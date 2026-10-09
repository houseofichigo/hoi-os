import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("..", import.meta.url));
const target = JSON.parse(
  readFileSync(join(root, ".desktop-stage/desktop/target.json"), "utf8"),
);
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (
  !["darwin", "win32"].includes(target.platform) ||
  !["arm64", "x64"].includes(target.arch) ||
  target.electron !== pkg.devDependencies.electron ||
  target.package !== pkg.version
)
  throw Error("Re-stage a supported desktop target before packaging");
const { buildIdentity } = await import("../dist/core/security-evidence.js");
const current = buildIdentity(root);
if (
  target.buildId !== current ||
  buildIdentity(join(root, ".desktop-stage")) !== current
)
  throw Error("DESKTOP_STAGE_STALE: Rebuild and re-stage before packaging");
const batch = `${current.slice(0, 12)}-${new Date().toISOString().replaceAll(":", "-")}`;
const output = join(root, "desktop-release", batch);
mkdirSync(output, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/electron-builder/cli.js"),
    target.platform === "darwin" ? "--mac" : "--win",
    "--" + target.arch,
    "--config.directories.output=" + output,
    "--config.artifactName=${productName}-${version}-" +
      current.slice(0, 12) +
      "-${os}-${arch}.${ext}",
    "--publish",
    "never",
  ],
  {
    cwd: root,
    stdio: "inherit",
    timeout: 600000,
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
  },
);
if (result.error)
  console.error("DESKTOP_PACKAGE_FAILED: " + result.error.message);
process.exitCode = result.status ?? 1;

if (result.status === 0) {
  writeFileSync(
    join(output, "BUILD.json"),
    JSON.stringify(
      {
        buildId: current,
        package: pkg.version,
        platform: target.platform,
        arch: target.arch,
        electron: target.electron,
        builtAt: new Date().toISOString(),
        signed: false,
        cleanMachineVerified: false,
        liveProvidersVerified: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Local desktop output: " + output);
}
