import { z } from "zod";
import {
  id,
  metadata,
  evidence,
  host,
  capabilitySchema,
  memoryInput,
} from "./schema.js";
const base = {
  schemaVersion: z.literal(1),
  id,
  createdAt: z.string().datetime(),
};
export const Source = z.object({
  ...base,
  key: z.string().min(1),
  location: z.string(),
  metadata,
  currentRevision: id.nullable(),
  lastChecked: z.string().datetime(),
});
export const SourceRevision = z.object({
  ...base,
  sourceId: id,
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  originalPath: z.string(),
  metadataSnapshot: metadata,
  status: z.enum(["pending", "ready", "failed"]),
  error: z.string().nullable(),
});
export const Passage = z.object({
  schemaVersion: z.literal(1),
  id,
  revisionId: id,
  location: z.string(),
  text: z.string().min(1),
});
export const Entity = z.object({
  ...base,
  type: z.enum([
    "person",
    "organization",
    "client",
    "project",
    "product",
    "tool",
    "process",
    "location",
    "goal",
  ]),
  name: z.string(),
  aliases: z.array(z.string()),
  allowedHosts: z.array(host),
  identity: z.string().nullable(),
});
export const Relationship = z.object({
  ...base,
  from: id,
  to: id,
  type: z.string(),
  basis: z.enum(["supported", "inferred", "manual"]),
  evidence: z.array(evidence),
  date: z.string().date().nullable(),
});
export const Memory = memoryInput.extend({
  ...base,
  state: z.enum(["proposed", "approved", "rejected", "superseded"]),
  updatedAt: z.string().datetime(),
});
export const Capability = capabilitySchema;
export const Execution = z.object({
  ...base,
  capability: id,
  version: z.number().int().positive(),
  host,
  state: z.enum(["running", "failed", "completed", "needs-review"]),
  input: z.record(z.unknown()),
  checkpoint: z.record(z.unknown()),
  output: z.unknown(),
  error: z.string().nullable(),
});
export const Approval = z.object({
  ...base,
  actionHash: z.string().length(64),
  policyHash: z.string().length(64),
  consumedAt: z.string().datetime().nullable(),
});
