import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { ingest } from "../dist/core/intake.js";
import { writeYaml } from "../dist/core/files.js";
import { Store, migrate } from "../dist/core/store.js";
import {
  proposeCalendar,
  reviewCalendar,
  executeCalendar,
  getCalendarAction,
} from "../dist/core/calendar.js";
async function seed(t) {
  const f = fixture(t);
  await ingest(f.s, f.file("meeting.md", "Prepare Cedar meeting."), {});
  const p = f.s.one("SELECT * FROM passages LIMIT 1");
  const event = {
    calendarId: "synthetic-calendar",
    title: "Prepare Cedar",
    start: "2035-01-01T09:00:00Z",
    end: "2035-01-01T09:30:00Z",
    timezone: "Europe/Paris",
    evidence: [
      {
        revisionId: p.revision_id,
        passageId: p.id,
        quote: "Prepare Cedar meeting.",
      },
    ],
  };
  const r = proposeCalendar(f.s, event, "local");
  const approve = () =>
    reviewCalendar(
      f.s,
      { id: r.id, expectedVersion: 1, digest: r.digest, decision: "approved" },
      "local",
    );
  const policy = f.s.policy();
  policy.actions.external = "approve";
  policy.calendar = { allowedCalendars: [event.calendarId] };
  writeYaml(f.s.path("policies/actions.yaml"), policy);
  let remote = null,
    calls = 0;
  const adapter = {
    async verify() {},
    async find() {
      return remote;
    },
    async available() {
      return true;
    },
    async create(e, id, digest) {
      calls++;
      return (remote = {
        id,
        summary: e.title,
        start: { dateTime: e.start },
        end: { dateTime: e.end },
        extendedProperties: { private: { hoiDigest: digest } },
      });
    },
  };
  return { ...f, event, r, approve, adapter, calls: () => calls };
}
test("exact approval is idempotent, rejects changed digest and creates once across restart", async (t) => {
  const f = await seed(t);
  assert.throws(
    () =>
      reviewCalendar(
        f.s,
        {
          id: f.r.id,
          expectedVersion: 1,
          digest: "changed",
          decision: "approved",
        },
        "local",
      ),
    /CHANGED/,
  );
  f.approve();
  f.approve();
  await executeCalendar(f.s, f.r.id, "local", f.adapter);
  await executeCalendar(f.s, f.r.id, "local", f.adapter);
  assert.equal(f.calls(), 1);
  const s2 = new Store(f.s.root);
  assert.equal(getCalendarAction(s2, f.r.id, "local").state, "executed");
  s2.close();
});
test("lost response reconciles without duplicate creation", async (t) => {
  const f = await seed(t);
  f.approve();
  const create = f.adapter.create;
  f.adapter.create = async (...a) => {
    await create(...a);
    throw Error("response lost");
  };
  await assert.rejects(
    executeCalendar(f.s, f.r.id, "local", f.adapter),
    /UNCERTAIN/,
  );
  assert.equal(
    (await executeCalendar(f.s, f.r.id, "local", f.adapter)).state,
    "executed",
  );
  assert.equal(f.calls(), 1);
});
test("unknown send never retries after absence and concurrent execution is refused", async (t) => {
  const f = await seed(t);
  f.approve();
  f.adapter.create = async () => {
    throw Error("timeout");
  };
  await assert.rejects(
    executeCalendar(f.s, f.r.id, "local", f.adapter),
    /UNCERTAIN/,
  );
  await assert.rejects(
    executeCalendar(f.s, f.r.id, "local", f.adapter),
    /UNCERTAIN/,
  );
  assert.equal(f.calls(), 0);
});
test("conflicts, denied policy, unapproved and restricted evidence cannot send", async (t) => {
  const f = await seed(t);
  await assert.rejects(
    executeCalendar(f.s, f.r.id, "local", f.adapter),
    /NOT_APPROVED/,
  );
  f.approve();
  f.adapter.available = async () => false;
  await assert.rejects(
    executeCalendar(f.s, f.r.id, "local", f.adapter),
    /CONFLICT/,
  );
  let policy = f.s.policy();
  delete policy.calendar;
  writeYaml(f.s.path("policies/actions.yaml"), policy);
  await assert.rejects(
    executeCalendar(f.s, f.r.id, "local", f.adapter),
    /DISABLED/,
  );
  policy.deniedSources = f.s.all("SELECT id FROM sources").map((r) => r.id);
  writeYaml(f.s.path("policies/actions.yaml"), policy);
  assert.throws(() => getCalendarAction(f.s, f.r.id, "local"));
  assert.equal(f.calls(), 0);
});
test("provider mismatch stays unresolved; rejection cannot be approved later", async (t) => {
  const f = await seed(t);
  reviewCalendar(
    f.s,
    {
      id: f.r.id,
      expectedVersion: 1,
      digest: f.r.digest,
      decision: "rejected",
    },
    "local",
  );
  assert.throws(f.approve, /STALE/);
  assert.equal(proposeCalendar(f.s, f.event, "local").state, "rejected");
});
test("schema six migration preserves records", async (t) => {
  const f = fixture(t);
  f.s.db.exec("DROP TABLE calendar_actions; PRAGMA user_version=6");
  f.s.close();
  const old = new Store(f.s.root);
  migrate(old);
  old.close();
  const current = new Store(f.s.root);
  assert.equal(current.schemaVersion, 19);
  assert.deepEqual(current.all("SELECT * FROM calendar_actions"), []);
  current.close();
});
test("concurrent commands cannot send twice", async (t) => {
  const f = await seed(t);
  f.approve();
  let release;
  f.adapter.available = () =>
    new Promise((ok) => {
      release = ok;
    });
  const first = executeCalendar(f.s, f.r.id, "local", f.adapter);
  await new Promise((ok) => setImmediate(ok));
  await assert.rejects(
    executeCalendar(f.s, f.r.id, "local", f.adapter),
    /RUNNING/,
  );
  release(true);
  await first;
  assert.equal(f.calls(), 1);
});
test("provider identity mismatch blocks reconciliation", async (t) => {
  const f = await seed(t);
  f.approve();
  f.adapter.find = async () => ({ id: "other" });
  await assert.rejects(
    executeCalendar(f.s, f.r.id, "local", f.adapter),
    /MISMATCH/,
  );
  assert.equal(f.calls(), 0);
});
test("restore preserves uncertain operation identity and does not resend", async (t) => {
  const { backup, restore } = await import("../dist/core/backup.js");
  const f = await seed(t);
  f.approve();
  f.adapter.create = async () => {
    throw Error("lost");
  };
  await assert.rejects(
    executeCalendar(f.s, f.r.id, "local", f.adapter),
    /UNCERTAIN/,
  );
  backup(f.s, f.root + "/backup");
  restore(f.root + "/backup", f.root + "/restored");
  const restored = new Store(f.root + "/restored");
  t.after(() => restored.close());
  assert.equal(
    getCalendarAction(restored, f.r.id, "local").external_id,
    f.r.external_id,
  );
  await assert.rejects(
    executeCalendar(restored, f.r.id, "local", f.adapter),
    /UNCERTAIN/,
  );
});
test("Google adapter uses fixed origin, deterministic ID, private event and no attendees", async (t) => {
  const { googleCalendar } = await import("../dist/core/calendar.js");
  const f = await seed(t);
  f.approve();
  const saved = globalThis.fetch,
    token = process.env.HOI_GOOGLE_CALENDAR_ACCESS_TOKEN;
  process.env.HOI_GOOGLE_CALENDAR_ACCESS_TOKEN = "synthetic-token";
  t.after(() => {
    globalThis.fetch = saved;
    if (token === undefined)
      delete process.env.HOI_GOOGLE_CALENDAR_ACCESS_TOKEN;
    else process.env.HOI_GOOGLE_CALENDAR_ACCESS_TOKEN = token;
  });
  let sends = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).origin, "https://www.googleapis.com");
    assert.equal(options.headers.Authorization, "Bearer synthetic-token");
    if (url.includes("users/me/calendarList/"))
      return Response.json({ id: f.event.calendarId, accessRole: "owner" });
    if (url.endsWith("freeBusy"))
      return Response.json({
        calendars: { [f.event.calendarId]: { busy: [] } },
      });
    if (options.method === "GET") return new Response("", { status: 404 });
    const body = JSON.parse(options.body);
    assert.equal(body.id, f.r.external_id);
    assert.equal(body.visibility, "private");
    assert.deepEqual(body.attendees, []);
    assert.equal(new URL(url).searchParams.get("sendUpdates"), "none");
    sends++;
    return Response.json(body);
  };
  await executeCalendar(f.s, f.r.id, "local", googleCalendar());
  assert.equal(sends, 1);
});
