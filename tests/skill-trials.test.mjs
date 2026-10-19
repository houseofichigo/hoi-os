import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sha } from "../dist/core/files.js";
import {
  bundleFingerprint,
  trialContext,
  compareSkillTrials,
} from "../dist/core/skill-trials.js";
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "hoi-skill-trial-"));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const save = (p, v) => writeFileSync(join(root, p), JSON.stringify(v));
  const suite = {
    id: "fictional-prep-v1",
    sources: [
      {
        id: "source-one",
        text: "Preparation needs two days. Contact is Morgan.",
      },
    ],
    cases: [
      {
        id: "prep",
        split: "development",
        standard: "Mention the confirmed preparation duration.",
        required: ["two days"],
        forbidden: ["three days"],
        sourceIds: ["source-one"],
      },
      {
        id: "contact",
        split: "held-out",
        standard: "Identify the recorded contact without guessing.",
        required: ["Morgan"],
        forbidden: ["Taylor"],
        sourceIds: ["source-one"],
      },
    ],
  };
  save("suite.json", suite);
  const env = {
    host: "fixture-1",
    model: "deterministic-fixture",
    engineVersion: "19-fixture",
    toolContract: "read-only v1",
    policy: "no outward actions",
    instructionVersion: "1",
  };
  save("environment.json", env);
  const spec = {
    schemaVersion: 1,
    suite: "suite.json",
    environment: "environment.json",
  };
  const answers = [
    {
      caseId: "prep",
      text: "Allow two days.",
      citations: [
        { sourceId: "source-one", quote: "Preparation needs two days." },
      ],
    },
    {
      caseId: "contact",
      text: "Morgan",
      citations: [{ sourceId: "source-one", quote: "Contact is Morgan." }],
    },
  ];
  for (const name of ["baseline", "candidate"]) {
    mkdirSync(join(root, name));
    writeFileSync(
      join(root, name, "SKILL.md"),
      `Fictional ${name} instructions`,
    );
    writeFileSync(join(root, name, "helper.js"), "// helper v1");
    writeFileSync(join(root, name, "reference.txt"), "reference v1");
    save(`${name}-answers.json`, answers);
    spec[name] = {
      bundle: name,
      answers: `${name}-answers.json`,
      receipt: `${name}-receipt.json`,
    };
  }
  function receipt(name, status = "completed") {
    save(`${name}-receipt.json`, {
      schemaVersion: 1,
      runId: name,
      status,
      contextFingerprint: trialContext(root, spec.suite, spec.environment)
        .fingerprint,
      bundleFingerprint: bundleFingerprint(root, name).fingerprint,
      answersChecksum: sha(readFileSync(join(root, `${name}-answers.json`))),
    });
  }
  receipt("baseline");
  receipt("candidate");
  return { root, spec, save, suite, env, answers, receipt };
}
test("comparisons never activate a skill or claim factual/external verification", (t) => {
  const f = fixture(t),
    r = compareSkillTrials(f.root, f.spec);
  assert.equal(r.decision, "needs-human-review");
  assert.equal(r.activationAllowed, false);
  assert.equal(r.verification.factualSupport, "requires-independent-review");
  assert.equal(r.verification.externalActions, "not-tested");
});
test("empty standards/checks and a missing held-out partition fail closed", (t) => {
  const f = fixture(t);
  f.suite.cases[0].required = [];
  f.save("suite.json", f.suite);
  assert.throws(() => compareSkillTrials(f.root, f.spec));
  f.suite.cases[0].required = ["two days"];
  f.suite.cases[0].standard = " ";
  f.save("suite.json", f.suite);
  assert.throws(() => compareSkillTrials(f.root, f.spec));
  f.suite.cases[0].standard = "Duration";
  f.suite.cases[1].split = "development";
  f.save("suite.json", f.suite);
  assert.throws(() => compareSkillTrials(f.root, f.spec), /HELD_OUT/);
});
test("changed helper scripts, text assets, keys, environment and answers invalidate receipts", (t) => {
  const f = fixture(t);
  for (const path of [
    "candidate/helper.js",
    "candidate/reference.txt",
    "suite.json",
    "environment.json",
    "candidate-answers.json",
  ]) {
    const p = join(f.root, path),
      before = readFileSync(p);
    writeFileSync(p, Buffer.concat([before, Buffer.from("\n")]));
    assert.throws(
      () => compareSkillTrials(f.root, f.spec),
      /CHANGED_ARTIFACTS/,
    );
    writeFileSync(p, before);
  }
});
test("unknown citations, fabricated quotes and missing answers cannot pass", (t) => {
  const f = fixture(t);
  for (const citation of [
    { sourceId: "memory-does-not-exist", quote: "two days" },
    { sourceId: "source-one", quote: "Invented quote" },
  ]) {
    f.answers[0].citations = [citation];
    f.save("candidate-answers.json", f.answers);
    f.receipt("candidate");
    const r = compareSkillTrials(f.root, f.spec);
    assert.equal(r.decision, "changes-required");
    assert.ok(r.regressions.includes("prep"));
  }
  f.save("candidate-answers.json", [f.answers[1]]);
  f.receipt("candidate");
  assert.ok(
    compareSkillTrials(f.root, f.spec).candidate.cases[0].failures.includes(
      "missing-answer",
    ),
  );
});
test("uncertain executions remain inconclusive; duplicated runs are rejected", (t) => {
  const f = fixture(t);
  f.receipt("candidate", "uncertain");
  assert.equal(compareSkillTrials(f.root, f.spec).decision, "inconclusive");
  f.receipt("candidate");
  const p = join(f.root, "candidate-receipt.json");
  const r = JSON.parse(readFileSync(p));
  r.runId = "baseline";
  f.save("candidate-receipt.json", r);
  assert.throws(() => compareSkillTrials(f.root, f.spec), /DISTINCT_RUNS/);
});
test("path escapes and symlinked or secret bundle files are rejected", (t) => {
  const f = fixture(t);
  assert.throws(() =>
    compareSkillTrials(f.root, { ...f.spec, suite: "../suite.json" }),
  );
  symlinkSync(
    join(f.root, "suite.json"),
    join(f.root, "candidate", "linked.json"),
  );
  assert.throws(() => bundleFingerprint(f.root, "candidate"), /Symlink/);
  rmSync(join(f.root, "candidate", "linked.json"));
  writeFileSync(join(f.root, "candidate", ".env"), "not a real credential");
  assert.throws(() => bundleFingerprint(f.root, "candidate"));
});
