---
name: hoi-install
description: "Use when requested to locate, install or verify the existing HOI OS product and optional workspace adapters, or guide chat-only users through a documented local installation. Does not generate an app."
license: MIT
---

# Install or verify HOI OS

HOI OS is an existing product whose engine runs ingestion, retrieval, audits, projects and map data. Skills are optional clients. Never scaffold, generate or substitute a replacement application when asked to install HOI OS. Downloading this guide does not install the engine or grant access to a private workspace.

## Select the supported path

Determine whether execution is on the user's intended computer; a cloud container is not that computer. Reuse known product/workspace locations and adapter choices. Ask only for missing choices. App-only is valid where the selected product supports it; assistants are optional.

- **Local execution:** read [local setup](references/local-setup.md). Inspect any existing installation and its compatibility facts before changing it. Verify first when the product is already installed. Select a documented release for a new download; never invent a release URL or apply unreleased commands to an older tag.
- **Chat-only:** read [chat guidance](references/chat-guidance.md). Provide supported commands for the user's computer and interpret supplied diagnostics. Do not claim access to the user's machine or install into an ephemeral environment as a substitute.

Keep private data outside the checkout. Preserve nonempty directories, edited manuals and skills. Updates require stopping the old engine, a verified backup and release-compatible migration guidance. An active engine lock must never be bypassed. Do not change global assistant settings, connect accounts or ingest company documents as an installation side effect.

## Verify and hand off

Report the product version, engine/API compatibility when supported, selected workspace, adapter states and diagnostics. Distinguish bundled instructions, installed adapters and an available assistant runtime. A verified skill package alone does not prove an assistant is installed or has loaded the skills.

For app-only users, open Home and explain selected-source intake. With a verified compatible adapter, open the private workspace in Codex or Claude Code and hand off to `hoi-onboard`. If a tool or prerequisite is missing, give the repair step and retain an unverified state. Only execution evidence or explicit user confirmation supports a successful-installation claim. No API key is mandatory.

## Workspace guidance

When the installed adapter provides guide metadata, follow its managed manual links to governance, filesystem ownership and tool conventions under `.hoi/guides/`. A missing or modified guide requires a reviewed adapter update; never overwrite custom instructions to repair it. Older releases may not provide guides. Markdown cannot grant permissions, enable tools or approve proposals. Keep goals in onboarding context and memory in reviewed records rather than creating competing root state files.
