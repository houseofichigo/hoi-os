import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";
import {
  buildIdentity,
  evidenceChecks,
  EVIDENCE_TTL_MS,
} from "../dist/core/security-evidence.js";
import { security } from "../dist/core/configuration.js";
import { backup } from "../dist/core/backup.js";
const id = "a".repeat(64);
function report() {
  return {
    version: 1,
    checkVersion: 1,
    buildId: id,
    suites: [
      {
        suite: "core",
        passed: true,
        tests: 10,
        testedAt: new Date().toISOString(),
        platform: process.platform,
        arch: process.arch,
        node: process.versions.node,
        suiteDigest: "b".repeat(64),
      },
    ],
  };
}
test("security evidence expires and is bound to code, check version, suite and platform", (t) => {
  const f = fixture(t),
    p = join(f.root, "evidence.json");
  const save = (x) => writeFileSync(p, JSON.stringify(x));
  assert.equal(evidenceChecks(id, p)[0].detail, "EVIDENCE_MISSING");
  save(report());
  assert.equal(evidenceChecks(id, p)[0].status, "pass");
  assert.equal(evidenceChecks("c".repeat(64), p)[0].detail, "BUILD_MISMATCH");
  assert.equal(
    evidenceChecks(id, p, Date.now() + EVIDENCE_TTL_MS + 1000)[0].detail,
    "EVIDENCE_EXPIRED",
  );
  assert.equal(
    evidenceChecks(id, p, Date.now() - 120000)[0].detail,
    "EVIDENCE_FUTURE",
  );
  let r = report();
  r.suites[0].platform = process.platform === "win32" ? "darwin" : "win32";
  save(r);
  assert.equal(evidenceChecks(id, p)[0].detail, "PLATFORM_MISMATCH");
  r = report();
  r.suites[0].passed = false;
  save(r);
  assert.equal(evidenceChecks(id, p)[0].status, "not-tested");
  r = report();
  r.checkVersion = 99;
  save(r);
  assert.equal(evidenceChecks(id, p)[0].detail, "EVIDENCE_INVALID");
  save(report());
  assert.equal(
    evidenceChecks(id, p).find((x) => x.code === "DESKTOP_BOUNDARY").detail,
    "SUITE_NOT_RUN",
  );
});
test("malformed evidence cannot inject private strings or claim zero-test success", (t) => {
  const f = fixture(t),
    p = join(f.root, "evidence.json"),
    r = report();
  r.suites[0].error = "private@example.test token-secret path-secret";
  writeFileSync(p, JSON.stringify(r));
  const result = evidenceChecks(id, p);
  assert.ok(!JSON.stringify(result).includes("secret"));
  assert.equal(result[0].detail, "EVIDENCE_INVALID");
  delete r.suites[0].error;
  r.suites[0].tests = 0;
  writeFileSync(p, JSON.stringify(r));
  assert.equal(evidenceChecks(id, p)[0].status, "not-tested");
});
test("workspace security verifies actual backup and exposes only scoped metadata", (t) => {
  const f = fixture(t);
  assert.equal(
    security(f.s, "local").checks.find((c) => c.code === "BACKUP_STATUS")
      .status,
    "fail",
  );
  const b = join(f.root, "snapshot");
  backup(f.s, b);
  const check = security(f.s, "local");
  assert.equal(
    check.checks.find((c) => c.code === "BACKUP_STATUS").status,
    "pass",
  );
  assert.equal(check.buildId, buildIdentity());
  assert.ok(check.checks.every((c) => c.checkVersion === 1 && c.buildId));
  writeFileSync(join(b, "manifest.json"), "invalid");
  const broken = security(f.s, "local");
  assert.equal(
    broken.checks.find((c) => c.code === "BACKUP_STATUS").detail,
    "BACKUP_INVALID",
  );
  assert.ok(!JSON.stringify(broken).includes(f.root));
  assert.equal(
    broken.checks.find((c) => c.code === "CREDENTIAL_STORAGE").status,
    "not-tested",
  );
});

test("build identity survives packaging removal of development metadata and detects code changes", async (t) => {
  const { mkdirSync } = await import("node:fs");
  const f = fixture(t),
    root = join(f.root, "product");
  mkdirSync(root);
  for (const dir of ["dist/core", "dist/web", "bin", "skills", "desktop"])
    mkdirSync(join(root, dir), { recursive: true });
  const pkg = {
    version: "0.1.0-test",
    dependencies: { sqlite: "fixture" },
    devDependencies: { electron: "42.11.8" },
  };
  const p = join(root, "package.json");
  writeFileSync(p, JSON.stringify(pkg));
  writeFileSync(join(root, "desktop/main.cjs"), "// fixture");
  const initial = buildIdentity(root);
  delete pkg.devDependencies;
  pkg.hoiEngine = { electron: "42.11.8" };
  writeFileSync(p, JSON.stringify(pkg));
  assert.equal(buildIdentity(root), initial);
  writeFileSync(join(root, "desktop/main.cjs"), "// changed fixture");
  assert.notEqual(buildIdentity(root), initial);
});
