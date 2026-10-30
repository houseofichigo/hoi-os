# Knowledge Hub source retirement — 17 October 2026

Local, unreleased changes. This record supersedes the temporary “legacy source retained” state in the extraction/reconciliation reports. No schema change, private migration, provider use or publication.

## Preserved before removal

A separate dated archive contains the full pre-change product source (including uncommitted work), configurations, tests, documentation and prior built Hub. A manifest records 563 file checksums and the archive checksum. Legacy generated business-app assets, desktop staging and native release artifacts were relocated intact. The archive is outside the distributable product; no private workspace or credential store was archived. Do not copy it into a public package.

## Active product

- Seven-phase, 25-step method and 21 optional engine-client skills remain.
- The governed engine retains retrieval, source permissions, task/project records, wiki/memory review, approvals, jobs, budgets and recovery.
- `npm run build` produces the engine, Knowledge Hub and read-only map. `build:hub` remains an alias.
- `npm start`, `hoi hub` and compatibility launcher `hoi app` open the Hub. `/app` is a URL alias on the Hub server. `hoi map` remains read-only.
- Dashboard, Inbox, CRM, full Chat and Electron source/build scripts are retired. Their engine capabilities are not deleted. There is no replacement business frontend or bundled Node runtime.
- Dependency installation excludes Electron. React, Radix and graph libraries are build-time dependencies; staged runtime packages contain only engine dependencies and compiled browser assets.
- Shared CSS removes selectors belonging exclusively to retired screens, preserving retained view declarations and responsive rules.

## Verification

Source build `c8509d42f7da0e55f2d0d1ed93fc668dc1ab3476d3220abe8538c36736356e89`, macOS arm64, Node 22.14.0:

| Check                                               | Result                                                                                                                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`, recorded through `verify:security` | 295 tests: 292 passed, 3 optional-model checks skipped; skill and guide drift checks passed                                                                                             |
| Full retained browser suite                         | 17 passed, including authentication recovery, onboarding without AI, reviewed intake, wiki/memory editing, map/fallback, adapter recovery and Skills management                         |
| Responsive/keyboard checks                          | 390/768/1280/1440px, Escape and focus restoration; eight macOS screenshot baselines inspected/recorded. Other platforms have no visual-baseline certification                           |
| Before/after style comparison                       | Overview and Skills at 390/1280px produced identical PNG bytes after restoring the dynamically selected gallery styles                                                                  |
| Source boundary                                     | Build rejects retired UI/Electron imports; current lockfile and installed dependency tree exclude Electron                                                                              |
| Staged runtime                                      | 9 direct engine dependencies, 111 installed production packages; no Git checkout, Electron, React runtime dependency, skills installation or AI configuration needed                    |
| Isolated package exercise                           | Fictional import/retrieval, two server restarts, separate backup/restore preserving revision identity, and installation-directory removal simulation all passed                         |
| Optional adapter exercise                           | Both 21-skill host packages, portable guide links, customized manual/skill preservation, conflict-aware removal and separate restored-copy relocation passed; host execution not tested |
| Preservation                                        | 563 pre-change source file checksums and archive checksum verified; product skill instructions and runtime mirrors unchanged                                                            |
| Local public-source pattern scan                    | 549 allowlisted files checked with no pattern findings; not a new Git-history, comprehensive privacy or release certification                                                           |

Five core tests specific to the retired Electron boundary/Mac kit were archived, explaining the count change from 300 to 295. Business-screen and Electron UI tests were archived with their implementation; they are not claimed as passing. The retained engine/API suites still cover business records, approvals and permissions. No historical Electron certificate applies to this build.

Browser verification found a delayed-response race in the Skills drawer: closing it while a control request completed could reopen it. The response now refreshes the selected record only while it is still selected; stale detail reads are ignored. A held-response browser check covers dismissal during the write.

A full formatting check still reports six pre-existing untouched files (`src/chat-send.ts`, `scripts/run-review-pack.mjs`, `docs/CLEAN_INSTALL.md`, `docs/RELEASE_GATE_EXECUTION.md`, `docs/RELEASE_READINESS_BATCHES.md`, `docs/UNIFIED_RETRIEVAL_VERIFICATION.json`). Changed code is formatted; historical records were not broadly reformatted. This is an existing repository-wide formatting gate, not a runtime failure.

## Limits and next work

Node 22.14+ and compatible native modules are required. No fresh-machine, Windows, Intel Mac, fresh assistant-host, live-provider or live-Google certification is claimed. The lazy 3D graph chunk remains large; the accessible list is retained. The next functional work is a complete fictional Chief of Staff recipe with independent review and bounded evaluation, followed by reviewed procedural lessons. Automatic skill improvement and activation remain unavailable.
