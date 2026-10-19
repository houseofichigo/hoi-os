import { DISCOVERY_SQL } from "./discovery-schema.js";
import { z } from "zod";
import type { Store } from "./store.js";
import { type Host, evidence } from "./schema.js";
import { sha, now } from "./files.js";
import { RETRIEVAL_PROFILE, retrievalProfile } from "./retrieval-profile.js";
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
export const observationSchema = z
  .object({
    topic: z.string().trim().min(1).max(300),
    observations: z
      .array(
        claim
          .extend({
            kind: z.enum([
              "decision",
              "constraint",
              "preference",
              "problem-resolution",
              "proposed-action",
              "open-question",
            ]),
            questions: z.array(z.string().trim().min(1).max(300)).max(3),
          })
          .strict(),
      )
      .max(24),
  })
  .strict();
export const ARTIFACT_VERSION = "conversation-discovery-v1";
export const DISCOVERY_VERSION = "conversation-discovery-v2";
export function artifactClaims(a: any): any[] {
  return (
    a.observations ?? [
      ...a.summary,
      ...a.decisions,
      ...a.proposedActions,
      ...a.openQuestions,
    ]
  );
}
function visible(s: Store, h: Host, row: any) {
  const src = s.one(
    "SELECT s.* FROM sources s JOIN revisions r ON r.source_id=s.id WHERE r.id=?",
    row.source_revision,
  );
  return (
    src &&
    s.allowed(src, h) &&
    src.current_revision === row.source_revision &&
    artifactClaims(JSON.parse(row.payload)).every((c) =>
      s.evidenceVisible(c.evidence, h),
    )
  );
}
function validate(s: Store, h: Host, claims: any[], request: any) {
  s.assertHost(h);
  if (s.policy().actions.draft !== "allow") throw Error("POLICY_DENIED");
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
  return [...revisions][0] as string;
}
function persist(s: Store, revision: string, version: string, payload: any) {
  const id = "artifact_" + sha(revision + version),
    encoded = JSON.stringify(payload);
  const old = s.one("SELECT payload FROM knowledge_artifacts WHERE id=?", id);
  if (old && old.payload !== encoded) throw Error("ARTIFACT_VERSION_CONFLICT");
  s.tx(() => {
    s.exec(
      "INSERT OR IGNORE INTO knowledge_artifacts VALUES(?,?,?,?,?)",
      id,
      revision,
      version,
      encoded,
      now(),
    );
    if (s.schemaVersion >= 21)
      indexArtifact(s, { id, source_revision: revision, payload: encoded });
  });
  return { id };
}
export function saveConversationArtifact(
  s: Store,
  h: Host,
  input: unknown,
  request: any,
) {
  s.assertSchema(19, "Conversation artifacts");
  const v = artifactSchema.parse(input),
    revision = validate(s, h, artifactClaims(v), request);
  return persist(s, revision, ARTIFACT_VERSION, {
    ...v,
    state: "derived-unreviewed",
    coverage: "available supplied segments; upstream completeness not verified",
    instructionVersion: ARTIFACT_VERSION,
  });
}
export function saveObservations(
  s: Store,
  h: Host,
  input: unknown,
  request: any,
  window: { id: string; instructionDigest: string; coverage: string },
) {
  s.assertSchema(21, "Discovery observations");
  const v = observationSchema.parse(input),
    revision = validate(s, h, v.observations, request);
  const observations = v.observations.map((o, i) => ({
    ...o,
    id:
      "observation_" +
      sha(
        JSON.stringify([
          revision,
          o.kind,
          o.text.trim(),
          [...o.evidence].sort((a, b) =>
            JSON.stringify(a).localeCompare(JSON.stringify(b)),
          ),
        ]),
      ),
    attribution:
      "Statements recorded in the cited source; not independently verified",
    turnReferences: s
      .all("SELECT payload FROM session_exports WHERE revision_id=?", revision)
      .flatMap((row) =>
        JSON.parse(row.payload)
          .turns.filter((t: any) =>
            o.evidence.some(
              (e) => e.quote.includes(t.text) || t.text.includes(e.quote),
            ),
          )
          .map((t: any) => ({
            id: t.id,
            role: t.role,
            timestamp: t.timestamp,
          })),
      ),
  }));
  return persist(
    s,
    revision,
    `${DISCOVERY_VERSION}:${window.instructionDigest}:${window.id}`,
    {
      ...v,
      observations,
      state: "derived-unreviewed",
      coverage: window.coverage,
      windowId: window.id,
      instructionVersion: DISCOVERY_VERSION,
      instructionDigest: window.instructionDigest,
    },
  );
}
function indexArtifact(s: Store, row: any) {
  const a = JSON.parse(row.payload),
    src = s.one(
      "SELECT s.title FROM sources s JOIN revisions r ON r.source_id=s.id WHERE r.id=?",
      row.source_revision,
    );
  const units = artifactClaims(a).map((c, i) => ({
    ...c,
    id: row.id + ":" + i,
    questions: c.questions ?? [],
    provenance: a.observations ? "cited-observation" : "legacy-claim",
  }));
  // Old global questions have no claim mapping. Keep that limitation explicit.
  if (!a.observations && a.questions?.length)
    units.push({
      id: row.id + ":legacy",
      text: "",
      questions: a.questions,
      evidence: artifactClaims(a).flatMap((c) => c.evidence),
      provenance: "legacy-artifact-level",
    });
  s.exec(
    "DELETE FROM discovery_search WHERE unit_id IN (SELECT id FROM discovery_units WHERE artifact_id=?)",
    row.id,
  );
  s.exec("DELETE FROM discovery_units WHERE artifact_id=?", row.id);
  for (const u of units) {
    s.exec(
      "INSERT INTO discovery_units VALUES(?,?,?,?)",
      u.id,
      row.id,
      row.source_revision,
      JSON.stringify(u),
    );
    s.exec(
      "INSERT INTO discovery_search(title,context,questions,claim,unit_id) VALUES(?,?,?,?,?)",
      src?.title ?? "",
      a.topic,
      u.questions.join("\n"),
      u.text,
      u.id,
    );
  }
}
export function rebuildDiscovery(s: Store) {
  s.tx(() => {
    s.exec("DROP TABLE IF EXISTS discovery_search");
    s.db.exec(DISCOVERY_SQL);
    s.exec("DELETE FROM discovery_units");
    for (const row of s.all("SELECT * FROM knowledge_artifacts ORDER BY id"))
      indexArtifact(s, row);
  });
  return { indexed: s.one("SELECT count(*) n FROM discovery_units").n };
}
export function listArtifacts(s: Store, h: Host, input: unknown = {}) {
  s.assertHost(h);
  s.assertSchema(21, "Discovery");
  const v = z
    .object({
      sourceId: z.string().optional(),
      id: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(25),
    })
    .strict()
    .parse(input);
  const rows = s
    .all(
      "SELECT a.*,r.source_id FROM knowledge_artifacts a JOIN revisions r ON r.id=a.source_revision WHERE a.id>? ORDER BY a.id",
      v.cursor ?? "",
    )
    .filter(
      (row) =>
        (!v.sourceId || row.source_id === v.sourceId) &&
        (!v.id || row.id === v.id) &&
        visible(s, h, row),
    );
  const items = rows.slice(0, v.limit).map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    revisionId: row.source_revision,
    createdAt: row.created_at,
    ...JSON.parse(row.payload),
  }));
  if (v.id && !items.length) throw Error("ARTIFACT_UNAVAILABLE");
  return { items, nextCursor: rows.length > v.limit ? items.at(-1)?.id : null };
}
export function discoveryStatus(s: Store, h: Host) {
  s.assertHost(h);
  if (s.schemaVersion < 21) return { state: "upgrade-required", indexed: 0 };
  try {
    s.one("SELECT count(*) n FROM discovery_search");
  } catch {
    return {
      state: "failed",
      indexed: 0,
      reason: "Discovery index requires rebuild",
    };
  }
  let eligible = 0,
    indexed = 0;
  for (const row of s.all("SELECT * FROM knowledge_artifacts"))
    if (visible(s, h, row)) {
      eligible++;
      if (s.one("SELECT 1 FROM discovery_units WHERE artifact_id=?", row.id))
        indexed++;
    }
  return {
    state: eligible === indexed ? "ready" : "partial",
    eligible,
    indexed,
    pending: eligible - indexed,
  };
}
export function artifactEvidence(
  s: Store,
  h: Host,
  query: string,
  experimental = true,
) {
  if (s.schemaVersion < 21) return [];
  s.assertHost(h);
  const terms = [
    ...new Set(
      query
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .match(/[\p{L}\p{N}_-]+/gu) ?? [],
    ),
  ].slice(0, 64);
  if (!terms.length) return [];
  const match = terms.map((t) => '"' + t + '"').join(" OR "),
    result: any[] = [],
    seen = new Set<string>(),
    checked = new Map<string, boolean>();
  const profile = experimental ? RETRIEVAL_PROFILE : retrievalProfile(s);
  const sql = `SELECT u.payload unit,a.* FROM discovery_search f JOIN discovery_units u ON u.id=f.unit_id JOIN knowledge_artifacts a ON a.id=u.artifact_id WHERE discovery_search MATCH ? ORDER BY bm25(discovery_search,${profile.discoveryWeights.join(",")},0),u.id`;
  for (const row of s.db.prepare(sql).iterate(match) as any) {
    if (!checked.has(row.id)) checked.set(row.id, !!visible(s, h, row));
    if (!checked.get(row.id)) continue;
    const u = JSON.parse(row.unit);
    if (!experimental && u.provenance === "cited-observation") continue;
    for (const e of u.evidence) {
      const key = sha(
        e.quote
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .toLowerCase()
          .trim()
          .replace(/\s+/g, " "),
      );
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        kind: "source",
        revisionId: e.revisionId,
        passageId: e.passageId,
        discovery: {
          artifactId: row.id,
          unitId: u.id,
          instructionVersion: row.instruction_version,
          provenance: u.provenance,
          reason: "Ranked discovery matched; original passage supplied",
        },
      });
      if (result.length >= RETRIEVAL_PROFILE.channelLimit) return result;
    }
  }
  return result;
}

export function configureDiscovery(s: Store, h: Host, raw: unknown) {
  s.assertSchema(21, "Discovery profile");
  s.assertHost(h);
  if (h !== "local" || s.policy().actions.draft !== "allow")
    throw Error("LOCAL_CONFIGURATION_REQUIRED");
  const v = z
    .object({ enabled: z.boolean(), confirm: z.literal(true) })
    .strict()
    .parse(raw);
  s.exec(
    "INSERT INTO knowledge_retrieval_config VALUES('discovery',?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
    JSON.stringify({
      enabled: v.enabled,
      updatedAt: now(),
      quality: "independent-review-pending",
    }),
  );
  return {
    enabled: v.enabled,
    profile: retrievalProfile(s).version,
    quality: "Experimental profile; independent quality certification pending",
  };
}
