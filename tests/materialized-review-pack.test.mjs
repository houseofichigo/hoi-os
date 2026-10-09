import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runReviewPack } from "../scripts/run-review-pack.mjs";
test("candidate fixtures resolve real revisions, enforce denied/archive access, and remain unreviewed", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "hoi-review-run-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pack = JSON.parse(
    readFileSync(
      new URL(
        "../evaluation/knowledge-v1/candidates/review-pack.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const r = await runReviewPack(pack, join(root, "run"));
  assert.equal(r.metrics.cases, 120);
  assert.equal(r.fixtures.length, 12);
  assert.equal(r.metrics.leakCount, 0);
  assert.equal(r.humanApproved, 0);
  assert.equal(r.metrics.correctAbstention, null);
  assert.equal(r.acceptance, "not-certified");
  assert.ok(r.fixtures.every((f) => f.referencesResolved > 0));
  const rows = JSON.parse(readFileSync(join(root, "run/scoring-input.json")));
  assert.ok(
    rows
      .find((r) => r.id === "birch-02-en")
      .relevant.every((x) => JSON.parse(x).asOf === "2026-01-10"),
  );
  await assert.rejects(() => runReviewPack(pack, join(root, "run")), /EEXIST/);
});

test("shared fixture exposes cross-subject competition without weakening source permissions", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "hoi-shared-review-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pack = JSON.parse(
    readFileSync(
      new URL(
        "../evaluation/knowledge-v1/candidates/review-pack.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const r = await runReviewPack(pack, join(root, "run"), {
    shared: true,
    distractors: 20,
  });
  assert.equal(r.fixtures.length, 1);
  assert.equal(r.layout, "shared-with-explicit-subject");
  assert.equal(r.measurements[0].distractors, 20);
  assert.ok(r.measurements[0].eligibleUnits > 20);
  assert.equal(r.metrics.leakCount, 0);
  assert.equal(r.metrics.cases, 120);
  const rows = JSON.parse(readFileSync(join(root, "run/scoring-input.json")));
  assert.ok(
    rows.every((x) => x.question.startsWith("Subject " + x.family + ".")),
  );
  assert.ok(rows.every((x) => x.forbidden.length >= 2));
});
