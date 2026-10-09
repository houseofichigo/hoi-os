import { readFileSync } from "node:fs";
import { atomic, writeYaml } from "./files.js";
import { z } from "zod";
import { Store } from "./store.js";
import { type Host } from "./schema.js";
import { uid, sha, now } from "./files.js";
import { connections, googleWriteRequest } from "./sync.js";
import { intakeDetail } from "./work-intake.js";
import { type CalendarAdapter } from "./calendar.js";
export const GOOGLE_ACTION_SQL = `CREATE TABLE IF NOT EXISTS email_actions(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,host TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,version INTEGER NOT NULL,state TEXT NOT NULL,external_id TEXT,created_at TEXT NOT NULL);`;
function access(s: Store, h: Host) {
  s.assertSchema(16, "Google drafts");
  s.assertHost(h);
  if (h !== "local" || s.policy().actions.read === "deny")
    throw Error("GOOGLE_ACTION_DENIED");
}
const header = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((v) => !/[\r\n]/.test(v), "Invalid header");
const input = z
  .object({
    key: z.string().min(1).max(200),
    intakeId: z.string(),
    connectionId: z.string(),
    to: z.array(z.string().email()).min(1).max(20),
    subject: header,
    body: z.string().trim().min(1).max(30000),
  })
  .strict();
function scope(s: Store, p: any, h: Host) {
  const d = intakeDetail(s, p.intakeId, h),
    c = connections(s, h).find((x) => x.id === p.connectionId);
  if (
    !c ||
    c.provider !== "gmail" ||
    d.kind !== "email" ||
    !s.one(
      "SELECT 1 FROM sync_items WHERE connection_id=? AND source_id=?",
      c.id,
      d.sourceId,
    )
  )
    throw Error("EMAIL_SCOPE_UNAVAILABLE");
  if (
    s.one("SELECT current_revision FROM sources WHERE id=?", d.sourceId)
      ?.current_revision !== d.revisionId
  )
    throw Error("EMAIL_SOURCE_CHANGED");
  return { d, c };
}
export function emailAction(s: Store, id: string, h: Host) {
  access(s, h);
  const r = s.one("SELECT * FROM email_actions WHERE id=? AND host=?", id, h);
  if (!r) throw Error("EMAIL_ACTION_UNAVAILABLE");
  const p = JSON.parse(r.payload);
  scope(s, p, h);
  return { ...r, payload: undefined, proposal: p };
}
export function emailActions(s: Store, h: Host) {
  access(s, h);
  return s
    .all("SELECT id FROM email_actions ORDER BY created_at DESC")
    .flatMap((r) => {
      try {
        return [emailAction(s, r.id, h)];
      } catch {
        return [];
      }
    });
}
export function proposeEmail(s: Store, v: unknown, h: Host) {
  access(s, h);
  const p = input.parse(v);
  const { d } = scope(s, p, h);
  const evidence = d.passages.map((x: any) => ({
    revisionId: d.revisionId,
    passageId: x.id,
    quote: x.text,
  }));
  s.validateEvidence(evidence, h, true);
  const payload = {
    ...p,
    threadId: d.item.threadId,
    remoteMessageId: d.item.remoteId,
    revisionId: d.revisionId,
    evidence,
  };
  const digest = sha(JSON.stringify(payload));
  const old = s.one(
    "SELECT id,digest FROM email_actions WHERE request_key=?",
    p.key,
  );
  if (old) {
    if (old.digest !== digest) throw Error("EMAIL_KEY_CONFLICT");
    return emailAction(s, old.id, h);
  }
  const id = uid("email");
  s.exec(
    "INSERT INTO email_actions VALUES(?,?,?,?,?,?,?,?,?)",
    id,
    p.key,
    h,
    JSON.stringify(payload),
    digest,
    1,
    "proposed",
    null,
    now(),
  );
  return emailAction(s, id, h);
}
export function reviewEmailAction(s: Store, v: unknown, h: Host) {
  access(s, h);
  const p = z
    .object({
      id: z.string(),
      expectedVersion: z.number().int().positive(),
      digest: z.string(),
      decision: z.enum(["approved", "rejected"]),
    })
    .strict()
    .parse(v);
  return s.tx(() => {
    const r = emailAction(s, p.id, h);
    if (r.digest !== p.digest) throw Error("EMAIL_CHANGED");
    if (r.state === p.decision && r.version === p.expectedVersion + 1) return r;
    if (r.state !== "proposed" || r.version !== p.expectedVersion)
      throw Error("STALE_EMAIL_REVIEW");
    s.exec(
      "UPDATE email_actions SET state=?,version=version+1 WHERE id=?",
      p.decision,
      r.id,
    );
    return emailAction(s, r.id, h);
  });
}
export interface GmailDraftAdapter {
  find(p: any, id: string, digest: string): Promise<any | null>;
  create(p: any, id: string, digest: string): Promise<any>;
}
export function gmailDraftAdapter(
  s: Store,
  connectionId: string,
): GmailDraftAdapter {
  const marker = (id: string) => `<${id}@hoi.local>`;
  return {
    async find(p, id, digest) {
      const all = await googleWriteRequest(
        s,
        connectionId,
        "gmail",
        "drafts?maxResults=100",
      );
      for (const d of all.drafts || []) {
        const detail = await googleWriteRequest(
          s,
          connectionId,
          "gmail",
          `drafts/${encodeURIComponent(d.id)}?format=full`,
        );
        const hs = detail.message?.payload?.headers || [];
        if (
          hs.find((h: any) => h.name.toLowerCase() === "message-id")?.value !==
          marker(id)
        )
          continue;
        if (
          hs.find((h: any) => h.name.toLowerCase() === "x-hoi-digest")
            ?.value !== digest
        )
          throw Error("EMAIL_PROVIDER_MISMATCH");
        const value = (name: string) =>
          hs.find((h: any) => h.name.toLowerCase() === name)?.value;
        const text = Buffer.from(
          detail.message?.payload?.body?.data ?? "",
          "base64url",
        ).toString("utf8");
        const subject = value("subject");
        const encodedSubject = `=?UTF-8?B?${Buffer.from(p.subject).toString("base64")}?=`;
        if (
          detail.message?.threadId !== p.threadId ||
          value("to") !== p.to.join(", ") ||
          ![p.subject, encodedSubject].includes(subject) ||
          text.replace(/\r\n/g, "\n").trimEnd() !==
            p.body.replace(/\r\n/g, "\n").trimEnd()
        )
          throw Error("EMAIL_PROVIDER_MISMATCH");
        return { id: detail.id, digest };
      }
      return null;
    },
    async create(p, id, digest) {
      const original = await googleWriteRequest(
        s,
        connectionId,
        "gmail",
        `messages/${encodeURIComponent(p.remoteMessageId)}?format=metadata`,
      );
      if (original.threadId !== p.threadId) throw Error("EMAIL_THREAD_CHANGED");
      const messageId = original.payload?.headers?.find(
        (h: any) => h.name.toLowerCase() === "message-id",
      )?.value;
      const lines = [
        `To: ${p.to.join(", ")}`,
        `Subject: =?UTF-8?B?${Buffer.from(p.subject).toString("base64")}?=`,
        `Message-ID: ${marker(id)}`,
        `X-HOI-Digest: ${digest}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
      ];
      if (messageId && !/[\r\n]/.test(messageId))
        lines.push(`In-Reply-To: ${messageId}`, `References: ${messageId}`);
      lines.push("", Buffer.from(p.body).toString("base64"));
      const result = await googleWriteRequest(
        s,
        connectionId,
        "gmail",
        "drafts",
        {
          message: {
            threadId: p.threadId,
            raw: Buffer.from(lines.join("\r\n")).toString("base64url"),
          },
        },
      );
      if (!result.id || result.message?.threadId !== p.threadId)
        throw Error("EMAIL_PROVIDER_MISMATCH");
      return { id: result.id, digest };
    },
  };
}
const busy = new Set<string>();
export async function executeEmailAction(
  s: Store,
  id: string,
  h: Host,
  adapter?: GmailDraftAdapter,
) {
  access(s, h);
  if (s.policy().actions.external === "deny")
    throw Error("EXTERNAL_ACTION_DENIED");
  const key = s.root + ":" + id;
  if (busy.has(key)) throw Error("EMAIL_RUNNING");
  busy.add(key);
  try {
    let r = emailAction(s, id, h);
    if (r.state === "executed") return r;
    if (!["approved", "executing", "uncertain"].includes(r.state))
      throw Error("EMAIL_NOT_APPROVED");
    s.validateEvidence(r.proposal.evidence, h, true);
    const { c } = scope(s, r.proposal, h);
    if (!adapter && (!c.writeActions || c.state !== "active"))
      throw Error("GOOGLE_WRITE_NOT_ENABLED");
    const a = adapter ?? gmailDraftAdapter(s, c.id),
      found = await a.find(r.proposal, id, r.digest);
    if (found) {
      if (found.digest !== r.digest) throw Error("EMAIL_PROVIDER_MISMATCH");
      s.exec(
        "UPDATE email_actions SET state='executed',external_id=?,version=version+1 WHERE id=?",
        found.id,
        id,
      );
      return emailAction(s, id, h);
    }
    if (r.state !== "approved") throw Error("EMAIL_UNCERTAIN_REVIEW_REQUIRED");
    r = emailAction(s, id, h);
    if (r.state !== "approved") throw Error("EMAIL_CHANGED");
    s.exec(
      "UPDATE email_actions SET state='executing',version=version+1 WHERE id=?",
      id,
    );
    try {
      const result = await a.create(r.proposal, id, r.digest);
      if (result.digest !== r.digest || !result.id)
        throw Error("EMAIL_PROVIDER_MISMATCH");
      s.exec(
        "UPDATE email_actions SET state='executed',external_id=?,version=version+1 WHERE id=?",
        result.id,
        id,
      );
    } catch {
      s.exec(
        "UPDATE email_actions SET state='uncertain',version=version+1 WHERE id=?",
        id,
      );
      throw Error("EMAIL_UNCERTAIN_REVIEW_REQUIRED");
    }
    return emailAction(s, id, h);
  } finally {
    busy.delete(key);
  }
}
export function connectedCalendar(
  s: Store,
  calendarId: string,
): CalendarAdapter | undefined {
  const c = connections(s, "local").find(
    (c) =>
      c.provider === "calendar" &&
      c.calendarId === calendarId &&
      c.writeActions &&
      c.state === "active",
  );
  if (!c) return undefined;
  const request = (path: string, body?: unknown) =>
      googleWriteRequest(s, c.id, "calendar", path, body),
    path = "calendars/" + encodeURIComponent(calendarId) + "/events";
  return {
    async verify(id) {
      const data = await request(
        "users/me/calendarList/" + encodeURIComponent(id),
      );
      if (data.id !== id || !["owner", "writer"].includes(data.accessRole))
        throw Error("CALENDAR_NOT_WRITABLE");
    },
    async find(_c, id) {
      try {
        return await request(path + "/" + encodeURIComponent(id));
      } catch (e) {
        if ((e as Error).message === "PROVIDER_404") return null;
        throw e;
      }
    },
    async available(e: any) {
      if (!e.meetingId) throw Error("MEETING_OCCURRENCE_REQUIRED");
      const d = intakeDetail(s, e.meetingId, "local");
      if (
        d.kind !== "calendar" ||
        !s.one(
          "SELECT 1 FROM sync_items WHERE connection_id=? AND source_id=?",
          c.id,
          d.sourceId,
        )
      )
        throw Error("MEETING_SCOPE_UNAVAILABLE");
      const live = await request(
        path + "/" + encodeURIComponent(d.item.remoteId),
      );
      if (
        live.status === "cancelled" ||
        Date.parse(live.start?.dateTime) !==
          Date.parse(d.item.calendar?.start) ||
        Date.parse(live.end?.dateTime) !== Date.parse(d.item.calendar?.end)
      )
        throw Error("MEETING_CHANGED");
      const result = await request("freeBusy", {
        timeMin: e.start,
        timeMax: e.end,
        items: [{ id: calendarId }],
      });
      const availability = result.calendars?.[calendarId];
      if (!availability || availability.errors?.length)
        throw Error("CALENDAR_COVERAGE_UNKNOWN");
      return availability.busy?.length === 0;
    },
    async create(e, id, digest) {
      return request(path, {
        id,
        summary: e.title,
        start: { dateTime: e.start, timeZone: e.timezone },
        end: { dateTime: e.end, timeZone: e.timezone },
        extendedProperties: { private: { hoiDigest: digest } },
      });
    },
  };
}

export function googlePolicyPreview(s: Store, h: Host) {
  access(s, h);
  const policy = s.policy();
  return {
    mode: policy.actions.external,
    digest: sha(JSON.stringify(policy)),
    explanation:
      "Deny blocks external writes. Approve permits only registered external operations after their exact-action review, plus separate connector permissions. No email-send operation exists.",
  };
}
export function reviewGooglePolicy(s: Store, input: unknown, h: Host) {
  access(s, h);
  const v = z
    .object({
      mode: z.enum(["deny", "approve"]),
      expectedDigest: z.string(),
      confirm: z.literal(true),
    })
    .strict()
    .parse(input);
  const policy = s.policy();
  if (sha(JSON.stringify(policy)) !== v.expectedDigest)
    throw Error("POLICY_CHANGED");
  if (policy.actions.external === v.mode) return googlePolicyPreview(s, h);
  const path = s.path("policies/actions.yaml");
  atomic(
    s.path(".hoi/policy-history/" + uid("policy") + ".yaml"),
    readFileSync(path),
  );
  policy.actions.external = v.mode;
  writeYaml(path, policy);
  s.log("google.policy.reviewed", { mode: v.mode });
  return googlePolicyPreview(s, h);
}
