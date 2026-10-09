import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";
import { entity } from "../dist/core/knowledge.js";
import {
  createProject,
  reviewProposal,
  listTasks,
  listProposals,
  updateTask,
  getTask,
} from "../dist/core/tasks.js";
import {
  importWork,
  prepareExtraction,
  submitExtraction,
  listMentions,
  resolveMention,
  undoDecision,
  decisions,
  intakeList,
} from "../dist/core/work-intake.js";
import { writeYaml } from "../dist/core/files.js";
import { backup, restore } from "../dist/core/backup.js";
import { Store, CURRENT_SCHEMA_VERSION } from "../dist/core/store.js";
import { spawnSync } from "node:child_process";
function setup(t) {
  const f = fixture(t);
  const e = entity(f.s, { name: "Cedar", type: "project" });
  const p = createProject(
    f.s,
    { entityId: e.id, objective: "Cedar proposal" },
    "local",
  );
  return { ...f, p };
}
function item(p, kind, remoteId, extra = {}) {
  return {
    kind,
    remoteId,
    account: "fictional@example.invalid",
    title: `Cedar ${kind}`,
    occurredAt: "2026-09-26T09:00:00Z",
    updatedAt: "2026-09-26T10:00:00Z",
    checkedAt: "2026-09-26T11:00:00Z",
    projectId: p.id,
    timezone: kind === "calendar" ? "Europe/Paris" : null,
    segments: [{ text: "Send the Cedar proposal.", speaker: "Alex" }],
    ...extra,
  };
}
function task(p, extra = {}) {
  return {
    projectId: p.id,
    title: "Send Cedar proposal",
    outcome: "Deliver the proposal",
    owner: null,
    dueDate: null,
    dueTime: null,
    timezone: null,
    ...extra,
  };
}
async function extracted(s, p, kind, remoteId, changes = {}, itemChanges = {}) {
  const i = await importWork(s, item(p, kind, remoteId, itemChanges), "local"),
    r = prepareExtraction(s, i.id, "local");
  const quote =
    itemChanges.segments?.find((x) => !x.quoted)?.text ??
    "Send the Cedar proposal.";
  const ref = r.passages.find((x) => x.text.includes(quote));
  const input = {
    runId: r.runId,
    requestDigest: r.requestDigest,
    adapter: "codex",
    extractionVersion: "commitments-v1",
    mentions: [
      {
        task: task(p, changes),
        intent: kind === "calendar" ? "context" : "commitment",
        actor: "Alex",
        recurrenceId: itemChanges.recurrenceId ?? null,
        evidence: [
          { revisionId: ref.revisionId, passageId: ref.passageId, quote },
        ],
      },
    ],
  };
  submitExtraction(s, input, "local");
  const m = listMentions(s, "local").find((m) => m.run_id === r.runId);
  return { i, r, m, input };
}
function resolve(s, m, decision, extra = {}) {
  return resolveMention(
    s,
    { id: m.id, expectedVersion: m.version, decision, ...extra },
    "local",
  );
}
test("email transcript calendar resolve to one task; retries are idempotent and merge undo is reversible", async (t) => {
  const { s, p } = setup(t);
  const email = await extracted(s, p, "email", "message-1");
  const sep = resolve(s, email.m, "separate");
  const approved = reviewProposal(
    s,
    { id: sep.proposalId, expectedVersion: 1, decision: "approved" },
    "local",
  );
  const transcript = await extracted(s, p, "transcript", "meeting-1");
  const merge = resolve(s, transcript.m, "merge", {
    targetId: sep.proposalId,
    targetVersion: 1,
  });
  assert.equal(
    resolve(s, transcript.m, "merge", {
      targetId: sep.proposalId,
      targetVersion: 1,
    }).reused,
    true,
  );
  assert.equal(getTask(s, approved.taskId, "local").evidence.length, 2);
  undoDecision(s, merge.decisionId, "local");
  assert.equal(getTask(s, approved.taskId, "local").evidence.length, 1);
  const calendar = await extracted(s, p, "calendar", "event-1");
  assert.throws(() => resolve(s, calendar.m, "separate"), /Context/);
  resolve(s, calendar.m, "merge", {
    targetId: sep.proposalId,
    targetVersion: 3,
  });
  assert.equal(listTasks(s, "local").length, 1);
  assert.equal(listTasks(s, "local")[0].evidence.length, 2);
  const again = await importWork(s, item(p, "email", "message-1"), "local");
  assert.equal(again.reused, true);
  assert.equal(submitExtraction(s, email.input, "local").reused, true);
  assert.equal(listMentions(s, "local").length, 3);
});
test("bilingual matching, changed deadline review, completed tasks and rejection survive new evidence", async (t) => {
  const { s, p } = setup(t);
  const a = await extracted(s, p, "email", "one");
  const sep = resolve(s, a.m, "separate");
  const approved = reviewProposal(
    s,
    { id: sep.proposalId, expectedVersion: 1, decision: "approved" },
    "local",
  );
  updateTask(
    s,
    { id: approved.taskId, expectedVersion: 1, status: "done" },
    "local",
  );
  const b = await extracted(
    s,
    p,
    "transcript",
    "two",
    { title: "Envoyer la proposition Cedar", dueDate: "2026-10-02" },
    { segments: [{ text: "Envoyer la proposition Cedar vendredi." }] },
  );
  assert.equal(b.m.candidates[0].proposalId, sep.proposalId);
  assert.throws(
    () =>
      resolve(s, b.m, "merge", { targetId: sep.proposalId, targetVersion: 2 }),
    /Changed fields/,
  );
  resolve(s, b.m, "update", { targetId: sep.proposalId, targetVersion: 2 });
  assert.equal(listTasks(s, "local")[0].dueDate, "2026-10-02");
  assert.equal(listTasks(s, "local")[0].status, "done");
  const c = await extracted(s, p, "email", "three");
  const cp = resolve(s, c.m, "separate");
  reviewProposal(
    s,
    { id: cp.proposalId, expectedVersion: 1, decision: "rejected" },
    "local",
  );
  const repeated = await extracted(s, p, "email", "four");
  assert.equal(repeated.m.state, "suppressed");
  assert.equal(listTasks(s, "local").length, 1);
});
test("quoted and invented evidence, calendar promises and stale extraction are rejected", async (t) => {
  const { s, p } = setup(t);
  const i = await importWork(
    s,
    item(p, "email", "q", {
      segments: [
        { text: "Thanks.\n> Send the proposal." },
        { text: "Old deadline Friday", quoted: true },
      ],
    }),
    "local",
  );
  const r = prepareExtraction(s, i.id, "local");
  const bad = {
    runId: r.runId,
    requestDigest: r.requestDigest,
    adapter: "codex",
    extractionVersion: "commitments-v1",
    mentions: [
      {
        task: task(p),
        intent: "commitment",
        actor: null,
        evidence: [
          {
            revisionId: r.passages[0].revisionId,
            passageId: r.passages.find((p) =>
              p.text.includes("Old deadline Friday"),
            ).passageId,
            quote: "Old deadline Friday",
          },
        ],
      },
    ],
  };
  assert.throws(() => submitExtraction(s, bad, "local"), /non-quoted/);
  assert.equal(listMentions(s, "local").length, 0);
  await importWork(
    s,
    item(p, "email", "q", {
      updatedAt: "2026-09-27T10:00:00Z",
      segments: [{ text: "Changed" }],
    }),
    "local",
  );
  assert.throws(
    () => submitExtraction(s, { ...bad, mentions: [] }, "local"),
    /stale/,
  );
  const cal = await importWork(s, item(p, "calendar", "event"), "local"),
    cr = prepareExtraction(s, cal.id, "local");
  assert.throws(
    () =>
      submitExtraction(
        s,
        {
          ...bad,
          runId: cr.runId,
          requestDigest: cr.requestDigest,
          mentions: [
            {
              ...bad.mentions[0],
              evidence: [
                {
                  revisionId: cr.passages[0].revisionId,
                  passageId: cr.passages[0].passageId,
                  quote: "Send the Cedar proposal.",
                },
              ],
            },
          ],
        },
        "local",
      ),
    /Calendar context/,
  );
});
test("project and recurring instance boundaries, policy revocation, and stale undo", async (t) => {
  const { s, p } = setup(t);
  const a = await extracted(
    s,
    p,
    "email",
    "one",
    {},
    { recurrenceId: "week1" },
  );
  const sep = resolve(s, a.m, "separate");
  const b = await extracted(
    s,
    p,
    "transcript",
    "two",
    {},
    { recurrenceId: "week2" },
  );
  assert.equal(b.m.candidates.length, 0);
  const other = createProject(
    s,
    {
      entityId: entity(s, { type: "project", name: "Other" }).id,
      objective: "Separate client",
    },
    "local",
  );
  const c = await extracted(s, other, "email", "other");
  assert.equal(c.m.candidates.length, 0);
  reviewProposal(
    s,
    { id: sep.proposalId, expectedVersion: 1, decision: "approved" },
    "local",
  );
  assert.throws(
    () => undoDecision(s, sep.decisionId, "local"),
    /STALE_VERSION/,
  );
  const source = s.one(
    "SELECT source_id FROM revisions WHERE id=?",
    a.m.evidence[0].revisionId,
  ).source_id;
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [source],
  });
  assert.equal(listTasks(s, "local").length, 0);
  assert.equal(
    listMentions(s, "local").some((x) => x.id === a.m.id),
    false,
  );
  assert.throws(() => prepareExtraction(s, a.i.id, "local"), /unavailable/);
});
test("interrupted import retry and failed resolution roll back without duplicate proposals", async (t) => {
  const { s, p } = setup(t);
  const a = await extracted(s, p, "email", "one");
  s.exec("UPDATE work_intake SET state='running' WHERE id=?", a.i.id);
  const r = await importWork(s, item(p, "email", "one"), "local");
  assert.equal(r.revisionId, a.i.revisionId);
  s.db.exec(
    "CREATE TRIGGER fail_resolution BEFORE INSERT ON intake_decisions BEGIN SELECT RAISE(ABORT, 'injected'); END",
  );
  assert.throws(() => resolve(s, a.m, "separate"), /injected/);
  assert.equal(listProposals(s, "local").length, 0);
  assert.equal(listMentions(s, "local")[0].state, "pending");
  s.db.exec("DROP TRIGGER fail_resolution");
  resolve(s, a.m, "separate");
  assert.equal(listProposals(s, "local").length, 1);
});
test("schema 3 backup upgrades to 4 and restored intake preserves decisions and original evidence", async (t) => {
  const { s, p, root } = setup(t);
  const a = await extracted(s, p, "email", "one");
  resolve(s, a.m, "separate");
  const b = join(root, "backup");
  backup(s, b);
  const restored = join(root, "restore");
  restore(b, restored);
  const copy = new Store(restored);
  assert.equal(decisions(copy, "local").length, 1);
  assert.equal(intakeList(copy, "local").length, 1);
  copy.close();
  s.db.exec(
    "DROP TABLE intake_decisions; DROP TABLE commitment_mentions; DROP TABLE extraction_runs; DROP TABLE work_intake; PRAGMA user_version=3",
  );
  s.close();
  const out = spawnSync(
    process.execPath,
    [
      "bin/hoi.mjs",
      "upgrade",
      join(root, "pre4"),
      "--workspace",
      join(root, "workspace"),
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(out.status, 0, out.stderr);
  const upgraded = new Store(join(root, "workspace"));
  assert.equal(upgraded.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(listProposals(upgraded, "local").length, 1);
  upgraded.close();
});
test("concurrent imports, source ownership, stale retries and reviewed rejection remain safe", async (t) => {
  const { s, p } = setup(t),
    v = item(p, "email", "same");
  const pending = importWork(s, v, "local");
  await assert.rejects(importWork(s, v, "local"), /already running/);
  await pending;
  const a = await extracted(s, p, "email", "rejected");
  resolve(s, a.m, "reject");
  const repeat = await extracted(s, p, "transcript", "repeated");
  assert.equal(repeat.m.state, "suppressed");
  const other = createProject(
    s,
    {
      entityId: entity(s, { type: "project", name: "Other" }).id,
      objective: "Other",
    },
    "local",
  );
  await assert.rejects(
    importWork(s, { ...v, projectId: other.id }, "local"),
    /another project/,
  );
  const old = intakeList(s, "local").find((x) => x.title === v.title);
  await importWork(
    s,
    { ...v, updatedAt: "2026-10-01T10:00:00Z", segments: [{ text: "New" }] },
    "local",
  );
  s.exec("UPDATE work_intake SET state='failed' WHERE id=?", old.id);
  await assert.rejects(importWork(s, v, "local"), /Older export/);
});
test("updated source replaces current evidence and undo retains permission lineage", async (t) => {
  const { s, p } = setup(t);
  const a = await extracted(s, p, "email", "change");
  const sep = resolve(s, a.m, "separate");
  const b = await extracted(
    s,
    p,
    "email",
    "change",
    { dueDate: "2026-10-02" },
    { updatedAt: "2026-09-27T10:00:00Z" },
  );
  assert.throws(
    () =>
      resolve(s, b.m, "update", { targetId: sep.proposalId, targetVersion: 2 }),
    /STALE_VERSION/,
  );
  resolve(s, b.m, "update", { targetId: sep.proposalId, targetVersion: 1 });
  const approved = reviewProposal(
    s,
    { id: sep.proposalId, expectedVersion: 2, decision: "approved" },
    "local",
  );
  assert.equal(getTask(s, approved.taskId, "local").evidenceCurrent, true);
  const c = await extracted(s, p, "transcript", "new", {
    dueDate: "2026-10-03",
  });
  const update = resolve(s, c.m, "update", {
    targetId: sep.proposalId,
    targetVersion: 1,
  });
  undoDecision(s, update.decisionId, "local");
  assert.equal(getTask(s, approved.taskId, "local").dueDate, "2026-10-02");
  const source = s.one(
    "SELECT source_id FROM revisions WHERE id=?",
    c.m.evidence[0].revisionId,
  ).source_id;
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [source],
  });
  assert.equal(listTasks(s, "local").length, 0);
});
