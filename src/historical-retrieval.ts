import { type Store } from "./store.js";
import { type Host } from "./schema.js";
import { type EvidenceItem } from "./retrieval.js";
import { memoryHistory } from "./reviewed-memory.js";
import { wikiDetail, wikiHistory } from "./wiki-core.js";
import { preferences } from "./daily-workspace.js";
import { wallInstant } from "./daily.js";
import { sha } from "./files.js";

export function historyCutoff(s: Store, h: Host, date: string) {
  const next = new Date(Date.parse(date + "T12:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
  const timezone = s.schemaVersion >= 12 ? preferences(s, h).timezone : "UTC";
  const cutoff = wallInstant(next, "00:00", timezone);
  if (cutoff === null) throw Error("HISTORICAL_DATE_UNAVAILABLE");
  return new Date(cutoff - 1).toISOString();
}
/** State recorded by end of the requested workspace day, with current access enforced. */
export function historicalEvidence(
  s: Store,
  h: Host,
  asOf: string,
): EvidenceItem[] {
  s.assertSchema(19, "Historical knowledge search");
  s.assertHost(h);
  const cutoff = historyCutoff(s, h, asOf),
    out: EvidenceItem[] = [];
  const applicable = (from?: string | null, until?: string | null) =>
    (!from || from <= asOf) && (!until || until >= asOf);
  const base = (
    kind: EvidenceItem["kind"],
    recordId: string,
    revision: string,
    title: string,
    text: string,
    data: any,
    reference: any,
    relatedRecords: string[],
    provenance: string,
    attribution: string | null,
    effectiveDate: string | null,
  ): EvidenceItem => ({
    kind,
    id: `${kind}:${revision}:${reference.passageId ?? reference.blockId ?? recordId}`,
    recordId,
    revision,
    title,
    excerpt: text,
    data: { ...data, historical: true, asOf },
    reference: { ...reference, asOf },
    relatedRecords,
    provenance,
    attribution,
    effectiveDate,
    supportingEvidence: data.evidence ?? [],
    score: 0,
    method: "lexical",
    reason: `Historical state recorded by ${cutoff}; effective date ${effectiveDate ?? "unknown"}`,
  });
  for (const source of s.all("SELECT * FROM sources")) {
    if (!s.allowed(source, h)) continue;
    const r = s.one(
      "SELECT * FROM revisions WHERE source_id=? AND created_at<=? ORDER BY created_at DESC,rowid DESC LIMIT 1",
      source.id,
      cutoff,
    );
    if (!r) continue;
    const m = JSON.parse(r.metadata_snapshot);
    if (
      !s.allowed({ id: source.id, metadata: m }, h) ||
      m.status === "superseded" ||
      !applicable(m.effectiveDate)
    )
      continue;
    for (const p of s.all("SELECT * FROM passages WHERE revision_id=?", r.id))
      out.push(
        base(
          "source",
          source.id,
          r.id,
          source.title,
          p.text,
          {
            sourceId: source.id,
            revisionId: r.id,
            passageId: p.id,
            title: source.title,
            quote: p.text,
            location: p.location,
            originalPath: r.original_path,
            authority: m.authority,
            status: m.status,
            effectiveDate: m.effectiveDate,
            metadata: m,
          },
          { revisionId: r.id, passageId: p.id },
          [m.project, m.client, ...(m.entities ?? [])].filter(Boolean),
          "source-backed",
          m.owner ?? null,
          m.effectiveDate ?? null,
        ),
      );
  }
  for (const identity of s.all("SELECT id FROM wiki_identities")) {
    try {
      // A historical snapshot cannot bypass a revoked current page ACL.
      wikiDetail(s, identity.id, h, true);
      const page = wikiHistory(s, identity.id, h)
        .filter(
          (p) =>
            p.reviewedAt &&
            p.reviewedAt <= cutoff &&
            ["canonical", "superseded"].includes(p.status),
        )
        .sort(
          (a, b) =>
            b.reviewedAt.localeCompare(a.reviewedAt) ||
            b.createdAt.localeCompare(a.createdAt),
        )[0];
      if (!page || !applicable(page.effectiveDate)) continue;
      const blocks = page.legacy
        ? [
            {
              id: "legacy",
              text: page.content,
              kind: "source-backed",
              evidence: page.evidence,
            },
          ]
        : page.blocks;
      for (const b of blocks) {
        if (["question", "unverified"].includes(b.kind)) continue;
        out.push(
          base(
            "wiki",
            page.pageId,
            page.id,
            page.title,
            b.text,
            {
              pageId: page.pageId,
              wikiRevisionId: page.id,
              blockId: b.id,
              title: page.title,
              quote: b.text,
              provenance: b.kind,
              author: b.author ?? null,
              evidence: b.evidence ?? [],
              effectiveDate: page.effectiveDate,
            },
            { pageId: page.pageId, wikiRevisionId: page.id, blockId: b.id },
            page.subjects ?? [],
            b.kind,
            b.author ?? null,
            page.effectiveDate ?? null,
          ),
        );
      }
    } catch {
      /* Whole-page permission failure excludes titles and counts. */
    }
  }
  const memories: any[] = [];
  for (const current of s.memories(true)) {
    try {
      const m = memoryHistory(s, current.id, h)
        .revisions.filter((m) => (m.updatedAt ?? m.createdAt) <= cutoff)
        .sort((a, b) => b.version - a.version)[0];
      if (
        m?.state === "approved" &&
        m.reviewedAt &&
        m.reviewedAt <= cutoff &&
        applicable(m.validFrom, m.validUntil)
      )
        memories.push(m);
    } catch {
      /* Current and historical permissions are both required. */
    }
  }
  const replaced = new Set(memories.map((m) => m.supersedes));
  for (const m of memories) {
    if (replaced.has(m.id)) continue;
    const { checksum, ...record } = m,
      revision = sha(JSON.stringify(record));
    out.push(
      base(
        "memory",
        m.id,
        revision,
        `${m.type} memory`,
        m.content,
        { ...record, memoryRevision: revision },
        { memoryId: m.id, memoryRevision: revision },
        m.entities ?? [],
        m.evidence.length
          ? "source-backed"
          : m.author
            ? "attributed-memory"
            : "legacy-reviewed-memory",
        m.author ?? null,
        m.validFrom ?? null,
      ),
    );
  }
  return out;
}
