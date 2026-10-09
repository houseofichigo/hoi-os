import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { operationCatalog } from "../dist/core/operations.js";
import { GUIDE_NAMES, guideManifest } from "../dist/core/guides.js";
import { format } from "prettier";
const check = process.argv.includes("--check");
const rows = operationCatalog()
  .map(
    (o) =>
      `| \`${o.name}\` | ${o.action} | ${o.requiredPermission} | ${o.idempotency} | ${o.inputSchema} | ${o.outputSchema} | ${o.exclusive ? "Yes" : "No"} |`,
  )
  .join("\n");
const reference = await format(
  `# Generated engine operation reference\n\nAudience: assistant adapters and developers. Generated from the shared operation registry; do not edit by hand. This inventory describes the unreleased local build. Discover the installed engine before use.\n\nAction classes are registry classifications, not authorization. Domain validators and exact-action approval checks remain authoritative. The generic request-receipt label does not promise safe replay of every mutation; use each operation's supported key/version and reconciliation workflow.\n\nSee [tool conventions](TOOL_CONVENTIONS.md), [governance](RULES.md) and [filesystem ownership](FILESYSTEM.md).\n\n| Operation | Action | Permission | Registry idempotency | Input | Output | Exclusive |\n|---|---|---|---|---|---|---|\n${rows}\n`,
  { parser: "markdown" },
);
function output(path, value) {
  if (check) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== value)
      throw Error(`Documentation drift: ${path}; run npm run docs:sync`);
  } else writeFileSync(path, value);
}
output("docs/OPERATIONS_REFERENCE.md", reference);
const contents = Object.fromEntries(
  GUIDE_NAMES.map((n) => [
    n,
    n === "OPERATIONS_REFERENCE.md"
      ? reference
      : readFileSync("docs/" + n, "utf8"),
  ]),
);
for (const [n, text] of Object.entries(contents)) {
  if (/\/Users\/|\/home\/[^ ]+|Bearer\s+[A-Za-z0-9]{20}/.test(text))
    throw Error(`Non-portable guide: ${n}`);
  for (const m of text.matchAll(/\]\(([^)#]+\.md)\)/g))
    if (!GUIDE_NAMES.includes(m[1]))
      throw Error(`Unbundled guide link: ${n}: ${m[1]}`);
}
output(
  "docs/GUIDES.json",
  JSON.stringify(guideManifest(contents), null, 2) + "\n",
);
console.log(
  check
    ? "Guide bundle and operation reference match."
    : "Guide bundle and operation reference generated.",
);
