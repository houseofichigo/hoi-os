import { rebuildKnowledge } from "./semantic.js";
import { knowledgeSearch } from "./retrieval.js";
import { prepareFile, extractTextFile } from "./file-work.js";
import { localSource, recordLocation } from "./local-identity.js";
import { readFileSync, statSync, existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, parse, relative, resolve } from "node:path";
import { Store } from "./store.js";
import { metadata, type Host } from "./schema.js";
import {
  assertInput,
  atomic,
  sha,
  uid,
  now,
  walk,
  contained,
} from "./files.js";
import { extractSafe as extract } from "./extract-safe.js";
import { parseCsv } from "./structured.js";

export const DEFAULT_INGEST_MAX_FILES = 150;
export const DEFAULT_INGEST_MAX_BYTES = 1024 * 1024 * 1024;

type IngestLimits = { maxFiles?: number; maxBytes?: number };

function positiveLimit(value: number | undefined, fallback: number) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1)
    throw Error("Ingest limits must be positive integers");
  return value;
}

export function planIngest(
  s: Store,
  input: string,
  options: IngestLimits = {},
) {
  const path = assertInput(input);
  if (contained(realpathSync(s.root), path))
    throw Error("Do not re-ingest workspace storage");
  const directory = statSync(path).isDirectory();
  const root = directory ? path : resolve(path, "..");
  const selected = directory ? walk(path) : [path];
  const files = selected
    .map((file) => {
      const stat = statSync(file);
      return {
        path: relative(root, file).replaceAll("\\", "/"),
        bytes: stat.size,
        modifiedMs: Math.trunc(stat.mtimeMs),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  const maxFiles = positiveLimit(options.maxFiles, DEFAULT_INGEST_MAX_FILES);
  const maxBytes = positiveLimit(options.maxBytes, DEFAULT_INGEST_MAX_BYTES);
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const oversizedFiles = files.filter(
    (file) => file.bytes > 50 * 1024 * 1024,
  ).length;
  const extensions: Record<string, number> = {};
  for (const file of files) {
    const extension = extname(file.path).toLowerCase() || "[none]";
    extensions[extension] = (extensions[extension] ?? 0) + 1;
  }
  const resolved = resolve(path);
  const broadRoot =
    resolved === parse(resolved).root || resolved === resolve(homedir());
  const warnings = [
    ...(broadRoot ? ["BROAD_IMPORT_ROOT"] : []),
    ...(files.length > maxFiles ? ["FILE_LIMIT_EXCEEDED"] : []),
    ...(totalBytes > maxBytes ? ["BYTE_LIMIT_EXCEEDED"] : []),
    ...(oversizedFiles ? ["FILE_SIZE_LIMIT_EXCEEDED"] : []),
    ...(files.length === 0 ? ["NO_FILES_SELECTED"] : []),
  ];
  const manifest = {
    root,
    target: directory ? "." : relative(root, path).replaceAll("\\", "/"),
    files,
    limits: { maxFiles, maxBytes },
  };
  const existingLocations = new Set(
    s.all("SELECT location FROM sources").map((source) => source.location),
  );
  return {
    planHash: sha(JSON.stringify(manifest)),
    root,
    target: manifest.target,
    fileCount: files.length,
    totalBytes,
    extensions: Object.fromEntries(
      Object.entries(extensions).sort(([a], [b]) => a.localeCompare(b)),
    ),
    existingLocations: files.filter((file) =>
      existingLocations.has(resolve(root, file.path)),
    ).length,
    oversizedFiles,
    limits: manifest.limits,
    blocked: warnings.length > 0,
    warnings,
    files,
  };
}

async function ingestInternal(
  s: Store,
  input: string,
  options: {
    host?: Host;
    jobId?: string;
    uploadJobId?: string;
    metadata?: unknown;
    sourceId?: string;
    sourceKey?: string;
    planHash?: string;
    maxFiles?: number;
    maxBytes?: number;
  } = {},
): Promise<any> {
  const path = assertInput(input);
  if (contained(realpathSync(s.root), path)) {
    const upload =
      options.uploadJobId &&
      s.one(
        "SELECT * FROM hub_jobs WHERE id=? AND host=? AND state='processing'",
        options.uploadJobId,
        options.host || "local",
      );
    const expected =
      upload &&
      s.path(
        `.hoi/uploads/${options.uploadJobId}/${JSON.parse(upload.payload).name}`,
      );
    if (!expected || realpathSync(expected) !== path)
      throw Error("Do not re-ingest workspace storage");
  }
  if (statSync(path).isDirectory()) {
    if (options.sourceId || options.sourceKey)
      throw Error("Source identity options require a single file");
    const plan = planIngest(s, path, options);
    if (!options.planHash)
      throw Error(
        `Directory ingestion requires a reviewed plan. Run ingest-plan first and pass --plan-hash ${plan.planHash}`,
      );
    if (options.planHash !== plan.planHash)
      throw Error("Ingest plan is stale or does not match this directory");
    if (plan.blocked)
      throw Error(`Ingest plan is blocked: ${plan.warnings.join(", ")}`);
    const results = [];
    for (const item of plan.files) {
      const f = resolve(plan.root, item.path);
      try {
        results.push(
          await ingest(s, f, {
            metadata: options.metadata,
            host: options.host,
          }),
        );
      } catch (e) {
        results.push({ file: f, error: (e as Error).message });
      }
    }
    const failures = results.filter((result) => result.error);
    return {
      planHash: plan.planHash,
      fileCount: plan.fileCount,
      totalBytes: plan.totalBytes,
      imported: results.length - failures.length,
      failed: failures.length,
      outcomes: results,
    };
  }
  if (statSync(path).size > 50 * 1024 * 1024)
    throw Error("File exceeds 50 MB import limit");
  const { checksum } = await prepareFile(path);
  if (options.jobId) {
    const row = s.one(
      "SELECT payload,state FROM intake_jobs WHERE id=?",
      options.jobId,
    );
    if (row.state === "cancelled") throw Error("JOB_CANCELLED");
    const payload = JSON.parse(row.payload);
    if (payload.checksum && payload.checksum !== checksum)
      throw Error(
        "FILE_CHANGED: Selected content changed; create a new job after review",
      );
    s.exec(
      "UPDATE intake_jobs SET payload=?,updated_at=? WHERE id=?",
      JSON.stringify({ ...payload, checksum }),
      now(),
      options.jobId,
    );
  }
  const prior = options.sourceId
    ? s.one("SELECT * FROM sources WHERE id=?", options.sourceId)
    : s.one(
        "SELECT * FROM sources WHERE source_key=?",
        options.sourceKey || path,
      ) ||
      (!options.sourceKey || options.sourceKey.startsWith("files:")
        ? localSource(s, path, checksum)
        : null);
  if (prior && !s.allowed(prior, options.host || "local", true))
    throw Error("Source unavailable");
  if (
    prior &&
    s.schemaVersion >= 8 &&
    s.one("SELECT state FROM source_lifecycle WHERE source_id=?", prior.id)
      ?.state === "archived"
  )
    throw Error("Source archived; restore explicitly before reimport");
  if (options.sourceId && !prior) throw Error("Unknown source ID");
  const meta = metadata.parse(
    options.metadata ?? (prior ? JSON.parse(prior.metadata) : {}),
  );
  for (const id of [
    ...meta.entities,
    ...[meta.client, meta.project].filter(Boolean),
  ])
    if (!s.one("SELECT id FROM entities WHERE id=?", id))
      throw Error(`Unknown entity ${id}`);
  const sourceId = prior?.id ?? uid("source"),
    occurrence = options.jobId || uid("import");
  const originalPath = join(
    "originals",
    now().slice(0, 10),
    occurrence,
    basename(path),
  );
  const preserved = await prepareFile(path, s.path(originalPath));
  if (preserved.checksum !== checksum)
    throw Error("FILE_CHANGED: Preview and retry changed file");
  let revision = prior
    ? s.one(
        "SELECT * FROM revisions WHERE source_id=? AND checksum=?",
        sourceId,
        checksum,
      )
    : null;
  const duplicate = !!revision;
  if (!revision) {
    revision = { id: uid("revision"), status: "pending" };
    s.tx(() => {
      if (!prior)
        s.exec(
          "INSERT INTO sources VALUES(?,?,?,?,?,?,?,?)",
          sourceId,
          options.sourceKey || path,
          meta.title ?? basename(path),
          path,
          JSON.stringify(meta),
          null,
          now(),
          now(),
        );
      s.exec(
        "INSERT INTO revisions VALUES(?,?,?,?,?,?,?,?)",
        revision.id,
        sourceId,
        checksum,
        originalPath,
        JSON.stringify(meta),
        "pending",
        null,
        now(),
      );
    });
  }
  s.tx(() => {
    s.exec(
      "INSERT INTO occurrences VALUES(?,?,?,?,?,?)",
      occurrence,
      sourceId,
      revision.id,
      path,
      now(),
      originalPath,
    );
    s.exec(
      "UPDATE sources SET title=?,location=?,metadata=?,last_checked=? WHERE id=?",
      meta.title ?? prior?.title ?? basename(path),
      path,
      JSON.stringify(meta),
      now(),
      sourceId,
    );
  });
  if (!options.sourceKey || options.sourceKey.startsWith("files:"))
    recordLocation(s, sourceId, path, checksum);
  await indexRevision(s, revision, originalPath, path, options.jobId);
  s.exec(
    "UPDATE sources SET current_revision=? WHERE id=?",
    revision.id,
    sourceId,
  );
  if (!options.sourceKey || options.sourceKey.startsWith("files:"))
    recordLocation(s, sourceId, path, checksum);
  s.log("source.import", {
    sourceId,
    revisionId: revision.id,
    occurrence,
    duplicate,
  });
  return {
    sourceId,
    revisionId: revision.id,
    occurrence,
    duplicate,
    ...s.one("SELECT status,error FROM revisions WHERE id=?", revision.id),
  };
}

export function retrieve(
  s: Store,
  query: string,
  host: Host,
  opts: {
    client?: string;
    project?: string;
    limit?: number;
    latest?: boolean;
    sourceId?: string;
    asOf?: string;
  } = {},
) {
  const result = knowledgeSearch(s, { query, ...opts }, host);
  const results = result.evidence
    .filter((e) => e.kind === "source")
    .map((e) => e.data);
  const wikiResults = result.evidence
    .filter((e) => e.kind === "wiki")
    .map((e) => e.data);
  const memoryResults = result.evidence
    .filter((e) => e.kind === "memory")
    .map((e) => e.data);
  return {
    query,
    results,
    wikiResults,
    memoryResults,
    retrievalProfile: result.profile,
    coverage: {
      ...result.coverage,
      returned: results.length,
      permittedMatches: result.coverage.permittedCandidates,
      failedSources: s
        .all(
          "SELECT s.*,r.status FROM sources s JOIN revisions r ON r.id=s.current_revision WHERE r.status!=?",
          "ready",
        )
        .filter((r) => s.allowed(r, host)).length,
    },
    warnings: [
      ...result.warnings,
      ...(results.some((r) => !r.effectiveDate)
        ? [
            "Some effective dates are unknown; import time is not document time.",
          ]
        : []),
    ],
  };
}

async function indexRevision(
  s: Store,
  revision: any,
  originalPath: string,
  inputPath: string,
  jobId?: string,
) {
  if (revision.status !== "ready") {
    try {
      const parsed = inputPath.toLowerCase().endsWith(".csv")
        ? await extractTextFile(s.path(originalPath))
        : { passages: await extract(s.path(originalPath)), rows: [] };
      const { passages, rows } = parsed;
      if (
        jobId &&
        s.one("SELECT state FROM intake_jobs WHERE id=?", jobId)?.state ===
          "cancelled"
      )
        throw Error("JOB_CANCELLED");
      s.tx(() => {
        s.exec(
          "DELETE FROM passage_search WHERE passage_id IN (SELECT id FROM passages WHERE revision_id=?)",
          revision.id,
        );
        s.exec("DELETE FROM passages WHERE revision_id=?", revision.id);
        for (const p of passages) {
          const id = uid("passage");
          s.exec(
            "INSERT INTO passages VALUES(?,?,?,?)",
            id,
            revision.id,
            p.location,
            p.text,
          );
          s.exec(
            "INSERT INTO passage_search(text,passage_id) VALUES(?,?)",
            p.text,
            id,
          );
        }
        s.exec("DELETE FROM structured_rows WHERE revision_id=?", revision.id);
        rows.forEach((row, i) =>
          s.exec(
            "INSERT INTO structured_rows VALUES(?,?,?,?)",
            uid("row"),
            revision.id,
            i + 2,
            JSON.stringify(row),
          ),
        );
        s.exec(
          "UPDATE revisions SET status=?,error=NULL WHERE id=?",
          "ready",
          revision.id,
        );
      });
    } catch (e) {
      if ((e as Error).message === "JOB_CANCELLED") throw e;
      s.exec(
        "UPDATE revisions SET status=?,error=? WHERE id=?",
        "failed",
        (e as Error).message,
        revision.id,
      );
    }
  }
}
export async function ingest(
  s: Store,
  input: string,
  options: NonNullable<Parameters<typeof ingestInternal>[2]> = {},
): Promise<any> {
  if (s.schemaVersion < 11 || statSync(assertInput(input)).isDirectory())
    return ingestInternal(s, input, options);
  const host = options.host || "local";
  s.assertHost(host);
  const key = options.jobId || uid("intake");
  if (!options.jobId)
    s.exec(
      "INSERT INTO intake_jobs VALUES(?,?,?,?,?,?,?, ?,?)",
      key,
      host,
      "queued",
      JSON.stringify({ input, options }),
      null,
      null,
      0,
      now(),
      now(),
    );
  const row = s.one(
    "SELECT * FROM intake_jobs WHERE id=? AND host=?",
    key,
    host,
  );
  if (!row) throw Error("Job unavailable");
  if (row.state === "cancelled") throw Error("JOB_CANCELLED");
  if (row.state === "completed")
    return { ...JSON.parse(row.result), jobId: key };
  s.exec(
    "UPDATE intake_jobs SET state=?,attempts=attempts+1,updated_at=? WHERE id=?",
    "processing",
    now(),
    key,
  );
  try {
    const result = await ingestInternal(s, input, { ...options, jobId: key });
    s.exec(
      "UPDATE intake_jobs SET state=?,result=?,reason=?,updated_at=? WHERE id=?",
      result.status === "ready" ? "completed" : "extraction-gap",
      JSON.stringify(result),
      result.status === "ready" ? null : "EXTRACTION_GAP",
      now(),
      key,
    );
    return { ...result, jobId: key };
  } catch (e) {
    const code =
      (e as Error).message.match(/^[A-Z][A-Z_]+/)?.[0] || "INTAKE_FAILED";
    s.exec(
      "UPDATE intake_jobs SET state=?,reason=?,updated_at=? WHERE id=?",
      code === "JOB_CANCELLED" ? "cancelled" : "failed",
      code,
      now(),
      key,
    );
    throw e;
  }
}
export function intakeJobs(s: Store, h: Host) {
  s.assertSchema(11, "Intake jobs");
  s.assertHost(h);
  return s
    .all("SELECT * FROM intake_jobs WHERE host=? ORDER BY created_at DESC", h)
    .filter((r) => {
      const occurrence = s.one(
        "SELECT source_id FROM occurrences WHERE id=?",
        r.id,
      );
      const source =
        occurrence &&
        s.one("SELECT * FROM sources WHERE id=?", occurrence.source_id);
      return !source || s.allowed(source, h, true);
    })
    .map((r) => ({
      ...r,
      payload: JSON.parse(r.payload),
      name: basename(JSON.parse(r.payload).input || "Intake item"),
      result: r.result ? JSON.parse(r.result) : null,
    }));
}
export async function controlIntakeJob(
  s: Store,
  h: Host,
  key: string,
  action: string,
) {
  const row = intakeJobs(s, h).find((r) => r.id === key);
  if (!row) throw Error("Job unavailable");
  if (s.policy().actions.draft !== "allow") throw Error("POLICY_DENIED");
  if (action === "cancel") {
    if (row.state === "completed") throw Error("JOB_COMPLETED");
    s.exec(
      "UPDATE intake_jobs SET state='cancelled',reason='USER_CANCELLED',updated_at=? WHERE id=?",
      now(),
      key,
    );
    return { id: key, state: "cancelled" };
  }
  if (action !== "resume") throw Error("Unknown job action");
  if (row.state === "cancelled")
    throw Error("JOB_CANCELLED: Create a newly reviewed import");
  if (row.state === "completed") return row.result;
  if (row.payload.kind === "knowledge-index")
    return rebuildKnowledge(s, h, { requestKey: row.payload.requestKey });
  const occurrence = s.one("SELECT * FROM occurrences WHERE id=?", key);
  if (!occurrence)
    return ingest(s, row.payload.input, {
      ...row.payload.options,
      jobId: key,
      host: h,
    });
  const source = s.one(
    "SELECT * FROM sources WHERE id=?",
    occurrence.source_id,
  );
  if (!s.allowed(source, h)) throw Error("Source unavailable or archived");
  const revision = s.one(
    "SELECT * FROM revisions WHERE id=?",
    occurrence.revision_id,
  );
  s.exec(
    "UPDATE intake_jobs SET state='processing',attempts=attempts+1,updated_at=? WHERE id=?",
    now(),
    key,
  );
  if (
    (await prepareFile(s.path(revision.original_path))).checksum !==
    revision.checksum
  )
    throw Error("ORIGINAL_CHECKSUM_MISMATCH");
  await indexRevision(
    s,
    revision,
    revision.original_path,
    row.payload.input,
    key,
  );
  const current = s.one("SELECT status FROM revisions WHERE id=?", revision.id);
  // Never promote an old resumed revision over a newer successful import.
  if (
    !source.current_revision ||
    source.current_revision === revision.id ||
    s.one(
      "SELECT created_at FROM revisions WHERE id=?",
      source.current_revision,
    ).created_at < revision.created_at
  )
    s.exec(
      "UPDATE sources SET current_revision=? WHERE id=?",
      revision.id,
      source.id,
    );
  const result = {
    sourceId: source.id,
    revisionId: revision.id,
    status: current.status,
    jobId: key,
  };
  s.exec(
    "UPDATE intake_jobs SET state=?,result=?,reason=?,updated_at=? WHERE id=?",
    current.status === "ready" ? "completed" : "extraction-gap",
    JSON.stringify(result),
    current.status === "ready" ? null : "EXTRACTION_GAP",
    now(),
    key,
  );
  return result;
}
