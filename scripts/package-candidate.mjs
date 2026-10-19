import { readFileSync, writeFileSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import JSZip from "jszip";
import { preparePackageOutput } from "./package-output.mjs";
import { stageHub } from "./hub-stage.mjs";
import { verifyHubPackage } from "./hub-acceptance.mjs";
import { buildIdentity } from "../dist/core/security-evidence.js";
const product = fileURLToPath(new URL("..", import.meta.url));
const hash = (b) => createHash("sha256").update(b).digest("hex");
export async function packageCandidate(output) {
  const out = preparePackageOutput(product, output);
  // CANDIDATE.json is written last: a failed preparation is never a complete candidate.
  const staged = join(out, "hub");
  stageHub(staged);
  const manifest = JSON.parse(readFileSync(join(staged, "HUB_PACKAGE.json")));
  const checked = verifyHubPackage(staged);
  const zip = new JSZip();
  for (const name of [...manifest.files.map((f) => f.path), "HUB_PACKAGE.json"])
    zip.file(name, readFileSync(join(staged, name)), {
      date: new Date("2020-01-01T00:00:00Z"),
      createFolders: false,
    });
  writeFileSync(
    join(out, "hoi-os-hub.zip"),
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      platform: "UNIX",
    }),
  );
  const skills = spawnSync(
    process.execPath,
    [
      join(product, "scripts/package-release.mjs"),
      "--output",
      join(out, "skills"),
    ],
    { cwd: product, encoding: "utf8" },
  );
  if (skills.status !== 0)
    throw Error(
      "CANDIDATE_SKILLS_FAILED: Preserve this incomplete output and retry in a new directory.",
    );
  cpSync(join(product, "docs/FINAL_HANDOVER.md"), join(out, "START_HERE.md"));
  const assets = [
    "hoi-os-hub.zip",
    "START_HERE.md",
    "skills/hoi-install.zip",
    "skills/hoi-os-skills.zip",
    "skills/hoi-install.md",
    "skills/SKILL_PACKAGE.json",
    "skills/SHA256SUMS",
  ];
  const report = {
    formatVersion: 1,
    state: "local-unreleased-candidate",
    product: "HOI OS harness and optional Knowledge Hub",
    sourceBuildId: buildIdentity(product),
    packagedBuildId: buildIdentity(staged),
    hubManifest: checked,
    skillCounts: JSON.parse(
      readFileSync(join(out, "skills/SKILL_PACKAGE.json")),
    ).counts,
    files: Object.fromEntries(
      assets.map((n) => [n, hash(readFileSync(join(out, n)))]),
    ),
    gates: {
      publication: "not-performed",
      cleanMachine: "not-attested",
      freshAssistantHosts: "pending",
      independentEffectiveness: "pending",
      privateMigration: "not-performed",
    },
  };
  writeFileSync(
    join(out, "CANDIDATE.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  writeFileSync(
    join(out, "SHA256SUMS"),
    [...assets, "CANDIDATE.json"]
      .map((n) => `${hash(readFileSync(join(out, n)))}  ${n}`)
      .join("\n") + "\n",
  );
  return { output: out, ...report };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values } = parseArgs({ options: { output: { type: "string" } } });
  console.log(JSON.stringify(await packageCandidate(values.output), null, 2));
}
