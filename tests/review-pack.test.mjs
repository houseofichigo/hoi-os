import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateReviewPack } from "../scripts/validate-review-pack.mjs";
const raw = readFileSync(
    new URL(
      "../evaluation/knowledge-v1/candidates/review-pack.json",
      import.meta.url,
    ),
    "utf8",
  ),
  pack = JSON.parse(raw);
test("fictional draft review pack has fixed splits, resolvable logical labels and recorded checksum", () => {
  assert.equal(validateReviewPack(pack).cases, 120);
  assert.equal(validateReviewPack(pack).humanApproved, 0);
  const manifest = JSON.parse(
    readFileSync(
      new URL(
        "../evaluation/knowledge-v1/candidates/manifest.json",
        import.meta.url,
      ),
    ),
  );
  assert.equal(createHash("sha256").update(raw).digest("hex"), manifest.sha256);
});
test("draft validation rejects fake review approval, split leakage and missing evidence", () => {
  let p = structuredClone(pack);
  p.cases[0].review.status = "approved";
  assert.throws(() => validateReviewPack(p), /approval/);
  p = structuredClone(pack);
  p.cases[0].split = "held-out";
  assert.throws(() => validateReviewPack(p), /crosses/);
  p = structuredClone(pack);
  p.cases[0].proposedRelevant = ["missing"];
  assert.throws(() => validateReviewPack(p), /reference/);
});
