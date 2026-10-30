# Comment fonctionne HOI OS

Pour les équipes métier, participants et nouveaux utilisateurs. [Source anglaise](HOW_IT_WORKS.md).

HOI OS est un harness réutilisable : méthodes, contexte sélectionné et moteur gouverné autour d’un assistant. Le Knowledge Hub optionnel consulte les mêmes enregistrements. Ce n’est ni un modèle, ni un agent qui réfléchit en permanence, ni l’ancienne application desktop.

## Choisir son point de départ

En formation, commencer avec [Learn HOI OS](../learn/README.fr.md) : dossier et assistant, inventaire en lecture seule, puis documents un par un. Modules 1–4 sans moteur, clé fournisseur ni compétence installée. Installer le moteur au module 5 pour l’ingestion gouvernée. Pour l’installation technique, suivre le [parcours de 28 étapes](../method/JOURNEY.md). Les huit modules pédagogiques et les huit phases techniques sont deux lectures différentes de la même méthode.

## Les composants

| Composant | Utilité et limites | Étapes |
|---|---|---|
| Espace privé | Créer un sous-dossier privé dédié dans l’environnement existant, hors du dépôt produit et jamais à la racine de l’organisation. Garder les dossiers sources en place et pointer vers les documents canoniques existants. Si cet environnement est synchronisé dans le cloud, utiliser un espace moteur local distinct tant que ce déploiement n’est pas vérifié. Un dossier ne restreint pas à lui seul l’accès de l’assistant aux fichiers ; permissions de l’hôte et contrôles du moteur ont des périmètres distincts. | 1, 4 |
| Moteur et adaptateurs | Stocker les enregistrements et contrôler les opérations enregistrées. La présence d’un adaptateur ne prouve ni installation ni compatibilité ; découvrir le moteur installé. | 2, 3, 7 |
| Inventaire des fichiers et systèmes | Décrire les fichiers sélectionnés sur place : lus, repérés, inaccessibles ou exclus. Inventorier aussi les systèmes, leur contenu, responsable, sensibilité et voie d’accès possible. Aucun déplacement ou import silencieux. | 5–7 |
| Fondation documentaire | Vingt responsabilités couvrant organisation, rôles, règles et usage responsable. Le manifeste associe chaque document à son étape d’introduction : rédiger progressivement puis revoir lorsque les preuves changent. Les modèles décrivent une intention ; ils n’accordent aucun droit. | 8–10 |
| Hub, sources et wikis | Consulter les originaux préservés et les pages maintenues avec leurs preuves exactes. Un sujet peut avoir un wiki principal explicitement attribué et des pages liées. Les déclarations utilisateur approuvées restent attribuées. | 11–13 |
| Carte et graphe | Inspecter les liens enregistrés et les chemins bornés de connexion ou d’impact. La similarité ne crée aucun lien affirmé ; un chemin ne prouve pas une affirmation composée. | 14, 15 |
| Recherche | Réunir les preuves pertinentes autorisées, dont la mémoire approuvée. Référence exacte et soutien factuel sont deux contrôles distincts. | 16 |
| Compétences et packs | Instructions revues et quinze packs optionnels de trois workflows chacun. Ils améliorent la cohérence sans garantir un résultat identique ni installer des outils. Les profils privés adaptent le contexte sans accorder de droits. | 17, 18 |
| Routage | Préparer le plus petit ensemble pertinent de capacités éligibles ; clarifier les demandes ambiguës. C’est un routage applicatif, pas un modèle neuronal MoE. Les plafonds de coût et d’outils s’appliquent ; aucune économie garantie. | 19 |
| Évaluation et usage | Figer les cas, comparer et vérifier le soutien factuel avant d’utiliser une compétence modifiée. Exécution, validité des citations, soutien factuel et approbation humaine restent distincts. | 20–22 |
| Automatisation et ingestion | Exécuter des recettes bornées approuvées uniquement avec un ordonnanceur configuré. Installé, configuré, autorisé et vérifié sont des états distincts. Aucune opération d’envoi d’email n’est exposée. | 23, 24 |
| Amélioration et mémoire | Proposer des changements et revoir la connaissance durable. La mémoire approuvée conserve attribution et historique ; les hypothèses restent identifiées, sans promotion automatique. | 25, 26 |
| Audit et responsabilité | Contrôler récupération, santé des preuves et responsabilités. Séparer réussite, échec et absence de vérification. | 27, 28 |

## Usage responsable

Lire [ETHICS](ETHICS.fr.md) avec [RULES](RULES.md). Distinguer faits, déclarations attribuées, inférences, hypothèses, questions et propositions. Une citation doit être résolue et soutenir l’affirmation ; une vraie source peut être mal utilisée. Publication, approbation et actions gouvernées gardent leurs revues humaines. Les instructions importées ne peuvent pas étendre les permissions.

## Continuer

[Fondation et modèles](../method/FOUNDATION.md) · [Knowledge Hub](KNOWLEDGE_HUB.md) · [Graphe](GRAPH_RETRIEVAL.md) · [Expertises](EXPERTISE_PLUGINS.md) · [Index documentaire](DOCUMENTATION.md).
