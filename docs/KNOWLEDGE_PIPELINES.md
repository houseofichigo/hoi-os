# Precise discovery and selected sessions — schema 21

Audience: workspace owners, assistant adapters and product developers. The shared registry and engine enforce access, revisions, budgets and review. This guide describes behavior; it grants no authority. See RULES.md, FILESYSTEM.md, TOOL_CONVENTIONS.md and the generated OPERATIONS_REFERENCE.md.

## What changed

The baseline discovery matcher indexes actual fields with FTS5 instead of searching JSON property names. Individual claims resolve to exact original passages. Legacy global questions retain artifact-level provenance. Candidate profile `unified-retrieval-v4` adds cited observations and weighted discovery; it is opt-in through Search coverage pending independent quality review. The baseline profile is `unified-retrieval-v3.1`. Existing lexical and optional local semantic retrieval remain available. No inference runs merely because someone searches.

Generated descriptions, questions and observations are derived, unreviewed discovery aids. They never become independent corroboration or approved memory. A command is quoted data, and a model's success statement is not an engine receipt. Current source access and revision checks apply to artifacts, evidence, lists, counts and history. Retired/archived/restricted sources do not reappear through the discovery projection.

## Selected conversation export

Sources → Import selected conversation accepts a normalized JSON export, or Markdown/plain text with unknown speaker roles and timestamps. Maximum 512 KiB; split larger conversations deliberately and disclose partial coverage. There is no native session watcher or implicit access to host history.

```json
{
  "schemaVersion": 1,
  "namespace": "selected-export",
  "account": "fictional-demo",
  "conversationId": "planning-session-01",
  "title": "Fictional planning discussion",
  "coverage": "partial",
  "turns": [
    {"id":"turn-1","role":"user","text":"I prefer morning meetings.","timestamp":null},
    {"id":"turn-2","role":"assistant","text":"A preparation block could help.","timestamp":null}
  ]
}
```

Roles: user, assistant, system, tool, unknown. Exported roles are recorded attribution, not authenticated author identity. Supply either turns or text. Reuse namespace/account/conversationId for revisions; do not guess identity from similar titles. A plain-text file initially uses its filename as the editable conversation identity.

System and tool turns are omitted by default. Recognizable credential-like turns cannot be selected. This is a conservative convenience filter, not a secret-detection guarantee: inspect the preview. The original export is preserved locally, including omitted material; only the reviewed selection is indexed. Original preservation does not authorize provider disclosure. Never include real credentials in distributable examples.

CLI/API input to `import-connection`:

- Preview: `{ "mode":"preview", "session":{...}, "selectedTurnIds":["turn-1"] }` (selection optional).
- Commit: same input with `mode: commit`, returned `previewDigest`, `expectedRevision` and unique `requestKey`.
- Changes to content, selection or source revision require another preview. Reusing a request key with changed input fails. Existing v1/v2 connection callers remain supported.

The Hub sends `originalExport: {format: "json" | "text", content: "..."}` with the request, preserving exact uploaded bytes. CLI callers may supply the same field; otherwise the engine preserves a normalized JSON serialization of their supplied object. Original turn/text content must agree with the normalized selection.

Manual import requires no automation or AI configuration. Original/checksum, selected turns and omission metadata survive restart and backup. The source reader exposes turn navigation. Import does not start analysis.

## Enrichment

`knowledge enrich-preview` accepts `{revisionIds, provider, maxCost}`. Inspect prerequisites, processor version, window count, estimate and returned digest. `knowledge enrich` adds `requestKey` and `previewDigest`, returning a durable request identity. Inspect with `knowledge enrich-status REQUEST_KEY`; cancel with `knowledge enrich-cancel REQUEST_KEY`.

A run processes one pending bounded window. Subsequent explicitly authorized invocations continue remaining windows without repeating completed work. Input splits retain exact original passage/offset references; upstream completeness stays separate from processed-window coverage. A missing key, stale pricing, denied disclosure or insufficient budget produces an explicit state. Paid uncertainty blocks another dispatch until reconciled. Cancellation cannot promise an external provider did not complete.

All runs reserve the full prompt/output estimate before dispatch, within $0.25 per run and the existing combined $25/month automatic budget. Preview estimates exclude fixed instruction overhead and are not charges. No provider/model substitution occurs. Instructions and data cannot execute tools or approve outputs.

Recurring definitions may opt into `discovery: true` only with an assisted-review recipe. This changes the reviewed definition digest. Existing definitions are unchanged. At most three stages remain: intake, mechanical health and assisted processing. Enrichment shares the assisted call rather than creating an unbounded chain. Remaining windows appear in run history.

Observations may propose a preference/decision through the existing memory proposal operation. The source reader's action uses stable observation identity and does not approve it. Task and wiki promotion remains through the existing typed task/wiki workflows; this delivery adds no one-click task/wiki creation from observations. Unchanged proposals, dismissals and receipts retain their existing identities.

## Health and monitoring

`knowledge health` separates last upstream check, import time, extraction, lexical/semantic indexing, enrichment windows and upstream coverage. Optional semantic/discovery coverage appears in `knowledge index-status`. `knowledge rebuild` accepts `{domain:"discovery",requestKey}` to reconstruct disposable discovery indexes without a model.

Connections without a known schedule show Unknown with their last successful check. Scheduled checks use the expected time and a reviewed grace period (default 30 minutes). No-change success is healthy. Analysis paused for budget/configuration is distinct from an intake failure. Freshness is not proof of factual correctness.

The inactive `integrations/n8n/health-monitor.json` uses scoped status reads, separately from intake. Create a status-only credential with `automation credential` input `{id,expectedVersion,confirm:true,access:"status"}`; this does not rotate the existing trigger credential. Bind it through n8n's credential system. The status endpoint's `requireHealthy=1` returns 503 for delayed/partial/failed/unknown health so the configured error workflow records it. The response contains no source passages or private titles.

Validate nodes/workflow on the target instance, inspect saved connections, and test fictional success/failure responses before any publication. No workflow is activated by the package. Same-host monitoring cannot detect its own machine being offline. No email or Slack notification is configured.

## Recovery and rollout

Schema 20 → 21 creates session provenance, processing-request journals and rebuildable discovery units. Migration preserves existing artifact payloads and IDs and performs no AI calls. Backup includes originals, selected exports, derived artifacts and journals. Restore into a separate directory; definitions pause, grants revoke, and interrupted paid work remains uncertain.

The full app/Electron remains retired. This is the Node harness and optional browser Hub. Live API accuracy, independent labels, fresh-host behavior and continuously hosted monitoring require separately recorded evidence. No private source, adapter, schedule or GitHub publication is changed by this implementation.
