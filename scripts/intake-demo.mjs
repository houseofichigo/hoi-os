import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initialize, Store } from "../dist/core/store.js";
import { entity } from "../dist/core/knowledge.js";
import { createProject, reviewProposal } from "../dist/core/tasks.js";
import {
  importWork,
  prepareExtraction,
  submitExtraction,
  listMentions,
  resolveMention,
} from "../dist/core/work-intake.js";
// Synthetic assistant outputs exercise the handoff contract; no model is invoked.
export async function seedIntakeDemo(workspace) {
  workspace = resolve(workspace);
  if (existsSync(workspace)) throw Error("Demo requires a new directory");
  initialize(workspace);
  const s = new Store(workspace);
  try {
    const project = createProject(
      s,
      {
        entityId: entity(s, { type: "project", name: "Cedar (fictional)" }).id,
        objective: "Deliver a fictional Cedar proposal",
      },
      "local",
    );
    const task = {
      projectId: project.id,
      title: "Send Cedar proposal",
      outcome: "Deliver the proposal",
      owner: "Alex (fictional)",
      dueDate: null,
      dueTime: null,
      timezone: null,
    };
    let proposalId;
    for (const [kind, quote, fields] of [
      ["email", "I will send the Cedar proposal.", {}],
      [
        "transcript",
        "Alex: Je vais envoyer la proposition Cedar le 2 octobre 2026.",
        { dueDate: "2026-10-02" },
      ],
      [
        "calendar",
        "Review the Cedar proposal. This event does not imply a preparation deadline.",
        {},
      ],
    ]) {
      const i = await importWork(
        s,
        {
          kind,
          account: "fictional@example.invalid",
          remoteId: `demo-${kind}`,
          title: `Cedar ${kind} (synthetic)`,
          projectId: project.id,
          occurredAt: "2026-09-26T09:00:00Z",
          updatedAt: "2026-09-26T10:00:00Z",
          checkedAt: "2026-09-26T11:00:00Z",
          timezone: kind === "calendar" ? "Europe/Paris" : null,
          segments: [
            { text: quote, speaker: kind === "transcript" ? "Alex" : null },
          ],
        },
        "local",
      );
      const request = prepareExtraction(s, i.id, "local"),
        passage = request.passages.find((p) => p.text.includes(quote));
      submitExtraction(
        s,
        {
          runId: request.runId,
          requestDigest: request.requestDigest,
          adapter: "codex",
          extractionVersion: "commitments-v1",
          mentions: [
            {
              task: { ...task, ...fields },
              intent: kind === "calendar" ? "context" : "commitment",
              actor: kind === "calendar" ? null : "Alex",
              evidence: [
                {
                  revisionId: passage.revisionId,
                  passageId: passage.passageId,
                  quote,
                },
              ],
            },
          ],
        },
        "local",
      );
      const m = listMentions(s, "local").find(
        (m) => m.run_id === request.runId,
      );
      if (kind === "email") {
        const result = resolveMention(
          s,
          { id: m.id, expectedVersion: 1, decision: "separate" },
          "local",
        );
        proposalId = result.proposalId;
        reviewProposal(
          s,
          { id: proposalId, expectedVersion: 1, decision: "approved" },
          "local",
        );
      }
    }
    return {
      workspace,
      projectId: project.id,
      proposalId,
      note: "Synthetic fixture extraction. One approved task; two mentions awaiting duplicate review.",
    };
  } finally {
    s.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.argv[2])
    throw Error("Usage: node scripts/intake-demo.mjs <new-workspace>");
  console.log(JSON.stringify(await seedIntakeDemo(process.argv[2]), null, 2));
}
