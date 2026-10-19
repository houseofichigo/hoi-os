# Reviewed procedural lessons

Audience: workspace owners, optional assistants and engine developers. Current local Knowledge Hub edition; schema 19 is unchanged. Authoritative implementation: `src/reviewed-memory.ts`, `src/skill-lessons.ts`, `src/skill-library.ts` and source permissions in `src/store.ts`.

## Owner workflow

1. Preserve the selected evaluation report or observation through Knowledge Hub’s reviewed import. Keep the complete comparison bundle outside the workspace if it contains non-importable helper files; importing a report does not validate or execute its bundle.
2. Open **Skills → Improvement → Record lesson**. Select the skill and exact revision, choose the observation type, describe the lesson, its applicability and its limitations, then select a preserved passage.
3. **Save lesson for review** creates a proposed procedural memory attributed to the local user. The form uses local-only visibility. An assistant can propose through registered memory operations with its actual identity and permitted hosts; it cannot claim user authorship or approve.
4. Inspect the evidence and pinned revision; edit or compare the draft, then approve or reject its exact version. Current, Proposed and History use the same Memory reviewer as Knowledge Hub. Corrections, retirement and restoration preserve history.
5. If the lesson warrants an instruction change, **Inspect skill and revisions**, edit a separate skill draft, compare it and evaluate it. Skill activation and adapter synchronization remain separate reviewed actions. Approval of a lesson never changes a skill.

No evaluation runs from this screen. “Engine rehearsal”, “Saved comparison”, “Assistant-host run” and “Manual observation” describe the submitted evidence, not engine-certified outcomes. An imported report that claims success is still a report. The offline comparator checks its full artifact bundle separately; human quality review and independent host evidence are not inferred.

## Memory contract

Use the existing `memory propose --input lesson.json` operation with a unique `requestKey`. Its `memory` object has `type: "procedural"`, nonblank `content`, at least one exact `evidence` reference (`revisionId`, `passageId`, `quote`), and this optional, strict `lesson` object:

| Field                     | Meaning                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `skillId`                 | Accessible bundled or workspace skill ID                                   |
| `revisionId` / `checksum` | Exact existing revision and SHA-256, obtained from `skills get`            |
| `scope`                   | Nonblank applicability conditions; up to 2,000 characters                  |
| `limitations`             | Nonblank limits or untested conditions; up to 2,000 characters             |
| `evaluationKind`          | `engine-rehearsal`, `saved-comparison`, `host-run` or `manual-observation` |

Standard memory durability, effective dates, evidence, allowed hosts and supersession still apply. No `passed`, score, approval or activation field exists in this metadata. Host access cannot exceed the referenced workspace skill’s access. Source access and skill access are rechecked on reads; revoked access removes titles, content and counts. The existing conservative memory policy hides lessons, including their history, while supporting sources are archived. Restore the source through the archive workflow before reading that memory again.

`memory draft`, `memory save-draft`, `memory compare`, `memory review` and `memory retire` retain expected versions, exact checksums and idempotency keys. Generic edits/replacements cannot strip the lesson classification, change it into a semantic fact or replace an unrelated skill’s lesson. The legacy `capture`/`review-memory` implementation cannot bypass this contract; use versioned memory operations for lessons. The CLI’s schema-19 `review-memory` alias already routes through versioned review.

The review engine validates that the pinned skill revision still exists before saving/approving. It may be an inactive draft; approval cannot activate it. If a later product update removes an old bundled revision, history retains its recorded identity and explains the unavailable revision. Create a new proposal against an available revision rather than rewriting history. Disabled skills remain inspectable.

## Retrieval, storage and recovery

Lessons live in the existing `memory/` Markdown records and immutable revision history, with SQLite journals for recoverable writes. There is no new memory store or database migration. Existing backups preserve the metadata and revisions.

Skill lessons are excluded from automatic factual context, unified current/historical retrieval, semantic indexing and the default knowledge map. They remain explicitly inspectable in Skills and Memory. This distinction applies to the new `lesson` records; legacy procedural memories are unchanged. Approved lessons are recommendations for explicit skill review, never automatically injected instructions or client facts.

The Hub editor preserves the pinned skill, evidence and observation type while allowing statement, scope, limitation and date corrections. Re-pinning via the typed memory contract requires a valid exact revision; source reports and previous revisions remain preserved.

See [comparison contract](SKILL_IMPROVEMENT.md), [governance](RULES.md), [storage](FILESYSTEM.md), [generated operations](OPERATIONS_REFERENCE.md) and [local validation](PROCEDURAL_LESSONS_VALIDATION.md). A synthetic demonstration is not proof that a skill improved real work.
