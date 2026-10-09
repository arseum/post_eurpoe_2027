# Lessons

- Le serveur local tournait toujours sur le port 8000, souvent déjà pris. Solution : `serve.sh` choisit un port libre dynamiquement au lieu d'un port fixe.

- Sélecteur d'ID + classe d'état : `#drawer { transform: … }` l'emporte sur `.drawer.open { transform: none }`, et `#battle2d { display: grid }` sur `.stage-view { display: none }`. Règle : quand un élément a un style par ID, écrire ses états avec l'ID (`#drawer.open`, `#battle2d.on`).
- Scripts puppeteer : `page.evaluate('endTurn()')` attend la promesse async (combat compris) ; lancer via `setTimeout(endTurn, 0)` pour garder la maîtrise du timing des captures.
- Ne jamais centrer avec `transform` un élément qui porte une animation d'entrée finissant par `transform: none` (fill `both`) : le centrage est écrasé. Centrer en flex/grid et réserver `transform` à l'animation.

- Scripts d'édition Python : `str.replace` remplace toutes les occurrences. Vérifier `count == 1` avant de remplacer, sinon un extrait identique dans une autre fonction est modifié (bug du bot moyen, `P is not defined`). Toujours lire la ligne `ERREURS` du harnais.
- Captures puppeteer avec SwiftShader : la carte 3D rend `page.screenshot` très lent. Lancer Chrome avec `protocolTimeout: 300000` et attendre ≥ 15 s après un combat lancé par `setTimeout(endTurn, 0)` avant de capturer.
- Les événements ont une fenêtre de tours tirée par la graine : dans un script de test, ne pas supposer qu'un événement tombe au tour indiqué par `turn` ; l'afficher directement avec `showEvent(EVENTS.find(...))`.
- Coût en tokens : un agent repart à froid (100-300 k tokens). Reprendre un agent interrompu avec SendMessage plutôt qu'en relancer un ; coder soi-même quand le contexte est déjà chargé.
- Infobulles : `tt()` renvoie du HTML échappé, prévu pour un attribut écrit dans une chaîne (`data-tt="${tt(...)}"`). Affecté via `el.dataset.tt`, l'échappement reste visible (`<div>` affiché). Règle : `dataset.tt = ttHtml(...)`, `data-tt="${tt(...)}"`.
- Revue d'une journée de commits déjà poussés : branche temporaire depuis le commit de base, `git restore --source=main --staged --worktree .` puis `git restore --staged .`, et `git add -N` sur les fichiers nouveaux (sinon absents de `git diff`). Retour : `git diff main > patch`, `git checkout -f main`, `git apply`.
- Refactor du jeu : comparer le JSON de `tools/sim/run.js --json` avant/après (hors `elapsedMs`), le harnais est déterministe. Les animations de combat y sont neutralisées : les tester dans Chrome.
- Les agents de revue se trompent parfois (`spendCommand` « sauvegarde deux fois » était faux) : vérifier chaque constat dans le code avant de corriger.
- Sauvegarde : jamais pendant le traitement d'un tour (`endTurnBusy`) ni en combat, sinon un rechargement donne un tour à moitié appliqué (production doublée, partie bloquée en phase `battle`).

- Ajouter un nœud ou une option de carte : mesurer au harnais sur 8 graines, et vérifier séparément l'effet du jeu et celui des bots. Un bot qui ignore le nœud donne la référence. Les bots réagissent mal aux nouveautés (cible rentable au mauvais moment, garde paniquée, armée bloquée dans un cul-de-sac). Leur faire jouer le coup enseigné au joueur avant de conclure sur l'équilibrage.

- Tester un parcours guidé avec de **vrais clics** (`page.mouse.click` au centre de l'élément, et `document.elementFromPoint` pour vérifier qu'il n'est pas recouvert), jamais seulement en appelant les fonctions (`launchAssault()`). Le tutoriel « fonctionnait » en test, mais la carte du guide recouvrait le bouton « Lancer l'assaut » et bloquait le joueur. Règle : toute fenêtre flottante, guide compris, doit s'écarter de la cible qu'elle désigne (`coversTarget` / `.flip`).
