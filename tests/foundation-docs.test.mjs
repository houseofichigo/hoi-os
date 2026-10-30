import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  cpSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const script = resolve("scripts/sync-foundation.mjs");
function fixture(t) {
  const p = mkdtempSync(join(tmpdir(), "hoi-foundation-"));
  t.after(() => rmSync(p, { recursive: true, force: true }));
  cpSync("method", join(p, "method"), { recursive: true });
  return p;
}
function run(p, check = false) {
  return spawnSync(process.execPath, [script, ...(check ? ["--check"] : [])], {
    cwd: p,
    encoding: "utf8",
  });
}
test("foundation derives all twenty step associations and rejects table drift", (t) => {
  const p = fixture(t);
  assert.equal(run(p).status, 0);
  assert.equal(run(p, true).status, 0);
  const path = join(p, "method/JOURNEY.md");
  const before = readFileSync(path, "utf8");
  assert.match(before, /\| 7 \|.*TOOLS\.md/);
  writeFileSync(path, before.replace("| 7 |", "| 99 |"));
  const result = run(p, true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Foundation drift/);
});
test("unknown introduction steps and mismatched method versions are rejected", (t) => {
  const p = fixture(t),
    file = join(p, "method/foundation.json");
  const manifest = JSON.parse(readFileSync(file));
  manifest.documents[0].introducedAtStep = 29;
  writeFileSync(file, JSON.stringify(manifest));
  assert.match(run(p).stderr, /FOUNDATION_REFERENCE/);
  manifest.documents[0].introducedAtStep = 2;
  manifest.journeyVersion = "unsupported";
  writeFileSync(file, JSON.stringify(manifest));
  assert.match(run(p).stderr, /FOUNDATION_JOURNEY_VERSION/);
});
