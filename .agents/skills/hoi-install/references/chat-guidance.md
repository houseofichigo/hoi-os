# ChatGPT and Claude chat

This is an installation guide, not a remote connection to the user's computer. A chat's code-execution container does not provide the user's local filesystem or persistent HOI SQLite database. Do not run the local setup there and tell the user their computer is installed.

1. Establish macOS or Windows and whether the user will use Codex, Claude Code, or both locally.
2. Read `local-setup.md` and provide its version-pinned commands, with the user's chosen product and private workspace locations. On Windows use PowerShell; on macOS use Terminal.
3. Guide one meaningful stage at a time. When troubleshooting, request the exact error or minimal `doctor --json` output; do not request credentials or entire workspaces. Diagnostic output may contain private source details; `diagnostics --json` is the minimal support alternative.
4. Explain how to open the private workspace in the selected local assistant and start onboarding.
5. State which steps the user confirmed and which remain unverified. Do not claim persistent skill installation because the user attached a Markdown file in a conversation.

Claude: download `hoi-install.zip`, then use **Customize → Skills → + → Create skill → Upload a skill** and enable it. Code execution and skill creation must be available under the user's account/organization settings. Reference: https://support.claude.com/en/articles/12512180-use-skills-in-claude.

ChatGPT: use a supported standalone-skill installation interface where available. Otherwise attach the self-contained `hoi-install.md` to the conversation and ask for guided local setup. The attachment is conversation guidance, not a persistent install. This release does not submit a plugin to a directory. Reference: https://learn.chatgpt.com/docs/build-skills.

Suggested prompt: “Use the attached HOI OS installation guide to help me install v0.1.0-alpha.2 on my computer. Ask for missing setup choices and give me commands for my operating system. Do not claim the local installation is complete until we have checked its diagnostics.”
