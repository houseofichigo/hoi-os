import { z } from "zod";
import { Store } from "./store.js";
import { type Host } from "./schema.js";
import { listTasks, listProjects, getProject } from "./tasks.js";
import { intakeList } from "./work-intake.js";
import { retrieve } from "./intake.js";
import { context, connect } from "./knowledge.js";
const zone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Invalid timezone");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const dailyOptions = z
  .object({
    date: z.string().date(),
    timezone: zone,
    owner: z.string().max(300).nullable().default(null),
    projectId: z.string().optional(),
    workStart: clock.default("09:00"),
    workEnd: clock.default("18:00"),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .default([1, 2, 3, 4, 5]),
    prepMinutes: z.number().int().min(15).max(240).default(30),
    bufferMinutes: z.number().int().min(0).max(120).default(15),
    coverage: z
      .object({
        from: z.string().datetime({ offset: true }),
        to: z.string().datetime({ offset: true }),
        checkedAt: z.string().datetime({ offset: true }),
        complete: z.boolean(),
      })
      .strict()
      .refine(
        (v) => Date.parse(v.to) > Date.parse(v.from),
        "Invalid coverage range",
      )
      .optional(),
  })
  .strict()
  .refine((v) => v.workEnd > v.workStart, "Working hours must end after start");
export function localParts(ms: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(ms)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
// Enumerate actual zone offsets around the requested date; ambiguous/nonexistent wall times fail closed.
export function wallInstant(date: string, time: string, tz: string) {
  const base = Date.parse(`${date}T${time}:00Z`),
    offsets = new Set<number>();
  for (let h = -36; h <= 36; h += 6) {
    const ms = base + h * 3600000,
      p = localParts(ms, tz);
    offsets.add(Date.parse(`${p.date}T${p.time}:00Z`) - ms);
  }
  const found = [...offsets]
    .map((o) => base - o)
    .filter((ms) => {
      const p = localParts(ms, tz);
      return p.date === date && p.time === time;
    });
  return found.length === 1 ? found[0] : null;
}
const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10);
function events(s: Store, h: Host) {
  const visible = new Set(intakeList(s, h).map((r) => r.id));
  return s
    .all(
      "SELECT w.* FROM work_intake w JOIN sources s ON w.source_id=s.id AND w.revision_id=s.current_revision WHERE w.state=? ORDER BY w.rowid",
      "ready",
    )
    .filter(
      (r, index, rows) =>
        visible.has(r.id) &&
        !rows.slice(index + 1).some((next) => next.source_id === r.source_id),
    )
    .flatMap((r) => {
      const i = JSON.parse(r.item);
      if (!i.projectId && s.schemaVersion >= 10)
        i.projectId = s.one(
          "SELECT project_id FROM work_assignments WHERE item_key=?",
          r.item_key,
        )?.project_id;
      if (i.kind !== "calendar") return [];
      const refs = s
        .all("SELECT id,text FROM passages WHERE revision_id=?", r.revision_id)
        .map((p) => ({
          revisionId: r.revision_id,
          passageId: p.id,
          quote: p.text,
        }));
      return [
        {
          id: r.id,
          projectId: i.projectId,
          title: i.title,
          recurrenceId: i.recurrenceId,
          cancelled: i.cancelled,
          checkedAt: i.checkedAt,
          timezone: i.timezone,
          timing: i.calendar ?? null,
          evidence: refs,
        },
      ];
    });
}
export function dailyView(s: Store, input: unknown, h: Host, at = new Date()) {
  s.assertSchema(4, "Daily work");
  s.assertHost(h);
  const o = dailyOptions.parse(input),
    now = at.getTime();
  if (o.projectId) getProject(s, o.projectId, h);
  const all = listTasks(s, h),
    tasks = all.filter((t) => !o.projectId || t.projectId === o.projectId);
  const active = tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  const priorities = active
    .map((t) => {
      let reason = "No recorded deadline",
        score = 0;
      if (t.dueDate) {
        const instant = t.dueTime
          ? wallInstant(t.dueDate, t.dueTime, t.timezone)
          : null;
        const deadlineDate =
          instant !== null ? localParts(instant, o.timezone).date : t.dueDate;
        const local = o.date;
        if (deadlineDate < local) {
          score = 100;
          reason = "Overdue recorded date";
        } else if (deadlineDate === local) {
          score = 80;
          reason = "Due today";
        } else {
          score = 20;
          reason = `Upcoming deadline: ${t.dueDate}`;
        }
        if (t.dueTime) {
          const instant = wallInstant(t.dueDate, t.dueTime, t.timezone);
          if (instant === null)
            reason += "; ambiguous or nonexistent local time needs review";
          else if (
            instant < now &&
            o.date === localParts(now, o.timezone).date
          ) {
            score = 100;
            reason = "Overdue recorded time";
          }
        }
      }
      if (["waiting", "blocked"].includes(t.status)) {
        score -= 30;
        reason += `; ${t.status}: follow-up or unblock first`;
      }
      if (!t.evidenceCurrent) reason += "; evidence needs review";
      return { ...t, priority: score, reason };
    })
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
        a.id.localeCompare(b.id),
    );
  const allEvents = events(s, h),
    endDate = addDays(o.date, 7),
    start = wallInstant(o.date, "00:00", o.timezone),
    end = wallInstant(endDate, "00:00", o.timezone);
  if (start === null || end === null)
    throw Error("Week boundary is ambiguous in this timezone");
  const week = allEvents.filter(
    (e) =>
      !e.cancelled &&
      e.timing &&
      Date.parse(e.timing.start) < end &&
      Date.parse(e.timing.end) > start,
  );
  const gaps: string[] = [];
  const registry = connect(s);
  for (const provider of ["gmail", "calendar", "drive"])
    if (
      !registry.connections.some(
        (c: any) =>
          c.provider === provider &&
          c.host === h &&
          c.status === "available" &&
          Date.parse(c.checkedAt) <= now &&
          now - Date.parse(c.checkedAt) <= 86400000,
      )
    )
      gaps.push(
        `${provider} connection unavailable for this host; selected exports only.`,
      );
  const visibleIds = new Set(intakeList(s, h).map((e) => e.id));
  const hiddenCalendar = s
    .all("SELECT * FROM work_intake")
    .some(
      (r) =>
        JSON.parse(r.item).kind === "calendar" &&
        !visibleIds.has(r.id) &&
        s.one("SELECT current_revision FROM sources WHERE id=?", r.source_id)
          ?.current_revision === r.revision_id,
    );
  const pendingCalendar = s
    .all(
      "SELECT item,state FROM work_intake w WHERE NOT EXISTS (SELECT 1 FROM work_intake newer WHERE newer.item_key=w.item_key AND newer.rowid>w.rowid AND newer.state='ready')",
    )
    .some((r) => JSON.parse(r.item).kind === "calendar" && r.state !== "ready");
  const timingMissing =
    pendingCalendar || allEvents.some((e) => !e.cancelled && !e.timing);
  if (timingMissing)
    gaps.push(
      "Some calendar exports are unfinished or lack explicit start/end times.",
    );
  if (hiddenCalendar)
    gaps.push("Calendar availability cannot be verified for this host.");
  const stale = week.some(
    (e) =>
      Date.parse(e.checkedAt) > now || now - Date.parse(e.checkedAt) > 86400000,
  );
  if (stale)
    gaps.push("Calendar exports are stale or have future check timestamps.");
  const c = o.coverage;
  const complete =
    !!c &&
    c.complete &&
    Date.parse(c.from) <= start &&
    Date.parse(c.to) >= end &&
    Date.parse(c.checkedAt) <= now &&
    now - Date.parse(c.checkedAt) <= 86400000;
  if (!complete)
    gaps.push(
      "Complete, recently checked availability for this seven-day window has not been confirmed.",
    );
  const slots: any[] = [],
    reserved: { start: number; end: number }[] = week
      .filter((e) => e.timing.busy)
      .map((e) => ({
        start: Date.parse(e.timing.start) - o.bufferMinutes * 60000,
        end: Date.parse(e.timing.end) + o.bufferMinutes * 60000,
      }));
  const selected = week
    .filter((e) => !o.projectId || e.projectId === o.projectId)
    .sort((a, b) => Date.parse(a.timing.start) - Date.parse(b.timing.start));
  for (const e of selected) {
    if (e.timing.allDay || Date.parse(e.timing.start) <= now) continue;
    let slot: null | { start: number; end: number } = null;
    if (complete && !stale && !timingMissing && !hiddenCalendar) {
      // Search latest available preparation time before this exact event instance.
      for (let day = 6; day >= 0 && !slot; day--) {
        const date = addDays(o.date, day);
        if (!o.weekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay()))
          continue;
        const a = wallInstant(date, o.workStart, o.timezone),
          b = wallInstant(date, o.workEnd, o.timezone);
        if (a === null || b === null) continue;
        const limit = Math.min(
          b,
          Date.parse(e.timing.start) - o.bufferMinutes * 60000,
        );
        for (
          let stop = Math.floor(limit / 900000) * 900000;
          stop - o.prepMinutes * 60000 >= Math.max(a, now);
          stop -= 900000
        ) {
          const begin = stop - o.prepMinutes * 60000;
          if (!reserved.some((r) => begin < r.end && stop > r.start)) {
            slot = { start: begin, end: stop };
            break;
          }
        }
      }
    }
    if (slot)
      reserved.push({
        start: slot.start - o.bufferMinutes * 60000,
        end: slot.end + o.bufferMinutes * 60000,
      });
    slots.push({
      eventId: e.id,
      title: e.title,
      start: slot ? new Date(slot.start).toISOString() : null,
      end: slot ? new Date(slot.end).toISOString() : null,
      reason: slot
        ? "Free in confirmed exported availability, within working hours and before this event; recheck before booking."
        : complete && !stale && !timingMissing && !hiddenCalendar
          ? "No fitting preparation slot."
          : "Availability incomplete; no slot suggested.",
      evidence: e.evidence,
    });
  }
  if (!o.owner)
    gaps.push("Choose your recorded owner name to identify your promises.");
  return {
    date: o.date,
    timezone: o.timezone,
    projects: listProjects(s, h),
    priorities,
    promises: active.filter((t) => !!o.owner && t.owner === o.owner),
    waitingFor: active.filter((t) => t.status === "waiting"),
    kanban: tasks,
    week: selected,
    slots,
    gaps,
    coverage: {
      complete: complete && !stale && !timingMissing && !hiddenCalendar,
      mode: "Selected exports; no calendar writes",
    },
    settings: o,
  };
}
export function projectMeetingContext(
  s: Store,
  projectEntity: string,
  h: Host,
) {
  if (s.schemaVersion < 3) return { tasks: [], decisions: [] };
  const project = listProjects(s, h).find((p) => p.entity_id === projectEntity);
  if (!project) return { tasks: [], decisions: [] };
  const tasks = listTasks(s, h).filter(
    (t) =>
      t.projectId === project.id && !["done", "cancelled"].includes(t.status),
  );
  const decisions = context(s, h, {
    entities: [projectEntity],
  }).memories.filter(
    (m: any) => m.type === "decision" && m.entities.includes(projectEntity),
  );
  return { tasks, decisions };
}
export function prepareDailyMeeting(s: Store, eventId: string, h: Host) {
  s.assertSchema(4, "Meeting preparation");
  s.assertHost(h);
  const event = events(s, h).find((e) => e.id === eventId && !e.cancelled);
  if (!event || !event.timing) throw Error("Current timed event unavailable");
  const p = event.projectId ? getProject(s, event.projectId, h) : null;
  const related = p
    ? projectMeetingContext(s, p.entity_id, h)
    : {
        tasks: listTasks(s, h).filter(
          (t) =>
            !t.projectId &&
            !["done", "cancelled"].includes(t.status) &&
            t.evidence.some((e: any) =>
              event.evidence.some(
                (a) =>
                  a.revisionId === e.revisionId && a.passageId === e.passageId,
              ),
            ),
        ),
        decisions: [],
      };
  const docs = retrieve(s, p ? "" : event.title, h, {
    ...(p ? { project: p.entity_id } : {}),
    limit: 12,
    latest: true,
  });
  const gaps = [
    "Client identity and objectives must be confirmed.",
    "Selected event export; live calendar state is not verified.",
  ];
  if (!event.timing.participants.length) gaps.push("Participants unknown.");
  if (!docs.results.length) gaps.push("No permitted project documents found.");
  if (docs.coverage.truncated)
    gaps.push("Project document coverage is truncated.");
  if (
    Date.now() - Date.parse(event.checkedAt) > 86400000 ||
    Date.parse(event.checkedAt) > Date.now()
  )
    gaps.push("Event export check is stale or in the future.");
  if (related.tasks.some((t) => !t.evidenceCurrent))
    gaps.push("Some task evidence needs review.");
  const result = {
    event,
    project: p ? { id: p.id, name: p.name, objective: p.objective } : null,
    ...related,
    documents: docs.results,
    gaps,
    questions: [
      "What needs a decision?",
      "Which open commitments need confirmation?",
    ],
  };
  if (JSON.stringify(result).length > s.policy().maxContextChars)
    throw Error(
      "Meeting context exceeds budget; narrow the project or resolve source coverage before preparing.",
    );
  return result;
}
