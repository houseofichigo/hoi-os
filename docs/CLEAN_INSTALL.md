# Desktop installation verification

## Evidence boundaries

A developer-machine run, an empty workspace and an empty PATH are useful isolation
checks. None establishes a clean-machine installation. Keep these results separate:

| Environment       | Required evidence                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Development Mac   | Staged and packaged app launch, renderer boundaries, import, restart and upgrade-copy tests                          |
| Clean Mac         | Fresh user/machine without HOI, Git or Node setup; native keychain, app launch, import/retrieval, update and removal |
| Clean Windows x64 | Native installer, credential store, launch/import/restart, update and uninstall preserving the workspace             |

Do not infer Windows or Intel Mac verification from a Mac arm64 build. A CI job
definition is not a completed run. Build metadata explicitly leaves clean-machine
and live-provider verification false.

## Prepare the candidate locally

Run `npm run desktop:stage`, `npm run verify:security -- --desktop`, and relevant
core/browser checks. Package with `npm run desktop:package`; stale stages are
rejected. Each successful package receives its own timestamped directory under
`desktop-release/`, a build-labelled artifact and `BUILD.json`. Older artifacts
are preserved. Generate checksums with `npm run desktop:checksums -- <directory>`.
The default checksum command includes all artifact subdirectories; it does not
mean all listed artifacts are current or tested.

## Clean Mac operator procedure

1. Record Mac architecture, OS, app version/build and artifact SHA256. Confirm the
   test machine has no HOI development setup. Use a fictional document only.
2. Extract the matching ZIP and copy the app to the intended installation folder.
   Record Gatekeeper/signing behavior. Alpha candidates are unsigned/unnotarized;
   do not disable platform protections globally. A blocked launch is a finding.
3. Launch without a shell, Git or Node installation. Create a private workspace
   outside the app bundle. Complete or skip onboarding without installing skills.
4. Import a fictional document through the manifest, retrieve its evidence, quit
   and relaunch. Confirm original checksum, citations and persisted records.
5. Test secure credential storage with a specifically authorized test account if
   available. Record unavailable/unverified otherwise; never include secrets.
6. Verify a backup and restore to another directory. Compare source identities,
   checksums and reviewed records. Upgrade only a copy of an older supported
   workspace; retain the compatible original for rollback.
7. Remove the app normally. Confirm the separate private workspace still exists.
   Reinstall and reopen it. Do not delete the workspace as an uninstall step.
8. Record failures and corrections before marking that build/platform passed.

Repeat on Windows using the NSIS installer, including paths with spaces and native
uninstall. Signing, clean-platform verification, live accounts and the real-data
pilot remain release gates; GitHub publication remains a separate final action.

Use a private record with build ID, artifact checksum, platform/architecture,
timestamp, test name, pass/fail/not-tested, observed outcome and limitation. Keep
account identifiers, local paths and document content out of public summaries.

## Local Mac arm64 rehearsal — 2026-09-28

Build `afe3adab0a3bc2d134ab6a6e987043aaf9019158509134d524095e4a83cb0340`:

- Core: 213 tests passed; staged Electron: 2 tests passed.
- Packaged app: 2 tests passed with an empty PATH.
- ZIP extracted into a path with spaces: the same 2 tests passed with an empty PATH.
- Covered app-only fictional imports, native SQLite/extraction, bundled assistant
  CLI, renderer boundaries, quit/restart and a verified upgraded workspace copy.
- Confirmed stale-stage packaging is rejected; older artifacts were preserved.
- A first packaged test timed out because the harness supplied the development
  entrypoint. Packaged launch arguments were corrected and both runs then passed.

This is a development-machine rehearsal. Clean Mac Gatekeeper/signing, native
credential-store acceptance on a new machine, actual uninstall/reinstall, Windows
execution, live Google/AI and the real-data pilot remain unverified. The ZIP is
unsigned/unnotarized; no publication was performed.

## Windows x64 operator checklist

Run only after the clean Mac gate passes; cross-packaging can happen beforehand.

1. On Windows, record OS version, x64 architecture and installer build. Verify the
   downloaded installer with `Get-FileHash -Algorithm SHA256` against SHA256SUMS.
2. Install as a standard user into a path with spaces. Record SmartScreen/signing
   behavior; do not disable Windows protections globally to force a pass.
3. Launch from the Start menu without Git, Node or assistant adapters. Create a
   separate workspace, finish/skip onboarding, and import a fictional document.
4. Search its text, inspect its original and citations, quit and restart. Verify
   native SQLite persistence, no orphan engine and retained workspace selection.
5. Verify the Windows credential-store path with an authorized test credential;
   missing secure storage must prevent saving credentials. Do not record values.
6. Verify backup and restoration to another directory, then upgrade a supported
   older workspace copy. Confirm identities, approvals and source checksums.
7. Uninstall through Windows Settings. Confirm the private workspace is preserved.
   Reinstall, reopen it and repeat retrieval.
8. Record each result as pass, fail or not-tested against the exact build. A built
   executable, inspected DLL or successful Mac run is not Windows runtime evidence.

## Windows candidate preparation — 2026-09-28

The same build `afe3adab0a3bc2d134ab6a6e987043aaf9019158509134d524095e4a83cb0340`
was cross-packaged on macOS as an unsigned Windows x64 NSIS installer. Static
inspection confirmed bundled engine/UI, 21 skills, and PE x64 SQLite, credential
store and canvas modules. BUILD.json, SHA256SUMS and a build-only verification
record accompany the local artifact. The previous Mac artifact remains intact.

Windows launch, installer/uninstaller behavior, credential storage and recovery
remain **not tested**. No remote workflow or publication occurred. The shared
`.desktop-stage` now targets Windows; run `npm run desktop:stage -- darwin arm64`
before using the development desktop launcher on an Apple Silicon Mac. Packaged
Mac apps do not depend on this staging directory.

## App-only and removal rehearsal — 2026-10-09

Runtime build `95d7f29f0028f6517e5452eb9178bbeb558599682ec476e97dea55baef891a1e`, version `0.1.0-alpha.2`, Electron `42.11.8`, macOS arm64, development machine. Local ZIP SHA-256: `18e480fd4630a4872b913a780243e8d63d91a468053a132f0f9a4c7a93ec4bc4`.

| Requested check | Observed result | Boundary |
| --- | --- | --- |
| Onboarding without skills or AI | Passed in staged and packaged Electron; chose no assistant, skipped optional setup; no workspace manuals/adapters or provider rows created | Bundled skill instructions still ship with the product; they need no installation |
| Fictional import, restart and retrieval | Reviewed Markdown import, full quit/relaunch, unchanged exact retrieved evidence | No provider call; lexical retrieval |
| Separate backup/restore/upgrade | Verified backup; restored two separate copies; original and copied retrieval identities preserved | New schema-18 test uses a current fixture with an older schema marker, not an authentic old release database; existing desktop schema-11 upgrade-copy test also passed |
| App removal and reinstall | Removed only a disposable installed `.app`; every separate workspace file retained its SHA-256; reinstalled and retrieved unchanged evidence | Direct bundle removal on this development Mac, not Finder/Trash interaction or clean-machine acceptance |

Verification: three staged Electron tests passed; the same three passed in the packaged app with empty PATH; the additional packaged removal/reinstall test passed separately. Thirteen focused onboarding/recovery core tests passed, including interrupted memory replacement recovery into a separate restored copy. No product runtime behavior changed in this batch.

The first removal harness used a generic recursive bundle copy and the copied app crashed. Repeating with macOS `/usr/bin/ditto` passed; the harness now uses that bundle-preserving tool. This is a harness correction, not a claim that all third-party copy utilities are supported. The release artifact and user workspace were never removed. All test workspaces were fictional and disposable.

Reproduce after staging and packaging a matching build:

```sh
npm run test:desktop
HOI_DESKTOP_TEST_EXECUTABLE="/path/to/HOI OS.app/Contents/MacOS/HOI OS" HOI_DESKTOP_TEST_NO_SYSTEM_TOOLS=1 npm run test:desktop
HOI_DESKTOP_TEST_BUNDLE="/path/to/HOI OS.app" npx playwright test --config playwright.desktop.config.mjs tests/desktop/removal.spec.mjs
node --test tests/onboarding.test.mjs tests/recovery.test.mjs tests/memory-recovery-hardening.test.mjs
```

The removal test skips when no explicit macOS bundle is provided. It copies the bundle into its own temporary directory, removes only that copy, and retains the separately located workspace until assertions finish. Never point a test cleanup operation at a real workspace.

### Installing and using the local candidate without AI

1. Verify the ZIP checksum, extract it, and place `HOI OS.app` in your chosen applications directory. This candidate is unsigned/unnotarized; record any OS block rather than disabling protections globally.
2. Open the app and choose **Create workspace**. Choose a directory outside the app bundle; keep this location for recovery.
3. Complete the profile/timezone steps. Keep **Preferred experience: none** and skip optional sources/adapters/recovery setup as appropriate. Skipping recovery is allowed for onboarding, but make a verified backup before a real upgrade.
4. In **Knowledge Hub → Ingestion**, select a fictional file, review its manifest, then import. Sources and retrieval work without an AI key. Generative Chat remains unavailable until configured.
5. Quit normally, reopen the same workspace, and confirm the document remains available. Closing the app stops its engine; it does not delete the workspace.
6. Before upgrading, verify a backup and restore it into a separate directory. Use **Create upgraded copy** when prompted; retain the original for compatible rollback. Never open a newer schema with an older engine.
7. To remove the app, quit it and remove only the application bundle. Keep your workspace and backups. Reinstall and use **Open workspace** to reconnect. Optional adapters may still reference the previous app location and need reviewed repair after relocation.

### Remaining release blockers

- Clean Mac/user installation, Gatekeeper behavior, signing/notarization and secure keychain verification.
- Genuine historical-release database upgrade fixtures beyond schema-marker simulations, plus platform-specific rollback acceptance.
- Intel Mac and native Windows install/update/uninstall and credential-store verification. NSIS preservation settings are configuration evidence only.
- Independent answer-quality review, explicitly scoped live-provider/Google tests and real-use pilot. Live OpenAI evaluation is paused; no part of its authorized $5 budget was used here.
- Distribution polish and security review, including the default Electron icon and unpacked resources noted by the packager.

No private migration, external connection, AI configuration, GitHub update or publication was performed.

## Follow-up readiness batches

See [historical upgrade, clean-Mac kit and signing assessment](RELEASE_READINESS_BATCHES.md). The original schema-1 release source now generates a genuine historical-schema fixture that successfully migrates and restores; this improves on marker-only simulations, while still using current compatible dependencies. The clean-Mac kit is prepared. Native signing/Gatekeeper checks fail for the current unsigned candidate and no valid signing identity is available, so public distribution remains blocked.
