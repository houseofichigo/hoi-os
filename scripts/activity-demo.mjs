// Fictional, deterministic demonstration: no provider requests or private imports.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../dist/core/store.js";
import { entity } from "../dist/core/knowledge.js";
import { createProject } from "../dist/core/tasks.js";
import { ingest } from "../dist/core/intake.js";
import { configureAI, waitAI } from "../dist/core/ai.js";
import { sendChat } from "../dist/core/chat-send.js";
import { serve } from "../dist/core/server.js";
const root = mkdtempSync(join(tmpdir(), "hoi-activity-demo-"));
initialize(join(root, "workspace"));
const s = new Store(join(root, "workspace"));
const project = createProject(
  s,
  {
    entityId: entity(s, { name: "Fictional Cedar workshop", type: "project" })
      .id,
    objective: "Prepare a fictional learning workshop",
  },
  "local",
);
const file = join(root, "workshop.md");
writeFileSync(
  file,
  "Alex will prepare the workshop agenda for Cedar. No deadline was agreed.",
);
await ingest(s, file, { metadata: { project: project.entity_id } });
const source = s.one("SELECT id,current_revision FROM sources LIMIT 1");
const passage = s.one(
  "SELECT * FROM passages WHERE revision_id=? LIMIT 1",
  source.current_revision,
);
const evidence = {
  revisionId: source.current_revision,
  passageId: passage.id,
  quote: passage.text,
};
await configureAI(
  s,
  {
    provider: "openai",
    model: "fictional-fixture",
    inputPerMillion: 0.1,
    outputPerMillion: 0.1,
    pricingDate: new Date().toISOString().slice(0, 10),
    allowWorkspaceContext: true,
    sourceIds: [source.id],
    confirm: true,
  },
  "local",
);
let round = 0;
const sent = await sendChat(
  s,
  {
    requestKey: "activity-demo",
    origin: "home",
    scope: "workspace",
    projectId: project.id,
    message: "Summarize the Cedar project and propose the recorded action.",
    provider: "openai",
    documents: [{ sourceId: source.id, revisionId: source.current_revision }],
  },
  "local",
  {
    key: "fictional-test-key",
    stream: async () => ({
      text: JSON.stringify(
        ++round === 1
          ? {
              type: "tool",
              call: { name: "records", input: { kind: "projects" } },
            }
          : {
              type: "answer",
              text: "The Cedar workshop needs an agenda. Alex is the recorded owner; no deadline was supplied. This is fictional demonstration data.",
              citations: [evidence],
              recordCitations: [
                { kind: "project", id: project.id, version: 0 },
              ],
              taskProposal: {
                key: "cedar-agenda",
                task: {
                  title: "Prepare workshop agenda",
                  outcome: "Agenda ready for review",
                  owner: "Alex",
                  projectId: project.id,
                },
                evidence: [evidence],
              },
            },
      ),
      usage: { input_tokens: 10, output_tokens: 10 },
    }),
  },
);
await waitAI(s, sent.jobId);
const running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
const url = new URL(running.url);
url.searchParams.set("view", "chat");
url.searchParams.set("conversation", sent.conversationId);
console.log(
  JSON.stringify({ url: url.toString(), workspace: s.root, fictional: true }),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () =>
    running.server.close(() => {
      s.close();
      process.exit(0);
    }),
  );
