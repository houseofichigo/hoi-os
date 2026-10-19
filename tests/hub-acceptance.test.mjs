import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { verifyHubPackage, runAcceptance } from "../scripts/hub-acceptance.mjs";
import { stageHub } from "../scripts/hub-stage.mjs";
const digest = (b) => createHash("sha256").update(b).digest("hex");
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "hoi-acceptance-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function manifest(root, files) {
  writeFileSync(
    join(root, "HUB_PACKAGE.json"),
    JSON.stringify({ version: 1, surface: "knowledge-hub", files }),
  );
}
test("acceptance refuses unsafe manifests before creating any workspace", async (t) => {
  const root = fixture(t),
    pkg = join(root, "package"),
    out = join(root, "output");
  mkdirSync(pkg);
  writeFileSync(join(root, "outside.txt"), "preserved");
  for (const name of [
    "../outside.txt",
    "/absolute",
    "C:/outside",
    "..\\outside",
    "a/../b",
    "a//b",
  ]) {
    manifest(pkg, [{ path: name, sha256: digest("preserved") }]);
    await assert.rejects(
      runAcceptance({ packageRoot: pkg, output: out }),
      /PACKAGE_PATH_INVALID/,
    );
    assert.equal(existsSync(out), false);
  }
  writeFileSync(join(pkg, "a"), "original");
  manifest(pkg, [{ path: "a", sha256: digest("other") }]);
  assert.throws(() => verifyHubPackage(pkg), /PACKAGE_CHECKSUM_MISMATCH/);
  manifest(pkg, [
    { path: "a", sha256: digest("original") },
    { path: "A", sha256: digest("original") },
  ]);
  assert.throws(() => verifyHubPackage(pkg), /PACKAGE_MANIFEST_INVALID/);
  assert.equal(readFileSync(join(root, "outside.txt"), "utf8"), "preserved");
});
test("acceptance rejects linked files, unlisted files and existing or overlapping output", async (t) => {
  const root = fixture(t),
    pkg = join(root, "package");
  mkdirSync(pkg);
  writeFileSync(join(root, "outside.txt"), "original");
  symlinkSync(join(root, "outside.txt"), join(pkg, "linked"));
  manifest(pkg, [{ path: "linked", sha256: digest("original") }]);
  assert.throws(() => verifyHubPackage(pkg), /PACKAGE_SYMLINK/);
  rmSync(join(pkg, "linked"));
  writeFileSync(join(pkg, "a"), "original");
  writeFileSync(join(pkg, "unlisted"), "extra");
  manifest(pkg, [{ path: "a", sha256: digest("original") }]);
  assert.throws(() => verifyHubPackage(pkg), /PACKAGE_UNLISTED_FILE/);
  await assert.rejects(
    runAcceptance({ packageRoot: pkg, output: root }),
    /OUTPUT_EXISTS/,
  );
  await assert.rejects(
    runAcceptance({ packageRoot: pkg, output: join(pkg, "output") }),
    /OUTPUT_OVERLAPS_PACKAGE/,
  );
  const alias = join(root, "alias");
  symlinkSync(pkg, alias, "dir");
  await assert.rejects(
    runAcceptance({ packageRoot: pkg, output: join(alias, "output") }),
    /OUTPUT_OVERLAPS_PACKAGE/,
  );
});
test("packaged acceptance reports dependency failure safely and never promotes untested host gates", async (t) => {
  const root = fixture(t),
    pkg = join(root, "package"),
    output = join(root, "failure");
  stageHub(pkg);
  const r = await runAcceptance({ packageRoot: pkg, output });
  assert.equal(r.status, "failed");
  assert.equal(r.checks[0].status, "failed");
  assert.equal(r.scope.cleanMachine, "not-attested");
  assert.equal(r.scope.hostSessionsRun, 0);
  assert.equal(r.scope.providerDispatches, 0);
  assert.ok(r.pending.some((s) => s.includes("Codex")));
  assert.equal(existsSync(join(output, "workspace")), false);
  assert.doesNotMatch(
    readFileSync(join(output, "acceptance.json"), "utf8"),
    /Bearer|http:\/\/|\/Users\//,
  );
  await assert.rejects(
    runAcceptance({ packageRoot: pkg, output }),
    /OUTPUT_EXISTS/,
  );
  const cancelled = join(root, "cancelled");
  const controller = new AbortController();
  controller.abort();
  const stopped = await runAcceptance({
    packageRoot: pkg,
    output: cancelled,
    signal: controller.signal,
  });
  assert.equal(stopped.status, "interrupted");
  assert.equal(stopped.checks[0].code, "ACCEPTANCE_CANCELLED");
  assert.equal(existsSync(join(cancelled, "workspace")), false);
});
test(
  "isolated production package completes launcher/CLI, adapters, exact review and recovery acceptance",
  { timeout: 180000 },
  async (t) => {
    const root = fixture(t),
      pkg = join(root, "package"),
      output = join(root, "accepted");
    stageHub(pkg);
    const install = spawnSync(
      process.execPath,
      [
        process.env.npm_execpath,
        "ci",
        "--omit=dev",
        "--offline",
        "--no-audit",
        "--no-fund",
      ],
      { cwd: pkg, encoding: "utf8", timeout: 90000 },
    );
    assert.equal(install.status, 0, install.stderr);
    const result = await runAcceptance({ packageRoot: pkg, output });
    assert.equal(
      result.status,
      "passed-local-checks",
      JSON.stringify(result.checks),
    );
    assert.equal(result.checks.length, 12);
    assert.ok(result.checks.every((c) => c.status === "passed"));
    assert.equal(result.schemaVersion, 20);
    assert.match(result.buildId, /^[a-f0-9]{64}$/);
    assert.ok(result.pending.length);
    assert.equal(result.scope.hostSessionsRun, 0);
    assert.equal(result.scope.cleanMachine, "not-attested");
    assert.equal(
      existsSync(join(output, "workspace/.hoi/engine-session")),
      false,
    );
    assert.equal(
      existsSync(join(output, "restored-workspace/.hoi/engine-session")),
      false,
    );
    const text = readFileSync(join(output, "acceptance.json"), "utf8");
    assert.doesNotMatch(text, /Bearer|http:\/\/|\/Users\//);
    assert.equal(
      digest(readFileSync(join(output, "HOST_REVIEW.md"))),
      result.artifacts["HOST_REVIEW.md"],
    );
    assert.equal(verifyHubPackage(pkg).digest, result.package.digest);
    const installed = join(pkg, "node_modules/better-sqlite3/package.json");
    const previous = readFileSync(installed);
    const stale = JSON.parse(previous);
    stale.version = "0.0.0";
    writeFileSync(installed, JSON.stringify(stale));
    const wrong = await runAcceptance({
      packageRoot: pkg,
      output: join(root, "wrong-dependency"),
    });
    assert.equal(wrong.status, "failed");
    assert.equal(wrong.checks[0].code, "DEPENDENCY_VERSION_MISMATCH");
    assert.equal(existsSync(join(root, "wrong-dependency/workspace")), false);
    writeFileSync(installed, previous);
  },
);
