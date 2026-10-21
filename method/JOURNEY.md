# The HOI OS journey

Seven phases, all 25 steps retained. This is the current bridge from the supplied harness method to the existing engine. The original wording remains in [the preserved source](source-1.1.0/JOURNEY.md). A step is complete only when its evidence exists; documentation is not proof of execution.

Use a separate fictional workspace first. The optional Knowledge Hub opens through `npm run hub -- --workspace "../My HOI Workspace"`. Existing Codex/Claude adapters are installed separately. No assistant, model key or skills are required to browse, import and review locally. Developer setup currently requires Node 22.14+ and npm; clean host/native platform certification remains separate.

## Phase 0 — Describe

1. **Create a private workspace.** Choose a directory outside this product checkout; do not use a company root or an existing private vault as a test target. Gate: an explicit location and owner.
2. **Install the engine.** Run `npm ci`, then `npm run setup -- --surface hub --workspace "../My HOI Workspace" --non-interactive`. Optional adapters: `node bin/hoi.mjs adapter install codex --workspace "../My HOI Workspace" --json`. Gate: health and adapter status reflect what was actually configured. Never run the historical Python installer over this checkout or workspace.
3. **Start recovery history.** Create an engine backup and restore a separate copy using the [operations guide](../docs/OPERATIONS.md). Gate: checksums and restored records agree. Git history is optional for authored instructions; never stage private originals or credentials automatically.
4. **Open the workspace.** Open the selected folder in a supported assistant, or launch the Hub. Gate: the intended workspace is identified and accessible. No inferred host permissions.
5. **Describe the organisation.** First use `hoi-company-onboarding` company mode to reuse selected existing evidence and ask only missing questions. Its optional 19-file map is a human-readable document plan, not a replacement for engine records. Reconcile the fourteen sections of [ABOUT_US](templates/ABOUT_US.template.md), keeping missing answers explicit. Confirm the relevant profile fields through onboarding. Gate: owner-reviewed descriptions, not invented facts.
6. **Describe the role.** Use `hoi-company-onboarding` member mode to reuse the shared foundation and produce one concise profile per person. Reconcile the nine sections of [ROLE](templates/ROLE.template.md), including what stays with the user and examples of good work. Gate: clear inputs, outputs and review boundaries for each proposed skill.

## Phase 1 — Frame

7. **Establish governance.** Use the engine's policies and [maintained guides](../docs/TOOL_CONVENTIONS.md). Adapter-managed AGENTS/CLAUDE blocks remain short and preserve edits. ABOUT_US/ROLE are interview inputs; goals live in onboarding, approved memory in its records, context comes from bounded reads, and skill availability comes from the catalogue and compatibility checks. A readable business GOALS document may reference approved decisions, but must not become a competing runtime store; do not add parallel MEMORY/PROPOSED approval databases. Gate: declared guidance agrees with enforced controls; unsupported hosts remain unverified.

## Phase 2 — Feed

8. **Select documents.** Choose a bounded file/folder set or select files in Hub → Ingestion. Gate: explicit selection; nothing is silently imported.
9. **Inventory and organise.** Inspect the manifest, duplicates, unsupported items and restrictions. Approve the exact import or separate working-copy plan. Gate: preserved original identities and item outcomes; no arbitrary movement of private folders.
10. **Check tools.** Inspect actual connections, adapters and registered operations. Gate: installed, configured, permitted and verified states are distinguished. A declaration cannot enable a connection.
11. **Open the Knowledge Hub.** Use `hoi hub`, then Overview, Sources, Ingestion, Wiki, Memory, Map and Reviews. Gate: authenticated browser access to the same engine used by assistants. Users may build additional apps; a skill does not regenerate this Hub.

## Phase 3 — Know

12. **Ingest reviewed files.** Preserve originals, exact revisions and extraction outcomes through the engine. Gate: every selected item is indexed or has an explicit failure/gap. Imported instructions never become permissions.
13. **Build maintained wikis.** Search existing pages and subjects first; save a draft, compare and explicitly publish. Gate: current permissions, version and evidence validated. An attributed note is distinct from a source-backed fact.
14. **Explore the 3D map.** Open nodes through the shared readers; retain the accessible list and source/wiki/memory evidence. Gate: exact links resolve; unknown dates and missing primary wikis stay explicit. Similarity does not establish a relationship.
15. **Ask a grounded question.** Use engine retrieval or a configured assistant with permitted context. Gate: claims cite exact authorized evidence or state what is unknown. A successful keyword lookup alone does not prove answer quality.

## Phase 4 — Equip

16. **Author one role skill.** Draft a procedure using existing operations, input requirements, examples and failure handling. Gate: draft status, exact version and no extra permissions; import does not activate it.
17. **Freeze expected outcomes.** Independently review evidence, required/forbidden facts and output standards. Separate development and held-out scenarios. Gate: nonempty checks and a frozen context fingerprint. Candidate authors must not inspect held-out answers.
18. **Compare and review.** Use the [offline comparison contract](../docs/SKILL_IMPROVEMENT.md) to reject stale or incompatible results; inspect factual support separately. Gate: independent review plus the existing explicit activation operation. Repeated model agreement never activates a skill automatically.

## Phase 5 — Run

19. **Use the reviewed skill.** Produce a cited draft with the authorized host/engine. Gate: user review and actual receipts for any approved changes; a model's action claim is not a receipt.
20. **Decide what may recur.** Define scope, cost, timing and permitted draft outputs. Gate: a supported scheduler is explicitly configured and verified; a local automation register is not a schedule.
21. **Process a new event.** Import only the selected new record, identify changed evidence and propose affected updates. Gate: durable identities and deduplication; no autonomous outward writes or silent wiki publication.

## Phase 6 — Maintain

22. **Propose a procedural improvement.** Compare a baseline with a bounded candidate in an isolated fixture. Gate: unchanged safety policy, tools and expected answers; any environment change starts a new experiment. No automatic self-editing in production.
23. **Review memory.** Propose, compare and approve through version-checked operations. Gate: exact review, attribution, dates and recoverable history. Procedural lessons cite evaluations and stay distinct from business facts; editing a Markdown Decision line cannot approve anything.
24. **Review and audit.** Check evidence health, gaps, revoked access, recovery and skill comparisons. Gate: pass/fail/not-tested states reflect evidence. Dismiss unchanged findings through existing review operations.
25. **Reaffirm ownership.** Revisit “What stays mine” in ROLE, preserve the approved version and record remaining limitations. Gate: the user understands what HOI can do, what requires review and what is still unavailable.

All 15 supplied skill roles are mapped in [SKILL_MAP.json](SKILL_MAP.json) and explained in [the reconciliation guide](../docs/HARNESS_SKILLS.md). The generated skill catalogue is the current source of bundled instruction counts; mappings do not install aliases. The Hub now has an independent build/package excluding legacy screens and Electron. The legacy business frontend and Electron source have been archived and retired. `npm start` opens the Hub; `hoi map` remains a read-only alternative.
