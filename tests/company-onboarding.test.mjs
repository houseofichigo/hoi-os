import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";
import {
  listSkills,
  skillDetail,
  resolveSkill,
} from "../dist/core/skill-library.js";
import { updateAdapters, adapterStatus } from "../dist/core/adapters.js";

test("company onboarding resolves its complete bundle and installs both adapter reference trees", (t) => {
  const { s } = fixture(t);
  const name = "hoi-company-onboarding";
  const summary = listSkills(s, "codex").find((skill) => skill.id === name);
  assert.ok(summary?.compatible);
  const detail = skillDetail(s, name, "codex");
  const active = detail.active;
  assert.ok(active);
  const resolved = resolveSkill(
    s,
    { name, revisionId: active.revisionId, checksum: active.checksum },
    "codex",
  );
  assert.ok(resolved.instructions);
  const catalog = JSON.parse(readFileSync("skills/catalog.json", "utf8"));
  const entry = catalog.skills.find((skill) => skill.name === name);
  assert.deepEqual(entry.requiredOperations, []);
  assert.deepEqual(entry.optionalConnections, []);
  assert.ok(entry.files.includes("references/member.md"));
  assert.ok(entry.files.includes("references/document-map.md"));
  updateAdapters(s, "local", { action: "install", hosts: ["codex", "claude"] });
  assert.ok(adapterStatus(s).every((host) => host.status === "verified"));
  for (const directory of [".agents", ".claude"])
    for (const file of entry.files)
      assert.deepEqual(
        readFileSync(s.path(`${directory}/skills/${name}/${file}`)),
        readFileSync(join("skills", name, file)),
      );
});
