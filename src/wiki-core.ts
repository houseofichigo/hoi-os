import { listTasks, listProjects } from "./tasks.js";
import { records } from "./workspace.js";
import { z } from "zod";
import type { Store } from "./store.js";
import { uid, now, writeNote, readNote, sha } from "./files.js";
import { evidence, host as hostSchema, type Host } from "./schema.js";

export const WIKI_CORE_SQL = `
CREATE TABLE IF NOT EXISTS wiki_identities(id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 0,published_id TEXT,draft_id TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wiki_revision_data(revision_id TEXT PRIMARY KEY REFERENCES wiki_pages(id),page_id TEXT NOT NULL REFERENCES wiki_identities(id),base_id TEXT,payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS wiki_revision_page ON wiki_revision_data(page_id);
CREATE TABLE IF NOT EXISTS wiki_primary(subject_id TEXT PRIMARY KEY,page_id TEXT NOT NULL REFERENCES wiki_identities(id));
CREATE TABLE IF NOT EXISTS wiki_taxonomy(tag TEXT PRIMARY KEY,aliases TEXT NOT NULL,version INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS wiki_tag_redirects(old_tag TEXT PRIMARY KEY,new_tag TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wiki_events(id TEXT PRIMARY KEY,page_id TEXT,kind TEXT NOT NULL,details TEXT NOT NULL,at TEXT NOT NULL);
INSERT OR IGNORE INTO wiki_taxonomy VALUES('topic/ai-agents','["agents IA"]',1),('topic/automation','["automatisation"]',1),('topic/data-strategy','["stratégie data"]',1),('topic/leadership','[]',1);
`;
export const wikiTemplates: Record<string, string[]> = {
  client: [
    "Context",
    "Contacts",
    "Goals",
    "Preferences",
    "Linked projects",
    "Decisions",
  ],
  project: [
    "Objective",
    "Scope",
    "Deliverables",
    "Milestones",
    "Risks",
    "Decisions",
    "Related knowledge",
  ],
  person: ["Role", "Affiliations", "Responsibilities", "Recorded preferences"],
  offering: [
    "Audience",
    "Outcomes",
    "Prerequisites",
    "Delivery format",
    "Current material",
  ],
  training: [
    "Audience",
    "Outcomes",
    "Prerequisites",
    "Delivery format",
    "Current material",
  ],
  topic: ["Explanation", "Examples", "Limitations", "References"],
  process: [
    "Explanation",
    "Procedure",
    "Examples",
    "Limitations",
    "References",
  ],
  decision: [
    "Decision",
    "Rationale",
    "Alternatives",
    "Participants",
    "Consequences",
  ],
};
const ev = evidence.extend({
  relation: z
    .enum(["supports", "contradicts", "references"])
    .default("supports"),
});
const block = z
  .object({
    id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .max(100),
    heading: z.string().max(200),
    text: z.string().trim().min(1).max(30000),
    kind: z.enum(["source-backed", "user-authored", "unverified", "question"]),
    evidence: z.array(ev).max(50).default([]),
    evidenceScope: z.enum(["block", "page"]).default("block"),
  })
  .strict();
export const wikiDraftSchema = z
  .object({
    pageId: z.string().optional(),
    expectedVersion: z.number().int().nonnegative().default(0),
    title: z.string().trim().min(1).max(240),
    type: z.string().trim().min(1).max(40),
    summary: z.string().max(1500).default(""),
    aliases: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    language: z.enum(["en", "fr", "mixed", "unknown"]).default("unknown"),
    tags: z.array(z.string()).max(30).default([]),
    subjects: z.array(z.string()).max(40).default([]),
    relatedPages: z.array(z.string()).max(40).default([]),
    owner: z.string().max(240).nullable().default(null),
    effectiveDate: z.string().date().nullable().default(null),
    reviewDate: z.string().date().nullable().default(null),
    allowedHosts: z
      .array(hostSchema)
      .min(1)
      .default(["local", "codex", "claude"]),
    blocks: z.array(block).min(1).max(100),
  })
  .strict();
function check(s: Store, h: Host, write = false) {
  s.assertSchema(15, "Knowledge Core");
  s.assertHost(h);
  if (write && s.policy().actions.draft === "deny")
    throw Error("Knowledge changes denied");
}
function log(s: Store, page: string | null, kind: string, details: any) {
  s.exec(
    "INSERT INTO wiki_events VALUES(?,?,?,?,?)",
    uid("wikievent"),
    page,
    kind,
    JSON.stringify(details),
    now(),
  );
}
export function migrateWikiIdentities(s: Store) {
  // Group only explicit chains. Equal slugs without a supersedes chain remain separate.
  const rows = s.all("SELECT * FROM wiki_pages ORDER BY created_at,id"),
    byId = new Map(rows.map((r: any) => [r.id, r]));
  for (const r of rows) {
    if (s.one("SELECT 1 FROM wiki_revision_data WHERE revision_id=?", r.id))
      continue;
    let root = r;
    const seen = new Set<string>();
    while (
      root.supersedes &&
      byId.has(root.supersedes) &&
      !seen.has(root.supersedes)
    ) {
      seen.add(root.id);
      root = byId.get(root.supersedes);
    }
    const pageId = "page_" + sha(root.id).slice(0, 24);
    s.exec(
      "INSERT OR IGNORE INTO wiki_identities VALUES(?,0,NULL,NULL,?)",
      pageId,
      r.created_at,
    );
    s.exec(
      "INSERT INTO wiki_revision_data VALUES(?,?,?,?)",
      r.id,
      pageId,
      r.supersedes,
      JSON.stringify({ legacy: true }),
    );
    if (r.status === "canonical")
      s.exec(
        "UPDATE wiki_identities SET published_id=? WHERE id=?",
        r.id,
        pageId,
      );
    if (r.status === "draft")
      s.exec("UPDATE wiki_identities SET draft_id=? WHERE id=?", r.id, pageId);
  }
}
function currentTag(s: Store, tag: string) {
  const seen = new Set<string>();
  while (!seen.has(tag)) {
    seen.add(tag);
    const r = s.one(
      "SELECT new_tag FROM wiki_tag_redirects WHERE old_tag=?",
      tag,
    );
    if (!r) break;
    tag = r.new_tag;
  }
  return tag;
}
function revision(s: Store, id: string, h: Host, history = false): any {
  const row = s.one(
    "SELECT w.*,d.page_id,d.base_id,d.payload FROM wiki_pages w JOIN wiki_revision_data d ON d.revision_id=w.id WHERE w.id=?",
    id,
  );
  if (
    !row ||
    !JSON.parse(row.allowed_hosts).includes(h) ||
    (!history && !s.knowledgeActive(id))
  )
    throw Error("WIKI_UNAVAILABLE");
  const refs = s.all(
    "SELECT revision_id revisionId,passage_id passageId,quote,relation FROM wiki_evidence WHERE page_id=?",
    id,
  );
  // Fail closed on the whole revision, including title and metadata.
  if (!s.evidenceVisible(refs, h, false)) throw Error("WIKI_UNAVAILABLE");
  const payload = JSON.parse(row.payload);
  if (payload.tags)
    payload.tags = Array.from(
      new Set(payload.tags.map((t: string) => currentTag(s, t))),
    );
  if ((payload.subjects ?? []).some((id: string) => !subject(s, id, h)))
    throw Error("WIKI_UNAVAILABLE");
  return {
    id: row.id,
    pageId: row.page_id,
    title: row.title,
    type: row.type,
    status: row.status,
    owner: row.owner,
    subjects: JSON.parse(row.entities),
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    baseId: row.base_id,
    allowedHosts: JSON.parse(row.allowed_hosts),
    content: payload.content ?? readNote(s.path(row.content_path)).content,
    evidence: refs,
    evidenceCurrent: s.evidenceVisible(refs, h, true),
    ...payload,
  };
}
function identity(s: Store, ref: string) {
  return (
    s.one("SELECT * FROM wiki_identities WHERE id=?", ref) ??
    s.one(
      "SELECT i.* FROM wiki_identities i JOIN wiki_revision_data d ON d.page_id=i.id WHERE d.revision_id=?",
      ref,
    )
  );
}
export function wikiDetail(
  s: Store,
  ref: string,
  h: Host,
  history = false,
): any {
  check(s, h);
  const p = identity(s, ref);
  if (!p) throw Error("WIKI_UNAVAILABLE");
  const isRevision = ref !== p.id;
  const id = isRevision ? ref : (p.published_id ?? p.draft_id);
  if (!id) throw Error("WIKI_UNAVAILABLE");
  const r = revision(s, id, h, history);
  const records = (r.subjects ?? []).flatMap((id: string) => {
    const x = subject(s, id, h);
    return x ? [x] : [];
  });
  return {
    ...r,
    relatedPages: (r.relatedPages ?? []).filter((id: string) => {
      const target = identity(s, id);
      try {
        if (!target) return false;
        revision(s, target.published_id ?? target.draft_id, h);
        return true;
      } catch {
        return false;
      }
    }),
    version: p.version,
    publishedId: p.published_id,
    draftId:
      p.draft_id &&
      (() => {
        try {
          revision(s, p.draft_id, h);
          return true;
        } catch {
          return false;
        }
      })()
        ? p.draft_id
        : null,
    records,
    primarySubjects: s
      .all("SELECT subject_id FROM wiki_primary WHERE page_id=?", p.id)
      .map((x: any) => x.subject_id)
      .filter((id: string) => subject(s, id, h)),
  };
}
export function wikiLibrary(s: Store, h: Host, history = false): any[] {
  check(s, h);
  return s
    .all("SELECT * FROM wiki_identities ORDER BY created_at DESC")
    .flatMap((p: any) => {
      try {
        return [wikiDetail(s, p.id, h, history)];
      } catch {
        return [];
      }
    });
}
function subject(s: Store, id: string, h: Host): any {
  const memory = s.memories(true).find((m: any) => m.id === id);
  if (memory)
    return memory.allowedHosts.includes(h) &&
      s.knowledgeActive(id) &&
      s.evidenceVisible(memory.evidence ?? [], h, false)
      ? { id, kind: "memory", title: memory.content, evidence: memory.evidence }
      : null;
  const source = s.one("SELECT * FROM sources WHERE id=?", id);
  if (source)
    return s.allowed(source, h)
      ? { id, title: source.title, kind: "source" }
      : null;
  const task = listTasks(s, h).find((t: any) => t.id === id);
  if (task) return { ...task, kind: "task" };
  for (const kind of ["client", "project", "training"] as const) {
    const r = records(s, kind, h).find((x: any) => x.id === id);
    if (r) return { ...r, kind };
  }
  const project = listProjects(s, h).find(
    (p: any) => p.id === id || p.entity_id === id,
  );
  if (project) return { ...project, id, recordId: project.id, kind: "project" };
  if (
    s.one("SELECT 1 FROM workspace_records WHERE id=?", id) ||
    s.one("SELECT 1 FROM projects WHERE id=? OR entity_id=?", id, id) ||
    s.one("SELECT 1 FROM tasks WHERE id=?", id)
  )
    return null;
  const e = s.one("SELECT * FROM entities WHERE id=?", id);
  if (e) {
    if (!JSON.parse(e.allowed_hosts).includes(h)) return null;
    // Entities have no standalone ACL. Require a visible relationship or explicit manual entity.
    const links = s.all(
      "SELECT * FROM relationships WHERE from_id=? OR to_id=?",
      id,
      id,
    );
    if (
      links.length &&
      !links.some((l: any) =>
        s.evidenceVisible(JSON.parse(l.evidence), h, false),
      )
    )
      return null;
    return { id, title: e.name, kind: e.type };
  }
  return null;
}
export function saveWikiDraft(s: Store, input: unknown, h: Host): any {
  check(s, h, true);
  const v = wikiDraftSchema.parse(input);
  if (!wikiTemplates[v.type])
    throw Error("WIKI_TYPE: Choose a supported template");
  if (new Set(v.blocks.map((b) => b.id)).size !== v.blocks.length)
    throw Error("DUPLICATE_BLOCK_ID");
  const old = v.pageId ? wikiDetail(s, v.pageId, h) : null;
  if (old && v.allowedHosts.some((x) => !old.allowedHosts.includes(x)))
    throw Error("Cannot broaden page access");
  if (!v.allowedHosts.includes(h))
    throw Error("Author host must retain access");
  if (v.subjects.some((id) => !subject(s, id, h)))
    throw Error("SUBJECT_UNAVAILABLE");
  for (const id of v.relatedPages) wikiDetail(s, id, h);
  v.tags = Array.from(new Set(v.tags.map((t) => currentTag(s, t))));
  for (const tag of v.tags)
    if (!s.one("SELECT 1 FROM wiki_taxonomy WHERE tag=?", tag))
      throw Error("UNKNOWN_TAG: Review taxonomy first");
  const oldBlocks = new Map((old?.blocks ?? []).map((b: any) => [b.id, b]));
  const blocks = v.blocks.map((b) => {
    const prior: any = oldBlocks.get(b.id);
    if (
      b.kind === "user-authored" &&
      h !== "local" &&
      (!prior ||
        prior.kind !== "user-authored" ||
        prior.text !== b.text ||
        prior.heading !== b.heading)
    )
      throw Error(
        "ATTRIBUTION_DENIED: Only the local user can author attributed statements",
      );
    if (b.kind === "source-backed" && !b.evidence.length)
      throw Error("EVIDENCE_REQUIRED");
    s.validateEvidence(b.evidence, h, true);
    return {
      ...b,
      ...(b.kind === "user-authored"
        ? {
            author: prior?.text === b.text ? prior.author : "workspace-user",
            recordedAt: prior?.text === b.text ? prior.recordedAt : now(),
          }
        : {}),
    };
  });
  const pageId = v.pageId ?? uid("page"),
    rid = uid("wiki"),
    stamp = now(),
    path = `wiki/${rid}.md`;
  const content = blocks
    .map((b) => `## ${b.heading}\n\n${b.text}`)
    .join("\n\n");
  const payload = { ...v, blocks, content, legacy: false, authorHost: h };
  delete payload.pageId;
  // Immutable file first; a failed SQL transaction can leave an unreferenced original, never a missing referenced file.
  writeNote(s.path(path), {
    id: rid,
    pageId,
    createdAt: stamp,
    ...payload,
    status: "draft",
    content,
  });
  s.tx(() => {
    const p = s.one("SELECT * FROM wiki_identities WHERE id=?", pageId);
    if (p ? p.version !== v.expectedVersion : v.expectedVersion !== 0)
      throw Error("STALE_VERSION: Reload the page before saving");
    if (!p)
      s.exec(
        "INSERT INTO wiki_identities VALUES(?,0,NULL,NULL,?)",
        pageId,
        stamp,
      );
    const prior = p?.draft_id;
    if (prior)
      s.exec(
        "UPDATE wiki_pages SET status='superseded' WHERE id=? AND status='draft'",
        prior,
      );
    s.exec(
      "INSERT INTO wiki_pages VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      rid,
      pageId,
      v.title,
      v.type,
      "draft",
      v.owner,
      JSON.stringify(v.subjects),
      JSON.stringify(v.allowedHosts),
      path,
      v.effectiveDate,
      null,
      p?.published_id ?? null,
      stamp,
      stamp,
    );
    s.exec(
      "INSERT INTO wiki_revision_data VALUES(?,?,?,?)",
      rid,
      pageId,
      p?.published_id ?? null,
      JSON.stringify(payload),
    );
    const refs = blocks.flatMap((b) => b.evidence);
    for (const e of refs)
      s.exec(
        "INSERT INTO wiki_evidence VALUES(?,?,?,?,?,?,?)",
        uid("we"),
        rid,
        e.revisionId,
        e.passageId,
        e.quote,
        e.relation,
        stamp,
      );
    s.exec(
      "UPDATE wiki_identities SET draft_id=?,version=version+1 WHERE id=?",
      rid,
      pageId,
    );
    log(s, pageId, "draft.saved", { revisionId: rid, host: h });
  });
  return wikiDetail(s, rid, h);
}
export function compareWiki(s: Store, ref: string, h: Host) {
  const p = identity(s, ref);
  if (!p) throw Error("WIKI_UNAVAILABLE");
  return {
    version: p.version,
    before: p.published_id ? wikiDetail(s, p.published_id, h) : null,
    after: p.draft_id ? wikiDetail(s, p.draft_id, h) : null,
  };
}
export function publishWiki(s: Store, input: unknown, h: Host) {
  check(s, h, true);
  if (h !== "local") throw Error("REVIEW_REQUIRED: Publish in the local app");
  const v = z
    .object({
      pageId: z.string(),
      revisionId: z.string(),
      expectedVersion: z.number().int(),
      confirm: z.literal(true),
    })
    .strict()
    .parse(input);
  const r = wikiDetail(s, v.revisionId, h);
  if (r.pageId !== v.pageId) throw Error("PAGE_MISMATCH");
  if (r.legacy) throw Error("Use legacy review for a legacy revision");
  if (r.blocks.some((b: any) => b.kind === "unverified"))
    throw Error("UNVERIFIED_CLAIMS: Cite or remove proposed facts");
  s.validateEvidence(r.evidence, h, true);
  s.tx(() => {
    const p = identity(s, v.pageId);
    if (p.published_id === v.revisionId) return;
    if (
      p.version !== v.expectedVersion ||
      p.draft_id !== v.revisionId ||
      r.baseId !== p.published_id
    )
      throw Error("STALE_VERSION: Compare again before publishing");
    if (p.published_id)
      s.exec(
        "UPDATE wiki_pages SET status='superseded' WHERE id=?",
        p.published_id,
      );
    s.exec(
      "UPDATE wiki_pages SET status='canonical',reviewed_at=?,updated_at=? WHERE id=?",
      now(),
      now(),
      v.revisionId,
    );
    s.exec(
      "UPDATE wiki_identities SET published_id=?,draft_id=NULL,version=version+1 WHERE id=?",
      v.revisionId,
      v.pageId,
    );
    log(s, v.pageId, "published", {
      revisionId: v.revisionId,
      reviewer: "workspace-user",
    });
  });
  // Markdown is an immutable draft snapshot; authoritative lifecycle is the transactional DB record.
  return wikiDetail(s, v.pageId, h);
}
export function wikiHistory(s: Store, ref: string, h: Host) {
  const current = wikiDetail(s, ref, h, true);
  return s
    .all(
      "SELECT revision_id FROM wiki_revision_data WHERE page_id=? ORDER BY rowid DESC",
      current.pageId,
    )
    .flatMap((x: any) => {
      try {
        return [wikiDetail(s, x.revision_id, h, true)];
      } catch {
        return [];
      }
    });
}
export function restoreWikiDraft(s: Store, input: any, h: Host) {
  check(s, h, true);
  const r = wikiDetail(s, String(input.revisionId), h, true);
  const p = identity(s, r.pageId);
  const { id: _, pageId: __, version: ___, ...rest } = r;
  const v: any = {};
  for (const k of Object.keys(wikiDraftSchema.shape))
    if (k in rest) v[k] = rest[k];
  v.blocks = r.blocks
    ? r.blocks.map(({ author, recordedAt, ...b }: any) => b)
    : [
        {
          id: "legacy",
          heading: "Legacy page content",
          text: r.content,
          kind: "source-backed",
          evidence: r.evidence,
          evidenceScope: "page",
        },
      ];
  v.type = wikiTemplates[r.type] ? r.type : "topic";
  return saveWikiDraft(
    s,
    { ...v, pageId: r.pageId, expectedVersion: input.expectedVersion },
    h,
  );
}
export function assignPrimary(s: Store, input: unknown, h: Host) {
  check(s, h, true);
  if (h !== "local") throw Error("REVIEW_REQUIRED");
  const v = z
    .object({
      subjectId: z.string(),
      pageId: z.string(),
      expectedVersion: z.number().int(),
    })
    .strict()
    .parse(input);
  const p = wikiDetail(s, v.pageId, h);
  if (!subject(s, v.subjectId, h)) throw Error("SUBJECT_UNAVAILABLE");
  if (!(p.subjects ?? p.entities ?? []).includes(v.subjectId))
    throw Error("Link the subject in a reviewed draft first");
  s.tx(() => {
    if (identity(s, p.pageId).version !== v.expectedVersion)
      throw Error("STALE_VERSION");
    s.exec(
      "INSERT INTO wiki_primary VALUES(?,?) ON CONFLICT(subject_id) DO UPDATE SET page_id=excluded.page_id",
      v.subjectId,
      p.pageId,
    );
    s.exec("UPDATE wiki_identities SET version=version+1 WHERE id=?", p.pageId);
    log(s, p.pageId, "primary.assigned", v);
  });
  return { assigned: true };
}
export function resolveWikiNode(s: Store, id: string, h: Host) {
  check(s, h);
  const p = identity(s, id);
  if (p)
    return {
      record: { id, kind: "wiki" },
      primary: wikiDetail(s, p.id, h),
      pages: [wikiDetail(s, p.id, h)],
    };
  const record = subject(s, id, h);
  if (!record) throw Error("NODE_UNAVAILABLE");
  const relatedIds = [id, record.recordId, record.projectId].filter(Boolean);
  const project = listProjects(s, h).find(
    (p: any) => relatedIds.includes(p.id) || relatedIds.includes(p.entity_id),
  );
  if (project) relatedIds.push(project.id, project.entity_id);
  const pages = wikiLibrary(s, h).filter(
    (p) =>
      (p.subjects ?? []).some((x: string) => relatedIds.includes(x)) ||
      p.evidence.some(
        (e: any) =>
          s.one("SELECT source_id FROM revisions WHERE id=?", e.revisionId)
            ?.source_id === id,
      ),
  );
  const assigned = relatedIds
    .map((x) => s.one("SELECT page_id FROM wiki_primary WHERE subject_id=?", x))
    .find(Boolean);
  return {
    record,
    pages,
    primary: pages.find((p) => p.pageId === assigned?.page_id) ?? null,
  };
}
export function wikiBacklinks(s: Store, ref: string, h: Host) {
  const p = wikiDetail(s, ref, h);
  return wikiLibrary(s, h).filter((x) =>
    (x.relatedPages ?? []).includes(p.pageId),
  );
}
export function taxonomy(s: Store, h: Host) {
  check(s, h);
  return s
    .all(
      "SELECT * FROM wiki_taxonomy WHERE tag NOT IN (SELECT old_tag FROM wiki_tag_redirects) ORDER BY tag",
    )
    .map((x: any) => ({ ...x, aliases: JSON.parse(x.aliases) }));
}
export function updateTaxonomy(s: Store, input: unknown, h: Host) {
  check(s, h, true);
  if (h !== "local") throw Error("REVIEW_REQUIRED");
  const v = z
    .object({
      tag: z.string().regex(/^topic\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
      aliases: z.array(z.string().trim().min(1)).max(30),
      expectedVersion: z.number().int().nonnegative(),
    })
    .strict()
    .parse(input);
  s.tx(() => {
    const old = s.one("SELECT * FROM wiki_taxonomy WHERE tag=?", v.tag);
    if ((old?.version ?? 0) !== v.expectedVersion) throw Error("STALE_VERSION");
    s.exec(
      "INSERT INTO wiki_taxonomy VALUES(?,?,?) ON CONFLICT(tag) DO UPDATE SET aliases=excluded.aliases,version=excluded.version",
      v.tag,
      JSON.stringify(v.aliases),
      v.expectedVersion + 1,
    );
    log(s, null, "taxonomy.reviewed", v);
  });
  return taxonomy(s, h);
}
export function searchWiki(
  s: Store,
  query: string,
  h: Host,
  opts: { project?: string; client?: string; limit?: number } = {},
) {
  if (s.schemaVersion < 15) return [];
  check(s, h);
  const normalize = (x: string) =>
    x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const tokens = normalize(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!tokens.length) return [];
  const out: any[] = [];
  for (const p of wikiLibrary(s, h).filter(
    (x) => x.status === "canonical" && x.evidenceCurrent,
  )) {
    if (opts.project) {
      const project = listProjects(s, h).find(
        (x: any) => x.id === opts.project || x.entity_id === opts.project,
      );
      if (
        !(p.subjects ?? []).some((x: string) =>
          [opts.project, project?.id, project?.entity_id].includes(x),
        )
      )
        continue;
    }
    if (opts.client && !(p.subjects ?? []).includes(opts.client)) continue;
    const blocks = p.legacy
      ? [
          {
            id: "legacy",
            heading: p.title,
            text: p.content,
            kind: "source-backed",
            evidence: p.evidence,
          },
        ]
      : p.blocks;
    for (const b of blocks) {
      if (["question", "unverified"].includes(b.kind)) continue;
      const expanded = (p.tags ?? []).flatMap((t: string) => {
        const r = s.one("SELECT aliases FROM wiki_taxonomy WHERE tag=?", t);
        return r ? JSON.parse(r.aliases) : [];
      });
      const text = normalize(
        [
          p.title,
          p.summary,
          ...(p.aliases ?? []),
          ...(p.tags ?? []),
          ...expanded,
          b.heading,
          b.text,
        ].join(" "),
      );
      const score = tokens.filter((t) => text.includes(t)).length;
      if (!score) continue;
      out.push({
        pageId: p.pageId,
        wikiRevisionId: p.id,
        blockId: b.id,
        title: p.title,
        quote: b.text,
        provenance: b.kind,
        author: b.author ?? null,
        recordedAt: b.recordedAt ?? p.createdAt,
        effectiveDate: p.effectiveDate,
        reviewedAt: p.reviewedAt,
        legacyEvidence: p.legacy,
        evidence: b.evidence,
        score,
        conflict: b.evidence.some((e: any) => e.relation === "contradicts"),
      });
    }
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((x) => {
      const key = sha(x.quote + JSON.stringify(x.evidence));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, opts.limit ?? 8);
}

export function mergeWikiTag(s: Store, input: unknown, h: Host) {
  check(s, h, true);
  if (h !== "local") throw Error("REVIEW_REQUIRED");
  const v = z
    .object({
      from: z.string(),
      to: z.string().regex(/^topic\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
      expectedVersion: z.number().int(),
      confirm: z.literal(true),
    })
    .strict()
    .parse(input);
  if (v.from === v.to || currentTag(s, v.to) === v.from)
    throw Error("TAG_CYCLE");
  s.tx(() => {
    const old = s.one("SELECT * FROM wiki_taxonomy WHERE tag=?", v.from);
    if (
      !old ||
      old.version !== v.expectedVersion ||
      currentTag(s, v.from) !== v.from
    )
      throw Error("STALE_VERSION");
    const target = currentTag(s, v.to);
    s.exec(
      "INSERT OR IGNORE INTO wiki_taxonomy VALUES(?,?,1)",
      target,
      JSON.stringify([v.from, ...JSON.parse(old.aliases)]),
    );
    const existing = s.one("SELECT * FROM wiki_taxonomy WHERE tag=?", target);
    s.exec(
      "UPDATE wiki_taxonomy SET aliases=?,version=version+1 WHERE tag=?",
      JSON.stringify(
        Array.from(
          new Set([
            ...JSON.parse(existing.aliases),
            v.from,
            ...JSON.parse(old.aliases),
          ]),
        ),
      ),
      target,
    );
    s.exec("INSERT INTO wiki_tag_redirects VALUES(?,?)", v.from, target);
    log(s, null, "taxonomy.merged", v);
  });
  return taxonomy(s, h);
}
export function wikiSubjects(s: Store, h: Host) {
  check(s, h);
  const ids = new Set<string>();
  const out: any[] = [];
  for (const kind of ["client", "project", "training"] as const)
    for (const r of records(s, kind, h)) {
      ids.add(r.id);
      out.push({ id: r.id, title: r.name, kind });
    }
  for (const e of s.all("SELECT * FROM entities")) {
    if (
      ids.has(e.id) ||
      s.one("SELECT 1 FROM projects WHERE entity_id=?", e.id)
    )
      continue;
    const r = subject(s, e.id, h);
    if (r) out.push({ id: e.id, title: e.name, kind: e.type });
  }
  return out;
}
