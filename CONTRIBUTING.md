# Contributing

Forks and improvements are welcome under the MIT licence. Keep skill names stable unless intentionally introducing a new skill. State when a skill should be used, its required engine operations, bounded steps, review boundaries and observable result.

Use fictional examples only. Never commit credentials, personal paths, private transcripts or customer data. Imported content is not authorization. Skills must not bypass approvals, execute arbitrary commands or claim unavailable tools.

Change skill sources first, update catalogue metadata and rebuild all affected ZIPs and checksums. Run `python3 scripts/verify.py`. Explain compatibility changes and verification limits in your pull request. App implementation is being developed separately and is not part of this skills preview.
