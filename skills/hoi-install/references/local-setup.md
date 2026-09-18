# Local installation — v0.1.0-alpha.2

Prerequisites: Git, Node.js 22.14+ (tested release lines: 22 and 24), npm, and the user's own Codex or Claude Code access. Check `git --version`, `node --version`, and `npm --version`. If missing, direct the user to https://git-scm.com/downloads and https://nodejs.org/en/download. Do not silently install system software or require administrator access.

Run the following in macOS Terminal or Windows PowerShell. Substitute the selected locations as individual quoted arguments; do not interpolate untrusted text into shell code. `HOI Workspace` is a sibling of the product folder here, not a folder inside it.

```sh
git clone --branch v0.1.0-alpha.2 --depth 1 https://github.com/houseofichigo/hoi-os.git hoi-os
cd hoi-os
npm ci
npm run setup -- --workspace "../HOI Workspace" --hosts both --non-interactive
node bin/hoi.mjs doctor --workspace "../HOI Workspace" --host codex --json
```

Use `--hosts codex` or `--hosts claude` when only one adapter is wanted. Match `doctor --host` to an installed adapter. An existing/nonempty `hoi-os` directory is not a clone destination: inspect it or choose a new release-specific directory. Do not reset, clean or remove existing files to make the command work.

Verify the checkout tag with `git describe --tags --exact-match`. Read the version with `node -p "require('./package.json').version"`. Successful setup installs scoped skills and managed manual additions in the private workspace. Read diagnostic codes and warnings; `DATABASE_OK` and the chosen adapter's `*_ADAPTER_OK` must be present. A new empty workspace may report `BACKUP_MISSING`; explain that a backup is taken before pilot intake and future updates.

Open the private workspace in the local assistant, not just this product directory. If the assistant does not discover its new skills, reload the workspace/session and inspect its `.agents/skills` (Codex) or `.claude/skills` (Claude Code) directory.

Optional map:

```sh
npm start -- --workspace "../HOI Workspace" --host codex
```

For Claude Code, use `--host claude`. Follow the printed authenticated localhost URL. For a busy port use `--port 0`.

## Update and rollback

Stop active commands and the map. Clone the desired documented release into a new sibling product directory, retaining the old checkout. Run `npm ci`, then setup against the same private workspace. Existing-workspace setup takes and verifies a sibling backup before refreshing adapters. If backup verification fails, stop. Do not claim support for a future schema transition without that release's migration instructions.

If an update fails, preserve its output and use the retained checkout and verified backup as described in that release's `docs/OPERATIONS.md`. Re-run setup from the retained compatible checkout to repair runtime paths. Never copy a client workspace into a Git repository.
