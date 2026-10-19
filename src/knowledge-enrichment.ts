import { z } from "zod";
import type { Store } from "./store.js";
import type { Host } from "./schema.js";
import { now, sha } from "./files.js";
import { discoveryWindows, runAutomationReview } from "./automation-review.js";
import { DISCOVERY_VERSION } from "./conversation-artifacts.js";
const input = z
  .object({
    revisionIds: z.array(z.string()).min(1).max(100),
    provider: z.enum(["openai", "anthropic"]),
    maxCost: z.number().positive().max(0.25).default(0.25),
  })
  .strict();
const running = new Map<
  string,
  { controller: AbortController; promise: Promise<void> }
>();
const key = (s: Store, id: string) => s.root + ":" + id;
function access(s: Store, h: Host, revisionIds: string[], provider?: string) {
  s.assertSchema(21, "Knowledge enrichment");
  s.assertHost(h);
  if (!["local", "codex", "claude"].includes(h))
    throw Error("HOST_UNAVAILABLE");
  for (const rev of revisionIds) {
    const src = s.one(
      "SELECT s.* FROM sources s JOIN revisions r ON r.source_id=s.id WHERE r.id=?",
      rev,
    );
    if (!src || !s.allowed(src, h) || src.current_revision !== rev)
      throw Error("SOURCE_UNAVAILABLE");
    if (
      provider &&
      !s.one(
        "SELECT 1 FROM ai_disclosures WHERE source_id=? AND provider=?",
        src.id,
        provider,
      )
    )
      throw Error("PROVIDER_SOURCE_DISCLOSURE_REQUIRED");
  }
}
export function previewEnrichment(s: Store, raw: unknown, h: Host) {
  const v = input.parse(raw);
  access(s, h, v.revisionIds);
  const provider = s.one(
      "SELECT * FROM ai_providers WHERE provider=?",
      v.provider,
    ),
    config = provider ? JSON.parse(provider.payload) : null;
  const windows = discoveryWindows(s, v.revisionIds),
    prerequisites: string[] = [];
  if (!config) prerequisites.push("AI_CONFIGURATION_REQUIRED");
  if (config && !config.allowWorkspaceContext)
    prerequisites.push("WORKSPACE_CONTEXT_DISCLOSURE_REQUIRED");
  if (
    config &&
    (!config.pricingDate ||
      Date.now() - Date.parse(config.pricingDate) > 31 * 86400000)
  )
    prerequisites.push("AI_PRICE_UNAVAILABLE");
  try {
    access(s, h, v.revisionIds, v.provider);
  } catch {
    prerequisites.push("PROVIDER_SOURCE_DISCLOSURE_REQUIRED");
  }
  const binding = {
    input: v,
    providerVersion: provider?.version ?? null,
    processor: DISCOVERY_VERSION,
    windows: windows.map((w) => w.id),
  };
  return {
    ...binding,
    digest: sha(JSON.stringify(binding)),
    windowCount: windows.length,
    prerequisites,
    budget: { perRun: v.maxCost, automaticMonthly: 25 },
    estimate:
      config && windows[0]
        ? (Buffer.byteLength(JSON.stringify(windows[0])) *
            config.inputPerMillion +
            2048 * config.outputPerMillion) /
          1e6
        : null,
    coverage:
      "One bounded window per invocation; remaining windows persist as pending. Estimate excludes fixed instruction overhead; dispatch reserves the full prompt estimate.",
    disclosure: "No data is sent by preview",
  };
}
export function enrichmentStatus(s: Store, id: string, h: Host) {
  s.assertHost(h);
  const r = s.one(
    "SELECT * FROM knowledge_enrichment_requests WHERE request_key=? AND host=?",
    id,
    h,
  );
  if (!r) throw Error("ENRICHMENT_UNAVAILABLE");
  const p = JSON.parse(r.payload);
  access(s, h, p.revisionIds);
  return {
    requestKey: id,
    state: r.state,
    ...(r.result ? JSON.parse(r.result) : {}),
    notice:
      r.state === "uncertain"
        ? "Reconcile the paid outcome before retrying"
        : undefined,
  };
}
export function startEnrichment(
  s: Store,
  raw: unknown,
  h: Host,
  dependencies: Parameters<typeof runAutomationReview>[4] = {},
) {
  const v = input
    .extend({
      requestKey: z.string().regex(/^[a-zA-Z0-9:_-]{8,180}$/),
      previewDigest: z.string().length(64),
    })
    .parse(raw);
  const { requestKey, previewDigest, ...options } = v,
    digest = sha(JSON.stringify(v));
  access(s, h, v.revisionIds, v.provider);
  if (s.policy().actions.draft !== "allow") throw Error("POLICY_DENIED");
  const old = s.one(
    "SELECT * FROM knowledge_enrichment_requests WHERE request_key=?",
    requestKey,
  );
  if (old) {
    if (old.host !== h || old.digest !== digest)
      throw Error("IDEMPOTENCY_CONFLICT");
    return enrichmentStatus(s, requestKey, h);
  }
  const preview = previewEnrichment(s, options, h);
  if (preview.digest !== previewDigest) throw Error("ENRICHMENT_PREVIEW_STALE");
  if (preview.prerequisites.length) throw Error(preview.prerequisites[0]);
  if (
    s.one(
      "SELECT 1 FROM knowledge_enrichment_requests WHERE state='running'",
    ) ||
    s.one("SELECT 1 FROM automation_runs WHERE state='running'")
  )
    throw Error("WORKSPACE_JOB_RUNNING");
  s.exec(
    "INSERT INTO knowledge_enrichment_requests VALUES(?,?,?,?,?,NULL,?)",
    requestKey,
    h,
    digest,
    JSON.stringify(options),
    "running",
    now(),
  );
  const controller = new AbortController();
  const recheck = () => {
    access(s, h, v.revisionIds, v.provider);
    if (controller.signal.aborted || s.policy().actions.draft !== "allow")
      throw Error("AI_CANCELLED");
    if (
      s.one("SELECT version FROM ai_providers WHERE provider=?", v.provider)
        ?.version !== preview.providerVersion
    )
      throw Error("AI_CONFIGURATION_CHANGED");
  };
  const promise = Promise.resolve().then(async () => {
    try {
      const result = await runAutomationReview(
        s,
        {
          definitionId:
            "enrichment:" +
            sha(JSON.stringify([h, options.revisionIds, options.provider])),
          runId: "enrichment:" + requestKey,
          definition: {
            label: "Selected knowledge enrichment",
            scope: { kind: "sources", sourceIds: [] },
            accessHost: h as "local" | "codex" | "claude",
            recipe: "assisted-review",
            discovery: true,
            objective:
              "Extract supported observations for discovery. Propose findings only; never approve facts or actions.",
            maxItems: 100,
            futureRevisions: false,
            importBacklog: false,
            analyzeBacklog: true,
            discloseFutureSources: false,
            provider: v.provider,
            maxCost: v.maxCost,
            scheduler: { kind: "manual", cadence: "manual", timezone: "UTC" },
          },
          pins: [],
          providerPin: { version: preview.providerVersion },
          revisionIds: v.revisionIds,
        },
        controller.signal,
        recheck,
        dependencies,
      );
      recheck();
      s.exec(
        "UPDATE knowledge_enrichment_requests SET state='completed',result=? WHERE request_key=?",
        JSON.stringify(result),
        requestKey,
      );
    } catch (e) {
      const uncertain = s.one(
        "SELECT 1 FROM ai_jobs WHERE json_extract(payload,'$.automationRunId')=? AND state='uncertain'",
        "enrichment:" + requestKey,
      );
      const code =
        /^(AI_[A-Z_]+|PROVIDER_[A-Z_]+|SOURCE_[A-Z_]+|AUTOMATION_[A-Z_]+)/.exec(
          e instanceof Error ? e.message : "",
        )?.[0] ?? "ENRICHMENT_REVIEW_REQUIRED";
      s.exec(
        "UPDATE knowledge_enrichment_requests SET state=?,result=? WHERE request_key=?",
        uncertain
          ? "uncertain"
          : controller.signal.aborted
            ? "cancelled"
            : "needs-attention",
        JSON.stringify({ error: code }),
        requestKey,
      );
    } finally {
      running.delete(key(s, requestKey));
    }
  });
  running.set(key(s, requestKey), { controller, promise });
  return enrichmentStatus(s, requestKey, h);
}
export function cancelEnrichment(s: Store, id: string, h: Host) {
  const status = enrichmentStatus(s, id, h);
  running.get(key(s, id))?.controller.abort();
  return {
    ...status,
    notice:
      "Cancellation requested; an already-dispatched external request may still complete.",
  };
}
export async function waitEnrichment(s: Store) {
  await Promise.all(
    [...running]
      .filter(([k]) => k.startsWith(s.root + ":"))
      .map(([, v]) => v.promise),
  );
}
export async function stopEnrichment(s: Store) {
  for (const [k, v] of running)
    if (k.startsWith(s.root + ":")) v.controller.abort();
  await waitEnrichment(s);
}
export function recoverEnrichment(s: Store) {
  if (s.schemaVersion >= 21)
    s.exec(
      "UPDATE knowledge_enrichment_requests SET state='uncertain',result=? WHERE state='running'",
      JSON.stringify({ error: "AI_RECONCILIATION_REQUIRED" }),
    );
}
