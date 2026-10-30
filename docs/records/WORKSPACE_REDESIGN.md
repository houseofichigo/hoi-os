# Chief of Staff workspace redesign

Local alpha implementation. No real company intake, private workspace migration, calendar write or publication performed.

## Five reviewable deliveries

| Delivery                     | Local implementation                                                                                                                                                                                                                       | Demonstration                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Navigation and Knowledge Hub | Six top-level sections; Overview, Sources, Ingestion, Wiki, Memory, Map and Reviews; streamed file/folder uploads; impact-bound archive/restore; explicit historical evidence                                                              | Import a fictional document, inspect affected records, archive it, verify active retrieval excludes it, restore the same identity |
| Clients and Projects         | Client gallery/table, editable profiles, linked projects, project table/board, saved browser views, task-derived progress, modal detail editor, version history and client delivery sessions                                               | Create a client, link a project, edit its properties, reject a stale edit, reopen after restart                                   |
| Home                         | Attention, meetings, reply candidates, deadlines, waiting-for and upcoming trainings; underlying lists and Today workflow; connection freshness                                                                                            | Compare the fictional dashboard with its approved tasks and event evidence                                                        |
| Automatic intake             | Local folders and direct read-only Google adapters; user-owned desktop OAuth/PKCE; OS keyring credentials; reviewed scopes; five-minute in-process polling; per-item checkpoints; manual sync/pause/disconnect; assistant processing queue | Activate a bounded fictional folder, sync twice, change a file, archive it, verify exclusion survives another connection          |
| Configuration and hardening  | Skill catalogue, executable capabilities/history, assistant/search availability, connector history, health and security checks; `hoi-security` and updated `hoi-audit`                                                                     | Check unavailable providers, scoped findings, synthetic regressions and recovery                                                  |

The interface uses English and current HOI colours/type. Client cards are flat as requested. Chat remains explicit Claude/Codex handoff. Web search is assistant-mediated; there is no native search engine or model API requirement.

## Architecture and interfaces

Sequential schema migrations add source lifecycle/import jobs (8), editable workspace records/history/email review (9), and connection jobs/checkpoints/assistant assignments (10). Existing source, project, task, approval and evidence IDs remain stable. `upgrade` retains the verified-backup requirement. Do not migrate the live workspace merely to view this redesign.

Shared commands:

```text
hoi source list|impact ID|change --input change.json|scan|review --input review.json
hoi records client|project|training
hoi records save --input record.json
hoi dashboard --input options.json
hoi sync create --input connection.json
hoi sync preview CONNECTION_ID
hoi sync control --input decision.json
hoi sync run CONNECTION_ID
hoi configuration
hoi security
```

All commands use the explicitly selected `--workspace`, actual `--host` and optional `--json`. Record edits use `{kind,id?,expectedVersion,record}`; source changes use `{id,expectedVersion,digest,state}`. Lifecycle state is `active` or `archived`. Source impact must be reviewed again when its digest changes.

Authenticated app routes mirror the core: `/api/hub/*`, `/api/records/*`, `/api/dashboard`, `/api/email/review`, `/api/sync/*`, `/api/configuration`, `/api/security`. Upload bytes use POST `/api/hub/upload/<job-id>` after a reviewed manifest. The server enforces declared size, 50 MB per file, checksums, safe basenames and existing same-origin/token checks. Source history is explicit and remains permission-checked. Originals are not deleted by archiving; sync identities remain excluded until restoration.

Unassigned communications are indexed without invented projects. Assign them from the assistant processing queue before extracting project tasks or preparing a project meeting. Assignment changes are refused once extraction is in review. New revisions reopen assistant processing; marking review complete is an explicit user action, not evidence of autonomous AI work.

## Google and local connection setup

In Configuration → Connections, choose a provider and a bounded scope. Local folders exclude hidden files/directories, symlinks, node_modules, generated output and backup/original archive folders. The initial scope limit is 150 items; local folder previews also cap selected bytes at 1 GB. Larger selections require narrowing the scope; the app does not silently call a partial scan complete.

For Google, create a user-owned **Desktop application** OAuth client, enable the selected provider API, and enter its client ID/secret into the local app. The app prepares a Google consent URL, verifies OAuth state/PKCE on a temporary loopback callback and confirms account identity. Credentials and refresh tokens are stored through `@napi-rs/keyring` in the OS credential store. No plaintext credential fallback is provided. Credential-store failures and expired/revoked tokens require reconnecting. A reconnect cannot silently change an existing connection's account identity.

Gmail uses `gmail.readonly`, Calendar uses `calendar.readonly`, Drive uses `drive.readonly`, plus Google identity scopes. Calendar write credentials remain separate: read-only sync does not enable the approved-event write adapter.

Preview and activate each scope before syncing. Polling runs only while the local app server runs; **Sync now** starts immediately. No daemon is installed. Interrupted runs become paused and retain completed item checkpoints; review the scope and resume explicitly. Transient provider responses receive bounded retries. Disconnect removes the local credential and stops intake, while preserving imported sources. Provider-side grant revocation remains available in the user's Google account.

Current adapters use **bounded full-scope reconciliation with durable per-item version/checksum checkpoints**, not unbounded mailbox ingestion or provider history-cursor polling. This avoids claiming partial history coverage as complete, at the cost of more read requests. Gmail examines metadata for selected threads, including their outgoing replies. Plain-text bodies are preserved with quotation boundaries; HTML-only mail stops with an explicit extraction error and preserves the raw provider response for review. Attachment IDs in provider responses do not imply attachment bytes were imported; upload needed attachments separately. Drive exports Google Docs/Sheets/Slides to supported Office formats. Calendar records retain occurrence identity and timezone; cancelled instances update existing records when timing can be recovered.

Read scopes are not model-data scopes: imported content is indexed locally. Wiki writing, semantic decisions and task extraction remain assistant-handoff proposals. No new model runtime, API key or unattended interpretation is installed.

Local-folder identities currently use resolved paths. Moving or renaming a file can create a new source identity; archive exclusions do not follow that rename. Keep selected folder paths stable during the alpha pilot. Pause takes effect between items, so an already-started download may finish before the connection pauses.

## Signals, permissions and security

Reply candidates use the latest visible non-draft/non-trash/non-spam thread message. Incoming messages older than 24 hours without a later known outgoing reply can be confirmed, dismissed or snoozed. Automated/list mail is excluded. Coverage is always described as selected threads; an empty set is not proof that the whole inbox is handled.

Project/client progress is completed visible accepted tasks divided by visible non-cancelled accepted tasks. Empty denominators display Not measured. Completed/cancelled work is excluded from deadline alerts. Training records represent client delivery sessions, manually entered/confirmed; no automatic classification claim is made.

Permissions apply to source titles, active evidence, derived records, dashboard aggregation and graph projections. Historical source access is explicit and still checks host/restricted-source policy. Source review findings describe mechanical evidence and suggest keep/verify/update/archive; archive uses a separate impact review. Unchanged dismissed findings remain recorded.

Security checks report pass/fail/not-tested per domain. Configuration checks are not live exploit testing or certification. Authentication/origin, containment, exact approvals and permission checks rely on their regression/live verification evidence rather than a fabricated security score. Credentials never belong in diagnostic exports or source archives.

## Verification and rollout

Run `npm run check` and `npm run test:browser`. Additional tests cover upload interruption/limits, archive exclusion and recovery, stale edits, bounded local sync, duplicate scopes, quote boundaries, reply handling, OAuth callback/PKCE with mocked providers, missing credentials and restoration from an earlier schema. Browser tests cover navigation, upload/archive/restore, clients/projects, source review, narrow layouts and the existing task/chat/map workflows.

Local validation on 2026-09-26: all 115 core tests and 12 browser tests passed. On the recorded Apple M5 machine, the 1,000-document map fixture reached its usable list in 211 ms and interactive graph in 1,302 ms. The new gallery and dashboard were also inspected in the in-app browser using a fictional workspace. These measurements describe this test run, not a cross-platform performance guarantee.

Create a new fictional preview:

```text
npm run build
node scripts/workspace-demo.mjs "<new synthetic workspace>"
node bin/hoi.mjs app --workspace "<new synthetic workspace>" --host local --port 0
```

Live Google authentication/provider behaviour, keyring access on each target OS, clean Windows installation, real extraction/deduplication quality and the ten-day pilot remain verification gates. Do not infer those from mocked providers or local macOS tests. The product remains alpha and existing GitHub assets are unchanged.
