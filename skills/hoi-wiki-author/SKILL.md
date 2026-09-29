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
