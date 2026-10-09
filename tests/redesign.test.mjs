import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdirSync, writeFileSync } from "node:fs";
import { fixture } from "./helpers.mjs";
import { sha, writeYaml } from "../dist/core/files.js";
import {
  planUpload,
  receiveUpload,
  sourceImpact,
  changeSource,
  hubSources,
} from "../dist/core/hub.js";
import { retrieve } from "../dist/core/intake.js";
import {
  saveRecord,
  records,
  dashboard,
  reviewEmail,
} from "../dist/core/workspace.js";
import {
  createConnection,
  previewConnection,
  controlConnection,
  syncConnection,
  assistantQueue,
} from "../dist/core/sync.js";
import { importWork } from "../dist/core/work-intake.js";
import { configuration } from "../dist/core/configuration.js";
async function upload(f, text = "Cedar evidence ready.", name = "Cedar.md") {
  const jobs = planUpload(
    f.s,
    { files: [{ name, size: Buffer.byteLength(text), checksum: sha(text) }] },
    "local",
  );
  return receiveUpload(f.s, jobs[0].id, "local", Readable.from([text]));
}
test("streamed upload preserves evidence, archive excludes retrieval, restore recovers same identity", async (t) => {
  const f = fixture(t),
    r = await upload(f);
  assert.equal(retrieve(f.s, "Cedar", "local").results.length, 1);
  const p = sourceImpact(f.s, r.sourceId, "local");
  changeSource(
    f.s,
    { id: r.sourceId, expectedVersion: 0, digest: p.digest, state: "archived" },
    "local",
  );
  assert.equal(retrieve(f.s, "Cedar", "local").results.length, 0);
  assert.equal(hubSources(f.s, "local")[0].state, "archived");
  assert.throws(
    () =>
      changeSource(
        f.s,
        {
          id: r.sourceId,
          expectedVersion: 0,
          digest: p.digest,
          state: "active",
        },
        "local",
      ),
    /changed/,
  );
  const p2 = sourceImpact(f.s, r.sourceId, "local");
  changeSource(
    f.s,
    { id: r.sourceId, expectedVersion: 1, digest: p2.digest, state: "active" },
    "local",
  );
  assert.equal(retrieve(f.s, "Cedar", "local").results.length, 1);
});
test("uploads reject traversal, oversized and mismatched bytes; permission hides sources", async (t) => {
  const f = fixture(t);
  assert.throws(() =>
    planUpload(
      f.s,
      { files: [{ name: "../bad", size: 1, checksum: sha("a") }] },
      "local",
    ),
  );
  const [job] = planUpload(
    f.s,
    { files: [{ name: "a.md", size: 1, checksum: sha("a") }] },
    "local",
  );
  await assert.rejects(
    receiveUpload(f.s, job.id, "local", Readable.from(["ab"])),
    /failed/,
  );
  const r = await upload(f);
  const policy = f.s.policy();
  policy.deniedSources.push(r.sourceId);
  writeYaml(f.s.path("policies/actions.yaml"), policy);
  assert.equal(hubSources(f.s, "local").length, 0);
});
test("editable clients, linked projects, stale edits and empty task progress", (t) => {
  const f = fixture(t);
  const c = saveRecord(
    f.s,
    { kind: "client", expectedVersion: 0, record: { name: "Cedar" } },
    "local",
  );
  const p = saveRecord(
    f.s,
    {
      kind: "project",
      expectedVersion: 0,
      record: { name: "Launch", clientIds: [c.id], status: "in-progress" },
    },
    "local",
  );
  assert.equal(records(f.s, "project", "local")[0].clientIds[0], c.id);
  assert.throws(
    () =>
      saveRecord(
        f.s,
        {
          kind: "client",
          id: c.id,
          expectedVersion: 0,
          record: { name: "Stale" },
        },
        "local",
      ),
    /Stale/,
  );
  assert.equal(dashboard(f.s, "local").projects[0].progress.percent, null);
  assert.ok(configuration(f.s, "local").skills.length);
});
test("selected local sync requires preview, resumes safely, respects archive and queues assistant processing", async (t) => {
  const f = fixture(t);
  const folder = f.root + "/selected";
  mkdirSync(folder);
  writeFileSync(folder + "/a.md", "Cedar meeting");
  const c = createConnection(
    f.s,
    { provider: "files", label: "Selected files", folder },
    "local",
  );
  await assert.rejects(syncConnection(f.s, c.id, "local"), /Activate/);
  const p = await previewConnection(f.s, c.id, "local");
  await controlConnection(
    f.s,
    { id: c.id, action: "activate", digest: p.digest },
    "local",
  );
  assert.equal((await syncConnection(f.s, c.id, "local")).processed, 1);
  assert.equal((await syncConnection(f.s, c.id, "local")).processed, 0);
  assert.equal(assistantQueue(f.s, "local").length, 1);
  const r = hubSources(f.s, "local")[0],
    impact = sourceImpact(f.s, r.id, "local");
  changeSource(
    f.s,
    { id: r.id, expectedVersion: 0, digest: impact.digest, state: "archived" },
    "local",
  );
  writeFileSync(folder + "/a.md", "Changed Cedar meeting");
  assert.equal((await syncConnection(f.s, c.id, "local")).processed, 0);
  assert.equal(assistantQueue(f.s, "local").length, 0);
});
test("unassigned mail produces candidate, outgoing reply clears it and completed projects are not deadlines", async (t) => {
  const f = fixture(t);
  const base = {
    kind: "email",
    account: "synthetic",
    remoteId: "m1",
    threadId: "t1",
    title: "Please reply",
    occurredAt: "2020-01-01T12:00:00Z",
    updatedAt: "2020-01-01T12:00:00Z",
    checkedAt: new Date().toISOString(),
    segments: [{ text: "Can you confirm?" }],
    email: {
      direction: "incoming",
      sender: "cedar@example.test",
      recipients: ["owner@example.test"],
    },
  };
  await importWork(f.s, base, "local");
  let d = dashboard(f.s, "local");
  assert.equal(d.emails.length, 1);
  reviewEmail(
    f.s,
    { id: d.emails[0].id, digest: d.emails[0].digest, state: "dismissed" },
    "local",
  );
  assert.equal(dashboard(f.s, "local").emails.length, 0);
  await importWork(
    f.s,
    {
      ...base,
      remoteId: "m2",
      occurredAt: "2020-01-02T12:00:00Z",
      updatedAt: "2020-01-02T12:00:00Z",
      email: { ...base.email, direction: "outgoing" },
    },
    "local",
  );
  assert.equal(dashboard(f.s, "local").emails.length, 0);
  saveRecord(
    f.s,
    {
      kind: "project",
      expectedVersion: 0,
      record: { name: "Done", status: "completed", dueDate: "2020-01-01" },
    },
    "local",
  );
  assert.equal(dashboard(f.s, "local").deadlines.length, 0);
});
test("Google Gmail intake includes selected thread replies, preserves quote boundaries and handles revoked auth", async (t) => {
  const { AsyncEntry } = await import("@napi-rs/keyring");
  const { emailSegments } = await import("../dist/core/sync.js");
  assert.deepEqual(
    emailSegments("Confirm Monday.\nOn Tuesday someone wrote:\nOld promise."),
    [
      { text: "Confirm Monday.", quoted: false },
      { text: "On Tuesday someone wrote:\nOld promise.", quoted: true },
    ],
  );
  const f = fixture(t);
  t.mock.method(AsyncEntry.prototype, "getPassword", async () =>
    JSON.stringify({
      access_token: "synthetic",
      refresh_token: "synthetic",
      expires: Date.now() + 600000,
    }),
  );
  const c = createConnection(
    f.s,
    { provider: "gmail", label: "Fixture Gmail", query: "subject:Cedar" },
    "local",
  );
  const incoming = {
    id: "m1",
    threadId: "t1",
    historyId: "1",
    labelIds: ["INBOX"],
    internalDate: "1577880000000",
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "Subject", value: "Cedar" },
        { name: "From", value: "client@example.test" },
      ],
      body: { data: Buffer.from("Please confirm.").toString("base64url") },
    },
  };
  const outgoing = {
    ...incoming,
    id: "m2",
    historyId: "2",
    labelIds: ["SENT"],
    internalDate: "1577966400000",
  };
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).includes("messages?"))
      return Response.json({ messages: [{ id: "m1", threadId: "t1" }] });
    if (String(url).includes("/threads/"))
      return Response.json({ messages: [incoming, outgoing] });
    return Response.json(String(url).includes("/m1?") ? incoming : outgoing);
  });
  const p = await previewConnection(f.s, c.id, "local");
  assert.equal(p.items.length, 2);
  await controlConnection(
    f.s,
    { id: c.id, action: "activate", digest: p.digest },
    "local",
  );
  assert.equal((await syncConnection(f.s, c.id, "local")).processed, 2);
  assert.equal(dashboard(f.s, "local").emails.length, 0);
  assert.equal(assistantQueue(f.s, "local").length, 2);
});
test("missing credentials fail closed before provider calls", async (t) => {
  const { AsyncEntry } = await import("@napi-rs/keyring");
  const f = fixture(t);
  t.mock.method(AsyncEntry.prototype, "getPassword", async () => undefined);
  let called = false;
  t.mock.method(globalThis, "fetch", async () => {
    called = true;
    throw Error();
  });
  const c = createConnection(
    f.s,
    { provider: "gmail", label: "No credentials", query: "label:Pilot" },
    "local",
  );
  await assert.rejects(previewConnection(f.s, c.id, "local"), /RECONNECT/);
  assert.equal(called, false);
});
test("archive exclusion survives a second folder connection and denied duplicate uploads cannot broaden permissions", async (t) => {
  const f = fixture(t),
    folder = f.root + "/files";
  mkdirSync(folder);
  writeFileSync(folder + "/a.md", "Cedar archived");
  async function activate() {
    const c = createConnection(
      f.s,
      { provider: "files", label: "Files", folder },
      "local",
    );
    const p = await previewConnection(f.s, c.id, "local");
    await controlConnection(
      f.s,
      { id: c.id, action: "activate", digest: p.digest },
      "local",
    );
    return c;
  }
  const a = await activate();
  await syncConnection(f.s, a.id, "local");
  const source = hubSources(f.s, "local")[0],
    p = sourceImpact(f.s, source.id, "local");
  changeSource(
    f.s,
    { id: source.id, expectedVersion: 0, digest: p.digest, state: "archived" },
    "local",
  );
  const b = await activate();
  assert.equal((await syncConnection(f.s, b.id, "local")).processed, 0);
  const r = await upload(f, "Private data", "private.md");
  const policy = f.s.policy();
  policy.deniedSources.push(r.sourceId);
  writeYaml(f.s.path("policies/actions.yaml"), policy);
  await assert.rejects(upload(f, "Private data", "private.md"), /failed/);
});
test("OAuth uses state, PKCE, OS credential storage and verifies provider identity", async (t) => {
  const { AsyncEntry } = await import("@napi-rs/keyring");
  const { oauthStart } = await import("../dist/core/sync.js");
  const { get } = await import("node:http");
  const f = fixture(t);
  let stored = "";
  t.mock.method(AsyncEntry.prototype, "setPassword", async (value) => {
    stored = value;
  });
  t.mock.method(AsyncEntry.prototype, "getPassword", async () => stored);
  t.mock.method(globalThis, "fetch", async (url) =>
    String(url).includes("/token")
      ? Response.json({
          access_token: "synthetic",
          refresh_token: "synthetic-refresh",
          expires_in: 3600,
        })
      : Response.json({ id: "fictional-account", email: "fake@example.test" }),
  );
  const c = createConnection(
    f.s,
    { provider: "gmail", label: "OAuth fixture", query: "label:pilot" },
    "local",
  );
  const result = await oauthStart(
    f.s,
    c.id,
    {
      clientId: "fake.apps.googleusercontent.com",
      clientSecret: "synthetic-secret",
    },
    "local",
  );
  const u = new URL(result.url);
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  const callback = new URL(u.searchParams.get("redirect_uri"));
  callback.search = new URLSearchParams({
    state: u.searchParams.get("state"),
    code: "synthetic-code",
  });
  await new Promise((ok, bad) =>
    get(callback, (res) => {
      res.resume();
      res.on("end", () =>
        res.statusCode === 200 ? ok() : bad(Error("callback failed")),
      );
    }).on("error", bad),
  );
  assert.equal(JSON.parse(stored).refresh_token, "synthetic-refresh");
  const row = f.s.one("SELECT * FROM sync_connections WHERE id=?", c.id);
  assert.equal(row.state, "needs-preview");
  assert.ok(!JSON.stringify(row).includes("synthetic-secret"));
  assert.equal(JSON.parse(row.payload).accountId, "fictional-account");
});
test("schema seven backup restores elsewhere and migrates without losing original identity", async (t) => {
  const { Store, migrate } = await import("../dist/core/store.js");
  const { backup, restore } = await import("../dist/core/backup.js");
  const f = fixture(t),
    r = await upload(f);
  f.s.db.exec("PRAGMA user_version=7");
  f.s.close();
  const old = new Store(f.s.root);
  backup(old, f.root + "/old-backup");
  old.close();
  restore(f.root + "/old-backup", f.root + "/restored workspace");
  const copy = new Store(f.root + "/restored workspace");
  migrate(copy);
  copy.close();
  const current = new Store(f.root + "/restored workspace");
  t.after(() => current.close());
  assert.equal(current.schemaVersion, 19);
  assert.equal(
    current.one("SELECT id FROM sources WHERE id=?", r.sourceId).id,
    r.sourceId,
  );
  assert.equal(retrieve(current, "Cedar", "local").results.length, 1);
});
