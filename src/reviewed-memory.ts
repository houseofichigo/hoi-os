import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { type Store } from "./store.js";
import { type Host, memoryInput } from "./schema.js";
import { atomic, readNote, sha, uid, now } from "./files.js";

const key = z.string().min(8).max(200);
const memoryId = z.string().regex(/^memory_[a-z0-9]+$/);
function check(s: Store, h: Host, write = false) {
  s.assertSchema(19, "Reviewed memory");
  s.assertHost(h);
  if (write && s.policy().actions.draft === "deny")
    throw Error("POLICY_DENIED");
}
function visible(s: Store, m: any, h: Host, current = false) {
  return (
    m.allowedHosts?.includes(h) &&
    s.evidenceVisible(m.evidence ?? [], h, current)
  );
}
export function memoryGet(s: Store, id: string, h: Host) {
  check(s, h);
  memoryId.parse(id);
  const path = s.path(`memory/${id}.md`);
  if (!existsSync(path)) throw Error("MEMORY_UNAVAILABLE");
  const m = readNote(path);
  if (!visible(s, m, h)) throw Error("MEMORY_UNAVAILABLE");
  return { ...m, version: m.version ?? 1, checksum: sha(readFileSync(path)) };
}
export function memoryList(s: Store, h: Host, state = "current") {
  check(s, h);
  if (!["current", "proposed", "history"].includes(state))
    throw Error("INVALID_MEMORY_VIEW");
  const today = now().slice(0, 10);
  return s
    .memories(true)
    .filter(
      (m) =>
        visible(s, m, h, state !== "history") &&
        (state === "history" ||
          (state === "proposed"
            ? m.state === "proposed"
            : m.state === "approved" &&
              s.knowledgeActive(m.id) &&
              (!m.validFrom || m.validFrom <= today) &&
              (!m.validUntil || m.validUntil >= today))),
    )
    .map((m) => memoryGet(s, m.id, h));
}
export function memoryHistory(s: Store, id: string, h: Host) {
  const current = memoryGet(s, id, h);
  const rows = s.all(
    "SELECT * FROM memory_revisions WHERE memory_id=? ORDER BY version DESC",
    id,
  );
  const revisions = rows
    .map((r) => {
      const checksum = sha(readFileSync(s.path(r.path)));
      if (checksum !== r.checksum) throw Error("MEMORY_HISTORY_CONFLICT");
      return { ...readNote(s.path(r.path)), version: r.version, checksum };
    })
    .filter((m) => visible(s, m, h));
  const index = revisions.findIndex((m) => m.version === current.version);
  if (index >= 0) revisions[index] = current;
  else revisions.unshift(current);
  return { id, revisions };
}
/** Journals are engine-authored. Refuse an unexpected edit instead of overwriting it. */
export function recoverMemoryWrites(s: Store) {
  if (s.schemaVersion < 19) return;
  for (const j of s.all(
    "SELECT * FROM memory_write_journal WHERE state='pending' ORDER BY created_at,id",
  )) {
    let writes: {
      path: string;
      before: string | null;
      after: string;
      text: string;
    }[];
    try {
      writes = z
        .array(
          z
            .object({
              path: z
                .string()
                .regex(
                  /^memory\/(?:history\/memory_[a-z0-9]+\/\d+\.md|memory_[a-z0-9]+\.md)$/,
                ),
              before: z
                .string()
                .regex(/^[a-f0-9]{64}$/)
                .nullable(),
              after: z.string().regex(/^[a-f0-9]{64}$/),
              text: z.string(),
            })
            .strict(),
        )
        .min(1)
        .parse(JSON.parse(j.writes));
      if (
        new Set(writes.map((w) => w.path)).size !== writes.length ||
        writes.some((w) => sha(w.text) !== w.after)
      )
        throw Error("Invalid journal");
    } catch {
      throw Error("MEMORY_JOURNAL_INVALID");
    }
    for (const w of writes) {
      const path = s.path(w.path),
        actual = existsSync(path) ? sha(readFileSync(path)) : null;
      if (actual !== w.before && actual !== w.after)
        throw Error("MEMORY_RECOVERY_CONFLICT");
    }
    for (const w of writes) {
      const path = s.path(w.path);
      if (!existsSync(path) || sha(readFileSync(path)) !== w.after)
        atomic(path, w.text);
    }
    s.exec("UPDATE memory_write_journal SET state='complete' WHERE id=?", j.id);
  }
}
function serializeNote(s: Store, m: any) {
  // Same representation as canonical Markdown, without a temporary file.
  return `${"---\n"}${YAML.stringify(Object.fromEntries(Object.entries(m).filter(([k]) => k !== "content")))}---\n\n${m.content ?? ""}\n`;
}
import YAML from "yaml";
function commit(
  s: Store,
  h: Host,
  requestKey: string,
  payload: unknown,
  notes: any[],
) {
  const hash = sha(JSON.stringify(payload));
  const prior = s.one(
    "SELECT * FROM memory_write_journal WHERE host=? AND request_key=?",
    h,
    requestKey,
  );
  if (prior) {
    if (prior.payload_hash !== hash) throw Error("IDEMPOTENCY_CONFLICT");
    recoverMemoryWrites(s);
    return JSON.parse(prior.result);
  }
  const writes: any[] = [];
  const revisions: any[] = [];
  for (const note of notes) {
    const path = `memory/${note.id}.md`,
      absolute = s.path(path);
    if (existsSync(absolute)) {
      const old = readNote(absolute),
        version = old.version ?? 1;
      const history = `memory/history/${note.id}/${version}.md`,
        text = readFileSync(absolute, "utf8");
      if (
        existsSync(s.path(history)) &&
        sha(readFileSync(s.path(history))) !== sha(text)
      )
        throw Error("MEMORY_HISTORY_CONFLICT");
      writes.push({
        path: history,
        before: existsSync(s.path(history))
          ? sha(readFileSync(s.path(history)))
          : null,
        after: sha(text),
        text,
      });
      revisions.push({
        id: note.id,
        version,
        path: history,
        checksum: sha(text),
      });
    }
    const text = serializeNote(s, note),
      history = `memory/history/${note.id}/${note.version}.md`;
    writes.push({
      path,
      before: existsSync(absolute) ? sha(readFileSync(absolute)) : null,
      after: sha(text),
      text,
    });
    writes.push({ path: history, before: null, after: sha(text), text });
    revisions.push({
      id: note.id,
      version: note.version,
      path: history,
      checksum: sha(text),
    });
  }
  const result = {
    id: notes[0].id,
    version: notes[0].version,
    state: notes[0].state,
  };
  s.db.transaction(() => {
    for (const r of revisions)
      s.exec(
        "INSERT OR IGNORE INTO memory_revisions VALUES(?,?,?,?,?)",
        r.id,
        r.version,
        r.checksum,
        r.path,
        now(),
      );
    s.exec(
      "INSERT INTO memory_write_journal VALUES(?,?,?,?,?,?,?,?)",
      uid("memorywrite"),
      h,
      requestKey,
      hash,
      JSON.stringify(writes),
      JSON.stringify(result),
      "pending",
      now(),
    );
    s.log("memory.versioned-write", result);
  })();
  recoverMemoryWrites(s);
  return result;
}
function retry(s: Store, h: Host, v: any) {
  const row = s.one(
    "SELECT * FROM memory_write_journal WHERE host=? AND request_key=?",
    h,
    v.requestKey,
  );
  if (!row) return null;
  if (row.payload_hash !== sha(JSON.stringify(v)))
    throw Error("IDEMPOTENCY_CONFLICT");
  recoverMemoryWrites(s);
  return JSON.parse(row.result);
}
export function proposeMemory(s: Store, input: unknown, h: Host) {
  check(s, h, true);
  const v = z
    .object({
      requestKey: key,
      memory: memoryInput,
      attributedStatement: z.boolean().default(false),
    })
    .strict()
    .parse(input);
  const prior = retry(s, h, v);
  if (prior) return prior;
  if (v.attributedStatement && h !== "local")
    throw Error("USER_ATTRIBUTION_REQUIRED");
  s.validateEvidence(v.memory.evidence, h, true);
  if (
    v.memory.validFrom &&
    v.memory.validUntil &&
    v.memory.validFrom > v.memory.validUntil
  )
    throw Error("INVALID_VALIDITY_INTERVAL");
  for (const id of v.memory.entities) {
    const entity = s.one("SELECT * FROM entities WHERE id=?", id);
    if (!entity || !JSON.parse(entity.allowed_hosts).includes(h))
      throw Error("SUBJECT_UNAVAILABLE");
  }
  let predecessor: any = undefined;
  if (v.memory.supersedes) {
    const old = memoryGet(s, v.memory.supersedes, h);
    predecessor = { version: old.version, checksum: old.checksum };
    if (v.memory.allowedHosts.some((host) => !old.allowedHosts.includes(host)))
      throw Error("ACCESS_EXPANSION_DENIED");
  }
  const note = {
    ...v.memory,
    ...(predecessor ? { predecessor } : {}),
    id: uid("memory"),
    schemaVersion: 1,
    version: 1,
    state: "proposed",
    author: v.attributedStatement ? "workspace-user" : null,
    createdBy: h,
    createdAt: now(),
    updatedAt: now(),
  };
  return commit(s, h, v.requestKey, v, [note]);
}
export function reviewVersionedMemory(s: Store, input: unknown, h: Host) {
  check(s, h, true);
  if (h !== "local") throw Error("REVIEW_REQUIRED");
  const v = z
    .object({
      requestKey: key,
      id: memoryId,
      expectedVersion: z.number().int().positive(),
      expectedChecksum: z.string().length(64),
      state: z.enum(["approved", "rejected", "retired"]),
      confirm: z.literal(true),
    })
    .strict()
    .parse(input);
  const prior = retry(s, h, v);
  if (prior) return prior;
  const current = memoryGet(s, v.id, h);
  if (
    current.version !== v.expectedVersion ||
    current.checksum !== v.expectedChecksum
  )
    throw Error("STALE_MEMORY_VERSION");
  if (["retired", "superseded"].includes(current.state))
    throw Error("MEMORY_REPLACEMENT_REQUIRED");
  if (v.state === "approved") {
    s.validateEvidence(current.evidence, h, true);
    if (!current.evidence.length && current.author !== "workspace-user")
      throw Error("MEMORY_EVIDENCE_REQUIRED");
  }
  const { checksum, ...record } = current;
  const notes = [
    {
      ...record,
      state: v.state,
      version: current.version + 1,
      updatedAt: now(),
      reviewedAt: now(),
    },
  ];
  if (v.state === "approved" && current.supersedes) {
    const old = memoryGet(s, current.supersedes, h);
    if (
      old.state !== "approved" ||
      !current.predecessor ||
      old.version !== current.predecessor.version ||
      old.checksum !== current.predecessor.checksum
    )
      throw Error("SUPERSEDED_MEMORY_CHANGED");
    if (
      current.allowedHosts.some(
        (host: Host) => !old.allowedHosts.includes(host),
      )
    )
      throw Error("ACCESS_EXPANSION_DENIED");
    const { checksum, ...previous } = old;
    notes.push({
      ...previous,
      state: "superseded",
      supersededBy: current.id,
      version: old.version + 1,
      updatedAt: now(),
      reviewedAt: now(),
    });
  }
  return commit(s, h, v.requestKey, v, notes);
}

const editIdentity = z.object({
  id: memoryId,
  expectedVersion: z.number().int().positive(),
  expectedChecksum: z.string().regex(/^[a-f0-9]{64}$/),
});
function checkedMemory(s: Store, v: z.infer<typeof editIdentity>, h: Host) {
  const m = memoryGet(s, v.id, h);
  if (m.version !== v.expectedVersion || m.checksum !== v.expectedChecksum)
    throw Error("STALE_MEMORY_VERSION");
  return m;
}
const editableFields = [
  "type",
  "content",
  "evidence",
  "entities",
  "durability",
  "validFrom",
  "validUntil",
  "allowedHosts",
] as const;
function editable(m: any) {
  return Object.fromEntries(editableFields.map((k) => [k, m[k]]));
}
/** Copy an exact revision into a new proposal; never roll back approved files. */
export function beginMemoryDraft(s: Store, input: unknown, h: Host) {
  check(s, h, true);
  const v = editIdentity
    .extend({
      requestKey: key,
      restoreVersion: z.number().int().positive().optional(),
    })
    .strict()
    .parse(input);
  const current = memoryGet(s, v.id, h);
  const prior = retry(s, h, v);
  if (prior) return prior;
  checkedMemory(s, v, h);
  if (current.state === "superseded") throw Error("MEMORY_SUCCESSOR_REQUIRED");
  const selected = v.restoreVersion
    ? memoryHistory(s, v.id, h).revisions.find(
        (m) => m.version === v.restoreVersion,
      )
    : current;
  if (!selected) throw Error("MEMORY_REVISION_UNAVAILABLE");
  s.validateEvidence(selected.evidence ?? [], h, true);
  const note = {
    ...editable(selected),
    allowedHosts: selected.allowedHosts.filter((host: Host) =>
      current.allowedHosts.includes(host),
    ),
    id: uid("memory"),
    schemaVersion: 1,
    version: 1,
    state: "proposed",
    author: selected.author ?? null,
    createdBy: h,
    createdAt: now(),
    updatedAt: now(),
    derivedFrom: {
      id: current.id,
      version: selected.version,
      checksum: selected.checksum,
    },
    ...(current.state === "approved"
      ? {
          supersedes: current.id,
          predecessor: { version: current.version, checksum: current.checksum },
        }
      : {}),
  };
  return commit(s, h, v.requestKey, v, [note]);
}
export function saveMemoryDraft(s: Store, input: unknown, h: Host) {
  check(s, h, true);
  const v = editIdentity
    .extend({
      requestKey: key,
      changes: memoryInput
        .pick({
          type: true,
          content: true,
          evidence: true,
          entities: true,
          durability: true,
          validFrom: true,
          validUntil: true,
        })
        .partial()
        .strict(),
      attributedStatement: z.boolean().default(false),
    })
    .strict()
    .parse(input);
  memoryGet(s, v.id, h);
  const prior = retry(s, h, v);
  if (prior) return prior;
  const current = checkedMemory(s, v, h);
  if (current.state !== "proposed") throw Error("MEMORY_DRAFT_REQUIRED");
  if (v.attributedStatement && h !== "local")
    throw Error("USER_ATTRIBUTION_REQUIRED");
  const next = { ...current, ...v.changes };
  if (!next.content.trim()) throw Error("MEMORY_CONTENT_REQUIRED");
  if (next.validFrom && next.validUntil && next.validFrom > next.validUntil)
    throw Error("INVALID_VALIDITY_INTERVAL");
  s.validateEvidence(next.evidence, h, true);
  for (const id of next.entities) {
    const e = s.one("SELECT * FROM entities WHERE id=?", id);
    if (!e || !JSON.parse(e.allowed_hosts).includes(h))
      throw Error("SUBJECT_UNAVAILABLE");
  }
  const changed =
    JSON.stringify(editable(next)) !== JSON.stringify(editable(current));
  const { checksum, ...note } = next;
  return commit(s, h, v.requestKey, v, [
    {
      ...note,
      author: v.attributedStatement
        ? "workspace-user"
        : changed
          ? null
          : current.author,
      version: current.version + 1,
      updatedAt: now(),
    },
  ]);
}
export function compareMemoryDraft(s: Store, id: string, h: Host) {
  const draft = memoryGet(s, id, h);
  if (draft.state !== "proposed") throw Error("MEMORY_DRAFT_REQUIRED");
  const baseId = draft.supersedes ?? draft.derivedFrom?.id;
  const base = baseId ? memoryGet(s, baseId, h) : null;
  const history = memoryHistory(s, id, h).revisions;
  const previous = history.find((m) => m.version < draft.version) ?? null;
  return {
    draft,
    base,
    previous,
    stalePredecessor: !!(
      draft.supersedes &&
      (!base ||
        base.state !== "approved" ||
        base.version !== draft.predecessor?.version ||
        base.checksum !== draft.predecessor?.checksum)
    ),
    changes: editableFields
      .filter(
        (k) =>
          JSON.stringify(base?.[k] ?? null) !==
          JSON.stringify(draft[k] ?? null),
      )
      .map((field) => ({
        field,
        before: base?.[field] ?? null,
        after: draft[field] ?? null,
      })),
  };
}
