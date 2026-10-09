import { z } from "zod";
import { id, metadata, evidence } from "./schema.js";
import { taskFields } from "./task-schema.js";
export const workItem = z
  .object({
    kind: z.enum(["email", "transcript", "calendar"]),
    account: z.string().min(1).max(300),
    remoteId: z.string().min(1).max(500),
    title: z.string().min(1).max(500),
    occurredAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    checkedAt: z.string().datetime({ offset: true }),
    projectId: id.nullable().default(null),
    threadId: z.string().max(500).nullable().default(null),
    recurrenceId: z.string().max(500).nullable().default(null),
    timezone: z.string().nullable().default(null),
    cancelled: z.boolean().default(false),
    email: z
      .object({
        direction: z.enum(["incoming", "outgoing", "unknown"]),
        sender: z.string(),
        recipients: z.array(z.string()),
        draft: z.boolean().default(false),
        spam: z.boolean().default(false),
        trash: z.boolean().default(false),
        automated: z.boolean().default(false),
      })
      .strict()
      .optional(),
    calendar: z
      .object({
        start: z.string().datetime({ offset: true }),
        end: z.string().datetime({ offset: true }),
        participants: z.array(z.string().max(300)).max(100).default([]),
        busy: z.boolean().default(true),
        allDay: z.boolean().default(false),
      })
      .strict()
      .refine(
        (v) => Date.parse(v.end) > Date.parse(v.start),
        "Event end must follow start",
      )
      .optional(),
    segments: z
      .array(
        z
          .object({
            text: z.string().min(1).max(12000),
            speaker: z.string().max(300).nullable().default(null),
            timestamp: z.string().max(80).nullable().default(null),
            quoted: z.boolean().default(false),
          })
          .strict(),
      )
      .min(1)
      .max(300),
    metadata: metadata.default({}),
  })
  .strict()
  .refine(
    (v) => v.kind !== "calendar" || !!v.timezone,
    "Calendar timezone required",
  )
  .refine((v) => {
    try {
      if (v.timezone) new Intl.DateTimeFormat("en", { timeZone: v.timezone });
      return true;
    } catch {
      return false;
    }
  }, "Invalid timezone");
export const submission = z
  .object({
    runId: id,
    requestDigest: z.string(),
    adapter: z.enum(["codex", "claude", "openai", "anthropic"]),
    extractionVersion: z.literal("commitments-v1"),
    mentions: z
      .array(
        z
          .object({
            task: taskFields,
            evidence: z.array(evidence).min(1).max(20),
            intent: z.enum(["commitment", "suggestion", "context"]),
            actor: z.string().max(300).nullable(),
            recurrenceId: z.string().max(500).nullable().default(null),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const resolution = z
  .object({
    id,
    expectedVersion: z.number().int().positive(),
    decision: z.enum(["separate", "merge", "update", "reopen", "reject"]),
    targetId: id.optional(),
    targetVersion: z.number().int().positive().optional(),
  })
  .strict();
export const INTAKE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS work_intake(id TEXT PRIMARY KEY,item_key TEXT NOT NULL,digest TEXT NOT NULL,host TEXT NOT NULL,item TEXT NOT NULL,archive_path TEXT NOT NULL,state TEXT NOT NULL,source_id TEXT,revision_id TEXT,error TEXT,created_at TEXT NOT NULL,UNIQUE(item_key,digest));
CREATE TABLE IF NOT EXISTS extraction_runs(id TEXT PRIMARY KEY,intake_id TEXT NOT NULL REFERENCES work_intake(id),host TEXT NOT NULL,request TEXT NOT NULL,digest TEXT NOT NULL,state TEXT NOT NULL,submission_digest TEXT,created_at TEXT NOT NULL,UNIQUE(intake_id,host));
CREATE TABLE IF NOT EXISTS commitment_mentions(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES extraction_runs(id),fingerprint TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,state TEXT NOT NULL,version INTEGER NOT NULL,proposal_id TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intake_decisions(id TEXT PRIMARY KEY,mention_id TEXT NOT NULL REFERENCES commitment_mentions(id),target_id TEXT,payload TEXT NOT NULL,reversed INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
`;
