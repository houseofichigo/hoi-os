import { createHash } from "node:crypto";
import { readFileSync, readdirSync, lstatSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
export const PRODUCT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const CHECK_VERSION = 1;
export const EVIDENCE_TTL_MS = 7 * 86400000;
export const TEST_CHECKS = {
  SOURCE_PERMISSION_ENFORCEMENT: "core",
  AUTHENTICATION_ORIGIN: "core",
  UPLOAD_CONTAINMENT: "core",
  EXACT_APPROVALS: "core",
  CREDENTIAL_EXCLUSION: "core",
  RECOVERY_REGRESSIONS: "core",
  CONNECTOR_REGRESSIONS: "core",
  DESKTOP_BOUNDARY: "desktop",
  BROWSER_ACCESSIBILITY: "browser",
} as const;
export function buildIdentity(root = PRODUCT_ROOT) {
  const hash = createHash("sha256");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  hash.update(
    JSON.stringify({
      version: pkg.version,
      dependencies: pkg.dependencies,
      electron: pkg.devDependencies?.electron ?? pkg.hoiEngine?.electron,
      checkVersion: CHECK_VERSION,
    }),
  );
  const files: string[] = [];
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error("BUILD_SYMLINK");
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  for (const dir of ["dist/core", "dist/web", "bin", "skills", "desktop"])
    visit(join(root, dir));
  for (const name of [
    "RULES.md",
    "FILESYSTEM.md",
    "TOOL_CONVENTIONS.md",
    "OPERATIONS_REFERENCE.md",
    "GUIDES.json",
  ])
    if (existsSync(join(root, "docs", name)))
      files.push(join(root, "docs", name));
    else hash.update(`missing-guide:${name}`);
  for (const file of files.sort()) {
    const name = relative(root, file).replaceAll("\\", "/");
    if (name.startsWith("dist/core/") && !name.endsWith(".js")) continue;
    if (name.startsWith("desktop/") && !/\.(cjs|mjs|js|css|html)$/.test(name))
      continue;
    hash.update(name + "\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}
const suite = z
  .object({
    suite: z.enum(["core", "browser", "desktop"]),
    passed: z.boolean(),
    tests: z.number().int().nonnegative().max(100000),
    testedAt: z.string().datetime(),
    platform: z.enum(["darwin", "linux", "win32"]),
    arch: z.enum(["arm64", "x64"]),
    node: z.string().regex(/^\d+\.\d+\.\d+$/),
    suiteDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const evidenceSchema = z
  .object({
    version: z.literal(1),
    checkVersion: z.literal(1),
    buildId: z.string().regex(/^[a-f0-9]{64}$/),
    suites: z.array(suite).max(3),
  })
  .strict();
export type Evidence = z.infer<typeof evidenceSchema>;
export function evidenceChecks(
  buildId: string,
  file = join(PRODUCT_ROOT, ".verification/security.json"),
  time = Date.now(),
) {
  let report: Evidence | undefined,
    reason = "EVIDENCE_MISSING";
  try {
    if (existsSync(file)) {
      const st = lstatSync(file);
      if (!st.isFile() || st.size > 262144) throw Error("invalid");
      report = evidenceSchema.parse(JSON.parse(readFileSync(file, "utf8")));
      if (
        new Set(report.suites.map((s) => s.suite)).size !== report.suites.length
      )
        throw Error("duplicate");
      reason =
        report.buildId === buildId ? "EVIDENCE_AVAILABLE" : "BUILD_MISMATCH";
    }
  } catch {
    report = undefined;
    reason = "EVIDENCE_INVALID";
  }
  return Object.entries(TEST_CHECKS).map(([code, kind]) => {
    const s = report?.suites.find((s) => s.suite === kind);
    let detail = reason;
    if (reason === "EVIDENCE_AVAILABLE") {
      detail = !s
        ? "SUITE_NOT_RUN"
        : s.platform !== process.platform || s.arch !== process.arch
          ? "PLATFORM_MISMATCH"
          : Date.parse(s.testedAt) > time + 60000
            ? "EVIDENCE_FUTURE"
            : time - Date.parse(s.testedAt) > EVIDENCE_TTL_MS
              ? "EVIDENCE_EXPIRED"
              : !s.passed || s.tests < 1
                ? "SUITE_FAILED"
                : "MATCHING_SYNTHETIC_EVIDENCE";
    }
    return {
      code,
      status: detail === "MATCHING_SYNTHETIC_EVIDENCE" ? "pass" : "not-tested",
      detail,
      checkVersion: CHECK_VERSION,
      buildId,
      scope: `Synthetic ${kind} regression suite; not a live workspace/provider attestation`,
      testedAt: s?.testedAt ?? null,
      environment: s
        ? { platform: s.platform, arch: s.arch, node: s.node }
        : null,
      tests: s?.tests ?? 0,
    };
  });
}
