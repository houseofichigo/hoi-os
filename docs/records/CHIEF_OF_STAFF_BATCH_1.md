# Chief of Staff — Batch 1

Local implementation, 2026-09-26. Not published. The live HOI workspace was not migrated.

## Delivered

Projects linked to existing project entities; structured evidence-backed task proposals; explicit approve/reject; local tasks with status, owner, outcome, project, optional deadline/timezone and optimistic version; evidence inspection and status history. Projects & Tasks provides review, project/status filters, task details and accessible controls.

One proposal can cite an email, transcript and calendar passage. This is a structured proposal contract, not automatic extraction or cross-source semantic matching. A calendar reference provides context, not proof of a promise or deadline. Human review remains responsible for entailment.

Schema 3 adds projects, task_proposals, tasks, task_evidence and task_history. Upgrades run ordered schema 1→2→3 steps in one database transaction after a verified backup. Schema 1 and 2 backups remain restorable. Schema 2 wikis remain usable before upgrade. Older product binaries must not open schema 3: restore the pre-upgrade backup into a separate directory to roll back.

## Try the synthetic demo

From the product checkout, use a **new** directory outside the checkout. Never substitute the live workspace:

```sh
npm run build
node scripts/task-demo.mjs "../HOI Chief of Staff Demo"
node bin/hoi.mjs app --workspace "../HOI Chief of Staff Demo" --host local --port 0
```

Open the authenticated URL printed by the last command. Select Projects & Tasks, inspect the three references, then approve. There should be one task. Open it, set status to waiting, inspect history, stop and restart the app using the same command: the same task remains. The demo seeder refuses any existing workspace or sibling inputs directory. It places fictional source files in a sibling `<workspace>-inputs` folder, outside protected workspace storage. The fixture uses fictional Cedar, Alex and Morgan records and deliberately leaves the deadline unknown.

## CLI and app API

All commands require an explicit workspace and host; add --json for structured output. Input uses --input file.json.

| CLI operation                       | App endpoint                             |
| ----------------------------------- | ---------------------------------------- |
| project list / project get ID       | GET /api/projects / GET /api/projects/ID |
| project create --input project.json | POST /api/projects/create                |
| task list / task get ID             | GET /api/tasks / GET /api/tasks/ID       |
| task proposals                      | GET /api/tasks/proposals                 |
| task propose --input proposal.json  | POST /api/tasks/propose                  |
| task review --input review.json     | POST /api/tasks/review                   |
| task update --input update.json     | POST /api/tasks/update                   |
| task history ID                     | GET /api/tasks/ID/history                |

Project creation: `{ "entityId": "entity_existing", "objective": "Deliver the pilot", "owner": null }`. The entity must already exist with type project and be visible to the current host. Repeating identical project creation returns the same project; different details conflict.

Proposal creation:

```json
{
  "key": "stable-import-or-proposal-key",
  "task": {
    "projectId": "project_existing",
    "title": "Send revised proposal",
    "outcome": "Provide the reviewed proposal to the client",
    "owner": null,
    "dueDate": null,
    "dueTime": null,
    "timezone": null
  },
  "allowedHosts": ["local", "codex", "claude"],
  "evidence": [
    {
      "revisionId": "revision_existing",
      "passageId": "passage_existing",
      "quote": "Exact source text"
    }
  ]
}
```

Use real IDs and exact quotes from retrieval; placeholders are not executable fixtures. Evidence is required and checked against current revisions on proposal creation/approval. A time requires a valid date and IANA timezone. A date without a time remains a date. Empty owners/deadlines are not inferred.

Review: `{ "id": "proposal_existing", "expectedVersion": 1, "decision": "approved" }`; decision may also be rejected. Same decision with the original expectedVersion is replay-safe. Opposite decisions or stale versions fail. Proposal key reuse with different content fails; identical reuse returns the prior proposal, including its rejection state.

Update: `{ "id": "task_existing", "expectedVersion": 1, "status": "waiting" }`. Batch 1 updates task status only. Supported values: open, in-progress, waiting, blocked, done, cancelled. Editing commitment fields and merge/reopen proposals are Batch 2 work. Every actual status transition increments version and appends history; stale updates return HTTP 409.

App endpoints retain bearer authentication and Host/Origin checks. The map service remains read-only. Task visibility requires host access to the project, proposal and every evidence source, using current source policy even for historical records. Revoking one source hides the entire derived record, including history. Stale-but-permitted source versions remain visible with a warning; new approval requires current evidence. Previously delivered content cannot be recalled from a user's browser; subsequent reads enforce revocation.

Approvals attest to an explicit local operator/assistant command, as with existing HOI reviews; they are not cryptographic proof of a human identity. Runtime permissions remain necessary. A policy requiring draft approval permits the task proposal/review flow but refuses direct project creation or status updates; those require the default allow policy or a future dedicated review flow. No external writes are implemented.

## Validation and limitations

Verified locally on 2026-09-26: 58 core/integration/recovery tests pass, five Chromium checks pass, runtime mirrors match, formatting and git diff whitespace checks pass. These are local macOS results, not a new Windows or fresh-host acceptance claim. Tests cover idempotent and competing reviews, concurrent connections, injected transaction failure, evidence validation, source revocation, migration/restore, authenticated API and keyboard approval with restart persistence.

No private source ingestion, real workspace migration, automatic task extraction, semantic deduplication, Kanban, chat, calendar writes, new runtime skills or publication was performed in this batch. Existing unrelated audits and plan files are preserved. Batch 2 is the next implementation boundary.

## Chat adapter feasibility investigation

Local command help confirms Codex offers app-server with stdio transport and Claude offers print mode, stream-json output and tool restrictions. [OpenAI's App Server documentation](https://learn.chatgpt.com/docs/app-server) describes the interface for custom clients. These are candidate integration surfaces, not evidence that HOI currently has authenticated model or connector access.

Recommendation for Batch 5: an explicitly configured standalone Codex CLI adapter over stdio, with protocol/version checks, controlled tools and approvals. Do not hard-code the desktop-bundled executable discovered on the development machine. Keep a separate Claude adapter boundary; do not move credentials between them. This batch inspected help/documentation only: no model turn, credentials, account identity or private content was requested. Authentication, streaming/cancellation, tool isolation and end-to-end inference remain to be verified before enabling chat. No mandatory API provider was selected.
