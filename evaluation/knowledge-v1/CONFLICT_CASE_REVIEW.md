# French conflict-query diagnostic

Status: investigation only; candidate labels remain unreviewed. No ranking configuration changed.

The corrected 1,018-unit run queried `Subject moss. Peut-on affirmer une date unique?` as Codex. The proposed relevant evidence is `moss/a` (delivery 2026-12-03) and `moss/b` (delivery 2026-12-04). Neither supersedes the other. The word “Approved” in these fictional source texts is not engine approval or verified authority.

| Logical evidence | Lexical rank | Hybrid rank |
|---|---:|---:|
| moss/a | 3 | 4 |
| moss/b | 4 | 6 |

Both references resolved and remained in the returned top ten. This is a top-five ranking regression, not lost storage or denied evidence. The hybrid result places two unrelated distractors at positions two and five. Unrelated `ember/public` and `linden/delivery` also outrank the intended subject in both variants. The current rank-fusion implementation combines channel positions with equal weights and constant 60; it does not guarantee that a named subject dominates general semantic matches. This inspection does not isolate which channel score caused each displacement.

The fixture has no explicit `CONTRADICTS` relationship. The query prefix supplies a text subject name, not a resolved subject ID. Therefore this case cannot establish failure of explicit relationship expansion or automatic contradiction detection. No answer was generated, so we do not know whether an assistant would correctly surface the disagreement using both supplied passages.

Before changing retrieval: independently review the question and relevance labels; test matched English/French cases with unrelated subject terms; inspect channel ranks; distinguish explicit stable-ID scope from text-only subject mentions; and evaluate candidate changes on genuinely unseen scenario families. Do not fit a Moss-specific boost or silently infer a contradiction edge. Keep this case visible in the next review, even if a larger run changes its rank.

Evidence: `measurements/2026-10-09-shared-hybrid-1000-corrected.json` and the preserved fictional run's scoring inputs. The report maps logical records to exact engine references. Runtime retrieval and default settings are unchanged.

## Larger-run follow-up

The 10,000-unit report again flags `moss-02-fr`. Both relevant passages resolve and are returned: lexical positions three/four, hybrid positions five/seven. Thus one still falls outside the top five. Independently generated record IDs can change tie ordering, so this is corroboration of a top-five weakness, not a controlled estimate of distractor-count impact. No labels or ranking settings were changed.

## Lexical channel inspection

A direct read-only trace of the preserved 10,000-unit fixture confirms the lexical contribution. For `Subject moss. Peut-on affirmer une date unique?`, the source channel ranks the permitted Ember passage first (BM25 −9.678789; matches `date`), then the two Moss passages (BM25 −9.031804 each; match `moss`). Nova and distractor passages match `subject` at much weaker scores. The OR query treats `date` and `moss` as ordinary search terms; the textual prefix does not establish an authoritative subject restriction. Wiki/memory channels and semantic fusion subsequently change final positions.

This is evidence of query ambiguity and generic lexical weighting, not proof that the engine should infer a client association or a contradiction edge. The next reviewed experiment should compare explicit engine project/client scope, unambiguous bilingual questions and free-text subject mentions as separate scenarios. Keep default ranking unchanged until that comparison has independent labels. The exported evidence packet contains both Moss passages and their exact references for human inspection.

## Scoped-retrieval follow-up (2026-10-09)

A separate Saffron/Marigold bilingual development regression found a project record/entity-ID mismatch. Source metadata references the entity, while the app uses the project record. Current source filters now accept the explicit stored mapping; the new tests cover two conflicting delivery statements, unrelated distractors and revoked source access. This is a scoped-retrieval correction. The unscoped Moss top-five weakness remains open, and its exposed questions were not used to adjust ranking weights or infer relationships.
