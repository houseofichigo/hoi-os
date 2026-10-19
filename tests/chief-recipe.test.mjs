import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runChiefRecipe,
  verifyRecipeArtifacts,
} from "../scripts/chief-recipe.mjs";
import { Store } from "../dist/core/store.js";
import { listProposals, listTasks } from "../dist/core/tasks.js";
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const fixture = (t) => {
  const root = mkdtempSync(join(tmpdir(), "hoi-chief-recipe-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return join(root, "run");
};

test("fictional recipe produces current evidence, keeps unknowns and pending work, and restores separately", async (t) => {
  const out = fixture(t);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("Unexpected provider/network call");
  };
  t.after(() => {
    globalThis.fetch = oldFetch;
  });
  const { report } = await runChiefRecipe(out);
  assert.equal(report.status, "engine-checks-passed");
  assert.equal(report.externalSpendUsd, 0);
  assert.equal(report.activationAllowed, false);
  assert.equal(report.verification.humanReview, "pending");
  assert.equal(
    report.verification.heldOutIsolation,
    "not-established-public-fixtures",
  );
  for (const id of ["cedar", "willow"]) {
    const result = read(join(out, id, "output.json"));
    const input = read(join(out, id, "transcript-input.json"));
    assert.equal(result.proposal.evidence[0].quote, input.segments[0].text);
    assert.equal(result.proposal.state, "proposed");
    assert.ok(result.knowledge.evidence.some((e) => e.kind === "memory"));
    assert.ok(result.knowledge.evidence.some((e) => e.kind === "wiki"));
    assert.ok(result.knowledge.evidence.some((e) => e.kind === "source"));
    assert.ok(!JSON.stringify(result).includes("RECIPE_RESTRICTED_SENTINEL"));
    assert.equal(
      result.daily.priorities[0].dueDate,
      id === "cedar" ? "2026-10-18" : "2026-10-19",
    );
    for (const suffix of ["workspace", "restored"]) {
      const s = new Store(join(out, id, suffix));
      try {
        // Restored copy tests revocation; the review workspace remains available.
        assert.equal(listTasks(s, "codex").length, 3);
        assert.equal(
          listProposals(s, "codex").filter((p) => p.state === "proposed")
            .length,
          suffix === "workspace" ? 1 : 0,
        );
      } finally {
        s.close();
      }
    }
    if (id === "willow") {
      assert.equal(result.proposal.task.dueDate, null);
      assert.equal(result.proposal.task.projectId, null);
    }
  }
  assert.equal(verifyRecipeArtifacts(out).executionAttestation, false);
  await assert.rejects(() => runChiefRecipe(out), /EEXIST/);
  const link = join(out, "..", "alias");
  symlinkSync(out, link, "dir");
  await assert.rejects(() => runChiefRecipe(link), /EEXIST/);
  if (process.platform !== "win32")
    assert.equal(statSync(out).mode & 0o777, 0o700);
});

test("explicit fixture review is idempotent, retained after restart, and never called human approval", async (t) => {
  const out = fixture(t);
  const { report } = await runChiefRecipe(out, { simulateReview: true });
  assert.equal(report.status, "engine-checks-passed");
  for (const c of report.cases) {
    assert.equal(c.reviewSimulation.humanReview, false);
    assert.equal(c.humanReview, "pending");
    const s = new Store(join(out, c.id, "workspace"));
    try {
      assert.equal(listTasks(s, "local").length, 4);
      const p = listProposals(s, "local").find(
        (p) => p.id === c.reviewSimulation.proposalId,
      );
      assert.equal(p.taskId, c.reviewSimulation.taskId);
      assert.equal(p.state, "approved");
    } finally {
      s.close();
    }
  }
});

test("artifact verification detects edits, duplicate references, traversal and symlink substitution", async (t) => {
  const out = fixture(t);
  await runChiefRecipe(out);
  const brief = join(out, "cedar/brief.md"),
    original = readFileSync(brief);
  writeFileSync(brief, "Changed answer");
  assert.throws(() => verifyRecipeArtifacts(out), /RECIPE_CHANGED_ARTIFACT/);
  writeFileSync(brief, original);
  const manifest = join(out, "report.json"),
    bytes = readFileSync(manifest),
    report = JSON.parse(bytes);
  report.artifacts[0].path = "../private.md";
  writeFileSync(manifest, JSON.stringify(report));
  assert.throws(
    () => verifyRecipeArtifacts(out),
    /RECIPE_INVALID_ARTIFACT_PATH/,
  );
  report.artifacts[0] = report.artifacts[1];
  writeFileSync(manifest, JSON.stringify(report));
  assert.throws(() => verifyRecipeArtifacts(out), /RECIPE_INVALID_REPORT/);
  writeFileSync(manifest, bytes);
  const external = join(out, "..", "external.md");
  writeFileSync(external, original);
  unlinkSync(brief);
  symlinkSync(external, brief);
  assert.throws(() => verifyRecipeArtifacts(out), /Symlink/);
});
