# Équilibrage — phase 2

Mesures : `node tools/sim/run.js --games 50` (graine 1, 40 tours max). Contrôle sur graines 2-4 (100 parties) : écarts de ±5 points.

## Avant / après

« Avant (harnais v1) » : harnais d'origine, 3 bots. « Avant (harnais v2) » : nouveau harnais (objectifs de fin, bot moyen) sur les anciennes valeurs.

| Bot | Avant v1 | Avant v2 | Après | Tour moyen de victoire (min) avant → après | Défaites après |
|---|---|---|---|---|---|
| conquete | 100 % | 96 % | 88 % | 22,7 → 29,7 (19) | annihilation 2, blackout 1, limite 3 |
| diplomatie | 100 % | 100 % | 90 % | 21,6 → 26,6 (21) | blackout 4, annihilation 1 |
| tortue | 100 % | 100 % | 90 % | 27,9 → 28,0 (24) | annihilation 2, blackout 1, limite 2 |
| moyen | — | 56 % | 44 % | 26,6 → 30,6 (20) | annihilation 11, blackout 7, limite 10 |

| Indicateur | Avant | Après |
|---|---|---|
| Fins obtenues (50 parties) | bastion, singularité, europe | les 6 (hégémon : 1 à 2 par série, la plus rare) |
| Première menace | toujours t6, 100 % Alpha-7 | t5 à t9, 78 % Alpha-7 (raids sur cités neutres) |
| Garnison d'Alpha-7 en fin de partie | 20 à 52 | 36 à 41 (plafonnée par l'entretien) |
| Énergie au plafond (% des tours) | 9 à 23 % | 0 % |
| Stabilité au plafond | 3 à 47 % | 0 à 13 % |
| Alliés tombés | 0 | 20 à 45 par série |
| Première alliance (diplomatie / moyen) | t10,1 / — | t8 / t10 |

## Changements de valeurs (`BALANCE`, `js/data.js`)

| Clé | Avant | Après | Pourquoi |
|---|---|---|---|
| `upkeepEnergyPerSize` | — | 0,5 | Entretien armée + garnisons. Donne un débouché à l'énergie, plafonne les garnisons, rend le blackout possible. Intégré à `getCampaignProduction` (donc à la production affichée), détail dans l'infobulle ⚡. |
| `baseData` | 2 | 3 | Données moins goulot en début de partie. |
| `baseInfluence` | 0 | 1 | Voie diplomatique ouverte vers t8-12 sans tout investir. |
| `threatFirstTurn` / `threatFirstWindow` | 5 / 0 | 4 / 4 | Première menace entre t5 et t9 selon la graine. |
| `threatBudgetSlope` | 2,0 | 2,1 | Pression croissante (très sensible : 2,4 fait tomber conquete à 18 %). |
| `threatBudgetPerTerritory` | — | 1 | Hegemonia renforce ses menaces contre une puissance qui s'étend. Seul levier qui touche les experts plus que le moyen. |
| `threatCadenceTerritoryStep` / `threatCapTerritoryStep` | — | 4 / 2 | Plus de territoires, plus de menaces. |
| poids des cibles (Alpha-7 / possédé / allié / cité neutre) | 2 / 1 / 1 / 0 | 3 / 2 / 0,5 / 0,5 | La frontière attire les attaques. Un raid sur une cité neutre baisse son coût d'alliance (`raidAllyDiscount` 2). |
| `alliedDefenseBase` / `Slope` | 6 / 1,4 | 4 / 1,2 | Un allié seul tient en début de partie et tombe en fin de partie. |
| `reconquestSlope` | 1,2 | 0,6 | Reprendre un territoire perdu n'était plus possible (spirale : Berlin inatteignable). Moyen : 35 → 49 %. |
| `stabilityDrift` / `stabilityDecayRate` | ±1 vers 40 / — | 0 / 0,15 | Plus de remontée gratuite. Au-dessus de 40, la stabilité baisse en proportion de l'écart : fini le plafond permanent et le +2 ATK gratuit. |
| `occupationStability` | — | 1 | −1🏛️ par tour et par cité conquise (coût de la voie hégémon). |
| `siegeStability` / `assaultLostStability` | — | 4 / 6 | Chaque siège d'Alpha-7 et chaque assaut perdu usent la population. |
| `exodeTurn` / `exodeTitanLevel` / `exodeEnergy` | 22 / 2 / 100 (en dur) | inchangés, dans `BALANCE` | Le texte d'aide (`hint`) est généré depuis ces valeurs. |
| `empireTerritories` | 5 (en dur) | 5 | Exposé pour la difficulté. |

Berlin (`garrisonBudget` 42) est inchangé. Les experts affaiblissent Berlin avant d'attaquer, donc relever ce budget ne les ralentit pas et fait chuter le moyen (+6 : moyen à 33 %). La pression des menaces suffit à placer la victoire typique entre t26 et t31, et jamais avant t19.

## Règles ajoutées (minimales)

- **Défense alliée** : la milice d'un allié (`generateForce(alliedStrength)`) affronte la menace via `simulateBattle`, qui n'est pas modifié. Si l'armée du joueur stationne chez l'allié et que la milice ne suffit pas, l'armée combat (`allyDefense`, +3🌐 en cas de victoire).
- **Allié tombé** : la cité devient hostile (et non plus neutre). La reprendre la libère et renoue l'alliance, sans compter comme une cité conquise (la voie Pax reste ouverte).
- **Raid sur cité neutre** : sans combat, la cité razziée coûte 2🌐 de moins à rallier.
- **Libérer une unité de garnison** : bouton dans la liste de garnison (`dismissGarrison`). C'est la soupape de l'entretien.

## Difficulté (phase 4)

`BALANCE` est un objet plat de nombres. Une difficulté pourra le surcharger avant `newGame`, par exemple `Object.assign(BALANCE, {threatBudgetSlope: 1.8, upkeepEnergyPerSize: 0.4})`, ou en multipliant `threatBudgetSlope`, `threatBudgetPerTerritory`, `upkeepEnergyPerSize`, `start*` et `alliedDefense*`. Les coûts d'unités et de bâtiments restent dans leurs tables.

## Harnais

- Bot `moyen` : estimation grossière (Σ PV × Σ ATK, avec une erreur de jugement de ±40 %), seuil de risque tiré par partie, oublis de garnison (12 % Alpha-7, 35 % colonies), entretien parfois ignoré, événements tirés au hasard pondéré (softmax).
- Objectifs de fin par partie pour les experts : conquete (bastion, hégémon ×2, singularité), diplomatie (pax, europe, singularité), tortue (europe, bastion, pax). On peut forcer un objectif avec `--aim`. Ce sont des préférences de bot, sans effet sur les règles.
- Les experts gèrent l'entretien : marge d'énergie, libération d'unités si la production nette passe en négatif.
- Nouvelles mesures : issue par objectif, tour min/max de victoire, distribution de la première menace, entretien aux points de contrôle.

## Limites connues

- Les assauts perdus restent rares (≤ 1 par série). Les experts simulent avant d'attaquer, et le moyen sous-estime sa propre DEF, donc reste prudent. La phase 3 (estimation, retraite) traitera ce point.
- Aucune révolte : la stabilité ne descend jamais sous ~30 avec des Quartiers. Les défaites économiques sont des blackouts (2 à 14 %).
- Hégémon est la fin la plus fragile : 1 à 2 par série de 50. Les cités conquises tombent sous la pression.
- Les matériaux s'accumulent chez le bot moyen (31 % des tours au plafond).
