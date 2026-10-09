import { z } from "zod";
import { Store } from "./store.js";
import { uid, now, sha, atomic } from "./files.js";
import { type Host, id } from "./schema.js";
import { ingest } from "./intake.js";
import { listWiki } from "./wiki.js";
import { listTasks } from "./tasks.js";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
export const HUB_SQL = `CREATE TABLE IF NOT EXISTS source_lifecycle(source_id TEXT PRIMARY KEY REFERENCES sources(id),state TEXT NOT NULL,version INTEGER NOT NULL,at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hub_jobs(id TEXT PRIMARY KEY,host TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,result TEXT,at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS source_reviews(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,host TEXT NOT NULL,fingerprint TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,at TEXT NOT NULL);`;
export function hubAccess(s: Store, h: Host, write = false) {
  s.assertSchema(8, "Knowledge Hub");
  s.assertHost(h);
  if (write && s.policy().actions.draft !== "allow")
    throw Error("Direct changes require draft: allow");
}
export function hubSources(s: Store, h: Host) {
  hubAccess(s, h);
  return s
    .all(
      "SELECT s.*,r.status extractionStatus FROM sources s LEFT JOIN revisions r ON r.id=s.current_revision",
    )
    .filter((r) => s.allowed(r, h, true))
    .map((r) => ({
      id: r.id,
      title: r.title,
      currentRevision: r.current_revision,
      extractionStatus: r.extractionStatus,
      lastChecked: r.last_checked,
      metadata: JSON.parse(r.metadata),
      ...(s.one(
        "SELECT state,version FROM source_lifecycle WHERE source_id=?",
        r.id,
      ) || { state: "active", version: 0 }),
    }));
}
export function sourceImpact(s: Store, key: string, h: Host) {
  hubAccess(s, h);
  const source = hubSources(s, h).find((x) => x.id === key);
  if (!source) throw Error("Source unavailable");
  const refs = (e: any[]) =>
    e.some(
      (x) =>
        s.one("SELECT source_id FROM revisions WHERE id=?", x.revisionId)
          ?.source_id === key,
    );
  const wiki = s
    .all("SELECT id,title,allowed_hosts FROM wiki_pages")
    .filter(
      (w) =>
        JSON.parse(w.allowed_hosts).includes(h) &&
        s
          .all(
            "SELECT revision_id revisionId,passage_id passageId,quote FROM wiki_evidence WHERE page_id=?",
            w.id,
          )
          .some((e) => refs([e])),
    )
    .filter((w) =>
      s
        .all(
          "SELECT revision_id revisionId FROM wiki_evidence WHERE page_id=?",
          w.id,
        )
        .every((e) => {
          const r = s.one(
            "SELECT s.* FROM sources s JOIN revisions r ON r.source_id=s.id WHERE r.id=?",
            e.revisionId,
          );
          return r && s.allowed(r, h, true);
        }),
    );
  const memories = s.memories(true).filter(
    (m) =>
      m.allowedHosts.includes(h) &&
      refs(m.evidence || []) &&
      (m.evidence || []).every((e: any) => {
        const r = s.one(
          "SELECT s.* FROM sources s JOIN revisions r ON r.source_id=s.id WHERE r.id=?",
          e.revisionId,
        );
        return r && s.allowed(r, h, true);
      }),
  );
  const tasks = listTasks(s, h).filter((t) => refs(t.evidence));
  const result = {
    source,
    wiki: wiki.map((w) => ({ id: w.id, title: w.title })),
    memories: memories.map((m) => ({ id: m.id, content: m.content })),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title })),
    citations: s.one(
      "SELECT count(*) n FROM passages p JOIN revisions r ON r.id=p.revision_id WHERE r.source_id=?",
      key,
    ).n,
  };
  return { ...result, digest: sha(JSON.stringify(result)) };
}
export function changeSource(s: Store, input: unknown, h: Host) {
  hubAccess(s, h, true);
  const v = z
    .object({
      id,
      expectedVersion: z.number().int().nonnegative(),
      digest: z.string(),
      state: z.enum(["active", "archived"]),
    })
    .strict()
    .parse(input);
  return s.tx(() => {
    const p = sourceImpact(s, v.id, h);
    if (p.digest !== v.digest || p.source.version !== v.expectedVersion)
      throw Error("Source impact changed; review again");
    s.exec(
      "INSERT INTO source_lifecycle VALUES(?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET state=excluded.state,version=excluded.version,at=excluded.at",
      v.id,
      v.state,
      v.expectedVersion + 1,
      now(),
    );
    s.log("source.lifecycle", { id: v.id, state: v.state });
    return { id: v.id, state: v.state };
  });
}
const uploadSchema = z
  .object({
    files: z
      .array(
        z
          .object({
            name: z
              .string()
              .min(1)
              .max(240)
              .refine(
                (v) =>
                  basename(v) === v &&
                  !/[\\/\x00]/.test(v) &&
                  !v.startsWith("."),
              ),
            size: z
              .number()
              .int()
              .nonnegative()
              .max(50 * 1024 * 1024),
            checksum: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .min(1)
      .max(150),
    project: z.string().nullable().default(null),
    client: z.string().nullable().default(null),
  })
  .strict()
  .refine(
    (v) => v.files.reduce((n, f) => n + f.size, 0) <= 1024 ** 3,
    "Import exceeds 1 GB",
  );
export function planUpload(s: Store, input: unknown, h: Host) {
  hubAccess(s, h, true);
  const v = uploadSchema.parse(input);
  for (const [key, type] of [
    [v.project, "project"],
    [v.client, "client"],
  ])
    if (
      key &&
      !s.one("SELECT * FROM entities WHERE id=? AND type=?", key, type)
    )
      throw Error("Unknown assignment");
  for (const key of [v.project, v.client])
    if (
      key &&
      !JSON.parse(
        s.one("SELECT allowed_hosts FROM entities WHERE id=?", key)
          .allowed_hosts,
      ).includes(h)
    )
      throw Error("Assignment unavailable");
  const jobs = v.files.map((f) => ({
    id: uid("upload"),
    ...f,
    project: v.project,
    client: v.client,
    duplicate: s
      .all(
        "SELECT s.* FROM sources s JOIN revisions r ON r.source_id=s.id WHERE r.checksum=?",
        f.checksum,
      )
      .some((r) => s.allowed(r, h)),
  }));
  s.tx(() => {
    for (const j of jobs)
      s.exec(
        "INSERT INTO hub_jobs VALUES(?,?,?,?,?,?)",
        j.id,
        h,
        JSON.stringify(j),
        "queued",
        null,
        now(),
      );
  });
  return jobs;
}
export function uploadJobs(s: Store, h: Host) {
  hubAccess(s, h);
  return s
    .all("SELECT * FROM hub_jobs WHERE host=? ORDER BY at DESC", h)
    .flatMap((r) => {
      const result = r.result ? JSON.parse(r.result) : null;
      if (result?.sourceId) {
        const src = s.one("SELECT * FROM sources WHERE id=?", result.sourceId);
        if (!src || !s.allowed(src, h)) return [];
      }
      return [{ ...JSON.parse(r.payload), state: r.state, result }];
    });
}
const active = new Set<string>();
export async function receiveUpload(
  s: Store,
  key: string,
  h: Host,
  stream: any,
) {
  hubAccess(s, h, true);
  const row = s.one(
    "SELECT * FROM hub_jobs WHERE id=? AND host=?",
    id.parse(key),
    h,
  );
  if (!row) throw Error("Upload unavailable");
  if (active.has(s.root + key)) throw Error("Upload busy");
  if (["indexed", "extraction-gap"].includes(row.state)) {
    const result = JSON.parse(row.result);
    const src = s.one("SELECT * FROM sources WHERE id=?", result.sourceId);
    if (!src || !s.allowed(src, h)) throw Error("Upload unavailable");
    stream.resume?.();
    return result;
  }
  const item = JSON.parse(row.payload),
    dir = s.path(".hoi/uploads/" + key),
    file = join(dir, item.name);
  active.add(s.root + key);
  mkdirSync(dir, { recursive: true });
  s.exec("UPDATE hub_jobs SET state='processing' WHERE id=?", key);
  try {
    let bytes = 0;
    await pipeline(
      stream,
      new Transform({
        transform(chunk, _enc, cb) {
          bytes += chunk.length;
          cb(
            bytes > item.size || bytes > 50 * 1024 * 1024
              ? Error("Upload exceeds declared size")
              : null,
            chunk,
          );
        },
      }),
      createWriteStream(file, { flags: "w", mode: 0o600 }),
    );
    if (bytes !== item.size || sha(readFileSync(file)) !== item.checksum)
      throw Error("Upload checksum mismatch");
    const prior = s.one(
      "SELECT * FROM sources WHERE source_key=?",
      "upload:" + item.checksum + ":" + item.name,
    );
    if (prior && !s.allowed(prior, h)) throw Error("Source unavailable");
    const result = await ingest(s, file, {
      host: h,
      uploadJobId: key,
      sourceKey: "upload:" + item.checksum + ":" + item.name,
      metadata: prior
        ? JSON.parse(prior.metadata)
        : {
            title: item.name,
            project: item.project,
            client: item.client,
            allowedHosts: ["local", "codex", "claude"],
          },
    });
    if (s.schemaVersion >= 10)
      s.exec(
        "INSERT INTO assistant_queue VALUES(?,?,'awaiting-assistant') ON CONFLICT(source_id) DO UPDATE SET revision_id=excluded.revision_id,state=CASE WHEN revision_id=excluded.revision_id THEN state ELSE 'awaiting-assistant' END",
        result.sourceId,
        result.revisionId,
      );
    s.exec(
      "UPDATE hub_jobs SET state=?,result=? WHERE id=?",
      result.status === "ready" ? "indexed" : "extraction-gap",
      JSON.stringify(result),
      key,
    );
    return result;
  } catch {
    s.exec("UPDATE hub_jobs SET state='failed' WHERE id=?", key);
    throw Error("Upload failed; check the file and retry the same job");
  } finally {
    active.delete(s.root + key);
    rmSync(dir, { recursive: true, force: true });
  }
}
export function scanSources(s: Store, h: Host) {
  hubAccess(s, h, true);
  for (const r of hubSources(s, h).filter((r) => r.state === "active")) {
    const problems = [];
    if (r.extractionStatus !== "ready")
      problems.push("Extraction needs review");
    if (Date.now() - Date.parse(r.lastChecked) > 30 * 86400000)
      problems.push("Source has not been verified for 30 days");
    if (r.metadata.status === "superseded")
      problems.push("Source marked superseded");
    const duplicate = s
      .all(
        "SELECT s.* FROM sources s JOIN revisions r ON r.id=s.current_revision WHERE r.checksum=(SELECT checksum FROM revisions WHERE id=(SELECT current_revision FROM sources WHERE id=?)) AND s.id!=?",
        r.id,
        r.id,
      )
      .some((x) => s.allowed(x, h));
    if (duplicate) problems.push("Same content in another visible source");
    if (!problems.length) continue;
    const fingerprint = sha(
        JSON.stringify({
          sourceId: r.id,
          revision: s.one(
            "SELECT current_revision FROM sources WHERE id=?",
            r.id,
          )?.current_revision,
          metadata: r.metadata,
          problems,
        }),
      ),
      key = "sr_" + sha(h + fingerprint);
    s.exec(
      "UPDATE source_reviews SET state='obsolete' WHERE source_id=? AND host=? AND state='pending' AND fingerprint!=?",
      r.id,
      h,
      fingerprint,
    );
    s.exec(
      "INSERT OR IGNORE INTO source_reviews VALUES(?,?,?,?,?,?,?)",
      key,
      r.id,
      h,
      fingerprint,
      JSON.stringify({
        title: r.title,
        problems,
        sourceId: r.id,
        explanation: problems.join("; "),
        recommendedAction: r.extractionStatus !== "ready" ? "update" : "verify",
        evidence: {
          revisionId: s.one(
            "SELECT current_revision FROM sources WHERE id=?",
            r.id,
          )?.current_revision,
        },
        affectedRecords: sourceImpact(s, r.id, h),
      }),
      "pending",
      now(),
    );
  }
  return sourceReviews(s, h);
}
export function sourceReviews(s: Store, h: Host) {
  hubAccess(s, h);
  return s
    .all("SELECT * FROM source_reviews WHERE host=? ORDER BY at DESC", h)
    .filter((r) => {
      const src = s.one("SELECT * FROM sources WHERE id=?", r.source_id);
      return src && s.allowed(src, h);
    })
    .map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
}
export function reviewSource(s: Store, input: unknown, h: Host) {
  hubAccess(s, h, true);
  const v = z
    .object({ id, decision: z.enum(["keep", "verify", "update", "archive"]) })
    .strict()
    .parse(input);
  const r = sourceReviews(s, h).find((x) => x.id === v.id);
  if (!r || r.state !== "pending") throw Error("Finding unavailable");
  if (v.decision === "archive") return sourceImpact(s, r.source_id, h);
  s.exec("UPDATE source_reviews SET state=? WHERE id=?", v.decision, r.id);
  return { id: r.id, state: v.decision };
}
export function sourceHistory(s: Store, key: string, h: Host) {
  hubAccess(s, h);
  const src = s.one("SELECT * FROM sources WHERE id=?", key);
  if (!src || !s.allowed(src, h, true)) throw Error("Source unavailable");
  return s
    .all(
      "SELECT id,checksum,status,created_at FROM revisions WHERE source_id=? ORDER BY created_at DESC",
      key,
    )
    .map((r) => ({
      ...r,
      passages: s.all(
        "SELECT id,location FROM passages WHERE revision_id=?",
        r.id,
      ),
    }));
}

export function sourceDetail(s: Store, key: string, h: Host) {
  hubAccess(s, h);
  const source = hubSources(s, h).find((x) => x.id === key);
  if (!source) throw Error("Source unavailable");
  const raw = s.one("SELECT * FROM sources WHERE id=?", key);
  // Archived originals remain in history; active previews never include archived passages.
  const revisions = s.all(
    "SELECT id,status,created_at FROM revisions WHERE source_id=? ORDER BY created_at DESC",
    key,
  );
  const passages =
    source.state === "active"
      ? s.all(
          "SELECT id,text,location FROM passages WHERE revision_id=?",
          raw.current_revision,
        )
      : [];
  const impact = sourceImpact(s, key, h);
  const visibleWiki = new Set(listWiki(s, h).map((w) => w.id));
  return {
    source,
    passages,
    revisions,
    linked: [
      ...(impact.wiki ?? []).filter((w) => visibleWiki.has(w.id)),
      ...(impact.tasks ?? []),
    ].map((r: any) => ({
      id: r.id,
      title: r.title,
    })),
  };
}
