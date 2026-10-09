# Reviewed transcript intake

Local schema-16 enhancement; no migration or GitHub publication.

In Inbox → Transcripts, upload one document through the existing manifest review, or select an active Knowledge Hub document. Review the original extracted passages, optionally attribute a speaker to each passage, select a project or retain Standalone, and optionally supply an exact meeting time with timezone. Unknown meeting dates remain null; import dates are not meeting dates. Mixed-speaker passages may keep a blank speaker label; the original text remains available to extraction.

Confirming review creates an intake interpretation that references the existing source revision and original file. It creates no additional source, copied document or accepted task. The same reviewed input reuses its intake record. Speaker labels are explicitly user-confirmed interpretation, not altered original text. Source changes and archived/denied sources invalidate the review.

The next step prepares a bounded assistant request. Copy to Codex/Claude; paste the structured response into the dedicated response exchange. Validation requires the exact run/digest and original passage quotes. Review extracted mentions and duplicate candidates below, then approve task proposals separately. Instructions inside the transcript cannot authorize actions. Unknown owners/deadlines remain unknown.

Shared operations: `intake transcript-preview --input <json>` and `intake transcript-commit --input <json>` (use the CLI's documented JSON-input convention); authenticated API `/api/intake/transcript-preview` and `/api/intake/transcript-commit`. Both use the same engine checks. Confirmation is local-user-only; assistant hosts cannot mark their own speaker interpretation as user-confirmed. No new schema is introduced.

Limits: text extraction must succeed first. Audio/video transcription is not configured. Passages larger than 12,000 characters or documents over 300 passages are rejected with a smaller-document instruction; extraction's existing context limit is also enforced. This workflow retains explicit assistant handoff; it does not start a paid model call or approve suggestions automatically.

## Validation — 2026-09-28

205 core, 36 browser and 2 Electron checks passed against the final build. Added tests cover one-source upload/review, unknown meeting dates, assistant-host confirmation denial, exact extraction validation, idempotent reuse, archived sources and one accepted standalone task. The fictional Inbox demo runs on localhost; private data and GitHub were not changed. The previously built desktop ZIP predates this enhancement; current Electron verification uses the refreshed local stage.
