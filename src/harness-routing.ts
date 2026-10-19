import { z } from "zod";
import { readFileSync } from "node:fs";
import { skillDetail } from "./skill-library.js";
import type { Store } from "./store.js";
import type { Host } from "./schema.js";
import { getProject, getTask } from "./tasks.js";
import { sha } from "./files.js";

export const routeInput = z
  .object({
    message: z.string().trim().min(1).max(12000),
    skillId: z.string().max(80).optional(),
    inputs: z.record(z.unknown()).default({}),
    record: z
      .object({ kind: z.enum(["task", "project"]), id: z.string().max(120) })
      .strict()
      .optional(),
    workflow: z.literal("priorities-and-meeting").optional(),
  })
  .strict();
const contracts = () =>
  JSON.parse(
    readFileSync(
      new URL("../../skills/contracts.json", import.meta.url),
      "utf8",
    ),
  );
export const PROJECT_FIELDS = [
  "project_title",
  "client_name",
  "objective",
  "scope_in",
  "scope_out",
  "deliverables",
  "phases",
  "risks",
  "impact",
  "tech_stack",
  "next_steps",
  "priority",
  "start_date",
  "due_date",
  "status",
  "owner",
  "tags",
];
const norm = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
const patterns: [string, RegExp][] = [
  [
    "hoi-meeting-prep",
    /\b(prepare|preparer|preparation|brief|agenda)\b.*\b(meeting|reunion|rendez-vous)\b|\b(meeting|reunion)\b.*\b(prep|brief|preparation)\b/,
  ],
  [
    "hoi-chief-of-staff",
    /priorit|focus on today|daily brief|work brief|waiting.for|que.*faire.*aujourd|quoi.*aujourd/,
  ],
  [
    "hoi-task-intake",
    /\b(extract|extraire|extracting|identify|identifier|turn|transformer)\b.*\b(tasks|actions|commitments|todos|to-dos|taches|engagements)\b/,
  ],
  [
    "hoi-project-intake",
    /\b(project|projet)\b.*\b(brief|structure|cadrage|plan)\b|\b(structure|create|creer|structurer)\b.*\b(project|projet)\b/,
  ],
  [
    "hoi-retrieve",
    /\b(find|search|retrieve|look up|what|which|who|when|where|why|how|que|chercher|rechercher|trouver|quel|quelle|quels|quelles|qui|quand|ou|comment|pourquoi)\b/,
  ],
];
export function routeHarness(s: Store, raw: unknown, h: Host) {
  s.assertHost(h);
  const input = routeInput.parse(raw),
    metadata = contracts();
  const base = {
    schemaVersion: 1,
    executed: false,
    limits: {
      stages: 3,
      toolRounds: 5,
      concurrency: 1,
      recursiveDelegation: false,
    },
  };
  if (input.record && !input.skillId && !input.workflow) {
    // Resolve now so an invented or inaccessible ID cannot become an actionable route.
    if (input.record.kind === "task") getTask(s, input.record.id, h);
    else getProject(s, input.record.id, h);
    return {
      ...base,
      state: "ready",
      kind: "read",
      operation: `${input.record.kind}:get`,
      record: input.record,
      reason: "An exact permitted record can be read without a specialist.",
    };
  }
  const text = norm(input.message);
  if (
    !input.skillId &&
    /\b(publish|publier|approve|approuver|activate|activer|configure|configurer|delete|supprimer|send email|envoyer|security|securite)\b/.test(
      text,
    )
  )
    return {
      ...base,
      state: "clarification",
      fields: ["skillId"],
      question:
        "Select the relevant governance skill explicitly. Publication, approvals and external actions require their existing review workflow.",
    };
  let selected: string[];
  if (input.skillId) selected = [input.skillId];
  else if (input.workflow)
    selected = ["hoi-chief-of-staff", "hoi-meeting-prep"];
  else {
    const matches = patterns
      .filter(([, pattern]) => pattern.test(text))
      .map(([name]) => name);
    selected = matches.filter(
      (name) => name !== "hoi-retrieve" || matches.length === 1,
    );
    if (selected.length !== 1)
      return {
        ...base,
        state: "clarification",
        fields: ["intent"],
        question: selected.length
          ? "Which output should come first? Select one skill, or the priorities-and-meeting workflow."
          : "Do you want to find evidence, prepare a meeting, review priorities, extract actions or structure a project brief?",
      };
  }
  const stages: any[] = [];
  const missing = new Set<string>();
  for (const name of selected) {
    let skill;
    try {
      skill = skillDetail(s, name, h);
    } catch {
      return {
        ...base,
        state: "unavailable",
        reason: "The selected skill is unavailable.",
      };
    }
    if (!skill.enabled || !skill.active?.compatible)
      return {
        ...base,
        state: "unavailable",
        skillId: name,
        reason:
          "Skill disabled, inactive or incompatible. Inspect Skills before continuing.",
      };
    const routing = metadata[name]?.routing;
    if (!routing)
      return {
        ...base,
        state: "unavailable",
        skillId: name,
        reason:
          "This skill requires its explicit governed workflow; automatic routing is not enabled.",
      };
    for (const field of routing.requiredInputs) {
      const value = input.inputs[field];
      if (
        typeof value !== "string" ||
        !value.trim() ||
        /^(unknown|n\/a|tbd|todo|null|undefined|-)$/i.test(value.trim())
      )
        missing.add(field);
    }
    if (name === "hoi-project-intake") {
      if (!["High", "Medium", "Low"].includes(String(input.inputs.priority)))
        missing.add("priority");
      if (
        !["Inbox", "Planning", "In Progress", "Completed"].includes(
          String(input.inputs.status),
        )
      )
        missing.add("status");
      for (const field of ["start_date", "due_date"])
        if (!z.string().date().safeParse(input.inputs[field]).success)
          missing.add(field);
      if (
        typeof input.inputs.tags !== "string" ||
        input.inputs.tags.split(",").some((x) => !x.trim())
      )
        missing.add("tags");
      if (
        Object.keys(input.inputs).some((key) => !PROJECT_FIELDS.includes(key))
      )
        missing.add("exact_project_fields");
    }
    if(name === "hoi-task-intake" && !missing.has("sourceId")) {
      const source=s.one("SELECT * FROM sources WHERE id=?",input.inputs.sourceId);
      if(!source || !s.allowed(source,h)) return {...base,state:"unavailable",reason:"The selected source is unavailable."};
    }
    if(name === "hoi-meeting-prep" && !missing.has("meetingId")) {
      const meeting=s.one("SELECT * FROM work_intake WHERE id=?",input.inputs.meetingId);
      const source=meeting && s.one("SELECT * FROM sources WHERE id=?",meeting.source_id);
      if(!source || !s.allowed(source,h) || !["event","calendar"].includes(JSON.parse(meeting.item).kind)) return {...base,state:"unavailable",reason:"Resolve an exact permitted meeting occurrence first."};
    }
    stages.push({
      skillId: name,
      revisionId: skill.active.revisionId,
      checksum: skill.active.checksum,
      ...routing,
    });
  }
  if (missing.size)
    return {
      ...base,
      state: "clarification",
      fields: [...missing],
      question:
        "Supply only the missing or invalid required fields before preparing this request.",
      stages,
    };
  return {
    ...base,
    state: "ready",
    kind: stages.length === 1 ? "skill" : "workflow",
    stages,
    digest: sha(JSON.stringify(stages)),
    reason: input.skillId
      ? "Explicit eligible selection."
      : input.workflow
        ? "Explicit predefined workflow."
        : "One matching specialist; no model call was used for routing.",
  };
}
