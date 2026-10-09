# HOI Knowledge Core — local alpha

The schema-15 Knowledge Core adds stable page identities while preserving old wiki revision IDs and source citations. No Obsidian dependency, provider installation, private migration or GitHub publication is included.

## Ownership and editing

A page has a stable `page_…` identity; immutable `wiki_…` revisions retain their Markdown snapshots. Database lifecycle state is authoritative. The Markdown file describes the saved snapshot, not the page's current publication state. Save writes the snapshot before committing its references; interrupted transactions may leave a recoverable unreferenced file, but cannot replace published content. Backup preserves these files and all revision/identity records.

Existing explicit supersedes chains receive deterministic page identities during migration. Same-title or same-slug records outside an explicit chain are not automatically merged. Legacy content keeps page-level evidence; no paragraph citations are invented.

Users save drafts, compare content/properties/evidence, and explicitly publish. Publication binds the page, revision, current version and base published revision. Replays are idempotent. Assistant hosts cannot publish or create personal attribution. Unknown effective dates stay unknown. Restoring a revision creates another draft.

Structured records remain authoritative for task status, deadlines, owners and progress. Wiki related-record panels read current values rather than maintaining a competing copy.

## Interfaces

The shared operation family is `wiki`. Schema 15 adds `pages`, `page`, `save`, `compare`, `publish`, `history`, `restore`, `primary`, `node`, `backlinks`, `taxonomy`, `tag`, `tag-merge`, `templates` and `search`. Existing legacy commands remain available for legacy revisions. New revisions reject legacy canonical/review calls so they cannot bypass version checks.

Authenticated app routes use `/api/wiki-core`. Read routes include `/page/:id`, `/compare/:id`, `/history/:id`, `/node/:id`, `/backlinks/:id`, `/templates`, `/subjects`, `/taxonomy`, and `/search?q=…`. Mutations are `/save`, `/publish`, `/restore`, `/primary`, `/taxonomy` and `/tag-merge`. Engine schemas validate all mutations. Assistant principals remain bound to their host credentials.

`retrieve` retains its original source `results` and adds `wikiResults` to avoid breaking passage consumers. Wiki results identify page, exact revision, block, provenance, attribution and supporting evidence. Chat answers may additionally provide `wikiCitations` with pageId, wikiRevisionId, blockId and quote; these must match supplied, accessible published knowledge.

## Classification and map

Templates cover clients, projects, people, offerings, training, topics, processes and decisions. Topic vocabulary is controlled; French/English aliases and reviewed merges are supported. Tag redirection preserves historical originals. Tags do not create evidence-backed graph edges.

Primary wiki assignment is explicit. Published pages appear once in the map; drafts and old revisions remain in the editor/history. Every existing map node remains inspectable; associated knowledge is shown when the engine can resolve it. Pages without a primary assignment are presented as choices. The accessible list uses the same interaction.

## Accuracy and limitations

Published is a lifecycle state, not certification. Attributed user statements carry a recorded author/time and are separate from source-backed content. Questions/unverified blocks are omitted from factual wiki retrieval. Assistant interpretation remains explicit handoff.

Retrieval uses bounded lexical matching plus aliases and explicit subject scope. It has no embeddings, translation model, semantic contradiction detector or new external search provider. Unknown or conflicting material remains reviewable. Deterministic findings cover changed evidence, recorded contradictions, due review dates, unavailable links and existing duplicate checks. Human review of factual support and the real-data pilot remain required.

The UI is a safe Markdown reading/editing surface; raw HTML and executable embeds are not rendered. The preview currently supports basic headings and text rather than a full document-layout editor. Source original opening continues through existing authenticated source views.

## Local validation

The wiki regression collection includes 30 labelled fictional bilingual queries (24 answerable, six missing-answer cases), exact evidence resolution, legacy migration, review boundaries, permission revocation, stale versions, publication retries, tag redirects, interrupted SQL writes, backup/restore and Chat citation validation. These checks do not establish 95% factual support on real AI-authored briefs; that requires the human-reviewed pilot.

Verified on macOS arm64 on 2026-09-27: **192 core tests, 34 browser tests and 2 Electron tests passed**. The runtime skill mirrors/catalogue also match. [Build-specific evidence](verification/knowledge-core-2026-09-27.json) records the exact build and suite digests.

The browser wiki flow covers persisted drafts, publication, reload, map opening and widths of 390, 768, 1280 and 1440 pixels. The Electron regressions cover renderer isolation, import, bundled CLI, restart, shutdown and a verified upgraded workspace copy. They do not constitute Windows verification or a full assistive-technology audit.

The 30-query fixture is an alias-based lexical retrieval regression, not a substitute for the broader human-labelled acceptance collection covering realistic paraphrases, conflicts and missing answers. The ≥95% reviewed factual-support target and ten-day pilot remain unverified.

A separate fictional demo workspace is available while its local server runs at http://127.0.0.1:53358/app?view=knowledge&section=Wiki. It includes cited Cedar project context, an attributed preference and an open question. No private workspace was migrated and nothing was pushed or published to GitHub.
