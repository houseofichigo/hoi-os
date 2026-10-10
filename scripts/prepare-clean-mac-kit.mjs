import {
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  lstatSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
export function prepareKit(candidate, output) {
  const build = JSON.parse(readFileSync(join(candidate, "BUILD.json"), "utf8"));
  if (
    build.platform !== "darwin" ||
    !["arm64", "x64"].includes(build.arch) ||
    !/^\w{64}$/.test(build.buildId)
  )
    throw Error("MAC_BUILD_REQUIRED");
  const zips = readdirSync(candidate).filter(
    (n) => n.endsWith(".zip") && lstatSync(join(candidate, n)).isFile(),
  );
  if (zips.length !== 1) throw Error("ONE_CANDIDATE_ZIP_REQUIRED");
  const name = zips[0],
    checksum = createHash("sha256")
      .update(readFileSync(join(candidate, name)))
      .digest("hex");
  const listed = readFileSync(join(candidate, "SHA256SUMS"), "utf8").split(
    "\n",
  );
  if (!listed.includes(checksum + "  " + name))
    throw Error("ARTIFACT_CHECKSUM_MISMATCH");
  mkdirSync(output); // Preserve earlier kits; never replace their operator results.
  copyFileSync(join(candidate, name), join(output, name));
  writeFileSync(join(output, "SHA256SUMS"), checksum + "  " + name + "\n");
  copyFileSync(join(candidate, "BUILD.json"), join(output, "BUILD.json"));
  const cases = [
    "fresh-machine-no-development-tools",
    "checksum",
    "gatekeeper",
    "onboarding-without-adapters-or-ai",
    "fictional-import",
    "quit-and-retrieve",
    "keychain",
    "verified-backup-restore",
    "upgrade-copy-and-rollback",
    "uninstall-preserves-workspace",
    "reinstall-and-retrieve",
  ];
  const report = {
    version: 1,
    buildId: build.buildId,
    artifactSha256: checksum,
    platform: "macOS",
    arch: build.arch,
    operator: null,
    observedAt: null,
    osVersion: null,
    freshEnvironmentConfirmed: false,
    results: cases.map((id) => ({
      id,
      status: "not-tested",
      observation: null,
    })),
    acceptance: "not-certified",
  };
  writeFileSync(
    join(output, "OPERATOR_RESULTS.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  writeFileSync(
    join(output, "fictional-workshop.md"),
    "# Fictional Juniper workshop\nRecovery reference JUN-718. The workshop uses a printed agenda.\n",
  );
  writeFileSync(
    join(output, "START_HERE.md"),
    `# Clean Mac verification kit\n\nBuild ${build.buildId}; ${build.arch}. This is an unsigned alpha test candidate, not an approved public release.\n\n1. Use a fresh Mac or genuinely fresh test user; record OS, operator and date in OPERATOR_RESULTS.json. An empty PATH on the developer machine does not satisfy this gate.\n2. Run shasum -a 256 -c SHA256SUMS in this folder. Extract the ZIP. Record any Gatekeeper block; do not disable protections globally.\n3. Create a workspace outside the app bundle. Complete onboarding with no assistant; skip optional configuration.\n4. Import fictional-workshop.md via manifest review. Quit, reopen and retrieve JUN-718.\n5. Verify a backup and restore into another directory; retain originals. Upgrade a copy only when an older supported fixture is available.\n6. Quit, remove only the app bundle, and confirm the separate workspace remains. Reinstall and retrieve the same record.\n7. Record pass/fail/not-tested for each check with observations. Keychain requires a separately authorized test credential; never write secrets into the report.\n\nA blocked or unavailable check stays unverified. Do not send private records, account identifiers or local paths in public reports. Signing, native Windows and live-provider gates remain separate.\n`,
  );
  return {
    buildId: build.buildId,
    artifactSha256: checksum,
    checks: cases.length,
    acceptance: "not-certified",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [source, out] = process.argv.slice(2);
  if (!source || !out)
    throw Error(
      "Usage: prepare-clean-mac-kit.mjs CANDIDATE_DIRECTORY NEW_KIT_DIRECTORY",
    );
  console.log(JSON.stringify(prepareKit(resolve(source), resolve(out))));
}
