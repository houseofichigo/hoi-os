<<<<<<< HEAD
# Chat-only installation guidance

A conversation attachment is a guide, not a persistent skill installation or connection to the user's computer. Cloud execution does not provide the user's local HOI database.

1. Reuse the known operating system, product/workspace paths and adapter choice. App-only is a valid choice for compatible product versions.
2. Read [local setup](local-setup.md). Separate current local-checkout commands from the historical published release. Do not claim unreleased desktop downloads exist.
3. Give commands for macOS Terminal or Windows PowerShell one meaningful stage at a time. If the user cannot execute locally, explain what remains unavailable; never generate a replacement app.
4. Interpret minimal user-supplied diagnostics or errors. Never request tokens or entire private workspaces.
5. For app-only setup, hand off to Home. For optional installed adapters, help the user open the private workspace and verify skill discovery before `hoi-onboard`.

Where the chat interface supports skill-folder uploads, use the individual `hoi-install.zip`. Otherwise attach `hoi-install.md` as conversation guidance. Do not equate an attachment with persistent installation. Report successful steps only from execution evidence or explicit user confirmation.
=======
# Chat-only guidance

This package supplies instructions, not access to the user's computer. A cloud container is not the user's local workspace.

Read [app availability and setup](local-setup.md) first. Explain that the separate app is not yet publicly released. Do not invent an installer or offer the historical release as the compatible current app.

If the user already has a compatible app, reuse known paths and adapter choices and follow its own documentation. Ask only for missing information. Never ask for credentials or a complete private workspace. Verify discovery in the selected assistant before claiming installation succeeded.

An individual skill-folder ZIP can be inspected or imported where supported. Importing instructions does not provide the registered HOI engine operations. Otherwise, attaching Markdown provides conversation guidance only. Do not claim universal host execution from a static package check.
>>>>>>> 66fcc668b3a4e0085bdc3eb3d23209fadb2ba052
