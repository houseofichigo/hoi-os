# HOI OS v0.1.0-alpha.2

Public evaluation prerelease for macOS and Windows, with local Codex and Claude Code adapters.

- 14 operational skills and a new `hoi-install` guide.
- Downloadable installer ZIP, self-contained chat guide, operational collection and SHA-256 checksums.
- MIT-licensed code and skill instructions; separate HOI trademark terms.
- Version-pinned installation, a generated skill catalog, and complete runtime packages.
- Local-first core, preserved originals, cited retrieval, meeting briefs, reviewed decisions, verified recovery and optional knowledge map.

ChatGPT and Claude chat downloads guide local setup. They do not provide access to a local database or install the full OS merely by being uploaded. Account-specific skill interfaces may require different setup steps; use the Markdown attachment fallback where needed.

See the README compatibility table and `docs/VALIDATION.md` for measured checks. Fresh interactive assistant sessions, real-data evaluation, independent client pilots and stable-release acceptance remain pending. No claim of a stable release is made.

## Maintainer publication

Run `npm ci`, `npm run check`, `npm run format:check`, `npm run test:browser` and `npm run package:release`. Review the exact staged file list before the initial commit: only this standalone product belongs in GitHub. Keep `.local`, `release`, test reports, private workspaces and backup data excluded.

The Verify workflow runs on main pushes and pull requests. The Prerelease workflow runs on alpha tags or an explicit Run workflow request; it repeats the platform matrix and browser checks before building and publishing the four release assets. Only the publish job has contents-write permission. A failing verification blocks publication. A manual run checks the requested version and creates the tag at the exact verified commit when publishing.

Do not move a published tag or replace an existing prerelease. Fixes require a new version. After publication, download each public asset and compare it with `SHA256SUMS`; verify the README's four download links.
