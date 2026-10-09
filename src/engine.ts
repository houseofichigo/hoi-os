import {
  readFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  chmodSync,
  statSync,
} from "node:fs";
import { hostname } from "node:os";
import { randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import { AsyncEntry } from "@napi-rs/keyring";
import { Store } from "./store.js";
import { safePath, atomic, sha } from "./files.js";
import { acquireLock } from "./locks.js";
import {
  executeOperation,
  operationInfo,
  operationCatalog,
  ENGINE_API_VERSION,
} from "./operations.js";
import type { Host } from "./schema.js";
const sessionDir = (root: string) => safePath(root, ".hoi/engine-session");
const descriptorPath = (root: string) =>
  safePath(root, ".hoi/engine-session/endpoint.json");
function protect(path: string, directory = false) {
  if (process.platform !== "win32") {
    chmodSync(path, directory ? 0o700 : 0o600);
    const st = statSync(path);
    if (st.mode & 0o077 || st.uid !== process.getuid?.())
      throw Error("ENGINE_CREDENTIAL_PERMISSIONS");
  }
}
function checkPrivate(path: string) {
  if (process.platform !== "win32") {
    const st = statSync(path);
    if (st.mode & 0o077 || st.uid !== process.getuid?.())
      throw Error(
        "ENGINE_CREDENTIAL_PERMISSIONS: Repair private workspace permissions",
      );
  }
}
const keyring = (root: string, host: string) =>
  new AsyncEntry("houseofichigo.hoi-os.engine", sha(root) + ":" + host);
async function saveCredential(root: string, host: string, token: string) {
  if (process.platform === "win32") {
    try {
      await keyring(root, host).setPassword(token);
    } catch {
      throw Error(
        "ENGINE_CREDENTIAL_STORE_UNAVAILABLE: Unlock the OS credential store",
      );
    }
  } else {
    const path = safePath(root, `.hoi/engine-session/${host}.credential`);
    atomic(path, token);
    protect(path);
  }
}
export async function readEngineCredential(root: string, host: string) {
  if (!["local", "codex", "claude"].includes(host))
    throw Error("ENGINE_HOST_UNAVAILABLE");
  if (process.platform === "win32") {
    try {
      const token = await keyring(root, host).getPassword();
      if (!token) throw Error();
      return token;
    } catch {
      throw Error("ENGINE_CREDENTIAL_STORE_UNAVAILABLE");
    }
  }
  const path = safePath(root, `.hoi/engine-session/${host}.credential`);
  if (!existsSync(path)) throw Error("ENGINE_HOST_UNAVAILABLE");
  checkPrivate(sessionDir(root));
  checkPrivate(path);
  return readFileSync(path, "utf8");
}
export async function createEngineSession(s: Store) {
  const release = acquireLock(s.root, "engine"),
    tokens = new Map<string, Host>();
  const credentials = new Map<Host, string>();
  if (s.schemaVersion >= 11)
    s.exec(
      "UPDATE intake_jobs SET state='interrupted',reason='ENGINE_RESTART' WHERE state='processing'",
    );
  let accepting = true,
    tail: Promise<unknown> = Promise.resolve(),
    closed = false;
  const boot = randomUUID();
  try {
    mkdirSync(sessionDir(s.root), { recursive: true, mode: 0o700 });
    protect(sessionDir(s.root), true);
    // Publication is last: a half-created session must never be discoverable.
    rmSync(descriptorPath(s.root), { force: true });
    for (const h of ["local", "codex", "claude"]) {
      try {
        s.assertHost(h);
      } catch {
        continue;
      }
      const token = randomBytes(32).toString("hex");
      await saveCredential(s.root, h, token);
      tokens.set(token, h);
      credentials.set(h, token);
    }
  } catch (e) {
    rmSync(sessionDir(s.root), { recursive: true, force: true });
    release();
    throw e;
  }
  const enqueue = <T>(fn: () => Promise<T> | T): Promise<T> => {
    if (!accepting)
      return Promise.reject(
        Error("ENGINE_STOPPING: Wait for shutdown to complete"),
      );
    const next = tail.then(fn);
    tail = next.catch(() => {});
    return next;
  };
  return {
    enqueue,
    authenticate(bearer: string) {
      for (const [token, host] of tokens)
        if (
          bearer.length === token.length &&
          timingSafeEqual(Buffer.from(bearer), Buffer.from(token))
        )
          return host;
      return undefined;
    },
    publish(port: number) {
      atomic(
        descriptorPath(s.root),
        JSON.stringify({
          apiVersion: ENGINE_API_VERSION,
          port,
          pid: process.pid,
          hostname: hostname(),
          workspace: sha(s.root),
          boot,
        }),
      );
      protect(descriptorPath(s.root));
    },
    status: () => ({
      apiVersion: ENGINE_API_VERSION,
      schemaVersion: s.schemaVersion,
      state: accepting ? "running" : "stopping",
      operations: operationCatalog(),
    }),
    execute(host: Host, raw: unknown, requestId: string) {
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))
        return Promise.reject(Error("REQUEST_ID_INVALID"));
      const control = raw as any;
      if (
        (control?.command === "jobs" &&
          ["cancel", "list", undefined].includes(control?.args?.[0])) ||
        (control?.command === "app-action" &&
          control?.args?.[0] === "/api/intake/jobs/control" &&
          control?.input?.action === "cancel") ||
        (control?.command === "sync" &&
          control?.args?.[0] === "control" &&
          control?.input?.action === "pause") ||
        (control?.command === "app-action" &&
          control?.args?.[0] === "/api/sync/control" &&
          control?.input?.action === "pause")
      ) {
        if (!accepting) return Promise.reject(Error("ENGINE_STOPPING"));
        // Cancellation writes control state only; active work observes it before indexing.
        return executeOperation(s, host, raw);
      }
      return enqueue(async () => {
        const info = operationInfo(raw);
        s.assertHost(host);
        if (info.exclusive)
          throw Error(
            "ENGINE_MAINTENANCE_REQUIRED: Stop the app before upgrading",
          );
        if (info.action === "read") return executeOperation(s, host, raw);
        const path = s.path(`.hoi/engine-receipts/${host}-${requestId}.json`),
          digest = sha(JSON.stringify(raw));
        if (existsSync(path)) {
          const saved = JSON.parse(readFileSync(path, "utf8"));
          if (saved.digest !== digest)
            throw Error(
              "REQUEST_ID_CONFLICT: Use a new request ID for changed input",
            );
          // Never return cached private content after permissions change. Receipts acknowledge completion only.
          if (saved.state === "completed")
            return {
              replayed: true,
              requestId,
              state: "completed",
              operation: info.name,
            };
          throw Error(
            "ENGINE_OUTCOME_UNKNOWN: Inspect records before submitting a new request",
          );
        }
        atomic(
          path,
          JSON.stringify({
            digest,
            state: "started",
            operation: info.name,
            at: new Date().toISOString(),
          }),
        );
        const result = await executeOperation(s, host, raw);
        atomic(
          path,
          JSON.stringify({
            digest,
            state: "completed",
            operation: info.name,
            at: new Date().toISOString(),
          }),
        );
        return result;
      });
    },
    async stop() {
      if (closed) return;
      closed = true;
      accepting = false;
      await tail;
      rmSync(sessionDir(s.root), { recursive: true, force: true });
      if (process.platform === "win32")
        for (const h of credentials.keys()) {
          try {
            await keyring(s.root, h).deletePassword();
          } catch {}
        }
      tokens.clear();
      if (existsSync(s.path(".hoi/lock/owner.json"))) release();
    },
  };
}
export async function callEngine(
  root: string,
  host: Host,
  operation: unknown,
  suppliedId?: string,
): Promise<{ connected: boolean; result?: any }> {
  if (!existsSync(descriptorPath(root))) return { connected: false };
  checkPrivate(descriptorPath(root));
  const d = JSON.parse(readFileSync(descriptorPath(root), "utf8"));
  if (d.apiVersion !== ENGINE_API_VERSION)
    throw Error("ENGINE_VERSION_MISMATCH: Use the installed engine's CLI");
  if (
    d.hostname !== hostname() ||
    d.workspace !== sha(root) ||
    !Number.isInteger(d.port) ||
    d.port < 1 ||
    d.port > 65535 ||
    !Number.isSafeInteger(d.pid) ||
    d.pid <= 0
  )
    throw Error("ENGINE_DESCRIPTOR_INVALID");
  try {
    process.kill(d.pid, 0);
  } catch {
    throw Error(
      "ENGINE_UNAVAILABLE: Run recover-lock after the owner has stopped, then restart the app before retrying",
    );
  }
  const credential = await readEngineCredential(root, host),
    requestId = suppliedId || randomUUID();
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:${d.port}/api/engine/call`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        apiVersion: ENGINE_API_VERSION,
        requestId,
        operation,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(300000),
    });
  } catch {
    throw Error(
      `ENGINE_RESPONSE_UNCERTAIN: Inspect state or retry with --request-id ${requestId}; no automatic retry was attempted`,
    );
  }
  const payload = (await response.json()) as any;
  if (!response.ok) throw Error(payload.error || "ENGINE_REQUEST_FAILED");
  return { connected: true, result: payload.result };
}
