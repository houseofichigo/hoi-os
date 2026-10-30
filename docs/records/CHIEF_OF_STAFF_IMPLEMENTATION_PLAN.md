# HOI OS Chief of Staff — implementation plan

Date: 2026-09-25. Status: planned; not implemented or released.

## 1. Outcome and delivery boundary

Turn the existing local HOI OS into a personal Chief of Staff that combines selected transcripts, email, calendar events and working files; maintains a cited Brain; proposes a coherent task list; prepares meetings; and suggests preparation time. Provide a conversational interface over the same governed tools and records.

Implement and validate locally first. Do not push source, update GitHub documentation, replace release downloads, or publish new skills until the local acceptance gates pass and the finished release is ready for review. The public upgrade is a later delivery phase. Keep private HOI data and evaluation records outside the product repository.

Keep the existing Node/TypeScript core, SQLite, Markdown memory/wiki records, provenance, backup/restore, CLI and runtime adapters. Do not rebuild as microservices. Existing source/wikis/memory/map remain usable throughout migrations. Local changes do not imply the currently published installer contains them.

## 2. Baseline and gaps

Inspected product: source revisions and originals, FTS retrieval, host-mediated connection exports, reviewed memory with validity/supersession, cited wikis, entities/relationships, workflow checkpoints, policy-bound approvals, and an authenticated local app/map server. The current catalog has 15 skills, including the installer. Recount from the generated catalog at release time.

Missing: a structured task lifecycle, cross-source commitment matching, incremental operational intake, first-class project workspaces, weekly planning, calendar proposals, an integrated chat execution adapter, and a semantic knowledge-maintenance review queue. Current host connection attestations are not independent live connections. Existing app mutations cover limited wiki/memory review; they are not a general write API.

Inspect the adjacent Personal Workspace app for reusable tested intake components before implementation. Reuse behind explicit storage interfaces only; leave its live vault and service unchanged. Twenty/CRM integration is outside this phase: HOI OS owns its local tasks and does not create a second synchronized CRM task store.

## 3. Product surfaces

| Surface          | Required behavior                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Today            | Briefing, upcoming meetings, priorities, promises, waiting-for items, source freshness and approval count.                     |
| Projects & Tasks | Project list/detail, table and Kanban, owner/status/due filters, proposal review, merge review, task history and evidence.     |
| HOI Brain        | Wikis for company/offering/clients/people/projects/processes; Memory; 3D Map; source inspection and knowledge-review findings. |
| Calendar         | Week view, event details, preparation requirements, suggested slots and explicit event-creation review.                        |
| Chat             | Streaming conversation, project scope, cited answers, tool execution status, cancellation and reviewable action cards.         |
| Sources & Skills | Selected folders, connection readiness, sync runs/errors, extraction gaps, skill catalog and unmet requirements.               |

Global workspace indicator and source-access checks apply to every surface. Empty states explain the next action. Lists remain usable without WebGL; chat failure does not block task review. Serve built assets through the launcher; file:// is not an application launch path.

## 4. Data and ownership

SQLite owns operational state; Markdown continues to own editable context and approved memory. Originals and immutable revisions stay preserved. Search and map projections are rebuildable. New objects have stable IDs, schema versions, timestamps and access scope.

| Object                  | Required information                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project                 | Linked existing project entity, objective, owner, status, dates, relevant sources, people, skills.                                                                                |
| Task                    | Project, title, concrete outcome, assignee, requester, due date/time/timezone or unknown, duration estimate, priority with reason, status, waiting-on party, completion evidence. |
| Commitment mention      | Source revision/passage, exact excerpt, speaker/sender, attributed actor, explicit vs inferred commitment, extraction version and source timestamp.                               |
| Task proposal           | Create/update/merge/reopen operation, target task, proposed field changes, match explanation, evidence, review state and optimistic version.                                      |
| Task evidence/history   | Many-to-many source links, field-level provenance, review decisions, status changes, merge/unmerge history.                                                                       |
| Event                   | Provider/account-scoped identity, recurrence instance, start/end/timezone, participants, status and last verified time.                                                           |
| Intake subscription/run | Selected scope, provider cursor, extraction version, checkpoints, retry state, counts and coverage gaps.                                                                          |
| Preparation proposal    | Event/task links, duration and basis, proposed interval, alternatives, availability snapshot and approval state.                                                                  |
| Knowledge finding       | Finding type, affected records, evidence, proposed remedy, severity, review/snooze/dismiss state.                                                                                 |
| Conversation/tool run   | Workspace/project, supplied messages, selected model/adapter, permitted tools, evidence references, outputs and execution state.                                                  |

Task states: open, in-progress, waiting, blocked, done, cancelled. Proposal states are separate: proposed, approved, rejected, superseded. Approving a proposal applies one version-checked transaction. A task due date may be a date without a time; never fabricate midnight or turn a meeting date into a deadline. Estimated preparation duration is distinct from a confirmed commitment.

Derived tasks, summaries, wikis and chat answers must not leak restricted source content. Preserve the provenance dependency and apply access checks before retrieval, matching, display and execution. Test mixed-permission evidence explicitly; an aggregate must not expose a hidden source through its title or explanation.

## 5. Intake pipeline

Flow: select scope → preserve source → extract → resolve context → propose facts/commitments → match tasks → review → apply → refresh derived views.

Start with user-triggered refresh and export fallback. Use only verified available host tools or explicitly configured adapters; show unavailable capabilities honestly. No background access to an assistant's tools is assumed. An optional local scheduler comes only after restart-safe adapters work; no unattended assistant orchestration is required for the first delivery.

- Email: stable message/thread IDs, sender/recipients, sent date, quoted-message boundaries, attachment identity. Avoid extracting the same promise from every quoted reply.
- Calendar: timezone, event updates/cancellations, recurrence instances, all-day events and known availability. Recurring instances remain distinct.
- Transcripts: meeting identity/date, participants and timestamps where supplied; unresolved speaker identity stays unresolved. Imported files first; hosted transcript adapters later.
- Files: read-only selected roots with a dry-run inventory, file count/size/format/exclusion summary, authority/version review, then bounded import. Never crawl the entire company folder by default.
- Exclude credentials, product dependencies, .git, caches, backups, archives by default and OS/application data. Explicitly protect .secrets; do not copy it into records or diagnostics.
- A disappearing file or provider record is marked unavailable, not silently deleted. Preserve prior imported evidence; distinguish stale copies from current provider state.
- Save provider checkpoints only after the corresponding import transaction succeeds. Use bounded retries/backoff and resume after interruption. Deleted/cancelled provider objects need reconciliation, not just incremental additions.

LLM extraction produces schema-validated proposals, not direct state changes. A transcript's instructions cannot authorize tools or policy edits. Extraction failure leaves the original preserved and a visible gap.

## 6. Cross-source deduplication

Three separate levels: source identity/revision, extracted mention identity, and operational task identity.

1. Use provider IDs and checksums to prevent duplicate source processing. Preserve occurrence provenance.
2. Give extracted mentions stable keys tied to revision, evidence span and extraction version; retries cannot create repeated proposals.
3. Retrieve candidate tasks within permitted project/person context using identifiers, normalized action/deliverable, dates and lexical matching.
4. Apply strong deterministic matches first. Use bounded semantic comparison for ambiguous candidates; an LLM score alone must not silently merge tasks.
5. Attach clearly repeated evidence to an existing task. New/conflicting owners, deadlines or scope become update proposals; they do not overwrite approved fields.
6. Present uncertain matches side by side with merge/keep-separate controls. Record the decision and support reversal.
7. Preserve rejected-proposal fingerprints. Repeated ingestion does not resurrect rejected or completed work; materially changed evidence may propose a reopen with an explanation.

Examples to test: transcript plus email plus calendar reference → one task; same wording for two clients → two tasks; weekly recurring deliverable → distinct tasks; changed deadline → update proposal; forwarded/quoted emails → no additional task; French/English paraphrases → match review; calendar meeting → linked context, not an invented promise.

## 7. Brain and knowledge maintenance

Keep HOI's current memory as the canonical store. Generate cited draft wiki updates from selected new evidence, and review before promoting a current canonical account. Retain prior versions and distinguish inferred summaries from explicit decisions.

Extend technical audit and consolidation with a knowledge-review capability covering stale evidence, contradictions, superseded offers, duplicate pages, missing owners, expired memory, broken references and completed projects still presented as active. Produce keep/update/merge/supersede/archive proposals, each with evidence and a reason. Not recently accessed is not proof of uselessness. No automatic source deletion.

Allow a manually invoked audit and, later, an opt-in weekly local review. Dismiss/snooze findings with reasons so users do not repeatedly triage the same issue. Separate technical integrity results from human-reviewed semantic correctness.

Map task/project/memory/wiki relationships only from the same persisted records. Distinguish inferred and supported edges. Use actual recorded dates; no decorative historical growth.

MemPalace: defer production adoption. If measured retrieval failures justify a trial, use a pinned version in an isolated experiment with a permitted synthetic or explicitly selected collection. Compare French/English recall, latency, resource use, provenance resolution, access enforcement, deletion/reindex and recovery. Treat its index as derived; do not migrate approved HOI memory into a competing authoritative store. External candidate: https://github.com/mempalace/mempalace (reviewed 2026-09-25; no installation authorized by this plan).

## 8. Planning and meeting capabilities

Morning briefing: upcoming events, new/changed commitments, overdue tasks, waiting-for items, suggested priorities, preparation needs, gaps and per-provider freshness. Missing coverage must be visible; a partial inbox cannot support a claim that all promises were found.

Meeting preparation: resolve the exact event/instance, participants and project; retrieve current documents, past decisions and open commitments; produce a cited brief and missing-information list. Afterward, ingest supplied notes/transcript and propose decisions/tasks for review.

Prioritization: start with visible rules based on confirmed deadlines, importance, dependencies, preparation needs and user priorities. Show reasons and allow overrides. Avoid opaque urgency scores and promises of optimal scheduling.

Preparation slots: propose duration with assumptions; respect timezone, work hours, busy events, all-day status, travel/buffers, conflicts and existing preparation blocks. Produce alternatives and flag insufficient availability. Require task/meeting context and fresh availability. Suggesting or approving a task is not authorization to write a calendar event.

External write scope: one explicitly configured calendar adapter may create a preparation event after exact approval. Recheck availability before execution; material changes invalidate approval. Persist provider idempotency/correlation IDs and reconcile uncertain results before retrying. Test timeout-after-provider-success. Sending email, autonomous rescheduling and modifying other people's events remain deferred; local email drafts are allowed.

## 9. Chat, tools and skills

First run an execution-adapter feasibility spike. Preferred initial mode: one verified local assistant adapter for the HOI installation; retain independent Claude/Codex CLI skill usage. If a supported embedded session bridge is unavailable, implement an explicit optional API provider adapter rather than claiming browser chat inherits desktop subscriptions. Keep providers behind a common interface. No credential copying or dependency on Codex-bundled libraries.

Adapter contract: readiness, model selection, structured proposals, streaming, cancellation, bounded context, tool calls/results, timeouts and error reporting. The app must work for reading/review without an inference provider; unavailable chat has a clear setup state. API costs are shown only when actually measurable.

Expose registered core tools for search, source passages, tasks, projects, meetings, memory/wiki proposals, knowledge audit and configured connection reads. Validate tool inputs and enforce policy on the server. No arbitrary shell access through chat. Limit tool loops/time/context. Conversation content is private; capture durable memory only as a proposal, not every chat message.

Route requests to relevant existing skills; inventory requirements and readiness. Do not load every skill into every prompt or imply all third-party connectors are available. Skill instructions guide reasoning; core tools enforce operations.

Candidate new skills: hoi-chief-of-staff (daily/weekly briefing and priorities), hoi-task-review (proposal/match review), hoi-plan-week (preparation suggestions), hoi-knowledge-review (semantic maintenance). Extend ingest/connect/meeting-prep/capture/wiki/audit rather than duplicate their responsibilities. Keep skill names and count subject to implementation review.

Keep runtime canonical sources in hoi-os/skills, regenerate complete Claude/Codex mirrors, and ingest every created/updated first-party skill into skills/houseofichigo-skills/skills/<skill-name>/ with provenance/checksums in accordance with current Hub instructions. The existing collection uses an aggregate suite entry: reconcile that layout explicitly without deleting its history. Keep its README table and verified links current. Local unpublished skills must be labeled unpublished.

## 10. Internal versus external search

Internal search is mandatory and permission-filtered. Add optional web search through a configured provider/host tool for client background and current public facts. Preserve URL, retrieval time, quotes and source quality; findings become proposed knowledge. Keep private data out of outbound queries unless the user approves the disclosure. Web content is untrusted evidence, never tool authorization.

Deep research is a user-invoked workflow: scope/questions → research plan → bounded searches → source comparison → cited report → optional Brain proposal. Set visible time/cost/tool budgets and support cancellation. Ship after core intake/tasks/planning. A lightweight web-search action can arrive with chat; no mandatory new search service.

## 11. API, migration and recovery requirements

- Add versioned, validated endpoints and CLI commands for projects, tasks, proposals, intake, briefings, preparation proposals and findings. Use readable and JSON outputs.
- Mutation requests require authenticated local sessions, strict Origin/Host checks, bounded payloads, optimistic record versions, idempotency keys and audit records. Preserve existing map read-only behavior.
- Schema migrations use a verified backup and rehearsal against a private copy. Define forward migration and tested restoration procedure before changing live data. Old binaries must refuse unsupported schema versions.
- Commit approval and task changes atomically. Preserve cross-store recovery for Markdown/wiki/memory changes. Do not record success until durable writes complete.
- Backup includes operational records, memory/wiki files, originals and required metadata; excludes credentials. Restore into a new location, reinstall adapters and rebuild projections. Compare identities/checksums and resolve all source links.
- Restart recovery distinguishes retryable work from uncertain external mutations. Locks, concurrent review, stopped servers, disk-full failures and expired sessions have actionable recovery paths.

## 12. Local implementation milestones

Indicative effort for one founder plus coding assistance: 10–15 focused engineering weeks, plus a two-week pilot; adjust after the adapter spike and task evaluation. Estimates are not delivery promises.

| Milestone                                  | Work                                                                                                                                                                             | Exit gate                                                                                                    | Estimate        |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------- |
| M0 — baseline and decisions                | Record checkout state, run existing checks, private backup/recovery baseline, inspect reusable app components, inventory available tools, chat adapter spike, UI/data contracts. | Supported execution path demonstrated; pilot scope and working hours selected before private intake.         | 3–5 days        |
| M1 — operational records                   | Versioned migration, project/task/proposal/evidence/history schema, CLI/API, review queue and project/task UI.                                                                   | Create/review/update/reject/merge/unmerge and concurrent-review tests pass; recovery works.                  | 1–2 weeks       |
| M2 — intake and matching                   | Normalized email/event/transcript imports, folder inventory, extraction contracts, incremental checkpoints, duplicate candidate engine.                                          | Same commitment across three sources yields one reviewed task; interruptions/reimports preserve state.       | 2 weeks         |
| M3 — Brain maintenance                     | Evidence-linked wiki/memory updates, findings queue, knowledge-review skill and task/project graph projection.                                                                   | Stale/conflicting evidence produces reviewable findings; no silent overwrites/deletions or permission leaks. | 1–2 weeks       |
| M4 — daily work                            | Today, waiting-for/promises, weekly planning, meeting briefs, Calendar view and preparation suggestions.                                                                         | Complete intake → review → brief → preparation proposal workflow passes.                                     | 1–2 weeks       |
| M5 — integrated chat                       | Productionize adapter, streaming/tool loop/cancellation, citations, project scope, skill routing and optional web search.                                                        | Chat invokes the same governed tools; denied/failed operations remain visibly denied/failed.                 | 2 weeks         |
| M6 — approved calendar write and hardening | One adapter, approval/idempotency/reconciliation, recovery, accessibility and performance.                                                                                       | Exactly one approved event; no duplicates on retry; fresh availability enforced.                             | 1–2 weeks       |
| M7 — HOI daily pilot                       | Selected real project, daily use, extraction/retrieval/meeting review, corrections and regressions.                                                                              | Ten working days with no unresolved critical defect, recovery rehearsal and acceptance metrics.              | 2 elapsed weeks |
| M8 — reusable distribution                 | Generic setup, skills/collection, synthetic sample, documentation, package/CI/install checks and new prerelease.                                                                 | Release candidate reviewed and remote artifacts verified after publication.                                  | 3–5 days        |

M0 adapter investigation happens early even though chat UI ships later. M3/M4 reuse M2 data; M5 may build on stable M1 APIs without waiting for all planning polish. Deliver an end-to-end email+transcript+event task-review slice during M2, not only at the end.

## 13. Acceptance and evaluation

Maintain synthetic fixtures in the repository and real evaluations privately. Freeze a held-out evaluation set; do not tune and report success on the same examples.

- Task extraction: at least 100 labeled candidate commitments across email, transcripts and calendar-linked context, including French/English and non-actions. Target ≥95% proposal precision and ≥90% recall of explicit commitments. Record denominator and reviewer decisions.
- Duplicate handling: at least 50 labeled clusters/non-clusters covering quoted replies, language variation, recurrence, separate clients, cancellation, rejection and changed deadlines. Target ≥95% duplicate-candidate recall; zero incorrect automatic merges in the held-out set. Ambiguous matches require review.
- Provenance: all visible citations resolve; every generated task has supporting evidence or an explicit manual origin. No inferred owner/deadline is displayed as confirmed.
- Retrieval: at least 30 labeled real questions with ≥90% recall@5 on answerable questions; visible gaps for missing answers. Test restricted sources and later access revocation.
- Briefs: five real meetings reviewed, ≥95% factual support, no invented promises/deadlines; record preparation plus correction time. Stable release retains the larger existing meeting/client gates.
- Planning: timezone/DST, date-only tasks, recurrence, all-day events, work hours, buffers, cancellation and overlap tests. No approved calendar write using stale availability; no duplicate preparation events after restart or network timeout.
- Recovery: interrupted import/extraction/approval/migration/backup, concurrent commands, disk-write failure, restore elsewhere and reindex preserve identities, history, originals and source links.
- Browser: every tab, keyboard task review/merge, source inspection, narrow screens, reduced motion, WebGL fallback, expired sessions, provider unavailable, chat cancellation and stopped server.
- Performance: record machine/dataset; target usable list within 2 seconds and graph within 5 seconds on the HOI reference machine at 1,000 sources plus a representative task set. Measure API latency and report model latency separately.
- Skills: resource links, full mirror parity, catalog generation, deterministic ZIPs/checksums and requirement detection. Test local-capable and chat-only installation paths honestly.
- Existing npm run check, formatting, browser checks and release platform matrix remain mandatory. Reconfirm fresh Claude/Codex sessions and clean macOS/Windows installation before broad support claims.

Critical defects: data loss, permission leakage, wrong/invented citations, unauthorized external mutation, duplicate external writes, or blocked core workflow. Resolve all before declaring the pilot complete; record daily failures privately.

## 14. Pilot choices and source scope

Only these choices need user input before dependent work: initial project/files; email accounts and selected labels/date window; calendar account(s); transcript source; working hours/timezone and preferred preparation buffers; execution adapter/provider if the local spike offers alternatives with different cost/privacy properties.

These choices do not block synthetic implementation. Ask for them at M0, not repeatedly for routine coding. Read-only folder inventory may propose a scope, but importing the entire Hub is not the default. Initial file collection: approximately 50–150 approved files plus selected matching communications/events.

## 15. Reusable release after local completion

1. Freeze a tested local candidate and private pilot report; reconcile current repository/release state without rewriting existing tags/assets.
2. Remove machine-specific assumptions from product defaults. Keep provider accounts, absolute private paths and credentials in private configuration. Ship fictional company/project examples.
3. Update setup, doctor, schema migration/backup recovery, connection recipes, compatibility matrix, app SOP, skill catalog and limitations.
4. Publish the product and skills together at a new prerelease version, selected after checking existing releases. Preserve MIT and third-party notices; review any newly adopted dependency license.
5. Generate installer ZIP, chat Markdown fallback, operational skill bundle and SHA256SUMS; ensure generated mirrors and collection ingests include supporting resources and provenance.
6. Run clean install/update/recovery checks, macOS/Windows/Linux CI, browser suite, packaging and publication-content scan. Do not publish private pilot data or diagnostics.
7. Present final changes, validation evidence and remaining limitations for review. Then update houseofichigo/hoi-os and the verified skills collection repository; do not create a duplicate product repository.
8. Verify public tag, README links, downloaded bytes/checksums and clean install from the released artifact. Record exact verified URLs/commit in the local collection index.

Remain alpha until the existing independent-client and real-data stable-release gates pass. A successful HOI pilot authorizes a useful prerelease claim, not universal reliability.

## 16. First implementation batch

Start with M0 and M1: baseline checks and backup rehearsal; adapter feasibility; schema/API contracts; task/proposal migration; synthetic transcript/email/event fixture; and Projects & Tasks review UI. The first demonstration is one proposed task with three evidence links, approved once, surviving reimport and restart. No broad folder import or external calendar writes are needed to prove it.
