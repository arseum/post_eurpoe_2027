# Spec — Mieux accompagner le joueur (2026-10-09)

## Retour de l'utilisateur

> Le guide du début présente bien l'interface, mais on ne sait pas vraiment comment se déroule la partie ni quel est l'objectif, à long terme comme à court terme. Les atouts des cités (« Garnison », « +4 PV pour toutes les unités ») ne sont pas forcément clairs pour un nouveau joueur : une description plus claire au survol, après un petit délai, aiderait beaucoup. On peut se faire attaquer sans s'y attendre : il faut prévenir que c'est possible, et le mettre plus en évidence. Bref, il faut mieux accompagner le joueur, surtout au début et quand il débloque de nouveaux concepts.

## Constat dans le code

| Besoin | Aujourd'hui |
|---|---|
| Objectifs | Aucun affichage permanent. Le chapitre donne une phrase à son ouverture, puis rien. Les conditions des fins ne sont visibles qu'au bilan de fin. |
| Infobulles | Affichées sans délai. Le texte est court et suppose qu'on connaît les termes (PV, garnison, entretien, préavis…). |
| Menaces | Le conseil n'arrive qu'à la **première menace détectée** (2 tours de préavis), et seulement si le guide est activé. Rien ne prévient avant. La fin de tour ne signale pas qu'une colonie va tomber. |
| Nouveaux concepts | Il n'y a que 6 conseils. Ils ne s'affichent qu'une fois les 13 étapes du guide terminées, et seulement si le guide est activé. |

## Principes

- **Rester léger.** Pas de nouveau bouton permanent, sauf le suivi d'objectifs. Tout le reste est contextuel, et s'affiche une seule fois ou au survol.
- **Ne pas changer les règles du jeu.** Les objectifs ne donnent pas de récompense, donc le harnais doit rester identique.
- **Une seule voix : PROMETHEUS.** Les explications passent par la carte du conseiller, déjà connue du joueur.
- **Les informations vitales passent même si le guide est désactivé.** Le guide coupé masque les conseils pédagogiques, jamais un danger.

## 1. Suivi d'objectifs (court et long terme)

Un encart compact en haut à gauche, sous les ressources (zone vide aujourd'hui), dans le style Bastion doré. On peut le replier : il garde un liseré et le nombre d'objectifs.

```
┌ OBJECTIFS ──────────────────── ▾ ┐
│ ◆ Libérer Berlin                  │
│   Garnison ████████░░ 42 → 32     │  ← affaiblie par les avant-postes pris
│   Destin en vue : Bastion         │  ← fin obtenue si Berlin tombait maintenant
│ ─────────────────────────────── │
│ ⚠ Défendre Alpha-7 · 2 tours      │  ← court terme, 2 au plus, triés par urgence
│ ○ Prendre ou rallier un territoire│
└───────────────────────────────────┘
```

- **Long terme** : « Libérer Berlin ».
  - Une jauge montre la garnison de Berlin et ce que les avant-postes ont déjà retiré.
  - « Destin en vue » indique la fin qu'on obtiendrait si Berlin tombait maintenant. Au survol, une infobulle liste les autres fins et ce qu'il manque pour chacune.
  - Les conditions viennent de `ENDINGS[].hint` et `check`.
- **Court terme** : les 2 objectifs les plus urgents, calculés à chaque rendu par des règles par ordre de priorité. Cliquer sur un objectif centre la carte ou ouvre le bon panneau.

| Priorité | Condition | Objectif affiché |
|---|---|---|
| 1 | Menace sur un territoire à vous, chances < 60 % ou sans défense | « Défendre X · N tour(s) » (rouge) |
| 2 | Aucun bâtiment de production | « Bâtir une première production (Réacteur, Usine, Centre de données) » |
| 3 | Tour ≥ 3 et garnison d'Alpha-7 vide | « Laisser des unités en garnison à Alpha-7 » |
| 4 | Chapitre 1 | « Prendre ou rallier un premier territoire » (ouvre le chapitre 2) |
| 5 | Recherches du palier actuel épuisées, Cœur pas au maximum | « Éveiller le Cœur (niveau N) » |
| 6 | Influence suffisante pour une alliance | « S'allier à X : Y🌐 disponibles » |
| 7 | Chapitre ≥ 2, avant-postes non pris | « Prendre un avant-poste pour affaiblir Berlin » |
| 8 | Assaut sur Berlin estimé ≥ 60 % | « Lancer l'assaut sur Berlin » |

## 2. Infobulles différées et glossaire

- **Délai** : l'infobulle apparaît après **400 ms** de survol immobile, et disparaît dès que la souris sort. On évite ainsi les infobulles qui clignotent quand on traverse l'écran.
- **Glossaire** : un objet `GLOSSARY` dans `data.js` d'une vingtaine de termes, chacun avec une définition d'une à deux phrases écrite pour un débutant :
  - PV, ATK, DEF, VIT, ligne avant / arrière ;
  - garnison, armée, entretien, préavis, menace ;
  - stabilité, influence, données, matériaux, énergie ;
  - point de commandement, Cœur, palier ;
  - occupation, alliance, cité / ruine / avant-poste, repli.
- **Termes repérés** : dans les textes de l'interface (cartes de cité, panneau, menaces, guide), un terme du glossaire est souligné en pointillé (`<dfn>`), et son infobulle donne la définition.
  - Exemple : « +4 **PV** pour toutes les unités » devient au survol « Points de vie. Une unité meurt à 0. S'applique à l'armée, aux garnisons et aux héros, en attaque comme en défense. »
- **Atouts des cités** : chaque atout gagne une phrase d'explication concrète (`identity.*.help`), affichée en infobulle sur la ligne du bonus.
  - Exemple pour la Flotte de secours : « Quand Alpha-7 est attaquée, des miliciens marseillais combattent à vos côtés. Leur nombre augmente avec les tours. Ils ne restent pas après le combat. »

## 3. Menaces : prévenir avant, signaler pendant

- **Pré-alerte** (tour 3, avant la première menace possible au tour 4) : un message de PROMETHEUS, affiché **même si le guide est désactivé**.
  > « Hegemonia sait que nous sommes réveillés. Ses raids vont commencer. Chaque attaque est annoncée quelques tours à l'avance. Gardez toujours des unités en garnison à Alpha-7 : si le dôme tombe, tout est perdu. »
- **Première menace** : le conseil existant reste et passe lui aussi en vital (affiché sans guide). Il explique le préavis, le nombre de tours et les chances de tenir.
- **Menace dangereuse** : si un territoire à vous a moins de 60 % de chances de tenir, sa carte de menace pulse en rouge et l'objectif n° 1 apparaît dans le suivi.
- **Fin de tour** : si une menace arrive **au prochain tour** sur un territoire à vous sans défense, ou avec moins de 50 % de chances, une confirmation s'affiche. Elle s'affiche **toujours**, même avec « Ne plus me demander », parce que cette option ne porte que sur les points de commandement restants.
  > « Turin tombera probablement au prochain tour (20 % de tenir). » avec les boutons [Revenir aux ordres] et [Finir quand même].

## 4. Nouveaux concepts : expliquer au bon moment

- Les conseils de PROMETHEUS (`GUIDE_TIPS`) ne sont plus bloqués par les 13 étapes du guide. Ils passent après l'étape en cours, un seul à la fois, et ne reviennent pas une fois vus.
- On en ajoute une dizaine, chacun déclenché la première fois que le concept apparaît :

| Déclencheur | Contenu |
|---|---|
| Première cité sélectionnée hors guide | Les deux voies, et le fait qu'on peut les comparer |
| Première cité prise | Occupation (−🏛️ par tour), garnison à laisser, atout actif |
| Première alliance | Elle se défend seule, peut tomber, et on peut la libérer |
| Entretien > 25 % de la production d'énergie | Chaque unité consomme de l'énergie. Risque de blackout. |
| Stabilité < 30 | Effet sur l'ATK. Risque de révolte à 0. |
| Premier palier de recherche épuisé | Éveiller le Cœur pour aller plus loin |
| Nouvelle unité débloquée | Son rôle (ligne avant, soins, esquive…) |
| Chapitre 3 | La route de Berlin : Ouest (courte et dure) ou Est (longue et facile) |
| Premier territoire perdu | Le reprendre coûte plus cher avec le temps |
| Premier assaut perdu ou repli | La consigne de repli protège l'armée |

- **Codex** : le bouton Guide du rail ouvre un tiroir « Aide » avec trois onglets :
  - **Objectifs** : le détail de l'encart.
  - **Concepts** : le glossaire, plus les conseils déjà vus, pour les relire.
  - **Destins** : les 6 fins et leurs conditions.
  
  Rejouer le guide reste possible depuis ce tiroir.

## Découpage

1. Infobulles différées, glossaire, termes repérés, explication des atouts des cités.
2. Menaces : pré-alerte, alertes vitales hors guide, carte qui pulse, confirmation de fin de tour.
3. Suivi d'objectifs (court et long terme, destin en vue).
4. Nouveaux conseils, déblocage hors étapes, tiroir Aide (Concepts, Destins).
5. Tests Chrome (nouvelle partie de bout en bout avec le guide activé puis désactivé), vérification que le harnais reste identique, revue, documentation.

## Décisions (validées le 2026-10-09)

1. Alertes vitales affichées même guide désactivé.
2. Objectifs sans récompense : guidage pur, harnais identique.
3. Le bouton Guide devient « Aide » (tiroir Objectifs / Concepts / Destins + rejouer le guide).
4. Ordre de la spec.
