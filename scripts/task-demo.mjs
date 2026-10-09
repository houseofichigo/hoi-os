import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initialize, Store } from "../dist/core/store.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import { entity } from "../dist/core/knowledge.js";
import { createProject, createProposal } from "../dist/core/tasks.js";
export async function seedTaskDemo(workspace) {
  workspace = resolve(workspace);
  const inputs = `${workspace}-inputs`;
  if (existsSync(workspace) || existsSync(inputs))
    throw Error(
      "Demo requires a new directory; existing workspaces are never changed.",
    );
  mkdirSync(inputs, { recursive: true });
  initialize(workspace);
  const s = new Store(workspace);
  try {
    const e = entity(s, { type: "project", name: "Cedar pilot" });
    const project = createProject(
      s,
      {
        entityId: e.id,
        objective: "Review the Cedar pilot proposal",
        owner: "Alex (fictional)",
      },
      "local",
    );
    const evidence = [];
    for (const [type, content] of [
      [
        "email",
        "Morgan: Please send the revised Cedar proposal before the review.",
      ],
      [
        "transcript",
        "Alex: I will send the revised Cedar proposal before our review.",
      ],
      [
        "calendar",
        "Cedar proposal review. Participants: Alex and Morgan. No preparation deadline supplied.",
      ],
    ]) {
      const file = join(inputs, `${type}.md`);
      writeFileSync(file, content);
      await ingest(s, file, {
        metadata: { title: `Cedar ${type}`, documentType: type, project: e.id },
      });
      const r = retrieve(s, "Cedar", "local").results.find(
        (r) => r.quote === content,
      );
      if (!r) throw Error("Demo evidence missing");
      evidence.push({
        revisionId: r.revisionId,
        passageId: r.passageId,
        quote: r.quote,
      });
    }
    const proposal = createProposal(
      s,
      {
        key: "cedar-proposal-demo",
        task: {
          projectId: project.id,
          title: "Send revised Cedar proposal",
          outcome: "Provide the revised proposal for review",
          owner: "Alex (fictional)",
        },
        evidence,
      },
      "local",
    );
    return {
      workspace,
      projectId: project.id,
      proposalId: proposal.id,
      evidenceCount: evidence.length,
      note: "Synthetic structured proposal; not automatic extraction or duplicate detection.",
    };
  } finally {
    s.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const path = process.argv[2];
  if (!path)
    throw Error("Usage: node scripts/task-demo.mjs <new synthetic workspace>");
  mkdirSync(dirname(resolve(path)), { recursive: true });
  console.log(JSON.stringify(await seedTaskDemo(resolve(path)), null, 2));
}
