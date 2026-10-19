# Local candidate and publication boundary

Audience: maintainers preparing the current harness and optional Knowledge Hub. This is an alpha candidate, not a release certification. The retired Electron app's signing and installer reports do not validate this Node distribution.

## Review source before packaging

`publication/manifest.json` lists exact candidate source paths. Review and explicitly add new product files; preparation rejects unclassified files. Run:

```sh
npm run publication:prepare
```

The command snapshots the working-tree inventory, scans candidate bytes and reachable Git history for selected credential/private-path patterns, and records a report and SHA256SUMS under `.local/publication/`. Only a passing scan produces a separate `source/` candidate. It never stages, commits, tags, fetches, pushes or uploads. Do not publish `.local/`, private workspaces or raw runtime logs.

The allowlist is not permission to publish. Pattern matching cannot prove absence of private business data or unknown secret formats. Review text and binary assets. Findings block candidate creation. History findings need a separate remediation decision; the command never rewrites Git. Avoid blanket `git add .`.

## Prepare one immutable local candidate

```sh
npm run check
npm run format:check
npm run test:browser
npm run package:candidate -- --output "../HOI candidate"
```

The destination must not already exist. Packaging writes the staged Hub, `hoi-os-hub.zip`, installer and operational skill archives, `START_HERE.md`, build fingerprints and SHA256SUMS. `CANDIDATE.json` is written only after assembly succeeds. Partial outputs remain for inspection; retry in another new directory. Skill-only packaging likewise requires `npm run package:release -- --output "../HOI skills candidate"`. Neither command overwrites a historical release directory.

The package base version remains historical compatibility metadata. Use build fingerprints and checksums to identify this candidate; choose a new release identity before eventual publication. The GitHub workflow is manual candidate preparation with read-only repository permissions. It uploads CI artifacts after checks; it does not create a tag or GitHub release.

Run the [installation acceptance kit](HUB_INSTALLATION.md) against the extracted package. Record its exact package digest, platform and results. Preserve the [host checklist](HOST_ACCEPTANCE.md) for actual fresh assistant sessions. Hashes detect changes but are not signatures or proof of publisher identity.

## Remaining release gates

The [final handover](FINAL_HANDOVER.md) separates clean target-platform installation, fresh assistant integration, independent retrieval/skill quality, bounded live providers/connectors and real-use pilot evidence. Existing automated checks do not certify these gates. Native app signing is outside the current product boundary; if a desktop installer is reintroduced, it requires its own verification.

Before publication, review final source and artifacts for private data, licences, provenance, dependency findings and accurate capability claims. Do not replace previously published assets as a shortcut. No publication is authorized by this document.
