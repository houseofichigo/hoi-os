import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareAnswerEvaluation,
  scoreAnswers,
  fingerprint,
} from "../scripts/answer-evaluation.mjs";
const ref = { kind: "source", revisionId: "r1", passageId: "p1" };
const packet = {
  version: 1,
  cases: [
    { id: "one", split: "held-out", references: [{ reference: ref, rank: 1 }] },
  ],
};
function fixture() {
  const submission = prepareAnswerEvaluation(packet);
  const answer = {
    text: "Delivery is Friday.",
    provider: "fixture",
    model: "fixture",
    buildId: "test",
    instructionVersion: "v1",
    at: "2026-10-09T10:00:00Z",
    costUsd: 0,
    abstained: false,
    supplied: [ref],
    citations: [ref],
  };
  const review = {
    answerHash: fingerprint(answer),
    reviewer: "Fictional test reviewer",
    at: "2026-10-09T11:00:00Z",
    completeClaimAccounting: true,
    expectedAbstain: false,
    claims: [
      {
        id: "c1",
        start: 0,
        end: answer.text.length,
        text: answer.text,
        verdict: "supported",
        reason: "Test fixture evidence.",
        evidence: [ref],
      },
    ],
    citationChecks: [
      {
        reference: ref,
        status: "resolved",
        at: "2026-10-09T10:30:00Z",
        buildId: "test",
        identity: "fixture",
      },
    ],
  };
  submission.cases[0] = { id: "one", answer, review };
  return submission;
}
test("pending answer cases remain unmeasured, and complete fixture reviews never certify", () => {
  const empty = scoreAnswers(packet, prepareAnswerEvaluation(packet));
  assert.equal(empty.heldOut.factualSupport, null);
  assert.equal(empty.heldOut.complete, false);
  const scored = scoreAnswers(packet, fixture());
  assert.equal(scored.heldOut.factualSupport, 1);
  assert.equal(scored.acceptance, "not-certified");
});
test("answer review binds packet and answer, rejects invented or unsupplied citations", () => {
  for (const mutate of [
    (s) => (s.packetHash = "changed"),
    (s) => (s.cases[0].answer.text += "Changed."),
    (s) => (s.cases[0].answer.supplied = []),
    (s) => (s.cases[0].answer.citations = [{ ...ref, passageId: "invented" }]),
    (s) => s.cases.push(s.cases[0]),
    (s) => (s.cases[0].review.citationChecks = []),
  ]) {
    const s = fixture();
    mutate(s);
    assert.throws(() => scoreAnswers(packet, s));
  }
});
test("uncertain claims and unresolved citations are failures, abstention uses observed answer", () => {
  const s = fixture();
  s.cases[0].review.claims[0].verdict = "uncertain";
  s.cases[0].review.citationChecks[0].status = "denied";
  s.cases[0].review.expectedAbstain = true;
  const r = scoreAnswers(packet, s);
  assert.equal(r.heldOut.factualSupport, 0);
  assert.equal(r.heldOut.citationResolution, 0);
  assert.equal(r.heldOut.correctAbstention, 0);
});
test("incomplete accounting, missing provenance and evidence absent from retrieval fail closed", () => {
  for (const mutate of [
    (s) => (s.cases[0].review.completeClaimAccounting = false),
    (s) => (s.cases[0].review.reviewer = " "),
    (s) => (s.cases[0].review.claims[0].start = 1),
    (s) => (s.cases[0].review.claims[0].evidence = []),
    (s) => (s.cases[0].review.citationChecks[0].at = "2025-01-01"),
  ]) {
    const s = fixture();
    mutate(s);
    assert.throws(() => scoreAnswers(packet, s));
  }
  const p = structuredClone(packet);
  p.cases[0].references[0].rank = null;
  const s = fixture();
  s.packetHash = fingerprint(p);
  assert.throws(() => scoreAnswers(p, s), /not retrieved/);
});

test("ranking diagnostics retain missing and outside-top-five evidence without changing labels", async () => {
  const { diagnoseRanking } =
    await import("../scripts/diagnose-review-ranking.mjs");
  const p = structuredClone(packet);
  p.cases[0].proposedAbstain = false;
  p.cases[0].references[0].proposedRelevant = true;
  p.cases[0].references[0].rank = 7;
  const before = JSON.stringify(p);
  const result = diagnoseRanking(p);
  assert.equal(result.cases[0].topFive, 0);
  assert.equal(result.cases[0].missed[0].rank, 7);
  assert.equal(JSON.stringify(p), before);
});
