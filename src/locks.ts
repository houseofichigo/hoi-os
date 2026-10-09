import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  renameSync,
} from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { atomic, uid, now } from "./files.js";
export function inspectLock(root: string) {
  const path = join(root, ".hoi/lock");
  if (!existsSync(path)) return { code: "LOCK_CLEAR", state: "clear" };
  try {
    const owner = JSON.parse(readFileSync(join(path, "owner.json"), "utf8"));
    if (
      owner.hostname !== hostname() ||
      !Number.isSafeInteger(owner.pid) ||
      owner.pid <= 0
    )
      return { code: "LOCK_UNKNOWN", state: "unknown" };
    try {
      process.kill(owner.pid, 0);
      return { code: "LOCK_ACTIVE", state: "active" };
    } catch (e: any) {
      return e.code === "ESRCH"
        ? { code: "LOCK_STALE", state: "stale" }
        : { code: "LOCK_UNKNOWN", state: "unknown" };
    }
  } catch {
    return { code: "LOCK_UNKNOWN", state: "unknown" };
  }
}
export function acquireLock(root: string, command: string) {
  const path = join(root, ".hoi/lock");
  try {
    mkdirSync(path);
  } catch {
    throw Error(
      "LOCK_BUSY: Run doctor, then recover-lock only if the owner has stopped.",
    );
  }
  if (existsSync(`${root}.hoi-restore`)) {
    rmSync(path, { recursive: true });
    throw Error("RESTORE_PENDING: Workspace is being restored");
  }
  const token = uid("lock");
  try {
    atomic(
      join(path, "owner.json"),
      JSON.stringify({
        pid: process.pid,
        hostname: hostname(),
        command,
        token,
        startedAt: now(),
      }),
    );
  } catch (e) {
    rmSync(path, { recursive: true, force: true });
    throw e;
  }
  return () => {
    const owner = JSON.parse(readFileSync(join(path, "owner.json"), "utf8"));
    if (owner.token !== token)
      throw Error("LOCK_CHANGED: Refusing to release another owner");
    rmSync(path, { recursive: true });
  };
}
export function recoverLock(root: string) {
  const guard = join(root, ".hoi/recovery-lock");
  try {
    mkdirSync(guard);
  } catch {
    throw Error(
      "RECOVERY_BUSY: Another recovery may be active; inspect it before continuing.",
    );
  }
  try {
    const state = inspectLock(root);
    if (state.state === "clear") return state;
    if (state.state !== "stale")
      throw Error(
        `${state.code}: Refusing active or uncertain owner; no files changed.`,
      );
    const path = join(root, ".hoi/lock"),
      archived = join(root, ".hoi", uid("recovered-lock"));
    renameSync(path, archived);
    return { code: "LOCK_RECOVERED", state: "clear" };
  } finally {
    rmSync(guard, { recursive: true, force: true });
  }
}
