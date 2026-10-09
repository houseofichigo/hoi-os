# CLI reference

Run `node <product>/bin/hoi.mjs COMMAND --workspace <private-directory> --host codex --json`. Replace host with `claude` when appropriate. Terminal-only operators may select `local`. Structured inputs can be JSON or YAML. Paths with spaces must be quoted.

| Command                                                                               | Input and behavior                                                                                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `init`                                                                                | Create an empty private workspace. Refuses a nonempty uninitialized directory.                                             |
| `doctor`, `audit`                                                                     | Database integrity, permitted source counts, extraction gaps, memory issues and connection attestations.                   |
| `health`                                                                              | Privacy-safe schema, database size, knowledge counts, revision outcomes, workflow counts and diagnostic checks.            |
| `onboard --input FILE`                                                                | Merge supplied name, role, organization, offering, goals, recurringWork, tools, restrictions. Each value is a string.      |
| `context`                                                                             | Return bounded context and current approved memory permitted for the actual host.                                          |
| `connect [--input FILE]`                                                              | Inspect or record host connection status after a real tool check.                                                          |
| `import-connection --input FILE`                                                      | Preserve a normalized provider export; register stable account/object identity.                                            |
| `ingest-plan PATH [--max-files 150] [--max-bytes 1073741824]`                         | Read-only inventory for a file/folder. Returns limits, warnings and a plan hash.                                           |
| `ingest PATH [--metadata FILE]`                                                       | Preserve and extract one explicitly selected file.                                                                         |
| `ingest FOLDER --plan-hash HASH [--max-files N] [--max-bytes N]`                      | Import the exact reviewed, bounded directory plan. Refuses stale or blocked plans.                                         |
| `ingest PATH --source-id ID`                                                          | Import a version or moved file under an existing source identity.                                                          |
| `retrieve QUERY [--client ID] [--project ID] [--source-id ID] [--latest] [--limit 8]` | Return bounded evidence with authority, revision and freshness. A source-only query can omit QUERY.                        |
| `query-data --source-id ID --column amount --operation sum`                           | Typed CSV aggregate: count, sum, min, max, avg. Mixed text/numeric cells fail; units are not inferred.                     |
| `entity --input FILE`                                                                 | Create or update a canonical person, organization, client, project, product, tool, process, location or goal.              |
| `relate --input FILE`                                                                 | Add a supported, inferred or manually declared relationship.                                                               |
| `capture --input FILE`                                                                | Propose a memory.                                                                                                          |
| `review-memory ID --state approved`                                                   | On schema 19 requires `--input` with expectedVersion, expectedChecksum, requestKey and confirm; local review only. `rejected` is also supported.                                                              |
| `consolidate`                                                                         | Report duplicate, stale and proposed memories without changing them.                                                       |
| `organize`                                                                            | Create a concrete plan of working-file copies; never move originals.                                                       |
| `approve PLAN --hash HASH`                                                            | Record approval for the exact reviewed action.                                                                             |
| `organize PLAN --apply --approval ID`                                                 | Apply approved placements; refuse changed sources/policy or conflicting files.                                             |
| `build-capability --input FILE`                                                       | Save a draft capability with registered tools.                                                                             |
| `evaluate CAPABILITY --input FILE`                                                    | Run labeled input/expectedSourceIds cases.                                                                                 |
| `build-capability CAPABILITY --activate`                                              | Activate an exact capability version with a passing evaluation.                                                            |
| `run meeting-prep --input FILE`                                                       | Create a meeting evidence brief and execution ledger record.                                                               |
| `run CAPABILITY --input FILE --resume EXECUTION`                                      | Resume unchanged work at recorded checkpoints.                                                                             |
| `run CAPABILITY --input FILE --approval ID`                                           | Execute an exact approved run when draft policy is approve.                                                                |
| `reindex`                                                                             | Rebuild FTS from immutable passages.                                                                                       |
| `map [--port 4640]`                                                                   | Start the optional read-only localhost map.                                                                                |
| `backup DESTINATION`                                                                  | Create a new backup outside the workspace with checksums and a consistent SQLite snapshot.                                 |
| `restore BACKUP`                                                                      | Verify, stage and restore; retain the previous workspace beside the restored one. Stop active commands/map first.          |
| `upgrade BACKUP_DESTINATION`                                                          | Take a verified backup, then migrate a supported older workspace sequentially to the current schema; see COMPATIBILITY.md. |

## Bounded directory ingestion

Plan first:

```sh
hoi ingest-plan "SOURCE_FOLDER" --workspace WS --host codex \
  --max-files 150 --max-bytes 1073741824 --json
```

Review `fileCount`, `totalBytes`, `extensions`, `existingLocations`, `warnings`, `blocked` and `planHash`. Then import the unchanged selection with the exact same limits:

```sh
hoi ingest "SOURCE_FOLDER" --workspace WS --host codex \
  --plan-hash "PLAN_HASH" --max-files 150 --max-bytes 1073741824 --json
```

The default directory limits are 150 files and 1 GiB. Disk roots and the current user's home directory are blocked. A changed file list, size or modification time changes the hash and requires a new plan. Excluded paths and symlinks remain excluded. Single explicitly selected files retain the shorter `ingest FILE` route.

## Example metadata

```json
{
  "title": "Atlas signed proposal",
  "documentType": "proposal",
  "authority": "primary",
  "sensitivity": "internal",
  "allowedHosts": ["codex", "claude", "local"],
  "status": "signed",
  "effectiveDate": "2026-09-12",
  "client": "entity_atlas",
  "project": "entity_pilot"
}
```

Create referenced entities first. Missing authority defaults to secondary, status to unknown, date to null. Restricted sources default to denied by policy even if their host allowlist includes the current host.

## Example entity and relationship

```json
{
  "id": "entity_atlas",
  "type": "client",
  "name": "Atlas Collective",
  "aliases": ["Atlas"]
}
```

```json
{
  "from": "entity_pilot",
  "to": "entity_atlas",
  "type": "FOR_CLIENT",
  "basis": "manual"
}
```

For supported relationships, supply at least one evidence item: `{"revisionId":"revision_...","passageId":"passage_...","quote":"exact source substring"}`. Inferred relationships remain visibly labeled. Never submit invented IDs.

## Example meeting

```json
{
  "title": "Atlas pilot review",
  "start": "2026-10-12T10:00:00+02:00",
  "participants": ["Taylor Morgan"],
  "client": "entity_atlas",
  "project": "entity_pilot",
  "query": "pilot milestones decisions",
  "objectives": ["Review the pilot scope"],
  "eventEvidence": []
}
```

An empty eventEvidence list means the event is user-supplied and not verified live. The returned Markdown is saved under executions and links to preserved originals; passage/revision IDs accompany each citation. The assistant should synthesize only supported conclusions and explicitly state missing information.

## Example memory

```json
{
  "type": "decision",
  "content": "Proceed with the discovery pilot.",
  "durability": "project",
  "entities": ["entity_pilot"],
  "evidence": []
}
```

An evidence-free decision must be confirmed by the user. It is learned memory, not documentary proof. Use `supersedes` for a revised decision.

## Capability contract

Copy the workspace's capabilities/meeting-prep.yaml, choose a distinct ID, and keep only registered steps. All current workflows use the meeting-input contract. This is a constrained capability builder, not a universal automation engine. Evaluation input is an array:

```json
[
  {
    "name": "pilot evidence",
    "input": {
      "title": "Atlas pilot",
      "start": "2026-10-12T10:00:00Z",
      "query": "Atlas"
    },
    "expectedSourceIds": ["source_actual_id"]
  }
]
```

If policy requires drafting approval, first inspect the run's awaiting-approval response, approve its plan/hash, then rerun with the approval ID. Evaluation does not bypass policy; run it in a test workspace whose policy permits local drafts.

## Wiki pages

Wiki pages are synthesized current views backed by immutable passage evidence. They require database schema 2; run `upgrade BACKUP_DIR` on an existing workspace first (a verified backup is taken before migration).

```
hoi wiki propose --workspace WS --host claude --input page.json
hoi wiki list --workspace WS --host claude --json
hoi wiki get house-of-ichigo --workspace WS --host claude
hoi wiki review WIKI_ID --state reviewed --workspace WS --host claude
hoi wiki canonical WIKI_ID --workspace WS --host claude
hoi wiki contradictions --workspace WS --host claude --json
```

Example `page.json`:

```json
{
  "slug": "house-of-ichigo",
  "title": "House of Ichigo",
  "type": "company",
  "content": "## Positioning\n\nTraining and advisory.",
  "entities": [],
  "effectiveDate": null,
  "evidence": [
    {
      "revisionId": "revision_x",
      "passageId": "passage_y",
      "quote": "exact text present in the passage",
      "relation": "supports"
    }
  ]
}
```

Every page starts as a draft. `review` records the human decision, `canonical` promotes a reviewed page and marks the superseded page. A canonical page is never replaced silently: propose the successor with `supersedes` set to the canonical page ID. `contradictions` is a mechanical report (duplicate active pages, stale evidence, recorded contradiction relations); semantic conflicts between sources require human review.

## Registries

Capability step tools, hosts, and connector providers validate against runtime registries (`src/tools.ts`, `src/hosts.ts`, `src/connectors.ts`) instead of fixed lists. Built-ins register at load: tools `context`, `retrieve`, `meeting-brief`; hosts `codex`, `claude`, `local`; connectors `gmail`, `calendar`, `drive`, `github`, `files`. New entries are added with `registerTool`, `registerHost`, and `registerConnector` — no schema edit required. Tool constraints (required preceding step, minimum autonomy, citation production) are declared by each tool and enforced when a capability is saved, activated, or run.

## Workspace App

```
hoi app --workspace WS --host claude [--port 0]
```

Serves the local Workspace App on 127.0.0.1 with a bearer token (default port 4641). Exposes read endpoints plus exactly four reviewable mutations: wiki propose/review/canonical and memory review. Holds the workspace write lock while running. See docs/APP.md.

## Optional assistant adapters (unreleased local checkout)

`adapter status`, `adapter install codex|claude|both` and `adapter remove codex|claude|both` use the shared engine when it is running. Supply `--workspace` explicitly. Installation validates the engine API and required operations, takes a verified backup and archives existing adapter files with checksums. Local edits are retained and reported as conflicts. Removal affects only installer-tracked files; unrelated skills and manual text survive.

Configuration exposes the same local actions. `verified` means instruction-package integrity, not a verified assistant runtime. App-only workspaces report missing optional adapters as informational. Current generated facts are in [COMPATIBILITY.md](COMPATIBILITY.md); old tagged releases do not provide these commands.

## Intake recovery and entity review (schema 11)

- `jobs list`: per-host durable intake state and reason codes.
- `jobs resume ID`: resume from preserved originals; cancelled imports require a new reviewed import.
- `jobs cancel ID`: request cancellation at a safe indexing boundary; originals remain preserved.
- `knowledge dates`: supplied effective dates and separate recorded timestamps, filtered by source permissions.
- `entity-merge list`: visible proposals and history.
- `entity-merge review --input merge.json`: propose, approve/reject by exact digest, or undo a reviewed entity redirect. Original records are retained.

These use the same explicit workspace/host arguments as other commands. See [Batch C](ENGINE_BATCH_C.md) for examples and limitations. `ingest --source-id ID` selects a reviewed source identity after an ambiguous move warning. Sync previews disclose selected thread reply context and skipped files; schema-11 run history includes per-item outcomes.

## Daily workspace (schema 12)

- `dashboard --input options.json`: optional `date` and `timezone`; defaults to stored workspace timezone and current local date. Returns signals with coverage and typed record actions.
- `preferences get` / `preferences save --input preferences.json`: `{ "expectedVersion": 0, "timezone": "Europe/Paris" }`.
- `views project` (or `client`, `training`): workspace/host-scoped saved settings and version.
- `views save --input views.json`: `{ "kind": "project", "expectedVersion": 0, "views": [{ "name": "Active", "query": "", "filter": "in-progress", "sort": "name", "columns": ["status", "owner"], "view": "table" }] }`. Empty views explicitly clears the saved set.
- `processing list`: requests visible to their creator or target host, subject to source permissions.
- `processing prepare --input request.json`: `{ "sourceId": "…", "revisionId": "…", "assistant": "codex" }` returns a persisted request ID, digest and handoff.
- `processing complete --input result.json --host codex`: `{ "requestId": "…", "digest": "…", "runIds": [], "proposalIds": [], "wikiIds": [], "memoryIds": [] }`. Requires at least one valid stored result. Completed extraction runs may contain zero commitments. Results must support the exact requested revision; this never approves proposals.

These operations use the running engine. The app has corresponding authenticated routes. Chat remains assistant handoff; manual review completion never claims a validated assistant result.

## Reviewed skill library (schema 14)

Use `skills list` and `skills get NAME` for catalog/detail reads.
`skills preview|commit|draft|control|sync-preview|sync --input FILE` use the same validated engine operations as the app. Detail reads take the skill name as a positional argument; draft input includes `name`, `expectedVersion`, `markdown` and optional `fromRevision`. Control input includes `name`, `expectedVersion`, `action` (activate/disable/revert); activation also requires exact `revisionId` and `checksum`. Sync requires a reviewed preview digest and installed adapter. See [Consulting and Skills](CONSULTING_SKILLS.md).

## Activity and turn results (local schema 18)

`activity list`, `activity get ID`, `suggestions list`, `suggestions get ID`, and `chat results RUN_ID` are permission-filtered reads. List operations accept JSON input with `bucket`, `category`, `limit` and `cursor`. See [Interactive work](INTERACTIVE_WORK.md) for filters, API routes and review boundaries.
