import { parseArgs } from "node:util";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { Store } from "../dist/core/store.js";
import { backup } from "../dist/core/backup.js";
import { acquireLock } from "../dist/core/locks.js";
import { ingest } from "../dist/core/intake.js";
import { metadata } from "../dist/core/schema.js";
import { assertInput, sha, atomic, uid } from "../dist/core/files.js";
const { values: v } = parseArgs({
  options: {
    workspace: { type: "string" },
    input: { type: "string" },
    backup: { type: "string" },
  },
});
if (!v.workspace || !v.input || !v.backup)
  throw Error(
    "Supply --workspace, --input selected-files.json and --backup <new private directory>.",
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
      .min(50)
      .max(150),
  })
  .strict()
  .parse(JSON.parse(readFileSync(v.input, "utf8")));
if (
  new Set(manifest.files.map((f) => resolve(f.path))).size !==
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
const s = new Store(resolve(v.workspace)),
  release = acquireLock(s.root, "pilot-import");
try {
  if (
    !s.one(
      "SELECT id FROM entities WHERE id=? AND type='project'",
      manifest.projectId,
    )
  )
    throw Error("Select an existing project identity");
  const verified = backup(s, v.backup),
    id = uid("pilot_import"),
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
        { id, projectId: manifest.projectId, backup: verified, results },
        null,
        2,
      ),
    );
  }
  console.log(
    JSON.stringify({
      id,
      imported: results.length,
      gaps: results.filter((r) => r.status !== "ready").length,
    }),
  );
} finally {
  release();
  s.close();
}
