import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import {
  configureSemantic,
  indexStatus,
  installLocalModel,
  rebuildKnowledge,
  prepareSemanticQuery,
} from "../dist/core/semantic.js";
import { knowledgeSearch } from "../dist/core/retrieval.js";
import { ingest } from "../dist/core/intake.js";
import { writeYaml } from "../dist/core/files.js";

test("semantic search is opt-in and incomplete or invalid packages fail closed", async (t) => {
  const { s, root } = fixture(t);
  assert.equal(indexStatus(s, "local").semantic, "disabled");
  await assert.rejects(
    installLocalModel(s, "local", { confirm: true, directory: root }),
    /OPT_IN/,
  );
  assert.throws(
    () => configureSemantic(s, "codex", { enabled: true, confirm: true }),
    /LOCAL_CONFIGURATION/,
  );
  configureSemantic(s, "local", { enabled: true, confirm: true });
  await assert.rejects(
    installLocalModel(s, "local", { confirm: true, directory: root }),
  );
  await prepareSemanticQuery(s, "local", "question");
  assert.equal(
    knowledgeSearch(s, { query: "question" }, "local").coverage.mode,
    "lexical",
  );
  assert.equal(indexStatus(s, "local").semantic, "not-indexed");
  configureSemantic(s, "local", { enabled: false, confirm: true });
});

test(
  "verified offline model indexes French evidence and rechecks revoked permissions",
  { skip: !process.env.HOI_TEST_MODEL_DIRECTORY },
  async (t) => {
    const { s, file } = fixture(t);
    const imported = await ingest(
      s,
      file(
        "fictional.md",
        "La formation des dirigeants comprend un atelier pratique sur les agents IA et une séance de préparation.",
      ),
      { host: "local" },
    );
    configureSemantic(s, "local", { enabled: true, confirm: true });
    t.after(() => {
      try {
        configureSemantic(s, "local", { enabled: false, confirm: true });
      } catch {}
    });
    await installLocalModel(s, "local", {
      confirm: true,
      directory: process.env.HOI_TEST_MODEL_DIRECTORY,
    });
    const first = await rebuildKnowledge(s, "local", {
      requestKey: "offline-model-test",
    });
    assert.deepEqual(
      await rebuildKnowledge(s, "local", { requestKey: "offline-model-test" }),
      first,
    );
    assert.equal(indexStatus(s, "local").semantic, "ready");
    const query = "What does the leadership training include?";
    await prepareSemanticQuery(s, "local", query);
    assert.equal(
      knowledgeSearch(s, { query }, "local").coverage.mode,
      "hybrid",
    );
    writeYaml(s.path("policies/actions.yaml"), {
      ...s.policy(),
      deniedSources: [imported.sourceId],
    });
    assert.equal(knowledgeSearch(s, { query }, "local").evidence.length, 0);
  },
);

test(
  "automatic index maintenance rebuilds changed evidence, resumes interruptions and preserves cancellation",
  { skip: !process.env.HOI_TEST_MODEL_DIRECTORY },
  async (t) => {
    const { maintainKnowledgeIndex } =
      await import("../dist/core/index-maintenance.js");
    const { s, file } = fixture(t);
    configureSemantic(s, "local", { enabled: true, confirm: true });
    t.after(() => {
      try {
        configureSemantic(s, "local", { enabled: false, confirm: true });
      } catch {}
    });
    await installLocalModel(s, "local", {
      confirm: true,
      directory: process.env.HOI_TEST_MODEL_DIRECTORY,
    });
    await ingest(s, file("automatic.md", "Orchard uses morning workshops."), {
      host: "local",
    });
    assert.equal((await maintainKnowledgeIndex(s, "local")).state, "current");
    const first = indexStatus(s, "local").generation;
    await maintainKnowledgeIndex(s, "local");
    assert.equal(indexStatus(s, "local").generation, first);
    await ingest(s, file("automatic.md", "Orchard uses afternoon workshops."), {
      host: "local",
    });
    assert.equal(indexStatus(s, "local").semantic, "partial");
    await maintainKnowledgeIndex(s, "local");
    const second = indexStatus(s, "local").generation;
    assert.notEqual(first, second);
    assert.equal(indexStatus(s, "local").semantic, "ready");
    // Simulate interrupted activation: old generation remains active, building generation and checkpoint survive.
    s.exec(
      "UPDATE knowledge_index_generations SET state='building' WHERE id=?",
      second,
    );
    s.exec(
      "UPDATE knowledge_index_generations SET state='active' WHERE id=?",
      first,
    );
    const job = s
      .all("SELECT * FROM intake_jobs WHERE id LIKE 'index_%'")
      .find((j) => JSON.parse(j.payload).generation === second);
    s.exec(
      "UPDATE intake_jobs SET state='processing',result=NULL WHERE id=?",
      job.id,
    );
    s.exec("DELETE FROM knowledge_retrieval_config WHERE id='maintenance'");
    await maintainKnowledgeIndex(s, "local");
    assert.equal(indexStatus(s, "local").generation, second);
    // An explicitly cancelled rebuild is not automatically restarted.
    s.exec(
      "UPDATE knowledge_index_generations SET state='building' WHERE id=?",
      second,
    );
    s.exec(
      "UPDATE knowledge_index_generations SET state='active' WHERE id=?",
      first,
    );
    s.exec("UPDATE intake_jobs SET state='cancelled' WHERE id=?", job.id);
    assert.equal((await maintainKnowledgeIndex(s, "local")).state, "paused");
    assert.equal(indexStatus(s, "local").generation, first);
  },
);
