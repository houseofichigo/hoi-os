# Community preparation — Batch 2

Completed locally; GitHub publication remains last.

- Reformatted the source, UI, tests, scripts and documentation with the existing formatter.
- Retained all 21 canonical skill IDs; clarified legacy wiki, canonical authoring,
  one-memory capture, session capture and audit/security boundaries.
- Added explicit MIT declarations and Codex display metadata; corrected desktop
  runtime guidance. Instructions do not claim fresh assistant-session verification.
- Regenerated complete runtime mirrors, catalogue and compatibility facts.
- Ingested all current skill packages into the company collection, preserving
  previous versions and per-file checksums outside the public product.
- Corrected current schema references and optional-assistant setup documentation.
  Historical download links remain explicitly historical.
- Added contribution, security-reporting, conduct and changelog documentation,
  plus a privacy-conscious bug template and local CI gate definitions.

The package base version remains unchanged until the candidate is frozen for a
new prerelease. No release URL or installer verification is invented. Resumable
app onboarding is Batch 3; live providers, clean installation and pilot gates
remain open. Static skill checks and generated mirrors do not prove host runtime
behavior. Private adapters and workspaces were not migrated or overwritten.

## Local verification

- `npm run check`: 208 core tests passed; includes reproducible package generation,
  complete resource mirrors and operation-contract checks.
- `npm run format:check` and `git diff --check`: passed.
- Static Skill Repo Forge inspection: 21 packages, zero blockers, warnings or notes.
  This is heuristic inspection, not proof of live assistant behavior.
- Canonical company collection: all 51 current skill files match ingestion checksums.
- Publication preparation: 411 allowlisted files; 148 reachable history blobs scanned,
  no configured pattern findings or unclassified paths. No staging or publication.

Browser and Electron suites were not rerun for this instruction/documentation and
formatting batch. Earlier build-specific security evidence must not be represented
as fresh evidence for changed files. Live host and platform gates remain open.
