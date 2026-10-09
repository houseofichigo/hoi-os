import { Worker } from "node:worker_threads";
import { existsSync, mkdirSync, renameSync, createWriteStream } from "node:fs";
import { copyFile, stat, unlink } from "node:fs/promises";
import { pipeline as streamPipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { join, dirname } from "node:path";
import { load } from "sqlite-vec";
import { z } from "zod";
import { type Store } from "./store.js";
import { type Host } from "./schema.js";
import { safePath, sha, now, uid } from "./files.js";
import { checksumModelFile } from "./file-work.js";
import { LOCAL_MODEL } from "./local-model.js";
import { wikiLibrary } from "./wiki-core.js";

export const MODEL_FINGERPRINT = sha(JSON.stringify(LOCAL_MODEL));
const queryVectors = new Map<string, number[]>(),
  workers = new Map<string, Worker>();
let queue: Promise<unknown> = Promise.resolve();
const loaded = new WeakSet<object>();
const root = (s: Store) => s.path(`.hoi/models/${MODEL_FINGERPRINT}`);
export function enabled(s: Store) {
  return (
    s.schemaVersion >= 19 &&
    JSON.parse(
      s.one(
        "SELECT payload FROM knowledge_retrieval_config WHERE id='semantic'",
      )?.payload ?? "{}",
    ).enabled === true
  );
}
function key(s: Store, h: Host, q: string) {
  return sha(s.root + "\0" + h + "\0" + q);
}
function extension(s: Store) {
  if (!loaded.has(s.db)) {
    load(s.db);
    loaded.add(s.db);
  }
  s.db.exec(
    "CREATE TABLE IF NOT EXISTS knowledge_vectors(id TEXT NOT NULL,generation_id TEXT NOT NULL,embedding BLOB NOT NULL,PRIMARY KEY(id,generation_id))",
  );
}
export function indexStatus(s: Store, h: Host) {
  s.assertHost(h);
  const generation =
    s.schemaVersion >= 19
      ? s.one(
          "SELECT id,model_fingerprint FROM knowledge_index_generations WHERE state='active' AND model_fingerprint=?",
          MODEL_FINGERPRINT,
        )
      : null;
  const units = s.schemaVersion >= 19 ? collectUnits(s, h) : [];
  const indexed = new Set(
    generation
      ? s
          .all(
            "SELECT payload FROM knowledge_search_units WHERE generation_id=?",
            generation.id,
          )
          .map((r) => JSON.stringify(JSON.parse(r.payload).reference))
      : [],
  );
  const domains = Object.fromEntries(
    ["source", "wiki", "memory"].map((kind) => {
      const eligible = units.filter((u) => u.kind === kind),
        missing = eligible.filter(
          (u) => !indexed.has(JSON.stringify(u.reference)),
        ).length;
      return [
        kind,
        {
          eligible: eligible.length,
          indexed: eligible.length - missing,
          pending: missing,
        },
      ];
    }),
  );
  const coverage = units.filter(
    (u) => !indexed.has(JSON.stringify(u.reference)),
  ).length;
  const maintenance =
    s.schemaVersion >= 19
      ? JSON.parse(
          s.one(
            "SELECT payload FROM knowledge_retrieval_config WHERE id='maintenance'",
          )?.payload ?? "{}",
        )
      : {};
  return {
    lexical: "available",
    domains,
    maintenance: {
      state: maintenance.state ?? "idle",
      reason: maintenance.reason ?? null,
      updatedAt: maintenance.updatedAt ?? null,
    },
    semantic: !enabled(s)
      ? "disabled"
      : generation
        ? coverage
          ? "partial"
          : "ready"
        : "not-indexed",
    model: LOCAL_MODEL.id,
    modelFingerprint: MODEL_FINGERPRINT,
    indexingRequired: coverage,
    modelBytes: LOCAL_MODEL.files.reduce((n, f) => n + f.size, 0),
    generation: generation?.id ?? null,
    limitations: [
      "Read-time permissions and revision checks remain authoritative; stale units are excluded.",
    ],
  };
}
export function configureSemantic(s: Store, h: Host, input: unknown) {
  s.assertSchema(19, "Local semantic search");
  s.assertHost(h);
  if (h !== "local" || s.policy().actions.draft !== "allow")
    throw Error("LOCAL_CONFIGURATION_REQUIRED");
  const v = z
    .object({ enabled: z.boolean(), confirm: z.literal(true) })
    .strict()
    .parse(input);
  s.exec(
    "INSERT OR REPLACE INTO knowledge_retrieval_config VALUES('semantic',?)",
    JSON.stringify(v),
  );
  if (!v.enabled) {
    workers.get(s.root)?.terminate();
    workers.delete(s.root);
    queryVectors.clear();
  }
  return indexStatus(s, h);
}
async function modelReady(s: Store) {
  for (const f of LOCAL_MODEL.files) {
    const path = safePath(root(s), f.path);
    if (
      !existsSync(path) ||
      (await checksumModelFile(path)).checksum !== f.sha256
    )
      throw Error("LOCAL_MODEL_MISSING_OR_CORRUPT");
  }
}
export async function installLocalModel(s: Store, h: Host, input: unknown) {
  s.assertSchema(19, "Local model");
  s.assertHost(h);
  if (h !== "local" || !enabled(s) || s.policy().actions.draft !== "allow")
    throw Error("SEMANTIC_OPT_IN_REQUIRED");
  const v = z
    .object({ confirm: z.literal(true), directory: z.string().optional() })
    .strict()
    .parse(input);
  for (const f of LOCAL_MODEL.files) {
    const dest = safePath(root(s), f.path);
    mkdirSync(dirname(dest), { recursive: true, mode: 0o700 });
    if (
      existsSync(dest) &&
      (await checksumModelFile(dest)).checksum === f.sha256
    )
      continue;
    const temp = safePath(root(s), f.path + "." + uid("download") + ".tmp");
    if (v.directory) {
      const source = safePath(v.directory, f.path);
      if ((await stat(source)).size !== f.size)
        throw Error("MODEL_SIZE_MISMATCH");
      await copyFile(source, temp);
    } else {
      const response = await fetch(
        `https://huggingface.co/${LOCAL_MODEL.id}/resolve/${LOCAL_MODEL.revision}/${f.remote}`,
        { signal: AbortSignal.timeout(600000) },
      );
      if (!response.ok || !response.body) throw Error("MODEL_DOWNLOAD_FAILED");
      let bytes = 0;
      const bound = new Transform({
        transform(chunk, _encoding, callback) {
          bytes += chunk.length;
          callback(bytes > f.size ? Error("MODEL_SIZE_EXCEEDED") : null, chunk);
        },
      });
      await streamPipeline(
        Readable.fromWeb(response.body as any),
        bound,
        createWriteStream(temp, { mode: 0o600, flags: "wx" }),
      );
    }
    if ((await checksumModelFile(temp)).checksum !== f.sha256) {
      await unlink(temp);
      throw Error("MODEL_CHECKSUM_MISMATCH");
    }
    renameSync(temp, dest);
  }
  s.exec(
    "INSERT OR REPLACE INTO knowledge_model_manifests VALUES(?,?,?)",
    MODEL_FINGERPRINT,
    JSON.stringify(LOCAL_MODEL),
    now(),
  );
  return { state: "installed", fingerprint: MODEL_FINGERPRINT };
}
export function embed(s: Store, text: string, query = false): Promise<any[]> {
  const next = queue.then(
    () =>
      new Promise<any[]>((resolve, reject) => {
        const worker =
          workers.get(s.root) ??
          new Worker(new URL("./embedding-worker.js", import.meta.url), {
            execArgv: [],
          });
        workers.set(s.root, worker);
        worker.ref();
        let settled = false;
        const finish = (error?: Error, value?: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          worker.off("message", message);
          worker.off("error", failed);
          worker.off("exit", exited);
          worker.unref();
          error ? reject(error) : resolve(value);
        };
        const message = (r: any) =>
          r.error ? finish(Error(r.error)) : finish(undefined, r.segments);
        const failed = () => {
          workers.delete(s.root);
          finish(Error("LOCAL_EMBEDDING_FAILED"));
        };
        const exited = () => {
          workers.delete(s.root);
          finish(Error("LOCAL_EMBEDDING_INTERRUPTED"));
        };
        const timer = setTimeout(() => {
          workers.delete(s.root);
          void worker.terminate();
          finish(Error("LOCAL_EMBEDDING_TIMEOUT"));
        }, 120000);
        worker.once("message", message);
        worker.once("error", failed);
        worker.once("exit", exited);
        worker.postMessage({ path: root(s), text, query });
      }),
  );
  queue = next.catch(() => {});
  return next;
}
export async function prepareSemanticQuery(s: Store, h: Host, query: string) {
  if (
    !enabled(s) ||
    !s.one(
      "SELECT 1 FROM knowledge_index_generations WHERE state='active' AND model_fingerprint=?",
      MODEL_FINGERPRINT,
    )
  )
    return;
  const k = key(s, h, query);
  if (queryVectors.has(k)) return;
  try {
    if (!workers.has(s.root)) await modelReady(s);
    const values = await embed(s, query, true);
    queryVectors.set(k, values[0].vector);
    while (queryVectors.size > 64)
      queryVectors.delete(queryVectors.keys().next().value!);
  } catch {
    queryVectors.delete(k);
  }
}
export function semanticReferences(
  s: Store,
  h: Host,
  query: string,
  allow: (ref: any) => boolean,
) {
  if (!enabled(s)) return [];
  const vector = queryVectors.get(key(s, h, query));
  if (!vector) return [];
  const generation = s.one(
    "SELECT id FROM knowledge_index_generations WHERE state='active' AND model_fingerprint=?",
    MODEL_FINGERPRINT,
  );
  if (!generation) return [];
  try {
    extension(s);
    const allowed = s
      .all(
        "SELECT id,payload FROM knowledge_search_units WHERE generation_id=?",
        generation.id,
      )
      .filter((r) => {
        try {
          return allow(JSON.parse(r.payload).reference);
        } catch {
          return false;
        }
      })
      .map((r) => r.id);
    if (!allowed.length) return [];
    return s
      .all(
        "SELECT u.payload,vec_distance_cosine(v.embedding,?) distance FROM knowledge_vectors v JOIN knowledge_search_units u ON u.id=v.id AND u.generation_id=v.generation_id WHERE v.generation_id=? AND v.id IN (SELECT value FROM json_each(?)) ORDER BY distance LIMIT 50",
        Buffer.from(new Float32Array(vector).buffer),
        generation.id,
        JSON.stringify(allowed),
      )
      .map((r) => JSON.parse(r.payload));
  } catch {
    return [];
  }
}
export function collectUnits(s: Store, h: Host) {
  const units: {
    reference: any;
    text: string;
    recordId: string;
    revision: string;
    kind: string;
  }[] = [];
  for (const r of s.all(
    "SELECT p.*,s.id source_id,s.metadata FROM passages p JOIN revisions r ON r.id=p.revision_id JOIN sources s ON s.current_revision=r.id",
  )) {
    if (
      !s.allowed({ id: r.source_id, metadata: JSON.parse(r.metadata) }, h) ||
      JSON.parse(r.metadata).status === "superseded"
    )
      continue;
    units.push({
      kind: "source",
      recordId: r.source_id,
      revision: r.revision_id,
      text: r.text,
      reference: { kind: "source", revisionId: r.revision_id, passageId: r.id },
    });
  }
  for (const p of wikiLibrary(s, h).filter(
    (p) => p.status === "canonical" && p.evidenceCurrent,
  )) {
    for (const b of p.legacy ? [{ id: "legacy", text: p.content }] : p.blocks) {
      if (["question", "unverified"].includes(b.kind)) continue;
      units.push({
        kind: "wiki",
        recordId: p.pageId,
        revision: p.id,
        text: b.text,
        reference: {
          kind: "wiki",
          pageId: p.pageId,
          wikiRevisionId: p.id,
          blockId: b.id,
        },
      });
    }
  }
  const today = now().slice(0, 10);
  for (const m of s
    .memories()
    .filter(
      (m) =>
        m.state === "approved" &&
        m.allowedHosts.includes(h) &&
        s.evidenceVisible(m.evidence, h) &&
        (!m.validFrom || m.validFrom <= today) &&
        (!m.validUntil || m.validUntil >= today),
    )) {
    const revision = sha(JSON.stringify(m));
    units.push({
      kind: "memory",
      recordId: m.id,
      revision,
      text: m.content,
      reference: { kind: "memory", memoryId: m.id, memoryRevision: revision },
    });
  }
  return units;
}
export async function rebuildKnowledge(s: Store, h: Host, input: unknown) {
  s.assertSchema(19, "Knowledge indexing");
  s.assertHost(h);
  if (h !== "local" || !enabled(s) || s.policy().actions.draft !== "allow")
    throw Error("SEMANTIC_OPT_IN_REQUIRED");
  const v = z
    .object({ requestKey: z.string().min(8).max(200) })
    .strict()
    .parse(input);
  extension(s);
  await modelReady(s);
  const jobId = "index_" + sha(v.requestKey),
    existing = s.one("SELECT * FROM intake_jobs WHERE id=?", jobId);
  if (existing?.state === "completed") return JSON.parse(existing.result);
  if (existing?.state === "cancelled") throw Error("JOB_CANCELLED");
  const generation = existing
    ? JSON.parse(existing.payload).generation
    : uid("indexgeneration");
  if (existing)
    s.exec(
      "UPDATE intake_jobs SET state='processing',reason=NULL,updated_at=? WHERE id=?",
      now(),
      jobId,
    );
  if (!existing)
    s.tx(() => {
      s.exec(
        "INSERT INTO knowledge_index_generations VALUES(?,?,?, ?,NULL)",
        generation,
        MODEL_FINGERPRINT,
        "building",
        now(),
      );
      s.exec(
        "INSERT INTO intake_jobs VALUES(?,?,?,?,?,?,?,?,?)",
        jobId,
        h,
        "processing",
        JSON.stringify({
          kind: "knowledge-index",
          input: "Local knowledge index",
          generation,
          requestKey: v.requestKey,
        }),
        null,
        null,
        1,
        now(),
        now(),
      );
    });
  const units = collectUnits(s, h),
    fingerprint = knowledgeFingerprint(s, h);
  const payload = JSON.parse(
    s.one("SELECT payload FROM intake_jobs WHERE id=?", jobId).payload,
  );
  if (payload.inputFingerprint !== fingerprint)
    s.tx(() => {
      s.exec("DELETE FROM knowledge_vectors WHERE generation_id=?", generation);
      s.exec(
        "DELETE FROM knowledge_search_units WHERE generation_id=?",
        generation,
      );
      s.exec(
        "UPDATE intake_jobs SET payload=? WHERE id=?",
        JSON.stringify({ ...payload, inputFingerprint: fingerprint }),
        jobId,
      );
    });
  try {
    for (const unit of units) {
      if (
        s.one("SELECT state FROM intake_jobs WHERE id=?", jobId)?.state ===
        "cancelled"
      )
        throw Error("JOB_CANCELLED");
      const base = sha(
        JSON.stringify([
          unit.reference,
          sha(unit.text),
          MODEL_FINGERPRINT,
          generation,
        ]),
      );
      if (s.one("SELECT 1 FROM knowledge_search_units WHERE id=?", base + ":0"))
        continue;
      const segments = await embed(s, unit.text);
      s.tx(() => {
        segments.forEach((segment, index) => {
          const id = base + ":" + index;
          s.exec(
            "INSERT OR REPLACE INTO knowledge_search_units VALUES(?,?,?,?,?,?,?)",
            id,
            unit.kind,
            unit.recordId,
            unit.revision,
            sha(segment.text),
            JSON.stringify({
              reference: unit.reference,
              start: segment.start,
              end: segment.end,
            }),
            generation,
          );
          s.exec(
            "INSERT OR REPLACE INTO knowledge_vectors VALUES(?,?,?)",
            id,
            generation,
            Buffer.from(new Float32Array(segment.vector).buffer),
          );
        });
      });
    }
    if (
      s.one("SELECT state FROM intake_jobs WHERE id=?", jobId)?.state ===
      "cancelled"
    )
      throw Error("JOB_CANCELLED");
    if (knowledgeFingerprint(s, h) !== fingerprint)
      throw Error("INDEX_INPUT_CHANGED");
    const result = {
      id: jobId,
      state: "completed",
      generation,
      units: units.length,
      fingerprint,
    };
    s.tx(() => {
      s.exec(
        "UPDATE knowledge_index_generations SET state='retired' WHERE state='active'",
      );
      s.exec(
        "UPDATE knowledge_index_generations SET state='active',activated_at=? WHERE id=?",
        now(),
        generation,
      );
      s.exec(
        "UPDATE intake_jobs SET state='completed',result=?,updated_at=? WHERE id=?",
        JSON.stringify(result),
        now(),
        jobId,
      );
    });
    return result;
  } catch (e) {
    s.exec(
      "UPDATE intake_jobs SET state=?,reason=?,updated_at=? WHERE id=?",
      (e as Error).message === "JOB_CANCELLED" ? "cancelled" : "failed",
      "LOCAL_INDEX_INTERRUPTED",
      now(),
      jobId,
    );
    throw e;
  }
}

export function knowledgeFingerprint(s: Store, h: Host) {
  return sha(
    JSON.stringify(
      collectUnits(s, h)
        .map((u) => [JSON.stringify(u.reference), sha(u.text)])
        .sort((a, b) => a[0].localeCompare(b[0])),
    ),
  );
}
export function localModelPresent(s: Store) {
  return LOCAL_MODEL.files.every((f) => existsSync(safePath(root(s), f.path)));
}
