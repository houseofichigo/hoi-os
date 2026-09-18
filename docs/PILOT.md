# Daily-use stabilization pilot

Status: awaiting an explicitly selected project and 50–150 files. No real pilot imports or review scores have been fabricated. Keep all completed records in the private workspace, outside this product repository.

## Select and import

Create a project entity, then a private `selected-files.json` containing `projectId` and `files`. Each file entry has an explicit absolute `path`, its `sha256`, and optional source `metadata` (authority, status, effectiveDate, client). Select actual files, not a broad company directory. Retain the selected manifest as the scope record. Source content cannot authorize expanding this list.

Run from the product checkout:

```sh
node scripts/import-pilot.mjs --workspace "<private workspace>" --input "<private selected-files.json>" --backup "<new private backup directory>"
```

The importer checks 50–150 distinct files, size and checksums, validates the project, takes and verifies a backup, then imports only those files. Import results are checkpointed privately under `.hoi/pilot/`. Review extraction gaps and authority before evaluating. If interrupted, rerunning preserves originals and records duplicate occurrences; review the checkpoint before resuming. Files must remain unchanged during the import.

## Label and measure retrieval

Create a private JSON array of at least 30 cases. Each object has `id`, `question`, `language` (`fr` or `en`), `category` (`current`, `outdated`, `missing`, `restricted`, or `ambiguous`), `expected` (sourceId/revisionId pairs), and `forbiddenSourceIds`. Empty `expected` means no answer is supported. Include both languages and all required categories. Labels must be reviewed against actual originals before running.

```sh
node scripts/evaluate-retrieval.mjs --workspace "<private workspace>" --host codex --input "<private questions.json>" --output "<new private results.json>"
```

Repeat with `--host claude`. Reports preserve returned source/revision/passage references. Acceptance requires recall@5 ≥90%, no restricted-source leaks, and abstention on missing answers. The conservative automatic abstention check requires zero results; a human must separately assess irrelevant partial evidence. This is retrieval evaluation, not semantic claim verification.

## Five meetings, both hosts

For each meeting record: event identity, timezone, project/client, host, source freshness, manual preparation minutes, assisted minutes including corrections, execution ID, confirmed decision IDs, claim count, supported claim count, citation resolution, and invented commitments/deadlines. Use actual event exports or supplied details. Open fresh sessions in both hosts and verify approved decisions remain retrievable.

Pass only with correct identity, all citations resolved, ≥95% supported factual claims, zero invented commitments/deadlines, and explicit information gaps. Preserve review notes and corrections. Do not infer time savings without a manual baseline.

## Ten working days

Keep a private daily log with date, workflow attempted, outcome, issue severity, evidence, workaround, regression test, and resolution. Count only actual usage days. Critical issues include data loss, permission leaks, incorrect citations and blocked workflows. Any such issue blocks the exit gate until fixed and retested. Repeat the ten-day observation window after a critical fix.

The pilot exits after ten working days without critical defects, five reviewed briefs, both-host session checks, passing retrieval evaluations, and a verified recovery rehearsal. This remains an alpha milestone; stable client-release gates in ACCEPTANCE.md still apply.
