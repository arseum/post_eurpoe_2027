# Post-Europe 2147

Jeu de stratégie narratif en JavaScript, sans dépendance ni build. Vous dirigez Alpha-7, un dôme survivant dans une Europe dévastée, assisté par l'IA PROMETHEUS. Gérez votre base, recherchez des technologies, recrutez une armée, prenez ou alliez-vous aux cités (chacune offre un atout différent selon la voie choisie), pillez les ruines de la carte d'Europe, puis marchez sur Berlin, capitale d'Hegemonia. La fin dépend de vos choix, de vos alliances et de la confiance accordée à PROMETHEUS.

## Lancer le serveur local

```
./serve.sh
```

## Lancer le harnais d'équilibrage

```
node tools/sim/run.js --games 10
```

Voir `tools/sim/README.md` pour les options (bots, graine, objectifs de fin, sortie JSON).

## Structure des fichiers

- `index.html`, `style.css` : interface et styles
- `js/data.js` : données du jeu (équilibrage, unités, bâtiments, carte, événements, recherche, fins)
- `js/game.js` : état, règles, tours, combats, sauvegarde
- `js/render.js`, `js/guide.js` : interface et guide de PROMETHEUS
- `js/scene3d.js`, `js/base3d.js`, `js/map3d.js`, `js/fx3d.js`, `js/emblem3d.js`, `js/geo-europe.js` : scènes 3D, emblèmes des cités et géographie
- `js/audio.js` : sons
- `js/version.template.js` : version injectée au déploiement
- `assets/models` : modèles 3D
- `tools/sim` : harnais de simulation headless
- `tasks` : plans, constats et leçons de développement
- `.github/workflows/deploy.yml` : déploiement GitHub Pages
