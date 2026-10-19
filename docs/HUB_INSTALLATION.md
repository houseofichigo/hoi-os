# Install and verify the optional Knowledge Hub

Audience: people trying the current, unreleased harness package. The governed engine, 25-step method and 21 optional skill packages remain the product. The old Electron app and its installer evidence are historical. This guide describes a Node installation, not a signed desktop application.

## Install in two separate locations

Keep the extracted product, the private workspace and acceptance results in separate directories. First verify the archive's SHA-256 against a checksum received through a trusted channel. `HUB_PACKAGE.json` detects accidental file changes; it is not a digital signature and cannot prove publisher identity if both files and manifest were replaced.

Install Node.js 22.14 or newer with npm. Native dependencies must match the operating system, architecture and Node ABI. Downloading dependencies requires network access; the semantic model is optional and is not downloaded by setup or acceptance. Do not copy another machine's `node_modules` folder. A native build may require the target platform's compilation tools when a compatible binary is unavailable.

In a new extracted package directory:

```sh
npm ci --omit=dev
npm run hub:acceptance -- --output "../HOI acceptance"
```

Choose a new output directory for every attempt. The acceptance command refuses existing output, package/workspace overlap, changed package checksums, symlinked packaged files and unlisted runtime files. It never accepts an existing private workspace. It does not install dependencies, invoke an assistant, download a model or call a provider. It deliberately simulates one task approval with fictional data.

Read `acceptance.json`. A result of `passed-local-checks` means the reported automated checks passed on that particular system. It does not mean the machine was clean, an assistant discovered its skills, or the skills produced useful answers. A failure preserves the fictional workspaces and a named failed check; retry into another new directory after correcting the installation. Do not force-remove a live lock. Ctrl+C requests a stop after the current bounded check, closes a running Hub and records `interrupted`. A forced kill or power loss can still leave a stale lock; preserve the folder and follow supported recovery before reuse.

Then create your real workspace deliberately:

```sh
npm run setup -- --workspace "../My HOI Workspace" --non-interactive
npm start -- --workspace "../My HOI Workspace" --port 0
```

Open the launcher's complete authenticated URL, including its temporary fragment. Do not share it. A plain `/hub` URL cannot authenticate. Restart with a newly printed link. Ctrl+C stops the engine; there is no installed background service. Preserve your workspace even when replacing the product directory.

Setup defaults to no adapters or AI configuration. You can import selected documents, retrieve passages, edit/review wikis and memory, and inspect the map without either. Google scopes, provider keys/disclosure, semantic models and assistant installation are separate optional choices.

## What the acceptance command verifies

- Packaged file checksums, runtime identity and isolated production dependency resolution.
- Native SQLite and vector extension loading. The keyring module loads, but this does not certify AI credential storage. Windows engine authentication exercises its own credential-store path when actually run there.
- Setup without assistant manuals, launcher authentication and concurrent CLI clients under `codex` and `claude` identities while the Hub owns the database.
- One preserved fictional import, duplicate intake, a local-only denial, exact source/passage identities, task proposal retry and scripted review.
- Optional adapter installation, versioned guides and preservation of existing manual text.
- Shutdown/restart, verified backup, restoration into a separate directory and refreshed runtime paths.
- Current-schema upgrade backup and adapter update/removal conflicts on a separate copy.

The result records real OS, CPU, architecture, Node/ABI, native dependency versions, package-manifest digest, build fingerprint, check timestamps and fictional evidence identities. No launcher URL, engine credential, machine hostname or raw process output is included. Paths in retained workspace configuration are local runtime data: share the report and reviewed evidence, not the whole acceptance folder.

This is a current-schema recovery rehearsal. It does not manufacture an old database by lowering its schema number. Migration from historical releases and any deliberate old private workspace upgrade require their own supported-version fixture, verified backup, separate restore and record comparison.

## Verify an assistant host separately

The runner leaves `workspace/` with both optional adapters for the [fresh-session checklist](HOST_ACCEPTANCE.md). `restored-workspace/` is a recovery copy; `conflict-workspace/` intentionally contains a customized adapter conflict. Do not use the conflict copy as the fresh-host baseline. Skill-file integrity and host execution are distinct results.

The runner does not start Codex or Claude Code. Opening either may incur that host's costs and requires an intentionally configured account. No model subscription or provider credentials are needed for the automatic installation checks.

## Upgrade and removal

Stop the old engine. Keep the old installation, verify a workspace backup, and restore to a separate directory. Run supported setup in the new package against that copy, inspect compatibility and perform any required `upgrade` with its own verified backup before opening it for daily use. Do not open a newer database using an older engine; roll back to a compatible restored copy.

To remove the Node installation, stop the engine and remove only the product directory you deliberately selected. Preserve the separate workspace and backups. Removing an adapter removes only matching managed instructions; custom instructions and manual text remain, with conflicts reported. Neither action deletes source records. Removing Node itself is a separate operating-system action.

On a fresh test user/machine, record the platform, dependency-install result, browser checks, host results, removal/restore steps and limitations. Mac arm64, Mac x64, Windows x64 and Linux results are separate; passing one cannot certify another. Keep unsigned Node-package acceptance separate from the retired app's signing/notarization work. Publication is a later decision.
