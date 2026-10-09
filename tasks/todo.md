# Todo

## Vers un vrai jeu — chantier 2026-10-08

Source : `tasks/constats.md`. Ordre imposé : 1 → 2 → 3 → 4.

### Phase 1 — Choix significatifs
- [x] Spec de conception (deep-reasoner, `tasks/spec-phase1.md`) : conséquences des 15 drapeaux orphelins, fin imposée par le parcours, Capitulation retirée des victoires, événement Alliance de Lyon branché sur la carte
- [x] Implémentation `data.js` / `game.js` / `render.js` / `style.css` (`?v=47`)
- [x] Vérification : harnais (90 parties, 0 erreur) + navigateur (hint, décisions sur Alpha-7, fin calculée avec récap), 0 erreur console

### Phase 2 — Harnais d'équilibrage
- [x] `tools/sim/` : chargement headless de `data.js` + `game.js` (Node vm, stubs DOM), bots conquête / diplomatie / tortue, rapport chiffré
- [x] Mesures de référence (150 parties : 100 % victoire, 0 assaut perdu)
- [x] Réglages : entretien des unités, pression des menaces, courbe d'influence, défaites économiques réelles
- [x] Mesures après réglage (`tasks/equilibrage-phase2.md`)

### Phase 3 — Décision tactique avant combat
- [x] Estimation de victoire (120 simulations, dégâts ±20 %) dans l'écran « Préparer l'assaut » + chances de tenir sur les cartes de menace
- [x] Consigne de repli (jusqu'au bout / prudent / très prudent), survivants ramenés au point de départ
- [x] Choix des unités engagées (les autres restent en garnison)
- [x] Re-mesure au harnais (experts 85-90 %, moyen 50 %) + navigateur (`?v=49`, 0 erreur)

### Phase 4 — Nettoyage, son, difficulté
- [x] ROADMAP réécrit, `wave` → `turn`, chapitre 3 lié à la carte, textes (annihilation, raiders, jour du choix)
- [x] Sons Web Audio (`js/audio.js`, synthèse + nappe d'ambiance, bouton Son du rail)
- [x] Difficulté facile / normal / difficile (`DIFFICULTIES` sur `BALANCE`, écran titre, `--difficulty` au harnais)
- [x] Bilan de fin enrichi (`state.stats`, 10 indicateurs)
- [x] Vérification finale navigateur 1600×900 + 1280×720, `?v=50`, 0 erreur console

### Revue (2026-10-08)

- Phase 1 : 16 décisions à effet permanent (`DECISIONS` + `activeEffects`), conséquences annoncées (`hint`), échos narratifs, Alliance de Lyon réelle, fin calculée par le parcours (5 fins de Berlin + Exode alternatif, Capitulation = défaite), écran « Pourquoi cette fin », graine par partie.
- Phase 2 : `BALANCE` centralisé, entretien en énergie, menaces variables et croissantes, milice alliée, razzias. Harnais `tools/sim/` avec 4 bots. Normal : experts 85-90 %, moyen 50 %.
- Phase 3 : dégâts ±20 %, écran « Préparer l'assaut » (chances sur 120 simulations, unités engagées, consigne de repli), chances de tenir sur les menaces.
- Phase 4 : vestiges des vagues nettoyés, chapitre 3 lié à la carte, sons synthétisés, 3 difficultés (facile : experts 100 % ; difficile : experts 20-55 %, moyen 20 %), bilan de fin, ROADMAP/README.
- Limites : le bot moyen en facile finit souvent à la limite de tours (bot trop attentiste) ; aucune révolte observée ; sons non écoutés (seulement vérifiés sans erreur) ; pas de partie complète jouée à la main.

## Guide de PROMETHEUS (tutoriel interactif)

Guide non bloquant piloté par l'action : carte conseiller + anneau de mise en évidence, étapes validées par les vraies actions du joueur, conseils contextuels uniques. Option sur l'écran titre, activée par défaut.

- [x] `js/guide.js` : étapes, conseils, carte, anneau, préférences
- [x] Interrupteur écran titre (localStorage, activé par défaut) + bouton Guide du rail
- [x] `state.guide` (newGame / defaultState / loadSave)
- [x] Hooks `guideUpdate()` (render, renderBuildPhase, toggleResearch, processNext, dismissCh)
- [x] `data-node` sur les étiquettes 3D
- [x] CSS `.switch`, `#guide-card`, `#guide-ring`, `?v=45`
- [x] Vérification : parcours complet des étapes par actions réelles, conseils menace/combat, passer/relancer, option désactivée, ancienne sauvegarde, 1600×900 + 1280×720, 0 erreur console

### Revue (2026-10-08)

- Guide non bloquant de 13 étapes, validées par les vraies actions (ouvrir le Dôme, bâtir, ouvrir l'Armée, recruter, cliquer Lyon, finir le tour, ouvrir le Savoir) + 7 conseils contextuels uniques (menace, combat, commandement épuisé, marche, première colonie, héros, chapitre 2).
- Option sur l'écran titre, activée par défaut, mémorisée (`pe2147_guide`) ; bouton Guide dans le rail pour couper/relancer ; « Passer le guide » dans la carte.
- Vérifié (puppeteer, 1600×900 + 1280×720) : progression 0 → 13 par actions réelles, anneau sur la bonne cible à chaque étape (y compris étiquettes 3D et fenêtre Recherche), masquage pendant les événements, conseil de combat affiché puis expiré, option désactivée persistante, ancienne sauvegarde sans `guide`, 0 erreur console.
- Corrigé en route : l'écran titre n'était pas centré (l'animation `rise` écrasait `translateY(-50%)`), l'interrupteur sortait de l'écran en 720 px.

## Refonte UI/UX « Bastion doré » — Livraison 1 : écran campagne

Plan détaillé : direction Bastion doré (bleu-nuit, filets laiton, Marcellus SC, teal = action), carte = scène plein écran, panneaux contextuels, vraie Europe en relief.

- [x] Données géo `js/geo-europe.js` (côtes + fleuves, bbox lon −6…20 / lat 41…56)
- [x] `geo` sur les 10 nœuds de `MAP_NODES`
- [x] `index.html` : coque HUD, polices, Phosphor, `?v=44`, titre corrigé
- [x] `style.css` : réécriture complète sur tokens
- [x] `render.js` : barre haute, rail + tiroirs, panneau colonie, menaces, fin de tour, toasts
- [x] Recherche restylée (arbre plein écran)
- [x] `map3d.js` : terrain relief, projection géo, bannières, routes, `focus`, `pulse`
- [x] `game.js` : hooks feedback (toasts, pulse), modales événement/chapitre/fin, résultat combat
- [x] HUD combat plein écran
- [x] Écran titre avec carte en fond
- [x] `base3d.js` : palette
- [x] Vérification : captures 1600×900 + 1280×720, parcours scripté, 0 erreur console, sauvegarde existante
- [x] Revue + leçons + mémoires

### Revue (2026-10-08)

- Coque HUD Demacia : carte 3D plein écran, barre ressources/tour/commandement, rail + tiroirs (Dôme, Armée, Héros, Journal), panneau colonie contextuel, cartes de menace, médaillon fin de tour, toasts, Échap ferme tout.
- Carte : vraie Europe (Natural Earth 50m, `js/geo-europe.js`), relief procédural (Alpes, Pyrénées, Apennins…), fleuves, nœuds géolocalisés (`geo` dans `MAP_NODES`), modèles par type, bannières de statut, routes animées depuis l'armée, temps de marche sur la route sélectionnée, `focus`/`pulse`.
- Combat 3D : HUD (barres de force, round, rapport, vitesse), palette harmonisée.
- Règles de jeu inchangées ; `game.js` ne reçoit que des hooks (toasts, pulse, balisage des modales).
- Vérifié par puppeteer (Chrome + SwiftShader) en 1600×900 et 1280×720 : titre, carte, sélection, tiroirs, recherche, événement, marche → combat 3D → conquête du CERN, défense, menaces, vue base, reprise de sauvegarde après rechargement, Échap. 0 erreur console (hors 404 attendu de `version.js`).
- Limites connues : la vue base 3D reste sommaire (livraison 2) ; sans réseau, polices/icônes/Three.js (CDN) ne chargent pas et le jeu bascule en combat 2D.

## UX à revoir (suite, livraison 2)

- [ ] Rendre la vue base 3D interactive (cliquer sur un bâtiment pour agir)
- [ ] Ajouter un guide de début de partie pour les premières actions
- [x] Réduire le nombre de boutons visibles en même temps (couvert par la livraison 1)
- [x] Ajouter un retour visuel clair après chaque action du joueur (couvert par la livraison 1)

## Phase 2 — Équilibrage mesuré (harnais)

- [x] `BALANCE` plat dans `data.js`, lu par `game.js` (refactor à iso-résultat, vérifié au harnais)
- [x] Bot « moyen » (estimation grossière, risques, oublis, événements au hasard pondéré)
- [x] Profils de fin par partie pour les bots experts (`--aim`)
- [x] Entretien des unités en énergie (production nette affichée juste)
- [x] Réglages : menaces, Berlin, données, influence, alliés — itérations mesurées
- [x] Textes (desc, hint) alignés sur les nouvelles valeurs
- [x] `tasks/equilibrage-phase2.md` : avant/après

### Revue (2026-10-08)

Experts 88/90/90 %, moyen 44 %, les 6 fins obtenues sur 50 parties, victoire typique t26-31 (min t19). Détails : `tasks/equilibrage-phase2.md`.

## Transition de tour et confirmation (2026-10-08)

- [x] Confirmation si des points de commandement restent inutilisés (`requestEndTurn`, `showEndTurnConfirm`)
- [x] Voile de transition « Une nuit passe sur l'Europe » avec bascule du numéro de tour (`passDay`, `#day-veil`)
- [x] Cycle jour/nuit sur la carte 3D pendant la transition (`Map3D.passDay`)
- [x] Respect de `prefers-reduced-motion` (fin de tour directe)
- [x] Case « Ne plus me demander » + interrupteur « Confirmer la fin de tour » à l'écran titre (`pe2147_end_confirm`)
- [x] Bug : balises `<div>` visibles dans l'infobulle Commandement (`ttHtml`)
- [x] Signature discrète en bas à gauche de l'accueil (nom, portfolio, GitHub, LinkedIn, e-mail)
- [x] Vérifié dans Chrome headless : confirmation, retour, transition, tour sans points restants

### Revue
`endTurn()` reste inchangé (harnais `tools/sim` non affecté). Le bouton passe par `requestEndTurn()`, la logique du tour s'exécute sous le voile au bout de 1,15 s, puis le voile se dissipe et laisse apparaître événements ou combat.

## Revue de la journée : /simplify + /code-review (2026-10-08)

- [x] Branche temporaire `revue-08-10` (diff `0e9dab6..main`), supprimée après transfert
- [x] /simplify : 4 angles, corrections ciblées appliquées, refontes d'architecture écartées
- [x] Iso-résultat prouvé au harnais (30 parties × 4 bots, JSON identique hors durée)
- [x] /code-review high : 8 constats confirmés corrigés (sauvegarde en plein tour, défense alliée tirée deux fois, garnison d'assaut au mauvais tour, « sans défense » à 0 %, chapitre qui régresse, graine des bots, bascule du son, migration v1)
- [x] Tests Chrome : actions, Échap sur l'assaut, combats 3D et 2D, chapitre, défaite, rechargement en plein combat

## Confirmation de fin de tour : portée par campagne (2026-10-08)

- [x] Interrupteur « Confirmer la fin de tour » retiré de l'accueil (jugé non pertinent)
- [x] « Ne plus me demander pendant cette campagne » : stocké dans la sauvegarde (`state.skipEndConfirm`), reposé à chaque nouvelle campagne
- [x] Vérifié : case cochée, rechargement, nouvelle campagne

## Prototype : base 3D plus belle (2026-10-08)

- [x] Trouver un pack CC0 de bâtiments sci-fi (GLB), vérifier la licence et le poids
- [x] Rendu : ombres, éclairage d'environnement, halo (bloom), sol
- [x] Remplacer réacteur, usine, antenne par des modèles du pack recolorés (bleu nuit / or / teal)
- [x] Captures avant/après, prototype validé par l'utilisateur
- [x] Étape 2 : 7 autres bâtiments en modèles du pack (lueur par ressource), tour du cœur sur mesure, anneaux de niveau harmonisés
- [x] Vérifié : construction, niveaux 2-3, cœur, bascule carte/base, combat 3D, aucune erreur console

## Base 3D interactive (2026-10-09)

- [x] Zones cliquables par emplacement et sur le cœur, clic distingué du glisser (5 px)
- [x] Survol : anneau doré + nom et niveau près du curseur ; sélection : anneau teal qui tourne
- [x] Panneau latéral bâtiment / cœur : niveau, production actuelle et suivante, bouton Améliorer / Éveiller
- [x] Emplacement vide : ouvre le tiroir de construction ; Échap et ✕ ferment le panneau
- [x] Tests Chrome : survol, clic, amélioration, cœur, vide, glisser, Échap ; non-régression carte et combats
- [x] Entrer dans la base n'ouvre plus le tiroir Dôme (écran allégé) ; guide adapté : « Entrez dans Alpha-7 » puis « cliquez sur un emplacement libre » — testé de bout en bout

## Identité des cités (spec : `tasks/spec-identite-cites.md`, 2026-10-09)

- [x] Spécification rédigée
- [x] Validation de la spec par l'utilisateur
- [x] Étape 1 : `identity` dans `MAP_NODES`, `cityDividend`, `sealAlliance`, `unitCost`, milice de Marseille, harnais (iso-résultat puis réglage)
- [x] Étape 2 : panneau de colonie (cartes Prendre / S'allier), infobulles, toasts, guide
  - Cartes empilées (368 px de large), garnison estimée dans la carte Prendre, action dans chaque carte ; cité tenue = carte active ; perdue / alliée tombée = carte grisée
  - Infobulle des ressources : « Dont Lyon, La Ligue marchande +4 » ; journal à la prise et à la perte (« Atout perdu », « Pacte rompu »)
  - Guide : l'étape Lyon présente les deux voies et cible les cartes
  - Vérifié : harnais identique (règles inchangées), Chrome 1440×900 (tient sans défilement) et 1280×720 (défile), 0 erreur
- [ ] Étape 3 : 3D (emblèmes carte, étendards et accessoires base, milice en combat : teinte alliée, aujourd'hui des Pillards rouges)
- [ ] Étape 4 : tests Chrome, revue, README / ROADMAP / mémoire
