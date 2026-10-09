# Spec — Tutoriel incarné jusqu'au premier combat (2026-10-09)

## Retour de l'utilisateur

> Donner au guide une identité claire dans l'histoire du jeu, avec un visuel. Il conseille de finir le premier tour avec 2 actions restantes, ce n'est pas terrible. Il dit, et les objectifs aussi, d'aller attaquer Lyon ou Marseille dès le début, alors qu'on a 0 % de chances. Il ne va pas assez loin dans l'immersion : il faudrait qu'il accompagne le joueur jusqu'au premier combat, contre une ruine très facile. Le faire parler mot à mot, comme le texte d'introduction, avec la façon de passer de tous les jeux : un clic pendant qu'il parle affiche tout, un deuxième clic passe au dialogue suivant.

## Constat

- 3 Sentinelles de départ : 0 % contre Lyon (garnison 14), 100 % contre une garnison de 8 ou moins. Le CERN (8) est gagnable, mais à 3 tours de marche.
- Le tutoriel actuel fait bâtir 1 bâtiment, puis finir le tour avec 2 points de commandement perdus.
- L'objectif « Tenir Lyon, Marseille ou le CERN » pousse vers des cibles imprenables.
- PROMETHEUS est déjà l'IA du dôme dans l'introduction (« PROMETHEUS reprend conscience »), mais le guide n'a qu'un losange abstrait comme visuel, et aucune présentation.

## 1. PROMETHEUS, un personnage

- **Présentation dès la première réplique.** Intelligence de défense du dôme, conçue avant l'effondrement pour protéger les derniers survivants des Alpes. Elle se réveille avec le Commandant. Son ton est calme et précis, avec une pointe de chaleur. Elle dit « nous ».
- **Visuel.** Un portrait SVG animé de 72 px dans un cadre hexagonal doré : un œil holographique teal, des anneaux segmentés qui tournent, une ligne de balayage. Pendant qu'elle parle, l'iris pulse. Un cartouche affiche « PROMETHEUS » et, en dessous, « IA du dôme Alpha-7 ».
- **Voix écrite mot à mot**, à la vitesse du texte d'introduction, pour toutes ses répliques (tutoriel, conseils, alertes).
  - Un clic sur la carte pendant qu'elle écrit affiche tout le texte.
  - Un deuxième clic passe à la suite, quand la réplique demande seulement une confirmation.
  - Espace et Entrée font la même chose.
  - Avec `prefers-reduced-motion`, le texte s'affiche d'un coup.

## 2. Une cible d'entraînement : les Ruines de Grenoble

- Nouveau nœud de type `ruin` (lon 5,72, lat 45,19), relié seulement à Alpha-7, à **1 tour** de marche.
- Garnison 5 (des Pillards). Cache : +20🔩 +10💾 +10⚡ (réglée au harnais).
- `minor: true` : ne compte pas comme territoire pour Hegemonia (force, cadence et nombre des menaces) et n'est jamais ciblée.
- Il ne débloque pas de chapitre.
- Effet de bord voulu : le jalon « Première Bannière » se déclenche au tour 2.
- Équilibrage : les bots le prendront aussi. Mesure au harnais sur 8 graines, à comparer à la 1.4.0. On vise des écarts dans le bruit.

## 3. Le tutoriel, tour par tour

Tour 1, les trois ordres sont utilisés :

| # | Réplique | Fin de l'étape |
|---|---|---|
| 1 | Présentation de PROMETHEUS, d'Hegemonia et de la mission | Clic |
| 2 | Les réserves, et les deux qui font perdre à 0 | Clic |
| 3 | 3 points par tour, qui ne se gardent pas : « utilisons-les tous » | Clic |
| 4 | Entrer dans Alpha-7 | Vue base |
| 5 | Ordre 1/3 : bâtir le Réacteur | Réacteur bâti |
| 6 | Ordre 2/3 : bâtir l'Usine | Usine bâtie |
| 7 | Des automates pillent les Ruines de Grenoble, à un tour : proie facile. Retour à la carte, puis sélectionner Grenoble. | Grenoble sélectionnée |
| 8 | Préparer l'assaut (PROMETHEUS estime nos chances) | Écran d'assaut ouvert |
| 9 | Ordre 3/3 : lancer l'assaut | Armée en marche |
| 10 | Le dôme est vide : recruter une Sentinelle (gratuit, elle reste en garnison) | Garnison ≥ 1 |
| 11 | Tous les ordres sont donnés : terminer le tour | Combat lancé |
| 12 | Pendant le combat : comment il se déroule, ×2 / ×3 | Retour à la carte |
| 13 | Grenoble est à nous : cache, premier territoire, la garnison protège | Clic |
| 14 | Ouvrir le Savoir | Savoir ouvert |
| 15 | Les trois voies et les paliers | Clic |
| 16 | Lyon, Marseille et Turin : bien plus solides. Une vraie armée, ou de l'influence pour s'allier. | Clic |
| 17 | L'encart Objectifs, le bouton Aide, « je signalerai chaque danger » | Clic |

- Chaque étape se valide toute seule si le joueur fait l'action avant qu'on la lui demande.
- Le conseil « combat » et le conseil « garnison » ne se déclenchent plus en double pendant le tutoriel.

## 4. Objectifs honnêtes

- La règle « Tenir Lyon, Marseille ou le CERN » est remplacée par **« Attaquer X (≈ NN %) »**. X est la cible voisine d'un territoire tenu qui donne les meilleures chances à l'armée actuelle, à condition qu'elles dépassent 50 %. L'estimation (30 simulations) est mise en cache par tour et par armée.
- Si aucune cible ne passe les 50 % : « Renforcer l'armée », avec l'explication (recruter, Caserne, recherche).

## Découpage

1. Nœud Grenoble, carte, mesure au harnais.
2. Portrait, voix mot à mot, clic pour passer.
3. Nouveau tutoriel et objectifs honnêtes.
4. Tests Chrome (nouvelle partie complète jusqu'au tour 3, guide activé, puis tutoriel passé), revue, documentation, version.

## Résultats (2026-10-09)

Mesure : 50 parties × 8 graines par bot, comparée à la 1.4.0. Les bots font le raid d'ouverture du tutoriel (assaut au tour 1, retour au tour 2), puis ignorent Grenoble.

| Étape de réglage | Conquête | Diplomatie | Tortue | Moyen |
|---|---|---|---|---|
| 1.4.0 | 78,8 | 93,8 | 86,2 | 35,0 |
| Grenoble comptée comme territoire | 66,0 | 82,2 | 71,0 | 30,5 |
| `minor` (hors menaces) | 65,0 | 89,5 | 77,5 | 33,2 |
| Bots qui ignorent Grenoble | 78,8 | — | 86,2 | — |
| Raid au tour 1, sans retour de l'armée | 42,5 | 66,0 | 86,2 | 35,2 |
| Avec retour, sans la garde paniquée des bots | 63,2 | 89,2 | 86,2 | 31,2 |
| **Cache 20/10/10 (retenu)** | **78,8** | **93,2** | **86,2** | **33,8** |
| Cache 30/15/15 | 84,8 | — | — | 39,0 |

Enseignements :
- Un territoire de plus renforce Hegemonia, d'où `minor`.
- Laisser l'armée dans un cul-de-sac fait tomber Alpha-7 : le tutoriel fait ramener l'armée.
- Le raid coûte 2 points de commandement (aller et retour) : avec la petite cache, c'était un coup perdant. Avec 20/10/10, il est neutre à légèrement positif, sans être écrasant.
