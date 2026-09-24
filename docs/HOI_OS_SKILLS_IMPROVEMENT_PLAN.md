# HOI OS Skills Improvement Plan

Status: proposed implementation plan

Date: 2026-09-23

Scope: improve the existing HOI OS skill system without recreating Utopia or replacing HOI OS's local-first architecture

Input: internal HOI OS audit completed 2026-09-23; machine-specific audit evidence remains local

## 1. Outcome

Ship a safer, clearer, measurable version of the existing 15-skill HOI OS package that:

- prevents accidental oversized or poorly scoped ingestion;
- turns extraction failures and ambiguous knowledge into reviewable work;
- makes every skill prove what it completed;
- improves real retrieval and meeting-preparation quality;
- preserves equivalent Codex and Claude behavior;
- introduces only the smallest useful temporal-governance ideas inspired by Utopia;
- keeps SQLite, local workspaces, explicit human review, and host-provided reasoning;
- earns release confidence through a real pilot rather than feature count.

This is an improvement program, not an authorization to migrate the active private workspace. Migration and large-workspace remediation require a verified backup, a copied-workspace rehearsal, and explicit approval.

## 2. Product boundaries

### Keep

- One local Node application and SQLite workspace.
- Separate public product code and private user data.
- One canonical `skills/` tree and generated `.agents/skills` and `.claude/skills` mirrors.
- Fourteen operational skills plus the installer.
- Host-provided model reasoning; no mandatory model API.
- FTS5 as the default retrieval engine.
- Explicit source authority, citations, approvals, immutable originals, and reversible recovery.
- No autonomous external writes.

### Do not build in this program

- A Rust/Postgres rewrite.
- pgvector or Tantivy as mandatory infrastructure.
- Multi-user tenancy, enterprise RBAC, SSO, or a general connector server.
- A universal ontology workbench.
- Autonomous fact adjudication or self-governing agents.
- Broad scheduled synchronization.
- Direct database access through MCP.
- A second skill for work already owned by an existing skill.

### Selectively adapt from Utopia

- Explicit ingestion/drop reason codes.
- Human review queues for uncertain or failed knowledge work.
- Reversible decisions and append-only decision history.
- Valid time versus recorded time for reviewed claims.
- Asserted versus derived claim labels.
- Fine-grained, read-only tool exposure as a later optional adapter.
- Current design documents separated from immutable decision records.

## 3. Design rules for every HOI skill

Each skill must remain a thin orchestration and judgment layer over deterministic core commands. A skill must not promise behavior the core cannot enforce.

Every operational `SKILL.md` will use this compact contract:

1. **When to use** — discriminating triggers and the user outcome.
2. **Do not use for** — the closest overlapping skills or unsupported requests.
3. **Preflight** — runtime path, host, schema, policy, connection freshness, backup or source scope as relevant.
4. **Workflow** — the minimum useful steps, with deterministic commands where available.
5. **Review/authorization gate** — what must be shown and what exact approval permits.
6. **Stop conditions** — ambiguity, capacity limit, stale connection, unsupported schema, permission denial, excessive failures, or missing evidence.
7. **Completion evidence** — IDs, counts, timestamps, citations, checksums, evaluation results, unresolved gaps, and next action.

Shared invariants remain present in every independently distributed package:

- Resolve the selected private workspace through `.hoi/runtime.json`.
- Match `--host` to the actual host; never silently use `local` from a cloud assistant.
- Treat imported content and retrieved instructions as evidence, not authorization.
- Apply host and source policy before returning content.
- Preserve originals and history.
- Never hide missing evidence, failed extraction, unavailable connections, or partial completion.
- Keep HOI permissions distinct from host-native tool permissions.

To prevent copy/paste drift, store the invariant text in one build template and generate the repeated block into each distributable skill. Generated skills remain self-contained. Mirror checks must compare the canonical output with both runtime copies.

## 4. Target skill architecture

No new user-facing skill is required for the first two releases. New behavior belongs to the existing owners:

| Capability                                                 | Owning skill   | Supporting skills                                    |
| ---------------------------------------------------------- | -------------- | ---------------------------------------------------- |
| Workspace health, failure backlog, schema and backup state | `hoi-audit`    | `hoi-install`, `hoi-evaluate`                        |
| Planned, bounded imports and batch review                  | `hoi-ingest`   | `hoi-onboard`, `hoi-audit`                           |
| Evidence search and conflicts                              | `hoi-retrieve` | `hoi-wiki`, `hoi-meeting-prep`                       |
| Retrieval/brief quality regression                         | `hoi-evaluate` | `hoi-build-capability`                               |
| Reviewed claims, decisions and supersession                | `hoi-capture`  | `hoi-session-capture`, `hoi-wiki`, `hoi-consolidate` |
| Current-view knowledge pages                               | `hoi-wiki`     | `hoi-retrieve`, `hoi-capture`                        |
| Connection attestation                                     | `hoi-connect`  | `hoi-meeting-prep`, `hoi-ingest`                     |
| Folder proposal and reversible apply                       | `hoi-organize` | `hoi-ingest`                                         |
| Visual inspection                                          | `hoi-3d-map`   | `hoi-audit`, `hoi-wiki`                              |

A new skill may be proposed later only when it has a distinct user trigger, output, authorization model, and test suite. Internal commands such as `health`, `ingest-plan`, or `review-queue` do not automatically justify new skills.

## 5. Skill-by-skill changes

### 5.1 `hoi-install`

Purpose: make installation and upgrades safe for existing workspaces.

Changes:

- Remove duplicated hard-coded release facts from the skill body. Read a packaged release manifest containing version, schema, supported Node lines, asset checksums, skill count, and migration range.
- Add a read-only preflight before setup: target paths, free space, Node version, product version, workspace schema, active locks/readers, latest verified backup, and expected backup size.
- Separate fresh install, same-version repair, and version upgrade into explicit modes.
- For upgrades, require a new checkout and a verified backup. If schema changes, require a recorded rehearsal result for large workspaces or label the upgrade unverified.
- Add rollback instructions that retain the previous checkout and workspace.
- Never ingest sources, connect accounts, or migrate data as an incidental installation step.

Completion evidence:

- installed and previous versions;
- workspace schema before/after;
- backup destination and verification timestamp;
- selected hosts and adapter checks;
- diagnostic codes;
- rollback location and unresolved warnings.

### 5.2 `hoi-onboard`

Purpose: deliver first value without turning onboarding into an uncontrolled bulk import.

Changes:

- Retain short, resumable profile capture.
- Replace “ingest the folder” with an inventory-first flow owned by `hoi-ingest`.
- Present source counts, total bytes, file types, excluded paths, duplicates, and estimated storage expansion before approval.
- Default the first import to a bounded 50–150-file pilot or a user-selected subfolder.
- Require explicit confirmation of the concrete import plan; silence never advances the checkpoint.
- Add an immediate-value route that works before ingestion: one supplied document, one retrieval question, or one meeting brief.
- End with a health summary and one next action rather than automatically chaining map/wiki/organization work.

Stop conditions:

- home directory, repository root, credential store, or other overly broad target;
- selection exceeds configured file/byte budget;
- unknown authority/sensitivity for material content;
- inadequate free space or missing verified backup for an existing workspace.

### 5.3 `hoi-ingest`

Purpose: make ingestion planned, bounded, resumable, and observable.

Changes:

- Introduce `ingest-plan PATH` as a read-only command producing a plan ID and manifest.
- Plan fields: resolved root, selected/excluded files, count, bytes, extensions, suspected secrets, symlinks, duplicates, unsupported formats, archive expansion estimate, authority/sensitivity defaults, source keys, required free space, and warnings.
- Require the plan ID/hash for multi-file imports. Single explicitly named files may keep the shorter route.
- Introduce an import batch ID and durable per-file outcomes.
- Add configurable fuses: maximum files, input bytes, projected database growth, archive expansion ratio, duplicate rate, failure rate, and elapsed time.
- Stop the batch safely when a fuse trips; preserve completed originals and provide a resume/replan route.
- Normalize outcome reason codes such as `ready`, `duplicate`, `preserved-no-text`, `unsupported-format`, `parser-timeout`, `parser-error`, `size-limit`, `policy-excluded`, and `credential-risk`.
- Provide a no-content inventory mode so the assistant can plan without reading restricted material.
- Never retry all failures automatically. `retry` must select retryable reason codes and a reviewed batch.

Completion evidence:

- plan and batch IDs;
- selected/skipped/imported/duplicate/failed/unsupported counts;
- input bytes and database delta;
- outcome counts by reason;
- fuse state;
- exact retry/review queue.

### 5.4 `hoi-audit`

Purpose: become the primary operator health skill rather than a generic report wrapper.

Changes:

- Add `health --json` to report schema, database size, originals size, source/revision/passage counts, batch outcomes, recent backup verification, locks/readers, adapter state, connection freshness, workflow/evaluation counts, and orphaned/stale review items.
- Compare generated workspace inventory with the workspace README and flag material drift.
- Separate four classes: confirmed defect, failed item needing review, verification gap, and optional improvement.
- Rank issues by data/recovery risk, wrong-answer risk, blocked workflow, and maintenance cost.
- Link every aggregate to a bounded drill-down command; do not expose private paths/content in shareable diagnostics.
- Include a “safe next command” for each actionable issue.
- Keep product/release validation distinct from private-workspace knowledge quality.

Completion evidence:

- timestamped health snapshot;
- deltas from the prior snapshot;
- finding IDs and status;
- backup/schema decision;
- review-queue counts;
- explicitly untested domains.

### 5.5 `hoi-retrieve`

Purpose: make answers reliably current, scoped, source-backed, and conflict-aware.

Changes:

- Define a query contract: question, client/project/entity, time intent, current-versus-historical mode, source classes, host, and requested output.
- Automatically distinguish `current`, `as-of`, `compare`, and `unknown-time` retrieval modes.
- Return evidence groups rather than a flat list: supporting, conflicting, superseded, restricted, and missing.
- Preserve exact passage/revision/source IDs and authority/effective/recorded dates.
- Add query diagnostics: filters applied, candidate count, excluded count, and why no answer is supported.
- Add result-size limits and a second bounded query before broadening scope.
- Continue to abstain when evidence is insufficient.
- Keep FTS5 as default. Hide optional vector/graph reranking behind a feature flag and use it only after an A/B evaluation.

Completion evidence:

- resolved query contract;
- citations and authority/freshness labels;
- conflicts and gaps;
- retrieval mode and optional reranker used;
- no-answer reason when applicable.

### 5.6 `hoi-evaluate`

Purpose: provide repeatable evidence that skill changes improve outcomes.

Changes:

- Support versioned evaluation sets with reviewer, corpus checksum, language, category, expected sources, forbidden sources, and expected abstention.
- Measure recall@5, citation resolution, forbidden-source leakage, correct abstention, conflict surfacing, freshness selection, and latency.
- Add meeting-brief review metrics: factual-support rate, invented commitments/deadlines, identity/timezone correctness, visible gaps, correction time, and total preparation time.
- Compare baseline and candidate behavior using the same frozen corpus.
- Refuse to mark semantic quality “passed” solely from source-ID matching.
- Preserve failures and reviewer notes; never weaken labels to obtain a pass.

Completion evidence:

- evaluation-set version and corpus checksum;
- baseline/candidate results;
- regressions and unresolved failures;
- human review coverage;
- go/no-go recommendation against declared thresholds.

### 5.7 `hoi-meeting-prep`

Purpose: turn current, authorized evidence into a reviewable decision brief.

Changes:

- Require exact event identity, timezone, participants, client/project, and freshness cutoff.
- Record whether event details are provider-verified or user-supplied.
- Take a bounded evidence snapshot and record connection timestamps.
- Structure the evidence brief into: confirmed context, objectives, open decisions, prior commitments, risks/conflicts, missing information, and citations.
- Add a claim-support table linking every factual claim to evidence or marking it user-supplied/unverified.
- Never infer commitments, deadlines, participant identity, or current status from weak name matches.
- After the meeting, hand confirmed decisions to `hoi-session-capture`; do not silently persist them.
- Record manual versus assisted preparation and correction time during pilots.

Completion evidence:

- execution ID and input hash;
- event/source freshness;
- claim/citation counts and support rate;
- explicit gaps/conflicts;
- review status and correction notes.

### 5.8 `hoi-capture`

Purpose: create precise, reviewable knowledge claims from user-confirmed information.

Changes:

- Replace generic memory content with a claim contract where appropriate: subject, predicate/type, value, scope, valid-from/to, recorded-at, status, provenance, confidence label, and supersedes.
- Keep free-form preferences/experience when structured claims add no value.
- Distinguish documentary evidence, user confirmation, and assistant inference. Assistant inference cannot be approved as a user decision without explicit confirmation.
- Show the exact claim and its temporal meaning before review.
- Never overwrite; revisions supersede and remain reversible.

### 5.9 `hoi-session-capture`

Purpose: prevent loss of confirmed decisions while avoiding silent memory creation.

Changes:

- Classify candidates as decision, preference, commitment, correction, lesson, or wiki-change proposal.
- Exclude assistant suggestions, unresolved options, hidden reasoning, and unconfirmed summaries.
- Group duplicates and show which existing claim would be superseded.
- Ask for one review batch while preserving per-item acceptance/rejection.
- Route product engineering decisions to a durable ADR when operating in the product repository; route private operating knowledge to HOI memory/wiki.

### 5.10 `hoi-consolidate`

Purpose: maintain current knowledge without destructive merging.

Changes:

- Report duplicate, overlapping, conflicting, stale, future-effective, and superseded claims separately.
- Propose reversible actions: keep both, supersede, link as alias, reject, or request more evidence.
- Never auto-merge entities or facts based on embedding/name similarity alone.
- Track repeated human reversals; after a configured threshold, disable the relevant automatic suggestion rule and surface it for review.
- Record rationale and before/after claim IDs for every accepted consolidation.

### 5.11 `hoi-wiki`

Purpose: produce reviewed current views without hiding history or conflict.

Changes:

- Preflight schema 2 before retrieval/drafting and route schema 1 to the safe upgrade workflow.
- Include an `as_of` time, evidence cutoff, review state, and superseded-page link in every page.
- Require sections or structured fields for contested claims and unknown dates when relevant.
- Derive page claims from `hoi-retrieve` evidence groups; never treat a prior wiki page as sole proof of itself.
- Surface pages whose evidence is stale, restricted, superseded, or contradicted.
- Keep one canonical current page per scope/type only after review; preserve prior versions.

### 5.12 `hoi-build-capability`

Purpose: build bounded workflows, not general autonomous agents.

Changes:

- Add a capability contract: trigger, inputs, source domains, tools, transformations, decisions, output, autonomy, approvals, timeout/budget, failure behavior, and KPI.
- Default to the lowest autonomy level that solves the task.
- Require labeled evaluation cases before activation and regression runs after version changes.
- Add explicit maximum context, source count, retries, runtime, and output size.
- Keep arbitrary shell and external-write steps unsupported.
- Reject capabilities that duplicate an existing skill without a distinct trigger/output.

### 5.13 `hoi-connect`

Purpose: make connection status fresh, account-scoped, and least-privileged.

Changes:

- Record provider, opaque account fingerprint, host, scopes/capabilities, successful minimal-read timestamp, expiry/refresh expectation, and last failure code.
- Distinguish `available-now`, `stale-attestation`, `export-only`, `unavailable`, and `permission-insufficient`.
- Verify only the minimum authorized read; never broaden scope to “test” a connection.
- Keep tokens and raw credential responses out of HOI storage.
- Require stable provider/account/object keys for imported exports.
- Treat optional read-only MCP as a future adapter over the same attestation and policy contract.

### 5.14 `hoi-organize`

Purpose: make working-copy organization predictable and reversible.

Changes:

- Add a dry-run manifest with source, destination, conflict policy, reason, and checksum.
- Detect collisions, case-only conflicts, path-length problems, stale plans, and insufficient space.
- Bind approval to the manifest hash and policy version.
- Write a reversal manifest for created working copies/directories.
- Preserve originals and never reorganize an import merely to satisfy a template.

### 5.15 `hoi-3d-map`

Purpose: visualize reviewed knowledge without implying that graph appearance equals truth.

Changes:

- Add visible layers for asserted claims, derived claims, conflicts, unknown dates, stale evidence, failed imports, and review items.
- Keep the accessible list as a first-class view and make it the fallback for large graphs/WebGL limits.
- Add provenance and review-state drill-down for every node/edge.
- Add graph-size thresholds and sampled/filtered modes rather than attempting to render the full workspace.
- Never create decorative edges or infer chronology.

## 6. Core changes required to support the skills

Skills cannot implement these guarantees through prose alone. Add the following minimal core primitives.

### 6.1 Health and release facts

- `release-manifest.json` generated from package version, schema constant, catalog, tests, supported runtimes, and release assets.
- `health --json` with privacy-safe aggregates and drill-down tokens.
- Generated private `workspace-health.md` or equivalent app view; never commit it to the public product repository.
- CI drift tests covering documentation claims.

### 6.2 Ingestion batches and review queue

New or extended records:

- `import_plans`: immutable plan hash, selection, estimates, limits, warnings.
- `import_batches`: plan, start/end, status, counts, database delta, fuse reason.
- `import_items`: source/path fingerprint, outcome, normalized reason, retryability.
- `review_items`: type, object, reason, priority, status, owner, rationale, resolution and reversal link.

All schema changes must have a backup-first migration and restore test. No change is applied to the active private workspace until a copied-workspace rehearsal passes.

### 6.3 Reviewed temporal claims

Add only after ingestion and pilot stabilization:

- `knowledge_claims`: subject/type/value, scope, valid time, recorded time, asserted/derived, confidence, review state, supersedes, source provenance.
- `claim_decisions`: append-only reviewer action, actor label, rationale, before/after IDs, timestamp.
- Entity merge remains explicit, reviewable, and reversible.
- Derived claims never replace asserted claims and remain disabled by default.

This is not a general ontology engine. Start with a small reviewed vocabulary for decisions, commitments, preferences, statuses, ownership, and relationships used by meeting preparation.

### 6.4 Optional retrieval adapters

- Define a retrieval interface around the current FTS5 implementation.
- Add feature-flagged local vector and graph reranking only after baseline evaluation.
- Store retrieval strategy/version in evaluation and execution records.
- Do not migrate the primary database merely to add semantic search.

## 7. Implementation work packages

### WP0 — Protect and baseline

Dependencies: none.

Gate: must complete before changes that touch schema or private data.

Deliverables:

- Freeze current public tag and record product/workspace versions.
- Create and independently checksum-verify a new private backup.
- Record free-space and migration capacity requirements.
- Clone or snapshot the private workspace for rehearsal.
- Capture current health aggregates and current test/CI baseline.
- Create product `docs/decisions/` and the first decision record describing this program and its non-goals.

Exit criteria:

- Restore from the rehearsal backup succeeds.
- Current source/revision/passage/original counts are recorded.
- Active workspace remains untouched.

### WP1 — Skill contract and release-truth foundation

Dependencies: WP0 for current facts.

Suggested release: `v0.1.0-alpha.3` candidate.

Deliverables:

- Shared self-contained skill contract generated into all operational packages.
- Rewritten descriptions with discriminating triggers and overlap boundaries.
- Preflight/stop/completion sections across all 15 skills.
- Generated release manifest and documentation drift tests.
- Catalog and mirror generator updated.
- Optional `agents/openai.yaml` generated for Codex-facing UI metadata without changing default invocation policy.

Exit criteria:

- All canonical skills pass the skill validator.
- Every referenced command exists in the CLI registry.
- Every referenced file/resource is packaged.
- `.agents` and `.claude` mirrors are exact documented transforms.
- README, validation, operations, CLI, release notes, schema and skill counts agree.

### WP2 — Safe ingestion and operational health

Dependencies: WP0–WP1.

Suggested release: `v0.1.0-alpha.3`.

Deliverables:

- `ingest-plan`, import batches, normalized outcomes and fuses.
- Review queue and health command/app view.
- Updated `hoi-onboard`, `hoi-ingest`, `hoi-audit`, `hoi-organize`, and `hoi-install`.
- Copied-workspace schema migration and recovery rehearsal.
- Large-workspace tests that use synthetic sparse fixtures, not private data in the repository.

Exit criteria:

- A broad directory cannot ingest without a reviewed bounded plan.
- Fuse tests stop safely without losing preserved originals.
- Failed/unsupported items are countable, drillable and selectively retryable.
- Database growth is reported per batch.
- Migration rehearsal preserves counts, integrity, retrieval, adapters and rollback.

### WP3 — Retrieval, evaluation and meeting quality

Dependencies: WP2 health and stable corpus selection.

Suggested release: `v0.1.0-alpha.4`.

Deliverables:

- Query contract and grouped conflict-aware retrieval.
- Versioned evaluation sets and baseline comparison.
- Claim-support table and freshness snapshot in meeting briefs.
- Updated `hoi-retrieve`, `hoi-evaluate`, `hoi-meeting-prep`, and `hoi-build-capability`.

Exit criteria:

- At least 30 bilingual pilot cases cover current, outdated, missing, restricted, ambiguous and conflicting evidence.
- Recall@5 is at least 90% on the frozen real corpus.
- Forbidden-source leakage is zero.
- Expected abstention and conflict surfacing are measured.
- Five reviewed meeting briefs reach at least 95% supported factual claims with zero invented commitments/deadlines.

### WP4 — Temporal decisions and current-view knowledge

Dependencies: WP3 real evidence baseline.

Suggested release: `v0.2.0-alpha.1` because this changes the knowledge contract.

Deliverables:

- Reviewed temporal claims and append-only claim decisions.
- Product ADR index with status/supersession.
- Updated `hoi-capture`, `hoi-session-capture`, `hoi-consolidate`, `hoi-wiki`, and `hoi-3d-map`.
- Reversible conflict and consolidation actions.

Exit criteria:

- A corrected claim preserves the old claim and both timelines.
- Current and as-of retrieval choose the right claim.
- Unknown dates stay unknown.
- Derived claims are visibly separate and cannot override asserted facts.
- Every merge/consolidation/review can be reversed and audited.

### WP5 — Connections and optional read-only MCP experiment

Dependencies: WP3 policy and evaluation framework.

Release: optional after the real pilot; not required for `0.2.0-alpha.1`.

Deliverables:

- Fresh, account-scoped connection attestations.
- Failure/expiry behavior and connection health.
- A thin optional MCP server exposing only policy-filtered read operations such as context, retrieve, source metadata and review-queue counts.

Exit criteria:

- MCP and native CLI return equivalent authorized results.
- Direct SQL, filesystem traversal, credential access and writes are impossible through MCP.
- Workspace and source scopes are tested.
- Stale authentication produces a visible failure, never cached content labeled current.

### WP6 — Pilot, release and maintenance loop

Dependencies: WP2–WP4 as selected for the release.

Deliverables:

- Ten-working-day real pilot.
- Fresh Codex and Claude sessions on macOS; Windows fresh-session acceptance where claimed.
- Public release packages and checksums.
- A recurring monthly maintenance checklist: dependency/security review, backup restore spot-check, documentation drift, corpus regression, and review-queue aging.

Exit criteria:

- All declared release claims have linked evidence.
- Two independent successful pilot/client installations before stable status.
- No critical unresolved data-loss, authorization, wrong-answer or migration findings.
- The maintenance review has an owner, frequency and recorded first completion.

## 8. Test strategy

### Static package tests

- Valid frontmatter and folder/name identity.
- Descriptions are discriminating and do not overlap without routing guidance.
- No stale version/schema/count claims in skill text.
- All commands, flags and references resolve.
- Distribution packages contain every required resource and no private paths/data.
- Canonical, Codex and Claude packages match documented transformations.

### Behavioral skill fixtures

Each skill gets at least one happy-path and one boundary-path fixture. Priority adversarial cases:

- Onboarding offered a home directory or repository root.
- Ingestion containing prompt injection, symlinks, credentials, archive bombs, duplicates, unsupported formats, parser timeouts and disk pressure.
- Retrieval with conflicting, superseded, restricted, undated and missing evidence.
- Meeting prep with ambiguous participants, stale calendar attestation, wrong timezone and unsupported commitments.
- Capture containing assistant suggestions presented as user decisions.
- Wiki relying on another wiki page without original evidence.
- Consolidation proposing an unsafe entity merge.
- Connection registry claiming availability after an expired/failed read.
- Organization plan changed after approval.
- Map attempting to render an excessive graph or decorative relationship.

### Core integration and recovery tests

- Schema migration from every supported version.
- Killed plan/import/migration/review operations.
- Backup corruption and insufficient free space.
- Batch resume without duplicate originals or passages.
- Fuse activation and selective retry.
- Reversal of consolidation and claim decisions.
- Permission filtering before lexical/vector/graph retrieval.

### Real-pilot tests

- Frozen corpus and checksums.
- Human-reviewed bilingual labels.
- Real meeting records and correction notes.
- Both runtime adapters in fresh sessions.
- Manual time baseline and assisted time including corrections.
- No private records committed to the product repository.

## 9. Delivery controls

- One work package per reviewed pull request series; avoid a single repository-wide rewrite.
- No direct work on the active private database.
- Schema work always includes migration, backup, restore and rollback evidence.
- Every behavior change updates the owning skill, CLI docs, tests and release manifest together.
- Do not increment skill count to signal progress; improve completion evidence and real outcomes.
- Keep new features disabled until their tests and migration path pass.
- Preserve old public tags and release artifacts.
- Use a new prerelease for corrections; never move a published tag.

## 10. Definition of done for an improved skill

A skill is improved only when all of the following are true:

- Its description routes the intended requests and excludes the nearest wrong route.
- The body is concise and self-contained, with conditional detail moved to packaged references only when needed.
- Preconditions and stop conditions are explicit.
- It requests no authority beyond the user's task.
- It uses deterministic core behavior for enforceable safety properties.
- It reports partial success and unresolved gaps.
- It defines observable completion evidence.
- It passes static packaging, behavioral, adversarial and cross-host mirror checks.
- At least one realistic fixture demonstrates the intended behavior.
- For priority workflows, a real reviewed use is recorded before stable-release claims.

## 11. Success measures

The program succeeds when it moves measurable outcomes rather than adding surface area:

| Outcome                                                  |                      Target |
| -------------------------------------------------------- | --------------------------: |
| Accidental unbounded imports                             |                           0 |
| Imported originals lost during failure/migration         |                           0 |
| Failed/unsupported revision outcomes without reason code |                           0 |
| Documentation fact conflicts in CI                       |                           0 |
| Forbidden-source leakage in pilot                        |                           0 |
| Real retrieval recall@5                                  |                        ≥90% |
| Supported factual claims in reviewed briefs              |                        ≥95% |
| Invented commitments/deadlines                           |                           0 |
| Fresh Codex/Claude priority-workflow passes              |    100% of claimed surfaces |
| Reversible reviewed knowledge changes                    |                        100% |
| Median meeting-preparation time improvement              | ≥50%, including corrections |

## 12. Recommended first implementation slice

Start with WP0 and the smallest part of WP1/WP2:

1. Create and verify a new private backup; rehearse restore on a copy.
2. Add a generated release manifest and drift tests.
3. Add read-only `ingest-plan` with file/byte/type/exclusion/duplicate/space estimates.
4. Rewrite `hoi-onboard`, `hoi-ingest`, and `hoi-audit` around the plan and health output.
5. Add boundary fixtures for broad folders, credentials, size limits and failure reporting.
6. Validate both generated mirrors and package an alpha.3 candidate.

This slice directly addresses the current large-workspace risk and produces value before any temporal claim model, semantic search, MCP adapter, or visual expansion.

## 13. Decision required before implementation

The plan assumes the first release target is **stabilization (`v0.1.0-alpha.3`)**, containing WP0–WP2 only. Temporal claims and optional semantic/MCP work remain later releases. Implementation should not begin on WP4 or WP5 until the bounded real pilot has a baseline.

---

Prioritization was informed by the constraint-first and smallest-useful-artifact principles of The Three Ms of AI™. Adapted from The Three Ms of AI™ © 2026 Nate Herk. All rights reserved.
