import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)),
  stage = join(root, ".desktop-stage");
const platform = process.argv[2] || process.platform,
  arch = process.argv[3] || process.arch;
if (
  !["darwin", "win32", "linux"].includes(platform) ||
  !["arm64", "x64"].includes(arch)
)
  throw Error("Unsupported desktop target");
const { buildIdentity } = await import("../dist/core/security-evidence.js");
const { bundledGuides } = await import("../dist/core/guides.js");
bundledGuides(root); // Fail closed when the portable guide bundle is missing or stale.
const buildId = buildIdentity(root);
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
mkdirSync(stage);
// Explicit source allowlist: never copy the company directory, workspace or credentials.
for (const item of [
  "desktop",
  "dist",
  "bin",
  "skills",
  "docs/RULES.md",
  "docs/FILESYSTEM.md",
  "docs/TOOL_CONVENTIONS.md",
  "docs/OPERATIONS_REFERENCE.md",
  "docs/GUIDES.json",
  ".agents",
  ".claude",
  "LICENSE",
  "licenses",
  "TRADEMARKS.md",
  "THIRD_PARTY_NOTICES.md",
])
  if (existsSync(join(root, item)))
    cpSync(join(root, item), join(stage, item), { recursive: true });
mkdirSync(join(stage, "licenses"), { recursive: true });
for (const name of ["LICENSE", "LICENSES.chromium.html"])
  cpSync(
    join(root, "node_modules/electron/dist", name),
    join(stage, "licenses", "electron-" + name),
  );
if (existsSync(join(root, ".verification/security.json"))) {
  const { evidenceSchema } = await import("../dist/core/security-evidence.js");
  const evidence = evidenceSchema.parse(
    JSON.parse(readFileSync(join(root, ".verification/security.json"), "utf8")),
  );
  mkdirSync(join(stage, ".verification"));
  writeFileSync(
    join(stage, ".verification/security.json"),
    JSON.stringify(evidence),
  );
}
const staged = {
  ...pkg,
  hoiEngine: { electron: pkg.devDependencies.electron },
  main: "desktop/main.cjs",
  scripts: {},
  build: undefined,
};
writeFileSync(join(stage, "package.json"), JSON.stringify(staged, null, 2));
cpSync(join(root, "package-lock.json"), join(stage, "package-lock.json"));
for (const [family, name] of [
  ["inter-tight", "inter-tight-latin-wght-normal.woff2"],
  ["fraunces", "fraunces-latin-full-normal.woff2"],
  ["jetbrains-mono", "jetbrains-mono-latin-wght-normal.woff2"],
]) {
  const dir = join(root, "node_modules/@fontsource-variable", family, "files");
  const source = existsSync(join(dir, name))
    ? name
    : readdirSync(dir).find(
        (n) => n.startsWith(family + "-latin-") && n.endsWith("normal.woff2"),
      );
  cpSync(join(dir, source), join(stage, "desktop", family + ".woff2"));
  cpSync(
    join(dir, "..", "LICENSE"),
    join(stage, "desktop", family + "-LICENSE.txt"),
  );
}
const npm = process.env.npm_execpath;
if (!npm) throw Error("Run through npm run desktop:stage");
const r = spawnSync(
  process.execPath,
  [
    npm,
    "ci",
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--os=" + platform,
    "--cpu=" + arch,
  ],
  { cwd: stage, stdio: "inherit" },
);
if (r.status !== 0) throw Error("Desktop dependency staging failed");
const { rebuild } = await import("@electron/rebuild");
await rebuild({
  buildPath: stage,
  projectRootPath: stage,
  electronVersion: pkg.devDependencies.electron,
  platform,
  arch,
  onlyModules: ["better-sqlite3"],
});
writeFileSync(
  join(stage, "desktop/target.json"),
  JSON.stringify({
    platform,
    arch,
    electron: pkg.devDependencies.electron,
    package: pkg.version,
    buildId,
  }),
);
console.log("Desktop stage ready: " + platform + " " + arch);
