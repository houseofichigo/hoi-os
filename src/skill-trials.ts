/** Offline comparison only. Never executes skills, calls models, or activates a revision. */
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";
import { safePath, sha } from "./files.js";

const text = z.string().trim().min(1).max(100_000);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const file = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (s) =>
      !s.startsWith("/") &&
      !s.includes("\\") &&
      !s
        .split("/")
        .some(
          (p) =>
            !p ||
            p === "." ||
            p === ".." ||
            p.startsWith(".env") ||
            [".secrets", ".git"].includes(p),
        ) &&
      !/^[A-Za-z]:/.test(s),
    "Use a contained relative artifact path, without secrets or Git metadata",
  );
const trial = z.object({ bundle: file, answers: file, receipt: file }).strict();
const comparison = z
  .object({
    schemaVersion: z.literal(1),
    suite: file,
    environment: file,
    baseline: trial,
    candidate: trial,
  })
  .strict();
const suiteSchema = z
  .object({
    id: text,
    sources: z
      .array(z.object({ id: text, text }).strict())
      .min(1)
      .max(200),
    cases: z
      .array(
        z
          .object({
            id: text,
            split: z.enum(["development", "held-out"]),
            standard: text,
            required: z.array(text).min(1).max(30),
            forbidden: z.array(text).max(30),
            sourceIds: z.array(text).max(20),
          })
          .strict(),
      )
      .min(2)
      .max(200),
  })
  .strict();
const environmentSchema = z
  .object({
    host: text,
    model: text,
    engineVersion: text,
    toolContract: text,
    policy: text,
    instructionVersion: text,
  })
  .strict();
const answersSchema = z
  .array(
    z
      .object({
        caseId: text,
        text,
        citations: z
          .array(z.object({ sourceId: text, quote: text }).strict())
          .max(30),
      })
      .strict(),
  )
  .min(1)
  .max(200);
const receiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: text,
    status: z.enum(["completed", "failed", "uncertain"]),
    contextFingerprint: digest,
    bundleFingerprint: digest,
    answersChecksum: digest,
  })
  .strict();

function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length) throw Error("TRIAL_DUPLICATE_ID");
}
function read(root: string, path: string) {
  file.parse(path);
  const target = safePath(root, path),
    stat = lstatSync(target);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024)
    throw Error("TRIAL_FILE_LIMIT");
  return readFileSync(target, "utf8");
}
export function bundleFingerprint(root: string, path: string) {
  file.parse(path);
  const folder = safePath(root, path);
  if (!lstatSync(folder).isDirectory())
    throw Error("TRIAL_BUNDLE_DIRECTORY_REQUIRED");
  const entries: { path: string; checksum: string }[] = [];
  let bytes = 0,
    visited = 0;
  function visit(dir: string, depth = 0) {
    if (depth > 12) throw Error("TRIAL_BUNDLE_DEPTH");
    for (const name of readdirSync(dir).sort()) {
      if (++visited > 256) throw Error("TRIAL_BUNDLE_ENTRY_LIMIT");
      const target = join(dir, name),
        rel = relative(root, target).replaceAll("\\", "/");
      file.parse(rel);
      safePath(root, rel);
      const stat = lstatSync(target);
      if (stat.isDirectory()) visit(target, depth + 1);
      else {
        if (!stat.isFile()) throw Error("TRIAL_UNSUPPORTED_FILE");
        bytes += stat.size;
        if (entries.length >= 128 || bytes > 8 * 1024 * 1024)
          throw Error("TRIAL_BUNDLE_LIMIT");
        entries.push({
          path: relative(folder, target).replaceAll("\\", "/"),
          checksum: sha(readFileSync(target)),
        });
      }
    }
  }
  visit(folder);
  if (!entries.length) throw Error("TRIAL_EMPTY_BUNDLE");
  return {
    fingerprint: sha(JSON.stringify(entries)),
    files: entries.length,
    bytes,
  };
}
export function trialContext(
  root: string,
  suitePath: string,
  environmentPath: string,
) {
  const suiteBytes = read(root, suitePath),
    environmentBytes = read(root, environmentPath);
  const suite = suiteSchema.parse(JSON.parse(suiteBytes));
  const environment = environmentSchema.parse(JSON.parse(environmentBytes));
  unique(suite.cases.map((c) => c.id));
  unique(suite.sources.map((s) => s.id));
  if (new Set(suite.cases.map((c) => c.split)).size !== 2)
    throw Error("TRIAL_HELD_OUT_REQUIRED");
  for (const c of suite.cases) {
    unique(c.sourceIds);
    if (c.sourceIds.some((id) => !suite.sources.some((s) => s.id === id)))
      throw Error("TRIAL_UNKNOWN_SOURCE");
  }
  return {
    suite,
    environment,
    fingerprint: sha(
      JSON.stringify({
        version: 1,
        suite: sha(suiteBytes),
        environment: sha(environmentBytes),
      }),
    ),
  };
}
export function compareSkillTrials(root: string, input: unknown) {
  const spec = comparison.parse(input);
  const context = trialContext(root, spec.suite, spec.environment);
  const results = [spec.baseline, spec.candidate].map((trial) => {
    const bundle = bundleFingerprint(root, trial.bundle);
    const raw = read(root, trial.answers),
      answers = answersSchema.parse(JSON.parse(raw));
    const receipt = receiptSchema.parse(JSON.parse(read(root, trial.receipt)));
    if (
      receipt.contextFingerprint !== context.fingerprint ||
      receipt.bundleFingerprint !== bundle.fingerprint ||
      receipt.answersChecksum !== sha(raw)
    )
      throw Error(
        "TRIAL_CHANGED_ARTIFACTS: start a new run; never reuse results after edits",
      );
    unique(answers.map((a) => a.caseId));
    if (
      answers.some((a) => !context.suite.cases.some((c) => c.id === a.caseId))
    )
      throw Error("TRIAL_UNKNOWN_CASE");
    const cases = context.suite.cases.map((c) => {
      const answer = answers.find((a) => a.caseId === c.id);
      const failures: string[] = [];
      if (!answer) failures.push("missing-answer");
      else {
        if (c.required.some((v) => !answer.text.includes(v)))
          failures.push("missing-required-text");
        if (c.forbidden.some((v) => answer.text.includes(v)))
          failures.push("forbidden-text");
        if (
          c.sourceIds.some(
            (id) => !answer.citations.some((r) => r.sourceId === id),
          )
        )
          failures.push("missing-citation");
        if (
          answer.citations.some(
            (r) =>
              !context.suite.sources.some(
                (s) => s.id === r.sourceId && s.text.includes(r.quote),
              ),
          )
        )
          failures.push("unresolved-citation");
      }
      return {
        id: c.id,
        split: c.split,
        pass: receipt.status === "completed" && !failures.length,
        failures,
      };
    });
    return { runId: receipt.runId, status: receipt.status, bundle, cases };
  });
  const [baseline, candidate] = results;
  if (baseline.runId === candidate.runId)
    throw Error("TRIAL_DISTINCT_RUNS_REQUIRED");
  const regressions = candidate.cases
    .filter((c, i) => baseline.cases[i].pass && !c.pass)
    .map((c) => c.id);
  return {
    schemaVersion: 1,
    contextFingerprint: context.fingerprint,
    baseline,
    candidate,
    regressions,
    decision: results.some((r) => r.status !== "completed")
      ? "inconclusive"
      : candidate.cases.every((c) => c.pass) && !regressions.length
        ? "needs-human-review"
        : "changes-required",
    activationAllowed: false,
    verification: {
      mechanicalChecks: "performed",
      factualSupport: "requires-independent-review",
      executionIdentity: "declared-in-receipt-not-host-attested",
      externalActions: "not-tested",
      heldOutIsolation: "requires-independent-runner",
    },
  };
}
