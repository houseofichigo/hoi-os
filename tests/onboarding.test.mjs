import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";
import { onboarding, saveOnboarding } from "../dist/core/onboarding.js";
import { onboard } from "../dist/core/knowledge.js";
import { Store } from "../dist/core/store.js";
import { backup, restore } from "../dist/core/backup.js";
test("onboarding resumes, shares profile, rejects stale writes and restores without adapters", (t) => {
  const { s, root } = fixture(t);
  onboard(s, { organization: "Fictional studio", offering: "Retain me" });
  const first = onboarding(s, "local");
  const v = saveOnboarding(
    s,
    {
      expectedVersion: 0,
      step: "profile",
      profileHash: first.profileHash,
      profile: { name: "Alex" },
    },
    "local",
  );
  assert.equal(v.profile.offering, "Retain me");
  assert.throws(
    () =>
      saveOnboarding(
        s,
        { expectedVersion: 0, step: "assistant", assistant: "none" },
        "local",
      ),
    /STALE/,
  );
  assert.throws(
    () =>
      saveOnboarding(
        s,
        {
          expectedVersion: v.version,
          step: "preferences",
          preferencesVersion: 0,
          timezone: "Invalid/Zone",
          workStart: "09:00",
          workEnd: "18:00",
        },
        "local",
      ),
    /timezone/,
  );
  const prefs = saveOnboarding(
    s,
    {
      expectedVersion: v.version,
      step: "preferences",
      preferencesVersion: 0,
      timezone: "America/New_York",
      workStart: "08:00",
      workEnd: "16:00",
    },
    "local",
  );
  assert.equal(prefs.preferences.timezone, "America/New_York");
  backup(s, join(root, "backup"));
  restore(join(root, "backup"), join(root, "restored"));
  const restored = new Store(join(root, "restored"));
  try {
    assert.deepEqual(onboarding(restored, "local").completed, [
      "profile",
      "preferences",
    ]);
    assert.equal(onboarding(restored, "local").profile.name, "Alex");
  } finally {
    restored.close();
  }
});
test("skipping does not erase profile or falsely finish incomplete setup", (t) => {
  const { s } = fixture(t);
  const a = onboarding(s, "local");
  const b = saveOnboarding(
    s,
    { expectedVersion: a.version, step: "recovery", skip: true, finish: true },
    "local",
  );
  assert.equal(b.status, "in-progress");
  let d = b;
  for (const step of d.steps.filter((x) => x !== "recovery"))
    d = saveOnboarding(
      s,
      { expectedVersion: d.version, step, skip: true, finish: true },
      "local",
    );
  assert.equal(d.status, "complete");
  assert.equal(d.skipped.length, 6);
});

test("onboarding respects profile access and marks status as read-only", async (t) => {
  const { s } = fixture(t);
  const { readNote, writeNote } = await import("../dist/core/files.js");
  const { operationInfo } = await import("../dist/core/operations.js");
  const path = s.path("context/profile.md");
  writeNote(path, { ...readNote(path), allowedHosts: ["local"] });
  assert.throws(() => onboarding(s, "codex"), /DENIED/);
  assert.equal(
    operationInfo({
      command: "onboard",
      args: ["status"],
      options: {},
    }).action,
    "read",
  );
});
