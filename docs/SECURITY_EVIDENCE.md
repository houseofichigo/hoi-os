# Understanding security findings

Configuration → Security and `hoi security --json` report three distinct scopes:

- **Current workspace:** database integrity, external-action policy, visible configured source scopes and latest-backup verification. A scope check does not prove upstream coverage. A backup passes only when its contents verify and the recorded verification is recent.
- **Synthetic build evidence:** permissions, authentication/origin, upload containment, exact approvals, credential exclusion, recovery, connector regression behavior, browser checks and desktop boundaries. A pass means the mapped regression suite passed on the recorded platform for this build.
- **Live behavior:** OS credential-store access and Gmail/Calendar/Drive remain not-tested until separately exercised with approved scopes. Mock provider tests are not live verification.

Each finding includes a build ID, check version, scope, timestamp (or no recorded test), and the tested environment where applicable. There is no security score. Local evidence is not signed or tamper-proof against the OS account that owns the product.

## Reproduce local verification

```sh
npm run verify:security
npm run verify:security -- --browser
npm run desktop:stage
npm run verify:security -- --desktop
```

Core verification invokes `npm run check`, including generated skill consistency. Browser verification requires Playwright's Chromium installation. Desktop verification requires a stage matching the current build and platform. It uses the staged app and asserts the expected Electron version, rather than trusting an arbitrary executable override.

`.verification/security.json` contains only allowlisted aggregate evidence: build ID, suite/check versions, test count, pass/fail, test time, platform/architecture, Node test-runner version and test-source digest. Logs stay in `.verification/*.log`; they may contain synthetic paths and are not a support export. Packaging copies only the validated JSON file, never those logs.

A recorded pass requires a matching build, check version, OS and architecture, at least one test, a successful suite and a timestamp no more than seven days old. Missing, malformed, failed, future or expired records remain not-tested. Changing the runtime/skill code or declared runtime versions invalidates the build match. An on-disk code change during a running engine produces `BUILD_CHANGED`; restart after finishing installation.

The build hash covers distributable JS, web assets, desktop boundary code, CLI entrypoint, canonical skills and declared dependencies. It is not a signature or a complete integrity measurement of every native dependency byte. Platform-native modules and signed distribution remain separate verification responsibilities. The record's Node version is the test runner; the desktop suite additionally verifies its pinned Electron runtime.

To include the newest report in an already prepared stage, re-stage or copy the schema-validated JSON through the staging command before packaging. Intel/Windows packages correctly show not-tested for Apple Silicon evidence. Historical audit records in `docs/verification/` document a particular run; the UI reads only the current `.verification/security.json`.

These checks neither authorize repairs nor ingest private data. Real workspace migrations still require a verified backup and separate restore rehearsal. GitHub publication remains a later step.
