# Workspace App

The Workspace App is a local, single-user web interface over a private HOI OS workspace: Home (source-backed search), Brain (declared entities), Wiki (review and promote pages), Sources (ingested originals and attested connections), Memory (approve or reject proposals), and a link to the 3D Memory Map. It applies the House of Ichigo brand: white ground, Ink text, Cobalt actions, rules instead of boxes, no gradients or shadows.

## Start

```
node bin/hoi.mjs app --workspace "../HOI Workspace" --host claude
```

Open the authenticated URL the command prints (default port 4641; use `--port 0` for any free port). The server binds 127.0.0.1 and every API call requires the printed bearer token. The app holds the workspace write lock while running, so stop it before running write commands from the CLI.

## Boundary

The app exposes exactly four mutations, all of them reviews of work an assistant proposed: `POST /api/wiki/propose`, `POST /api/wiki/review`, `POST /api/wiki/canonical`, and `POST /api/memory/review`. Everything else is read-only, and the separate `map` command keeps its original read-only surface (`graph`, `wiki`, `passage`, `original`). Ingestion, onboarding, organization, connections, and capability runs stay in the assistant through the HOI skills, where the propose→approve→apply governance applies.

The app API is an audited local convenience surface, not a security boundary against the assistant itself: an assistant with shell access can edit workspace files directly, as the architecture documentation states. Use host runtime permissions for that boundary.
