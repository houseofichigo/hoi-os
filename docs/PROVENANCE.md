# Provenance

- Product requirements: the user's HOI OS strategic brief and approved development plan, September 17, 2026. The original brief and checksum are preserved in the parent company's dated archive, outside this distributable repository.
- AIS-OS: https://github.com/nateherkai/AIS-OS . Reviewed for local skills, onboarding, shared manuals, audit patterns and visualization. This implementation uses those architectural ideas; no AIS-OS source files or trademarked frameworks were copied into the product. Its Three Ms and Four Cs remain attributed to Nate Herk if referenced elsewhere.
- Personal Workspace: selected file-extraction patterns, source-revision handling, review and recovery ideas were adapted from the user's local application. Its database, originals, credentials, user data and live service were not copied or changed.
- Brand: the user's House of Ichigo branding skill v3.1 supplies tokens and logo. The local map removes the remote font import and bundles the matching licensed fonts. The display-heading tracking override follows BRAND.md rather than the contradictory negative value in the token file.
- Visualization: React, react-force-graph-3d and its Three.js stack render recorded nodes and relationships. No upstream AIS-OS globe or decorative animation is bundled.
- SQLite: better-sqlite3 is used because this machine's Node 22.14 built-in SQLite lacks FTS5. The database still lives locally in a single workspace file.

Third-party dependencies retain their own licenses. See THIRD_PARTY_NOTICES.md and the license files distributed with installed packages. Product examples are fictional; they contain no HOI client data.
