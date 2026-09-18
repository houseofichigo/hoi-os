# Connections and models

HOI OS reuses read tools already available in the selected assistant. It does not extract credentials from Claude/Codex, install a universal connector library, or assume a subscription includes API access.

## Connect a host tool

1. Invoke hoi-connect in the selected host.
2. The assistant inventories actual available tools and performs a minimal authorized read of the intended provider/account.
3. After success, it records `{ "provider": "calendar", "host": "codex", "status": "available" }` through connect. Available is a host attestation, not an independently verified OAuth session.
4. For missing tools, record unavailable. For manually exported data, record export-only.
5. Supply a normalized export to import-connection. The private original export is archived, and subsequent versions use a stable provider/account/object key.

Supported provider names: gmail, calendar, drive, github. Files work locally without a connector. Each runtime has independent connection status. No sending, draft-writing, publishing or remote editing is implemented.

```json
{
  "provider": "calendar",
  "account": "person@example.invalid",
  "remoteId": "provider-event-id",
  "title": "Client pilot review",
  "url": "https://calendar.google.com/",
  "updatedAt": "2026-09-17T09:00:00Z",
  "checkedAt": "2026-09-17T10:00:00Z",
  "text": "Event details exported by the authorized host tool.",
  "metadata": { "documentType": "calendar-event", "authority": "primary" }
}
```

Do not include access tokens, raw credential responses, or unrelated account content. The export schema rejects unknown fields. Exports are snapshots; use a fresh provider read for current operational state. Provider timestamps must come from actual provider results, not invented freshness claims.

## Model registry

models/registry.yaml records active-host inference and optional provider information. The first release makes no independent model API calls. Classification and final synthesis run in the active assistant. Retrieval and extraction are local deterministic operations.

API-key-based model routing, cost metering, embeddings and unattended inference remain future work. No API keys are needed to use the shipped core. Sources that cannot be processed by the selected host must be excluded through policies and allowedHosts before the assistant reads them.

## Optional OCR

Use the product's `ocr` command after installing Tesseract from its official distribution. `doctor-ocr` reports executable availability and installed language packs. OCR runs locally, writes a distinct text output, and never replaces the original scan. Import the scan and output separately and declare their relationship. OCR text is derived and requires verification; searchable PDF extraction does not automatically run OCR.
