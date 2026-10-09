# HOI OS completion plan

Updated 2026-09-27. This is the current delivery index; prior batch records remain historical. GitHub updates are the final action after local release gates, never an implementation step.

## Evidence and method

Reconciled approved requirements, local source, test records and deja-vu session references. History explains decisions; source and passing tests establish implemented behavior. Spec Kit is not installed. This repository uses explicit feature specs, implementation tasks and acceptance evidence without adding a runtime dependency or replacing existing manuals. This follows the incremental approach in [Spec Kit's existing-project guide](https://github.com/github/spec-kit/blob/main/docs/guides/existing-projects.md).

## Current state

| Area                 | Evidence                                        | Status / remaining proof                                                                                                                             |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: shared engine     | ENGINE_BATCH_A.md; engine tests                 | Implemented locally. Real assistant-session and Windows credential-store proof pending.                                                              |
| B: optional skills   | ENGINE_BATCH_B.md; adapters tests               | Implemented locally. App-only setup and optional desktop adapters; see E.                                                                            |
| C: intake/governance | ENGINE_BATCH_C.md; intake reliability tests     | Implemented locally; 135 core / 14 browser baseline. Live provider verification pending.                                                             |
| D: daily workspace   | ../specs/004-daily-workspace/spec.md            | Implemented locally: 143 core / 17 browser tests. Coverage, direct actions, saved views and linked results; private migration pending.               |
| E: desktop           | ENGINE_BATCH_E.md; ../specs/005-desktop/spec.md | Implemented locally with packaged macOS arm64 lifecycle tests; unsigned local artifacts. Target-platform and clean-machine verification remain open. |
| F: security/recovery | ENGINE_BATCH_F.md                               | Local build-evidence checks and supported-schema recovery rehearsals implemented. Live-provider, clean-platform and pilot proof remain open.         |

Existing projects/tasks, clients, training records, manual upload, source archive/restore, knowledge reviews, memory and map are retained. Code completion does not establish real-project usefulness.

## Finish in order

1. D completed locally. Preserve its recorded checks and specification as the next batch baseline.
2. E local desktop implementation is recorded in ENGINE_BATCH_E.md. Close clean-machine macOS/Windows, signing and uninstall verification gates before distribution. Local arm64 packaged tests are not cross-platform proof.
3. F local hardening is recorded in ENGINE_BATCH_F.md; close its live-provider, fresh-host and platform gaps. Verify backup and restore into a separate copy before any private migration. Do not downgrade a newer database in place.
4. Select one project and bounded communications/files. Run 30 bilingual retrieval questions (90% answerable recall@5), five briefs (95% factual support; no invented commitments/deadlines), and ten working days without critical defects. Validate selected Google connections and fresh Claude/Codex sessions. Retain handoff without requiring a paid API.
5. Prepare generic setup, installation skills, fictional samples, local packages/checksums, release notes and privacy/publication review. Run platform CI/clean-install checks. Stable release additionally requires two independent client pilots and the original larger benchmark/meeting gates.
6. Only after these gates, update the existing GitHub repository and prerelease downloads, verify assets/checksums/links, and keep alpha claims accurate. No GitHub operation is authorized as part of the present batch.

## Open decisions and limits

Signing/notarization and clean Windows/macOS x64 environments must be arranged for desktop distribution. Optional web search is currently assistant-mediated. Embedded chat, model routing, autonomous rescheduling, email sending, replacement memory systems and broad integrations remain deferred. A submitted assistant result proves schema/evidence validation, not factual correctness; human review remains required.

## Batch E work breakdown — desktop distribution

- Define a narrow desktop bridge and lifecycle contract. Keep the SQLite owner and sync/extraction jobs outside the renderer. Reuse the engine registry; expose selected operations, never arbitrary shell commands.
- Add Electron sandboxing, context isolation, strict navigation/window policy and a vetted preload. Test malformed bridge requests and renderer attempts to reach private files or secrets.
- Build first launch (create/select workspace, health, optional selected sources, optional adapters), native selectors, single-instance detection, engine status/restart and orderly quit. Quit stops sync; there is no hidden service.
- Bundle Node, UI, SQLite, keyring and extraction requirements for macOS arm64/x64 and Windows x64. Record architecture-specific build and launch evidence. Unsigned local artifacts are not a verified public install experience.
- Keep alpha updates manual. Before upgrade, verify the backup and a separate restore; rollback uses a compatible copy. Verify uninstall preserves private workspaces.
- Exit demonstration: on a clean target machine without Git/Node, install, import a fictional document, retrieve it, restart and retrieve it again. No-skills operation must pass before optional adapters are exercised.

## Batch F work breakdown — hardening and operational proof

- Tie each security check to build identity, check version, scope and timestamp. Report pass/fail/not-tested; expire stale evidence. Do not turn results into a certification score.
- Verify engine/renderer isolation, origin/authentication controls, upload containment, source restrictions through all projections, exact approvals, credential exclusion and encrypted/OS-protected credential availability.
- Exercise supported-schema restoration, schema upgrades, interrupted sync/import, manual rollback, archive/move exclusions and native dependency failures in isolated workspaces. Carry every unresolved audit finding forward explicitly.
- Run accessibility, narrow-screen, reduced-motion and map fallback/performance checks. Record actual platform/runtime versions and fixture sizes.
- Verify read-only live Gmail/Calendar/Drive with user-selected scopes, aliases, HTML mail, pagination, expired authorization and cursors. Then verify fresh Codex and Claude sessions against the same running engine.
- Exit: a fresh audit with supporting evidence and no unresolved data-loss, permission, citation, unauthorized-action or blocked-workflow defect. Testing gaps remain labeled, not scored as passing.

## Pilot and release record

Keep a private pilot log outside this product checkout: selected scope and consent, backup/restore evidence, labeled questions, timing baseline/corrections, reviewed briefs and daily incidents. Import only the reviewed selection. Re-run regressions for confirmed defects. A critical defect interrupts the ten-working-day success window.

The final publication checklist is: generic installation walkthrough → clean-machine matrix → skill/package/checksum verification → private-data/content review → version/release notes → GitHub update → downloaded-asset verification. The existing public release is historical and must not be described as containing these local batches. Skills install or verify the released app; they never synthesize it.

## Pilot preparation follow-on

The [recovery-gated walkthrough](PILOT_PREPARATION.md) is implemented. A small user-selected private collection has been imported into an isolated workspace after backup and separate restore. This is smoke evidence only: the full collection, independent evaluation, fresh-host sessions, live-provider checks, clean-platform gates and ten-day pilot remain open. GitHub stays last.

## Executive UX upgrade

[Executive workspace delivery](EXECUTIVE_WORKSPACE.md) records the subsequent UI batches. Reliability/navigation, executive Home, schema-13 conversations/evidence and the first workspace-consistency pass are implemented locally. The delivery record identifies remaining inspector/deep-link/form polish and UX acceptance gates. Existing engine A–F and pilot gates continue to apply. GitHub remains last.

## Consulting and reviewed Skills

[Schema-14 delivery record](CONSULTING_SKILLS.md) covers shared training/consulting projects, workspace skill imports/revisions/activation, conflict-aware optional adapter sync and the focused composer with pinned documents and one skill. These changes are local alpha only. The private pilot, live-provider and platform gates remain open; publication is still last.
