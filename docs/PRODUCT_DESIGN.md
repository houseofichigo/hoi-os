# HOI OS product interface — local alpha

This app-specific addendum follows the approved screenshot-led design. It overrides corporate layout restrictions only inside HOI OS. Corporate documents and the installed branding skill are unchanged.

## Product rules

White and Cool Grey surfaces; Ink text; Cobalt actions; pillar colours for meaningful categories and chart series. Inter Tight interface headings and body, Fraunces for the Home welcome and empty-chat heading, JetBrains Mono for numerals. Controls use 6px corners, panels 8px, composer 12px. No gradients, glow or decorative shadows. Light theme only.

The shared product controls use Radix Dialog, Tabs and Tooltip primitives with HOI styles. Desktop navigation separates Work and Intelligence; Configuration remains last. A development component showcase is available at the authenticated app URL with `?showcase=components`. It uses fictional examples and no engine mutations.

## Delivered workflows

- Skills: responsive gallery/list, friendly names, categories, search, curated examples, explicit availability and a focus-managed detail drawer. Import preview, revisions, activation, disable and adapter review remain governed operations.
- Skills → Chat: links carry only skill identity and starter index. They prepare an unsent draft. Existing text prompts an explicit keep/replace choice. Draft state remains in tab memory during navigation, keyed by workspace session; it is not saved to browser storage and does not survive a full reload. Historical conversations remain persisted by the engine.
- Chat: compact native project/assistant/skill menus, selected-context chips, reviewed upload, explicit prepare/copy/validate handoff. No model provider, voice or simulated execution was added.
- Home: decisions and agenda precede portfolio insights. Chart labels open filtered project records. Projects has a collapsed Insights area; client galleries remain flat.
- Knowledge Hub: source list/gallery switch with file-type placeholders. No thumbnail renderer was added, and placeholder graphics are not document previews. Existing source reading and archive-impact review remain intact.
- Configuration: existing connection summaries and on-demand setup forms use the shared tabs and product styling.

Presentation metadata lives in `skills/presentation.json`, is generated into the canonical catalogue, and is exposed descriptively by skill listing. It never changes engine permissions, compatibility or execution. Imported skills fall back to text names and a fixed SVG icon; no imported markup is rendered as an icon. Skill instruction files and canonical company copies were not modified by this UI update.

## Verification and remaining gates

Use fictional workspaces for demonstrations. Core, browser and Electron evidence is recorded separately after validation. Screenshots cover 390, 768, 1280 and 1440 CSS-pixel widths. Current-session browser zoom may change available CSS width.

Clean Windows visual baselines, live connector reliability, real-data quality and the ten-day pilot remain separate acceptance gates. The map remains a large lazy-loaded dependency. No private workspace migration, external Action call or GitHub update is included.

### Local verification — 27 September 2026

The final macOS arm64 build passed 182 core tests, 33 browser tests and 2 Electron tests. Runtime mirrors and the skill catalogue match. Build-specific results are retained in [the verification record](verification/visual-workspace-2026-09-27.json). The desktop checks include isolated rendering, app-only import, bundled CLI access, restart, clean quit and explicit upgrade-copy recovery.

Browser checks include unsent skill starters, draft replacement review, chart drill-down, source gallery parity, record edit cancellation and responsive screenshots. Reviewed gallery screenshot baselines cover macOS at 390 and 1440 pixels; functional layout checks additionally cover 768 and 1280 pixels. Other-platform visual baselines remain pending. The 1,000-document map benchmark had an intermittent timeout, passed its isolated rerun, and then passed the full suite after its motion preference was made explicit; reduced motion is checked separately.

The fictional demonstration workspace is `hoi-visual-demo-2026-09-27`. It contains no imported company collection. It is separate from the user's existing workspaces.

### Skills discovery — 28 September 2026

Skills now opens Discover (bundled HOI skills) or My skills (workspace imports and
bundled overrides). Search, expandable category/availability filters and counts use
actual library records. Manage skills includes disabled records and retains editing,
comparison, activation, rollback and reviewed adapter synchronization in the detail
drawer. Previous Bundled, Workspace and Archived URLs resolve to the new views.

Gallery covers are local icon/category placeholders, not generated outputs or
third-party imagery. The compact list remains available. Use skill and example
requests open unsent Chat drafts; activation and provider execution remain separate.
The prominent Create skill action was removed. No chat builder was added and the
supplied skill-creator package was not installed.

Import accepts SKILL.md, .zip and .skill archives under the same 512 KiB / 64-file
limits and decompression/path checks. Preview now includes instructions, original
filename, checksum and compatibility. Originals, revisions and supporting files are
preserved; scripts are never executed by import or activation. No schema change or
third-party marketplace was introduced. Workspace imports do not claim a verified
publisher. Existing engine skills and their canonical copies are unchanged.

Verification for this Skills update: 221 core, 39 browser and 2 Electron checks
passed on macOS arm64. Gallery baselines at 390 and 1440px were visually reviewed;
layout checks also cover 768 and 1280px. The import browser scenario checks .skill
preview, inactive drafts and management navigation. Core checks cover malformed,
traversal, symlink, expanded-size and file-count failures. Formatting passed.
The fictional demonstration is `.local/skills-discovery-demo-2026-09-28`.
No live-provider or clean-machine verification is claimed by these checks.

### Compact shared composer — 28 September 2026

Home, Knowledge Hub and Chat share the screenshot-inspired white composer with a
16px border radius, borderless growing input, compact attachment/history/assistant/
context controls and circular Send/Cancel action. The integrated connector strip can
be hidden and restored from Context without disconnecting sources. Connection icons
use actual records and open Configuration; unavailable providers are not invented.

Assistant/model details and the manual $0.25 limit are inside Assistant. Context
contains scope, project restriction and skill selection. Radix popovers become modal
sheets on narrow screens, with Escape dismissal and focus restoration. Attachments
retain manifest review and explicit import. Empty messages disable Send, configured
requests still generate immediately, and handoff remains explicit. No engine/API or
schema change was made. Reference markup was used for composition only: no external
Genspark scripts, styles, fonts or services are loaded.

Verification: 221 core, 40 browser and 2 Electron tests passed for this composer
update. The new browser scenario checks empty Send, connector hide/restore, menu
focus, 390/768/1280/1440px layouts, multiline growth and missing-assistant draft
recovery. Reviewed composer captures are generated under test-results. Source-link
focus now runs after the source row is rendered, fixing a regression exposed by
this layout. Formatting passed. Clean-machine and live-provider gates remain open.
