import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { parseArgs } from "node:util";
import { preparePackageOutput } from "./package-output.mjs";
import { catalog, files } from "./skill-packages.mjs";
const root = fileURLToPath(new URL("..", import.meta.url)),
  pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const check = spawnSync(
  process.execPath,
  [join(root, "scripts/sync-skills.mjs"), "--check"],
  { encoding: "utf8" },
);
if (check.status !== 0) throw Error(check.stdout + check.stderr);
const { values } = parseArgs({ options: { output: { type: "string" } } });
const data = catalog(root, pkg.version),
  out = preparePackageOutput(root, values.output);
const fixed = new Date("2020-01-01T00:00:00.000Z");
async function zip(names, name, operational = false) {
  const z = new JSZip();
  for (const skill of names)
    for (const path of files(join(root, "skills", skill)))
      z.file(
        `${skill}/${relative(join(root, "skills", skill), path).replaceAll("\\", "/")}`,
        readFileSync(path),
        { date: fixed, createFolders: false },
      );
  const prefix = operational ? "" : "hoi-install/";
  z.file(prefix + "LICENSE", readFileSync(join(root, "LICENSE")), {
    date: fixed,
    createFolders: false,
  });
  if (operational)
    z.file(
      "README.md",
      `These ${names.length} operational skills require the matching HOI OS core and private workspace. This is a collection archive, not a single skill upload. This is an unreleased local candidate. Use the matching engine/Knowledge Hub package and its installation guide; the historical package version does not identify a newly published release.\n`,
      { date: fixed },
    );
  const bytes = await z.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX",
  });
  writeFileSync(join(out, name), bytes);
}
await zip(["hoi-install"], "hoi-install.zip");
await zip(
  data.skills.filter((s) => s.kind === "operational").map((s) => s.name),
  "hoi-os-skills.zip",
  true,
);
const guide = readFileSync(join(root, "skills/hoi-install/SKILL.md"), "utf8")
  .replace(/\]\(references\/local-setup.md\)/g, "](#local-installation)")
  .replace(/\]\(references\/chat-guidance.md\)/g, "](#chat-guidance)");
const local = readFileSync(
    join(root, "skills/hoi-install/references/local-setup.md"),
    "utf8",
  ),
  chat = readFileSync(
    join(root, "skills/hoi-install/references/chat-guidance.md"),
    "utf8",
  );
writeFileSync(
  join(out, "hoi-install.md"),
  guide +
    '\n<a id="local-installation"></a>\n' +
    local +
    '\n<a id="chat-guidance"></a>\n' +
    chat +
    "\n## License\n\n" +
    readFileSync(join(root, "LICENSE"), "utf8"),
);
writeFileSync(
  join(out, "SKILL_PACKAGE.json"),
  JSON.stringify(
    {
      formatVersion: 1,
      channel: "local-unreleased-candidate",
      packageBase: pkg.version,
      catalogSha256: createHash("sha256")
        .update(readFileSync(join(root, "skills/catalog.json")))
        .digest("hex"),
      counts: {
        installer: 1,
        operational: data.skills.filter((s) => s.kind === "operational").length,
        total: data.skills.length,
      },
      compatibility: data.compatibility,
      skillInstructions: Object.fromEntries(
        data.skills.map((s) => [
          s.name,
          createHash("sha256")
            .update(readFileSync(join(root, "skills", s.name, "SKILL.md")))
            .digest("hex"),
        ]),
      ),
      limitations: [
        "Instructions require the matching engine and an authorized host.",
        "No skill activation or host installation occurs during packaging.",
        "Fresh host execution and independent effectiveness remain unverified.",
      ],
    },
    null,
    2,
  ) + "\n",
);
const assets = [
  "hoi-install.md",
  "hoi-install.zip",
  "hoi-os-skills.zip",
  "SKILL_PACKAGE.json",
];
writeFileSync(
  join(out, "SHA256SUMS"),
  assets
    .map(
      (name) =>
        `${createHash("sha256")
          .update(readFileSync(join(out, name)))
          .digest("hex")}  ${name}`,
    )
    .join("\n") + "\n",
);
console.log(
  `Release assets: ${relative(root, out)} (${assets.length + 1} files)`,
);
