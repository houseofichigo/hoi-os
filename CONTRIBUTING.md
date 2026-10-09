# Contributing

HOI OS is alpha. Use fictional workspaces and keep private documents, credentials,
accounts, audit reports and evaluation records outside the product checkout.

Install the developer prerequisites from README, run `npm ci`, and use the existing
engine operation registry for business logic. Preserve approvals, provenance,
source permissions and sequential migration/restore compatibility. Skills are
optional clients, never a second implementation of the engine.

Before proposing a change run `npm run check`, `npm run format:check` and relevant
browser/desktop tests. Skill changes require `npm run skills:sync`. Include the
problem, final behavior, tests and unverified limits. Do not infer clean-machine
or live-provider support from synthetic tests. Add regression coverage for defects.

Follow [publication readiness](docs/PUBLICATION_READINESS.md) before any release.
Never include private audit reports or use blanket staging for a release candidate.
Contributions use the repository MIT license; preserve dependency notices.
