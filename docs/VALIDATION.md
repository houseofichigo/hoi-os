# Validation and limits

All 21 skills were checked with the skill-repo-forge static auditor (`--target all`). Package validation includes frontmatter, references, selected secret patterns, ZIP paths and checksums. Static checks do not prove live assistant execution, safe interpretation of arbitrary input or complete absence of confidential content.

This publication contains only skill instructions, public catalogue metadata, documentation, licences, validation tooling and ZIPs generated from those files. No private workspace, application binary, application source update, provider key or OAuth token is included.

Run `python3 scripts/verify.py` to verify this checkout and its bundled archive bytes. CI runs that check; it does not execute imported skill instructions.

Fresh assistant installation, live providers, the separate app's clean Mac/Windows installation and real-use pilot remain unverified by this skills publication.
