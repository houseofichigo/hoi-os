---
name: hoi-install
description: Install or update HOI OS from its official GitHub release in a local Codex or Claude Code workspace, or guide a ChatGPT or Claude chat user through local installation.
---

# Install HOI OS

Install the full HOI OS alpha and its 14 operational skills, then hand off to onboarding. Installing this guide alone does not install the core, connect accounts, or grant access to a local database.

## Choose the execution path

Determine whether the active tools can execute commands on the user's intended computer. A temporary cloud container is not that computer. Use existing context for the operating system, product location, private workspace location, and preferred adapters (`codex`, `claude`, or `both`). Ask only for missing choices; keep the private workspace outside the product checkout.

- **Local execution available:** read [local setup](references/local-setup.md), inspect prerequisites and the chosen directories, then perform the requested install within existing host permissions. Use release `v0.1.0-alpha.2` from `https://github.com/houseofichigo/hoi-os`.
- **Chat-only or uncertain execution location:** read [chat guidance](references/chat-guidance.md). Provide the commands for the user's computer. Interpret diagnostic output they supply, but do not install into an ephemeral container and call that a local installation.

Keep knowledge and credentials private. Do not upload a workspace to GitHub, change unrelated global assistant configuration, install optional connectors, or ingest documents as part of setup.

## Existing installations and failures

Never overwrite a nonempty destination or discard uncommitted changes. For updates, use a separate checkout of the release, retain the prior checkout, stop the old map, and run setup against the existing private workspace. Setup must complete its verified backup before refreshing adapters. If prerequisites, permissions, backup, build, or diagnostics fail, report the concrete failure and the next repair step; do not continue to onboarding as though setup succeeded.

## Completion evidence

Report the installed version, product and workspace locations, selected adapters, diagnostic outcome, and any warnings. Confirm these from command results when available; in chat-only mode identify them as user-reported and keep unverified steps explicit. Operational skills are workspace-scoped by default.

Open the private workspace in the chosen local assistant. Invoke `$hoi-onboard` in Codex or `/hoi-onboard` in Claude Code. The optional map starts through `npm start`; opening `web/index.html` does not run the app. No model API key is required for local setup; users bring their own assistant access.
