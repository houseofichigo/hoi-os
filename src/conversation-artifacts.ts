import { z } from "zod";
import { type Store } from "./store.js";
import { type Host, evidence } from "./schema.js";
import { sha, now } from "./files.js";
const claim = z
  .object({
    text: z.string().trim().min(1).max(1200),
    evidence: z.array(evidence).min(1).max(8),
  })
  .strict();
export const artifactSchema = z
  .object({
    topic: z.string().trim().min(1).max(300),
    questions: z.array(z.string().trim().min(1).max(300)).max(8),
    summary: z.array(claim).max(12),
    decisions: z.array(claim).max(12),
    proposedActions: z.array(claim).max(20),
    openQuestions: z.array(claim).max(12),
  })
  .strict();
export const ARTIFACT_VERSION = "conversation-discovery-v1";
/** Derived text is a discovery aid. Only its original passages enter factual context. */
export function saveConversationArtifact(
  s: Store,
  h: Host,
  input: unknown,
  request: any,
) {
  s.assertSchema(19, "Conversation artifacts");
  s.assertHost(h);
  if (s.policy().actions.draft !== "allow") throw Error("POLICY_DENIED");
  const v = artifactSchema.parse(input),
    claims = [
      ...v.summary,
      ...v.decisions,
      ...v.proposedActions,
      ...v.openQuestions,
    ];
  for (const c of claims)
    for (const e of c.evidence) {
      s.validateEvidence([e], h, true);
      if (
        !request.passages.some(
          (p: any) =>
            p.revisionId === e.revisionId &&
            p.passageId === e.passageId &&
            p.text.includes(e.quote),
        )
      )
        throw Error("ARTIFACT_EVIDENCE_NOT_SUPPLIED");
    }
  const revisions = new Set(request.passages.map((p: any) => p.revisionId));
  if (revisions.size !== 1) throw Error("ARTIFACT_REVISION_AMBIGUOUS");
  const revision = [...revisions][0] as string,
    id = "artifact_" + sha(revision + ARTIFACT_VERSION);
  const payload = {
    ...v,
    state: "derived-unreviewed",
    coverage: "available supplied segments; upstream completeness not verified",
    instructionVersion: ARTIFACT_VERSION,
  };
  const existing = s.one(
    "SELECT payload FROM knowledge_artifacts WHERE id=?",
    id,
  );
  if (existing) {
    if (existing.payload !== JSON.stringify(payload))
      throw Error("ARTIFACT_VERSION_CONFLICT");
    return { id };
  }
  s.exec(
    "INSERT INTO knowledge_artifacts VALUES(?,?,?,?,?)",
    id,
    revision,
    ARTIFACT_VERSION,
    JSON.stringify(payload),
    now(),
  );
  return { id };
}
export function artifactEvidence(s: Store, h: Host, query: string) {
  if (s.schemaVersion < 19) return [];
  const tokens = query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return s
    .all("SELECT * FROM knowledge_artifacts ORDER BY created_at DESC")
    .flatMap((row) => {
      const a = JSON.parse(row.payload),
        claims = [
          ...a.summary,
          ...a.decisions,
          ...a.proposedActions,
          ...a.openQuestions,
        ];
      // Entire artifact must still be visible; no partially redacted derived titles.
      if (!claims.every((c: any) => s.evidenceVisible(c.evidence, h)))
        return [];
      if (
        !tokens.some((t) => JSON.stringify(a).toLocaleLowerCase().includes(t))
      )
        return [];
      return claims.flatMap((c: any) =>
        c.evidence.map((e: any) => ({
          kind: "source",
          revisionId: e.revisionId,
          passageId: e.passageId,
        })),
      );
    })
    .slice(0, 50);
}
