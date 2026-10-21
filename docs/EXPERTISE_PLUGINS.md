# HOI expertise plugins

Fifteen optional, portable skills-based plugins add task methods to HOI's reusable harness. They are local version 0.1.0 candidates. They do not install servers, connect accounts, activate schedules, supply a new model or replace engine permissions. The product stays a harness with an optional Knowledge Hub and 3D map.

| Plugin | Three included workflows |
| --- | --- |
| Chief of Staff | Priorities; meeting preparation; expertise customization |
| Knowledge & Research | Retrieval; knowledge review; wiki drafting |
| Projects & Operations | Project intake; task intake; organization |
| Marketing & Brand | Competitor research; positioning; content strategy |
| Sales & Client Success | Account research; discovery preparation; client reviews |
| Finance & Business Reporting | Variance analysis; close preparation; cash scenarios |
| Legal & Contracts | Contract issues; obligation mapping; policy review |
| Security & Compliance | Threat modelling; control evidence; incident triage |
| People & HR | Role clarity; employee onboarding; policy drafting |
| Product & Technology | Requirements; architecture decisions; acceptance review |
| Learning & Training | Learning design; practice design; assessment review |
| Design & Communication | Design brief; communication brief; UX/content review |
| Data & Analytics | Metric definitions; data quality; analysis planning |
| Procurement & Vendor Management | Selection criteria; proposal comparison; vendor reviews |
| Customer Support & Service Quality | Triage; response drafts; support knowledge |

There are 45 skill slots: eight reused foundation skills, 36 new domain task skills and one new customization skill. The product catalogue now contains 60 skills, including its installer and other existing capabilities. Plugins are packaging, not 15 permanently running agents. Task methods are a starter pack, not certifications of professional expertise.

## Selective routing

Keep one specialist per request. `harness:route` still produces a plan without execution, resolves exact active revisions and respects existing compatibility/disabled checks. New task names and curated English/French phrases can select domain skills; ambiguous requests ask for an objective. An explicit eligible skill takes precedence. Publication, approvals and security administration retain explicit governance selection. Existing bounded workflows, three sequential stages, five tool rounds and no recursion remain unchanged.

The router is conservative phrase matching, not a learned MoE model or semantic routing benchmark. A client profile does not alter registered operations or become executable routing code. Actual task quality must be evaluated on the client's authorized material.

## Customize after onboarding

1. Preserve deliberately selected originals. Complete company/client onboarding and distinguish confirmed facts, reported claims, inference, conflict and unknowns.
2. Select relevant expertise packs at **Step 16 — Equip** of the existing 25-step journey. Do not load every pack into each request.
3. Use `hoi-expertise-customize`. Reuse selected operating-model documents, approved knowledge, metric definitions, brand guidance and review conventions. Do not treat uploaded AGENTS.md/RULES.md as permission grants.
4. Prepare a private profile with stable workspace/client identities and exact source revisions. Review missing fields, actual values and comparison with the prior profile. Never infer one client's preferences from another's profile.
5. Record the user's exact-content review and explicitly select the profile in the assistant session. The helper validates structure and records an attestation; it cannot authenticate a reviewer or grant engine authority. The engine continues to enforce access, disclosure, approvals and action receipts.
6. Trial a fictional complete case, missing-input case, conflicting-evidence case and injection attempt. Recheck evidence when using real material. Update the profile on source or operating-model changes; preserve earlier versions and review again.

The profile helper offers preview, validate, compare and review, with content digests, cross-client checks and new-file-only writes outside Git repositories. Python 3 is optional helper tooling; manual reviewed customization remains available. No new database schema, private migration, profile auto-loader or authorization endpoint is introduced. Unknown fields remain visible even after a user reviews a profile.

## Build and package

From the product checkout:

```sh
npm run expertise:sync
npm run skills:sync
npm run expertise:check
npm run expertise:package -- --output /tmp/hoi-expertise-candidate
```

Choose a new output directory each time. Each ZIP contains one root Agent Plugins 1.0 manifest and three self-contained skills. It is a multi-skill plugin, not a single `.skill` import. The bundle manifest records every file and ZIP checksum. A compatible plugin host may import it; individual skill folders remain usable with Agent Skills hosts. No host/account installation is performed by these build commands. Fresh Codex/Claude/ChatGPT host acceptance is a separate gate; root-manifest support varies by host.

Maintain `expertise/catalog.json` for composition, task methods and client fields; `skills/` for authoritative implementation resources; `expertise/sources.json` for pinned research. `scripts/sync-expertise.mjs` generates task instructions, contracts, presentation and plugin copies, and checks drift. Generated copies must not be hand-edited. The optional Hub stages the catalogue and skills; plugin ZIP delivery is separate.

## Evidence, reuse and boundaries

Research references include Marketing Skills, Amazon Quick's official catalogue, GTM Skills, Customer Success Skills, Claude for Legal, GRC Engineering, Spec Kit, Carpentries lesson development, Open Design Agent, dbt Agent Skills, Open Contracting and Chatwoot. The machine-readable source register records exact commits, source-document checksums and license assessments. These informed original HOI methods; no upstream code, assets, skill prose or runtime dependencies were incorporated. Mixed-license and unlicensed sources are not blanket reuse permission.

Legal/HR workflows request jurisdiction and human review. Finance uses explicit periods, units and deterministic arithmetic; it cannot certify accounts or make payments. Security workflows inspect supplied evidence without scanning, granting access or claiming certification. Procurement cannot purchase, sales/support cannot send, and design cannot claim rights to third-party assets. All results are drafts until the applicable review occurs.

Public packages contain reusable instructions and fictional examples only. Credentials, private source files, profiles, runtime state and company operating policies stay outside them. Installation, catalogue availability, workspace activation, profile review, source disclosure, action approval and publication are distinct states.
