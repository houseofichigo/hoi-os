import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fixture } from "./helpers.mjs";
import { adapterStatus, updateAdapters } from "../dist/core/adapters.js";
import { backup, restore, verifyBackup } from "../dist/core/backup.js";
import { Store } from "../dist/core/store.js";
import { operationCatalog } from "../dist/core/operations.js";

test("all fifteen supplied skill roles map to actual catalogue entries and operations", () => {
  const map = JSON.parse(readFileSync("method/SKILL_MAP.json"));
  const catalog = JSON.parse(readFileSync("skills/catalog.json"));
  const ops = new Set(operationCatalog().map((x) => x.name));
  assert.equal(map.entries.length, 15);
  assert.equal(new Set(map.entries.map((x) => x.suppliedSkill)).size, 15);
  for (const entry of map.entries) {
    assert.match(entry.suppliedInstructionSha256, /^[a-f0-9]{64}$/);
    for (const id of entry.engineSkills) {
      const skill = catalog.skills.find((x) => x.name === id);
      assert.ok(skill, id);
      for (const op of skill.requiredOperations) assert.ok(ops.has(op), op);
    }
  }
  assert.equal(
    map.entries.find((x) => x.suppliedSkill === "hoi-automate").disposition,
    "host-dependent",
  );
  assert.equal(
    catalog.skills.some((x) => x.name === "hoi-app"),
    false,
  );
});

test("same-name imported folders are not merged, and their files never become installer-owned", (t) => {
  const { s } = fixture(t),
    dir = s.path(".agents/skills/hoi-retrieve");
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), "Imported Python-harness instructions.");
  writeFileSync(join(dir, "scripts/legacy.py"), "DO NOT EXECUTE");
  const result = updateAdapters(s, "local", {
    action: "install",
    hosts: ["codex"],
  });
  assert.ok(result.conflicts.includes(".agents/skills/hoi-retrieve/"));
  assert.equal(
    readFileSync(join(dir, "SKILL.md"), "utf8"),
    "Imported Python-harness instructions.",
  );
  assert.equal(existsSync(join(dir, "agents/openai.yaml")), false);
  const manifest = JSON.parse(readFileSync(s.path(".hoi/adapters/codex.json")));
  assert.ok(
    !Object.keys(manifest.files).some((x) =>
      x.startsWith(".agents/skills/hoi-retrieve/"),
    ),
  );
  assert.equal(adapterStatus(s)[0].status, "modified");
  updateAdapters(s, "local", { action: "remove", hosts: ["codex"] });
  assert.ok(existsSync(join(dir, "SKILL.md")));
  assert.ok(existsSync(join(dir, "scripts/legacy.py")));
});

test("interrupted adapter writes retain recovery identity and restore into a separate copy", (t) => {
  const { s, root } = fixture(t);
  writeFileSync(s.path("AGENTS.md"), "Owner instructions\n");
  const path = s.path.bind(s);
  let tripped = false;
  s.path = (rel) => {
    if (
      !tripped &&
      rel === ".agents/skills/hoi-install/SKILL.md" &&
      existsSync(path(".hoi/adapter-update.json"))
    ) {
      tripped = true;
      throw Error("fixture interrupted write");
    }
    return path(rel);
  };
  assert.throws(
    () => updateAdapters(s, "local", { action: "install", hosts: ["codex"] }),
    /fixture interrupted write/,
  );
  s.path = path;
  const journal = JSON.parse(readFileSync(s.path(".hoi/adapter-update.json")));
  verifyBackup(journal.backup);
  assert.equal(adapterStatus(s)[0].status, "update-interrupted");
  assert.throws(
    () => updateAdapters(s, "local", { action: "install", hosts: ["codex"] }),
    /ADAPTER_UPDATE_INTERRUPTED/,
  );
  const restored = join(root, "separate-restored");
  restore(journal.backup, restored);
  const copy = new Store(restored);
  try {
    assert.equal(
      readFileSync(copy.path("AGENTS.md"), "utf8"),
      "Owner instructions\n",
    );
    assert.equal(existsSync(copy.path(".hoi/adapter-update.json")), false);
    updateAdapters(copy, "local", { action: "install", hosts: ["codex"] });
    assert.equal(adapterStatus(copy)[0].status, "verified");
  } finally {
    copy.close();
  }
});

test("setup rejects nonempty destinations and product aliases without Git or workspace mutation", (t) => {
  const { root } = fixture(t),
    target = join(root, "unrelated");
  mkdirSync(target);
  writeFileSync(join(target, "original.txt"), "preserve");
  const args = [
    "scripts/setup.mjs",
    "--workspace",
    target,
    "--non-interactive",
    "--skip-build",
  ];
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /empty directory/);
  assert.equal(readFileSync(join(target, "original.txt"), "utf8"), "preserve");
  assert.equal(existsSync(join(target, ".hoi")), false);
  assert.equal(existsSync(join(target, ".git")), false);
  const alias = join(root, "product-alias");
  symlinkSync(resolve("."), alias, "dir");
  const linked = spawnSync(
    process.execPath,
    [
      "scripts/setup.mjs",
      "--workspace",
      join(alias, "fictional-private"),
      "--non-interactive",
      "--skip-build",
    ],
    { encoding: "utf8" },
  );
  assert.notEqual(linked.status, 0);
  assert.match(linked.stderr, /separate directories/);
  assert.equal(existsSync("fictional-private"), false);
});

test("adapter preflight rejects linked skill roots before any managed write", (t) => {
  const { s, root } = fixture(t);
  const outside = join(root, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "SKILL.md"), "preserve");
  mkdirSync(s.path(".agents/skills"), { recursive: true });
  symlinkSync(outside, s.path(".agents/skills/hoi-retrieve"), "dir");
  assert.throws(
    () => updateAdapters(s, "local", { action: "install", hosts: ["codex"] }),
    /Symlink|SYMLINK/,
  );
  assert.equal(existsSync(s.path("AGENTS.md")), false);
  assert.equal(existsSync(s.path(".hoi/adapter-update.json")), false);
  assert.equal(readFileSync(join(outside, "SKILL.md"), "utf8"), "preserve");
});

test("untracked code added after installation is reported and preserved on removal", (t) => {
  const { s } = fixture(t);
  updateAdapters(s, "local", { action: "install", hosts: ["codex"] });
  const extra = s.path(".agents/skills/hoi-retrieve/unknown.py");
  writeFileSync(extra, "never execute");
  assert.equal(adapterStatus(s)[0].status, "modified");
  assert.ok(
    adapterStatus(s)[0].untracked.includes(
      ".agents/skills/hoi-retrieve/unknown.py",
    ),
  );
  const result = updateAdapters(s, "local", {
    action: "remove",
    hosts: ["codex"],
  });
  assert.ok(result.conflicts.length);
  assert.ok(existsSync(extra));
  assert.ok(existsSync(s.path(".agents/skills/hoi-retrieve/SKILL.md")));
});

test("a concurrent file edit after preflight is preserved and leaves a recovery marker", (t) => {
  const { s } = fixture(t);
  updateAdapters(s, "local", { action: "install", hosts: ["codex"] });
  const path = s.path.bind(s);
  const rel = ".agents/skills/hoi-install/SKILL.md";
  let changed = false;
  s.path = (name) => {
    const target = path(name);
    if (
      !changed &&
      name === rel &&
      existsSync(path(".hoi/adapter-update.json"))
    ) {
      changed = true;
      writeFileSync(target, "Concurrent owner edit; preserve this.");
    }
    return target;
  };
  assert.throws(
    () => updateAdapters(s, "local", { action: "install", hosts: ["codex"] }),
    /ADAPTER_CHANGED_DURING_UPDATE/,
  );
  s.path = path;
  assert.equal(
    readFileSync(path(rel), "utf8"),
    "Concurrent owner edit; preserve this.",
  );
  assert.equal(adapterStatus(s)[0].status, "update-interrupted");
  verifyBackup(
    JSON.parse(readFileSync(path(".hoi/adapter-update.json"))).backup,
  );
});

test("backup restores both adapters and custom skills without copying host settings or credentials", (t) => {
  const { s, root } = fixture(t);
  updateAdapters(s, "local", { action: "install", hosts: ["codex", "claude"] });
  const custom = ".agents/skills/hoi-retrieve/SKILL.md";
  writeFileSync(s.path(custom), "Fictional customized skill.");
  const unrelated = ".claude/skills/fictional-custom";
  mkdirSync(s.path(unrelated), { recursive: true });
  writeFileSync(s.path(unrelated + "/SKILL.md"), "Owner instructions.");
  writeFileSync(s.path(unrelated + "/.env"), "FICTIONAL_SECRET=excluded");
  writeFileSync(
    s.path(".claude/settings.json"),
    '{"fictionalSecret":"excluded"}',
  );
  const destination = join(root, "adapter-backup"),
    restored = join(root, "restored-adapters");
  backup(s, destination);
  const manifest = verifyBackup(destination);
  assert.ok(manifest.files[custom]);
  assert.ok(manifest.files[unrelated + "/SKILL.md"]);
  assert.equal(manifest.files[unrelated + "/.env"], undefined);
  assert.equal(manifest.files[".claude/settings.json"], undefined);
  restore(destination, restored);
  const copy = new Store(restored);
  try {
    assert.equal(adapterStatus(copy)[0].status, "modified");
    assert.equal(adapterStatus(copy)[1].status, "verified");
    assert.equal(
      readFileSync(copy.path(custom), "utf8"),
      "Fictional customized skill.",
    );
    assert.equal(
      readFileSync(copy.path(unrelated + "/SKILL.md"), "utf8"),
      "Owner instructions.",
    );
    assert.equal(existsSync(copy.path(unrelated + "/.env")), false);
    assert.equal(existsSync(copy.path(".claude/settings.json")), false);
  } finally {
    copy.close();
  }
});
