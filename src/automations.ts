import { definitionHealth } from "./pipeline-health.js";
import { z } from "zod";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Store } from "./store.js";
import type { Host } from "./schema.js";
import { sha, now, uid } from "./files.js";
import { skillDetail } from "./skill-library.js";
import { connections, syncConnection } from "./sync.js";
import { scanKnowledge } from "./maintenance.js";
import { importSnapshot, snapshotInput } from "./external-snapshots.js";
import { runAutomationReview } from "./automation-review.js";
import { automaticBudgetStatus } from "./ai.js";

const ident = z.string().trim().min(1).max(180);
const scopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("connection"), connectionId: ident }).strict(),
  z
    .object({
      kind: z.literal("sources"),
      sourceIds: z.array(ident).min(1).max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal("export"),
      namespace: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
      account: ident,
      scope: ident,
      contentTypes: z
        .array(z.enum(["document", "email", "transcript", "event"]))
        .min(1)
        .max(4),
    })
    .strict(),
]);
export const definitionInput = z
  .object({
    label: z.string().trim().min(1).max(100),
    scope: scopeSchema,
    accessHost: z.enum(["local", "codex", "claude"]).default("local"),
    recipe: z.enum([
      "knowledge-health",
      "intake-health",
      "assisted-review",
      "intake-review",
    ]),
    discovery: z.boolean().optional(),
    objective: z.string().trim().min(1).max(1000),
    maxItems: z.number().int().min(1).max(100).default(25),
    futureRevisions: z.boolean(),
    importBacklog: z.boolean().default(false),
    analyzeBacklog: z.boolean().default(false),
    discloseFutureSources: z.boolean().default(false),
    provider: z.enum(["openai", "anthropic"]).optional(),
    maxCost: z.number().positive().max(0.25).default(0.25),
    scheduler: z
      .object({
        kind: z.enum(["manual", "codex", "n8n"]),
        timezone: z.string().refine((t) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: t });
            return true;
          } catch {
            return false;
          }
        }),
        graceMinutes: z.number().int().min(1).max(1440).optional(),
        cadence: z
          .enum(["manual", "quarter-hour", "daily", "weekly"])
          .default("manual"),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.discovery && !v.recipe.includes("review"))
      c.addIssue({
        code: "custom",
        message: "Discovery requires an assisted review recipe",
      });
    if (v.recipe.startsWith("intake") && v.scope.kind === "sources")
      c.addIssue({
        code: "custom",
        message: "Intake requires a connection or export namespace",
      });
    if (v.recipe.includes("review") && !v.provider)
      c.addIssue({ code: "custom", message: "Select the provider explicitly" });
    if (
      v.discloseFutureSources &&
      (!v.recipe.includes("review") ||
        !v.recipe.startsWith("intake") ||
        !v.futureRevisions)
    )
      c.addIssue({
        code: "custom",
        message:
          "Future disclosure requires reviewed intake, an explicit provider and future revisions",
      });
    if (v.scheduler.kind === "manual" && v.scheduler.cadence !== "manual")
      c.addIssue({ code: "custom", message: "Manual mode has no cadence" });
    if (v.scheduler.kind !== "manual" && v.scheduler.cadence === "manual")
      c.addIssue({
        code: "custom",
        message: "Select the cadence for the external schedule",
      });
  });
export type AutomationDefinition = z.infer<typeof definitionInput>;
const saveInput = z
  .object({
    id: ident.optional(),
    expectedVersion: z.number().int().nonnegative(),
    definition: definitionInput,
    previewDigest: z.string().length(64),
  })
  .strict();
const controlInput = z
  .object({
    id: ident,
    expectedVersion: z.number().int().positive(),
    digest: z.string().length(64).optional(),
    confirm: z.literal(true),
  })
  .strict();
export const runInput = z
  .object({
    id: ident,
    triggerId: z.string().regex(/^[a-zA-Z0-9:_-]{8,160}$/),
    snapshot: snapshotInput.optional(),
  })
  .strict();
const work = new Map<string, Promise<void>>();
const controllers = new Map<string, AbortController>();
const runtimeKey = (s: Store, id: string) => `${s.root}:${id}`;
function access(s: Store, h: Host, owner = false) {
  s.assertSchema(20, "Governed automation");
  s.assertHost(h);
  if (owner && h !== "local") throw Error("AUTOMATION_OWNER_REQUIRED");
  if (owner && s.policy().actions.draft !== "allow")
    throw Error("AUTOMATION_DRAFT_DENIED");
}
function row(s: Store, id: string) {
  const r = s.one("SELECT * FROM automation_definitions WHERE id=?", id);
  if (!r) throw Error("AUTOMATION_UNAVAILABLE");
  return { ...r, payload: JSON.parse(r.payload) };
}
function sourceIds(s: Store, d: AutomationDefinition) {
  if (d.scope.kind === "sources") return d.scope.sourceIds;
  if (d.scope.kind === "connection")
    return s
      .all(
        "SELECT source_id FROM sync_items WHERE connection_id=? AND source_id IS NOT NULL",
        d.scope.connectionId,
      )
      .map((x) => x.source_id);
  return s
    .all(
      `SELECT DISTINCT a.source_id FROM automation_snapshots a JOIN sources s ON s.id=a.source_id AND s.current_revision=a.revision_id WHERE namespace=? AND account=? AND scope=? AND content_type IN (${d.scope.contentTypes.map(() => "?").join(",")})`,
      d.scope.namespace,
      d.scope.account,
      d.scope.scope,
      ...d.scope.contentTypes,
    )
    .map((x) => x.source_id);
}
function permittedSources(s: Store, d: AutomationDefinition, h: Host) {
  s.assertHost(h);
  return [...new Set<string>(sourceIds(s, d))]
    .map((id) => s.one("SELECT * FROM sources WHERE id=?", id))
    .filter((x) => x && s.allowed(x, h));
}
function assertScope(s: Store, d: AutomationDefinition) {
  s.assertHost(d.accessHost);
  if (s.policy().actions.draft !== "allow")
    throw Error("AUTOMATION_DRAFT_DENIED");
  if (
    d.scope.kind === "sources" &&
    permittedSources(s, d, d.accessHost).length !==
      new Set(d.scope.sourceIds).size
  )
    throw Error("AUTOMATION_SOURCE_UNAVAILABLE");
  if (d.scope.kind === "connection") {
    const c = connections(s, d.accessHost).find(
      (c) => c.id === (d.scope as any).connectionId,
    );
    if (!c || !["active", "syncing"].includes(c.state))
      throw Error("AUTOMATION_CONNECTION_NOT_ACTIVE");
    if (c.maxItems > d.maxItems)
      throw Error(
        "AUTOMATION_SCOPE_LIMIT: Connection maxItems exceeds this definition; review a smaller connection first",
      );
  }
}
function pins(s: Store, d: AutomationDefinition) {
  return [
    ...(d.recipe.startsWith("intake") ? ["hoi-ingest"] : []),
    "hoi-knowledge-review",
  ].map((name) => {
    const detail = skillDetail(s, name, d.accessHost),
      a = detail.active;
    if (!detail.enabled || !a?.compatible)
      throw Error("AUTOMATION_SKILL_UNAVAILABLE");
    return { skillId: name, revisionId: a.revisionId, checksum: a.checksum };
  });
}
function providerPin(s: Store, d: AutomationDefinition) {
  if (!d.provider) return null;
  const r = s.one(
    "SELECT payload,version FROM ai_providers WHERE provider=?",
    d.provider,
  );
  if (!r) return null;
  const { verification, ...config } = JSON.parse(r.payload);
  return {
    provider: d.provider,
    version: r.version,
    model: config.model,
    digest: sha(JSON.stringify(config)),
  };
}
function scopePin(s: Store, d: AutomationDefinition) {
  if (d.scope.kind !== "connection") return sha(JSON.stringify(d.scope));
  const r = s.one(
    "SELECT payload FROM sync_connections WHERE id=?",
    d.scope.connectionId,
  );
  return sha(r?.payload ?? "");
}
export function previewAutomation(s: Store, raw: unknown, h: Host) {
  access(s, h, true);
  const d = definitionInput.parse(raw);
  assertScope(s, d);
  const binding = {
    definition: d,
    skills: pins(s, d),
    scopeDigest: scopePin(s, d),
    provider: providerPin(s, d),
  };
  const sources = permittedSources(s, d, d.accessHost);
  const connection =
    d.scope.kind === "connection"
      ? s.one(
          "SELECT preview FROM sync_connections WHERE id=?",
          d.scope.connectionId,
        )
      : null;
  const backlog = connection?.preview
    ? JSON.parse(connection.preview).items.length
    : sources.length;
  return {
    ...binding,
    digest: sha(JSON.stringify(binding)),
    backlog: {
      recordedSources: sources.length,
      previewItems: backlog,
      import: d.importBacklog,
      analysis: d.analyzeBacklog,
    },
    permissions: [
      "import-scoped-originals",
      "write-review-findings",
      ...(d.provider ? ["propose-cited-content"] : []),
    ],
    prerequisites: [
      ...(d.provider && !binding.provider ? ["AI_CONFIGURATION_REQUIRED"] : []),
      ...(d.scheduler.kind !== "manual"
        ? ["EXTERNAL_SCHEDULE_NOT_VERIFIED"]
        : []),
    ],
    budget: { perRun: d.maxCost, automaticMonthly: 25 },
    steps: [
      ...(d.recipe.startsWith("intake") ? ["intake"] : []),
      "knowledge-health",
      ...(d.recipe.includes("review") ? ["assisted-review"] : []),
    ],
  };
}
export function saveAutomation(s: Store, raw: unknown, h: Host) {
  access(s, h, true);
  const v = saveInput.parse(raw),
    preview = previewAutomation(s, v.definition, h);
  if (preview.digest !== v.previewDigest)
    throw Error("AUTOMATION_PREVIEW_STALE");
  const previous = v.id ? row(s, v.id) : null;
  if ((previous?.version ?? 0) !== v.expectedVersion)
    throw Error("STALE_VERSION");
  if (
    previous &&
    s.one(
      "SELECT 1 FROM automation_runs WHERE definition_id=? AND state='running'",
      previous.id,
    )
  )
    throw Error("AUTOMATION_BUSY: Pause and wait before editing");
  const id = v.id ?? uid("automation"),
    version = v.expectedVersion + 1;
  s.tx(() => {
    // Keep the scheduling ownership while disabled: polling must not silently resume.
    s.exec(
      "INSERT INTO automation_definitions VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,state=excluded.state,payload=excluded.payload,approval_digest=NULL,updated_at=excluded.updated_at",
      id,
      version,
      "disabled",
      h,
      JSON.stringify({
        definition: preview.definition,
        skills: preview.skills,
        scopeDigest: preview.scopeDigest,
        provider: preview.provider,
      }),
      null,
      now(),
      now(),
    );
    s.exec("UPDATE automation_grants SET revoked=1 WHERE definition_id=?", id);
    event(s, id, null, "saved-disabled");
  });
  return automationStatus(s, h, id);
}
export function releaseAutomationConnection(s: Store, raw: unknown, h: Host) {
  access(s, h, true);
  const v = controlInput.parse(raw),
    r = row(s, v.id);
  if (
    r.version !== v.expectedVersion ||
    r.state === "enabled" ||
    s.one(
      "SELECT 1 FROM automation_runs WHERE definition_id=? AND state='running'",
      r.id,
    )
  )
    throw Error("AUTOMATION_PAUSE_REQUIRED");
  s.tx(() => {
    for (const owner of s.all(
      "SELECT connection_id FROM automation_source_owners WHERE definition_id=?",
      r.id,
    ))
      s.exec(
        "UPDATE sync_connections SET state='paused',version=version+1 WHERE id=?",
        owner.connection_id,
      );
    s.exec("DELETE FROM automation_source_owners WHERE definition_id=?", r.id);
  });
  return {
    id: r.id,
    state: "paused",
    notice:
      "Connections remain paused. Preview and activate explicitly to restore built-in polling.",
  };
}
function event(s: Store, id: string, runId: string | null, kind: string) {
  s.exec(
    "INSERT INTO automation_events VALUES(?,?,?,?,?)",
    uid("automation_event"),
    id,
    runId,
    kind,
    now(),
  );
}
function checkBinding(s: Store, r: any) {
  const d: AutomationDefinition = r.payload.definition;
  assertScope(s, d);
  if (
    JSON.stringify(pins(s, d)) !== JSON.stringify(r.payload.skills) ||
    scopePin(s, d) !== r.payload.scopeDigest ||
    JSON.stringify(providerPin(s, d)) !== JSON.stringify(r.payload.provider)
  )
    throw Error(
      "AUTOMATION_REVIEW_REQUIRED: Scope, provider or instructions changed",
    );
}
export function enableAutomation(s: Store, raw: unknown, h: Host) {
  access(s, h, true);
  const v = controlInput.parse(raw),
    r = row(s, v.id);
  if (r.version !== v.expectedVersion) throw Error("STALE_VERSION");
  const p = previewAutomation(s, r.payload.definition, h);
  if (v.digest !== p.digest) throw Error("AUTOMATION_PREVIEW_STALE");
  checkBinding(s, r);
  const d: AutomationDefinition = r.payload.definition;
  const existing = permittedSources(s, d, d.accessHost).map(
    (x) => x.current_revision,
  );
  const preview =
    d.scope.kind === "connection"
      ? s.one(
          "SELECT preview FROM sync_connections WHERE id=?",
          d.scope.connectionId,
        )?.preview
      : null;
  s.tx(() => {
    if (d.scope.kind === "connection") {
      const owner = s.one(
        "SELECT definition_id FROM automation_source_owners WHERE connection_id=?",
        d.scope.connectionId,
      );
      if (owner && owner.definition_id !== r.id)
        throw Error("AUTOMATION_CONNECTION_ALREADY_OWNED");
      s.exec(
        "INSERT OR IGNORE INTO automation_source_owners VALUES(?,?)",
        d.scope.connectionId,
        r.id,
      );
    }
    const payload = {
      ...r.payload,
      enabledAt: now(),
      baselineRevisions: existing,
      baselineItems: preview ? JSON.parse(preview).items : [],
    };
    s.exec(
      "UPDATE automation_definitions SET state='enabled',version=version+1,approval_digest=?,payload=?,updated_at=? WHERE id=?",
      p.digest,
      JSON.stringify(payload),
      now(),
      r.id,
    );
    s.exec(
      "UPDATE automation_grants SET revoked=1 WHERE definition_id=?",
      r.id,
    );
    event(s, r.id, null, "enabled");
  });
  return automationStatus(s, h, r.id);
}
export function pauseAutomation(s: Store, raw: unknown, h: Host) {
  access(s, h, true);
  const v = controlInput.parse(raw),
    r = row(s, v.id);
  if (r.version !== v.expectedVersion) throw Error("STALE_VERSION");
  s.tx(() => {
    s.exec(
      "UPDATE automation_definitions SET state='paused',version=version+1,updated_at=? WHERE id=?",
      now(),
      r.id,
    );
    s.exec(
      "UPDATE automation_grants SET revoked=1 WHERE definition_id=?",
      r.id,
    );
    event(s, r.id, null, "paused");
  });
  for (const run of s.all(
    "SELECT id FROM automation_runs WHERE definition_id=? AND state='running'",
    r.id,
  ))
    controllers.get(runtimeKey(s, run.id))?.abort();
  return {
    ...automationStatus(s, h, r.id),
    notice:
      "Engine execution is paused. Verify external schedule pause separately. A dispatched provider request may still complete.",
  };
}
export function automationCredential(s: Store, raw: unknown, h: Host) {
  access(s, h, true);
  const v = controlInput
      .extend({ access: z.enum(["trigger", "status"]).default("trigger") })
      .parse(raw),
    r = row(s, v.id);
  if (r.version !== v.expectedVersion || r.state !== "enabled")
    throw Error("AUTOMATION_NOT_ENABLED_OR_STALE");
  const token = randomBytes(32).toString("hex");
  s.tx(() => {
    s.exec(
      "UPDATE automation_grants SET revoked=1 WHERE definition_id=? AND ((id LIKE 'monitorgrant_%')=?)",
      r.id,
      v.access === "status" ? 1 : 0,
    );
    s.exec(
      "INSERT INTO automation_grants VALUES(?,?,?,?,0,?)",
      uid(v.access === "status" ? "monitorgrant" : "grant"),
      r.id,
      r.version,
      sha(token),
      now(),
    );
  });
  return {
    definitionId: r.id,
    token,
    access: v.access,
    notice:
      v.access === "status"
        ? "Read-only status credential. It cannot trigger work."
        : "Shown once. Store in the scheduler credential store. This grants only trigger, export submission and safe status for this definition.",
  };
}
export function authenticateAutomation(s: Store, token: string) {
  if (s.schemaVersion < 20 || !/^[a-f0-9]{64}$/.test(token)) return undefined;
  const hash = sha(token),
    g = s.one(
      "SELECT * FROM automation_grants WHERE token_hash=? AND revoked=0",
      hash,
    );
  if (!g || !timingSafeEqual(Buffer.from(hash), Buffer.from(g.token_hash)))
    return undefined;
  const r = row(s, g.definition_id);
  if (r.state !== "enabled" || r.version !== g.definition_version)
    return undefined;
  return {
    definitionId: r.id,
    version: r.version,
    access: g.id.startsWith("monitorgrant_") ? "status" : "trigger",
  };
}
export function observeScheduler(s: Store, raw: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({
      id: ident,
      expectedVersion: z.number().int().positive(),
      schedulerId: ident,
      state: z.enum([
        "configured",
        "verified-active",
        "paused",
        "unavailable",
        "unknown",
      ]),
      evidence: z.string().trim().min(1).max(2000),
      nextRun: z.string().datetime({ offset: true }).nullable().default(null),
    })
    .strict()
    .parse(raw);
  const r = row(s, v.id);
  if (r.version !== v.expectedVersion) throw Error("STALE_VERSION");
  s.exec(
    "INSERT INTO automation_schedule_observations VALUES(?,?,?) ON CONFLICT(definition_id) DO UPDATE SET payload=excluded.payload,observed_at=excluded.observed_at",
    r.id,
    JSON.stringify({
      ...v,
      attestation: "operator-recorded scheduler read-back",
    }),
    now(),
  );
  return automationStatus(s, h, r.id);
}
function visible(s: Store, r: any, h: Host) {
  // Definitions contain private paths and queries; only their owner sees these.
  if (h !== "local" || r.host !== h) return false;
  const d: AutomationDefinition = r.payload.definition;
  return sourceIds(s, d).every((id) => {
    const source = s.one("SELECT * FROM sources WHERE id=?", id);
    return !source || s.allowed(source, h);
  });
}
export function automationStatus(s: Store, h: Host, id?: string): any {
  access(s, h);
  const result = s
    .all("SELECT id FROM automation_definitions ORDER BY created_at DESC")
    .map((x) => row(s, x.id))
    .filter((r) => visible(s, r, h))
    .map((r) => {
      const o = s.one(
        "SELECT payload,observed_at FROM automation_schedule_observations WHERE definition_id=?",
        r.id,
      );
      return {
        id: r.id,
        version: r.version,
        state: r.state,
        ...r.payload,
        approvedDigest: r.approval_digest,
        health: definitionHealth(s, r.id),
        schedulerObservation: o
          ? {
              ...JSON.parse(o.payload),
              observedAt: o.observed_at,
              stale: Date.now() - Date.parse(o.observed_at) > 86400000,
            }
          : { state: "unknown", nextRun: null },
        lastRun:
          s.one(
            "SELECT id,state,updated_at updatedAt FROM automation_runs WHERE definition_id=? ORDER BY created_at DESC LIMIT 1",
            r.id,
          ) ?? null,
      };
    });
  if (id) {
    const r = result.find((r) => r.id === id);
    if (!r) throw Error("AUTOMATION_UNAVAILABLE");
    return r;
  }
  return {
    definitions: result,
    automaticBudget: 25,
    currentBudget: h === "local" ? automaticBudgetStatus(s) : null,
    usage:
      h === "local"
        ? s.all(
            "SELECT month,SUM(actual) actual,SUM(CASE WHEN actual IS NULL THEN reserved ELSE 0 END) reserved FROM ai_usage WHERE category='automatic' GROUP BY month",
          )
        : [],
  };
}
export function automationHistory(s: Store, h: Host, raw: unknown = {}) {
  access(s, h);
  const v = z
    .object({
      id: ident.optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(25),
    })
    .strict()
    .parse(raw);
  if (h !== "local") return { items: [], nextCursor: null };
  if (v.id) automationStatus(s, h, v.id);
  const cursor = v.cursor
    ? s.one("SELECT created_at,id FROM automation_runs WHERE id=?", v.cursor)
    : null;
  if (v.cursor && !cursor) throw Error("AUTOMATION_CURSOR_INVALID");
  const allowed = s
    .all("SELECT id FROM automation_definitions")
    .filter((x) => visible(s, row(s, x.id), h))
    .map((x) => x.id);
  if (!allowed.length) return { items: [], nextCursor: null };
  const rows = s.all(
    `SELECT * FROM automation_runs WHERE (? IS NULL OR definition_id=?) AND (? IS NULL OR created_at<? OR (created_at=? AND id<?)) AND definition_id IN (${allowed.map(() => "?").join(",")}) ORDER BY created_at DESC,id DESC LIMIT ?`,
    v.id ?? null,
    v.id ?? null,
    cursor?.created_at ?? null,
    cursor?.created_at ?? null,
    cursor?.created_at ?? null,
    cursor?.id ?? null,
    ...allowed,
    v.limit + 1,
  );
  const items = rows.slice(0, v.limit).map((r) => safeRun(s, r, h));
  return { items, nextCursor: rows.length > v.limit ? items.at(-1)?.id : null };
}
function safeRun(s: Store, r: any, h?: Host) {
  const version = s.one(
    "SELECT payload FROM automation_definition_revisions WHERE definition_id=? AND version=?",
    r.definition_id,
    r.definition_version,
  );
  const cp = JSON.parse(r.checkpoint),
    d: AutomationDefinition = (
      version ? JSON.parse(version.payload) : row(s, r.definition_id).payload
    ).definition;
  const refs = (cp.revisionIds ?? []).filter((rev: string) => {
    const source = s.one(
      "SELECT s.* FROM sources s JOIN revisions r ON r.source_id=s.id WHERE r.id=?",
      rev,
    );
    return (
      source && s.allowed(source, d.accessHost) && (!h || s.allowed(source, h))
    );
  });
  return {
    id: r.id,
    definitionId: r.definition_id,
    definitionVersion: r.definition_version,
    state: r.state,
    stage: cp.stage ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    error: cp.error ?? null,
    ...(h && refs.length === (cp.revisionIds ?? []).length
      ? {
          revisionIds: refs,
          reviewIds: cp.reviewIds ?? [],
          aiJobIds: cp.aiJobIds ?? [],
          syncRunId: cp.syncRunId ?? null,
          pendingCount: cp.pendingCount ?? 0,
          pendingWindows: cp.pendingWindows ?? null,
          artifactIds: cp.artifactIds ?? [],
        }
      : {}),
    notice:
      r.state === "uncertain"
        ? "Inspect provider and engine receipts before another paid attempt."
        : null,
  };
}
export function automationSafeStatus(s: Store, id: string) {
  const r = row(s, id);
  return {
    definitionId: id,
    state: r.state,
    health: definitionHealth(s, id),
    runs: s
      .all(
        "SELECT * FROM automation_runs WHERE definition_id=? ORDER BY created_at DESC LIMIT 10",
        id,
      )
      .map((r) => safeRun(s, r)),
  };
}
function slot(d: AutomationDefinition, at: Date) {
  if (d.scheduler.cadence === "manual") return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: d.scheduler.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(at);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  if (d.scheduler.cadence === "daily") return date;
  if (d.scheduler.cadence === "weekly") {
    const day = new Date(`${date}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    return day.toISOString().slice(0, 10);
  }
  // Local wall-clock identity deliberately coalesces repeated DST slots.
  return `${date}T${p.hour}:${Math.floor(Number(p.minute) / 15) * 15}`;
}
export function startAutomation(
  s: Store,
  raw: unknown,
  h: Host | null,
  grant?: { definitionId: string; version: number; access?: string },
) {
  if (grant?.access === "status") throw Error("AUTOMATION_OPERATION_DENIED");
  if (h) access(s, h, true);
  const v = runInput.parse(raw),
    r = row(s, v.id),
    d: AutomationDefinition = r.payload.definition;
  if (
    !h &&
    (!grant || grant.definitionId !== r.id || grant.version !== r.version)
  )
    throw Error("AUTOMATION_GRANT_DENIED");
  if (r.state !== "enabled") throw Error("AUTOMATION_DISABLED");
  checkBinding(s, r);
  if (v.snapshot && d.scope.kind !== "export")
    throw Error("AUTOMATION_EXPORT_SCOPE_REQUIRED");
  if (
    s.schemaVersion >= 21 &&
    s.one("SELECT 1 FROM knowledge_enrichment_requests WHERE state='running'")
  )
    throw Error("WORKSPACE_JOB_RUNNING");
  const digest = sha(JSON.stringify(v.snapshot ?? null));
  const triggerKey = v.snapshot
    ? `export:${v.triggerId}`
    : (slot(d, new Date()) ?? v.triggerId);
  const prior = s.one(
    "SELECT * FROM automation_runs WHERE definition_id=? AND trigger_key=?",
    r.id,
    triggerKey,
  );
  if (prior) {
    if (prior.request_digest !== digest)
      throw Error("AUTOMATION_TRIGGER_CONFLICT");
    return { ...safeRun(s, prior, h ?? undefined), replayed: true };
  }
  if (
    s.one("SELECT 1 FROM automation_runs WHERE state='running'") ||
    s.one("SELECT 1 FROM sync_runs WHERE state='running'") ||
    s.one("SELECT 1 FROM ai_jobs WHERE state IN ('queued','running')")
  )
    throw Error("AUTOMATION_WORKSPACE_BUSY");
  const id = uid("automation_run"),
    controller = new AbortController();
  s.tx(() => {
    s.exec(
      "INSERT INTO automation_runs VALUES(?,?,?,?,?,?,?,?,?)",
      id,
      r.id,
      r.version,
      triggerKey,
      digest,
      "running",
      JSON.stringify({ stage: "scope-check", revisionIds: [] }),
      now(),
      now(),
    );
    event(s, r.id, id, "started");
  });
  controllers.set(runtimeKey(s, id), controller);
  const promise = Promise.resolve()
    .then(() => execute(s, r, id, v.snapshot, controller))
    .finally(() => {
      work.delete(runtimeKey(s, id));
      controllers.delete(runtimeKey(s, id));
    });
  work.set(runtimeKey(s, id), promise);
  return { id, definitionId: r.id, state: "running", replayed: false };
}
async function execute(
  s: Store,
  r: any,
  runId: string,
  snapshot: any,
  controller: AbortController,
) {
  const d: AutomationDefinition = r.payload.definition,
    cp: any = {
      stage: "scope-check",
      revisionIds: [],
      reviewIds: [],
      aiJobIds: [],
    };
  const checkpoint = (stage: string, state?: string) => {
    cp.stage = stage;
    s.tx(() => {
      event(s, r.id, runId, stage);
      s.exec(
        "UPDATE automation_runs SET checkpoint=?,updated_at=?,state=COALESCE(?,state) WHERE id=?",
        JSON.stringify(cp),
        now(),
        state ?? null,
        runId,
      );
    });
  };
  const recheck = () => {
    if (controller.signal.aborted) throw Error("AUTOMATION_PAUSED");
    const current = row(s, r.id);
    if (current.state !== "enabled" || current.version !== r.version)
      throw Error("AUTOMATION_PAUSED");
    checkBinding(s, current);
  };
  try {
    recheck();
    if (d.recipe.startsWith("intake")) {
      checkpoint("intake");
      if (!d.futureRevisions && !d.importBacklog)
        throw Error("AUTOMATION_INTAKE_NOT_AUTHORIZED");
      if (d.scope.kind === "connection") {
        const result = await syncConnection(
          s,
          d.scope.connectionId,
          d.accessHost,
          {
            automationId: r.id,
            check: recheck,
            baselineItems: r.payload.baselineItems,
            importBacklog: d.importBacklog,
            futureRevisions: d.futureRevisions,
          },
        );
        cp.syncRunId = result.runId;
        cp.partialIntake = result.failed > 0;
      } else if (snapshot) {
        const result = await importSnapshot(
          s,
          snapshot,
          d,
          r.payload.enabledAt,
          d.accessHost,
          recheck,
        );
        cp.revisionIds = [result.revisionId];
        if (!snapshot.updatedAt || snapshot.updatedAt <= r.payload.enabledAt)
          s.exec(
            "INSERT OR IGNORE INTO automation_backlog_revisions VALUES(?,?)",
            r.id,
            result.revisionId,
          );
      } else throw Error("AUTOMATION_EXPORT_REQUIRED");
    }
    recheck();
    cp.revisionIds = [
      ...new Set([
        ...cp.revisionIds,
        ...permittedSources(s, d, d.accessHost).map((x) => x.current_revision),
      ]),
    ];
    checkpoint("knowledge-health");
    if (!d.futureRevisions)
      cp.revisionIds = cp.revisionIds.filter((rev: string) =>
        r.payload.baselineRevisions.includes(rev),
      );
    cp.revisionIds.sort((a: string, b: string) => {
      const last = (rev: string) =>
        s.one(
          "SELECT checked_at FROM automation_checks WHERE definition_id=? AND revision_id=?",
          r.id,
          rev,
        )?.checked_at ?? "";
      return last(a).localeCompare(last(b)) || a.localeCompare(b);
    });
    cp.pendingCount = Math.max(0, cp.revisionIds.length - d.maxItems);
    cp.revisionIds = cp.revisionIds.slice(0, d.maxItems);
    cp.reviewIds = scanKnowledge(s, d.accessHost, cp.revisionIds)
      .filter((x) => x.current && x.state === "pending")
      .map((x) => x.id);
    s.tx(() => {
      for (const revisionId of cp.revisionIds)
        s.exec(
          "INSERT INTO automation_checks VALUES(?,?,?) ON CONFLICT(definition_id,revision_id) DO UPDATE SET checked_at=excluded.checked_at",
          r.id,
          revisionId,
          now(),
        );
    });
    if (d.recipe.includes("review")) {
      checkpoint("assisted-review");
      const candidates = cp.revisionIds
        .filter(
          (rev: string) =>
            d.analyzeBacklog ||
            (!r.payload.baselineRevisions.includes(rev) &&
              !s.one(
                "SELECT 1 FROM automation_backlog_revisions WHERE definition_id=? AND revision_id=?",
                r.id,
                rev,
              ) &&
              s.one("SELECT created_at FROM revisions WHERE id=?", rev)
                ?.created_at > r.payload.enabledAt),
        )
        .slice(0, d.maxItems);
      if (!r.payload.provider) throw Error("AI_CONFIGURATION_REQUIRED");
      if (candidates.length) {
        const result = await runAutomationReview(
          s,
          {
            definitionId: r.id,
            runId,
            definition: d,
            pins: r.payload.skills,
            providerPin: r.payload.provider,
            revisionIds: candidates,
          },
          controller.signal,
          recheck,
        );
        cp.aiJobIds = result.jobIds;
        cp.artifactIds = result.artifactIds ?? [];
        cp.pendingWindows = result.pendingWindows ?? 0;
        cp.reviewIds.push(...result.reviewIds);
      }
    }
    recheck();
    if (cp.partialIntake) throw Error("AUTOMATION_INTAKE_PARTIAL");
    checkpoint("complete", "completed");
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    cp.error =
      /^(AUTOMATION_[A-Z_]+|AI_[A-Z_]+|PROVIDER_[A-Z_]+|WORKSPACE_[A-Z_]+|SOURCE_[A-Z_]+)/.exec(
        message,
      )?.[0] ?? "AUTOMATION_REVIEW_REQUIRED";
    const uncertain = !!s.one(
      "SELECT 1 FROM ai_jobs WHERE json_extract(payload,'$.automationRunId')=? AND state='uncertain'",
      runId,
    );
    s.tx(() => {
      s.exec(
        "UPDATE automation_runs SET state=?,checkpoint=?,updated_at=? WHERE id=?",
        uncertain
          ? "uncertain"
          : controller.signal.aborted
            ? "cancelled"
            : "needs-attention",
        JSON.stringify(cp),
        now(),
        runId,
      );
      event(
        s,
        r.id,
        runId,
        uncertain
          ? "uncertain"
          : controller.signal.aborted
            ? "cancelled"
            : "needs-attention",
      );
    });
  }
}
export async function waitAutomations(s: Store) {
  await Promise.all(
    [...work.entries()]
      .filter(([k]) => k.startsWith(s.root + ":"))
      .map(([, p]) => p),
  );
}
export async function stopAutomations(s: Store) {
  for (const [k, c] of controllers) if (k.startsWith(s.root + ":")) c.abort();
  await waitAutomations(s);
}
export function recoverAutomations(s: Store) {
  if (s.schemaVersion < 20) return;
  s.exec(
    "UPDATE automation_runs SET state='interrupted',updated_at=? WHERE state='running'",
    now(),
  );
  // Started paid jobs remain uncertain with their reservations and processing keys.
  s.exec(
    "UPDATE ai_jobs SET state='uncertain',updated_at=? WHERE state IN ('running','queued') AND json_extract(payload,'$.automationRunId') IS NOT NULL",
    now(),
  );
}
