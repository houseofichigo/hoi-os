import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import {
  resolve,
  join,
  dirname,
  basename,
  relative,
  isAbsolute,
  sep,
} from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  lstatSync,
  realpathSync,
} from "node:fs";

const { values: v } = parseArgs({
  options: {
    workspace: { type: "string" },
    hosts: { type: "string", default: "none" },
    "skip-build": { type: "boolean" },
    surface: { type: "string", default: "hub" },
    "non-interactive": { type: "boolean" },
  },
});
const product = fileURLToPath(new URL("..", import.meta.url));
if (
  Number(process.versions.node.split(".")[0]) < 22 ||
  (process.versions.node.startsWith("22.") &&
    Number(process.versions.node.split(".")[1]) < 14)
)
  throw Error("Node.js 22.14 or newer is required.");
if (!["none", "codex", "claude", "both"].includes(v.hosts))
  throw Error("--hosts must be none, codex, claude, or both");
if (!["app", "hub"].includes(v.surface))
  throw Error("--surface must be app or hub");
// The old app flag is a compatibility alias; the business app is retired.
v.surface = "hub";
let workspace = v.workspace;
if (!workspace) {
  if (v["non-interactive"] || !stdin.isTTY)
    throw Error(
      "Supply --workspace <private directory> for non-interactive setup",
    );
  const rl = createInterface({ input: stdin, output: stdout });
  workspace =
    (await rl.question(
      `Private workspace directory [${join(homedir(), "HOI Workspace")}]: `,
    )) || join(homedir(), "HOI Workspace");
  rl.close();
}
workspace = resolve(workspace);
// Inspect the selected location before building or writing any workspace files.
try {
  if (lstatSync(workspace).isSymbolicLink())
    throw Error("Choose a real workspace directory, not a symbolic link");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
function physical(path) {
  const suffix = [];
  while (!existsSync(path)) {
    suffix.unshift(basename(path));
    path = dirname(path);
  }
  return join(realpathSync(path), ...suffix);
}
workspace = physical(workspace);
const productDirectory = physical(product);
const within = (a, b) => {
  const p = relative(a, b);
  return !p || (p !== ".." && !p.startsWith(".." + sep) && !isAbsolute(p));
};
if (within(productDirectory, workspace) || within(workspace, productDirectory))
  throw Error(
    "The private workspace and product checkout must be separate directories.",
  );
if (
  existsSync(workspace) &&
  !existsSync(join(workspace, ".hoi/workspace.json")) &&
  readdirSync(workspace).length
)
  throw Error(
    "Choose an empty directory for a new private workspace; existing files are never adopted or committed automatically.",
  );
if (!v["skip-build"]) {
  const npm = process.env.npm_execpath;
  if (!npm) throw Error("Run setup through npm run setup");
  const r = spawnSync(
    process.execPath,
    [npm, "run", v.surface === "hub" ? "build:hub" : "build"],
    {
      cwd: product,
      stdio: "inherit",
    },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const { initialize, Store } = await import("../dist/core/store.js");
const { contained, atomic, safePath } = await import("../dist/core/files.js");
if (contained(product, workspace) || contained(workspace, product))
  throw Error(
    "The private workspace and product checkout must be separate directories.",
  );
const { acquireLock } = await import("../dist/core/locks.js");
const { backup } = await import("../dist/core/backup.js");
const { updateAdapters } = await import("../dist/core/adapters.js");
const { ENGINE_API_VERSION } = await import("../dist/core/protocol.js");
const existing = existsSync(join(workspace, ".hoi/workspace.json"));
let release;
if (existing) release = acquireLock(workspace, "setup");
else {
  initialize(workspace);
  release = acquireLock(workspace, "setup");
}
let s;
let installed;
try {
  s = new Store(workspace);
  if (existing) backup(s, `${workspace}.before-setup-${Date.now()}`);
  const runtimePath = safePath(workspace, ".hoi/runtime.json");
  const previous = existsSync(runtimePath)
    ? JSON.parse(readFileSync(runtimePath, "utf8"))
    : { hosts: [] };
  atomic(
    runtimePath,
    JSON.stringify(
      {
        schemaVersion: 2,
        productPath: product,
        entrypoint: join(product, "bin/hoi.mjs"),
        workspace,
        hosts: previous.hosts || [],
        engineApiVersion: ENGINE_API_VERSION,
      },
      null,
      2,
    ),
  );
  if (v.hosts !== "none")
    installed = updateAdapters(s, "local", {
      action: "install",
      hosts: v.hosts === "both" ? ["codex", "claude"] : [v.hosts],
    });
} finally {
  s?.close();
  release();
}
const doctor = spawnSync(
  process.execPath,
  [
    join(product, "bin/hoi.mjs"),
    "doctor",
    "--workspace",
    workspace,
    "--host",
    "local",
    "--json",
  ],
  { encoding: "utf8" },
);
if (doctor.status !== 0) throw Error(doctor.stderr);
console.log(
  `Setup complete. Start ${v.surface === "hub" ? "Knowledge Hub with npm run hub" : "Home with npm start"} -- --workspace "${workspace}". Assistant adapters are optional.\n${doctor.stdout}`,
);
if (installed) console.log(JSON.stringify(installed, null, 2));
