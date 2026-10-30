# Intake reliability and knowledge governance — Batch C

Local implementation, 2026-09-26. Schema 11; engine API 1. No private migration, company ingestion, live OAuth authorization, GitHub update or publication was performed.

## Intake and recovery

File imports have persistent jobs with owner, state, attempts, reason codes and preserved results. Interrupted extraction can resume from the checksummed original even when the selected input has disappeared. Retry does not add another occurrence for the same resumed job. Failed preservation never promotes a revision. Job cancellation stops indexing at the next safe checkpoint and retains originals.

Hashing, original preservation and text/CSV extraction run in a reusable worker. Office/PDF extraction retains its bounded child-process isolation. The server can return intake status and accept cancellation while other engine work is pending. SQLite indexing still occurs in the engine; this batch does not claim every database write is nonblocking.

Knowledge Hub → Ingestion shows durable intake jobs, retry/cancel actions and upload states. Commands are also available:

```sh
node bin/hoi.mjs jobs list --workspace "<workspace>" --host local --json
node bin/hoi.mjs jobs resume JOB_ID --workspace "<workspace>" --host local --json
node bin/hoi.mjs jobs cancel JOB_ID --workspace "<workspace>" --host local --json
```

Do not retry a cancelled request implicitly; create a newly reviewed import. Incomplete upload streams still require the user to retry the upload. Only complete, validated bytes become preserved originals.

The upload path now permits only the exact authenticated staging job inside a workspace. Normal private-vault re-ingestion remains rejected, including when a temporary path has a canonical filesystem alias.

## Identity and exclusions

Local source identity uses recorded filesystem identity and location history. A verified move requires the old location to disappear. Where filesystem identity is unavailable, a checksum match is used only when one vanished source matches and no other location of that source still exists. Copies get separate source identities. Ambiguous candidates produce `IDENTITY_REVIEW_REQUIRED`; explicit `--source-id` selects the reviewed identity.

Archive exclusions remain attached to source IDs. Renaming an archived file does not reactivate it. Schema migration seeds location/checksum history for existing local sources without changing their IDs or originals. Provider identities remain provider-based.

Folder sync previews and results report excluded paths, oversized files and inaccessible items. Unsupported content is preserved and reported as an extraction gap. No text interpretation or task approval is implied by indexing.

## Connected synchronization

Sync records item-level outcomes and durable checkpoints. Repeated or interrupted runs reconcile the bounded selected scope against persisted identities and stamps. A successful item is not imported again when an adjacent item fails. Interrupted runs remain visible in history; their active connections resume polling when the engine runs again.

Provider calls have bounded retries, page limits and item budgets. Google list endpoints now follow pages instead of rejecting every second page. Gmail includes additional messages from selected threads for reply context; the preview marks that context. HTML-only bodies convert to plain text without running scripts or fetching images. Attachment content is excluded.

Gmail history IDs and Drive change tokens are recorded only after durable successful reconciliation. Expired cursors trigger a bounded selected-scope rescan. Change feeds are reconciliation hints: the engine still checks selected Gmail queries and Drive membership, rather than trusting a global change event to authorize a new source. Calendar windows explicitly support fixed dates or an approved rolling window. Date-scoped calendar sync remains bounded reconciliation rather than using an unrestricted change-token query.

Three unsuccessful attempts at the same item/version stop automatic extraction retries. Pause, preview and reactivate to explicitly retry that scope. Partial failures retain prior freshness and appear as partial coverage; they do not advance the checkpoint. Disconnect continues to stop intake without deleting imported sources.

Provider contract references: [Gmail synchronization](https://developers.google.com/workspace/gmail/api/guides/sync), [Drive changes](https://developers.google.com/workspace/drive/api/guides/manage-changes), [Calendar list and sync-token restrictions](https://developers.google.com/workspace/calendar/api/v3/reference/events/list). These are implementation references, not live-provider verification.

## Knowledge governance

Findings include evidence, affected records, explanations and suggested actions. Refreshing an unchanged source's sync timestamp no longer recreates a dismissed source finding. Changed evidence still produces a new fingerprint.

Cited wiki/memory proposals can include a supplied effective date, stored separately from their recorded timestamp. Unknown effective dates remain null. `knowledge dates` exposes the records subject to the same evidence permissions.

Entity merges are reviewable redirects, not destructive rewrites. Propose a same-type, same-permission pair, approve its exact digest, and optionally undo it. Original entity IDs, evidence, projects, client records and history remain intact. The derived map resolves reviewed redirects while retaining original edge endpoints. This does not merge project/task database records or perform semantic entity matching.

Use `entity-merge list` and `entity-merge review --input merge.json`. The input action is `propose` (with `from`, `to`, `reason`), `approve`/`reject` (with proposal `id` and exact `digest`), or `undo`. Changing the entities invalidates a pending proposal. Existing overlapping merges must be reviewed first. These controls currently use the CLI; a dedicated merge editor is not part of this batch.

## Verification boundary

Final local validation: `npm run check` passed **135/135 core tests**, including build and runtime catalogue consistency; `npm run test:browser` passed **14/14 browser tests**. The new intake reliability suite accounts for 13 core cases. All fixtures were synthetic.

Synthetic tests cover moves/copies, ambiguous identities, archived renames, oversize/excluded/unsupported files, preservation failures, interrupted extraction, cancellation, paginated Gmail/Drive, expired Gmail history, partial-sync checkpoint safety, dates, reversible merges and schema-10 backup/restore into a separate schema-11 copy. Existing approval/deduplication, permission, browser and recovery suites also remain release gates.

The 1,000-document synthetic retrieval benchmark retained 60/60 answerable recall@5. This is not a real-client quality measurement. Live provider behavior, clean Windows execution, the bounded private migration rehearsal and real-data pilot remain pending. No automatic task extraction, automatic merge approval or calendar mutation was added.
