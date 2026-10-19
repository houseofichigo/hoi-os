# Harness skills and installation

Current local edition, 19 October 2026. The seven phases and 25 steps remain in `method/JOURNEY.md`. The supplied 1.1.0 ZIP is preserved unchanged. Its Python utilities, guard plugin, static viewers and generated state stores are not installed. The governed engine, schema 20 and optional Knowledge Hub remain authoritative.

## Reconciliation

`method/SKILL_MAP.json` records all 15 supplied skill names, exact source-instruction hashes and supported destinations. These are explanatory routes, not executable aliases. The product still bundles 22 engine-client instructions; the company inventory is separate.

| Supplied role    | Supported route                                   | Decision                                                                                             |
| ---------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Onboard          | `hoi-onboard`                                     | Keep owner interview, first useful result and explicit source selection.                             |
| Govern           | Onboarding, managed manuals and maintained guides | No generated competing GOALS, MEMORY, PROPOSED or permission stores.                                 |
| Organize         | `hoi-organize`                                    | Use exact working-copy plans and engine approvals; preserve originals.                               |
| Connect          | `hoi-connect`, Configuration                      | Separate observed host-tool availability from engine OAuth and scope.                                |
| App              | `hoi-3d-map`, optional Knowledge Hub              | Replace static workbench generation; users may build additional engine clients.                      |
| Ingest           | `hoi-ingest`                                      | Keep reviewed manifests, stable revisions and item outcomes.                                         |
| Wiki author      | `hoi-wiki-author`                                 | Draft, compare and publish through versioned engine operations.                                      |
| 3D map           | `hoi-3d-map`                                      | Shared readers and accessible list; no private static HTML export.                                   |
| Retrieve         | `hoi-retrieve`                                    | Ranked, permitted evidence and exact citations; explicit fallback coverage.                          |
| Skill author     | `hoi-build-capability`, Skills management         | Draft role instructions; compare and explicitly review activation; separate adapter synchronization. |
| Evaluate         | `hoi-evaluate`                                    | Frozen comparisons and independent review; no automatic status promotion.                            |
| Automate         | `hoi-connect` scheduling guidance                 | Host-dependent. A register does not create or pause a schedule. No scheduler added.                  |
| Memory propose   | `hoi-capture`, `hoi-session-capture`              | Reviewed engine memory, attribution, immutable history; no Decision-line approvals.                  |
| Knowledge review | `hoi-knowledge-review`                            | Current evidence health, review identity and persistent dismissals.                                  |
| Audit            | `hoi-audit`                                       | Observed checks and explicit untested domains.                                                       |

Role skills use the existing `skills:draft` contract, with name, expected version, Markdown and optional prior revision. Supporting files are retained when an explicit prior revision is used. Importing packages uses preview → commit draft → review. Activation binds the revision/checksum. Engine permissions do not come from instructions. Assistant sessions still need their own host authorization; this documentation does not certify discovery or invocation in a fresh host.

## Supported installation

Use the existing Node setup in a separate, explicit workspace. New setup defaults to the Hub and no adapters. A nonempty uninitialized folder, the product directory or its alias is refused before build/workspace writes. No automatic Git initialization, staging or commits occur. The original Python installer is deliberately superseded, not repaired in-place.

From a source checkout, install dependencies, then:

```sh
npm run setup -- --surface hub --workspace "../My HOI Workspace" --non-interactive
npm run hub -- --workspace "../My HOI Workspace" --port 0
```

A staged Hub package uses its own `npm ci --omit=dev`, `npm run setup` and `npm start`. It needs Node/native dependencies. Existing workspaces use supported compatibility and backup checks; never silently upgrade a private copy or downgrade in-place.

After the user chooses an adapter, use the registered `adapter install codex`, `adapter install claude` or `adapter install both` operation against that workspace. Installation writes project-scoped instructions and versioned guide copies, not global host settings. It does not grant source or provider disclosure permissions.

The packaged `hub:acceptance` command installs both adapters only in its own new fictional workspace and tests update/removal conflicts on a separate copy. Use the [installation guide](HUB_INSTALLATION.md) and [fresh-session worksheet](HOST_ACCEPTANCE.md) to distinguish instruction integrity from host discovery and actual execution.

## Conflicts and recovery

- New and updated skill folders are preflighted for containment and symbolic links. Same-name folders with untracked files or custom instructions are preserved as a whole. The result reports conflicts; it does not merge Python-harness scripts with engine instructions.
- An update can repair an otherwise unchanged skill's missing managed files. Manuals preserve user text and customized managed blocks. Existing unrelated skills are never removed.
- Removal only removes matching managed content. Customized folders and manuals remain in place and in the verified backup. A reported removed adapter is not a claim that all custom host-discoverable files disappeared; review the returned conflicts.
- A backup and archived checksums precede changes. `.hoi/adapter-update.json` is written before the first managed write and removed only after completion. Interruption remains visible as `update-interrupted`; another update is refused.
- New engine backups explicitly include workspace `.agents/skills/` and `.claude/skills/` content, including custom skills, while excluding adjacent host settings, credential files, symlinks and excluded build/cache paths. Older backups may contain adapter manifests without those folders; inspect their manifests and retained archives before relying on them. A fresh recovery rehearsal is required.
- Read the journal's backup/archive references, stop the affected engine, verify that backup and restore into a separate directory using the engine's recovery workflow. Inspect the restored state before retrying. Never delete the marker to force progress or replay an uncertain operation. Preserve the interrupted workspace for comparison.
- After restoration to another directory, use supported setup to refresh machine-local runtime paths before an assistant opens the restored copy. An adapter's integrity status does not attest host discovery or successful tool execution.

Static instructions cannot repair the supplied ZIP's defects. This edition replaces the conflicting paths with tested engine paths. The supplied scripts remain historical and unsupported. No new provider, automatic skill optimization, background watcher, model spend, private adapter installation or publication is implied.
