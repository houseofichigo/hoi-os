# Answer-quality review workflow

This batch supplies evaluation tooling, not completed human evaluation. The preserved 120-case packet has **zero generated answers and zero independent reviews**. Its exposed scenario families cannot certify held-out quality. No provider requests were made. Ranking and runtime behavior are unchanged.

## Files and reproduction

- `pending-submission.json`: hash-bound worksheet, one empty answer/review per case.
- `pending-report.json`: demonstration that missing answers produce null metrics, never passing scores.
- `ranking-diagnostic.json`: frozen-packet top-five misses under unreviewed proposed labels. Includes the known French conflict case without tuning against it.
- Original evidence: `../review-packets/2026-10-09-shared-10000/packet.json`.

From the product directory:

```sh
node scripts/answer-evaluation.mjs prepare PACKET.json NEW-SUBMISSION.json
node scripts/answer-evaluation.mjs score PACKET.json SUBMISSION.json NEW-REPORT.json
node scripts/diagnose-review-ranking.mjs PACKET.json NEW-DIAGNOSTIC.json
```

Commands refuse existing output files. Preserve originals; work in a new version of the submission. A changed packet requires a new worksheet. No engine database, provider configuration or private workspace is modified.

## Recording an actual answer

For each case, replace `answer: null` only with an observed answer. Record `text`, `provider`, `model`, `buildId`, `instructionVersion`, ISO `at`, actual `costUsd`, and boolean `abstained`. Include exact reference objects in `supplied` and `citations`. Supplied evidence must be a ranked result in that packet; proposed-relevant records omitted by retrieval cannot be silently added. Citations must be a subset of supplied references. Do not claim this offline format proves the provider actually received that context; preserve the engine run separately as audit evidence.

Generating answers requires a configured provider, disclosure authorization and the existing spending limits. This tool does not dispatch requests or infer abstention from an empty retrieval result.

## Independent review

After reviewing the full answer against the evidence, set `review` with:

- `answerHash`: SHA-256 of `JSON.stringify(answer)` (exported helper `fingerprint`). Changes require a new review.
- `reviewer`, actual ISO `at`, and `completeClaimAccounting: true` only after checking every factual claim.
- `expectedAbstain`: independently reviewed missing-answer judgment, not copied from model behavior.
- `claims`: each has unique `id`, exact answer `text`, JavaScript UTF-16 `start`/`end` offsets, `verdict` (`supported`, `unsupported`, `uncertain`), `reason`, and supplied `evidence` reference objects. A supported claim needs evidence. An answer with no factual assertions may have an empty list; its support denominator remains zero.
- `citationChecks`: one per cited reference, with `reference`, `status` (`resolved`, `denied`, `missing`, `changed`), actual ISO `at`, engine `buildId` and permission identity `identity`. Resolve through `knowledge:evidence` under current permissions. Check times must follow generation and precede review.

Names and timestamps are offline attestations, not authenticated signatures. The tool cannot discover omitted assertions or undisclosed inline citations; complete accounting is a human responsibility. Exported evidence does not provide fresh permission checks. Do not use this fictional packet workflow to export private evidence.

## Reading results

Held-out-labelled rows supply provisional micro-averaged supported-claim and citation-resolution rates and observed abstention accuracy. Counts and review completeness are always reported. Uncertain and unsupported claims both reduce support. Missing reviews are excluded from ratios but keep completeness false; zero denominators are null. No report certifies acceptance, even with all positive reviews.

Before product acceptance, create genuinely unseen families with independently reviewed relevance and expected facts, freeze their hashes, run the configured provider and review its answers. Retain the ≥90% recall@5, ≥95% factual-support and ≥95% missing-answer abstention gates, exact citation resolution and permission tests. The known French case remains an open diagnostic; investigate general subject resolution and bilingual development fixtures before any ranking change.
