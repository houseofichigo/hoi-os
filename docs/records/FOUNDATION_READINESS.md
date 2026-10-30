# Foundation readiness

Status: local alpha, 2026-09-26. The product foundation is implemented; operational readiness remains to be demonstrated. Per the user’s latest direction, finish foundation verification before moving into real projects. House of Ichigo is the future pilot area, not an instruction to ingest its entire folder.

| Area                 | Implemented locally                                                                                                    | Remaining proof or limitation                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Storage and recovery | Preserved originals, evidence references, SQLite migrations, verified backup/restore                                   | Rehearse against a selected private workspace copy before live migration                     |
| Brain and map        | Cited wiki/memory proposals, maintenance review, persisted relationships, 3D and accessible list                       | Real knowledge quality; semantic findings still need assistant/human review                  |
| Projects and tasks   | Approval queue, evidence, history, status, duplicate candidates and reversible review                                  | Extraction uses explicit assistant submissions; ambiguous semantic duplicates require review |
| Daily work           | Priorities, waiting-for, meeting briefs, preparation suggestions                                                       | Selected exports need current availability; real usefulness not yet measured                 |
| Chat                 | Governed tools, citations, review cards and explicit assistant handoff                                                 | No embedded model or live token streaming; user chose no new runtime                         |
| Calendar             | Exact approval, concrete destination, availability check, durable event identity and uncertain-response reconciliation | Standalone Google adapter is not authenticated or live-verified; writes disabled by default  |
| Distribution         | Installation flow, canonical skills/mirrors, deterministic packages, configured platform CI                            | Fresh Claude/Codex sessions, clean platform runs and publication review remain gates         |

## Finish the foundation first

1. Keep existing regression, browser and synthetic recovery checks passing.
2. Rehearse installation and the same workflow in fresh Codex and Claude Code sessions. Record actual outcomes; do not infer them from generated skill files.
3. Select and authenticate a concrete calendar only when ready for a reviewed write test. Approve the exact event before creation. A connected assistant calendar tool is not automatically an authenticated standalone app adapter.
4. Run the configured macOS/Windows/Linux CI matrix on the eventual candidate. Local tests do not verify other platforms.
5. Then agree a bounded real-data selection within House of Ichigo and take a verified backup before intake.

No GitHub update, version bump, private migration or real intake is performed as part of this readiness preparation. Batch 7 is prepared, not completed. Ten days of use cannot be replaced by synthetic tests.

## Private pilot evaluation kit

Copy `examples/pilot/record.json` to a private location outside the product checkout. It intentionally starts with empty measurements and false checks. Maintain detailed labeled evidence, reviewer notes and daily failures privately; enter only their aggregate results into this record.

```text
node scripts/pilot-readiness.mjs --input "<private pilot-record.json>"
```

Exit codes: 0 means all recorded gates pass and the candidate is ready for release review; 2 means gates remain open; 1 means malformed input. Output contains aggregate metrics and gate codes, not meeting IDs or source content. The tool evaluates user-recorded claims; it does not independently verify them or authorize publication.

Measure on a held-out set:

- At least 100 labeled extraction candidates: proposal precision ≥95%, explicit commitment recall ≥90%.
- At least 50 duplicate clusters/non-clusters: duplicate-candidate recall ≥95%, zero incorrect automatic merges.
- At least 30 retrieval questions: answerable recall@5 ≥90%; include unanswerable questions and verify visible gaps.
- Five distinct reviewed meetings: ≥95% factual support in each, no invented commitments/deadlines; measure manual and assisted time including corrections. Median reduction target ≥50%.
- Ten distinct working weekdays without critical defects; no unresolved critical defects. Record daily use, not planned dates.
- Explicit evidence for backup, restore rehearsal, citation resolution, permissions, both fresh assistant hosts, live calendar adapter, core/browser checks, platform CI, packages and publication scan.

`correct` means supported proposals, recovered explicit commitments, found duplicate candidates, questions with relevant evidence in the top five, or correctly flagged missing answers as appropriate. Meeting `claims.correct` counts supported factual claims. `assistedMinutes` includes corrections. Unknown measurements remain zero, and unknown checks remain false. Do not use private evaluation records in public examples or release artifacts.

The existing importer requires an explicitly reviewed 50–150-file manifest with checksums and an existing project entity. It verifies backup before importing. Do not run it over the company root or infer source authorization from this template.
