# Resumable onboarding — Batch 3

Open **Continue setup** on Home, or **Configuration → Onboarding**. Desktop
create/open-workspace remains the entry point; onboarding runs inside the selected
workspace. Skills, projects, API keys and connections are optional.

Progress lives in the existing workspace-preferences table (schema 16). No schema
migration or private-workspace upgrade was performed for this batch. Saved choices
survive restart and backup/restore. Existing profile fields and unrelated manuals
are preserved. Stale profile/progress/settings versions require reload.

1. Confirm optional identity and first outcome. Existing profile answers are reused.
2. Confirm timezone and working hours; these seed week-planning preferences.
3. Choose no AI, handoff or a preferred API provider. This records preference only;
   separate provider configuration owns keys, disclosure, models and cost limits.
4. Open the existing bounded ingestion manifest or skip intake.
5. Inspect a retrieved passage or review a task suggestion. This checkpoint records
   acknowledgement, not verified answer quality.
6. Create a verified backup beside the private workspace, or explicitly skip it.
   Integrity verification is not a restore rehearsal. Finish after reviewing or
   skipping all steps. Setup can be reopened without resetting data.

The shared CLI uses `onboard status`, `onboard save --input progress.json` and
local-only `onboard backup`. Authenticated app routes are `/api/onboarding`,
`/api/onboarding/save` and `/api/onboarding/backup`. Legacy profile updates remain
supported. `hoi-onboard` uses the same checkpoints.

Profile writes use the existing atomic file operation before saving the checklist.
If interrupted between them, the profile is preserved and the unfinished checkpoint
can be resumed. Preferences and progress are saved in one database transaction.
The wizard does not create accounts, install adapters, enable AI, import files or
approve tasks as side effects. Optional configuration is linked to its existing
review flow. No synthetic first-result or provider-success claims are made.

Tests cover persistence, stale edits, skip/finish behavior, restored progress and
390px browser navigation. Live-provider, clean-install and real-pilot gates remain
separate; GitHub publication is still last.

## Local validation

211 core tests passed, including restoration, stale saves and profile permissions.
The full browser suite passed 37 tests; the onboarding browser test was rerun after
the final preference-preservation adjustment and passed. Formatting, skill mirrors
and company-copy checksums passed. A separate fictional demo was opened for review.
Electron/clean-machine checks were not rerun; prior build evidence is not new
certification for this batch. No private workspace was migrated and no GitHub
operation was performed.
