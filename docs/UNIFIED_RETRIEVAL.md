# Unified retrieval and reviewed memory — local implementation

Audience: maintainers and alpha testers. Authoritative code: `src/retrieval.ts`, `src/reviewed-memory.ts`, `src/semantic.ts`, the shared operation registry and workspace policy. This document describes unreleased app work, not the published skills package or platform certification.

## Implemented

- Sequential schema 19 tables for rebuildable retrieval units, model manifests/generations, conversation artifacts and memory revision/write journals. Existing IDs and Markdown are preserved.
- Sources, published wiki blocks and current approved memories compete before excerpt allocation. Equal reciprocal-rank fusion uses constant 60, channel limit 50, merged limit 100, at most 10 results and 3 excerpts per record. Exact repeated excerpts are deduplicated. Original `retrieve` response fields remain available.
- Exact source/wiki/memory evidence resolution and memory citations. Permissions and current revisions are rechecked. Selected memories retain exact revision fingerprints. Default map memory nodes are current and approved.
- Memory proposals, local exact-version review, replacement and retirement; immutable revision files and restart recovery journals. Replacement approval checks the predecessor fingerprint and updates both records recoverably. History is explicit; assistants cannot mark inferred facts as user-authored or approve through the new review operation.
- Current/Proposed/History Memory views, attributed-note proposals, correction comparison, review and retirement. A corrected memory preserves the predecessor.
- Opt-in local CPU embedding worker with remote runtime loading disabled. Pinned upstream E5 ONNX artifacts, bounded verified download/offline directory import, tokenizer-sized segments and sqlite-vec adapter. Index generations switch atomically; jobs support interruption/resume and cancellation. Read-time access checks precede vector ranking.
- Knowledge Hub search-coverage controls. Missing/corrupt runtime or model falls back to lexical search. New records make existing generation coverage partial until rebuilt. With semantic search enabled and the verified model installed, the running app checks eligible knowledge every 30 seconds and rebuilds changed generations through the engine queue.
- Existing automatic-analysis jobs may return validated conversation discovery artifacts. Original passage references are mandatory. Summaries are derived/unreviewed and only locate original evidence; they do not become independent factual context, accepted tasks or approved memory. Existing analysis scopes and cost controls remain.
- Six existing skills updated; runtime mirrors and canonical local collection retain provenance and previous versions. No new overlapping memory skill.

## Interfaces

Use generated `OPERATIONS_REFERENCE.md`, not a duplicate handwritten API schema. New registered `knowledge` subcommands include search, evidence, index-status, configure-search, install-model and rebuild. New `memory` subcommands include list, get, history, propose, review and retire. All require the matching engine host identity. New memory writes require request keys; review requires current version/checksum and explicit local confirmation. Legacy `review-memory` on schema 19 uses that same review contract.

Model download is a separate explicit action after enabling semantic search. About 465 MiB of pinned files plus temporary/index space is required. Offline installation accepts a directory matching the manifest layout; it is validated identically. The source upload limit remains 50 MiB. Model verification uses a separate bounded streaming hasher.

## Verification and open acceptance work

Focused synthetic tests cover unified allocation, late matching memories, current-state exclusions, revoked evidence, stale/double review, replacement, archive history, backup/restore, interrupted journal recovery, additive migration and artifact evidence validation. The opt-in model test verifies offline installation, French-to-English retrieval, idempotent rebuild and permission revocation. This is functional evidence, not measured semantic quality.

Still required before the full requested upgrade can be accepted:

- Human-labelled 120-question corpus (40 development / 80 held-out), scenario-family separation, independently reviewed answers and recall/abstention/support measurements. No generated dataset is represented as human-labelled ground truth.
- Complete operational-record EvidenceItem unification; historical semantic retrieval and historical relationship expansion remain unavailable.
- Representative-corpus/platform performance and detailed extraction/model fault coverage. The named synthetic 10,000-unit benchmark now meets its warm latency target after policy parsing optimization.
- Optional budgeted reranker: not implemented or enabled. No extra paid model call is introduced by retrieval.
- Dedicated memory draft editing/restoration and broader accessibility/visual baselines. The new Memory flow has keyboard/focus and 390/768/1280/1440px checks.
- Clean Mac/Windows verification, live automatic-analysis verification and real-use pilot. A developer machine test is not a clean-install result.

No private workspace was migrated. Before any such upgrade, verify a backup and restore a separate compatible copy. Do not publish these app changes based on synthetic tests alone.

The evaluation handoff is in `evaluation/knowledge-v1/README.md`; labels and human acceptance remain pending. The fictional app walkthrough can be started with `node scripts/demo-retrieval.mjs` after building. It creates a separate temporary workspace, one French source, a published attributed wiki and an approved attributed memory. It does not configure a provider or download a model.

Staged macOS arm64 native check: Electron 42.11.8 loaded the verified offline model, built the SQLite vector index and retrieved French evidence from an English query. This is a staged dependency smoke test, not clean-machine verification. The reproducible worker test is `scripts/verify-staged-semantic.mjs`, run with the Electron executable in Node mode, a stage-directory argument and a verified-model-directory argument.

## Historical and related context (October 9 continuation)

Search accepts an explicit `asOf` date. It selects the state recorded by the end of that day in the workspace timezone, applies known effective dates and checks current permissions. This is not a claim about facts the workspace had not recorded then. Legacy memories without a review timestamp are excluded. Historical search is lexical; it does not reuse a current semantic index. Chat search can request this mode and must retain the date on exact citations. Evidence inspection labels historical material.

Current search expands one hop over explicit permitted source/memory relationships, capped at 20 candidates. Inferred similarity and second-hop links are excluded. Contradiction links preserve their label, without claiming automatic contradiction detection. Selected source passages may include up to two adjacent passages from the same revision, inside the shared character budget and three-passage source limit. These retain separately resolvable references.

## Automatic index maintenance

The app server schedules maintenance through the existing engine queue, only for local opt-in semantic search. It does not download models, call providers or run after shutdown. Sources, published wiki blocks and approved memories have permission-filtered eligible/indexed/pending counts. A cancelled automatic rebuild remains paused for the same input until a manual rebuild or changed knowledge; failed attempts use persisted backoff and pause after three attempts. Missing models wait for explicit installation.

Index jobs retain checkpoints across restart. Changed inputs invalidate an interrupted generation’s checkpoints; a generation is activated only if its input fingerprint still matches. The previous active generation remains available during rebuilding. A replacement generation still covers the complete eligible set, but validated unchanged embeddings are reused. A synthetic 10,000-unit rebuild is measured below; representative-workspace queue contention remains unmeasured.

## Evaluation tooling continuation

The evaluation directory now includes a reproducible 10,000-passage lexical benchmark and a standalone relevance scorer with scenario-family split validation. The measured Apple M5 run is recorded with build identity and hardware. Broad-query p95 was approximately 1.68 seconds; exact-ID p95 was 2.59 ms. These generated workloads do not establish bilingual recall, semantic performance or factual support. The 120 human-labelled questions and reviewed answer gate remain outstanding. See `evaluation/knowledge-v1/README.md` for the report and input contract.

## Incremental embedding reuse

Replacement generations reuse unchanged units only from the current active generation with the same model fingerprint. Keys bind exact revision/passage identity, source-text checksum and embedding recipe version (chunking, prefixes, pooling and normalization). All segments must be present, contiguous and checksum-valid; vectors must have the expected dimensions, finite normalized values and matching byte checksums. Partial or corrupt checkpoints are reprocessed. Legacy units without cache metadata are embedded once to upgrade their rebuildable projection.

Permission filtering occurs before reuse. Old generations are not independently trusted as evidence. New generations still activate atomically, and rebuild results separately report embedded, reused and resumed unit counts. No original, wiki or memory record is changed by reuse; there is no database migration. Retired index cleanup and representative-workspace memory/latency guarantees remain future work; synthetic scale measurements follow below.

## Candidate evaluation corpus

A 120-question fictional candidate pack is available at `evaluation/knowledge-v1/candidates/REVIEW.md`, with structured proposed labels and a checksum manifest. All labels remain pending independent human review; logical fixture references are not yet materialized engine citations. The proposed 40/80 split must be reviewed and sealed outside tuning access before it is used for acceptance. The structural validator rejects fake approval states, missing references and cross-split families. No measured recall or factual-support claim follows from generating the pack.

The candidate pack now has a reproducible materialization runner. It creates separate fictional workspaces, maps proposed labels to actual engine evidence and tests access/history boundaries. Exact-reference checks pass in its diagnostic run. The draft is still unreviewed and unsealed; the runner does not generate answers or certify quality. See `evaluation/knowledge-v1/README.md` for setup exceptions and reproduction commands.

A paired offline hybrid run is recorded in `evaluation/knowledge-v1/measurements/2026-10-09-draft-hybrid-run.json`. It improved provisional draft-label recall from 52.17% to 93.48%, without observed recall regressions or forbidden returned references. This does not pass the human quality gate: fixtures have only one to three records, labels are unreviewed and all unanswerable questions still retrieved some candidate evidence. No generated answers or factual-support checks were performed. Ranking and rollout defaults were not changed.

The shared-workspace diagnostic combines all candidate families with 1,000 synthetic distractor documents. Queries explicitly identify their subject, so this does not test entity resolution. An initial run exposed a benchmark query-key mismatch and fell back to lexical retrieval; that report is preserved and marked invalid for hybrid claims. The corrected runner checks actual retrieval mode. The 10,000-unit hybrid performance and independent human answer gates remain open.

The corrected 1,018-unit run confirmed 116 hybrid / four historical lexical queries. Provisional hybrid recall@5 was 98.91% versus lexical 100%, while nDCG@10 improved from 82.17% to 96.50%. One French conflict case regressed; no forbidden references appeared. Warm p95 was 505.48 ms with some overlapping core-test load. See the evaluation README for preserved invalid-run evidence, corrected measurements and limitations. No ranking defaults changed.

## 10,000-unit measurement and next priority

The shared offline hybrid run now covers exactly 10,000 eligible units on Apple M5 / 32 GiB. All 116 current queries used hybrid retrieval; four historical queries remained lexical. Warm p50/p95 were 3.38/5.24 seconds, so the ≤2-second p95 target is **not met**. Indexing took 59.14 seconds and whole-process peak RSS was about 1.62 GiB. No concurrent test suite ran; ordinary desktop activity remained. Provisional recall@5 was 98.91% with zero forbidden returned references, but labels remain unreviewed, one French conflict question regresses and answer support/abstention remain unmeasured.

Prioritize profiling repeated permission/evidence resolution and lexical candidate materialization before release. Preserve access checks and verify any caching against revocation, archive and revision changes. See the evaluation README for exact measurements and the independent-review handoff. This batch changed evaluation documentation only, not engine behavior, schema or rollout defaults.

## Retrieval performance fix

The 10,000-unit bottleneck was repeated policy YAML parsing. `knowledgeSearch` now uses a synchronous, request-scoped parsed policy, checking file identity and nanosecond change timestamps before returning. A changed policy discards the entire result with a retry error; failure also clears the snapshot. Path containment, source archive/current revision checks and historical evidence checks remain active. There is no cache of authorization across requests and no schema change.

Repeating the same preserved fixture reduced warm hybrid p95 from 5.24 seconds to **0.99 seconds**, with all 120 ordered evidence lists unchanged and zero forbidden references. The measured latency target now passes on this fictional Apple M5 workload. Human-reviewed answer quality, the existing French conflict ranking weakness, Windows/clean-machine checks and real-use pilot remain separate. Exact reports are linked in `evaluation/knowledge-v1/README.md`.

Matching-build verification after the performance fix: core 260 passed / three optional model tests skipped; all four offline semantic tests separately passed; browser 43 passed; staged macOS arm64 Electron two passed. New tests cover policy replacement during a search (whole response rejected), invalid-policy cleanup, subsequent revocation, archive/restore and stale revisions. This remains developer/staged verification, not clean-install or Windows certification.
