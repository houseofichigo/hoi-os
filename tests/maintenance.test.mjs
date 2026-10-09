import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";
import { ingest, retrieve } from "../dist/core/intake.js";
import { capture, reviewMemory, context } from "../dist/core/knowledge.js";
import { proposeWiki, reviewWiki, listWiki } from "../dist/core/wiki.js";
import {
  scanKnowledge,
  listKnowledgeReviews,
  reviewKnowledge,
  proposeKnowledge,
  replacementChoices,
} from "../dist/core/maintenance.js";
import { graph } from "../dist/core/graph.js";
import { backup, restore } from "../dist/core/backup.js";
import { Store, migrate, CURRENT_SCHEMA_VERSION } from "../dist/core/store.js";
import { writeYaml } from "../dist/core/files.js";
async function seed(t) {
  const f = fixture(t),
    path = f.file("offering.md", "Cedar offering is current.");
  const source = await ingest(f.s, path);
  const e = retrieve(f.s, "Cedar", "local").results[0];
  const evidence = [
    { revisionId: e.revisionId, passageId: e.passageId, quote: e.quote },
  ];
  return { ...f, path, source, evidence };
}
function decide(s, r, action, extra = {}) {
  return reviewKnowledge(
    s,
    {
      id: r.id,
      expectedVersion: r.version,
      action,
      targetId: r.targets[0].id,
      ...extra,
    },
    "local",
  );
}
test("expired memory archive keeps original and history; rejected unchanged finding stays reviewed", async (t) => {
  const { s, evidence } = await seed(t);
  const m = capture(
    s,
    {
      type: "decision",
      content: "Old decision",
      validUntil: "2020-01-01",
      evidence,
    },
    "local",
  );
  reviewMemory(s, m.id, "approved", "local");
  const r = scanKnowledge(s, "local")[0];
  decide(s, r, "archive");
  assert.equal(s.memories().length, 0);
  assert.equal(s.memories(true).length, 1);
  assert.equal(
    graph(s, "local").nodes.some((n) => n.id === m.id),
    false,
  );
  assert.equal(
    scanKnowledge(s, "local").filter((r) => r.state === "pending" && r.current)
      .length,
    0,
  );
  assert.equal(decide(s, r, "archive").reused, true);
  const n = capture(
    s,
    {
      type: "semantic",
      content: "Another old fact",
      validUntil: "2020-01-01",
      evidence,
    },
    "local",
  );
  const next = scanKnowledge(s, "local").find((r) => r.targets[0].id === n.id);
  decide(s, next, "reject");
  assert.equal(
    scanKnowledge(s, "local").find((r) => r.id === next.id).state,
    "reviewed",
  );
});
test("source change flags wiki, stale reviews fail, and restricted titles never enter map or queues", async (t) => {
  const { s, evidence, path, file, source } = await seed(t);
  const w = proposeWiki(
    s,
    {
      slug: "offering",
      title: "Private offering",
      type: "offering",
      content: "Current offering.",
      evidence,
    },
    "local",
  );
  reviewWiki(s, w.id, "reviewed", "local");
  file("offering.md", "Cedar offering has changed.");
  await ingest(s, path);
  const r = scanKnowledge(s, "local").find((r) => r.type === "stale-evidence");
  assert.ok(r);
  file("offering.md", "Cedar offering has changed again.");
  await ingest(s, path);
  assert.throws(() => decide(s, r, "keep"), /STALE_VERSION/);
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [source.sourceId],
  });
  assert.equal(listWiki(s, "local").length, 0);
  assert.equal(listKnowledgeReviews(s, "local").length, 0);
  assert.ok(!JSON.stringify(graph(s, "local")).includes("Private offering"));
});
test("duplicate merge requires reviewed cited replacement and retires only selected original", async (t) => {
  const { s, evidence } = await seed(t);
  const a = capture(
      s,
      { type: "semantic", content: "Same fact", evidence },
      "local",
    ),
    b = capture(
      s,
      { type: "semantic", content: "Same fact", evidence },
      "local",
    );
  reviewMemory(s, b.id, "approved", "local");
  const raw = scanKnowledge(s, "local").find((r) => r.type === "duplicate");
  const r = { ...raw, targets: [raw.targets.find((t) => t.id === a.id)] };
  const c = replacementChoices(s, "local").find((c) => c.id === b.id);
  assert.throws(
    () =>
      decide(s, r, "merge", {
        replacementId: b.id,
        replacementDigest: "stale",
      }),
    /STALE_VERSION/,
  );
  decide(s, r, "merge", { replacementId: b.id, replacementDigest: c.digest });
  assert.equal(s.memories().length, 1);
  assert.equal(context(s, "local").memories[0].id, b.id);
  assert.equal(s.memories(true).length, 2);
  assert.throws(
    () =>
      proposeKnowledge(
        s,
        { kind: "memory", input: { type: "semantic", content: "Uncited" } },
        "local",
      ),
    /evidence/,
  );
});
test("contradictions and superseded source flags are mechanical; draft denial blocks maintenance", async (t) => {
  const { s, evidence, source } = await seed(t);
  proposeWiki(
    s,
    {
      slug: "conflict",
      title: "Conflict",
      type: "project",
      content: "Claim",
      evidence: [{ ...evidence[0], relation: "contradicts" }],
    },
    "local",
  );
  const row = s.one("SELECT metadata FROM sources WHERE id=?", source.sourceId);
  s.exec(
    "UPDATE sources SET metadata=? WHERE id=?",
    JSON.stringify({ ...JSON.parse(row.metadata), status: "superseded" }),
    source.sourceId,
  );
  const rows = scanKnowledge(s, "local");
  assert.ok(rows.some((r) => r.type === "contradiction"));
  assert.ok(rows.some((r) => r.type === "superseded-source"));
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    actions: { ...s.policy().actions, draft: "deny" },
  });
  assert.throws(() => scanKnowledge(s, "local"), /denied/);
});
test("schema 4 restores and upgrades; disposition survives backup restoration", async (t) => {
  const { s, root, evidence } = await seed(t);
  const m = capture(
    s,
    { type: "semantic", content: "Old", validUntil: "2020-01-01", evidence },
    "local",
  );
  const r = scanKnowledge(s, "local")[0];
  decide(s, r, "archive");
  await backup(s, join(root, "backup5"));
  await restore(join(root, "backup5"), join(root, "copy5"));
  const copy = new Store(join(root, "copy5"));
  assert.equal(copy.memories().length, 0);
  copy.close();
  s.db.exec(
    "DROP TABLE knowledge_dispositions; DROP TABLE knowledge_reviews; PRAGMA user_version=4",
  );
  await backup(s, join(root, "backup4"));
  await restore(join(root, "backup4"), join(root, "copy4"));
  const old = new Store(join(root, "copy4"));
  assert.equal(old.schemaVersion, 4);
  migrate(old);
  old.close();
  const upgraded = new Store(join(root, "copy4"));
  assert.equal(upgraded.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(upgraded.memories()[0].id, m.id);
  upgraded.close();
});
test("task map edges resolve persisted records and disappear when their source is denied", async (t) => {
  const { s, evidence, source } = await seed(t);
  const { entity } = await import("../dist/core/knowledge.js");
  const { createProject, createProposal, reviewProposal } =
    await import("../dist/core/tasks.js");
  const p = createProject(
    s,
    {
      entityId: entity(s, { name: "Cedar", type: "project" }).id,
      objective: "Review",
    },
    "local",
  );
  const proposal = createProposal(
    s,
    {
      key: "map-task",
      task: { projectId: p.id, title: "Review Cedar", outcome: "Reviewed" },
      evidence,
    },
    "local",
  );
  const task = reviewProposal(
    s,
    { id: proposal.id, expectedVersion: 1, decision: "approved" },
    "local",
  );
  const g = graph(s, "local");
  assert.ok(g.nodes.some((n) => n.id === task.taskId));
  assert.ok(
    g.links.some((l) => l.source === task.taskId && l.target === p.entity_id),
  );
  assert.ok(
    g.links.some(
      (l) => l.source === source.sourceId && l.target === task.taskId,
    ),
  );
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [source.sourceId],
  });
  assert.ok(!graph(s, "local").nodes.some((n) => n.id === task.taskId));
});
