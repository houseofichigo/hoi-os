import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";
import { Store } from "../dist/core/store.js";
import { sha } from "../dist/core/files.js";
import { backup, restore } from "../dist/core/backup.js";
import {
  proposeMemory,
  memoryGet,
  memoryHistory,
  reviewVersionedMemory,
  recoverMemoryWrites,
} from "../dist/core/reviewed-memory.js";
const propose = (s, key, text, extra = {}) =>
  proposeMemory(
    s,
    {
      requestKey: key,
      attributedStatement: true,
      memory: { type: "preference", content: text, ...extra },
    },
    "local",
  );
function approve(s, id, key) {
  const m = memoryGet(s, id, "local");
  return reviewVersionedMemory(
    s,
    {
      id,
      requestKey: key,
      expectedVersion: m.version,
      expectedChecksum: m.checksum,
      state: "approved",
      confirm: true,
    },
    "local",
  );
}

test("invalid memory journal payloads fail before any file is overwritten", (t) => {
  const { s } = fixture(t),
    p = propose(
      s,
      "propose-integrity",
      "Fictional client prefers morning sessions",
    );
  const journal = s.one(
    "SELECT * FROM memory_write_journal WHERE request_key=?",
    "propose-integrity",
  );
  const writes = JSON.parse(journal.writes),
    path = s.path(writes[0].path),
    original = readFileSync(path);
  const cases = [
    "{broken",
    "[]",
    JSON.stringify(
      writes.map((w, i) =>
        i === 0 ? { ...w, text: w.text + "corruption" } : w,
      ),
    ),
    JSON.stringify([...writes, writes[0]]),
    JSON.stringify(
      writes.map((w, i) => (i === 0 ? { ...w, path: "../outside.md" } : w)),
    ),
    JSON.stringify(writes.map((w, i) => (i === 0 ? { ...w, after: null } : w))),
  ];
  for (const payload of cases) {
    s.exec(
      "UPDATE memory_write_journal SET state='pending',writes=? WHERE id=?",
      payload,
      journal.id,
    );
    assert.throws(() => recoverMemoryWrites(s), /MEMORY_JOURNAL_INVALID/);
    assert.deepEqual(readFileSync(path), original);
    assert.equal(
      s.one("SELECT state FROM memory_write_journal WHERE id=?", journal.id)
        .state,
      "pending",
    );
  }
  // A valid earlier write must not be applied before a later corrupt entry is checked.
  const corruptLast = writes.map((w, i) =>
    i === writes.length - 1 ? { ...w, text: w.text + "corruption" } : w,
  );
  s.exec(
    "UPDATE memory_write_journal SET writes=? WHERE id=?",
    JSON.stringify(corruptLast),
    journal.id,
  );
  rmSync(path);
  assert.throws(() => recoverMemoryWrites(s), /MEMORY_JOURNAL_INVALID/);
  assert.equal(existsSync(path), false);
  writeFileSync(path, original);
  s.exec(
    "UPDATE memory_write_journal SET writes=? WHERE id=?",
    journal.writes,
    journal.id,
  );
  recoverMemoryWrites(s);
  assert.equal(memoryGet(s, p.id, "local").state, "proposed");
});

test("partially applied replacement survives backup, separate restore and repeated restart", (t) => {
  const { s, root } = fixture(t);
  const a = propose(
    s,
    "propose-original",
    "Fictional client prefers morning sessions",
  );
  approve(s, a.id, "approve-original");
  const b = propose(
    s,
    "propose-successor",
    "Fictional client prefers afternoon sessions",
    { supersedes: a.id },
  );
  approve(s, b.id, "approve-successor");
  const journal = s.one(
    "SELECT * FROM memory_write_journal WHERE request_key=?",
    "approve-successor",
  );
  const writes = JSON.parse(journal.writes);
  // Rewind only disposable fixture files to their exact pre-commit bytes.
  for (const w of writes) {
    const path = s.path(w.path);
    if (w.before === null) rmSync(path, { force: true });
    else {
      const before = writes.find((x) => sha(x.text) === w.before);
      assert.ok(before);
      writeFileSync(path, before.text);
    }
  }
  s.exec(
    "UPDATE memory_write_journal SET state='pending' WHERE id=?",
    journal.id,
  );
  // Simulate interruption after just one write of a multi-record replacement.
  const first = writes.find((w) => w.before !== w.after);
  writeFileSync(s.path(first.path), first.text);
  const backupDir = join(root, "interrupted-backup"),
    restoredPath = join(root, "separate-restore");
  assert.equal(backup(s, backupDir).verified, true);
  restore(backupDir, restoredPath);
  for (let attempt = 0; attempt < 2; attempt++) {
    const restored = new Store(restoredPath);
    try {
      assert.equal(memoryGet(restored, a.id, "local").state, "superseded");
      assert.equal(memoryGet(restored, b.id, "local").state, "approved");
      assert.equal(memoryHistory(restored, a.id, "local").revisions.length, 3);
      assert.equal(memoryHistory(restored, b.id, "local").revisions.length, 2);
      assert.equal(
        restored.one(
          "SELECT state FROM memory_write_journal WHERE id=?",
          journal.id,
        ).state,
        "complete",
      );
      for (const w of writes) {
        assert.ok(existsSync(restored.path(w.path)));
        assert.equal(sha(readFileSync(restored.path(w.path))), w.after);
      }
    } finally {
      restored.close();
    }
  }
  // Recovery of the restored copy must not modify the original partial workspace.
  assert.equal(
    s.one("SELECT state FROM memory_write_journal WHERE id=?", journal.id)
      .state,
    "pending",
  );
  recoverMemoryWrites(s);
});
