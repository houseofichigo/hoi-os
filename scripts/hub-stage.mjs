import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { assertHubModules } from "./hub-boundary.mjs";

const product = fileURLToPath(new URL("..", import.meta.url));
const runtimeDependencies = [
  "@huggingface/transformers",
  "@napi-rs/keyring",
  "better-sqlite3",
  "fast-xml-parser",
  "jszip",
  "pdfjs-dist",
  "sqlite-vec",
  "yaml",
  "zod",
];
const included = [
  "dist/core",
  "dist/hub",
  "bin",
  "skills",
  "expertise",
  ".agents",
  ".claude",
  "method",
  "licenses",
  "LICENSE",
  "TRADEMARKS.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/RULES.md",
  "docs/EXPERTISE_PLUGINS.md",
  "docs/KNOWLEDGE_PIPELINES.md",
  "docs/DISCOVERY_VALIDATION.md",
  "docs/FILESYSTEM.md",
  "docs/TOOL_CONVENTIONS.md",
  "docs/OPERATIONS_REFERENCE.md",
  "docs/GUIDES.json",
  "docs/COMPATIBILITY.md",
  "docs/CLI.md",
  "docs/OPERATIONS.md",
  "docs/HARNESS_TRANSITION.md",
  "docs/HARNESS_SKILLS.md",
  "docs/HUB_INSTALLATION.md",
  "docs/HOST_ACCEPTANCE.md",
  "docs/FINAL_HANDOVER.md",
  "docs/KNOWLEDGE_HUB.md",
  "docs/HARNESS_FOUNDATION_VALIDATION.md",
  "docs/HARNESS_RECONCILIATION_VALIDATION.md",
  "docs/HUB_EXTRACTION_VALIDATION.md",
  "docs/HUB_RETIREMENT_VALIDATION.md",
  "docs/SKILL_IMPROVEMENT.md",
  "docs/PROCEDURAL_LESSONS.md",
  "docs/AUTOMATIONS.md",
  "docs/AUTOMATION_VALIDATION.md",
  "integrations",
  "examples/automations",
  "examples/routing",
  "docs/PROCEDURAL_LESSONS_VALIDATION.md",
  "docs/CHIEF_OF_STAFF_RECIPE.md",
  "scripts/start.mjs",
  "scripts/setup.mjs",
  "scripts/skill-trials.mjs",
  "scripts/chief-recipe.mjs",
  "scripts/hub-acceptance.mjs",
  "scripts/discovery-acceptance.mjs",
  "examples/skill-comparison",
  "examples/chief-of-staff",
];
const digest = (p) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");
function files(path) {
  if (lstatSync(path).isSymbolicLink()) throw Error("HUB_STAGE_SYMLINK");
  if (lstatSync(path).isDirectory())
    return readdirSync(path)
      .sort()
      .flatMap((n) => files(join(path, n)));
  if (!lstatSync(path).isFile()) throw Error("HUB_STAGE_SPECIAL_FILE");
  return [path];
}
export function stageHub(output) {
  const destination = resolve(output);
  if (existsSync(destination))
    throw Error(
      "HUB_STAGE_EXISTS: Choose a new destination; existing files are never replaced.",
    );
  const build = JSON.parse(
    readFileSync(join(product, "dist/hub/hub-build.json"), "utf8"),
  );
  assertHubModules(build.modules);
  for (const path of included) files(join(product, path));
  const pkg = JSON.parse(readFileSync(join(product, "package.json"), "utf8"));
  mkdirSync(destination, { recursive: true });
  for (const path of included)
    cpSync(join(product, path), join(destination, path), { recursive: true });
  const staged = {
    name: pkg.name,
    version: pkg.version,
    private: true,
    type: "module",
    hoiSurface: "knowledge-hub",
    engines: pkg.engines,
    bin: pkg.bin,
    license: pkg.license,
    repository: pkg.repository,
    description:
      "HOI OS governed engine and optional Knowledge Hub; local unreleased distribution candidate",
    dependencies: Object.fromEntries(
      runtimeDependencies.map((name) => [name, pkg.dependencies[name]]),
    ),
    scripts: {
      setup: "node scripts/setup.mjs --skip-build --surface hub",
      start: "node scripts/start.mjs --surface hub",
      hub: "node scripts/start.mjs --surface hub",
      "harness:compare": "node scripts/skill-trials.mjs",
      "harness:recipe": "node scripts/chief-recipe.mjs",
      "hub:acceptance": "node scripts/hub-acceptance.mjs",
    },
  };
  writeFileSync(
    join(destination, "package.json"),
    JSON.stringify(staged, null, 2) + "\n",
  );
  const lock = JSON.parse(
    readFileSync(join(product, "package-lock.json"), "utf8"),
  );
  lock.packages[""] = {
    name: staged.name,
    version: staged.version,
    license: staged.license,
    engines: staged.engines,
    bin: staged.bin,
    dependencies: staged.dependencies,
  };
  writeFileSync(
    join(destination, "package-lock.json"),
    JSON.stringify(lock, null, 2) + "\n",
  );
  const npm = process.env.npm_execpath;
  if (!npm) throw Error("Run staging through npm run hub:stage");
  const result = spawnSync(
    process.execPath,
    [
      npm,
      "install",
      "--package-lock-only",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: destination, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw Error(
      "HUB_STAGE_LOCK_FAILED: No complete manifest written. " + result.stderr,
    );
  const finalLock = JSON.parse(
    readFileSync(join(destination, "package-lock.json"), "utf8"),
  );
  if (
    Object.keys(finalLock.packages).some((p) =>
      /node_modules\/(electron|electron-builder|@electron\/|vite(?:\/|$)|react(?:-dom|-force-graph-3d)?(?:\/|$)|radix-ui(?:\/|$))/.test(
        p,
      ),
    )
  )
    throw Error("HUB_STAGE_UNEXPECTED_DEPENDENCY");
  writeFileSync(
    join(destination, "README.md"),
    `# HOI OS — engine and Knowledge Hub\n\nUnreleased local candidate. Requires Node.js 22.14 or newer; no Git, Electron, assistant installation or AI key is needed to run the Hub. A compatible native dependency installation is still required.\n\n1. Run \`npm ci --omit=dev\` in this directory.\n2. Run \`npm run setup -- --workspace "../My HOI Workspace" --non-interactive\`.\n3. Run \`npm start -- --workspace "../My HOI Workspace" --port 0\` and open its complete authenticated URL.\n\nKeep the workspace outside this installation. Stopping the server stops its jobs; removing this installation does not delete a separate workspace. Preserve a verified backup before upgrading existing data. This candidate has no desktop installer or clean-machine certification.\n\nRun \`npm run hub:acceptance -- --output "../HOI acceptance"\` for a fictional installation/recovery rehearsal. See [installation and verification](docs/HUB_INSTALLATION.md) and [fresh-host checks](docs/HOST_ACCEPTANCE.md). A passing script does not certify a clean machine or assistant session.\n\nSee [the 25-step method](method/JOURNEY.md), [Hub guide](docs/KNOWLEDGE_HUB.md) and [governance](docs/RULES.md). The legacy business app and Electron runtime are retired. Project/task records remain engine-owned; user-built interfaces and assistants use those same operations.\n`,
  );
  const manifest = {
    version: 1,
    surface: "knowledge-hub",
    state: "local-unreleased-candidate",
    sourceVersion: pkg.version,
    files: files(destination).map((p) => ({
      path: relative(destination, p).replaceAll("\\", "/"),
      sha256: digest(p),
    })),
  };
  writeFileSync(
    join(destination, "HUB_PACKAGE.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return {
    output: destination,
    files: manifest.files.length,
    runtimeDependencies: runtimeDependencies.length,
    electron: false,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values } = parseArgs({ options: { output: { type: "string" } } });
  if (!values.output) throw Error("Use --output <new empty path>");
  console.log(JSON.stringify(stageHub(values.output)));
}
