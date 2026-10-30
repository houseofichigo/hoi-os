# Harness skills and installer validation — 17 October 2026

Local, unreleased HOI OS batch. The product remains the governed engine, optional Knowledge Hub, 25-step method and 21 optional skill packages. Schema stays 19. No private workspace installation or migration, provider execution, scheduling, activation or publication was performed.

## Delivered

- All 15 roles from the supplied 1.1.0 harness have explicit destinations in `method/SKILL_MAP.json`. The original ZIP, 22 method documents/templates and source instruction hashes remain preserved. The Python installer, guard plugin, static viewers and competing memory/approval stores are not installed.
- Source setup defaults to the Hub with no assistant adapters. It rejects nonempty uninitialized directories and overlapping product/workspace locations, including aliases, before writing. It does not initialize Git or stage files.
- Adapter installation preflights complete skill folders. Same-name imported or customized folders remain untouched instead of being mixed with bundled files. Removal preserves custom content in place and reports conflicts. Runtime availability remains distinct from package integrity.
- Updates write a durable recovery marker after verified backup and before managed changes. An interrupted update or conflicting concurrent edit blocks replay and directs recovery into a separate copy. Configuration displays recovery guidance and disables further adapter mutations until recovery.
- The staged rehearsal exposed a backup defect: the generic intake walker excluded `.agents` and `.claude`, so older backups could retain manifests without installed skill files. Backups now separately include workspace skill folders, including custom skills, while excluding adjacent host settings, known credential paths, symlinks and excluded build/cache paths. Existing backups are not retroactively repaired. Follow [the recovery guidance](HARNESS_SKILLS.md#conflicts-and-recovery).
- Product mirrors and catalogue are current. Twenty-nine missing company skill sources were recovered from preserved Git history: 24 instruction hashes matched the old index directly; five historical variants were reconciled to current product sources with both versions retained. All 21 current product bundles were synchronized into the canonical local company collection. All 59 company inventory entries now have valid paths and hashes. The neutral public mirror was not changed.

## Verification

Environment: macOS arm64, Node 22.14.0 and Playwright Chromium on the existing development machine. Fictional temporary workspaces only.

| Check                        | Result and scope                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core and consistency         | 297 passed, zero failed, three optional-model tests skipped out of 300; runtime mirrors, catalogue and generated guides checked                                                     |
| Targeted browser regressions | 13 passed: Hub workflows, Skills, onboarding, adapter conflict/recovery UI, keyboard/focus behavior and responsive layouts including 390/768/1280/1440 pixels                       |
| Static skill review          | All 21 product instruction packages passed the Skill Repo Forge static audit with zero reported blockers, warnings or notes; not a host-execution certification                     |
| Preservation                 | 176 pre-change files, 22 original method files, all 15 supplied instruction hashes and 21 current canonical product bundles verified                                                |
| Company inventory            | 59 unique IDs; indexed paths, instruction hashes and root index agree; canonical README conflict markers resolved locally                                                           |
| Package                      | 389 manifest entries verified, plus the manifest itself; nine runtime dependencies; old frontend and Electron absent; no machine-specific author path or excluded secret file found |
| Isolated dependencies        | 111 packages installed with `npm ci --omit=dev --offline`, using the existing local cache; no repository `node_modules` link                                                        |
| Hub without adapters or AI   | Setup, fictional Markdown import, retrieval and two separate server launches passed; exact source revision retained                                                                 |
| Recovery                     | Backup restoration to a separate directory preserved source revision identity and both adapter bundles, including custom instructions; relocation setup refreshed runtime paths     |
| Adapter lifecycle            | Both hosts' 21 instruction packages and linked guides verified; owner manual text, folder conflicts and custom removals preserved; host execution not attempted                     |
| Removal simulation           | Reversibly moving the installation directory left the separate workspace intact; this is not an OS uninstaller test                                                                 |

The final development build identity is `f10c8b800e40f266d8293c95559eb69b5bd7207070da64593ae422cc161f58b6`. Its core security evidence is current. The 13-scenario browser run is recorded as targeted evidence, not substituted for a complete browser or desktop suite.

The first isolated dependency attempt was blocked from accessing npm's native cache by the sandbox; the approved cache-access retry succeeded. The staged restore failure was fixed and retested. A subsequent fixture-only comparison was corrected for macOS `/var` → `/private/var` canonical paths. These intermediate logs and the superseded local candidate remain preserved alongside the passing evidence.

## Local deliverable and limitations

Candidate: `release/hoi-os-knowledge-hub-2026-10-17-local.zip`, with adjacent SHA-256 file. It contains the engine, Hub, method, skills and maintained guides. It requires Node 22.14+ and compatible native dependencies. It is not published or a signed desktop installer.

The local evidence archive is `archives/2026-10-17/hoi-harness-reconciliation/` in the containing company workspace: preservation manifests, recovered-source provenance, static audits, final core/browser logs, isolated-package receipts and package checksums. Private workspace records and credentials are not part of this candidate.

Fresh Codex/Claude session discovery, clean Mac/Windows/Intel Mac installation, live connectors/providers and real-use quality remain unverified in this batch. Restored non-product implementation briefs were integrity-checked, not executed or newly activated. Optional model tests remain skipped.

Legacy business-app/Electron sources are still preserved in the development checkout. The next planned batch is deliberate source/dependency retirement and shared-style cleanup, followed by the complete fictional Chief of Staff recipe, isolated evaluation runner and reviewed procedural-memory experience. See [transition status](HARNESS_TRANSITION.md).
