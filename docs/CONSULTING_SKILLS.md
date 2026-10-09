# Consulting, focused chat and Skills — local alpha

This unreleased update uses schema 14. GitHub publication and private workspace migration are separate steps.

## Delivery projects

Home now has Overview, Today, Trainings and Consulting. Project Delivery types are independent, editable Training/Consulting flags. Both may be selected; unclassified projects remain unchanged. Training views also retain projects with existing delivery sessions. Mixed projects use one identity and one set of accepted tasks. Session times remain separate from project deadlines; projects without sessions say so. Active work is the default, with completed/cancelled filters.

## Reviewed workspace skills

Skills follows Chat in navigation. Bundled instructions are immutable; an edit creates a workspace override. Workspace drafts require explicit activation of their exact revision/checksum. The revision selector supports inspecting and restoring earlier versions; compare shows active and selected Markdown side by side. Disabling prevents new handoffs but preserves history.

Import accepts SKILL.md or a single skill-folder ZIP, limited to 512 KiB compressed and expanded, 64 files. Preview precedes commitment. Originals and checksums are archived in the private workspace; supporting files are retained, safely previewed, never executed. Unsafe paths, symlinks, reserved filenames and case collisions are rejected. Duplicate names require opening the existing skill and supplying its current record version.

Adapter synchronization is a separate preview/confirm action. It requires the optional adapter already installed, takes a verified backup, and refuses changed targets or customized-file conflicts. Workspace-only skills use a hoi-user- prefix in adapters; bundled overrides keep the bundled directory. Previously managed supporting files removed by an update are removed only if unchanged. Disabling in HOI does not uninstall an existing assistant copy.

Private edits and third-party imports are not automatically copied into the company's canonical skill collection. No new HOI operational skill is authored by this update.

## Chat

The empty conversation has a centered title, broad multiline composer and quick starters. Active conversations retain transcript, handoff panel and turn-specific Evidence. Add context selects up to ten active permitted documents and pins their current revisions; at most five passages per document are supplied, subject to the existing context budget. Upload opens reviewed Knowledge Hub intake.

One active compatible skill may be selected. Its exact revision, checksum and instructions are pinned to the turn. The UI states “Skill instructions supplied”; activation adds no tool, permission or automatic execution. Updates do not rewrite earlier conversations. Historical document permissions are rechecked. Changing project or assistant starts a fresh conversation.

## Shared interfaces and recovery

Registry/CLI family: skills list/get/preview/commit/draft/control/sync-preview/sync. Mutation input is supplied through the existing --input JSON-file convention. Authenticated app endpoints use the same core functions. Schema-13 migration is additive and backups include originals, revision records and activation history.

Synthetic regression coverage includes mixed delivery, stale edits, activation/rollback, malformed packages, revoked document access, pinned handoffs, adapter conflicts and migration/restore. Browser checks exercise the new workflow and 390/768/1280/1440 layouts. Clean Windows installation, actual assistant execution and the real-data pilot remain separate gates. Chat still requires explicit copy/validate handoff; no model provider or voice capability was added.

## Verified on 27 September 2026

180 core tests, 28 browser tests and 2 Electron tests passed on macOS arm64. The shared build identity is `5e208b255a563c75736a50c4a72dae7671805e98750aed258be28e69e2d1c649`. [Build-specific evidence](verification/consulting-skills-2026-09-27.json) records suite versions and times. Migration/restore used isolated synthetic workspaces; no private upgrade was performed.

A fresh fictional demo is running locally with mixed delivery projects, an unscheduled training project and a reviewed example workspace skill. These samples are not imported company records.

## Chat uploads and intake skills — 27 September 2026

Add context now accepts local transcripts, briefs and documents without leaving Chat. Review attachments computes a checksum manifest before import; Import and attach reviewed files uses the authenticated Knowledge Hub upload endpoint. New sources are preserved and indexed there. Only readable active sources in the selected project scope are attached. Failed jobs can be retried using the same reviewed manifest; extraction gaps stay preserved and visible. Up to ten document references per request and 50 MB per file remain enforced. Changing scope/unmounting stops further files and prevents late results from attaching to the wrong conversation; a file already being imported may finish in Knowledge Hub.

Choose Project brief (hoi-project-intake) or To-do proposal (hoi-task-intake) in the Skill selector. Both can use selected transcripts, briefs, email and calendar evidence. The task skill uses existing proposal contracts and duplicate review, not the project's 17 required fields. Tasks need an existing project; unknown owners/deadlines remain unknown. Chat currently supports one task proposal per assistant response. Email/calendar evidence retains source-specific interpretation rules; these skills do not add connections or external write actions.

Uploading does not invoke a model. The existing prepare/copy/validate handoff remains. Audio/video transcription is not configured. Project Action integration is still separate; the project skill alone does not create a local or external project.

Chat upload verification: 182 core, 29 browser and 2 Electron tests passed on macOS arm64. See [build-specific evidence](verification/chat-upload-2026-09-27.json). The new browser scenario confirms that reviewing a manifest alone creates no source and that imported transcript evidence is pinned to the chosen task-skill handoff. No private migration, external Action call or publication was performed.

## Home and project charts — 27 September 2026

Home now includes a portfolio summary with project-status and delivery-mix bars, plus expandable accepted-task completion. Projects uses the same charts scoped to the current filters, with record links and a completion ring in the project detail panel. Mixed training/consulting projects occupy one delivery category. No accepted tasks means “Not measured”; cancelled tasks are excluded from completion. These views use existing permission-filtered records, not invented trends or estimates of effort.

HOI Cobalt, Learn teal, Build green and Lead magenta distinguish chart series; warning and danger colours retain their status meaning. Direct labels and counts accompany colour. A single restrained bar reveal respects reduced motion. The motion direction was informed by [Didier Girard's code-generated motion-design example](https://fr.linkedin.com/posts/didiergirard_opus-55-15-secondes-de-motion-design-activity-7509265816480165889-LEBb); no external animation code was copied.

Verification: 182 core, 30 browser and 2 Electron tests passed on macOS arm64. The browser regression covers filtered counts, exact project navigation, empty completion denominators, reduced motion and widths of 390, 768, 1280 and 1440 pixels. See [build-specific evidence](verification/work-charts-2026-09-27.json). Charts were demonstrated using the fictional workspace; real-data pilot and other-platform verification remain separate. No private migration or GitHub update occurred.
