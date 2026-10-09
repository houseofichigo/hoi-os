import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { ingest } from "../dist/core/intake.js";
import { knowledgeSearch, knowledgeEvidence } from "../dist/core/retrieval.js";
import {
  proposeMemory,
  memoryGet,
  reviewVersionedMemory,
} from "../dist/core/reviewed-memory.js";
import {
  saveWikiDraft,
  publishWiki,
  wikiDetail,
} from "../dist/core/wiki-core.js";
import { writeYaml } from "../dist/core/files.js";
import { relationship } from "../dist/core/knowledge.js";
const review = (s, id) => {
  const m = memoryGet(s, id, "local");
  return reviewVersionedMemory(
    s,
    {
      id,
      expectedVersion: m.version,
      expectedChecksum: m.checksum,
      requestKey: "review-" + id,
      confirm: true,
      state: "approved",
    },
    "local",
  );
};
const publish = (s, d) =>
  publishWiki(
    s,
    {
      pageId: d.pageId,
      revisionId: d.id,
      expectedVersion: d.version,
      confirm: true,
    },
    "local",
  );
test("historical retrieval uses recorded source, wiki and memory versions with present permissions", async (t) => {
  const { s, file } = fixture(t);
  t.mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-01-01T12:00:00Z"),
  });
  const a = await ingest(
    s,
    file("orchard.md", "Orchard venue is North Hall."),
    { host: "local" },
  );
  const m = proposeMemory(
    s,
    {
      requestKey: "first-preference",
      attributedStatement: true,
      memory: {
        type: "preference",
        content: "Orchard prefers morning sessions.",
      },
    },
    "local",
  );
  review(s, m.id);
  const w = saveWikiDraft(
    s,
    {
      title: "Orchard guide",
      type: "topic",
      blocks: [
        {
          id: "delivery",
          heading: "Delivery",
          text: "Orchard uses printed handouts.",
          kind: "user-authored",
          evidence: [],
        },
      ],
    },
    "local",
  );
  publish(s, w);
  t.mock.timers.tick(86400000);
  const b = await ingest(
    s,
    file("orchard.md", "Orchard venue is South Hall."),
    { host: "local" },
  );
  assert.equal(a.sourceId, b.sourceId);
  const replacement = proposeMemory(
    s,
    {
      requestKey: "new-preference",
      attributedStatement: true,
      memory: {
        type: "preference",
        content: "Orchard prefers afternoon sessions.",
        supersedes: m.id,
      },
    },
    "local",
  );
  review(s, replacement.id);
  const current = wikiDetail(s, w.pageId, "local");
  const edit = saveWikiDraft(
    s,
    {
      pageId: w.pageId,
      expectedVersion: current.version,
      title: "Orchard guide",
      type: "topic",
      blocks: [
        {
          id: "delivery",
          heading: "Delivery",
          text: "Orchard uses digital handouts.",
          kind: "user-authored",
          evidence: [],
        },
      ],
    },
    "local",
  );
  publish(s, edit);
  const old = knowledgeSearch(
    s,
    { query: "Orchard", asOf: "2026-01-01" },
    "local",
  );
  assert.equal(old.evidence.length, 3);
  assert.match(old.evidence.map((e) => e.excerpt).join(" "), /North Hall/);
  assert.match(old.evidence.map((e) => e.excerpt).join(" "), /morning/);
  assert.match(old.evidence.map((e) => e.excerpt).join(" "), /printed/);
  for (const e of old.evidence)
    assert.ok(
      knowledgeEvidence(
        s,
        { kind: e.kind, ...e.reference },
        "local",
      ).quote.includes(e.excerpt),
    );
  const latest = knowledgeSearch(s, { query: "Orchard" }, "local");
  assert.doesNotMatch(
    latest.evidence.map((e) => e.excerpt).join(" "),
    /North Hall|morning|printed/,
  );
  assert.equal(
    knowledgeSearch(s, { query: "Orchard", asOf: "2025-12-31" }, "local")
      .evidence.length,
    0,
  );
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [a.sourceId],
  });
  assert.equal(
    knowledgeSearch(
      s,
      { query: "Orchard", asOf: "2026-01-01" },
      "local",
    ).evidence.filter((e) => e.kind === "source").length,
    0,
  );
  assert.throws(() =>
    knowledgeEvidence(
      s,
      {
        kind: "source",
        ...old.evidence.find((e) => e.kind === "source").reference,
      },
      "local",
    ),
  );
  assert.throws(() =>
    knowledgeSearch(s, { query: "Orchard", asOf: "2026-02-30" }, "local"),
  );
});
test("one-hop explicit links retrieve related evidence without inferred or two-hop edges", async (t) => {
  const { s, file } = fixture(t);
  const a = await ingest(s, file("a.md", "Orchard workshop preparation."), {
      host: "local",
    }),
    b = await ingest(s, file("b.md", "A rehearsal requires two days."), {
      host: "local",
    }),
    c = await ingest(s, file("c.md", "Catering is booked."), { host: "local" }),
    d = await ingest(s, file("d.md", "Invented similarity."), {
      host: "local",
    });
  relationship(
    s,
    { from: a.sourceId, to: b.sourceId, type: "CONTRADICTS", basis: "manual" },
    "local",
  );
  relationship(
    s,
    { from: b.sourceId, to: c.sourceId, type: "SUPPORTS", basis: "manual" },
    "local",
  );
  relationship(
    s,
    { from: a.sourceId, to: d.sourceId, type: "SUPPORTS", basis: "inferred" },
    "local",
  );
  let r = knowledgeSearch(s, { query: "Orchard" }, "local");
  assert.deepEqual(
    new Set(r.evidence.map((e) => e.recordId)),
    new Set([a.sourceId, b.sourceId]),
  );
  assert.equal(
    r.evidence.find((e) => e.recordId === b.sourceId).relationship.type,
    "CONTRADICTS",
  );
  assert.equal(
    knowledgeSearch(
      s,
      { query: "Orchard", expandRelationships: false },
      "local",
    ).evidence.length,
    1,
  );
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [b.sourceId],
  });
  assert.equal(
    knowledgeSearch(s, { query: "Orchard" }, "local").evidence.length,
    1,
  );
});

test("chat retains historical source citations and rejects undated old evidence", async (t) => {
  const { beginChat, submitChat, chatEvidence } =
    await import("../dist/core/chat.js");
  const { s, file } = fixture(t);
  t.mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-01-01T12:00:00Z"),
  });
  const a = await ingest(s, file("venue.md", "Orchard venue is North Hall."), {
    host: "local",
  });
  t.mock.timers.tick(86400000);
  await ingest(s, file("venue.md", "Orchard venue is South Hall."), {
    host: "local",
  });
  let r = beginChat(
    s,
    { message: "Where was Orchard on January 1?", host: "codex" },
    "local",
  );
  r = submitChat(
    s,
    r.id,
    r.version,
    {
      type: "tool",
      call: { name: "search", input: { query: "Orchard", asOf: "2026-01-01" } },
    },
    "local",
  );
  const e = knowledgeSearch(
    s,
    { query: "Orchard", asOf: "2026-01-01" },
    "codex",
  ).evidence[0];
  const citation = { ...e.reference, quote: e.excerpt };
  const { asOf, ...undated } = citation;
  assert.throws(() =>
    submitChat(
      s,
      r.id,
      r.version,
      { type: "answer", text: "North Hall.", citations: [undated] },
      "local",
    ),
  );
  r = submitChat(
    s,
    r.id,
    r.version,
    {
      type: "answer",
      text: "On January 1, North Hall.",
      citations: [citation],
    },
    "local",
  );
  assert.equal(r.state, "completed");
  assert.equal(chatEvidence(s, r.id, "local").cited[0].asOf, "2026-01-01");
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [a.sourceId],
  });
  assert.throws(() => chatEvidence(s, r.id, "local"));
});

test("neighbor expansion stays in the exact revision and shared context budget", async (t) => {
  const { s, file } = fixture(t);
  const a = await ingest(s, file("segments.md", "Uniqueorchard decision."), {
    host: "local",
  });
  const p = s.one("SELECT * FROM passages WHERE revision_id=?", a.revisionId);
  s.exec(
    "INSERT INTO passages(id,revision_id,location,text) VALUES(?,?,?,?)",
    "neighbor-fictional",
    a.revisionId,
    "next",
    "The owner is the delivery team.",
  );
  const r = knowledgeSearch(s, { query: "Uniqueorchard" }, "local");
  assert.equal(
    r.evidence[0].data.surrounding[0].passageId,
    "neighbor-fictional",
  );
  assert.equal(
    knowledgeEvidence(
      s,
      {
        kind: "source",
        revisionId: a.revisionId,
        passageId: "neighbor-fictional",
      },
      "local",
    ).quote,
    "The owner is the delivery team.",
  );
  assert.ok(
    r.evidence.reduce(
      (n, e) =>
        n +
        e.excerpt.length +
        (e.data.surrounding ?? []).reduce((n, p) => n + p.quote.length, 0),
      0,
    ) <= s.policy().maxContextChars,
  );
  assert.equal(
    knowledgeSearch(
      s,
      { query: "Uniqueorchard", expandContext: false },
      "local",
    ).evidence[0].data.surrounding,
    undefined,
  );
});
