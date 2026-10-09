# Plan

1. Hash distributable runtime code, skills and declared runtime versions into a build identity. Capture it at process load and detect on-disk changes.
2. Validate versioned local evidence with an allowlisted schema; bind it to build/platform/architecture and bounded freshness.
3. Run the actual core/browser/desktop suites in a verification command. Publish aggregate records atomically only when the build stays unchanged. Keep logs local.
4. Surface scope, freshness, tested environment and coverage in Configuration and update the optional security skill.
5. Add absent-table legacy migration/rollback fixtures and desktop bootstrap failure/timing regressions.
6. Re-run relevant suites, prepare local artifacts with only sanitized evidence, and carry unresolved release findings into the fresh audit.
