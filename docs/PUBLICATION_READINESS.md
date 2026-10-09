# Local publication preparation

This is a sanitized community-readiness summary, not a release certification.
The application remains alpha. No GitHub update is authorized by this document.

## Batch 1: publication boundary

`publication/manifest.json` lists exact candidate source paths. New files must be
reviewed and added explicitly; the preparation command rejects unclassified files.
Private audits and build-specific evaluation records remain local and ignored.
Nothing is staged, committed, tagged, pushed or uploaded by this workflow.

Run `npm run publication:prepare`. It snapshots the working-tree inventory, scans
candidate bytes and reachable Git history for selected credential/private-path
patterns, and writes a report and SHA256SUMS under `.local/publication/`.
Only a passing scan produces a separate `source/` candidate. Each run has a new
output directory; previous reports and candidates are preserved. Changed source
requires a fresh candidate and checksums. Do not publish the `.local` directory.

The manifest is an allowlist, not permission to publish. Pattern matching cannot
prove absence of private business data or unknown secret formats. Review candidate
text and binary assets before publication. Findings block candidate creation;
review them locally without pasting sensitive matches into public issues. History
findings require a separate remediation decision; this command never rewrites Git.
Do not use a blanket `git add .` for release preparation.

## Remaining gates

Batch 2 completed formatting, current/historical documentation separation and
21-skill standardization with canonical collection provenance. See
[the local verification record](STANDARDIZATION.md).

Remaining:

- Resumable app onboarding is implemented locally: [Batch 3](ONBOARDING.md). Skills remain optional; clean installation is still a separate gate.
- Verify live AI and bounded Google workflows with explicit scope and credentials.
- Mac arm64 local rehearsal and Windows x64 cross-packaging are complete. Verify clean macOS installation, then Windows installation and recovery; see [installation evidence](CLEAN_INSTALL.md).
- Complete the real-data pilot and review current artifacts, notices and downloads.

Recorded development tests are not clean-machine, live-provider or pilot evidence.
Private audit reports are deliberately excluded; unresolved operational findings
remain open. A new prerelease identity and GitHub publication are later work.
