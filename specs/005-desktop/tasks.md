# Batch E tasks

- [x] Sandboxed renderer, isolated preload and bounded navigation/network policy.
- [x] Separate engine process, native workspace selection, engine status/restart and quit drainage.
- [x] App-only first launch; optional adapters and native source-folder selection in Configuration.
- [x] Explicit verified backup / restore / upgraded-copy workflow; original workspace retained.
- [x] Electron and native dependency staging isolated from developer Node modules.
- [x] Architecture-specific packaging scripts with publication disabled.
- [x] Core bridge tests and real Electron lifecycle tests using fictional data.
- [x] Local macOS arm64 packaged smoke tests and all three artifact checksums. Intel/Windows execution remains below.
- [ ] Clean-machine macOS arm64/x64 and Windows installation/uninstallation verification.
- [ ] Distribution signing/notarization before a public installer experience can be claimed.

The last two items are platform/release gates, not synthetic-test claims. No private workspace migration or GitHub update is part of this batch.
