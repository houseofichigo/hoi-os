# House of Ichigo OS

A local operating layer for knowledge, decisions, and meeting preparation. Bring your own Claude Code or Codex access. Keep private information on your computer, separate from the product repository.

**v0.1.0-alpha.2 · Public evaluation prerelease.** See [validation](docs/VALIDATION.md) and [stable-release gates](docs/ACCEPTANCE.md).

## Download installation skill

[Download hoi-install.zip](https://github.com/houseofichigo/hoi-os/releases/download/v0.1.0-alpha.2/hoi-install.zip) · [Download chat guide](https://github.com/houseofichigo/hoi-os/releases/download/v0.1.0-alpha.2/hoi-install.md) · [Download all 12 operational skills](https://github.com/houseofichigo/hoi-os/releases/download/v0.1.0-alpha.2/hoi-os-skills.zip) · [Checksums](https://github.com/houseofichigo/hoi-os/releases/download/v0.1.0-alpha.2/SHA256SUMS)

The installer skill guides setup. The operational skills require the installed core and a private workspace; downloading them alone does not install the OS. The collection ZIP is not a single-skill upload.

**Claude chat:** upload `hoi-install.zip` through **Customize → Skills → + → Create skill → Upload a skill**, enable it, and ask: “Use hoi-install to help me install HOI OS on my computer.” Account/organization settings must allow skills and code execution. [Official instructions](https://support.claude.com/en/articles/12512180-use-skills-in-claude).

**ChatGPT:** install the standalone guide where your interface supports skills. Otherwise attach `hoi-install.md` and ask: “Use this guide to help me install HOI OS on my computer. Ask for missing setup choices and check my diagnostic results.” An attachment provides conversation guidance, not a persistent skill installation. No plugin-directory submission is included. [Official skill documentation](https://learn.chatgpt.com/docs/build-skills).

Chat-only guidance cannot access your local database or install software on your computer. A cloud code-execution container is not your local workspace.

## Install with Codex

Paste into a local Codex session:

```text
Install HOI OS v0.1.0-alpha.2 from https://github.com/houseofichigo/hoi-os.
Read skills/hoi-install/SKILL.md at that tag and follow its local setup guide.
Use the Codex adapter. Ask only for missing product and private workspace locations.
Preserve existing files, run diagnostics, then help me open the private workspace and use $hoi-onboard.
```

If Codex cannot fetch the guide, download and attach `hoi-install.md`. Installation requires local execution on your intended computer.

## Install with Claude Code

Paste into a local Claude Code session:

```text
Install HOI OS v0.1.0-alpha.2 from https://github.com/houseofichigo/hoi-os.
Read skills/hoi-install/SKILL.md at that tag and follow its local setup guide.
Use the Claude adapter. Ask only for missing product and private workspace locations.
Preserve existing files, run diagnostics, then help me open the private workspace and use /hoi-onboard.
```

## Manual installation

Install [Git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org/en/download) first. Node 22.14+ is required; Node 22 and 24 are the tested release lines. npm ships with Node. You need your own assistant access; a separate model API key is optional.

These commands work in macOS Terminal and Windows PowerShell. Use a new product directory and a private workspace outside it:

```sh
git clone --branch v0.1.0-alpha.2 --depth 1 https://github.com/houseofichigo/hoi-os.git hoi-os
cd hoi-os
npm ci
npm run setup -- --workspace "../HOI Workspace" --hosts both --non-interactive
node bin/hoi.mjs doctor --workspace "../HOI Workspace" --host codex --json
```

Choose `--hosts codex` or `--hosts claude` to install only one adapter. Match the doctor host to your selected assistant. Setup builds the product, preserves unrelated manual content, and installs workspace-scoped skills without changing global assistant configuration.

Open **HOI Workspace** in Codex or Claude Code, then use `$hoi-onboard` or `/hoi-onboard`. New empty workspaces may report `BACKUP_MISSING`; take a backup before importing valuable information. Existing-workspace setup takes a verified backup before refreshing adapters.

Optional map:

```sh
npm start -- --workspace "../HOI Workspace" --host codex
```

Use `--host claude` for Claude Code. Open the authenticated localhost URL printed by the command. Opening `web/index.html` does not run the app. Use `--port 0` if a port is occupied.

## Included operational skills

<!-- skills:start -->

| Skill                  | Purpose                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `hoi-3d-map`           | Open the local HOI knowledge map with source-backed relationships and temporal views.              |
| `hoi-audit`            | Inspect evidence health, extraction gaps, connections, and memory freshness in HOI OS.             |
| `hoi-build-capability` | Define, evaluate, and activate a bounded HOI workflow using registered tools.                      |
| `hoi-capture`          | Record user-supplied decisions, preferences, or experience as reviewable HOI memory.               |
| `hoi-connect`          | Check available Gmail, Calendar, Drive, or GitHub host tools for a selected HOI workspace.         |
| `hoi-consolidate`      | Find duplicate, stale, and proposed HOI memories for review.                                       |
| `hoi-evaluate`         | Run reproducible evidence retrieval checks for a HOI capability.                                   |
| `hoi-ingest`           | Preserve and register selected local files or host-exported sources in HOI OS.                     |
| `hoi-meeting-prep`     | Prepare a cited client meeting brief using HOI knowledge and available read-only host connections. |
| `hoi-onboard`          | Build or update a personal HOI OS profile through a short, resumable conversation.                 |
| `hoi-organize`         | Propose and apply a reviewable working-folder organization while preserving originals.             |
| `hoi-retrieve`         | Find source-backed information and bounded context in HOI OS.                                      |

<!-- skills:end -->

The machine-readable [catalog](skills/catalog.json) records descriptions, versions, resources and runtime requirements. `hoi-install` is the additional installation guide.

## Capabilities and boundaries

- Preserved originals, checksums, revisions, passages, evidence references and metadata-filtered search.
- Markdown/text, PDF text, DOCX, PPTX, XLSX and CSV intake; optional image OCR through a separately installed Tesseract.
- Meeting evidence briefs, reviewed decisions, bounded context, approvals and execution history.
- Optional read-only localhost 3D map, with project/client/memory/timeline views and a keyboard-accessible record list.
- Explicit read-only host exports for supported connections; no bundled credentials or implied OAuth access.
- Verified backup/restore, diagnostics, crash recovery and separate private workspaces.

The assistant performs reasoning. Citation checks do not prove factual support. HOI policies govern HOI commands; other assistant tools keep their own permissions. No autonomous sending, publishing, financial mutation, scheduling or telemetry is included.

## Compatibility and verification

| Surface             | Supported experience                                                        | Verification status                                               |
| ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Local macOS         | Full core, scoped adapters, optional map                                    | Local automated installation/core/browser checks pass             |
| Local Windows       | Same Node setup and core                                                    | Node 22/24 CI passed; fresh interactive host checks pending       |
| Codex / Claude Code | 12 operational skills and installer                                         | Package/setup verified; fresh user-session acceptance pending     |
| ChatGPT             | Installation guide where skills are supported; Markdown attachment fallback | Guidance package verified; account-specific UI acceptance pending |
| Claude chat         | Installer ZIP upload; guided local setup                                    | ZIP structure verified; account-specific UI acceptance pending    |

Publishing this prerelease does not complete the [real-data pilot](docs/PILOT.md), independent client pilots or stable-release gates.

## Updates, recovery and development

For updates, retain your existing checkout and use a new release-specific checkout. Run setup against the existing private workspace; it takes a verified backup before changing adapters. Never run a destructive Git reset or copy private information into the product repository. Read [operations and recovery](docs/OPERATIONS.md).

```sh
npm run check
npm run format:check
npx playwright install chromium
npm run test:browser
npm run package:release
```

Release packaging is deterministic and writes four assets under `release/v0.1.0-alpha.2/`. Playwright is a development dependency; users do not need its browser to use the app. `npm run demo` runs a fictional temporary workspace after building.

Read [CLI reference](docs/CLI.md), [architecture](docs/ARCHITECTURE.md), [connections](docs/CONNECTIONS.md), and [provenance](docs/PROVENANCE.md).

## License and attribution

Code and skill instructions are [MIT licensed](LICENSE). See [trademark and logo terms](TRADEMARKS.md) and [third-party notices](THIRD_PARTY_NOTICES.md). AIS-OS inspired the interaction patterns; this implementation does not redistribute its code or named frameworks.
