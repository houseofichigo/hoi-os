# Operations and recovery

## Updates

For developer/browser updates, use a reviewed compatible product checkout. Desktop users use a compatible packaged app; Git and a separate Node installation are not required. Before any private schema upgrade, take a verified backup and restore it into a separate directory. Stop the relevant engine/readers when exclusive recovery is required. Do not bypass locks.

Current schema and supported sequential migrations are listed in [generated compatibility](COMPATIBILITY.md). This local checkout uses schema 18. Use the explicit backup-first upgrade flow; setup does not silently migrate a private database. Preserve the previous compatible workspace copy for rollback, rather than opening a newer database with an older engine. Historical schema-2 instructions do not describe the current app.

## Backups

Backup writes a consistent SQLite snapshot and a SHA-256 manifest of private workspace files, excluding credentials, live lock files, temporary files and generated dependencies. Generated assistant adapters are reinstalled by setup. Backups contain private originals and knowledge; store them privately. Application backup does not provide encryption or key management.

Restore validates checksums and SQLite integrity before staging replacement. The old workspace is renamed to a unique sibling and retained. The manifest cannot escape the backup root. Restore refuses a running writer or map reader. Files use relative original paths, so restoring to another directory works. Rerun setup after relocation to update runtime.json's machine-local product/workspace paths.

## Interrupted work

One engine owns workspace writes under `.hoi/lock` with owner PID and machine identity; compatible CLI requests route to that running engine. After a crash, run `doctor` and then `recover-lock`; active or uncertain owners are refused. Legacy locks without machine identity require investigation. Do not remove an active lock. Rerun ingest for pending/failed sources; preserved originals and occurrence history remain available. Resume a failed workflow by execution ID only when its inputs, host, policy, context, source state and capability still match.

The map records its process under `.hoi/readers`. Stop it with Ctrl+C before restore. After a killed process, verify it has stopped before removing its stale reader marker. A running map can coexist with ordinary CLI writes; refresh the browser to see new records.

## Troubleshooting

| Symptom                                  | Action                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Native SQLite module cannot load         | Use a supported Node LTS and run npm ci. Supported platforms normally receive prebuilt binaries; unusual platforms may need compiler tools. |
| CLI says build first                     | Run npm run build in the product checkout.                                                                                                  |
| No skills appear                         | Open the private workspace, verify its .agents/skills or .claude/skills directory, and restart the host if needed.                          |
| No results                               | Check source extraction, filters, access policy and exact terms. Use a bounded source read; do not invent missing evidence.                 |
| Connection says available but tool fails | Refresh the host attestation with hoi-connect. Availability is not a permanent authentication guarantee.                                    |
| Scan has no text                         | Run doctor-ocr; use ocr for image files. Rasterize PDF pages separately before optional OCR.                                                |
| Map authorization fails                  | Open the complete URL from the current map command. Tokens expire when the server restarts.                                                 |
| Port is occupied                         | Choose `map --port 4641`; do not stop an unrelated service.                                                                                 |
| Browser lacks WebGL                      | Use the accessible record list.                                                                                                             |
| Source evidence became stale             | Re-read the current revision and explicitly approve a replacement memory.                                                                   |
| Aggregate rejects a column               | Normalize mixed numeric/text values and confirm common units in a separate working copy; preserve the original.                             |

No telemetry is sent. Diagnostics are local. Review logs and redact source names, paths, quotations, account identifiers and tokens before sharing a support report. Do not copy the private workspace into an issue or public repository.

## Optional image OCR

```sh
node bin/hoi.mjs doctor-ocr
node bin/hoi.mjs ocr "scan.png" --output "scan-derived.txt" --language eng+fra --workspace "../My HOI Workspace"
```

The command refuses existing outputs, retains the original, and writes a checksum sidecar. Available languages depend on the client's local Tesseract installation. No OCR engine or language model is silently downloaded by this command.

## Stabilized startup and diagnostics

Run `npm start -- --workspace "<private workspace>" --host codex` (or `claude`). It validates installation, starts localhost, and opens the authenticated URL. Add `--no-open` to copy the URL yourself. If the port is occupied, add `--port 0`. Do not open `web/index.html` via `file://`; it is application source, not a standalone app.

Home opens first. Knowledge Hub offers a lazily loaded Map and its accessible record list. A failed refresh clears displayed records rather than leaving stale evidence visible. Restarting the server changes its session token: open the newly printed URL.

`doctor --json` includes versioned diagnostic checks: `DATABASE_OK/UNAVAILABLE/CORRUPT`, `EXTRACTION_OK/GAPS`, `LOCK_CLEAR/ACTIVE/STALE/UNKNOWN`, `CODEX_ADAPTER_OK/MISSING`, `CLAUDE_ADAPTER_OK/MISSING`, and `BACKUP_VERIFIED/OLD/MISSING/INVALID`. Backup verification checks contents when diagnostics run; OLD means more than seven days since creation, not a claim that every subsequent change is backed up.

`diagnostics --json --output "<new local report.json>"` exports only versions, platform, architecture, diagnostic codes and aggregate source counts. It omits paths, identities, content, credentials, tokens, exception text and raw configuration. It refuses to replace an existing output. Review even this minimal report before sharing it.

`recover-lock --workspace "<private workspace>"` refuses live, foreign-machine, malformed or uncertain owners. Only a same-machine PID proven absent can be recovered; the owner record is retained. Legacy locks without machine identity require manual investigation, not automatic deletion.

`recover-restore --workspace "<private workspace>"` handles a killed restore. After verifying the restoring process has stopped, it uses the journal to recover the previous workspace if the directory swap was interrupted. Completed swaps retain the prior workspace. Incomplete staging directories are never treated as successful backups and may be inspected before manual cleanup.

Setup against an existing workspace takes a verified sibling backup before updating adapters. Keep backup directories private and include them in your own encrypted storage policy. Setup does not silently change the database schema; run the explicit backup-first `upgrade` command when a supported older workspace needs the current schema (see [generated compatibility](COMPATIBILITY.md)).

## Optional adapters

Current setup defaults to app-only and does not create assistant manuals in a new workspace. Existing adapters remain installed when setup is rerun with `--hosts none`. Use the separate `adapter install/remove` commands or Configuration for explicit adapter changes.

General workspace backups exclude `.agents` and `.claude`. Adapter changes additionally preserve these skill files under dated workspace archives with checksums. Check returned conflicts before relying on changed instructions; repair restores missing packaged resources but retains local edits. Legacy, untracked removal is refused until the adapter is installed/verified. Invalid managed manual markers require review rather than blind rewriting. Keep preserved archives private.

## Assistant documentation updates

Adapter installation bundles the governance, filesystem and tool-convention guides with a generated operation reference under `.hoi/guides/<content-digest>/`. Manifests record version and checksums. Legacy adapters remain readable and report documentation-update-needed; update them through the existing adapter installation flow. A modified guide or managed manual is retained as a conflict. User text outside managed blocks is preserved. Old guide bundles remain for history and other adapters after removal. Full pre-update backups include prior manuals and guides; the local archive also records replaced manuals and current guide copies.

See [filesystem ownership](FILESYSTEM.md) for permitted editing and [tool conventions](TOOL_CONVENTIONS.md) for safe retries.

### Local guide-delivery verification (30 September 2026)

Schema remains 18. Guide bundle `e530e666485f9b1a992a24f7a414ba456cf56c6adc4cdd0a04e3acb61feea2e1` is included in build `8157ae8deb22eed263d1544fbb6b39632f21f6842cd567740101cff7399428ce`. Local evidence: 229 core checks, 42 browser checks and 2 staged Electron checks passed. The Electron workflow installs an adapter and verifies all four guide files and managed manual links. A deliberately modified generated reference was rejected by the drift checker. App-only, legacy-manifest, custom-guide/manual conflict and imported-instruction preservation cases use fictional workspaces.

The local canonical skill collection contains the updated installer/onboarding guidance with provenance; prior published snapshots remain unchanged. These tests do not establish live-provider or clean-machine certification. No private schema migration or publication was performed.

The rebuilt unsigned macOS arm64 package at `desktop-release/8157ae8deb22-2026-09-30T11-38-29.771Z/` passed both packaged-app tests, including adapter installation and guide links. Its guide checksums and build identity match the checkout; SHA256SUMS is included. The earlier `11-37-22.340Z` artifact failed guide containment inspection and is marked rejected in its QA.json; it must not be distributed. No artifact was published.
