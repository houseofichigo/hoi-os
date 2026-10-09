import { wikiDetail } from "./wiki-core.js";
import { z } from "zod";
import { Store } from "./store.js";
import { type Host, id } from "./schema.js";
import { sha, now, readNote } from "./files.js";
import { proposeWiki } from "./wiki.js";
import { capture } from "./knowledge.js";
function access(s: Store, h: Host, write = false) {
  s.assertSchema(5, "Knowledge maintenance");
  s.assertHost(h);
  if (write && s.policy().actions.draft === "deny")
    throw Error("Knowledge changes denied");
}
function objects(s: Store): any[] {
  return [
    ...s.all("SELECT * FROM wiki_pages").map((w) => ({
      id: w.id,
      kind: "wiki",
      title: w.title,
      content: readNote(s.path(w.content_path)).content,
      state: w.status,
      allowedHosts: JSON.parse(w.allowed_hosts),
      slug: w.slug,
      evidence: s.all(
        "SELECT revision_id revisionId,passage_id passageId,quote,relation FROM wiki_evidence WHERE page_id=?",
        w.id,
      ),
      snapshot: w,
    })),
    ...s.memories(true).map((m) => ({
      id: m.id,
      kind: "memory",
      title: m.content,
      content: m.content,
      state: m.state,
      allowedHosts: m.allowedHosts,
      evidence: m.evidence,
      snapshot: m,
    })),
  ];
}
function visible(s: Store, o: any, h: Host) {
  if (s.schemaVersion >= 15 && o.kind === "wiki") {
    try {
      wikiDetail(s, o.id, h);
    } catch {
      return false;
    }
  }
  return o.allowedHosts.includes(h) && s.evidenceVisible(o.evidence, h, false);
}
function digest(s: Store, o: any) {
  return sha(
    JSON.stringify({
      object: o,
      sources: o.evidence.map((e: any) =>
        s.one(
          "SELECT s.id,s.current_revision,s.metadata FROM sources s JOIN revisions r ON r.source_id=s.id WHERE r.id=?",
          e.revisionId,
        ),
      ),
    }),
  );
}
function findings(s: Store, h: Host) {
  const all = objects(s).filter(
    (o) =>
      s.knowledgeActive(o.id) &&
      visible(s, o, h) &&
      !["rejected", "superseded", "archived"].includes(o.state),
  );
  const out: any[] = [];
  function add(type: string, targets: any[], reason: string) {
    const fingerprint = sha(
      JSON.stringify({ type, targets: targets.map((o) => digest(s, o)) }),
    );
    out.push({
      id: `review_${fingerprint}`,
      fingerprint,
      type,
      targets,
      reason,
      explanation: reason,
      affectedRecords: targets.map((o) => ({ id: o.id, kind: o.kind })),
      evidence: targets.flatMap((o) => o.evidence),
      recommendedAction: type === "duplicate" ? "merge" : "verify",
    });
  }
  for (const o of all) {
    if (s.schemaVersion >= 15 && o.kind === "wiki") {
      const p = wikiDetail(s, o.id, h);
      if (p.reviewDate && p.reviewDate < now().slice(0, 10))
        add("review-due", [o], "The recorded verification date is due.");
      const stored = s.one(
        "SELECT payload FROM wiki_revision_data WHERE revision_id=?",
        o.id,
      );
      const related = stored
        ? (JSON.parse(stored.payload).relatedPages ?? [])
        : [];
      if (related.length > (p.relatedPages ?? []).length)
        add(
          "broken-link",
          [o],
          "A related page is unavailable; review the link without disclosing the hidden target.",
        );
    }
    if (!s.evidenceVisible(o.evidence, h, true))
      add("stale-evidence", [o], "A supporting source revision has changed.");
    if (o.evidence.some((e: any) => e.relation === "contradicts"))
      add(
        "contradiction",
        [o],
        "A source was explicitly recorded as contradicting this page.",
      );
    if (
      o.evidence.some((e: any) => {
        const row = s.one(
          "SELECT s.metadata FROM sources s JOIN revisions r ON r.source_id=s.id WHERE r.id=?",
          e.revisionId,
        );
        return row && JSON.parse(row.metadata).status === "superseded";
      })
    )
      add(
        "superseded-source",
        [o],
        "Supporting information is marked superseded; review any offering claims.",
      );
    if (
      o.kind === "memory" &&
      o.snapshot.validUntil &&
      o.snapshot.validUntil < now().slice(0, 10)
    )
      add("expired-memory", [o], `Memory expired on ${o.snapshot.validUntil}.`);
  }
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  for (let i = 0; i < all.length; i++)
    for (const b of all.slice(i + 1)) {
      const a = all[i];
      if (
        a.kind === b.kind &&
        (norm(a.content) === norm(b.content) ||
          (a.kind === "wiki" && a.slug === b.slug))
      )
        add(
          "duplicate",
          [a, b],
          "Matching content or wiki slug; semantic identity requires review.",
        );
    }
  return out;
}
function rowVisible(s: Store, row: any, h: Host) {
  const f = JSON.parse(row.payload);
  return (
    f.targets.every(
      (o: any) =>
        visible(s, o, h) &&
        objects(s).some(
          (current) => current.id === o.id && visible(s, current, h),
        ),
    ) &&
    (!row.decision ||
      !JSON.parse(row.decision).replacementId ||
      objects(s).some(
        (o) =>
          o.id === JSON.parse(row.decision).replacementId && visible(s, o, h),
      ))
  );
}
export function scanKnowledge(s: Store, h: Host) {
  access(s, h, true);
  return s.tx(() => {
    for (const f of findings(s, h))
      s.exec(
        "INSERT OR IGNORE INTO knowledge_reviews VALUES(?,?,?,?,?,?,?)",
        f.id,
        f.fingerprint,
        JSON.stringify(f),
        "pending",
        1,
        null,
        now(),
      );
    return listKnowledgeReviews(s, h);
  });
}
export function listKnowledgeReviews(s: Store, h: Host) {
  access(s, h);
  const current = new Set(findings(s, h).map((f) => f.fingerprint));
  return s
    .all("SELECT * FROM knowledge_reviews ORDER BY created_at,id")
    .filter((r) => rowVisible(s, r, h))
    .map((r) => ({
      id: r.id,
      version: r.version,
      state: r.state,
      current: current.has(r.fingerprint),
      ...JSON.parse(r.payload),
      decision: r.decision ? JSON.parse(r.decision) : null,
    }));
}
export function proposeKnowledge(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({
      kind: z.enum(["wiki", "memory"]),
      input: z.unknown(),
      effectiveDate: z.string().date().nullable().optional(),
    })
    .strict()
    .parse(input);
  if (
    !Array.isArray((v.input as any)?.evidence) ||
    !(v.input as any).evidence.length
  )
    throw Error("Cited proposal requires evidence");
  const result =
    v.kind === "wiki" ? proposeWiki(s, v.input, h) : capture(s, v.input, h);
  if (s.schemaVersion >= 11)
    s.exec(
      "INSERT INTO knowledge_dates VALUES(?,?,?,?)",
      result.id,
      v.effectiveDate || null,
      now(),
      h,
    );
  return {
    ...result,
    effectiveDate: v.effectiveDate || null,
    recordedAt: now(),
  };
}
const review = z
  .object({
    id,
    expectedVersion: z.number().int().positive(),
    action: z.enum([
      "keep",
      "reject",
      "archive",
      "update",
      "merge",
      "supersede",
    ]),
    targetId: id,
    replacementId: id.optional(),
    replacementDigest: z.string().optional(),
  })
  .strict();
export function replacementChoices(s: Store, h: Host) {
  access(s, h);
  return objects(s)
    .filter(
      (o) =>
        s.knowledgeActive(o.id) &&
        visible(s, o, h) &&
        ["reviewed", "canonical", "approved"].includes(o.state) &&
        s.evidenceVisible(o.evidence, h, true) &&
        o.evidence.length &&
        (!o.snapshot.validUntil ||
          o.snapshot.validUntil >= now().slice(0, 10)) &&
        (!o.snapshot.validFrom || o.snapshot.validFrom <= now().slice(0, 10)),
    )
    .map((o) => ({
      id: o.id,
      kind: o.kind,
      title: o.title,
      content: o.content,
      evidence: o.evidence,
      digest: digest(s, o),
    }));
}
export function reviewKnowledge(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = review.parse(input);
  return s.tx(() => {
    const row = s.one("SELECT * FROM knowledge_reviews WHERE id=?", v.id);
    if (!row || !rowVisible(s, row, h)) throw Error("Review unavailable");
    if (row.state !== "pending") {
      if (row.decision === JSON.stringify(v))
        return { id: row.id, state: "reviewed", reused: true };
      throw Error("STALE_VERSION: Already reviewed");
    }
    if (
      row.version !== v.expectedVersion ||
      !findings(s, h).some((f) => f.fingerprint === row.fingerprint)
    )
      throw Error("STALE_VERSION: Knowledge or evidence changed; scan again");
    const f = JSON.parse(row.payload),
      target = f.targets.find((o: any) => o.id === v.targetId);
    if (!target) throw Error("Target outside finding");
    if (["update", "merge", "supersede"].includes(v.action)) {
      const replacement = objects(s).find((o) => o.id === v.replacementId);
      if (
        !replacement ||
        replacement.id === target.id ||
        replacement.kind !== target.kind ||
        !visible(s, replacement, h) ||
        !s.knowledgeActive(replacement.id) ||
        !["reviewed", "canonical", "approved"].includes(replacement.state) ||
        !replacement.evidence.length ||
        (replacement.snapshot.validUntil &&
          replacement.snapshot.validUntil < now().slice(0, 10)) ||
        (replacement.snapshot.validFrom &&
          replacement.snapshot.validFrom > now().slice(0, 10))
      )
        throw Error(
          "A cited reviewed replacement of the same kind is required",
        );
      s.validateEvidence(replacement.evidence, h, true);
      if (digest(s, replacement) !== v.replacementDigest)
        throw Error("STALE_VERSION: Replacement changed");
      if (
        replacement.allowedHosts.some(
          (host: string) => !target.allowedHosts.includes(host),
        )
      )
        throw Error("Replacement cannot broaden host access");
    }
    if (!["keep", "reject"].includes(v.action))
      s.exec(
        "INSERT INTO knowledge_dispositions VALUES(?,?,?,?,?)",
        target.id,
        v.action,
        v.replacementId ?? null,
        row.id,
        now(),
      );
    s.exec(
      "UPDATE knowledge_reviews SET state='reviewed',version=version+1,decision=? WHERE id=?",
      JSON.stringify(v),
      row.id,
    );
    s.log("knowledge.reviewed", {
      id: row.id,
      targetId: target.id,
      action: v.action,
    });
    return { id: row.id, state: "reviewed" };
  });
}

export function knowledgeDates(s: Store, h: Host) {
  access(s, h);
  s.assertSchema(11, "Knowledge dates");
  return objects(s)
    .filter((o) => visible(s, o, h))
    .map((o) => ({
      id: o.id,
      kind: o.kind,
      state: o.state,
      ...(s.one(
        "SELECT effective_date effectiveDate,recorded_at recordedAt FROM knowledge_dates WHERE target_id=?",
        o.id,
      ) || { effectiveDate: null, recordedAt: null }),
    }));
}
