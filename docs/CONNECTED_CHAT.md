# Connected Chief of Staff chat

Unreleased local implementation. No GitHub publication or private workspace upgrade.

## One engine, three entry points

Home Overview opens a workspace-wide request. Knowledge Hub keeps its seven views
below the composer and defaults to knowledge scope. Chat provides saved conversation
history, the transcript and turn-specific evidence. All three use the same React
composer/controller. Unsent drafts remain in session memory per entry point; they
survive navigation, not browser reload. Submitted conversations persist in SQLite.

Select OpenAI or Anthropic during onboarding, configure its model, pricing and OS
credential-store key in Configuration, then explicitly permit workspace context and
selected sources. Send begins generation immediately. Missing setup preserves the
draft; HOI does not silently choose another provider. Handoff remains selectable.
The fictional demo has no API key and cannot generate real answers until configured.

## Governed context

Read tools cover knowledge, tasks, project/client records, scoped email/transcript
records, calendar occurrences and connector freshness. Read models enforce access;
queries return at most five records per page. The current lexical search and explicit
relationships remain authoritative; no semantic matching or live-on-demand sync is
claimed. Sources, published wikis and approved memories can be attached explicitly.

API requests run with local app permissions plus provider disclosure checks; they do
not inherit permission from a skill. Handoff remains bound to its assistant host.
The API loop permits five read-tool rounds, a context ceiling and a combined manual
request estimate of at most $0.25. Unknown usage retains its reservation. Approvals
and external writes remain separate existing workflows. No send-email tool exists.

Evidence includes supplied/cited passages, wiki sections and versioned live-record
references. Historical views fail closed when their context guard changes. The new
guard includes client/project records and communication changes; legacy guard
formats remain supported. This conservative policy can make a historical turn
unavailable even when an unrelated record changes; selective invalidation is not
implemented here.

## Interfaces and recovery

`POST /api/chat/send` and `hoi chat send --input <file> --host local` use strict
ChatSend/v1 input: requestKey, optional conversationId/expectedVersion, origin,
scope, message, optional projectId, documents, knowledge references, optional exact
skill revision/checksum, provider and maxCost. The optional host field is retained
for client compatibility; API generation always creates a local-host conversation.
Returns conversationId, runId, jobId and state. Keys and document text never enter URLs.

Schema 17 adds chat_sends and conversation_context. The send transaction persists
the turn, reservation, job and request receipt together. An identical retry returns
the existing job; changed payloads under the same key fail. Scope/provider changes
require a new conversation. Interrupted jobs become uncertain rather than being
blindly redispatched; their reservations remain visible. Backup and relocated restore
preserve send receipts and conversation IDs. Versions 1–16 retain sequential upgrades.

## Verification and boundaries

Use deterministic provider fixtures for direct-generation, tools and cancellation
checks. No live-provider reliability is inferred from those tests. Clean Mac/Windows
installation, live Google/AI, the real-data pilot and publication remain separate gates.
Local verification on 2026-09-28: 221 core tests, 38 browser tests and 2 Electron
tests passed for build `2aa132bd2f1ed7e2b700a281b4fb88b32d2741303b19fffa5acd0014a2b00282`.
The two desktop checks also passed against the packaged Mac arm64 executable with
system tools removed from PATH. Formatting and the local publication-content scan
passed. This is development-machine evidence, not clean-machine certification.

The unsigned Mac arm64 ZIP and SHA256SUMS are under
`desktop-release/2aa132bd2f1e-2026-09-28T13-10-08.934Z/`. Older Mac/Windows artifacts
retain their older code. The isolated demo is `.local/connected-chat-demo-2026-09-28`;
it contains fictional records and no configured provider key. No private data was
migrated. No push, tag or release was performed.
