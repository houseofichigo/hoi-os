import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initialize, Store } from "../dist/core/store.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import {
  entity,
  relationship,
  capture,
  reviewMemory,
  onboard,
} from "../dist/core/knowledge.js";
import { serve } from "../dist/core/server.js";
const root = mkdtempSync(join(tmpdir(), "hoi-os-demo-")),
  workspace = join(root, "workspace");
initialize(workspace);
const s = new Store(workspace);
onboard(s, {
  name: "Taylor Morgan",
  role: "Independent consultant",
  organization: "Northline Studio (fictional)",
  goals: "Deliver three evidence-led client pilots.",
  recurringWork: "Prepare client meetings and preserve decisions.",
});
const definitions = [
  ["studio", "organization", "Northline Studio"],
  ["taylor", "person", "Taylor Morgan"],
  ["atlas", "client", "Atlas Collective"],
  ["cedar", "client", "Cedar Works"],
  ["meridian", "client", "Meridian Research"],
  ["atlas-pilot", "project", "Atlas · service pilot"],
  ["cedar-review", "project", "Cedar · knowledge review"],
  ["meridian-launch", "project", "Meridian · launch plan"],
  ["launch-goal", "goal", "Three pilots, ready to run"],
  ["discovery", "process", "Client discovery"],
  ["workspace-tool", "tool", "Shared document workspace"],
  ["field-guide", "product", "Field guide"],
  ["paris", "location", "Paris"],
];
const entities = {};
for (const [key, type, name] of definitions)
  entities[key] = entity(s, {
    id: `entity_${key}`,
    type,
    name,
    date: type === "project" ? "2026-09-01" : null,
  }).id;
for (const [from, to, type] of [
  ["taylor", "studio", "WORKS_AT"],
  ["studio", "atlas", "SERVES"],
  ["studio", "cedar", "SERVES"],
  ["studio", "meridian", "SERVES"],
  ["atlas-pilot", "atlas", "FOR_CLIENT"],
  ["cedar-review", "cedar", "FOR_CLIENT"],
  ["meridian-launch", "meridian", "FOR_CLIENT"],
  ["taylor", "launch-goal", "OWNS"],
  ["launch-goal", "atlas-pilot", "ADVANCES"],
  ["atlas-pilot", "discovery", "USES"],
  ["cedar-review", "workspace-tool", "USES"],
  ["meridian-launch", "field-guide", "PRODUCES"],
  ["studio", "paris", "LOCATED_IN"],
])
  relationship(
    s,
    { from: entities[from], to: entities[to], type, basis: "manual" },
    "local",
  );
const briefs = [
  [
    "atlas",
    "atlas-pilot",
    "Pilot scope",
    "The Atlas service pilot covers three discovery interviews and a written recommendation. The review meeting is planned for 2026-10-12.",
  ],
  [
    "atlas",
    "atlas-pilot",
    "Discovery notes",
    "Atlas participants asked for clearer ownership and a shared record of decisions. The pilot will test weekly evidence reviews.",
  ],
  [
    "atlas",
    "atlas-pilot",
    "Approved proposal",
    "Atlas approved a discovery phase. A later rollout remains undecided. No additional delivery date has been confirmed.",
  ],
  [
    "cedar",
    "cedar-review",
    "Knowledge inventory",
    "Cedar has policies, research, and meeting notes. The review will identify primary sources and expired guidance.",
  ],
  [
    "cedar",
    "cedar-review",
    "Review workshop",
    "The Cedar workshop compares current source quality against team questions. Missing evidence will be recorded.",
  ],
  [
    "cedar",
    "cedar-review",
    "Information architecture",
    "Cedar will organize working documents by project and retain original files independently.",
  ],
  [
    "meridian",
    "meridian-launch",
    "Launch research",
    "Meridian is preparing a field guide for research teams. Pilot feedback will inform the first edition.",
  ],
  [
    "meridian",
    "meridian-launch",
    "Editorial decisions",
    "Meridian agreed to separate confirmed findings from hypotheses. Each claim requires a traceable source.",
  ],
  [
    "meridian",
    "meridian-launch",
    "Planning notes",
    "Meridian needs a review of existing evidence before choosing a launch date. The launch date is not confirmed.",
  ],
];
for (let i = 0; i < briefs.length; i++) {
  const [client, project, title, text] = briefs[i],
    file = join(root, `source-${i}.md`);
  writeFileSync(
    file,
    `# ${title}\n\n${text}\n\nSynthetic demonstration material. No real client data.`,
  );
  const src = await ingest(s, file, {
    metadata: {
      title,
      client: entities[client],
      project: entities[project],
      entities: [entities.taylor],
      authority: "primary",
      status: i % 3 === 2 ? "approved" : "draft",
      effectiveDate: `2026-09-${String(i + 1).padStart(2, "0")}`,
    },
  });
  if (i % 3 === 1) {
    const e = retrieve(s, client, "local", { sourceId: src.sourceId })
      .results[0];
    if (e) {
      const m = capture(
        s,
        {
          type: "decision",
          content: text,
          evidence: [
            {
              revisionId: e.revisionId,
              passageId: e.passageId,
              quote: e.quote,
            },
          ],
          entities: [entities[project]],
          validFrom: `2026-09-${String(i + 1).padStart(2, "0")}`,
        },
        "local",
      );
      reviewMemory(s, m.id, "approved", "local");
    }
  }
}
const product = fileURLToPath(new URL("..", import.meta.url));
const running = await serve(
  s,
  "local",
  join(product, "dist/web"),
  Number(process.env.HOI_DEMO_PORT ?? 4640),
);
console.log(
  JSON.stringify(
    { workspace, url: running.url, data: "Entirely fictional demonstration" },
    null,
    2,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () =>
    running.server.close(() => {
      s.close();
      process.exit(0);
    }),
  );
