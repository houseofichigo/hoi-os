import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixture } from "./helpers.mjs";
import { sha } from "../dist/core/files.js";
import { Store } from "../dist/core/store.js";
import { acquireLock } from "../dist/core/locks.js";
import { importPilot } from "../scripts/import-pilot.mjs";
function setup(t) {
  const f = fixture(t);
  f.s.exec(
    "INSERT INTO entities VALUES(?,?,?,?,?,?,?,?)",
    "project-fiction",
    "project",
    "Fictional Orchard",
    null,
    "[]",
    '["local","codex","claude"]',
    null,
    new Date().toISOString(),
  );
  writeFileSync(f.s.path("AGENTS.md"), "Preserve unrelated instructions.\n");
  const files = Array.from({ length: 50 }, (_, i) => {
    const content = `Fictional Orchard document ${i}: workshop preparation.`;
    return { path: f.file(`selected ${i}.md`, content), sha256: sha(content) };
  });
  const input = f.file(
    "selected-files.json",
    JSON.stringify({ projectId: "project-fiction", files }),
  );
  return {
    f,
    files,
    options: {
      workspace: f.s.root,
      input,
      backup: join(f.root, "verified backup"),
      rehearsal: join(f.root, "restored copy"),
    },
  };
}
test("pilot rehearses a separate restore before bounded intake and persists recovery evidence", async (t) => {
  const { f, options } = setup(t);
  const result = await importPilot(options);
  assert.equal(result.imported, 50);
  assert.equal(result.recoveryRehearsed, true);
  const copy = new Store(options.rehearsal);
  try {
    assert.equal(copy.one("SELECT COUNT(*) AS n FROM sources").n, 0);
    assert.equal(
      copy.one("SELECT id FROM entities WHERE id=?", "project-fiction").id,
      "project-fiction",
    );
    assert.equal(
      readFileSync(copy.path("AGENTS.md"), "utf8"),
      "Preserve unrelated instructions.\n",
    );
  } finally {
    copy.close();
  }
  assert.equal(f.s.one("SELECT COUNT(*) AS n FROM sources").n, 50);
  const checkpoint = JSON.parse(
    readFileSync(f.s.path(`.hoi/pilot/${result.id}.json`), "utf8"),
  );
  assert.equal(checkpoint.rehearsal.workspace, realpathSync(options.rehearsal));
  assert.equal(checkpoint.results.length, 50);
  const repeat = await importPilot({
    ...options,
    backup: options.backup + "2",
    rehearsal: options.rehearsal + "2",
  });
  assert.equal(repeat.imported, 50);
  assert.equal(f.s.one("SELECT COUNT(*) AS n FROM sources").n, 50);
});
test("pilot refuses active ownership without changing database or backup", async (t) => {
  const { f, options } = setup(t);
  const unlock = acquireLock(f.s.root, "test-owner");
  const before = readFileSync(f.s.path(".hoi/os.sqlite"));
  try {
    await assert.rejects(importPilot(options), /LOCK_BUSY/);
  } finally {
    unlock();
  }
  assert.deepEqual(readFileSync(f.s.path(".hoi/os.sqlite")), before);
  assert.equal(existsSync(options.backup), false);
});
test("pilot rejects recovery path overlap, occupied destinations, missing rehearsal and altered selection", async (t) => {
  const { f, options, files } = setup(t);
  await assert.rejects(
    importPilot({ ...options, rehearsal: join(f.s.root, "copy") }),
    /PILOT_PATH_OVERLAP/,
  );
  await assert.rejects(
    importPilot({ ...options, rehearsal: f.root }),
    /PILOT_PATH_OVERLAP/,
  );
  await assert.rejects(
    importPilot({
      ...options,
      rehearsal: fileURLToPath(new URL("../private-recovery", import.meta.url)),
    }),
    /PILOT_PRIVATE_PATH/,
  );
  await assert.rejects(
    importPilot({ ...options, rehearsal: undefined }),
    /PILOT_ARGUMENTS/,
  );
  writeFileSync(options.rehearsal, "unrelated");
  await assert.rejects(importPilot(options), /PILOT_DESTINATION_EXISTS/);
  writeFileSync(files[0].path, "changed");
  await assert.rejects(
    importPilot({ ...options, rehearsal: options.rehearsal + "2" }),
    /Selected file changed/,
  );
  assert.equal(existsSync(options.backup), false);
  assert.equal(f.s.one("SELECT COUNT(*) AS n FROM sources").n, 0);
});
test("small walkthrough is explicit and never presented as the full pilot collection", async (t) => {
  const { f, options, files } = setup(t);
  writeFileSync(
    options.input,
    JSON.stringify({ projectId: "project-fiction", files: files.slice(0, 2) }),
  );
  await assert.rejects(importPilot(options));
  const result = await importPilot({ ...options, walkthrough: true });
  assert.equal(result.mode, "walkthrough");
  assert.equal(result.imported, 2);
});
