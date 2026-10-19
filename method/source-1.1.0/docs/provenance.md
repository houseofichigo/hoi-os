# Provenance

Where each idea in this method came from, what was taken, and under which licence. The rule throughout: **take
patterns and rules, not paragraphs**. Where a few lines of wording were adapted, the file says so at its end and the
source is listed in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). No third-party skill is installed into the core:
each was read as data, as a reference.

| Source | Licence | What was taken | Where it lives here |
| --- | --- | --- | --- |
| [houseofichigo/hoi-os-atelier-chief-of-staff](https://github.com/houseofichigo/hoi-os-atelier-chief-of-staff) — the 13-step atelier | MIT, House of Ichigo | The step prompts (inventory, filing, governance, ingestion, wiki, map, app, run, connect), the ABOUT_US structure, the 3D map script and its vendored libraries, the evaluation answer-key columns (document of record, failure condition) | Core skills phases 0–5; `hoi-3d-map/scripts/map.py` (translated, generalised) |
| [houseofichigo/hoi-os](https://github.com/houseofichigo/hoi-os) — the app edition | MIT, House of Ichigo | Twelve judgement rules (listed in [BRIEF.md §8](../BRIEF.md#8-what-each-skill-was-built-from)); skill names; the approval-hash pattern; pass / fail / not tested; the 17-field contract-plus-validator pattern | AGENTS and RULES templates; organize, ingest, retrieve, wiki-author, memory-propose, knowledge-review, audit |
| [mattpocock/skills](https://github.com/mattpocock/skills) — `grilling`, `to-questionnaire`, `writing-for-agents` | MIT | Rounds, the frontier, recommended answers worded so "yes" accepts them, "facts are your job"; the questionnaire for an absent owner; context pointers, two loads, completion criteria with clarity and demand, single source of truth | `_shared/references/challenge.md`, `writing-rules.md`, `skill-template.md`; `hoi-onboard` |
| [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) — `llm-wiki`, `grounded-citations`, connector skills, `weekly-review-planning`, `email-inbox-triage` | MIT | Session orientation; page thresholds; verbatim quotes checked against the page; the catalogue of what "connected" can mean; schedule and event automation patterns | AGENTS session start; `hoi-wiki-author`; `quote_check.py`; `hoi-connect`; `hoi-automate` |
| [NicholasSpisak/second-brain](https://github.com/NicholasSpisak/second-brain) | No licence file | Conventions only, no text: takeaways before writing; a source page per document; the log as an idempotence ledger; the eight lint checks | `hoi-ingest` step 7; `hoi-wiki-author` step 2; `lint_wiki.py --full` |
| [affaan-m/ECC](https://github.com/affaan-m/ECC) — `email-ops`, agent prompt-defence baseline, `chief-of-staff` agent, `conversation-analyzer` agent, `recursive-decision-ledger` | MIT (root; 292 of 311 skills carry no licence field) | Untrusted inbound text rules incl. quote-verbatim-and-ask; send verification; suspicious-signal list; four-tier triage; learning loop; status marks with decay and replay; "Skill Stack" composition | `_shared/references/untrusted-input.md`; `hoi-automate`; `hoi-knowledge-review`; skills.json status machine; skill template "Works with" |
| ECC `quality-nonconformance` | Apache-2.0 | **Pattern only, no text**: the section order of a domain skill | `_shared/references/skill-template.md` |
| [Agent Skills specification](https://agentskills.io/) | open specification | The skill folder format, front matter, progressive disclosure | Every skill |
| Karpathy's LLM Wiki pattern | idea | Immutable sources, a model-maintained cited wiki, periodic lint | Phase 3 |
| OpenAI, Böckeler (martinfowler.com), Anthropic — harness and evaluation articles | articles | Short instruction file as a map; guides and sensors; grade outcomes, repeated trials, calibrate judges | METHOD.md; `hoi-evaluate` |
| [3d-force-graph](https://github.com/vasturiano/3d-force-graph) 1.80.1, [marked](https://github.com/markedjs/marked) 18.0.14 | MIT | Vendored display libraries | `skills/hoi-3d-map/vendor/` |

## What was looked at and not taken

| Found | Why not |
| --- | --- |
| HOI OS skill bodies | Thin wrappers around the app's command line (9–37 lines each); nothing survives without the app. The rules were harvested instead |
| hermes-agent macOS integrations (Apple Notes, iMessage, Find My) | macOS-only; useless for a mixed Windows cohort |
| second-brain text | No licence: conventions taken, wording never |
| ECC `knowledge-ops` | Four storage layers — the layering this method deliberately avoids |
| ECC's 71 agents, as agents | Subagents are host-specific; the method must run on several hosts |
| ECC's research and industry-vertical skills, session commands | Out of scope for a general, non-technical method |
| Any third-party skill installed into the core | Untrusted until audited; the core is written, not assembled |
