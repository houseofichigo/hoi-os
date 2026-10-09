import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { candidate, safePath, scan } from "../scripts/publication-safety.mjs";
test("publication rejects private paths, traversal and credential content", () => {
  for (const path of [
    "audits/report.md",
    "../private.md",
    ".secrets/key",
    "docs/verification/run.json",
    "workspaces/data.db",
    "/absolute",
    "foo/../bar",
  ])
    assert.equal(safePath(path), false);
  assert.equal(safePath("src/engine.ts"), true);
  assert.deepEqual(scan(Buffer.from("sk-" + "a".repeat(32))), [
    "PROVIDER_CREDENTIAL",
  ]);
  assert.deepEqual(scan(Buffer.from("fictional example")), []);
});
test("explicit manifest rejects symlinks and duplicates; captures exact bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "hoi-publication-"));
  try {
    writeFileSync(join(root, "ok.md"), "fictional example");
    assert.equal(
      candidate(root, { files: ["ok.md"] })[0].bytes.toString(),
      "fictional example",
    );
    assert.throws(() => candidate(root, { files: ["ok.md", "ok.md"] }));
    symlinkSync(root, join(root, "link.md"), "junction");
    assert.throws(() => candidate(root, { files: ["link.md"] }), /Symlink/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
