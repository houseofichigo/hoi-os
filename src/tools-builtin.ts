import { projectMeetingContext } from "./daily.js";
import { registerTool } from "./tools.js";
import { context } from "./knowledge.js";
import { retrieve } from "./intake.js";
import type { MeetingInput } from "./schema.js";
function brief(input: MeetingInput, evidence: any[]) {
  const escape = (text: string) => text.replace(/[\\`*_[\]<>#!|]/g, "\\$&");
  const cite = (e: any) =>
    `[Open source](../${e.originalPath.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}) · Passage: ${e.passageId} · Revision: ${e.revisionId}`;
  const markdown = [
    `# ${escape(input.title)}`,
    `Time: ${input.start}`,
    `Participants: ${escape(input.participants.join(", ")) || "Not supplied"}`,
    "## Objectives",
    ...(input.objectives.length
      ? input.objectives.map((x) => `- ${escape(x)}`)
      : ["No confirmed objectives supplied."]),
    "## Source evidence",
    ...evidence.map(
      (e) =>
        `### ${escape(e.title)} · ${escape(e.location)}\n\n${escape(e.quote)}\n\n${cite(e)} · ${e.authority} · ${e.status} · effective date: ${e.effectiveDate ?? "unknown"}`,
    ),
    "## Open questions",
    "- Which outcomes need a decision in this meeting?",
    "- Which commitments require confirmation against the latest source?",
    "## Information gaps",
    ...(!input.client ? ["- Client identity has not been resolved."] : []),
    ...(!input.project ? ["- No project has been selected."] : []),
    ...(!input.eventEvidence.length
      ? [
          "- Event details were supplied by the user; live calendar state was not verified.",
        ]
      : []),
    ...(!evidence.length
      ? ["- No permitted matching evidence was found."]
      : []),
    "\nThis is a draft evidence brief. Dates and commitments must not be inferred from missing sources.",
  ].join("\n\n");
  return { markdown, evidence };
}
registerTool({
  name: "context",
  run: (s, host, _input, ctx) => context(s, host, ctx.contextOptions),
});
registerTool({
  name: "retrieve",
  run: (s, host, input) =>
    retrieve(s, input.query || input.title, host, {
      client: input.client,
      project: input.project,
      limit: 12,
    }),
});
registerTool({
  name: "meeting-brief",
  requiresPrecedingTool: "retrieve",
  minAutonomy: "A2",
  producesCitations: true,
  run: (_s, _host, input, ctx) => {
    const retrieval = Object.values(ctx.checkpoint.steps).find(
      (x: any) => x?.results,
    ) as any;
    const result = brief(input, retrieval?.results ?? []);
    const work = input.project
      ? projectMeetingContext(_s, input.project, _host)
      : { tasks: [], decisions: [] };
    const safe = (x: string) => x.replace(/[\\`*_[\]<>#!|]/g, "\\$&");
    const refs = (items: any[]) =>
      items
        .map((e) => `Passage: ${e.passageId} · Revision: ${e.revisionId}`)
        .join("; ");
    result.markdown +=
      "\n\n## Current project tasks\n" +
      work.tasks
        .map(
          (t) =>
            `- ${safe(t.title)} · ${t.status} · owner: ${safe(t.owner ?? "unknown")} · deadline: ${t.dueDate ?? "unknown"} ${t.dueTime ?? ""} ${t.timezone ?? ""} · ${t.evidenceCurrent ? "current evidence" : "evidence needs review"} · ${refs(t.evidence)}`,
        )
        .join("\n");
    result.markdown +=
      "\n\n## Approved decisions\n" +
      work.decisions
        .map((m: any) => `- ${safe(m.content)} · ${refs(m.evidence)}`)
        .join("\n");
    if (result.markdown.length > _s.policy().maxContextChars)
      throw Error("Meeting brief exceeds context budget; narrow the project");
    return { ...result, ...work };
  },
});
