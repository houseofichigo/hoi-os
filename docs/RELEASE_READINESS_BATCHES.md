# Release-readiness batches — 2026-10-09

The work below is local and fictional. No private upgrade, paid inference, signing submission or publication occurred. Live AI evaluation remains paused.

## 1. Historical-source upgrade rehearsal: passed with stated limits

`rehearse-historical-upgrade.mjs` archives the locally available `v0.1.0-alpha.2` tag, resolves its commit, compiles its original source in a separate directory, and creates a schema-1 workspace using that engine. It imports fictional evidence, proposes and approves a memory through the old operations, and creates an old-format backup. The current engine verifies/restores that backup into a different directory, migrates it to schema 19, and checks source/revision/passage identities and the approved memory file. A second backup and restore retain retrieval. File checksums confirm the original remains unchanged before rollback; the old engine can still retrieve its evidence.

[Machine-readable result](HISTORICAL_SCHEMA1_UPGRADE.json) records the exact historical commit and source archive checksum. This is a real old-source-generated schema, not a changed schema marker. It uses currently installed compatible dependencies rather than reproducing the historical lockfile/native binaries. Schema 1 predates task, wiki and conversation tables, so this does not certify their historical upgrades. Additional old app snapshots and historical dependency reproduction remain desirable coverage.

Reproduce from the product directory after building the current core:

```sh
node scripts/rehearse-historical-upgrade.mjs /path/to/new-rehearsal-directory
```

The destination must not exist. It retains source code, fictional originals, old/new backups, restored workspaces and the report. No Git checkout, branch, tag or existing workspace is changed. A first harness run failed because it inspected the store's cached opening schema after migration; reopening the store fixed the harness. Both rehearsal directories were preserved locally. No runtime migration change was necessary.

## 2. Clean-Mac operator kit: prepared, execution pending

`prepare-clean-mac-kit.mjs` validates the single top-level candidate ZIP against its checksum file, copies that artifact and BUILD.json, adds one fictional document, and creates a blank 11-check operator worksheet. Output directories cannot be overwritten. Checksum mismatch fails before output creation. An automated test verifies these safeguards and that every result starts as not-tested.

```sh
node scripts/prepare-clean-mac-kit.mjs /path/to/candidate /path/to/new-kit
```

The prepared kit targets build `95d7f29f0028f6517e5452eb9178bbeb558599682ec476e97dea55baef891a1e`, macOS arm64, ZIP checksum `18e480fd4630a4872b913a780243e8d63d91a468053a132f0f9a4c7a93ec4bc4`. It contains no keys, account data or private workspace. The operator must record actual machine/OS, freshness, date and observations. A developer-machine test or empty PATH does not close this gate. A Gatekeeper-blocked launch remains a failed check; no global protection bypass is instructed.

## 3. Signing and packaging readiness: assessed, blocked

Read-only native checks on that exact candidate found:

- Available valid code-signing identities: **0** on the current host.
- `codesign --verify --deep --strict`: **failed**, reporting that code has no resources but its signature requires them.
- `spctl --assess --type execute`: **failed** with the same signature-resource error when run outside sandbox restrictions.
- Candidate metadata correctly says signed=false, cleanMachineVerified=false and liveProvidersVerified=false.
- The existing local packager explicitly disables signing identity discovery and publishes never. Merely installing a certificate will not activate a reviewed signed-release build path.

This artifact is suitable for the documented local developer rehearsal, not public distribution. Do not describe it as properly signed, notarized or Gatekeeper-approved. Keep the current unsigned output intact for traceability.

Remaining signing work requires an Apple Developer ID certificate/private key and authorized notarization credentials, configured securely outside product files. A separate signed build path must sign nested native components correctly, notarize/staple, rerun native assessment on the final bundle and extracted ZIP, regenerate hashes and pass a fresh-Mac test. Do not add private certificates, passwords or keys to this repository. The default Electron icon and unpacked resources also remain distribution-review items. No signing credentials were read, installed or requested in chat.

## Gate summary

| Gate | Outcome |
| --- | --- |
| Schema-1 old-source import and reviewed memory migration | Passed locally |
| Old-format and upgraded backup/restore | Passed locally |
| Original preservation and old-engine rollback read | Passed locally |
| Clean-Mac handoff kit | Prepared and checksum-validated |
| Fresh Mac execution | Not tested; needs another machine/test user |
| Signing/Gatekeeper | Failed current unsigned candidate; identity unavailable |
| Notarization | Not attempted |
| Windows / Intel Mac | Not tested |
| Live AI / Google and independent quality review | Paused / separate |
| Publication | Not performed |

## Verification of this batch

`npm run check`: 281 tests, 278 passed, three optional semantic-model tests skipped; runtime skill mirrors/catalogue and generated guides matched. Formatting and whitespace checks passed. The historical source rehearsal passed separately against the pinned commit. No runtime/UI changes were made, so browser/Electron results from the preceding app-only batch were not relabelled as new runs. The portable operator kit is retained locally under `desktop-release/operator-kits/2026-10-09-arm64/`, excluded from source distribution.
