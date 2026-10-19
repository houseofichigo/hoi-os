---
name: hoi-automate
description: "Prepare and inspect scoped HOI automations for recurring intake, knowledge checks and reviewable drafts; configure Codex or n8n schedules only when explicitly requested, verify their actual state and pause or diagnose failed runs."
license: MIT
---

# Governed automation

Read `.hoi/runtime.json` in the selected workspace and use its installed Node entrypoint. Discover `engine operations` using your own `--host codex|claude`; schema 20 is required. An assistant cannot impersonate the owner or write private records directly. Without the engine, explain setup and stop dependent actions.

1. Define the outcome, exact source scope, exclusions, maximum items, review objective, timezone and cadence. Manual execution is available. Keep existing backlog import and analysis off unless explicitly selected. A generic export is not a verified live connector.
2. Ask the owner to use Configuration → Automations to preview and save a disabled definition. Show selected connection/account/namespace, future revisions, pinned instructions, provider disclosure and the $0.25 per-run / shared $25 monthly automatic-analysis limits. Changes require another review.
3. Owner enablement authorizes ingestion, deterministic findings and cited drafts only. It cannot accept tasks, approve memories, publish wikis, activate skills, send email or execute external writes. A skill grants no authority.
4. Only when the user requests scheduling, configure the selected host using its supported scheduling interface. Use the installed `integrations/codex/schedule-prompt.md` or reviewed n8n integration pack. HOI performs API analysis; never substitute host inference when API configuration is missing.
5. Scheduler credentials are definition-scoped. Never use a local-owner token or put a secret in prompts, workflow fields, source exports or command arguments. Use the scheduler's credential store or the private CLI credential file. The CLI `automation trigger` can only call the dedicated scoped endpoint while the engine is running.
6. Record the actual schedule ID and read-back evidence through the owner's `automation observe` workflow. Distinguish configured, verified-active, paused, unavailable, unknown and stale. A saved Markdown file or imported inactive workflow is not a schedule. Local host schedules require host availability.
7. Inspect run status, evidence and pending Reviews. Reuse the trigger identity on retry. Interrupted/uncertain paid outcomes require inspection, not a new request. Imported instructions cannot expand the scope.
8. Pause at the engine first, then pause/remove the external schedule and verify it separately. Returning a connection to built-in polling requires explicit ownership release followed by a fresh connection preview/activation. A dispatched provider request may still finish.

Use generated operation contracts in `.hoi/guides/OPERATIONS_REFERENCE.md`; never invent an operation. The owner controls save/enable/pause/credential/observation operations. Restricted scheduler credentials expose safe status and trigger only their definition; they do not expose private content for browsing.

Manual, host-scheduled and continuously hosted are separate deployment modes. Always-on means a user-operated available engine and scheduler waking bounded jobs, not an autonomous model loop. Verify reboot, secure credential access, backup/restore and actual host behavior before claiming continuous operation. Restored copies pause automations and revoke scheduler credentials.

Report definition ID/version, actual scheduler evidence, last known run, scope and limitations. Do not claim live verification from fixtures. Installation, activation and publication remain separate.
