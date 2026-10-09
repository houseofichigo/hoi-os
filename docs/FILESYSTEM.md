# HOI OS filesystem and ownership

Audience: users, administrators and optional assistants. Authority: workspace initialization, intake, backup/restore and record operations in the installed engine. This guide describes storage; it does not authorize direct edits to managed files.

The product checkout or installed app is separate from the selected private workspace. Neither client data nor workspace backups belong in the public product repository.

| Location / concept                                                   | Canonical owner                                                              | Supported changes                                                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `.hoi/os.sqlite`                                                     | Engine records, IDs, relationships, jobs, revisions, approvals and histories | Use registered operations; never edit SQLite as an assistant shortcut                                                     |
| `originals/`, `archives/`                                            | Preserved import bytes, occurrences and archived versions                    | Engine preservation and recovery operations; never overwrite originals                                                    |
| `sources/`                                                           | Descriptive registry; source/revision truth lives in SQLite                  | Intake and source operations                                                                                              |
| `context/profile.md`                                                 | Onboarding goals and profile with access metadata                            | Onboarding operations preserve prior versions                                                                             |
| `memory/`                                                            | Individual attributed/proposed/approved Markdown records                     | Capture and review operations; no second MEMORY.md store                                                                  |
| `wiki/`                                                              | Markdown revisions plus canonical page/revision records in SQLite            | Save draft, compare, publish; keep history                                                                                |
| `policies/`, `capabilities/`, `models/`, `information-architecture/` | Validated configuration and declarations                                     | Supported configuration/capability operations; administrator-only manual changes require compatible validation and backup |
| `connections/` and engine connection records                         | Host attestations and scoped synchronization configuration                   | Connection operations; an attestation is not proof of live OAuth access                                                   |
| `working/`, `executions/`                                            | Working material and workflow artifacts                                      | Preserve provenance and distinguish drafts from approved results                                                          |
| `.hoi/guides/`                                                       | Versioned installed documentation                                            | Reviewed adapter updates; preserve modified files and report conflicts                                                    |
| `.agents/`, `.claude/`, workspace manuals                            | Optional assistant adapters                                                  | Managed installation/update/removal; user text outside managed blocks remains intact                                      |

Additional engine-owned subdirectories may hold skill packages, intake jobs and generated indexes. Inspect the current operation reference rather than guessing paths. Credentials live in the operating-system credential store; local references or runtime files must not be exported as secrets. `.hoi/runtime.json` contains machine-local launch information and is not portable public documentation.

## File lifecycle

Preserve the original, checksum and import occurrence before deriving searchable content. Unsupported material remains preserved with an explicit extraction state. Changed content creates a revision; duplicate content does not justify deleting occurrences.

Working drafts, published wiki revisions and deliberate exports have different lifecycles. AI-generated material retains its evidence, attribution and review state. Client/project associations use stable IDs; a source can support multiple records without copying its original into every folder.

Client/project folders are optional, deliberate exports, not a replacement database. When classification is unclear, retain an unassigned source and seek review rather than inventing a project. Do not reorganize selected upstream folders automatically.

## Recovery and confidentiality

Use the engine backup operation for a consistent snapshot and checksum manifest. Backups contain private knowledge and are not encrypted by this feature. Restore to a separate compatible directory and verify it before upgrading private data. Keep the previous copy; do not open a newer database with an older engine as rollback.

Stop active workspace owners for operations that require exclusive recovery access. Never bypass an active lock. Reconfigure credential references and machine-local runtime paths through supported setup after relocation. Archive/restore of a source is distinct from restoring the entire workspace.

See [governance](RULES.md), [tool conventions](TOOL_CONVENTIONS.md) and the [operation reference](OPERATIONS_REFERENCE.md). Public packages must contain only product material and fictional examples, never private profiles, originals, accounts, credentials or backup contents.

## Schema 19 retrieval and memory additions

`memory/history/<memory-id>/<version>.md` contains immutable memory revisions. The current `memory/<memory-id>.md` remains the authoritative working record; engine journals reconcile multi-file review and replacement writes after interruption. An unexpected external edit stops recovery for reconciliation rather than being overwritten.

`.hoi/models/<model-fingerprint>/` holds the optional verified local embedding model. It is distinct from configuration under `models/`. Search units, vector generations and derived conversation artifacts are stored in SQLite and remain rebuildable; derived summaries do not replace originals or approved records. Downloaded model files are never required for lexical reads. Existing backup verification includes workspace files, including installed model files; do not assume model caches are omitted from backup size.
