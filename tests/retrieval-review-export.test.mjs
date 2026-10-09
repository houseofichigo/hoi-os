import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runReviewPack } from "../scripts/run-review-pack.mjs";
import { exportRetrievalReview } from "../scripts/export-retrieval-review.mjs";
import { Store } from "../dist/core/store.js";
import { writeYaml } from "../dist/core/files.js";

test("review packet resolves exact evidence, escapes source markup and cannot claim human acceptance", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "hoi-review-export-"));
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
  pack.records[0].text +=
    ' <script>alert("fixture")</script> [unsafe](https://invalid.example)';
  const run = join(root, "run");
  await runReviewPack(pack, run, { shared: true });
  const out = join(root, "review"),
    summary = exportRetrievalReview(pack, run, out);
  assert.equal(summary.cases, 120);
  assert.equal(summary.families, 12);
  const packet = JSON.parse(readFileSync(join(out, "packet.json"), "utf8"));
  assert.equal(packet.acceptance, "not-certified");
  assert.ok(
    packet.cases.every(
      (c) =>
        c.review.status === "pending" &&
        c.review.reviewer === null &&
        c.generatedAnswer === null,
    ),
  );
  assert.ok(
    packet.cases.every((c) => c.references.every((e) => e.text.length > 0)),
  );
  const md = readFileSync(join(out, "cedar.md"), "utf8");
  assert.ok(md.includes("&lt;script&gt;"));
  assert.ok(!md.includes("<script>"));
  assert.ok(!md.includes("[unsafe](https://invalid.example)"));
  const csv = readFileSync(join(out, "review.csv"), "utf8");
  assert.equal(csv.trim().split("\n").length, 121);
  assert.throws(() => exportRetrievalReview(pack, run, out), /EEXIST/);
  const rows = JSON.parse(
    readFileSync(join(run, "scoring-input.json"), "utf8"),
  );
  const original = JSON.stringify(rows);
  rows[0].question = "Changed question";
  writeFileSync(join(run, "scoring-input.json"), JSON.stringify(rows));
  assert.throws(
    () => exportRetrievalReview(pack, run, join(root, "tampered")),
    /REVIEW_CASE_MISMATCH/,
  );
  writeFileSync(join(run, "scoring-input.json"), original);
  const s = new Store(join(run, "fixture-0"));
  try {
    writeYaml(s.path("policies/actions.yaml"), {
      ...s.policy(),
      deniedHosts: ["codex"],
    });
  } finally {
    s.close();
  }
  assert.throws(
    () => exportRetrievalReview(pack, run, join(root, "revoked")),
    /denied/,
  );
});
