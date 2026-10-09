# Desktop application — Batch E

Local implementation, 2026-09-26. Schema 12 / engine API 1 are unchanged. No private migration, business-data import, external action or GitHub update.

## Implemented

Electron hosts the existing app with sandboxing and context isolation. SQLite, synchronization and extraction remain in a separate engine process. The app and bundled CLI use the same authenticated operation registry. No shell, filesystem API or arbitrary IPC is exposed to the renderer. Fixed bridge actions validate the calling main frame and selected engine origin. Unknown navigation, permissions and renderer network destinations are denied. A separate in-memory session serves an explicit setup-asset allowlist. The system browser is used only for the supported Google authorization endpoint.

First launch creates or selects a separate private workspace. It does not install skills or write assistant manuals. Existing Home, Knowledge Hub, projects, clients, chat handoff and Configuration remain the app UI. Native source-folder selection fills the scoped connection form without importing automatically. Configuration and the native Workspace menu expose engine/workspace controls. One desktop instance runs per profile; a pre-existing workspace owner is refused rather than bypassed. Quit stops sync, drains accepted engine work and releases ownership.

Optional adapters remain installed through Configuration. Their managed manual points to `.hoi/runtime.json`, now including the bundled executable/argument array. The bundled CLI works without separately installed Node and can retrieve while the app owns the workspace. Adapter backups/manual preservation remain the existing engine behavior.

Older workspaces require an explicit upgraded copy: verify backup, restore separately, migrate copy, check health, then open. Overlapping or occupied destinations are refused. The original schema stays intact. Uninstallation does not target external private workspace directories; native clean-machine uninstall remains unverified.

Staging uses an explicit distributable-file allowlist, production dependencies and separately rebuilt SQLite binaries. Font, Electron and Chromium license notices accompany the bundled code. Electron 42.11.8 / SQLite 12.11.1 provide prebuilt native compatibility; Electron 44 was evaluated but the existing SQLite line had no matching prebuilt ABI, and this machine lacks Apple build tools. The maintained 42 patch line avoids silently adding those system tools. Reassess support before publication.

A discovered packaging issue initially rebuilt the developer Node SQLite dependency as well. Staging now invokes `@electron/rebuild` against the isolated stage root only; both Node regressions and Electron tests passed afterward. Packaging consumes one staged architecture, never a mixed-architecture dependency tree. Publication is disabled in the wrapper. The manual macOS/Windows CI definition is local and unexecuted; runner labels follow [GitHub’s runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

## Evidence

- **145 core tests passed**, including the two new desktop bridge/URL boundary tests; generated runtime catalogue consistency passed.
- **17 browser tests passed** after the Configuration changes.
- **Two Electron lifecycle scenarios passed** against the staged app and packaged macOS arm64 app: app-only creation, fictional Markdown and DOCX upload/index (including the extraction subprocess), fresh bundled-CLI retrieval, native source-folder selection, optional adapter installation and its runtime command, restart/persistence, isolation, denied file navigation/external fetch, quit lock release, and schema-11 upgraded-copy flow with overlapping/nonempty destination refusal.
- Local unsigned ZIPs for macOS arm64/x64 and an NSIS installer for Windows x64 were generated. Packaged SQLite binaries were inspected as Mach-O arm64, Mach-O x86_64 and PE32+ x86-64 respectively. Checksums are recorded in `desktop-release/SHA256SUMS`. Runtime proof is limited to Apple Silicon on the current HOI development machine; it is not a clean-machine installation test.

## Remaining gates

Clean-machine macOS arm64/x64 and Windows install/restart/uninstall; Windows credential-store behavior; distribution signing/notarization; custom native app icon; live OAuth; real fresh Claude/Codex sessions; extraction performance on packaged large files; the bounded ten-day pilot. Unpacked resources are used for the native engine/extraction children; signed resource-integrity hardening remains a release gate. External research-link popups are blocked in the desktop pending a reviewed safe external-link flow; the browser app remains available for them.

The app remains alpha. No claim of completed client release, security certification or real-data grounding is made. Batch F should attach build-specific security evidence and rehearse recovery while retaining these open platform findings.

See [desktop instructions](DESKTOP.md), [specification](../specs/005-desktop/spec.md), [tasks](../specs/005-desktop/tasks.md) and [completion plan](COMPLETION_PLAN.md).
