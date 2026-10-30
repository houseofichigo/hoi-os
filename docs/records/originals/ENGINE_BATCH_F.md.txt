# Security evidence and recovery — Batch F

Local engineering audit, 2026-09-27. Schema 12 / engine API 1 remain unchanged. This audits source and synthetic behavior, not private workspace health or live provider reliability. No private migration, business-data ingestion or GitHub update occurred.

## Changes

Security findings now carry build identity, check version, scope and test timestamp or explicit missing evidence. Current workspace integrity, policy, visible connector scopes and verified-backup state remain separate from recorded synthetic results. Matching-build passes are available for permission enforcement, authentication/origin, uploads, exact approvals, credential exclusion, recovery, connector regressions, browser behavior and desktop boundaries.

Records are constrained to aggregate fields, matched to OS/architecture and expire after seven days. Unknown fields, wrong versions/builds/platforms, future or expired timestamps, failed suites and zero-test claims cannot create a pass. Build changes after process load produce a visible restart-required finding. Local records are unsigned and are not a certification or tamper-proof attestation. Live provider and OS keyring checks deliberately remain not-tested.

`npm run verify:security` executes the core check command, including skill consistency, and atomically records results only if the build remained unchanged. Browser and staged-desktop modes use the same contract. Raw logs are kept locally outside distributable records. Packaging preserves the declared Electron version in runtime metadata because the packager strips development dependencies; a regression verifies identity remains stable across that transformation. The app shows each finding's scope, evidence time and tested environment. Packaged evidence from this Apple Silicon machine does not grant Windows/Intel passes.

Recovery coverage now includes all supported older schemas, 1–11, with later feature tables actually absent. Each rehearsal verifies a backup, restores into a different directory, migrates the copy, checks originals/IDs/approved memory/base approvals/host instructions and restores a separate old-schema rollback copy. Existing task/history and interrupted-operation regression suites remain in the core checks. These are reconstructed synthetic legacy fixtures, not archives from real historical client installations.

Desktop startup now reports a redacted actionable bootstrap failure, refuses to wait the full timeout after an early engine exit, and preserves the first IPC request during asynchronous imports. A dedicated delayed-import test covers that timing boundary. This supplements the existing native-runtime import, restart, quit and upgraded-copy scenarios.

The optional `hoi-security` skill now reads the bundled runtime command and explains matching evidence versus live verification. Runtime mirrors and the canonical House of Ichigo copy were updated with checksummed provenance; no global adapter installation or publication was performed.

## Verification

Build: `914f9868f259e7ee8425a35b0777472ec7185d5a613f1fb0e1df2891a7c877ab`.

- **162 core tests passed**, including production build and runtime catalogue consistency.
- **18 browser tests passed**, including security evidence on narrow screens, keyboard workflows, reduced motion and WebGL fallback.
- **2 Electron scenarios passed in both the stage and packaged macOS arm64 app**, covering no-skills workspace creation, Markdown/DOCX import and worker extraction, native selection, optional adapter runtime, concurrent CLI retrieval, restart/quit and non-overwriting upgrade-copy behavior.
- Synthetic 1,000-document map on Apple M5: **315 ms list; 1,263 ms graph**. These are local measurements, not cross-machine guarantees.
- Security-skill validation passed. The evidence record has no paths, account identifiers, document content, credentials, raw errors or tokens.

The [machine-readable historical record](verification/2026-09-27-security.json) contains actual suite times, environment and digests. The [evidence guide](SECURITY_EVIDENCE.md) documents reproduction and expiry. Local Batch F artifacts use `local-f` filenames, preserving earlier Batch E ZIPs/installers; current checksums live in `desktop-release/SHA256SUMS`. All six retained Batch E/F artifact checksums were verified. All three Batch F package trees match the final build ID, include required notices and sanitized evidence, and exclude raw verification logs and private workspace directories.

## Carried-forward audit findings

| Finding                                                       | Current disposition                                                                                      | Required remaining proof                                                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Competing CLI/app workspace locks                             | A implementation retained; concurrent operation regressions pass                                         | Fresh real Codex/Claude sessions and Windows credential storage                                                                                   |
| Primary launcher opened map                                   | A fix retained; Home remains primary                                                                     | Clean installed-app walkthrough                                                                                                                   |
| Skills were mandatory / could be mistaken for app generators  | App-only setup retained; security skill now desktop-aware                                                | Fresh assistant installation handoff                                                                                                              |
| Stale schema/install documentation                            | Compatibility manifest and current batch index retained; historical validation is dated                  | Reconcile final release notes and install downloads at publication                                                                                |
| Dashboard ambiguity, overdue deadlines and record navigation  | D regressions pass                                                                                       | Five reviewed real meeting briefs and daily-use pilot                                                                                             |
| Path-dependent intake identities, silent skips, provider gaps | C regressions pass for moves, archived exclusions, skips, HTML mail, pagination/cursors and interruption | Selected live Gmail/Calendar/Drive scopes, aliases and revoked authorization                                                                      |
| Permanent security placeholders                               | Replaced where measured evidence exists; live gaps remain explicit                                       | Live OS keyring round trip, provider access, platform matrix                                                                                      |
| Recovery compatibility across prior schemas                   | Expanded synthetic matrix passes without modifying an original workspace                                 | Backup/restore rehearsal of the selected private workspace before migration                                                                       |
| Desktop distribution                                          | Local unsigned native artifacts; narrow bridge and lifecycle tests                                       | Clean macOS arm64/x64 + Windows installs/uninstalls; signing/notarization; branded native icon                                                    |
| Desktop external research links                               | Still blocked except OAuth; browser interface remains available                                          | Reviewed safe external-link flow before claiming desktop research parity                                                                          |
| Native integrity and packaging                                | Separate native dependency trees and preserved notices; unpacked resources retained                      | Signed-resource/native integrity hardening and target-platform execution                                                                          |
| Knowledge quality and daily usefulness                        | Synthetic retrieval/grounding only                                                                       | Bounded real data, 30 bilingual questions, ≥90% answerable recall@5, ≥95% factual support, five briefs, ten working days without critical defects |

No confirmed critical defect remains in the exercised synthetic scenarios. Untested environments and live data are not declared defect-free. Batch F's local engineering work is complete; its operational/release gates remain open.

## Next

Arrange the clean target-machine checks and select one bounded project/source scope for the private backup-and-restore rehearsal. Only then migrate the approved copy and begin live-provider/fresh-host verification and the ten-day pilot. Do not ingest the whole company directory by default. GitHub publication remains last, after local release/privacy/package gates; stable-release client-pilot requirements remain unchanged.
