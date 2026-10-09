import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  cpSync,
  readdirSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import { files, catalog, table } from "./skill-packages.mjs";
const root = fileURLToPath(new URL("..", import.meta.url)),
  check = process.argv.includes("--check");
const version = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  ).version,
  data = catalog(root, version),
  mismatches = [];
for (const runtime of [".claude", ".agents"]) {
  const parent = join(root, runtime, "skills");
  mkdirSync(parent, { recursive: true });
  for (const skill of data.skills) {
    const source = join(root, "skills", skill.name),
      target = join(parent, skill.name);
    if (check) {
      const a = files(source)
          .map((f) => relative(source, f))
          .sort(),
        b = existsSync(target)
          ? files(target)
              .map((f) => relative(target, f))
              .sort()
          : [];
      if (
        JSON.stringify(a) !== JSON.stringify(b) ||
        a.some(
          (f) =>
            !existsSync(join(target, f)) ||
            !readFileSync(join(source, f)).equals(
              readFileSync(join(target, f)),
            ),
        )
      )
        mismatches.push(`${runtime}/${skill.name}`);
    } else {
      rmSync(target, { recursive: true, force: true });
      cpSync(source, target, { recursive: true });
    }
  }
  for (const name of readdirSync(parent))
    if (!data.skills.some((s) => s.name === name))
      mismatches.push(`Unexpected generated skill: ${runtime}/${name}`);
}
const factsPath = join(root, "docs/COMPATIBILITY.md");
const facts = `# Current local compatibility\n\nGenerated from package, protocol, schema and skill manifests. Do not edit by hand.\n\n- Status: **unreleased local checkout**; tagged downloads keep their historical contents.\n- Package base version: ${version} (not a new release).\n- Engine API: ${data.compatibility.engineApiVersion}.\n- Current workspace schema: ${data.compatibility.workspaceSchema}.\n- Readable/upgradeable schemas: ${data.compatibility.supportedSchemas.join(", ")}.\n- Node: ${data.compatibility.node} (developer/browser installation).\n- Bundled instructions: ${data.skills.length} skills, including ${data.skills.filter((s) => s.kind === "operational").length} operational skills and one installer guide.\n- Adapters: optional Codex and Claude Code, scoped to the private workspace.\n- Desktop: local Electron staging and packaging are available; released installers and clean-platform verification remain separate gates.\n\nCompatibility is checked using API version and operation requirements; a matching base package version alone does not prove a compatible unreleased checkout. Native Windows execution and real assistant-session discovery still require verification.\n`;
if (check) {
  if (!existsSync(factsPath) || readFileSync(factsPath, "utf8") !== facts)
    mismatches.push("compatibility facts");
} else writeFileSync(factsPath, facts);
const serialized = JSON.stringify(data, null, 2) + "\n",
  catalogPath = join(root, "skills/catalog.json");
if (check) {
  if (
    !existsSync(catalogPath) ||
    readFileSync(catalogPath, "utf8") !== serialized
  )
    mismatches.push("catalog");
} else writeFileSync(catalogPath, serialized);
const readmePath = join(root, "README.md"),
  readme = readFileSync(readmePath, "utf8"),
  pattern = /<!-- skills:start -->[\s\S]*?<!-- skills:end -->/;
if (!pattern.test(readme)) throw Error("README skill markers missing");
const generated = await format(
  readme.replace(
    pattern,
    `<!-- skills:start -->\n${table(data)}\n<!-- skills:end -->`,
  ),
  { parser: "markdown" },
);
if (check) {
  if (generated !== readme) mismatches.push("README catalog");
} else writeFileSync(readmePath, generated);
if (mismatches.length) {
  console.error(mismatches.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    check
      ? "Runtime packages and catalog match."
      : "Runtime packages and catalog generated.",
  );
