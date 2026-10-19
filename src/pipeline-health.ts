import type { Store } from "./store.js";
import type { Host } from "./schema.js";
import { now, sha } from "./files.js";
import { LOCAL_MODEL } from "./local-model.js";
import { discoveryStatus } from "./conversation-artifacts.js";
export function definitionHealth(s: Store, id: string, at = Date.now()) {
  const r = s.one("SELECT * FROM automation_definitions WHERE id=?", id);
  if (!r) return { state: "unknown", nextExpected: null, lastSuccess: null };
  const d = JSON.parse(r.payload).definition,
    o = s.one(
      "SELECT payload FROM automation_schedule_observations WHERE definition_id=?",
      id,
    ),
    observation = o ? JSON.parse(o.payload) : null;
  const last = s.one(
      "SELECT * FROM automation_runs WHERE definition_id=? ORDER BY created_at DESC LIMIT 1",
      id,
    ),
    success = s.one(
      "SELECT updated_at FROM automation_runs WHERE definition_id=? AND state='completed' ORDER BY updated_at DESC LIMIT 1",
      id,
    );
  const period: any = {
    "quarter-hour": 900000,
    daily: 86400000,
    weekly: 604800000,
  };
  const graceMinutes = d.scheduler.graceMinutes ?? 30;
  const observed = observation?.nextRun
    ? Date.parse(observation.nextRun)
    : null;
  const expected =
    observed && (!success || observed > Date.parse(success.updated_at))
      ? observed
      : period[d.scheduler.cadence]
        ? Date.parse(success?.updated_at ?? r.updated_at) +
          period[d.scheduler.cadence]
        : null;
  const cp = last ? JSON.parse(last.checkpoint) : {};
  const budgetPaused = /BUDGET|PRICE|CONFIGURATION|DISCLOSURE/.test(
    cp.error ?? "",
  );
  const state =
    r.state !== "enabled"
      ? "paused"
      : d.scheduler.kind === "manual"
        ? "unknown"
        : last?.state === "uncertain"
          ? "failed"
          : budgetPaused
            ? "partial"
            : last && ["needs-attention", "failed"].includes(last.state)
              ? "failed"
              : expected && at > expected + graceMinutes * 60000
                ? "delayed"
                : success
                  ? "current"
                  : "unknown";
  return {
    state,
    lastSuccess: success?.updated_at ?? null,
    nextExpected: expected ? new Date(expected).toISOString() : null,
    graceMinutes,
    expectedBasis:
      observed && expected === observed
        ? "scheduler-observation"
        : "cadence-estimate",
    analysis: budgetPaused ? "paused" : d.discovery ? "enabled" : "not enabled",
    reason: cp.error ?? null,
    observer: observation?.state ?? "unknown",
  };
}
export function connectionFreshness(s: Store, c: any) {
  if (c.error) return "partial";
  if (c.state !== "active" && c.state !== "syncing") return "paused";
  const owner =
    s.schemaVersion >= 20
      ? s.one(
          "SELECT definition_id FROM automation_source_owners WHERE connection_id=?",
          c.id,
        )
      : null;
  // A timestamp without an expected check interval cannot prove ongoing coverage.
  if (!owner) return "unknown";
  const health = definitionHealth(s, owner.definition_id);
  if (health.analysis === "paused" && c.last_success) {
    const d = JSON.parse(
      s.one(
        "SELECT payload FROM automation_definitions WHERE id=?",
        owner.definition_id,
      ).payload,
    ).definition;
    const period: any = {
      "quarter-hour": 900000,
      daily: 86400000,
      weekly: 604800000,
    };
    return period[d.scheduler.cadence]
      ? Date.now() >
        Date.parse(c.last_success) +
          period[d.scheduler.cadence] +
          (d.scheduler.graceMinutes ?? 30) * 60000
        ? "delayed"
        : "current"
      : "unknown";
  }
  return health.state;
}
export function connectionCoverage(s: Store, h: Host) {
  s.assertHost(h);
  if (s.schemaVersion < 21) return [];
  return s
    .all("SELECT * FROM sync_connections WHERE host=?", h)
    .filter((c) =>
      s
        .all(
          "SELECT s.* FROM sync_items i JOIN sources s ON s.id=i.source_id WHERE i.connection_id=?",
          c.id,
        )
        .every((src) => s.allowed(src, h)),
    )
    .map((c) => ({
      id: c.id,
      label: JSON.parse(c.payload).label,
      state: connectionFreshness(s, c),
      lastSuccess: c.last_success,
      reason: c.error ? "Inspect connection failure" : null,
    }));
}
export function knowledgeHealth(s: Store, h: Host) {
  s.assertHost(h);
  s.assertSchema(21, "Pipeline health");
  return s.withReadPolicyCache(() => {
    const sources = s
      .all(
        "SELECT s.*,r.status extraction,r.created_at imported_at FROM sources s JOIN revisions r ON r.id=s.current_revision ORDER BY s.last_checked DESC,s.id",
      )
      .filter((r) => s.allowed(r, h));
    const jobsByRevision = new Map<string, any[]>();
    for (const row of s.all(
      "SELECT state,payload FROM ai_jobs WHERE json_extract(payload,'$.discovery')=1 ORDER BY updated_at DESC",
    )) {
      const job = { state: row.state, ...JSON.parse(row.payload) };
      for (const rev of job.revisionIds ?? [])
        jobsByRevision.set(rev, [...(jobsByRevision.get(rev) ?? []), job]);
    }
    const counts = new Map(
      s
        .all("SELECT revision_id,count(*) n FROM passages GROUP BY revision_id")
        .map((r) => [r.revision_id, r.n]),
    );
    const indexedCounts = new Map(
      s
        .all(
          "SELECT p.revision_id,count(DISTINCT f.passage_id) n FROM passage_search f JOIN passages p ON p.id=f.passage_id GROUP BY p.revision_id",
        )
        .map((r) => [r.revision_id, r.n]),
    );
    const artifactCounts = new Map(
      s
        .all(
          "SELECT source_revision,count(*) n FROM knowledge_artifacts GROUP BY source_revision",
        )
        .map((r) => [r.source_revision, r.n]),
    );
    const semanticEnabled =
      JSON.parse(
        s.one(
          "SELECT payload FROM knowledge_retrieval_config WHERE id='semantic'",
        )?.payload ?? "{}",
      ).enabled === true;
    const generation = s.one(
      "SELECT id FROM knowledge_index_generations WHERE state='active' AND model_fingerprint=? ORDER BY rowid DESC LIMIT 1",
      sha(JSON.stringify(LOCAL_MODEL)),
    );
    const semanticReferences = new Set(
      generation
        ? s
            .all(
              "SELECT payload FROM knowledge_search_units WHERE generation_id=?",
              generation.id,
            )
            .flatMap((r) => {
              const u = JSON.parse(r.payload);
              return u.reference?.revisionId
                ? [u.reference.revisionId + ":" + u.reference.passageId]
                : [];
            })
        : [],
    );
    const stages = sources.slice(0, 200).map((r) => {
      const total = counts.get(r.current_revision) ?? 0,
        indexed = indexedCounts.get(r.current_revision) ?? 0;
      const allJobs = jobsByRevision.get(r.current_revision) ?? [],
        latest = allJobs[0];
      const jobs = allJobs.filter(
        (j) => j.processorDigest === latest?.processorDigest,
      );
      const completed = new Set(
        jobs.filter((j) => j.state === "completed").map((j) => j.windowId),
      );
      const pending =
        latest?.revisionWindowCount == null
          ? null
          : Math.max(0, latest.revisionWindowCount - completed.size);
      const upstream =
        JSON.parse(
          s.one(
            "SELECT payload FROM session_exports WHERE revision_id=?",
            r.current_revision,
          )?.payload ?? "{}",
        ).coverage ?? "unknown";
      const artifacts = artifactCounts.get(r.current_revision) ?? 0;
      const semantic = !semanticEnabled
        ? "not enabled"
        : generation &&
            total &&
            s
              .all(
                "SELECT id FROM passages WHERE revision_id=?",
                r.current_revision,
              )
              .every((p) =>
                semanticReferences.has(r.current_revision + ":" + p.id),
              )
          ? "current"
          : "partial";
      return {
        sourceId: r.id,
        title: r.title,
        revisionId: r.current_revision,
        lastChecked: r.last_checked,
        importedAt: r.imported_at,
        extraction:
          r.extraction === "ready"
            ? "current"
            : r.extraction === "failed"
              ? "failed"
              : "partial",
        lexical: total && indexed === total ? "current" : "partial",
        semantic,
        enrichment: jobs.some((j) => ["uncertain", "failed"].includes(j.state))
          ? "failed"
          : jobs.some((j) => ["running", "queued"].includes(j.state))
            ? "partial"
            : pending === 0
              ? "current"
              : artifacts || jobs.length
                ? "partial"
                : "not enabled",
        pendingWindows: pending,
        upstreamCoverage: upstream,
        artifactCount: artifacts,
      };
    });
    return {
      checkedAt: now(),
      connections: connectionCoverage(s, h),
      sources: stages,
      totalPermittedSources: sources.length,
      truncated: sources.length > stages.length,
      discovery: discoveryStatus(s, h),
      limitations: [
        "Freshness records successful checks, not factual correctness.",
        "A stopped host cannot report its own outage; external monitoring must be verified separately.",
        "Processing completion applies to supplied windows; upstream completeness is reported separately. At most 200 source rows are shown.",
      ],
    };
  });
}
