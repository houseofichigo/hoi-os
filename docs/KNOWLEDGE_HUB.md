# Knowledge Hub

The optional Knowledge Hub is a local browser client of the existing HOI engine. No assistant installation or API key is needed for preserved-file intake, wiki editing/review, memory review or map inspection. AI interpretation remains optional.

```sh
npm ci
npm run setup -- --surface hub --workspace "../My HOI Workspace" --non-interactive
npm run hub -- --workspace "../My HOI Workspace" --port 0
```

Alternatively: `node bin/hoi.mjs hub --workspace "../My HOI Workspace" --host local --port 0 --json`. An assistant uses its actual `codex` or `claude` identity, never impersonates local. Open the complete printed localhost URL, including its temporary fragment credential. Do not publish that URL. Stop the process with Ctrl+C; use a new launcher URL after restart.

The seven views retain current behavior: Overview, Sources, Ingestion, Wiki, Memory, Map and Reviews. Add files through Ingestion → selection → manifest review → import. Source originals are preserved; wiki edits use Save draft → Compare → Publish. Memory changes use the same versioned review operations as CLI clients. Map nodes and the accessible list open their existing record/wiki/evidence readers.

For a disposable fictional demonstration after building, run `npm run demo:hub`. It creates a separate temporary workspace containing a source-backed Orchard workshop wiki, with no installed assistant or configured provider. Open its complete printed URL; Ctrl+C stops the demo. This does not touch an existing workspace. Test results and limitations are recorded in [foundation validation](HARNESS_FOUNDATION_VALIDATION.md).

“Ask about this” opens a reference for a configured assistant in the same private workspace. It sends nothing automatically. **Use skill** rechecks the active revision and compatibility, then opens an unsent reference containing its revision/checksum and selected example. The host must resolve it again before use. The Hub does not contain a Chat screen. Related project, client, training, task and proposal links show permitted live properties and wiki links; edits remain registered engine operations. Other legacy workflow links explain the handoff instead of loading retired screens.

`npm run build` (also available as `build:hub`) builds the engine and the Hub/map assets in `dist/hub`. It excludes dashboard, Inbox, CRM, Chat and Electron modules; a build check rejects accidental imports. Wiki, memory and original-file intake use shared components and the same engine. The map remains lazy-loaded with its accessible record list. Shared styles were trimmed to the retained views; the graph chunk remains large and lazy-loaded.

## Standalone local package

From the development checkout, run `npm run hub:stage -- --output "../hoi-hub-candidate"` with a **new destination**. Staging preserves an explicit allowlist, generates a production-only lockfile from the existing dependency cache, and records file checksums in `HUB_PACKAGE.json`. It never replaces an existing destination. A failed stage without that manifest is incomplete. Staging does not publish or install the package.

In the staged directory:

```sh
npm ci --omit=dev
npm run setup -- --workspace "../My HOI Workspace" --non-interactive
npm start -- --workspace "../My HOI Workspace" --port 0
```

This package needs Node 22.14 or newer and compatible native dependencies. It contains the engine, Hub, optional skills, guides and method; it has no Electron, development tooling, legacy frontend or bundled workspace. Both the development checkout and the staged package now open the Hub with `npm start`, `hoi hub` or the compatibility alias `hoi app`. `hoi map` opens the separate read-only map. The old business screens, Electron source, packaging workflow and development dependencies have been retired into a recoverable local archive. Engine operations and workspace records remain available. See [retirement validation](HUB_RETIREMENT_VALIDATION.md).

Use `npm run hub:acceptance -- --output "../HOI acceptance"` from a newly staged package with production dependencies installed for a retained fictional rehearsal. See [installation and acceptance](HUB_INSTALLATION.md) and [fresh assistant-host checks](HOST_ACCEPTANCE.md). No existing workspace is accepted by this command.

See [extraction validation](HUB_EXTRACTION_VALIDATION.md) for the local package rehearsal and remaining platform gates. Removing a package directory is distinct from removing the separate workspace.

The Hub uses the same access controls and lock owner as the full engine. A second launcher for an already-owned workspace must not bypass the lock. Current clients can call the running engine through existing discovery. This is local alpha support, not clean-machine or live-provider certification.
