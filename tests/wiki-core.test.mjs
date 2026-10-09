import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { Store, migrate } from "../dist/core/store.js";
import {
  saveWikiDraft,
  publishWiki,
  wikiDetail,
  wikiHistory,
  restoreWikiDraft,
  searchWiki,
  assignPrimary,
  resolveWikiNode,
  compareWiki,
} from "../dist/core/wiki-core.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import { proposeWiki, reviewWiki, canonicalWiki } from "../dist/core/wiki.js";
import { entity } from "../dist/core/knowledge.js";
import { graph } from "../dist/core/graph.js";
const draft = (x = {}) => ({
  title: "Orchard policy",
  type: "topic",
  aliases: ["politique verger"],
  blocks: [
    {
      id: "policy",
      heading: "Policy",
      text: "Orchard preparation needs two days.",
      kind: "user-authored",
      evidence: [],
    },
  ],
  ...x,
});
const edit = (p, x = {}) =>
  draft({ pageId: p.pageId, expectedVersion: p.version, ...x });
const publish = (s, p) =>
  publishWiki(
    s,
    {
      pageId: p.pageId,
      revisionId: p.id,
      expectedVersion: p.version,
      confirm: true,
    },
    "local",
  );
test("attributed drafts publish explicitly, reject stale updates, retain history and restore as draft", (t) => {
  const { s } = fixture(t);
  let p = saveWikiDraft(s, draft(), "local");
  assert.equal(searchWiki(s, "Orchard", "local").length, 0);
  assert.throws(
    () =>
      publishWiki(
        s,
        {
          pageId: p.pageId,
          revisionId: p.id,
          expectedVersion: p.version,
          confirm: true,
        },
        "codex",
      ),
    /REVIEW_REQUIRED/,
  );
  let published = publish(s, p);
  assert.equal(publish(s, p).id, p.id);
  assert.equal(
    searchWiki(s, "politique verger", "local")[0].author,
    "workspace-user",
  );
  assert.throws(() => saveWikiDraft(s, edit(p), "local"), /STALE/);
  let d = saveWikiDraft(
    s,
    edit(published, { title: "Updated policy" }),
    "local",
  );
  assert.equal(wikiDetail(s, p.pageId, "local").id, p.id);
  assert.equal(compareWiki(s, p.pageId, "local").after.id, d.id);
  published = publish(s, d);
  assert.equal(wikiHistory(s, p.pageId, "local").length, 2);
  const restored = restoreWikiDraft(
    s,
    { revisionId: p.id, expectedVersion: published.version },
    "local",
  );
  assert.equal(restored.status, "draft");
  assert.equal(wikiDetail(s, p.pageId, "local").id, d.id);
});
test("assistant cannot impersonate user; questions and unsupported facts do not enter answer context", (t) => {
  const { s } = fixture(t);
  assert.throws(() => saveWikiDraft(s, draft(), "codex"), /ATTRIBUTION/);
  const d = saveWikiDraft(
    s,
    draft({
      blocks: [
        {
          id: "b",
          heading: "Q",
          text: "Does the moon need cheese?",
          kind: "unverified",
        },
      ],
    }),
    "codex",
  );
  assert.throws(() => publish(s, d), /UNVERIFIED/);
  const q = saveWikiDraft(
    s,
    edit(d, {
      blocks: [
        {
          id: "b",
          heading: "Q",
          text: "Does the moon need cheese?",
          kind: "question",
        },
      ],
    }),
    "local",
  );
  publish(s, q);
  assert.deepEqual(searchWiki(s, "cheese", "local"), []);
});
test("source evidence, permissions, stale revisions and graph relation labels", async (t) => {
  const { s, file } = fixture(t);
  const f = file("facts.md", "Orchard preparation needs two days.");
  await ingest(s, f);
  const e = retrieve(s, "Orchard", "local").results[0];
  const evidence = {
    revisionId: e.revisionId,
    passageId: e.passageId,
    quote: e.quote,
    relation: "contradicts",
  };
  const d = saveWikiDraft(
    s,
    draft({
      allowedHosts: ["local"],
      blocks: [
        {
          id: "b",
          heading: "Conflict",
          text: "Two-day preparation is contested.",
          kind: "source-backed",
          evidence: [evidence],
        },
      ],
    }),
    "local",
  );
  publish(s, d);
  assert.throws(() => wikiDetail(s, d.pageId, "codex"), /UNAVAILABLE/);
  assert.equal(searchWiki(s, "preparation", "codex").length, 0);
  assert.ok(
    graph(s, "local").links.some(
      (l) => l.target === d.pageId && l.type === "CONTRADICTS",
    ),
  );
  assert.ok(graph(s, "local").nodes.some((n) => n.id === d.pageId));
  const { writeFileSync } = await import("node:fs");
  writeFileSync(f, "Orchard preparation needs three days.");
  await ingest(s, f);
  assert.equal(searchWiki(s, "preparation", "local").length, 0);
});
test("primary subject is explicit and rechecks source permissions", (t) => {
  const { s } = fixture(t);
  const e = entity(s, {
    name: "Orchard",
    type: "client",
    allowedHosts: ["local"],
  });
  const d = saveWikiDraft(s, draft({ subjects: [e.id] }), "local");
  const p = publish(s, d);
  assert.equal(resolveWikiNode(s, e.id, "local").primary, null);
  assignPrimary(
    s,
    { subjectId: e.id, pageId: p.pageId, expectedVersion: p.version },
    "local",
  );
  assert.equal(resolveWikiNode(s, e.id, "local").primary.pageId, p.pageId);
  assert.throws(() => wikiDetail(s, p.pageId, "codex"), /UNAVAILABLE/);
});
test("legacy IDs and evidence survive migration without invented block citations", async (t) => {
  const { s, file } = fixture(t);
  await ingest(s, file("legacy.md", "Legacy orchard knowledge."));
  const e = retrieve(s, "orchard", "local").results[0];
  const w = proposeWiki(
    s,
    {
      slug: "legacy-orchard",
      title: "Legacy",
      type: "topic",
      content: "Legacy content.",
      evidence: [
        { revisionId: e.revisionId, passageId: e.passageId, quote: e.quote },
      ],
    },
    "local",
  );
  reviewWiki(s, w.id, "reviewed", "local");
  canonicalWiki(s, w.id, "local");
  s.db.exec(
    "DROP TABLE wiki_primary;DROP TABLE wiki_events;DROP TABLE wiki_taxonomy;DROP TABLE wiki_revision_data;DROP TABLE wiki_identities;PRAGMA user_version=14",
  );
  const old = new Store(s.root);
  migrate(old);
  old.close();
  const restored = new Store(s.root);
  t.after(() => restored.close());
  const p = wikiDetail(restored, w.id, "local");
  assert.equal(p.id, w.id);
  assert.equal(p.legacy, true);
  assert.equal(p.blocks, undefined);
  assert.equal(p.evidence.length, 1);
});
test("30 bilingual labelled retrieval cases preserve evidence and exclude missing answers", async (t) => {
  const { s, file } = fixture(t);
  const labels = [
    ["Orchard onboarding", "Accueil verger"],
    ["Lumen delivery", "Livraison lumière"],
    ["Cedar coaching", "Accompagnement cèdre"],
    ["Atlas evaluation", "Évaluation atlas"],
    ["Willow preparation", "Préparation saule"],
    ["Maple facilitation", "Animation érable"],
    ["Birch prerequisites", "Prérequis bouleau"],
    ["Pine objectives", "Objectifs pin"],
    ["River workshop", "Atelier rivière"],
    ["Stone reporting", "Rapport pierre"],
    ["Meadow support", "Assistance prairie"],
    ["Forest followup", "Suivi forêt"],
  ];
  const cases = [];
  for (let i = 0; i < labels.length; i++) {
    const [en, fr] = labels[i];
    await ingest(
      s,
      file(
        `case-${i}.md`,
        `${en}: the documented preparation allowance is ${i + 1} days.`,
      ),
    );
    const hit = retrieve(s, en, "local").results.find(
      (x) => x.title === `case-${i}` || x.quote.startsWith(en),
    );
    assert.ok(hit);
    const ev = {
      revisionId: hit.revisionId,
      passageId: hit.passageId,
      quote: hit.quote,
    };
    const p = saveWikiDraft(
      s,
      draft({
        title: en,
        aliases: [fr],
        blocks: [
          {
            id: "policy",
            heading: "Preparation",
            text: hit.quote,
            kind: "source-backed",
            evidence: [ev],
          },
        ],
      }),
      "local",
    );
    publish(s, p);
    cases.push({ q: en, id: p.pageId }, { q: fr, id: p.pageId });
  }
  let correct = 0;
  for (const c of cases) {
    const hits = searchWiki(s, c.q, "local", { limit: 5 });
    if (hits.some((x) => x.pageId === c.id)) correct++;
    for (const h of hits) s.validateEvidence(h.evidence, "local", true);
  }
  assert.ok(correct / cases.length >= 0.9, `${correct}/24 recall@5`);
  for (const q of [
    "unicorn budget",
    "licorne facturation",
    "Venus procurement",
    "Vénus recrutement",
    "submarine itinerary",
    "sous-marin assurance",
  ])
    assert.equal(searchWiki(s, q, "local", { limit: 5 }).length, 0);
});
test("taxonomy merge retains revision originals, restores aliases and rejects stale edits", async (t) => {
  const { s } = fixture(t);
  const { updateTaxonomy, mergeWikiTag, taxonomy } =
    await import("../dist/core/wiki-core.js");
  updateTaxonomy(
    s,
    { tag: "topic/advisory", aliases: ["conseil"], expectedVersion: 0 },
    "local",
  );
  const p = saveWikiDraft(s, draft({ tags: ["topic/advisory"] }), "local");
  publish(s, p);
  mergeWikiTag(
    s,
    {
      from: "topic/advisory",
      to: "topic/consulting",
      expectedVersion: 1,
      confirm: true,
    },
    "local",
  );
  assert.deepEqual(wikiDetail(s, p.id, "local").tags, ["topic/consulting"]);
  assert.ok(searchWiki(s, "conseil", "local").length);
  assert.throws(
    () =>
      mergeWikiTag(
        s,
        {
          from: "topic/advisory",
          to: "topic/other",
          expectedVersion: 1,
          confirm: true,
        },
        "local",
      ),
    /STALE/,
  );
  assert.ok(!taxonomy(s, "local").some((t) => t.tag === "topic/advisory"));
});
test("failed transactions leave published knowledge intact and backup restores page IDs and drafts", async (t) => {
  const { s, root } = fixture(t);
  const { backup, restore, verifyBackup } =
    await import("../dist/core/backup.js");
  const { join } = await import("node:path");
  let p = publish(s, saveWikiDraft(s, draft(), "local"));
  const exec = s.exec.bind(s);
  s.exec = (sql, ...args) => {
    if (sql.startsWith("INSERT INTO wiki_revision_data"))
      throw Error("injected disk/database interruption");
    return exec(sql, ...args);
  };
  assert.throws(
    () => saveWikiDraft(s, edit(p, { title: "Interrupted" }), "local"),
    /injected/,
  );
  s.exec = exec;
  assert.equal(wikiDetail(s, p.pageId, "local").id, p.id);
  assert.equal(wikiHistory(s, p.pageId, "local").length, 1);
  const d = saveWikiDraft(
    s,
    edit(p, { title: "Saved before restart" }),
    "local",
  );
  const b = join(root, "backup"),
    r = join(root, "restored");
  backup(s, b);
  verifyBackup(b);
  restore(b, r);
  const copy = new Store(r);
  t.after(() => copy.close());
  assert.equal(wikiDetail(copy, p.pageId, "local").draftId, d.id);
  assert.equal(wikiDetail(copy, d.id, "local").title, "Saved before restart");
  assert.equal(wikiHistory(copy, p.pageId, "local").length, 2);
});
test("chat wiki citations are validated and withheld after the cited page changes", async (t) => {
  const { s } = fixture(t);
  const { beginChat, submitChat, chatEvidence } =
    await import("../dist/core/chat.js");
  const p = publish(s, saveWikiDraft(s, draft(), "local"));
  const run = beginChat(
    s,
    { message: "Orchard preparation", host: "codex" },
    "local",
  );
  const e = {
    pageId: p.pageId,
    wikiRevisionId: p.id,
    blockId: "policy",
    quote: "Orchard preparation needs two days.",
  };
  submitChat(
    s,
    run.id,
    run.version,
    {
      type: "answer",
      text: "According to your recorded statement, preparation needs two days.",
      citations: [],
      wikiCitations: [e],
    },
    "local",
  );
  assert.ok(
    chatEvidence(s, run.id, "local").wiki.some(
      (x) => x.cited && x.author === "workspace-user",
    ),
  );
  const d = saveWikiDraft(s, edit(p, { title: "Changed policy" }), "local");
  publish(s, d);
  assert.throws(
    () => chatEvidence(s, run.id, "local"),
    /CONTEXT_CHANGED|current/,
  );
});
