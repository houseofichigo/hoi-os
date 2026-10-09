# Workspace App

The current unreleased app is a local workspace interface over the HOI engine: Home, Inbox, Projects, Clients, Knowledge Hub, Chat, Skills and Configuration. Knowledge Hub contains sources, ingestion, wikis, memory, map and reviews. Chat has evidence-linked results and a shared Activity drawer. Skills are optional instructions; core features do not depend on installing them.

## Start

```
node bin/hoi.mjs app --workspace "../HOI Workspace" --host local
```

Open the authenticated URL the command prints (default port 4641; use `--port 0` for any free port). The server binds 127.0.0.1 and every API call requires the printed bearer token. The running engine owns workspace writes. Compatible CLI and assistant requests connect to that engine; they must not bypass its lock. Restarting changes the browser session token.

## Boundary

The authenticated app and CLI use the shared operation registry for intake, records, proposals, reviewed wiki/memory updates, scoped connections and optional AI generation. Discover current contracts through the [generated operation reference](OPERATIONS_REFERENCE.md). Read permission, source visibility, provider disclosure and domain approval checks are enforced by the engine. The separate map command retains its read-only surface.

OpenAI and Anthropic configuration is optional and requires separate secure credentials and disclosure. Assistant handoff is an alternative. Approved Google draft/preparation-event workflows retain exact-action review; email sending is unavailable. Implemented features are not automatically live-provider certified.

The app API is an audited local convenience surface, not a security boundary against the assistant itself: an assistant with shell access can edit workspace files directly, as the architecture documentation states. Use host runtime permissions for that boundary.

## Versioned assistant guides

App-only setup remains the default and does not generate assistant manuals. Optional adapter installation supplies a versioned guide bundle and managed manual links. Configuration reports documentation-update-needed for old, missing or modified bundles; package integrity does not prove an assistant session is available. Updates preserve user edits and record conflicts. See [governance](RULES.md), [filesystem ownership](FILESYSTEM.md) and [tool conventions](TOOL_CONVENTIONS.md). The current local app supports configured provider generation as well as explicit assistant handoff; earlier handoff-only descriptions belong to older releases.

## Setup choices

Developer/browser setup uses `npm run setup -- --workspace "../HOI Workspace" --hosts none`. Select `codex`, `claude` or `both` only when installing optional adapters. Desktop first launch creates/selects a workspace using the bundled runtime. Before upgrading private data, verify a backup and restore a separate copy as described in [recovery](OPERATIONS.md). Guide updates do not require a schema migration.
