import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
  readdirSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { Store, migrate } from "../dist/core/store.js";
import { restore, verifyBackup, backup } from "../dist/core/backup.js";
import { retrieve } from "../dist/core/intake.js";
const root = resolve("."),
  destination = process.argv[2];
if (!destination)
  throw Error(
    "Usage: node scripts/rehearse-historical-upgrade.mjs NEW_DIRECTORY",
  );
const out = resolve(destination);
mkdirSync(out); // Refuse overwriting any earlier rehearsal.
const revision = execFileSync("git", ["rev-parse", "v0.1.0-alpha.2^{commit}"], {
  encoding: "utf8",
}).trim();
const code = join(out, "historical-code");
mkdirSync(code);
execFileSync("git", [
  "archive",
  "--format=tar",
  "--output=" + join(out, "source.tar"),
  revision,
]);
execFileSync("/usr/bin/tar", ["-xf", join(out, "source.tar"), "-C", code]);
// Explicit compatibility harness: release sources, currently installed compatible dependencies.
symlinkSync(join(root, "node_modules"), join(code, "node_modules"), "dir");
execFileSync(process.execPath, [
  join(root, "node_modules/typescript/bin/tsc"),
  "-p",
  join(code, "tsconfig.json"),
]);
const load = (name) =>
  import(pathToFileURL(join(code, "dist/core", name + ".js")).href);
const oldStore = await load("store"),
  oldIntake = await load("intake"),
  oldKnowledge = await load("knowledge"),
  oldBackup = await load("backup");
const original = join(out, "original-schema-1");
oldStore.initialize(original);
const input = join(out, "fictional.md");
writeFileSync(
  input,
  "# Cedar\nFictional Cedar reference CED-731 prefers a printed agenda.",
);
let old = new oldStore.Store(original),
  expected;
try {
  await oldIntake.ingest(old, input);
  const hit = oldIntake.retrieve(old, "CED-731", "local").results[0];
  assert.ok(hit);
  const memory = oldKnowledge.capture(
    old,
    {
      type: "preference",
      content: "Cedar prefers a printed agenda.",
      evidence: [
        {
          revisionId: hit.revisionId,
          passageId: hit.passageId,
          quote: hit.quote,
        },
      ],
    },
    "local",
  );
  oldKnowledge.reviewMemory(old, memory.id, "approved", "local");
  expected = {
    sourceId: hit.sourceId,
    revisionId: hit.revisionId,
    passageId: hit.passageId,
    quote: hit.quote,
    memoryId: memory.id,
  };
  oldBackup.backup(old, join(out, "historical-backup"));
} finally {
  old.close();
}
const sha = (data) => createHash("sha256").update(data).digest("hex");
function tree(path) {
  const result = {};
  function walk(dir, prefix = "") {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const name = prefix + e.name;
      if (e.isDirectory()) walk(join(dir, e.name), name + "/");
      else result[name] = sha(readFileSync(join(dir, e.name)));
    }
  }
  walk(path);
  return result;
}
const untouched = tree(original);
verifyBackup(join(out, "historical-backup"));
const upgraded = join(out, "upgraded-schema-19");
restore(join(out, "historical-backup"), upgraded);
let s = new Store(upgraded);
try {
  assert.equal(s.schemaVersion, 1);
  migrate(s);
  s.close();
  s = new Store(upgraded);
  assert.equal(s.schemaVersion, 19);
  const hit = retrieve(s, "CED-731", "local").results.find(
    (r) => r.passageId === expected.passageId,
  );
  assert.ok(hit);
  for (const k of ["sourceId", "revisionId", "passageId", "quote"])
    assert.equal(hit[k], expected[k]);
  assert.equal(
    readFileSync(join(upgraded, "memory", expected.memoryId + ".md"), "utf8"),
    readFileSync(join(original, "memory", expected.memoryId + ".md"), "utf8"),
  );
  backup(s, join(out, "upgraded-backup"));
} finally {
  s.close();
}
verifyBackup(join(out, "upgraded-backup"));
restore(join(out, "upgraded-backup"), join(out, "restored-schema-19"));
s = new Store(join(out, "restored-schema-19"));
try {
  assert.equal(s.schemaVersion, 19);
  assert.ok(
    retrieve(s, "CED-731", "local").results.some(
      (r) => r.passageId === expected.passageId,
    ),
  );
} finally {
  s.close();
}
assert.deepEqual(tree(original), untouched);
old = new oldStore.Store(original);
try {
  assert.ok(
    oldIntake
      .retrieve(old, "CED-731", "local")
      .results.some((r) => r.passageId === expected.passageId),
  );
} finally {
  old.close();
}
const report = {
  version: 1,
  historicalTag: "v0.1.0-alpha.2",
  historicalCommit: revision,
  sourceArchiveSha256: sha(readFileSync(join(out, "source.tar"))),
  fromSchema: 1,
  toSchema: 19,
  sourceAndCitationIdsPreserved: true,
  approvedMemoryFilePreserved: true,
  originalUnchangedBeforeRollback: true,
  oldEngineRollbackReadPassed: true,
  upgradedBackupRestorePassed: true,
  limitations: [
    "Historical release source executed with current compatible dependencies, not the historical lockfile binaries.",
    "Fictional source and approved memory only; schema 1 predates projects/tasks/wiki/conversation tables.",
    "No private migration or clean-machine certification.",
  ],
};
writeFileSync(
  join(out, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
  { flag: "wx" },
);
console.log(JSON.stringify(report));
