# Release acceptance

Audience: maintainers and independent evaluators of the current harness and optional Knowledge Hub. Automated tests validate mechanics. Keep the product labelled alpha until the applicable gates have recorded evidence.

| Gate                  | Required evidence                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation          | Run the packaged Node acceptance kit on actually fresh target systems. Report Mac arm64, Mac x64, Windows x64 and Linux separately, including native dependencies, recovery and removal. No Electron signing claim applies to this edition.           |
| Assistant integration | Fresh Codex and Claude Code sessions discover workspace instructions, perform a permitted read and submit one reviewed fictional proposal. Adapter files alone do not prove integration.                                                              |
| Preservation          | Identical imports, changed revisions, collisions, moves, interrupted extraction and restored backups reconcile with original checksums.                                                                                                               |
| Retrieval             | Versioned bilingual development and held-out corpora; answerable recall@5 at least 90%, no exact-identifier regression, at least 95% correct abstention on missing-answer cases. Synthetic labels and independent human labels must be distinguished. |
| Grounding             | Every displayed citation resolves to authorized evidence; independent review finds at least 95% factual support. No invented commitments or deadlines.                                                                                                |
| Meeting preparation   | Review actual briefs for occurrence/client identity, freshness and gaps. Measure time saved against a recorded manual baseline rather than an estimate.                                                                                               |
| Policy                | Denied/archived data excluded before exposure; imported instructions cannot grant authority; an edited action cannot reuse approval.                                                                                                                  |
| Recovery              | Interrupted work, separate-directory restoration, index rebuild and supported-version upgrade/rollback preserve identities and histories. A same-schema rehearsal is not historical migration evidence.                                               |
| Hub and map           | Reading, editing, evidence, source opening, keyboard list, WebGL fallback, narrow layouts and reduced motion work.                                                                                                                                    |
| Independent pilots    | Complete the agreed ten-day usefulness pilot and independent installations with authorized data, recorded defects and fixes.                                                                                                                          |

## Evaluation records

Keep real evaluation records private and outside the product. Record question, permitted identity, expected source/revision references, returned results, temporal interpretation and reviewer judgement. Include unanswerable questions and explicit abstention. Generated answers cannot label themselves correct.

For meeting preparation record the exact occurrence, timezone, related subject IDs, freshness, manual and assisted time including corrections, supported claims, invented commitments and reviewer. A fluent narrative is not proof of correctness. Saved skill-output comparisons evaluate the supplied artifacts, not the assistant's live runtime.

Local retrieval benchmarks, deterministic provider fixtures and scripted approvals must retain those labels. Optional semantic search remains opt-in; optional reranking stays disabled unless independent evaluation supports it. Windows behavior must be tested on Windows before being claimed.

## Candidate procedure

Run `npm run check`, `npm run format:check`, browser regressions and the publication safety scan; review dependency findings and notices. Build into a new directory with `npm run package:candidate -- --output "../HOI candidate"`. Verify the extracted package and record build/platform identity. Follow [publication preparation](PUBLICATION_READINESS.md) and [installation](HUB_INSTALLATION.md). A passing build is not approval to publish or evidence that the external gates passed.

## Routing and automation gate

See [schema-20 verification](AUTOMATION_VALIDATION.md) for observed checks and remaining host/evaluation gates. Authored routing fixtures are not independent human labels. Inactive n8n templates are not live workflows. Do not activate private sources, install schedules or claim continuous uptime from local tests.
