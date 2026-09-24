import { readFileSync, statSync, existsSync } from "node:fs";
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
  if (contained(s.root, path))
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

export async function ingest(
  s: Store,
  input: string,
  options: {
    metadata?: unknown;
    sourceId?: string;
    sourceKey?: string;
    planHash?: string;
    maxFiles?: number;
    maxBytes?: number;
  } = {},
): Promise<any> {
  const path = assertInput(input);
  if (contained(s.root, path))
    throw Error("Do not re-ingest workspace storage");
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
        results.push(await ingest(s, f, { metadata: options.metadata }));
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
  const prior = options.sourceId
    ? s.one("SELECT * FROM sources WHERE id=?", options.sourceId)
    : s.one(
        "SELECT * FROM sources WHERE source_key=?",
        options.sourceKey || path,
      );
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
  const bytes = readFileSync(path),
    checksum = sha(bytes),
    sourceId = prior?.id ?? uid("source"),
    occurrence = uid("import");
  const originalPath = join(
    "originals",
    now().slice(0, 10),
    occurrence,
    basename(path),
  );
  atomic(s.path(originalPath), bytes);
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
  if (revision.status !== "ready") {
    try {
      const passages = await extract(s.path(originalPath));
      const rows = path.toLowerCase().endsWith(".csv")
        ? parseCsv(bytes.toString("utf8"))
        : [];
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
      s.exec(
        "UPDATE revisions SET status=?,error=? WHERE id=?",
        "failed",
        (e as Error).message,
        revision.id,
      );
    }
  }
  s.exec(
    "UPDATE sources SET current_revision=? WHERE id=?",
    revision.id,
    sourceId,
  );
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
  } = {},
) {
  s.assertHost(host);
  const limit = Math.max(1, Math.min(opts.limit ?? 8, 30));
  const tokens = query.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  const match = tokens.map((t) => `"${t.replaceAll('"', '""')}"`).join(" OR ");
  let rows: any[] = [];
  if (match)
    rows = s.all(
      `SELECT p.*,s.id source_id,s.title,s.metadata,s.last_checked,r.created_at revision_created,r.original_path,bm25(passage_search) rank FROM passage_search JOIN passages p ON p.id=passage_search.passage_id JOIN revisions r ON r.id=p.revision_id JOIN sources s ON s.current_revision=r.id WHERE passage_search MATCH ? ORDER BY rank`,
      match,
    );
  else if (opts.sourceId || opts.client || opts.project)
    rows = s.all(
      "SELECT p.*,s.id source_id,s.title,s.metadata,s.last_checked,r.created_at revision_created,r.original_path,0 rank FROM passages p JOIN revisions r ON r.id=p.revision_id JOIN sources s ON s.current_revision=r.id ORDER BY s.title",
    );
  const candidates = rows.filter((r) => {
    const m = JSON.parse(r.metadata);
    return (
      s.allowed({ id: r.source_id, metadata: m }, host) &&
      (!opts.client || m.client === opts.client) &&
      (!opts.project || m.project === opts.project) &&
      (!opts.sourceId || r.source_id === opts.sourceId) &&
      m.status !== "superseded"
    );
  });
  if (opts.latest)
    candidates.sort((a, b) => {
      const x = JSON.parse(a.metadata),
        y = JSON.parse(b.metadata);
      const status: any = { signed: 3, approved: 2, draft: 1, unknown: 0 };
      return (
        status[y.status] - status[x.status] ||
        (y.effectiveDate ?? "").localeCompare(x.effectiveDate ?? "") ||
        a.rank - b.rank
      );
    });
  let remaining = s.policy().maxContextChars;
  const results = [];
  for (const r of candidates.slice(0, limit)) {
    if (remaining <= 0) break;
    const excerpt = r.text.slice(0, remaining);
    remaining -= excerpt.length;
    const m = JSON.parse(r.metadata);
    results.push({
      sourceId: r.source_id,
      revisionId: r.revision_id,
      passageId: r.id,
      originalPath: r.original_path,
      title: r.title,
      location: r.location,
      quote: excerpt,
      authority: m.authority,
      status: m.status,
      effectiveDate: m.effectiveDate,
      lastChecked: r.last_checked,
      rank: r.rank,
    });
  }
  return {
    query,
    results,
    coverage: {
      returned: results.length,
      permittedMatches: candidates.length,
      truncated: candidates.length > results.length || remaining === 0,
      failedSources: s
        .all(
          "SELECT s.*,r.status FROM sources s JOIN revisions r ON r.id=s.current_revision WHERE r.status!=?",
          "ready",
        )
        .filter((r) => s.allowed(r, host)).length,
    },
    warnings: [
      ...(results.some((r) => !r.effectiveDate)
        ? [
            "Some effective dates are unknown; import time is not document time.",
          ]
        : []),
      ...(results.length
        ? []
        : ["No permitted matching evidence. Do not invent an answer."]),
    ],
  };
}
