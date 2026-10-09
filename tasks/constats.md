# Constats — tour du projet (2026-10-08)

Lecture du code uniquement (`game.js`, `data.js`, `render.js`, index, CI, docs). Pas de partie jouée de bout en bout.

## 1. Les choix du joueur pèsent peu

- **15 drapeaux narratifs sur 23 ne sont jamais lus** (`allianceLyon`, `refugiesAccueillis`, `saboteurIdentifie`, `voieLiberatrice`, `revanche`, `sommetPropose`…). Ces choix d'événement se limitent donc à ± quelques ressources.
- **L'événement « Alliance de Lyon » (tour 13) ne crée pas d'alliance** sur la carte (`map.allied` n'est pas touché).
- **Les fins se choisissent dans une liste** après Berlin : on prend celle qu'on préfère parmi les fins débloquées, sans que la partie l'impose.
  - « Capitulation » est toujours proposée, même après avoir pris Berlin.
  - « Europe Unie » ne demande qu'une alliance et 12 d'influence.
  - « Exode » ne demande que le bâtiment Titan.
- **Combat 100 % automatique** : seule la composition de l'armée compte. Aucun ordre, aucune formation, aucune estimation de victoire avant l'assaut.
- **Peu de décisions de construction** : 10 bâtiments uniques (niveaux 1 à 3), puis plus rien à bâtir.
- **Aucune rejouabilité** : carte fixe, événements à tour fixe, graines déterministes. Deux parties sont identiques.

## 2. Économie et équilibrage

- **Pas d'entretien des unités** : l'armée ne coûte rien une fois recrutée. Seule la taille max limite l'armée, et les ressources montent vite au plafond (200).
- **Les défaites économiques sont quasi impossibles** :
  - Blackout : la production de base d'énergie (+5) est ajoutée avant le test.
  - Révolte : la stabilité revient seule vers 40 à chaque tour.
- **La stabilité n'a d'effet qu'en dessous de 30 ou au-dessus de 70** (±2 ATK).
- **L'influence de départ est nulle** : alliance impossible avant le Cœur niveau 2, la recherche et l'Antenne (vers le tour 10 environ). Le chemin diplomatique démarre tard.
- **Un assaut perdu détruit toute l'armée**, sans retraite possible : la punition est très dure par rapport au reste.
- **L'équilibrage n'est vérifié par aucun outil**, alors que `simulateBattle` est pur et facile à simuler en masse sous Node.

## 3. Vestiges du mode « 30 vagues »

- `ROADMAP.md` est entièrement obsolète : il parle de vagues et liste des choses déjà faites (arbre techno, événements).
- Dans les événements, le champ s'appelle encore `wave`. « Le Jour du Choix » (tour 29) annonce un « assaut final » sans lien avec Berlin.
- Le chapitre 3 se déclenche au tour 20, quoi qu'il se passe sur la carte.
- Le texte de la défaite « Annihilation » dit « Trois défaites consécutives », alors qu'une seule défense perdue sur Alpha-7 suffit.
- Le chapitre 1 parle de « repousser les premiers raiders ».

## 4. Ressenti de jeu absent

- **Aucun son** (ni musique, ni effets).
- **Pas de niveau de difficulté.**
- **Pas d'écran de bilan utile** : la fin n'affiche que tours, bâtiments et événements.
- **La vue base 3D n'est pas interactive** (déjà noté dans `todo.md`).

## 5. Technique

- **Aucun test.** Le seul filet de sécurité est un script puppeteer resté dans le scratchpad d'une session passée.
- Tout le JS est en variables globales et scripts classiques. `game.js` (1 255 lignes) mélange règles, DOM et animation.
- **Le cache-busting `?v=46` est manuel** : on l'oublie facilement, et on l'a déjà payé.
- **Dépendance aux CDN** (Three.js, polices, Phosphor) : hors ligne, le jeu perd la 3D et les icônes.
- **Une seule sauvegarde.** Les migrations sont faites à la main dans `loadSave`, sans numéro de version fiable.
- `tasks/` n'est pas suivi par git. Le README se résume à deux lignes.
- La CI a encore une étape « Debug tree » de mise au point.

## Priorités proposées

1. **Rendre les choix significatifs** : brancher les drapeaux orphelins sur des conséquences réelles (carte, unités, événements suivants), imposer la fin selon le parcours au lieu d'un menu, et retirer « Capitulation » des fins de victoire.
2. **Créer un harnais d'équilibrage** sous Node : simuler N parties avec des stratégies types (conquête, diplomatie, tortue), puis régler l'entretien des unités, la pression des menaces et la courbe d'influence à partir de vrais chiffres.
3. **Donner une vraie décision tactique** avant chaque combat : estimation de victoire, retraite possible, choix des unités engagées. Ce sont les deux grands manques face à Demacia Rising.
4. **Nettoyer les vestiges des vagues** (ROADMAP, textes, `wave` → `turn`, chapitre 3 lié à la carte).
5. **Ajouter des sons et une difficulté** : un gain de ressenti rapide pour un coût faible.
