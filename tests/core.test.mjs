import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialize, Store } from "../dist/core/store.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import {
  capture,
  reviewMemory,
  context,
  entity,
  relationship,
  onboard,
  consolidate,
} from "../dist/core/knowledge.js";
import {
  run,
  saveCapability,
  evaluate,
  activate,
} from "../dist/core/workflow.js";
import { organize, approve, applyOrganization } from "../dist/core/organize.js";
import { backup, restore } from "../dist/core/backup.js";
import { graph } from "../dist/core/graph.js";
import { writeYaml, readNote } from "../dist/core/files.js";
export function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "hoi-test-")),
    workspace = join(root, "workspace");
  initialize(workspace);
  const s = new Store(workspace);
  t.after(() => {
    try {
      s.close();
    } catch {}
    rmSync(root, { recursive: true, force: true });
  });
  return {
    root,
    s,
    file: (name, text) => {
      const p = join(root, name);
      writeFileSync(p, text);
      return p;
    },
  };
}
test("source identity, duplicate occurrences, immutable evidence and moved files", async (t) => {
  const { s, file } = fixture(t);
  const p = file("proposal.md", "Atlas delivery is due on 2026-10-12.");
  const a = await ingest(s, p),
    b = await ingest(s, p);
  assert.equal(a.sourceId, b.sourceId);
  assert.equal(b.duplicate, true);
  assert.equal(s.one("SELECT COUNT(*) n FROM occurrences").n, 2);
  const evidence = retrieve(s, "Atlas", "codex").results[0];
  file("proposal.md", "Atlas delivery is due on 2026-11-14.");
  const c = await ingest(s, p);
  assert.notEqual(c.revisionId, a.revisionId);
  assert.equal(
    retrieve(s, "Atlas", "codex").results[0].revisionId,
    c.revisionId,
  );
  s.validateEvidence([evidence]);
  assert.throws(() => s.validateEvidence([evidence], "codex", true), /stale/);
  const moved = file("renamed.md", "Atlas delivery is due on 2026-11-14.");
  assert.equal(
    (await ingest(s, moved, { sourceId: a.sourceId })).sourceId,
    a.sourceId,
  );
});
test("source policy filters before returning text; current restrictions apply to old evidence", async (t) => {
  const { s, file } = fixture(t);
  const a = await ingest(s, file("secret.md", "confidential octopus pricing"), {
    metadata: { sensitivity: "restricted" },
  });
  assert.equal(retrieve(s, "octopus", "codex").results.length, 0);
  assert.equal(
    graph(s, "codex").nodes.filter((n) => n.type === "document").length,
    0,
  );
  const policy = s.policy();
  policy.allowRestrictedHosts = ["local"];
  writeYaml(s.path("policies/actions.yaml"), policy);
  const e = retrieve(s, "octopus", "local").results[0];
  assert.ok(e);
  assert.throws(() => s.validateEvidence([e], "codex"), /permitted/);
  policy.deniedSources = [a.sourceId];
  writeYaml(s.path("policies/actions.yaml"), policy);
  assert.equal(retrieve(s, "octopus", "local").results.length, 0);
});
test("unsupported input retained and reported, credential paths excluded", async (t) => {
  const { root, s, file } = fixture(t);
  const p = file("unknown.bin", "preserve me");
  const a = await ingest(s, p);
  assert.equal(a.status, "failed");
  const r = s.one("SELECT * FROM revisions WHERE id=?", a.revisionId);
  assert.equal(readFileSync(s.path(r.original_path), "utf8"), "preserve me");
  mkdirSync(join(root, ".secrets"));
  writeFileSync(join(root, ".secrets", "key.txt"), "secret");
  await assert.rejects(
    ingest(s, join(root, ".secrets", "key.txt")),
    /Excluded/,
  );
});
test("approval binds exact plan, policy and revision; conflicting destination is preserved", async (t) => {
  const { s, file } = fixture(t);
  const p = file("a.md", "Atlas contract");
  await ingest(s, p);
  const plan = organize(s, "codex");
  assert.throws(() => approve(s, plan.id, "wrong"), /changed/);
  const approval = approve(s, plan.id, plan.hash);
  const changed = s.policy();
  changed.maxContextChars = 12000;
  writeYaml(s.path("policies/actions.yaml"), changed);
  assert.throws(
    () => applyOrganization(s, plan.id, approval.id, "codex"),
    /stale/,
  );
  const a2 = approve(s, plan.id, plan.hash);
  assert.equal(applyOrganization(s, plan.id, a2.id, "codex").count, 1);
  assert.throws(
    () => applyOrganization(s, plan.id, a2.id, "codex"),
    /consumed/,
  );
  assert.ok(existsSync(s.path(plan.entries[0].to)));
});
test("memory stays proposed until reviewed, becomes stale and preserves supersession", async (t) => {
  const { s, file } = fixture(t);
  const p = file("notes.md", "Atlas meeting agreed on a pilot.");
  await ingest(s, p);
  const e = retrieve(s, "Atlas", "codex").results[0];
  const evidence = [
    {
      revisionId: e.revisionId,
      passageId: e.passageId,
      quote: "agreed on a pilot",
    },
  ];
  const m = capture(
    s,
    { type: "decision", content: "Run the pilot", evidence },
    "codex",
  );
  assert.equal(context(s, "codex").memories.length, 0);
  reviewMemory(s, m.id, "approved", "codex");
  assert.equal(context(s, "codex").memories.length, 1);
  file("notes.md", "Atlas meeting postponed.");
  await ingest(s, p);
  assert.equal(context(s, "codex").memories.length, 0);
  assert.ok(consolidate(s, "codex").stale.includes(m.id));
  const next = capture(
    s,
    { type: "decision", content: "Pause the pilot", supersedes: m.id },
    "codex",
  );
  reviewMemory(s, next.id, "approved", "codex");
  assert.equal(readNote(s.path(`memory/${m.id}.md`)).state, "superseded");
});
test("entity aliases do not merge ambiguous names; graph relationships need valid endpoints and evidence", async (t) => {
  const { s, file } = fixture(t);
  const a = entity(s, { name: "Alex", type: "person" }),
    b = entity(s, { name: "Alex", type: "person" });
  assert.notEqual(a.id, b.id);
  assert.throws(
    () =>
      relationship(
        s,
        { from: a.id, to: b.id, type: "KNOWS", basis: "supported" },
        "codex",
      ),
    /require evidence/,
  );
  relationship(
    s,
    { from: a.id, to: b.id, type: "KNOWS", basis: "manual" },
    "codex",
  );
  const g = graph(s, "codex");
  assert.equal(g.links.filter((l) => l.type === "KNOWS").length, 1);
  assert.equal(g.nodes.find((n) => n.id === a.id).date, null);
});
test("meeting prep records checkpoints, resumes idempotently and gates generated capabilities", async (t) => {
  const { s, file } = fixture(t);
  const source = await ingest(
    s,
    file("meeting.md", "Atlas project: review the pilot milestones."),
  );
  const input = {
    title: "Atlas pilot",
    start: "2026-10-12T10:00:00+02:00",
    query: "Atlas",
  };
  const a = await run(s, "meeting-prep", input, "codex");
  assert.equal(a.state, "completed");
  assert.match(a.output.markdown, /\.\.\/originals\//);
  const b = await run(s, "meeting-prep", input, "codex", { resume: a.id });
  assert.equal(b.id, a.id);
  assert.equal(s.one("SELECT COUNT(*) n FROM executions").n, 1);
  await assert.rejects(
    run(s, "meeting-prep", { ...input, title: "Other" }, "codex", {
      resume: a.id,
    }),
    /changed/,
  );
  const c = { ...s.capability("meeting-prep"), id: "client-prep" };
  saveCapability(s, c);
  await assert.rejects(run(s, "client-prep", input, "codex"), /draft/);
  assert.throws(() => activate(s, "client-prep"), /passing/);
  const result = await evaluate(
    s,
    "client-prep",
    [{ input, expectedSourceIds: [source.sourceId] }],
    "codex",
  );
  assert.equal(result.passed, true);
  activate(s, "client-prep");
  assert.equal(
    (await run(s, "client-prep", input, "codex")).state,
    "completed",
  );
});
test("latest ranks authoritative document status and effective date, not import order", async (t) => {
  const { s, file } = fixture(t);
  const signed = await ingest(s, file("signed.md", "Atlas proposal approved"), {
    metadata: { status: "signed", effectiveDate: "2026-08-01" },
  });
  await ingest(s, file("draft.md", "Atlas proposal draft"), {
    metadata: { status: "draft", effectiveDate: "2026-09-17" },
  });
  assert.equal(
    retrieve(s, "Atlas", "codex", { latest: true }).results[0].sourceId,
    signed.sourceId,
  );
});
test("backup restores into another location, rejects corruption, and retains prior workspace", async (t) => {
  const { root, s, file } = fixture(t);
  await ingest(s, file("source.md", "Restore the Atlas record"));
  const dest = join(root, "backup");
  backup(s, dest);
  const target = join(root, "restored");
  restore(dest, target);
  const second = new Store(target);
  assert.equal(retrieve(second, "Atlas", "codex").results.length, 1);
  second.close();
  assert.ok(restore(dest, target).previous);
  writeFileSync(join(dest, "context/profile.md"), "tampered");
  assert.throws(() => restore(dest, target), /Checksum/);
});
test("onboarding updates only supplied answers and retains previous content", (t) => {
  const { s } = fixture(t);
  onboard(s, { name: "Taylor", goals: "Launch a pilot" });
  onboard(s, { goals: "Review the pilot" });
  const c = context(s, "codex");
  assert.match(c.notes[0].content, /Taylor/);
  assert.match(c.notes[0].content, /Review the pilot/);
});
