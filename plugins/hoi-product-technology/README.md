# HOI Product & Technology

Requirements, architecture decisions and delivery acceptance.

Local candidate 0.1.0. Three skills:

- [hoi-product-requirements](skills/hoi-product-requirements/SKILL.md)
- [hoi-architecture-decision](skills/hoi-architecture-decision/SKILL.md)
- [hoi-acceptance-review](skills/hoi-acceptance-review/SKILL.md)

## Set up for a client

1. Complete company/client onboarding using selected source files.
2. Select only relevant packs. Read [client context](CLIENT_CONTEXT.md).
3. Use hoi-expertise-customize (Chief of Staff pack or HOI catalogue) to prepare and compare a private profile; review exact content and source references.
4. Explicitly select that profile for the correct workspace/client and try a fictional task before live use. Never include private profiles in this package.

The host must support Agent Plugins 1.0 or individual Agent Skills. Import the plugin ZIP into a compatible host; this is a multi-skill plugin, not a single .skill upload. Host installation has not been live-certified. Existing HOI foundation skills require matching HOI engine operations; new draft workflows can use selected material without an engine but cannot claim record verification. No MCP server, credentials, live connector or scheduler is bundled. Profile review does not grant engine permissions.

Package sources are generated from HOI OS skills and expertise metadata. Edit those sources, then run expertise:sync. Read NOTICE.md for upstream research.
