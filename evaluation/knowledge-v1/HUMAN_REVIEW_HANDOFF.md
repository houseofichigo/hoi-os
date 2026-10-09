# Independent evaluation handoff

This is a review checklist, not approval evidence. All candidate labels are still pending. This coding process has seen the existing questions; their proposed held-out split is not sealed.

## Inputs

- `candidates/REVIEW.md`: readable fictional questions, source material and proposed labels.
- `candidates/review-pack.json` and `manifest.json`: preserved draft and checksum.
- `measurements/`: runtime/build-specific diagnostic reports and exact-reference mappings.
- `CONFLICT_CASE_REVIEW.md`: known French conflict-query ranking regression.
- `README.md`: reproduction commands, fixture limitations and metric definitions.

## Reviewer responsibilities

1. Review the underlying fictional records before accepting proposed relevance or expected facts. Record your identity and actual review date; never treat this checklist or an assistant output as your approval.
2. Clarify generic questions, especially subject names, temporal intent and whether a conflict requires abstention or an answer explicitly stating disagreement. Preserve original candidate files; save corrections in a separately versioned artifact.
3. Check each expected exact passage against the materialized fixture. Source text calling itself “approved” is not governed approval. Review authority, attribution, dates and denied/archived visibility independently.
4. Create unseen scenario families for the final held-out partition, outside the tuning process. Keep whole families together and freeze hashes before tuning. Repeated translations of one scenario do not constitute independent samples.
5. After provider configuration and disclosure authorization, generate answers against that frozen set. Save exact supplied evidence, cited references, provider/model, instruction version, costs and response. Do not use generated answers as ground truth.
6. Review each factual claim and observed abstention. No generated answers currently exist in these diagnostic runs. Mark uncertain labels unresolved; do not force them into positive/negative relevance.

## Gates still requiring evidence

| Gate | Required evidence |
|---|---|
| Recall@5 ≥90% | Independently reviewed, genuinely held-out answerable cases; all relevant items count |
| Factual support ≥95% | Human-reviewed claims in generated answers, with denominator and failures |
| Correct abstention ≥95% | Actual answer decisions on missing-answer cases |
| Citation resolution | Every displayed reference resolves under current permissions |
| No unauthorized exposure | Retrieval, historical answers, snippets, counts and derived context checks |
| Performance | Named hardware, measured corpus scale, p50/p95, memory and index/model sizes; disclose synthetic limitations |

No rating in a diagnostic report closes these gates automatically. Keep reranking disabled and memory approval manual. Clean installations, Windows verification and real-use pilot remain separate release gates.

## Submission and scoring tools

Use [the answer-review worksheet and format](answer-review/README.md) to capture observed answers and independent reviews. The scorer binds reviews to the exact answer and packet, requires every declared citation to have a resolution observation, and reports denominators and incomplete review coverage. It cannot authenticate reviewers, detect omitted claims or replace current engine permission checks. The prepared worksheet intentionally has 120 null answers and reviews.
