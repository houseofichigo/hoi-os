import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fixture } from "./helpers.mjs";
import { Store, migrate, CURRENT_SCHEMA_VERSION } from "../dist/core/store.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import { entity } from "../dist/core/knowledge.js";
import { writeYaml } from "../dist/core/files.js";
import { backup, restore } from "../dist/core/backup.js";
import { listWiki } from "../dist/core/wiki.js";
import {
  createProject,
  listProjects,
  createProposal,
  listProposals,
  reviewProposal,
  listTasks,
  getTask,
  updateTask,
  taskHistory,
} from "../dist/core/tasks.js";
import { serve } from "../dist/core/server.js";

async function setup(t) {
  const f = fixture(t),
    { s } = f;
  const e = entity(s, { name: "Cedar pilot", type: "project" });
  const p = createProject(
    s,
    { entityId: e.id, objective: "Deliver reviewed proposal" },
    "local",
  );
  const refs = [];
  for (const [name, text] of [
    ["email", "Please send the Cedar proposal Friday."],
    ["transcript", "Alex: I will send the Cedar proposal Friday."],
    ["calendar", "Cedar proposal review Friday."],
  ]) {
    await ingest(s, f.file(`${name}.md`, text));
    const r = retrieve(
      s,
      name === "transcript" ? "Alex" : "Cedar",
      "local",
    ).results.find((r) => r.quote === text);
    assert.ok(r);
    refs.push({
      revisionId: r.revisionId,
      passageId: r.passageId,
      quote: r.quote,
    });
  }
  const input = {
    key: "cedar-proposal-v1",
    task: {
      projectId: p.id,
      title: "Send Cedar proposal",
      outcome: "Deliver the revised proposal",
    },
    evidence: refs,
  };
  return { ...f, p, input };
}
test("one proposal with three sources approves once and persists across restart", async (t) => {
  const { s, input } = await setup(t);
  const p = createProposal(s, input, "local");
  assert.equal(p.task.owner, null);
  assert.equal(p.task.dueDate, null);
  assert.equal(createProposal(s, input, "local").id, p.id);
  const a = reviewProposal(
    s,
    { id: p.id, expectedVersion: 1, decision: "approved" },
    "local",
  );
  assert.equal(
    reviewProposal(
      s,
      { id: p.id, expectedVersion: 1, decision: "approved" },
      "local",
    ).taskId,
    a.taskId,
  );
  assert.equal(listTasks(s, "local").length, 1);
  assert.equal(getTask(s, a.taskId, "local").evidence.length, 3);
  assert.throws(
    () =>
      reviewProposal(
        s,
        { id: p.id, expectedVersion: 1, decision: "rejected" },
        "local",
      ),
    /STALE_VERSION/,
  );
  const second = new Store(s.root);
  t.after(() => second.close());
  assert.equal(listTasks(second, "local")[0].id, a.taskId);
  const task = updateTask(
    s,
    { id: a.taskId, expectedVersion: 1, status: "waiting" },
    "local",
  );
  assert.equal(task.version, 2);
  assert.throws(
    () =>
      updateTask(
        second,
        { id: a.taskId, expectedVersion: 1, status: "done" },
        "local",
      ),
    /STALE_VERSION/,
  );
  assert.equal(taskHistory(s, a.taskId, "local").length, 2);
  const out = spawnSync(
    process.execPath,
    ["bin/hoi.mjs", "task", "list", "--workspace", s.root, "--json"],
    { encoding: "utf8" },
  );
  assert.equal(out.status, 0, out.stderr);
  assert.equal(JSON.parse(out.stdout)[0].id, a.taskId);
});
test("rejection, validation, stale evidence and transaction failure cannot create tasks", async (t) => {
  const { s, input } = await setup(t);
  assert.throws(() =>
    createProposal(
      s,
      { ...input, task: { ...input.task, dueTime: "10:00" } },
      "local",
    ),
  );
  assert.throws(
    () =>
      createProposal(
        s,
        { ...input, evidence: [{ ...input.evidence[0], quote: "fabricated" }] },
        "local",
      ),
    /Evidence/,
  );
  const p = createProposal(s, input, "local");
  assert.throws(
    () =>
      reviewProposal(
        s,
        { id: p.id, expectedVersion: 2, decision: "approved" },
        "local",
      ),
    /STALE_VERSION/,
  );
  s.db.exec(
    "CREATE TRIGGER fail_task BEFORE INSERT ON task_history BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
  );
  assert.throws(
    () =>
      reviewProposal(
        s,
        { id: p.id, expectedVersion: 1, decision: "approved" },
        "local",
      ),
    /injected failure/,
  );
  assert.equal(listTasks(s, "local").length, 0);
  assert.equal(listProposals(s, "local")[0].state, "proposed");
  s.db.exec("DROP TRIGGER fail_task");
  reviewProposal(
    s,
    { id: p.id, expectedVersion: 1, decision: "rejected" },
    "local",
  );
  assert.equal(createProposal(s, input, "local").state, "rejected");
  assert.equal(listTasks(s, "local").length, 0);
  const fresh = createProposal(s, { ...input, key: "changed" }, "local");
  s.exec(
    "UPDATE sources SET current_revision='unavailable' WHERE current_revision=?",
    input.evidence[0].revisionId,
  );
  assert.throws(
    () =>
      reviewProposal(
        s,
        { id: fresh.id, expectedVersion: 1, decision: "approved" },
        "local",
      ),
    /stale/,
  );
});
test("revoking any supporting source hides task titles, proposals, details and history", async (t) => {
  const { s, input } = await setup(t);
  const p = createProposal(s, input, "local");
  const a = reviewProposal(
    s,
    { id: p.id, expectedVersion: 1, decision: "approved" },
    "local",
  );
  const source = s.one(
    "SELECT source_id FROM revisions WHERE id=?",
    input.evidence[0].revisionId,
  ).source_id;
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [source],
  });
  assert.deepEqual(listTasks(s, "local"), []);
  assert.deepEqual(listProposals(s, "local"), []);
  assert.throws(() => getTask(s, a.taskId, "local"), /unavailable/);
  assert.throws(() => taskHistory(s, a.taskId, "local"), /unavailable/);
  assert.throws(
    () =>
      reviewProposal(
        s,
        { id: p.id, expectedVersion: 1, decision: "approved" },
        "local",
      ),
    /unavailable/,
  );
});
for (const version of [1, 2])
  test(`backup, restore and sequential upgrade from schema ${version}`, async (t) => {
    const { s, root } = fixture(t);
    s.db.exec(
      "DROP TABLE task_history; DROP TABLE task_evidence; DROP TABLE tasks; DROP TABLE task_proposals; DROP TABLE projects;",
    );
    if (version === 1)
      s.db.exec("DROP TABLE wiki_evidence; DROP TABLE wiki_pages;");
    s.db.exec(`PRAGMA user_version=${version}`);
    s.close();
    const old = new Store(join(root, "workspace"));
    t.after(() => old.close());
    assert.equal(old.schemaVersion, version);
    if (version === 2) assert.deepEqual(listWiki(old, "local"), []);
    assert.throws(() => listProjects(old, "local"), /requires schema 3/);
    const b = join(root, "backup");
    backup(old, b);
    const restored = join(root, "restored");
    restore(b, restored);
    const r = new Store(restored);
    assert.equal(r.schemaVersion, version);
    r.close();
    const out = spawnSync(
      process.execPath,
      [
        "bin/hoi.mjs",
        "upgrade",
        join(root, "pre-upgrade"),
        "--workspace",
        restored,
        "--json",
      ],
      { encoding: "utf8" },
    );
    assert.equal(out.status, 0, out.stderr);
    const upgraded = new Store(restored);
    t.after(() => upgraded.close());
    assert.equal(upgraded.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(listProjects(upgraded, "local"), []);
    assert.deepEqual(listWiki(upgraded, "local"), []);
  });
test("app endpoints require authentication, retain read-only map and reject stale writes", async (t) => {
  const { s, input } = await setup(t);
  const p = createProposal(s, input, "local");
  const app = await serve(s, "local", join(process.cwd(), "dist/web"), 0, {
    app: true,
  });
  t.after(() => new Promise((ok) => app.server.close(ok)));
  const base = app.url.split("/app#")[0];
  const headers = {
    Authorization: `Bearer ${app.token}`,
    "Content-Type": "application/json",
    Origin: base,
  };
  assert.equal((await fetch(`${base}/api/tasks`)).status, 401);
  assert.equal(
    (
      await fetch(`${base}/api/tasks/review`, {
        method: "POST",
        headers: { ...headers, Origin: "https://invalid.test" },
        body: JSON.stringify({
          id: p.id,
          expectedVersion: 1,
          decision: "approved",
        }),
      })
    ).status,
    403,
  );
  const payload = { id: p.id, expectedVersion: 1, decision: "approved" };
  const replies = await Promise.all(
    [1, 2].map(() =>
      fetch(`${base}/api/tasks/review`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    ),
  );
  assert.equal(replies[0].taskId, replies[1].taskId);
  const stale = await fetch(`${base}/api/tasks/update`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: replies[0].taskId,
      expectedVersion: 99,
      status: "done",
    }),
  });
  assert.equal(stale.status, 409);
  const map = await serve(s, "local", join(process.cwd(), "dist/web"), 0);
  t.after(() => new Promise((ok) => map.server.close(ok)));
  assert.equal(
    (
      await fetch(`${map.url.split("/#")[0]}/api/tasks/review`, {
        method: "POST",
      })
    ).status,
    405,
  );
});

test("approved task survives source reimport, backup and restoration elsewhere", async (t) => {
  const { s, input, root } = await setup(t);
  const p = createProposal(s, input, "local");
  const a = reviewProposal(
    s,
    { id: p.id, expectedVersion: 1, decision: "approved" },
    "local",
  );
  for (const r of s.all("SELECT location FROM sources"))
    await ingest(s, r.location);
  assert.equal(createProposal(s, input, "local").taskId, a.taskId);
  const destination = join(root, "task-backup");
  backup(s, destination);
  const restored = join(root, "new location");
  restore(destination, restored);
  const copy = new Store(restored);
  t.after(() => copy.close());
  assert.deepEqual(
    getTask(copy, a.taskId, "local"),
    getTask(s, a.taskId, "local"),
  );
  assert.deepEqual(
    taskHistory(copy, a.taskId, "local"),
    taskHistory(s, a.taskId, "local"),
  );
  copy.validateEvidence(
    getTask(copy, a.taskId, "local").evidence,
    "local",
    true,
  );
});

test("host allowlists and denied mutation policy apply to task operations", async (t) => {
  const { s, input, p } = await setup(t);
  const proposed = createProposal(
    s,
    { ...input, allowedHosts: ["local"] },
    "local",
  );
  assert.deepEqual(listProposals(s, "codex"), []);
  assert.throws(
    () =>
      reviewProposal(
        s,
        { id: proposed.id, expectedVersion: 1, decision: "approved" },
        "codex",
      ),
    /unavailable/,
  );
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    actions: { ...s.policy().actions, draft: "deny" },
  });
  assert.throws(
    () =>
      reviewProposal(
        s,
        { id: proposed.id, expectedVersion: 1, decision: "approved" },
        "local",
      ),
    /denied/,
  );
  assert.equal(listProposals(s, "local").length, 1);
  s.exec(
    "UPDATE entities SET allowed_hosts=? WHERE id=?",
    JSON.stringify(["claude"]),
    p.entity_id,
  );
  assert.deepEqual(listProposals(s, "local"), []);
});

test("approval-required drafting permits task review but refuses direct status changes", async (t) => {
  const { s, input } = await setup(t);
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    actions: { ...s.policy().actions, draft: "approve" },
  });
  const p = createProposal(s, input, "local");
  const a = reviewProposal(
    s,
    { id: p.id, expectedVersion: 1, decision: "approved" },
    "local",
  );
  assert.throws(
    () =>
      updateTask(
        s,
        { id: a.taskId, expectedVersion: 1, status: "done" },
        "local",
      ),
    /requires a review flow/,
  );
});
