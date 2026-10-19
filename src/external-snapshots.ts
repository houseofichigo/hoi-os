import { z } from "zod";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { atomic, now, sha } from "./files.js";
import type { Store } from "./store.js";
import type { Host } from "./schema.js";
import type { AutomationDefinition } from "./automations.js";
import { ingest } from "./intake.js";

export const snapshotInput = z
  .object({
    schemaVersion: z.literal(2),
    namespace: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
    account: z.string().trim().min(1).max(180),
    scope: z.string().trim().min(1).max(180),
    objectId: z.string().trim().min(1).max(256),
    title: z.string().trim().min(1).max(300),
    contentType: z.enum(["document", "email", "transcript", "event"]),
    text: z.string().trim().min(1).max(500000),
    observedAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }).nullable(),
    revision: z.string().max(200).nullable(),
    coverage: z.enum(["complete", "partial", "unknown"]),
    original: z
      .object({
        mediaType: z.enum(["text/plain", "text/markdown", "application/json"]),
        text: z.string().max(500000),
      })
      .strict(),
  })
  .strict();
export type ExternalSourceSnapshot = z.infer<typeof snapshotInput>;
export async function importSnapshot(
  s: Store,
  raw: unknown,
  d: AutomationDefinition,
  enabledAt: string,
  h: Host,
  recheck: () => void,
) {
  const v = snapshotInput.parse(raw);
  if (
    d.scope.kind !== "export" ||
    v.namespace !== d.scope.namespace ||
    v.account !== d.scope.account ||
    v.scope !== d.scope.scope ||
    !d.scope.contentTypes.includes(v.contentType)
  )
    throw Error("AUTOMATION_EXPORT_OUTSIDE_SCOPE");
  if (Date.parse(v.observedAt) > Date.now() + 60000)
    throw Error("AUTOMATION_EXPORT_TIME_INVALID");
  if (!d.importBacklog && (!v.updatedAt || v.updatedAt <= enabledAt))
    throw Error("AUTOMATION_BACKLOG_REVIEW_REQUIRED");
  if (!d.futureRevisions && v.updatedAt && v.updatedAt > enabledAt)
    throw Error("AUTOMATION_FUTURE_REVISIONS_DENIED");
  recheck();
  const sourceKey = `export:${sha(JSON.stringify([v.namespace, v.account, v.objectId]))}`;
  const existing = s.one("SELECT * FROM sources WHERE source_key=?", sourceKey);
  if (existing && !s.allowed(existing, h)) throw Error("SOURCE_UNAVAILABLE");
  const checksum = sha(JSON.stringify({ ...v, observedAt: undefined }));
  const prior = s.one(
    "SELECT * FROM automation_snapshots WHERE namespace=? AND account=? AND object_id=? AND checksum=?",
    v.namespace,
    v.account,
    v.objectId,
    checksum,
  );
  if (prior)
    return {
      sourceId: prior.source_id,
      revisionId: prior.revision_id,
      exportArchive: prior.archive_path,
      reused: true,
    };
  // Stable content archive also makes interrupted retries recoverable.
  const archive = `archives/${now().slice(0, 10)}/export-${checksum}.json`;
  if(!existsSync(s.path(archive))) atomic(s.path(archive), JSON.stringify(v, null, 2));
  const dir = mkdtempSync(join(tmpdir(), "hoi-export-"));
  try {
    const file = join(dir, "export.md");
    atomic(
      file,
      `# ${v.title}\n\nCoverage: ${v.coverage}\nUpdated: ${v.updatedAt ?? "unknown"}\nRevision: ${v.revision ?? "unknown"}\n\n${v.text}`,
    );
    recheck();
    const result = await ingest(s, file, {
      host: h,
      sourceKey,
      metadata: {
        ...(existing
          ? JSON.parse(existing.metadata)
          : { allowedHosts: [h, "local"], sensitivity: "internal" }),
        title: v.title,
        documentType: v.contentType,
      },
    });
    recheck();
    s.exec(
      "INSERT OR IGNORE INTO automation_snapshots VALUES(?,?,?,?,?,?,?,?,?,?)",
      v.namespace,
      v.account,
      v.objectId,
      checksum,
      result.sourceId,
      result.revisionId,
      archive,
      v.observedAt,
      v.scope,
      v.contentType,
    );
    s.exec(
      "UPDATE sources SET location=? WHERE id=?",
      `export:${v.namespace}:${v.objectId}`,
      result.sourceId,
    );
    return { ...result, exportArchive: archive, reused: false };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
