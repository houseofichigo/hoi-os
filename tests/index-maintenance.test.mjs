import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fixture } from "./helpers.mjs";
import {
  maintainKnowledgeIndex,
  startIndexMaintenance,
} from "../dist/core/index-maintenance.js";
import {
  configureSemantic,
  indexStatus,
  MODEL_FINGERPRINT,
} from "../dist/core/semantic.js";
import { LOCAL_MODEL } from "../dist/core/local-model.js";
import { ingest } from "../dist/core/intake.js";
import { writeYaml } from "../dist/core/files.js";
test("automatic maintenance respects opt-in, missing model and permission-filtered coverage", async (t) => {
  const { s, file } = fixture(t);
  const a = await ingest(s, file("a.md", "Fictional maintenance evidence"), {
    host: "local",
  });
  assert.equal(await maintainKnowledgeIndex(s, "local"), undefined);
  configureSemantic(s, "local", { enabled: true, confirm: true });
  assert.equal(
    (await maintainKnowledgeIndex(s, "local")).reason,
    "MODEL_INSTALL_REQUIRED",
  );
  assert.equal(indexStatus(s, "local").domains.source.pending, 1);
  assert.equal(
    s.one("SELECT count(*) n FROM intake_jobs WHERE id LIKE 'index_%'").n,
    0,
  );
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [a.sourceId],
  });
  assert.equal(indexStatus(s, "local").domains.source.eligible, 0);
  assert.equal(await maintainKnowledgeIndex(s, "codex"), undefined);
});
test("corrupt local models use bounded durable retries and safe errors", async (t) => {
  const { s } = fixture(t);
  configureSemantic(s, "local", { enabled: true, confirm: true });
  for (const f of LOCAL_MODEL.files) {
    const p = s.path(join(".hoi/models", MODEL_FINGERPRINT, f.path));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, "corrupt");
  }
  t.mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-10-09T12:00:00Z"),
  });
  let state = await maintainKnowledgeIndex(s, "local");
  assert.equal(state.attempts, 1);
  assert.equal(state.state, "retrying");
  assert.equal((await maintainKnowledgeIndex(s, "local")).attempts, 1);
  t.mock.timers.tick(600001);
  state = await maintainKnowledgeIndex(s, "local");
  assert.equal(state.attempts, 2);
  t.mock.timers.tick(600001);
  state = await maintainKnowledgeIndex(s, "local");
  assert.equal(state.state, "paused");
  assert.equal(state.attempts, 3);
  t.mock.timers.tick(600001);
  assert.equal((await maintainKnowledgeIndex(s, "local")).attempts, 3);
  assert.equal(state.reason, "LOCAL_INDEX_UNAVAILABLE");
});
test("closing the server prevents queued maintenance from starting", async (t) => {
  const { s } = fixture(t);
  const queued = [];
  const stop = startIndexMaintenance(s, "local", (fn) => {
    queued.push(fn);
    return Promise.resolve();
  });
  assert.equal(queued.length, 1);
  stop();
  await queued[0]();
  assert.equal(
    s.one(
      "SELECT payload FROM knowledge_retrieval_config WHERE id='maintenance'",
    ),
    undefined,
  );
});
