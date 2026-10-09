# Implementation plan

1. Keep the existing engine owner in a separate Electron-as-Node child process. Use the same authenticated HTTP registry for app and CLI; no database API in the renderer.
2. Restrict the preload to fixed workspace/lifecycle actions and native selection. Validate the sender frame and selected origin. Deny renderer networking outside the engine and packaged setup assets.
3. Stage an explicit product allowlist with independent production dependencies. Rebuild only the staged SQLite package against the selected Electron ABI, preserving the developer Node tree. Package one matching architecture at a time with publication disabled.
4. Exercise synthetic workspace creation, intake, optional adapter installation, bundled CLI, restart, quit and explicit backup/restore-upgrade. Record clean-machine and platform gaps separately.
5. Keep source, scripts, docs and unsigned local artifacts private to this implementation until the final release gates.
