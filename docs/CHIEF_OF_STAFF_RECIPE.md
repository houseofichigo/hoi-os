# Fictional Chief of Staff rehearsal

Audience: harness developers and people evaluating the optional Chief of Staff workflow. This is a **fixed engine rehearsal**, not a live assistant, a new scheduler or an AI benchmark. It works without API keys, model downloads, adapter installation or the retired business app.

The authoritative operations remain daily view/meeting, unified knowledge retrieval, task proposal/review, versioned memory and backup/restore. See the generated [operation reference](OPERATIONS_REFERENCE.md) and [tool conventions](TOOL_CONVENTIONS.md). The optional [Chief of Staff instructions](../skills/hoi-chief-of-staff/SKILL.md) tell a host how to combine them; the runner does not interpret or execute the instructions.

## Run the complete workflow

From the source checkout:

```sh
npm ci
npm run build:core
npm run harness:recipe -- --output /tmp/hoi-chief-first-run
```

Choose a new directory under an existing writable parent. The standalone Hub package includes the runner and compiled engine; after `npm ci`, omit the build step. On Windows, use a new directory under a local temporary folder. Windows execution remains unverified.

The runner accepts no private-workspace path, custom script, provider, URL or arbitrary input package. It creates two separate fictional workspaces, one project-linked and one standalone. Each contains original documents, a calendar occurrence, a transcript, a published wiki, an attributed approved memory and explicitly seeded historical tasks. Local fixture seeding is recorded separately from the proposed new action.

It reads accepted tasks, prepares the exact meeting, retrieves up to ten knowledge items, resolves citations and saves a transcript-linked task proposal. Task fields are authored fixture data, **not model extraction**. The brief is a deterministic rendering of those results. The default run leaves the new proposal pending.

The rehearsal restarts each workspace, repeats intake/proposal calls, backs it up, restores into a different directory and revokes evidence only in that restored copy. It verifies that revoked evidence and its dependent proposal become unavailable. The original review workspace remains intact.

Inspect:

- `cedar/brief.md` and `willow/brief.md`: readable briefs and coverage limitations.
- Each case's `output.json`, `evidence.md`, `evidence.json`, original and transcript: exact identities, versions, attribution and passages.
- `review-payload.json`: the exact proposed approval payload; saving this file does not approve anything.
- `seed-history.json`: explicitly scripted prior task/wiki/memory state, not human review.
- `identity.json`: fixture, runner, engine, dependency-lock and instruction fingerprints; actual runtime/platform and zero-spend limits.
- `report.json`: checks and artifact checksums. `REVIEW.md` and `frozen-review-standard.md`: the pending independent review handoff.

The daily date is deliberately fixed to 19 October 2026. Retrieval and evidence validity use the real engine clock; stale/future event checks remain visible. This is not a way to override temporal permissions.

## Explicit review rehearsal

To exercise approval in a **new fictional run**:

```sh
npm run harness:recipe -- --output /tmp/hoi-chief-review-run --simulate-review
```

This explicitly runs the local review operation against the fixed proposal, retries the identical decision, rejects a competing decision and verifies one resulting task and one initial history entry. The report labels it `scripted-fixture-review` with `humanReview: false`. It cannot operate on an existing workspace or approve a different payload.

For a manual review of the default run, inspect the exact proposal and evidence first. Use the existing local CLI from the product directory, substituting the case's actual absolute paths:

```sh
node bin/hoi.mjs --workspace /tmp/hoi-chief-first-run/cedar/workspace --host local --json task review --input /tmp/hoi-chief-first-run/cedar/review-payload.json
```

This command is an explicit approval, not a preview. Local authority must come from the user. Optional assistant hosts must not impersonate `local`; use their actual host identity and the current review policy. The shared CLI routes through a running engine if present. Never remove an active lock. The optional Hub can inspect the knowledge in this workspace; task review remains an engine operation after retirement of the business frontend.

## Integrity, isolation and cost

```sh
npm run harness:recipe -- --verify /tmp/hoi-chief-first-run
```

Verification checks the frozen outputs for changes, refuses traversal/symlink substitution and does not reinterpret review state. Editable local checksums are corruption detection, not cryptographic host attestation. Workspace changes after the run do not rewrite the frozen report; recheck current evidence through the engine before acting.

Existing output directories, including symlinks, are refused. Failure retains partial artifacts and `failed.json`; use a new output directory after repair. There is no resume that might repeat paid or external actions. Files are private-mode on platforms supporting POSIX permissions.

The fixed runner has **zero provider calls, zero external spend, zero model downloads and zero arbitrary-command execution paths**. It checks a 30-second limit between cases; this is not a hard preemption guarantee. Isolation means fresh local directories and separate SQLite stores, **not an OS sandbox for untrusted skills**. Do not adapt it to execute arbitrary packages or credentials without designing that boundary separately.

## What this establishes

The checks cover project and standalone work, unknown deadlines, completed/cancelled exclusion, waiting-for distinctions, exact occurrences, incomplete availability, source/wiki/memory evidence, citation resolution, restricted/revoked evidence, restart/deduplication and restoration. The optional simulation adds exact-review retry and competing-review rejection.

Human factual support, usefulness, skill effectiveness, live host execution, Google/provider behavior and a genuinely unseen held-out evaluation are **not established**. The public reserved fixture is a regression partition only. The author-written standard awaits independent owner review; no generated report marks that review complete.

For a later skill improvement trial, first freeze independently reviewed labels and hidden scenario families. Run actual baseline/candidate host sessions with explicit data/cost authorization, then use the existing [artifact comparison contract](SKILL_IMPROVEMENT.md). Do not reuse this deterministic brief as evidence that the skill generated a good answer. Activation remains a separate reviewed engine action.
