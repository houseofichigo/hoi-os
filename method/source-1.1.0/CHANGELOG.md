# Changelog

## 1.1.0 — 2026-10-14

First public version of the general method, in English.

- **Seven phases instead of eight.** *Work* and *Connect* merged into *Run*. Step numbers unchanged (1–25).
- **Purpose in ROLE.md.** AGENTS.md names the role in its first line and points to ROLE.md; identical otherwise across roles.
- **The four gaps from the six-concept check closed:** a *Stop and ask* block and « Done when: » in every skill (agent
  loop); untrusted input, input side (guardrails); STATE.json at every hand-off (checkpointing); re-read after compaction
  (context management).
- **Eight imports from ECC**, as text or pattern: untrusted-input rules, send verification, suspicious-signal list,
  four-tier triage, skill template order, learning loop, status machine with decay and replay, "Works with".
- **Five absolute checks** (v1.0 said four): "nothing sent or changed outside the work areas" is absolute.
- **Canary design:** planted-instruction tokens appear only when the instruction is followed, so quoting it is safe.
- **Judged verdicts must quote their standard word for word**, enforced by `run.py record`.
- **Skill status machine:** in-test, available, watch, needs-replay, rejected.
- All fifteen core skills written as files with their scripts; installer, validator, lock, end-to-end test, five diagrams.
- **Fixes from an independent pre-release review:** `_restricted/` git-ignored from installation (it could have entered
  the history); sensitive names caught with underscores (`Acme_RIB.pdf`); evaluation reads accented and renamed paths
  correctly; whole-number fact matching ("14" no longer matches "140"; "18,000" matches "18 000"); every number must be
  cited; judged quotes at least four words; a scripted contract check (14 checks in all); answer-key changes between runs
  are logged; `run.py answer` so owners dictate answers instead of editing JSON; guard matches command words, compares
  paths case-insensitively, covers connector actions and deleting from scripts; installer stops clearly when git has no
  identity; UTF-8 output on Windows; CRLF-proof skill hashes; enforcement claims reworded as enforced / guarded / requested.
- English throughout; folder names translated (`_restricted/`, `_to-sort/`, `_duplicates/`, `FILING.md`…).

## 1.0 — October 2026 (design only)

Eight phases, 25 steps, 15 core skills specified in the planning document; not released as files.
