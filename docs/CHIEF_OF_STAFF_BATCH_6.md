# Batch 6 — calendar approval and recovery

Local alpha implementation, 2026-09-26. No live calendar writes, workspace migration or publication performed.

## Delivered

Schema 7 preserves prior versions 1–6 through the existing verified-backup upgrade path. Calendar proposals store the exact concrete calendar ID, title, offset-aware start/end, timezone, evidence, approval fingerprint and deterministic provider event ID. Review and execution are separate actions. Identical proposals reuse the existing decision, including rejection. Changed proposals require new review.

Today → Calendar approvals offers review of preparation suggestions, exact approval/rejection, explicit execution and reconciliation. The table remains available after restart. The app endpoints use existing authentication and same-origin controls; map-only mode remains read-only.

Execution verifies write access, checks for an existing matching provider event, rechecks current availability and source permissions, and persists an executing state before sending. Concurrent local executions are serialized; CLI and app workspace locks continue to prevent competing processes. A timeout, interruption or malformed response leaves the action uncertain. Reconciliation reads the same persisted external ID; it never automatically resends an uncertain operation, even after a 404. Provider-side availability and insertion are separate calls, so an unrelated concurrent calendar edit remains possible.

Events are private, busy preparation blocks of at most four hours, without attendees, recurrence or invitation sending. No OAuth token enters a workspace, backup or error message. Tokens are supplied only through the server process environment. The assistant connector's credentials are not copied into the app.

## Configuration and local commands

Writes are disabled by default. Configure only a verified, concrete calendar ID in the explicitly selected private workspace's `policies/actions.yaml`:

```yaml
calendar:
  allowedCalendars: ["your-concrete-calendar-id"]
```

Keep `actions.external: deny`; the calendar allowlist is a narrow exception for this adapter. The `primary` alias is deliberately rejected so changing accounts cannot silently redirect an approved event. A Google OAuth access token with calendar-list read, free/busy read and event-write permissions must be supplied as `HOI_GOOGLE_CALENDAR_ACCESS_TOKEN` to the CLI/server process using your credential manager. The app does not implement OAuth consent, refresh or token storage. Do not paste credentials into chat, command history or knowledge files. An expired/missing token produces an actionable provider error and cannot be interpreted as success.

```text
node bin/hoi.mjs calendar --workspace "<private workspace>" --host codex --json
node bin/hoi.mjs calendar propose --input event.json --workspace "<private workspace>" --host codex
node bin/hoi.mjs calendar review --input review.json --workspace "<private workspace>" --host codex
node bin/hoi.mjs calendar execute <action-id> --workspace "<private workspace>" --host codex
```

Event input: `calendarId`, `title`, `start`, `end`, `timezone`, and `evidence` with exact `revisionId`, `passageId`, `quote`. Review input: `id`, `expectedVersion`, `digest`, `decision` (`approved`/`rejected`). Execution of an uncertain action only reconciles. Do not work around an uncertain action by creating a new proposal; inspect the provider before any manual recovery.

API routes: GET `/api/calendar`; POST `/api/calendar/propose`, `/review`, `/execute`. Review cards display the destination, exact times, timezone and evidence before approval.

## Validation and remaining gates

Synthetic tests cover approval idempotency, changed digests, conflicts, denied policy and restricted evidence, concurrent execution, lost responses, provider identity mismatch, rejection preservation, restart persistence, schema-6 migration, restore into a different directory and the Google HTTP request contract. Browser coverage includes keyboard approval, persistence, disabled writes and narrow screens. Existing installation, backup, source preservation, map and browser regressions remain required.

The Google adapter is implemented against the [event insertion API](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) and [availability API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query). Mocked HTTP tests are not live verification. Selecting and authenticating a real calendar, approving one exact event, and checking it remotely remain required before calling Batch 6 complete. No live credentials were available for the standalone app during implementation.

Validation: **102 core tests and 10 browser tests passed**, including skill mirror checks. The existing 1,000-document map benchmark passed on Apple M5: list 209 ms, graph 1,972 ms. Clean Windows verification and the ten-day real-data pilot remain outstanding. The current product stays alpha. Existing handoff chat remains unchanged; no runtime was installed.

Synthetic demonstration: run `node scripts/calendar-demo.mjs "<new synthetic workspace>"`, then start the app against that workspace with `--host local`. Open Today → Calendar approvals; approve the fictional event and confirm execution reports `CALENDAR_WRITES_DISABLED`. The core lost-response tests demonstrate successful reconciliation with exactly one synthetic provider creation.
