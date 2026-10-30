# Actionable daily workspace — Batch D

Local implementation, 2026-09-26. Schema 12; engine API 1. No private migration, company ingestion, external action or GitHub update.

## Working behavior

Home returns six structured signals. Each has permitted underlying records, typed record actions, coverage state, scope and last refresh. Fresh successful selected Gmail/calendar scopes can legitimately report zero. Missing coverage is unknown; untracked exports/incomplete windows/restricted evidence are partial; stopped/revoked/older-than-15-minute sync coverage is stale. Coverage never claims all accounts or all commitments are known. Recorded workspace lists explicitly limit their claim to visible recorded work.

Overdue work appears under attention, outside the next seven-day deadline window (today inclusive, day seven exclusive). Done/cancelled tasks and completed/cancelled projects are excluded. Timed deadlines are converted into the workspace timezone; date-only values remain dates. Ambiguous daylight-saving wall times require review instead of invented overdue precision. Workspace timezone defaults to Europe/Paris and is editable in Home.

Signal links open the exact task/evidence, proposal, project, training, source or connection; meetings prepare their exact recorded occurrence. Keyboard focus is moved to the task, proposal, source or connection; record editors retain native dialog behavior. Back to Home is available. Unassigned events still explain the project assignment required for meeting preparation.

Reply candidates display sender, age, latest visible unquoted text, passage evidence and review status. Incoming messages older than 24 hours remain candidates, not inferred obligations. Review binds to the revision as well as update timestamp. Dismissal/snooze hides the reviewed candidate; a later incoming message can reopen it after its age threshold. A known later outgoing reply clears the candidate. Source coverage remains explicit.

Saved table/board/gallery settings now live in SQLite, scoped to workspace and host. Version checks reject stale changes. A fresh browser session receives the same saved views. Old browser-only preferences are not silently migrated between workspaces; save the desired view again. Project/client layouts and accessible lazy map remain intact.

Assistant-processing handoffs persist the source revision, selected assistant and digest. A target assistant can submit completed stored extraction-run IDs and evidence-linked task/wiki/memory proposal IDs. Invalid references, wrong hosts, mismatched revisions and conflicting repeated results are refused. Completed zero-commitment extraction is valid evidence of processing. Stored-reference validation is not factual-quality certification or approval. User-marked review remains a separate queue state. The linked extraction runs retain their existing execution/submission records. No model is invoked by this flow.

## Validation

Final local checks: **143/143 core tests** passed with build and generated-catalogue consistency; **17/17 browser tests** passed. The HOI brand checker passed for the changed dashboard, processing, records and app stylesheet. The synthetic 1,000-document map measured 301 ms to its list and 1,324 ms to its graph on Apple M5. These are local synthetic measurements, not live-provider or clean-platform proof. Dedicated tests cover scope freshness/empty counts, restricted evidence, DST/deadlines, saved-view isolation/versioning/reopen, email review, processing-result validation and schema-11 backup/restore into an isolated schema-12 copy. Browser checks exercise exact record navigation/focus, saved views in a fresh context, handoff/manual-review labels and narrow reduced-motion layout. Existing map, task approval, chat, recovery and source lifecycle tests remain required.

## Limits and next batch

Live Google behavior, fresh real assistant sessions, clean Windows/macOS packaging and the bounded real-data pilot remain pending. The browser/developer app still needs Node; Batch E packages Electron. This is alpha. Native distribution, security evidence and the pilot gates in [COMPLETION_PLAN.md](COMPLETION_PLAN.md) precede the final GitHub update.

Implementation scope and checklist: [specification](../specs/004-daily-workspace/spec.md), [tasks](../specs/004-daily-workspace/tasks.md). Spec Kit was researched but not installed; these are local planning artifacts, not generated Spec Kit scaffolding.
