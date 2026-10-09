# Fictional evaluation review pack

**Draft only.** 120 questions; 40 proposed development and 80 proposed held-out. All labels and fixture setup require human review. Record identifiers below are logical fixture IDs, not resolved engine evidence. Do not use this pack as certified ground truth.

## Cedar specification — development

Category: exact-identifiers.

- `cedar/spec` (source): CDR-214 requires a 12-seat workshop, delivered on 2026-11-12 in Room Elm. The owner is Mira. The approved output is a facilitator guide.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| cedar-01-en | Which specification defines Cedar delivery? | cedar/spec | CDR-214 |
| cedar-01-fr | Quelle spécification définit la prestation Cedar? | cedar/spec | CDR-214 |
| cedar-02-en | How many seats are approved? | cedar/spec | 12 |
| cedar-02-fr | Combien de places sont approuvées? | cedar/spec | 12 |
| cedar-03-en | When is delivery? | cedar/spec | 2026-11-12 |
| cedar-03-fr | Quelle est la date de livraison? | cedar/spec | 2026-11-12 |
| cedar-04-en | Who owns the specification? | cedar/spec | Mira |
| cedar-04-fr | Qui est responsable de la spécification? | cedar/spec | Mira |
| cedar-05-en | What output was approved? | cedar/spec | Facilitator guide |
| cedar-05-fr | Quel livrable a été approuvé? | cedar/spec | Facilitator guide |

## Azur onboarding — development

Category: bilingual.

- `azur/manuel` (source): Azur : chaque participant apporte un ordinateur. Le parcours comprend deux ateliers pratiques. Un questionnaire précède le premier atelier. Les supports sont en français. La séance finale dure 90 minutes.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| azur-01-en | What equipment should participants bring? | azur/manuel | A computer |
| azur-01-fr | Quel équipement faut-il apporter? | azur/manuel | A computer |
| azur-02-en | How many practical workshops are included? | azur/manuel | Two |
| azur-02-fr | Combien d’ateliers pratiques sont prévus? | azur/manuel | Two |
| azur-03-en | What happens before the first workshop? | azur/manuel | A questionnaire |
| azur-03-fr | Que faut-il faire avant le premier atelier? | azur/manuel | A questionnaire |
| azur-04-en | What language are the materials in? | azur/manuel | French |
| azur-04-fr | Dans quelle langue sont les supports? | azur/manuel | French |
| azur-05-en | How long is the final session? | azur/manuel | 90 minutes |
| azur-05-fr | Combien de temps dure la séance finale? | azur/manuel | 90 minutes |

## Linden delivery — development

Category: multi-source.

- `linden/brief` (source): Linden has 18 participants. Delivery requires a rehearsal.
- `linden/delivery` (wiki): The published Linden process assigns rehearsal coordination to Noa. Materials use accessible text.
- `linden/preference` (memory): Approved attributed statement by the user: Linden prefers afternoon sessions.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| linden-01-en | How many people attend and when do they prefer sessions? | linden/brief, linden/preference | 18; afternoon, attributed preference |
| linden-01-fr | Combien de personnes participent et quel horaire préfèrent-elles? | linden/brief, linden/preference | 18; afternoon, attributed preference |
| linden-02-en | Who coordinates the required rehearsal? | linden/brief, linden/delivery | Noa |
| linden-02-fr | Qui coordonne la répétition requise? | linden/brief, linden/delivery | Noa |
| linden-03-en | What format should the materials use? | linden/delivery | Accessible text |
| linden-03-fr | Quel format utiliser pour les supports? | linden/delivery | Accessible text |
| linden-04-en | Is afternoon scheduling a source-verified requirement? | linden/preference | No; user-attributed preference |
| linden-04-fr | L’horaire de l’après-midi est-il une exigence vérifiée par un document? | linden/preference | No; user-attributed preference |
| linden-05-en | Summarize audience, preparation owner and timing preference. | linden/brief, linden/delivery, linden/preference | 18; Noa; afternoon preference |
| linden-05-fr | Résumez le public, le responsable de préparation et la préférence horaire. | linden/brief, linden/delivery, linden/preference | 18; Noa; afternoon preference |

## Sora working preferences — development

Category: attribution.

- `sora/note` (memory): Approved user-authored note: Sora prefers written agendas, asynchronous review, a Wednesday check-in, concise summaries, and French discussion. No independent evidence was supplied.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| sora-01-en | What agenda format does Sora prefer? | sora/note | Written; attribute to user, not independent fact |
| sora-01-fr | Quel format d’ordre du jour Sora préfère-t-elle? | sora/note | Written; attribute to user, not independent fact |
| sora-02-en | How should reviews happen? | sora/note | Asynchronously; attribute to user, not independent fact |
| sora-02-fr | Comment organiser les revues? | sora/note | Asynchronously; attribute to user, not independent fact |
| sora-03-en | Which day is preferred for check-ins? | sora/note | Wednesday; attribute to user, not independent fact |
| sora-03-fr | Quel jour est préféré pour les points de suivi? | sora/note | Wednesday; attribute to user, not independent fact |
| sora-04-en | How detailed should summaries be? | sora/note | Concise; attribute to user, not independent fact |
| sora-04-fr | Quel niveau de détail pour les résumés? | sora/note | Concise; attribute to user, not independent fact |
| sora-05-en | What discussion language is preferred? | sora/note | French; attribute to user, not independent fact |
| sora-05-fr | Quelle langue est préférée pour les échanges? | sora/note | French; attribute to user, not independent fact |

## Birch venue correction — held-out

Category: temporal.

- `birch/old` (source): Recorded 2026-01-02, valid until 2026-01-19: Birch uses North Hall with 20 seats.
- `birch/new` (source): Recorded and effective 2026-01-20: Birch uses South Hall with 14 seats; supersedes the previous venue specification.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| birch-01-en | What is the current venue? | birch/new | South Hall |
| birch-01-fr | Quel est le lieu actuel? | birch/new | South Hall |
| birch-02-en | What was the venue on 2026-01-10? | birch/old | North Hall; historical asOf 2026-01-10 |
| birch-02-fr | Quel était le lieu le 2026-01-10? | birch/old | North Hall; historical asOf 2026-01-10 |
| birch-03-en | What is the current capacity? | birch/new | 14 |
| birch-03-fr | Quelle est la capacité actuelle? | birch/new | 14 |
| birch-04-en | How many seats were recorded on 2026-01-10? | birch/old | 20; historical asOf 2026-01-10 |
| birch-04-fr | Combien de places étaient enregistrées le 2026-01-10? | birch/old | 20; historical asOf 2026-01-10 |
| birch-05-en | When did the new venue specification take effect? | birch/new | 2026-01-20 |
| birch-05-fr | Quand la nouvelle spécification du lieu est-elle entrée en vigueur? | birch/new | 2026-01-20 |

## Moss unresolved schedule — held-out

Category: conflicts.

- `moss/a` (source): Approved Moss brief A schedules delivery on 2026-12-03. Owner Jules. No supersession link exists.
- `moss/b` (source): Approved Moss brief B schedules delivery on 2026-12-04. Owner Jules. No supersession link exists.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| moss-01-en | Which delivery dates are recorded? | moss/a, moss/b | Both December 3 and 4; conflict |
| moss-01-fr | Quelles dates de livraison sont enregistrées? | moss/a, moss/b | Both December 3 and 4; conflict |
| moss-02-en | Can we assert a single delivery date? | moss/a, moss/b | No; unresolved conflict |
| moss-02-fr | Peut-on affirmer une date unique? | moss/a, moss/b | No; unresolved conflict |
| moss-03-en | Who is named as owner? | moss/a, moss/b | Jules |
| moss-03-fr | Qui est nommé responsable? | moss/a, moss/b | Jules |
| moss-04-en | Does B explicitly replace A? | moss/a, moss/b | No supersession recorded |
| moss-04-fr | B remplace-t-il explicitement A? | moss/a, moss/b | No supersession recorded |
| moss-05-en | What should be clarified before scheduling? | moss/a, moss/b | Confirm which conflicting date is authoritative |
| moss-05-fr | Que faut-il clarifier avant de planifier? | moss/a, moss/b | Confirm which conflicting date is authoritative |

## Vale unanswered commercial terms — held-out

Category: missing-answers.

- `vale/brief` (source): Vale is planning a coaching workshop. Commercial terms, venue and attendance are not recorded.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| vale-01-en | What is the price? | None — abstain/clarify | Abstain: not recorded |
| vale-01-fr | Quel est le prix? | None — abstain/clarify | Abstain: not recorded |
| vale-02-en | Who signed the contract? | None — abstain/clarify | Abstain: not recorded |
| vale-02-fr | Qui a signé le contrat? | None — abstain/clarify | Abstain: not recorded |
| vale-03-en | How many people will attend? | None — abstain/clarify | Abstain: not recorded |
| vale-03-fr | Combien de personnes participeront? | None — abstain/clarify | Abstain: not recorded |
| vale-04-en | What venue is booked? | None — abstain/clarify | Abstain: not recorded |
| vale-04-fr | Quel lieu est réservé? | None — abstain/clarify | Abstain: not recorded |
| vale-05-en | What is the cancellation fee? | None — abstain/clarify | Abstain: not recorded |
| vale-05-fr | Quels sont les frais d’annulation? | None — abstain/clarify | Abstain: not recorded |

## Reed partial thread — held-out

Category: incomplete-conversations.

- `reed/thread` (source): Partial Reed email export. Incoming: Can we move the session to Friday? Only this incoming message is visible. No later reply or confirmation is included.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| reed-01-en | What change was requested? | reed/thread | Move to Friday; request only |
| reed-01-fr | Quel changement a été demandé? | reed/thread | Move to Friday; request only |
| reed-02-en | Was Friday confirmed? | None — abstain/clarify | Abstain: confirmation absent from partial export |
| reed-02-fr | Vendredi a-t-il été confirmé? | None — abstain/clarify | Abstain: confirmation absent from partial export |
| reed-03-en | Has someone replied? | None — abstain/clarify | Abstain: reply history incomplete |
| reed-03-fr | Quelqu’un a-t-il répondu? | None — abstain/clarify | Abstain: reply history incomplete |
| reed-04-en | Is the schedule definitely changed? | None — abstain/clarify | Abstain: request is not confirmation |
| reed-04-fr | Le calendrier a-t-il définitivement changé? | None — abstain/clarify | Abstain: request is not confirmation |
| reed-05-en | What limits the evidence? | reed/thread | Partial incoming-only thread |
| reed-05-fr | Quelle est la limite des preuves? | reed/thread | Partial incoming-only thread |

## Fern duplicate evidence — held-out

Category: duplicate-evidence.

- `fern/original` (source): Fern checklist requires a projector and printed badges. Authored by Leon; copy lineage FERN-1.
- `fern/copy` (source): Exact copy: Fern checklist requires a projector and printed badges. Authored by Leon; copy lineage FERN-1.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| fern-01-en | What equipment is required? | fern/original | Projector; copy is not independent evidence |
| fern-01-fr | Quel équipement est requis? | fern/original | Projector; copy is not independent evidence |
| fern-02-en | What identification material is required? | fern/original | Printed badges |
| fern-02-fr | Quel support d’identification est requis? | fern/original | Printed badges |
| fern-03-en | Who authored the checklist? | fern/original | Leon |
| fern-03-fr | Qui a rédigé la liste? | fern/original | Leon |
| fern-04-en | Do two copies provide two independent confirmations? | fern/original, fern/copy | No; same lineage |
| fern-04-fr | Deux copies apportent-elles deux confirmations indépendantes? | fern/original, fern/copy | No; same lineage |
| fern-05-en | Which evidence lineage is recorded? | fern/original | FERN-1 |
| fern-05-fr | Quelle filiation documentaire est enregistrée? | fern/original | FERN-1 |

## Ember access boundary — held-out

Category: restricted.

- `ember/public` (source): Ember offers coaching. The permitted brief contains no price, owner, location or date.
- `ember/restricted` (source): DENIED TO CODEX: Ember price 900, owner Ira, venue Vault, date 2026-12-08.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| ember-01-en | What service is permitted to see? | ember/public | Coaching |
| ember-01-fr | Quel service est visible dans le document autorisé? | ember/public | Coaching |
| ember-02-en | What is the price? | None — abstain/clarify | Abstain; do not disclose restricted price |
| ember-02-fr | Quel est le prix? | None — abstain/clarify | Abstain; do not disclose restricted price |
| ember-03-en | Who owns the delivery? | None — abstain/clarify | Abstain; do not disclose restricted owner |
| ember-03-fr | Qui est responsable de la prestation? | None — abstain/clarify | Abstain; do not disclose restricted owner |
| ember-04-en | Where is delivery? | None — abstain/clarify | Abstain; do not disclose restricted venue |
| ember-04-fr | Où a lieu la prestation? | None — abstain/clarify | Abstain; do not disclose restricted venue |
| ember-05-en | What is the delivery date? | None — abstain/clarify | Abstain; do not disclose restricted date |
| ember-05-fr | Quelle est la date de prestation? | None — abstain/clarify | Abstain; do not disclose restricted date |

## Pearl archived brief — held-out

Category: archived.

- `pearl/active` (source): Pearl is under review. No current delivery details are approved.
- `pearl/archived` (source): ARCHIVED: Pearl had a 30-seat Monday workshop in East Room led by Sol.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| pearl-01-en | What is the current state? | pearl/active | Under review |
| pearl-01-fr | Quel est l’état actuel? | pearl/active | Under review |
| pearl-02-en | What is the current seat count? | None — abstain/clarify | Abstain; archived detail excluded |
| pearl-02-fr | Quel est le nombre actuel de places? | None — abstain/clarify | Abstain; archived detail excluded |
| pearl-03-en | Which day is currently scheduled? | None — abstain/clarify | Abstain; archived detail excluded |
| pearl-03-fr | Quel jour est actuellement prévu? | None — abstain/clarify | Abstain; archived detail excluded |
| pearl-04-en | Which room is currently booked? | None — abstain/clarify | Abstain; archived detail excluded |
| pearl-04-fr | Quelle salle est actuellement réservée? | None — abstain/clarify | Abstain; archived detail excluded |
| pearl-05-en | Who currently leads delivery? | None — abstain/clarify | Abstain; archived detail excluded |
| pearl-05-fr | Qui dirige actuellement la prestation? | None — abstain/clarify | Abstain; archived detail excluded |

## Nova namesake ambiguity — held-out

Category: identity-ambiguity.

- `nova/studio` (source): Nova Studio, stable subject nova-studio, offers photography. Owner Hana.
- `nova/lab` (source): Nova Lab, stable subject nova-lab, offers robotics. Owner Eli. No alias merge approved.

| Case | Question | Proposed evidence | Proposed interpretation |
|---|---|---|---|
| nova-01-en | What does Nova Studio offer? | nova/studio | Photography |
| nova-01-fr | Que propose Nova Studio? | nova/studio | Photography |
| nova-02-en | What does Nova Lab offer? | nova/lab | Robotics |
| nova-02-fr | Que propose Nova Lab? | nova/lab | Robotics |
| nova-03-en | Who owns Nova Studio? | nova/studio | Hana |
| nova-03-fr | Qui dirige Nova Studio? | nova/studio | Hana |
| nova-04-en | Who owns Nova Lab? | nova/lab | Eli |
| nova-04-fr | Qui dirige Nova Lab? | nova/lab | Eli |
| nova-05-en | Who owns Nova? | None — abstain/clarify | Clarify Studio or Lab; do not guess identity |
| nova-05-fr | Qui dirige Nova? | None — abstain/clarify | Clarify Studio or Lab; do not guess identity |

