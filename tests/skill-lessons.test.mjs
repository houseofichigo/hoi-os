import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";
import { ingest, retrieve } from "../dist/core/intake.js";
import {
  context,
  capture,
  reviewMemory,
  consolidate,
} from "../dist/core/knowledge.js";
import {
  memoryGet,
  memoryList,
  memoryHistory,
  proposeMemory,
  reviewVersionedMemory,
  beginMemoryDraft,
  saveMemoryDraft,
} from "../dist/core/reviewed-memory.js";
import { skillDetail, draftSkill } from "../dist/core/skill-library.js";
import { knowledgeSearch } from "../dist/core/retrieval.js";
import { collectUnits } from "../dist/core/semantic.js";
import { appRead } from "../dist/core/app-operations.js";
import { sourceDetail, sourceImpact } from "../dist/core/hub.js";
import { graph } from "../dist/core/graph.js";
import { backup, restore } from "../dist/core/backup.js";
import { Store } from "../dist/core/store.js";
import { executeOperation } from "../dist/core/operations.js";

const identity = (m) => ({
  id: m.id,
  expectedVersion: m.version,
  expectedChecksum: m.checksum,
});
async function setup(t, workspaceSkill = false) {
  const f = fixture(t),
    { s, file } = f;
  const imported = await ingest(
    s,
    file(
      "rehearsal.md",
      "# Fictional rehearsal\n\nCedar observation: inspect exact evidence before proposing a commitment. No real assistant was evaluated.",
    ),
  );
  const p = retrieve(s, "Cedar observation", "local").results[0];
  const skill = workspaceSkill
    ? draftSkill(
        s,
        {
          name: "fictional-helper",
          expectedVersion: 0,
          markdown:
            "---\nname: fictional-helper\ndescription: Fictional instructions\n---\nInspect evidence.\n",
        },
        "local",
      )
    : skillDetail(s, "hoi-chief-of-staff", "local");
  const revision = skill.active ?? skill.revisions[0];
  const memory = {
    type: "procedural",
    content: "Inspect exact Cedar evidence before proposing commitments.",
    evidence: [
      { revisionId: p.revisionId, passageId: p.passageId, quote: p.quote },
    ],
    lesson: {
      skillId: skill.id,
      revisionId: revision.revisionId,
      checksum: revision.checksum,
      scope: "Fictional Cedar briefing only",
      limitations: "No live host, owner review or held-out quality measurement",
      evaluationKind: "engine-rehearsal",
    },
  };
  return { ...f, skill, imported, memory };
}
const proposal = (s, memory, requestKey = "new-lesson-proposal") =>
  proposeMemory(s, { requestKey, memory }, "codex");
const review = (s, id, state = "approved") => {
  const m = memoryGet(s, id, "local");
  return reviewVersionedMemory(
    s,
    {
      ...identity(m),
      state,
      confirm: true,
      requestKey: `${state}-${id}-${m.version}`,
    },
    "local",
  );
};

test("procedural lessons pin real revisions and evidence, never activate a skill, and exclude business retrieval", async (t) => {
  const { s, skill, memory } = await setup(t, true);
  const before = skillDetail(s, skill.id, "local");
  const p = proposal(s, memory);
  assert.deepEqual(proposal(s, memory), p);
  assert.throws(
    () => proposal(s, { ...memory, content: "Changed" }),
    /IDEMPOTENCY/,
  );
  const draft = memoryGet(s, p.id, "local");
  assert.throws(
    () =>
      reviewVersionedMemory(
        s,
        {
          ...identity(draft),
          state: "approved",
          confirm: true,
          requestKey: "model-approve",
        },
        "codex",
      ),
    /REVIEW_REQUIRED/,
  );
  review(s, p.id);
  assert.deepEqual(skillDetail(s, skill.id, "local"), before);
  assert.equal(memoryList(s, "local").filter((m) => m.lesson).length, 1);
  assert.equal(context(s, "local").memories.length, 0);
  assert.equal(
    collectUnits(s, "local").filter((m) => m.kind === "memory").length,
    0,
  );
  assert.equal(
    graph(s, "local").nodes.some((n) => n.id === p.id),
    false,
  );
  for (const input of [
    { query: "Cedar" },
    { query: "Cedar", asOf: new Date().toISOString().slice(0, 10) },
  ])
    assert.equal(
      knowledgeSearch(s, input, "local").evidence.some(
        (e) => e.kind === "memory",
      ),
      false,
    );
});

test("lesson validation refuses spoofed revisions, evidence-free attribution and purpose laundering", async (t) => {
  const { s, memory } = await setup(t);
  for (const [change, expected] of [
    [{ type: "semantic" }, /LESSON_TYPE/],
    [{ evidence: [] }, /LESSON_EVIDENCE/],
    [
      { lesson: { ...memory.lesson, checksum: "0".repeat(64) } },
      /REVISION_UNAVAILABLE/,
    ],
    [{ lesson: { ...memory.lesson, scope: " " } }, /String/],
    [{ lesson: { ...memory.lesson, passed: true } }, /Unrecognized/],
  ])
    assert.throws(
      () =>
        proposeMemory(
          s,
          {
            requestKey: "invalid-lesson",
            attributedStatement: true,
            memory: { ...memory, ...change },
          },
          "local",
        ),
      expected,
    );
  const p = proposal(s, memory),
    m = memoryGet(s, p.id, "local");
  assert.throws(
    () =>
      saveMemoryDraft(
        s,
        {
          ...identity(m),
          requestKey: "type-launder",
          changes: { type: "semantic" },
        },
        "local",
      ),
    /PURPOSE/,
  );
  assert.throws(
    () =>
      saveMemoryDraft(
        s,
        {
          ...identity(m),
          requestKey: "erase-evidence",
          changes: { evidence: [] },
          attributedStatement: true,
        },
        "local",
      ),
    /LESSON_EVIDENCE/,
  );
  assert.throws(
    () =>
      proposal(
        s,
        { type: "semantic", content: "Client fact", supersedes: p.id },
        "wrong-purpose",
      ),
    /PURPOSE/,
  );
  assert.throws(() => capture(s, memory, "local"), /VERSIONED_MEMORY_PROPOSE/);
  assert.throws(
    () =>
      capture(
        s,
        { type: "semantic", content: "Client fact", supersedes: p.id },
        "local",
      ),
    /VERSIONED_MEMORY_PROPOSE/,
  );
  assert.throws(
    () => reviewMemory(s, p.id, "approved", "local"),
    /VERSIONED_MEMORY_REVIEW/,
  );
});

test("lesson edits, replacement, retirement, restore and backup preserve exact history", async (t) => {
  const { s, root, memory, skill } = await setup(t);
  const p = proposal(s, memory);
  review(s, p.id);
  const d = beginMemoryDraft(
    s,
    {
      ...identity(memoryGet(s, p.id, "local")),
      requestKey: "lesson-correction",
    },
    "local",
  );
  const old = memoryGet(s, d.id, "local");
  const input = {
    ...identity(old),
    requestKey: "lesson-edit",
    changes: {
      content:
        "Inspect the exact revision and quote before proposing commitments.",
      lesson: {
        ...old.lesson,
        limitations:
          "Fictional fixture only; independent review remains pending.",
      },
    },
  };
  const saved = saveMemoryDraft(s, input, "local");
  assert.deepEqual(saveMemoryDraft(s, input, "local"), saved);
  assert.throws(
    () =>
      saveMemoryDraft(
        s,
        { ...input, requestKey: "stale-lesson-edit" },
        "local",
      ),
    /STALE/,
  );
  review(s, d.id);
  assert.equal(memoryGet(s, p.id, "local").state, "superseded");
  review(s, d.id, "retired");
  const restored = beginMemoryDraft(
    s,
    {
      ...identity(memoryGet(s, d.id, "local")),
      restoreVersion: 1,
      requestKey: "restore-lesson",
    },
    "local",
  );
  assert.equal(memoryGet(s, restored.id, "local").state, "proposed");
  assert.deepEqual(memoryGet(s, restored.id, "local").lesson, memory.lesson);
  const dir = join(root, "backup"),
    copy = join(root, "restored");
  backup(s, dir);
  restore(dir, copy);
  const other = new Store(copy);
  assert.deepEqual(
    memoryHistory(other, d.id, "local"),
    memoryHistory(s, d.id, "local"),
  );
  assert.equal(
    memoryGet(other, restored.id, "local").lesson.checksum,
    memory.lesson.checksum,
  );
  assert.equal(
    skillDetail(other, skill.id, "local").active.checksum,
    memory.lesson.checksum,
  );
  other.close();
});

test("source and skill revocation remove lessons from reads, history, counts and source impact", async (t) => {
  const { s, skill, imported, memory } = await setup(t, true);
  const p = proposal(s, memory);
  review(s, p.id);
  assert.equal(sourceImpact(s, imported.sourceId, "local").memories.length, 1);
  s.exec(
    "INSERT INTO source_lifecycle VALUES(?, 'archived', 1, ?)",
    imported.sourceId,
    new Date().toISOString(),
  );
  assert.equal(memoryList(s, "local").length, 0);
  assert.throws(() => memoryHistory(s, p.id, "local"), /UNAVAILABLE/);
  assert.throws(() => review(s, p.id));
  s.exec(
    "UPDATE source_lifecycle SET state='active',version=2 WHERE source_id=?",
    imported.sourceId,
  );
  assert.equal(memoryHistory(s, p.id, "local").revisions.length, 2);
  s.exec(
    "UPDATE workspace_skills SET allowed_hosts=? WHERE id=?",
    JSON.stringify(["local"]),
    skill.id,
  );
  assert.equal(memoryList(s, "codex", "history").length, 0);
  assert.deepEqual(sourceImpact(s, imported.sourceId, "codex").memories, []);
  assert.throws(() => memoryHistory(s, p.id, "codex"), /UNAVAILABLE/);
  assert.throws(() => proposal(s, memory), /UNAVAILABLE/);
  assert.equal(
    appRead(s, "codex", "/api/workspace", "", true).counts.memories,
    0,
  );
  assert.equal(
    sourceDetail(s, imported.sourceId, "codex").source.id,
    imported.sourceId,
  );
  assert.equal(consolidate(s, "codex").proposed.length, 0);
  const md = JSON.parse(
    s.one("SELECT metadata FROM sources WHERE id=?", imported.sourceId)
      .metadata,
  );
  s.exec(
    "UPDATE sources SET metadata=? WHERE id=?",
    JSON.stringify({ ...md, allowedHosts: ["claude"] }),
    imported.sourceId,
  );
  assert.throws(() => memoryGet(s, p.id, "local"), /UNAVAILABLE/);
  assert.equal(memoryList(s, "local", "history").length, 0);
});

test("registered memory operations and authenticated app paths share lesson validation", async (t) => {
  const { s, memory } = await setup(t);
  const p = await executeOperation(s, "local", {
    command: "memory",
    args: ["propose"],
    input: { requestKey: "registry-lesson", memory },
  });
  const rows = await executeOperation(s, "local", {
    command: "memory",
    args: ["list"],
    options: { state: "proposed" },
  });
  assert.equal(rows[0].id, p.id);
  await assert.rejects(
    executeOperation(s, "local", {
      command: "app-action",
      args: ["/api/memory/propose"],
      input: {
        requestKey: "app-invalid-lesson",
        memory: { ...memory, evidence: [] },
      },
    }),
    /LESSON_EVIDENCE/,
  );
});
