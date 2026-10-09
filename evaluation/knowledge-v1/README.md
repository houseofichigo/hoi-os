# Human-reviewed retrieval evaluation gate

This directory defines the acceptance protocol. It does **not** contain 120 human-labelled questions yet. Existing synthetic core fixtures remain regression evidence, not substitutes for this gate.

Before tuning the fixed retrieval profile, obtain and freeze 120 fictional questions with source/wikiblock/memory revision labels: 40 development and 80 held-out. Partition whole scenario families, not paraphrases of the same facts. A reviewer other than the tuning process must approve labels; record reviewer identity, timestamp, corpus hash and split revision. Do not use a generated answer as its own label.

Every row needs: question ID, family ID, split, language, question, workspace fixture identity, permitted host/provider scope, relevant exact evidence references, expected current/historical interpretation, abstention requirement, reviewed answer facts, reviewer and review timestamp. Ground-truth files must not contain private client material.

Cover lexical identifiers; bilingual paraphrases; combined sources/wiki/memory; current and historical corrections; attributed memory; conflicts; unanswerable questions; partial threads; duplicated evidence; and restricted/archived records. Record unanswered or ambiguous labels as pending, never negative relevance by default.

Freeze the baseline before comparison. Report baseline, unified lexical, hybrid and artifact-discovery variants separately. Reranking is not implemented/enabled and has no quality claim. Measure recall@5, nDCG@10, exact citation resolution, reviewed factual support, correct abstention and permission leakage; report denominators and failed examples. Acceptance thresholds are the approved product plan's thresholds, not a synthetic smoke-test score.

For latency, use a named machine, actual indexed-unit count, cold/warm separation, p50/p95, peak memory, model/index bytes and provider cost. The current one-passage bilingual smoke test establishes loading and permission behavior only; it cannot establish the 10,000-unit ≤2-second target.

## Runnable tooling

After `npm run build`, run:

```sh
node scripts/benchmark-knowledge.mjs /tmp/hoi-benchmark-new.json
node scripts/score-retrieval.mjs /path/to/labelled-run.json /tmp/hoi-score-new.json
```

Outputs are exclusive: choose a new filename to preserve earlier measurements. The benchmark creates and removes its own fictional workspace. It preserves generated originals while running and projects exactly 10,000 original paragraph passages across 100 sources. It measures 50 exact-ID queries and 20 broad warm queries. This tests retrieval scaling independently of extraction/chunking quality. It makes no provider calls or model downloads.

The scorer accepts an array of run rows with `id`, `family`, `split` (`development` or `held-out`), `relevant` (exact evidence identity strings), `returned` (ranked identity strings), and explicit `abstain`. Optional `forbidden` identities detect returned forbidden evidence; optional `answerAbstained` records an observed answer decision. Optional `review` has `status`, `reviewer`, and ISO `at`. Use a consistent identity containing kind, stable record, revision and passage/block; labels and results must use the same identities. The scorer does not itself run retrieval or verify citations against a workspace.

It rejects cross-split scenario families, duplicate question IDs and inconsistent labels. Recall is the fraction of all relevant evidence found in the first five results, not simply any-hit success. nDCG uses binary relevance and unique returned identities. Abstention is unmeasured unless actual answer decisions are supplied; an empty retrieval result alone is not proof of correct answer abstention. Metrics use held-out rows, with denominators and per-case results. Reports always say `not-certified`: citation resolution, independent label provenance and human-reviewed answer support require additional verification.

## Recorded local measurement

[October 9 lexical measurement](measurements/2026-10-09-lexical-10000.json): Apple M5, 10 logical CPUs, 32 GiB RAM, macOS arm64, Node 22.14.0. Exact-ID retrieval found the expected passage for 50/50 queries; all 50 returned primary references resolved. Warm p95 was 2.59 ms for exact IDs and 1,679.75 ms for broad queries. Process peak RSS was approximately 312 MiB, including fixture creation and both workloads. This is one synthetic local run, not a cross-platform performance guarantee or a semantic-quality result. The first query follows fixture creation, so no true cold-filesystem latency is claimed.

## Candidate review pack (not ground truth)

The [human-readable review pack](candidates/REVIEW.md) and [structured draft](candidates/review-pack.json) contain 120 assistant-authored fictional questions: 40 proposed development, 80 proposed held-out, with 60 English and 60 French questions. Paired translations stay within their scenario family. The 12 families cover identifiers, bilingual wording, mixed sources/wiki/memory, attribution, dates, contradictions, missing information, incomplete threads, duplicates, restricted/archived evidence and ambiguous names.

These are **candidate labels**, not human labels. No retrieval quality score is claimed. The held-out split is proposed, not sealed: this coding process has seen the cases, so independent reviewers must assess contamination, add unseen scenarios where needed and freeze the final set before tuning. Several setup requirements are intentionally explicit review work rather than encoded by descriptive text: restricted sources require real policy denial, archived sources require actual archive state, temporal fixtures require exact recorded/effective dates, memory requires governed approval, and wiki requires publication. Words such as “approved” in a fixture document do not establish engine authority.

Review sequence:

1. Inspect each original fictional record and its proposed facts. Correct ambiguous questions and labels; do not approve from the proposed answer alone.
2. Check whole-family split independence and create a genuinely sealed held-out set outside tuning access.
3. Materialize each scenario in an isolated fixture through engine operations. Resolve logical record IDs to exact revision/passage/block references and record the fixture hash. `exactEngineReferences: null` explicitly marks this pending step.
4. Record reviewer identity, timestamp and corpus hash in a new reviewed artifact; preserve this draft unchanged. Do not mutate the draft’s status to bypass validation.
5. Run variants against the frozen fixtures, validate exact citations with current permissions, then independently review generated answers for factual support and abstention.

`node scripts/validate-review-pack.mjs evaluation/knowledge-v1/candidates/review-pack.json` validates draft counts, references and split structure. It explicitly refuses purported human approval and never issues acceptance certification. The manifest pins the draft content checksum.

## Materialized diagnostic runs

```sh
node scripts/run-review-pack.mjs evaluation/knowledge-v1/candidates/review-pack.json NEW_DIRECTORY
```

The runner requires a directory that does not exist, creates 12 isolated fictional workspaces and preserves their originals, then runs all 120 questions through unified lexical search as Codex. It writes `run.json` (provenance, exact-reference mappings and diagnostic metrics) and `scoring-input.json`. An existing output directory is refused. A failed run is left intact for inspection, never overwritten on retry. No provider is called, no model is downloaded and no existing workspace is opened.

Source ingestion, wiki publication, attributed-memory approval and source archiving use the engine. Restricted fixtures use real host permissions. For the explicitly named Birch temporal fixture only, recorded revision timestamps are seeded in its disposable database to represent January history; this is a fixture setup technique, not a supported user write operation. All proposed relevant references and every returned primary reference must resolve through the engine. Forbidden references must fail resolution before scoring. The source text never supplies execution authority.

The [first diagnostic report](measurements/2026-10-09-draft-lexical-run.json) remains **unreviewed**. Logical labels resolve in a separate run artifact; the original draft pack and its checksum remain unchanged. Duplicate-lineage, alias, contradiction and partial-thread records currently test content retrieval, not full connector/relationship behavior. This limitation is recorded in every report. Answers are not generated, so correct answer abstention and factual support remain null/unmeasured. A provisional relevance score is useful for finding failures but must not be reported as product acceptance or as a sealed held-out result.

## Paired local hybrid comparison

Pass an already verified offline model directory as the optional third argument:

```sh
node scripts/run-review-pack.mjs evaluation/knowledge-v1/candidates/review-pack.json NEW_DIRECTORY VERIFIED_MODEL_DIRECTORY
```

The runner collects lexical results before enabling semantic search in each fresh fixture, installs only from the supplied local package, rebuilds its index and evaluates the identical cases. It records modes per query, verifies exact references for hybrid results, and writes the lexical scoring input alongside the hybrid one. At completion it disables semantic search and removes only the model copies created in those fresh fixture directories; originals, indexes, manifests and reports remain. Reusing those fixtures for semantic queries requires reinstalling the verified model package. It does not download a model or invoke a provider.

The [paired diagnostic report](measurements/2026-10-09-draft-hybrid-run.json) contains 116 hybrid queries and four historical queries that intentionally remain lexical. Provisional recall@5 on the proposed held-out subset rose from 52.17% to 93.48%; nDCG@10 rose from 52.17% to 91.87%. No per-case recall regressions or forbidden returned references were observed. These are **not acceptance results**: labels are unreviewed, the split is unsealed, and each isolated fixture contains only one to three records, making top-five retrieval much easier than a real workspace.

All 34 unanswerable cases returned evidence in hybrid mode, versus 16 in lexical mode. This measures retrieved candidates, not generated answer errors: no answers were generated. It demonstrates why the assistant must not equate retrieved context with a supported answer. Next evaluation work requires independent labels, realistic distractors and mixed-workspace retrieval, followed by reviewed generated answers and abstention checks. Do not enable reranking, alter thresholds or claim the 90% quality gate based on this diagnostic pack.

## Shared-workspace distractor diagnostic

```sh
node scripts/run-review-pack.mjs evaluation/knowledge-v1/candidates/review-pack.json NEW_DIRECTORY VERIFIED_MODEL_DIRECTORY 1000
```

The optional fourth argument combines all scenario families into one fictional workspace and adds up to 10,000 preserved synthetic distractor documents. Queries receive explicit `Subject <family>.` context because several original questions are ambiguous outside their isolated fixtures. Both paired variants receive exactly the same qualified question. This does not test automatic subject resolution and is not directly comparable to the earlier unqualified isolated run. Every case checks the union of restricted/archived references across the workspace.

The initial `2026-10-09-shared-hybrid-1000.json` is retained as an **invalid hybrid benchmark**: query embedding used an unqualified question while retrieval used explicit subject context. Its recorded query modes correctly show lexical fallback. Do not use its timing or relevance as hybrid evidence. The runner now embeds the exact executed question and rejects unexpected lexical fallback in a hybrid run. Corrected measurements are recorded separately.

The [corrected report](measurements/2026-10-09-shared-hybrid-1000-corrected.json) verifies 116 hybrid queries and four historical lexical queries over 1,018 eligible units. On the proposed held-out labels, lexical versus hybrid recall@5 was 100% versus 98.91%; nDCG@10 was 82.17% versus 96.50%. The comparison flags `moss-02-fr` as a recall regression. This requires review; no ranking settings were changed to fit the draft. No forbidden references were returned. All 34 unanswerable cases retrieved candidates in both variants; answer correctness remains unmeasured.

On Apple M5 / 32 GiB, corrected warm query-embedding-plus-retrieval p50 was 338.54 ms and p95 505.48 ms. Index construction took 7.01 seconds. Database/WAL sizes were 7,675,904 / 4,161,232 bytes; whole-process peak RSS was 1,579,168 KiB (about 1.51 GiB). Database sizes include fixture records, not just the vector index. Core verification overlapped part of this run, so latency is a diagnostic under mixed local load, not an isolated performance guarantee. No paid provider calls or model downloads occurred. Templated distractors, explicit subject prefixes and unreviewed labels limit these results; neither human quality gates nor the 10,000-unit hybrid target are certified.

## 10,000-unit hybrid diagnostic

Reproduce the shared workload with `9982` as the final runner argument: the fixture contributes 18 eligible units before distractors. The [10,000-unit report](measurements/2026-10-09-shared-hybrid-10000.json) records the actual count, model fingerprint, runtime build, hardware, per-query modes/timings and exact-reference mappings. All 116 current queries used hybrid retrieval; four historical queries remained lexical. No other test suite ran concurrently. Normal desktop processes were not disabled; this was not a dedicated benchmark machine.

| Measurement | Observed |
|---|---:|
| Eligible search units | 10,000 |
| Preserved sources, including excluded fixture sources | 9,998 |
| Warm hybrid p50 | 3,384.16 ms |
| Warm hybrid p95 | 5,242.94 ms |
| Index construction | 59.14 s |
| Whole-process peak RSS | 1,703,568 KiB (~1.62 GiB) |
| SQLite database / WAL | 70,889,472 / 4,185,952 bytes |
| Lexical / hybrid provisional recall@5 | 97.83% / 98.91% |
| Lexical / hybrid provisional nDCG@10 | 82.11% / 93.84% |
| Forbidden returned references | 0 |
| Paid provider calls | 0 |

**The warm p95 ≤2-second target failed on this workload.** Database bytes include authoritative fixture records and other projections, not only vector-index bytes. Peak RSS covers fixture creation, indexing and query execution; it is not a steady-state measurement. Model installation/copy time is outside indexing and query timing. These results do not claim cold-start, Windows or clean-machine performance.

`moss-02-fr` again regressed relative to lexical: its two relevant passages were at lexical positions three/four and hybrid positions five/seven. See [conflict-case review](CONFLICT_CASE_REVIEW.md). Equal-score ordering uses generated record identities, so independently materialized runs need not retain identical tied order. Do not interpret a ranking change between corpus sizes as caused solely by distractors. All 34 unanswerable cases returned evidence; answer abstention remains unmeasured.

Next engineering work is profiling and reducing repeated eligibility/evidence resolution while preserving current permission, revision, archive and scope checks. Inspect lexical candidate materialization as well as semantic index traversal. Do not solve the latency failure by skipping checks or caching authorization beyond its validity. Compare any optimization on the same preserved fixture, then rerun permission-revocation, historical, exact-ID and ranking regressions. No runtime or ranking change was made in this measurement batch.

The [independent-review handoff](HUMAN_REVIEW_HANDOFF.md) identifies the remaining human work. Unreviewed templated data and explicit subject prefixes do not satisfy the held-out quality gates, regardless of the diagnostic percentages above.

## Request-scoped policy parsing optimization

Profiling one preserved 10,000-unit hybrid query found 40,022 policy reads, taking about 2.90 seconds of 3.60 seconds total (`measurements/2026-10-09-policy-profile-before.json`). Repeated YAML parsing dominated that sample.

Retrieval now parses policy once during a synchronous search and verifies the policy file's device, inode, size and nanosecond modification/change timestamps before returning. Path containment is resolved again at the boundary. If the file changed, the entire response fails with `POLICY_CHANGED_DURING_READ`; the caller may retry. The snapshot is cleared on success or failure and never survives into another request. Async callbacks are refused. Source lifecycle, revision and evidence checks still run; this does not cache source authorization or bypass provider-disclosure checks.

The [final same-fixture repeat](measurements/2026-10-09-policy-snapshot-10000.json) used the exact preserved index and questions, without reingestion or index rebuilding. All 120 ordered reference lists were identical to the pre-optimization run; no forbidden reference was returned or resolvable. All 116 current queries used hybrid retrieval, while four historical queries remained lexical. Warm p50 was **543.79 ms**, p95 **987.23 ms**, versus 3,384.16 / 5,242.94 ms previously. The two-second p95 target is met on this named fictional workload; it is not a universal performance guarantee. No concurrent test suite ran. Peak process RSS was 1,773,360 KiB (~1.69 GiB), excluding fixture/index construction in this repeat.

An intermediate implementation checked file metadata on every policy access and measured p95 1,526.57 ms; its [report](measurements/2026-10-09-policy-cache-10000.json) is retained with its distinct build identity. The final implementation instead rejects a whole read if policy changes at its boundary. Ranking, RRF weights, models and source eligibility did not change. The French conflict case remains at the same ranks; no human quality or answer-abstention gate is closed by this optimization.

## Evidence-resolved human review packet

The [review packet index](review-packets/2026-10-09-shared-10000/README.md) contains all 120 fictional cases, organized into 12 family documents. Each includes the actual question, proposed answer facts, exact authorized passages, retrieved ranks, proposed relevance and attribution where available. `review.csv` has blank reviewer/decision/date fields. No generated answer or human approval is supplied.

Reproduce after building:

```sh
node scripts/export-retrieval-review.mjs evaluation/knowledge-v1/candidates/review-pack.json FICTIONAL_RUN_DIRECTORY NEW_OUTPUT_DIRECTORY
```

The parent output directory must exist; the final directory must not exist. Use a run created by `run-review-pack.mjs`. The exporter validates case identities, questions, proposed labels and forbidden-reference mappings, then re-resolves each evidence reference under that case's current host permissions. A revoked or stale required reference stops export. Forbidden passages are checked for denial and never copied. Source HTML/Markdown is escaped in the readable documents. Earlier runs and packets are never overwritten; failed output directories remain for inspection.

`packet.json` records the candidate/input hashes, evaluated build and current resolution build separately. This is a static export of fictional evidence, not a live permission-aware view: a later revocation cannot erase an already exported document. Do not use the script to distribute private workspaces. Creating the packet does not approve labels or certify acceptance. Reviewers must still correct ambiguities and create genuinely unseen held-out families before tuning; see [the handoff](HUMAN_REVIEW_HANDOFF.md).
