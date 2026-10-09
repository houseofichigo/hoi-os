import { intakeList, intakeDetail } from "./work-intake.js";
import { connections } from "./sync.js";
import { z } from "zod";
import { type Store } from "./store.js";
import { type Host } from "./schema.js";
import { records } from "./workspace.js";
import { listTasks } from "./tasks.js";
import { sha } from "./files.js";
import { type EvidenceItem } from "./retrieval.js";

export const recordReference = z
  .object({
    kind: z.literal("record"),
    recordKind: z.enum(["project", "client", "task", "event", "connection"]),
    recordId: z.string(),
    recordVersion: z.string().regex(/^\d+$/),
    recordRevision: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const fields = [
  "name",
  "title",
  "objective",
  "status",
  "owner",
  "priority",
  "deliveryTypes",
  "scope",
  "deliverables",
  "startDate",
  "dueDate",
  "milestones",
  "risks",
  "nextSteps",
  "notes",
  "contacts",
  "outcome",
  "description",
  "waitingFor",
  "start",
  "end",
  "timezone",
  "recurrenceId",
  "cancelled",
  "allDay",
  "checkedAt",
  "updatedAt",
  "provider",
  "state",
  "selectedScope",
  "lastSuccess",
  "freshness",
  "from",
  "to",
];
/** Live properties come only from existing permitted read models. Never interpret wiki prose as status. */
export function operationalEvidence(
  s: Store,
  h: Host,
  filter: { project?: string; client?: string } = {},
): EvidenceItem[] {
  s.assertHost(h);
  if (s.schemaVersion < 9) return [];
  const clients = records(s, "client", h).filter((r) =>
    s.evidenceVisible(r.evidence ?? [], h, true),
  );
  const clientIds = new Set(clients.map((r) => r.id));
  const projects = records(s, "project", h).filter(
    (r) =>
      s.evidenceVisible(r.evidence ?? [], h, true) &&
      r.clientIds.every((id: string) => clientIds.has(id)),
  );
  const projectIds = new Set(projects.map((r) => r.id));
  const project = filter.project
    ? s.one(
        "SELECT id FROM projects WHERE id=? OR entity_id=?",
        filter.project,
        filter.project,
      )?.id
    : undefined;
  if (filter.project && !projectIds.has(project)) return [];
  const scoped = projects.filter(
    (r) =>
      (!project || r.id === project) &&
      (!filter.client || r.clientIds.includes(filter.client)),
  );
  const scopedIds = new Set(scoped.map((r) => r.id));
  const rows: ["project" | "client" | "task" | "event" | "connection", any][] =
    [
      ...scoped.map((r) => ["project", r] as ["project", any]),
      ...clients
        .filter(
          (r) =>
            (!filter.client || r.id === filter.client) &&
            (!project || scoped.some((p) => p.clientIds.includes(r.id))),
        )
        .map((r) => ["client", r] as ["client", any]),
      ...listTasks(s, h)
        .filter(
          (r) =>
            s.evidenceVisible(r.evidence ?? [], h, true) &&
            (!r.projectId || projectIds.has(r.projectId)) &&
            (!(project || filter.client) || scopedIds.has(r.projectId)),
        )
        .map((r) => ["task", r] as ["task", any]),
    ];
  for (const event of intakeList(s, h).filter(
    (e) =>
      e.kind === "calendar" &&
      (!e.projectId || projectIds.has(e.projectId)) &&
      (!(project || filter.client) || scopedIds.has(e.projectId)),
  )) {
    const detail = intakeDetail(s, event.id, h),
      item = detail.item;
    if (
      !item.calendar ||
      !event.sourceId ||
      !s.allowed(
        s.one("SELECT * FROM sources WHERE id=?", event.sourceId),
        h,
        true,
      )
    )
      continue;
    const evidence = detail.passages.slice(0, 5).map((p) => ({
      revisionId: event.revisionId,
      passageId: p.id,
      quote: p.text.slice(0, 2000),
    }));
    if (!s.evidenceVisible(evidence, h, true)) continue;
    rows.push([
      "event",
      {
        id: event.id,
        version: s.one(
          "SELECT count(*) n FROM revisions WHERE source_id=? AND rowid <= (SELECT rowid FROM revisions WHERE id=?)",
          event.sourceId,
          event.revisionId,
        ).n,
        title: event.title,
        ...item.calendar,
        timezone: item.timezone,
        recurrenceId: item.recurrenceId,
        cancelled: item.cancelled,
        checkedAt: item.checkedAt,
        updatedAt: item.updatedAt,
        projectId: event.projectId,
        evidence,
        sourceRevision: event.revisionId,
        freshness:
          Date.now() - Date.parse(item.checkedAt) > 86400000
            ? "stale"
            : "current",
        coverage: "Preserved calendar occurrence only; not live availability",
      },
    ]);
  }
  // Connection health has no inferred project association. Never copy raw configuration or errors.
  if (!filter.project && !filter.client && s.schemaVersion >= 10)
    for (const c of connections(s, h)) {
      const freshness =
        c.state !== "active"
          ? "partial"
          : !c.lastSuccess
            ? "unknown"
            : Date.now() - Date.parse(c.lastSuccess) > 86400000
              ? "stale"
              : c.coverage.state;
      rows.push([
        "connection",
        {
          id: c.id,
          version: c.version,
          title: `${c.provider} connection`,
          provider: c.provider,
          state: c.state,
          lastSuccess: c.lastSuccess,
          freshness,
          selectedScope: c.coverage.mode,
          from: c.coverage.from,
          to: c.coverage.to,
          coverage:
            "Selected configured scope only; no live synchronization performed",
          evidence: [],
        },
      ]);
    }
  return rows.map(([kind, r]) => {
    const properties = Object.fromEntries(
      fields.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]),
    );
    const relatedRecords =
      kind === "project"
        ? r.clientIds
        : (kind === "task" || kind === "event") && r.projectId
          ? [r.projectId]
          : [];
    const revision = sha(
      JSON.stringify({
        kind,
        id: r.id,
        version: r.version,
        properties,
        sourceRevision: r.sourceRevision ?? null,
        relatedRecords,
        evidence: r.evidence ?? [],
      }),
    );
    const excerpt = Object.entries(properties)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n");
    const reference = {
      recordKind: kind,
      recordId: r.id,
      recordVersion: String(r.version),
      recordRevision: revision,
    };
    return {
      kind: "record",
      id: `record:${kind}:${r.id}:${revision}`,
      recordId: r.id,
      revision,
      title: r.name ?? r.title ?? "Recorded item",
      excerpt,
      provenance:
        kind === "event"
          ? "synchronized-calendar-occurrence"
          : kind === "connection"
            ? "connector-health-snapshot"
            : "authoritative-operational-record",
      attribution: r.owner ?? null,
      effectiveDate: null,
      relatedRecords,
      supportingEvidence: r.evidence ?? [],
      reference,
      score: 0,
      method: "lexical",
      reason: "Matching current operational properties; not a wiki description",
      data: {
        ...reference,
        version: r.version,
        title: r.name ?? r.title ?? "Recorded item",
        quote: excerpt,
        authority: "live-record",
        coverage:
          r.coverage ?? "Current recorded properties; no external refresh",
        ...(r.freshness ? { freshness: r.freshness } : {}),
        evidence: r.evidence ?? [],
      },
    };
  });
}
export function resolveOperationalEvidence(s: Store, input: unknown, h: Host) {
  const ref = recordReference.parse(input);
  const found = operationalEvidence(s, h).find(
    (e) =>
      e.recordId === ref.recordId &&
      e.reference.recordKind === ref.recordKind &&
      e.reference.recordVersion === ref.recordVersion &&
      e.revision === ref.recordRevision,
  );
  if (!found)
    throw Error(
      "EVIDENCE_UNAVAILABLE: Operational record changed or access was removed",
    );
  return { ...found.data, kind: "record", quote: found.excerpt };
}
