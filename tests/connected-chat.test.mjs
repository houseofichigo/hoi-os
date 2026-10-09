import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { sendChat } from "../dist/core/chat-send.js";
import { configureAI, waitAI } from "../dist/core/ai.js";
import { getConversation, beginChat, submitChat } from "../dist/core/chat.js";
import { migrate, Store } from "../dist/core/store.js";
const cfg = {
  provider: "openai",
  model: "fictional",
  inputPerMillion: 0.1,
  outputPerMillion: 0.1,
  pricingDate: new Date().toISOString().slice(0, 10),
  allowWorkspaceContext: true,
  sourceIds: [],
  confirm: true,
};
const draft = {
  requestKey: "request-123",
  origin: "home",
  scope: "workspace",
  message: "What is recorded?",
  provider: "openai",
};
const answer = {
  type: "answer",
  text: "No relevant records were supplied.",
  citations: [],
};
test("direct send persists one turn/job, rejects changed retries and completes using a bounded read tool", async (t) => {
  const { s } = fixture(t);
  await configureAI(s, cfg, "local");
  let calls = 0;
  const deps = {
    key: "fictional",
    stream: async () => ({
      text: JSON.stringify(
        ++calls === 1
          ? {
              type: "tool",
              call: { name: "records", input: { kind: "projects" } },
            }
          : answer,
      ),
      usage: { input_tokens: 20, output_tokens: 20 },
    }),
  };
  const sent = await sendChat(s, draft, "local", deps);
  const retry = await sendChat(s, draft, "local", deps);
  assert.equal(retry.jobId, sent.jobId);
  await assert.rejects(
    () => sendChat(s, { ...draft, message: "changed" }, "local", deps),
    /IDEMPOTENCY/,
  );
  await waitAI(s, sent.jobId);
  assert.equal(calls, 2);
  assert.equal(s.one("SELECT count(*) n FROM ai_jobs").n, 1);
  const c = getConversation(s, sent.conversationId, "local");
  assert.equal(c.turns.length, 1);
  assert.equal(c.turns[0].state, "completed");
  assert.equal(c.context.scope, "workspace");
  await assert.rejects(
    () =>
      sendChat(
        s,
        {
          ...draft,
          requestKey: "new-key-123",
          conversationId: c.id,
          expectedVersion: 1,
        },
        "local",
        deps,
      ),
    /STALE/,
  );
  await assert.rejects(
    () =>
      sendChat(
        s,
        {
          ...draft,
          requestKey: "new-key-124",
          conversationId: c.id,
          expectedVersion: c.version,
          scope: "knowledge",
        },
        "local",
        deps,
      ),
    /SCOPE_CHANGED/,
  );
});
test("failed preflight rolls back conversation, turn and send identity", async (t) => {
  const { s } = fixture(t);
  await assert.rejects(() => sendChat(s, draft, "local"), /AI_NOT_CONFIGURED/);
  assert.equal(s.one("SELECT count(*) n FROM conversations").n, 0);
  assert.equal(s.one("SELECT count(*) n FROM chat_runs").n, 0);
  assert.equal(s.one("SELECT count(*) n FROM chat_sends").n, 0);
});
test("knowledge-only scope excludes task context and refuses workspace tools", (t) => {
  const { s } = fixture(t);
  const r = beginChat(
    s,
    { message: "knowledge", host: "codex", scope: "knowledge" },
    "local",
  );
  assert.equal(r.request.context[0].tasks, undefined);
  assert.equal(r.request.context[0].clients, undefined);
  assert.throws(
    () =>
      submitChat(
        s,
        r.id,
        r.version,
        { type: "tool", call: { name: "records", input: { kind: "clients" } } },
        "local",
      ),
    /OUTSIDE_SCOPE/,
  );
});
test("schema16 migration adds durable send storage without rewriting conversation identities", (t) => {
  const { s } = fixture(t);
  s.db.exec(
    "DROP TABLE chat_sends; DROP TABLE conversation_context; PRAGMA user_version=16",
  );
  const root = s.root;
  s.close();
  const copy = new Store(root);
  t.after(() => copy.close());
  migrate(copy);
  assert.equal(copy.db.pragma("user_version", { simple: true }), 19);
  assert.ok(copy.one("SELECT name FROM sqlite_master WHERE name='chat_sends'"));
});

test("backup and relocated restore preserve send identities and prevent redispatch", async (t) => {
  const { s, root } = fixture(t);
  await configureAI(s, cfg, "local");
  let calls = 0;
  const deps = {
    key: "fictional",
    stream: async () => {
      calls++;
      return {
        text: JSON.stringify(answer),
        usage: { input_tokens: 2, output_tokens: 2 },
      };
    },
  };
  const sent = await sendChat(s, draft, "local", deps);
  await waitAI(s, sent.jobId);
  const { backup, restore, verifyBackup } =
    await import("../dist/core/backup.js");
  const { join } = await import("node:path");
  backup(s, join(root, "backup"));
  verifyBackup(join(root, "backup"));
  await restore(join(root, "backup"), join(root, "copy"));
  const copy = new Store(join(root, "copy"));
  t.after(() => copy.close());
  assert.equal((await sendChat(copy, draft, "local", deps)).jobId, sent.jobId);
  assert.equal(calls, 1);
});
test("provider disclosure applies to source-backed selected context and rolls back refused sends", async (t) => {
  const { s, file } = fixture(t);
  const { ingest } = await import("../dist/core/intake.js");
  const source = await ingest(
    s,
    file("private.md", "Private fictional project details"),
    {},
  );
  await configureAI(s, cfg, "local");
  const revision = s.one(
    "SELECT current_revision r FROM sources WHERE id=?",
    source.sourceId,
  ).r;
  await assert.rejects(
    () =>
      sendChat(
        s,
        {
          ...draft,
          documents: [{ sourceId: source.sourceId, revisionId: revision }],
        },
        "local",
        { key: "fictional" },
      ),
    /DISCLOSURE/,
  );
  assert.equal(s.one("SELECT count(*) n FROM chat_sends").n, 0);
});
test("cancelled generation retains one reservation and idempotent retries never dispatch again", async (t) => {
  const { s } = fixture(t);
  await configureAI(s, cfg, "local");
  let calls = 0;
  const deps = {
    key: "fictional",
    stream: async (_p, _m, _k, _q, _n, signal) => {
      calls++;
      return await new Promise((resolve, reject) =>
        signal.addEventListener("abort", () => reject(Error("cancelled")), {
          once: true,
        }),
      );
    },
  };
  const sent = await sendChat(s, draft, "local", deps);
  const { cancelAI } = await import("../dist/core/ai.js");
  cancelAI(s, sent.jobId, "local");
  await waitAI(s, sent.jobId);
  assert.equal((await sendChat(s, draft, "local", deps)).state, "cancelled");
  assert.equal(calls, 1);
  assert.equal(s.one("SELECT count(*) n FROM ai_usage").n, 1);
});
