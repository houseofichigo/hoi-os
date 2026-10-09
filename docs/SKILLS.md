<<<<<<< HEAD
# Skill roles and compatibility

The generated [catalogue](../skills/catalog.json) is authoritative for counts,
package version, engine API, required operations and optional connections.
Current skill packages are unreleased; the base version is not a new release.
Synthetic package and setup checks are separate from fresh Codex/Claude sessions.
The verified workspace schema describes the test baseline, not a promise that
all operations work on an older schema. Check operation availability and upgrade
requirements before use; never migrate private data just to load a skill.

| Need                             | Skill                | Boundary                                                               |
| -------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| Existing product installation    | hoi-install          | Never creates a replacement app                                        |
| Progressive assistant onboarding | hoi-onboard          | App-only setup works without it                                        |
| One specified memory             | hoi-capture          | Proposed memory, explicit review                                       |
| End-of-session decisions         | hoi-session-capture  | Confirmed session content; avoid duplicate captures                    |
| Canonical wiki editing           | hoi-wiki-author      | Section evidence; save and compare drafts                              |
| Legacy wiki revisions            | hoi-wiki             | Retained page-level evidence workflow                                  |
| Operational health               | hoi-audit            | Read-only health; source scans explicitly persist findings             |
| Knowledge freshness              | hoi-knowledge-review | Mechanical findings and cited proposals; no semantic certainty         |
| Security configuration           | hoi-security         | Scoped pass/fail/not-tested; no certification                          |
| Project brief                    | hoi-project-intake   | Exact required fields; external Action is not automatically configured |
| Standalone or project tasks      | hoi-task-intake      | Evidence, duplicate review and approval                                |

Other catalogue entries cover retrieval, ingestion, organization, meeting briefs,
Chief of Staff views, maps, connections, evaluation and constrained capabilities.
All retain their canonical IDs. Instructions cannot grant permissions, approve
their own actions or make a connector available.

## Maintenance

Edit product `skills/`, then run `npm run skills:sync`. This generates the full
Claude/Codex mirrors, catalogue, compatibility facts and README catalogue. Use
`node scripts/sync-skills.mjs --check` to detect drift. Preserve all supporting
files. Workspace adapter updates remain a separate reviewed action; regeneration
of product mirrors does not change installed private adapters.

HOI-authored updates must also enter the canonical company skills collection,
with before/after checksums and provenance. That company archive is outside this
public product. Do not bundle private workspace overrides or third-party imports
as HOI-authored material. No global skill installation is part of this workflow.
=======
# Skill catalogue

| Skill | Purpose |
| --- | --- |
| [hoi-3d-map](../skills/hoi-3d-map/SKILL.md) | Use when requested to open the local HOI Workspace App or its optional 3D knowledge map to inspect source-backed search, wiki, memory, entities, relationships, and temporal views. |
| [hoi-audit](../skills/hoi-audit/SKILL.md) | Use when requested to inspect an HOI OS workspace for schema, database, extraction, backup, adapter, connection, workflow, and memory health without changing it. |
| [hoi-build-capability](../skills/hoi-build-capability/SKILL.md) | Use when requested to define, evaluate, and activate a bounded HOI workflow using registered tools. |
| [hoi-capture](../skills/hoi-capture/SKILL.md) | Use when requested to record user-supplied decisions, preferences, or experience as reviewable HOI memory. |
| [hoi-chief-of-staff](../skills/hoi-chief-of-staff/SKILL.md) | Use when requested to prepare a daily HOI work brief, review promises and waiting-for tasks, prepare an exact meeting instance, and suggest local preparation time from confirmed calendar exports. |
| [hoi-connect](../skills/hoi-connect/SKILL.md) | Use when requested to check available Gmail, Calendar, Drive, or GitHub host tools for a selected HOI workspace. |
| [hoi-consolidate](../skills/hoi-consolidate/SKILL.md) | Use when requested to find duplicate, stale, and proposed HOI memories for review. |
| [hoi-evaluate](../skills/hoi-evaluate/SKILL.md) | Use when requested to run reproducible evidence retrieval checks for a HOI capability. |
| [hoi-ingest](../skills/hoi-ingest/SKILL.md) | Use when requested to plan and ingest selected local files or authorized host exports into HOI OS with bounded scope, preserved originals, provenance, and visible failures. |
| [hoi-install](../skills/hoi-install/SKILL.md) | Use when requested to locate, install or verify the existing HOI OS product and optional workspace adapters, or guide chat-only users through a documented local installation. Does not generate an app. |
| [hoi-knowledge-review](../skills/hoi-knowledge-review/SKILL.md) | Use when requested to audit HOI wiki and memory for stale evidence, recorded contradictions, duplicates, superseded information and expired memory; prepare cited replacements and review findings without deleting originals. |
| [hoi-meeting-prep](../skills/hoi-meeting-prep/SKILL.md) | Use when requested to prepare a cited client meeting brief using HOI knowledge and available read-only host connections. |
| [hoi-onboard](../skills/hoi-onboard/SKILL.md) | Use when requested to onboard a user into HOI OS, capture their operating context, select a bounded source scope, and reach a first useful result without uncontrolled ingestion. |
| [hoi-organize](../skills/hoi-organize/SKILL.md) | Use when requested to propose and apply an exact, approval-bound organization of HOI OS working copies while preserving every original. |
| [hoi-project-intake](../skills/hoi-project-intake/SKILL.md) | Extract a complete project brief from a transcript or user input, clarify missing fields, and validate the exact 17-field project Action contract before an explicitly requested submission. Individual tasks use HOI task proposals separately. |
| [hoi-retrieve](../skills/hoi-retrieve/SKILL.md) | Use when requested to find source-backed information and bounded context in HOI OS. |
| [hoi-security](../skills/hoi-security/SKILL.md) | Review HOI OS security configuration and recorded test coverage, including source access, exact approvals, connection scopes, credentials and recovery. Use for a requested security check of a selected local workspace. |
| [hoi-session-capture](../skills/hoi-session-capture/SKILL.md) | Use when requested to propose reviewable HOI memories and wiki updates from decisions made in the current working session. |
| [hoi-task-intake](../skills/hoi-task-intake/SKILL.md) | Use when requested to extract evidence-backed to-do proposals from selected transcripts, briefs, Gmail messages or Calendar context; check existing commitments and route ambiguous duplicates to review without approving tasks or changing calendars. |
| [hoi-wiki](../skills/hoi-wiki/SKILL.md) | Use when requested to build and maintain cited, reviewable current-view wiki pages from HOI OS evidence without replacing original sources or history. |
| [hoi-wiki-author](../skills/hoi-wiki-author/SKILL.md) | Use when requested to create or revise cited HOI wiki drafts for clients, projects, people, offerings, topics and decisions; resolve existing pages first and preserve evidence, attribution and revision history. |
>>>>>>> 66fcc668b3a4e0085bdc3eb3d23209fadb2ba052
