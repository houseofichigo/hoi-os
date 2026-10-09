import { migrateWikiIdentities, wikiDetail } from "./wiki-core.js";
import { readFileSync } from "node:fs";
import { Store } from "./store.js";
import { wikiPageInput, type Host } from "./schema.js";
import { uid, now, readNote, writeNote, atomic } from "./files.js";

const ACTIVE = ["draft", "reviewed", "canonical"];
function assertWiki(s: Store) {
  s.assertSchema(2, "The wiki");
}
function visible(s: Store, row: any, host: Host) {
  if (
    s.schemaVersion >= 15 &&
    s.one("SELECT 1 FROM wiki_revision_data WHERE revision_id=?", row.id)
  ) {
    try {
      wikiDetail(s, row.id, host);
    } catch {
      return false;
    }
  }
  return (
    s.knowledgeActive(row.id) &&
    JSON.parse(row.allowed_hosts).includes(host) &&
    s.evidenceVisible(
      evidenceRows(s, row.id).map((e) => ({
        revisionId: e.revision_id,
        passageId: e.passage_id,
        quote: e.quote,
      })),
      host,
      false,
    )
  );
}
function evidenceRows(s: Store, pageId: string) {
  return s.all(
    "SELECT * FROM wiki_evidence WHERE page_id=? ORDER BY created_at",
    pageId,
  );
}
function summarize(s: Store, row: any, host: Host) {
  const evidence = evidenceRows(s, row.id).map((e) => ({
    revisionId: e.revision_id,
    passageId: e.passage_id,
    quote: e.quote,
    relation: e.relation,
  }));
  const supports = evidence.filter((e) => e.relation !== "contradicts");
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    status: row.status,
    owner: row.owner,
    entities: JSON.parse(row.entities),
    effectiveDate: row.effective_date,
    reviewedAt: row.reviewed_at,
    supersedes: row.supersedes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidenceCount: evidence.length,
    evidenceCurrent: s.evidenceVisible(supports, host, true),
    evidence,
  };
}
export function proposeWiki(s: Store, input: unknown, host: Host) {
  assertWiki(s);
  s.assertHost(host);
  const page = wikiPageInput.parse(input);
  s.validateEvidence(
    page.evidence.map(({ relation: _relation, ...e }) => e),
    host,
    true,
  );
  const canonical = s.one(
    "SELECT id FROM wiki_pages WHERE slug=? AND status='canonical'",
    page.slug,
  );
  if (canonical && page.supersedes !== canonical.id)
    throw Error(
      "A canonical page exists for this slug; propose with supersedes set to it. Canonical pages are never replaced silently.",
    );
  if (page.supersedes) {
    const prior = s.one("SELECT * FROM wiki_pages WHERE id=?", page.supersedes);
    if (!prior || !visible(s, prior, host))
      throw Error("Superseded page unavailable");
    if (
      page.allowedHosts.some(
        (h) => !JSON.parse(prior.allowed_hosts).includes(h),
      )
    )
      throw Error("Replacement cannot broaden host access");
    if (prior.slug !== page.slug)
      throw Error("A page may only supersede a page with the same slug");
  }
  const id = uid("wiki"),
    contentPath = `wiki/${page.slug}.${id}.md`;
  writeNote(s.path(contentPath), {
    schemaVersion: 1,
    id,
    slug: page.slug,
    title: page.title,
    type: page.type,
    status: "draft",
    owner: page.owner,
    entities: page.entities,
    allowedHosts: page.allowedHosts,
    effectiveDate: page.effectiveDate,
    supersedes: page.supersedes ?? null,
    createdAt: now(),
    content: page.content,
  });
  s.tx(() => {
    s.exec(
      "INSERT INTO wiki_pages VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      page.slug,
      page.title,
      page.type,
      "draft",
      page.owner,
      JSON.stringify(page.entities),
      JSON.stringify(page.allowedHosts),
      contentPath,
      page.effectiveDate,
      null,
      page.supersedes ?? null,
      now(),
      now(),
    );
    for (const e of page.evidence)
      s.exec(
        "INSERT INTO wiki_evidence VALUES(?,?,?,?,?,?,?)",
        uid("wikievidence"),
        id,
        e.revisionId,
        e.passageId,
        e.quote,
        e.relation,
        now(),
      );
  });
  if (s.schemaVersion >= 15) migrateWikiIdentities(s);
  s.log("wiki.proposed", { id, slug: page.slug });
  return { id, slug: page.slug, status: "draft", contentPath };
}
export function listWiki(s: Store, host: Host) {
  assertWiki(s);
  s.assertHost(host);
  return s
    .all("SELECT * FROM wiki_pages ORDER BY slug,created_at")
    .filter((row) => visible(s, row, host))
    .map((row) => {
      const { evidence: _evidence, ...summary } = summarize(s, row, host);
      return summary;
    });
}
export function getWiki(s: Store, ref: string, host: Host) {
  assertWiki(s);
  s.assertHost(host);
  const row =
    s.one("SELECT * FROM wiki_pages WHERE id=?", ref) ??
    s.one(
      "SELECT * FROM wiki_pages WHERE slug=? AND status IN ('canonical','reviewed','draft') ORDER BY CASE status WHEN 'canonical' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,created_at DESC",
      ref,
    );
  if (!row || !visible(s, row, host)) throw Error("Wiki page unavailable");
  const note = readNote(s.path(row.content_path));
  const d =
    s.schemaVersion >= 15
      ? s.one(
          "SELECT page_id,payload FROM wiki_revision_data WHERE revision_id=?",
          row.id,
        )
      : null;
  const extra = d ? JSON.parse(d.payload) : {};
  const content = extra.blocks
    ? extra.blocks
        .filter((b: any) => !["question", "unverified"].includes(b.kind))
        .map(
          (b: any) =>
            `## ${b.heading}\n${b.kind === "user-authored" ? "[Attributed statement by " + b.author + "]\n" : ""}${b.text}`,
        )
        .join("\n\n")
    : note.content;
  return {
    ...summarize(s, row, host),
    ...(d
      ? {
          pageId: d.page_id,
          blocks: extra.blocks?.filter(
            (b: any) => !["question", "unverified"].includes(b.kind),
          ),
          legacy: extra.legacy,
        }
      : {}),
    content,
  };
}
export function reviewWiki(
  s: Store,
  id: string,
  state: "reviewed" | "rejected",
  host: Host,
) {
  assertWiki(s);
  s.assertHost(host);
  const row = s.one("SELECT * FROM wiki_pages WHERE id=?", id);
  if (s.schemaVersion >= 15) {
    const d = s.one(
      "SELECT payload FROM wiki_revision_data WHERE revision_id=?",
      id,
    );
    if (d && !JSON.parse(d.payload).legacy)
      throw Error("Use version-checked Knowledge Core publication");
  }
  if (!row || !visible(s, row, host)) throw Error("Wiki page unavailable");
  s.validateEvidence(summarize(s, row, host).evidence, host, true);
  if (row.status !== "draft") throw Error("Only draft pages can be reviewed");
  s.exec(
    "UPDATE wiki_pages SET status=?,reviewed_at=?,updated_at=? WHERE id=?",
    state,
    now(),
    now(),
    id,
  );
  const note = readNote(s.path(row.content_path));
  atomic(
    s.path(`archives/${now().slice(0, 10)}/${uid("wiki-review")}.md`),
    readFileSync(s.path(row.content_path)),
  );
  writeNote(s.path(row.content_path), {
    ...note,
    status: state,
    reviewedAt: now(),
  });
  s.log("wiki.reviewed", { id, state });
  return { id, status: state };
}
export function canonicalWiki(s: Store, id: string, host: Host) {
  assertWiki(s);
  s.assertHost(host);
  const row = s.one("SELECT * FROM wiki_pages WHERE id=?", id);
  if (s.schemaVersion >= 15) {
    const d = s.one(
      "SELECT payload FROM wiki_revision_data WHERE revision_id=?",
      id,
    );
    if (d && !JSON.parse(d.payload).legacy)
      throw Error("Use version-checked Knowledge Core publication");
  }
  if (!row || !visible(s, row, host)) throw Error("Wiki page unavailable");
  s.validateEvidence(summarize(s, row, host).evidence, host, true);
  if (row.status !== "reviewed")
    throw Error("Review the page before marking it canonical");
  s.tx(() => {
    s.exec(
      "UPDATE wiki_pages SET status='superseded',updated_at=? WHERE slug=? AND status='canonical'",
      now(),
      row.slug,
    );
    if (row.supersedes)
      s.exec(
        "UPDATE wiki_pages SET status='superseded',updated_at=? WHERE id=?",
        now(),
        row.supersedes,
      );
    s.exec(
      "UPDATE wiki_pages SET status='canonical',updated_at=? WHERE id=?",
      now(),
      id,
    );
  });
  const note = readNote(s.path(row.content_path));
  atomic(
    s.path(`archives/${now().slice(0, 10)}/${uid("wiki-review")}.md`),
    readFileSync(s.path(row.content_path)),
  );
  writeNote(s.path(row.content_path), { ...note, status: "canonical" });
  if (s.schemaVersion >= 15) {
    const d = s.one(
      "SELECT page_id FROM wiki_revision_data WHERE revision_id=?",
      id,
    );
    if (d)
      s.exec(
        "UPDATE wiki_identities SET published_id=?,draft_id=NULL,version=version+1 WHERE id=?",
        id,
        d.page_id,
      );
  }
  s.log("wiki.canonical", { id, slug: row.slug });
  return { id, slug: row.slug, status: "canonical" };
}
export function wikiContradictions(s: Store, host: Host) {
  assertWiki(s);
  s.assertHost(host);
  const rows = s
    .all("SELECT * FROM wiki_pages")
    .filter((row) => visible(s, row, host));
  const bySlug = new Map<string, any[]>();
  for (const row of rows.filter((r) => ACTIVE.includes(r.status)))
    bySlug.set(row.slug, [...(bySlug.get(row.slug) ?? []), row.id]);
  const stale: string[] = [],
    contradicted: string[] = [];
  for (const row of rows.filter((r) =>
    ["reviewed", "canonical"].includes(r.status),
  )) {
    const evidence = evidenceRows(s, row.id);
    const supports = evidence
      .filter((e) => e.relation !== "contradicts")
      .map((e) => ({
        revisionId: e.revision_id,
        passageId: e.passage_id,
        quote: e.quote,
      }));
    if (!s.evidenceVisible(supports, host, true)) stale.push(row.id);
    if (evidence.some((e) => e.relation === "contradicts"))
      contradicted.push(row.id);
  }
  return {
    duplicateActivePages: [...bySlug.values()].filter((ids) => ids.length > 1),
    staleEvidence: stale,
    recordedContradictions: contradicted,
    semanticReview:
      "Mechanical report only. Quote checks prove source-text presence, not entailment; conflicting claims across sources require human review.",
  };
}
