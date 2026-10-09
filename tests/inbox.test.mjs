import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { Store, migrate } from "../dist/core/store.js";
import {
  importWork,
  prepareExtraction,
  intakeDetail,
  matchCandidates,
} from "../dist/core/work-intake.js";
import {
  createProposal,
  reviewProposal,
  getTask,
  listTasks,
  assignTask,
  taskHistory,
  createProject,
} from "../dist/core/tasks.js";
import { entity } from "../dist/core/knowledge.js";
import { prepareDailyMeeting } from "../dist/core/daily.js";
const item = (kind = "transcript") => ({
  kind,
  account: "fictional",
  remoteId: kind,
  title: "Discuss the workshop",
  occurredAt: "2026-09-27T09:00:00Z",
  updatedAt: "2026-09-27T09:00:00Z",
  checkedAt: "2026-09-27T09:00:00Z",
  segments: [{ text: "Alex will send the workshop notes." }],
  ...(kind === "calendar"
    ? {
        timezone: "Europe/Paris",
        calendar: {
          start: "2026-09-28T09:00:00Z",
          end: "2026-09-28T10:00:00Z",
        },
      }
    : {}),
});
async function data(t) {
  const f = fixture(t);
  const imported = await importWork(f.s, item(), "local");
  const detail = intakeDetail(f.s, imported.id, "local");
  const evidence = detail.passages.map((p) => ({
    revisionId: detail.revisionId,
    passageId: p.id,
    quote: p.text,
  }));
  return { ...f, imported, evidence };
}
test("standalone approval, reassignment and restart preserve identity/history", async (t) => {
  const { s, imported, evidence } = await data(t);
  assert.equal(prepareExtraction(s, imported.id, "local").projectId, null);
  const p = createProposal(
    s,
    {
      key: "standalone",
      task: { title: "Send notes", outcome: "Workshop notes shared" },
      evidence,
    },
    "local",
  );
  const reviewed = reviewProposal(
    s,
    { id: p.id, expectedVersion: 1, decision: "approved" },
    "local",
  );
  assert.equal(getTask(s, reviewed.taskId, "local").projectId, null);
  assert.equal(
    reviewProposal(
      s,
      { id: p.id, expectedVersion: 1, decision: "approved" },
      "local",
    ).taskId,
    reviewed.taskId,
  );
  const e = entity(s, { name: "Cedar", type: "project" });
  const project = createProject(
    s,
    { entityId: e.id, objective: "Workshop" },
    "local",
  );
  const assigned = assignTask(
    s,
    { id: reviewed.taskId, expectedVersion: 1, projectId: project.id },
    "local",
  );
  assert.equal(assigned.projectId, project.id);
  assert.throws(
    () =>
      assignTask(
        s,
        { id: assigned.id, expectedVersion: 1, projectId: null },
        "local",
      ),
    /STALE/,
  );
  assignTask(
    s,
    { id: assigned.id, expectedVersion: 2, projectId: null },
    "local",
  );
  assert.equal(taskHistory(s, assigned.id, "local").length, 3);
  const reopened = new Store(s.root);
  assert.equal(getTask(reopened, assigned.id, "local").projectId, null);
  reopened.close();
});
test("schema15 migration preserves accepted task histories and permits null project", async (t) => {
  const { s, evidence } = await data(t);
  const e = entity(s, { name: "Cedar", type: "project" }),
    p = createProject(s, { entityId: e.id, objective: "Deliver" }, "local");
  const proposal = createProposal(
    s,
    {
      key: "prior",
      task: { projectId: p.id, title: "Notes", outcome: "Share notes" },
      evidence,
    },
    "local",
  );
  const reviewed = reviewProposal(
    s,
    { id: proposal.id, expectedVersion: 1, decision: "approved" },
    "local",
  );
  s.db.pragma("user_version=15");
  const before = taskHistory(s, reviewed.taskId, "local");
  migrate(s);
  assert.equal(s.db.pragma("user_version", { simple: true }), 19);
  assert.deepEqual(taskHistory(s, reviewed.taskId, "local"), before);
  assert.equal(s.db.pragma("foreign_key_check").length, 0);
});
test("unassigned candidate matching does not conflate unrelated owners; standalone meetings work", async (t) => {
  const { s, evidence } = await data(t);
  createProposal(
    s,
    {
      key: "one",
      task: { title: "Send notes", outcome: "Share notes", owner: "Alex" },
      evidence,
    },
    "local",
  );
  assert.equal(
    matchCandidates(
      s,
      {
        task: {
          projectId: null,
          title: "Send notes",
          outcome: "Share notes",
          owner: "Morgan",
        },
        evidence: [],
        recurrenceId: null,
      },
      "local",
    ).length,
    0,
  );
  const meeting = await importWork(s, item("calendar"), "local");
  assert.equal(prepareDailyMeeting(s, meeting.id, "local").project, null);
  assert.equal(listTasks(s, "local").length, 0);
});
