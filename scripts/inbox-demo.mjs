import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedKnowledgeDemo } from "./knowledge-core-demo.mjs";
import { Store } from "../dist/core/store.js";
import { importWork, intakeDetail } from "../dist/core/work-intake.js";
import { createProposal } from "../dist/core/tasks.js";
export async function seedInboxDemo(workspace) {
  const base = await seedKnowledgeDemo(workspace);
  const s = new Store(base.workspace);
  try {
    const evidence = [];
    for (const kind of ["email", "transcript", "calendar"]) {
      const at = new Date().toISOString();
      const start = new Date(Date.now() + 86400000).toISOString(),
        end = new Date(Date.now() + 90000000).toISOString();
      const r = await importWork(
        s,
        {
          kind,
          account: "fictional-demo",
          remoteId: "standalone-" + kind,
          title: `Fictional workshop ${kind}`,
          occurredAt: at,
          updatedAt: at,
          checkedAt: at,
          segments: [
            {
              speaker: "Alex",
              text: "Alex will share the workshop notes. This is a fictional standalone commitment.",
            },
          ],
          ...(kind === "email"
            ? {
                threadId: "fictional-workshop",
                email: {
                  direction: "incoming",
                  sender: "alex@example.invalid",
                  recipients: ["demo@example.invalid"],
                },
              }
            : {}),
          ...(kind === "calendar"
            ? {
                timezone: "Europe/Paris",
                calendar: { start, end, participants: ["Alex"] },
              }
            : {}),
        },
        "local",
      );
      const d = intakeDetail(s, r.id, "local");
      evidence.push({
        revisionId: d.revisionId,
        passageId: d.passages[0].id,
        quote: d.passages[0].text,
      });
    }
    createProposal(
      s,
      {
        key: "fictional-standalone-notes",
        task: {
          title: "Share workshop notes (fictional)",
          outcome: "Notes shared",
          owner: "Alex",
        },
        evidence,
      },
      "local",
    );
    return {
      ...base,
      schema: 16,
      inbox:
        "Email, transcript and calendar evidence for one standalone proposal",
    };
  } finally {
    s.close();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  console.log(
    JSON.stringify(await seedInboxDemo(resolve(process.argv[2])), null, 2),
  );
