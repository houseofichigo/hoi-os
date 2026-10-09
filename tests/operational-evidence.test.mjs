import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { saveRecord } from "../dist/core/workspace.js";
import { knowledgeSearch, knowledgeEvidence } from "../dist/core/retrieval.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import {
  createProposal,
  reviewProposal,
  updateTask,
} from "../dist/core/tasks.js";
import { beginChat, submitChat, chatEvidence } from "../dist/core/chat.js";

async function setup(t) {
  const f = fixture(t),
    { s } = f;
  const client = saveRecord(
    s,
    { kind: "client", expectedVersion: 0, record: { name: "Cedar client" } },
    "local",
  );
  const project = saveRecord(
    s,
    {
      kind: "project",
      expectedVersion: 0,
      record: {
        name: "Cedar training",
        clientIds: [client.id],
        objective: "Prepare Cedar workshop",
        status: "in-progress",
      },
    },
    "local",
  );
  await ingest(
    s,
    f.file("cedar.md", "Cedar workshop requires a preparation agenda."),
    { host: "local" },
  );
  const source = retrieve(s, "Cedar", "local").results[0];
  const evidence = [
    {
      revisionId: source.revisionId,
      passageId: source.passageId,
      quote: source.quote,
    },
  ];
  const proposal = createProposal(
    s,
    {
      key: "cedar-approved-task",
      task: {
        title: "Cedar preparation",
        outcome: "Prepare the agenda",
        projectId: project.id,
      },
      evidence,
    },
    "local",
  );
  const accepted = reviewProposal(
    s,
    { id: proposal.id, expectedVersion: 1, decision: "approved" },
    "local",
  );
  return { ...f, client, project, taskId: accepted.taskId };
}
test("workspace records compete with knowledge and exact references expire on edits", async (t) => {
  const { s, client, taskId } = await setup(t);
  const brain = knowledgeSearch(s, { query: "Cedar" }, "local");
  assert.equal(
    brain.evidence.some((e) => e.kind === "record"),
    false,
  );
  const combined = knowledgeSearch(
    s,
    { query: "Cedar", scope: "workspace" },
    "local",
  );
  assert.deepEqual(
    new Set(
      combined.evidence
        .filter((e) => e.kind === "record")
        .map((e) => e.reference.recordKind),
    ),
    new Set(["project", "client", "task"]),
  );
  assert.ok(combined.evidence.some((e) => e.kind === "source"));
  for (const e of combined.evidence)
    assert.ok(knowledgeEvidence(s, { kind: e.kind, ...e.reference }, "local"));
  const ref = combined.evidence.find((e) => e.recordId === client.id);
  saveRecord(
    s,
    {
      kind: "client",
      id: client.id,
      expectedVersion: client.version,
      record: { name: "Cedar renamed" },
    },
    "local",
  );
  assert.throws(
    () => knowledgeEvidence(s, { kind: "record", ...ref.reference }, "local"),
    /EVIDENCE_UNAVAILABLE/,
  );
  const task = combined.evidence.find((e) => e.recordId === taskId);
  updateTask(s, { id: taskId, expectedVersion: 1, status: "done" }, "local");
  assert.throws(
    () => knowledgeEvidence(s, { kind: "record", ...task.reference }, "local"),
    /EVIDENCE_UNAVAILABLE/,
  );
  assert.equal(
    knowledgeSearch(
      s,
      { query: "Cedar", scope: "workspace", asOf: "2025-01-01" },
      "local",
    ).coverage.records,
    "historical-records-unavailable",
  );
});
test("permission and explicit relationship scopes exclude inaccessible records before counts", async (t) => {
  const { s, project, client } = await setup(t);
  saveRecord(
    s,
    {
      kind: "client",
      expectedVersion: 0,
      record: { name: "Hidden Cedar", allowedHosts: ["local"] },
    },
    "local",
  );
  const scoped = knowledgeSearch(
    s,
    { query: "Cedar", scope: "workspace", project: project.id },
    "codex",
  );
  assert.ok(
    scoped.evidence
      .filter((e) => e.kind === "record")
      .every(
        (e) =>
          [project.id, client.id].includes(e.recordId) ||
          e.relatedRecords.includes(project.id),
      ),
  );
  assert.equal(JSON.stringify(scoped).includes("Hidden Cedar"), false);
  assert.equal(
    knowledgeSearch(
      s,
      { query: "Cedar", scope: "workspace", project: "project_unknown" },
      "local",
    ).evidence.some((e) => e.kind === "record"),
    false,
  );
});
test("chat supplies current record citations and evidence while knowledge scope stays isolated", async (t) => {
  const { s } = await setup(t);
  const chat = beginChat(
    s,
    { message: "Cedar", host: "local", scope: "workspace" },
    "local",
  );
  const supplied = chatEvidence(s, chat.id, "local");
  assert.equal(supplied.liveRecords.length, 3);
  const cited = supplied.liveRecords.find((r) => r.kind === "project");
  const done = submitChat(
    s,
    chat.id,
    chat.version,
    {
      type: "answer",
      text: "The recorded project is in progress.",
      citations: [],
      recordCitations: [
        { kind: cited.kind, id: cited.id, version: cited.version },
      ],
    },
    "local",
  );
  assert.equal(done.state, "completed");
  assert.ok(
    chatEvidence(s, chat.id, "local").liveRecords.find((r) => r.id === cited.id)
      .cited,
  );
  const brain = beginChat(
    s,
    { message: "Cedar", host: "local", scope: "knowledge" },
    "local",
  );
  assert.deepEqual(chatEvidence(s, brain.id, "local").liveRecords, []);
});

test("archived evidence excludes dependent operational records and invalidates historical chat", async (t) => {
  const { sourceImpact, changeSource } = await import("../dist/core/hub.js");
  const { s, taskId } = await setup(t);
  const chat = beginChat(s, { message: "Cedar", host: "local" }, "local");
  const ref = knowledgeSearch(
    s,
    { query: "Cedar", scope: "workspace" },
    "local",
  ).evidence.find((e) => e.recordId === taskId);
  const source = s.one("SELECT id FROM sources LIMIT 1");
  const impact = sourceImpact(s, source.id, "local");
  changeSource(
    s,
    {
      id: source.id,
      expectedVersion: impact.source.version,
      digest: impact.digest,
      state: "archived",
    },
    "local",
  );
  assert.throws(
    () => knowledgeEvidence(s, { kind: "record", ...ref.reference }, "local"),
    /EVIDENCE_UNAVAILABLE/,
  );
  assert.equal(
    knowledgeSearch(
      s,
      { query: "Cedar", scope: "workspace" },
      "local",
    ).evidence.some((e) => e.recordId === taskId),
    false,
  );
  assert.throws(() => chatEvidence(s, chat.id, "local"), /CONTEXT_CHANGED/);
});
