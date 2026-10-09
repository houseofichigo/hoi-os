import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fixture } from "./helpers.mjs";
import { serve } from "../dist/core/server.js";
import { inspectLock } from "../dist/core/locks.js";
import { callEngine, readEngineCredential } from "../dist/core/engine.js";
import { entity } from "../dist/core/knowledge.js";
import { createProject, listTasks } from "../dist/core/tasks.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import { Store } from "../dist/core/store.js";
const exec = promisify(execFile);
const cli = (workspace, host, ...args) =>
  exec(
    process.execPath,
    [
      "bin/hoi.mjs",
      ...args,
      "--workspace",
      workspace,
      "--host",
      host,
      "--json",
    ],
    { cwd: resolve("."), timeout: 20000 },
  ).then((r) => JSON.parse(r.stdout));
const close = (r) =>
  new Promise((ok, bad) => r.server.close((e) => (e ? bad(e) : ok())));
async function seed(t) {
  const f = fixture(t),
    e = entity(f.s, { name: "Cedar", type: "project" }),
    project = createProject(
      f.s,
      { entityId: e.id, objective: "Prepare reviewed proposal" },
      "local",
    );
  const evidence = [];
  for (const kind of ["email", "transcript", "calendar"]) {
    await ingest(
      f.s,
      f.file(kind + ".md", `Cedar ${kind}: deliver the reviewed proposal.`),
    );
    const r = retrieve(f.s, kind, "codex").results[0];
    evidence.push({
      revisionId: r.revisionId,
      passageId: r.passageId,
      quote: r.quote,
    });
  }
  return { ...f, project, evidence };
}
test("running app and fresh CLI clients share ownership; proposal approved once survives restart", async (t) => {
  const f = await seed(t),
    r = await serve(f.s, "local", resolve("dist/web"), 0, { app: true });
  try {
    assert.equal(inspectLock(f.s.root).state, "active");
    assert.ok(
      (await cli(f.s.root, "codex", "retrieve", "Cedar")).results.length,
    );
    const input = f.file(
      "proposal.json",
      JSON.stringify({
        key: "cedar-shared-engine",
        task: {
          projectId: f.project.id,
          title: "Deliver Cedar proposal",
          outcome: "Client receives reviewed proposal",
        },
        evidence: f.evidence,
      }),
    );
    const [p, other] = await Promise.all([
      cli(
        f.s.root,
        "codex",
        "task",
        "propose",
        "--input",
        input,
        "--request-id",
        "proposal-001",
      ),
      cli(f.s.root, "claude", "task", "list"),
    ]);
    assert.equal(other.length, 0);
    const retry = await cli(
      f.s.root,
      "codex",
      "task",
      "propose",
      "--input",
      input,
      "--request-id",
      "proposal-001",
    );
    assert.equal(retry.replayed, true);
    const review = await fetch(
      `http://127.0.0.1:${r.server.address().port}/api/tasks/review`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${r.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: p.id,
          expectedVersion: 1,
          decision: "approved",
        }),
      },
    );
    assert.equal(review.status, 200);
    assert.equal((await cli(f.s.root, "claude", "task", "list")).length, 1);
    assert.equal(listTasks(f.s, "local")[0].evidence.length, 3);
  } finally {
    await close(r);
  }
  assert.equal(inspectLock(f.s.root).state, "clear");
  assert.equal(existsSync(join(f.s.root, ".hoi/engine-session")), false);
  const reopened = new Store(f.s.root);
  try {
    assert.equal(listTasks(reopened, "local").length, 1);
  } finally {
    reopened.close();
  }
});
test("engine rejects host spoofing, wrong token, unknown operations and changed replay payloads", async (t) => {
  const f = await seed(t),
    r = await serve(f.s, "local", resolve("dist/web"), 0, { app: true });
  try {
    const token = await readEngineCredential(f.s.root, "codex");
    const url = `http://127.0.0.1:${r.server.address().port}/api/engine/call`;
    const post = (body, auth = token) =>
      fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${auth}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const body = {
      apiVersion: 1,
      requestId: "request-001",
      operation: { command: "task", args: ["list"] },
    };
    assert.equal((await post(body, "wrong")).status, 401);
    assert.equal((await post({ ...body, host: "local" })).status, 403);
    assert.equal(
      (await post({ ...body, operation: { ...body.operation, host: "local" } }))
        .status,
      403,
    );
    assert.equal((await post({ ...body, apiVersion: 2 })).status, 403);
    assert.equal(
      (
        await post({
          ...body,
          operation: { command: "shell", args: ["echo nope"] },
        })
      ).status,
      404,
    );
    const mutation = {
      command: "capture",
      input: { type: "decision", content: "Cedar scope confirmed" },
    };
    await callEngine(f.s.root, "codex", mutation, "receipt-001");
    await assert.rejects(
      callEngine(
        f.s.root,
        "codex",
        { ...mutation, input: { type: "decision", content: "Changed" } },
        "receipt-001",
      ),
      /REQUEST_ID_CONFLICT/,
    );
    // Revoked host cannot use an already issued credential or receive receipt data.
    const policy = JSON.parse(JSON.stringify(f.s.policy()));
    policy.deniedHosts.push("codex");
    const { writeYaml } = await import("../dist/core/files.js");
    writeYaml(f.s.path("policies/actions.yaml"), policy);
    assert.notEqual((await post(body)).status, 200);
  } finally {
    await close(r);
  }
});
test("second app is refused and backups exclude live engine credentials", async (t) => {
  const f = fixture(t),
    r = await serve(f.s, "local", resolve("dist/web"), 0, { app: true });
  try {
    await assert.rejects(
      serve(f.s, "local", resolve("dist/web"), 0, { app: true }),
      /LOCK_BUSY/,
    );
    const backup = await cli(
      f.s.root,
      "local",
      "backup",
      join(f.root, "snapshot"),
    );
    assert.equal(backup.verified, true);
    const manifest = JSON.parse(
      readFileSync(join(backup.destination, "manifest.json"), "utf8"),
    );
    assert.ok(
      !Object.keys(manifest.files).some((x) => x.includes("engine-session")),
    );
  } finally {
    await close(r);
  }
});

test("shutdown drains accepted work and refuses new work before releasing ownership", async (t) => {
  const f = fixture(t);
  const { createEngineSession } = await import("../dist/core/engine.js");
  const engine = await createEngineSession(f.s);
  let unblock;
  const gate = new Promise((resolve) => {
    unblock = resolve;
  });
  let finished = false;
  const work = engine.enqueue(async () => {
    await gate;
    finished = true;
  });
  const stopping = engine.stop();
  assert.equal(inspectLock(f.s.root).state, "active");
  await assert.rejects(
    engine.enqueue(() => null),
    /ENGINE_STOPPING/,
  );
  unblock();
  await Promise.all([work, stopping]);
  assert.equal(finished, true);
  assert.equal(inspectLock(f.s.root).state, "clear");
});
