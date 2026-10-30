# Chief of Staff — Batch 4

Local alpha implementation: knowledge maintenance queue, cited wiki/memory draft submission, review history, persisted task/project map relationships, and two portable skills. The live workspace and GitHub release are unchanged.

## Demonstration

```sh
npm run build
node scripts/maintenance-demo.mjs "../HOI Knowledge Demo"
node bin/hoi.mjs app --workspace "../HOI Knowledge Demo" --host local --port 0
```

Use a new directory. The seeder refuses existing workspaces and creates fictional Cedar tasks, a wiki page with changed evidence, and expired memory. Open **Wiki → Scan knowledge**. Inspect the quotations, keep the wiki finding or archive the expired memory, then scan again. An unchanged reviewed finding stays closed. Restart the app: history remains and retired knowledge stays out of active views. The originals remain stored.

The map now includes approved tasks, their recorded project-entity links and supporting evidence. It uses the same permitted task records as Projects & Tasks. Project edges are declared relationships; evidence edges preserve exact passage/revision references. Dates come from recorded task deadlines and approval timestamps. No inferred ownership or dates are added.

## Findings and decisions

The scan records these mechanical findings:

- Source revisions changed since wiki/memory evidence was recorded.
- Wiki evidence explicitly marked as contradicting a page.
- Exact normalized content duplicates or matching wiki slugs.
- Supporting sources marked superseded, including offering information.
- Memory past its explicit validUntil date.

Age alone does not establish that an offering is obsolete. Semantic contradictions, paraphrase duplicates and usefulness require assistant/human review; the scanner does not claim to discover them comprehensively. Findings identify the relevant source quotations and retain their original snapshots.

| Decision                   | Effect                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| Keep                       | Close this unchanged finding; retain the record in active views              |
| Reject                     | Dismiss this unchanged finding; retain the record                            |
| Archive                    | Retire the selected record from active wiki/memory/context/map views         |
| Update / merge / supersede | Retire the selected record in favor of one exact cited, reviewed replacement |

The last three actions share a retirement mechanism but retain different decision labels in history. **They do not generate or merge text.** Draft and review the replacement first, preserving important distinctions and access restrictions. A merge must be based on explicit comparison, not a matching title alone. The UI shows replacement text and quotations before a decision.

No originals are deleted. Schema-5 dispositions overlay active views; wiki Markdown and memory files remain locally preserved. Wiki review/canonical note writes now archive the prior note version. There is no automatic undo command; historical decisions are retained and recovery uses verified backups.

## Proposals and exact review contract

Use the existing wiki/memory proposal schemas through the new shared wrapper:

```json
{
  "kind": "memory",
  "input": {
    "type": "decision",
    "content": "The reviewed decision supported by the source.",
    "allowedHosts": ["codex", "claude", "local"],
    "evidence": [
      {
        "revisionId": "revision_from_retrieval",
        "passageId": "passage_from_retrieval",
        "quote": "Exact source text"
      }
    ]
  }
}
```

Use `kind: wiki` with slug/title/type/content/evidence and the other existing wiki fields. Evidence is mandatory in this wrapper. Submitted records start as drafts/proposals; they are not approved automatically. Review through Wiki or Memory before selecting them as a replacement. The existing canonical/supersedes workflow remains available. A standalone reviewed replacement can be linked using the maintenance queue; the queue does not itself make that wiki canonical.

```sh
node bin/hoi.mjs knowledge scan --workspace "../Private Workspace" --host codex --json
node bin/hoi.mjs knowledge propose --input proposal.json --workspace "../Private Workspace" --host codex --json
node bin/hoi.mjs knowledge replacements --workspace "../Private Workspace" --host codex --json
node bin/hoi.mjs knowledge review --input review.json --workspace "../Private Workspace" --host codex --json
```

A simple review is `{ "id": "review_from_scan", "expectedVersion": 1, "targetId": "record_from_finding", "action": "keep" }`. Update/merge/supersede additionally require replacementId and replacementDigest from `knowledge replacements`. The replacement must be a different record of the same kind, visible to the host, reviewed/approved, current and cited. It must not broaden host permissions.

Fingerprinting includes the record snapshot and current source revision/metadata. Changed evidence invalidates pending reviews and produces new findings on scan. Exact decision retries are idempotent; competing decisions fail. Unchanged keep/reject decisions do not repeatedly return as pending. Retired records and changed findings stay in history, with current=false where applicable.

Authenticated app API: GET `/api/knowledge`, `/api/knowledge/replacements`; POST `/api/knowledge/scan`, `/api/knowledge/propose`, `/api/knowledge/review`. CLI/app operations share the same core. Scan is a local mutation because it records findings. Draft-deny policy blocks maintenance mutations. Stop the app before CLI commands against the same workspace because the app owns its lock.

Permissions apply to finding snapshots, current target records, replacement records and source evidence. Wiki titles now require permitted evidence, including in graph projections; source restrictions cannot leave derived titles visible. Archived records are not counted as active memory or returned in active context. History is not a current assertion of truth.

## Storage and recovery

Schema 5 adds knowledge_reviews and knowledge_dispositions. Supported source schemas remain 1–5; upgrades apply sequential migrations after the existing verified-backup flow. Restoring a schema-4 backup and upgrading is tested. A schema-5 backup retains originals, findings, decisions and retirement overlays. Roll back by restoring the older backup into another directory with the compatible product version; never open schema 5 with an older binary.

No live private workspace was upgraded during this batch. Use the synthetic demonstration before selecting a bounded pilot.

## Skills and distribution

- `hoi-chief-of-staff`: daily work, promises, waiting-for items, exact meeting preparation and local preparation suggestions.
- `hoi-knowledge-review`: mechanical scan, semantic-review boundaries, cited replacements and exact review decisions.

Canonical product sources are under skills/. Claude/Codex mirrors and the machine-readable catalog are generated from them. The local product now contains 16 operational skills plus hoi-install. Published alpha.2 downloads still contain the earlier set; no release was updated.

The two new skills were also ingested into the canonical House of Ichigo collection at `skills/houseofichigo-skills/skills/<name>/`, with source provenance, file checksums and dated archives. Their collection entries explicitly state local development, not publication. Existing installed runtime copies outside this product were not globally replaced.

## Validation and limitations

Validated on 26 September 2026: **82 core tests and eight browser checks pass**. Runtime skill mirrors/catalog match, both new skills pass validation, and the new UI passes the mechanical HOI brand check.

Core checks cover archive retention, exact retries, rejected finding suppression, changed-evidence review invalidation, source permission revocation, cited replacement/merge requirements, duplicate detection, contradictions, superseded sources, expired memory, draft-deny policy, schema-4 recovery and persisted task-map links. Browser checks cover scanning, keyboard review, archive, retained history, restart and narrow layouts alongside prior regressions. Both new skills pass the skill validator and runtime package generation checks.

Semantic accuracy and real-work usefulness remain pilot gates. Source changes flag affected evidence but do not rewrite knowledge. No autonomous cleanup, cloud memory, broad company ingestion, calendar mutation or publication was added. Batch 5 (chat and optional search) remains separate and still requires resolving the supported local-adapter/provider choice.
