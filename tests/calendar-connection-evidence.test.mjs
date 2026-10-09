import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { importWork } from "../dist/core/work-intake.js";
import { createConnection } from "../dist/core/sync.js";
import { knowledgeSearch, knowledgeEvidence } from "../dist/core/retrieval.js";
import { connectedRead } from "../dist/core/connected-context.js";
import { beginChat, submitChat, chatEvidence } from "../dist/core/chat.js";
import { sourceImpact, changeSource } from "../dist/core/hub.js";
const event = (recurrenceId = "2026-10-01") => ({
  kind: "calendar",
  account: "fictional",
  remoteId: "cedar-series",
  recurrenceId,
  title: "Cedar workshop",
  occurredAt: "2026-10-01T08:00:00Z",
  updatedAt: "2026-10-01T08:00:00Z",
  checkedAt: "2026-10-01T08:00:00Z",
  timezone: "Europe/Paris",
  calendar: {
    start: "2026-10-01T09:00:00+02:00",
    end: "2026-10-01T10:00:00+02:00",
  },
  segments: [{ text: "Cedar workshop preparation." }],
});
test("calendar occurrences remain distinct, resolve exact properties, and invalidate on cancellation or archive", async (t) => {
  const { s } = fixture(t);
  await importWork(s, event(), "local");
  await importWork(s, event("2026-10-08"), "local");
  const results = knowledgeSearch(
    s,
    { query: "Cedar", scope: "workspace" },
    "local",
  ).evidence.filter((e) => e.reference.recordKind === "event");
  assert.equal(results.length, 2);
  assert.notEqual(results[0].recordId, results[1].recordId);
  const first = results.find((e) =>
    e.excerpt.includes("recurrenceId: 2026-10-01"),
  );
  assert.match(
    knowledgeEvidence(s, { kind: "record", ...first.reference }, "local").quote,
    /Europe\/Paris/,
  );
  await importWork(
    s,
    { ...event(), cancelled: true, updatedAt: "2026-10-02T08:00:00Z" },
    "local",
  );
  assert.throws(
    () => knowledgeEvidence(s, { kind: "record", ...first.reference }, "local"),
    /UNAVAILABLE/,
  );
  const current = connectedRead(s, "local", { kind: "calendar" }).records.find(
    (r) => r.quote.includes("recurrenceId: 2026-10-01"),
  );
  assert.match(current.quote, /cancelled: true/);
  assert.equal(current.freshness, "stale");
  const source = s.one(
    "SELECT source_id FROM work_intake WHERE id=?",
    current.id,
  );
  const impact = sourceImpact(s, source.source_id, "local");
  changeSource(
    s,
    {
      id: source.source_id,
      expectedVersion: impact.source.version,
      digest: impact.digest,
      state: "archived",
    },
    "local",
  );
  assert.equal(
    connectedRead(s, "local", { kind: "calendar", id: current.id }).records
      .length,
    0,
  );
});
test("connector summaries exclude raw configuration and errors and recheck host and disconnection", async (t) => {
  const { s } = fixture(t);
  const c = createConnection(
    s,
    {
      provider: "gmail",
      label: "private-label",
      query: "private-search-secret",
    },
    "local",
  );
  s.exec(
    "UPDATE sync_connections SET error=? WHERE id=?",
    "private-error-secret",
    c.id,
  );
  const read = connectedRead(s, "local", { kind: "connections" });
  assert.equal(read.records.length, 1);
  assert.doesNotMatch(
    JSON.stringify(read),
    /private-search-secret|private-error-secret|private-label/,
  );
  assert.equal(
    connectedRead(s, "codex", { kind: "connections" }).records.length,
    0,
  );
  const found = knowledgeSearch(
    s,
    { query: "gmail", scope: "workspace" },
    "local",
  ).evidence.find((e) => e.recordId === c.id);
  assert.ok(found);
  const chat = beginChat(
    s,
    { message: "gmail connection", scope: "workspace", host: "local" },
    "local",
  );
  const supplied = chatEvidence(s, chat.id, "local").liveRecords.find(
    (e) => e.kind === "connection",
  );
  assert.ok(supplied);
  submitChat(
    s,
    chat.id,
    chat.version,
    {
      type: "answer",
      text: "The configured connection requires setup.",
      citations: [],
      recordCitations: [{ kind: "connection", id: c.id, version: 1 }],
    },
    "local",
  );
  s.exec("UPDATE sync_connections SET state='disconnected' WHERE id=?", c.id);
  assert.throws(
    () => knowledgeEvidence(s, { kind: "record", ...found.reference }, "local"),
    /UNAVAILABLE/,
  );
  assert.throws(() => chatEvidence(s, chat.id, "local"), /UNAVAILABLE/);
  assert.equal(
    knowledgeSearch(s, { query: "gmail" }, "local").evidence.some(
      (e) => e.kind === "record",
    ),
    false,
  );
});
