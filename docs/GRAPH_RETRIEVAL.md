# Graph retrieval implementation — 30 October 2026

The engine exposes read-only `knowledge path` and `knowledge impact` operations with strict inputs: source identity, optional target identity and depth 1–2. The authenticated Hub exposes the same reads under `/api/knowledge/path` and `/api/knowledge/impact`. Inputs are validated by the shared graph operation contract.

Traversal starts from the permission-filtered graph. Inferred relationships are excluded and evidence is rechecked. Only CITES, SUPPORTS, DESCRIBES, CONTRADICTS and SUPERSEDES participate. Paths follow stored direction; impact follows supporting edges forward and other dependency references backward. A path indicates recorded relationships, not proof of a composite claim. Impact suggests review and never edits a record.

Responses stop at 100 nodes / 200 edges and report truncation. Depth defaults to one, maximum two. Missing and inaccessible identities share the same unavailable response. The implementation still materializes the authorized graph before traversal: bounded output is not a bounded-memory index. No historical graph reconstruction is claimed.

The map offers Explain connection and Review impact from the selected record, an accessible textual edge list and a clear-result action. These are explicit exploration actions; automatic retrieval has not been broadened to two hops.

Linked-source retrieval now retains the original query. Expansion candidates are sorted before the 20-item cap. Linked published wikis are scoped by exact page identity before ranking; operational records resolve from the permission-filtered operational read model. Explicit contradictions retain a bounded fallback when their vocabulary does not match.

## Verification and remaining gates

Frozen structural cases in `tests/graph-query.test.mjs` cover directed one/two-hop paths, depth limits, unavailable identities, hidden titles, isolated sources and malformed requests. They are regression fixtures, not human-labelled semantic evaluation.

Initial four-entity measurements recorded 2.76–5.38 ms per read and 61–919 serialized characters. These are six local observations, not production p95 or tokenizer counts. No provider was called. Actual token savings, maintenance cost, independent answer-quality evaluation and a 10,000-unit performance run remain unverified. Broad graph expansion remains off until those comparisons pass.

No schema migration, new provider, schedule, private workspace upgrade, Graphify installation or publication is included.

Recorded checks: core build and guide consistency pass; four graph tests, three retrieval regressions and four browser map tests pass. The updated browser suite exercises Review impact. Its 1,000-document fixture measured 812 ms list / 2,571 ms graph on Apple M5. The full `npm run check` was attempted but stopped after the adapter setup subprocess did not finish; it is not a passing full regression run. Logs are preserved outside the product repository. Independent semantic quality, paid-token comparisons and maintenance-cost measurements remain outstanding.


## Completion follow-up

Exact linked-page resolution, revoked intermediary regression coverage and path-evidence opening are implemented. Eight browser cases pass, including the four specified widths. The standalone adapter suite passes (5 tests); its durable file writes explain the earlier long run.

`node scripts/measure-graph.mjs <output.json>` reproduces a fictional 10,000-entity / 99-edge benchmark without providers. Ten warm reads measured median 71.94 ms / p95 107.87 ms on Apple M5, 187.7 MB peak RSS, 916 serialized characters per response, and 582 ms fixture construction. Every read rebuilds the authorized projection, so rebuild overhead is included. This sparse graph benchmark does not certify dense graphs or passage retrieval.

No actual model-token or lifecycle API-cost saving is claimed. The optimization default remains unchanged pending independently labelled answer-quality comparison and provider-token evaluation. These external acceptance gates cannot be replaced by structural tests.

### Final local verification

The full run completed 389 tests: 384 passed, 3 skipped, one contradiction assertion failed and one package case timed out under parallel load. The contradiction behavior was corrected and all 10 focused graph/historical tests passed. Re-running packaged acceptance through npm without competing tests passed all 4 checks in 49.8 seconds. All 8 map browser tests passed. Skill mirrors, generated guides, 15 expertise packs, change-impact fingerprints, 20 foundation responsibilities and bilingual Learn links passed their checks. Initial failed/timeout logs remain preserved; this is not represented as an uninterrupted green full-suite run.

The software increment is complete. Broader automatic expansion remains disabled pending independent factual-support review and actual provider-token/cost comparison. No private activation or GitHub publication occurred.

## Published candidate scope

This commit isolates the graph update on the published base. Earlier verification above refers to the broader local development checkout. The isolated candidate additionally passed its build, 13 graph/retrieval/history tests and the map browser suite; unrelated unpublished Learn/workflow changes are not included.
