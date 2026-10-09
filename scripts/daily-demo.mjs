import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initialize, Store } from "../dist/core/store.js";
import { entity } from "../dist/core/knowledge.js";
import {
  createProject,
  createProposal,
  reviewProposal,
  updateTask,
} from "../dist/core/tasks.js";
import { importWork } from "../dist/core/work-intake.js";
import { wallInstant, localParts } from "../dist/core/daily.js";
export async function seedDailyDemo(workspace) {
  if (!workspace)
    throw Error("Usage: node scripts/daily-demo.mjs <new-workspace>");
  workspace = resolve(workspace);
  if (existsSync(workspace)) throw Error("Demo requires a new workspace");
  initialize(workspace);
  const s = new Store(workspace);
  try {
    const p = createProject(
      s,
      {
        entityId: entity(s, { type: "project", name: "Cedar (fictional)" }).id,
        objective: "Review the Cedar proposal",
      },
      "local",
    );
    const now = new Date(),
      date = localParts(now.getTime(), "Europe/Paris").date;
    const next = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10);
    const start = new Date(
        wallInstant(next, "15:00", "Europe/Paris"),
      ).toISOString(),
      end = new Date(wallInstant(next, "16:00", "Europe/Paris")).toISOString();
    const imported = await importWork(
      s,
      {
        kind: "calendar",
        account: "fictional@example.invalid",
        remoteId: "cedar-review",
        title: "Cedar proposal review (synthetic)",
        projectId: p.id,
        occurredAt: start,
        updatedAt: now.toISOString(),
        checkedAt: now.toISOString(),
        timezone: "Europe/Paris",
        calendar: {
          start,
          end,
          participants: ["Alex (fictional)", "Morgan (fictional)"],
        },
        segments: [
          {
            text: "Discuss the Cedar proposal. Alex will bring the proposal. Morgan will confirm the budget.",
          },
        ],
      },
      "local",
    );
    const passage = s.one(
      "SELECT id,text FROM passages WHERE revision_id=? AND text LIKE '%Alex will%'",
      imported.revisionId,
    );
    for (const [title, owner, status] of [
      ["Bring the Cedar proposal", "Alex (fictional)", "open"],
      ["Confirm Cedar budget", "Morgan (fictional)", "waiting"],
    ]) {
      const proposal = createProposal(
        s,
        {
          key: title,
          task: {
            projectId: p.id,
            title,
            outcome: title,
            owner,
            dueDate: next,
          },
          evidence: [
            {
              revisionId: imported.revisionId,
              passageId: passage.id,
              quote: passage.text,
            },
          ],
        },
        "local",
      );
      const approved = reviewProposal(
        s,
        { id: proposal.id, expectedVersion: 1, decision: "approved" },
        "local",
      );
      if (status !== "open")
        updateTask(
          s,
          { id: approved.taskId, expectedVersion: 1, status },
          "local",
        );
    }
    return {
      workspace,
      date,
      timezone: "Europe/Paris",
      owner: "Alex (fictional)",
      note: "Fictional fixture only. Availability intentionally unconfirmed; no slot until a complete snapshot is supplied.",
    };
  } finally {
    s.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(JSON.stringify(await seedDailyDemo(process.argv[2]), null, 2));
