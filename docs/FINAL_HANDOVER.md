# HOI OS — final local implementation handover

## Product boundary

This edition is a **harness with an optional Knowledge Hub**, not the retired all-in-one desktop app. It preserves the seven-phase, 25-step method and its source documents; 21 optional product skills; the governed engine; reviewed wikis and memory; and the clickable 3D map. Users may build their own interfaces on registered operations.

The Hub contains Knowledge, Skills and Configuration. It supports reviewed file intake, evidence inspection, wiki drafts/compare/publish, memory review/history, skill management and assistant handoff. The engine retains its permission, exact-approval, jobs, budget and recovery boundaries. No Markdown file grants authority. Imported scripts are not executed by skill import or activation.

Schema 19 is retained. This delivery does not migrate a private workspace, contact a paid provider, install a private adapter, publish a release or create another background service.

## Candidate contents

- `hoi-os-hub.zip`: engine, built browser Hub/map, method, skills, guides, examples and a production dependency lock. No Node runtime or `node_modules` is bundled.
- `skills/hoi-install.zip` and `skills/hoi-install.md`: installer instructions.
- `skills/hoi-os-skills.zip`: 20 operational skills as a collection, not a single-skill upload.
- `skills/SKILL_PACKAGE.json`: compatibility and exact instruction checksums.
- `CANDIDATE.json`: source and packaged build fingerprints, file hashes and explicit outstanding gates.
- `SHA256SUMS`: integrity checks for candidate files. Checksums are not a publisher signature.
- `hub/`: the same staged product before installing dependencies; its `HUB_PACKAGE.json` records every packaged file.

A historical package version is preserved as a compatibility base. **The candidate manifest and build fingerprints identify this unreleased delivery.** Never replace an old release directory or assume a public tag contains these changes. Packaging refuses existing outputs. An interrupted output without `CANDIDATE.json` is incomplete; preserve it and retry in a new directory.

## Installation and first use

Verify checksums from a trusted channel. Extract the Hub ZIP into its own product directory, install Node.js 22.14+ and npm, then run:

```sh
npm ci --omit=dev
npm run hub:acceptance -- --output "../HOI acceptance"
```

Read the resulting `acceptance.json` before using real information. The runner uses fictional workspaces and checks packaged dependencies, authenticated launch, concurrent CLI reads/writes, import/retrieval, restart, backup/restore and adapter conflicts. It does not require skills or AI credentials at first launch. A successful result applies only to the reported machine and package.

Create a separate workspace deliberately:

```sh
npm run setup -- --workspace "../My HOI Workspace" --non-interactive
npm start -- --workspace "../My HOI Workspace" --port 0
```

Use the complete private authenticated launcher URL. Stop with Ctrl+C. Start with a selected fictional file, retrieve its evidence, review a wiki or memory draft and verify a backup. Add optional assistants and connections separately through Configuration. A chat subscription is not an API key and does not certify local host integration.

When reading this file from the outer candidate folder, the detailed guides are under `hub/docs/`. Inside the Hub package, use `docs/HUB_INSTALLATION.md`, `docs/HOST_ACCEPTANCE.md`, `docs/OPERATIONS.md`, `docs/COMPATIBILITY.md` and `docs/OPERATIONS_REFERENCE.md`. The fictional daily recipe is in `docs/CHIEF_OF_STAFF_RECIPE.md`; reviewed improvement is in `docs/SKILL_IMPROVEMENT.md` and `docs/PROCEDURAL_LESSONS.md`.

## Upgrade, recovery and removal

Stop the old engine. Preserve the previous product and a verified backup. Restore a separate workspace copy and run supported setup/upgrade there before touching the daily workspace. Do not lower a schema number or open a newer database with an older engine. Use a compatible restored copy for rollback.

Removing this Node product means stopping the engine and removing only its selected installation directory. Keep the separate workspace, originals and backups. Adapter removal preserves customized instructions and unrelated manual text. It is not data deletion. No Electron uninstall or signing process is part of this edition.

## What remains outside this local handover

| Gate                  | Evidence still required before claiming it                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean installation    | Run the supplied kit on an actually fresh user/machine for each supported OS/architecture; record native-module installation and recovery.                       |
| Assistant integration | Open fresh Codex and Claude Code sessions in the fictional workspace and complete the host checklist. Installed files alone do not prove discovery or execution. |
| Effectiveness         | Independently review bilingual retrieval, grounding, abstention and skill outputs. Saved-artifact comparisons are not live model evaluations.                    |
| Live connections      | Test deliberately bounded accounts/scopes and exact-approved writes with intended credentials; no automatic email sending.                                       |
| Pilot                 | Record real daily usefulness and defects over the agreed pilot period with authorized data.                                                                      |
| Publication           | Review privacy, licences and candidate evidence, select a new release identity and explicitly approve publication.                                               |

These are validation and release decisions, not claims that more local feature batches have been completed. The current package is an alpha candidate. Local test totals and exact candidate hashes belong in the accompanying final validation record, not in a permanent readiness claim.

## Publication review for this handover

The 17 October source scan found no selected credential/private-path patterns in current allowlisted source files, but publication is blocked by 24 excluded-path findings in reachable Git history: 23 generated distribution artifacts and one session file. These are path findings, not 24 detected credentials. Historical archives need content review and an explicit remediation decision before publication. Git history and remote releases were not rewritten. The local candidate is usable for fictional evaluation; it is not approved for publication.
