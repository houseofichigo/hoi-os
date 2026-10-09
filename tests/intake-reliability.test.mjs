import test from "node:test";
import assert from "node:assert/strict";
import {
  renameSync,
  writeFileSync,
  rmSync,
  truncateSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";
import {
  ingest,
  retrieve,
  intakeJobs,
  controlIntakeJob,
} from "../dist/core/intake.js";
import {
  sourceImpact,
  changeSource,
  scanSources,
  reviewSource,
} from "../dist/core/hub.js";
import {
  createConnection,
  previewConnection,
  controlConnection,
  syncConnection,
  connections,
} from "../dist/core/sync.js";
import { htmlText, emailBody } from "../dist/core/email-text.js";
import { entity } from "../dist/core/knowledge.js";
import { mergeEntity } from "../dist/core/entity-merge.js";
import { graph } from "../dist/core/graph.js";
import { backup, restore } from "../dist/core/backup.js";
import { Store, migrate } from "../dist/core/store.js";
async function activate(s, input) {
  const c = createConnection(s, input, "local");
  const p = await previewConnection(s, c.id, "local");
  await controlConnection(
    s,
    { id: c.id, action: "activate", digest: p.digest },
    "local",
  );
  return { c, p };
}
test("verified moves preserve identity, archived renamed files stay excluded and copies remain separate", async (t) => {
  const f = fixture(t);
  const a = f.file("a.md", "Cedar source"),
    b = join(f.root, "b.md");
  const r = await ingest(f.s, a);
  renameSync(a, b);
  const moved = await ingest(f.s, b);
  assert.equal(moved.sourceId, r.sourceId);
  const copy = f.file("copy.md", "Cedar source");
  assert.notEqual((await ingest(f.s, copy)).sourceId, r.sourceId);
  const impact = sourceImpact(f.s, r.sourceId, "local");
  changeSource(
    f.s,
    {
      id: r.sourceId,
      expectedVersion: 0,
      digest: impact.digest,
      state: "archived",
    },
    "local",
  );
  renameSync(b, join(f.root, "renamed.md"));
  await assert.rejects(ingest(f.s, join(f.root, "renamed.md")), /archived/);
  assert.equal(f.s.one("SELECT COUNT(*) n FROM sources").n, 2);
});
test("sync records oversize/excluded/gap outcomes and does not advance freshness on incomplete indexing", async (t) => {
  const f = fixture(t),
    dir = join(f.root, "selected");
  mkdirSync(dir);
  writeFileSync(join(dir, "ready.md"), "Cedar");
  writeFileSync(join(dir, "unsupported.bin"), "unsupported");
  writeFileSync(join(dir, "big.txt"), "");
  truncateSync(join(dir, "big.txt"), 51 * 1024 * 1024);
  writeFileSync(join(dir, ".hidden"), "excluded");
  const { c, p } = await activate(f.s, {
    provider: "files",
    label: "Selected",
    folder: dir,
  });
  assert.ok(p.items.some((i) => i.reason === "FILE_TOO_LARGE"));
  assert.ok(p.items.some((i) => i.reason === "EXCLUDED_PATH"));
  const r = await syncConnection(f.s, c.id, "local");
  assert.equal(r.processed, 1);
  assert.equal(r.failed, 1);
  assert.ok(r.outcomes.some((i) => i.state === "extraction-gap"));
  assert.equal(connections(f.s, "local")[0].lastSuccess, null);
  assert.ok(
    f.s.one("SELECT original_path FROM revisions WHERE status='failed'"),
  );
  const ready = f.s.one("SELECT id FROM sources WHERE title='ready.md'");
  const impact = sourceImpact(f.s, ready.id, "local");
  changeSource(
    f.s,
    {
      id: ready.id,
      expectedVersion: 0,
      digest: impact.digest,
      state: "archived",
    },
    "local",
  );
  renameSync(join(dir, "ready.md"), join(dir, "moved.md"));
  const again = await syncConnection(f.s, c.id, "local");
  assert.ok(again.outcomes.some((i) => i.reason === "ARCHIVED"));
  assert.equal(f.s.one("SELECT COUNT(*) n FROM sources").n, 2);
});
test("interrupted extraction resumes from preserved bytes after input deletion without duplicate occurrence", async (t) => {
  const f = fixture(t),
    path = f.file("recover.md", "Cedar preserved original");
  const r = await ingest(f.s, path);
  rmSync(path);
  f.s.exec("UPDATE intake_jobs SET state='interrupted' WHERE id=?", r.jobId);
  f.s.exec("UPDATE revisions SET status='pending' WHERE id=?", r.revisionId);
  const count = f.s.one("SELECT COUNT(*) n FROM occurrences").n;
  const resumed = await controlIntakeJob(f.s, "local", r.jobId, "resume");
  assert.equal(resumed.status, "ready");
  assert.equal(f.s.one("SELECT COUNT(*) n FROM occurrences").n, count);
  assert.ok(retrieve(f.s, "preserved", "local").results.length);
  f.s.exec("UPDATE intake_jobs SET state='queued' WHERE id=?", r.jobId);
  await controlIntakeJob(f.s, "local", r.jobId, "cancel");
  await assert.rejects(
    controlIntakeJob(f.s, "local", r.jobId, "resume"),
    /JOB_CANCELLED/,
  );
});
test("HTML email fallback preserves visible quotes without scripts or attachment text", () => {
  const html =
    '<p>Bonjour &amp; welcome</p><script>steal()</script><img src="https://tracking.test"><blockquote>Old request</blockquote>';
  const text = htmlText(html);
  assert.match(text, /Bonjour & welcome/);
  assert.match(text, /> Old request/);
  assert.doesNotMatch(text, /steal|tracking/);
  const p = {
    parts: [
      {
        mimeType: "text/html",
        body: { data: Buffer.from(html).toString("base64url") },
      },
      {
        filename: "secret.txt",
        mimeType: "text/plain",
        body: { data: Buffer.from("attachment").toString("base64url") },
      },
    ],
  };
  assert.equal(emailBody(p), text);
});
test("entity merges are exact reviewed redirects and undo preserves original records", (t) => {
  const f = fixture(t),
    a = entity(f.s, { name: "Cedar alias", type: "client" }),
    b = entity(f.s, { name: "Cedar", type: "client" });
  const proposal = mergeEntity(f.s, "local", {
    action: "propose",
    from: a.id,
    to: b.id,
    reason: "User confirmed duplicate client",
  });
  assert.ok(graph(f.s, "local").nodes.some((n) => n.id === a.id));
  assert.throws(
    () =>
      mergeEntity(f.s, "local", {
        action: "approve",
        id: proposal.id,
        digest: "changed",
      }),
    /STALE/,
  );
  mergeEntity(f.s, "local", {
    action: "approve",
    id: proposal.id,
    digest: proposal.digest,
  });
  assert.equal(
    graph(f.s, "local").nodes.some((n) => n.id === a.id),
    false,
  );
  assert.ok(f.s.one("SELECT id FROM entities WHERE id=?", a.id));
  mergeEntity(f.s, "local", {
    action: "undo",
    id: proposal.id,
    digest: proposal.digest,
  });
  assert.ok(graph(f.s, "local").nodes.some((n) => n.id === a.id));
});
test("dismissed source findings stay dismissed across freshness refresh; schema 10 restore upgrades explicitly", async (t) => {
  const f = fixture(t),
    r = await ingest(f.s, f.file("unknown.bin", "preserved"));
  const finding = scanSources(f.s, "local")[0];
  reviewSource(f.s, { id: finding.id, decision: "keep" }, "local");
  f.s.exec(
    "UPDATE sources SET last_checked=? WHERE id=?",
    new Date().toISOString(),
    r.sourceId,
  );
  assert.equal(
    scanSources(f.s, "local").filter((r) => r.state === "pending").length,
    0,
  );
  for (const table of [
    "intake_jobs",
    "source_locations",
    "sync_checkpoints",
    "sync_run_items",
    "entity_merges",
    "knowledge_dates",
  ])
    f.s.db.exec(`DROP TABLE ${table}`);
  f.s.db.pragma("user_version = 10");
  f.s.close();
  const old = new Store(f.s.root);
  const dest = join(f.root, "backup");
  backup(old, dest);
  old.close();
  const copy = join(f.root, "restored");
  restore(dest, copy);
  const before = new Store(copy);
  migrate(before);
  before.close();
  const after = new Store(copy);
  assert.equal(after.schemaVersion, 19);
  assert.equal(after.one("SELECT COUNT(*) n FROM sources").n, 1);
  after.close();
});
test("paginated Gmail HTML intake saves checkpoints only after durable work and rescans expired history", async (t) => {
  const f = fixture(t);
  const { AsyncEntry } = await import("@napi-rs/keyring");
  t.mock.method(AsyncEntry.prototype, "getPassword", async () =>
    JSON.stringify({
      refresh_token: "synthetic",
      access_token: "synthetic",
      expires: Date.now() + 3600000,
    }),
  );
  let expired = false,
    historyCalls = 0;
  const message = (n) => ({
    id: "m" + n,
    threadId: "t" + n,
    historyId: String(n),
    internalDate: "1577836800000",
    payload: {
      mimeType: "text/html",
      headers: [{ name: "Subject", value: "Cedar " + n }],
      body: {
        data: Buffer.from("<p>Please review Cedar.</p>").toString("base64url"),
      },
    },
  });
  t.mock.method(globalThis, "fetch", async (url) => {
    const u = new URL(url);
    if (u.pathname.endsWith("/history")) {
      historyCalls++;
      return expired
        ? new Response("", { status: 404 })
        : Response.json({ historyId: "2", history: [] });
    }
    if (u.pathname.endsWith("/messages"))
      return Response.json(
        u.searchParams.has("pageToken")
          ? { messages: [{ id: "m2", threadId: "t2" }] }
          : {
              messages: [{ id: "m1", threadId: "t1" }],
              nextPageToken: "page2",
            },
      );
    if (u.pathname.includes("/threads/"))
      return Response.json({
        messages: [message(u.pathname.endsWith("t1") ? 1 : 2)],
      });
    return Response.json(message(u.pathname.endsWith("m1") ? 1 : 2));
  });
  const { c, p } = await activate(f.s, {
    provider: "gmail",
    label: "Fictional",
    query: "subject:Cedar",
  });
  assert.equal(p.items.length, 2);
  assert.equal((await syncConnection(f.s, c.id, "local")).processed, 2);
  const checkpoint = JSON.parse(
    f.s.one("SELECT payload FROM sync_checkpoints WHERE connection_id=?", c.id)
      .payload,
  );
  assert.equal(checkpoint.historyId, "2");
  expired = true;
  const next = await syncConnection(f.s, c.id, "local");
  assert.equal(next.reconciliation, "CURSOR_EXPIRED_RESCAN");
  assert.equal(next.processed, 0);
  assert.equal(historyCalls, 1);
  assert.equal(f.s.one("SELECT COUNT(*) n FROM sources").n, 2);
});
test("ambiguous vanished-file matches require review rather than merging identities", async (t) => {
  const f = fixture(t),
    a = f.file("one.md", "same"),
    b = f.file("two.md", "same");
  await ingest(f.s, a);
  await ingest(f.s, b);
  rmSync(a);
  rmSync(b);
  const c = f.file("new.md", "same");
  await assert.rejects(ingest(f.s, c), /IDENTITY_REVIEW_REQUIRED/);
  assert.equal(f.s.one("SELECT COUNT(*) n FROM sources").n, 2);
});
test("manual uploads work with canonical workspace paths without allowing vault re-ingestion", async (t) => {
  const f = fixture(t);
  const { realpathSync } = await import("node:fs");
  const { Readable } = await import("node:stream");
  const { planUpload, receiveUpload } = await import("../dist/core/hub.js");
  const { sha } = await import("../dist/core/files.js");
  const s = new Store(realpathSync(f.s.root));
  try {
    const text = "Canonical path uploaded evidence";
    const [job] = planUpload(
      s,
      {
        files: [
          {
            name: "upload.md",
            size: Buffer.byteLength(text),
            checksum: sha(text),
          },
        ],
      },
      "local",
    );
    const r = await receiveUpload(s, job.id, "local", Readable.from([text]));
    assert.equal(r.status, "ready");
    await assert.rejects(ingest(s, s.path("README.md")), /workspace storage/);
  } finally {
    s.close();
  }
});

test("Drive pagination and change cursors reconcile only selected files, preserving checkpoint on partial failure", async (t) => {
  const f = fixture(t);
  const { AsyncEntry } = await import("@napi-rs/keyring");
  t.mock.method(AsyncEntry.prototype, "getPassword", async () =>
    JSON.stringify({
      refresh_token: "fixture",
      access_token: "fixture",
      expires: Date.now() + 3600000,
    }),
  );
  let version = 1,
    fail = false;
  t.mock.method(globalThis, "fetch", async (url) => {
    const u = new URL(url);
    if (u.pathname.endsWith("/startPageToken"))
      return Response.json({ startPageToken: "start1" });
    if (u.pathname.endsWith("/changes"))
      return Response.json({ changes: [], newStartPageToken: "start2" });
    if (u.pathname.endsWith("/files"))
      return Response.json(
        u.searchParams.has("pageToken")
          ? {
              files: [
                {
                  id: "f2",
                  name: "two.md",
                  mimeType: "text/plain",
                  modifiedTime: String(version),
                },
              ],
            }
          : {
              files: [
                {
                  id: "f1",
                  name: "one.md",
                  mimeType: "text/plain",
                  modifiedTime: String(version),
                },
              ],
              nextPageToken: "next",
            },
      );
    if (fail && u.pathname.endsWith("/f2"))
      return new Response("", { status: 403 });
    return new Response("Cedar fixture content " + version);
  });
  const { c } = await activate(f.s, {
    provider: "drive",
    label: "Selected Drive",
    folderIds: ["chosen-folder"],
  });
  assert.equal((await syncConnection(f.s, c.id, "local")).processed, 2);
  const first = f.s.one(
    "SELECT payload FROM sync_checkpoints WHERE connection_id=?",
    c.id,
  ).payload;
  version = 2;
  fail = true;
  const partial = await syncConnection(f.s, c.id, "local");
  assert.equal(partial.failed, 1);
  assert.equal(
    f.s.one("SELECT payload FROM sync_checkpoints WHERE connection_id=?", c.id)
      .payload,
    first,
  );
  fail = false;
  assert.equal((await syncConnection(f.s, c.id, "local")).processed, 1);
  assert.equal(
    JSON.parse(
      f.s.one(
        "SELECT payload FROM sync_checkpoints WHERE connection_id=?",
        c.id,
      ).payload,
    ).driveToken,
    "start2",
  );
  assert.equal(f.s.one("SELECT COUNT(*) n FROM sources").n, 2);
});
test("knowledge date proposals preserve unknown effective dates and record supplied dates separately", async (t) => {
  const f = fixture(t),
    r = await ingest(f.s, f.file("date.md", "Cedar factual context"));
  const { proposeKnowledge, knowledgeDates } =
    await import("../dist/core/maintenance.js");
  const e = retrieve(f.s, "Cedar", "local").results[0];
  const input = {
    type: "semantic",
    content: "Cedar context",
    evidence: [
      { revisionId: e.revisionId, passageId: e.passageId, quote: e.quote },
    ],
  };
  const unknown = proposeKnowledge(f.s, { kind: "memory", input }, "local");
  const supplied = proposeKnowledge(
    f.s,
    {
      kind: "memory",
      input: { ...input, content: "Cedar confirmed date" },
      effectiveDate: "2026-09-01",
    },
    "local",
  );
  const dates = knowledgeDates(f.s, "local");
  assert.equal(dates.find((d) => d.id === unknown.id).effectiveDate, null);
  assert.equal(
    dates.find((d) => d.id === supplied.id).effectiveDate,
    "2026-09-01",
  );
  assert.match(dates.find((d) => d.id === supplied.id).recordedAt, /T/);
});
test("job cancellation bypasses a busy work queue without approving or deleting any source", async (t) => {
  const f = fixture(t),
    r = await ingest(f.s, f.file("cancel.md", "Preserved evidence"));
  f.s.exec("UPDATE intake_jobs SET state='queued' WHERE id=?", r.jobId);
  const { createEngineSession } = await import("../dist/core/engine.js");
  const engine = await createEngineSession(f.s);
  let release;
  const gate = new Promise((ok) => {
    release = ok;
  });
  const work = engine.enqueue(() => gate);
  try {
    const result = await engine.execute(
      "local",
      { command: "jobs", args: ["cancel", r.jobId] },
      "cancel-fixture",
    );
    assert.equal(result.state, "cancelled");
    assert.ok(f.s.one("SELECT id FROM sources WHERE id=?", r.sourceId));
  } finally {
    release();
    await work;
    await engine.stop();
  }
});

test("normalized communication jobs retain the invoking host across restricted revisions", async (t) => {
  const f = fixture(t),
    { importWork } = await import("../dist/core/work-intake.js");
  const item = {
    kind: "email",
    account: "fixture",
    remoteId: "codex-only",
    checkedAt: "2026-09-02T10:00:00Z",
    title: "Restricted fixture",
    occurredAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z",
    projectId: null,
    segments: [{ text: "Review scope" }],
    metadata: { allowedHosts: ["codex"] },
  };
  await importWork(f.s, item, "codex");
  await importWork(
    f.s,
    {
      ...item,
      updatedAt: "2026-09-02T10:00:00Z",
      segments: [{ text: "Review revised scope" }],
    },
    "codex",
  );
  assert.equal(intakeJobs(f.s, "codex").length, 2);
  assert.equal(intakeJobs(f.s, "local").length, 0);
  assert.equal(retrieve(f.s, "revised", "local").results.length, 0);
});
