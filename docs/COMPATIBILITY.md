<<<<<<< HEAD
# Current local compatibility

Generated from package, protocol, schema and skill manifests. Do not edit by hand.

- Status: **unreleased local checkout**; tagged downloads keep their historical contents.
- Package base version: 0.1.0-alpha.2 (not a new release).
- Engine API: 1.
- Current workspace schema: 19.
- Readable/upgradeable schemas: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19.
- Node: >=22.14.0 (developer/browser installation).
- Bundled instructions: 21 skills, including 20 operational skills and one installer guide.
- Adapters: optional Codex and Claude Code, scoped to the private workspace.
- Desktop: local Electron staging and packaging are available; released installers and clean-platform verification remain separate gates.

Compatibility is checked using API version and operation requirements; a matching base package version alone does not prove a compatible unreleased checkout. Native Windows execution and real assistant-session discovery still require verification.
=======
# Compatibility

Skills package: **0.2.0-alpha.1**, independent of the app release number.

- 21 skills, including the installation/availability guide.
- Target engine API: **1**; verified local workspace contract: **17**.
- Per-skill required operations: `skills/contracts.json`.
- Separate new app: **not publicly released**.
- Historical engine `v0.1.0-alpha.2`: not a compatible substitute.
- Intended adapters: local Codex and Claude Code; fresh end-to-end host verification remains pending.
- Other hosts may inspect/adapt instructions; no universal runtime compatibility claim.

The packaged metadata describes requirements, not a connection or permission grant. The app must validate compatibility and permissions at runtime. Do not change host identity to bypass denied operations.
>>>>>>> 66fcc668b3a4e0085bdc3eb3d23209fadb2ba052
