const GUIDE_KEY = 'pe2147_guide';
let guideKey = null;
let guideRaf = null;
let guideTarget = null;

function gq(sel) {
    return document.querySelector(sel);
}

function railBtn(name) {
    return gq(`.rail-btn[data-drawer="${name}"]`);
}

function nodeLabel(id) {
    return centerView === 'map' ? gq(`.m3d-label[data-node="${id}"] .m3d-name`) : gq('#vs-map');
}

function armyCount(s) {
    return s.army.length + (s.map.garrisons.alpha7 || []).length;
}

function newGuide(on) {
    return {on, step: 0, seen: [], tip: null, base: 0};
}

const GUIDE_STEPS = [
    {
        text: 'Commandant, voici ce qu\'il reste de l\'Europe. Notre dôme, <b>Alpha-7</b>, veille sous les Alpes. Hegemonia tient Berlin : la libérer mettra fin à la guerre.',
        target: () => nodeLabel('alpha7'), ack: true
    },
    {
        text: 'Nos réserves : énergie, matériaux, données, stabilité et influence. Survolez-les pour voir le gain de chaque tour. Si l\'<b>énergie</b> ou la <b>stabilité</b> tombe à zéro, le dôme s\'effondre.',
        target: () => gq('#res-plates'), ack: true
    },
    {
        text: 'Chaque ordre (bâtir, étudier, marcher, s\'allier, fortifier) coûte <b>1 point de commandement</b>. Vous en avez 3 par tour. Recruter est gratuit.',
        target: () => gq('#cmd'), ack: true
    },
    {
        text: 'Commençons par le dôme. Entrez dans <b>Alpha-7</b>.',
        target: () => gq('#vs-base'), done: () => centerView === 'base'
    },
    {
        text: 'Un bâtiment produit à chaque tour. Cliquez sur un <b>emplacement libre</b> (anneau doré au sol), puis bâtissez le <b>Réacteur à Fusion</b> : il sécurise notre énergie.',
        target: () => openDrawer === 'dome'
            ? [...document.querySelectorAll('#drawer .row .btn-primary')].find(b => !b.disabled && b.textContent.includes('Bâtir')) || gq('#drawer .row')
            : centerView === 'base' ? null : gq('#vs-base'),
        done: s => s.buildings.length >= 1
    },
    {
        text: 'Une bonne économie ne suffit pas. Ouvrez le panneau <b>Armée</b>.',
        target: () => railBtn('army'), done: () => openDrawer === 'army'
    },
    {
        text: 'Recrutez une <b>Sentinelle</b>. Elle tient la ligne avant et ne coûte aucun point de commandement.',
        target: () => openDrawer === 'army' ? gq('#drawer .recruit:not(:disabled)') : railBtn('army'),
        enter: g => g.base = armyCount(state),
        done: s => armyCount(s) > s.guide.base
    },
    {
        text: 'Autour de nous, des cités libres. On peut les rallier ou les soumettre. Cliquez sur <b>Lyon</b> sur la carte.',
        target: () => nodeLabel('lyon'),
        enter: () => {
            openDrawer = null;
            setTimeout(renderBuildPhase, 0);
        },
        done: () => selectedNode === 'lyon'
    },
    {
        text: 'Chaque cité offre autre chose selon la voie choisie. <b>Prendre</b> Lyon nous livre son réseau d\'écoute, au prix de la stabilité. <b>S\'allier</b> coûte de l\'influence, et sa Ligue marchande nous ouvre les autres cités.',
        target: () => gq('#node-panel.open .city-cards') || gq('#node-panel.open'), ack: true
    },
    {
        text: 'Quand vos ordres sont donnés, <b>terminez le tour</b>. La production tombe, les armées avancent, les menaces approchent.',
        target: () => gq('#btn-endturn'), done: s => s.turn >= 2
    },
    {
        text: 'Mon cortex peut débloquer bâtiments, unités et héros. Ouvrez le <b>Savoir</b>.',
        target: () => gq('#btn-research'), done: () => gq('#research-overlay').classList.contains('active')
    },
    {
        text: 'Trois voies : Doctrine, Guerre et Singularité. Chaque étude coûte 1 point. Les paliers supérieurs exigent d\'<b>éveiller mon Cœur</b> depuis le panneau Dôme.',
        target: () => gq('#research-modal .rs-item.avail') || gq('#research-modal'), ack: true, inResearch: true
    },
    {
        text: 'Le reste vous appartient, Commandant. Je vous signalerai l\'essentiel en chemin. Le bouton <b>Aide</b> du rail rappelle le déroulé d\'une partie, les termes du jeu et les destins possibles.',
        target: () => gq('#btn-guide'), ack: true
    }
];

const GUIDE_TIPS = [
    {
        id: 'prealert', urgent: true, vital: true,
        trigger: s => s.phase === 'build' && s.turn >= 3 && !s.map.threats.length && !s.guide.seen.includes('threat'),
        target: () => nodeLabel('alpha7'),
        text: 'Hegemonia sait que nous sommes réveillés : ses raids vont commencer. Chaque attaque est annoncée quelques tours à l\'avance. Gardez toujours des unités en <b>garnison à Alpha-7</b> : si le dôme tombe, tout est perdu.'
    },
    {
        id: 'threat', urgent: true, vital: true,
        trigger: s => s.phase === 'build' && s.map.threats.length > 0,
        target: () => gq('#threats .threat-card'),
        text: 'Une force hostile marche sur nos terres. Le chiffre indique les tours avant l\'attaque, la carte nos chances de tenir. Placez une garnison, ramenez l\'armée ou fortifiez : sans défenseurs, la colonie tombe, et si c\'est Alpha-7, tout est perdu.'
    },
    {
        id: 'battle', urgent: true, inBattle: true,
        trigger: s => s.phase === 'battle',
        expire: s => s.phase === 'build',
        target: () => gq('#speed'),
        text: 'Le combat se résout seul. La ligne avant encaisse, les unités rapides frappent l\'arrière. Accélérez avec ×2 ou ×3.'
    },
    {
        id: 'cmdZero',
        trigger: s => s.phase === 'build' && s.command === 0,
        target: () => gq('#btn-endturn'),
        text: 'Plus de points de commandement pour ce tour. Terminez-le : ils reviendront au complet.'
    },
    {
        id: 'march',
        trigger: s => s.phase === 'build' && !!s.map.armyDest,
        target: () => nodeLabel(state.map.armyDest),
        text: 'L\'armée est en marche et n\'acceptera aucun ordre avant d\'arriver. Surveillez les colonies qu\'elle laisse sans défense.'
    },
    {
        id: 'holding',
        trigger: s => s.phase === 'build' && heldTerritories(s) > 0,
        target: () => railBtn('army'),
        text: 'Une nouvelle bannière. Une colonie conquise a besoin d\'une <b>garnison</b> : quand l\'armée s\'y trouve, transférez des unités depuis le panneau Armée. Une cité alliée, elle, se défend seule.'
    },
    {
        id: 'hero',
        trigger: s => s.phase === 'build' && HEROES.some(h => s.research.includes(h.research) && !s.heroes.includes(h.id)),
        target: () => railBtn('heroes'),
        text: 'Un <b>héros</b> est prêt à nous rejoindre. Il combat aux côtés de l\'armée avec une capacité unique.'
    },
    {
        id: 'chapter2',
        trigger: s => s.phase === 'build' && s.chapter >= 2,
        target: () => nodeLabel('outpost'),
        text: 'Les avant-postes de <b>Strasbourg</b> et <b>Munich</b> ravitaillent Berlin. Chacun pris affaiblit sa garnison avant l\'assaut final.'
    },
    {
        id: 'cityConquered',
        trigger: s => s.phase === 'build' && conqueredCities(s) >= 1,
        target: () => gq('#objectives'),
        text: 'Une cité libre sous notre bannière. Son atout est actif, mais l\'<b>occupation</b> pèse sur la stabilité chaque tour. Laissez-y une garnison : Hegemonia vise en priorité nos territoires.'
    },
    {
        id: 'cityAllied',
        trigger: s => s.phase === 'build' && alliedCities(s) >= 1,
        target: () => gq('#objectives'),
        text: 'Une alliée rend son service tant qu\'elle tient. Elle se défend seule, mais peut tomber face à une grosse menace. Reprendre une alliée tombée la libère et renoue le pacte.'
    },
    {
        id: 'upkeep',
        trigger: s => s.phase === 'build' && getUpkeep() >= 3 && getUpkeep() * 4 > getCampaignProduction().energy + getUpkeep(),
        target: () => gq('#res-plates .res'),
        text: 'Notre armée pèse sur le réacteur : l\'<b>entretien</b> consomme plus d\'un quart de notre énergie. Bâtissez ou améliorez un Réacteur, ou libérez des unités, sinon c\'est le blackout.'
    },
    {
        id: 'lowStability', urgent: true,
        trigger: s => s.phase === 'build' && s.resources.stability < BALANCE.stabilityLow,
        target: () => gq('#res-plates .res:nth-child(4)'),
        text: 'La population gronde : sous 30 de <b>stabilité</b>, nos unités perdent 2 ATK, et à 0 c\'est la révolte. Quartiers, Bouclier du Dôme et certains choix d\'événements la remontent.'
    },
    {
        id: 'researchTier',
        trigger: s => s.phase === 'build' && researchTierDone(),
        target: () => railBtn('dome'),
        text: 'Ce palier de recherche est épuisé. <b>Éveillez mon Cœur</b> depuis le panneau Dôme pour ouvrir le suivant et agrandir l\'armée.'
    },
    {
        id: 'newUnit',
        trigger: s => s.phase === 'build' && UNITS.some(u => !u.always && s.buildings.includes(u.building)),
        target: () => railBtn('army'),
        text: 'Une nouvelle unité est disponible dans le panneau Armée. Survolez-la : ligne avant ou arrière, soins, esquive… Mélanger les rôles rend l\'armée bien plus solide.'
    },
    {
        id: 'chapter3',
        trigger: s => s.phase === 'build' && s.chapter >= 3,
        target: () => nodeLabel('berlin'),
        text: 'Deux routes mènent à Berlin. <b>L\'Ouest</b>, par Strasbourg : courte, mais très défendue. <b>L\'Est</b>, par Zurich et Munich : plus longue, mais plus abordable. Chaque avant-poste pris affaiblit la capitale.'
    },
    {
        id: 'nodeLost',
        trigger: s => s.phase === 'build' && Object.keys(s.map.lost).length >= 1,
        target: () => gq('#objectives'),
        text: 'Un territoire est perdu. Le reprendre reste possible, mais sa garnison grossit avec le temps : n\'attendez pas trop.'
    },
    {
        id: 'retreat',
        trigger: s => s.phase === 'build' && (s.stats.retreats + s.stats.assaultsLost) >= 1,
        target: () => railBtn('army'),
        text: 'Un assaut a mal tourné. Avant chaque attaque, l\'écran <b>Préparer l\'assaut</b> estime nos chances, et la consigne de <b>repli</b> fait reculer l\'armée avant qu\'elle ne soit anéantie.'
    }
];

function s0(fn) {
    try {
        return fn();
    } catch (e) {
        return null;
    }
}

function guidePref() {
    return prefGet(GUIDE_KEY) !== '0';
}

function guideOptionInit() {
    syncSwitch('opt-guide', guidePref());
}

function toggleGuideOption() {
    prefSet(GUIDE_KEY, guidePref() ? '0' : '1');
    guideOptionInit();
}

function enterStep(g) {
    const st = GUIDE_STEPS[g.step];
    if (st && st.enter) st.enter(g);
}

function currentGuideItem() {
    const g = state.guide;
    if (g.tip) {
        const tip = GUIDE_TIPS.find(t => t.id === g.tip);
        if (tip && tip.expire && tip.expire(state)) {
            g.seen.push(tip.id);
            g.tip = null;
            save();
        } else if (tip) return {kind: 'tip', item: tip};
    }
    while (g.step < GUIDE_STEPS.length && GUIDE_STEPS[g.step].done && GUIDE_STEPS[g.step].done(state)) {
        g.step++;
        enterStep(g);
        save();
    }
    const stepsDone = g.step >= GUIDE_STEPS.length;
    const tip = GUIDE_TIPS.find(t => !g.seen.includes(t.id) && (t.urgent || stepsDone || state.turn >= 3) && t.trigger(state));
    if (tip) {
        g.tip = tip.id;
        save();
        return {kind: 'tip', item: tip};
    }
    return stepsDone ? null : {kind: 'step', item: GUIDE_STEPS[g.step]};
}

function vitalGuideItem() {
    const g = state.guide;
    if (g.tip) {
        const tip = GUIDE_TIPS.find(t => t.id === g.tip);
        if (tip && tip.vital && !(tip.expire && tip.expire(state))) return {kind: 'tip', item: tip};
        g.tip = null;
    }
    const tip = GUIDE_TIPS.find(t => t.vital && !g.seen.includes(t.id) && t.trigger(state));
    if (!tip) return null;
    g.tip = tip.id;
    save();
    return {kind: 'tip', item: tip};
}

function guideVisible(cur) {
    if (gq('#event-overlay').classList.contains('active') || gq('#chapter-overlay').classList.contains('active')) return false;
    if (state.phase !== 'build' && !cur.item.inBattle) return false;
    if (gq('#research-overlay').classList.contains('active') && !cur.item.inResearch) return false;
    return true;
}

function guideUpdate() {
    const card = document.getElementById('guide-card');
    if (!card) return;
    if (!state || !document.getElementById('game-screen').classList.contains('active')) {
        card.classList.remove('show');
        guideTarget = null;
        return;
    }
    const cur = state.guide.on ? currentGuideItem() : vitalGuideItem();
    if (!cur || !guideVisible(cur)) {
        card.classList.remove('show');
        guideTarget = null;
        return;
    }
    const isStep = cur.kind === 'step';
    const key = cur.kind + ':' + (isStep ? state.guide.step : cur.item.id) + ':' + state.guide.on;
    if (key !== guideKey) {
        guideKey = key;
        const count = isStep ? `<span class="gc-count">${state.guide.step + 1} / ${GUIDE_STEPS.length}</span>` : `<span class="gc-count${cur.item.vital ? ' vital' : ''}">${cur.item.vital ? 'Alerte' : 'Conseil'}</span>`;
        const actions = (isStep && !cur.item.ack)
            ? `<span class="gc-hint">${ic('hand-pointing')}À vous de jouer</span>`
            : `<button class="btn btn-primary" onclick="guideAck()">Compris</button>`;
        card.innerHTML = `<div class="gc-portrait"><span></span></div><div class="gc-body"><div class="gc-head"><span class="eyebrow">PROMETHEUS · Conseiller</span>${count}</div><p class="gc-text">${glossText(cur.item.text)}</p><div class="gc-actions">${actions}${state.guide.on ? '<button class="gc-skip" onclick="guideSkip()">Passer le guide</button>' : ''}</div></div>`;
        card.classList.remove('show');
        void card.offsetWidth;
    }
    card.classList.add('show');
    guideTarget = cur.item.target;
    if (!guideRaf) guideRaf = requestAnimationFrame(guideTrack);
}

function guideTrack() {
    guideRaf = null;
    const ring = document.getElementById('guide-ring');
    const el = guideTarget ? s0(guideTarget) : null;
    const r = el && el.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') {
        ring.classList.remove('show');
    } else {
        const pad = 6;
        const box = `${r.left - pad},${r.top - pad},${r.width + pad * 2},${r.height + pad * 2}`;
        if (ring.dataset.box !== box) {
            ring.dataset.box = box;
            ring.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
            ring.style.width = (r.width + pad * 2) + 'px';
            ring.style.height = (r.height + pad * 2) + 'px';
        }
        ring.classList.add('show');
    }
    if (guideTarget) guideRaf = requestAnimationFrame(guideTrack);
    else ring.classList.remove('show');
}

function guideAck() {
    const g = state.guide;
    if (g.tip) {
        g.seen.push(g.tip);
        g.tip = null;
    } else if (g.step < GUIDE_STEPS.length) {
        g.step++;
        enterStep(g);
    }
    save();
    guideUpdate();
}

function guideSkip() {
    state.guide.on = false;
    save();
    guideUpdate();
    toast('Guide en pause. Le bouton Aide du rail permet de le réactiver.', '');
}

let helpTab = 'deroule';

function setHelpTab(t) {
    helpTab = t;
    renderDrawer();
}

function replayGuide() {
    state.guide.on = true;
    state.guide.step = 0;
    state.guide.tip = null;
    enterStep(state.guide);
    guideKey = null;
    openDrawer = null;
    save();
    renderBuildPhase();
}

function chapterGate(ch) {
    return MAP_NODES.filter(n => n.unlocksChapter === ch).map(n => n.name).join(', ');
}

function helpDeroule() {
    const ch = CHAPTERS.map(c => {
        const gate = c.num === 1 ? 'Dès le début.' : `S'ouvre quand vous tenez : ${chapterGate(c.num)}.`;
        return `<div class="help-item${state.chapter === c.num ? ' now' : ''}"><div class="help-h">Chapitre ${c.num} · ${esc(chapterTitle(c))}</div><p>${esc(c.desc)} ${gate} Il débloque de nouveaux bâtiments.</p></div>`;
    }).join('');
    const defeats = Object.entries(DEFEATS).map(([k, d]) => `<li><b>${esc(d.title)}</b> · ${{annihilation: 'Alpha-7 tombe.', blackout: 'L\'énergie tombe à 0.', revolte: 'La stabilité tombe à 0.', capitulation: 'Vous choisissez de vous rendre.'}[k] || ''}</li>`).join('');
    return `<div class="help-item"><div class="help-h">Le but</div><p>${glossText('Libérer Berlin, capitale d\'Hegemonia. Prendre les avant-postes de Strasbourg et Munich affaiblit sa garnison. Votre façon de gagner décide de la fin : voir l\'onglet Destins.')}</p></div>`
        + `<div class="help-item"><div class="help-h">Un tour</div><p>${glossText('Donnez vos ordres : chacun coûte 1 point de commandement, recruter est gratuit. Puis terminez le tour : la production tombe, l\'armée avance, les menaces approchent, des événements surviennent.')}</p></div>`
        + `<div class="help-item"><div class="help-h">Les menaces</div><p>${glossText('Hegemonia attaque vos territoires, annoncés quelques tours à l\'avance. Sans garnison ni armée sur place, un territoire tombe. Si Alpha-7 tombe, la partie est perdue.')}</p></div>`
        + ch + `<div class="help-item"><div class="help-h">Défaites</div><ul>${defeats}</ul></div>`;
}

function helpConcepts() {
    const terms = Object.values(GLOSSARY).map(g => `<div class="help-item"><div class="help-h">${esc(g.title)}</div><p>${richText(g.text)}</p></div>`).join('');
    const seen = GUIDE_TIPS.filter(t => state.guide.seen.includes(t.id)).map(t => `<div class="help-item tip"><p>${t.text}</p></div>`).join('');
    return terms + (seen ? `<div class="sec-label">Conseils déjà reçus</div>${seen}` : '');
}

function helpDestins() {
    const now = resolveEnding();
    return `<p class="help-intro">La fin dépend de votre façon de gagner. Celle en surbrillance est celle que vous obtiendriez si Berlin tombait maintenant.</p>` + Object.entries(ENDINGS).map(([k, e]) => `<div class="help-item${k === now ? ' now' : ''}"><div class="help-h">${esc(e.title)} <span class="help-sub">${esc(e.sub)}</span></div><p>${richText(e.hint)}</p></div>`).join('');
}

function helpBody() {
    const tabs = [['deroule', 'Déroulé'], ['concepts', 'Concepts'], ['destins', 'Destins']].map(([k, l]) => `<button class="speed-btn${helpTab === k ? ' active' : ''}" onclick="setHelpTab('${k}')">${l}</button>`).join('');
    const guide = `<div class="help-guide"><button class="btn btn-ghost" onclick="toggleGuide()">${ic(state.guide.on ? 'bell-slash' : 'bell')}${state.guide.on ? 'Couper les conseils' : 'Activer les conseils'}</button><button class="btn btn-ghost" onclick="replayGuide()">${ic('arrow-counter-clockwise')}Rejouer le tutoriel</button></div><p class="help-note">${ic('warning-diamond')}Les alertes de danger restent affichées même conseils coupés.</p>`;
    const body = helpTab === 'concepts' ? helpConcepts() : helpTab === 'destins' ? helpDestins() : helpDeroule();
    return guide + `<div class="seg help-tabs">${tabs}</div><div class="help-list">${body}</div>`;
}

function toggleGuide() {
    state.guide.on = !state.guide.on;
    guideKey = null;
    save();
    if (openDrawer === 'help') renderDrawer();
    guideUpdate();
}
