import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { dashboard, saveRecord, reviewEmail } from "../dist/core/workspace.js";
import {
  savedViews,
  saveViews,
  preferences,
  savePreferences,
  prepareProcessing,
  completeProcessing,
  processingRequests,
} from "../dist/core/daily-workspace.js";
import { ingest } from "../dist/core/intake.js";
import { createConnection, reviewQueue } from "../dist/core/sync.js";
import {
  importWork,
  prepareExtraction,
  submitExtraction,
} from "../dist/core/work-intake.js";
import {
  createProposal,
  reviewProposal,
  updateTask,
} from "../dist/core/tasks.js";
import { writeYaml } from "../dist/core/files.js";
import { Store, migrate } from "../dist/core/store.js";
import { backup, restore } from "../dist/core/backup.js";
const at = new Date("2026-10-25T12:00:00Z");
const project = (s) =>
  saveRecord(
    s,
    {
      kind: "project",
      expectedVersion: 0,
      record: { name: "Fictional Cedar" },
    },
    "local",
  );
async function reference(f) {
  const r = await ingest(
    f.s,
    f.file("evidence.md", "Cedar confirms delivery."),
    { host: "local" },
  );
  const p = f.s.one(
    "SELECT id,text FROM passages WHERE revision_id=?",
    r.revisionId,
  );
  return { revisionId: r.revisionId, passageId: p.id, quote: p.text };
}
function task(s, p, e, title, fields = {}) {
  const proposal = createProposal(
    s,
    {
      key: title,
      task: { title, outcome: title, projectId: p.id, ...fields },
      evidence: [e],
    },
    "local",
  );
  return reviewProposal(
    s,
    { id: proposal.id, expectedVersion: 1, decision: "approved" },
    "local",
  );
}
test("dashboard separates overdue, timed timezone boundaries and completed work from upcoming window", async (t) => {
  const f = fixture(t),
    p = project(f.s),
    e = await reference(f);
  const old = task(f.s, p, e, "Old", { dueDate: "2026-10-24" }),
    due = task(f.s, p, e, "Today", { dueDate: "2026-10-25" }),
    pastTime = task(f.s, p, e, "Elapsed time", {
      dueDate: "2026-10-25",
      dueTime: "09:00",
      timezone: "Europe/Paris",
    });
  task(f.s, p, e, "Ambiguous", {
    dueDate: "2026-10-25",
    dueTime: "02:30",
    timezone: "Europe/Paris",
  });
  const finished = task(f.s, p, e, "Finished", { dueDate: "2026-10-20" });
  updateTask(
    f.s,
    { id: finished.taskId, expectedVersion: 1, status: "done" },
    "local",
  );
  task(f.s, p, e, "Outside", { dueDate: "2026-11-01" });
  task(f.s, p, e, "LA time", {
    dueDate: "2026-10-24",
    dueTime: "23:30",
    timezone: "America/Los_Angeles",
  });
  const d = dashboard(
    f.s,
    "local",
    { date: "2026-10-25", timezone: "Europe/Paris" },
    at,
  );
  assert.deepEqual(
    new Set(d.attention.overdue.map((t) => t.title)),
    new Set(["Old", "Elapsed time", "LA time"]),
  );
  assert.deepEqual(
    new Set(d.deadlines.map((t) => t.title)),
    new Set(["Today", "Ambiguous"]),
  );
  assert.equal(
    d.deadlines.find((t) => t.title === "Ambiguous").deadlineReview,
    true,
  );
  assert.equal(
    d.deadlines.find((t) => t.title === "Today").action.id,
    due.taskId,
  );
  assert.equal(
    d.signals[0].items.some((t) => t.id === finished.taskId),
    false,
  );
});
test("coverage distinguishes unknown, current empty selected scope, partial windows, stale and restricted evidence", async (t) => {
  const f = fixture(t);
  assert.equal(
    dashboard(f.s, "local", {}, at).signals[1].coverage.state,
    "unknown",
  );
  const c = createConnection(
    f.s,
    {
      provider: "calendar",
      label: "Fictional calendar",
      calendarId: "fictional",
      from: "2026-10-24T00:00:00Z",
      to: "2026-11-02T00:00:00Z",
    },
    "local",
  );
  f.s.exec(
    "UPDATE sync_connections SET state='active',last_success=? WHERE id=?",
    at.toISOString(),
    c.id,
  );
  let d = dashboard(f.s, "local", {}, at);
  assert.equal(d.signals[1].coverage.state, "current");
  assert.equal(d.signals[1].items.length, 0);
  assert.equal(
    dashboard(f.s, "local", { date: "2026-11-10" }, at).signals[1].coverage
      .state,
    "partial",
  );
  assert.equal(
    dashboard(f.s, "local", {}, new Date(+at + 16 * 60000)).signals[1].coverage
      .state,
    "stale",
  );
  const r = await ingest(
    f.s,
    f.file("private.md", "Private calendar evidence"),
    { host: "local" },
  );
  f.s.exec(
    "INSERT INTO sync_items VALUES(?,?,?,?)",
    c.id,
    "private",
    "1",
    r.sourceId,
  );
  const policy = f.s.policy();
  policy.deniedSources.push(r.sourceId);
  writeYaml(f.s.path("policies/actions.yaml"), policy);
  assert.equal(
    dashboard(f.s, "local", {}, at).signals[1].coverage.state,
    "partial",
  );
  assert.equal(
    dashboard(f.s, "codex", {}, at).signals[1].coverage.state,
    "unknown",
  );
});
test("workspace timezone and saved views persist, isolate hosts, reject stale saves and invalid settings", (t) => {
  const f = fixture(t);
  savePreferences(f.s, "local", {
    expectedVersion: 0,
    timezone: "America/Los_Angeles",
  });
  assert.equal(
    dashboard(f.s, "local", {}, new Date("2026-10-25T01:00:00Z")).date,
    "2026-10-24",
  );
  const views = [
    {
      name: "Active",
      query: "Cedar",
      filter: "in-progress",
      sort: "name",
      columns: ["owner"],
      view: "board",
    },
  ];
  saveViews(f.s, "local", { kind: "project", expectedVersion: 0, views });
  assert.throws(
    () =>
      saveViews(f.s, "local", { kind: "project", expectedVersion: 0, views }),
    /VIEW_STALE/,
  );
  assert.equal(savedViews(f.s, "codex", "project").views.length, 0);
  const reopened = new Store(f.s.root);
  assert.deepEqual(savedViews(reopened, "local", "project").views, views);
  reopened.close();
  assert.throws(() =>
    saveViews(f.s, "local", {
      kind: "project",
      expectedVersion: 1,
      views: [{ ...views[0], sort: "secret" }],
    }),
  );
  assert.throws(
    () =>
      savePreferences(f.s, "local", { expectedVersion: 0, timezone: "UTC" }),
    /SETTINGS_STALE/,
  );
});
test("email revision-based review reopens on new incoming content and retains visible last-message evidence", async (t) => {
  const f = fixture(t),
    base = {
      kind: "email",
      account: "fictional",
      remoteId: "m1",
      threadId: "thread",
      title: "Confirm delivery",
      occurredAt: "2020-01-01T00:00:00Z",
      updatedAt: "2020-01-01T00:00:00Z",
      checkedAt: new Date().toISOString(),
      segments: [{ text: "Please confirm delivery." }],
      email: {
        direction: "incoming",
        sender: "client@example.test",
        recipients: ["owner@example.test"],
      },
    };
  await importWork(f.s, base, "local");
  let email = dashboard(f.s, "local").emails[0];
  assert.equal(email.sender, "client@example.test");
  assert.ok(email.evidence.length);
  assert.match(email.excerpt, /confirm/);
  reviewEmail(
    f.s,
    {
      id: email.id,
      digest: email.digest,
      state: "snoozed",
      until: new Date(Date.now() + 86400000).toISOString(),
    },
    "local",
  );
  assert.equal(dashboard(f.s, "local").emails.length, 0);
  await importWork(
    f.s,
    {
      ...base,
      remoteId: "m2",
      occurredAt: "2020-01-02T00:00:00Z",
      segments: [{ text: "Please confirm revised delivery." }],
    },
    "local",
  );
  assert.equal(dashboard(f.s, "local").emails[0].state, "candidate");
  await importWork(
    f.s,
    {
      ...base,
      remoteId: "m3",
      occurredAt: "2020-01-03T00:00:00Z",
      email: { ...base.email, direction: "outgoing" },
    },
    "local",
  );
  assert.equal(dashboard(f.s, "local").emails.length, 0);
});
test("processing request binds source revision and assistant; manual review is not a validated result", async (t) => {
  const f = fixture(t),
    p = project(f.s);
  const r = await importWork(
    f.s,
    {
      kind: "transcript",
      account: "fictional",
      remoteId: "call",
      title: "Cedar call",
      occurredAt: at.toISOString(),
      updatedAt: at.toISOString(),
      checkedAt: at.toISOString(),
      projectId: p.id,
      segments: [
        { text: "We discussed options without confirming a commitment." },
      ],
    },
    "codex",
  );
  r.sourceId = f.s.one(
    "SELECT source_id FROM revisions WHERE id=?",
    r.revisionId,
  ).source_id;
  f.s.exec(
    "INSERT INTO assistant_queue VALUES(?,?,?)",
    r.sourceId,
    r.revisionId,
    "awaiting-assistant",
  );
  assert.equal(
    reviewQueue(
      f.s,
      { sourceId: r.sourceId, revisionId: r.revisionId },
      "local",
    ).state,
    "user-reviewed",
  );
  const request = prepareProcessing(f.s, "local", {
    sourceId: r.sourceId,
    revisionId: r.revisionId,
    assistant: "codex",
  });
  assert.equal(
    prepareProcessing(f.s, "local", {
      sourceId: r.sourceId,
      revisionId: r.revisionId,
      assistant: "codex",
    }).id,
    request.id,
  );
  const run = prepareExtraction(f.s, r.id, "codex");
  assert.throws(
    () =>
      completeProcessing(f.s, "codex", {
        requestId: request.id,
        digest: request.digest,
        runIds: [run.runId],
      }),
    /RUN_MISMATCH/,
  );
  submitExtraction(
    f.s,
    {
      runId: run.runId,
      requestDigest: run.requestDigest,
      adapter: "codex",
      extractionVersion: "commitments-v1",
      mentions: [],
    },
    "codex",
  );
  assert.throws(
    () =>
      completeProcessing(f.s, "claude", {
        requestId: request.id,
        digest: request.digest,
        runIds: [run.runId],
      }),
    /REQUEST_MISMATCH/,
  );
  const result = completeProcessing(f.s, "codex", {
    requestId: request.id,
    digest: request.digest,
    runIds: [run.runId],
  });
  assert.equal(result.state, "validated-result");
  assert.equal(processingRequests(f.s, "local")[0].result.runIds[0], run.runId);
  const policy = f.s.policy();
  policy.deniedSources.push(r.sourceId);
  writeYaml(f.s.path("policies/actions.yaml"), policy);
  assert.equal(processingRequests(f.s, "local").length, 0);
});
test("schema 11 backup restores into separate copy and upgrades without touching original source identities", async (t) => {
  const f = fixture(t),
    ref = await reference(f);
  f.s.db.exec(
    "DROP TABLE saved_views; DROP TABLE processing_requests; DROP TABLE workspace_preferences; PRAGMA user_version=11",
  );
  f.s.close();
  const old = new Store(f.s.root);
  const dest = f.root + "/backup";
  backup(old, dest);
  old.close();
  restore(dest, f.root + "/restored");
  const copy = new Store(f.root + "/restored");
  migrate(copy);
  copy.close();
  const current = new Store(f.root + "/restored");
  assert.equal(current.schemaVersion, 19);
  assert.equal(
    current.one("SELECT id FROM revisions WHERE id=?", ref.revisionId).id,
    ref.revisionId,
  );
  assert.equal(savedViews(current, "local", "project").version, 0);
  current.close();
  const unchanged = new Store(f.s.root);
  assert.equal(unchanged.schemaVersion, 11);
  unchanged.close();
});

test("restricted task evidence never enters dashboard titles, counts or result links", async (t) => {
  const f = fixture(t),
    p = project(f.s),
    e = await reference(f);
  const a = task(f.s, p, e, "Confidential obligation", {
    dueDate: "2026-10-20",
  });
  assert.equal(dashboard(f.s, "local", {}, at).signals[0].items.length, 1);
  const sourceId = f.s.one(
    "SELECT source_id FROM revisions WHERE id=?",
    e.revisionId,
  ).source_id;
  const policy = f.s.policy();
  policy.deniedSources.push(sourceId);
  writeYaml(f.s.path("policies/actions.yaml"), policy);
  const d = dashboard(f.s, "local", {}, at);
  assert.equal(d.signals[0].items.length, 0);
  assert.equal(JSON.stringify(d).includes("Confidential obligation"), false);
  assert.equal(JSON.stringify(d).includes(a.taskId), false);
});

test("processing rejects unrelated evidence and changed sources without declaring completion", async (t) => {
  const f = fixture(t),
    p = project(f.s),
    e = await reference(f),
    sourceId = f.s.one(
      "SELECT source_id FROM revisions WHERE id=?",
      e.revisionId,
    ).source_id;
  const request = prepareProcessing(f.s, "local", {
    sourceId,
    revisionId: e.revisionId,
    assistant: "codex",
  });
  const other = await ingest(
      f.s,
      f.file("other.md", "Unrelated confirmed scope."),
      { host: "codex" },
    ),
    ref = f.s.one(
      "SELECT id,text FROM passages WHERE revision_id=?",
      other.revisionId,
    );
  const proposal = createProposal(
    f.s,
    {
      key: "unrelated",
      task: { projectId: p.id, title: "Other work", outcome: "Other work" },
      evidence: [
        { revisionId: other.revisionId, passageId: ref.id, quote: ref.text },
      ],
    },
    "codex",
  );
  assert.throws(
    () =>
      completeProcessing(f.s, "codex", {
        requestId: request.id,
        digest: request.digest,
        proposalIds: [proposal.id],
      }),
    /EVIDENCE_MISMATCH/,
  );
  assert.equal(processingRequests(f.s, "local")[0].state, "awaiting-assistant");
  const { changeSource, sourceImpact } = await import("../dist/core/hub.js");
  const impact = sourceImpact(f.s, sourceId, "local");
  changeSource(
    f.s,
    {
      id: sourceId,
      expectedVersion: 0,
      digest: impact.digest,
      state: "archived",
    },
    "local",
  );
  assert.throws(
    () =>
      completeProcessing(f.s, "codex", {
        requestId: request.id,
        digest: request.digest,
        proposalIds: [proposal.id],
      }),
    /SOURCE_CHANGED/,
  );
  assert.equal(processingRequests(f.s, "local").length, 0);
});
test("executive indicators and attention order use recorded work without treating missing calendar coverage as zero", async (t) => {
  const f = fixture(t);
  const overdue = saveRecord(
    f.s,
    {
      kind: "project",
      expectedVersion: 0,
      record: {
        name: "Late fictional project",
        status: "in-progress",
        dueDate: "2026-10-24",
      },
    },
    "local",
  );
  saveRecord(
    f.s,
    {
      kind: "project",
      expectedVersion: 0,
      record: { name: "Blocked fictional project", status: "blocked" },
    },
    "local",
  );
  saveRecord(
    f.s,
    {
      kind: "project",
      expectedVersion: 0,
      record: {
        name: "Completed fictional project",
        status: "completed",
        dueDate: "2026-10-20",
      },
    },
    "local",
  );
  saveRecord(
    f.s,
    {
      kind: "project",
      expectedVersion: 0,
      record: {
        name: "Future fictional project",
        status: "planned",
        dueDate: "2026-10-27",
      },
    },
    "local",
  );
  const r = dashboard(f.s, "local", {}, at);
  assert.deepEqual(
    r.executive.indicators.map((k) => k.count),
    [0, 1, 1, 0],
  );
  assert.equal(r.executive.indicators[3].coverage.state, "unknown");
  assert.equal(r.executive.queue[0].id, overdue.id);
  assert.deepEqual(
    r.executive.queue.map((q) => q.reason),
    ["Overdue", "Blocked"],
  );
  assert.equal(
    r.executive.queue.some((q) => q.name.includes("Completed")),
    false,
  );
});
