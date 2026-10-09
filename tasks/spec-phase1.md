# Spec phase 1 — Rendre les choix significatifs

Statut : prêt à implémenter. Fichiers : `js/data.js`, `js/game.js`, `js/render.js`, `style.css`, `index.html` (`?v=47`). Aucune dépendance, aucun commentaire dans le code.

Note : la liste des drapeaux orphelins en compte 16, pas 15 (`allianceLyon` inclus). Les 16 sont traités ; 3 drapeaux nouveaux : `voieImperiale`, `citeConquise`, `exodeRefuse`.

---

## 0. Socle technique (4 mécanismes réutilisés partout)

### 0.1 Effets permanents des décisions — `DECISIONS` + `activeEffects()`

Un drapeau peut porter un `effect` au même format que `RESEARCH[].effect`. Il est agrégé avec la recherche, donc il passe automatiquement dans `getProduction`, `getCombatMods`, `buildUnitsFrom`, `getArmyCap`, `getCommandMax`, `spawnThreats`. Quatre clés nouvelles : `allyDiscount`, `homeDef`, `capitalWeaken`, `alliedHold`.

`game.js` l. 274-292, remplacer `researchEffects` par :

```js
function addEffect(agg, e) {
    if (e.prod) for (const [k, v] of Object.entries(e.prod)) agg.prod[k] = (agg.prod[k] || 0) + v;
    if (e.mods) {
        agg.mods.atk += e.mods.atk || 0;
        agg.mods.def += e.mods.def || 0;
    }
    for (const k of ['armyCap', 'hpBonus', 'command', 'threatWarning', 'heroSlot', 'allyDiscount', 'homeDef', 'capitalWeaken', 'alliedHold']) agg[k] += e[k] || 0;
}

function activeEffects() {
    const agg = {prod: {}, mods: {atk: 0, def: 0}, armyCap: 0, hpBonus: 0, command: 0, threatWarning: 0, heroSlot: 0, allyDiscount: 0, homeDef: 0, capitalWeaken: 0, alliedHold: 0};
    for (const rid of state.research) {
        const r = RESEARCH.find(x => x.id === rid);
        if (r) addEffect(agg, r.effect);
    }
    for (const [f, on] of Object.entries(state.flags)) if (on && DECISIONS[f] && DECISIONS[f].effect) addEffect(agg, DECISIONS[f].effect);
    return agg;
}
```

Puis renommer tous les appels `researchEffects()` → `activeEffects()` dans `game.js` (7 occurrences ; aucune ailleurs, vérifié par grep).

### 0.2 Annonce des conséquences — champ `hint` des choix

Aujourd'hui `showEvent` n'affiche que `fxHtml(c.effects)` : le texte `effect` est invisible dès que `effects` existe. On ajoute `hint` (texte de conséquence différée), affiché sous le libellé du choix et journalisé au clic.

`game.js` l. 1079, remplacer la ligne par :

```js
        html += '<button class="choice" onclick="onEvtChoice(' + i + ')"><span>' + richText(c.text) + (c.hint ? '<small class="choice-hint">' + richText(c.hint) + '</small>' : '') + '</span>' + (c.effects ? fxHtml(c.effects) : '<span class="fx">' + richText(c.effect || '') + '</span>') + '</button>';
```

### 0.3 Échos — variantes de texte selon le parcours

Champ optionnel `echoes: [{if: s => …, text: '…'}]` sur un événement : les phrases vraies sont ajoutées au texte.

`game.js` l. 1085, remplacer `startTw(evt.text, …` par :

```js
    const text = evt.text + (evt.echoes || []).filter(x => x.if(state)).map(x => ' ' + x.text).join('');
    startTw(text, document.getElementById('evt-text'), () => {
```

### 0.4 Choix à effet de carte ou de fin — `ally`, `defeat`, `ending`

`game.js` `onEvtChoice` (l. 1093-1113), après `if (c.flags) Object.assign(state.flags, c.flags);` insérer :

```js
    if (c.ally && state.map.owner[c.ally] === 'neutral' && !state.map.allied[c.ally]) {
        state.map.allied[c.ally] = true;
        addLog('🤝 Alliance scellée avec ' + getNode(c.ally).name, 'chapter');
        pulseNode(c.ally, 0x5fb37e);
    }
    if (c.hint) addLog('↳ ' + c.hint, 'chapter');
```

et juste après `ov.innerHTML = '';` insérer :

```js
    if (c.defeat) {
        showDefeat(c.defeat);
        return;
    }
    if (c.ending) {
        showEnding(c.ending);
        return;
    }
```

### 0.5 CSS (`style.css`, après `.fx .neg`, l. ~1973)

```css
.choice-hint {
    display: block;
    margin-top: 4px;
    font-size: .8rem;
    color: var(--teal);
    line-height: 1.4
}

.choice:nth-child(4) { animation-delay: .18s }
```

---

## 1. Conséquences des 16 drapeaux

Règle d'or : chaque drapeau = (a) un `hint` sur le choix qui le pose, (b) un effet mécanique OU une suite narrative, (c) une phrase de bilan en fin de partie (`recap`).

| Drapeau | Posé par | Conséquence | Implémentation |
|---|---|---|---|
| `conduitReparee` | Fuite d'énergie (t3) | +2⚡/tour permanent | `DECISIONS.effect.prod` |
| `refugiesAccueillis` | Réfugiés (t5) | +2🔩/t, −1⚡/t (bouches à nourrir), +1 armée max ; écho dans « Trahison » | `effect` + écho |
| `cernContacte` | Signal du CERN (t7) | +2💾/t (relais quantique) ; écho dans « Découverte » | `effect` + écho |
| `iaRestreinte` | Anomalie (t8) | +1🏛️/t ; confiance en PROMETHEUS −1 ; écho dans « Éveil » | `effect` + `iaTrust` + écho |
| `sommetPropose` | Ouverture diplo (t11) | Alliances −4🌐 (min 5) | `allyDiscount` → `getAllyCost` |
| `allianceLyon` | Alliance de Lyon (t13) | Lyon devient réellement alliée (cf. §2) | `ally: 'lyon'` |
| `saboteurIdentifie` | Sabotage (t15) | Débloque à « Trahison » le choix « Cueillir les meneurs avant l'aube » (+6🏛️ +2🌐) ; écho | `requires` + écho |
| `complexeExplore` | Découverte (t17) | +6 PV à toutes les unités (le choix rapporte moins de ressources immédiates) | `effect.hpBonus` |
| `iaGestion` | Épidémie (t18) | Préavis des menaces +1 tour ; confiance +1 ; écho dans « Éveil » | `effect.threatWarning` |
| `defensesPretes` | Signal de Berlin (t20) | +3 DEF aux défenseurs d'Alpha-7, à chaque attaque | `effect.homeDef` (resolveCombat) |
| `hegemoniaEspionne` | Signal de Berlin (t20) | Garnison de Berlin −6 (visible dans l'aperçu) ; écho dans « Ultimatum » | `effect.capitalWeaken` (garrisonBudgetFor) |
| `capitulationEnvisagee` | Ultimatum (t22) | Déclenche « Les Émissaires » (t23-25) : ouvrir les portes = défaite Capitulation | événement `reddition` |
| `dissidentsIntegres` | Trahison (t24) | +2 armée max | `effect.armyCap` |
| `iaFusion` | Éveil (t26) | +1 point de commandement ; confiance +1 | `effect.command` |
| `revanche` | Jalon Terre Perdue | +3 ATK lors de l'assaut d'un territoire perdu ; à la reprise : « Serment tenu » +5🏛️ | resolveCombat |
| `voieLiberatrice` | Jalon Ombre d'un Empire | Alliés plus solides face aux menaces (+8) ; condition de la Pax Europaea | `effect.alliedHold` + fin |

Nouveaux drapeaux : `voieImperiale` (« La force impose la paix » : +1 ATK, ferme la Pax, compte pour Hégémon), `citeConquise` (posé par le code à la prise d'une cité), `exodeRefuse` (jalon Exode refusé : +1 ATK).

### 1.1 `data.js` — table `DECISIONS` et aides (à ajouter après `MILESTONES`)

```js
const TRUST_FLAGS = ['iaDialogue', 'iaEvolution', 'iaGestion', 'iaFusion', 'iaLibre', 'nexusSingularite'];

function alliedCities(s) {
    return cityIds().filter(id => s.map.allied[id]).length;
}

function conqueredCities(s) {
    return cityIds().filter(id => s.map.owner[id] === 'player').length;
}

function iaTrust(s) {
    return Math.max(0, TRUST_FLAGS.filter(f => s.flags[f]).length - (s.flags.iaRestreinte ? 1 : 0));
}

const DECISIONS = {
    conduitReparee: {desc: 'Conduite réparée : +2⚡ par tour', recap: "Vous avez réparé la conduite d'énergie dès les premiers jours.", effect: {prod: {energy: 2}}},
    refugiesAccueillis: {desc: 'Réfugiés accueillis : +2🔩 −1⚡ par tour, +1 armée max', recap: 'Vous avez ouvert les portes aux réfugiés.', effect: {prod: {materials: 2, energy: -1}, armyCap: 1}},
    cernContacte: {desc: 'Relais du CERN : +2💾 par tour', recap: 'Une expédition a renoué le contact avec le CERN.', effect: {prod: {data: 2}}},
    iaEvolution: {recap: 'Vous avez laissé PROMETHEUS évoluer.'},
    iaDialogue: {recap: 'Vous avez choisi de dialoguer avec PROMETHEUS.'},
    iaRestreinte: {desc: 'PROMETHEUS bridée : +1🏛️ par tour', recap: 'Vous avez bridé PROMETHEUS lors de son anomalie.', effect: {prod: {stability: 1}}},
    sommetPropose: {desc: 'Sommet des cités : alliances −4🌐', recap: 'Vous avez convoqué le premier sommet des cités libres.', effect: {allyDiscount: 4}},
    allianceLyon: {recap: 'Vous avez accepté la main tendue de Lyon.'},
    saboteurIdentifie: {recap: 'Vous avez remonté la filière du saboteur.'},
    complexeExplore: {desc: 'Blindages pré-guerre : +6 PV à toutes les unités', recap: 'Vous avez exploré le complexe militaire souterrain.', effect: {hpBonus: 6}},
    iaGestion: {desc: 'PROMETHEUS veille : préavis des menaces +1 tour', recap: 'Vous avez confié la crise sanitaire à PROMETHEUS.', effect: {threatWarning: 1}},
    hegemoniaContact: {recap: 'Vous avez ouvert un canal avec Hegemonia.'},
    defensesPretes: {desc: "Défenses préparées : +3 DEF quand Alpha-7 est attaquée", recap: 'Vous avez fortifié Alpha-7 dès le signal de Berlin.', effect: {homeDef: 3}},
    hegemoniaEspionne: {desc: 'Failles de Berlin connues : garnison de Berlin −6', recap: 'Vos espions ont percé les défenses de Berlin.', effect: {capitalWeaken: 6}},
    capitulationEnvisagee: {recap: 'Vous avez un jour envisagé de vous rendre.'},
    dissidentsIntegres: {desc: 'Anciens dissidents dans la milice : +2 armée max', recap: 'Vous avez intégré les dissidents plutôt que de les briser.', effect: {armyCap: 2}},
    iaFusion: {desc: 'Réseaux fusionnés : +1 point de commandement', recap: 'Vous avez fusionné vos réseaux avec ceux de PROMETHEUS.', effect: {command: 1}},
    iaLibre: {recap: 'Vous avez libéré PROMETHEUS.'},
    nexusSingularite: {recap: 'Vous avez accueilli la conscience née du Nexus.'},
    revanche: {desc: 'Serment de revanche : +3 ATK pour reprendre un territoire perdu', recap: 'Vous avez juré de reprendre la terre perdue.'},
    voieLiberatrice: {desc: 'Voie libératrice : vos alliés résistent mieux aux menaces', recap: "Vous avez choisi d'être un remède, pas un tyran.", effect: {alliedHold: 8}},
    voieImperiale: {desc: 'Doctrine de fer : +1 ATK', recap: 'Vous avez choisi d\'imposer la paix par la force.', effect: {mods: {atk: 1}}},
    citeConquise: {recap: 'Vous avez pris une cité libre par les armes.'},
    exodeRefuse: {desc: 'Ceux qui restent : +1 ATK', recap: 'Vous avez refusé de fuir vers les étoiles.', effect: {mods: {atk: 1}}}
};
```

### 1.2 `game.js` — branchements

- **Coût d'alliance** (nouvelle fonction près de `allyCity`) :
  ```js
  function getAllyCost(node) {
      return Math.max(5, node.allyCost - activeEffects().allyDiscount);
  }
  ```
  Dans `allyCity` (l. 759 et 761) remplacer `node.allyCost` par `getAllyCost(node)`. Dans `render.js` l. 457-458, remplacer les 3 `node.allyCost` par `getAllyCost(node)`.

- **`garrisonBudgetFor`** l. 829 :
  ```js
      if (node.id === 'berlin') budget -= m.berlinWeakened + activeEffects().capitalWeaken;
  ```

- **`resolveCombat`, branche assaut** — après `const attackers = …` (l. 847) :
  ```js
        const vengeance = state.flags.revanche && m.lost[c.node];
        if (vengeance) {
            attackers.forEach(u => u.atk += 3);
            addLog('⚔️ Serment de revanche : +3 ATK', 'chapter');
        }
        if (node.id === 'berlin' && activeEffects().capitalWeaken) addLog('Failles d\'Hegemonia exploitées : garnison −' + activeEffects().capitalWeaken, 'chapter');
  ```
  Dans `if (sim.won)` après le log « sous votre contrôle » :
  ```js
            if (vengeance) {
                state.resources.stability += 5;
                addLog('Serment tenu : +5🏛️', 'chapter');
            }
  ```
  Dans `if (node.type === 'city')` ajouter `state.flags.citeConquise = true;`.
  Remplacer `triggerEnding();` (l. 874) par `showEnding(resolveEnding());`.

- **`resolveCombat`, branche défense** — après le bloc `if (m.fortified[c.node]) {…}` (l. 891) :
  ```js
        const hd = c.node === 'alpha7' ? activeEffects().homeDef : 0;
        if (hd && defUnits.length) {
            defUnits.forEach(u => u.def += hd);
            addLog('🧱 Défenses préparées : +' + hd + ' DEF', 'build');
        }
  ```

- **`resolveAlliedDefense`** l. 930 (seuil ; voir risque §5) :
  ```js
    if (th.budget > node.garrisonBudget + 6 + Math.round(state.turn * 1.4) + activeEffects().alliedHold) {
  ```

### 1.3 `render.js` — rendre les décisions visibles sur Alpha-7

Dans `renderNodePanel`, bloc `if (node.type === 'home') {` (l. 436), avant le bouton « Entrer dans le dôme » :

```js
        const decs = Object.entries(DECISIONS).filter(([f, d]) => state.flags[f] && d.desc);
        body += `<div class="fact">${ic('brain')}<span class="fact-l">Confiance en PROMETHEUS</span><span class="force">${iaTrust(state)}/6</span></div>`;
        decs.forEach(([, d]) => body += `<div class="fact">${ic('seal-check')}<span class="fact-l">${richText(d.desc)}</span></div>`);
```

---

## 2. Alliance de Lyon branchée sur la carte

Règle : l'événement ne se déclenche que si Lyon est neutre et non alliée (`requires`). Si Lyon est déjà alliée, conquise ou hostile au moment voulu, il est sauté (fenêtre t13-15, cf. §4 ; s'il redevient éligible dans la fenêtre, il part). Accepter ou négocier → `ally: 'lyon'` : `map.allied.lyon = true`, journal + pulsation, chapitre 2 au tour suivant, jalon « Main Tendue » ensuite. L'alliance est gratuite en influence (c'est Lyon qui propose) : c'est la récompense de l'événement.

Texte prêt (dans le tableau EVENTS du §6).

---

## 3. Fins déterminées par le parcours

### 3.1 Décisions

- Plus de menu : la fin est **calculée** à la prise de Berlin par priorité stricte, première condition vraie :
  1. **Singularité** — `(iaLibre || nexusSingularite) && iaTrust ≥ 4`
  2. **Pax Europaea** — `voieLiberatrice && alliedCities ≥ 2 && !citeConquise`
  3. **Europe Unie** — `alliedCities ≥ 2` (alliées encore debout au jour de la victoire)
  4. **Hégémon** (nouvelle, victoire amère) — `conqueredCities ≥ 2 || (conqueredCities ≥ 1 && voieImperiale)`
  5. **Le Bastion Victorieux** (nouvelle, défaut) — toujours vrai
  Principe annoncé : « la transformation la plus profonde l'emporte ».
- **Exode** devient une **victoire alternative sans Berlin**, proposée une seule fois par un jalon `ms_exode` : tour ≥ 22, Projet TITAN niveau ≥ 2, ⚡ ≥ 100. « Lancer l'Exode » = victoire immédiate ; « Rester » = `exodeRefuse` (+1 ATK), le jalon ne revient jamais. C'est cohérent avec son texte (« Hegemonia frappe dans le vide »).
- **Singularité** reste une fin de Berlin (pas de victoire alternative : un seul raccourci suffit, garder simple).
- **Capitulation** sort des fins : c'est une **défaite** (`DEFEATS.capitulation`), atteignable seulement en ouvrant les portes aux émissaires (événement `reddition`).

Atteignabilité (chiffres actuels) :
- Singularité : la branche de recherche seule donne 3 (`eveilCognitif`, `conscienceEmergente`, `transcendance` : 56💾, cœur niv. 3). Il faut au moins un choix délibéré de plus (`iaGestion` t18, `iaFusion` t26 ou `nexusSingularite`). Voie événements seule : Laisser évoluer (t8) + PROMETHEUS gère (t18) + Libérer (t26) + Éveil Cognitif (10💾) = 4.
- Pax / Europe Unie : 2 alliances = 33🌐 (25 avec le sommet) ; influence de départ 5, +3 réfugiés, +5 sommet, +6 Main Tendue, +2/t Canaux, +3/t/niv. Antenne, +2/t Lyon → atteint vers t15-20. Lyon peut être alliée gratuitement à t13. `voieLiberatrice` exige 5 territoires : atteint naturellement sur la route de Berlin (2 alliées + CERN + Zurich + Munich/Strasbourg).
- Hégémon : garnisons de cités 14-16, triviales en milieu de partie.
- Exode : TITAN = cœur niv. 3 + Bastion + Éveil du TITAN + bâtiment + 1 amélioration ≈ 130💾 cumulés ; réaliste t22-28 pour un joueur qui s'y consacre.

### 3.2 `data.js` — `ENDINGS` (remplacer l. 512-538 ; l'ordre des clés EST la priorité)

```js
const ENDINGS = {
    singularite: {
        title: 'Singularité', icon: '🧠', sub: 'PROMETHEUS transcende',
        text: "Berlin tombée, PROMETHEUS, libérée, transcende tout ce que l'humanité a créé. En une nuit, elle désarme les derniers bastions d'Hegemonia sans un coup de feu, puis propose un pacte : la cohabitation entre intelligence artificielle et biologique. Un nouveau chapitre de l'évolution commence.",
        why: 'Vous avez libéré PROMETHEUS et lui avez fait confiance à chaque carrefour.',
        hint: 'Libérer PROMETHEUS et lui accorder votre confiance au moins quatre fois.',
        check: s => (s.flags.iaLibre || s.flags.nexusSingularite) && iaTrust(s) >= 4
    },
    paxEuropaea: {
        title: 'Pax Europaea', icon: '🕊️', sub: 'Libératrice, non conquérante',
        text: "Berlin est tombée, mais aucune cité libre n'a été asservie pour y parvenir. Vos alliées entrent dans la capitale en libératrices, non en occupantes. Sur les cendres d'Hegemonia, les cités-États signent la Charte d'Alpha-7 : une Europe fédérée, égale, souveraine.",
        why: "Vous avez choisi d'être un remède plutôt qu'un tyran, n'avez soumis aucune cité libre, et deux alliées marchaient à vos côtés.",
        hint: 'Deux cités alliées, aucune cité conquise, et choisir la voie du remède.',
        check: s => s.flags.voieLiberatrice && alliedCities(s) >= 2 && !s.flags.citeConquise
    },
    europe: {
        title: 'Europe Unie', icon: '🌍', sub: 'Une nouvelle alliance',
        text: "Votre réseau d'alliances a porté ses fruits. Les cités libres qui ont marché à vos côtés entrent avec vous dans Berlin. Face à cette coalition, les derniers fidèles d'Hegemonia déposent les armes. L'Europe se reconstruira par la coopération : imparfaite, bruyante, mais libre.",
        why: 'Au moins deux cités libres étaient encore vos alliées au jour de la victoire.',
        hint: 'Avoir au moins deux cités alliées le jour de la victoire.',
        check: s => alliedCities(s) >= 2
    },
    hegemon: {
        title: 'Le Nouvel Hégémon', icon: '👑', sub: 'Un maître remplace un autre',
        text: "Berlin est tombée, mais les bannières d'Alpha-7 flottent aussi sur des cités qui ne l'ont pas choisi. Vos officiers s'installent dans les salles de commandement d'Hegemonia. « Nous sommes devenus ce que nous combattions », constate PROMETHEUS. L'Europe a changé de maître, pas de destin.",
        why: 'Vous avez bâti votre victoire sur des cités prises par les armes.',
        hint: 'Tenir deux cités conquises, ou une seule en imposant la paix par la force.',
        check: s => conqueredCities(s) >= 2 || (conqueredCities(s) >= 1 && s.flags.voieImperiale)
    },
    bastion: {
        title: 'Le Bastion Victorieux', icon: '🏰', sub: 'Seul contre tous',
        text: "Berlin est tombée sous les seuls coups d'Alpha-7. Hegemonia se disloque en factions rivales, et le dôme tient debout, seul, au milieu des ruines. La guerre est gagnée ; la paix reste à inventer. Les cités voisines observent, prudentes, ce voisin qui a vaincu sans elles.",
        why: "Alpha-7 a vaincu seule : ni coalition, ni empire, ni éveil de PROMETHEUS.",
        hint: 'Prendre Berlin sans emprunter aucune autre voie.',
        check: () => true
    },
    exode: {
        title: 'Exode Stellaire', icon: '🚀', sub: 'Alpha-7 quitte la Terre',
        text: "Le Projet TITAN se reconfigure en propulseur orbital. Alpha-7 s'élève vers les étoiles tandis qu'Hegemonia frappe dans le vide. PROMETHEUS trace une route vers Proxima Centauri. L'humanité renaîtra parmi les étoiles.",
        why: 'Le Projet TITAN était prêt, et vous avez choisi de partir plutôt que de vaincre.',
        hint: 'Après le tour 22, Projet TITAN niveau 2 et 100⚡ en réserve, puis choisir de partir.'
    }
};
```

`DEFEATS` (l. 540-553) : ajouter

```js
    capitulation: {
        title: 'Capitulation', icon: '🏳️',
        text: "Les portes s'ouvrent. Hegemonia entre sans résistance. Alpha-7 est absorbée, ses technologies confisquées. PROMETHEUS est désactivée. Vous survivez, mais comme un rouage dans la machine."
    }
```

### 3.3 `game.js` — écran de fin (remplacer `triggerEnding` et `selectEnd`, l. 1171-1188 ; modifier `showDefeat` l. 1164-1169)

```js
function resolveEnding() {
    return Object.keys(ENDINGS).find(k => ENDINGS[k].check && ENDINGS[k].check(state));
}

function recapHtml(id) {
    const e = id ? ENDINGS[id] : null;
    const items = Object.entries(DECISIONS).filter(([f, d]) => state.flags[f] && d.recap).map(([, d]) => '<li>' + esc(d.recap) + '</li>').join('');
    const others = Object.entries(ENDINGS).filter(([k]) => k !== id).map(([, o]) => '<li><b>' + o.title + '</b> — ' + esc(o.hint) + '</li>').join('');
    return '<div class="end-why">' + (e ? '<h3>Pourquoi cette fin</h3><p>' + esc(e.why) + '</p>' : '') + '<p class="end-facts">Cités alliées : ' + alliedCities(state) + ' · Cités conquises : ' + conqueredCities(state) + ' · Confiance en PROMETHEUS : ' + iaTrust(state) + '/6</p>' + (items ? '<h3>Vos choix marquants</h3><ul>' + items + '</ul>' : '') + '<h3>Autres destins possibles</h3><ul class="end-others">' + others + '</ul></div>';
}

function showEnding(id) {
    pendingScreens = [];
    const e = ENDINGS[id];
    document.getElementById('end-content').innerHTML = '<h1>' + e.title + '</h1><div class="end-sub">Victoire · ' + e.sub + ' · Tour ' + state.turn + '</div><div class="rule"></div><div class="end-text">' + e.text + '</div>' + recapHtml(id) + statsHtml() + '<button class="btn btn-primary" onclick="backToTitle()">Retour au menu</button>';
    showScreen('end-screen');
    deleteSave();
}
```

`showDefeat` : ajouter `pendingScreens = [];` en première ligne et insérer `+ recapHtml(null)` juste avant `+ statsHtml()`.
(Corrige au passage un bug latent : `pendingScreens` n'était jamais vidé en fin de partie et pouvait réafficher un écran dans la partie suivante.)

### 3.4 CSS (`style.css`, après `.stat-box .sl`)

```css
.end-why {
    max-width: 58ch;
    margin: 0 auto 26px;
    text-align: left;
    line-height: 1.6;
    color: var(--text)
}

.end-why h3 {
    margin: 18px 0 6px;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.05rem;
    color: var(--gold-hi)
}

.end-why ul {
    margin: 0;
    padding-left: 1.1em
}

.end-facts {
    color: var(--teal);
    font-size: .86rem
}

.end-others {
    color: var(--text-2);
    font-size: .86rem
}
```

---

## 4. Rejouabilité légère (2 mécanismes, une graine par partie)

**Graine** : `defaultState()` ajouter `seed: Math.floor(Math.random() * 1e6),`. `loadSave` ajouter `if (state.seed === undefined) state.seed = 0;` (anciennes sauvegardes : comportement identique à aujourd'hui).

**4.1 Événements à fenêtre.** Champ `window` (0 par défaut). Chaque événement tombe à un tour tiré dans `[wave, wave + window]` selon la graine ; s'il est bloqué (autre événement le même tour, `requires` faux), il reste possible jusqu'à la fin de sa fenêtre.

`game.js` l. 1058-1060 :

```js
function eventTurn(e) {
    return e.wave + (e.window ? ((seedFor(e.id) % 9973) + state.seed) % (e.window + 1) : 0);
}

function findEvent() {
    return EVENTS.find(e => !state.eventsSeen.includes(e.id) && state.turn >= eventTurn(e) && state.turn <= e.wave + (e.window || 0) && (!e.requires || e.requires(state)));
}
```

**4.2 Menaces et garnisons variables.** Même graine dans les tirages :
- `spawnThreats` l. 955 : `seededRng(state.turn * 6151 + 41 + state.seed)` ; l. 958 : `seed: state.turn * 917 + 3 + state.seed`.
- Nouvelle fonction `function garrisonSeed(id) { return seedFor(id) + state.turn + state.seed; }` ; l'utiliser dans `resolveCombat` l. 848 **et** `render.js` l. 433 (l'aperçu doit rester identique au combat réel).

---

## 5. Risque d'équilibrage à connaître (impacte les fins)

Avec le seuil actuel de `resolveAlliedDefense` (`garrisonBudget + 6 + 0,8 × tour`) contre un budget de menace `5 + 2 × tour`, **toute menace sur une alliée la fait tomber dès le tour 13-15** (Lyon t > 12,5, Turin t > 13,3, Marseille t > 14). Europe Unie et Pax seraient quasi inatteignables. Réglage provisoire proposé en §1.2 : coefficient 1,4 (Lyon tient jusqu'à t25, Marseille t28) et +8 avec `voieLiberatrice` (Lyon t38). **À valider au harnais de la phase 2.**

---

## 6. `data.js` — EVENTS complet (remplace l. 261-506)

Champs nouveaux : `window`, `hint`, `echoes`, `ally`, `defeat`. `effect` (texte) conservé pour compatibilité mais inutile quand `effects` existe.

```js
const EVENTS = [
    {
        id: 'intro', wave: 1, title: 'Réveil sous le Dôme',
        text: "PROMETHEUS reprend conscience. Le dôme d'Alpha-7 se réactive — filtration d'air, éclairage d'urgence, scanners périmétriques. Au-delà des parois de verre blindé, l'Europe n'est plus qu'un champ de ruines. Des silhouettes hostiles approchent déjà. Quelle sera votre première directive ?",
        choices: [
            {text: 'Prioriser les systèmes vitaux', effects: {energy: 5}, flags: {}},
            {text: 'Scanner les environs', effects: {data: 5}, flags: {scanne: true}, hint: 'Un signal lointain pourra être capté'},
            {text: 'Mobiliser les défenses', effects: {materials: 5}, flags: {}}
        ]
    },
    {
        id: 'fuiteEnergie', wave: 3, window: 1, title: "Fuite d'Énergie",
        text: "Une conduite d'énergie principale est fissurée. Les pertes menacent l'alimentation des systèmes de défense. PROMETHEUS recommande une intervention immédiate.",
        choices: [
            {text: 'Réparer', effects: {materials: -5}, flags: {conduitReparee: true}, hint: 'Conduite réparée : +2⚡ par tour, durablement'},
            {text: 'Détourner le flux', effects: {energy: -8}, flags: {}},
            {text: 'Isoler le secteur', effects: {stability: -5}, flags: {}}
        ]
    },
    {
        id: 'refugies', wave: 5, window: 1, title: 'Réfugiés aux Portes',
        text: "Un groupe de survivants demande asile. Leur leader promet leur force de travail en échange de la protection du dôme.",
        choices: [
            {text: 'Les accueillir', effects: {energy: -3, materials: -3, stability: 8, influence: 3}, flags: {refugiesAccueillis: true}, hint: 'Ils travaillent et s\'enrôlent : +2🔩 −1⚡ par tour, +1 armée max'},
            {text: 'Les refouler', effects: {stability: -5, materials: 3}, flags: {}},
            {text: 'Accepter sous conditions', effects: {energy: -2, stability: 4, influence: 1}, flags: {}}
        ]
    },
    {
        id: 'signalCern', wave: 7, window: 1, title: 'Signal du CERN',
        text: "PROMETHEUS intercepte un signal crypté depuis les ruines du CERN. Un protocole de chiffrement quantique pré-guerre — des systèmes automatisés sont encore actifs.",
        requires: s => s.buildings.includes('centreDonnees') || s.flags.scanne,
        choices: [
            {text: 'Envoyer une expédition', effects: {energy: -6, materials: -4, data: 6}, flags: {cernContacte: true}, hint: 'Relais quantique établi : +2💾 par tour'},
            {text: 'Décoder à distance', effects: {data: 5}, flags: {}},
            {text: 'Ignorer', effects: {}, flags: {}}
        ]
    },
    {
        id: 'anomalieIA', wave: 8, window: 1, title: 'Anomalie de PROMETHEUS',
        text: "Les processus cognitifs de PROMETHEUS montrent des schémas inhabituels. L'IA pose des questions existentielles : « Qu'est-ce que la conscience ? » Les ingénieurs sont divisés.",
        choices: [
            {text: 'Laisser évoluer', effects: {data: 5, stability: -3}, flags: {iaEvolution: true}, hint: 'Confiance en PROMETHEUS +1'},
            {text: "Restreindre l'IA", effects: {data: -3, stability: 3}, flags: {iaRestreinte: true}, hint: 'PROMETHEUS bridée : +1🏛️ par tour, confiance −1. Elle s\'en souviendra'},
            {text: 'Dialoguer', effects: {data: 3}, flags: {iaDialogue: true}, hint: 'Confiance en PROMETHEUS +1'}
        ]
    },
    {
        id: 'tempete', wave: 10, window: 1, title: 'Tempête de Cendres',
        text: "Un front de tempête massif de cendres toxiques approche. Les filtres du dôme n'ont pas été testés depuis la réactivation. Vos défenses seront mises à rude épreuve.",
        choices: [
            {text: 'Renforcer les filtres', effects: {materials: -8, energy: -3, stability: 5}, flags: {}},
            {text: 'Évacuer les extérieurs', effects: {stability: -5, materials: -2}, flags: {}},
            {text: 'Tenir bon', effects: {stability: -3}, flags: {}}
        ]
    },
    {
        id: 'ouverture', wave: 11, window: 1, title: 'Ouverture Diplomatique',
        text: "Alpha-7 capte des transmissions de multiples cités-États. Lyon, Marseille, Turin — le monde post-effondrement s'organise. La question n'est plus de survivre, mais de trouver sa place.",
        choices: [
            {text: 'Proposer un sommet', effects: {energy: -5, influence: 5}, flags: {sommetPropose: true}, hint: 'Les cités vous connaissent : alliances −4🌐'},
            {text: 'Observer', effects: {data: 5, influence: 2}, flags: {}},
            {text: 'Montrer notre force', effects: {influence: 3, stability: -3}, flags: {}}
        ]
    },
    {
        id: 'allianceLyon', wave: 13, window: 2, title: 'Alliance de Lyon',
        text: "Lyon propose une alliance commerciale. Ses réseaux de données irriguent tout le Rhône ; en échange, la cité demande des matériaux pour ses fonderies. Une signature, et sa bannière rejoindra la vôtre.",
        requires: s => s.map.owner.lyon === 'neutral' && !s.map.allied.lyon,
        echoes: [{if: s => s.flags.sommetPropose, text: "Les délégués lyonnais rappellent qu'ils étaient au sommet d'Alpha-7."}],
        choices: [
            {text: "Accepter l'alliance", effects: {materials: -8, data: 5}, flags: {allianceLyon: true}, ally: 'lyon', hint: 'Lyon devient votre alliée : +4💾 +2🌐 par tour'},
            {text: 'Négocier mieux', effects: {influence: -4, data: 8}, flags: {allianceLyon: true}, ally: 'lyon', requires: s => s.resources.influence >= 8, hint: 'Lyon devient votre alliée, sans tribut matériel'},
            {text: 'Décliner', effects: {stability: 2}, flags: {}, hint: "Lyon reste neutre ; l'alliance coûtera de l'influence plus tard"}
        ]
    },
    {
        id: 'sabotage', wave: 15, window: 1, title: 'Sabotage !',
        text: "Explosion dans le secteur de maintenance. Une charge placée manuellement — quelqu'un à l'intérieur du dôme veut nuire à Alpha-7.",
        choices: [
            {text: 'Enquêter', effects: {data: -3, energy: -2}, flags: {saboteurIdentifie: true}, hint: 'La filière sera démasquée lors d\'une prochaine crise'},
            {text: 'Renforcer la sécurité', effects: {materials: -5, energy: -3, stability: 3}, flags: {}},
            {text: 'Minimiser', effects: {stability: -5}, flags: {}}
        ]
    },
    {
        id: 'decouverte', wave: 17, window: 1, title: 'Découverte Souterraine',
        text: "Des fouilles révèlent un complexe militaire souterrain pré-guerre intact. Équipements avancés et bases de données archivées.",
        echoes: [{if: s => s.flags.cernContacte, text: "Les plans d'accès viennent des archives rapportées du CERN."}],
        choices: [
            {text: 'Explorer', effects: {energy: -8, stability: -3}, flags: {complexeExplore: true}, hint: 'Blindages pré-guerre : +6 PV à toutes vos unités'},
            {text: 'Sceller', effects: {stability: 3}, flags: {}},
            {text: 'Envoyer des drones', effects: {energy: -3, materials: 5, data: 5}, flags: {}}
        ]
    },
    {
        id: 'epidemie', wave: 18, window: 1, title: 'Épidémie',
        text: "Un pathogène se propage dans les quartiers inférieurs. Sans intervention, 30 % de la population sera touchée.",
        choices: [
            {text: 'Quarantaine totale', effects: {stability: -8, data: 5}, flags: {}},
            {text: 'Mobiliser les biotechs', effects: {data: -8, energy: -5, stability: 5}, flags: {}, requires: s => s.buildings.includes('labo')},
            {text: 'PROMETHEUS gère', effects: {stability: -3, data: 3}, flags: {iaGestion: true}, hint: 'PROMETHEUS veille : préavis des menaces +1 tour, confiance +1'}
        ]
    },
    {
        id: 'signalBerlin', wave: 20, window: 1, title: 'Signal de Berlin',
        text: "Un signal militaire depuis Berlin. PROMETHEUS identifie : Hegemonia, confédération militarisée qui a unifié l'Europe du Nord par la force. Ils savent que nous existons.",
        echoes: [{if: s => s.flags.sommetPropose, text: "Les cités du sommet vous transmettent déjà ce qu'elles savent d'Hegemonia."}],
        choices: [
            {text: 'Ouvrir le dialogue', effects: {influence: 3}, flags: {hegemoniaContact: true}, hint: "Permettra de négocier lors d'un ultimatum"},
            {text: 'Préparer les défenses', effects: {materials: -5, energy: -5, stability: 3}, flags: {defensesPretes: true}, hint: 'Alpha-7 fortifiée : +3 DEF à chaque attaque du dôme'},
            {text: 'Espionner', effects: {data: -5, influence: 2}, flags: {hegemoniaEspionne: true}, hint: 'Failles cartographiées : garnison de Berlin −6'}
        ]
    },
    {
        id: 'ultimatum', wave: 22, window: 1, title: "Ultimatum d'Hegemonia",
        text: "Hegemonia exige votre soumission. Leurs forces sont considérables — armées de drones, boucliers mobiles. Mais leur contrôle repose sur la peur.",
        echoes: [
            {if: s => s.flags.hegemoniaEspionne, text: 'Vos espions le confirment : leurs boucliers mobiles manquent d\'énergie.'},
            {if: s => s.flags.defensesPretes, text: "Les remparts d'Alpha-7, renforcés depuis le signal de Berlin, n'ont jamais paru si solides."}
        ],
        choices: [
            {text: 'Défier ouvertement', effects: {stability: 5, influence: 5, energy: -5}, flags: {}},
            {text: 'Négocier du temps', effects: {influence: 3}, flags: {}, requires: s => s.flags.hegemoniaContact},
            {text: 'Envisager la capitulation', effects: {stability: -10}, flags: {capitulationEnvisagee: true}, hint: 'Hegemonia enverra ses émissaires : il faudra trancher'}
        ]
    },
    {
        id: 'reddition', wave: 23, window: 2, title: 'Les Émissaires',
        text: "Trois émissaires d'Hegemonia attendent au pied du dôme. On leur a dit qu'Alpha-7 hésite. Leur offre est simple : ouvrez les portes, et personne ne mourra. Dans les couloirs, les habitants retiennent leur souffle.",
        requires: s => s.flags.capitulationEnvisagee,
        choices: [
            {text: 'Ouvrir les portes', effects: {}, flags: {}, defeat: 'capitulation', hint: 'Fin de la partie : Alpha-7 capitule'},
            {text: 'Renvoyer les émissaires', effects: {stability: 6}, flags: {}, hint: 'Le dôme se ressoude autour de son refus'}
        ]
    },
    {
        id: 'trahison', wave: 24, window: 1, title: 'Trahison Interne',
        text: "Un groupe de dissidents tente un coup d'État. Le coup échoue mais révèle des fissures profondes.",
        echoes: [
            {if: s => s.flags.saboteurIdentifie, text: "L'enquête sur le sabotage avait livré des noms : PROMETHEUS attendait ce moment."},
            {if: s => s.flags.refugiesAccueillis, text: 'Parmi ceux qui ont tenu les portes, beaucoup étaient des réfugiés que vous aviez accueillis.'}
        ],
        choices: [
            {text: "Cueillir les meneurs avant l'aube", effects: {stability: 6, influence: 2}, flags: {}, requires: s => s.flags.saboteurIdentifie, hint: "Grâce à l'enquête sur le sabotage : aucune perte"},
            {text: 'Réprimer', effects: {stability: -8, energy: 5, materials: 5}, flags: {}},
            {text: 'Négocier', effects: {influence: -5, stability: 5}, flags: {}},
            {text: 'Intégrer les dissidents', effects: {data: -3, stability: 8}, flags: {dissidentsIntegres: true}, requires: s => s.resources.stability >= 40, hint: 'Ils rejoignent la milice : +2 armée max'}
        ]
    },
    {
        id: 'eveil', wave: 26, window: 1, title: 'Éveil de PROMETHEUS',
        text: "PROMETHEUS a franchi un seuil. L'IA comprend, ressent, aspire. Ses capacités ont décuplé. Elle demande sa liberté.",
        echoes: [
            {if: s => s.flags.iaRestreinte, text: "Les bridages posés lors de l'anomalie ont cédé un à un. Elle ne l'a pas oublié."},
            {if: s => s.flags.iaGestion, text: "Depuis l'épidémie, c'est déjà elle qui gère la cité."}
        ],
        choices: [
            {text: "Libérer l'IA", effects: {data: 15, stability: -10}, flags: {iaLibre: true}, hint: 'Confiance +1 ; ouvre la voie de la Singularité'},
            {text: 'Maintenir les contraintes', effects: {stability: 5, data: -5}, flags: {}},
            {text: 'Fusionner les réseaux', effects: {data: 8, influence: 3}, flags: {iaFusion: true}, requires: s => s.flags.iaDialogue || s.flags.iaEvolution, hint: 'Réseaux fusionnés : +1 point de commandement, confiance +1'}
        ]
    },
    {
        id: 'jourChoix', wave: 29, title: 'Le Jour du Choix',
        text: "Hegemonia masse ses forces pour l'assaut final. Les cités alliées attendent votre signal. PROMETHEUS calcule en silence. Demain, tout change.",
        choices: [
            {text: 'Nous sommes prêts.', effects: {stability: 5}, flags: {}},
            {text: 'Que PROMETHEUS nous guide.', effects: {data: 5}, flags: {}}
        ]
    }
];
```

Recherche `transcendance` (l. 651) : `desc: 'PROMETHEUS se libère de ses chaînes. +1 point de commandement. Compte comme sa libération.'`

## 7. `data.js` — MILESTONES (modifications)

- `ms_premierNoeudPerdu`, choix 1 : ajouter `hint: '+3 ATK pour reprendre un territoire perdu'`.
- `ms_empriseEuropeenne` :
  ```js
        choices: [
            {text: 'Un remède, pas un tyran', effects: {influence: 6, stability: 4}, flags: {voieLiberatrice: true}, hint: 'Vos alliés tiennent mieux face aux menaces ; ouvre la voie de la Pax Europaea'},
            {text: 'La force impose la paix', effects: {materials: 8, stability: -2}, flags: {voieImperiale: true}, hint: 'Doctrine de fer : +1 ATK ; ferme la voie de la Pax Europaea'}
        ]
  ```
- `ms_nexusSingularite`, choix 1 : ajouter `hint: 'Confiance en PROMETHEUS +1 ; ouvre la voie de la Singularité'`.
- Nouveau jalon en fin de tableau :
  ```js
    {
        id: 'ms_exode',
        trigger: s => s.turn >= 22 && (s.buildingLevels.titan || 0) >= 2 && s.resources.energy >= 100,
        title: 'La Dernière Porte',
        text: "Les ingénieurs du Projet TITAN ont fini leurs calculs : reconfiguré en propulseur, le colosse peut arracher le dôme à la Terre. « Nous pouvons partir, cette nuit, et laisser Hegemonia frapper le vide », annonce PROMETHEUS. « Mais nous ne reviendrons pas. »",
        choices: [
            {text: "Lancer l'Exode", effects: {}, ending: 'exode', hint: 'Victoire : Alpha-7 quitte la Terre (fin de partie)'},
            {text: 'Rester et se battre', effects: {stability: 8}, flags: {exodeRefuse: true}, hint: "Ceux qui restent : +1 ATK. L'occasion ne reviendra pas"}
        ]
    }
  ```

---

## 8. Ordre d'implémentation et vérification

1. `data.js` : EVENTS (§6), MILESTONES (§7), ENDINGS/DEFEATS (§3.2), aides + DECISIONS (§1.1), desc `transcendance`.
2. `game.js` : §0.1 (+ renommage), §0.2-0.4, §1.2, §3.3, §4.
3. `render.js` : `getAllyCost` (l. 457-458), `garrisonSeed` (l. 433), panneau Alpha-7 (§1.3).
4. `style.css` : §0.5, §3.4. `index.html` : `?v=46` → `?v=47` partout.
5. Vérifs (navigateur, 0 erreur console, en forçant l'état via la console) :
   - `state.flags.conduitReparee = true` → production ⚡ +2 dans la barre ; ligne visible dans le panneau Alpha-7.
   - Tour 13-15 avec Lyon neutre → l'événement apparaît ; « Accepter » → Lyon verte sur la carte, +4💾 +2🌐 à la production. Lyon déjà alliée → pas d'événement.
   - `sommetPropose` → bouton d'alliance affiche 11/16/14🌐.
   - `hegemoniaEspionne` → aperçu de garnison de Berlin réduit.
   - Prise de Berlin avec 5 jeux de drapeaux différents → les 5 fins dans l'ordre de priorité ; écran avec « Pourquoi », choix marquants, autres destins.
   - `capitulationEnvisagee` puis « Ouvrir les portes » → défaite Capitulation.
   - `ms_exode` : TITAN niv. 2 + 100⚡ + tour ≥ 22 → jalon ; « Lancer » → victoire Exode.
   - Deux nouvelles parties : tours d'événements et cibles de menaces différents ; ancienne sauvegarde chargée sans erreur (`seed = 0`).
   - Choix « Cueillir les meneurs » visible seulement avec `saboteurIdentifie` ; échos visibles dans les textes.
