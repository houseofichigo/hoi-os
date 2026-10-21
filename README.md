# HOI OS

**A local-first harness for an AI Chief of Staff, with an optional Knowledge Hub.**

HOI keeps evidence, reviewed memory and governed operations in a workspace you own. Optional assistants use the same engine. The Knowledge Hub lets you import selected files, read and edit wikis, review memory and explore an evidence-linked 3D map. You can build your own application on the registered operations.

This checkout is an **unreleased local candidate**. The earlier full business application and Electron installer are retired. Historical skills releases remain separate; a package's base version alone does not identify this candidate. Use its build fingerprint and checksums. The current schema-20 upgrade adds selective routing and disabled-by-default automation; see [current verification](docs/AUTOMATION_VALIDATION.md). See [final handover](docs/FINAL_HANDOVER.md) and [documentation index](docs/DOCUMENTATION.md).

## What is included

- A **25-step method in seven phases**, with preserved source documents and templates: [method](method/README.md).
- The shared engine: preserved originals, ranked retrieval, versioned wikis and reviewed memory, tasks, approvals, durable work and recovery.
- **22 optional skills: one installer and 21 operational skills**, with workspace-scoped Codex/Claude adapters.
- An optional browser Knowledge Hub: **Knowledge · Skills · Configuration**, including a 3D map and accessible record list.
- Fictional examples, an installation acceptance runner and checksummed local packaging.

No skill installation, model API key or semantic-model download is required for basic intake, retrieval and knowledge review. Skills supply instructions; they cannot grant permissions or approve their own proposals. Provider generation and Google actions are optional engine capabilities with separate disclosure, scopes, budgets and approvals. The Hub prepares assistant handoffs; it does not restore the retired Chat/Inbox frontend.

## Start from source

Install Node.js 22.14+ and npm, with compatible platform-native dependencies. Keep the product and private workspace separate:

```sh
npm ci
npm run setup -- --workspace "../HOI Workspace" --non-interactive
npm start -- --workspace "../HOI Workspace" --port 0
```

Open the complete authenticated URL printed by the launcher. Its temporary fragment is private; a plain `/hub` URL cannot sign you in. Ctrl+C stops the engine. Nothing installs a hidden service. Setup defaults to no assistant adapters and no AI configuration. Use a deliberately selected empty workspace first; setup does not silently migrate an old private database.

For a prepared Node package, follow [installation and recovery](docs/HUB_INSTALLATION.md). Git is not required to run that package. Node and native dependencies are required; this is not a standalone desktop installer.

## Add assistants deliberately

```sh
node bin/hoi.mjs adapter install codex --workspace "../HOI Workspace" --json
node bin/hoi.mjs adapter status --workspace "../HOI Workspace" --json
```

Use `claude` or `both` where appropriate. Configuration also exposes adapter management. Customized manuals and skills are preserved and conflicts reported. Installation, engine compatibility and successful execution in a fresh assistant session are separate states. Follow [host acceptance](docs/HOST_ACCEPTANCE.md).

Start with one outcome and selected source files. Try the [fictional Chief of Staff recipe](docs/CHIEF_OF_STAFF_RECIPE.md), then use [reviewed skill comparisons](docs/SKILL_IMPROVEMENT.md) and [procedural lessons](docs/PROCEDURAL_LESSONS.md) to improve instructions without automatically changing active skills.

## Build, verify and package

```sh
npm run check
npm run format:check
npm run test:browser
npm run publication:prepare
npm run package:candidate -- --output "../HOI candidate"
```

The output directory must be new. It contains a Hub ZIP, separate installer and operational-skill ZIPs, build metadata, checksums and a handover. Failed preparation retains an incomplete directory for inspection; retry in another directory. Packaging does not install adapters or publish anything. To package skills alone, use `npm run package:release -- --output "../HOI skills candidate"`.

Validate the extracted candidate with `npm ci --omit=dev` followed by `npm run hub:acceptance -- --output "../HOI acceptance"`. This rehearses fictional import, concurrent CLI use, restart, backup/restore and adapter conflict handling. It does not certify a clean machine or real assistant behavior. The manual GitHub workflow prepares downloadable candidate artifacts only; it cannot publish a release.

## Guides and boundaries

- [Governance](docs/RULES.md), [filesystem ownership](docs/FILESYSTEM.md), [tool conventions](docs/TOOL_CONVENTIONS.md).
- [Generated operations](docs/OPERATIONS_REFERENCE.md), [compatibility](docs/COMPATIBILITY.md), [architecture](docs/ARCHITECTURE.md), [connections](docs/CONNECTIONS.md).
- [Operations and recovery](docs/OPERATIONS.md), [publication preparation](docs/PUBLICATION_READINESS.md), [release acceptance](docs/ACCEPTANCE.md).

The engine remains authoritative. Credentials, private records and workspace configuration must stay outside this checkout and distributable packages. Before any private upgrade, verify a backup and restore it to a separate directory. A restored compatible copy is the rollback path.

## Bundled skills

For company documents and team profiles, start with [evidence-first onboarding](docs/COMPANY_ONBOARDING.md). It reuses selected existing work before asking questions and hands off to `hoi-onboard` for runtime setup.

<!-- skills:start -->

| Skill                    | Purpose                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hoi-3d-map`             | Use when requested to open the optional local HOI Knowledge Hub or 3D map to inspect and maintain sources, reviewed wikis, memory, evidence and relationships.                                                                                                                                                                 |
| `hoi-audit`              | Use when requested to inspect an HOI OS workspace for schema, database, extraction, backup, adapter, connection, workflow, and memory health without changing it.                                                                                                                                                              |
| `hoi-automate`           | Prepare and inspect scoped HOI automations for recurring intake, knowledge checks and reviewable drafts; configure Codex or n8n schedules only when explicitly requested, verify their actual state and pause or diagnose failed runs.                                                                                         |
| `hoi-build-capability`   | Use when requested to draft a role skill or define and evaluate a bounded HOI workflow using registered tools and explicit review.                                                                                                                                                                                             |
| `hoi-capture`            | Use when requested to record user-supplied decisions, preferences, or experience as reviewable HOI memory.                                                                                                                                                                                                                     |
| `hoi-chief-of-staff`     | Use when requested to prepare a daily HOI work brief, review promises and waiting-for tasks, prepare an exact meeting instance, and suggest local preparation time from confirmed calendar exports.                                                                                                                            |
| `hoi-company-onboarding` | Build or reconcile company operating documents, member profiles and client context from selected existing evidence, then interview only for gaps or contradictions. Use for evidence-first company or team onboarding and an agreed operating-document pack; not for runtime installation or account-wide conversation access. |
| `hoi-connect`            | Use when requested to check available Gmail, Calendar, Drive, or GitHub host tools for a selected HOI workspace.                                                                                                                                                                                                               |
| `hoi-consolidate`        | Use when requested to find duplicate, stale, and proposed HOI memories for review.                                                                                                                                                                                                                                             |
| `hoi-evaluate`           | Use when requested to evaluate HOI retrieval or compare proposed skill revisions against frozen fictional evidence and independently reviewed standards.                                                                                                                                                                       |
| `hoi-ingest`             | Use when requested to plan and ingest selected local files or authorized host exports into HOI OS with bounded scope, preserved originals, provenance, and visible failures.                                                                                                                                                   |
| `hoi-knowledge-review`   | Use when requested to audit HOI wiki and memory for stale evidence, recorded contradictions, duplicates, superseded information and expired memory; prepare cited replacements and review findings without deleting originals.                                                                                                 |
| `hoi-meeting-prep`       | Use when requested to prepare a cited client meeting brief using HOI knowledge and available read-only host connections.                                                                                                                                                                                                       |
| `hoi-onboard`            | Use when requested to onboard a user into HOI OS, capture their operating context, select a bounded source scope, and reach a first useful result without uncontrolled ingestion.                                                                                                                                              |
| `hoi-organize`           | Use when requested to propose and apply an exact, approval-bound organization of HOI OS working copies while preserving every original.                                                                                                                                                                                        |
| `hoi-project-intake`     | Extract a complete project brief from a transcript or user input, clarify missing fields, and validate the exact 17-field project Action contract before an explicitly requested submission. Individual tasks use HOI task proposals separately.                                                                               |
| `hoi-retrieve`           | Use when requested to find source-backed information and bounded context in HOI OS.                                                                                                                                                                                                                                            |
| `hoi-security`           | Review HOI OS security configuration and recorded test coverage, including source access, exact approvals, connection scopes, credentials and recovery. Use for a requested security check of a selected local workspace.                                                                                                      |
| `hoi-session-capture`    | Use when requested to propose reviewable HOI memories and wiki updates from decisions made in the current working session.                                                                                                                                                                                                     |
| `hoi-task-intake`        | Use when requested to extract evidence-backed to-do proposals from selected transcripts, briefs, Gmail messages or Calendar context; check existing commitments and route ambiguous duplicates to review without approving tasks or changing calendars.                                                                        |
| `hoi-wiki`               | Use when requested to build and maintain cited, reviewable current-view wiki pages from HOI OS evidence without replacing original sources or history.                                                                                                                                                                         |
| `hoi-wiki-author`        | Use when requested to create or revise cited HOI wiki drafts for clients, projects, people, offerings, topics and decisions; resolve existing pages first and preserve evidence, attribution and revision history.                                                                                                             |

<!-- skills:end -->

## Reuse and history

Code and skill instructions are [MIT licensed](LICENSE). Forking and reuse are welcome; see [trademarks](TRADEMARKS.md) and [third-party notices](THIRD_PARTY_NOTICES.md) for the separate brand and dependency terms.

[Historical release notes](docs/RELEASE.md) describe the older tagged skills package, not this candidate. Older app, desktop and batch reports remain historical evidence; they do not certify the current distribution. Live providers, independent retrieval/skill effectiveness, clean target-platform installations and real-use pilots require their own records. Do not infer readiness from a successful build.

## Selective routing and scheduled maintenance (local source upgrade)

Schema 20 adds conservative skill routing and opt-in, scope-bound intake/check/draft automation. The 25-step method and optional Knowledge Hub remain. No schedules activate on install. [Guide](docs/AUTOMATIONS.md) · [Validation and remaining gates](docs/AUTOMATION_VALIDATION.md) · [Codex trigger](integrations/codex/schedule-prompt.md) · [n8n templates](integrations/n8n/README.md).

### Precise knowledge pipelines — schema 21 candidate

[Selected session capture, enrichment and pipeline health](docs/KNOWLEDGE_PIPELINES.md) extend the existing engine and optional Hub. The baseline matcher is corrected; candidate observation ranking remains opt-in. Originals, reviewed memory and wiki authority remain unchanged. This local source upgrade does not update private workspaces or publish a release.

[Schema-21 validation, measured performance and remaining gates](docs/DISCOVERY_VALIDATION.md).
