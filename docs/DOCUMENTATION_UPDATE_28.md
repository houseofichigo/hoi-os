# 28-step documentation reconciliation

Date: 30 October 2026. State: local candidate, not published.
Base: `5a61dd9e82f59a1b9c4109d3cc4c22f6b34af9b3` on houseofichigo/hoi-os.

## What changed

- Adopted eight phases and 28 steps, with an exact prior method snapshot and an old-to-new mapping. `method/journey.json` owns the numbering checks.
- Reused the foundation manifest and twenty templates, now version 2.1.0. Knowledge/navigation and recovery responsibilities have explicit legacy mappings; no client file is renamed.
- Integrated ETHICS in English/French into the checksummed guide bundle and managed manual. Existing manifests remain readable; customized guides and manuals remain protected.
- Added a bilingual plain-language guide and eight Learn modules. Modules 1–4 need only a folder and assistant. Module 5 introduces the engine. The teaching sequence intentionally differs from technical setup order.
- Adapted the learning exercises to the published engine. Manual evidence checklists, separate review and a bounded handover replace dependencies on unpublished context/review/resume APIs. No engine feature was pulled in to satisfy documentation.
- Moved historical reports under records, with compatibility pointers and exact original snapshots for reports needing relative-link relocation. Assertions and results are unchanged; JSON compatibility copies retain their original shape. Unavailable historical verification artifacts are explicitly labelled, including five former broken links in active guides.
- Generated product skill mirrors and plugin copies from their maintained sources. Updated company canonical documentation separately while retaining its newer unpublished workflow behavior. Source preparation does not update private installations.

## Implementation boundary

Only two runtime source files change: the guide-name list and managed adapter text. Registered operations, schema 21, permissions and business records are unchanged. The retired desktop application is not restored. No provider call, schedule activation, private migration or publication occurred.

## Verification

The candidate was tested independently of the patch author's reported results:

- Full `npm run check`: 350 tests, 347 passed, 3 skipped, zero failures; generated guide/skill/expertise, foundation, Learn and journey checks passed.
- Browser: five onboarding, adapter and Knowledge Hub scenarios passed.
- Five changed skill packages: static compatibility audits passed with zero findings. This is not host execution certification.
- Legacy guide manifest and customized ETHICS/manual preservation: focused final test passed. An earlier fixture incorrectly retained the current checksum after removing guide entries; the fixture now models a real previous bundle.
- Initial restricted-sandbox run could not bind localhost. Network-enabled tests supersede those environment failures.
- Concurrent final packaging run: archive checks passed, but relocated acceptance exceeded its 180-second test timeout. Standalone rerun: all four tests passed, including the 13 internal relocated acceptance checks.
- Final candidate archive: two tests passed, including exact Hub bytes, all learning/ethics files and reproducible checksums.
- Active and relocated historical documentation links, formatting of changed code, and the two-file runtime-change boundary passed.
- Current publication inventory: no detected content findings or unclassified paths; historical findings below still block the publication gate.

## Remaining gates

- Human translation review, independent answer-quality review and observation of at least three business participants remain unverified. Structural checks do not certify learning effectiveness.
- The publication scanner still flags 24 already reachable historical objects: 22 distribution ZIPs, their checksum list and a generated native-session artifact. Current candidate files have no detected content findings. No history rewrite or deletion is performed; publication needs a separate disposition of those findings.
- The supplied briefing identifies Module 4 Harness v10, its phase-map slide, Learn AI branding guidance and Build with AI Day 2 as external training follow-ups. These assets are outside this repo candidate. They must be checked against the new map before reuse; no deck, brand release or installed skill was changed here.
- Existing platform/live-provider/participant gates remain separate from this documentation update.
