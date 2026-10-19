# Hosts: Codex, Claude Code and others

The harness is a folder of files in the open [Agent Skills](https://agentskills.io/) format, so any assistant that
reads skills and can work in a folder can run it. Two hosts are what the method is designed and tested around.

| | Codex | Claude Code |
| --- | --- | --- |
| Reads the instructions in | `AGENTS.md` | `CLAUDE.md` → points to `AGENTS.md` |
| Reads skills from | `.agents/skills/` | `.claude/skills/` |
| Start a skill by hand | `$hoi-onboard` | `/hoi-onboard` |
| Owner-only skills set by | `agents/openai.yaml` → `policy.allow_implicit_invocation: false` | `disable-model-invocation: true` in SKILL.md |
| Voice input | Yes | Yes |
| Guard plugin (hooks) | Not verified | Yes — [plugins/hoi-harness-guard](../plugins/hoi-harness-guard/README.md) |
| Scheduled automations | Use the host's own automation feature if available, else run the prompt by hand | Use scheduled tasks if available, else run the prompt by hand |

**Keep `skills/` as the one place you edit.** `install.py` and `hoi-skill-author` run
`skills/_shared/scripts/sync_skills.py`, which mirrors `skills/` into both host folders. Run
`sync_skills.py --check` to see drift.

**Other hosts** (Gemini CLI, Cursor, GitHub Copilot and others) increasingly read Agent Skills too; where they read
from, and how a skill is started by hand, varies. Point the host at the `skills/` folder following its own
documentation, and point it at AGENTS.md (`GEMINI.md` already does for Gemini CLI). The method itself does not depend
on any host feature beyond reading files, running Python, and asking before it acts.

**What every host needs:** Python 3.9 or later (standard library only), git, and permission for the assistant to run
commands in the folder. `pdftotext` (from poppler) is optional: without it, PDFs are read by the host's own reader at
ingestion step 4.

**Changing model.** Nothing in the folder names a model. Change the model in the host, then rerun the whole
evaluation (`$hoi-evaluate`, method step 22): that is how you know the new model does the job.
