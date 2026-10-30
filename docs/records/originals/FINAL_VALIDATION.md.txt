# Final harness and Knowledge Hub — local validation

17 October 2026. Final local implementation and candidate handover for the current product boundary: seven phases / 25 steps, 21 optional product skills, governed schema-19 engine and Knowledge Hub. No private upgrade, live provider call, assistant-host session, GitHub update or publication.

## Final changes

- Current README, documentation index and handover distinguish the harness/Hub from the retired desktop app and historical skills releases.
- Architecture, connection and recovery guidance now describe the current owner of each capability and scoped adapter backups.
- Installer instructions, product mirrors and the canonical company copy are reconciled with per-file provenance. All 59 company inventory IDs have existing sources, matching hashes and index entries; all 21 product skill trees match their canonical copies. Inventory is not activation.
- Skill packaging requires a new explicit output directory. It refuses source overlap and overwrite, preserves prior release directories and records exact instruction checksums.
- A reproducible local candidate command assembles the Hub, separate skill archives, build identities and checksums. The manual CI workflow prepares artifacts with read-only repository permissions; automatic tag-triggered publication is removed locally.
- Installation acceptance rejects incorrect pinned direct-dependency versions before creating a workspace.
- Publication preparation rejects unsafe path forms and localhost authentication fragments. Recent source files and tests have explicit allowlist entries; a stray session file is excluded and preserved locally.

## Measured checks

| Check                                  | Result                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Complete core suite                    | **306 passed, 3 skipped, 0 failed** (309 total); includes generated guide/catalogue checks                                    |
| Browser suite                          | **18 passed**; current Hub regressions and 390/768/1280/1440px coverage                                                       |
| Focused packaging/install checks       | **12 passed**, including deterministic package bytes, collisions, stale dependencies and recovery                             |
| Exact final ZIP installation rehearsal | **12 of 12 checks passed**, after extracting into a new directory and installing 111 production packages from the local cache |
| Formatting / whitespace                | Prettier check and Git whitespace check passed                                                                                |
| Dependency advisories                  | Production `npm audit --omit=dev`: **0 reported vulnerabilities** at this check                                               |
| Prior-version preservation             | **111 archived file hashes verified**, plus the excluded session artifact retained                                            |
| Current documentation entrypoints      | Relative local links resolve                                                                                                  |

Environment: macOS arm64, OS release 25.6.0, Apple M5, 32 GiB RAM, Node 22.14.0 / ABI 127. This was the existing development machine, not a clean user/machine. The three skipped tests require an explicitly supplied offline semantic model; no model was downloaded for this run. Independent bilingual ranking and factual-support certification remain separate. The dependency scan is point-in-time evidence, not a guarantee of safety; native installation still reports the upstream deprecated `prebuild-install` helper. The 3D map is lazy-loaded and its large chunk remains a build warning.

The exact package rehearsal verified no-skills/no-AI onboarding, authenticated launch, one engine shared with CLI identities, preserved import and deduplication, denied-source filtering, proposal retry and scripted exact approval, optional adapters/manual preservation, credential-excluding backup, restart, separate restoration, same-schema upgrade backup and customized-adapter removal conflicts. It did not certify historical migration or actual product uninstallation on a fresh system.

## Candidate identity

Local directory: `release/hoi-os-harness-final-2026-10-17/`. The historical base version is retained; it does not identify a new public release.

- Source build: `abe1fa206f4c4ab73c0bfffe50e369c2a9d2c947bb16bd8a06659b9225f2639c`.
- Packaged build: `85b8c3a04118eec601dbbe7c568f6337680db58c822d452de75f71468827f3a0`.
- Hub manifest: **411 files**, SHA-256 `3de7afc029f1edce7ff208c3272f6b02ec7ac03efff4687443bab27ce57ccd07`.
- Hub ZIP SHA-256: `a571ac4c5bc9ff38314df9c46feb0e85c15186ee7366388d73e47b375edf3c2e`.
- Installer ZIP SHA-256: `dcf95c31f41e1e2041a27441002d8907a01f19ca94b3fcebee45c8e827c05c66`.
- Operational skills ZIP SHA-256: `d435332a8f97cb5719f6da02607e024043d302cd8d74d51528647f5107cd0861`.

The production dependency lock differs from the source checkout, so source and packaged builds have separate identities. `CANDIDATE.json`, `SKILL_PACKAGE.json` and both SHA256SUMS files record the deliverable. No Node runtime, private workspace, credential store or model binary is bundled. Checksums are integrity evidence, not signatures.

## Publication blocker

The final source allowlist contains **579 files**, with no unclassified files and no selected credential/private-path pattern matches in current source. Reachable history scanning covered **679 blobs** and found **24 excluded paths**: 23 historical generated distribution artifacts and one `:memory:.ses` file. These are path findings, not 24 detected credentials. The source-candidate command therefore remains **blocked** and does not emit an approved source snapshot. Historical archive content review and a deliberate remediation decision are required before publication. History was not rewritten, and no previous remote asset was changed. Pattern scanning does not replace privacy and licence review.

## Remaining external gates

Actual fresh-machine native installation/removal; separate Windows/Intel Mac/Linux evidence; fresh Codex/Claude invocation; independent retrieval and skill effectiveness; bounded live provider/Google workflows; historical-workspace migration with recovery; and the real-use pilot remain unverified. Signing/notarization for the retired Electron app is outside this product boundary. Publication is a separate decision after the history finding and relevant gates are resolved.

The local implementation handover is complete for this scope. Use [the handover](FINAL_HANDOVER.md), [installation kit](HUB_INSTALLATION.md), [host worksheet](HOST_ACCEPTANCE.md) and [release gates](ACCEPTANCE.md) for external acceptance, rather than treating another feature batch as evidence.
