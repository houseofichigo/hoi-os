import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readiness } from "../scripts/pilot-readiness.mjs";
const empty = () =>
  JSON.parse(
    readFileSync(
      new URL("../examples/pilot/record.json", import.meta.url),
      "utf8",
    ),
  );
function complete() {
  const v = empty();
  v.heldOut = true;
  v.extraction = {
    labeled: 100,
    proposals: { total: 100, correct: 95 },
    explicitCommitments: { total: 100, correct: 90 },
  };
  v.duplicates = {
    labeled: 50,
    candidates: { total: 50, correct: 48 },
    incorrectAutomaticMerges: 0,
  };
  v.retrieval = {
    labeled: 30,
    answerable: { total: 20, correct: 18 },
    unanswerable: { total: 10, correct: 10 },
  };
  v.meetings = Array.from({ length: 5 }, (_, i) => ({
    id: "fictional-" + i,
    claims: { total: 20, correct: 19 },
    inventedCommitments: 0,
    manualMinutes: 30,
    assistedMinutes: 15,
  }));
  v.days = ["07", "08", "09", "10", "11", "14", "15", "16", "17", "18"].map(
    (d) => ({ date: "2026-09-" + d, criticalDefects: 0 }),
  );
  for (const k in v.checks) v.checks[k] = true;
  return v;
}
test("empty pilot fails, no missing denominators treated as success", () => {
  const r = readiness(empty());
  assert.equal(r.readyForReleaseReview, false);
  assert.equal(r.metrics.retrievalRecallAt5, null);
});
test("measured thresholds pass only with every gate; failures block", () => {
  assert.equal(readiness(complete()).readyForReleaseReview, true);
  for (const mutate of [
    (v) => (v.checks.calendarAdapterVerified = false),
    (v) => (v.duplicates.incorrectAutomaticMerges = 1),
    (v) => (v.meetings[0].inventedCommitments = 1),
    (v) => (v.days[0].criticalDefects = 1),
    (v) => (v.retrieval.answerable.correct = 17),
    (v) => v.meetings.forEach((m) => (m.assistedMinutes = 16)),
  ]) {
    const v = complete();
    mutate(v);
    assert.equal(readiness(v).readyForReleaseReview, false);
  }
});
test("reject duplicate days, impossible counts and future records; output excludes meeting identifiers", () => {
  let v = complete();
  v.days.push(v.days[0]);
  assert.throws(() => readiness(v));
  v = complete();
  v.extraction.proposals.correct = 101;
  assert.throws(() => readiness(v));
  assert.throws(() => readiness(complete(), "2026-09-01"));
  assert.ok(!JSON.stringify(readiness(complete())).includes("fictional-"));
});
