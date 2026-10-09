import { z } from "zod";
import type { Store } from "./store.js";
import type { Host } from "./schema.js";
import { getChat, chatEvidence } from "./chat.js";
import { aiJob } from "./ai.js";
import { getProject, getTask, listProposals } from "./tasks.js";
import { records } from "./workspace.js";
import { wikiDetail } from "./wiki-core.js";
import { emailActions } from "./google-actions.js";
import { listCalendarActions } from "./calendar.js";
import { listKnowledgeReviews } from "./maintenance.js";
import { intakeJobs } from "./intake.js";
import { connections } from "./sync.js";
import { intakeDetail } from "./work-intake.js";

export type ResultCard = {
  id: string;
  kind: string;
  title: string;
  state: string;
  summary: string;
  href: string;
  version?: number;
  evidence?: any[];
  evidenceCurrent?: boolean;
  updatedAt?: string;
  runId?: string;
  jobId?: string;
  category?: string;
  bucket?: string;
  events?: any[];
  task?: any;
};
const route = (fields: Record<string, string>) =>
  "/app?" + new URLSearchParams(fields).toString();
const visible = <T>(read: () => T): T[] => {
  try {
    return [read()];
  } catch {
    return [];
  }
};
function check(s: Store, h: Host) {
  s.assertSchema(18, "Activity");
  s.assertHost(h);
  if (s.policy().actions.read === "deny") throw Error("ACTIVITY_DENIED");
}
function bucket(state: string) {
  if (["queued", "running", "processing"].includes(state)) return "running";
  if (
    [
      "completed",
      "done",
      "indexed",
      "executed",
      "dismissed",
      "rejected",
      "cancelled",
      "resolved",
      "reviewed",
      "superseded",
    ].includes(state)
  )
    return "completed";
  return "attention";
}
function proposalCard(p: any): ResultCard {
  return {
    id: "proposal:" + p.id,
    kind: "task-proposal",
    title: p.task.title,
    state: p.taskId ? "completed" : p.state,
    summary: p.task.outcome,
    task: p.task,
    version: p.version,
    evidence: p.evidence,
    evidenceCurrent: p.evidenceCurrent,
    href: route(p.taskId ? { task: p.taskId } : { proposal: p.id }),
  };
}
export function turnResults(s: Store, runId: string, h: Host) {
  check(s, h);
  const turn = getChat(s, runId, h),
    evidence = chatEvidence(s, runId, h);
  const cards: ResultCard[] = [];
  if (turn.answer?.taskProposal) {
    const p =
      turn.acceptedProposal &&
      listProposals(s, h).find((p) => p.id === turn.acceptedProposal.id);
    if (p)
      cards.push({
        ...proposalCard(p),
        ...(p.taskId
          ? {
              kind: "action-receipt",
              summary: "Task created after review. " + p.task.outcome,
            }
          : {}),
      });
    else if (!turn.acceptedProposal)
      cards.push({
        id: "draft:" + runId,
        kind: "task-proposal",
        title: turn.answer.taskProposal.task.title,
        state: "draft",
        summary: turn.answer.taskProposal.task.outcome,
        href: "",
        version: turn.version,
        runId,
        task: turn.answer.taskProposal.task,
        evidence: turn.answer.taskProposal.evidence,
        evidenceCurrent: true,
      });
  }
  const refs = evidence.liveRecords.filter((r) => r.cited);
  for (const ref of refs) {
    if (ref.kind === "project")
      cards.push(
        ...visible(() => {
          const p = getProject(s, ref.id, h),
            r = records(s, "project", h).find((r) => r.id === p.id);
          return {
            id: "project:" + p.id,
            kind: "project",
            title: p.name,
            state: r?.status ?? p.status,
            summary: [r?.objective, r?.nextSteps].filter(Boolean).join("\n"),
            version: r?.version ?? p.version,
            href: route({ project: p.id }),
            evidence: evidence.cited,
          };
        }),
      );
    if (ref.kind === "event")
      cards.push(
        ...visible(() => {
          const e = intakeDetail(s, ref.id, h);
          return {
            id: "event:" + e.id,
            kind: "meeting",
            title: e.title,
            state: "recorded",
            summary: "Open the exact meeting and its preparation material.",
            href: route({ view: "inbox", section: "Calendar", event: e.id }),
            evidence: evidence.cited,
          };
        }),
      );
    if (ref.kind === "task")
      cards.push(
        ...visible(() => {
          const task = getTask(s, ref.id, h);
          return {
            id: "task:" + task.id,
            kind: "task",
            title: task.title,
            state: task.status,
            summary: task.outcome,
            version: task.version,
            href: route({ task: task.id }),
            evidence: task.evidence,
          };
        }),
      );
  }
  // Only validated, engine-owned links can resolve additional results. Never accept model URLs.
  for (const ref of s.all(
    "SELECT * FROM chat_result_links WHERE run_id=?",
    runId,
  )) {
    if (ref.kind === "wiki")
      cards.push(
        ...visible(() => {
          const original = wikiDetail(s, ref.record_id, h);
          const w = original.draftId
            ? wikiDetail(s, original.draftId, h)
            : original;
          return {
            id: "wiki:" + w.id,
            kind: w.status === "draft" ? "wiki-draft" : "wiki",
            title: w.title,
            state: w.state ?? w.status,
            summary: w.summary ?? "",
            version: w.version,
            href: route({
              view: "knowledge",
              section: "Wiki",
              wiki: w.pageId ?? w.id,
            }),
            evidence: w.evidence ?? [],
          };
        }),
      );
  }
  for (const ref of evidence.wiki.filter((r) => r.cited)) {
    const revisionId = (ref as any).wikiRevisionId ?? (ref as any).id;
    if (revisionId)
      cards.push(
        ...visible(() => {
          const w = wikiDetail(s, revisionId, h);
          const draft = w.draftId ? wikiDetail(s, w.draftId, h) : w;
          return {
            id: "wiki:" + draft.id,
            kind: draft.draftId === draft.id ? "wiki-draft" : "wiki",
            title: draft.title,
            state: draft.state ?? draft.status,
            summary: draft.summary ?? "",
            href: route({
              view: "knowledge",
              section: "Wiki",
              wiki: draft.pageId ?? draft.id,
            }),
            evidence: draft.evidence ?? [],
          };
        }),
      );
  }
  const events = new Set(
    refs.filter((r) => r.kind === "event").map((r) => r.id),
  );
  for (const r of listCalendarActions(s, h).filter((r) =>
    events.has(r.event.meetingId),
  ))
    cards.push({
      id: "calendar:" + r.id,
      kind: r.state === "executed" ? "action-receipt" : "preparation-block",
      title: r.event.title,
      state: r.state,
      summary:
        r.state === "executed"
          ? "Preparation event confirmed by the calendar adapter."
          : `${r.event.start} · ${r.event.timezone}`,
      href: route({
        view: "inbox",
        section: "Suggestions",
        review: "calendar",
        record: r.id,
      }),
      evidence: r.event.evidence,
    });
  return {
    runId,
    version: turn.version,
    cards: Array.from(new Map(cards.map((c) => [c.id, c])).values()),
    events: s.all(
      "SELECT id,sequence,stage,operation,recorded_at AS recordedAt FROM chat_progress WHERE run_id=? ORDER BY sequence",
      runId,
    ),
  };
}
function suggestionRows(s: Store, h: Host): ResultCard[] {
  const rows = listProposals(s, h).map(proposalCard);
  for (const r of h === "local" ? emailActions(s, h) : [])
    rows.push({
      id: "email:" + r.id,
      kind: r.state === "executed" ? "action-receipt" : "email-draft",
      title: r.proposal.subject,
      state: r.state,
      summary:
        "Review recipients, body and thread before saving a Gmail draft.",
      href: route({
        view: "inbox",
        section: "Suggestions",
        review: "email",
        record: r.id,
      }),
      evidence: r.proposal.evidence ?? [],
      updatedAt: r.updated_at,
      version: r.version,
    });
  for (const r of listCalendarActions(s, h))
    rows.push({
      id: "calendar:" + r.id,
      kind: r.state === "executed" ? "action-receipt" : "preparation-block",
      title: r.event.title,
      state: r.state,
      summary: `${r.event.start} · ${r.event.timezone}`,
      href: route({
        view: "inbox",
        section: "Suggestions",
        review: "calendar",
        record: r.id,
      }),
      evidence: r.event.evidence,
      updatedAt: r.updated_at,
      version: r.version,
    });
  for (const r of listKnowledgeReviews(s, h))
    rows.push({
      id: "knowledge:" + r.id,
      kind: "knowledge-review",
      title: r.type ?? "Knowledge review",
      state: r.current ? r.state : "superseded",
      summary:
        r.explanation ??
        r.reason ??
        "Review the finding and affected knowledge.",
      href: route({ view: "knowledge", section: "Reviews", finding: r.id }),
      evidence: r.evidence ?? [],
      version: r.version,
    });
  return rows.map((r) => ({
    ...r,
    category: "reviews",
    bucket: bucket(r.state),
  }));
}
const querySchema = z
  .object({
    bucket: z.enum(["all", "running", "attention", "completed"]).default("all"),
    category: z.enum(["all", "chat", "imports", "reviews"]).default("all"),
    cursor: z.string().max(1500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();
function page(rows: ResultCard[], input: unknown) {
  const q = querySchema.parse(input ?? {});
  const counts = { running: 0, attention: 0, completed: 0 };
  for (const r of rows) counts[r.bucket as keyof typeof counts]++;
  const ordered = rows
    .filter(
      (r) =>
        (q.bucket === "all" || r.bucket === q.bucket) &&
        (q.category === "all" || r.category === q.category),
    )
    .sort(
      (a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") ||
        a.id.localeCompare(b.id),
    );
  let offset = 0;
  if (q.cursor) {
    const n = ordered.findIndex((r) => r.id === q.cursor);
    if (n < 0) throw Error("ACTIVITY_CURSOR_STALE");
    offset = n + 1;
  }
  const items = ordered.slice(offset, offset + q.limit);
  return {
    items,
    counts,
    nextCursor:
      offset + items.length < ordered.length ? items.at(-1)!.id : null,
  };
}
export function suggestions(s: Store, h: Host, input: unknown = {}) {
  check(s, h);
  return page(suggestionRows(s, h), input);
}
export function suggestionDetail(s: Store, h: Host, id: string) {
  check(s, h);
  const r = suggestionRows(s, h).find((r) => r.id === id);
  if (!r) throw Error("SUGGESTION_UNAVAILABLE");
  return r;
}
function activityRows(s: Store, h: Host) {
  const rows = suggestionRows(s, h);
  for (const r of s.all(
    "SELECT id,run_id,updated_at FROM ai_jobs ORDER BY updated_at DESC",
  ))
    rows.push(
      ...visible(() => {
        const j = aiJob(s, r.id, h),
          c = r.run_id
            ? s.one(
                "SELECT conversation_id FROM conversation_turns WHERE run_id=?",
                r.run_id,
              )
            : null;
        // Do not duplicate prompt/context strings in the activity index.
        return {
          id: "ai:" + r.id,
          kind: "generation",
          title: r.run_id ? "Chat request" : "Source analysis",
          summary:
            j.state === "uncertain"
              ? "Outcome uncertain. Reconcile before another paid request."
              : "",
          state: j.state,
          category: "chat",
          bucket: bucket(j.state),
          jobId: j.id,
          runId: r.run_id,
          updatedAt: r.updated_at,
          href: c
            ? route({ view: "chat", conversation: c.conversation_id })
            : route({ view: "inbox", section: "Suggestions" }),
          events: r.run_id
            ? s.all(
                "SELECT sequence,stage,operation,recorded_at AS recordedAt FROM chat_progress WHERE run_id=? ORDER BY sequence",
                r.run_id,
              )
            : [],
        };
      }),
    );
  for (const j of intakeJobs(s, h))
    rows.push({
      id: "intake:" + j.id,
      kind: "import",
      title: j.name,
      state: j.state,
      summary: "Inspect the preserved item and import outcome.",
      category: "imports",
      bucket: bucket(j.state),
      updatedAt: j.updated_at,
      href: route({ view: "knowledge", section: "Ingestion" }),
    });
  for (const c of connections(s, h))
    rows.push({
      id: "sync:" + c.id,
      kind: "sync",
      title: c.label ?? c.provider,
      state: c.error ? "failed" : c.state,
      summary: c.lastSuccess
        ? "Last successful sync: " + c.lastSuccess
        : "No successful synchronization recorded.",
      category: "imports",
      bucket: c.error
        ? "attention"
        : c.state === "syncing"
          ? "running"
          : c.lastSuccess
            ? "completed"
            : "attention",
      updatedAt: c.lastSuccess ?? "",
      href: route({
        view: "configuration",
        section: "Connections",
        connection: c.id,
      }),
    });
  return rows;
}
export function activity(s: Store, h: Host, input: unknown = {}) {
  check(s, h);
  return page(activityRows(s, h), input);
}
export function activityDetail(s: Store, h: Host, id: string) {
  check(s, h);
  const r = activityRows(s, h).find((r) => r.id === id);
  if (!r) throw Error("ACTIVITY_UNAVAILABLE");
  return r;
}
