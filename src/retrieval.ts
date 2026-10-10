import {
  operationalEvidence,
  resolveOperationalEvidence,
  recordReference,
} from "./record-evidence.js";
import { historicalEvidence, historyCutoff } from "./historical-retrieval.js";
import { artifactEvidence } from "./conversation-artifacts.js";
import { semanticReferences } from "./semantic.js";
import { z } from "zod";
import { Store } from "./store.js";
import { type Host } from "./schema.js";
import { now, sha } from "./files.js";
import { searchWiki, wikiDetail, wikiSubjects } from "./wiki-core.js";

export const RETRIEVAL_PROFILE = Object.freeze({
  version: "unified-retrieval-v3",
  channelLimit: 50,
  candidateLimit: 100,
  resultLimit: 10,
  perSource: 3,
  rrfConstant: 60,
});
const optionsSchema = z
  .object({
    query: z.string().trim().max(8000),
    scope: z.enum(["knowledge", "workspace"]).default("knowledge"),
    project: z.string().optional(),
    client: z.string().optional(),
    sourceId: z.string().optional(),
    limit: z.number().int().min(1).max(30).default(10),
    latest: z.boolean().default(false),
    asOf: z.string().date().optional(),
    expandRelationships: z.boolean().default(true),
    expandContext: z.boolean().default(true),
  })
  .strict();
export type EvidenceItem = {
  kind: "source" | "wiki" | "memory" | "record";
  id: string;
  recordId: string;
  revision: string;
  excerpt: string;
  title: string;
  provenance: string;
  attribution: string | null;
  effectiveDate: string | null;
  relatedRecords: string[];
  supportingEvidence: any[];
  score: number;
  method: "lexical" | "semantic" | "relationship";
  relationship?: {
    id: string;
    type: string;
    fromId: string;
    toId: string;
    basis: string;
    evidence: any[];
  };
  reason: string;
  reference: Record<string, string>;
  data: any;
};
const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const terms = (value: string) => [
  ...new Set(normalize(value).match(/[\p{L}\p{N}_-]+/gu) ?? []),
];

/** Complete eligible memory set: no context budget is consumed before ranking. */
export function eligibleMemories(
  s: Store,
  h: Host,
  project?: string,
  client?: string,
) {
  s.assertHost(h);
  const today = now().slice(0, 10);
  const all = s.memories();
  const replaced = new Set(
    all.filter((m) => m.state === "approved").map((m) => m.supersedes),
  );
  const projectRow =
    project && s.schemaVersion >= 3
      ? s.one(
          "SELECT id,entity_id FROM projects WHERE id=? OR entity_id=?",
          project,
          project,
        )
      : null;
  const projectIds = [project, projectRow?.id, projectRow?.entity_id].filter(
    Boolean,
  );
  return all.filter(
    (m) =>
      m.state === "approved" &&
      !replaced.has(m.id) &&
      m.allowedHosts?.includes(h) &&
      s.evidenceVisible(m.evidence, h) &&
      (!m.validFrom || m.validFrom <= today) &&
      (!m.validUntil || m.validUntil >= today) &&
      (!project || m.entities?.some((id: string) => projectIds.includes(id))) &&
      (!client || m.entities?.includes(client)),
  );
}

// Project records and their explicit subject entities are the same scope.
// Never infer an association from names, tags or query terms.
function matchesProject(
  s: Store,
  requested: string | undefined,
  linked: unknown,
) {
  if (!requested) return true;
  if (linked === requested) return true;
  const row =
    s.schemaVersion >= 3
      ? s.one(
          "SELECT id,entity_id FROM projects WHERE id=? OR entity_id=?",
          requested,
          requested,
        )
      : null;
  return !!row && (linked === row.id || linked === row.entity_id);
}

export function knowledgeSearch(s: Store, input: unknown, h: Host) {
  return s.withReadPolicyCache(() => searchWithinRead(s, input, h));
}
function searchWithinRead(s: Store, input: unknown, h: Host) {
  s.assertHost(h);
  const v = optionsSchema.parse(input),
    tokens = terms(v.query);
  if (v.asOf) {
    const scoped = historicalEvidence(s, h, v.asOf).filter(
      (e) =>
        (!v.sourceId || (e.kind === "source" && e.recordId === v.sourceId)) &&
        (!v.project || e.relatedRecords.includes(v.project)) &&
        (!v.client || e.relatedRecords.includes(v.client)),
    );
    const channels = ["source", "wiki", "memory"].map((kind) =>
      scoped
        .filter((e) => e.kind === kind)
        .map((e) => ({
          ...e,
          score: tokens.filter((t) =>
            terms(e.title + " " + e.excerpt).includes(t),
          ).length,
        }))
        .filter((e) => e.score > 0)
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
        .slice(0, 50),
    );
    return finishSearch(s, v, channels, false, historyCutoff(s, h, v.asOf));
  }
  const channels: EvidenceItem[][] = [];
  const match = tokens.map((t) => `"${t.replaceAll('"', '""')}"`).join(" OR ");
  const rows = match
    ? s.all(
        `SELECT p.*,s.id source_id,s.title,s.metadata,s.last_checked,
    r.original_path,bm25(passage_search) rank FROM passage_search
    JOIN passages p ON p.id=passage_search.passage_id JOIN revisions r ON r.id=p.revision_id
    JOIN sources s ON s.current_revision=r.id WHERE passage_search MATCH ? ORDER BY rank,p.id`,
        match,
      )
    : v.sourceId || v.project || v.client
      ? s.all(`SELECT p.*,s.id source_id,s.title,s.metadata,
      s.last_checked,r.original_path,0 rank FROM passages p JOIN revisions r ON r.id=p.revision_id
      JOIN sources s ON s.current_revision=r.id ORDER BY s.title,p.id`)
      : [];
  let sourceRows = rows.filter((r) => {
    const m = JSON.parse(r.metadata);
    return (
      s.allowed({ id: r.source_id, metadata: m }, h) &&
      m.status !== "superseded" &&
      (!v.sourceId || r.source_id === v.sourceId) &&
      matchesProject(s, v.project, m.project) &&
      (!v.client || m.client === v.client)
    );
  });
  if (v.latest) {
    const authority: Record<string, number> = {
      signed: 3,
      approved: 2,
      draft: 1,
      unknown: 0,
    };
    sourceRows.sort((a, b) => {
      const x = JSON.parse(a.metadata),
        y = JSON.parse(b.metadata);
      return (
        (authority[y.status] ?? 0) - (authority[x.status] ?? 0) ||
        (y.effectiveDate ?? "").localeCompare(x.effectiveDate ?? "") ||
        a.rank - b.rank
      );
    });
  }
  channels.push(
    sourceRows.slice(0, 50).map((r) => {
      const m = JSON.parse(r.metadata);
      const data = {
        sourceId: r.source_id,
        revisionId: r.revision_id,
        passageId: r.id,
        originalPath: r.original_path,
        title: r.title,
        location: r.location,
        quote: r.text,
        authority: m.authority,
        status: m.status,
        effectiveDate: m.effectiveDate,
        lastChecked: r.last_checked,
        rank: r.rank,
      };
      return {
        kind: "source",
        id: `source:${r.id}`,
        recordId: r.source_id,
        revision: r.revision_id,
        title: r.title,
        excerpt: r.text,
        provenance: "source-backed",
        attribution: m.owner ?? null,
        effectiveDate: m.effectiveDate ?? null,
        relatedRecords: [m.project, m.client, ...(m.entities ?? [])].filter(
          Boolean,
        ),
        supportingEvidence: [],
        reference: { revisionId: r.revision_id, passageId: r.id },
        score: 0,
        method: "lexical",
        reason: "Matching source passage",
        data,
      } as EvidenceItem;
    }),
  );
  if (!v.sourceId) {
    channels.push(
      searchWiki(s, v.query, h, { ...v, limit: 50 }).map((w) => ({
        kind: "wiki",
        id: `wiki:${w.wikiRevisionId}:${w.blockId}`,
        recordId: w.pageId,
        revision: w.wikiRevisionId,
        title: w.title,
        excerpt: w.quote,
        provenance: w.provenance,
        attribution: w.author ?? null,
        effectiveDate: w.effectiveDate ?? null,
        relatedRecords: [],
        supportingEvidence: w.evidence,
        reference: {
          pageId: w.pageId,
          wikiRevisionId: w.wikiRevisionId,
          blockId: w.blockId,
        },
        score: 0,
        method: "lexical",
        reason: "Matching published wiki section or reviewed alias",
        data: w,
      })),
    );
    const memory = eligibleMemories(s, h, v.project, v.client)
      .map((m) => ({
        m,
        score: tokens.filter((t) => terms(m.content).includes(t)).length,
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.m.id.localeCompare(b.m.id))
      .slice(0, 50);
    channels.push(
      memory.map(({ m }) => {
        const revision = sha(JSON.stringify(m));
        return {
          kind: "memory",
          id: `memory:${m.id}:${revision}`,
          recordId: m.id,
          revision,
          title: `${m.type} memory`,
          excerpt: m.content,
          provenance: m.evidence?.length
            ? "source-backed"
            : m.author
              ? "attributed-memory"
              : "legacy-reviewed-memory",
          attribution: m.author ?? null,
          effectiveDate: m.validFrom ?? null,
          relatedRecords: m.entities ?? [],
          supportingEvidence: m.evidence ?? [],
          reference: { memoryId: m.id, memoryRevision: revision },
          score: 0,
          method: "lexical",
          reason: "Matching approved, currently valid memory",
          data: { ...m, memoryRevision: revision },
        } as EvidenceItem;
      }),
    );
  }
  if (v.scope === "workspace" && !v.sourceId)
    channels.push(
      operationalEvidence(s, h, v)
        .map((e) => ({
          ...e,
          score: tokens.filter((t) =>
            terms(e.recordId + " " + e.title + " " + e.excerpt).includes(t),
          ).length,
        }))
        .filter((e) => e.score > 0)
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
        .slice(0, 50),
    );
  const resolved = new Map<string, EvidenceItem>();
  const semantic = semanticReferences(s, h, v.query, (ref) => {
    const data = knowledgeEvidence(s, ref, h) as any;
    let item: EvidenceItem;
    if (ref.kind === "source") {
      if (
        (v.sourceId && data.sourceId !== v.sourceId) ||
        !matchesProject(s, v.project, data.metadata.project) ||
        (v.client && data.metadata.client !== v.client)
      )
        return false;
      item = {
        kind: "source",
        id: `source:${ref.passageId}`,
        recordId: data.sourceId,
        revision: ref.revisionId,
        title: data.title,
        excerpt: data.quote,
        provenance: "source-backed",
        attribution: data.metadata.owner ?? null,
        effectiveDate: data.metadata.effectiveDate ?? null,
        relatedRecords: [],
        supportingEvidence: [],
        reference: { revisionId: ref.revisionId, passageId: ref.passageId },
        score: 0,
        method: "semantic",
        reason: "Matching local multilingual embedding",
        data,
      };
    } else if (ref.kind === "wiki") {
      if (
        v.sourceId ||
        (v.project && !data.subjects?.includes(v.project)) ||
        (v.client && !data.subjects?.includes(v.client))
      )
        return false;
      item = {
        kind: "wiki",
        id: `wiki:${ref.wikiRevisionId}:${ref.blockId}`,
        recordId: ref.pageId,
        revision: ref.wikiRevisionId,
        title: data.title,
        excerpt: data.quote,
        provenance: data.provenance,
        attribution: data.author ?? null,
        effectiveDate: data.effectiveDate ?? null,
        relatedRecords: data.subjects ?? [],
        supportingEvidence: data.evidence ?? [],
        reference: {
          pageId: ref.pageId,
          wikiRevisionId: ref.wikiRevisionId,
          blockId: ref.blockId,
        },
        score: 0,
        method: "semantic",
        reason: "Matching local multilingual embedding",
        data,
      };
    } else {
      if (
        v.sourceId ||
        !eligibleMemories(s, h, v.project, v.client).some(
          (m) => m.id === ref.memoryId,
        )
      )
        return false;
      const m = eligibleMemories(s, h).find((m) => m.id === ref.memoryId)!;
      item = {
        kind: "memory",
        id: `memory:${m.id}:${ref.memoryRevision}`,
        recordId: m.id,
        revision: ref.memoryRevision,
        title: `${m.type} memory`,
        excerpt: m.content,
        provenance: m.evidence.length ? "source-backed" : "attributed-memory",
        attribution: m.author ?? null,
        effectiveDate: m.validFrom ?? null,
        relatedRecords: m.entities,
        supportingEvidence: m.evidence,
        reference: { memoryId: m.id, memoryRevision: ref.memoryRevision },
        score: 0,
        method: "semantic",
        reason: "Matching local multilingual embedding",
        data: { ...m, memoryRevision: ref.memoryRevision },
      };
    }
    resolved.set(JSON.stringify(ref), item);
    return true;
  })
    .map((segment) => {
      const item = resolved.get(JSON.stringify(segment.reference));
      if (!item) return null;
      const excerpt = item.excerpt.slice(segment.start, segment.end);
      return {
        ...item,
        excerpt,
        data: {
          ...item.data,
          ...(item.kind === "memory"
            ? { content: excerpt }
            : { quote: excerpt }),
        },
      };
    })
    .filter((item): item is EvidenceItem => item !== null);
  channels.push(semantic);
  const originals = new Map(
    channels
      .flat()
      .filter((e) => e.kind === "source")
      .map((e) => [e.id, e]),
  );
  channels.push(
    artifactEvidence(s, h, v.query).flatMap((ref) => {
      const data = knowledgeEvidence(s, ref, h) as any;
      if (
        (v.sourceId && data.sourceId !== v.sourceId) ||
        !matchesProject(s, v.project, data.metadata.project) ||
        (v.client && data.metadata.client !== v.client)
      )
        return [];
      const found = originals.get(`source:${ref.passageId}`) ?? {
        kind: "source" as const,
        id: `source:${ref.passageId}`,
        recordId: data.sourceId,
        revision: ref.revisionId,
        title: data.title,
        excerpt: data.quote,
        provenance: "source-backed",
        attribution: data.metadata.owner ?? null,
        effectiveDate: data.effectiveDate ?? null,
        relatedRecords: [],
        supportingEvidence: [],
        score: 0,
        method: "lexical" as const,
        reference: { revisionId: ref.revisionId, passageId: ref.passageId },
        data,
      };
      return [
        {
          ...found,
          reason:
            "Original evidence located through a derived, unreviewed conversation artifact",
        },
      ];
    }),
  );
  if (v.expandRelationships && !v.sourceId)
    channels.push(relationshipExpansion(s, h, channels.flat(), v));
  return finishSearch(s, v, channels, semantic.length > 0);
}
function relationshipExpansion(
  s: Store,
  h: Host,
  seeds: EvidenceItem[],
  v: z.infer<typeof optionsSchema>,
) {
  const permittedSubjects = new Set(
    s.schemaVersion >= 15 ? wikiSubjects(s, h).map((x) => x.id) : [],
  );
  const ids = new Set(
    seeds.flatMap((e) => [
      e.recordId,
      ...e.relatedRecords.filter((id) => permittedSubjects.has(id)),
    ]),
  );
  if (!ids.size) return [];
  const out: EvidenceItem[] = [];
  const endpoints = JSON.stringify([...ids]);
  for (const edge of s.all(
    "SELECT * FROM relationships WHERE from_id IN (SELECT value FROM json_each(?)) OR to_id IN (SELECT value FROM json_each(?)) ORDER BY created_at,id",
    endpoints,
    endpoints,
  )) {
    if (
      !["DESCRIBES", "CITES", "SUPPORTS", "CONTRADICTS", "SUPERSEDES"].includes(
        edge.type,
      ) ||
      edge.basis === "inferred"
    )
      continue;
    const proof = JSON.parse(edge.evidence);
    if (!s.evidenceVisible(proof, h)) continue;
    const target = ids.has(edge.from_id) ? edge.to_id : edge.from_id;
    if (ids.has(target)) continue;
    let candidates: EvidenceItem[] = [];
    if (s.one("SELECT 1 FROM sources WHERE id=?", target)) {
      candidates = knowledgeSearch(
        s,
        {
          query: "",
          sourceId: target,
          expandRelationships: false,
          expandContext: false,
        },
        h,
      ).evidence;
      candidates = candidates.filter(
        (e) =>
          (!v.project || e.relatedRecords.includes(v.project)) &&
          (!v.client || e.relatedRecords.includes(v.client)),
      );
    } else {
      const m = eligibleMemories(s, h, v.project, v.client).find(
        (m) => m.id === target,
      );
      if (m) {
        const revision = sha(JSON.stringify(m));
        candidates = [
          {
            kind: "memory",
            id: `memory:${m.id}:${revision}`,
            recordId: m.id,
            revision,
            title: `${m.type} memory`,
            excerpt: m.content,
            provenance: m.evidence.length
              ? "source-backed"
              : m.author
                ? "attributed-memory"
                : "legacy-reviewed-memory",
            attribution: m.author ?? null,
            effectiveDate: m.validFrom ?? null,
            relatedRecords: m.entities,
            supportingEvidence: m.evidence,
            reference: { memoryId: m.id, memoryRevision: revision },
            score: 0,
            method: "relationship",
            reason: "",
            data: { ...m, memoryRevision: revision },
          },
        ];
      }
    }
    for (const e of candidates) {
      if (out.some((x) => x.id === e.id)) continue;
      out.push({
        ...e,
        method: "relationship",
        reason: `Explicit ${edge.type} relationship; ${edge.type === "CONTRADICTS" ? "inspect both statements" : "one-hop evidence expansion"}`,
        relationship: {
          id: edge.id,
          type: edge.type,
          fromId: edge.from_id,
          toId: edge.to_id,
          basis: edge.basis,
          evidence: proof,
        },
      });
      if (out.length >= 20) return out;
    }
  }
  return out;
}
function finishSearch(
  s: Store,
  v: z.infer<typeof optionsSchema>,
  channels: EvidenceItem[][],
  semanticUsed: boolean,
  cutoff?: string,
) {
  const fused = new Map<string, EvidenceItem>();
  for (const channel of channels)
    channel
      .filter(
        (item, index) =>
          channel.findIndex((other) => other.id === item.id) === index,
      )
      .forEach((item, index) => {
        const prior = fused.get(item.id);
        if (prior) prior.score += 1 / (60 + index + 1);
        else fused.set(item.id, { ...item, score: 1 / (60 + index + 1) });
      });
  const candidates = [...fused.values()]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 100);
  const seen = new Set<string>(),
    parents = new Map<string, number>(),
    selected: EvidenceItem[] = [];
  for (const item of candidates) {
    const fingerprint = sha(
      (item.kind === "record" ? item.recordId + ":" : "") +
        normalize(item.excerpt).trim().replace(/\s+/g, " "),
    );
    const parent = `${item.kind}:${item.recordId}`;
    if (
      seen.has(fingerprint) ||
      (!v.sourceId && (parents.get(parent) ?? 0) >= 3)
    )
      continue;
    seen.add(fingerprint);
    parents.set(parent, (parents.get(parent) ?? 0) + 1);
    selected.push(item);
    if (selected.length >= Math.min(v.limit, 10)) break;
  }
  let remaining = s.policy().maxContextChars;
  const allowance = Math.floor(remaining / Math.max(1, selected.length));
  const evidence = selected.flatMap((item) => {
    if (remaining <= 0) return [];
    const excerpt = item.excerpt.slice(0, Math.min(remaining, allowance));
    remaining -= excerpt.length;
    return [
      {
        ...item,
        excerpt,
        data: {
          ...item.data,
          retrieval: {
            method: item.method,
            reason: item.reason,
            ...(item.relationship ? { relationship: item.relationship } : {}),
          },
          ...(item.kind === "memory"
            ? { content: excerpt }
            : { quote: excerpt }),
        },
      },
    ];
  });
  // Expand only within the remaining shared budget and existing per-source cap.
  if (v.expandContext) {
    const supplied = new Set(
      evidence
        .filter((e) => e.kind === "source")
        .map((e) => e.reference.passageId),
    );
    const counts = new Map<string, number>();
    for (const e of evidence.filter((e) => e.kind === "source"))
      counts.set(e.recordId, (counts.get(e.recordId) ?? 0) + 1);
    for (const item of evidence.filter((e) => e.kind === "source")) {
      const passages = s.all(
        "SELECT id,text,location FROM passages WHERE revision_id=? ORDER BY rowid",
        item.revision,
      );
      const index = passages.findIndex(
        (p) => p.id === item.reference.passageId,
      );
      const surrounding = [];
      for (const p of [passages[index - 1], passages[index + 1]]) {
        if (
          !p ||
          supplied.has(p.id) ||
          remaining <= 0 ||
          (counts.get(item.recordId) ?? 0) >= 3
        )
          continue;
        const quote = p.text.slice(0, Math.min(1200, remaining));
        if (!quote) continue;
        surrounding.push({
          revisionId: item.revision,
          passageId: p.id,
          quote,
          location: p.location,
          ...(v.asOf ? { asOf: v.asOf } : {}),
          reason: "Adjacent passage in the same source revision",
        });
        supplied.add(p.id);
        counts.set(item.recordId, (counts.get(item.recordId) ?? 0) + 1);
        remaining -= quote.length;
      }
      if (surrounding.length) item.data.surrounding = surrounding;
    }
  }
  return {
    query: v.query,
    scope: v.scope,
    profile: RETRIEVAL_PROFILE.version,
    retrievedAt: now(),
    ...(v.asOf ? { asOf: v.asOf, recordedThrough: cutoff } : {}),
    evidence,
    coverage: {
      mode: semanticUsed ? "hybrid" : "lexical",
      records:
        v.scope === "workspace"
          ? v.asOf
            ? "historical-records-unavailable"
            : "current-lexical"
          : "outside-scope",
      semantic: semanticUsed
        ? "used"
        : v.asOf
          ? "historical-lexical-only"
          : "unavailable-or-no-matches",
      returned: evidence.length,
      permittedCandidates: channels.reduce((n, c) => n + c.length, 0),
      truncated:
        candidates.length > evidence.length ||
        evidence.some((e, i) => e.excerpt.length < selected[i].excerpt.length),
    },
    warnings: [
      ...(v.asOf
        ? [
            "Historical results reflect recorded state by the requested day; unknown effective dates remain unknown. Legacy records without review timestamps are excluded.",
          ]
        : []),
      ...(!evidence.length
        ? ["No permitted matching evidence. Do not invent an answer."]
        : []),
      ...(semanticUsed || v.asOf
        ? []
        : [
            "Semantic retrieval was unavailable or found no permitted matches; lexical results are shown.",
          ]),
    ],
  };
}

/** Resolve exact supplied identity, never a model-generated title or cached excerpt. */
export function knowledgeEvidence(s: Store, input: unknown, h: Host) {
  s.assertHost(h);
  const historical = z
    .object({ asOf: z.string().date().optional() })
    .passthrough()
    .parse(input);
  if (historical.asOf) {
    const { asOf, ...reference } = historical;
    if (reference.kind === "source") {
      const ref = z
        .object({
          kind: z.literal("source"),
          revisionId: z.string(),
          passageId: z.string(),
        })
        .strict()
        .parse(reference);
      const row = s.one(
        "SELECT p.text quote,p.location,r.created_at,r.metadata_snapshot,r.original_path,s.id sourceId,s.title,s.metadata FROM passages p JOIN revisions r ON r.id=p.revision_id JOIN sources s ON s.id=r.source_id WHERE p.id=? AND r.id=?",
        ref.passageId,
        ref.revisionId,
      );
      if (
        !row ||
        row.created_at > historyCutoff(s, h, asOf) ||
        !s.allowed({ id: row.sourceId, metadata: row.metadata }, h) ||
        !s.allowed({ id: row.sourceId, metadata: row.metadata_snapshot }, h)
      )
        throw Error("EVIDENCE_UNAVAILABLE");
      const metadata = JSON.parse(row.metadata_snapshot);
      return {
        ...ref,
        asOf,
        historical: true,
        quote: row.quote,
        location: row.location,
        sourceId: row.sourceId,
        title: row.title,
        metadata,
        authority: metadata.authority,
        effectiveDate: metadata.effectiveDate,
      };
    }

    const found = historicalEvidence(s, h, asOf).find(
      (e) =>
        JSON.stringify(
          Object.keys({ ...reference })
            .sort()
            .map((k) => [k, (reference as any)[k]]),
        ) ===
        JSON.stringify(
          Object.keys({ kind: e.kind, ...e.reference })
            .filter((k) => k !== "asOf")
            .sort()
            .map((k) => [k, ({ kind: e.kind, ...e.reference } as any)[k]]),
        ),
    );
    if (!found) throw Error("EVIDENCE_UNAVAILABLE");
    return {
      ...found.reference,
      kind: found.kind,
      ...found.data,
      quote: found.excerpt,
      historical: true,
      asOf,
    };
  }
  const ref = z
    .discriminatedUnion("kind", [
      recordReference,
      z
        .object({
          kind: z.literal("source"),
          revisionId: z.string(),
          passageId: z.string(),
        })
        .strict(),
      z
        .object({
          kind: z.literal("wiki"),
          pageId: z.string(),
          wikiRevisionId: z.string(),
          blockId: z.string(),
        })
        .strict(),
      z
        .object({
          kind: z.literal("memory"),
          memoryId: z.string(),
          memoryRevision: z.string(),
        })
        .strict(),
    ])
    .parse(input);
  if (ref.kind === "record") return resolveOperationalEvidence(s, ref, h);
  if (ref.kind === "source") {
    const p = s.one(
      "SELECT * FROM passages WHERE id=? AND revision_id=?",
      ref.passageId,
      ref.revisionId,
    );
    if (!p) throw Error("EVIDENCE_UNAVAILABLE");
    s.validateEvidence(
      [{ revisionId: ref.revisionId, passageId: ref.passageId, quote: p.text }],
      h,
      true,
    );
    const source = s.one(
      "SELECT s.*,r.original_path FROM sources s JOIN revisions r ON r.source_id=s.id WHERE r.id=?",
      ref.revisionId,
    );
    const metadata = JSON.parse(source.metadata);
    return {
      ...ref,
      sourceId: source.id,
      title: source.title,
      metadata,
      quote: p.text,
      location: p.location,
      originalPath: source.original_path,
      effectiveDate: metadata.effectiveDate,
      authority: metadata.authority,
      status: metadata.status,
      lastChecked: source.last_checked,
    };
  }
  if (ref.kind === "wiki") {
    const page = wikiDetail(s, ref.wikiRevisionId, h, true);
    const block =
      page.legacy && ref.blockId === "legacy"
        ? { text: page.content }
        : page.blocks?.find((b: any) => b.id === ref.blockId);
    if (
      page.pageId !== ref.pageId ||
      page.status !== "canonical" ||
      !page.evidenceCurrent ||
      !block ||
      ["question", "unverified"].includes(block.kind)
    )
      throw Error("EVIDENCE_UNAVAILABLE");
    return {
      ...ref,
      title: page.title,
      quote: block.text,
      subjects: page.subjects,
      provenance: block.kind,
      author: block.author ?? null,
      effectiveDate: page.effectiveDate,
      evidence: block.evidence ?? [],
    };
  }
  const m = eligibleMemories(s, h).find(
    (m) =>
      m.id === ref.memoryId && sha(JSON.stringify(m)) === ref.memoryRevision,
  );
  if (!m) throw Error("EVIDENCE_UNAVAILABLE");
  return {
    ...ref,
    quote: m.content,
    evidence: m.evidence,
    attribution: m.author ?? null,
  };
}
