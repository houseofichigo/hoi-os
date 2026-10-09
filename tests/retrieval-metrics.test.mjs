import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRetrieval } from "../scripts/retrieval-metrics.mjs";
const row = {
  id: "q1",
  family: "f1",
  split: "held-out",
  relevant: ["a", "b"],
  returned: ["a", "a", "x"],
  abstain: false,
};
test("retrieval metrics count all relevant evidence, deduplicate and never certify unreviewed labels", () => {
  const r = evaluateRetrieval([row]);
  assert.equal(r.recallAt5, 0.5);
  assert.equal(r.reviewed, 0);
  assert.equal(r.acceptance, "not-certified");
  assert.equal(r.correctAbstention, null);
  assert.ok(r.ndcgAt10 < 1);
});
test("scenario split leakage and ambiguous labels are rejected", () => {
  assert.throws(
    () => evaluateRetrieval([row, { ...row, id: "q2", split: "development" }]),
    /crosses splits/,
  );
  assert.throws(() => evaluateRetrieval([{ ...row, abstain: true }]), /cannot/);
  assert.throws(() => evaluateRetrieval([row, row]), /identity/);
});
test("abstention requires observed answer decision and leaks are counted independently of recall", () => {
  const r = evaluateRetrieval([
    { ...row, returned: ["a", "b", "secret"], forbidden: ["secret"] },
    {
      id: "q2",
      family: "f2",
      split: "held-out",
      relevant: [],
      returned: [],
      abstain: true,
      answerAbstained: false,
    },
  ]);
  assert.equal(r.recallAt5, 1);
  assert.equal(r.leakCount, 1);
  assert.equal(r.correctAbstention, 0);
});
