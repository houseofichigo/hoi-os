import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { safePath, sha } from "./files.js";
import { hostname } from "node:os";
import { z } from "zod";
// Deliberately not a generic engine client. This credential never becomes a Host.
export async function triggerAutomationClient(
  root: string,
  credentialFile: string,
  input: unknown,
) {
  const body = z
    .object({
      triggerId: z.string().regex(/^[a-zA-Z0-9:_-]{8,160}$/),
      snapshot: z.unknown().optional(),
    })
    .strict()
    .parse(input);
  const path = resolve(credentialFile),
    stat = statSync(path);
  if (
    !stat.isFile() ||
    (process.platform !== "win32" &&
      ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()))
  )
    throw Error("AUTOMATION_CREDENTIAL_PERMISSIONS");
  const token = readFileSync(path, "utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(token))
    throw Error("AUTOMATION_CREDENTIAL_INVALID");
  const d = JSON.parse(
    readFileSync(safePath(root, ".hoi/engine-session/endpoint.json"), "utf8"),
  );
  if (
    d.workspace !== sha(resolve(root)) ||
    d.hostname !== hostname() ||
    !Number.isInteger(d.port) ||
    d.port < 1 ||
    d.port > 65535
  )
    throw Error("ENGINE_ENDPOINT_UNAVAILABLE");
  const response = await fetch(
    `http://127.0.0.1:${d.port}/api/automation-client/run`,
    {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw Error(
      `AUTOMATION_TRIGGER_HTTP_${response.status}: Inspect engine status; retry only with the same trigger identity.`,
    );
  return response.json();
}
