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
