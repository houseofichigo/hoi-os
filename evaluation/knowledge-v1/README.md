# Human-reviewed retrieval evaluation gate

This directory defines the acceptance protocol. It does **not** contain 120 human-labelled questions yet. Existing synthetic core fixtures remain regression evidence, not substitutes for this gate.

Before tuning the fixed retrieval profile, obtain and freeze 120 fictional questions with source/wikiblock/memory revision labels: 40 development and 80 held-out. Partition whole scenario families, not paraphrases of the same facts. A reviewer other than the tuning process must approve labels; record reviewer identity, timestamp, corpus hash and split revision. Do not use a generated answer as its own label.

Every row needs: question ID, family ID, split, language, question, workspace fixture identity, permitted host/provider scope, relevant exact evidence references, expected current/historical interpretation, abstention requirement, reviewed answer facts, reviewer and review timestamp. Ground-truth files must not contain private client material.

Cover lexical identifiers; bilingual paraphrases; combined sources/wiki/memory; current and historical corrections; attributed memory; conflicts; unanswerable questions; partial threads; duplicated evidence; and restricted/archived records. Record unanswered or ambiguous labels as pending, never negative relevance by default.

Freeze the baseline before comparison. Report baseline, unified lexical, hybrid and artifact-discovery variants separately. Reranking is not implemented/enabled and has no quality claim. Measure recall@5, nDCG@10, exact citation resolution, reviewed factual support, correct abstention and permission leakage; report denominators and failed examples. Acceptance thresholds are the approved product plan's thresholds, not a synthetic smoke-test score.

For latency, use a named machine, actual indexed-unit count, cold/warm separation, p50/p95, peak memory, model/index bytes and provider cost. The current one-passage bilingual smoke test establishes loading and permission behavior only; it cannot establish the 10,000-unit ≤2-second target.
