# Locate and verify before installing

Use the selected checkout's package manifest and documentation. For the current **unreleased local checkout**, `docs/COMPATIBILITY.md` is generated from the engine and skill manifests. The package base version alone cannot distinguish it from the historical release.

An existing source checkout needs Node.js 22.14+ and npm; Git is needed only to obtain a checkout. The staged Hub package needs Node and npm but not Git. Check their versions; explain missing prerequisites rather than silently installing system software. The Electron app is retired in this edition. There is no supported standalone installer without Node; use the checksummed Node package and its current guide.

## Current local checkout: optional Knowledge Hub by default

These commands are for the current checkout identified by `docs/HUB_INSTALLATION.md` and generated compatibility, not the old published tag:

```sh
npm ci
npm run setup -- --surface hub --workspace "../HOI Workspace" --hosts none --non-interactive
node bin/hoi.mjs doctor --workspace "../HOI Workspace" --host local --json
npm run hub -- --workspace "../HOI Workspace" --host local
```

Setup without `--hosts` also omits adapters. It writes no assistant manuals or skill directories in a new workspace. Re-running app-only setup preserves already installed adapters.

Optional, after setup:

```sh
node bin/hoi.mjs adapter install codex --workspace "../HOI Workspace" --host local --json
node bin/hoi.mjs adapter status --workspace "../HOI Workspace" --host local --json
```

Use `claude` or `both` instead of `codex` as requested. Removal is `adapter remove codex` with the same workspace arguments. Updates preserve local edits and report conflicts. A same-name folder with untracked or customized content is skipped as a whole, so Python-harness scripts cannot be mixed into a replacement. Removal preserves customized files in place and in the backup; do not claim a clean uninstall while conflict files remain. Configuration shows package integrity separately from runtime availability. After installation reload the assistant workspace and invoke `hoi-onboard`; discovery must still be verified in that host.

## Historical downloadable release: v0.1.0-alpha.2

The published tag predates app-only setup and the shared engine. Its documented setup requires selecting `codex`, `claude` or `both`. Do not offer it as the new app-only desktop experience. If the user needs app-only and only this release is available, explain the mismatch rather than generating an application.

For users explicitly choosing that older assistant-led release:

```sh
git clone --branch v0.1.0-alpha.2 --depth 1 https://github.com/houseofichigo/hoi-os.git hoi-os
cd hoi-os
npm ci
npm run setup -- --workspace "../HOI Workspace" --hosts both --non-interactive
node bin/hoi.mjs doctor --workspace "../HOI Workspace" --host codex --json
```

Substitute only the selected paths and adapters; quote paths as individual arguments. Commands work in macOS Terminal or Windows PowerShell, subject to that release's documented verification limits. Check `git describe --tags --exact-match` and its own README. Never clone over a nonempty folder, reset user changes, or fabricate a newer download.

## Updates and recovery

Stop the existing engine before product setup. Retain the old checkout and use a separate directory for the chosen documented release. Existing-workspace setup verifies a sibling backup before changing runtime paths. General backups include workspace `.agents/skills` and `.claude/skills` plus managed guides, while excluding adjacent host settings and credentials. Adapter changes also preserve prior instructions with checksums. Keep backups private.

Read compatibility and upgrade guidance before opening a newer database. Do not downgrade a database in place: restore a compatible backup into a separate directory and use the matching engine. An initial empty workspace may report BACKUP_MISSING. Missing optional adapters are informational; database errors, incompatible installed adapters and preservation conflicts need attention. Do not describe failed checks as successful setup.

## Staged Hub package

In the selected verified local package, run `npm ci --omit=dev`, then `npm run setup -- --workspace "../HOI Workspace" --non-interactive`, then `npm start -- --workspace "../HOI Workspace" --port 0`. Check HUB_PACKAGE.json and the package guide; do not claim this unreleased candidate is downloadable from a historical tag. New setup refuses nonempty targets and never initializes or commits a Git repository. Existing HOI workspaces require their supported compatibility and recovery checks.
