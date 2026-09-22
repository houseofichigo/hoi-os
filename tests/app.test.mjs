import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { fixture } from "./helpers.mjs";
import { ingest, retrieve } from "../dist/core/intake.js";
import { capture } from "../dist/core/knowledge.js";
import { serve } from "../dist/core/server.js";

const webRoot = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../dist/web",
);
async function call(running, path, body) {
  const r = await fetch(`http://127.0.0.1:${port(running)}/api/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${running.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: r.ok ? await r.json() : null };
}
const port = (running) => running.server.address().port;

test("app mode exposes reviewable mutations; map mode stays read-only", async (t) => {
  const { s, file } = fixture(t);
  await ingest(s, file("positioning.md", "Ichigo positioning statement here"));
  const found = retrieve(s, "positioning statement", "local");
  const e = found.results[0];
  const evidence = {
    revisionId: e.revisionId,
    passageId: e.passageId,
    quote: e.quote,
  };
  capture(
    s,
    { type: "decision", content: "Use the September positioning" },
    "local",
  );
  const app = await serve(s, "local", webRoot, 0, { app: true });
  t.after(() => app.server.close());
  // Reads
  const workspace = await call(app, "workspace");
  assert.equal(workspace.status, 200);
  assert.equal(workspace.json.counts.sources, 1);
  assert.equal(workspace.json.counts.memories, 1);
  const sources = await call(app, "sources");
  assert.equal(sources.json.length, 1);
  const memory = await call(app, "memory");
  assert.equal(memory.json[0].state, "proposed");
  const search = await call(app, "retrieve?q=positioning");
  assert.ok(search.json.results.length >= 1);
  // Wiki lifecycle over HTTP
  const proposed = await call(app, "wiki/propose", {
    slug: "positioning",
    title: "Positioning",
    type: "company",
    content: "Current positioning.",
    evidence: [evidence],
  });
  assert.equal(proposed.status, 200);
  assert.equal(proposed.json.status, "draft");
  const reviewed = await call(app, "wiki/review", {
    id: proposed.json.id,
    state: "reviewed",
  });
  assert.equal(reviewed.json.status, "reviewed");
  const canonical = await call(app, "wiki/canonical", {
    id: proposed.json.id,
  });
  assert.equal(canonical.json.status, "canonical");
  // Memory review over HTTP
  const approve = await call(app, "memory/review", {
    id: memory.json[0].id,
    state: "approved",
  });
  assert.equal(approve.json.state, "approved");
  // Unlisted mutation is refused even in app mode
  const refused = await fetch(`http://127.0.0.1:${port(app)}/api/graph`, {
    method: "POST",
    headers: { Authorization: `Bearer ${app.token}` },
  });
  assert.equal(refused.status, 405);
  // Bad token still 401
  const anon = await fetch(`http://127.0.0.1:${port(app)}/api/workspace`);
  assert.equal(anon.status, 401);
  // App page is served
  const page = await fetch(`http://127.0.0.1:${port(app)}/app`);
  assert.ok((await page.text()).includes("root"));
  app.server.close();
  // Map mode: no app endpoints, no mutations
  const map = await serve(s, "local", webRoot, 0);
  t.after(() => map.server.close());
  const post = await fetch(`http://127.0.0.1:${port(map)}/api/wiki/review`, {
    method: "POST",
    headers: { Authorization: `Bearer ${map.token}` },
  });
  assert.equal(post.status, 405);
  const ws = await call(map, "workspace");
  assert.equal(ws.status, 404);
  const graphRead = await call(map, "graph");
  assert.equal(graphRead.status, 200);
});
