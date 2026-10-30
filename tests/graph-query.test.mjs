import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { graphQuery } from "../dist/core/graph-query.js";
import { ingest } from "../dist/core/intake.js";
import { graph } from "../dist/core/graph.js";

test("graph reads refuse unknown identities without leaking graph titles", async (t) => {
  const { s, file } = fixture(t);
  await ingest(
    s,
    file("fictional.md", "# Fictional\n\nPrivate orchard planning."),
    { host: "local" },
  );
  for (const mode of ["path", "impact"]) {
    const r = graphQuery(s, "local", mode, {
      source: "missing",
      target: "missing",
    });
    assert.equal(r.state, "unavailable");
    assert.deepEqual(r.nodes, []);
    assert.deepEqual(r.links, []);
  }
});
test("graph traversal rejects unbounded or malformed requests", (t) => {
  const { s } = fixture(t);
  for (const depth of [0, 3, 100])
    assert.throws(() =>
      graphQuery(s, "local", "impact", { source: "x", depth }),
    );
  assert.throws(() =>
    graphQuery(s, "local", "impact", { source: "x", permissions: "all" }),
  );
});
test("isolated permitted source has no fabricated impact or connection", async (t) => {
  const { s, file } = fixture(t);
  await ingest(s, file("isolated.md", "# Orchard\n\nAn isolated source."), {
    host: "local",
  });
  const source = graph(s, "local").nodes.find((n) => n.type === "document").id;
  const r = graphQuery(s, "local", "impact", { source, depth: 2 });
  assert.equal(r.state, "ready");
  assert.equal(r.nodes.length, 1);
  assert.deepEqual(r.links, []);
  assert.equal(
    graphQuery(s, "local", "path", { source, target: "absent" }).state,
    "unavailable",
  );
});

import { entity, relationship } from "../dist/core/knowledge.js";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
const frozen = [
  {
    id: "forward-en",
    mode: "path",
    source: "entity_a",
    target: "entity_b",
    depth: 1,
    state: "ready",
  },
  {
    id: "two-hop-fr",
    mode: "path",
    source: "entity_a",
    target: "entity_c",
    depth: 2,
    state: "ready",
  },
  {
    id: "depth-bound",
    mode: "path",
    source: "entity_a",
    target: "entity_c",
    depth: 1,
    state: "no-path-within-bound",
  },
  {
    id: "reverse-not-implied",
    mode: "path",
    source: "entity_c",
    target: "entity_a",
    depth: 2,
    state: "no-path-within-bound",
  },
  {
    id: "hidden-target",
    mode: "path",
    source: "entity_a",
    target: "entity_hidden",
    depth: 2,
    state: "unavailable",
  },
  {
    id: "impact",
    mode: "impact",
    source: "entity_c",
    depth: 2,
    state: "ready",
  },
];
test("frozen directed and restricted graph cases with measured read latency", (t) => {
  const { s } = fixture(t);
  for (const [id, name] of [
    ["entity_a", "Training process"],
    ["entity_b", "Guide de formation"],
    ["entity_c", "Specification"],
    ["entity_hidden", "Hidden marker"],
  ])
    entity(s, {
      id,
      name,
      type: "process",
      ...(id === "entity_hidden" ? { allowedHosts: ["local"] } : {}),
    });
  for (const [from, to] of [
    ["entity_a", "entity_b"],
    ["entity_b", "entity_c"],
  ])
    relationship(s, { from, to, type: "CITES", basis: "manual" }, "local");
  const samples = [];
  for (const c of frozen) {
    const { id, mode, state, ...input } = c;
    const start = performance.now();
    const r = graphQuery(s, "codex", mode, input);
    assert.equal(r.state, state, id);
    assert.ok(!JSON.stringify(r).includes("Hidden marker"));
    samples.push({
      id,
      milliseconds: performance.now() - start,
      serializedCharacters: JSON.stringify(r).length,
      passed: true,
    });
  }
  writeFileSync(
    "/tmp/hoi-graph-measurements.json",
    JSON.stringify(
      {
        scope:
          "Six deterministic synthetic cases, four entities; not answer-quality or production-scale certification",
        samples,
        providerTokens: null,
        providerCost: 0,
      },
      null,
      2,
    ),
  );
});

import {
  saveWikiDraft,
  publishWiki,
  searchWiki,
} from "../dist/core/wiki-core.js";
test("exact linked wiki search is resolved before the ranking limit", (t) => {
  const { s } = fixture(t);
  let selected;
  for (let i = 0; i < 12; i++) {
    const d = saveWikiDraft(
      s,
      {
        title: `Orchard ${i}`,
        type: "topic",
        blocks: [
          {
            id: "claim",
            heading: "Delivery",
            text:
              i === 11
                ? "Orchard livraison bilingue."
                : "Orchard Orchard delivery delivery.",
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
        pageId: d.pageId,
        revisionId: d.id,
        expectedVersion: d.version,
        confirm: true,
      },
      "local",
    );
    selected = d.pageId;
  }
  assert.equal(
    searchWiki(s, "Orchard", "local", { pageId: selected, limit: 1 })[0].pageId,
    selected,
  );
  assert.equal(
    searchWiki(s, "Orchard", "local", { pageId: "absent", limit: 1 }).length,
    0,
  );
});
test("revoked intermediary cannot contribute a path or impact count", (t) => {
  const { s } = fixture(t);
  for (const id of ["entity_left", "entity_middle", "entity_right"])
    entity(s, { id, name: id, type: "process" });
  for (const [from, to] of [
    ["entity_left", "entity_middle"],
    ["entity_middle", "entity_right"],
  ])
    relationship(s, { from, to, type: "CITES", basis: "manual" }, "local");
  assert.equal(
    graphQuery(s, "codex", "path", {
      source: "entity_left",
      target: "entity_right",
      depth: 2,
    }).state,
    "ready",
  );
  s.exec(
    "UPDATE entities SET allowed_hosts=? WHERE id=?",
    JSON.stringify(["local"]),
    "entity_middle",
  );
  const r = graphQuery(s, "codex", "path", {
    source: "entity_left",
    target: "entity_right",
    depth: 2,
  });
  assert.equal(r.state, "no-path-within-bound");
  assert.deepEqual(r.nodes, []);
  assert.equal(
    graphQuery(s, "codex", "impact", { source: "entity_right", depth: 2 }).nodes
      .length,
    1,
  );
});
