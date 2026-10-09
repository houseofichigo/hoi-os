# HOI OS — Community Skills

<<<<<<< HEAD
Local release preparation: [publication boundary and remaining gates](docs/PUBLICATION_READINESS.md). No publication in this batch.

Local Knowledge Core development: [editable wikis, connected map and grounded retrieval](docs/KNOWLEDGE_CORE.md). Schema 16 is unreleased.

[Operational Inbox, optional API inference and reviewed Google actions](docs/OPERATIONAL_INBOX.md): local implementation status and remaining verification gates.

A local operating layer for knowledge, decisions, and meeting preparation. The core app runs independently; Claude Code and Codex skills are optional. Keep private information on your computer, separate from the product repository.

**Unreleased local development.** The package base remains the historical `v0.1.0-alpha.2`; it does not identify a newly published release. See [validation](docs/VALIDATION.md) and [stable-release gates](docs/ACCEPTANCE.md).
=======
**Open instructions for a personal knowledge and work system. Reuse them, adapt them, and fork the repository.**

HOI OS keeps its name, but your workspace, organization, sources and accounts are your own. This MIT-licensed package contains **21 skills: 20 operational skills and one installation/availability guide**.
>>>>>>> 66fcc668b3a4e0085bdc3eb3d23209fadb2ba052

> **Skills preview — 0.2.0-alpha.1.** The separate HOI OS app is still in development and will be published when ready. This repository does not currently distribute the new app. Operational skills need its compatible engine; importing a skill alone does not make ingestion, connectors or tools work.

<<<<<<< HEAD
Current local hardening: [Batch F audit](docs/ENGINE_BATCH_F.md) and [security evidence](docs/SECURITY_EVIDENCE.md). These describe unreleased code; live/provider/platform/pilot gates remain open.

Current local UI update: [Consulting, focused chat and reviewed Skills](docs/CONSULTING_SKILLS.md) (schema 14; unreleased).

Current visual design: [Skills gallery, focused chat and product design system](docs/PRODUCT_DESIGN.md) (unreleased; no schema migration).

## Current local checkout — app first

These commands apply to this **unreleased checkout**, not the tagged downloads below. See [generated compatibility facts](docs/COMPATIBILITY.md) and [Batch B](docs/ENGINE_BATCH_B.md).

```sh
npm ci
npm run setup -- --workspace "../HOI Workspace" --non-interactive
npm start -- --workspace "../HOI Workspace"
```

Setup defaults to app-only (`--hosts none`). No assistant subscription, skill installation or model API key is needed for intake, retrieval, audit, map or task review. Assistant interpretation is optional: handoff or separately configured API inference, with source disclosure and cost limits. Developer installation still needs Node and npm. Unreleased local desktop builds now bundle the runtime; see the [desktop guide](docs/DESKTOP.md) and [Batch E verification](docs/ENGINE_BATCH_E.md). Clean-machine and distribution gates remain pending.

Add or remove workspace adapters separately, including while the app is running:

```sh
node bin/hoi.mjs adapter install codex --workspace "../HOI Workspace" --json
node bin/hoi.mjs adapter status --workspace "../HOI Workspace" --json
node bin/hoi.mjs adapter remove codex --workspace "../HOI Workspace" --json
```

Use `claude` or `both` as appropriate, or Configuration → Skills & capabilities. Edited instructions are preserved and reported, and unrelated skills/manual text remain intact. Removing an adapter leaves the app and knowledge in place. A verified adapter package does not prove the assistant runtime is available.

## Onboard, then add optional skills

Start with one outcome and a bounded source selection in Knowledge Hub. Review the
import manifest, retrieve an original passage, and verify a backup before valuable
imports. Do not import an entire company folder by default. Use [Configuration → Onboarding](docs/ONBOARDING.md) to save and resume setup; the existing `hoi-onboard` assistant flow is also available with an optional adapter.

The current catalogue contains **21 skills: 20 operational skills and one installer**.
See [skill roles and compatibility](docs/SKILLS.md). The engine owns ingestion,
retrieval, audits, approvals and map data; installing skills does not install or
replace the app. Skill installation is workspace-scoped and never mandatory.

For updates, retain the previous product, verify a backup, restore a separate copy,
and follow [Operations](docs/OPERATIONS.md). Never open an upgraded database with
an older engine; use a compatible restored copy instead.

## Local Chief of Staff development

[Completion plan](docs/COMPLETION_PLAN.md) tracks the remaining desktop, security and pilot gates. [Batch D](docs/ENGINE_BATCH_D.md) adds actionable signals, explicit coverage, saved views and assistant result links. See [current compatibility](docs/COMPATIBILITY.md); no private upgrade or publication.

[Engine upgrade — Batch C](docs/ENGINE_BATCH_C.md): durable intake, file move tracking, explicit sync outcomes, safe HTML email extraction and knowledge governance. Introduced schema 11; existing private workspaces require a verified backup and separate restore rehearsal before upgrade.

[Engine upgrade — Batch A](docs/ENGINE_BATCH_A.md): Home startup, one workspace engine, host-bound assistant calls and durable mutation receipts. Local and unreleased; the tagged downloads below retain their historical behavior.

[Batch 1 implementation and synthetic demo](docs/CHIEF_OF_STAFF_BATCH_1.md): Projects & Tasks, evidence-backed proposals, review and schema 3 recovery. These local changes are not included in the release downloads below.

[Batch 2 intake and duplicate review](docs/CHIEF_OF_STAFF_BATCH_2.md): normalized communications, explicit assistant extraction, project-scoped matching, reversible updates and schema 4 recovery. Synthetic validation only; live connectors and real-data extraction quality remain pending.

[Batch 3 daily work](docs/CHIEF_OF_STAFF_BATCH_3.md): Today, promises, waiting-for work, Kanban, cited meeting preparation and local calendar-slot suggestions. These changes remain local and unreleased.

[Batch 4 Brain maintenance](docs/CHIEF_OF_STAFF_BATCH_4.md): source-health findings, cited replacement review, preserved originals and task-map links. Two new skills are local only; released downloads below retain their previous contents.

[Batch 5 assistant-handoff chat](docs/CHIEF_OF_STAFF_BATCH_5.md): project-scoped tools, citations, review cards and saved runs. The user selected handoff; no embedded model runtime or automatic web search is configured.

## Historical published release — installation skill

[Download hoi-install.zip](https://github.com/houseofichigo/hoi-os/releases/download/v0.1.0-alpha.2/hoi-install.zip) · [Download chat guide](https://github.com/houseofichigo/hoi-os/releases/download/v0.1.0-alpha.2/hoi-install.md) · [Download historical 14 operational skills](https://github.com/houseofichigo/hoi-os/releases/download/v0.1.0-alpha.2/hoi-os-skills.zip) · [Checksums](https://github.com/houseofichigo/hoi-os/releases/download/v0.1.0-alpha.2/SHA256SUMS)
=======
## Explore and download

- [Browse all 21 skills](docs/SKILLS.md)
- [Download the complete collection](dist/hoi-os-skills-0.2.0-alpha.1.zip)
- [Individual skill ZIPs](dist/individual/) — one skill per import
- [Checksums](dist/SHA256SUMS)
- [Getting started](docs/GETTING_STARTED.md) · [Compatibility](docs/COMPATIBILITY.md)
>>>>>>> 66fcc668b3a4e0085bdc3eb3d23209fadb2ba052

The collection ZIP is not a single-skill upload. Bundled scripts are not executed by downloading or inspecting it.

## What the skills cover

| Area | Examples |
| --- | --- |
| Daily work | Chief of Staff, meeting preparation, project briefs, task extraction |
| Knowledge | Bounded ingestion, evidence retrieval, wiki authoring, reviewed memory |
| Organization | Source organization, consolidation, knowledge map |
| Governance | Audit, security review, evaluation and knowledge review |
| Setup | Availability guidance, onboarding and capability proposals |

Skills provide instructions. The engine owns storage, permissions, exact-action approvals and executable tools. Skills cannot grant themselves permissions or approve their own proposals.

## Start here

**Exploring or contributing?** Read a skill, adapt it for your system, or fork the repository. No account or API key is needed to read or fork it.

**Already using a compatible HOI OS app?** Follow [Getting started](docs/GETTING_STARTED.md) and that app's adapter workflow. Check API and required operations before activation.

**Waiting for the app?** The new app is not available from this repository yet. No installation or download link is implied. The old engine is historical and does not satisfy the current skill contracts.

## Open for reuse

The [MIT licence](LICENSE) permits use, modification, redistribution and commercial reuse, with its copyright and licence notices retained. Forks are welcome. Use your own data, credentials and organization profile. Do not imply official endorsement of a modified fork.

See [Contributing](CONTRIBUTING.md) for changes and [Security](SECURITY.md) for reporting concerns without publishing sensitive data.

<<<<<<< HEAD
## Historical published release — manual installation
=======
## What changed
>>>>>>> 66fcc668b3a4e0085bdc3eb3d23209fadb2ba052

The default branch now focuses on skills. The earlier application is preserved in [the previous source snapshot](https://github.com/houseofichigo/hoi-os/tree/9079c5c2a3d31fbae200933eff3c5fffbee4ab12) and [historical releases](https://github.com/houseofichigo/hoi-os/releases). Existing tags have not been replaced. The separate new app will have its own publication gate.

<<<<<<< HEAD
These commands work in macOS Terminal and Windows PowerShell. Use a new product directory and a private workspace outside it:

```sh
git clone --branch v0.1.0-alpha.2 --depth 1 https://github.com/houseofichigo/hoi-os.git hoi-os
cd hoi-os
npm ci
npm run setup -- --workspace "../HOI Workspace" --hosts both --non-interactive
node bin/hoi.mjs doctor --workspace "../HOI Workspace" --host codex --json
```

Choose `--hosts codex` or `--hosts claude` to install only one adapter. Match the doctor host to your selected assistant. Setup builds the product, preserves unrelated manual content, and installs workspace-scoped skills without changing global assistant configuration.

Open **HOI Workspace** in Codex or Claude Code, then use `$hoi-onboard` or `/hoi-onboard`. New empty workspaces may report `BACKUP_MISSING`; take a backup before importing valuable information. Existing-workspace setup takes a verified backup before refreshing adapters.

Current local checkout — open Home:

```sh
npm start -- --workspace "../HOI Workspace" --host codex
```

Use `--host local` for the app or `--host claude` for Claude Code. Keep `node bin/hoi.mjs map --workspace "../HOI Workspace" --host codex` for the standalone read-only map. Open the authenticated localhost URL printed by the command. Opening `web/index.html` does not run the app. Use `--port 0` if a port is occupied.

The Workspace App adds a local interface with source-backed search, wiki review, sources, connections, and memory review:

```
node bin/hoi.mjs app --workspace "../HOI Workspace" --host claude
```

Read [the app guide](docs/APP.md). The current local app provides governed intake, source review and connections through the core. Assistant interpretation remains a handoff. Skills call the same engine while the app is running.

## Bundled local operational skills

<!-- skills:start -->

| Skill                  | Purpose                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hoi-3d-map`           | Use when requested to open the local HOI Workspace App or its optional 3D knowledge map to inspect source-backed search, wiki, memory, entities, relationships, and temporal views.                                                                     |
| `hoi-audit`            | Use when requested to inspect an HOI OS workspace for schema, database, extraction, backup, adapter, connection, workflow, and memory health without changing it.                                                                                       |
| `hoi-build-capability` | Use when requested to define, evaluate, and activate a bounded HOI workflow using registered tools.                                                                                                                                                     |
| `hoi-capture`          | Use when requested to record user-supplied decisions, preferences, or experience as reviewable HOI memory.                                                                                                                                              |
| `hoi-chief-of-staff`   | Use when requested to prepare a daily HOI work brief, review promises and waiting-for tasks, prepare an exact meeting instance, and suggest local preparation time from confirmed calendar exports.                                                     |
| `hoi-connect`          | Use when requested to check available Gmail, Calendar, Drive, or GitHub host tools for a selected HOI workspace.                                                                                                                                        |
| `hoi-consolidate`      | Use when requested to find duplicate, stale, and proposed HOI memories for review.                                                                                                                                                                      |
| `hoi-evaluate`         | Use when requested to run reproducible evidence retrieval checks for a HOI capability.                                                                                                                                                                  |
| `hoi-ingest`           | Use when requested to plan and ingest selected local files or authorized host exports into HOI OS with bounded scope, preserved originals, provenance, and visible failures.                                                                            |
| `hoi-knowledge-review` | Use when requested to audit HOI wiki and memory for stale evidence, recorded contradictions, duplicates, superseded information and expired memory; prepare cited replacements and review findings without deleting originals.                          |
| `hoi-meeting-prep`     | Use when requested to prepare a cited client meeting brief using HOI knowledge and available read-only host connections.                                                                                                                                |
| `hoi-onboard`          | Use when requested to onboard a user into HOI OS, capture their operating context, select a bounded source scope, and reach a first useful result without uncontrolled ingestion.                                                                       |
| `hoi-organize`         | Use when requested to propose and apply an exact, approval-bound organization of HOI OS working copies while preserving every original.                                                                                                                 |
| `hoi-project-intake`   | Extract a complete project brief from a transcript or user input, clarify missing fields, and validate the exact 17-field project Action contract before an explicitly requested submission. Individual tasks use HOI task proposals separately.        |
| `hoi-retrieve`         | Use when requested to find source-backed information and bounded context in HOI OS.                                                                                                                                                                     |
| `hoi-security`         | Review HOI OS security configuration and recorded test coverage, including source access, exact approvals, connection scopes, credentials and recovery. Use for a requested security check of a selected local workspace.                               |
| `hoi-session-capture`  | Use when requested to propose reviewable HOI memories and wiki updates from decisions made in the current working session.                                                                                                                              |
| `hoi-task-intake`      | Use when requested to extract evidence-backed to-do proposals from selected transcripts, briefs, Gmail messages or Calendar context; check existing commitments and route ambiguous duplicates to review without approving tasks or changing calendars. |
| `hoi-wiki`             | Use when requested to build and maintain cited, reviewable current-view wiki pages from HOI OS evidence without replacing original sources or history.                                                                                                  |
| `hoi-wiki-author`      | Use when requested to create or revise cited HOI wiki drafts for clients, projects, people, offerings, topics and decisions; resolve existing pages first and preserve evidence, attribution and revision history.                                      |

<!-- skills:end -->

The machine-readable [catalog](skills/catalog.json) records descriptions, versions, resources and runtime requirements. `hoi-install` is the additional installation guide.

## Capabilities and boundaries

- Preserved originals, checksums, revisions, passages, evidence references and metadata-filtered search.
- Markdown/text, PDF text, DOCX, PPTX, XLSX and CSV intake; optional image OCR through a separately installed Tesseract.
- Meeting evidence briefs, reviewed decisions, bounded context, approvals and execution history.
- Optional read-only localhost 3D map, with project/client/memory/timeline views and a keyboard-accessible record list.
- Scoped local/Google intake and optional OpenAI/Anthropic API analysis are implemented locally; credentials, disclosure and live verification are separate. See [Operational Inbox](docs/OPERATIONAL_INBOX.md).
- Verified backup/restore, diagnostics, crash recovery and separate private workspaces.

The assistant performs reasoning. Citation checks do not prove factual support. HOI policies govern HOI commands; other assistant tools keep their own permissions. No autonomous sending, publishing, financial mutation, scheduling or telemetry is included.

## Historical alpha.2 compatibility and verification

This table describes the older release only. Current local verification and remaining gates are listed in [Publication readiness](docs/PUBLICATION_READINESS.md); do not infer current Windows or live-provider verification from historical CI.

| Surface             | Supported experience                                                        | Verification status                                               |
| ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Local macOS         | Full core, scoped adapters, optional map                                    | Local automated installation/core/browser checks pass             |
| Local Windows       | Same Node setup and core                                                    | Node 22/24 CI passed; fresh interactive host checks pending       |
| Codex / Claude Code | Historical alpha.2: 14 operational skills and installer                     | Package/setup verified; fresh user-session acceptance pending     |
| ChatGPT             | Installation guide where skills are supported; Markdown attachment fallback | Guidance package verified; account-specific UI acceptance pending |
| Claude chat         | Installer ZIP upload; guided local setup                                    | ZIP structure verified; account-specific UI acceptance pending    |

Publishing this prerelease does not complete the [real-data pilot](docs/PILOT.md), independent client pilots or stable-release gates.

## Updates, recovery and development

For updates, retain your existing checkout and use a new release-specific checkout. Run setup against the existing private workspace; it takes a verified backup before changing adapters. Never run a destructive Git reset or copy private information into the product repository. Read [operations and recovery](docs/OPERATIONS.md).

```sh
npm run check
npm run format:check
npx playwright install chromium
npm run test:browser
npm run package:release
```

Release packaging is deterministic and writes four assets under `release/v0.1.0-alpha.2/`. Playwright is a development dependency; users do not need its browser to use the app. `npm run demo` runs a fictional temporary workspace after building.

Read [CLI reference](docs/CLI.md), [architecture](docs/ARCHITECTURE.md), [connections](docs/CONNECTIONS.md), and [provenance](docs/PROVENANCE.md).

## License and attribution

Code and skill instructions are [MIT licensed](LICENSE). See [trademark and logo terms](TRADEMARKS.md) and [third-party notices](THIRD_PARTY_NOTICES.md). AIS-OS inspired the interaction patterns; this implementation does not redistribute its code or named frameworks.

- [Chief of Staff Batch 6 — calendar approval and recovery](docs/CHIEF_OF_STAFF_BATCH_6.md): local alpha implementation; live adapter verification remains pending.

- [Foundation readiness and remaining gates](docs/FOUNDATION_READINESS.md): complete foundation verification before selecting real-project intake. House of Ichigo is the future pilot area; no whole-folder import authorized.

- [Chief of Staff workspace redesign](docs/WORKSPACE_REDESIGN.md): unified Knowledge Hub, editable clients/projects, daily signals, scoped read-only intake and security configuration. Local alpha; provider/platform verification remains pending.

Local transcript intake: [upload/select → review text and speakers → validate assistant suggestions](docs/TRANSCRIPT_WORKFLOW.md).

Local implementation note: [Connected Chief of Staff chat](docs/CONNECTED_CHAT.md) describes Home/Knowledge Hub entry points, schema 17, provider setup and verification boundaries. These changes are unreleased.

Local implementation note: [Interactive Chat results, Activity and Suggestions](docs/INTERACTIVE_WORK.md) describes schema 18, governed result cards, durable progress, shared review and a fictional demonstration. No app publication is included.

## Current local governance and assistant guides

Read [governance](docs/RULES.md), [filesystem ownership](docs/FILESYSTEM.md), [tool conventions](docs/TOOL_CONVENTIONS.md) and the [generated operation reference](docs/OPERATIONS_REFERENCE.md). The engine remains authoritative. Optional adapter updates install versioned guide copies and preserve customized manuals; app-only setup creates no assistant instructions. Run `npm run docs:sync` to regenerate references and `npm run docs:check` to detect drift. This documentation describes the unreleased app, not a new public skills release.

Local schema-19 work: [Unified retrieval and reviewed memory](docs/UNIFIED_RETRIEVAL.md) records implementation, verification and remaining acceptance gates. Semantic search is optional; private migration and publication are separate.
=======
[Changelog](CHANGELOG.md) · [Validation limits](docs/VALIDATION.md)
>>>>>>> 66fcc668b3a4e0085bdc3eb3d23209fadb2ba052
