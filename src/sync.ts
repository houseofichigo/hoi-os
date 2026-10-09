import { prepareFile } from "./file-work.js";
import { localSource, recordLocation } from "./local-identity.js";
import { emailBody } from "./email-text.js";
import { processingRequests } from "./daily-workspace.js";
import { z } from "zod";
import { AsyncEntry } from "@napi-rs/keyring";
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import {
  readFileSync,
  statSync,
  readdirSync,
  lstatSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join, resolve, extname } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "./store.js";
import { uid, now, sha, atomic, assertInput } from "./files.js";
import { type Host } from "./schema.js";
import { hubAccess } from "./hub.js";
import { ingest } from "./intake.js";
import { wallInstant } from "./daily.js";
import { importWork } from "./work-intake.js";
export const SYNC_SQL = `CREATE TABLE IF NOT EXISTS sync_connections(id TEXT PRIMARY KEY,host TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,preview TEXT,last_success TEXT,error TEXT);
CREATE TABLE IF NOT EXISTS sync_items(connection_id TEXT NOT NULL,remote_id TEXT NOT NULL,stamp TEXT NOT NULL,source_id TEXT NOT NULL,PRIMARY KEY(connection_id,remote_id));
CREATE TABLE IF NOT EXISTS sync_runs(id TEXT PRIMARY KEY,connection_id TEXT NOT NULL,state TEXT NOT NULL,processed INTEGER NOT NULL,error TEXT,at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS work_assignments(item_key TEXT PRIMARY KEY,project_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assistant_queue(source_id TEXT PRIMARY KEY,revision_id TEXT NOT NULL,state TEXT NOT NULL);`;
const configSchema = z
  .object({
    provider: z.enum(["files", "gmail", "calendar", "drive"]),
    label: z.string().min(1).max(100),
    folder: z.string().optional(),
    query: z.string().max(1000).optional(),
    calendarId: z.string().optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    coverageMode: z.enum(["fixed", "rolling"]).default("fixed"),
    rollingDays: z.number().int().min(1).max(90).default(30),
    maxItems: z.number().int().min(1).max(1000).default(150),
    fileIds: z.array(z.string().min(1)).max(150).optional(),
    folderIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      (v.provider === "files" && !v.folder) ||
      (v.provider === "gmail" && !v.query) ||
      (v.provider === "calendar" &&
        (!v.calendarId ||
          !v.from ||
          !v.to ||
          Date.parse(v.to) <= Date.parse(v.from))) ||
      (v.provider === "drive" && !v.fileIds?.length && !v.folderIds?.length)
    )
      c.addIssue({
        code: "custom",
        message: "Select an explicit provider scope",
      });
  });
const credential = (s: Store, key: string) =>
  new AsyncEntry("houseofichigo.hoi-os.google", sha(s.root) + ":" + key);
function access(s: Store, h: Host, write = false) {
  s.assertSchema(10, "Connections");
  hubAccess(s, h, write);
}
function connection(s: Store, key: string, h: Host) {
  access(s, h);
  const r = s.one(
    "SELECT * FROM sync_connections WHERE id=? AND host=?",
    key,
    h,
  );
  if (!r) throw Error("Connection unavailable");
  return {
    ...r,
    config: {
      coverageMode: "fixed",
      rollingDays: 30,
      maxItems: 150,
      ...JSON.parse(r.payload),
    },
  };
}
export function connections(s: Store, h: Host) {
  access(s, h);
  return s.all("SELECT id FROM sync_connections WHERE host=?", h).map((r) => {
    const c = connection(s, r.id, h);
    const checkpoint =
      s.schemaVersion >= 11
        ? s.one(
            "SELECT payload FROM sync_checkpoints WHERE connection_id=?",
            c.id,
          )
        : null;
    const window = checkpoint
      ? JSON.parse(checkpoint.payload).window || {}
      : {};
    return {
      id: c.id,
      version: c.version,
      ...c.config,
      state: c.state,
      lastSuccess: c.last_success,
      error: c.error,
      coverage: {
        mode:
          c.config.provider === "calendar"
            ? c.config.coverageMode
            : "selected-scope",
        from: window.from || c.config.from || null,
        to: window.to || c.config.to || null,
        lastSuccess: c.last_success,
        state: c.error ? "partial" : c.last_success ? "current" : "unknown",
      },
      items:
        s.schemaVersion < 11
          ? []
          : s
              .all(
                "SELECT i.* FROM sync_run_items i JOIN sync_runs r ON r.id=i.run_id WHERE r.connection_id=? ORDER BY r.at DESC LIMIT 150",
                c.id,
              )
              .filter(
                (i) =>
                  !i.source_id ||
                  s.allowed(
                    s.one("SELECT * FROM sources WHERE id=?", i.source_id),
                    h,
                    true,
                  ),
              )
              .map((i) => ({
                runId: i.run_id,
                state: i.state,
                reason: i.reason,
                name: JSON.parse(i.payload).name,
              })),
      runs: s.all(
        "SELECT id,state,processed,error,at FROM sync_runs WHERE connection_id=? ORDER BY at DESC LIMIT 10",
        c.id,
      ),
    };
  });
}
export function createConnection(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const value = configSchema.parse(input);
  if (value.folder) {
    assertInput(value.folder);
    if (!statSync(value.folder).isDirectory())
      throw Error("Choose a directory");
    value.folder = resolve(value.folder);
    if (
      value.folder === resolve(s.root) ||
      value.folder.startsWith(resolve(s.root) + "/")
    )
      throw Error("Do not synchronize the private workspace itself");
  }
  const key = uid("connection");
  s.exec(
    "INSERT INTO sync_connections VALUES(?,?,?,?,?,?,?,?)",
    key,
    h,
    1,
    JSON.stringify(value),
    value.provider === "files" ? "needs-preview" : "needs-auth",
    null,
    null,
    null,
  );
  return { id: key };
}
const scopes: any = {
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
  drive: "https://www.googleapis.com/auth/drive.readonly",
};
export async function oauthStart(
  s: Store,
  key: string,
  input: unknown,
  h: Host,
) {
  access(s, h, true);
  const c = connection(s, key, h);
  if (c.config.provider === "files") throw Error("No OAuth needed");
  const v = z
    .object({
      clientId: z.string().endsWith(".apps.googleusercontent.com"),
      clientSecret: z.string().min(1),
      writeActions: z.boolean().default(false),
    })
    .strict()
    .parse(input);
  if (c.state === "syncing") throw Error("Wait for sync to finish");
  s.exec(
    "UPDATE sync_connections SET state='needs-auth',preview=NULL WHERE id=?",
    key,
  );
  const entry = credential(s, key);
  try {
    await entry.setPassword(JSON.stringify(v));
    if (!(await entry.getPassword())) throw Error();
  } catch {
    throw Error(
      "SECURE_STORE_UNAVAILABLE: Unlock your operating-system credential store",
    );
  }
  const verifier = randomBytes(32).toString("base64url"),
    state = randomBytes(32).toString("hex");
  let redirect = "";
  const callback = createServer(async (req, res) => {
    try {
      const u = new URL(req.url || "/", redirect);
      if (
        req.headers.host !== new URL(redirect).host ||
        u.pathname !== "/callback" ||
        u.searchParams.get("state") !== state ||
        !u.searchParams.get("code")
      )
        throw Error();
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: v.clientId,
          client_secret: v.clientSecret,
          grant_type: "authorization_code",
          code: u.searchParams.get("code")!,
          code_verifier: verifier,
          redirect_uri: redirect,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw Error();
      const t: any = await r.json();
      if (!t.refresh_token) throw Error();
      const identityResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: "Bearer " + t.access_token },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!identityResponse.ok) throw Error();
      const identity: any = await identityResponse.json();
      if (
        !identity.id ||
        (c.config.accountId && c.config.accountId !== identity.id)
      )
        throw Error("Account changed");
      c.config.writeActions = v.writeActions;
      c.config.accountId = identity.id;
      c.config.accountEmail = identity.email;

      await entry.setPassword(
        JSON.stringify({
          ...v,
          ...t,
          expires: Date.now() + t.expires_in * 1000,
        }),
      );
      s.exec(
        "UPDATE sync_connections SET state='needs-preview',error=NULL,payload=? WHERE id=?",
        JSON.stringify(c.config),
        key,
      );
      res.end("Connected. Return to HOI OS and preview the selected scope.");
    } catch {
      res.statusCode = 400;
      res.end("Authorization failed. Return to HOI OS and reconnect.");
    } finally {
      callback.close();
      clearTimeout(timer);
    }
  });
  await new Promise<void>((ok) => callback.listen(0, "127.0.0.1", ok));
  redirect =
    "http://127.0.0.1:" + (callback.address() as any).port + "/callback";
  const timer = setTimeout(() => callback.close(), 300000);
  timer.unref();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: v.clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope:
      "openid email " +
      scopes[c.config.provider] +
      (v.writeActions
        ? c.config.provider === "gmail"
          ? " https://www.googleapis.com/auth/gmail.compose"
          : c.config.provider === "calendar"
            ? " https://www.googleapis.com/auth/calendar.events"
            : ""
        : ""),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return { url: url.toString() };
}
async function google(
  s: Store,
  key: string,
  path: string,
  bytes = false,
  post?: unknown,
  requiredScope?: string,
) {
  let auth: any;
  const entry = credential(s, key);
  try {
    const raw = await entry.getPassword();
    if (!raw) throw Error();
    auth = JSON.parse(raw);
    if (!auth.refresh_token) throw Error();
    if (auth.expires < Date.now() + 60000) {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: auth.clientId,
          client_secret: auth.clientSecret,
          grant_type: "refresh_token",
          refresh_token: auth.refresh_token,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw Error();
      const t: any = await r.json();
      auth = { ...auth, ...t, expires: Date.now() + t.expires_in * 1000 };
      await entry.setPassword(JSON.stringify(auth));
    }
  } catch {
    throw Error("RECONNECT_REQUIRED");
  }
  if (
    !path.startsWith("https://www.googleapis.com/") &&
    !path.startsWith("https://gmail.googleapis.com/")
  )
    throw Error("Provider URL denied");
  if (requiredScope && !(auth.scope || " ").split(" ").includes(requiredScope))
    throw Error("WRITE_RECONNECT_REQUIRED");
  const r = await providerFetch(path, {
    method: post ? "POST" : "GET",
    ...(post ? { body: JSON.stringify(post) } : {}),
    headers: {
      Authorization: "Bearer " + auth.access_token,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30000),
    redirect: "error",
  });
  if (!r.ok)
    throw Error(
      r.status === 401 ? "RECONNECT_REQUIRED" : "PROVIDER_" + r.status,
    );
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of r.body as any) {
    size += chunk.length;
    if (size > 50 * 1024 * 1024) {
      await r.body?.cancel().catch(() => {});
      throw Error("FILE_TOO_LARGE");
    }
    chunks.push(Buffer.from(chunk));
  }
  const content = Buffer.concat(chunks);
  return bytes ? content : JSON.parse(content.toString());
}
async function providerFetch(url: string, options: any) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(30000),
    });
    if (
      options.method === "POST" ||
      ![429, 500, 502, 503, 504].includes(response.status) ||
      attempt === 2
    )
      return response;
    await response.body?.cancel();
    await new Promise((ok) =>
      setTimeout(ok, Math.min(4000, 500 * 2 ** attempt)),
    );
  }
  throw Error("PROVIDER_UNAVAILABLE");
}
export function emailSegments(text: string) {
  const out: { text: string; quoted: boolean }[] = [];
  let quoted = false;
  for (const line of text.split("\n")) {
    if (
      /^\s*(On .+wrote:|Le .+écrit\s*:|-+\s*(Original Message|Forwarded message)|Begin forwarded message)/i.test(
        line,
      )
    )
      quoted = true;
    const q = quoted || /^\s*>/.test(line);
    for (const chunk of (line || " ").match(/[\s\S]{1,12000}/g) || []) {
      const prev = out[out.length - 1];
      if (
        prev &&
        prev.quoted === q &&
        prev.text.length + chunk.length + 1 <= 12000
      )
        prev.text += "\n" + chunk;
      else out.push({ text: chunk, quoted: q });
    }
  }
  if (out.length > 300) throw Error("EMAIL_TOO_LARGE");
  return out;
}
async function selected(s: Store, c: any): Promise<any[]> {
  const v = c.config;
  if (v.provider === "files") {
    const out: any[] = [];
    const walk = async (dir: string) => {
      for (const name of readdirSync(dir).sort()) {
        const path = join(dir, name);
        if (
          name.startsWith(".") ||
          ["node_modules", "dist", "archives", "originals", "backups"].includes(
            name,
          ) ||
          lstatSync(path).isSymbolicLink()
        ) {
          out.push({ id: path, name, size: 0, reason: "EXCLUDED_PATH" });
          if (out.length > v.maxItems)
            throw Error("SCOPE_TOO_LARGE: Select a smaller folder");
          continue;
        }
        try {
          assertInput(path);
          const st = statSync(path);
          if (st.isDirectory()) await walk(path);
          else
            out.push({
              id: path,
              name,
              size: st.size,
              ...(st.size > 50 * 1024 * 1024
                ? { reason: "FILE_TOO_LARGE" }
                : { stamp: (await prepareFile(path)).checksum }),
            });
        } catch {
          out.push({ id: path, name, size: 0, reason: "INACCESSIBLE" });
        }
        if (
          out.length > v.maxItems ||
          out.reduce((n, f) => n + f.size, 0) > 1024 ** 3
        )
          throw Error("SCOPE_TOO_LARGE: Select a smaller folder");
      }
    };
    await walk(v.folder);
    return out;
  }
  if (v.provider === "gmail") {
    const r: any = await googlePages(
      s,
      c,
      "messages",
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
        new URLSearchParams({ q: v.query, maxResults: "150" }),
    );

    const messages = new Map<string, any>();
    for (const threadId of new Set<string>(
      (r.messages || []).map((m: any) => m.threadId),
    )) {
      const thread: any = await google(
        s,
        c.id,
        "https://gmail.googleapis.com/gmail/v1/users/me/threads/" +
          encodeURIComponent(threadId) +
          "?format=metadata",
      );
      for (const m of thread.messages || []) {
        const subject = (m.payload?.headers || []).find(
          (x: any) => x.name.toLowerCase() === "subject",
        )?.value;
        messages.set(m.id, {
          id: m.id,
          name: subject || "Email",
          threadId,
          stamp: m.historyId,
          contextOnly: !(r.messages || []).some(
            (selected: any) => selected.id === m.id,
          ),
        });
      }
      if (messages.size > v.maxItems)
        throw Error("SCOPE_TOO_LARGE: Narrow the Gmail query");
    }
    return [...messages.values()];
  }
  if (v.provider === "calendar") {
    const window =
      v.coverageMode === "rolling"
        ? {
            from: now(),
            to: new Date(Date.now() + v.rollingDays * 86400000).toISOString(),
          }
        : v;
    c.window = { from: window.from, to: window.to };
    const r: any = await googlePages(
      s,
      c,
      "items",
      "https://www.googleapis.com/calendar/v3/calendars/" +
        encodeURIComponent(v.calendarId) +
        "/events?" +
        new URLSearchParams({
          timeMin: window.from,
          timeMax: window.to,
          singleEvents: "true",
          showDeleted: "true",
          maxResults: "150",
        }),
    );

    return (r.items || []).map((e: any) => ({
      id: e.id,
      name: e.summary || "Calendar event",
      stamp: e.updated,
      event: e,
      timezone: r.timeZone || "UTC",
    }));
  }
  const found = new Map<string, any>();
  for (const key of v.fileIds || []) {
    const f: any = await google(
      s,
      c.id,
      "https://www.googleapis.com/drive/v3/files/" +
        encodeURIComponent(key) +
        "?fields=id,name,mimeType,modifiedTime,size&supportsAllDrives=true",
    );
    found.set(f.id, f);
  }
  const pending = [...(v.folderIds || [])],
    seen = new Set<string>();
  while (pending.length) {
    const folder = pending.shift()!;
    if (seen.has(folder)) continue;
    seen.add(folder);
    if (seen.size > 150) throw Error("SCOPE_TOO_LARGE");
    const r: any = await googlePages(
      s,
      c,
      "files",
      "https://www.googleapis.com/drive/v3/files?" +
        new URLSearchParams({
          q:
            "'" +
            folder.replaceAll("'", "\\'") +
            "' in parents and trashed=false",
          fields: "files(id,name,mimeType,modifiedTime,size),nextPageToken",
          pageSize: "150",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
        }),
    );

    for (const f of r.files || []) {
      if (f.mimeType === "application/vnd.google-apps.folder")
        pending.push(f.id);
      else found.set(f.id, f);
    }
    if (found.size > v.maxItems) throw Error("SCOPE_TOO_LARGE");
  }
  return [...found.values()].map((f) => ({ ...f, stamp: f.modifiedTime }));
}
export async function previewConnection(s: Store, key: string, h: Host) {
  access(s, h, true);
  const c = connection(s, key, h);
  if (["active", "syncing"].includes(c.state))
    throw Error("Pause before reviewing scope");
  const items = await selected(s, c);
  const digest = sha(JSON.stringify({ config: c.config, items }));
  s.exec(
    "UPDATE sync_connections SET preview=?,state='needs-preview' WHERE id=?",
    JSON.stringify({ digest, items, at: now() }),
    key,
  );
  const visible = items.filter((item) => {
    let source = s.one(
      "SELECT s.* FROM sources s JOIN sync_items i ON i.source_id=s.id WHERE i.connection_id=? AND i.remote_id=?",
      key,
      item.id,
    );
    if (!source && c.config.provider === "files") {
      source = s.one(
        "SELECT * FROM sources WHERE source_key=?",
        "files:" + resolve(item.id),
      );
      if (!source && item.stamp) {
        try {
          source = localSource(s, item.id, item.stamp);
        } catch {
          return true;
        }
      }
    }
    return !source || s.allowed(source, h, true);
  });
  return { digest, items: visible };
}
export async function controlConnection(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
      .object({
        id: z.string(),
        action: z.enum(["activate", "pause", "disconnect"]),
        digest: z.string().optional(),
      })
      .strict()
      .parse(input),
    c = connection(s, v.id, h);
  if (c.state === "syncing" && v.action !== "pause")
    throw Error("Pause and wait for current sync before changing its scope");
  if (v.action === "activate") {
    const preview = c.preview && JSON.parse(c.preview);
    if (
      !preview ||
      preview.digest !== v.digest ||
      Date.now() - Date.parse(preview.at) > 3600000
    )
      throw Error("Preview selected scope again");
  }
  if (v.action === "disconnect" && c.config.provider !== "files") {
    try {
      await credential(s, c.id).deleteCredential();
    } catch {
      throw Error("SECURE_STORE_UNAVAILABLE");
    }
  }
  s.exec(
    "UPDATE sync_connections SET state=?,version=version+1 WHERE id=?",
    v.action === "activate"
      ? "active"
      : v.action === "pause"
        ? "paused"
        : "disconnected",
    c.id,
  );
  return { id: c.id };
}
const locks = new Set<string>();
export async function syncConnection(s: Store, key: string, h: Host) {
  access(s, h, true);
  const c = connection(s, key, h);
  if (c.state !== "active")
    throw Error("Activate a reviewed scope before synchronizing");
  if (locks.has(s.root)) throw Error("SYNC_BUSY");
  locks.add(s.root);
  const run = uid("sync");
  s.exec(
    "INSERT INTO sync_runs VALUES(?,?,?,?,?,?)",
    run,
    key,
    "running",
    0,
    null,
    now(),
  );
  s.exec("UPDATE sync_connections SET state='syncing' WHERE id=?", key);
  let processed = 0,
    failed = 0;
  const outcomes: any[] = [];
  const mark = (
    item: any,
    state: string,
    reason: string | null = null,
    sourceId: string | null = null,
  ) => {
    if (s.schemaVersion >= 11)
      s.exec(
        "INSERT INTO sync_run_items VALUES(?,?,?,?,?,?) ON CONFLICT(run_id,remote_id) DO UPDATE SET state=excluded.state,reason=excluded.reason,source_id=excluded.source_id",
        run,
        item.id,
        state,
        reason,
        JSON.stringify(item),
        sourceId,
      );
    if (state !== "processing")
      outcomes.push({ id: item.id, state, reason, sourceId });
  };
  try {
    const changes = await changeHint(s, c);
    const items = (await selected(s, c)).map((item) => ({
      ...item,
      scopeVersion: c.version,
    }));
    if (s.schemaVersion >= 11)
      s.tx(() => {
        for (const item of items) mark(item, "queued");
      });
    outcomes.length = 0;
    for (const saved of s.all(
      "SELECT * FROM sync_items WHERE connection_id=?",
      key,
    )) {
      if (
        items.some(
          (i) =>
            i.id === saved.remote_id ||
            (c.config.provider === "files" &&
              i.stamp &&
              i.stamp === saved.stamp),
        )
      )
        continue;
      const src = s.one("SELECT * FROM sources WHERE id=?", saved.source_id);
      if (!src || !s.allowed(src, h)) continue;
      const fingerprint = sha(
        JSON.stringify([key, saved.remote_id, src.current_revision, "missing"]),
      );
      s.exec(
        "INSERT OR IGNORE INTO source_reviews VALUES(?,?,?,?,?,?,?)",
        "sr_" + sha(h + fingerprint),
        src.id,
        h,
        fingerprint,
        JSON.stringify({
          title: src.title,
          sourceId: src.id,
          problems: [
            "No longer present in selected scope; verify upstream availability before archiving",
          ],
        }),
        "pending",
        now(),
      );
    }
    for (const item of items) {
      access(s, h, true);
      mark(item, "processing");
      if (item.reason) {
        mark(item, "skipped", item.reason);
        if (item.reason === "INACCESSIBLE") failed++;
        continue;
      }
      try {
        if (s.schemaVersion >= 11) {
          const failures = s
            .all(
              "SELECT payload FROM sync_run_items i JOIN sync_runs r ON r.id=i.run_id WHERE r.connection_id=? AND i.remote_id=? AND i.state IN ('failed','extraction-gap')",
              key,
              item.id,
            )
            .filter((row) => {
              const old = JSON.parse(row.payload);
              return (
                old.stamp === item.stamp &&
                old.scopeVersion === item.scopeVersion
              );
            }).length;
          if (failures >= 3) {
            mark(item, "skipped", "RETRY_LIMIT_REACHED");
            failed++;
            continue;
          }
        }
        if (connection(s, key, h).state !== "syncing")
          throw Error("SYNC_PAUSED");
        const sourceKey =
          c.config.provider === "files"
            ? "files:" + resolve(item.id)
            : "sync:" +
              (c.config.accountId || key) +
              ":" +
              c.config.provider +
              ":" +
              item.id;
        const moved =
          c.config.provider === "files"
            ? localSource(s, item.id, item.stamp)
            : null;
        const prior =
          s.one(
            "SELECT * FROM sync_items WHERE connection_id=? AND remote_id=?",
            key,
            item.id,
          ) ||
          s.one(
            "SELECT id source_id, '' stamp FROM sources WHERE source_key=?",
            sourceKey,
          ) ||
          (moved ? { source_id: moved.id, stamp: "" } : null);
        if (
          prior &&
          !s.allowed(
            s.one("SELECT * FROM sources WHERE id=?", prior.source_id),
            h,
            true,
          )
        ) {
          mark(item, "skipped", "SOURCE_UNAVAILABLE", prior.source_id);
          continue;
        }
        if (
          prior &&
          s.one(
            "SELECT state FROM source_lifecycle WHERE source_id=?",
            prior.source_id,
          )?.state === "archived"
        ) {
          mark(item, "skipped", "ARCHIVED", prior.source_id);
          if (c.config.provider === "files")
            recordLocation(s, prior.source_id, item.id, item.stamp);
          continue;
        }
        if (prior && item.stamp && prior.stamp === item.stamp) {
          s.exec(
            "UPDATE sources SET last_checked=? WHERE id=?",
            now(),
            prior.source_id,
          );
          for (const row of s.all(
            "SELECT id,item FROM work_intake WHERE source_id=? AND state='ready'",
            prior.source_id,
          )) {
            const item = JSON.parse(row.item);
            s.exec(
              "UPDATE work_intake SET item=? WHERE id=?",
              JSON.stringify({ ...item, checkedAt: now() }),
              row.id,
            );
          }
          mark(item, "unchanged", null, prior.source_id);
          continue;
        }
        const meta = prior
          ? JSON.parse(
              s.one("SELECT metadata FROM sources WHERE id=?", prior.source_id)
                .metadata,
            )
          : { allowedHosts: ["local", "codex", "claude"] };
        let result: any;
        const v = c.config;
        if (v.provider === "files")
          result = await ingest(s, item.id, {
            host: h,
            ...(prior ? { sourceId: prior.source_id } : {}),
            sourceKey,
            metadata: { ...meta, title: item.name },
          });
        else if (v.provider === "gmail") {
          const m: any = await google(
            s,
            key,
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
              item.id +
              "?format=full",
          );
          atomic(
            s.path(
              "archives/" + now().slice(0, 10) + "/" + uid("gmail") + ".json",
            ),
            JSON.stringify(m),
          );
          const headers = Object.fromEntries(
            (m.payload.headers || []).map((x: any) => [
              x.name.toLowerCase(),
              x.value,
            ]),
          );
          const text = emailBody(m.payload);
          if (!text) throw Error("EMAIL_TEXT_UNAVAILABLE");
          result = await importWork(
            s,
            {
              kind: "email",
              account: c.config.accountId || key,
              remoteId: m.id,
              threadId: m.threadId,
              title: headers.subject || "Email",
              occurredAt: new Date(+m.internalDate).toISOString(),
              updatedAt: new Date(+m.internalDate).toISOString(),
              checkedAt: now(),
              projectId: null,
              email: {
                direction: (m.labelIds || []).includes("SENT")
                  ? "outgoing"
                  : "incoming",
                sender: headers.from || "",
                recipients: (headers.to || "").split(","),
                draft: (m.labelIds || []).includes("DRAFT"),
                spam: (m.labelIds || []).includes("SPAM"),
                trash: (m.labelIds || []).includes("TRASH"),
                automated:
                  (!!headers["auto-submitted"] &&
                    headers["auto-submitted"] !== "no") ||
                  !!headers["list-id"],
              },
              segments: emailSegments(text),
              metadata: meta,
            },
            h,
          );
          item.stamp = m.historyId;
        } else if (v.provider === "calendar") {
          const e = item.event;
          atomic(
            s.path(
              "archives/" + now().slice(0, 10) + "/" + uid("event") + ".json",
            ),
            JSON.stringify(e),
          );
          if ((!e.start || !e.end) && e.status === "cancelled" && prior) {
            const old = s.one(
              "SELECT item FROM work_intake WHERE source_id=? ORDER BY rowid DESC LIMIT 1",
              prior.source_id,
            );
            if (old) {
              const item = JSON.parse(old.item);
              e.start = {
                dateTime: item.calendar.start,
                timeZone: item.timezone,
              };
              e.end = { dateTime: item.calendar.end };
              e.updated = e.updated || now();
              e.summary = e.summary || item.title;
              e.originalStartTime = { dateTime: item.recurrenceId };
              e.recurringEventId = item.recurrenceId
                ? "cancelled-instance"
                : undefined;
            }
          }
          if (!e.start || !e.end) {
            mark(item, "skipped", "EVENT_TIME_UNAVAILABLE");
            failed++;
            continue;
          }
          const zone = e.start.timeZone || item.timezone || "UTC";
          const timed = (v: any) =>
            v.dateTime ||
            new Date(wallInstant(v.date, "00:00", zone) ?? NaN).toISOString();
          result = await importWork(
            s,
            {
              kind: "calendar",
              account: c.config.accountId || key,
              remoteId: e.id,
              title: e.summary || "Calendar event",
              occurredAt: timed(e.start),
              updatedAt: e.updated,
              checkedAt: now(),
              projectId: null,
              recurrenceId: e.recurringEventId
                ? e.originalStartTime?.dateTime ||
                  e.originalStartTime?.date ||
                  e.id
                : null,
              timezone: zone,
              cancelled: e.status === "cancelled",
              calendar: {
                start: timed(e.start),
                end: timed(e.end),
                participants: (e.attendees || []).map((a: any) => a.email),
                allDay: !!e.start.date,
                busy: e.transparency !== "transparent",
              },
              segments: [
                { text: e.description || e.summary || "Calendar event" },
              ],
              metadata: meta,
            },
            h,
          );
        } else {
          const exports: any = {
            "application/vnd.google-apps.document": [
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              ".docx",
            ],
            "application/vnd.google-apps.spreadsheet": [
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ".xlsx",
            ],
            "application/vnd.google-apps.presentation": [
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              ".pptx",
            ],
          };
          const ex = exports[item.mimeType],
            url =
              "https://www.googleapis.com/drive/v3/files/" +
              encodeURIComponent(item.id) +
              (ex
                ? "/export?mimeType=" + encodeURIComponent(ex[0])
                : "?alt=media&supportsAllDrives=true");
          const bytes: any = await google(s, key, url, true);
          const dir = mkdtempSync(join(tmpdir(), "hoi-sync-"));
          try {
            const file = join(
              dir,
              "document" + (ex ? ex[1] : extname(item.name)),
            );
            atomic(file, bytes);
            result = await ingest(s, file, {
              host: h,
              sourceKey,
              metadata: { ...meta, title: item.name },
            });
          } finally {
            rmSync(dir, { recursive: true, force: true });
          }
        }
        const sourceId =
          result.sourceId ||
          result.source_id ||
          result.source?.id ||
          (result.id
            ? s.one("SELECT source_id FROM work_intake WHERE id=?", result.id)
                ?.source_id
            : null);
        const source = sourceId
          ? s.one("SELECT * FROM sources WHERE id=?", sourceId)
          : null;
        if (!source) throw Error("INTAKE_RESULT_INVALID");
        const revision = s.one(
          "SELECT status FROM revisions WHERE id=?",
          source.current_revision,
        );
        if (revision?.status !== "ready") {
          mark(item, "extraction-gap", "EXTRACTION_GAP", sourceId);
          failed++;
          continue;
        }
        s.tx(() => {
          s.exec(
            "INSERT INTO sync_items VALUES(?,?,?,?) ON CONFLICT(connection_id,remote_id) DO UPDATE SET stamp=excluded.stamp,source_id=excluded.source_id",
            key,
            item.id,
            item.stamp || "",
            sourceId,
          );
          s.exec(
            "INSERT INTO assistant_queue VALUES(?,?,'awaiting-assistant') ON CONFLICT(source_id) DO UPDATE SET revision_id=excluded.revision_id,state=CASE WHEN revision_id=excluded.revision_id THEN state ELSE 'awaiting-assistant' END",
            sourceId,
            source.current_revision,
          );
          s.exec(
            "UPDATE sync_runs SET processed=? WHERE id=?",
            ++processed,
            run,
          );
        });
        mark(item, "completed", null, sourceId);
      } catch (e) {
        const reason =
          (e as Error).message.match(/^[A-Z][A-Z_0-9]+/)?.[0] || "ITEM_FAILED";
        mark(item, "failed", reason);
        failed++;
        if (reason === "RECONNECT_REQUIRED" || reason === "SYNC_PAUSED")
          throw e;
      }
    }
    s.exec(
      "UPDATE sync_runs SET state=?,error=? WHERE id=?",
      failed ? "partial" : "completed",
      failed ? "ITEMS_NEED_REVIEW" : null,
      run,
    );
    if (!failed && s.schemaVersion >= 11) {
      const histories = items
        .map((i) => i.stamp)
        .filter((v) => /^\d+$/.test(v || ""));
      const historyId = histories.sort((a, b) =>
        BigInt(a) < BigInt(b) ? 1 : -1,
      )[0];
      s.exec(
        "INSERT INTO sync_checkpoints VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET payload=excluded.payload",
        key,
        JSON.stringify({
          scope: sha(JSON.stringify(c.config)),
          historyId: historyId || changes.historyId,
          driveToken: changes.driveToken,
          at: now(),
          mode:
            c.config.provider === "calendar"
              ? c.config.coverageMode
              : "selected-scope-reconciliation",
          reason: changes.reason,
          window: c.window,
        }),
      );
    }
    s.exec(
      "UPDATE sync_connections SET state='active',last_success=?,error=NULL WHERE id=?",
      failed ? c.last_success : now(),
      key,
    );
    if (failed)
      s.exec(
        "UPDATE sync_connections SET error='ITEMS_NEED_REVIEW' WHERE id=?",
        key,
      );
    return {
      processed,
      failed,
      runId: run,
      outcomes: outcomes.filter(
        (o) =>
          !o.sourceId ||
          s.allowed(
            s.one("SELECT * FROM sources WHERE id=?", o.sourceId),
            h,
            true,
          ),
      ),
      reconciliation: changes.reason,
    };
  } catch (e) {
    const code =
      /^(RECONNECT_REQUIRED|SCOPE_TOO_LARGE|PROVIDER_\d+|SYNC_BUSY|EMAIL_TEXT_UNAVAILABLE|EMAIL_TOO_LARGE|SYNC_PAUSED)/.exec(
        (e as Error).message,
      )?.[0] || "SYNC_FAILED";
    s.exec("UPDATE sync_runs SET state='failed',error=? WHERE id=?", code, run);
    s.exec(
      "UPDATE sync_connections SET state=?,error=? WHERE id=?",
      code === "RECONNECT_REQUIRED" ? "needs-auth" : "paused",
      code,
      key,
    );
    throw Error(code + ": Review connection and retry");
  } finally {
    locks.delete(s.root);
  }
}
export function startSync(
  s: Store,
  h: Host,
  schedule: (fn: () => Promise<unknown>) => Promise<unknown> = (fn) => fn(),
) {
  if (s.schemaVersion < 10) return () => {};
  s.exec(
    "UPDATE sync_connections SET state='active',error='INTERRUPTED_SYNC_RESUMING' WHERE state='syncing'",
  );
  s.exec("UPDATE sync_runs SET state='interrupted' WHERE state='running'");
  if (s.schemaVersion >= 11)
    s.exec(
      "UPDATE sync_run_items SET state='interrupted',reason='ENGINE_RESTART' WHERE state IN ('processing','queued') AND run_id IN (SELECT id FROM sync_runs WHERE state='interrupted')",
    );
  let stopped = false;
  const tick = async () => {
    if (stopped || locks.has(s.root)) return;
    for (const c of connections(s, h).filter((c) => c.state === "active")) {
      if (stopped) break;
      try {
        await schedule(() => syncConnection(s, c.id, h));
      } catch {}
    }
  };
  const timer = setInterval(() => void tick(), 300000);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
export function assistantQueue(s: Store, h: Host) {
  access(s, h);
  return s
    .all(
      "SELECT q.*,s.title,s.metadata FROM assistant_queue q JOIN sources s ON s.id=q.source_id",
    )
    .filter((r) => s.allowed({ id: r.source_id, metadata: r.metadata }, h))
    .map(({ metadata, ...r }) => ({
      ...r,
      processing:
        s.schemaVersion >= 12
          ? processingRequests(s, h).filter(
              (p) =>
                p.source_id === r.source_id && p.revision_id === r.revision_id,
            )
          : [],
      intakeId: s.one(
        "SELECT id FROM work_intake WHERE source_id=? ORDER BY rowid DESC LIMIT 1",
        r.source_id,
      )?.id,
    }));
}

export function reviewQueue(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({ sourceId: z.string(), revisionId: z.string() })
    .strict()
    .parse(input);
  const row = assistantQueue(s, h).find(
    (r) => r.source_id === v.sourceId && r.revision_id === v.revisionId,
  );
  if (!row) throw Error("Queue item unavailable or changed");
  s.exec(
    "UPDATE assistant_queue SET state='user-reviewed' WHERE source_id=? AND revision_id=?",
    v.sourceId,
    v.revisionId,
  );
  return {
    state: "user-reviewed",
    meaning: "User-marked review; no validated assistant result implied",
  };
}

async function googlePages(s: Store, c: any, field: string, path: string) {
  const all: any[] = [];
  let page: any, token: string | undefined;
  const seen = new Set<string>();
  for (let count = 0; count < 20; count++) {
    const url = new URL(path);
    if (token) url.searchParams.set("pageToken", token);
    page = await google(s, c.id, url.toString());
    all.push(...(page[field] || []));
    if (all.length > c.config.maxItems)
      throw Error("SCOPE_TOO_LARGE: Provider item budget exceeded");
    token = page.nextPageToken;
    if (!token) return { ...page, [field]: all };
    if (seen.has(token)) throw Error("PROVIDER_CURSOR_LOOP");
    seen.add(token);
  }
  throw Error("SCOPE_TOO_LARGE: Provider page budget exceeded");
}

async function changeHint(s: Store, c: any): Promise<any> {
  if (s.schemaVersion < 11) return {};
  const row = s.one(
    "SELECT payload FROM sync_checkpoints WHERE connection_id=?",
    c.id,
  );
  const saved = row ? JSON.parse(row.payload) : {};
  const sameScope = saved.scope === sha(JSON.stringify(c.config));
  try {
    if (c.config.provider === "drive") {
      if (sameScope && saved.driveToken) {
        const changed = await googlePages(
          s,
          c,
          "changes",
          "https://www.googleapis.com/drive/v3/changes?" +
            new URLSearchParams({
              pageToken: saved.driveToken,
              pageSize: "150",
              fields: "nextPageToken,newStartPageToken,changes(fileId,removed)",
              supportsAllDrives: "true",
              includeItemsFromAllDrives: "true",
            }),
        );
        return {
          driveToken: changed.newStartPageToken,
          reason: "DRIVE_CHANGES_RECONCILED",
        };
      }
      const token: any = await google(
        s,
        c.id,
        "https://www.googleapis.com/drive/v3/changes/startPageToken?fields=startPageToken&supportsAllDrives=true",
      );
      return {
        driveToken: token.startPageToken,
        reason: "INITIAL_SCOPE_RESCAN",
      };
    }
    if (!sameScope) return {};
    if (c.config.provider === "gmail" && saved.historyId) {
      const history = await googlePages(
        s,
        c,
        "history",
        "https://gmail.googleapis.com/gmail/v1/users/me/history?" +
          new URLSearchParams({
            startHistoryId: saved.historyId,
            maxResults: "150",
            fields: "historyId,nextPageToken,history(id)",
          }),
      );
      return { historyId: history.historyId, reason: "HISTORY_RECONCILED" };
    }
    // Calendar date scopes and Drive selected-folder membership need bounded reconciliation.
    return { reason: "BOUNDED_SCOPE_RESCAN" };
  } catch (e) {
    if (/PROVIDER_(404|410)|SCOPE_TOO_LARGE/.test((e as Error).message)) {
      const token: any =
        c.config.provider === "drive"
          ? await google(
              s,
              c.id,
              "https://www.googleapis.com/drive/v3/changes/startPageToken?fields=startPageToken&supportsAllDrives=true",
            )
          : {};
      return {
        reason: (e as Error).message.startsWith("SCOPE_TOO_LARGE")
          ? "CHANGE_BUDGET_RESCAN"
          : "CURSOR_EXPIRED_RESCAN",
        driveToken: token.startPageToken,
      };
    }
    throw e;
  }
}

export async function googleWriteRequest(
  s: Store,
  key: string,
  provider: "gmail" | "calendar",
  path: string,
  body?: unknown,
) {
  if (s.policy().actions.external === "deny")
    throw Error("EXTERNAL_ACTION_DENIED");
  const c = connection(s, key, "local");
  if (
    c.config.provider !== provider ||
    !c.config.writeActions ||
    c.state !== "active"
  )
    throw Error("GOOGLE_WRITE_NOT_ENABLED");

  const prefix =
    provider === "gmail"
      ? "https://gmail.googleapis.com/gmail/v1/users/me/"
      : "https://www.googleapis.com/calendar/v3/";
  // Internal adapter boundary. No send endpoint, arbitrary URL or HTTP method is accepted.
  if (
    provider === "gmail" &&
    !/^(drafts(?:\/[^?]+)?|messages(?:\/[^?]+)?)(?:\?.*)?$/.test(path)
  )
    throw Error("GOOGLE_ACTION_DENIED");
  if (provider === "gmail" && body && path !== "drafts")
    throw Error("GOOGLE_ACTION_DENIED");
  return google(
    s,
    key,
    prefix + path,
    false,
    body,
    provider === "gmail"
      ? "https://www.googleapis.com/auth/gmail.compose"
      : "https://www.googleapis.com/auth/calendar.events",
  );
}
