import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import {
  memoryGet,
  memoryHistory,
  proposeMemory,
  reviewVersionedMemory,
  recoverMemoryWrites,
} from "../dist/core/reviewed-memory.js";
import { knowledgeSearch } from "../dist/core/retrieval.js";
import { readFileSync, writeFileSync } from "node:fs";
import { backup, restore } from "../dist/core/backup.js";
import { Store, migrate } from "../dist/core/store.js";
import { join } from "node:path";
const propose = (s, text, extra = {}) =>
  proposeMemory(
    s,
    {
      requestKey: `propose-${text}`,
      attributedStatement: true,
      memory: { type: "preference", content: text, ...extra },
    },
    "local",
  );
const review = (s, id, state = "approved", extra = {}) => {
  const m = memoryGet(s, id, "local");
  return reviewVersionedMemory(
    s,
    {
      requestKey: `review-${id}-${state}`,
      id,
      expectedVersion: m.version,
      expectedChecksum: m.checksum,
      state,
      confirm: true,
      ...extra,
    },
    "local",
  );
};
test("reviewed memory preserves revisions, exact retries, stale checks and atomic replacement", (t) => {
  const { s } = fixture(t),
    a = propose(s, "Orchard prefers morning sessions");
  const before = memoryGet(s, a.id, "local");
  const payload = {
    requestKey: "approve-first",
    id: a.id,
    expectedVersion: before.version,
    expectedChecksum: before.checksum,
    state: "approved",
    confirm: true,
  };
  assert.throws(
    () => reviewVersionedMemory(s, payload, "codex"),
    /REVIEW_REQUIRED/,
  );
  const first = reviewVersionedMemory(s, payload, "local");
  assert.deepEqual(reviewVersionedMemory(s, payload, "local"), first);
  assert.throws(
    () =>
      reviewVersionedMemory(
        s,
        { ...payload, requestKey: "approve-stale" },
        "local",
      ),
    /STALE/,
  );
  const b = propose(s, "Orchard now prefers afternoon sessions", {
    supersedes: a.id,
  });
  review(s, b.id);
  assert.equal(memoryGet(s, a.id, "local").state, "superseded");
  assert.equal(memoryHistory(s, a.id, "local").revisions.length, 3);
  assert.deepEqual(
    knowledgeSearch(s, { query: "Orchard" }, "local").evidence.map(
      (e) => e.recordId,
    ),
    [b.id],
  );
  review(s, b.id, "retired");
  assert.equal(
    knowledgeSearch(s, { query: "Orchard" }, "local").evidence.length,
    0,
  );
});
test("assistant cannot impersonate authorship or approve unsupported inferred facts", (t) => {
  const { s } = fixture(t);
  assert.throws(
    () =>
      proposeMemory(
        s,
        {
          requestKey: "malicious-author",
          attributedStatement: true,
          memory: { type: "semantic", content: "Fabricated" },
        },
        "codex",
      ),
    /ATTRIBUTION/,
  );
  const p = proposeMemory(
    s,
    {
      requestKey: "inferred-proposal",
      memory: { type: "semantic", content: "Unverified inference" },
    },
    "codex",
  );
  assert.throws(() => review(s, p.id), /EVIDENCE_REQUIRED/);
  assert.equal(
    knowledgeSearch(s, { query: "inference" }, "local").evidence.length,
    0,
  );
});
test("journal recovery refuses conflicting files; backup restore retains history", (t) => {
  const { s, root } = fixture(t),
    p = propose(s, "Orchard preserves history");
  review(s, p.id);
  const backupDir = join(root, "backup"),
    copy = join(root, "restored");
  backup(s, backupDir);
  restore(backupDir, copy);
  const restored = new Store(copy);
  assert.equal(memoryHistory(restored, p.id, "local").revisions.length, 2);
  restored.close();
  const journal = s.one(
    "SELECT * FROM memory_write_journal WHERE request_key=?",
    `review-${p.id}-approved`,
  );
  s.exec(
    "UPDATE memory_write_journal SET state='pending' WHERE id=?",
    journal.id,
  );
  recoverMemoryWrites(s);
  s.exec(
    "UPDATE memory_write_journal SET state='pending' WHERE id=?",
    journal.id,
  );
  const path = s.path(`memory/${p.id}.md`),
    original = readFileSync(path);
  writeFileSync(path, "Unexpected edit");
  assert.throws(() => recoverMemoryWrites(s), /RECOVERY_CONFLICT/);
  writeFileSync(path, original);
  recoverMemoryWrites(s);
});
test("schema18 upgrade is additive and preserves memory bytes", (t) => {
  const { s } = fixture(t),
    p = propose(s, "Legacy-compatible memory");
  const original = readFileSync(s.path(`memory/${p.id}.md`));
  s.exec("PRAGMA user_version=18");
  const older = new Store(s.root);
  migrate(older);
  older.close();
  const current = new Store(s.root);
  assert.equal(current.schemaVersion, 19);
  assert.deepEqual(readFileSync(current.path(`memory/${p.id}.md`)), original);
  current.close();
});

test("draft editing, comparison, restoration and backup preserve reviewed originals", async (t) => {
  const { beginMemoryDraft, saveMemoryDraft, compareMemoryDraft } =
    await import("../dist/core/reviewed-memory.js");
  const { s, root } = fixture(t);
  const p = propose(s, "Orchard prefers morning");
  review(s, p.id);
  const identity = (m) => ({
    id: m.id,
    expectedVersion: m.version,
    expectedChecksum: m.checksum,
  });
  const original = memoryGet(s, p.id, "local");
  assert.throws(
    () =>
      saveMemoryDraft(
        s,
        {
          ...identity(original),
          requestKey: "not-a-draft",
          changes: { content: "Overwrite" },
        },
        "local",
      ),
    /DRAFT_REQUIRED/,
  );
  const d = beginMemoryDraft(
    s,
    { ...identity(original), requestKey: "begin-correction" },
    "local",
  );
  let draft = memoryGet(s, d.id, "local");
  const payload = {
    ...identity(draft),
    requestKey: "save-correction",
    changes: { content: "Orchard prefers afternoon", validFrom: "2025-01-01" },
    attributedStatement: true,
  };
  const saved = saveMemoryDraft(s, payload, "local");
  assert.deepEqual(saveMemoryDraft(s, payload, "local"), saved);
  assert.throws(
    () =>
      saveMemoryDraft(
        s,
        { ...payload, requestKey: "stale-correction" },
        "local",
      ),
    /STALE/,
  );
  assert.equal(memoryGet(s, p.id, "local").state, "approved");
  assert.equal(
    compareMemoryDraft(s, d.id, "local").changes.some(
      (c) => c.field === "content",
    ),
    true,
  );
  review(s, d.id);
  assert.equal(memoryGet(s, p.id, "local").state, "superseded");
  draft = memoryGet(s, d.id, "local");
  const restored = beginMemoryDraft(
    s,
    { ...identity(draft), restoreVersion: 1, requestKey: "restore-original" },
    "local",
  );
  assert.equal(
    memoryGet(s, restored.id, "local").content,
    "Orchard prefers morning",
  );
  assert.equal(memoryGet(s, restored.id, "local").state, "proposed");
  assert.equal(memoryGet(s, d.id, "local").state, "approved");
  assert.equal(memoryHistory(s, d.id, "local").revisions.length, 3);
  const dir = join(root, "draft-backup"),
    copy = join(root, "draft-restored");
  backup(s, dir);
  restore(dir, copy);
  const other = new Store(copy);
  assert.equal(memoryGet(other, restored.id, "local").derivedFrom.version, 1);
  assert.equal(memoryHistory(other, d.id, "local").revisions.length, 3);
  other.close();
});

test("draft mutations cannot inherit user attribution, bypass stale predecessors or reveal denied history", async (t) => {
  const { beginMemoryDraft, saveMemoryDraft, compareMemoryDraft } =
    await import("../dist/core/reviewed-memory.js");
  const { s } = fixture(t);
  const p = propose(s, "Original preference");
  review(s, p.id);
  const identity = (m) => ({
    id: m.id,
    expectedVersion: m.version,
    expectedChecksum: m.checksum,
  });
  const d = beginMemoryDraft(
    s,
    {
      ...identity(memoryGet(s, p.id, "local")),
      requestKey: "correction-second",
    },
    "local",
  );
  const m = memoryGet(s, d.id, "local");
  assert.throws(
    () =>
      saveMemoryDraft(
        s,
        {
          ...identity(m),
          requestKey: "false-attribution",
          changes: { content: "Inference" },
          attributedStatement: true,
        },
        "codex",
      ),
    /ATTRIBUTION/,
  );
  saveMemoryDraft(
    s,
    {
      ...identity(m),
      requestKey: "assistant-edit",
      changes: { content: "Inference" },
    },
    "codex",
  );
  assert.equal(memoryGet(s, d.id, "local").author, null);
  assert.throws(() => review(s, d.id), /EVIDENCE_REQUIRED/);
  review(s, p.id, "retired");
  assert.equal(compareMemoryDraft(s, d.id, "local").stalePredecessor, true);
  const privateNote = propose(s, "Private statement", {
    allowedHosts: ["local"],
  });
  assert.throws(
    () =>
      beginMemoryDraft(
        s,
        {
          ...identity(memoryGet(s, privateNote.id, "local")),
          requestKey: "unauthorized-copy",
        },
        "codex",
      ),
    /UNAVAILABLE/,
  );
  assert.throws(() => memoryHistory(s, privateNote.id, "codex"), /UNAVAILABLE/);
});
