# CLI reference

Run `node <product>/bin/hoi.mjs COMMAND --workspace <private-directory> --host codex --json`. Replace host with `claude` when appropriate. Terminal-only operators may select `local`. Structured inputs can be JSON or YAML. Paths with spaces must be quoted.

| Command                                                                               | Input and behavior                                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `init`                                                                                | Create an empty private workspace. Refuses a nonempty uninitialized directory.                                        |
| `doctor`, `audit`                                                                     | Database integrity, permitted source counts, extraction gaps, memory issues and connection attestations.              |
| `onboard --input FILE`                                                                | Merge supplied name, role, organization, offering, goals, recurringWork, tools, restrictions. Each value is a string. |
| `context`                                                                             | Return bounded context and current approved memory permitted for the actual host.                                     |
| `connect [--input FILE]`                                                              | Inspect or record host connection status after a real tool check.                                                     |
| `import-connection --input FILE`                                                      | Preserve a normalized provider export; register stable account/object identity.                                       |
| `ingest PATH [--metadata FILE]`                                                       | Preserve originals and extract supported file/folder contents.                                                        |
| `ingest PATH --source-id ID`                                                          | Import a version or moved file under an existing source identity.                                                     |
| `retrieve QUERY [--client ID] [--project ID] [--source-id ID] [--latest] [--limit 8]` | Return bounded evidence with authority, revision and freshness. A source-only query can omit QUERY.                   |
| `query-data --source-id ID --column amount --operation sum`                           | Typed CSV aggregate: count, sum, min, max, avg. Mixed text/numeric cells fail; units are not inferred.                |
| `entity --input FILE`                                                                 | Create or update a canonical person, organization, client, project, product, tool, process, location or goal.         |
| `relate --input FILE`                                                                 | Add a supported, inferred or manually declared relationship.                                                          |
| `capture --input FILE`                                                                | Propose a memory.                                                                                                     |
| `review-memory ID --state approved`                                                   | Approve exact reviewed content. `rejected` is also supported.                                                         |
| `consolidate`                                                                         | Report duplicate, stale and proposed memories without changing them.                                                  |
| `organize`                                                                            | Create a concrete plan of working-file copies; never move originals.                                                  |
| `approve PLAN --hash HASH`                                                            | Record approval for the exact reviewed action.                                                                        |
| `organize PLAN --apply --approval ID`                                                 | Apply approved placements; refuse changed sources/policy or conflicting files.                                        |
| `build-capability --input FILE`                                                       | Save a draft capability with registered tools.                                                                        |
| `evaluate CAPABILITY --input FILE`                                                    | Run labeled input/expectedSourceIds cases.                                                                            |
| `build-capability CAPABILITY --activate`                                              | Activate an exact capability version with a passing evaluation.                                                       |
| `run meeting-prep --input FILE`                                                       | Create a meeting evidence brief and execution ledger record.                                                          |
| `run CAPABILITY --input FILE --resume EXECUTION`                                      | Resume unchanged work at recorded checkpoints.                                                                        |
| `run CAPABILITY --input FILE --approval ID`                                           | Execute an exact approved run when draft policy is approve.                                                           |
| `reindex`                                                                             | Rebuild FTS from immutable passages.                                                                                  |
| `map [--port 4640]`                                                                   | Start the optional read-only localhost map.                                                                           |
| `backup DESTINATION`                                                                  | Create a new backup outside the workspace with checksums and a consistent SQLite snapshot.                            |
| `restore BACKUP`                                                                      | Verify, stage and restore; retain the previous workspace beside the restored one. Stop active commands/map first.     |
| `upgrade BACKUP_DESTINATION`                                                          | Preserve the current schema-1 workspace before checking compatibility; no later-schema migration exists yet.          |

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
