# Operations and recovery

## Updates

Stop active commands and the map. Back up the private workspace to a new directory outside it. Update product code using a reviewed release, run npm ci, then rerun setup against the existing private workspace. Setup rebuilds the product and refreshes its managed skill/manual blocks, preserving previous copies in workspace archives.

The current database version is 1. `upgrade BACKUP_DESTINATION` creates a backup and confirms this version. Future migrations must be transactional, take a verified pre-migration backup, and ship a restore test. This alpha does not claim an unimplemented migration path from a future schema or from Personal Workspace.

## Backups

Backup writes a consistent SQLite snapshot and a SHA-256 manifest of private workspace files, excluding credentials, live lock files, temporary files and generated dependencies. Generated assistant adapters are reinstalled by setup. Backups contain private originals and knowledge; store them privately. Application backup does not provide encryption or key management.

Restore validates checksums and SQLite integrity before staging replacement. The old workspace is renamed to a unique sibling and retained. The manifest cannot escape the backup root. Restore refuses a running writer or map reader. Files use relative original paths, so restoring to another directory works. Rerun setup after relocation to update runtime.json's machine-local product/workspace paths.

## Interrupted work

CLI mutations hold `.hoi/lock` with owner PID and machine identity. After a crash, run `doctor` and then `recover-lock`; active or uncertain owners are refused. Legacy locks without machine identity require investigation. Do not remove an active lock. Rerun ingest for pending/failed sources; preserved originals and occurrence history remain available. Resume a failed workflow by execution ID only when its inputs, host, policy, context, source state and capability still match.

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

The record list opens first. Choose **3D map** when needed. A failed refresh clears displayed records rather than leaving stale evidence visible. Restarting the server changes its session token: open the newly printed URL.

`doctor --json` includes versioned diagnostic checks: `DATABASE_OK/UNAVAILABLE/CORRUPT`, `EXTRACTION_OK/GAPS`, `LOCK_CLEAR/ACTIVE/STALE/UNKNOWN`, `CODEX_ADAPTER_OK/MISSING`, `CLAUDE_ADAPTER_OK/MISSING`, and `BACKUP_VERIFIED/OLD/MISSING/INVALID`. Backup verification checks contents when diagnostics run; OLD means more than seven days since creation, not a claim that every subsequent change is backed up.

`diagnostics --json --output "<new local report.json>"` exports only versions, platform, architecture, diagnostic codes and aggregate source counts. It omits paths, identities, content, credentials, tokens, exception text and raw configuration. It refuses to replace an existing output. Review even this minimal report before sharing it.

`recover-lock --workspace "<private workspace>"` refuses live, foreign-machine, malformed or uncertain owners. Only a same-machine PID proven absent can be recovered; the owner record is retained. Legacy locks without machine identity require manual investigation, not automatic deletion.

`recover-restore --workspace "<private workspace>"` handles a killed restore. After verifying the restoring process has stopped, it uses the journal to recover the previous workspace if the directory swap was interrupted. Completed swaps retain the prior workspace. Incomplete staging directories are never treated as successful backups and may be inspected before manual cleanup.

Setup against an existing workspace now takes a verified sibling backup before updating adapters. Keep backup directories private and include them in your own encrypted storage policy. No schema migration is introduced in this stabilization; version 1 remains unchanged.
