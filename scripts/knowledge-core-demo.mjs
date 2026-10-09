import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedExecutiveDemo } from "./executive-demo.mjs";
import { Store } from "../dist/core/store.js";
import { retrieve } from "../dist/core/intake.js";
import { listProjects } from "../dist/core/tasks.js";
import {
  saveWikiDraft,
  publishWiki,
  assignPrimary,
} from "../dist/core/wiki-core.js";
export async function seedKnowledgeDemo(workspace) {
  const base = await seedExecutiveDemo(workspace);
  const s = new Store(base.workspace);
  try {
    const project =
      listProjects(s, "local").find((p) => /Cedar/i.test(p.name)) ??
      listProjects(s, "local")[0];
    const evidence = retrieve(s, "Cedar", "local").results[0];
    if (!evidence) throw Error("Fictional source missing");
    const d = saveWikiDraft(
      s,
      {
        title: "Cedar project wiki (fictional)",
        type: "project",
        summary:
          "Demonstration of cited project knowledge and attributed notes.",
        aliases: ["Projet Cèdre"],
        language: "mixed",
        tags: ["topic/leadership"],
        subjects: [project.id],
        blocks: [
          {
            id: "source",
            heading: "Recorded project context",
            text: evidence.quote,
            kind: "source-backed",
            evidence: [
              {
                revisionId: evidence.revisionId,
                passageId: evidence.passageId,
                quote: evidence.quote,
                relation: "supports",
              },
            ],
          },
          {
            id: "experience",
            heading: "Delivery preference (fictional)",
            text: "For this fictional demonstration, allow two preparation days before a workshop.",
            kind: "user-authored",
            evidence: [],
          },
          {
            id: "questions",
            heading: "Open question",
            text: "Which participants will attend the next session?",
            kind: "question",
            evidence: [],
          },
        ],
      },
      "local",
    );
    const p = publishWiki(
      s,
      {
        pageId: d.pageId,
        revisionId: d.id,
        expectedVersion: d.version,
        confirm: true,
      },
      "local",
    );
    assignPrimary(
      s,
      { subjectId: project.id, pageId: p.pageId, expectedVersion: p.version },
      "local",
    );
    return {
      ...base,
      wikiPageId: p.pageId,
      projectId: project.id,
      schemaVersion: 15,
    };
  } finally {
    s.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(JSON.stringify(await seedKnowledgeDemo(process.argv[2])));
