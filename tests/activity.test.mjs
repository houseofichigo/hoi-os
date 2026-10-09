import test from "node:test";
import { join } from "node:path";
import { backup, restore } from "../dist/core/backup.js";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { configureAI, waitAI, cancelAI } from "../dist/core/ai.js";
import { sendChat } from "../dist/core/chat-send.js";
import {
  activity,
  activityDetail,
  suggestions,
  turnResults,
} from "../dist/core/activity.js";
import {
  beginChat,
  submitChat,
  acceptChatProposal,
} from "../dist/core/chat.js";
import { createProject, reviewProposal } from "../dist/core/tasks.js";
import { entity } from "../dist/core/knowledge.js";
import { ingest } from "../dist/core/intake.js";
import { writeYaml } from "../dist/core/files.js";
import { migrate, Store } from "../dist/core/store.js";
import { executeOperation, operationInfo } from "../dist/core/operations.js";
const config = {
  provider: "openai",
  model: "fixture",
  inputPerMillion: 0.1,
  outputPerMillion: 0.1,
  pricingDate: new Date().toISOString().slice(0, 10),
  allowWorkspaceContext: true,
  sourceIds: [],
  confirm: true,
};
test("activity records genuine ordered rounds, survives reopen and deduplicates dispatch", async (t) => {
  const { s, root } = fixture(t);
  await configureAI(s, config, "local");
  let n = 0;
  const input = {
    requestKey: "activity-request",
    origin: "home",
    scope: "workspace",
    message: "Read current projects",
    provider: "openai",
  };
  const deps = {
    key: "fictional",
    stream: async () => ({
      text: JSON.stringify(
        ++n === 1
          ? {
              type: "tool",
              call: { name: "records", input: { kind: "projects" } },
            }
          : { type: "answer", text: "No project records.", citations: [] },
      ),
      usage: { input_tokens: 5, output_tokens: 5 },
    }),
  };
  const sent = await sendChat(s, input, "local", deps);
  await waitAI(s, sent.jobId);
  const retry = await sendChat(s, input, "local", deps);
  assert.equal(retry.jobId, sent.jobId);
  assert.equal(n, 2);
  const results = turnResults(s, sent.runId, "local");
  assert.deepEqual(
    results.events.map((e) => e.stage),
    [
      "preparing-context",
      "generating",
      "reading",
      "generating",
      "validating",
      "completed",
    ],
  );
  assert.equal(activity(s, "local", { category: "chat" }).items.length, 1);
  assert.equal(
    activityDetail(s, "local", "ai:" + sent.jobId).state,
    "completed",
  );
  assert.equal(cancelAI(s, sent.jobId, "local").state, "completed");
  const copy = new Store(s.root);
  try {
    assert.equal(turnResults(copy, sent.runId, "local").events.length, 6);
  } finally {
    copy.close();
  }
  backup(s, join(root, "backup"));
  restore(join(root, "backup"), join(root, "restored"));
  const restored = new Store(join(root, "restored"));
  try {
    assert.deepEqual(
      turnResults(restored, sent.runId, "local").events,
      results.events,
    );
    assert.equal(
      activityDetail(restored, "local", "ai:" + sent.jobId).state,
      "completed",
    );
  } finally {
    restored.close();
  }
  assert.equal(
    operationInfo({ command: "activity", args: ["list"], options: {} }).action,
    "read",
  );
});
test("task card uses authoritative proposal, duplicate review creates one task and dismissed stays dismissed", async (t) => {
  const f = fixture(t),
    { s } = f;
  const p = createProject(
    s,
    {
      entityId: entity(s, { name: "Cedar", type: "project" }).id,
      objective: "Deliver workshop",
    },
    "local",
  );
  await ingest(s, f.file("note.md", "Prepare the Cedar workshop agenda."), {
    metadata: { project: p.entity_id },
  });
  let run = beginChat(
    s,
    { message: "Cedar workshop", projectId: p.id, host: "codex" },
    "local",
  );
  const source = run.request.context[0].search.results[0];
  const ev = {
    revisionId: source.revisionId,
    passageId: source.passageId,
    quote: source.quote,
  };
  run = submitChat(
    s,
    run.id,
    run.version,
    {
      type: "answer",
      text: "Proposed workshop action.",
      citations: [ev],
      taskProposal: {
        key: "fixture-proposal",
        task: {
          projectId: p.id,
          title: "Prepare agenda",
          outcome: "Agenda prepared",
        },
        evidence: [ev],
      },
    },
    "local",
  );
  const draft = turnResults(s, run.id, "local").cards.find(
    (c) => c.kind === "task-proposal",
  );
  assert.equal(draft.state, "draft");
  const proposal = acceptChatProposal(s, run.id, run.version, "local");
  assert.equal(
    acceptChatProposal(s, run.id, run.version, "local").id,
    proposal.id,
  );
  reviewProposal(
    s,
    {
      id: proposal.id,
      expectedVersion: proposal.version,
      decision: "rejected",
    },
    "local",
  );
  assert.equal(
    suggestions(s, "local", { bucket: "attention" }).items.filter(
      (c) => c.id === "proposal:" + proposal.id,
    ).length,
    0,
  );
  assert.equal(
    suggestions(s, "local", { bucket: "completed" }).items.find(
      (c) => c.id === "proposal:" + proposal.id,
    ).state,
    "rejected",
  );
  assert.equal(
    acceptChatProposal(s, run.id, run.version, "local").id,
    proposal.id,
  );
  assert.equal(s.one("SELECT COUNT(*) n FROM tasks").n, 0);
  const policy = s.policy();
  policy.actions.read = "deny";
  writeYaml(s.path("policies/actions.yaml"), policy);
  assert.throws(() => activity(s, "local"), /denied/i);
  assert.throws(() => turnResults(s, run.id, "local"), /denied/i);
});
test("schema 17 migration adds rebuildable links and progress without inventing history", (t) => {
  const { s } = fixture(t);
  s.db.exec(
    "DROP TABLE chat_progress; DROP TABLE chat_result_links; PRAGMA user_version=17;",
  );
  const old = new Store(s.root);
  try {
    migrate(old);
    assert.equal(old.db.pragma("user_version", { simple: true }), 19);
    assert.equal(old.one("SELECT count(*) n FROM chat_progress").n, 0);
  } finally {
    old.close();
  }
});

test("restricted context removes activity, counts, detail and cancel access", async (t) => {
  const f = fixture(t),
    { s } = f;
  const imported = await ingest(
    s,
    f.file("private.md", "Fictional confidential study result."),
    {},
  );
  const source = s.one("SELECT id,current_revision FROM sources LIMIT 1");
  await configureAI(s, { ...config, sourceIds: [source.id] }, "local");
  const sent = await sendChat(
    s,
    {
      requestKey: "private-activity",
      origin: "chat",
      scope: "knowledge",
      message: "Study result",
      provider: "openai",
      documents: [{ sourceId: source.id, revisionId: source.current_revision }],
    },
    "local",
    {
      key: "fictional",
      stream: async () => ({
        text: JSON.stringify({
          type: "answer",
          text: "No supported answer.",
          citations: [],
        }),
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    },
  );
  await waitAI(s, sent.jobId);
  s.exec(
    "UPDATE sources SET metadata=json_set(metadata,'$.allowedHosts',json('[\"claude\"]')) WHERE id=?",
    source.id,
  );
  assert.equal(activity(s, "local", { category: "chat" }).items.length, 0);
  assert.throws(
    () => activityDetail(s, "local", "ai:" + sent.jobId),
    /UNAVAILABLE/,
  );
  assert.throws(() => cancelAI(s, sent.jobId, "local"));
  assert.throws(() => turnResults(s, sent.runId, "local"));
});

test("activity pagination is stable and read-only CLI operations reject malformed filters", async (t) => {
  const { s } = fixture(t);
  await configureAI(s, config, "local");
  for (let i = 0; i < 3; i++) {
    const sent = await sendChat(
      s,
      {
        requestKey: "pagination-" + i,
        origin: "home",
        scope: "workspace",
        message: "Read records " + i,
        provider: "openai",
      },
      "local",
      {
        key: "fixture",
        stream: async () => ({
          text: JSON.stringify({
            type: "answer",
            text: "No records.",
            citations: [],
          }),
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      },
    );
    await waitAI(s, sent.jobId);
  }
  const first = activity(s, "local", { limit: 2 });
  const next = activity(s, "local", { limit: 2, cursor: first.nextCursor });
  assert.equal(
    new Set([...first.items, ...next.items].map((i) => i.id)).size,
    3,
  );
  assert.throws(() => activity(s, "local", { limit: 10000 }));
  const result = await executeOperation(s, "local", {
    command: "activity",
    args: ["list"],
    options: {},
    input: { limit: 1 },
  });
  assert.equal(result.items.length, 1);
});
