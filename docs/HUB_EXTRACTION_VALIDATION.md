# Independent Knowledge Hub — 16 October 2026

Local unreleased implementation in the existing HOI OS repository. Schema remains 19. No private upgrade, new provider, skill activation, source deletion or publication.

## Delivered

- A dedicated `hub.html` / `hub-app.jsx` entry and `build:hub` output in `dist/hub`. Emitted-module checks reject the legacy app, dashboard, Inbox, CRM, full Chat, calendar/email editors and Electron modules, including lazy dependencies.
- Shared authentication and recovery, knowledge overview, activity cards and connection policy are reusable without pulling legacy screens into the Hub. Memory, Skills, Configuration and reviews load on demand; the heavy 3D renderer remains lazy with the accessible record list available.
- Sources, reviewed upload, wiki draft/compare/publication, memory review/history, map, maintenance and Skills management retain their existing engine contracts. All seven Hub views remain available.
- Skill launch checks current availability and prepares an unsent handoff containing the exact revision/checksum. Examples fill that handoff. No conversation, provider job or action is created. Related records use permission-filtered reads and wiki links; unsupported full-app workflows show guidance.
- A staged package contains the engine, Hub, optional skills, 25-step method and guides. Its lockfile has nine direct runtime dependencies and excludes Electron, React runtime packages and development tooling. React is already bundled into the browser assets. It requires Node and compatible native dependencies.
- Security build identity covers the correct distribution, Hub assets and runtime setup/launch files. Missing required Hub assets fail instead of silently substituting desktop evidence. No old verification file is copied into the standalone package.

## Verification

Environment: macOS arm64, Node 22.14.0, Playwright Chromium. Fictional fixtures only.

- Core checks: 289 passed, zero failed, three optional-model tests skipped out of 292. Runtime skill mirrors/catalogue and generated guides/operation reference checked.
- Browser regressions: 20 passed across the Hub, wiki, memory, Activity, shell and Skills/legacy handoff. An additional focused Hub run passed three scenarios, including the new related-record/memory flow; 21 distinct scenarios in total.
- Module boundary tests exercise rejection of every named excluded screen and Electron path, verify lazy graph chunks, and check that the Hub serves its own entry at `/`, `/hub` and the compatibility `/app` alias. The legacy `app.html` file is absent. API authentication remains required.
- Staging checks verify package file hashes, guides/method presence, runtime dependency separation and refusal to overwrite an existing destination. Changing a Hub asset changes its build identity; removing the required Hub directory fails validation.
- The retained desktop staging allowlist now includes the setup/launch scripts covered by build identity. A separate copy check confirmed identity parity; this is not a new Electron installation or launch test.
- The standalone package was installed into a separate temporary directory with `npm ci --omit=dev --offline`, using 111 packages from the existing cache. It has no dependency on the repository's `node_modules` directory.
- Its setup ran without assistant manuals or AI configuration. A fictional Markdown source was ingested and retrieved. Two fresh Hub server launches and subsequent CLI retrieval retained the exact source revision. Backup restoration into a separate directory retained that revision.
- A reversible installation-directory removal simulation preserved the separate workspace and restored copy. This is not a macOS application-uninstaller test.
- Keyboard Escape and focus restoration, navigation/refresh, unsent skill handoff, missing records and reduced motion were exercised. Layout checks covered 375/390, 768, 1280 and 1440px plus narrow landscape. Existing light-theme styling was retained; this is not a complete accessibility or dark-theme certification.

The first isolated-package attempt exposed a legacy `dist/web` dependency in build identity; that dependency was corrected and the isolated workflow rerun. Earlier failures are retained with local evidence rather than counted as passes.

## Limits and next work

The standalone package is a local candidate, not a published or clean-machine-certified release. No Windows, Intel Mac, live provider, live Google account or private-workspace test was performed. The three skipped embedding-model integration checks remain unverified here.

The engine deliberately retains its registered operations, permissions, disclosures, jobs and recovery behavior. Removing screens is not an API permission restriction. Existing engine configuration still supports optional providers and connector settings; the Hub does not add autonomous execution.

Legacy app/Electron source and developer dependencies remain in the repository for recovery and compatibility. Shared CSS retains some unused legacy selectors. The 3D library still produces a large-chunk warning; no new performance or bundle-size guarantee is claimed.

Next: reconcile the supplied harness skills and installer with these engine contracts, repair the separately recorded catalogue inconsistencies, then retire the old source from a future distribution branch with its archive intact. The reviewed improvement runner, procedural-memory interface and clean-host/platform checks remain separate work. See [transition](HARNESS_TRANSITION.md) and [launch/package guide](KNOWLEDGE_HUB.md).
