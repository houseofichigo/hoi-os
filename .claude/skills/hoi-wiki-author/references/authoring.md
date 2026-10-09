# Authoring contract

Read operations: `wiki templates`, `wiki taxonomy`, `wiki pages`, `wiki page <id>`, `wiki search <query>`, `wiki node <record-id>`, `wiki backlinks <id>`, `wiki history <id>`.

Draft payload for `wiki save --input draft.json`:

```json
{
  "title": "Orchard preparation",
  "type": "topic",
  "summary": "Preparation policy",
  "aliases": ["Préparation verger"],
  "language": "en",
  "tags": ["topic/leadership"],
  "subjects": [],
  "relatedPages": [],
  "expectedVersion": 0,
  "blocks": [{
    "id": "preparation",
    "heading": "Preparation",
    "text": "Use an exact supported statement here.",
    "kind": "source-backed",
    "evidence": [{"revisionId":"revision-id","passageId":"passage-id","quote":"Exact supplied passage","relation":"supports"}]
  }]
}
```

Replace example IDs and text with retrieved evidence; this example is not executable evidence. Optional properties: owner, effectiveDate and reviewDate (nullable ISO date), allowedHosts. For edits include pageId and the latest expectedVersion. Retain stable block IDs. Omitted optional properties take defaults, so preserve existing properties during edits.

Block kinds: source-backed, user-authored, unverified, question. Evidence relation: supports, contradicts, references. Contradicting evidence is not support. Question blocks never enter factual retrieval. Legacy pages have page-level evidence: do not invent finer-grained attribution.

`wiki compare <page-id>` returns published and saved-draft revisions. The local user publishes a specific compared revision in the app. Stale-version errors require reloading and reconciling, not blindly resubmitting. History restoration makes another draft.
