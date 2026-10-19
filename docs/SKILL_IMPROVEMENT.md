# Reviewed skill comparisons

This is an offline developer tool for saved fictional evaluation artifacts. It never runs a skill, calls a model, changes permissions or activates a revision. It supplements existing retrieval evaluations without changing their API.

```sh
npm run build:core
npm run harness:compare -- --input examples/skill-comparison/comparison.json
```

An optional `--output new-report.json` creates a new private-mode file and refuses to overwrite an existing report. Exit 0 means mechanical checks permit human review; 2 means changes-required or inconclusive; 1 means invalid/incompatible artifacts.

## Artifact contract

The manifest has `schemaVersion: 1`, relative `suite` and `environment` paths, and `baseline`/`candidate` objects containing `bundle`, `answers`, `receipt`. All paths remain in the experiment directory; traversal, symlinks, credential paths and special files are rejected. Bundles include all files, including JS/TXT and copied helper dependencies, with a maximum of 128 files/8 MiB and 256 visited entries. Individual JSON files are capped at 2 MiB. This is not a sandbox for a separate host process.

The suite contains an ID, exact source texts, and cases with unique IDs, development/held-out split, a nonblank standard, nonempty required text checks, forbidden text checks and expected source IDs. Include current/outdated facts, missing answers and permission-denial scenarios in real evaluations. The fixture's tiny suite demonstrates the contract only.

The environment pins declared host, model, engine version, tool contract, policy and instruction version. `trialContext` hashes the exact suite and environment bytes; the answer key and corpus cannot change while reusing a receipt. `bundleFingerprint` hashes all included file paths and bytes. It cannot discover dependencies omitted from the bundle; the runner must include every executable helper and instruction dependency.

Each receipt includes schema version, distinct run ID, completed/failed/uncertain status, context fingerprint, bundle fingerprint and the exact answers checksum. These are declared execution metadata, **not cryptographic host attestation**. An independent runner must bind actual execution to those artifacts. Failed and uncertain executions never become passes.

Answers name exact case IDs and contain text plus source-ID/quote references. Missing or extra cases, duplicate IDs, unknown citations, fabricated quotes, mismatched fingerprints and empty checks cannot produce a clean comparison. Quote inclusion establishes resolution, not that a claim is supported; standards still require independent semantic review. No hidden model judge or self-awarded human approval is used.

## Review and activation

1. Freeze owner-reviewed standards and a separate held-out set before proposing changes. Keep held-out answers inaccessible to candidate authors.
2. Run baseline and bounded candidates in isolated fictional copies, using matched models, tools and budgets. Do not replay live side effects or uncertain paid requests.
3. Compare saved artifacts and inspect regressions. Keep failures and inconclusive runs in the record.
4. Independently review factual support, omissions, disclosure, costs and usefulness. The report explicitly leaves host identity, external behavior and held-out isolation unverified.
5. Import/save a draft and activate only through the existing reviewed skill operation. Record exact revision/checksum and retain rollback history.

Do not allow candidate edits to policies, approvals, tools, expected answers or original evidence. Lessons about procedures remain reviewed, scoped records with evaluation references; they never become business facts automatically.

The [Chief of Staff recipe](CHIEF_OF_STAFF_RECIPE.md) supplies a fixed, zero-cost engine rehearsal with evidence-linked briefs, a review boundary and separate restore copies. It does not execute candidate instructions or generate answers, so its report is not an assistant comparison receipt. The Hub now provides [Skills → Improvement](PROCEDURAL_LESSONS.md) for scoped procedural lessons using existing memory revisions and review. It does not run or attest comparisons. A bounded live-host runner and independently reviewed hidden labels remain pending.
