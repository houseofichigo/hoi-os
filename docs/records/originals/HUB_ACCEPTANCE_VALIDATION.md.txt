# Portable Hub acceptance — 17 October 2026

Local, unreleased batch. The governed engine, optional Knowledge Hub, 25-step method, 21 skill packages and schema 19 are retained. No skill instructions, private workspace, assistant installation, provider configuration or published repository was changed.

## Delivered

`hub:acceptance` is included in the production package. It validates the manifest before importing packaged code, refuses existing/overlapping output, and creates only fictional workspaces. It exercises the actual setup and launcher scripts, authenticated API and fresh CLI clients under both assistant identities. Native modules resolve from the isolated installation.

The retained report identifies the build, package manifest, operating system/architecture, CPU, Node/ABI, native versions, exact evidence identities and timestamped checks. Failures remain visible; uncertain or interrupted work is not converted into a pass. Raw launcher output and tokens are not copied into the report. The package manifest is an integrity check, not proof of publisher authenticity.

The [installation guide](HUB_INSTALLATION.md) covers requirements, launch authentication, optional adapters, recovery and removal. The [fresh-host worksheet](HOST_ACCEPTANCE.md) distinguishes observed skill discovery/execution from instruction integrity and scripted engine checks. Actual assistant sessions are deliberately not launched by the runner.

## Verification

Environment: existing macOS arm64 development machine, Apple M5, 32 GiB memory, Node 22.14.0 / ABI 127. No fresh user or machine was available for this run.

| Check                          | Observed result                                                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core and generated consistency | 304 passed, zero failed; 3 optional-model skips out of 307. Mirrors, catalogue and generated guides match.                                                                                                 |
| Browser regression             | 18 passed, including existing responsive/keyboard and reviewed knowledge workflows. No UI behavior changed in this batch.                                                                                  |
| New acceptance regressions     | 4 passed: unsafe manifest/path/checksum containment, existing/overlap rejection, safe failure/cancellation reporting, full isolated production workflow.                                                   |
| Production installation        | 111 packages installed from the existing local cache with `npm ci --omit=dev --offline`. No link to repository dependencies; not a clean-cache/network-install test.                                       |
| Packaged command               | All 12 checks passed through `npm run hub:acceptance`, with retained fictional workspaces and report.                                                                                                      |
| Preservation and distribution  | 10 prior files verified in the pre-change archive; 410 packaged manifest entries verified. Selected private-path and credential-pattern scan found no matches; not a full repository-history secret audit. |

Source build: `05fe625dcab040caf60dd3f24e07e9ba0961648050ae739a6c10e3004fb45f3a`. Packaged runtime build: `53fbf10a6f4b2e775fcbbf7678c74bf8807e20a4f426b7ad63806b39cdf093c4`. These differ because the production dependency lock differs from the development lock. Both are recorded; the source suite is not presented as a separate clean-platform certification.

Local candidate: `release/hoi-os-knowledge-hub-2026-10-17-acceptance-local.zip`. SHA-256: `cf582cc7e4fd2079895a2bd34204001351a7fe5f04c1d16b52e5340c4afd4e52`. It contains the acceptance command and installation/host guides, without dependencies, private workspaces or credentials. Install the locked production dependencies on the target machine. The ZIP and checksum are local only.

Evidence is preserved in the containing workspace under `archives/2026-10-17/hoi-hub-acceptance/`: automatic report, package manifest, selected fictional inputs, before versions, core/browser logs and combined verification record. The temporary installation/recovery copies remain separate; their credential/session files are not archived.

The first sandboxed dependency attempt could not access npm's native cache; the permitted cache-access run succeeded. An initial retry assertion expected a record body, while the engine intentionally returns a completion receipt without cached content. The assertion was corrected to re-read the permitted proposal and verify its identity; engine permissions and replay semantics were unchanged. No test failure was relabelled as a pass.

A passing local command does not establish clean-machine installation, historical migration, host execution or independent effectiveness.

## Remaining gates

- Run the supplied kit on a genuinely fresh user or machine, record dependency installation and browser behavior.
- Observe real Codex and Claude Code discovery, permitted retrieval, proposal, human review and retry/restart behavior separately. No model account was invoked in this batch.
- Verify Windows x64 and Mac x64 natively; this machine cannot certify either.
- Exercise installation removal on each target platform. The script never moves or deletes the installation from which it is running.
- Rehearse a deliberate historical/private upgrade with its own verified backup and separate restoration. This command checks a current-schema upgrade guard, not a fabricated old database.
- Complete independent usefulness/held-out evaluation and any separately authorized live providers/connectors before making those claims.
- Prepare a fresh publication allowlist and candidate review for the harness/Hub edition. Historical release snapshots and retired desktop evidence remain historical. Publication requires its own final action.
