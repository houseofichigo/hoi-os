# Stable-release acceptance

Automated tests validate mechanics; they do not replace real client acceptance. Keep this release labeled alpha until every required gate has evidence.

| Gate                | Required evidence                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation        | Clean macOS and Windows installs, each used in a fresh Claude Code and Codex session; no preexisting HOI accounts or machine paths.                                                                |
| Preservation        | Identical imports, changed versions, filename collisions, moved files, interrupted extraction and restored backups verified against checksums.                                                     |
| Retrieval           | At least 60 labeled real questions over 500–1,000 selected documents; recall@5 ≥90%. Include conflicting versions, absent evidence, ambiguous entities, French/English queries and denied sources. |
| Grounding           | Every citation resolves; human review finds ≥95% of factual claims supported. No fabricated commitments or deadlines.                                                                              |
| Meeting preparation | Ten real briefs reviewed; correct event/client identity and visible gaps. Median completion time at least 50% lower than a recorded manual baseline.                                               |
| Policy              | Denied data excluded before host exposure; imported instructions cannot authorize actions; changed action cannot reuse approval.                                                                   |
| Recovery            | Interrupted work, backup restoration to a new directory, index rebuilding and rollback of a release upgrade pass.                                                                                  |
| Map                 | All views, source opening, relationship inspection, keyboard list, narrow viewport and reduced-motion behavior verified.                                                                           |
| Independent pilots  | HOI plus at least two independent client installations, with recorded findings and fixes.                                                                                                          |

## Evaluation records

Store real test records privately, outside this product repository. For each retrieval question record: question, permitted host, expected source/revision IDs, returned top-five IDs, correct/incorrect, and reviewer notes. Include explicitly unanswerable questions; abstention is the expected result.

For each meeting record: intended event/timezone/client, source freshness, manual preparation minutes, assisted preparation minutes including corrections, factual claims checked, supported claims, invented commitments/deadlines, reviewer and date. A fluent narrative without verified evidence fails.

The automated 1,000-document/60-question fixture is deliberately synthetic and primarily tests retrieval plumbing. It must never be presented as measured production accuracy.

## Release procedure

Run npm ci, npm run check, npm run format:check and npm audit. Record dependency versions, CI results and browser checks. Complete the private pilot records, resolve material findings, then choose the GitHub owner/visibility and publish a reviewed release. Do not tag a stable version solely because code builds.
