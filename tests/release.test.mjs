import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { catalog, files } from "../scripts/skill-packages.mjs";
const root = resolve("."),
  version = JSON.parse(readFileSync("package.json", "utf8")).version;
test("release packages are reproducible, complete and extractable without local paths", async (t) => {
  const run = () => {
    const r = spawnSync(process.execPath, ["scripts/package-release.mjs"], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
  };
  run();
  const dir = join(root, "release", `v${version}`),
    first = readFileSync(join(dir, "SHA256SUMS"), "utf8");
  run();
  assert.equal(readFileSync(join(dir, "SHA256SUMS"), "utf8"), first);
  for (const line of first.trim().split("\n")) {
    const [hash, name] = line.split("  ");
    assert.equal(
      createHash("sha256")
        .update(readFileSync(join(dir, name)))
        .digest("hex"),
      hash,
    );
  }
  const installer = await JSZip.loadAsync(
    readFileSync(join(dir, "hoi-install.zip")),
  );
  assert.ok(installer.file("hoi-install/SKILL.md"));
  assert.ok(installer.file("hoi-install/references/local-setup.md"));
  assert.ok(installer.file("hoi-install/references/chat-guidance.md"));
  assert.ok(installer.file("hoi-install/LICENSE"));
  const scratch = mkdtempSync(join(tmpdir(), "hoi release skills "));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  for (const [name, entry] of Object.entries(installer.files)) {
    assert.ok(name.startsWith("hoi-install/"));
    assert.ok(!name.includes(".."));
    if (!entry.dir) {
      const dest = join(scratch, name);
      mkdirSync(join(dest, ".."), { recursive: true });
      writeFileSync(dest, await entry.async("nodebuffer"));
    }
  }
  assert.ok(existsSync(join(scratch, "hoi-install/references/local-setup.md")));
  const collection = await JSZip.loadAsync(
      readFileSync(join(dir, "hoi-os-skills.zip")),
    ),
    data = catalog(root, version);
  assert.equal(data.skills.filter((s) => s.kind === "operational").length, 14);
  assert.equal(
    Object.keys(collection.files).filter((p) => p.endsWith("/SKILL.md")).length,
    14,
  );
  assert.equal(collection.file("hoi-install/SKILL.md"), null);
  for (const s of data.skills.filter((s) => s.kind === "operational"))
    for (const f of s.files) assert.ok(collection.file(`${s.name}/${f}`));
  const guide = readFileSync(join(dir, "hoi-install.md"), "utf8");
  assert.doesNotMatch(guide, /\]\(references\//);
  assert.match(guide, /v0\.1\.0-alpha\.2/);
  for (const [name, entry] of Object.entries(installer.files))
    if (!entry.dir)
      assert.doesNotMatch(
        await entry.async("string"),
        /\/Users\/|\/var\/folders\/|localhost:\d{4,5}/,
      );
});
test("complete runtime mirrors include every skill resource", () => {
  for (const runtime of [".agents", ".claude"])
    for (const s of catalog(root, version).skills)
      for (const f of s.files)
        assert.deepEqual(
          readFileSync(join(root, runtime, "skills", s.name, f)),
          readFileSync(join(root, "skills", s.name, f)),
        );
});
test("setup repairs interrupted adapter installation and rejects missing choices without writing", (t) => {
  const scratch = mkdtempSync(join(tmpdir(), "hoi setup spaces ")),
    workspace = join(scratch, "Private workspace");
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const args = [
    "scripts/setup.mjs",
    "--workspace",
    workspace,
    "--hosts",
    "codex",
    "--non-interactive",
    "--skip-build",
  ];
  const run = () => {
    const r = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  };
  run();
  const guide = join(
    workspace,
    ".agents/skills/hoi-install/references/local-setup.md",
  );
  assert.ok(existsSync(guide));
  rmSync(guide);
  const manual = join(workspace, "AGENTS.md");
  writeFileSync(manual, "Keep my manual.\n" + readFileSync(manual, "utf8"));
  run();
  assert.ok(existsSync(guide));
  assert.match(readFileSync(manual, "utf8"), /Keep my manual/);
  const missing = spawnSync(
    process.execPath,
    ["scripts/setup.mjs", "--non-interactive", "--skip-build"],
    { encoding: "utf8", env: { ...process.env, HOI_WORKSPACE: "" } },
  );
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Supply --workspace/);
});
