import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  symlinkSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { parse } from "yaml";
import JSZip from "jszip";
import { preparePackageOutput } from "../scripts/package-output.mjs";
import { packageCandidate } from "../scripts/package-candidate.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
test("candidate destinations cannot overwrite history or overlap product sources", (t) => {
  const scratch = mkdtempSync(join(tmpdir(), "hoi-output-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const root = join(scratch, "product");
  mkdirSync(root);
  assert.throws(() => preparePackageOutput(root), /PACKAGE_OUTPUT_REQUIRED/);
  assert.throws(
    () => preparePackageOutput(root, root),
    /PACKAGE_OUTPUT_EXISTS/,
  );
  assert.throws(
    () => preparePackageOutput(root, join(root, "src", "candidate")),
    /PACKAGE_OUTPUT_OVERLAP/,
  );
  assert.equal(existsSync(join(root, "src")), false);
  if (process.platform !== "win32") {
    symlinkSync(root, join(scratch, "alias"));
    assert.throws(
      () => preparePackageOutput(root, join(scratch, "alias", "nested")),
      /PACKAGE_OUTPUT_OVERLAP/,
    );
  }
  const output = preparePackageOutput(root, join(root, "release", "new"));
  assert.ok(existsSync(output));
  assert.throws(
    () => preparePackageOutput(root, output),
    /PACKAGE_OUTPUT_EXISTS/,
  );
});
test("complete candidate contains exact Hub bytes, 22 skills, reproducible hashes and no publishing workflow", async (t) => {
  const scratch = mkdtempSync(join(tmpdir(), "hoi-candidate-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const one = join(scratch, "one"),
    two = join(scratch, "two");
  const result = await packageCandidate(one);
  await packageCandidate(two);
  assert.deepEqual(
    readFileSync(join(one, "SHA256SUMS")),
    readFileSync(join(two, "SHA256SUMS")),
  );
  assert.equal(result.state, "local-unreleased-candidate");
  assert.deepEqual(result.skillCounts, {
    installer: 1,
    operational: 21,
    total: 22,
  });
  assert.equal(result.gates.publication, "not-performed");
  for (const line of readFileSync(join(one, "SHA256SUMS"), "utf8")
    .trim()
    .split("\n")) {
    const [sha, name] = line.split("  ");
    assert.equal(hash(readFileSync(join(one, name))), sha, name);
  }
  const archive = await JSZip.loadAsync(
    readFileSync(join(one, "hoi-os-hub.zip")),
  );
  const manifest = JSON.parse(
    await archive.file("HUB_PACKAGE.json").async("string"),
  );
  assert.equal(Object.keys(archive.files).length, manifest.files.length + 1);
  for (const file of manifest.files)
    assert.equal(
      hash(await archive.file(file.path).async("nodebuffer")),
      file.sha256,
      file.path,
    );
  for (const name of Object.keys(archive.files))
    assert.doesNotMatch(name, /^(node_modules|desktop|\.secrets|\.local)\//);
  assert.ok(archive.file("docs/FINAL_HANDOVER.md"));
  const start = readFileSync(join(one, "START_HERE.md"), "utf8");
  assert.match(start, /\]\(hub\/docs\/AUTOMATIONS\.md\)/);
  for (const [, name] of start.matchAll(/\]\((hub\/docs\/[^)]+\.md)\)/g))
    assert.ok(existsSync(join(one, name)), name);
  const validation = await archive
    .file("docs/AUTOMATION_VALIDATION.md")
    .async("string");
  for (const [, name] of validation.matchAll(/\]\(([A-Z_]+\.md)\)/g))
    assert.ok(archive.file("docs/" + name), name);
  await assert.rejects(packageCandidate(one), /PACKAGE_OUTPUT_EXISTS/);
  const workflow = parse(
    readFileSync(resolve(".github/workflows/release.yml"), "utf8"),
  );
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.equal(workflow.permissions.contents, "read");
  assert.equal(workflow.jobs.publish, undefined);
  assert.doesNotMatch(JSON.stringify(workflow), /gh release|contents.*write/);
});
