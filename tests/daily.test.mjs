import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { entity } from "../dist/core/knowledge.js";
import {
  createProject,
  createProposal,
  reviewProposal,
  updateTask,
} from "../dist/core/tasks.js";
import { importWork } from "../dist/core/work-intake.js";
import {
  dailyView,
  prepareDailyMeeting,
  wallInstant,
} from "../dist/core/daily.js";
import { writeYaml } from "../dist/core/files.js";
const at = new Date("2026-10-19T07:00:00Z");
const options = {
  date: "2026-10-19",
  timezone: "Europe/Paris",
  owner: "Alex",
  coverage: {
    from: "2026-10-18T22:00:00Z",
    to: "2026-10-25T23:00:00Z",
    checkedAt: at.toISOString(),
    complete: true,
  },
};
function setup(t) {
  const f = fixture(t);
  const p = createProject(
    f.s,
    {
      entityId: entity(f.s, { name: "Cedar", type: "project" }).id,
      objective: "Review proposal",
    },
    "local",
  );
  return { ...f, p };
}
async function event(s, p, id, start, end, extra = {}) {
  return importWork(
    s,
    {
      kind: "calendar",
      account: "fictional",
      remoteId: id,
      title: `Cedar ${id}`,
      projectId: p.id,
      occurredAt: start,
      updatedAt: at.toISOString(),
      checkedAt: at.toISOString(),
      timezone: "Europe/Paris",
      segments: [{ text: "Review the proposal with Alex." }],
      calendar: { start, end, participants: ["Alex"], busy: true },
      ...extra,
    },
    "local",
  );
}
function approve(s, p, revision, extra = {}) {
  const ref = s.one(
    "SELECT id,text FROM passages WHERE revision_id=?",
    revision,
  );
  const v = createProposal(
    s,
    {
      key: Math.random().toString(),
      task: {
        projectId: p.id,
        title: "Send proposal",
        outcome: "Provide proposal",
        owner: "Alex",
        ...extra,
      },
      evidence: [{ revisionId: revision, passageId: ref.id, quote: ref.text }],
    },
    "local",
  );
  return reviewProposal(
    s,
    { id: v.id, expectedVersion: 1, decision: "approved" },
    "local",
  );
}
test("daily priorities, date-only deadlines, owner promises, waiting and cited meeting instance", async (t) => {
  const { s, p } = setup(t);
  const e = await event(
    s,
    p,
    "review",
    "2026-10-19T13:00:00Z",
    "2026-10-19T14:00:00Z",
  );
  const a = approve(s, p, e.revisionId, { dueDate: "2026-10-19" });
  const b = approve(s, p, e.revisionId, { owner: "Morgan" });
  updateTask(
    s,
    { id: b.taskId, expectedVersion: 1, status: "waiting" },
    "local",
  );
  const v = dailyView(s, options, "local", at);
  assert.equal(v.priorities[0].id, a.taskId);
  assert.equal(v.priorities[0].reason, "Due today");
  assert.equal(v.promises.length, 1);
  assert.equal(v.waitingFor.length, 1);
  const brief = prepareDailyMeeting(s, e.id, "local");
  assert.equal(brief.event.id, e.id);
  assert.equal(brief.tasks.length, 2);
  s.validateEvidence(brief.event.evidence, "local", true);
  assert.equal(
    dailyView(s, { ...options, owner: null }, "local", at).promises.length,
    0,
  );
});
test("slots respect busy time, buffers, working hours and each other across projects", async (t) => {
  const { s, p } = setup(t);
  await event(s, p, "first", "2026-10-19T13:00:00Z", "2026-10-19T14:00:00Z");
  await event(s, p, "second", "2026-10-19T14:00:00Z", "2026-10-19T15:00:00Z");
  await event(s, p, "busy", "2026-10-19T11:30:00Z", "2026-10-19T12:30:00Z");
  const v = dailyView(s, options, "local", at);
  assert.equal(v.coverage.complete, true);
  const slots = v.slots.filter((x) => x.start);
  assert.ok(slots.length >= 2);
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i];
    assert.ok(Date.parse(a.start) >= at.getTime());
    for (const b of slots.slice(i + 1))
      assert.ok(a.end <= b.start || b.end <= a.start);
  }
  assert.ok(
    v.slots.find((x) => x.title === "Cedar first").end <=
      "2026-10-19T11:15:00.000Z",
  );
});
test("incomplete, stale and restricted availability never generates slots or leaks titles", async (t) => {
  const { s, p } = setup(t);
  const e = await event(
    s,
    p,
    "private",
    "2026-10-19T13:00:00Z",
    "2026-10-19T14:00:00Z",
  );
  assert.equal(
    dailyView(s, { ...options, coverage: undefined }, "local", at).slots[0]
      .start,
    null,
  );
  assert.equal(
    dailyView(s, options, "local", new Date("2026-10-21T07:00:00Z")).coverage
      .complete,
    false,
  );
  const id = s.one(
    "SELECT source_id FROM revisions WHERE id=?",
    e.revisionId,
  ).source_id;
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [id],
  });
  const v = dailyView(s, options, "local", at);
  assert.equal(v.coverage.complete, false);
  assert.equal(v.week.length, 0);
  assert.ok(!JSON.stringify(v).includes("Cedar private"));
  assert.throws(() => prepareDailyMeeting(s, e.id, "local"), /unavailable/);
});
test("DST uses real instants, refuses ambiguous/gap wall times and handles date-only separately", () => {
  assert.equal(
    new Date(wallInstant("2026-10-23", "09:00", "Europe/Paris")).toISOString(),
    "2026-10-23T07:00:00.000Z",
  );
  assert.equal(
    new Date(wallInstant("2026-10-26", "09:00", "Europe/Paris")).toISOString(),
    "2026-10-26T08:00:00.000Z",
  );
  assert.equal(wallInstant("2026-10-25", "02:30", "Europe/Paris"), null);
  assert.equal(wallInstant("2026-03-29", "02:30", "Europe/Paris"), null);
});
test("recurring instances stay distinct; changed/cancelled instances replace old timing", async (t) => {
  const { s, p } = setup(t);
  const a = await event(
    s,
    p,
    "weekly",
    "2026-10-19T13:00:00Z",
    "2026-10-19T14:00:00Z",
    { recurrenceId: "one" },
  );
  await event(s, p, "weekly", "2026-10-20T13:00:00Z", "2026-10-20T14:00:00Z", {
    recurrenceId: "two",
  });
  const changed = await event(
    s,
    p,
    "weekly",
    "2026-10-19T15:00:00Z",
    "2026-10-19T16:00:00Z",
    { recurrenceId: "one", updatedAt: "2026-10-19T08:00:00Z" },
  );
  assert.notEqual(changed.revisionId, a.revisionId);
  assert.throws(() => prepareDailyMeeting(s, a.id, "local"), /unavailable/);
  assert.equal(dailyView(s, options, "local", at).week.length, 2);
  await event(s, p, "weekly", "2026-10-19T15:00:00Z", "2026-10-19T16:00:00Z", {
    recurrenceId: "one",
    updatedAt: "2026-10-19T09:00:00Z",
    cancelled: true,
  });
  assert.equal(dailyView(s, options, "local", at).week.length, 1);
});
test("legacy untimed exports block availability and no-fit workday is explicit", async (t) => {
  const { s, p } = setup(t);
  await event(s, p, "day", "2026-10-19T07:00:00Z", "2026-10-19T16:00:00Z");
  await event(s, p, "late", "2026-10-19T16:00:00Z", "2026-10-19T17:00:00Z");
  const v = dailyView(s, options, "local", at);
  assert.equal(v.slots.find((x) => x.title === "Cedar late").start, null);
  await event(s, p, "legacy", "2026-10-19T13:00:00Z", "2026-10-19T14:00:00Z", {
    calendar: undefined,
  });
  assert.equal(dailyView(s, options, "local", at).coverage.complete, false);
});
test("rechecked unchanged calendar becomes fresh without duplicating event or revision", async (t) => {
  const { s, p } = setup(t);
  const a = await event(
    s,
    p,
    "fresh",
    "2026-10-19T13:00:00Z",
    "2026-10-19T14:00:00Z",
    { checkedAt: "2026-10-17T07:00:00Z" },
  );
  assert.equal(dailyView(s, options, "local", at).coverage.complete, false);
  const b = await event(
    s,
    p,
    "fresh",
    "2026-10-19T13:00:00Z",
    "2026-10-19T14:00:00Z",
  );
  assert.equal(a.revisionId, b.revisionId);
  assert.equal(b.reused, true);
  assert.equal(dailyView(s, options, "local", at).coverage.complete, true);
  assert.equal(dailyView(s, options, "local", at).week.length, 1);
});
test("meeting gathers approved project decisions and documents while excluding other projects", async (t) => {
  const { s, p, file } = setup(t);
  const { capture, reviewMemory } = await import("../dist/core/knowledge.js");
  const { ingest } = await import("../dist/core/intake.js");
  const e = await event(
    s,
    p,
    "review",
    "2026-10-19T13:00:00Z",
    "2026-10-19T14:00:00Z",
  );
  const passage = s.one(
    "SELECT id,text FROM passages WHERE revision_id=?",
    e.revisionId,
  );
  const memory = capture(
    s,
    {
      type: "decision",
      content: "Use the approved scope",
      entities: [p.entity_id],
      evidence: [
        {
          revisionId: e.revisionId,
          passageId: passage.id,
          quote: passage.text,
        },
      ],
    },
    "local",
  );
  reviewMemory(s, memory.id, "approved", "local");
  await ingest(s, file("scope.md", "Approved project scope."), {
    metadata: { project: p.entity_id, title: "Cedar scope" },
  });
  const brief = prepareDailyMeeting(s, e.id, "local");
  assert.equal(brief.decisions.length, 1);
  assert.equal(brief.documents[0].title, "Cedar scope");
  for (const ref of brief.documents) s.validateEvidence([ref], "local", true);
});
test("another project busy period still blocks a project-filtered suggestion", async (t) => {
  const { s, p } = setup(t);
  const other = createProject(
    s,
    {
      entityId: entity(s, { name: "Other client", type: "project" }).id,
      objective: "Other work",
    },
    "local",
  );
  await event(s, p, "review", "2026-10-19T13:00:00Z", "2026-10-19T14:00:00Z");
  await event(s, other, "busy", "2026-10-19T07:00:00Z", "2026-10-19T13:00:00Z");
  const v = dailyView(s, { ...options, projectId: p.id }, "local", at);
  assert.equal(v.week.length, 1);
  assert.equal(v.slots[0].start, null);
});
test("existing meeting workflow includes task evidence and rejects resume after task changes", async (t) => {
  const { s, p, file } = setup(t);
  const { run } = await import("../dist/core/workflow.js");
  const { ingest } = await import("../dist/core/intake.js");
  const e = await event(
    s,
    p,
    "run",
    "2026-10-19T13:00:00Z",
    "2026-10-19T14:00:00Z",
  );
  const approved = approve(s, p, e.revisionId);
  await ingest(s, file("brief.md", "Cedar proposal review."), {
    metadata: { project: p.entity_id, title: "Cedar source" },
  });
  const input = {
    title: "Cedar review",
    start: "2026-10-19T13:00:00Z",
    project: p.entity_id,
  };
  const r = await run(s, "meeting-prep", input, "local");
  assert.equal(r.state, "completed");
  updateTask(
    s,
    { id: approved.taskId, expectedVersion: 1, status: "waiting" },
    "local",
  );
  await assert.rejects(
    run(s, "meeting-prep", input, "local", { resume: r.id }),
    /changed|stale/i,
  );
});
