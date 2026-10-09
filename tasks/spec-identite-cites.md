# Spec — Identité des cités (2026-10-09)

## Problème

Les trois cités (Lyon, Marseille, Turin) sont interchangeables, et le choix conquête / alliance ne dépend pas de la cité :

- `isHeld()` (`game.js:137`) traite une cité conquise et une cité alliée de la même façon : **même production** (`node.prod`) dans les deux cas.
- La conquête coûte −10🏛️ −5🌐, −1🏛️/t d'occupation et une garnison à tenir. L'alliance coûte de l'influence et peut tomber.
- Le choix se résume donc à « quelle ressource je dépense » et « quelle fin je vise ». Rien ne dit « Marseille, je la veux pour son arsenal ».

## Objectif

Chaque cité propose **deux dividendes différents** : un **en la prenant** (Saisie) et un **en s'alliant** (Pacte). Le joueur doit pouvoir se dire : « Lyon, je m'allie pour sa Ligue ; Turin, je la prends pour ses forges. »

Critères de réussite :
1. Le dividende de chaque cité se lit avant de choisir, dans le panneau de la colonie.
2. Au harnais, les bots experts gardent un taux de victoire entre 80 et 92 %, le bot moyen entre 38 et 50 %, et les 6 fins restent atteignables.
3. Aucune cité n'est un choix évident : chaque option (prendre ou s'allier) est retenue par au moins un profil de bot.
4. Chaque dividende se voit en 3D (carte, base ou combat).

## Règle générale

| | Saisie (conquise) | Pacte (alliée) |
|---|---|---|
| Production | **pleine** (celle d'aujourd'hui, légèrement retouchée) | **réduite** (environ la moitié, orientée vers la spécialité) |
| Bonus | un **atout matériel** pris à la cité (économie, armée) | un **service** rendu par la cité (renfort, diplomatie, défense) |
| Coûts | inchangés : −10🏛️ −5🌐, occupation −1🏛️/t, garnison, menaces attirées (poids 2) | inchangés : influence, la cité peut tomber |
| En cas de perte | le dividende disparaît, il revient si on la reprend | le service disparaît, il revient à la libération |

Il n'y a pas de nouvelle ressource, pas de nouveau nœud et pas de nouvelle unité dans cette version.

## Les trois cités

### Lyon — « La Bourse du Rhône » (données, diplomatie)

| | Saisie : *Le Réseau d'écoute* | Pacte : *La Ligue marchande* |
|---|---|---|
| Production | +5💾 +1🌐/t | +4💾 +1🌐/t |
| Bonus | Préavis des menaces **+1 tour** (on capte les transmissions d'Hegemonia) | Les **autres alliances coûtent −4🌐** (Lyon intercède) |
| Lecture | On sait plus tôt où frapper et quoi défendre | Lyon est la porte d'entrée de la voie diplomatique |

### Marseille — « Le Port-Forge » (matériaux, défense)

| | Saisie : *L'Arsenal phocéen* | Pacte : *La Flotte de secours* |
|---|---|---|
| Production | +5🔩 +2⚡/t | +3🔩 +2⚡/t |
| Bonus | Toutes les unités coûtent **−1🔩** (minimum 1) | Quand **Alpha-7 est attaquée**, une milice marseillaise rejoint la défense (budget `6 + tour × 0,6`) |
| Lecture | Recruter plus, plus vite : une armée de conquête | Le dôme respire : on peut envoyer l'armée loin |

### Turin — « La Cité-forge » (armée)

| | Saisie : *Les Forges alpines* | Pacte : *Le Contingent alpin* |
|---|---|---|
| Production | +4🔩 +3⚡/t | +2🔩 +3⚡/t |
| Bonus | **+4 PV** pour toutes les unités (blindages forgés) | **+1 armée max**, et 2 Sentinelles offertes une seule fois à la signature (si l'armée est pleine, elles vont dans la garnison d'Alpha-7) |
| Lecture | Une armée plus solide | Une armée plus grosse, tout de suite |

Valeurs réglées au harnais le 2026-10-09 (voir « Résultats étape 1 »).

## Données (`js/data.js`)

Ajouter un champ `identity` aux trois cités de `MAP_NODES`. `prod` reste en place pour les autres types de nœud et sert de valeur de repli.

```js
identity: {
    title: 'La Bourse du Rhône',
    conquest: {name: "Le Réseau d'écoute", desc: 'Préavis des menaces +1 tour', prod: {data: 5}, effect: {threatWarning: 1}},
    alliance: {name: 'La Ligue marchande', desc: 'Autres alliances −4🌐', prod: {data: 2, influence: 3}, effect: {allyDiscount: 4}}
}
```

Clés d'effet : `threatWarning`, `allyDiscount` et `hpBonus` existent déjà dans `activeEffects()`. On en ajoute trois :
- `unitDiscount` : remise en matériaux sur le recrutement.
- `homeRelief: true` : milice de Marseille pour défendre Alpha-7. Le budget vient de `BALANCE.reliefBase` / `reliefSlope`.
- `gift` : unités offertes une seule fois, mémorisées dans `map.gifted[id]`.

Pour `allyDiscount` (Lyon), la remise ne s'applique pas à Lyon elle-même : elle n'a d'effet qu'une fois Lyon alliée.

## Règles (`js/game.js`)

1. **`cityDividend(node)`** : renvoie `identity.conquest` si la cité est à `player`, `identity.alliance` si elle est alliée, `null` sinon.
2. **`getCampaignProduction()`** : pour une cité, utiliser `cityDividend(node).prod` au lieu de `node.prod`.
3. **`activeEffects()`** : ajouter les `effect` des dividendes actifs à l'agrégat, comme les `DECISIONS`.
4. **`sealAlliance(id)`** : une seule fonction pour sceller une alliance (passer `allied` à vrai, journal, son, impulsion, cadeau unique). On l'utilise dans les trois endroits qui le font aujourd'hui chacun de leur côté : `allyCity`, `onEvtChoice` (événement de Lyon) et la libération d'un allié tombé dans `resolveCombat`.
5. **Recrutement** : le coût affiché et le coût payé passent par une seule fonction `unitCost(u)` qui applique `unitDiscount`.
6. **Défense d'Alpha-7** : si `homeRelief` est actif, `defenseUnits('alpha7')` ajoute la milice (`generateForce`, préfixe `m`, déterministe par graine). Ses survivants ne sont pas gardés après le combat.
7. **Sauvegardes** : les dividendes se déduisent de `owner` et `allied`, donc pas de migration. On initialise seulement `map.gifted = {}` s'il est absent.

## Interface (grammaire Bastion doré, tokens de `style.css`)

- **Panneau de la colonie (cité neutre)** : sous le titre, le nom d'identité en serif (« La Bourse du Rhône »), puis deux cartes côte à côte :
  - **Prendre** : production, bonus, et rappel des coûts (−10🏛️ −5🌐, garnison).
  - **S'allier** : production, bonus, et coût en 🌐.
  
  Les boutons d'action existants (assaut, alliance) passent dans leur carte respective.
- **Cité tenue** : une seule carte, celle du dividende actif, marquée « actif ».
- **Cité perdue ou alliée tombée** : la carte est grisée, avec « Reprenez-la pour rétablir… ».
- **Infobulles de production** : la ligne de la cité donne le nom du dividende (« Lyon — Ligue marchande +2💾 +3🌐 »).
- **Toasts** : à la signature ou à la prise, par exemple « Arsenal phocéen : unités −1🔩 ».
- **Guide de PROMETHEUS** : une phrase lors de la première sélection d'une cité neutre : « Chaque cité offre autre chose selon que vous la prenez ou vous alliez à elle. »

## Traduction 3D

- **Carte (`map3d.js`)** : un emblème par cité au-dessus du nœud (balance, ancre, enclume), teinté selon le statut : or pour une cité conquise, teal pour une alliée, gris pour une neutre.
- **Base (`base3d.js`)** : un étendard de la cité sur la tour du cœur pour chaque dividende actif. En plus, pour la Saisie :
  - Arsenal : une grue près de l'usine.
  - Forges : une lueur orangée sur la caserne.
  - Réseau d'écoute : une parabole sur l'antenne.
- **Combat (`scene3d.js`)** : la milice marseillaise entre avec une teinte distincte et un toast « La flotte de Marseille débarque ».

## Harnais (`tools/sim`)

- Les bots lisent `identity` pour décider, par profil : `conquete` prend Marseille et Turin, `diplomatie` s'allie à Lyon d'abord, `moyen` choisit au hasard pondéré.
- Le rapport compte, par cité, combien de fois elle a été prise ou alliée.
- Comparer avant et après sur 50 parties × 4 bots, plus un contrôle sur les graines 2 à 4.

## Hors périmètre (étapes suivantes possibles)

- Une unité unique par cité (par exemple la Bombarde de Turin), qui demande des modèles 3D.
- Des événements propres à chaque cité selon son statut (grève des forges, émeute du port, chantage de la Ligue).
- Un troisième statut, « vassale ».
- Des traits de cités tirés au hasard à chaque campagne (chantier rejouabilité).

## Questions ouvertes

1. Une cité alliée rapporte environ la moitié de sa production actuelle. C'est voulu, pour que le service compense, mais c'est un affaiblissement de la voie diplomatique, à surveiller au harnais.
2. Faut-il exclure la Flotte de secours de Marseille de la Pax Europaea ? Je propose que non, elle reste compatible.

## Découpage

1. Données + règles + `sealAlliance` + harnais : refactor à iso-résultat d'abord, prouvé par un JSON identique, puis dividendes et réglage.
2. Panneau de colonie, infobulles, toasts, guide.
3. 3D : emblèmes sur la carte, étendards et accessoires dans la base, milice en combat.
4. Tests Chrome de bout en bout, revue, mise à jour de README, ROADMAP et mémoire.

## Résultats étape 1 (2026-10-09)

Refactor à iso-résultat prouvé (JSON du harnais identique, 30 parties × 4 bots), puis dividendes. Mesure : 50 parties × 8 graines par bot, comparée à `HEAD`.

| Bot | Avant | Après |
|---|---|---|
| conquete | 79,3 % | 78,8 % |
| diplomatie | 91,5 % | 93,8 % |
| tortue | 87,0 % | 86,3 % |
| moyen | 38,0 % | 35,0 % (écart dans le bruit, ±3,4) |

- Les 6 fins sont obtenues (1 600 parties). Aucune erreur de bot.
- Chaque option est choisie pour chaque cité : conquête prend les trois, diplomatie s'allie aux trois, et le bot moyen mélange.
- Écarts à la spec initiale :
  - Les alliances rapportent moins qu'avant, mais pas la moitié (−1 à −2 par cité). Avec une vraie moitié, la diplomatie tombait à 70-90 % à cause du blackout, parce que l'influence sature à 50.
  - Arsenal ramené à +2⚡.
  - Ligue marchande à +4💾 +1🌐.
- Renforcer la milice (8 + tour × 0,8) ne change pas le bot moyen : valeurs de la spec conservées.
- À faire à l'étape 3 : en combat 3D, la milice marseillaise apparaît en Pillards rouges côté joueur, ce qui prête à confusion.
