# Release gate execution — 2026-10-09

The user requested completion of platform, signing, retrieval, live-Google, pilot and publication gates. Publication is the final gated action; it is not justified by completion of local tests alone.

## Retrieval work

A new bilingual development scenario revealed an explicit identity mismatch: imported source metadata links to the project entity, while the app selects the project record. Current source retrieval now recognizes their stored `projects.entity_id` relationship in lexical, semantic-candidate and derived-artifact filtering. It does not guess from names or add new permissions. Regression cases verify that both differing delivery statements remain available in French/English project-scoped searches and denied sources remain excluded.

This addresses a scoped-retrieval defect, not the previously reported unscoped Moss ranking regression. No RRF weights, special name boosts, contradiction edges or evaluation labels were changed. Independent, unseen-family answer evaluation is still required before claiming quality acceptance.

## External gates awaiting setup

| Gate | Required input | Completion evidence |
| --- | --- | --- |
| Clean Mac | Fresh machine/test user and operator access | Completed checksum-bound kit with OS, build and observed outcomes |
| Apple signing | Developer ID identity and secure notarization setup | Signed/notarized final artifact, stapling and successful native assessment |
| Windows / Intel Mac | Native environments or authorized remote runners | Install/import/restart/restore/uninstall results for each exact artifact |
| Google | Explicit account, small selected Gmail label and calendar | Verified read scope; exact reviewed draft and no-attendee preparation event receipts |
| Ten-day pilot | Named user/workflow, bounded sources, baseline and start | Ten actual working days of observations and resolved critical defects |

Do not collect credentials in this document or chat. The existing unsigned candidate fails signing/Gatekeeper assessment. The prepared operator kit does not count as an executed clean-machine test. No test environment or Google scope has yet been supplied for this phase.

## Bounded Google execution sequence

1. Confirm the named scope and prepare a recovery copy before private upgrades/imports.
2. Connect through the user-owned OAuth flow with read-only defaults. Preview the bounded selection before synchronization or analysis; do not process an entire backlog.
3. Verify exact message/thread evidence, aliases/replies and recurring meeting occurrences. Record coverage and failed/revoked/offline behavior.
4. Prepare a proposed Gmail draft and a personal Calendar preparation block. Present recipients, subject/body/thread or title/calendar/time/timezone/supporting occurrence for exact approval. Enabling write scopes is separate from approving these payloads.
5. Execute each approved operation once, capture receipts and reconcile uncertain results before any retry. Never send email or add meeting attendees.

## Pilot protocol

Start only after scope, recovery and participant setup are confirmed. Keep actual observations in the selected private pilot workspace, outside the product repository. Each working day records used workflows, expected versus observed evidence, retrieval misses, source coverage, corrections, time spent and incidents. Prepare five briefs and the independently labelled bilingual questions; do not let generated answers label themselves. A critical defect interrupts the success window and requires correction and a new successful window under the established acceptance policy. Do not pre-fill future days or infer ten-day reliability from automated tests. No recurring automation is configured by this document.

## Publication sequence

Freeze the final runtime build after defects are resolved. Rerun applicable tests and platform verification, audit distributable files and history, update the explicit publication manifest, prepare final checksums and release notes, and verify signing and pilot evidence. Only then publish the intended app artifacts and verify their remote checksums/links. Preserve existing skills-release history; do not overwrite it with unverified app binaries. Any historical privacy finding requires review and an explicit remediation decision before history rewriting.

## Current publication audit

The existing publication-preparation scanner reported **blocked**: zero pattern findings in manifest-selected current files, 134 unclassified working-tree files, and 23 excluded-history-path findings. The latter are policy exclusions, not identified leaked credentials. The manifest predates recent runtime/evaluation additions and also encounters generated artifacts; do not simply allow every path or interpret an incomplete allowlist scan as a whole-repository privacy clearance. The detailed report is retained in ignored local audit storage. No files were deleted, no history was rewritten and nothing was pushed.

## Local verification

The project-scope runtime build is `9f9282a821da5fdf5f74ca84e8cc45f06e94177982e812c04ac870877055c2e1`. Core verification passed: 283 tests, 280 passed, three optional local-model tests skipped; guides and skill mirrors matched. The two new development tests first exposed the project/entity mismatch and now verify explicit scoping and revocation. Existing packaged build/operator-kit evidence refers to its older build and must not be treated as verification of this runtime change.

Matching-build browser verification also passed all 44 tests. Desktop/platform checks have not been refreshed for this runtime; no new signed candidate was built. Clean environments, signing identity, bounded Google selection and a pilot participant/start remain required inputs before those external gates can execute.
