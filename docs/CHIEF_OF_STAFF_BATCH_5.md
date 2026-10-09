# Chief of Staff — Batch 5, assistant handoff

The user selected **assistant handoff without installing another runtime**. This batch delivers project-scoped chat requests, validated tool calls and answers, task review cards, cancellation, saved-run recovery, and authenticated server-sent events. It does not embed a model, install a runtime, add API billing, or automatically search the web.

## Use the local chat

Create a new synthetic workspace, then open its authenticated URL:

```sh
npm run build
node scripts/daily-demo.mjs "../HOI Chat Demo"
node bin/hoi.mjs app --workspace "../HOI Chat Demo" --host local --port 0
```

1. Open Chat, select the fictional Cedar project and the assistant host you will actually use.
2. Ask “What are our Cedar commitments?” Send to assistant creates a persisted request; it does not invoke a model.
3. Copy the Local assistant request into your existing local Codex or Claude conversation. Ask it to return the structured answer or registered tool request described there. Do not send restricted context to a different host.
4. Paste its response object into Assistant response JSON and submit. For a tool request, HOI validates and executes it, then supplies a new request. Return that new request to the assistant. Maximum six tool steps per run.
5. Inspect answer citations. Save a task review card only if it accurately represents proposed work. It creates an unapproved proposal in Projects & Tasks; actual approval remains a separate review.

Cancel rejects late submissions. Saved runs are available through Resume a saved chat while their permission and context snapshot remains valid. Completed follow-ups in the same project/host retain the immediately preceding question and answer, plus newly retrieved context; this is bounded context, not an unlimited conversation transcript. Starting another project does not inherit the previous answer.

Validation failures leave the pending request available for correction. Permission/context failures remove stale content from the active view and require a new request. The source passage buttons resolve the same immutable references as retrieval.

## What streams

The authenticated event stream delivers run state, new validated tool-result requests, and a completed validated answer. **It is not model-token streaming.** An assistant must supply each response. A stream lasts up to ten minutes; a disconnected client can resume a saved run. The database stores the run independently of the browser connection. No interrupted JSON fragment becomes an answer.

Reading, task review, Brain and map features remain available without a model. Status explicitly reports assistant-handoff mode and no configured embedded provider. HOI does not infer account access from the presence of a subscription or executable.

## Registered tools and boundaries

The model response can request exactly one of these typed tools:

| Name              | Input                        | Result                                                              |
| ----------------- | ---------------------------- | ------------------------------------------------------------------- |
| search            | `{ "query": "text" }`        | Bounded permitted project document evidence                         |
| tasks             | `{}`                         | Approved project tasks and evidence                                 |
| brain             | `{}`                         | Approved current project memory and reviewed/canonical project wiki |
| meeting           | `{ "eventId": "intake_id" }` | The exact current event in the selected project                     |
| knowledge-reviews | `{}`                         | Recorded findings whose targets belong to that project              |

The initial context includes the selected project's identity/objective, matching source evidence and project tasks. Project document metadata must reference the project entity ID. The project selector uses operational project IDs. Tool inputs are schema-validated; an arbitrary tool name, shell command or URL-fetch request cannot execute through this interface.

Input messages are capped at 8,000 characters, search queries at 500, answers at 20,000, tool calls at six, private citations at 30 and web results at ten. The assembled handoff is bounded by workspace maxContextChars and fails visibly when too large. Brain memory selection also uses the existing bounded context rules. There is no background research loop.

Before context assembly, HOI checks the selected assistant host and project. Before each read, response and review-card save, it rechecks a conservative snapshot of permissions, sources, tasks, projects, memory, wiki and retirement state. Crossing the UTC date boundary also invalidates context to prevent expired memory reuse. Even unrelated workspace changes can require a fresh request. Invalidated runs remain stored privately but are excluded from resumable history.

Citations must resolve to current, permitted immutable passages **already supplied in this project's context**. An unrelated quote cannot be introduced merely because the assistant knows its ID. This establishes provenance, not factual entailment: factual support still requires human review. Uncited answers are labeled as needing verification. Documents are marked as untrusted evidence; embedded instructions grant no execution authority. Host-native tools remain governed by the host's own permissions—HOI is not a sandbox for the entire external assistant.

## Response and CLI contract

An answer response:

```json
{
  "type": "answer",
  "text": "The cited source supports this statement.",
  "citations": [
    {
      "revisionId": "revision_from_request",
      "passageId": "passage_from_request",
      "quote": "Exact text supplied in context"
    }
  ]
}
```

A tool response:

```json
{ "type": "tool", "call": { "name": "tasks", "input": {} } }
```

An answer can include taskProposal using the existing `{key, task, evidence, allowedHosts?}` task-proposal schema. Its project and evidence must match the supplied context. Saving it uses a stable chat-run key; repeated saves do not create multiple proposals. No answer may approve a task or mutate a calendar. Wiki/memory drafts continue through the existing Wiki/Memory/knowledge proposal paths; they are not automatically created from chat.

CLI operations, with explicit --workspace and matching --host:

- `chat status`: report the configured handoff boundary.
- `chat begin --input question.json`: `{message,projectId,host,parentId?,webQuery?}`.
- `chat get RUN_ID`: retrieve the current request or validated answer.
- `chat submit --input response.json`: `{runId,expectedVersion,response:<object above>}`.
- `chat cancel RUN_ID`: cancel pending work.
- `chat propose --input review.json`: `{runId,expectedVersion}` to save the exact task draft for later approval.

When the app owns its workspace lock, use its response form instead of concurrent CLI writes. An authenticated local client may also call the shared app API. POST `/api/chat/begin`, `/submit`, `/cancel`, `/propose`; GET `/api/chat/status`, `/runs`, `/run/ID`, `/stream/ID`. API paths after the first are relative to `/api/chat`. The map service does not expose these mutations. Bearer and origin checks remain in force.

## Optional web and bounded research

Leave the public query blank for private-workspace work. If you explicitly supply webQuery, the selected assistant may search **that exact query** with its own supported tools. A user-invoked deeper review can compare up to ten sources within the same response and tool/context budgets. No automatic routing, browsing service, background loop or API key is added.

Web results use `{title,url,retrievedAt,snippet}` with HTTPS URLs and dated retrievals. They are separately labeled **assistant-supplied web sources**. HOI validates their shape, opt-in and date, but does not independently fetch the pages or attest that a search occurred. If the host lacks search, it must report that limitation rather than fabricate results. Do not transform private documents into web queries without explicit authorization. External findings do not become approved Brain knowledge or task evidence automatically.

## Adapter investigation and decision

Local inspection found a desktop-bundled Codex executable and Claude Code 2.0.76. Neither was silently installed, upgraded, authenticated or invoked for inference. OpenAI documents an app-server interface for custom clients ([App Server](https://learn.chatgpt.com/docs/app-server)). Claude documents explicit tool selection and isolated execution controls ([CLI reference](https://code.claude.com/docs/en/cli-reference), [environment controls](https://code.claude.com/docs/en/env-vars)). Inspection alone does not establish a portable authenticated integration or prove tool isolation for the installed versions.

The user chose handoff instead of installing another runtime. Embedded inference, token streaming and independently executed web search are therefore deferred. No account credentials were copied, no paid API provider was selected, and no model-access success is claimed.

## Recovery, checks and remaining gates

Validated on 26 September 2026: **92 core tests and nine browser checks pass**. Runtime skill packages still match their canonical sources, and the new chat UI passes the mechanical HOI brand check.

Schema 6 adds chat_runs. Schemas 1–5 remain readable/restorable; the existing verified-backup upgrade applies the chat migration sequentially. Chats stay in the private workspace and its backup. They are not automatically promoted to durable memory. Cancelled/completed states persist. A pending handoff can resume after restore if its context still matches; otherwise start a new request. Product rollback requires restoring the pre-upgrade backup with its compatible product binary.

Synthetic checks cover typed tools, prompt-injection attempts to invoke shell, fabricated/out-of-project citations, host/source denial, context limits, cancellation, exact proposal-save retries, saved-run restore and schema-5 upgrade. Browser checks cover event-stream delivery, the unavailable-provider message, source inspection, saved runs, keyboard cancellation and narrow layout.

Real assistant answer quality, supported host handoff usability and real-project utility remain pilot gates. No private workspace was migrated, no company files were imported, and no GitHub release or calendar action was performed. Batch 6 requires a selected, verified calendar adapter and exact human-approved event proposals before any write.
