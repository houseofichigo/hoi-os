import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const { values: v } = parseArgs({
  options: {
    workspace: { type: "string" },
    hosts: { type: "string", default: "none" },
    "skip-build": { type: "boolean" },
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
if (!v["skip-build"]) {
  const npm = process.env.npm_execpath;
  if (!npm) throw Error("Run setup through npm run setup");
  const r = spawnSync(process.execPath, [npm, "run", "build"], {
    cwd: product,
    stdio: "inherit",
  });
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
  `Setup complete. Start Home with npm start -- --workspace "${workspace}". Assistant adapters are optional.\n${doctor.stdout}`,
);
if (installed) console.log(JSON.stringify(installed, null, 2));
