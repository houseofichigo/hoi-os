# HOI OS

**A local-first harness for an AI Chief of Staff, with an optional Knowledge Hub.**

HOI keeps evidence, reviewed memory and governed operations in a workspace you own. Optional assistants use the same engine. The Knowledge Hub lets you import selected files, read and edit wikis, review memory and explore an evidence-linked 3D map. You can build your own application on the registered operations.

This checkout is an **unreleased local candidate**. The earlier full business application and Electron installer are retired. Historical skills releases remain separate; a package's base version alone does not identify this candidate. Use its build fingerprint and checksums. The current schema-20 upgrade adds selective routing and disabled-by-default automation; see [current verification](docs/AUTOMATION_VALIDATION.md). See [final handover](docs/FINAL_HANDOVER.md) and [documentation index](docs/DOCUMENTATION.md).

## What is included

- A **25-step method in seven phases**, with preserved source documents and templates: [method](method/README.md).
- The shared engine: preserved originals, ranked retrieval, versioned wikis and reviewed memory, tasks, approvals, durable work and recovery.
- **60 optional skills: one installer and 59 operational skills**, with workspace-scoped Codex/Claude adapters.
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

| Skill                       | Purpose                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hoi-3d-map`                | Use when requested to open the optional local HOI Knowledge Hub or 3D map to inspect and maintain sources, reviewed wikis, memory, evidence and relationships.                                                                                                                                                                 |
| `hoi-acceptance-review`     | Use when asked to review a delivery against its agreed acceptance criteria. Not for deploying, merging or approving a release automatically.                                                                                                                                                                                   |
| `hoi-account-research`      | Use when asked to research the selected account for a business conversation. Not for bulk prospect scraping or unsolicited outreach.                                                                                                                                                                                           |
| `hoi-analysis-plan`         | Use when asked to plan an analysis to answer a defined decision question. Not for automatic model deployment or fabricated statistical significance.                                                                                                                                                                           |
| `hoi-architecture-decision` | Use when asked to compare technical options for the selected decision. Not authority for production changes or an untested performance guarantee.                                                                                                                                                                              |
| `hoi-assessment-review`     | Use when asked to review an assessment against learning outcomes and policy. Not for autonomous learner scoring or certification decisions.                                                                                                                                                                                    |
| `hoi-audit`                 | Use when requested to inspect an HOI OS workspace for schema, database, extraction, backup, adapter, connection, workflow, and memory health without changing it.                                                                                                                                                              |
| `hoi-automate`              | Prepare and inspect scoped HOI automations for recurring intake, knowledge checks and reviewable drafts; configure Codex or n8n schedules only when explicitly requested, verify their actual state and pause or diagnose failed runs.                                                                                         |
| `hoi-build-capability`      | Use when requested to draft a role skill or define and evaluate a bounded HOI workflow using registered tools and explicit review.                                                                                                                                                                                             |
| `hoi-capture`               | Use when requested to record user-supplied decisions, preferences, or experience as reviewable HOI memory.                                                                                                                                                                                                                     |
| `hoi-cash-scenarios`        | Use when asked to prepare cash-flow scenarios from approved balances and commitments. Not for initiating transfers, prioritizing creditors as legal advice or guaranteed forecasts.                                                                                                                                            |
| `hoi-chief-of-staff`        | Use when requested to prepare a daily HOI work brief, review promises and waiting-for tasks, prepare an exact meeting instance, and suggest local preparation time from confirmed calendar exports.                                                                                                                            |
| `hoi-client-review`         | Use when asked to review client outcomes and relationship risks from selected records. Not for automatic renewal outreach, account changes or contract decisions.                                                                                                                                                              |
| `hoi-close-preparation`     | Use when asked to prepare the period-close checklist from supplied accounting policies. Not for preparing filings, certifying accounts or executing ledger changes.                                                                                                                                                            |
| `hoi-communication-brief`   | Use when asked to draft a communication brief for a defined audience and objective. Not for autonomous external communication or impersonating an approver.                                                                                                                                                                    |
| `hoi-company-onboarding`    | Build or reconcile company operating documents, member profiles and client context from selected existing evidence, then interview only for gaps or contradictions. Use for evidence-first company or team onboarding and an agreed operating-document pack; not for runtime installation or account-wide conversation access. |
| `hoi-competitor-research`   | Use when asked to compare selected competitors for our target market. Not a substitute for private market data or authorization to contact competitors.                                                                                                                                                                        |
| `hoi-connect`               | Use when requested to check available Gmail, Calendar, Drive, or GitHub host tools for a selected HOI workspace.                                                                                                                                                                                                               |
| `hoi-consolidate`           | Use when requested to find duplicate, stale, and proposed HOI memories for review.                                                                                                                                                                                                                                             |
| `hoi-content-strategy`      | Use when asked to plan a content strategy from audience questions and approved knowledge. Not for automatic posting or fabricated SEO volumes.                                                                                                                                                                                 |
| `hoi-contract-issues`       | Use when asked to identify contract issues against the selected review playbook. Not legal advice, signature authority or automatic contract approval.                                                                                                                                                                         |
| `hoi-control-evidence`      | Use when asked to map selected evidence to the agreed controls. Not an audit opinion, certification or permission to alter systems.                                                                                                                                                                                            |
| `hoi-data-quality-review`   | Use when asked to review selected data for completeness consistency and duplication. Not for destructive cleaning or asserting statistical representativeness without evidence.                                                                                                                                                |
| `hoi-design-brief`          | Use when asked to prepare a design brief for the selected audience and surface. Not for redesigning unrelated surfaces or claiming a prototype is usability-tested.                                                                                                                                                            |
| `hoi-discovery-preparation` | Use when asked to prepare a discovery conversation for an account and objective. Not for autonomous qualification decisions or sending invitations.                                                                                                                                                                            |
| `hoi-employee-onboarding`   | Use when asked to prepare an onboarding plan for a supplied role. Not for repeating company-wide interviews or automatically creating user accounts.                                                                                                                                                                           |
| `hoi-evaluate`              | Use when requested to evaluate HOI retrieval or compare proposed skill revisions against frozen fictional evidence and independently reviewed standards.                                                                                                                                                                       |
| `hoi-expertise-customize`   | Prepare, compare and review a private client profile for selected HOI expertise plugins after company or client onboarding. Use when tailoring business workflows to a client's evidence, operating model, brand, metrics or review conventions. Does not install plugins, configure connections or grant permissions.         |
| `hoi-finance-variance`      | Use when asked to explain budget versus actual for the selected period. Not for investment advice, statutory assurance, journal posting or payments.                                                                                                                                                                           |
| `hoi-incident-triage`       | Use when asked to prepare an incident triage brief from selected observations. Not for autonomous incident response, public notification or attribution of an attacker.                                                                                                                                                        |
| `hoi-ingest`                | Use when requested to plan and ingest selected local files or authorized host exports into HOI OS with bounded scope, preserved originals, provenance, and visible failures.                                                                                                                                                   |
| `hoi-knowledge-review`      | Use when requested to audit HOI wiki and memory for stale evidence, recorded contradictions, duplicates, superseded information and expired memory; prepare cited replacements and review findings without deleting originals.                                                                                                 |
| `hoi-learning-design`       | Use when asked to design a learning sequence for supplied learner outcomes. Not for claiming learning effectiveness before learner evaluation.                                                                                                                                                                                 |
| `hoi-meeting-prep`          | Use when requested to prepare a cited client meeting brief using HOI knowledge and available read-only host connections.                                                                                                                                                                                                       |
| `hoi-metric-definition`     | Use when asked to define an auditable metric for the selected business question. Not for claiming metric values without data or executing warehouse writes.                                                                                                                                                                    |
| `hoi-obligation-map`        | Use when asked to extract obligations from the selected agreement. Not for accepting commitments, interpreting disputed legal duties or sending notices.                                                                                                                                                                       |
| `hoi-onboard`               | Use when requested to onboard a user into HOI OS, capture their operating context, select a bounded source scope, and reach a first useful result without uncontrolled ingestion.                                                                                                                                              |
| `hoi-organize`              | Use when requested to propose and apply an exact, approval-bound organization of HOI OS working copies while preserving every original.                                                                                                                                                                                        |
| `hoi-people-policy-draft`   | Use when asked to draft a people policy from confirmed operating decisions. Not legal advice or authority to change employment terms.                                                                                                                                                                                          |
| `hoi-policy-review`         | Use when asked to review a policy against selected internal requirements. Not for publishing policy or determining regulatory compliance.                                                                                                                                                                                      |
| `hoi-positioning-brief`     | Use when asked to draft a positioning brief for the supplied offering and audience. Not for legal approval of advertising claims or automatic campaign publication.                                                                                                                                                            |
| `hoi-practice-design`       | Use when asked to create a practice activity for a defined learning outcome. Not for automated grading or assessment-policy changes.                                                                                                                                                                                           |
| `hoi-product-requirements`  | Use when asked to turn the supplied user problem into testable requirements. Not authorization to deploy, replace a platform or broaden scope.                                                                                                                                                                                 |
| `hoi-project-intake`        | Extract a complete project brief from a transcript or user input, clarify missing fields, and validate the exact 17-field project Action contract before an explicitly requested submission. Individual tasks use HOI task proposals separately.                                                                               |
| `hoi-retrieve`              | Use when requested to find source-backed information and bounded context in HOI OS.                                                                                                                                                                                                                                            |
| `hoi-role-clarity`          | Use when asked to clarify responsibilities and handoffs for a selected role. Not for hiring, promotion, dismissal or automated employee scoring.                                                                                                                                                                               |
| `hoi-security`              | Review HOI OS security configuration and recorded test coverage, including source access, exact approvals, connection scopes, credentials and recovery. Use for a requested security check of a selected local workspace.                                                                                                      |
| `hoi-session-capture`       | Use when requested to propose reviewable HOI memories and wiki updates from decisions made in the current working session.                                                                                                                                                                                                     |
| `hoi-support-knowledge`     | Use when asked to propose a reusable support article from selected resolved cases. Not for promoting every conversation into approved knowledge.                                                                                                                                                                               |
| `hoi-support-response`      | Use when asked to draft a support response grounded in approved policy and knowledge. Not for sending replies or approving refunds.                                                                                                                                                                                            |
| `hoi-support-triage`        | Use when asked to triage a selected support case using the approved service policy. Not for automatically closing cases or making account/security changes.                                                                                                                                                                    |
| `hoi-task-intake`           | Use when requested to extract evidence-backed to-do proposals from selected transcripts, briefs, Gmail messages or Calendar context; check existing commitments and route ambiguous duplicates to review without approving tasks or changing calendars.                                                                        |
| `hoi-threat-model`          | Use when asked to prepare a threat model for the selected system boundary. Not authorization for scanning, exploitation or production changes.                                                                                                                                                                                 |
| `hoi-ux-content-review`     | Use when asked to review a user flow for clarity accessibility and recovery. Not for silently changing code or certifying accessibility.                                                                                                                                                                                       |
| `hoi-vendor-comparison`     | Use when asked to compare selected vendor proposals against approved criteria. Not for vendor selection approval or executing purchases.                                                                                                                                                                                       |
| `hoi-vendor-criteria`       | Use when asked to define vendor criteria for a supplied purchasing need. Not for awarding contracts or issuing binding procurement terms.                                                                                                                                                                                      |
| `hoi-vendor-review`         | Use when asked to review a vendor against supplied commitments and service evidence. Not for terminating suppliers, changing contracts or sending notices.                                                                                                                                                                     |
| `hoi-wiki`                  | Use when requested to build and maintain cited, reviewable current-view wiki pages from HOI OS evidence without replacing original sources or history.                                                                                                                                                                         |
| `hoi-wiki-author`           | Use when requested to create or revise cited HOI wiki drafts for clients, projects, people, offerings, topics and decisions; resolve existing pages first and preserve evidence, attribution and revision history.                                                                                                             |

<!-- skills:end -->

## Reuse and history

Code and skill instructions are [MIT licensed](LICENSE). Forking and reuse are welcome; see [trademarks](TRADEMARKS.md) and [third-party notices](THIRD_PARTY_NOTICES.md) for the separate brand and dependency terms.

[Historical release notes](docs/RELEASE.md) describe the older tagged skills package, not this candidate. Older app, desktop and batch reports remain historical evidence; they do not certify the current distribution. Live providers, independent retrieval/skill effectiveness, clean target-platform installations and real-use pilots require their own records. Do not infer readiness from a successful build.

## Selective routing and scheduled maintenance (local source upgrade)

Schema 20 adds conservative skill routing and opt-in, scope-bound intake/check/draft automation. The 25-step method and optional Knowledge Hub remain. No schedules activate on install. [Guide](docs/AUTOMATIONS.md) · [Validation and remaining gates](docs/AUTOMATION_VALIDATION.md) · [Codex trigger](integrations/codex/schedule-prompt.md) · [n8n templates](integrations/n8n/README.md).

### Precise knowledge pipelines — schema 21 candidate

[Selected session capture, enrichment and pipeline health](docs/KNOWLEDGE_PIPELINES.md) extend the existing engine and optional Hub. The baseline matcher is corrected; candidate observation ranking remains opt-in. Originals, reviewed memory and wiki authority remain unchanged. This local source upgrade does not update private workspaces or publish a release.

[Schema-21 validation, measured performance and remaining gates](docs/DISCOVERY_VALIDATION.md).

## Optional expertise plugins

[15 client-customizable plugins](docs/EXPERTISE_PLUGINS.md) package 45 focused workflows. Customize after onboarding within Step 16; private profiles never grant permissions. Local candidates only; no installation, runtime migration or publication is implied.
