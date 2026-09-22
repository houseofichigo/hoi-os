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
    return brief(input, retrieval?.results ?? []);
  },
});
