import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { Store } from "./store.js";
import { type Host } from "./schema.js";
import { hubAccess } from "./hub.js";
import { readNote, sha, now, uid } from "./files.js";
import { onboard } from "./knowledge.js";
import { preferences, savePreferences } from "./daily-workspace.js";
import { backup, verifyBackup } from "./backup.js";
const steps = [
  "profile",
  "preferences",
  "assistant",
  "sources",
  "first-result",
  "recovery",
] as const;
function access(s: Store, h: Host, write = false) {
  s.assertSchema(16, "Onboarding");
  hubAccess(s, h, write);
  const profile = readNote(s.path("context/profile.md"));
  if (!profile.allowedHosts?.includes(h))
    throw Error("ONBOARDING_DENIED: Profile is not available to this host");
}
export function onboarding(s: Store, h: Host) {
  access(s, h);
  const row = s.one(
    "SELECT * FROM workspace_preferences WHERE key='onboarding'",
  );
  const payload = row
    ? JSON.parse(row.payload)
    : {
        formatVersion: 1,
        completed: [],
        skipped: [],
        assistant: "none",
        workStart: "09:00",
        workEnd: "18:00",
        status: "in-progress",
      };
  return {
    ...payload,
    version: row?.version || 0,
    steps,
    profile: readNote(s.path("context/profile.md")).answers || {},
    profileHash: sha(readFileSync(s.path("context/profile.md"))),
    preferences: preferences(s, h),
    backupRecorded: existsSync(s.path(".hoi/last-backup.json")),
  };
}
const text = z.string().trim().max(2000);
const input = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    step: z.enum(steps),
    skip: z.boolean().default(false),
    profileHash: z.string().optional(),
    profile: z
      .object({
        name: text.optional(),
        role: text.optional(),
        organization: text.optional(),
        goals: text.optional(),
      })
      .strict()
      .optional(),
    preferencesVersion: z.number().int().nonnegative().optional(),
    timezone: z.string().optional(),
    workStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    workEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    assistant: z.enum(["none", "handoff", "openai", "anthropic"]).optional(),
    finish: z.boolean().default(false),
  })
  .strict();
export function saveOnboarding(s: Store, value: unknown, h: Host) {
  access(s, h, true);
  const v = input.parse(value),
    old = onboarding(s, h);
  if (old.version !== v.expectedVersion)
    throw Error("ONBOARDING_STALE: Reload setup before saving");
  if (v.step === "profile" && !v.skip && v.profileHash !== old.profileHash)
    throw Error("PROFILE_STALE: Reload the existing profile");
  if (v.step === "preferences" && !v.skip) {
    if (!v.timezone || v.preferencesVersion !== old.preferences.version)
      throw Error("SETTINGS_STALE: Reload and confirm timezone");
    try {
      new Intl.DateTimeFormat("en", { timeZone: v.timezone });
    } catch {
      throw Error("Invalid timezone");
    }
    if (!v.workStart || !v.workEnd || v.workStart >= v.workEnd)
      throw Error("Working hours must end after start");
  }
  // Profile is atomically written by the existing operation first. After interruption,
  // resuming reads that durable profile even if the progress checkpoint was not saved.
  if (
    v.step === "profile" &&
    !v.skip &&
    v.profile &&
    Object.keys(v.profile).length
  )
    onboard(s, v.profile);
  return s.tx(() => {
    if (v.step === "preferences" && !v.skip)
      savePreferences(s, h, {
        expectedVersion: v.preferencesVersion,
        timezone: v.timezone,
        workStart: v.workStart,
        workEnd: v.workEnd,
      });
    const {
      version,
      steps: unused,
      profile,
      profileHash,
      preferences: unusedPrefs,
      backupRecorded,
      ...state
    } = old;
    state.completed = old.completed.filter((x: string) => x !== v.step);
    state.skipped = old.skipped.filter((x: string) => x !== v.step);
    (v.skip ? state.skipped : state.completed).push(v.step);
    if (v.step === "preferences" && !v.skip)
      Object.assign(state, { workStart: v.workStart, workEnd: v.workEnd });
    if (v.step === "assistant" && !v.skip)
      state.assistant = v.assistant || "none";
    if (
      v.finish &&
      steps.every(
        (x) => state.completed.includes(x) || state.skipped.includes(x),
      )
    )
      state.status = "complete";
    state.updatedAt = now();
    s.exec(
      "INSERT INTO workspace_preferences VALUES('onboarding',?,?) ON CONFLICT(key) DO UPDATE SET version=excluded.version,payload=excluded.payload",
      version + 1,
      JSON.stringify(state),
    );
    return onboarding(s, h);
  });
}
export function onboardingBackup(s: Store, h: Host) {
  access(s, h, true);
  if (h !== "local")
    throw Error(
      "LOCAL_REQUIRED: Create a backup from the app or local terminal",
    );
  const result = backup(s, join(dirname(s.root), uid("hoi-onboarding-backup")));
  verifyBackup(result.destination);
  return { verified: true, files: result.files };
}
