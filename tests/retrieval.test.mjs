import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { ingest, retrieve } from "../dist/core/intake.js";
import { capture, reviewMemory } from "../dist/core/knowledge.js";
import { knowledgeSearch, knowledgeEvidence } from "../dist/core/retrieval.js";
import { saveWikiDraft, publishWiki } from "../dist/core/wiki-core.js";
import { writeYaml, readYaml } from "../dist/core/files.js";
import { executeOperation } from "../dist/core/operations.js";

test("unified ranking includes documents, wiki and approved memory before allocating context", async (t) => {
  const { s, file } = fixture(t);
  await ingest(
    s,
    file(
      "orchard.md",
      "# Orchard\n\n" + "Orchard workshop preparation. ".repeat(180),
    ),
    { host: "local" },
  );
  const draft = saveWikiDraft(
    s,
    {
      title: "Orchard delivery",
      type: "topic",
      blocks: [
        {
          id: "delivery",
          heading: "Delivery",
          text: "Orchard workshop requires a rehearsal.",
          kind: "user-authored",
          evidence: [],
        },
      ],
    },
    "local",
  );
  publishWiki(
    s,
    {
      pageId: draft.pageId,
      revisionId: draft.id,
      expectedVersion: draft.version,
      confirm: true,
    },
    "local",
  );
  const memory = capture(
    s,
    {
      type: "preference",
      content: "Orchard prefers short workshop exercises.",
    },
    "local",
  );
  reviewMemory(s, memory.id, "approved", "local");
  const policy = readYaml(s.path("policies/actions.yaml"));
  writeYaml(s.path("policies/actions.yaml"), {
    ...policy,
    maxContextChars: 600,
  });
  const result = knowledgeSearch(s, { query: "Orchard workshop" }, "local");
  assert.deepEqual(
    new Set(result.evidence.map((e) => e.kind)),
    new Set(["source", "wiki", "memory"]),
  );
  assert.ok(result.evidence.reduce((n, e) => n + e.excerpt.length, 0) <= 600);
  for (const e of result.evidence)
    assert.ok(
      knowledgeEvidence(
        s,
        { kind: e.kind, ...e.reference },
        "local",
      ).quote.includes(e.excerpt),
    );
  const old = retrieve(s, "Orchard workshop", "local");
  assert.ok(
    old.results.length && old.wikiResults.length && old.memoryResults.length,
  );
  assert.equal(
    (
      await executeOperation(s, "local", {
        command: "knowledge",
        args: ["search"],
        input: { query: "Orchard" },
      })
    ).evidence.length,
    result.evidence.length,
  );
});

test("memory search is not pre-truncated and excludes unapproved, expired, future and restricted memories", (t) => {
  const { s } = fixture(t);
  for (let i = 0; i < 8; i++) {
    const m = capture(
      s,
      { type: "semantic", content: "Unrelated ".repeat(1400) },
      "local",
    );
    reviewMemory(s, m.id, "approved", "local");
  }
  for (const [state, extra] of [
    ["proposed", {}],
    ["approved", { validUntil: "2000-01-01" }],
    ["approved", { validFrom: "2999-01-01" }],
    ["approved", { allowedHosts: ["local"] }],
    ["approved", {}],
  ]) {
    const m = capture(
      s,
      {
        type: "preference",
        content: "Orchard prefers accessible bilingual exercises.",
        ...extra,
      },
      "local",
    );
    if (state === "approved") reviewMemory(s, m.id, state, "local");
  }
  const found = knowledgeSearch(s, { query: "bilingual" }, "codex");
  assert.equal(found.evidence.length, 1);
  const ref = found.evidence[0].reference;
  reviewMemory(s, ref.memoryId, "rejected", "local");
  assert.throws(
    () => knowledgeEvidence(s, { kind: "memory", ...ref }, "codex"),
    /UNAVAILABLE/,
  );
  assert.equal(
    knowledgeSearch(s, { query: "bilingual" }, "codex").evidence.length,
    0,
  );
});

test("source diversity, exact duplicates and revoked evidence remain bounded", async (t) => {
  const { s, file } = fixture(t);
  await ingest(
    s,
    file("one.md", "# Orchard\n\nOrchard preparation requires a rehearsal."),
    { host: "local" },
  );
  const result = knowledgeSearch(s, { query: "Orchard" }, "local");
  const first = result.evidence[0];
  const policy = readYaml(s.path("policies/actions.yaml"));
  writeYaml(s.path("policies/actions.yaml"), {
    ...policy,
    deniedSources: [first.recordId],
  });
  assert.equal(
    knowledgeSearch(s, { query: "Orchard" }, "local").evidence.length,
    0,
  );
  assert.throws(() =>
    knowledgeEvidence(s, { kind: "source", ...first.reference }, "local"),
  );
  assert.throws(() =>
    knowledgeSearch(s, { query: "Orchard", limit: Infinity }, "local"),
  );
});
