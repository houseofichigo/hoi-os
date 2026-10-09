import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const refKey = (ref) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(ref).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
const requireThat = (condition, message) => {
  if (!condition) throw Error(message);
};
const text = (s) => typeof s === "string" && s.trim().length > 0;
const date = (s) => text(s) && Number.isFinite(Date.parse(s));
const ratio = (n, d) => (d ? n / d : null);

export function prepareAnswerEvaluation(packet) {
  requireThat(
    packet.version === 1 &&
      Array.isArray(packet.cases) &&
      packet.cases.length > 0,
    "Invalid evidence packet",
  );
  requireThat(
    new Set(packet.cases.map((c) => c.id)).size === packet.cases.length,
    "Duplicate cases",
  );
  return {
    version: 1,
    packetHash: fingerprint(packet),
    acceptance: "not-certified",
    cases: packet.cases.map((c) => ({ id: c.id, answer: null, review: null })),
  };
}

// Reviews are attestations supplied by an independent reviewer, never generated approvals.
// This offline scorer cannot authenticate people or replace live permission checks.
export function scoreAnswers(packet, submission) {
  const template = prepareAnswerEvaluation(packet);
  requireThat(
    submission.version === 1 && submission.packetHash === template.packetHash,
    "Evidence packet changed",
  );
  requireThat(
    Array.isArray(submission.cases) &&
      submission.cases.length === template.cases.length &&
      new Set(submission.cases.map((c) => c.id)).size === template.cases.length,
    "Missing or duplicate cases",
  );
  const submitted = new Map(submission.cases.map((c) => [c.id, c]));
  const rows = packet.cases.map((c) => {
    const entry = submitted.get(c.id);
    requireThat(entry, "Unknown or missing case");
    const { answer, review } = entry;
    const base = {
      id: c.id,
      split: c.split,
      generated: false,
      reviewed: false,
      claims: 0,
      supported: 0,
      citations: 0,
      resolved: 0,
      abstentionCorrect: null,
    };
    if (answer === null) {
      requireThat(review === null, "Review without answer");
      return base;
    }
    requireThat(
      answer &&
        text(answer.text) &&
        text(answer.provider) &&
        text(answer.model) &&
        text(answer.buildId) &&
        text(answer.instructionVersion) &&
        date(answer.at),
      "Incomplete answer provenance",
    );
    requireThat(
      Number.isFinite(answer.costUsd) &&
        answer.costUsd >= 0 &&
        typeof answer.abstained === "boolean",
      "Invalid answer usage or abstention",
    );
    requireThat(
      Array.isArray(answer.supplied) && Array.isArray(answer.citations),
      "Exact supplied and cited references required",
    );
    const available = new Set(
      c.references
        .filter((r) => Number.isInteger(r.rank) && r.rank > 0)
        .map((r) => refKey(r.reference)),
    );
    const supplied = new Set(answer.supplied.map(refKey));
    requireThat(
      supplied.size === answer.supplied.length &&
        [...supplied].every((k) => available.has(k)),
      "Evidence was not retrieved in this packet",
    );
    const citations = new Set(answer.citations.map(refKey));
    requireThat(
      citations.size === answer.citations.length &&
        [...citations].every((k) => supplied.has(k)),
      "Citation not supplied to answer",
    );
    base.generated = true;
    base.citations = citations.size;
    if (review === null) return base;
    requireThat(
      review && review.answerHash === fingerprint(answer),
      "Answer changed after review",
    );
    requireThat(
      text(review.reviewer) &&
        date(review.at) &&
        Date.parse(review.at) >= Date.parse(answer.at),
      "Reviewer identity and valid time required",
    );
    requireThat(
      review.completeClaimAccounting === true &&
        typeof review.expectedAbstain === "boolean" &&
        Array.isArray(review.claims) &&
        Array.isArray(review.citationChecks),
      "Incomplete human review",
    );
    const claimIds = new Set();
    for (const claim of review.claims) {
      requireThat(
        text(claim.id) && !claimIds.has(claim.id),
        "Duplicate or missing claim identity",
      );
      claimIds.add(claim.id);
      requireThat(
        Number.isInteger(claim.start) &&
          Number.isInteger(claim.end) &&
          claim.start >= 0 &&
          claim.end > claim.start &&
          claim.end <= answer.text.length &&
          answer.text.slice(claim.start, claim.end) === claim.text,
        "Claim must identify exact answer text",
      );
      requireThat(
        ["supported", "unsupported", "uncertain"].includes(claim.verdict) &&
          text(claim.reason) &&
          Array.isArray(claim.evidence),
        "Claim verdict and reason required",
      );
      requireThat(
        claim.evidence.every((ref) => supplied.has(refKey(ref))),
        "Claim evidence not supplied",
      );
      requireThat(
        claim.verdict !== "supported" || claim.evidence.length > 0,
        "Supported claim requires evidence",
      );
    }
    const checked = new Set();
    for (const check of review.citationChecks) {
      const key = refKey(check.reference);
      requireThat(
        citations.has(key) && !checked.has(key),
        "Unexpected or duplicate citation check",
      );
      checked.add(key);
      requireThat(
        ["resolved", "denied", "missing", "changed"].includes(check.status) &&
          date(check.at) &&
          text(check.buildId) &&
          text(check.identity),
        "Citation resolution provenance required",
      );
      requireThat(
        Date.parse(check.at) >= Date.parse(answer.at) &&
          Date.parse(check.at) <= Date.parse(review.at),
        "Invalid citation check time",
      );
    }
    requireThat(
      checked.size === citations.size,
      "Every citation needs a resolution check",
    );
    return {
      ...base,
      reviewed: true,
      claims: review.claims.length,
      supported: review.claims.filter((x) => x.verdict === "supported").length,
      resolved: review.citationChecks.filter((x) => x.status === "resolved")
        .length,
      abstentionCorrect: review.expectedAbstain ? answer.abstained : null,
    };
  });
  const held = rows.filter((r) => r.split === "held-out");
  const reviewed = held.filter((r) => r.reviewed);
  const sum = (key) => reviewed.reduce((n, r) => n + r[key], 0);
  const abstentions = reviewed.filter((r) => r.abstentionCorrect !== null);
  return {
    version: 1,
    packetHash: submission.packetHash,
    submissionHash: fingerprint(submission),
    acceptance: "not-certified",
    cases: rows.length,
    generated: rows.filter((r) => r.generated).length,
    reviewed: rows.filter((r) => r.reviewed).length,
    heldOut: {
      total: held.length,
      reviewed: reviewed.length,
      complete: held.length > 0 && held.every((r) => r.reviewed),
      factualSupport: ratio(sum("supported"), sum("claims")),
      supportedClaims: sum("supported"),
      totalClaims: sum("claims"),
      citationResolution: ratio(sum("resolved"), sum("citations")),
      resolvedCitations: sum("resolved"),
      totalCitations: sum("citations"),
      correctAbstention: ratio(
        abstentions.filter((r) => r.abstentionCorrect).length,
        abstentions.length,
      ),
      missingAnswerCasesReviewed: abstentions.length,
    },
    limitations: [
      "Offline reviewer attestations are not authenticated or fresh engine permission checks.",
      "Existing candidate families are exposed and unsealed; these metrics cannot certify held-out acceptance.",
      "Missing reviews and zero denominators remain unmeasured. Unsupported and uncertain claims both count against factual support.",
    ],
    rows,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [mode, packetPath, inputOrOutput, output] = process.argv.slice(2);
  requireThat(
    ["prepare", "score"].includes(mode) &&
      packetPath &&
      inputOrOutput &&
      (mode !== "score" || output),
    "Usage: answer-evaluation.mjs prepare packet.json new-submission.json | score packet.json submission.json new-report.json",
  );
  const packet = JSON.parse(readFileSync(packetPath, "utf8"));
  const result =
    mode === "prepare"
      ? prepareAnswerEvaluation(packet)
      : scoreAnswers(packet, JSON.parse(readFileSync(inputOrOutput, "utf8")));
  writeFileSync(
    mode === "prepare" ? inputOrOutput : output,
    JSON.stringify(result, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      acceptance: result.acceptance,
      cases: result.cases.length ?? result.cases,
      generated: result.generated,
      reviewed: result.reviewed,
    }),
  );
}
