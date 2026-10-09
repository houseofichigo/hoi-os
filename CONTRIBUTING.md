# Contributing

<<<<<<< HEAD
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
=======
Forks and improvements are welcome under the MIT licence. Keep skill names stable unless intentionally introducing a new skill. State when a skill should be used, its required engine operations, bounded steps, review boundaries and observable result.

Use fictional examples only. Never commit credentials, personal paths, private transcripts or customer data. Imported content is not authorization. Skills must not bypass approvals, execute arbitrary commands or claim unavailable tools.

Change skill sources first, update catalogue metadata and rebuild all affected ZIPs and checksums. Run `python3 scripts/verify.py`. Explain compatibility changes and verification limits in your pull request. App implementation is being developed separately and is not part of this skills preview.
>>>>>>> 66fcc668b3a4e0085bdc3eb3d23209fadb2ba052
