# Precise retrieval and selected sessions — local validation

19 October 2026. This is an unreleased schema-21 upgrade to the Node harness and optional Knowledge Hub. The 25-step method and 22 optional skills remain. The historical app/Electron edition remains retired.

## Delivered

- Meaningful-field FTS5 discovery, original-passage expansion, duplicate suppression before discovery candidate limits, a versioned candidate profile and explicit lexical fallback/rebuild for a damaged projection. Serialized JSON keys no longer match as content.
- Reviewed normalized JSON and Markdown/text session imports. Exact uploaded bytes, checksums, selected roles, unknown timestamps, omissions and stable identities survive restart/restore. First import, duplicate replay and stale preview are distinguished.
- Cited unreviewed observations, explicit one-window enrichment with durable checkpoints, existing disclosure/budget controls and conservative uncertain-outcome recovery. Unchanged observations retain promotion identity across instruction revisions. Memory promotion remains proposed.
- Separate extraction, lexical/semantic indexing, enrichment-window and upstream-coverage states; missed-check reporting, configurable grace periods, Activity entries and a disabled status-only n8n monitor template.
- Additive schema 20 → 21 migration and rebuildable search tables. Existing IDs, approval paths, wiki/memory authority and source permissions are retained.
- Six updated skills with prior versions, canonical company copies, provenance, registry hashes, product mirrors and generated guide/operation references. The company inventory has 60 unique IDs; the product catalogue remains 22.

## Verification

| Check | Recorded result |
| --- | --- |
| Full core/regression check | 338 tests: 335 passed, 3 skipped, 0 failed. The skips require the optional verified local model package. |
| Hub browser regression | 20 passed. Responsive baselines at 390, 768, 1280 and 1440 px; session reader/import, dismissal/focus, existing map/wiki/memory and automation workflows. |
| New discovery/session lifecycle suite | 13 cases, including corrupted projection recovery, source revocation, malformed exports, exact byte preservation, duplicate/stale imports, bounded enrichment, cancellation/uncertain outcomes, replacement instruction identities and separate migration/restore. |
| Skill checks | All six edited skills pass the bounded static inspector; catalogue and guide checks pass; 60 registry sources/hashes and index entries agree. No private installation or activation. |
| Read-only monitoring | A status-only credential can inspect safe status but cannot trigger work or impersonate an engine host. Pausing revokes it. |
| Packaging | Use the new local candidate and its acceptance receipts. `scripts/discovery-acceptance.mjs` rehearses session → observation → memory proposal → restart → separate restore against an explicitly selected relocated package. |

Build evidence is recorded locally in `.verification/security.json`; raw logs remain local. Screenshots are fictional fixtures under `tests/browser/`. These checks do not certify live model answers, a fresh machine or a continuously hosted deployment.

## Retrieval measurements and quality limitations

The 48 authored fixtures are split into 24 development and 24 held-out cases by scenario family. Labels remain provisional pending independent human review. The ranking runner supplies authored question-to-claim associations and scopes its scored result to a known source. It is a deterministic unit-ranking comparison, not end-to-end answer certification.

On those fixtures, the baseline and ranked variants both retrieve the labelled answer within five results. Held-out nDCG@10 changes from 0.631 to 1.000. That result demonstrates the mechanics of precise claim expansion; it does not establish semantic extraction quality, factual support or correct model abstention. Empty result rate is reported separately and is not treated as abstention accuracy. Hybrid retrieval was not evaluated in this run.

On this **Apple M5, 10 logical CPUs, 32 GiB RAM, macOS arm64, Node 22.14.0**, the synthetic workload contains **100 sources, 10,000 exact source passages and 10,000 discovery units**:

| Measurement | Quiet local run |
| --- | --- |
| Exact-identifier queries | 50/50 relevant within five; 50 exact references resolve |
| Warm exact query p50 / p95 | 0.92 / 1.51 ms |
| Broad query p50 / p95 | 216 / 301 ms, 20 queries |
| Peak process RSS | About 490 MiB, including fixture construction |
| Discovery index bytes | 11,968,512 |
| Database / WAL bytes | 23,433,216 / 4,214,792 |
| Provider calls and cost | None; $0 |

A separate run alongside the core/browser workload measured broad p95 **2,565 ms**, exceeding the two-second target. That result is retained, not discarded. The quiet target passes on this named synthetic workload; performance under contention, semantic inference, concurrent user requests and larger/mixed corpora remains unproven. No desktop-scale guarantee is extrapolated.

Raw ranking and both timing reports are preserved locally under `.local/knowledge-pipelines/2026-10-19/`. The scripts can reproduce them without private inputs or provider calls.

## Rollout and remaining gates

- Candidate observation ranking remains **opt-in**. Independent label review, ≥90% answerable recall@5, ≥95% factual support and ≥95% missing-answer abstention still require a separate end-to-end evaluation. No automatic quality certification is claimed.
- Enrichment is opt-in; selected imports, ordinary lexical retrieval and mechanical checks work without an AI key. No session watcher or automatic acceptance is introduced.
- The n8n monitor is inactive. Its portable structure follows official node documentation, but target-instance validation, credential binding, saved-connection inspection and fictional execution remain required. Available n8n tools did not expose node-schema/validation administration. No live scheduler was configured.
- Fresh-host/Windows checks, live-provider evaluation and continuous-host availability are separate gates. A monitor on a stopped host cannot detect that host's outage.
- No private migration, source activation, provider change, restored desktop application, GitHub push or publication occurred.

## Packaged rehearsal and publication boundary

The local candidate `release/hoi-os-precise-knowledge-2026-10-19-r1/` completed all 13 packaged installation/recovery checks and all five discovery-specific relocated checks. Production dependencies were installed from the existing cache; the first sandboxed attempt could not access that cache, and the authorized retry succeeded. This is a development-machine rehearsal, not a clean-machine claim.

The discovery rehearsal imported a selected session twice, preserved exact original bytes and speaker roles, resolved a cited French discovery question to its original passage, proposed one memory without approval, restarted, restored a separate copy and rebuilt a deliberately removed discovery projection. No AI call occurred.

Current distributable-file scans found no credential/path patterns. The repository-wide publication preflight remains **blocked by 24 pre-existing excluded-history-path findings**. No history was rewritten. Current routing/automation files were classified in the publication allowlist after inspection. Any future publication needs a separate history review; this local upgrade does not authorize it.
