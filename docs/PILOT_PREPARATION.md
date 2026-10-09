# Pilot preparation — recovery before private intake

This follow-on batch prepares a bounded walkthrough after engine batches A–F. It does not complete the real-use pilot or authorize publication.

The offline importer now requires `--rehearsal`, refuses existing or overlapping recovery destinations (including filesystem aliases), and acquires the workspace lock before opening SQLite. It refuses older schemas rather than migrating them. The app must be stopped for this recovery operation; normal assistant operations still use the shared engine.

A verified backup is restored into a new directory. The restored database must open, pass integrity and foreign-key checks, and retain preserved file checksums before the first new source is imported. Recovery results accompany private import checkpoints. Originals and existing instructions remain preserved. Private selections and recovery outputs are forbidden inside the product checkout.

An explicit `--walkthrough` supports a smaller selected collection. Default pilot imports still require 50–150 distinct files. Walkthrough completion does not prove semantic quality, fresh-host compatibility, or ten days of reliability. Retry uses new recovery destinations and a new run, with existing source deduplication; this script is not an automatic resume service.

## Demonstration and limits

Synthetic checks cover 50 selected files, repeat imports without source multiplication, restoration before intake, preservation of instructions and project identity, active ownership refusal, occupied/overlapping recovery directories, changed checksums, and explicitly labeled small walkthroughs. The existing importer/evaluator integration test now supplies the mandatory recovery directory.

A user-selected, ten-document private walkthrough was imported after separate recovery rehearsal: no extraction gaps, matching original checksums after reopen, and all 20 source-phrase retrieval probes across the two host policy identities found their expected source with resolving citations. These are smoke checks, not independent retrieval evaluation or fresh assistant sessions. Paths, document content and evaluation records remain outside this repository.

Remaining: independent bilingual labels, useful task/wiki/memory proposals reviewed against originals, fresh Claude/Codex sessions, real brief review, live-provider verification, clean-platform execution and ten actual working days. No GitHub updates or live-workspace migration were performed.

Validation on 2026-09-27: `npm run check` passed all 166 core tests and runtime catalogue/mirror checks; formatting passed for changed files. The first sandboxed run could not bind loopback; the final authorized run passed. Browser and desktop suites were not rerun because this batch changes only the offline pilot importer and its documentation/tests. Previously packaged desktop artifacts were not rebuilt or republished.
