import { z } from "zod";
import { Store } from "./store.js";
import { type Host } from "./schema.js";
import { sha, uid, now } from "./files.js";
import { getProject } from "./tasks.js";
import { intakeDetail } from "./work-intake.js";
const input = z
  .object({ sourceId: z.string(), revisionId: z.string() })
  .strict();
export function previewTranscript(s: Store, value: unknown, h: Host) {
  s.assertSchema(16, "Transcript review");
  s.assertHost(h);
  const v = input.parse(value),
    source = s.one("SELECT * FROM sources WHERE id=?", v.sourceId);
  if (
    s.policy().actions.read === "deny" ||
    !s.allowed(source, h) ||
    source.current_revision !== v.revisionId
  )
    throw Error("TRANSCRIPT_SOURCE_UNAVAILABLE_OR_CHANGED");
  const passages = s.all(
    "SELECT id,text,location FROM passages WHERE revision_id=? ORDER BY rowid",
    v.revisionId,
  );
  if (!passages.length) throw Error("TRANSCRIPT_EXTRACTION_GAP");
  if (passages.length > 300 || passages.some((p) => p.text.length > 12000))
    throw Error("TRANSCRIPT_TOO_LARGE: select a smaller document");
  const rows = passages.map((p) => ({
    passageId: p.id,
    text: p.text,
    location: p.location,
    speaker: null as string | null,
  }));
  return {
    sourceId: source.id,
    revisionId: v.revisionId,
    title: source.title,
    digest: sha(JSON.stringify(rows)),
    segments: rows,
  };
}
export function commitTranscript(s: Store, value: unknown, h: Host) {
  s.assertHost(h);
  if (h !== "local") throw Error("TRANSCRIPT_LOCAL_REVIEW_REQUIRED");
  if (s.policy().actions.draft === "deny")
    throw Error("TRANSCRIPT_REVIEW_DENIED");
  const v = z
    .object({
      sourceId: z.string(),
      revisionId: z.string(),
      digest: z.string(),
      projectId: z.string().nullable().default(null),
      occurredAt: z
        .string()
        .datetime({ offset: true })
        .nullable()
        .default(null),
      speakers: z
        .array(
          z
            .object({
              passageId: z.string(),
              speaker: z.string().trim().min(1).max(300).nullable(),
            })
            .strict(),
        )
        .max(300),
      confirm: z.literal(true),
    })
    .strict()
    .parse(value);
  const preview = previewTranscript(
    s,
    { sourceId: v.sourceId, revisionId: v.revisionId },
    h,
  );
  if (preview.digest !== v.digest) throw Error("TRANSCRIPT_PREVIEW_CHANGED");
  if (v.projectId) getProject(s, v.projectId, h);
  if (
    v.speakers.length !== preview.segments.length ||
    new Set(v.speakers.map((x) => x.passageId)).size !== v.speakers.length ||
    v.speakers.some(
      (x) => !preview.segments.some((p) => p.passageId === x.passageId),
    )
  )
    throw Error("TRANSCRIPT_SEGMENTS_CHANGED");
  const source = s.one("SELECT * FROM sources WHERE id=?", v.sourceId);
  const segments = preview.segments.map((p) => ({
    text: p.text,
    speaker: v.speakers.find((x) => x.passageId === p.passageId)!.speaker,
    timestamp: null,
    quoted: false,
  }));
  // This is a reviewed interpretation of an existing revision, not another imported source.
  const item = {
    kind: "transcript",
    account: "workspace-source",
    remoteId: v.sourceId,
    title: preview.title,
    occurredAt: v.occurredAt,
    updatedAt: null,
    checkedAt: now(),
    projectId: v.projectId,
    threadId: null,
    recurrenceId: null,
    timezone: null,
    cancelled: false,
    segments,
    metadata: JSON.parse(source.metadata),
    review: {
      host: h,
      recordedAt: now(),
      speakerAttribution: "user-confirmed",
    },
  };
  const digest = sha(JSON.stringify({ ...v, confirm: undefined })),
    key = sha("transcript:" + v.sourceId);
  return s.tx(() => {
    const prior = s.one(
      "SELECT id FROM work_intake WHERE item_key=? AND digest=?",
      key,
      digest,
    );
    if (prior) return { ...intakeDetail(s, prior.id, h), reused: true };
    const id = uid("intake"),
      original = s.one(
        "SELECT original_path FROM revisions WHERE id=?",
        v.revisionId,
      );
    s.exec(
      "INSERT INTO work_intake(id,item_key,digest,host,item,archive_path,state,source_id,revision_id,error,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      id,
      key,
      digest,
      h,
      JSON.stringify(item),
      original.original_path,
      "ready",
      v.sourceId,
      v.revisionId,
      null,
      now(),
    );
    s.log("transcript.reviewed", {
      intakeId: id,
      sourceId: v.sourceId,
      revisionId: v.revisionId,
    });
    return { ...intakeDetail(s, id, h), reused: false };
  });
}
