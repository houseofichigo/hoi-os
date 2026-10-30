# Optional skills — Batch B

Implemented locally on 2026-09-26. Unreleased; no GitHub update, private migration, global assistant installation or desktop packaging. Current generated facts: [COMPATIBILITY.md](COMPATIBILITY.md).

## What changed

Setup defaults to `--hosts none`. A new app-only workspace gets no `AGENTS.md`, `CLAUDE.md`, `.agents` or `.claude` additions. Ingestion, retrieval, audit, projects, task approval and map data remain core functions. Re-running app-only setup preserves installed adapters rather than implicitly removing them.

Optional adapters can be installed later:

```sh
node bin/hoi.mjs adapter install codex --workspace "../HOI Workspace" --json
node bin/hoi.mjs adapter status --workspace "../HOI Workspace" --json
node bin/hoi.mjs adapter remove codex --workspace "../HOI Workspace" --json
```

Use `claude` or `both` as needed. Configuration → Skills & capabilities provides the same actions through the authenticated engine. It separately lists bundled instructions, installed adapter integrity, registered engine operations and executable capabilities. Assistant runtime availability remains explicitly unprobed.

The installer guide now locates, installs or verifies the existing product. It explicitly prohibits generating a replacement application and distinguishes current local commands from the historical published tag. The guide has no hard-coded operational skill count.

## Preservation and compatibility

Adapter changes use Batch A's shared operation registry and engine queue. They validate the API and required operations, take a verified workspace backup, and preserve adapter folders in dated, checksum-verified archives before writes. General knowledge backups exclude assistant folders, making this additional archive necessary.

Installation repairs missing packaged files, updates unchanged managed files and retains local edits as reported conflicts. It preserves unrelated manual text and skills. Modified managed manual blocks are retained for review; malformed blocks cause an actionable error before adapter changes. Removal only removes installer-tracked files; preserved copies remain recoverable. Untracked legacy removal requires explicit install/verification first.

Adapters record file hashes, API version, package version, required operations and managed-block identity. Status distinguishes absent, legacy, incompatible, incomplete, modified and verified packages. A matching package base version alone does not establish compatibility for an unreleased checkout.

`skills/contracts.json` records each skill's required operations and optional connections. `skills:sync` generates the expanded catalogue, complete runtime mirrors, README catalogue and compatibility facts from package/protocol/schema sources. Historical release instructions remain labeled historical.

## Verification and remaining limits

- `npm run check`: 122 core tests passed; generated mirrors/catalogue/facts match.
- `npm run test:browser`: 13 browser tests passed, including Configuration install/remove.
- Synthetic app-only demonstration: setup with no adapters, ingest a fictional source, retrieve evidence, approve one project task, run audit and resolve map records.
- Preservation checks: edited instructions survive repair; deleted supporting resources are restored; adapter removal preserves unrelated files and workspace integrity; incompatible API/operation requirements and malformed manuals are reported.

These checks ran on the current macOS environment. Clean Windows execution, real assistant-session discovery and live-provider verification remain pending. The current browser/developer install still requires Node/npm; Electron downloads belong to Batch E. AI interpretation remains handoff. Batch C is next: durable intake jobs, stable source identities and connector completeness.
