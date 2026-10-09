import { connectedCalendar } from "./google-actions.js";
import { z } from "zod";
import { Store } from "./store.js";
import { evidence, id, type Host } from "./schema.js";
import { uid, now, sha } from "./files.js";
export const CALENDAR_SQL = `CREATE TABLE IF NOT EXISTS calendar_actions(id TEXT PRIMARY KEY, host TEXT NOT NULL, state TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL, digest TEXT NOT NULL, external_id TEXT NOT NULL, created_at TEXT NOT NULL);`;
const eventSchema = z
  .object({
    meetingId: id.optional(),
    calendarId: z
      .string()
      .min(1)
      .max(500)
      .refine((v) => v !== "primary", "Use the verified concrete calendar ID"),
    title: z.string().min(1).max(200),
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
    evidence: z.array(evidence).min(1).max(20),
  })
  .strict()
  .refine(
    (v) =>
      Date.parse(v.end) > Date.parse(v.start) &&
      Date.parse(v.end) - Date.parse(v.start) <= 14400000,
    "Invalid preparation duration",
  );
type Event = z.infer<typeof eventSchema>;
export interface CalendarAdapter {
  verify(calendar: string): Promise<void>;
  find(calendar: string, eventId: string): Promise<any | null>;
  available(event: Event): Promise<boolean>;
  create(event: Event, eventId: string, digest: string): Promise<any>;
}
function access(s: Store, h: Host) {
  s.assertSchema(7, "Calendar actions");
  s.assertHost(h);
  if (s.policy().actions.read === "deny") throw Error("CALENDAR_DENIED");
}
export function getCalendarAction(s: Store, key: string, h: Host) {
  access(s, h);
  const row = s.one("SELECT * FROM calendar_actions WHERE id=?", id.parse(key));
  if (!row || row.host !== h) throw Error("CALENDAR_UNAVAILABLE");
  const event = eventSchema.parse(JSON.parse(row.payload));
  s.validateEvidence(event.evidence, h, true);
  if (sha(JSON.stringify(event)) !== row.digest)
    throw Error("CALENDAR_CHANGED");
  return { ...row, event, payload: undefined };
}
export function listCalendarActions(s: Store, h: Host) {
  access(s, h);
  return s
    .all("SELECT id FROM calendar_actions ORDER BY created_at DESC")
    .flatMap((r) => {
      try {
        return [getCalendarAction(s, r.id, h)];
      } catch {
        return [];
      }
    });
}
export function proposeCalendar(s: Store, input: unknown, h: Host) {
  access(s, h);
  if (s.policy().actions.draft === "deny") throw Error("CALENDAR_DENIED");
  const event = eventSchema.parse(input);
  s.validateEvidence(event.evidence, h, true);
  const digest = sha(JSON.stringify(event));
  const existing = s.one(
    "SELECT id FROM calendar_actions WHERE digest=? AND host=?",
    digest,
    h,
  );
  if (existing) return getCalendarAction(s, existing.id, h);
  const key = uid("cal");
  s.exec(
    "INSERT INTO calendar_actions VALUES(?,?,?,?,?,?,?,?)",
    key,
    h,
    "proposed",
    1,
    JSON.stringify(event),
    digest,
    sha(key),
    now(),
  );
  return getCalendarAction(s, key, h);
}
const review = z
  .object({
    id,
    expectedVersion: z.number().int().positive(),
    digest: z.string(),
    decision: z.enum(["approved", "rejected"]),
  })
  .strict();
export function reviewCalendar(s: Store, input: unknown, h: Host) {
  const v = review.parse(input);
  return s.tx(() => {
    const r = getCalendarAction(s, v.id, h);
    if (r.digest !== v.digest) throw Error("CALENDAR_CHANGED");
    if (r.state === v.decision && r.version === v.expectedVersion + 1) return r;
    if (r.version !== v.expectedVersion || r.state !== "proposed")
      throw Error("CALENDAR_STALE_REVIEW");
    s.exec(
      "UPDATE calendar_actions SET state=?,version=version+1 WHERE id=?",
      v.decision,
      r.id,
    );
    s.log("calendar.review", {
      id: r.id,
      decision: v.decision,
      digest: r.digest,
    });
    return getCalendarAction(s, r.id, h);
  });
}
function matches(value: any, r: any) {
  return (
    value?.id === r.external_id &&
    value?.status !== "cancelled" &&
    value?.extendedProperties?.private?.hoiDigest === r.digest &&
    value.summary === r.event.title &&
    Date.parse(value.start?.dateTime) === Date.parse(r.event.start) &&
    Date.parse(value.end?.dateTime) === Date.parse(r.event.end)
  );
}
const running = new Set<string>();
export async function executeCalendar(
  s: Store,
  key: string,
  h: Host,
  adapter?: CalendarAdapter,
) {
  const lock = s.root + ":calendar-execution";
  if (running.has(lock)) throw Error("CALENDAR_RUNNING");
  running.add(lock);
  try {
    let r = getCalendarAction(s, key, h);
    if (s.policy().actions.external === "deny")
      throw Error("EXTERNAL_ACTION_DENIED");
    const connected =
      s.schemaVersion >= 16
        ? connectedCalendar(s, r.event.calendarId)
        : undefined;
    adapter = adapter ?? connected ?? googleCalendar();

    if (r.state === "executed") return r;
    if (!["approved", "executing", "uncertain"].includes(r.state))
      throw Error("CALENDAR_NOT_APPROVED");
    if (
      !connected &&
      !(s.policy() as any).calendar?.allowedCalendars.includes(
        r.event.calendarId,
      )
    )
      throw Error("CALENDAR_WRITES_DISABLED");
    await adapter.verify(r.event.calendarId);
    const found = await adapter.find(r.event.calendarId, r.external_id);
    if (found) {
      if (!matches(found, r)) throw Error("CALENDAR_PROVIDER_MISMATCH");
      s.exec(
        "UPDATE calendar_actions SET state='executed',version=version+1 WHERE id=?",
        r.id,
      );
      return getCalendarAction(s, key, h);
    }
    // An interrupted send is never retried automatically, even when GET currently returns 404.
    if (r.state !== "approved")
      throw Error(
        "CALENDAR_UNCERTAIN: No verified event found. Reconcile with the provider; do not create another proposal.",
      );
    if (Date.parse(r.event.start) <= Date.now()) throw Error("CALENDAR_PAST");
    if (!(await adapter.available(r.event))) throw Error("CALENDAR_CONFLICT");
    r = getCalendarAction(s, key, h);
    if (
      r.state !== "approved" ||
      (!connected &&
        !(s.policy() as any).calendar?.allowedCalendars.includes(
          r.event.calendarId,
        ))
    )
      throw Error("CALENDAR_CHANGED");
    s.tx(() => {
      const changed = s.exec(
        "UPDATE calendar_actions SET state='executing',version=version+1 WHERE id=? AND state='approved' AND version=?",
        r.id,
        r.version,
      );
      if (!changed.changes) throw Error("CALENDAR_RUNNING");
    });
    try {
      const created = await adapter.create(r.event, r.external_id, r.digest);
      if (!matches(created, r)) throw Error("CALENDAR_PROVIDER_MISMATCH");
      s.exec(
        "UPDATE calendar_actions SET state='executed',version=version+1 WHERE id=?",
        r.id,
      );
      s.log("calendar.executed", { id: r.id });
    } catch {
      s.exec(
        "UPDATE calendar_actions SET state='uncertain',version=version+1 WHERE id=?",
        r.id,
      );
      throw Error(
        "CALENDAR_UNCERTAIN: Reconcile this action before any retry.",
      );
    }
    return getCalendarAction(s, key, h);
  } finally {
    running.delete(lock);
  }
}
// Credentials stay in the process environment, never in workspace files or diagnostics.
export function googleCalendar(): CalendarAdapter {
  async function request(path: string, body?: unknown, missing = false) {
    const token = process.env.HOI_GOOGLE_CALENDAR_ACCESS_TOKEN;
    if (!token)
      throw Error(
        "CALENDAR_NOT_CONFIGURED: Supply a Google OAuth access token to the server process.",
      );
    const res = await fetch("https://www.googleapis.com/calendar/v3/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (missing && res.status === 404) return null;
    if (!res.ok) throw Error("CALENDAR_PROVIDER_ERROR_" + res.status);
    return res.json() as Promise<any>;
  }
  const path = (c: string) => "calendars/" + encodeURIComponent(c) + "/events";
  return {
    async verify(c) {
      const v = await request("users/me/calendarList/" + encodeURIComponent(c));
      if (v.id !== c || !["owner", "writer"].includes(v.accessRole))
        throw Error("CALENDAR_NOT_WRITABLE");
    },
    find(c, e) {
      return request(path(c) + "/" + encodeURIComponent(e), undefined, true);
    },
    async available(e) {
      const v = await request("freeBusy", {
        timeMin: e.start,
        timeMax: e.end,
        timeZone: e.timezone,
        items: [{ id: e.calendarId }],
      });
      const c = v.calendars?.[e.calendarId];
      if (!c || c.errors?.length || !Array.isArray(c.busy))
        throw Error("CALENDAR_COVERAGE_UNAVAILABLE");
      return c.busy.length === 0;
    },
    create(e, eventId, digest) {
      return request(path(e.calendarId) + "?sendUpdates=none", {
        id: eventId,
        summary: e.title,
        start: { dateTime: e.start, timeZone: e.timezone },
        end: { dateTime: e.end, timeZone: e.timezone },
        visibility: "private",
        transparency: "opaque",
        attendees: [],
        extendedProperties: { private: { hoiDigest: digest } },
      });
    },
  };
}
