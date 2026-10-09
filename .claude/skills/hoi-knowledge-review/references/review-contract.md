# Review contract

- `knowledge scan`: record current mechanical findings.
- `knowledge list`: inspect pending and reviewed findings, versions and current flags.
- `knowledge propose --input proposal.json`: create `{ "kind": "wiki" | "memory", "input": <existing wiki or memory proposal input> }`. Evidence is required. Reference exact revisionId, passageId and quote. Wiki inputs include slug/title/type/content/evidence; memory inputs include type/content/evidence. Preserve allowedHosts.
- Review the new wiki draft with `wiki review ID --state reviewed`, or a proposed memory with `review-memory ID --state approved`, only with authorization. Existing canonical wiki replacement uses the same slug and supersedes. Maintenance can retire an active record in favor of a standalone reviewed replacement; it does not itself make a wiki canonical.
- `knowledge replacements`: obtain visible, current, cited reviewed replacement IDs and digests.
- `knowledge review --input review.json`: submit the exact decision below.

```json
{"id":"review_from_scan","expectedVersion":1,"targetId":"record_from_finding","action":"keep"}
```

Actions are keep, reject, archive, update, merge and supersede. The last three additionally require replacementId and replacementDigest from `knowledge replacements`. A stale record, evidence revision or replacement digest requires reloading and renewed review; never substitute a new target under an old approval.

Retired originals remain stored and their review history stays accessible subject to permissions. This API has no destructive delete or automatic undo. Use a verified backup before a recovery operation. Historical finding text is not current knowledge.
