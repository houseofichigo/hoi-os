import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import {
  streamModel,
  reserveAI,
  configureAI,
  aiStatus,
  startAI,
  analysisPreview,
  configureAnalysis,
  scanAutomaticAnalysis,
} from "../dist/core/ai.js";
import { beginChat } from "../dist/core/chat.js";
import { importWork } from "../dist/core/work-intake.js";
import { createConnection } from "../dist/core/sync.js";
const cfg = {
  provider: "openai",
  model: "fictional-model",
  inputPerMillion: 1,
  outputPerMillion: 2,
  pricingDate: new Date().toISOString().slice(0, 10),
  allowWorkspaceContext: false,
  sourceIds: [],
  confirm: true,
};
test("provider SSE streams genuine deltas and usage, never retains provider text errors", async () => {
  for (const provider of ["openai", "anthropic"]) {
    let sent,
      observed = [];
    const events =
      provider === "openai"
        ? [
            { type: "response.output_text.delta", delta: "hello" },
            {
              type: "response.completed",
              response: { usage: { input_tokens: 10, output_tokens: 2 } },
            },
          ]
        : [
            { type: "message_start", message: { usage: { input_tokens: 10 } } },
            { type: "content_block_delta", delta: { text: "hello" } },
            { type: "message_delta", usage: { output_tokens: 2 } },
            { type: "message_stop" },
          ];
    const fake = async (url, init) => {
      sent = JSON.parse(init.body);
      return new Response(
        events.map((e) => "data: " + JSON.stringify(e) + "\n\n").join(""),
      );
    };
    const result = await streamModel(
      provider,
      "fictional",
      "not-real",
      "question",
      20,
      new AbortController().signal,
      (t) => observed.push(t),
      fake,
    );
    assert.equal(result.text, "hello");
    assert.equal(result.usage.input_tokens, 10);
    assert.equal(result.usage.output_tokens, 2);
    assert.deepEqual(observed, ["hello"]);
    assert.equal(sent.stream, true);
    if (provider === "openai") assert.equal(sent.store, false);
  }
});
test("interrupted stream fails rather than reporting a completed answer", async () => {
  await assert.rejects(
    () =>
      streamModel(
        "openai",
        "fictional",
        "not-real",
        "q",
        10,
        new AbortController().signal,
        () => {},
        async () =>
          new Response(
            'data: {"type":"response.output_text.delta","delta":"unfinished"}\n\n',
          ),
      ),
    /INTERRUPTED/,
  );
});
test("budget reservations include uncertain requests and enforce category cap", (t) => {
  const { s } = fixture(t);
  reserveAI(s, "a", "automatic", 20, 25);
  assert.throws(() => reserveAI(s, "b", "automatic", 6, 25), /BUDGET/);
  reserveAI(s, "c", "manual", 0.1, 0.25);
  assert.throws(() => reserveAI(s, "d", "manual", 0.3, 0.25), /BUDGET/);
  assert.equal(aiStatus(s, "local").usage.length, 2);
});
test("provider config requires local principal and explicit workspace disclosure before any call", async (t) => {
  const { s } = fixture(t);
  await assert.rejects(() => configureAI(s, cfg, "codex"), /LOCAL/);
  await configureAI(s, cfg, "local");
  const chat = beginChat(s, { message: "Hello", host: "codex" }, "local");
  assert.throws(
    () => startAI(s, { runId: chat.id, provider: "openai" }, "local"),
    /DISCLOSURE/,
  );
  assert.equal(s.one("SELECT COUNT(*) n FROM ai_usage").n, 0);
});
test("automatic analysis preview excludes existing backlog by default and rejects stale previews", async (t) => {
  const { s } = fixture(t);
  await configureAI(s, cfg, "local");
  const c = createConnection(
    s,
    {
      provider: "gmail",
      label: "Fictional selected mail",
      query: "label:pilot",
    },
    "local",
  );
  const i = await importWork(
    s,
    {
      kind: "email",
      account: "fictional",
      remoteId: "m1",
      threadId: "t1",
      title: "Pilot",
      occurredAt: "2026-09-27T09:00:00Z",
      updatedAt: "2026-09-27T09:00:00Z",
      checkedAt: "2026-09-27T09:00:00Z",
      segments: [{ text: "Please prepare notes." }],
    },
    "local",
  );
  const row = s.one("SELECT source_id FROM work_intake WHERE id=?", i.id);
  s.exec(
    "INSERT INTO sync_items VALUES(?,?,?,?)",
    c.id,
    "m1",
    "one",
    row.source_id,
  );
  s.exec("UPDATE sync_connections SET state='active' WHERE id=?", c.id);
  const preview = analysisPreview(s, { connectionId: c.id }, "local");
  assert.equal(preview.items.length, 1);
  const v = {
    connectionId: c.id,
    provider: "openai",
    enabled: true,
    kinds: ["email"],
    previewDigest: preview.digest,
    confirm: true,
  };
  assert.throws(
    () => configureAnalysis(s, { ...v, previewDigest: "wrong" }, "local"),
    /PREVIEW_CHANGED/,
  );
  configureAnalysis(s, v, "local");
  assert.equal(scanAutomaticAnalysis(s, "local").queued, 0);
  assert.equal(s.one("SELECT COUNT(*) n FROM ai_usage").n, 0);
});

test("provider credential evidence persists, expires and resets on configuration changes", async (t) => {
  const { s } = fixture(t);
  const { testAI, providerVerificationState } =
    await import("../dist/core/ai.js");
  await configureAI(s, cfg, "local");
  await testAI(s, { provider: "openai" }, "local", {
    key: async () => "fictional-key",
    fetch: async () => Response.json({ data: [{ id: cfg.model }] }),
  });
  assert.equal(
    aiStatus(s, "local").providers[0].state,
    "credential-check-passed",
  );
  assert.equal(
    providerVerificationState({
      verification: {
        state: "credential-check-passed",
        checkedAt: "2000-01-01T00:00:00Z",
      },
    }),
    "verification-stale",
  );
  await configureAI(s, cfg, "local");
  assert.equal(
    aiStatus(s, "local").providers[0].state,
    "configured-unverified",
  );
  await assert.rejects(
    () =>
      testAI(s, { provider: "openai" }, "local", {
        key: async () => "fictional-key",
        fetch: async () => new Response("private error", { status: 401 }),
      }),
    /AI_CONNECTION_FAILED_401/,
  );
  const p = aiStatus(s, "local").providers[0];
  assert.equal(p.state, "reconnect-needed");
  assert.equal(p.verification.code, "AI_CONNECTION_FAILED_401");
  assert.ok(!JSON.stringify(p).includes("private error"));
});
test("an in-flight credential check cannot attest changed configuration", async (t) => {
  const { s } = fixture(t);
  const { testAI } = await import("../dist/core/ai.js");
  await configureAI(s, cfg, "local");
  await assert.rejects(
    () =>
      testAI(s, { provider: "openai" }, "local", {
        key: async () => "fictional",
        fetch: async () => {
          await configureAI(s, { ...cfg, model: "other" }, "local");
          return Response.json({ data: [] });
        },
      }),
    /CONFIGURATION_CHANGED/,
  );
  assert.equal(
    aiStatus(s, "local").providers[0].state,
    "configured-unverified",
  );
});
