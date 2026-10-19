# Contributing

1. Read [BRIEF.md](BRIEF.md) §1: every decision has a reason. A change that contradicts one is a method change — say
   which decision, and why it should change.
2. Edit skills in `skills/` only, following `skills/_shared/references/skill-template.md` and `writing-rules.md`.
3. Scripts: Python 3.9+, standard library only, no network, no installs, deterministic work only.
4. Before a pull request:
   ```bash
   python3 scripts/validate_repo.py
   python3 scripts/test_scripts.py
   python3 scripts/make_lock.py          # if a skill changed; its status goes back to in-test
   ```
5. No real person, client or organisation anywhere; addresses on `.example` or `.invalid` domains only.
6. New roles are recipes, in their own repository ([recipes/README.md](recipes/README.md)), not changes to the core.
   If your recipe needs a core change, open an issue: that is a defect in the method.
