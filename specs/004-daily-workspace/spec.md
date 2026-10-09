# Batch D: actionable daily workspace

Status: implemented and verified locally (143 core / 17 browser tests). Local only; no publication or private migration.

## Product contract

HOI OS is the engine. The standalone app consumes its governed operations; optional assistant skills consume the same engine. Skills never generate a replacement app. AI interpretation remains assistant handoff.

## Required behavior

1. Each Home signal reports current/partial/stale/unknown coverage, selected scope and refresh time. A current empty scope may show zero; incomplete external coverage must not imply there are no commitments elsewhere.
2. Overdue active work is separate from upcoming seven-day deadlines. Date-only values keep their calendar dates; timed values use the selected workspace timezone. Completed/cancelled work is never overdue.
3. A signal opens its exact task, proposal, project, event, source, training or connection. Evidence remains permission-checked on access. Keyboard users can reach the record and return.
4. Reply candidates show visible last-message context, evidence and review status. Dismiss/snooze apply to the exact visible revision; new incoming messages reopen review. Unread is not unanswered.
5. Record views persist in the private workspace per host, with validated settings and version checks. Browser storage is not a workspace database.
6. Assistant-processing requests persist exact source revision and target host. Only verified stored extraction results/proposals can be linked. Manual completion is explicitly user-marked, never validated AI output.
7. Existing client galleries, tables, boards, map lazy loading, record list, provenance and approvals remain available.

## Acceptance

Synthetic core tests: coverage (including current empty scopes and restrictions), overdue/upcoming/DST, email reviews, view isolation and stale saves, processing result mismatch, schema-11 restoration into schema 12. Browser tests: dashboard → exact task/evidence, exact event preparation, saved view survives reload, keyboard record controls. Existing full suites remain required.

## Boundaries

No calendar writes, new model runtime, broad source ingestion, Electron implementation or publication in Batch D. Source restrictions always take precedence over dashboard counts and result links.
