# Harnais d'équilibrage (headless)

Simule des parties complètes de Post-Europe 2147 sous Node, sans navigateur ni dépendance.

```sh
node tools/sim/run.js                                  # 50 parties par bot, graine 1, 40 tours max
node tools/sim/run.js --games 200 --bot diplomatie     # un seul bot (ou liste : conquete,tortue)
node tools/sim/run.js --seed 7 --maxTurns 30 --json    # sortie JSON
node tools/sim/run.js --bot conquete --aim hegemon      # force un objectif de fin
```

## Fonctionnement

- `loader.js` lit `js/data.js` et `js/game.js` **à chaque exécution** et les exécute dans un contexte `node:vm`. Toute fonction appelée par le jeu mais absente (UI de `render.js`, `guide.js`…) est remplacée par un stub générique. `document` est un faux DOM tolérant ; `localStorage` vit en mémoire ; `Math.random` est graine (esquive des Agents).
- Les animations sont neutralisées (`playBattle`, `playBattle3D`, `showResult`, `phaseSwitch`, `startTw`) : `runBattle` et `resolveCombat` d'origine s'exécutent tels quels (blessures de héros comprises).
- `showEvent` / `showChapter` / `showDefeat` / `triggerEnding` sont enveloppés pour enregistrer l'écran. Le bot répond aux événements avec le vrai `onEvtChoice(i)` et ferme les chapitres avec `dismissCh()`.
- `bots.js` : trois stratégies jouant uniquement via les fonctions d'action du jeu (points de commandement compris).
  - `conquete` : recherche militaire, conquiert ruines, avant-postes, Nexus et cités, laisse des garnisons sur ses conquêtes, attaque Berlin dès qu'une fin de victoire est débloquée.
  - `diplomatie` : Cœur 2, Canaux diplomatiques, Antenne, alliances ; ne conquiert aucune cité ; vise la Pax Europaea.
  - `tortue` : économie complète, grosse garnison, alliances opportunistes, offensive à partir du tour ~20.
  - Règles communes : un assaut n'est lancé que si des simulations (`generateForce` + `simulateBattle`, graine du tour courant et du tour d'arrivée) le donnent gagnant ; Alpha-7 reçoit une garnison suffisante face aux menaces annoncées et à la menace projetée avant que l'armée parte ; fortification au tour d'impact.
  - Chaque partie fait varier légèrement le bot (seuil d'assaut, tour d'offensive, ordre de construction) et ses choix d'événements, d'où une distribution de résultats.
- `moyen` : joueur humain correct mais imparfait (estimation grossière Σ PV × Σ ATK, risques, oublis de garnison, événements au hasard pondéré).
  - Objectifs de fin par partie (`aims`, forçables avec `--aim`) : conquete → bastion/hégémon/singularité, diplomatie → pax/europe/singularité, tortue → europe/bastion/pax.
- Préférences par cité (`cityPrefs` : `ally` ou `take`) : tortue s'allie à Lyon et Marseille et vise Turin ; le moyen tire une préférence par cité à chaque partie.
- `run.js` : boucle de partie et rapport (premier statut de chaque cité, prise ou alliance, victoires, fins, causes de défaite, tours moyens, courbes de ressources aux tours 5/10/15/20/30, % de tours au plafond, combats, premiers tours de menace/alliance/conquête, armée).

Si une évolution du jeu casse un bot, l'erreur est comptée et affichée (`ERREURS dans N parties`) sans arrêter la série.
