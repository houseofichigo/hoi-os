# Executive workspace upgrade

Approved scope: decision-first Home, conversation-first chat with Claude/Codex handoff, visible evidence, consistent Knowledge Hub and record navigation. Existing policy and approval boundaries remain. GitHub publication stays last.

## Batch 1 — reliability and shell

Implemented: authenticated-session recovery, unavailable-engine recovery, failed-view containment, workspace identity, explicit fictional-demo identification, compact sidebar, narrow-screen menu, skip link, focus styles and shared header/status/empty-state components. Optional supporting-data failure produces a retry notice rather than crashing Home. Background refresh preserves open knowledge-review state.

Top-level views and Home, Knowledge Hub, project and Configuration subviews now persist in query parameters. Legacy record links remain valid. Project/client/training record selection persists in the URL and reopens after refresh; Back/Forward restores the selection. Fragment skip links are not interpreted as authentication credentials.

Workspace API additions are backward-compatible: `displayName` is the selected directory basename (no absolute path); `environment` is `demo` only when explicitly declared in private workspace metadata, otherwise `private`. Existing workspace metadata does not require migration.

## Batch 2 — executive Home

Implemented: four compact indicators, a deterministic attention queue with reasons, meetings, delivery outlook, collapsed empty secondary sections and detailed source coverage behind disclosures. The dashboard API adds an `executive` read model with indicators, ordered queue and timezone-aware agenda. It uses permitted existing records; no invented trend, AI summary, score or automatic action.

Attention ordering is overdue, blocked, synchronization failure, then pending task approvals. Overlapping attention entries are deduplicated by record kind and identity. Completed/cancelled work is excluded by the existing engine filters. “Needs decision” currently counts proposed tasks; it does not pretend to count unrecorded commitments or all knowledge-review findings. Meeting coverage is explicit even when its recorded count is zero.

## Batch 3 — conversations and evidence

Schema 13 adds conversations and ordered run links. Migration creates one legacy conversation per existing run; it does not infer missing chains. The core, shared registry, CLI and authenticated API expose create/list/detail/update/append and evidence reads. Updates and append operations check record versions. Project scope is optional for document search; a task proposal still requires a selected project.

Chat now has conversation search, rename, reversible archive, a persistent transcript, bottom composer, explicit cancellation and a separate structured handoff panel. Scope/assistant changes start a new conversation. Genuine execution state is refreshed; no simulated streaming or automatic model response is shown. The selected turn's evidence distinguishes supplied documents, explicit citations, related records and assistant-supplied web references. Passage inspection and original-source downloads recheck access.

Permission, source-archive or context changes conservatively invalidate historical content. Unavailable turns redact both question and answer, and their conversation title is withheld. This deliberately favors confidentiality over historical availability: even unrelated knowledge changes can require a new conversation. It is a known limitation, not a claim of selective historical revalidation.

CLI: `hoi chat conversations`, `hoi chat conversation <id>`, `hoi chat create --input <json>`, `hoi chat update --input <json>`, `hoi chat append --input <json>` and `hoi chat evidence <run-id>`; standard workspace/host flags apply. Creating/appending uses the same validated functions as the app. Existing run commands remain available.

## Batch 4 — workspace consistency

Sources have title search and project/client/type/state/extraction filters, a readable current-passage preview, revision dates, linked-record labels and an authenticated original download. `hoi source get <id>` exposes the same source-detail read model. Archived sources retain metadata/history but do not expose active passages. Archive/restore still requires the existing impact review.

The map is a lazy shared component within Knowledge Hub; the independent map launcher remains available. The embedded map has no second branded header/footer, and retains its record list, filters and evidence actions. Wiki maintenance has moved to Reviews. Project/client/training editors use readable labels, multiline delivery fields, separate Overview/Tasks/Knowledge/History views and a side drawer. Record names are secondary links. Empty and filtered-empty portfolios are distinct. Connections show status with setup forms behind an explicit disclosure. Intake jobs show names with internal IDs under technical details.

## Batch 5 — local verification and demonstration

The synthetic executive fixture includes a blocked overdue project, a pending task approval, linked client and training records, upcoming meeting and a clearly labeled demonstration conversation. `node scripts/executive-demo.mjs <new-directory>` creates it without overwriting a workspace. User data is never used as fixture material.

Verification covers schema-12 legacy migration, earlier supported migrations, independent backup/restore, ordered conversations, workspace scope, malformed replies, stale updates, cancelled requests, archived/restricted evidence, keyboard preview focus, responsive shell, long conversations, map fallback and existing engine/browser workflows. The current test results are recorded below. Electron staging is refreshed locally; distributable installers are not rebuilt or published by this UX pass.

### Remaining limitations and acceptance gates

- Human review of contrast and screen-reader behavior across every populated workflow remains open; automated keyboard and responsive checks are not accessibility certification.
- The real-data pilot, fresh assistant sessions, live-provider verification and clean-platform packaging remain separate gates. No private schema-13 migration has occurred.
- The shared Evidence panel is used in Chat. Dashboard, wiki and maintenance evidence still use their existing contextual inspectors. Consolidating every inspector is remaining UI polish.
- Record drawers have readable multiline fields and browser-required validation; field-specific server-validation presentation and richer grouped delivery forms remain to refine.
- Selected conversation/project/client/training URLs persist. Source preview selection and selected chat turn are not yet independent deep links.
- Source lists are filtered locally. The existing 1,000-document benchmark covers the map, not an exhaustive large-library preview benchmark.
- Conversation rendering supports paragraphs/headings and preserved line breaks, not a complete Markdown implementation. Context supplied for a follow-up is bounded to its immediate completed predecessor and current retrieved records.
- Generated compatibility facts and runtime mirrors are current. Skill instruction contents did not change, so the canonical company skill originals were not replaced.

GitHub remains unchanged. Learn AI stays on its existing workspace and schema until a separately verified recovery/migration step is requested.

### Verified build — 2026-09-27

- `npm run verify:security`: **173 core tests passed**, including `npm run check`, schema-13 migration, backup/restore and generated package consistency.
- `npm run verify:security -- --browser`: **26 browser tests passed**. Includes 390/768/1280/1440 shell checks, thirty-turn transcript, malformed responses, source focus restoration, archive/restricted evidence, keyboard actions and WebGL fallback. Existing 1,000-document map fixture remains within its thresholds on the recorded Apple M5 machine.
- `npm run verify:security -- --desktop`: **2 Electron tests passed** against the matching macOS arm64/Electron 42.11.8 local stage, including app-only intake, restart, boundary checks and upgrade-on-copy recovery.
- All three results refer to the same build identity in `.verification/security.json`. No packaged installer or stable release is implied.
- One interrupted-import subprocess check failed during overlapping build/test activity, then passed in isolation and in the final non-overlapping full core run. No data-loss fix was inferred from that transient test result.

The separate fictional executive/chat demo is running locally. Its populated conversation explicitly identifies its answer as seeded demonstration content. Existing private workspaces and GitHub were not changed.
