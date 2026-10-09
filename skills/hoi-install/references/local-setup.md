<<<<<<< HEAD
# Locate and verify before installing

Use the selected checkout's package manifest and documentation. For the current **unreleased local checkout**, `docs/COMPATIBILITY.md` is generated from the engine and skill manifests. The package base version alone cannot distinguish it from the historical release.

A developer/browser install needs Git, Node.js 22.14+ and npm. Check their versions; explain missing prerequisites rather than silently installing system software. Desktop installers without Git/Node are pending; do not claim they exist.

## Current local checkout: app-only by default

These commands are for an existing checkout containing `docs/ENGINE_BATCH_B.md`, not the old published tag:

```sh
npm ci
npm run setup -- --workspace "../HOI Workspace" --hosts none --non-interactive
node bin/hoi.mjs doctor --workspace "../HOI Workspace" --host local --json
npm start -- --workspace "../HOI Workspace" --host local
```

Setup without `--hosts` also selects app-only. It writes no assistant manuals or skill directories in a new workspace. Re-running app-only setup preserves already installed adapters.

Optional, after setup:

```sh
node bin/hoi.mjs adapter install codex --workspace "../HOI Workspace" --host local --json
node bin/hoi.mjs adapter status --workspace "../HOI Workspace" --host local --json
```

Use `claude` or `both` instead of `codex` as requested. Removal is `adapter remove codex` with the same workspace arguments. Updates preserve local edits and report conflicts; they do not silently replace customized instructions. Configuration shows package integrity separately from runtime availability. After installation reload the assistant workspace and invoke `hoi-onboard`; discovery must still be verified in that host.

## Historical downloadable release: v0.1.0-alpha.2

The published tag predates app-only setup and the shared engine. Its documented setup requires selecting `codex`, `claude` or `both`. Do not offer it as the new app-only desktop experience. If the user needs app-only and only this release is available, explain the mismatch rather than generating an application.

For users explicitly choosing that older assistant-led release:
=======
# Separate app availability and setup

This repository now distributes skill instructions only. The separate HOI OS app is still in development and is not published here. Cloning this repository does not install an engine. Do not run npm setup commands in this skills-only checkout or generate a substitute app.

## Existing compatible app
>>>>>>> 66fcc668b3a4e0085bdc3eb3d23209fadb2ba052

If the user already has a compatible HOI OS app, inspect its documented runtime and compatibility before installing any operational skill. The current instructions target engine API 1 and workspace schema 17, plus each skill's required operations in `skills/contracts.json`. Do not infer compatibility from a product name or version string alone.

<<<<<<< HEAD
Substitute only the selected paths and adapters; quote paths as individual arguments. Commands work in macOS Terminal or Windows PowerShell, subject to that release's documented verification limits. Check `git describe --tags --exact-match` and its own README. Never clone over a nonempty folder, reset user changes, or fabricate a newer download.

## Updates and recovery

Stop the existing engine before product setup. Retain the old checkout and use a separate directory for the chosen documented release. Existing-workspace setup verifies a sibling backup before changing runtime paths. Adapter changes additionally preserve skill folders, since general knowledge backups exclude assistant directories. Keep backups private.

Read compatibility and upgrade guidance before opening a newer database. Do not downgrade a database in place: restore a compatible backup into a separate directory and use the matching engine. An initial empty workspace may report BACKUP_MISSING. Missing optional adapters are informational; database errors, incompatible installed adapters and preservation conflicts need attention. Do not describe failed checks as successful setup.
=======
Select the user's private workspace explicitly. Follow that app's own onboarding and managed adapter installation instructions for Codex, Claude Code or both. App-only use remains valid. Keep user-edited manuals and skill revisions; report conflicts rather than overwriting them. Verify runtime availability and discovery separately from copying instructions.

## No compatible app available

Explain that these operational skills are a preview for inspection, adaptation and contributions. Do not claim a working engine connection or fabricate an installer URL. The separate app will be published after its release checks. No model subscription or account connection is included with this package.

## Historical version

The historical `v0.1.0-alpha.2` release at https://github.com/houseofichigo/hoi-os contains the earlier assistant-led engine. It is preserved for history, not the compatible runtime for this skills preview. Never install these new skills against that release without a verified compatibility check. Do not downgrade or migrate a private workspace as an installation side effect.

## Recovery

Before any future app upgrade, verify a backup and restore it into a separate directory using the matching app documentation. Keep original data and backups out of this repository. Never bypass an active engine lock or silently impersonate the local app from an assistant host.
>>>>>>> 66fcc668b3a4e0085bdc3eb3d23209fadb2ba052
