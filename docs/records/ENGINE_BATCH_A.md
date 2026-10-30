# Shared engine — Batch A

Local, unreleased implementation dated 2026-09-26. Schema remains 10; engine API version is 1. No private workspace migration or GitHub publication was performed. Electron packaging and optional-adapter setup are later batches.

## Working behavior

`npm start -- --workspace "<private workspace>" --host local` opens Home. Codex and Claude clients use their corresponding `--host` values. `hoi map` remains a separate read-only visualization.

The app owns the workspace lock for its lifetime. CLI operations discover the running engine before opening the database, authenticate as their selected host and use the shared operation dispatcher. Without a running engine, a CLI command acquires exclusive ownership before opening the store and releases it when finished. An active or uncertain lock is never bypassed.

The operation registry validates the common request envelope and dispatches domain input validation. Its metadata identifies the action class, permission, idempotency contract and input/output schema identifiers. Domain modules retain their source-policy and exact-approval checks. HTTP app reads and mutations share the dispatcher; binary original downloads retain explicit source checks. Uploads and scheduled synchronization use the same serialized queue.

`node bin/hoi.mjs engine status --workspace "<private workspace>" --host codex --json` reports API/schema compatibility. `engine operations` exposes the registry. Upgrades require the app to stop.

## Credentials and retries

Each running workspace generates separate ephemeral local, Codex and Claude credentials. Requests cannot override the credential's host. On POSIX systems, session files are protected by owner-only directory/file permissions (0700/0600), checked on access. Windows uses the OS credential store and fails closed when unavailable. Session material is excluded from backups and removed on orderly shutdown.

This is an application authorization boundary, not isolation from other programs running as the same operating-system user. Windows credential-store behavior still needs a native-machine verification.

Mutation requests have durable receipts. Retrying the same `--request-id` and input returns a completion acknowledgment; changing input under that ID is rejected. A started receipt with uncertain completion requires inspecting the actual records before a new request. Receipts deliberately do not cache private response content that could outlive a permission change. Domain-specific proposal review still checks versions and exact actions.

On shutdown, new queued work is refused, accepted work drains and synchronization stops before ownership is released. After a crash, run `recover-lock` only when its ownership checks establish that the process is gone, then restart the app to replace the stale discovery session. Recovery refuses active or uncertain owners.

## Synthetic demonstration and validation

The engine acceptance test starts an app, invokes fresh CLI processes as Codex and Claude, retrieves evidence and submits one proposal supported by an email, transcript and calendar reference. The app approves it, a repeated request does not duplicate it, and reopening the workspace confirms one task with all three evidence links.

Additional checks cover invalid credentials, host spoofing, API mismatch, policy revocation, competing app ownership, credential exclusion from backups, and shutdown draining. The launcher test confirms `/app` and handles an occupied port without taking over another workspace.

Validation on 2026-09-26: `npm run check` passed 119 core tests and runtime/catalogue consistency; `npm run test:browser` passed all 12 browser tests. The 1,000-document map check measured 294 ms to the list and 1,240 ms to the graph on Apple M5. These are local synthetic results, not clean Windows or live-provider verification.

## Remaining work

- Batch B: app-only setup, optional adapters, versioned skill contracts and generated compatibility documentation.
- Batch C: crash-resumable item jobs, extraction workers and stable source identities. The Batch A queue does not make existing long-running extraction nonblocking.
- Batch D: coverage and actionable dashboard improvements.
- Batch E: Electron, native packaging and clean-machine installation.
- Batch F: build-specific security evidence, broader recovery rehearsal and pilot readiness.

The current output envelope is JSON-validated with domain validation in the dispatcher; it is not yet a generated, domain-by-domain client SDK. Real assistant-session UX, live providers, Windows execution and the ten-day private pilot remain separate verification gates.
