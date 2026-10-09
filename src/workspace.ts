import { preferences } from "./daily-workspace.js";
import { providerCoverage } from "./coverage.js";
import { z } from "zod";
import { Store } from "./store.js";
import { uid, now, sha } from "./files.js";
import { type Host, id, host, evidence } from "./schema.js";
import { entity } from "./knowledge.js";
import {
  createProject,
  getProject,
  listProjects,
  listTasks,
  listProposals,
} from "./tasks.js";
import { connections } from "./sync.js";
import { dailyView, localParts, wallInstant } from "./daily.js";
import { hubAccess } from "./hub.js";
export const WORKSPACE_SQL = `CREATE TABLE IF NOT EXISTS workspace_records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workspace_history(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,host TEXT NOT NULL,at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_reviews(id TEXT PRIMARY KEY,host TEXT NOT NULL,digest TEXT NOT NULL,state TEXT NOT NULL,until_date TEXT, UNIQUE(id,host));`;
const text = z.string().max(12000),
  nullable = text.nullable().default(null);
const base = {
  name: z.string().trim().min(1).max(240),
  owner: nullable,
  notes: text.default(""),
  allowedHosts: z.array(host).min(1).default(["local", "codex", "claude"]),
  evidence: z.array(evidence).default([]),
};
const schemas = {
  client: z
    .object({
      ...base,
      status: z.enum(["active", "past"]).default("active"),
      contacts: z
        .array(z.object({ name: text, email: text }).strict())
        .default([]),
    })
    .strict(),
  project: z
    .object({
      ...base,
      deliveryTypes: z
        .array(z.enum(["training", "consulting"]))
        .max(2)
        .default([])
        .transform((x) => [...new Set(x)]),
      clientIds: z.array(id).default([]),
      status: z
        .enum([
          "planned",
          "in-progress",
          "waiting",
          "blocked",
          "completed",
          "cancelled",
        ])
        .default("planned"),
      priority: z.enum(["low", "normal", "high"]).default("normal"),
      objective: text.default(""),
      scope: text.default(""),
      deliverables: text.default(""),
      startDate: z.string().date().nullable().default(null),
      dueDate: z.string().date().nullable().default(null),
      milestones: text.default(""),
      risks: text.default(""),
      nextSteps: text.default(""),
      knowledgeIds: z.array(id).default([]),
    })
    .strict()
    .refine(
      (v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate,
      "Due date precedes start date",
    ),
  training: z
    .object({
      ...base,
      projectId: id,
      clientIds: z.array(id).default([]),
      start: z.string().datetime({ offset: true }),
      end: z.string().datetime({ offset: true }),
      timezone: z.string().refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }),
      eventId: id.nullable().default(null),
      taskIds: z.array(id).default([]),
      status: z
        .enum(["planned", "confirmed", "completed", "cancelled"])
        .default("planned"),
    })
    .strict()
    .refine(
      (v) => Date.parse(v.end) > Date.parse(v.start),
      "End must follow start",
    ),
};
type Kind = keyof typeof schemas;
function access(s: Store, h: Host, write = false) {
  s.assertSchema(9, "Workspace records");
  hubAccess(s, h, write);
}
export function records(s: Store, kind: Kind, h: Host): any[] {
  access(s, h);
  if (!(kind in schemas)) throw Error("Unknown record kind");
  const all = s
    .all("SELECT * FROM workspace_records WHERE kind=?", kind)
    .map((r) => ({ ...JSON.parse(r.payload), id: r.id, version: r.version }))
    .filter(
      (r) =>
        r.allowedHosts.includes(h) && s.evidenceVisible(r.evidence, h, false),
    );
  if (kind === "client") return all;
  if (kind === "project") {
    const visible = new Set(listProjects(s, h).map((p) => p.id));
    return listProjects(s, h)
      .map(
        (p) =>
          (all.find((r) => r.id === p.id)
            ? { deliveryTypes: [], ...all.find((r) => r.id === p.id) }
            : null) || {
            ...schemas.project.parse({
              name: p.name,
              objective: p.objective,
              owner: p.owner,
              allowedHosts: JSON.parse(
                s.one(
                  "SELECT allowed_hosts FROM entities WHERE id=?",
                  p.entity_id,
                ).allowed_hosts,
              ),
            }),
            id: p.id,
            version: 0,
          },
      )
      .filter(
        (r) =>
          visible.has(r.id) &&
          (!s.one("SELECT id FROM workspace_records WHERE id=?", r.id) ||
            all.some((a) => a.id === r.id)),
      )
      .filter((r) =>
        r.clientIds.every((c: string) =>
          records(s, "client", h).some((x) => x.id === c),
        ),
      );
  }
  return all.filter(
    (r) =>
      records(s, "project", h).some((p) => p.id === r.projectId) &&
      r.clientIds.every((c: string) =>
        records(s, "client", h).some((x) => x.id === c),
      ) &&
      r.taskIds.every((t: string) => listTasks(s, h).some((x) => x.id === t)),
  );
}
export function saveRecord(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({
      kind: z.enum(["client", "project", "training"]),
      id: id.optional(),
      expectedVersion: z.number().int().nonnegative(),
      record: z.unknown(),
    })
    .strict()
    .parse(input);
  const value: any = schemas[v.kind].parse(v.record);
  if (!value.allowedHosts.includes(h)) throw Error("Keep current host access");
  s.validateEvidence(value.evidence, h, true);
  value.allowedHosts = value.allowedHosts.filter((target: Host) =>
    s.evidenceVisible(value.evidence, target, false),
  );
  return s.tx(() => {
    let key = v.id;
    const old = key ? records(s, v.kind, h).find((r) => r.id === key) : null;
    if (key && !old) throw Error("Record unavailable");
    if ((old?.version || 0) !== v.expectedVersion)
      throw Error("Stale record; reload before saving");
    for (const c of value.clientIds || [])
      if (!records(s, "client", h).some((r) => r.id === c))
        throw Error("Client unavailable");
    if (v.kind === "project") {
      for (const k of value.knowledgeIds) {
        const source = s.one("SELECT * FROM sources WHERE id=?", k);
        if (!source || !s.allowed(source, h))
          throw Error("Linked knowledge unavailable");
      }
      if (!key) {
        const e = entity(s, {
          type: "project",
          name: value.name,
          allowedHosts: value.allowedHosts,
        });
        key = createProject(
          s,
          {
            entityId: e.id,
            objective: value.objective || value.name,
            owner: value.owner,
          },
          h,
        ).id;
      }
      const p = getProject(s, key!, h);
      s.exec(
        "UPDATE projects SET objective=?,owner=? WHERE id=?",
        value.objective,
        value.owner,
        key,
      );
      s.exec(
        "UPDATE entities SET name=?,allowed_hosts=? WHERE id=?",
        value.name,
        JSON.stringify(value.allowedHosts),
        p.entity_id,
      );
    }
    if (v.kind === "training") {
      if (!records(s, "project", h).some((p) => p.id === value.projectId))
        throw Error("Project unavailable");
      if (
        value.taskIds.some(
          (id: string) =>
            !listTasks(s, h).some(
              (t) => t.id === id && t.projectId === value.projectId,
            ),
        )
      )
        throw Error("Preparation task unavailable");
      if (value.eventId) {
        const r = s.one("SELECT * FROM work_intake WHERE id=?", value.eventId);
        if (
          !r ||
          (JSON.parse(r.item).projectId ||
            s.one(
              "SELECT project_id FROM work_assignments WHERE item_key=?",
              r.item_key,
            )?.project_id) !== value.projectId
        )
          throw Error("Event unavailable");
        const source = s.one("SELECT * FROM sources WHERE id=?", r.source_id);
        if (!source || !s.allowed(source, h)) throw Error("Event unavailable");
      }
    }
    if (v.kind === "client" && !key)
      key = entity(s, {
        type: "client",
        name: value.name,
        allowedHosts: value.allowedHosts,
      }).id;
    key ??= uid(v.kind);
    if (v.kind === "client")
      s.exec(
        "UPDATE entities SET name=?,allowed_hosts=? WHERE id=?",
        value.name,
        JSON.stringify(value.allowedHosts),
        key,
      );
    s.exec(
      "INSERT INTO workspace_records VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,payload=excluded.payload,at=excluded.at",
      key,
      v.kind,
      v.expectedVersion + 1,
      JSON.stringify(value),
      now(),
    );
    s.exec(
      "INSERT INTO workspace_history VALUES(?,?,?,?,?,?)",
      uid("history"),
      key,
      v.expectedVersion + 1,
      JSON.stringify(value),
      h,
      now(),
    );
    return { id: key, version: v.expectedVersion + 1, ...value };
  });
}
export function recordHistory(s: Store, key: string, h: Host) {
  access(s, h);
  const row = s.one("SELECT kind FROM workspace_records WHERE id=?", key);
  if (!row || !records(s, row.kind, h).some((r) => r.id === key))
    throw Error("Record unavailable");
  return s
    .all(
      "SELECT version,payload,at FROM workspace_history WHERE record_id=? ORDER BY version",
      key,
    )
    .filter((r) => {
      const p = JSON.parse(r.payload);
      return (
        p.allowedHosts.includes(h) && s.evidenceVisible(p.evidence, h, false)
      );
    })
    .map((r) => ({ ...r, record: JSON.parse(r.payload), payload: undefined }));
}
export function progress(s: Store, projectIds: string[], h: Host) {
  const tasks = listTasks(s, h).filter(
    (t) => projectIds.includes(t.projectId) && t.status !== "cancelled",
  );
  return {
    done: tasks.filter((t) => t.status === "done").length,
    total: tasks.length,
    percent: tasks.length
      ? Math.round(
          (100 * tasks.filter((t) => t.status === "done").length) /
            tasks.length,
        )
      : null,
  };
}
export function emailCandidates(s: Store, h: Host, at = new Date()) {
  access(s, h);
  const grouped = new Map<string, any[]>();
  for (const r of s.all("SELECT * FROM work_intake WHERE state='ready'")) {
    const item = JSON.parse(r.item);
    if (item.kind !== "email" || !item.email) continue;
    const src = s.one("SELECT * FROM sources WHERE id=?", r.source_id);
    if (!src || !s.allowed(src, h) || src.current_revision !== r.revision_id)
      continue;
    const key = item.account + ":" + (item.threadId || item.remoteId);
    grouped.set(key, [
      ...(grouped.get(key) || []),
      { ...item, id: r.id, sourceId: r.source_id, revisionId: r.revision_id },
    ]);
  }
  const out = [];
  for (const messages of grouped.values()) {
    const m = messages
      .filter((m) => !m.email.draft && !m.email.spam && !m.email.trash)
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];
    if (
      !m ||
      m.email.direction !== "incoming" ||
      m.email.automated ||
      +at - Date.parse(m.occurredAt) < 86400000
    )
      continue;
    const digest = sha(
      JSON.stringify({ revisionId: m.revisionId, updatedAt: m.updatedAt }),
    );
    const review = s.one(
      "SELECT * FROM email_reviews WHERE id=? AND host=?",
      m.id,
      h,
    );
    if (
      review?.digest === digest &&
      (review.state === "dismissed" ||
        (review.state === "snoozed" && Date.parse(review.until_date) > +at))
    )
      continue;
    out.push({
      id: m.id,
      title: m.title,
      occurredAt: m.occurredAt,
      sourceId: m.sourceId,
      digest,
      revisionId: m.revisionId,
      sender: m.email.sender,
      excerpt: m.segments
        .filter((x: any) => !x.quoted)
        .map((x: any) => x.text)
        .join("\n")
        .slice(0, 1000),
      ageHours: Math.floor((+at - Date.parse(m.occurredAt)) / 3600000),
      evidence: s
        .all("SELECT id,text FROM passages WHERE revision_id=?", m.revisionId)
        .slice(0, 3)
        .map((p) => ({
          revisionId: m.revisionId,
          passageId: p.id,
          quote: p.text,
        })),
      coverage:
        "Selected visible thread history; a missing reply may be outside the selected scope",
      action: { kind: "source", id: m.sourceId },
      state:
        review?.digest === digest && review?.state === "confirmed"
          ? "confirmed"
          : "candidate",
    });
  }
  return out;
}
export function reviewEmail(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({
      id,
      digest: z.string(),
      state: z.enum(["confirmed", "dismissed", "snoozed"]),
      until: z.string().datetime({ offset: true }).nullable().default(null),
    })
    .strict()
    .parse(input);
  if (v.state === "snoozed" && (!v.until || Date.parse(v.until) <= Date.now()))
    throw Error("Choose a future snooze time");
  if (
    !emailCandidates(s, h).some((r) => r.id === v.id && r.digest === v.digest)
  )
    throw Error("Email changed; reload");
  s.exec(
    "INSERT INTO email_reviews VALUES(?,?,?,?,?) ON CONFLICT(id,host) DO UPDATE SET digest=excluded.digest,state=excluded.state,until_date=excluded.until_date",
    v.id,
    h,
    v.digest,
    v.state,
    v.until,
  );
  return v;
}
export function dashboard(s: Store, h: Host, input: any = {}, at = new Date()) {
  access(s, h);
  const options = z
    .object({
      date: z.string().date().optional(),
      timezone: z.string().optional(),
    })
    .strict()
    .parse(input);
  const timezone =
    options.timezone ||
    (s.schemaVersion >= 12 ? preferences(s, h).timezone : "Europe/Paris");
  const date = options.date || localParts(+at, timezone).date;
  const daily = dailyView(s, { date, timezone }, h, at),
    projects = records(s, "project", h),
    tasks = listTasks(s, h);
  const add = (n: number) =>
    new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10);
  const end = add(7),
    from = wallInstant(date, "00:00", timezone)!,
    to = wallInstant(end, "00:00", timezone)!;
  const active = projects.filter(
    (p) => !["completed", "cancelled"].includes(p.status),
  );
  const action = (r: any, kind: string) => ({
    ...r,
    action: { kind, id: r.id },
  });
  const deadline = (r: any) => {
    const instant = r.dueTime
      ? wallInstant(r.dueDate, r.dueTime, r.timezone)
      : null;
    return {
      date: instant === null ? r.dueDate : localParts(instant, timezone).date,
      instant,
      uncertain: !!r.dueTime && instant === null,
    };
  };
  const overdue = (r: any) => {
    if (!r.dueDate) return false;
    const d = deadline(r);
    return (
      !d.uncertain &&
      (d.date < date ||
        (d.instant !== null &&
          date === localParts(+at, timezone).date &&
          d.instant < +at))
    );
  };
  const upcoming = (r: any) => {
    if (!r.dueDate || overdue(r)) return false;
    const d = deadline(r);
    return d.date >= date && d.date < end;
  };
  const open = tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  const calendarCoverage = providerCoverage(s, h, "calendar", { from, to }, at),
    emailCoverage = providerCoverage(s, h, "gmail", { from, to }, at);
  const localCoverage = {
    state: "current",
    scope: "Visible recorded workspace records only",
    lastSuccess: at.toISOString(),
    explanation:
      "Zero recorded items does not mean no outstanding commitments elsewhere.",
  };
  const attention = {
    overdue: [
      ...open.filter(overdue).map((t) => action(t, "task")),
      ...active.filter(overdue).map((p) => action(p, "project")),
    ],
    blocked: [
      ...active
        .filter((p) => p.status === "blocked")
        .map((p) => action(p, "project")),
      ...open
        .filter((t) => t.status === "blocked")
        .map((t) => action(t, "task")),
    ],
    approvals: listProposals(s, h)
      .filter((p) => p.state === "proposed")
      .map((p) => action(p, "proposal")),
    syncFailures:
      s.schemaVersion >= 10
        ? connections(s, h)
            .filter((c) => c.error)
            .map((c) =>
              action(
                { id: c.id, title: c.label, status: c.error },
                "connection",
              ),
            )
        : [],
  };
  const deadlines = [
    ...active.filter(upcoming).map((p) => action(p, "project")),
    ...open
      .filter(upcoming)
      .map((t) =>
        action({ ...t, deadlineReview: deadline(t).uncertain }, "task"),
      ),
  ].sort((a, b) => deadline(a).date.localeCompare(deadline(b).date));
  const meetings = daily.week.map((e) => action(e, "event"));
  const emails = emailCandidates(s, h, at),
    followups = open
      .filter((t) => t.status === "waiting")
      .map((t) => action(t, "task"));
  const trainings = records(s, "training", h)
    .filter(
      (r) =>
        !["completed", "cancelled"].includes(r.status) &&
        Date.parse(r.end) > from &&
        Date.parse(r.start) < wallInstant(add(30), "00:00", timezone)!,
    )
    .map((r) =>
      action(
        {
          ...r,
          preparation: r.taskIds.length
            ? `${tasks.filter((t) => r.taskIds.includes(t.id) && t.status === "done").length}/${r.taskIds.length} preparation tasks done`
            : "Not measured",
        },
        "training",
      ),
    );
  const signals = [
    {
      key: "attention",
      label: "Needs attention",
      items: [
        ...new Map(
          [
            ...attention.overdue,
            ...attention.blocked,
            ...attention.approvals,
            ...attention.syncFailures,
          ].map((r) => [r.action.kind + ":" + r.id, r]),
        ).values(),
      ],
      coverage: localCoverage,
    },
    {
      key: "meetings",
      label: "Meetings",
      items: meetings,
      coverage: calendarCoverage,
    },
    {
      key: "emails",
      label: "Email awaiting reply",
      items: emails,
      coverage: emailCoverage,
    },
    {
      key: "deadlines",
      label: "Deadlines",
      items: deadlines,
      coverage: localCoverage,
    },
    {
      key: "followups",
      label: "Follow-ups",
      items: followups,
      coverage: localCoverage,
    },
    {
      key: "trainings",
      label: "Upcoming trainings",
      items: trainings,
      coverage: localCoverage,
    },
  ];
  const agenda = meetings
    .filter(
      (e) =>
        e.timing &&
        Date.parse(e.timing.start) < wallInstant(add(1), "00:00", timezone)! &&
        Date.parse(e.timing.end) > from,
    )
    .sort((a, b) => Date.parse(a.timing.start) - Date.parse(b.timing.start));
  const queue = [
    ...new Map(
      [
        ...attention.overdue.map((r) => ({
          ...r,
          reason: "Overdue",
          priorityRank: 0,
        })),
        ...attention.blocked.map((r) => ({
          ...r,
          reason: "Blocked",
          priorityRank: 1,
        })),
        ...attention.syncFailures.map((r) => ({
          ...r,
          reason: "Source synchronization needs review",
          priorityRank: 2,
        })),
        ...attention.approvals.map((r) => ({
          ...r,
          reason: "Awaiting your approval",
          priorityRank: 3,
        })),
      ]
        .reverse()
        .map((r) => [r.action.kind + ":" + r.id, r]),
    ).values(),
  ].sort(
    (a, b) =>
      a.priorityRank - b.priorityRank ||
      String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")) ||
      a.id.localeCompare(b.id),
  );
  return {
    executive: {
      queue,
      agenda,
      indicators: [
        {
          key: "decisions",
          label: "Needs decision",
          count: attention.approvals.length,
          coverage: localCoverage,
          target: "attention",
        },
        {
          key: "overdue",
          label: "Overdue work",
          count: attention.overdue.length,
          coverage: localCoverage,
          target: "attention",
        },
        {
          key: "due",
          label: "Due this week",
          count: deadlines.length,
          coverage: localCoverage,
          target: "deadlines",
        },
        {
          key: "today",
          label: "Meetings today",
          count: agenda.length,
          coverage: calendarCoverage,
          target: "meetings",
        },
      ],
    },
    date,
    timezone,
    daily,
    signals,
    attention,
    deadlines,
    emails,
    emailCoverage,
    followups,
    trainings,
    projects: projects.map((p) => ({ ...p, progress: progress(s, [p.id], h) })),
    clients: records(s, "client", h).map((c) => ({
      ...c,
      progress: progress(
        s,
        projects.filter((p) => p.clientIds.includes(c.id)).map((p) => p.id),
        h,
      ),
    })),
    sourceCoverage: [...calendarCoverage.scopes, ...emailCoverage.scopes],
  };
}
