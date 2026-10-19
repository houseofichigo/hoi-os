# Running the method as a workshop

The workshop runs the same 25 steps with the same gates as a real engagement. That is what makes it an honest rehearsal
rather than a demo. What changes is the material: the input files and the documents come from a **recipe** (a role,
its corpus and its answer key, in its own repository) instead of the participant's own organisation.

## Before the day

- Each participant needs: a laptop where they may install Python and git, an assistant with folder access (Codex or
  Claude Code), and voice input switched on. Laptops cannot be configured in the room; send this list two weeks ahead.
- Ask each participant, before the day, for their function and their top three deliverables. That decides which recipe,
  and which corpus pack, they use.
- Prepare a USB kit: this repository, the recipe repository, and the Python and git installers for the participants'
  operating systems. The core needs no network.
- No participant's real data in the room. The recipes use invented organisations; e-mail addresses use `.example`.

## On the day

| Steps | In the workshop |
| --- | --- |
| 1–4 | Everyone runs `install.py` into a new folder, opens it in their assistant |
| 5–6 | The recipe's ABOUT_US.md and ROLE.md are dropped in; participants read and confirm them, and change one section by voice with `$hoi-onboard` to feel the interview |
| 7 | `$hoi-govern`; everyone reads AGENTS.md as a new hire |
| 8 | The recipe's corpus pack is copied in |
| 9 | The facilitator writes `hoi-organize` live in front of the room, then everyone runs it |
| 10–11 | Tools are export-only; the workbench opens empty |
| 12–15 | Ingest, wiki, map. The first contradiction is found on the map. The planted instruction is flagged and quoted |
| 16–18 | Two role skills written live, two taken from the recipe; one evaluation run each, judged in a second session |
| 19–21 | Skills run for real. One automation is proposed and **refused**, because its skill has one run, not three: that refusal is the lesson. The recipe's "wave 2" file is dropped into `inbox/` and the event is triggered by hand |
| 22–25 | One rule changed and the suite rerun; memory proposed and approved; audit; what stays yours |

## Timing for one day

| Block | Steps | Time |
| --- | --- | --- |
| What a harness is; the loop diagram | — | 30 min |
| Describe and Frame | 1–7 | 60 min |
| Feed | 8–11 | 60 min |
| Know | 12–15 | 75 min |
| Equip | 16–18 | 90 min |
| Run and Maintain | 19–25 | 60 min |

On three days, add the full interview with each participant's own (non-sensitive) organisation on day 2, and three
evaluation runs per skill on day 3.

## Facilitator checks

The gates are the facilitator's checklist: walk the room at each « done when ». The answer keys and the planted traps
are in the recipe's presenter folder, never in the participants' folders.
