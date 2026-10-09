# Batch E — local desktop app

The desktop app bundles the existing engine and UI. It runs without user-installed Node/Git or skills. The renderer is sandboxed and isolated; the engine owns SQLite in a separate process. Only a validated, main-frame-only bridge may choose a workspace, restart/stop the owned engine, choose an import folder or create an upgraded workspace copy.

First launch offers create/open workspace. Workspace paths come from native dialogs, not renderer strings. Existing unsupported schemas fail visibly. Older supported schemas require verified backup, separate restore and migration of that copy; originals remain available for rollback. Closing/quitting stops owned synchronization and drains work. No hidden service. An active external engine is never bypassed or killed.

Native production packages target macOS arm64/x64 and Windows x64. Packaging uses a staged dependency tree so Electron's SQLite rebuild cannot break Node development. Downloads/checksums stay local. Platform builds and runtime verification must be recorded separately; unsigned artifacts do not establish public install readiness.

Checks: sandbox/main-frame IPC, untrusted navigation/windows, native SQLite/keyring load, fictional import/retrieve/restart, busy shutdown, missing/old workspace, verified copy upgrade, app-only behavior, package containment and private-workspace preservation. Clean-machine verification remains an explicit gate when a machine is unavailable.
