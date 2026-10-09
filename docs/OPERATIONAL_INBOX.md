# Operational Inbox — local schema 16 development

This is unreleased local work. GitHub has not been updated. No private workspace was migrated and no live account was analyzed or modified for this implementation.

## Available locally

- Inbox after Home: Email, Calendar, Transcripts and Suggestions, referencing preserved intake records. Email candidates retain confirm/dismiss/snooze controls. Evidence opens in a keyboard-dismissable drawer.
- Standalone task proposals and accepted tasks; later project assignment preserves identity and history. Standalone tasks do not contribute to project progress. Missing owners/deadlines remain unknown.
- Sequential schema 15 → 16 migration rebuilds the task relationship while preserving task histories. Provider configuration, usage reservations, analysis scopes/jobs and Gmail proposals are persisted.
- OpenAI Responses and Anthropic Messages adapters, streaming and cancellation. Configuration uses the OS credential store; absence of secure storage fails closed. Keys are not exported with the workspace.
- Explicit provider-specific source disclosure plus permission to disclose selected workspace context. Existing host permissions do not authorize API disclosure. A prepared Chat request can be answered through an API or existing manual handoff. API responses are validated through the existing citation contract.
- Automatic commitment extraction for selected, durably synchronized normalized email/calendar/transcript items. Enabling analysis requires a reviewed preview; initial backlog is excluded unless explicitly included. Changed connector scope invalidates analysis authorization. Models create reviewable mentions, never accepted tasks.
- A combined $25 monthly automatic-analysis reservation ledger, using workspace timezone. Manual requests have a separate per-request ceiling. Recorded actual usage and unresolved reservations are retained. Unknown outcomes are not blindly retried. Pricing is explicitly supplied per model and expires after 31 days; this is a conservative local control, not provider billing certification.
- Exact-payload Gmail draft review and a connected Calendar preparation adapter. Gmail exposes no send operation. Uncertain draft writes require reconciliation; failure to find a confidently matching draft does not cause a resend. Calendar rechecks the supporting occurrence and availability and creates blocks without attendees.

## Setup in the app

1. Configuration → Assistant and search: select provider/model, enter current input/output prices and pricing date, then enter the key locally. Select permitted sources and review the workspace-context disclosure. Test the connection. A model listing tests credentials; a cited generation is a separate live check.
2. Configuration → Connections: select bounded Gmail/Calendar scope, authorize user-owned desktop OAuth, preview and sync. Read-only is the default. Review automatic-analysis scope separately; connecting alone never enables paid analysis.
3. To enable reviewed Google writes, review the workspace external-action policy and authorize the extra connector scope. Neither substitutes for exact approval of each draft/event. Existing policies remain denied until explicitly changed.
4. Chat: prepare a request, then use the API response control or copy to the selected assistant. Live structured output is shown under technical details until the completed answer passes citation validation.

## Current limitations and remaining acceptance gates

- No API credentials or bounded live Google test scope were supplied. Live generation, revoked-key handling against real services, Gmail draft creation and Calendar creation are not live-verified.
- Automatic interpretation currently extracts commitments only. Reply text is editable and manually proposed; automatic reply/wiki/memory/project interpretation is not yet delivered by the new worker.
- Transcript upload and existing-source selection now feed a dedicated text/speaker review and assistant-response validation flow. See [Transcript workflow](TRANSCRIPT_WORKFLOW.md). Unknown speakers/dates remain unknown; original sources are reused.
- Provider selection is per request or analysis scope; there is no silent fallback. Connection-test results are returned immediately; the persistent status conservatively remains configured-unverified.
- Chat currently streams the structured response in technical details, not a polished incremental answer transcript. Arbitrary model tools are not exposed; the provider path is bounded answer/extraction only.
- Optional client/person associations on standalone tasks, richer unified suggestion cards and resumable reconciliation of uncertain paid requests remain follow-up work.
- Synthetic/browser/Electron testing on the development Mac is not clean-machine verification. Clean Mac installation, real keyring/OAuth recovery, upgrade/uninstall rehearsal on a clean machine, Windows verification, and the ten-day pilot remain required.
- Public distribution and GitHub updates remain a separate final step.

## Recovery and safety

Before upgrading private data, verify a backup and restore to a different directory. Open the restored copy for migration first. Credentials are deliberately excluded; re-enter/reconnect on a new location or machine. Interrupted paid jobs retain conservative reservations and become uncertain; do not edit the ledger to force retries. Dismissed/completed commitment decisions continue through existing evidence-based review.

External policy defaults to `deny`. The reviewed `approve` mode permits only registered actions that still enforce exact approval and connector scopes. The legacy `DEFAULT_EXTERNAL_DENY` security finding intentionally reports that the default has changed; it is not permission to bypass those checks.

## Recorded local validation — 2026-09-27

- Core: 203 tests passed; schema/migration, policy, provider stream fixtures, budget reservations, standalone approval/reassignment and uncertain Google writes included.
- Browser: 35 tests passed; Inbox evidence/keyboard approval and persistence at 390/768/1280/1440 pixels included.
- Fictional demonstration: email, transcript and calendar evidence support one accepted standalone task. Restart/restore retains its identity and null project. Backup checksums verified and restoration rehearsed in a separate directory.
- Mac arm64 Electron stage rebuilt successfully; 2 Electron boundary/restart tests passed. Staging and development-machine tests are not clean-machine installation proof.
- Exact build-specific results are recorded locally under `.verification/`; these do not certify live APIs or another machine.

Local Mac arm64 ZIP built with publishing disabled: `desktop-release/HOI OS-0.1.0-alpha.2-local-f-mac-arm64.zip`; checksum in `desktop-release/SHA256SUMS`. This artifact is unsigned, unnotarized, and not clean-machine verified. Other files in that directory may be older artifacts and are not evidence for this build or Windows support.
