import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  renameSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
const root = resolve("."),
  npm = process.env.npm_execpath;
if (!npm) throw Error("Run npm run verify:security");
const build = spawnSync(process.execPath, [npm, "run", "build"], {
  stdio: "inherit",
});
if (build.status !== 0) process.exit(1);
const { buildIdentity, evidenceSchema, CHECK_VERSION } =
  await import("../dist/core/security-evidence.js");
const buildId = buildIdentity(),
  dir = join(root, ".verification");
mkdirSync(dir, { recursive: true });
let report = { version: 1, checkVersion: CHECK_VERSION, buildId, suites: [] };
try {
  const previous = evidenceSchema.parse(
    JSON.parse(readFileSync(join(dir, "security.json"), "utf8")),
  );
  if (previous.buildId === buildId) report = previous;
} catch {}
const requested = process.argv.includes("--desktop")
  ? ["desktop"]
  : process.argv.includes("--browser")
    ? ["browser"]
    : ["core"];
let failed = false;
for (const suite of requested) {
  const files =
    suite === "core"
      ? readdirSync("tests")
          .filter((x) => x.endsWith(".test.mjs"))
          .sort()
          .map((x) => "tests/" + x)
      : readdirSync("tests/" + suite)
          .filter((x) => x.endsWith(".spec.mjs"))
          .sort()
          .map((x) => "tests/" + suite + "/" + x);
  const hash = createHash("sha256");
  for (const f of files) hash.update(f + "\0").update(readFileSync(f));
  if (suite === "desktop") {
    if (
      !existsSync(".desktop-stage/desktop/target.json") ||
      buildIdentity(resolve(".desktop-stage")) !== buildId
    )
      throw Error(
        "DESKTOP_STAGE_STALE: Run npm run desktop:stage, then verify:security -- --desktop",
      );
  }
  const args =
    suite === "core"
      ? [npm, "run", "check"]
      : [
          "node_modules/@playwright/test/cli.js",
          "test",
          ...(suite === "desktop"
            ? ["--config", "playwright.desktop.config.mjs"]
            : []),
        ];
  const env = { ...process.env, FORCE_COLOR: "0" };
  delete env.HOI_DESKTOP_TEST_EXECUTABLE;
  const r = spawnSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 600000,
    env,
  });
  // Raw output remains local and may include synthetic temp paths; only aggregate fields enter shareable evidence.
  writeFileSync(
    join(dir, suite + ".log"),
    (r.stdout || "") + (r.stderr || ""),
    { mode: 0o600 },
  );
  const count = Number(
    (r.stdout || "").match(
      suite === "core" ? /# tests (\d+)/ : /(\d+) passed/,
    )?.[1] || 0,
  );
  const passed = r.status === 0 && count > 0 && buildIdentity() === buildId;
  const record = {
    suite,
    passed,
    tests: count,
    testedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    suiteDigest: hash.digest("hex"),
  };
  report.suites = report.suites.filter((x) => x.suite !== suite);
  report.suites.push(record);
  console.log(
    `${suite}: ${passed ? "passed" : "failed"} (${count} tests); local log .verification/${suite}.log`,
  );
  failed ||= !passed;
}
if (buildIdentity() !== buildId)
  throw Error("BUILD_CHANGED_DURING_VERIFICATION: Evidence not published");
const safe = evidenceSchema.parse(report);
writeFileSync(
  join(dir, "security.json.tmp"),
  JSON.stringify(safe, null, 2) + "\n",
  { mode: 0o600 },
);
renameSync(join(dir, "security.json.tmp"), join(dir, "security.json"));
process.exitCode = failed ? 1 : 0;
