# The HOI OS journey

Eight phases, 28 steps. This is the current bridge from the supplied harness method to the existing engine. The original wording remains in [the preserved source](source-1.1.0/JOURNEY.md); the previous 25-step numbering is mapped at the end of this page. A step is complete only when its evidence exists; documentation is not proof of execution.

New to HOI OS? Read [how HOI OS works](../docs/HOW_IT_WORKS.md) first: it names each part of the system that these steps build.

Use a separate fictional workspace first. The optional Knowledge Hub opens through `npm run hub -- --workspace "../My HOI Workspace"`. Existing Codex/Claude adapters are installed separately. No assistant, model key or skills are required to browse, import and review locally. Developer setup currently requires Node 22.14+ and npm; clean host/native platform certification remains separate.

| Phase                      | Steps | What you have at the end                                                    |
| -------------------------- | ----- | --------------------------------------------------------------------------- |
| 1 — Set up                 | 1–4   | A private workspace, a running engine and a tested backup                   |
| 2 — Inventory              | 5–7   | What exists, described in place; nothing moved                              |
| 3 — Foundation and ethics  | 8–10  | The organisation, the role, the rules and the ethics guide                  |
| 4 — Knowledge              | 11–16 | Cited sources, maintained wikis, the map and its connections                |
| 5 — Specialise             | 17–19 | The skills, the expertise plugins and the routing that picks one specialist |
| 6 — Verify                 | 20–22 | Expected outcomes frozen, a reviewed skill, a cited draft                   |
| 7 — Run                    | 23–24 | What may recur, and how a new event is processed                            |
| 8 — Maintain and hand over | 25–28 | Improvement, memory review, audit and ownership                             |

The technical journey below is a reference sequence. For a folder-first workshop, use [Learn](../learn/README.md): modules 1–4 need no engine, API key or installed skill; installation happens in module 5.

## Phase 1 — Set up

1. **Create a private workspace.** Choose a dedicated private local subfolder within the existing organizational environment (for example `Atelier Nord/HOI/`), outside the product checkout and never at the organizational root. Keep existing folders and canonical documents in place; link them rather than making competing copies. If that environment is cloud-synchronized, keep the active SQLite engine workspace separately local unless its storage and recovery have been verified; see [workspace storage](../docs/FILESYSTEM.md#workspace-location-and-existing-systems). Use fictional data in a separate test workspace, never an existing private vault as a test target. Gate: an explicit location and owner; no folder relocation or source ingestion is implied.
2. **Install the engine.** Run `npm ci`, then `npm run setup -- --surface hub --workspace "../My HOI Workspace" --non-interactive`. Optional adapters: `node bin/hoi.mjs adapter install codex --workspace "../My HOI Workspace" --json`. Gate: health and adapter status reflect what was actually configured. Never run the historical Python installer over this checkout or workspace.
3. **Start recovery history.** Create an engine backup and restore a separate copy using the [operations guide](../docs/OPERATIONS.md). Gate: checksums and restored records agree. Git history is optional for authored instructions; never stage private originals or credentials automatically.
4. **Open the workspace.** Open the selected folder in a supported assistant, or launch the Hub. Gate: the intended workspace is identified and accessible. No inferred host permissions.

## Phase 2 — Inventory

Look before acting. The inventory reads the existing drive or folders where they are; also list the systems used for the selected work. The organisation then chooses what enters the workspace and which access routes to review.

5. **Select documents.** Choose a bounded file/folder set or select files in Hub → Ingestion. Gate: explicit selection; nothing is silently imported.
6. **Inventory and organise.** Inspect the manifest, duplicates, unsupported items and restrictions. Approve the exact import or separate working-copy plan. Gate: preserved original identities and item outcomes; no arbitrary movement of private folders.
7. **Inventory systems and tools.** List the systems the selected work depends on: mail, calendar, CRM, ERP/accounting, chat, shared documents and other tools. Record what each holds, owner, sensitivity and access route: supported native connection (for example Gmail, Google Calendar, Google Drive or local folder), authorized assistant tool/MCP server, reviewed export through `import-connection`, or none. Unknowns remain unknown. Draft TOOLS.md from this inventory without credentials. Then inspect actual connections, adapters and registered operations for the selected routes. Gate: installed, configured, permitted and verified states are distinct; missing owners/access decisions remain visible; declarations and export schemas do not prove live connectivity or authorize access.

## Phase 3 — Foundation and ethics

8. **Describe the organisation.** First use `hoi-company-onboarding` company mode to reuse the evidence selected in Phase 2 and ask only missing questions. Its document map is a human-readable document plan, not a replacement for engine records. Reconcile the fourteen sections of [ABOUT_US](templates/ABOUT_US.template.md), keeping missing answers explicit. Confirm the relevant profile fields through onboarding. Gate: owner-reviewed descriptions, not invented facts.
9. **Describe the role.** Use `hoi-company-onboarding` member mode to reuse the shared foundation and produce one concise profile per person. Reconcile the nine sections of [ROLE](templates/ROLE.template.md), including what stays with the user and examples of good work. Gate: clear inputs, outputs and review boundaries for each proposed skill.
10. **Establish governance and ethics.** Use the engine's policies and [maintained guides](../docs/TOOL_CONVENTIONS.md). Adapt the [ethics guide](../docs/ETHICS.md) with the [ETHICS template](templates/foundation/ETHICS.md): owner, adaptations, open decisions and review date. RULES says what is permitted and enforced; ETHICS says how AI is used responsibly in this work; neither grants a permission. Adapter-managed AGENTS/CLAUDE blocks remain short and preserve edits. ABOUT_US/ROLE are interview inputs; goals live in onboarding, approved memory in its records, context comes from bounded reads, and skill availability comes from the catalogue and compatibility checks. A readable business GOALS document may reference approved decisions, but must not become a competing runtime store; do not add parallel MEMORY/PROPOSED approval databases. Gate: declared guidance agrees with enforced controls; unsupported hosts remain unverified.

## Phase 4 — Knowledge

11. **Open the Knowledge Hub.** Use `hoi hub`, then Overview, Sources, Ingestion, Wiki, Memory, Map and Reviews. Gate: authenticated browser access to the same engine used by assistants. Users may build additional apps; a skill does not regenerate this Hub.
12. **Ingest reviewed files.** Preserve originals, exact revisions and extraction outcomes through the engine. Gate: every selected item is indexed or has an explicit failure/gap. Imported instructions never become permissions.
13. **Build maintained wikis.** Search existing pages and subjects first; save a draft, compare and explicitly publish. Gate: current permissions, version and evidence validated. An attributed note is distinct from a source-backed fact.
14. **Explore the 3D map.** Open nodes through the shared readers; retain the accessible list and source/wiki/memory evidence. Gate: exact links resolve; unknown dates and missing primary wikis stay explicit. Similarity does not establish a relationship.
15. **Trace connections and impact.** From a selected record, use Explain connection (`knowledge path`) to show how two records are linked, and Review impact (`knowledge impact`) to list what may need review if it changes. Only recorded relationships are followed (cites, supports, describes, contradicts, supersedes), at depth 1–2, from the permission-filtered graph. See [graph retrieval](../docs/GRAPH_RETRIEVAL.md). Gate: every step of a path is an authorized recorded relationship; inspect its provenance and do not invent passage-level evidence; truncation is reported. A path is not proof of a composite claim, and impact suggests review without editing any record.
16. **Ask a grounded question.** Use engine retrieval or a configured assistant with permitted context. Gate: claims cite exact authorized evidence or state what is unknown. A successful keyword lookup alone does not prove answer quality.

## Phase 5 — Specialise

17. **Know the skills.** List the skills (`skills list`, or Hub → Skills): which are bundled, enabled or disabled, which revision is active and which drafts exist. A skill is one written method for one task; the assistant reads it only when that task comes up. Author a role skill with `hoi-build-capability` only where the catalogue lacks a method, using the ROLE interview. See [skills](../docs/SKILLS.md). Gate: enabled, active-revision and draft states are reported separately; creating a draft is not activation, and a skill grants no permission.
18. **Equip and customize expertise.** Choose relevant expertise plugins after selected files and operating-model documents are reviewed. Use `hoi-expertise-customize` to prepare, compare and review a private client profile. Gate: exact versions, source provenance, unresolved gaps and no new permissions; profile review and import do not activate tools. See [expertise guide](../docs/EXPERTISE_PLUGINS.md).
19. **Route each request to one specialist.** Use `harness:route` to see which reviewed skill a request would use, without executing it. The router picks one specialist per request from curated task names and English/French phrases; an explicit eligible skill takes precedence and an ambiguous request asks for its objective. It resembles a mixture of experts, but it is conservative phrase matching, not a learned model. Gate: the planned skill and its exact active revision are shown; ambiguity produces a question, not a guess; bounded workflows keep three sequential stages, five tool rounds and no recursion.

## Phase 6 — Verify

20. **Freeze expected outcomes.** Independently review evidence, required/forbidden facts and output standards. Separate development and held-out scenarios. Gate: nonempty checks and a frozen context fingerprint. Candidate authors must not inspect held-out answers.
21. **Compare and review.** Use the [offline comparison contract](../docs/SKILL_IMPROVEMENT.md) to reject stale or incompatible results; inspect factual support separately. Gate: independent review plus the existing explicit activation operation. Repeated model agreement never activates a skill automatically.
22. **Use the reviewed skill.** Produce a cited draft with the authorized host/engine. Gate: user review and actual receipts for any approved changes; a model's action claim is not a receipt.

## Phase 7 — Run

23. **Decide what may recur.** Define scope, cost, timing and permitted draft outputs. Gate: a supported scheduler is explicitly configured and verified; a local automation register is not a schedule.
24. **Process a new event.** Import only the selected new record, identify changed evidence and propose affected updates. Gate: durable identities and deduplication; no autonomous outward writes or silent wiki publication.

## Phase 8 — Maintain and hand over

25. **Propose a procedural improvement.** Compare a baseline with a bounded candidate in an isolated fixture. Gate: unchanged safety policy, tools and expected answers; any environment change starts a new experiment. No automatic self-editing in production.
26. **Review memory.** Propose, compare and approve through version-checked operations. Gate: exact review, attribution, dates and recoverable history. Procedural lessons cite evaluations and stay distinct from business facts; editing a Markdown Decision line cannot approve anything.
27. **Review and audit.** Check evidence health, gaps, revoked access, recovery and skill comparisons. Gate: pass/fail/not-tested states reflect evidence. Dismiss unchanged findings through existing review operations.
28. **Reaffirm ownership.** Revisit “What stays mine” in ROLE, preserve the approved version and record remaining limitations. Gate: the user understands what HOI can do, what requires review and what is still unavailable.

## Documents introduced at each step

<!-- foundation-steps:start -->

Documents are introduced progressively at the technical journey step that supplies their evidence, then reviewed when circumstances change. These are planning associations, not automatic file creation. The folder-first Learn path may draft README and a minimal manual before engine installation. CLAUDE/GEMINI pointers are created only when relevant; installing the engine alone does not install adapters or create those manuals. Existing canonical document locations remain valid. MEMORY/PROPOSED point to engine records and never grant approval.

| Step | Documents |
|---|---|
| 2 | `README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` |
| 6 | `FILESYSTEM.md`, `FILING.md` |
| 7 | `TOOLS.md`, `docs/TOOL_CONVENTIONS.md` |
| 8 | `ABOUT_US.md`, `GOALS.md` |
| 9 | `ROLES.md` |
| 10 | `RULES.md`, `ETHICS.md`, `VALIDATION-GUIDE.md` |
| 17 | `SKILLS.md` |
| 20 | `EVALS.md` |
| 23 | `WORKFLOWS.md`, `AUTOMATIONS.md` |
| 26 | `MEMORY.md`, `PROPOSED.md` |

<!-- foundation-steps:end -->

## Previous numbering

The 25-step journey (seven phases, Describe before Feed) is preserved in [the exact prior product method](history/JOURNEY-25.md); the original upstream method is retained separately in [the source archive](source-1.1.0/JOURNEY.md). Three steps are new (15, 17, 19); the inventory now precedes the description of the organisation.

| Previous step                       | Current step                                  |
| ----------------------------------- | --------------------------------------------- |
| 1–4                                 | 1–4                                           |
| 5 Describe the organisation         | 8                                             |
| 6 Describe the role                 | 9                                             |
| 7 Establish governance              | 10 (now with ethics)                          |
| 8 Select documents                  | 5                                             |
| 9 Inventory and organise            | 6                                             |
| 10 Check tools                      | 7 Inventory systems and tools                 |
| 11–14                               | 11–14                                         |
| —                                   | 15 Trace connections and impact (new)         |
| 15 Ask a grounded question          | 16                                            |
| —                                   | 17 Know the skills (new)                      |
| 16 Equip and customize expertise    | 18                                            |
| —                                   | 19 Route each request to one specialist (new) |
| 17 Freeze expected outcomes         | 20                                            |
| 18 Compare and review               | 21                                            |
| 19 Use the reviewed skill           | 22                                            |
| 20 Decide what may recur            | 23                                            |
| 21 Process a new event              | 24                                            |
| 22 Propose a procedural improvement | 25                                            |
| 23 Review memory                    | 26                                            |
| 24 Review and audit                 | 27                                            |
| 25 Reaffirm ownership               | 28                                            |

All 15 supplied skill roles are mapped in [SKILL_MAP.json](SKILL_MAP.json) and explained in [the reconciliation guide](../docs/HARNESS_SKILLS.md). The generated skill catalogue is the current source of bundled instruction counts; mappings do not install aliases. The Hub has an independent build/package excluding legacy screens and Electron. The legacy business frontend and Electron source have been archived and retired. `npm start` opens the Hub; `hoi map` remains a read-only alternative.
