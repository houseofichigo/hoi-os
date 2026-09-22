import {
  mkdirSync,
  existsSync,
  readFileSync,
  copyFileSync,
  renameSync,
  rmSync,
  lstatSync,
  readdirSync,
} from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { hostname } from "node:os";
import Database from "better-sqlite3";
import {
  Store,
  workspaceDirectories,
  CURRENT_SCHEMA_VERSION,
} from "./store.js";
import { walk, sha, atomic, safePath, contained, uid, now } from "./files.js";
export function backup(s: Store, destination: string) {
  const target = resolve(destination);
  if (contained(s.root, target) || contained(target, s.root))
    throw Error("Backup must be outside the workspace");
  if (existsSync(target)) throw Error("Backup destination must not exist");
  const stage = `${target}.${uid("incomplete")}`;
  mkdirSync(stage, { recursive: true, mode: 0o700 });
  try {
    const files: Record<string, string> = {};
    for (const file of walk(s.root)) {
      const name = relative(s.root, file).replaceAll("\\", "/");
      if (
        name.startsWith(".hoi/lock") ||
        name === ".hoi/last-backup.json" ||
        name.startsWith(".hoi/recovered-lock") ||
        name.startsWith(".hoi/recovery-lock") ||
        name.startsWith(".hoi/readers/") ||
        name.startsWith(".hoi/os.sqlite") ||
        name.endsWith(".tmp")
      )
        continue;
      const out = safePath(stage, name);
      atomic(out, readFileSync(file));
      files[name] = sha(readFileSync(out));
    }
    const dbPath = safePath(stage, ".hoi/os.sqlite");
    mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
    s.db.prepare("VACUUM INTO ?").run(dbPath);
    files[".hoi/os.sqlite"] = sha(readFileSync(dbPath));
    atomic(
      join(stage, "manifest.json"),
      JSON.stringify({ schemaVersion: 1, createdAt: now(), files }, null, 2),
    );
    verifyBackup(stage);
    renameSync(stage, target);
    atomic(
      s.path(".hoi/last-backup.json"),
      JSON.stringify({ destination: target, verifiedAt: now() }),
    );
    return {
      destination: target,
      files: Object.keys(files).length,
      verified: true,
    };
  } catch (e) {
    rmSync(stage, { recursive: true, force: true });
    throw e;
  }
}
export function restore(backupPath: string, workspace: string) {
  const target = resolve(workspace),
    guard = `${target}.hoi-restore`;
  mkdirSync(dirname(target), { recursive: true });
  try {
    mkdirSync(guard, { mode: 0o700 });
  } catch {
    throw Error("RESTORE_PENDING: Run recover-restore before retrying.");
  }
  try {
    atomic(
      join(guard, "owner.json"),
      JSON.stringify({ pid: process.pid, hostname: hostname() }),
    );
    return restoreGuarded(backupPath, workspace, guard);
  } finally {
    // Retain recovery instructions if rollback itself failed after removing the target.
    if (existsSync(target) || !existsSync(join(guard, "journal.json")))
      rmSync(guard, { recursive: true, force: true });
  }
}
function restoreGuarded(backupPath: string, workspace: string, guard: string) {
  const source = resolve(backupPath),
    target = resolve(workspace);
  if (contained(source, target) || contained(target, source))
    throw Error("Restore paths overlap");
  if (
    existsSync(target) &&
    readdirSync(target).length &&
    !existsSync(join(target, ".hoi/workspace.json"))
  )
    throw Error(
      "Refusing to replace a directory that is not an initialized HOI workspace",
    );
  if (
    existsSync(join(target, ".hoi/lock")) ||
    (existsSync(join(target, ".hoi/readers")) &&
      readdirSync(join(target, ".hoi/readers")).length)
  )
    throw Error("Workspace is in use; stop active commands and map first");
  const manifest = verifyBackup(source);
  safePath(dirname(target), target);
  const stage = `${target}.${uid("restore")}`,
    previous = `${target}.${uid("previous")}`;
  mkdirSync(stage, { recursive: true, mode: 0o700 });
  try {
    for (const name of workspaceDirectories)
      mkdirSync(safePath(stage, name), { recursive: true, mode: 0o700 });
    for (const name of Object.keys(manifest.files))
      atomic(safePath(stage, name), readFileSync(safePath(source, name)));
    atomic(join(stage, "manifest.json"), JSON.stringify(manifest));
    verifyBackup(stage);
    rmSync(join(stage, "manifest.json"));
    atomic(
      join(guard, "journal.json"),
      JSON.stringify({ target, stage, previous }),
    );
    if (existsSync(target)) renameSync(target, previous);
    try {
      renameSync(stage, target);
    } catch (e) {
      if (existsSync(previous)) renameSync(previous, target);
      throw e;
    }
  } catch (e) {
    rmSync(stage, { recursive: true, force: true });
    throw e;
  }
  return {
    workspace: target,
    previous: existsSync(previous) ? previous : null,
    verifiedFiles: Object.keys(manifest.files).length,
  };
}

export function verifyBackup(backupPath: string) {
  const source = resolve(backupPath);
  const manifest = JSON.parse(
    readFileSync(safePath(source, "manifest.json"), "utf8"),
  );
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.files?.[".hoi/os.sqlite"] ||
    !manifest.files?.[".hoi/workspace.json"]
  )
    throw Error("Invalid backup manifest");
  for (const [name, checksum] of Object.entries(manifest.files)) {
    if (
      name.split(/[\\/]/).some((p) => p === ".secrets" || p.startsWith(".env"))
    )
      throw Error("Backup includes excluded credentials");
    const file = safePath(source, name);
    if (!lstatSync(file).isFile() || sha(readFileSync(file)) !== checksum)
      throw Error(`Checksum mismatch: ${name}`);
  }
  const check = new Database(safePath(source, ".hoi/os.sqlite"), {
    readonly: true,
  });
  try {
    if (
      (check.prepare("PRAGMA integrity_check").get() as any).integrity_check !==
      "ok"
    )
      throw Error("Backup database is corrupt");
    if (
      ![1, CURRENT_SCHEMA_VERSION].includes(
        Number(
          (check.prepare("PRAGMA user_version").get() as any).user_version,
        ),
      )
    )
      throw Error("Unsupported backup schema");
    const originals = check
      .prepare(
        "SELECT original_path, checksum FROM revisions UNION ALL SELECT o.original_path, r.checksum FROM occurrences o JOIN revisions r ON r.id=o.revision_id",
      )
      .all() as { original_path: string; checksum: string }[];
    for (const original of originals) {
      const key = original.original_path.replaceAll("\\", "/");
      if (manifest.files[key] !== original.checksum)
        throw Error(
          "Backup original differs from its recorded revision checksum",
        );
    }
  } finally {
    check.close();
  }
  return manifest;
}

// Recovery only rolls back an interrupted swap; it never resumes a partially copied restore.
export function recoverRestore(workspace: string) {
  const target = resolve(workspace),
    guard = `${target}.hoi-restore`;
  if (!existsSync(guard)) return { code: "RESTORE_CLEAR" };
  const owner = JSON.parse(readFileSync(join(guard, "owner.json"), "utf8"));
  if (
    owner.hostname !== hostname() ||
    !Number.isSafeInteger(owner.pid) ||
    owner.pid <= 0
  )
    throw Error("RESTORE_OWNER_UNKNOWN");
  try {
    process.kill(owner.pid, 0);
    throw Error("RESTORE_OWNER_ACTIVE");
  } catch (e: any) {
    if (e.code !== "ESRCH") throw e;
  }
  if (existsSync(join(guard, "journal.json"))) {
    const journal = JSON.parse(
      readFileSync(join(guard, "journal.json"), "utf8"),
    );
    if (
      journal.target !== target ||
      !journal.stage.startsWith(`${target}.restore_`) ||
      !journal.previous.startsWith(`${target}.previous_`) ||
      dirname(journal.stage) !== dirname(target) ||
      dirname(journal.previous) !== dirname(target)
    )
      throw Error("RESTORE_JOURNAL_INVALID");
    if (!existsSync(target) && existsSync(journal.previous))
      renameSync(journal.previous, target);
    // A completed swap leaves the previous workspace in place; no user data is deleted.
  }
  rmSync(guard, { recursive: true });
  return { code: "RESTORE_RECOVERED" };
}
