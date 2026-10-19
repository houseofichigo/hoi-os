import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initialize, Store } from "../dist/core/store.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import { saveWikiDraft, publishWiki } from "../dist/core/wiki-core.js";
import { serve } from "../dist/core/server.js";
import { skillDetail } from "../dist/core/skill-library.js";
import { proposeMemory } from "../dist/core/reviewed-memory.js";

const root = mkdtempSync(join(tmpdir(), "hoi-knowledge-hub-demo-"));
const workspace = join(root, "Fictional Knowledge Hub");
initialize(workspace);
const metadata = join(workspace, ".hoi/workspace.json");
writeFileSync(
  metadata,
  JSON.stringify({
    ...JSON.parse(readFileSync(metadata, "utf8")),
    environment: "demo",
  }),
);
const s = new Store(workspace);
const source = join(root, "orchard-workshop.md");
writeFileSync(
  source,
  "# Orchard workshop — fictional\n\nThe workshop requires two preparation days. Morgan is the contact. The final participant count is not confirmed.\n",
);
await ingest(s, source);
const passage = retrieve(s, "preparation", "local").results[0];
const draft = saveWikiDraft(
  s,
  {
    title: "Orchard workshop — fictional",
    type: "topic",
    language: "en",
    tags: ["topic/leadership"],
    blocks: [
      {
        id: "preparation",
        heading: "Recorded preparation",
        kind: "source-backed",
        text: passage.quote,
        evidence: [
          {
            revisionId: passage.revisionId,
            passageId: passage.passageId,
            quote: passage.quote,
            relation: "supports",
          },
        ],
      },
    ],
  },
  "local",
);
publishWiki(
  s,
  {
    pageId: draft.pageId,
    revisionId: draft.id,
    expectedVersion: draft.version,
    confirm: true,
  },
  "local",
);
const report = join(root, "fictional-rehearsal-observation.md");
writeFileSync(
  report,
  "# Fictional rehearsal observation\n\nInspect the exact source passage before proposing commitments. This is a demonstration observation only: no live assistant, independent quality review or held-out evaluation was run.\n",
);
await ingest(s, report);
const observation = retrieve(
  s,
  "Inspect the exact source passage",
  "local",
).results.find((p) => p.quote.includes("demonstration observation"));
const skill = skillDetail(s, "hoi-chief-of-staff", "local").active;
proposeMemory(
  s,
  {
    requestKey: "fictional-procedural-lesson",
    attributedStatement: true,
    memory: {
      type: "procedural",
      content: "Inspect the exact source passage before proposing commitments.",
      allowedHosts: ["local"],
      evidence: [
        {
          revisionId: observation.revisionId,
          passageId: observation.passageId,
          quote: observation.quote,
        },
      ],
      lesson: {
        skillId: skill.id,
        revisionId: skill.revisionId,
        checksum: skill.checksum,
        scope: "Fictional Chief of Staff rehearsal only",
        limitations:
          "Demonstration, not evidence of better assistant performance. No live host or independent evaluation.",
        evaluationKind: "manual-observation",
      },
    },
  },
  "local",
);
const product = fileURLToPath(new URL("..", import.meta.url));
const running = await serve(s, "local", resolve(product, "dist/hub"), 0, {
  hub: true,
});
console.log(
  JSON.stringify({
    workspace,
    url: running.url,
    note: "Fictional demo only. Stop with Ctrl+C. No skills or providers installed.",
  }),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () =>
    running.server.close(() => {
      s.close();
      process.exit(0);
    }),
  );
