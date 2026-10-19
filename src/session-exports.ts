import { z } from "zod";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Store } from "./store.js";
import type { Host } from "./schema.js";
import { atomic, sha, now } from "./files.js";
import { ingest } from "./intake.js";
const turn = z
  .object({
    id: z.string().min(1).max(180),
    role: z.enum(["user", "assistant", "system", "tool", "unknown"]),
    text: z.string().min(1).max(100000),
    timestamp: z.string().datetime({ offset: true }).nullable().default(null),
  })
  .strict();
const session = z
  .object({
    schemaVersion: z.literal(1),
    namespace: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
    account: z.string().trim().min(1).max(180),
    conversationId: z.string().trim().min(1).max(256),
    title: z.string().trim().min(1).max(300),
    coverage: z.enum(["complete", "partial", "unknown"]),
    turns: z.array(turn).min(1).max(1000).optional(),
    text: z.string().min(1).max(500000).optional(),
  })
  .strict()
  .refine(
    (v) => !!v.turns !== !!v.text,
    "Supply turns or unstructured text, not both",
  );
const base = z
  .object({
    session,
    originalExport: z
      .object({
        format: z.enum(["json", "text"]),
        content: z.string().max(524288),
      })
      .strict()
      .optional(),
    selectedTurnIds: z.array(z.string()).max(1000).optional(),
    provider: z.enum(["openai", "anthropic"]).optional(),
  })
  .strict();
const secret =
  /(?:\b(?:api[_ -]?key|password|access[_ -]?token|authorization)\s*[:=]\s*\S+|\bsk-[a-zA-Z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
function prepare(s: Store, h: Host, raw: unknown) {
  s.assertSchema(21, "Session exports");
  s.assertHost(h);
  if (s.policy().actions.draft !== "allow") throw Error("POLICY_DENIED");
  const v = base.parse(raw),
    encoded = v.originalExport?.content ?? JSON.stringify(v.session);
  if (v.originalExport) {
    const original =
      v.originalExport.format === "json"
        ? session.parse(JSON.parse(encoded))
        : { text: encoded, turns: undefined };
    if (
      JSON.stringify(original.turns ?? original.text) !==
      JSON.stringify(v.session.turns ?? v.session.text)
    )
      throw Error("SESSION_ORIGINAL_MISMATCH");
  }
  if (Buffer.byteLength(encoded) > 512 * 1024) throw Error("SESSION_TOO_LARGE");
  const turns = v.session.turns ?? [
    {
      id: "unstructured",
      role: "unknown" as const,
      text: v.session.text!,
      timestamp: null,
    },
  ];
  if (new Set(turns.map((t) => t.id)).size !== turns.length)
    throw Error("SESSION_DUPLICATE_TURN_ID");
  if (v.selectedTurnIds?.some((id) => !turns.some((t) => t.id === id)))
    throw Error("SESSION_UNKNOWN_TURN");
  const selected = turns.filter(
    (t) =>
      !secret.test(t.text) &&
      (v.selectedTurnIds
        ? v.selectedTurnIds.includes(t.id)
        : !["system", "tool"].includes(t.role)),
  );
  if (!selected.length) throw Error("SESSION_NO_SAFE_SELECTED_CONTENT");
  const sourceKey =
    "export:" +
    sha(
      JSON.stringify([
        v.session.namespace,
        v.session.account,
        v.session.conversationId,
      ]),
    );
  const old = s.one("SELECT * FROM sources WHERE source_key=?", sourceKey);
  if (old && !s.allowed(old, h)) throw Error("SOURCE_UNAVAILABLE");
  const content = selected
    .map(
      (t) =>
        `## Turn ${t.id} · ${t.role} · ${t.timestamp ?? "time unknown"}\n\n${t.text}`,
    )
    .join("\n\n");
  const payload = {
    ...v.session,
    text: undefined,
    turns: selected,
    coverage: selected.length < turns.length ? "partial" : v.session.coverage,
    omitted: turns
      .filter((t) => !selected.includes(t))
      .map((t) => ({
        id: t.id,
        role: t.role,
        reason: secret.test(t.text)
          ? "credential-like content"
          : "not selected",
      })),
  };
  const checksum = sha(
    JSON.stringify({
      original: encoded,
      metadata: v.session,
      selected: selected.map((t) => t.id),
    }),
  );
  const digest = sha(
    JSON.stringify({
      checksum,
      provider: v.provider ?? null,
      expectedRevision: old?.current_revision ?? null,
    }),
  );
  return {
    v,
    encoded,
    turns,
    selected,
    sourceKey,
    old,
    content,
    payload,
    checksum,
    digest,
  };
}
export function previewSession(s: Store, raw: unknown, h: Host) {
  const p = prepare(s, h, raw),
    duplicate = s.one(
      "SELECT revision_id FROM session_exports WHERE source_id=? AND checksum=?",
      p.old?.id ?? "",
      p.checksum,
    );
  return {
    digest: p.digest,
    expectedRevision: p.old?.current_revision ?? null,
    sourceId: p.old?.id ?? null,
    outcome:
      duplicate && duplicate.revision_id === p.old?.current_revision
        ? "duplicate"
        : p.old
          ? "new revision"
          : "new source",
    session: p.payload,
    checksum: p.checksum,
    excluded: p.payload.omitted,
    availableTurns: p.turns.map((t) => ({
      id: t.id,
      role: t.role,
      timestamp: t.timestamp,
      selectable: !secret.test(t.text),
    })),
    provider: p.v.provider ?? null,
    disclosure:
      "Import does not authorize provider disclosure or start analysis",
    warnings: [
      ...(!p.v.session.turns
        ? ["Unstructured text: roles and timestamps remain unknown"]
        : []),
      "Original export is preserved locally; credential-like blocks are excluded from indexed content",
    ],
  };
}
export async function commitSession(s: Store, raw: unknown, h: Host) {
  const v = base
    .extend({
      requestKey: z.string().min(8).max(180),
      previewDigest: z.string().length(64),
      expectedRevision: z.string().nullable(),
    })
    .strict()
    .parse(raw);
  const { requestKey, previewDigest, expectedRevision, ...input } = v,
    hash = sha(JSON.stringify(v));
  s.assertHost(h);
  const prior = s.one(
    "SELECT * FROM session_imports WHERE request_key=?",
    requestKey,
  );
  if (prior) {
    if (prior.host !== h || prior.digest !== hash)
      throw Error("IDEMPOTENCY_CONFLICT");
    if (prior.state === "completed") {
      const r = JSON.parse(prior.result);
      const src = s.one("SELECT * FROM sources WHERE id=?", r.sourceId);
      if (!src || !s.allowed(src, h)) throw Error("SOURCE_UNAVAILABLE");
      return r;
    }
  }
  const p = prepare(s, h, input);
  // Pending imports can resume only if the current revision is our exact already-indexed content.
  const ownRetry =
    prior?.state === "pending" &&
    p.old &&
    s.one(
      "SELECT 1 FROM revisions WHERE id=? AND checksum=?",
      p.old.current_revision,
      sha(p.content),
    );
  if (
    !ownRetry &&
    (p.digest !== previewDigest ||
      (p.old?.current_revision ?? null) !== expectedRevision)
  )
    throw Error("SESSION_PREVIEW_STALE");
  const archive = `archives/${now().slice(0, 10)}/session-${p.checksum}.${p.v.originalExport?.format === "text" ? "txt" : "json"}`;
  s.exec(
    "INSERT OR IGNORE INTO session_imports VALUES(?,?,?,?,?,NULL,?)",
    requestKey,
    h,
    hash,
    JSON.stringify(v),
    "pending",
    now(),
  );
  if (!existsSync(s.path(archive))) atomic(s.path(archive), p.encoded);
  const dir = mkdtempSync(join(tmpdir(), "hoi-session-"));
  try {
    const file = join(dir, "session.md");
    atomic(file, p.content);
    const result = await ingest(s, file, {
      host: h,
      sourceKey: p.sourceKey,
      metadata: {
        ...(p.old
          ? JSON.parse(p.old.metadata)
          : { allowedHosts: [h, "local"], sensitivity: "internal" }),
        title: p.v.session.title,
        documentType: "assistant-session",
      },
    });
    const out = {
      ...result,
      exportArchive: archive,
      originalChecksum: sha(p.encoded),
      checksum: p.checksum,
      analysis: "not-started",
      coverage: p.payload.coverage,
    };
    s.tx(() => {
      s.exec(
        "INSERT OR IGNORE INTO session_exports VALUES(?,?,?,?,?)",
        result.sourceId,
        result.revisionId,
        JSON.stringify(p.payload),
        archive,
        p.checksum,
      );
      s.exec(
        "UPDATE sources SET location=? WHERE id=?",
        `export:${p.v.session.namespace}:${p.v.session.conversationId}`,
        result.sourceId,
      );
      s.exec(
        "UPDATE session_imports SET state='completed',result=? WHERE request_key=?",
        JSON.stringify(out),
        requestKey,
      );
    });
    return out;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
export function sessionDetail(s: Store, sourceId: string, h: Host) {
  s.assertHost(h);
  const src = s.one("SELECT * FROM sources WHERE id=?", sourceId);
  if (!src || !s.allowed(src, h)) throw Error("SOURCE_UNAVAILABLE");
  const r = s.one(
    "SELECT payload FROM session_exports WHERE revision_id=?",
    src.current_revision,
  );
  return r ? JSON.parse(r.payload) : null;
}
