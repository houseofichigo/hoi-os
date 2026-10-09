import { z } from "zod";
import { id, host, evidence } from "./schema.js";
export const taskStatus = z.enum([
  "open",
  "in-progress",
  "waiting",
  "blocked",
  "done",
  "cancelled",
]);
const text = z.string().trim().min(1).max(4000);
const timezone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Invalid timezone");
export const taskFields = z
  .object({
    projectId: id.nullable().default(null),
    title: text.max(240),
    outcome: text,
    owner: text.nullable().default(null),
    dueDate: z.string().date().nullable().default(null),
    dueTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .default(null),
    timezone: timezone.nullable().default(null),
  })
  .strict()
  .refine(
    (v) => !v.dueTime || !!(v.dueDate && v.timezone),
    "Timed deadline requires date and timezone",
  );
export const projectInput = z
  .object({
    entityId: id,
    objective: text,
    owner: text.nullable().default(null),
  })
  .strict();
export const proposalInput = z
  .object({
    key: z.string().min(1).max(200),
    task: taskFields,
    allowedHosts: z.array(host).min(1).default(["local", "codex", "claude"]),
    evidence: z.array(evidence).min(1).max(100),
  })
  .strict();
export const reviewInput = z
  .object({
    id,
    expectedVersion: z.number().int().positive(),
    decision: z.enum(["approved", "rejected"]),
  })
  .strict();
export const updateInput = z
  .object({
    id,
    expectedVersion: z.number().int().positive(),
    status: taskStatus,
  })
  .strict();
export const TASK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,entity_id TEXT NOT NULL UNIQUE REFERENCES entities(id),objective TEXT NOT NULL,owner TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS task_proposals(id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,state TEXT NOT NULL,version INTEGER NOT NULL,task_id TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),proposal_id TEXT NOT NULL UNIQUE REFERENCES task_proposals(id),payload TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS task_evidence(proposal_id TEXT NOT NULL REFERENCES task_proposals(id),revision_id TEXT NOT NULL REFERENCES revisions(id),passage_id TEXT NOT NULL REFERENCES passages(id),quote TEXT NOT NULL,PRIMARY KEY(proposal_id,revision_id,passage_id,quote));
CREATE TABLE IF NOT EXISTS task_history(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),version INTEGER NOT NULL,event TEXT NOT NULL,host TEXT NOT NULL,at TEXT NOT NULL,UNIQUE(task_id,version));
CREATE INDEX IF NOT EXISTS tasks_project_status ON tasks(project_id,status);
`;
