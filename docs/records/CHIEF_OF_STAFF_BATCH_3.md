# Chief of Staff — Batch 3

Local alpha implementation: Today, explained priorities, promises, waiting-for work, project Kanban, a seven-day agenda, cited meeting preparation and local preparation-slot suggestions. Uses schema 4; no live workspace migration or calendar writes.

## Demonstration

```sh
npm run build
node scripts/daily-demo.mjs "../HOI Daily Demo"
node bin/hoi.mjs app --workspace "../HOI Daily Demo" --host local --port 0
```

The demo refuses an existing directory. It creates fictional Cedar tasks and an explicitly timed event. Open the printed URL, select Today, enter `Alex (fictional)` as your recorded owner name and Refresh daily work. Compare priorities, My promises and Waiting for. Open Project Kanban and move a task with its labeled status selector. Prepare the Cedar event and inspect the source passages.

The fixture intentionally leaves availability unconfirmed. No preparation slot is presented as free until the full window is explicitly confirmed. This demonstrates missing-data handling, not a live connector.

## Daily views

Only approved tasks appear. Completed/cancelled work remains on Kanban and is excluded from active priorities. Priority reasons distinguish overdue dates/times, due today, future deadlines and unknown deadlines. Waiting/blocked items receive a lower action priority and an explicit follow-up/unblock explanation. This is a deterministic ordering, not an AI judgment about commercial importance.

My promises means active approved tasks whose recorded owner exactly matches the supplied name. Unknown owners are not guessed. Waiting for means tasks explicitly marked waiting. Kanban uses the same version-checked status update as Projects & Tasks, with native keyboard-accessible selects rather than drag-only controls. Evidence and stale-evidence indicators remain available.

The selected date starts a rolling seven-day window; it is not necessarily Monday. Working days default to Monday–Friday, 09:00–18:00. The UI permits timezone, working hours, preparation duration and buffers to be changed; CLI/API also support a weekdays array (Sunday=0). Settings are request-scoped and do not change global preferences.

## Explicit calendar timing

Normalized calendar input now accepts:

```json
{
  "calendar": {
    "start": "2026-10-19T15:00:00+02:00",
    "end": "2026-10-19T16:00:00+02:00",
    "participants": ["Alex (fictional)", "Morgan (fictional)"],
    "busy": true,
    "allDay": false
  }
}
```

This is an additional field in the Batch 2 intake object, not a standalone import. Use explicit offsets and an IANA timezone. All-day busy periods still need explicit boundary instants, with end exclusive. Recurring occurrences retain their stable recurrenceId and supplied offset; the system does not expand recurrence rules. Timing changes create new immutable evidence. Cancelled/obsolete instances do not appear as upcoming meetings.

Legacy calendar imports without timing remain preserved but cannot safely support availability. Reimport unchanged content with a newer checkedAt to refresh it: the new check is archived, while the source revision and extracted mentions remain unchanged. This supersedes Batch 2's initial behavior of retaining the first check timestamp.

## Availability and preparation slots

A selected set of events cannot prove that a calendar is free. Supply coverage only after checking **all calendars and busy periods that constrain the user**, including other projects. In the UI, Working hours and availability accepts the coverage object from this example:

```json
{
  "date": "2026-10-19",
  "timezone": "Europe/Paris",
  "owner": "Alex (fictional)",
  "workStart": "09:00",
  "workEnd": "18:00",
  "weekdays": [1, 2, 3, 4, 5],
  "prepMinutes": 30,
  "bufferMinutes": 15,
  "coverage": {
    "from": "2026-10-18T22:00:00Z",
    "to": "2026-10-25T23:00:00Z",
    "checkedAt": "2026-10-19T07:00:00Z",
    "complete": true
  }
}
```

These are fictional example dates, not a current availability attestation. The window includes the Paris daylight-saving change, so its UTC boundaries differ.

Coverage must encompass the entire seven-day window and be checked within 24 hours, with no future check timestamp. Relevant stale exports, unreadable calendar sources, unfinished imports or unknown event timing suppress suggestions. Missing live connections are shown separately; complete exported availability can support local suggestions without a live connector.

Suggestions search backward before each future timed event, within working hours and after the current instant, in 15-minute increments. They honor busy periods and buffers across every project, and reserve suggested slots against later suggestions. All-day events block time but do not generate meeting-preparation suggestions. No fitting slot produces an explicit gap. Ambiguous/nonexistent local-time boundaries fail closed; date-only task deadlines are never converted to midnight deadlines.

Suggestions are ephemeral. Nothing is booked, approved for execution or sent externally. Availability must be rechecked before any future booking workflow. Travel, focus time and lunch must be represented as busy intervals or excluded by working hours; they are not inferred.

## Meeting preparation and shared interfaces

`daily meeting INTAKE_ID` prepares the exact current event instance, with participants, project objective, current project tasks, approved project decisions, related documents and source references. It exposes unknown client/objectives, missing participants/documents, stale event checks and stale task evidence. Project documents must have metadata.project set to the existing project **entity ID**, not the operational project record ID.

The existing `run meeting-prep` capability also includes current tasks and approved decisions when its project entity is supplied. Its execution/resume digest includes operational context, so task changes cannot return an old cached brief. Existing input semantics remain unchanged. The app brief is a read-only preparation view; the workflow runner remains the path for checkpointed saved executions. The core does not generate new promises or infer deadlines from events.

```sh
node bin/hoi.mjs daily --input daily-options.json --workspace "../Private Workspace" --host codex --json
node bin/hoi.mjs daily meeting INTAKE_ID --workspace "../Private Workspace" --host codex --json
```

Use the same commands with --host claude. Stop the app before CLI commands against its workspace, because the app owns the workspace lock. Both interfaces call shared core operations. Authenticated app POST `/api/daily/view` accepts daily options, and `/api/daily/meeting` accepts `{ "id": "intake_id" }`. Both calculate read-only results. Calendar writes are not exposed.

Meeting preparation fails visibly if assembled context exceeds the workspace budget. Document retrieval is bounded and reports truncation. Approved decisions use the existing permitted, current-memory selection; no new memory backend was added.

## Verification and remaining limits

Validation on 26 September 2026: `npm run check` passes all **76 core tests** and skill-mirror checks; `npm run test:browser` passes all **seven browser checks**. The new UI passes the mechanical HOI brand check.

Synthetic macOS tests cover priorities, owner scoping, waiting state, date-only deadlines, DST changes, absent/stale/restricted availability, different-project conflicts, no-fit slots, recurring/cancelled/updated events, rechecks, cited project documents and decisions, and stale workflow resume after task changes. Browser coverage exercises Today, filters, native status controls, meeting citations and a narrow viewport alongside existing intake/task/map regressions.

Real-project utility, live calendar reliability, participant identity resolution, task extraction quality, Windows and fresh-host verification remain pilot gates. The model is not invoked by these views; evidence-based synthesis can be performed by the active assistant. The private workspace and GitHub release remain unchanged. Batch 4 (Brain maintenance and skills) is separate.
