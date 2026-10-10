import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { prepareKit } from "../scripts/prepare-clean-mac-kit.mjs";
test("clean Mac kit binds an exact artifact and cannot overwrite operator observations", (t) => {
  const root = mkdtempSync(join(tmpdir(), "hoi-kit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const src = join(root, "candidate"),
    out = join(root, "kit");
  mkdirSync(src);
  writeFileSync(
    join(src, "BUILD.json"),
    JSON.stringify({
      platform: "darwin",
      arch: "arm64",
      buildId: "a".repeat(64),
    }),
  );
  writeFileSync(join(src, "fixture.zip"), "fictional package bytes");
  const hash = createHash("sha256")
    .update("fictional package bytes")
    .digest("hex");
  writeFileSync(join(src, "SHA256SUMS"), hash + "  fixture.zip\n");
  assert.equal(prepareKit(src, out).artifactSha256, hash);
  const report = JSON.parse(
    readFileSync(join(out, "OPERATOR_RESULTS.json"), "utf8"),
  );
  assert.ok(report.results.every((r) => r.status === "not-tested"));
  assert.equal(report.acceptance, "not-certified");
  writeFileSync(join(out, "OPERATOR_RESULTS.json"), "operator content");
  assert.throws(() => prepareKit(src, out));
  assert.equal(
    readFileSync(join(out, "OPERATOR_RESULTS.json"), "utf8"),
    "operator content",
  );
  writeFileSync(join(src, "fixture.zip"), "changed");
  assert.throws(() => prepareKit(src, join(root, "bad")), /CHECKSUM/);
  assert.equal(existsSync(join(root, "bad")), false);
});
