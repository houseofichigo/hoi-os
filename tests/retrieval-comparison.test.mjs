import test from "node:test";
import assert from "node:assert/strict";
import { compareRetrieval } from "../scripts/compare-retrieval.mjs";
const a = {
    id: "a",
    family: "a",
    split: "held-out",
    question: "a?",
    relevant: ["a"],
    returned: [],
    abstain: false,
  },
  n = {
    id: "n",
    family: "n",
    split: "held-out",
    question: "n?",
    relevant: [],
    returned: [],
    abstain: true,
  };
test("comparison isolates gains without equating retrieved content with answerability", () => {
  const r = compareRetrieval(
    [a, n],
    [
      { ...a, returned: ["a"] },
      { ...n, returned: ["noise"] },
    ],
  );
  assert.deepEqual(r.improved, ["a"]);
  assert.equal(r.unanswerableCasesReturningEvidence.candidate, 1);
  assert.equal(r.acceptance, "not-certified");
});
test("comparison rejects changed labels and records regressions", () => {
  assert.throws(
    () => compareRetrieval([a], [{ ...a, relevant: ["b"] }]),
    /differ/,
  );
  assert.deepEqual(
    compareRetrieval([{ ...a, returned: ["a"] }], [a]).regressed,
    ["a"],
  );
});
