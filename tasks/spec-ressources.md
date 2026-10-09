# Spec — Ressources qui comptent (2026-10-09)

## Retour de l'utilisateur

> J'ai la sensation d'être assez riche : les ressources sont rarement une contrainte, en tout cas au début. On peut imaginer d'introduire les ressources petit à petit plutôt que de tout donner dès le début. L'aventure actuelle devient la « démo » du jeu (un simple libellé).

## Constat (harnais, 50 parties par bot)

- Bot moyen : 155🔩 au tour 20, 196🔩 au tour 30. **26 % des tours au plafond de matériaux.**
- Diplomatie : **53 % des tours au plafond d'influence** (50), dès le tour 15.
- Ce qui limite vraiment, ce sont les 3 points de commandement. Les ressources servent à valider un ordre, jamais à forcer un choix. Les matériaux n'ont qu'un débouché récurrent, le recrutement, lui-même bridé par l'armée max et l'entretien.

## Décisions validées

1 + 2 + 3, et « Démo » comme simple libellé.

## 1. Apparition progressive (interface seulement)

Une ressource cachée continue de produire en silence. La règle est purement visuelle, sans effet sur l'équilibrage.

| Ressource | Apparaît |
|---|---|
| ⚡ 🔩 | Dès le tour 1 |
| 💾 Données | Ouverture du Savoir, Centre de données bâti, recherche faite, ou tour 2 |
| 🏛️ Stabilité | Tour 3 (pré-alerte des raids), ou première menace |
| 🌐 Influence | Première cité sélectionnée, chapitre 2, ou tour 5 |

- Un choix d'événement qui touche une ressource cachée la révèle.
- Chaque apparition donne un conseil de PROMETHEUS.

## 2. Réserves plafonnées par le Cœur

- ⚡ 🔩 💾 : 60 / 120 / 200 selon le niveau du Cœur. 🌐 : 30 / 40 / 50. 🏛️ : 100.
- L'infobulle de chaque ressource affiche la réserve max, et ce qui l'augmente.
- Stock de départ ajusté au strict nécessaire, réglé au harnais.

## 3. Débouchés au surplus (révisé après mesure)

La première version proposait un **ordre d'urgence** (des ressources contre +1 point de commandement). Le harnais a montré que les bots finissent 70 à 80 % de leurs tours avec des points inutilisés, et que dès le tour 15 il n'y a plus rien d'utile à faire. L'ordre d'urgence ne servait donc à rien. L'utilisateur a validé son remplacement par :

- **Raffiner les données** (Centre de données) : 1 point + 25🔩 donnent 5, 7 ou 9💾 selon le niveau du Centre. Une fois par tour.
- **Remparts** : sur un territoire tenu, Alpha-7 comprise, 3 niveaux à 25 / 40 / 60🔩 et 1 point chacun. +1 DEF permanente par niveau pour les défenseurs. Ils sont détruits si le territoire tombe.
- **Répit négocié** : 12🌐 pour retarder une menace d'un tour, sur Alpha-7, un territoire ou une cité alliée. Une seule fois par menace, sans point de commandement.

## Mesure

- Nouvel indicateur dans le harnais : le pourcentage de tours terminés avec des points de commandement inutilisés, faute de quoi les dépenser.
- Cibles :
  - matériaux au plafond < 10 % pour le bot moyen ;
  - influence au plafond < 25 % pour la diplomatie ;
  - taux de victoire dans le bruit de la 1.4.0 / tutoriel (conquête ≈ 79, diplomatie ≈ 93, tortue ≈ 86, moyen ≈ 34).

## Démo

- « Démo » sur l'écran titre et à côté du numéro de version.
- Une ligne sur l'écran de fin : « Fin de la démo : la campagne complète viendra plus tard ».

## Résultats (2026-10-09)

50 parties × 8 graines par bot. La référence est le tutoriel incarné (`e2e4b9f`).

| Version | Conquête | Diplomatie | Tortue | Moyen | 🔩 au plafond (moyen) | 🌐 au plafond (diplomatie) |
|---|---|---|---|---|---|---|
| Référence | 78,8 | 93,2 | 86,2 | 33,8 | 27,6 % | 52,7 % |
| Plafonds + ordre d'urgence | 81,5 | 94,8 | 88,0 | 32,5 | 26,3 % | 54,6 % |
| Raffiner 20→6/9/12, remparts +2 DEF | 81,2 | 95,8 | 91,8 | 39,5 | 0,2 % | 55,3 % |
| **Raffiner 25→5/7/9, remparts +1 DEF (retenu)** | **79,2** | **95,5** | **89,2** | **36,8** | **0,3 %** | **54,7 %** |
| Antenne à +2🌐 (écarté) | 79,2 | 97,0 | 88,8 | 38,5 | 0,2 % | 46,6 % |

Profil d'une partie du bot moyen (avant) :
- tours 1 à 5 : les points sont utilisés, environ 8🔩 en stock ;
- tours 6 à 25 : environ 6💾 en stock, la recherche est le vrai goulot ;
- après le tour 15 : 95 à 100 % des tours avec des points inutilisés, et les matériaux montent jusqu'à 190.

Bilan :
- Objectif atteint : les matériaux ne s'accumulent plus (27,6 % → 0,3 % de tours au plafond).
- Le jeu est légèrement plus facile (+2 à +3 points selon le bot, dans ou au bord du bruit).
- Non atteint : l'influence de la diplomatie sature toujours (55 %). Le surplus est structurel à cette voie, il lui faudra un vrai débouché (piste : une Hegemonia qui réagit).
- Stock de départ inchangé : le début de partie est déjà serré.
