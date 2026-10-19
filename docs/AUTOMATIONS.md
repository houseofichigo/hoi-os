# Selective routing and governed automation

Audience: workspace owners, assistant adapters and operators of local scheduler integrations. Authority: the shared registry (`src/operations.ts`), schema-20 engine (`src/automations.ts`), source policy and provider disclosure. These instructions do not grant permissions. This is an unreleased source upgrade; historical release downloads are unchanged.

## What is available

HOI remains a 25-step harness, a local engine and an optional Knowledge Hub. The product now has 22 optional skills. No desktop app, proprietary scheduler, hosted service, recursive agent framework or mandatory AI key was added.

`harness route --input request.json` returns an exact record read, one eligible skill, a clarification or the explicit priorities-and-meeting workflow. It does not execute. The five automatic candidates are retrieve, meeting preparation, Chief of Staff, task intake and project intake. Project intake keeps its exact 17-field schema. Automatic routing is deterministic and conservative; manual selection remains available. Route metadata cannot grant tools or approvals. Workflows expose at most three stages and retain the five-round overall limit; these are plans for the existing host workflow, not a new recursive executor.

Automation recipes are intake → mechanical knowledge checks → optional assisted review. They bind source scope, skill checksums, provider/model configuration and budget. One automation runs at a time in a workspace. The model review uses one bounded API call without tools. Its output is checked against exact supplied quotations and appears as a finding with optional suggested text; it cannot publish, approve, send email or change external systems. Coverage is bounded excerpts, not complete specialist verification. Memory and wiki sources of truth remain unchanged.

## Owner workflow

Use Configuration → Automations, or owner-authenticated registry operations:

1. Create and preview a bounded connection through the existing Connections workflow, or select permitted source IDs / an explicit generic export namespace.
2. Call `automation preview --input definition.json`. Inspect backlog, account/query/folder, content types, future-revision authorization, provider, exact instructions and costs. Connection maxItems must fit the definition's cap.
3. Call `automation save` with `{expectedVersion:0, definition, previewDigest}`. Updates supply the existing ID/version. Saving always disables the definition and revokes old scheduler grants.
4. Call `automation enable` with `{id,expectedVersion,digest,confirm:true}` after exact scope review. Enablement does not create an external schedule. A connection becomes owned by this automation; built-in polling and legacy automatic analysis skip it.
5. Run once or install the selected external schedule separately. `automation status`, `automation history` and Activity show actual work and recoverable failures.
6. Pause immediately with `{id,expectedVersion,confirm:true}`. Existing dispatch may still complete; paid uncertainty remains reserved. Pause and verify the external schedule separately.
7. To transfer a connection back, pause, wait for active work, call `automation release-connection`, then preview and activate the connection. It stays paused until that explicit activation.

Definitions include `accessHost`, an explicitly approved access identity. Hardcoded recipe services intersect this identity's current source/policy rights with the definition's scope. Scheduler credentials never authenticate as this identity and cannot call the general operation registry. Owner configuration and source permissions remain independent.

## Third-party exports

The source bridge accepts schema-2 envelopes: `{schemaVersion:2,automationId,triggerId,snapshot}`. A snapshot has namespace, account, scope, stable object ID, title, content type, text, observed time, nullable source update time/revision, completeness and preserved original text/JSON. See `src/external-snapshots.ts` for the strict schema; incoming permission metadata and URL-fetch directives are rejected.

An enabled export definition is required. Existing schema-1 connector callers retain their interface. Generic snapshots preserve the original export and derived text separately. No scripts/HTML execute and no referenced URLs are fetched. Unknown source times stay unknown; with backlog excluded, unknown or older source updates require review. Stable namespace/account/object identity with scope-filtered membership deduplicates repeated exports. Native-source reconciliation is deliberately not guessed from titles; verified cross-transport mapping is a later connector extension. Source disappearance never deletes evidence.

Sources from generic snapshots default to the approved access host plus local owner and internal sensitivity. Provider disclosure is a separate explicit configuration step. `discloseFutureSources` defaults to false; enabling it in a reviewed intake-and-review definition permits only future matching revisions for the selected provider. It excludes backlog and never adds a broad per-source permission. Provider configuration/version changes revoke that route until renewed review. Existing backlog still requires its explicit source disclosure and analysis choices. Ingestion alone cannot authorize AI disclosure. Automated per-item skip/failure details remain in sync runs and intake jobs. Newly imported backlog revisions remain excluded from AI when backlog analysis is off. Existing connector size limits remain enforced; split an oversized scope before activation. Mechanical checks rotate source revisions within the run cap. Notes with no source association remain available to the manual knowledge-review scan.

## Credentials and host integration

`automation credential` is owner-only and replaces existing grants for that definition. A random token is shown once; SQLite retains only its hash. Prefer the scheduler credential store. CLI `--output <private-file>` writes mode-0600 credentials without printing them. Files under `.hoi/automation-credentials/` are excluded from backups; do not store secrets among source documents. On Windows, operators must verify the file ACL or use the scheduler's credential store; no Windows verification is claimed.

`automation trigger --workspace <selected-workspace> --credential-file <private-file> --input <trigger.json>` uses a dedicated loopback endpoint. It cannot start a new owner engine, expand scope or call arbitrary operations. The engine must be running. Trigger JSON contains `triggerId` and optionally a normalized snapshot. Retain the identity on retry. `automation inspect` with the same workspace and private credential file reads safe status without dispatch. The scoped HTTP API exposes only `/api/automation-client/run` and `/api/automation-client/status`; safe status contains no source text, private titles or credentials.

The [Codex prompt](../integrations/codex/schedule-prompt.md) and [n8n pack](../integrations/n8n/README.md) are inactive templates. Source installation is not scheduling. `automation observe` records operator-supplied schedule read-back: actual ID, observed state/evidence and optional next time. The UI marks observations stale after 24 hours. HOI does not infer a next-run time or live availability from a cron string.

Suggested cadence: intake every 15 minutes, mechanical health daily 08:00, assisted review Friday 16:00. Use the workspace timezone. The engine coalesces one scheduled run per local cadence slot, including repeated DST slots. Missed intervals do not produce an engine replay storm. n8n target-instance validation and saved-connection checks remain mandatory before publication.

## Budget, failure and recovery

Automatic API calls reserve their maximum estimated cost in the existing shared $25 monthly ledger, with a maximum $0.25 per run. Routing and mechanical checks use no model. Pricing older than 31 days blocks AI dispatch. Missing keys, absent disclosure or changed provider/instructions produce needs-attention; no fallback model or host inference is used. Provider usage is reconciled when returned; uncertain calls retain reservations and processing identities. Another trigger does not repeat a revision already dispatched with the same instructions.

Review findings reuse fingerprints and decisions. Dismissed unchanged findings remain dismissed. Changed source revisions produce distinct findings linked to previous assisted findings. Human approval and publication use the existing editors; suggestions are not independent evidence.

On process restart, active runs become interrupted and dispatched API jobs become uncertain. Prior trigger IDs return their retained outcomes. Inspect before retrying. Original copies and receipts permit diagnosis; no attempt is made to prove an external paid call did not happen.

Schema 20 adds definitions, scoped grants, schedule observations, connection ownership, immutable definition versions, runs/events and derivation keys. Existing source, wiki, memory, job and review identities remain authoritative. Backups include definitions/history. Restored copies pause automation, revoke grants and clear schedule observations before use. Re-review and issue fresh credentials after a separate restoration rehearsal. No private migration is performed by installing this source update.

## Availability and limits

Manual mode needs no scheduler or API key. Host scheduling requires the selected computer, host and engine. Continuous hosting requires a user-operated available machine, secure credential access, explicit startup configuration and verified backups. This upgrade installs no background service and does not change network binding. Docker/remote n8n cannot assume host loopback access; never expose the general engine API publicly to make a template connect.

Local tests cover engine contracts and loopback transport. Human routing labels, generated-answer factual support, live API responses, real Codex/n8n publication, reboot tests, fresh hosts and Windows remain separate evidence gates. See [validation](AUTOMATION_VALIDATION.md).
