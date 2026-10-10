import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { saveRecord } from "../dist/core/workspace.js";
import { ingest } from "../dist/core/intake.js";
import { readYaml, writeYaml } from "../dist/core/files.js";
import { knowledgeSearch } from "../dist/core/retrieval.js";

test("explicit project scope retains both conflicting bilingual passages through the project/entity link", async (t) => {
  const { s, file } = fixture(t);
  const p = saveRecord(
    s,
    {
      kind: "project",
      expectedVersion: 0,
      record: {
        name: "Fictional Saffron",
        objective: "Compare delivery notes",
      },
    },
    "local",
  );
  const entityId = s.one(
    "SELECT entity_id FROM projects WHERE id=?",
    p.id,
  ).entity_id;
  for (const [name, content] of [
    [
      "a",
      "Saffron delivery date is 2026-12-03. La date de livraison Saffron est le 3 décembre.",
    ],
    [
      "b",
      "Saffron delivery date is 2026-12-04. La date de livraison Saffron est le 4 décembre.",
    ],
  ])
    await ingest(s, file(name + ".md", content), {
      host: "local",
      metadata: { project: entityId },
    });
  for (let i = 0; i < 8; i++)
    await ingest(
      s,
      file(
        "other" + i + ".md",
        "Unrelated date calendrier delivery planning " + i,
      ),
      { host: "local" },
    );
  for (const query of [
    "What is the Saffron delivery date?",
    "Peut-on affirmer une date unique pour Saffron ?",
  ]) {
    const byRecord = knowledgeSearch(
      s,
      { query, project: p.id, limit: 5 },
      "local",
    ).evidence.filter((e) => e.kind === "source");
    const byEntity = knowledgeSearch(
      s,
      { query, project: entityId, limit: 5 },
      "local",
    ).evidence.filter((e) => e.kind === "source");
    assert.equal(byRecord.length, 2);
    assert.deepEqual(
      byRecord.map((e) => e.id),
      byEntity.map((e) => e.id),
    );
    assert.ok(byRecord.every((e) => e.excerpt.includes("Saffron")));
  }
  assert.equal(
    knowledgeSearch(s, { query: "date", project: "project_missing" }, "local")
      .evidence.length,
    0,
  );
});

test("equivalent project IDs cannot bypass a source permission revocation", async (t) => {
  const { s, file } = fixture(t);
  const p = saveRecord(
    s,
    {
      kind: "project",
      expectedVersion: 0,
      record: { name: "Fictional Marigold" },
    },
    "local",
  );
  const entityId = s.one(
    "SELECT entity_id FROM projects WHERE id=?",
    p.id,
  ).entity_id;
  await ingest(s, file("private.md", "Marigold date livraison 2026-12-03"), {
    host: "local",
    metadata: { project: entityId },
  });
  const before = knowledgeSearch(
    s,
    { query: "Marigold", project: p.id },
    "codex",
  ).evidence;
  assert.equal(before.length, 1);
  const policy = s.path("policies/actions.yaml");
  writeYaml(policy, {
    ...readYaml(policy),
    deniedSources: [before[0].recordId],
  });
  for (const project of [p.id, entityId])
    assert.equal(
      knowledgeSearch(s, { query: "Marigold", project }, "codex").evidence
        .length,
      0,
    );
});
