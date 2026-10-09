# Local desktop alpha

The desktop app bundles the HOI engine, browser interface, Node runtime, SQLite and credential-store dependencies. Users of a packaged app do not need Git, Node or assistant skills. These desktop builds are **unreleased local artifacts**, distinct from the existing public alpha. Nothing in this document claims Windows verification, signing or a clean-machine installation.

## Use

The local output folder may contain older macOS and Windows artifacts. New packages use separate build-labelled directories; do not treat the presence of a file as verification. See [clean-install procedure](CLEAN_INSTALL.md). Windows/Intel runtime verification is pending.

On macOS, unzip the matching local artifact and open `HOI OS.app`. These builds are unsigned and not notarized; production distribution remains blocked on signing and clean-machine checks. Do not disable system protections globally. Private workspaces stay outside the app bundle.

First launch offers **Create workspace** or **Open workspace**. New workspaces contain no assistant adapters. The running app opens Home. In Knowledge Hub → Ingestion, review a fictional document manifest and import it. Configuration → Connections offers a native source-folder picker; selection alone does not ingest anything. Scope preview and confirmation still apply.

Configuration → Skills & capabilities optionally installs Codex/Claude adapters. The workspace's `.hoi/runtime.json` records an executable and argument array for the bundled CLI. Skills operate the existing engine. They do not build an app, require a separate Node installation, or grant assistant access beyond the engine's host permissions.

Configuration → Workspace & recovery → **Desktop workspace and engine controls**, or the native Workspace menu, opens status, workspace selection, restart and stop. Closing the final window or quitting stops the engine and synchronization. There is no hidden background service. A browser/developer engine already holding the selected workspace must be stopped before desktop opens it; its lock is never bypassed. A crashed/uncertain lock requires explicit recovery.

## Manual updates and rollback

For a newer schema, opening a workspace shows **Create upgraded copy**. Choose a separate new/empty directory. The desktop creates and verifies a backup in its application-data backups folder, restores a separate copy, migrates only that copy, checks health and opens it. The original database remains on its original schema. Backup metadata may be recorded in the original workspace. Backups are local private data; do not publish or copy them into product source.

If an upgrade fails, keep the original and inspect diagnostics; partial copies must be reviewed before removal. Rollback means opening the original compatible workspace with the older app. It does not mean opening a newer database in an older engine. Credentials remain in the OS credential store and must be reconnected when needed. Removing the app does not remove a separately located private workspace; the Windows installer is configured to preserve application data as well, pending native verification.

## Developer build

```sh
npm ci
npm run desktop:stage
npm run test:desktop
npm run desktop
npm run desktop:package
npm run desktop:checksums
```

Stage targets explicitly with `npm run desktop:stage -- darwin arm64`, `darwin x64`, or `win32 x64`. Packaging consumes **one matching staged target**; re-stage before changing architecture. Staging uses a production-file allowlist and independent native dependencies. It never rebuilds the developer Node dependency tree. Do not add electron-builder's suggested global postinstall rebuild: it would break the separate browser/Node workflow.

Electron 42.11.8 is pinned with better-sqlite3 12.11.1 because that maintained Electron line has matching prebuilt SQLite binaries. Review Electron support/security updates before release; pinning is not indefinite maintenance. See [Electron support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines), [security guidance](https://www.electronjs.org/docs/latest/tutorial/security), and [native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).

The local builder never publishes. `desktop-release/SHA256SUMS` covers completed installers/ZIPs recursively. Use a build directory argument to checksum only one candidate. Successful packages include `BUILD.json`; packaging rejects stale stages and never overwrites prior candidate directories. Native modules and extraction children require real filesystem files, so this alpha uses unpacked resources (`asar: false`); signed distribution/integrity hardening remains a release gate. The desktop currently uses the default application icon. The manual platform CI definition is prepared locally but has not been pushed or executed.

## Verification boundaries

See [Batch E evidence](ENGINE_BATCH_E.md) and the [completion plan](COMPLETION_PLAN.md). Local synthetic tests do not establish live Google reliability, assistant synthesis quality, clean-machine install/uninstall behavior or the ten-day pilot. External web-result popups are currently blocked by desktop navigation policy; OAuth alone opens the system browser. Use the existing browser interface for those external research links until the reviewed external-link flow is implemented.
