# Separate app availability and setup

This repository now distributes skill instructions only. The separate HOI OS app is still in development and is not published here. Cloning this repository does not install an engine. Do not run npm setup commands in this skills-only checkout or generate a substitute app.

## Existing compatible app

If the user already has a compatible HOI OS app, inspect its documented runtime and compatibility before installing any operational skill. The current instructions target engine API 1 and workspace schema 17, plus each skill's required operations in `skills/contracts.json`. Do not infer compatibility from a product name or version string alone.

Select the user's private workspace explicitly. Follow that app's own onboarding and managed adapter installation instructions for Codex, Claude Code or both. App-only use remains valid. Keep user-edited manuals and skill revisions; report conflicts rather than overwriting them. Verify runtime availability and discovery separately from copying instructions.

## No compatible app available

Explain that these operational skills are a preview for inspection, adaptation and contributions. Do not claim a working engine connection or fabricate an installer URL. The separate app will be published after its release checks. No model subscription or account connection is included with this package.

## Historical version

The historical `v0.1.0-alpha.2` release at https://github.com/houseofichigo/hoi-os contains the earlier assistant-led engine. It is preserved for history, not the compatible runtime for this skills preview. Never install these new skills against that release without a verified compatibility check. Do not downgrade or migrate a private workspace as an installation side effect.

## Recovery

Before any future app upgrade, verify a backup and restore it into a separate directory using the matching app documentation. Keep original data and backups out of this repository. Never bypass an active engine lock or silently impersonate the local app from an assistant host.
