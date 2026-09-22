import { z } from "zod";
import { isRegisteredHost } from "./hosts.js";
export const id = z.string().regex(/^[a-z][a-z0-9_-]{2,100}$/);
export const host = z
  .string()
  .refine(isRegisteredHost, { message: "Unregistered host" });
export type Host = z.infer<typeof host>;
export const evidence = z
  .object({ revisionId: id, passageId: id, quote: z.string().min(1) })
  .strict();
export type Evidence = z.infer<typeof evidence>;
export const metadata = z
  .object({
    title: z.string().min(1).optional(),
    documentType: z.string().default("document"),
    authority: z.enum(["primary", "secondary", "derived"]).default("secondary"),
    sensitivity: z
      .enum(["public", "internal", "restricted"])
      .default("internal"),
    allowedHosts: z.array(host).default(["codex", "claude", "local"]),
    status: z
      .enum(["draft", "approved", "signed", "superseded", "unknown"])
      .default("unknown"),
    effectiveDate: z.string().date().nullable().default(null),
    client: id.nullable().default(null),
    project: id.nullable().default(null),
    owner: z.string().nullable().default(null),
    topics: z.array(z.string()).default([]),
    entities: z.array(id).default([]),
  })
  .strict();
export type Metadata = z.infer<typeof metadata>;
export const entityInput = z
  .object({
    id: id.optional(),
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
    name: z.string().min(1),
    aliases: z.array(z.string()).default([]),
    allowedHosts: z.array(host).default(["codex", "claude", "local"]),
    identity: z.string().optional(),
    date: z.string().date().nullable().default(null),
  })
  .strict();
export const relationInput = z
  .object({
    from: id,
    to: id,
    type: z.string().regex(/^[A-Z_]+$/),
    basis: z.enum(["supported", "inferred", "manual"]),
    evidence: z.array(evidence).default([]),
    date: z.string().date().nullable().default(null),
  })
  .strict();
export const memoryInput = z
  .object({
    type: z.enum([
      "episodic",
      "semantic",
      "decision",
      "preference",
      "procedural",
    ]),
    content: z.string().min(1),
    evidence: z.array(evidence).default([]),
    entities: z.array(id).default([]),
    durability: z
      .enum(["temporary", "project", "long-term", "permanent"])
      .default("long-term"),
    validFrom: z.string().date().nullable().default(null),
    validUntil: z.string().date().nullable().default(null),
    supersedes: id.optional(),
    allowedHosts: z.array(host).default(["codex", "claude", "local"]),
  })
  .strict();
export const policySchema = z
  .object({
    version: z.literal(1),
    deniedSources: z.array(id),
    deniedHosts: z.array(host),
    allowRestrictedHosts: z.array(host),
    maxContextChars: z.number().int().min(100).max(100000),
    actions: z
      .object({
        read: z.enum(["allow", "deny"]),
        draft: z.enum(["allow", "approve", "deny"]),
        organize: z.enum(["approve", "deny"]),
        external: z.literal("deny"),
      })
      .strict(),
  })
  .strict();
export const defaultPolicy = {
  version: 1,
  deniedSources: [],
  deniedHosts: [],
  allowRestrictedHosts: [],
  maxContextChars: 24000,
  actions: {
    read: "allow",
    draft: "allow",
    organize: "approve",
    external: "deny",
  },
};
// Step tools are validated against the runtime registry (src/tools.ts) when a
// capability is saved, activated, or run — not in this structural schema, so
// parsing stored capabilities never depends on registration order.
export const toolName = z.string().regex(/^[a-z][a-z0-9-]{1,40}$/);
export const capabilitySchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    version: z.number().int().positive(),
    purpose: z.string().min(1),
    requiredContext: z
      .array(z.string().regex(/^[a-zA-Z0-9_-]+\.md$/))
      .default(["profile.md"]),
    state: z.enum(["draft", "active"]).default("draft"),
    autonomy: z.enum(["A0", "A1", "A2"]).default("A2"),
    steps: z
      .array(z.object({ id, tool: toolName }).strict())
      .min(1)
      .max(12),
    evaluation: z
      .object({
        minEvidence: z.number().int().min(0),
        requireCitations: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.steps.map((s) => s.id)).size !== v.steps.length)
      ctx.addIssue({ code: "custom", message: "Step IDs must be unique" });
  });
export type Capability = z.infer<typeof capabilitySchema>;
export const wikiEvidenceInput = z
  .object({
    revisionId: id,
    passageId: id,
    quote: z.string().min(1),
    relation: z
      .enum(["supports", "mentions", "contradicts"])
      .default("supports"),
  })
  .strict();
export const wikiPageInput = z
  .object({
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/),
    title: z.string().min(1),
    type: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
    content: z.string().min(1).max(200_000),
    entities: z.array(id).default([]),
    effectiveDate: z.string().date().nullable().default(null),
    owner: z.string().nullable().default(null),
    allowedHosts: z.array(host).default(["codex", "claude", "local"]),
    supersedes: id.optional(),
    evidence: z.array(wikiEvidenceInput).min(1),
  })
  .strict();
export type WikiPageInput = z.infer<typeof wikiPageInput>;
export const meetingInput = z
  .object({
    title: z.string().min(1),
    start: z.string().datetime({ offset: true }),
    participants: z.array(z.string()).default([]),
    client: id.optional(),
    project: id.optional(),
    query: z.string().default(""),
    objectives: z.array(z.string()).default([]),
    eventEvidence: z.array(evidence).default([]),
  })
  .strict();
export type MeetingInput = z.infer<typeof meetingInput>;
