import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
const check = process.argv.includes("--check");
const m = JSON.parse(readFileSync("method/foundation.json"));
if (
  m.schemaVersion !== 1 ||
  m.documents.length !== 20 ||
  new Set(m.documents.map((d) => d.path)).size !== 20
)
  throw Error("FOUNDATION_COUNT");
const journey = JSON.parse(readFileSync("method/journey.json"));
const validSteps = new Set(journey.phases.flatMap((p) => p.steps));
if (m.journeyVersion !== journey.version)
  throw Error("FOUNDATION_JOURNEY_VERSION");
const paths = new Set(m.documents.map((d) => d.path));
function emit(p, t) {
  if (check) {
    if (!existsSync(p) || readFileSync(p, "utf8") !== t)
      throw Error("Foundation drift: " + p);
  } else {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, t);
  }
}
for (const d of m.documents) {
  if (
    !validSteps.has(d.introducedAtStep) ||
    !d.owner ||
    !d.validation ||
    !existsSync(d.template) ||
    d.references.some((r) => !paths.has(r))
  )
    throw Error("FOUNDATION_REFERENCE: " + d.path);
  emit(
    "skills/hoi-company-onboarding/references/templates/" + d.path,
    readFileSync(d.template, "utf8"),
  );
}
const intro =
  "# HOI foundation — 20 document responsibilities\n\nGenerated from method/foundation.json, version " +
  m.version +
  ". Canonical language: English; participant guide: [Learn](../learn/README.md). Introduced-at-step values are technical planning references, not automatic creation. Learn may draft minimal manuals earlier; host pointers are optional and do not install adapters. These are reviewed human documents, not replacement engine state. Existing client filenames and locations stay in place: record a responsibility mapping, never rename automatically.\n\n";
const table =
  "| Document | Purpose | Accountable owner | Validation | Introduced at step |\n|---|---|---|---|---|\n" +
  m.documents
    .map(
      (d) =>
        `| \`${d.path}\` | ${d.purpose} | ${d.owner} | ${d.validation} | ${d.introducedAtStep} |`,
    )
    .join("\n") +
  "\n";
const mapping =
  "\n## Historical mapping\n\nThe old optional product list is preserved in method/history/document-map-v1.md. The confirmed commercial list had 19 responsibilities; ETHICS adds the twentieth. No engine migration follows.\n\n" +
  Object.entries(m.legacyMappings)
    .map(
      ([a, b]) =>
        `- \`${a}\` → ${[b]
          .flat()
          .map((x) => "`" + x + "`")
          .join(
            ", ",
          )}. Preserve existing files; reconcile responsibilities during review.`,
    )
    .join("\n") +
  "\n\nMEMORY and PROPOSED are pointers to approved records and reviewed proposals. Goals are a readable description of onboarding/profile goals. Adapter manuals are documentation; their presence does not verify host installation. Review documents one by one, starting with a read-only inventory and a minimal manual.\n";
emit("method/FOUNDATION.md", intro + table + mapping);
emit(
  "skills/hoi-company-onboarding/references/document-map.md",
  intro.replace(
    "[Learn](../learn/README.md)",
    "the product Learn kit when available",
  ) +
    table +
    mapping,
);
emit(
  "skills/hoi-company-onboarding/references/foundation.json",
  JSON.stringify(
    {
      ...m,
      documents: m.documents.map((d) => ({
        ...d,
        template: "references/templates/" + d.path,
      })),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "20 foundation responsibilities, templates and links " +
    (check ? "verified" : "generated"),
);

const explanation =
  "Documents are introduced progressively at the technical journey step that supplies their evidence, then reviewed when circumstances change. These are planning associations, not automatic file creation. The folder-first Learn path may draft README and a minimal manual before engine installation. CLAUDE/GEMINI pointers are created only when relevant; installing the engine alone does not install adapters or create those manuals. Existing canonical document locations remain valid. MEMORY/PROPOSED point to engine records and never grant approval.";
const stepRows = [...new Set(m.documents.map((d) => d.introducedAtStep))]
  .sort((a, b) => a - b)
  .map(
    (step) =>
      `| ${step} | ${m.documents
        .filter((d) => d.introducedAtStep === step)
        .map((d) => "`" + d.path + "`")
        .join(", ")} |`,
  )
  .join("\n");
const section =
  "<!-- foundation-steps:start -->\n\n" +
  explanation +
  "\n\n| Step | Documents |\n|---|---|\n" +
  stepRows +
  "\n\n<!-- foundation-steps:end -->";
const journeyPath = "method/JOURNEY.md";
const journeyText = readFileSync(journeyPath, "utf8");
const marker =
  /<!-- foundation-steps:start -->[\s\S]*?<!-- foundation-steps:end -->/;
if (!marker.test(journeyText)) throw Error("FOUNDATION_JOURNEY_MARKER");
emit(journeyPath, journeyText.replace(marker, section));
