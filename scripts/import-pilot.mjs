import { parseArgs } from "node:util";
import { readFileSync, statSync, existsSync, realpathSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { Store, CURRENT_SCHEMA_VERSION } from "../dist/core/store.js";
import { backup, restore, verifyBackup } from "../dist/core/backup.js";
import { acquireLock } from "../dist/core/locks.js";
import { ingest } from "../dist/core/intake.js";
import { metadata } from "../dist/core/schema.js";
import {
  assertInput,
  sha,
  atomic,
  uid,
  contained,
} from "../dist/core/files.js";
// Resolve existing ancestors so symlink aliases cannot bypass overlap checks.
function physical(path) {
  const target = resolve(path);
  return existsSync(target)
    ? realpathSync(target)
    : resolve(physical(dirname(target)), basename(target));
}
export async function importPilot(v) {
  if (!v.workspace || !v.input || !v.backup || !v.rehearsal)
    throw Error(
      "PILOT_ARGUMENTS: Supply workspace, input, backup and a new separate rehearsal directory.",
    );
  const roots = [v.workspace, v.backup, v.rehearsal].map(physical);
  const product = physical(fileURLToPath(new URL("..", import.meta.url)));
  if ([...roots, physical(v.input)].some((path) => contained(product, path)))
    throw Error(
      "PILOT_PRIVATE_PATH: Keep private selection and recovery data outside the product checkout.",
    );
  if (roots.some((a, i) => roots.some((b, j) => i !== j && contained(a, b))))
    throw Error(
      "PILOT_PATH_OVERLAP: Workspace, backup and rehearsal must be separate.",
    );
  if (existsSync(v.backup) || existsSync(v.rehearsal))
    throw Error(
      "PILOT_DESTINATION_EXISTS: Choose new backup and rehearsal directories.",
    );
  const manifest = z
    .object({
      projectId: z.string(),
      files: z
        .array(
          z
            .object({
              path: z.string(),
              sha256: z.string().regex(/^[a-f0-9]{64}$/),
              metadata: metadata.optional(),
            })
            .strict(),
        )
        .min(v.walkthrough === true ? 1 : 50)
        .max(150),
    })
    .strict()
    .parse(JSON.parse(readFileSync(v.input, "utf8")));
  if (
    new Set(manifest.files.map((f) => physical(f.path))).size !==
    manifest.files.length
  )
    throw Error("Manifest repeats file paths");
  for (const f of manifest.files) {
    assertInput(f.path);
    if (
      !statSync(f.path).isFile() ||
      statSync(f.path).size > 50 * 1024 * 1024 ||
      sha(readFileSync(f.path)) !== f.sha256
    )
      throw Error(
        "Selected file changed, is too large, or is not a regular file; review the manifest again.",
      );
  }
  const release = acquireLock(roots[0], "pilot-import");
  let s;
  try {
    s = new Store(roots[0]);
    if (s.schemaVersion !== CURRENT_SCHEMA_VERSION)
      throw Error(
        "PILOT_UPGRADE_REQUIRED: Rehearse upgrade on a restored copy before pilot intake.",
      );
    if (
      !s.one(
        "SELECT id FROM entities WHERE id=? AND type='project'",
        manifest.projectId,
      )
    )
      throw Error("Select an existing project identity");
    const verified = backup(s, roots[1]);
    const restored = restore(roots[1], roots[2]);
    const before = verifyBackup(roots[1]);
    const check = new Store(roots[2]);
    try {
      if (
        check.schemaVersion !== s.schemaVersion ||
        check.db.prepare("PRAGMA integrity_check").get().integrity_check !==
          "ok" ||
        check.db.prepare("PRAGMA foreign_key_check").all().length
      )
        throw Error("PILOT_RESTORE_INVALID");
      // SQLite may update its file header on open; compare all preserved non-DB bytes.
      for (const [name, checksum] of Object.entries(before.files))
        if (
          name !== ".hoi/os.sqlite" &&
          sha(readFileSync(check.path(name))) !== checksum
        )
          throw Error("PILOT_RESTORE_CHECKSUM");
    } finally {
      check.close();
    }
    const id = uid("pilot_import"),
      results = [];
    for (const f of manifest.files) {
      // Recheck selection immediately before each import; originals always retain their own checksum.
      if (sha(readFileSync(f.path)) !== f.sha256)
        throw Error(
          "Selected file changed during intake; stop and review before resuming.",
        );
      results.push(
        await ingest(s, f.path, {
          metadata: { ...f.metadata, project: manifest.projectId },
        }),
      );
      atomic(
        s.path(`.hoi/pilot/${id}.json`),
        JSON.stringify(
          {
            id,
            projectId: manifest.projectId,
            backup: verified,
            rehearsal: restored,
            results,
          },
          null,
          2,
        ),
      );
    }
    return {
      id,
      imported: results.length,
      gaps: results.filter((r) => r.status !== "ready").length,
      recoveryRehearsed: true,
      mode: v.walkthrough === true ? "walkthrough" : "pilot",
    };
  } finally {
    try {
      s?.close();
    } finally {
      release();
    }
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { values } = parseArgs({
      options: {
        walkthrough: { type: "boolean", default: false },
        ...Object.fromEntries(
          ["workspace", "input", "backup", "rehearsal"].map((k) => [
            k,
            { type: "string" },
          ]),
        ),
      },
    });
    console.log(JSON.stringify(await importPilot(values)));
  } catch (error) {
    const code =
      /^([A-Z_]+):/.exec(error.message)?.[1] ?? "PILOT_IMPORT_FAILED";
    console.error(
      `${code}: Import stopped. Check selection, current schema, recovery destinations and workspace ownership. Stop the app for this offline recovery operation. No raw document data exported.`,
    );
    process.exitCode = 1;
  }
}
