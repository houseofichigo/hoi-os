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
