# Validation — updated September 18, 2026

Release status: **0.1.0-alpha.2 — implemented, locally verified, not a stable client release.**

## Downloadable release packages

The alpha.2 distribution adds `hoi-install`, a self-contained chat guide, a 12-skill collection and checksums. Thirteen skill folders pass format validation. Packaging tests verify reproducible bytes, complete resources, extraction, mirrors, and repair of interrupted adapter installation. Local command paths and chat-only limitations were reviewed; this is not a claim of completed fresh-session testing in all four assistant interfaces.

The GitHub workflows gate prerelease publication on the macOS/Windows/Linux × Node 22/24 matrix and Chromium checks. Read the actual workflow results for remote verification. Public release packaging does not close real-client acceptance gates.

## Stabilization verification — September 18

- Full verification: **37 Node tests passed**, production build passed, runtime mirrors matched, formatting passed.
- **Four automated Chromium checks passed**: all views and source evidence, keyboard/narrow-screen access, unavailable WebGL, actual reduced-motion preference, 3D rendering, expired sessions, and unavailable-server handling.
- Map benchmark on Apple M5, macOS, Node 22: **235 ms** to the list and **1,278 ms** from requesting 3D to a visible canvas and responsive pause control, with 1,001 synthetic document records. This is a local smoke benchmark, not a cross-machine service guarantee or proof that every graph layout has settled.
- Launcher successfully serves the selected workspace and returns actionable errors for missing arguments, missing workspace, and occupied port without stopping the other server.
- Fault tests cover empty-workspace restoration, externally corrupted originals, killed imports, disk-full atomic writes, incomplete backups, killed restore directory swaps, active/uncertain lock refusal, relocation, adapter reinstallation, reindexing and rollback.
- A real private HOI workspace copy was restored, its two original revisions checksum-verified, both adapters reinstalled, index rebuilt, and a same-release manual change rolled back. The live workspace's knowledge was not replaced. This does not validate a future schema migration or switching between released product versions.
- Fresh verified backup created privately before the rehearsal. Diagnostic exports use an explicit allowlist of aggregate fields.
- Pilot import and bilingual-label evaluation tools pass synthetic end-to-end tests. Actual project selection, 30 human-labeled questions, five real meeting reviews, fresh interactive host sessions and ten working days remain **pending**.
- Browser CI is configured but has not run on GitHub. Playwright is a development dependency only.

## Initial alpha verification — September 17

- Clean `npm ci` installation from the lockfile on macOS with Node 22.14.0.
- `npm run check`: **24 tests passed**, TypeScript build passed, production map build passed, and canonical Claude/Codex skill mirrors matched.
- `npm run format:check`: passed. All 12 canonical skills passed the skill-format validator.
- `npm audit`: zero reported vulnerabilities at verification time. This does not imply absence of unknown vulnerabilities.
- Synthetic retrieval fixture: **1,000 documents, 60 labeled questions, 60/60 expected sources in the top five results**. This is a controlled mechanics benchmark, not production retrieval accuracy.
- Source identity, immutable revisions, retained duplicate occurrences, moved files, unsupported-format preservation, Office extraction locations, PDF page references and typed CSV aggregates.
- Host/source policy filtering, entity restrictions, explicit memory review, stale-memory exclusion, supersession, bounded context and exclusion of unrelated client memory.
- Exact-action approval binding and single use; workflow resume; changed context/input/policy/source rejection; interrupted extraction recovery; unanswerable-query gaps; imported instructions leave policy unchanged.
- Host export normalization with account isolation and unchanged-revision preservation on a fresh availability check.
- Read-only map API authorization, foreign-origin rejection, mutation rejection, exact source/passage retrieval, and refusing restore while the map is active.
- Backup/restore into another directory, checksum-corruption detection, traversal rejection, and retention of the prior workspace.
- Fresh setup installs both runtime packages and preserves unrelated manual text on rerun.
- Browser: 3D rendering, client filtering including the associated project, record selection, supporting-passage inspection, effective-date filtering, exclusion of unknown dates, search, and accessible list navigation. At 390px viewport width, document width was 390px with no horizontal overflow. No browser error/warning logs were reported during the final checks.
- HOI brand checker: clean on combined map styles and markup. Brand fonts are bundled locally under their original family names; no remote font service is required.

The initial HOI private workspace was installed separately with two sources: the strategic brief (draft) and current brand rules (approved). Retrieval and database integrity checks passed. A checksum-manifested initial backup was created outside the product checkout. Existing Personal Workspace data and service were not changed.

## Pending release gates

- Clean-machine Windows and Linux execution. CI is configured for macOS/Windows/Linux × Node 22/24, but has not run on GitHub.
- Fresh interactive sessions in actual Claude Code and Codex installations; installed skill files and shared CLI were verified, not the complete host experiences.
- Live Gmail/Calendar/Drive/GitHub connection checks in each client's host. Normalized export mechanics were tested with fixtures; no client OAuth credentials are bundled.
- A representative real 500–1,000-document evaluation with ≥90% retrieval recall@5 and ≥95% human-reviewed factual support.
- Ten real meeting briefs and a measured ≥50% median time saving, plus at least two independent client pilots.
- Real OCR accuracy. Tesseract is absent from this machine's PATH; the availability diagnostic correctly reports that. PDF text extraction is verified separately.
- Broader browser and assistive-technology coverage. Chromium reduced-motion emulation, keyboard access and a 375px viewport now pass; real screen-reader and other-browser checks remain pending.
- Publication destination, visibility and product distribution license. A standalone local Git repository exists; no remote repository, push or release tag has been created.

## Practical limits

- Meeting preparation produces an evidence brief; final natural-language reasoning occurs in the active assistant. Quote validation is not semantic entailment verification.
- Capabilities currently compose context, retrieval and meeting drafting. Arbitrary tool execution and autonomous scheduling remain out of scope.
- CSV aggregates require consistently typed numeric cells and do not infer units. XLSX extraction exposes cell evidence but does not implement a spreadsheet calculation engine.
- Temporal views filter effective dates, not complete historical workspace snapshots.
- The lazy 3D bundle is approximately 1.41 MB before compression and triggers Vite's chunk-size advisory. The main interface is approximately 200 kB; the list works without WebGL.
- Node's built-in SQLite lacked FTS5 on the test machine, so the product uses better-sqlite3. Its prebuilt binary installer reports an upstream deprecation notice, despite zero current npm advisories.
- HOI cannot prevent an unrestricted host shell from editing the private workspace or bypassing its commands. Runtime permissions remain a separate boundary.
