# Harness and Knowledge Hub foundation — validation

Recorded 16 October 2026 for the unreleased local checkout. Schema remains 19; the historical package version remains `0.1.0-alpha.2`. This is a foundation batch, not a complete replacement release.

## Delivered

- `hoi hub` and `npm run hub` serve a focused Knowledge Hub through the existing authenticated engine. Navigation exposes Knowledge Hub, Skills and Configuration. Original intake, reviewed wiki editing, memory, evidence and the 3D map remain available.
- Launcher credentials now work when a complete authenticated URL opens in an already-loaded tab. Plain URLs still show recovery guidance. The wiki reader header wraps without overlapping its actions on narrow screens.
- The seven-phase, 25-step method has a current engine-compatible bridge. Twenty-two supplied reference files, visuals and templates are preserved byte-for-byte with a provenance manifest. Historical instructions and the visual-generation script are preserved source material, not newly enabled runtime capabilities.
- The offline comparison command checks frozen fictional sources, answer standards, declared environment, all included bundle files, receipts and citation quotes. It never executes a skill or activates a candidate.
- The existing map, onboarding and evaluation skills were updated. Product runtime mirrors and catalogue were regenerated; their local canonical copies and company indexes were updated. No host adapter or private skill activation was performed.

## Checks

Environment: macOS arm64, Node 22.14.0, repository Playwright Chromium. No configured provider, live Google account or private records were used.

| Check                             | Result and scope                                                                                                                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                   | 286 passed, zero failed, three skipped out of 289; runtime mirrors/catalogue and generated guides/operation reference match.                                                                                                                                          |
| Selected browser regression suite | 21 passed across focused Hub, wiki, reviewed memory, map, redesign and shell tests.                                                                                                                                                                                   |
| Final wiki-header verification    | Four browser tests passed after the layout correction: focused Hub, wiki and both reviewed-memory scenarios.                                                                                                                                                          |
| New comparison tests              | Six passing core tests cover invalid standards, missing cases, stale inputs, unknown/fabricated citations, uncertain outcomes, path escape and symlinks. Included in the core count above.                                                                            |
| Skill static audit                | All three changed product skills passed with zero blockers or warnings. Static review does not certify host execution.                                                                                                                                                |
| Preservation                      | All 22 method file hashes match the import manifest; archived pre-change files retain their recorded hashes.                                                                                                                                                          |
| Responsive inspection             | Hub wiki reader captured at 390, 768, 1280 and 1440px; no page-width overflow, action remains inside the header. Desktop and 390px captures visually inspected. These are inspection captures, not a complete accessibility certification or golden-image test suite. |

The three skipped tests require a verified offline embedding model: French retrieval with revoked-access checks, automatic index maintenance, and incremental embedding reuse. They were not verified in this batch.

The core suite requires localhost listeners. A restricted-sandbox rerun could not bind them (`EPERM`) in nine tests; those are environment failures, retained separately from the run with local-server access.

The new browser scenario starts without assistant manuals or AI setup, opens a plain URL then its authenticated launcher link, imports a fictional Markdown file through manifest review, saves and explicitly publishes an attributed wiki, opens it from the map, uses the unsent assistant-reference handoff, and verifies refresh/Back navigation. Existing wiki and memory tests cover their reviewed editing workflows.

The two-case comparison example uses manually authored fictional answers. Its result is `needs-human-review`, with `activationAllowed: false`. It does not establish factual quality, held-out isolation, actual provider execution, cost, or an improvement in production retrieval.

## Remaining limitations

1. Hub mode still uses the legacy frontend bundle and registered engine. It is not an API restriction. Legacy screens can still be reached through existing links; physical extraction of the Hub and deliberate retirement of the full app/Electron package remain pending.
2. The existing large 3D graph bundle produces a Vite chunk-size warning. No new performance guarantee is claimed.
3. The uploaded Python harness installer and runtime were not installed. Previously audited containment, overwrite, approval and evaluation defects remain unresolved there. Its skill reconciliation must preserve the governed engine's contracts.
4. Comparison receipts declare execution metadata; they do not attest a real host. An isolated runner, independently reviewed labels and the procedural-memory/review interface remain later work.
5. No Electron packaging, clean-machine, Intel Mac, Windows, live-provider, live-connector or ten-day pilot certification was performed. The retained desktop implementation does not constitute certification of the new direction.
6. The separate company skill index already referenced 29 other absent canonical source files and its collection README contained unresolved merge markers. The three skills changed here were restored from the product source and verified. The remaining inventory repair is separate; this batch does not claim that the entire company catalogue is healthy.

No private migration, broad import, API spending, GitHub update, app publication or deletion of the old app occurred. See [transition](HARNESS_TRANSITION.md) for remaining delivery and [Hub guide](KNOWLEDGE_HUB.md) for the fictional demonstration.
