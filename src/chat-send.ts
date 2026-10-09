import { prepareSemanticQuery } from "./semantic.js";
import { z } from "zod";
import { Store } from "./store.js";
import { type Host, id } from "./schema.js";
import { sha, now } from "./files.js";
import {
  createConversation,
  appendConversation,
  getConversation,
} from "./chat.js";
import { startAI, aiJob, requireAIKey } from "./ai.js";
export const sendInput = z
  .object({
    requestKey: z.string().min(8).max(120),
    conversationId: id.optional(),
    expectedVersion: z.number().int().positive().optional(),
    origin: z.enum(["home", "knowledge", "chat"]),
    scope: z.enum(["workspace", "knowledge"]),
    message: z.string().trim().min(1).max(8000),
    projectId: id.optional(),
    host: z.enum(["codex", "claude"]).default("codex"),
    documents: z
      .array(z.object({ sourceId: id, revisionId: id }).strict())
      .max(10)
      .default([]),
    knowledge: z
      .array(z.object({ kind: z.enum(["wiki", "memory"]), id }).strict())
      .max(10)
      .default([]),
    skill: z
      .object({
        name: z.string(),
        revisionId: z.string(),
        checksum: z.string(),
      })
      .strict()
      .optional(),
    provider: z.enum(["openai", "anthropic"]),
    maxCost: z.number().positive().max(0.25).default(0.25),
  })
  .strict();
export async function sendChat(
  s: Store,
  input: unknown,
  h: Host,
  dependencies: Parameters<typeof startAI>[3] = {},
) {
  s.assertSchema(17, "Connected Chat");
  s.assertHost(h);
  if (h !== "local") throw Error("AI_LOCAL_CONFIGURATION_REQUIRED");
  const v = sendInput.parse(input),
    hash = sha(JSON.stringify(v));
  const old = s.one(
    "SELECT * FROM chat_sends WHERE request_key=?",
    v.requestKey,
  );
  if (old) {
    if (old.host !== h || old.payload_hash !== hash)
      throw Error("CHAT_IDEMPOTENCY_CONFLICT");
    getConversation(s, old.conversation_id, h);
    const job = aiJob(s, old.job_id, h);
    return {
      conversationId: old.conversation_id,
      runId: old.run_id,
      jobId: old.job_id,
      state: job.state,
    };
  }
  if (!dependencies.key) await requireAIKey(s, v.provider);
  await prepareSemanticQuery(s,v.host,v.message);
  const concurrent = s.one(
    "SELECT * FROM chat_sends WHERE request_key=?",
    v.requestKey,
  );
  if (concurrent) {
    if (concurrent.host !== h || concurrent.payload_hash !== hash)
      throw Error("CHAT_IDEMPOTENCY_CONFLICT");
    getConversation(s, concurrent.conversation_id, h);
    const job = aiJob(s, concurrent.job_id, h);
    return {
      conversationId: concurrent.conversation_id,
      runId: concurrent.run_id,
      jobId: concurrent.job_id,
      state: job.state,
    };
  }
  return s.tx(() => {
    let c = v.conversationId
      ? getConversation(s, v.conversationId, h)
      : createConversation(
          s,
          {
            host: "local",
            scope: v.scope,
            origin: v.origin,
            title: v.message.slice(0, 80),
            ...(v.projectId ? { projectId: v.projectId } : {}),
          },
          h,
        );
    if (v.conversationId && c.version !== v.expectedVersion)
      throw Error("STALE_VERSION: Conversation changed");
    const saved = s.one(
      "SELECT * FROM conversation_context WHERE conversation_id=?",
      c.id,
    );
    if (
      v.conversationId &&
      (!saved ||
        saved.scope !== v.scope ||
        saved.provider !== v.provider ||
        c.projectId !== (v.projectId ?? null))
    )
      throw Error("CHAT_SCOPE_CHANGED: Start a new conversation");
    if (!v.conversationId)
      s.exec(
        "INSERT INTO conversation_context VALUES(?,?,?,?) ON CONFLICT(conversation_id) DO UPDATE SET scope=excluded.scope,origin=excluded.origin,provider=excluded.provider",
        c.id,
        v.scope,
        v.origin,
        v.provider,
      );
    c = appendConversation(
      s,
      {
        id: c.id,
        expectedVersion: c.version,
        message: v.message,
        documents: v.documents,
        knowledge: v.knowledge,
        ...(v.skill ? { skill: v.skill } : {}),
      },
      h,
    );
    const run = c.turns.at(-1)!;
    const job = startAI(
      s,
      { runId: run.id, provider: v.provider, maxCost: v.maxCost },
      h,
      dependencies,
    );
    s.exec(
      "INSERT INTO chat_sends VALUES(?,?,?,?,?,?,?)",
      v.requestKey,
      h,
      hash,
      c.id,
      run.id,
      job.id,
      now(),
    );
    return {
      conversationId: c.id,
      runId: run.id,
      jobId: job.id,
      state: job.state,
    };
  });
}
