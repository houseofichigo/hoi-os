---
name: hoi-wiki-author
description: "Use when requested to create or revise cited HOI wiki drafts for clients, projects, people, offerings, topics and decisions; resolve existing pages first and preserve evidence, attribution and revision history."
license: MIT
---
# HOI Wiki Author

Use the local HOI engine through `.hoi/runtime.json`: prefer its `command.executable` and `command.args`; otherwise use the documented Node entrypoint. Match `--host codex|claude` to the actual host, never elevate to `local`. Requires schema 15. Read [the authoring contract](references/authoring.md) before writing.

Resolve existing pages with `wiki pages`, `wiki search` and `wiki node`. Match stable subjects and explicit aliases; do not merge similarly named clients or pages. Use `wiki templates` and `wiki taxonomy` as the maintained source of templates and tags.

Extract supported statements into source-backed blocks with exact revision, passage and quote references. Keep unanswered questions as question blocks. Unsupported factual ideas remain unverified drafts. Preserve effective dates when supplied; never substitute import time.

Use `wiki save --input <file>` to submit a version-checked draft. Inspect `wiki compare <page-id>` and hand the proposed change to the user. Do not publish, assign primary pages or change taxonomy on your own. A request to write a wiki does not authorize publishing it.

Only local user input can create attributed personal statements. Never relabel assistant-generated claims as user-authored. Existing attributed blocks can be carried forward unchanged, with attribution retained by the engine.

Live tasks, deadlines and project status stay in their structured records. Link those records rather than keeping competing editable copies in prose. Skill instructions do not grant access to restricted sources or execute tools by themselves.


## Unified retrieval and reviewed memory (schema 19)

Discover engine compatibility and registered operations first. On schema 19, prefer `knowledge search --input <file>` for ranked, bounded source/wiki/approved-memory evidence, then `knowledge evidence --input <file>` to resolve exact references with current permissions. Retain each kind, revision, attribution, effective date and coverage; a reviewed preference is not independent corroboration. Derived conversation summaries locate original passages and must not be cited as independent facts. Local semantic search is optional: report lexical fallback honestly; never download a model or change scope merely to answer a question.

Use `memory list`, `memory get` and `memory history` for inspection. `memory propose --input <file>` requires a unique request key and creates a proposal only. Review and retirement require the local user's exact version/checksum review; assistants cannot self-approve or claim user authorship. Corrections identify the predecessor and preserve history. Do not write memory Markdown directly or create a competing MEMORY.md. On older engines retain supported reads and report the upgrade requirement rather than bypassing review.
