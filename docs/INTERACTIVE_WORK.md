# Interactive Chat results, Activity and Suggestions

Local implementation, 30 September 2026. This is an unreleased app upgrade; the public skills-only package is unchanged.

## Implemented

- Chat renders shared cards for validated task proposals, cited projects, tasks, meetings and wiki references. Existing calendar preparation records can be opened from the cited occurrence. Task creation receipts resolve to the accepted task.
- Card destinations are constructed by the engine after checking access. Model-provided URLs are not card actions. Uncited context stays in Evidence rather than becoming a result card.
- Task drafts can be edited and saved through the existing proposal operation. Saving does not approve. Exact-payload approval and existing task identities remain authoritative.
- Global Activity opens as a keyboard-dismissable drawer, with Running, Needs attention and Completed views, category filters and cursor pagination. It aggregates permitted AI jobs, intake jobs, connection status and review records.
- Chat stages are persisted at actual context preparation, generation, read-tool submission, response validation and terminal transitions. Legacy runs show only their known status. Cancelled or uncertain dispatches are not retried from cards.
- Inbox Suggestions shares the same cards and proposal IDs. Email and calendar reviews open the existing exact-action editors. Knowledge findings open their existing review; superseded findings stay in history.
- Opening Activity preserves unsent Chat drafts. Visible work polls at bounded intervals and skips hidden documents. Activity refreshes after successful app writes.

## Persistence and contracts

Schema 18 adds `chat_progress` and `chat_result_links` sequentially to schema 17. Progress sequence insertion and terminal transitions use database transactions. Result links retain record identity/version; editable records are not copied into cards. Backup/restore includes these SQLite tables.

Read operations, through the shared registry and authenticated API:

| CLI operation                                      | App API                        |
| -------------------------------------------------- | ------------------------------ |
| `activity list` with optional JSON filter input    | `GET /api/activity`            |
| `activity get ID`                                  | `GET /api/activity/ID`         |
| `suggestions list` with optional JSON filter input | `GET /api/suggestions`         |
| `suggestions get ID`                               | `GET /api/suggestions/ID`      |
| `chat results RUN_ID`                              | `GET /api/chat/results/RUN_ID` |

Filters: `bucket` (`all`, `running`, `attention`, `completed`), `category` (`all`, `chat`, `imports`, `reviews`), `limit` (1–100) and opaque `cursor`. IDs returned by a list should be reused exactly. An invalidated cursor requires refreshing the list.

Existing `chat propose` / `POST /api/chat/propose` accepts an optional edited task alongside the expected run version. Project reassignment is not silently performed by this editor. All other writes retain their existing governed endpoints; there is no generic execute-card API.

## Demonstration

After `npm run build`, run `node scripts/activity-demo.mjs`. It creates a separate temporary fictional workspace and prints an authenticated local app URL. The example contains a Cedar project, source-backed agenda proposal, project citation and two deterministic provider-fixture rounds. No external AI request is made, and no usable API key is installed. Stop with Ctrl-C.

Try Save for review, open the same proposal from Activity or Inbox, inspect evidence, then approve through the existing review. Completed work remains in history. Real generation requires separately configured credentials and disclosure permissions.

## Verification and limits

The new core tests cover ordered progress, idempotent dispatch, restart, backup/restore, schema-17 migration, dismissed suggestions, permission revocation and paginated registry reads. Browser tests cover shared proposal navigation, evidence, dismissal/history, draft retention, keyboard focus and screenshot baselines at 390/768/1280/1440px. Electron checks include imported items in Activity and focus restoration.

Build-specific results live in `.verification/security.json` and local suite logs. These are local macOS synthetic checks, not live-provider certification or clean-machine installation evidence.

Connection rows summarize the latest connection state, not a complete per-sync execution ledger. Poll refresh returns to the first Activity page; use category filters for larger histories. A read-operation stage records validated workflow submission, not model reasoning or a percentage. Older runs without saved citations do not gain invented cards. Receipt timestamps are shown only when the underlying record supplies them.

No follow-up queue, autonomous project/wiki creation, email sending, generic external action runner, new provider, private migration or publication is included. Existing disclosure checks, budgets and tool limits remain in force.

### Recorded local verification — 30 September 2026

Build `cc91cad21889d98ff0ddb0c0e2152c09839fae26baef12de3c0f67dc23e19db7`:

- Core: **227 passed** (`npm run check`, through the security evidence runner).
- Browser: **42 passed**, including four Activity viewport baselines.
- Staged Electron: **2 passed** on macOS arm64.
- Packaged Electron: **2 passed**, exercising import, Activity, isolation, bundled CLI, restart and verified upgraded-copy behavior.
- Separate-copy recovery test preserved ordered Chat progress and job status.
- Fictional Chat demonstration rendered exactly two cards (task proposal and cited project) and opened the referenced project.

An unsigned local ZIP is under `desktop-release/cc91cad21889-2026-09-29T22-35-33.424Z/`. No signing, clean-machine certification, live-provider request or publication was performed.
