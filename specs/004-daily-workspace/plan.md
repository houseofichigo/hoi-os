# Batch D implementation plan and record

## Engine

- `src/workspace.ts`: signal projection, deadline windows, exact action IDs, reply review and evidence.
- `src/coverage.ts`: selected-provider scope, freshness, restrictions and incomplete windows; no UI inference from an empty array.
- `src/daily-workspace.ts`: schema-12 saved views, timezone preferences, exact-revision assistant requests and stored-result validation.
- `src/store.ts`: sequential migration; backup restoration retains old source IDs.
- `src/operations.ts` / `src/app-operations.ts`: the same governed CLI and authenticated app operations.
- `src/sync.ts`: processing request links and explicitly user-marked review state.

## Interface

Home consumes structured signals. Query-string destinations open existing components instead of parallel record editors. Workspace views persist per host in SQLite; query/filter/columns/board settings are validated. The map stays mounted only under Knowledge Hub → Map. Token handling preserves destination parameters while removing the authentication fragment.

## Verification

`tests/daily-workspace.test.mjs` checks deadlines, timezone, coverage, permissions, persistence, stale saves, email states, processing references and isolated migration/restore. `tests/browser/daily-workspace.spec.mjs` and the extended redesign suite verify real UI actions and keyboard focus. Full existing suites protect earlier batches.

## Known boundaries

User-marked review and submitted assistant results are different states. A valid stored reference is not an approved task or a factual-quality guarantee. Old browser-only saved views are not imported implicitly into a potentially different workspace. No private workspace is selected by inference and no migration happens automatically in this batch.
