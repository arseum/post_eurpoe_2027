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

const PROMETHEUS_FACE = '<svg class="pm-face" viewBox="0 0 72 72" aria-hidden="true"><defs><radialGradient id="pmIris" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#e9fffb"/><stop offset=".35" stop-color="#3ff5e6"/><stop offset="1" stop-color="#0a5d58"/></radialGradient><radialGradient id="pmBg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#0d2a36"/><stop offset="1" stop-color="#04080f"/></radialGradient><clipPath id="pmClip"><circle cx="36" cy="36" r="27"/></clipPath></defs><polygon class="pm-hex" points="36,2 65,19 65,53 36,70 7,53 7,19"/><circle cx="36" cy="36" r="27" fill="url(#pmBg)"/><g clip-path="url(#pmClip)"><rect class="pm-scan" x="9" y="0" width="54" height="3"/></g><circle class="pm-ring pm-r1" cx="36" cy="36" r="24"/><circle class="pm-ring pm-r2" cx="36" cy="36" r="18.5"/><g class="pm-eye"><circle cx="36" cy="36" r="10" fill="url(#pmIris)"/><circle cx="36" cy="36" r="4.2" fill="#04080f"/><circle cx="34.4" cy="34.2" r="1.3" fill="#f0e6d2"/></g></svg>';
const TYPE_MS = 18;
const gtw = {timer: null, done: true, nodes: []};

function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setSpeaking(on) {
    const card = document.getElementById('guide-card');
    if (card) card.classList.toggle('speaking', on);
}

function finishGuideType() {
    clearInterval(gtw.timer);
    gtw.timer = null;
    gtw.nodes.forEach(n => n.node.textContent = n.text);
    gtw.nodes = [];
    gtw.done = true;
    setSpeaking(false);
}

function guideType(el) {
    finishGuideType();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push({node: walker.currentNode, text: walker.currentNode.textContent});
    if (reducedMotion() || !nodes.length) return;
    nodes.forEach(n => n.node.textContent = '');
    gtw.nodes = nodes;
    gtw.done = false;
    setSpeaking(true);
    let i = 0, pos = 0;
    gtw.timer = setInterval(() => {
        const n = nodes[i];
        if (!n) return finishGuideType();
        pos++;
        n.node.textContent = n.text.slice(0, pos);
        if (pos >= n.text.length) {
            i++;
            pos = 0;
        }
    }, TYPE_MS);
}

function guideCardClick(e) {
    if (e.target.closest('.gc-skip')) return;
    if (!gtw.done) {
        e.stopPropagation();
        e.preventDefault();
        finishGuideType();
        return;
    }
    if (e.target.closest('button, a, dfn')) return;
    const ack = document.querySelector('#guide-card .gc-actions .btn-primary');
    if (ack) {
        e.stopPropagation();
        guideAck();
    }
}

function onGuideKeydown(e) {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const card = document.getElementById('guide-card');
    if (!card || !card.classList.contains('show')) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    if (document.querySelector('#confirm-overlay.active, #event-overlay.active')) return;
    e.preventDefault();
    if (!gtw.done) return finishGuideType();
    if (card.querySelector('.gc-actions .btn-primary')) guideAck();
}

function initGuideCard() {
    const card = document.getElementById('guide-card');
    if (!card || card._wired) return;
    card._wired = true;
    card.addEventListener('click', guideCardClick, true);
    document.addEventListener('keydown', onGuideKeydown);
}

function newGuide(on) {
    return {on, step: 0, seen: [], tip: null, base: 0};
}

const GRENOBLE = 'grenoble';

function drawerBuildBtn(name) {
    const row = [...document.querySelectorAll('#drawer .row')].find(r => r.textContent.includes(name));
    return row ? row.querySelector('.btn-primary:not(:disabled)') || row : null;
}

const GUIDE_STEPS = [
    {
        text: 'Commandant. Je suis <b>PROMETHEUS</b>, l\'intelligence qui veille sur le dôme d\'<b>Alpha-7</b>. On m\'a conçue avant l\'effondrement pour protéger les derniers survivants des Alpes, et je me réveille avec vous. Au nord, <b>Hegemonia</b> tient Berlin et broie ce qui reste de l\'Europe. Notre mission : survivre, puis la libérer.',
        target: () => nodeLabel('alpha7'), ack: true
    },
    {
        text: 'Pour l\'instant, deux réserves : l\'<b>énergie</b> et les <b>matériaux</b>. D\'autres s\'ajouteront à mesure que le dôme s\'éveille. Survolez-les pour voir le gain de chaque tour. Une règle avant tout : si l\'énergie tombe à zéro, le dôme s\'éteint.',
        target: () => gq('#res-plates'), ack: true
    },
    {
        text: 'Chaque ordre coûte <b>1 point de commandement</b>, et nous en avons 3 par tour. Ils ne se gardent pas d\'un tour à l\'autre : ce premier tour, nous allons les utiliser tous les trois. Recruter, en revanche, est gratuit.',
        target: () => gq('#cmd'), ack: true
    },
    {
        text: 'Commençons par le dôme. Entrez dans <b>Alpha-7</b>.',
        target: () => gq('#vs-base'), done: () => centerView === 'base'
    },
    {
        text: 'Premier ordre : le <b>Réacteur à Fusion</b>. Cliquez sur un emplacement libre (anneau doré au sol), puis bâtissez-le : sans énergie, rien ne tient.',
        target: () => openDrawer === 'dome' ? drawerBuildBtn('Réacteur') : centerView === 'base' ? null : gq('#vs-base'),
        done: s => s.buildings.includes('reacteur')
    },
    {
        text: 'Deuxième ordre : l\'<b>Usine de Nanofabrication</b>. Ses matériaux servent à bâtir et à recruter. Bâtissez-la sur un autre emplacement.',
        target: () => openDrawer === 'dome' ? drawerBuildBtn('Usine') : centerView === 'base' ? null : gq('#vs-base'),
        done: s => s.buildings.includes('usine')
    },
    {
        text: 'Mes scanners captent des automates errants dans les <b>Ruines de Grenoble</b>, à un tour de marche. Une proie facile pour nos trois Sentinelles, et une cache de matériaux à la clé. Revenez à la carte et sélectionnez Grenoble.',
        target: () => centerView === 'map' ? nodeLabel(GRENOBLE) : gq('#vs-map'),
        enter: () => {
            openDrawer = null;
            setTimeout(renderBuildPhase, 0);
        },
        done: s => selectedNode === GRENOBLE || !!s.map.armyDest || s.map.owner[GRENOBLE] === 'player'
    },
    {
        text: 'Le panneau montre la <b>garnison estimée</b>. Avant chaque attaque, je calcule nos chances : cliquez sur <b>Préparer l\'assaut</b>.',
        target: () => gq('#node-panel.open .np-actions .btn-primary') || nodeLabel(GRENOBLE),
        done: s => !!assaultPlan || !!s.map.armyDest || s.map.owner[GRENOBLE] === 'player'
    },
    {
        text: 'Victoire quasi certaine. Le <b>repli</b> protège l\'armée si le combat tourne mal. Troisième et dernier ordre du tour : <b>lancez l\'assaut</b>.',
        target: () => gq('#confirm-overlay .assault-box .btn-primary') || gq('#node-panel.open .np-actions .btn-primary'),
        done: s => !!s.map.armyDest || s.map.owner[GRENOBLE] === 'player'
    },
    {
        text: 'L\'armée est en route, et le dôme est vide. Ouvrez le panneau <b>Armée</b> et recrutez une <b>Sentinelle</b> : loin de l\'armée, les recrues restent en garnison à Alpha-7.',
        target: () => openDrawer === 'army' ? gq('#drawer .recruit:not(:disabled)') : railBtn('army'),
        done: s => (s.map.garrisons.alpha7 || []).length > 0 || s.map.owner[GRENOBLE] === 'player'
    },
    {
        text: 'Tous nos ordres sont donnés. <b>Terminez le tour</b> : l\'armée atteindra les ruines, et le combat commencera.',
        target: () => gq('#btn-endturn'),
        enter: () => {
            openDrawer = null;
            setTimeout(renderBuildPhase, 0);
        },
        done: s => s.phase === 'battle' || s.turn >= 2
    },
    {
        text: 'Le combat se résout seul. La <b>ligne avant</b> encaisse les coups, les unités rapides frappent l\'arrière. Accélérez avec ×2 ou ×3 si vous le souhaitez.',
        target: () => gq('#speed'), inBattle: true, watch: true,
        done: s => s.phase === 'build' && s.turn >= 2
    },
    {
        text: 'Grenoble est à nous. La cache des ruines a rempli nos réserves. Mais l\'armée est loin du dôme : ramenez-la à <b>Alpha-7</b>. Hegemonia frappera bientôt, et c\'est le dôme qu\'elle visera d\'abord.',
        target: () => selectedNode === 'alpha7' ? [...document.querySelectorAll('#node-panel.open .np-actions .btn-primary')].find(b => b.textContent.includes('Déplacer')) || gq('#node-panel.open') : nodeLabel('alpha7'),
        enter: g => g.seen.push('holding', 'battle'),
        done: s => s.map.armyAt === 'alpha7' || s.map.armyDest === 'alpha7' || s.map.owner[GRENOBLE] !== 'player'
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
        text: 'Plus loin, <b>Lyon</b>, <b>Marseille</b> et <b>Turin</b>. Leurs garnisons sont bien plus solides : il faudra une vraie armée pour les prendre, ou de l\'influence pour s\'allier. Chacune offre un atout différent selon la voie choisie.',
        target: () => nodeLabel('lyon'), ack: true,
        enter: () => {
            if (gq('#research-overlay').classList.contains('active')) toggleResearch();
        }
    },
    {
        text: 'Je vous laisse les commandes. L\'encart <b>Objectifs</b> indique toujours la prochaine étape, et le bouton <b>Aide</b> résume le reste. Je vous signalerai chaque danger.',
        target: () => gq('#objectives'), ack: true
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
        trigger: s => s.phase === 'battle' && s.guide.step >= GUIDE_STEPS.length,
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
        id: 'resData', urgent: true,
        trigger: s => s.phase === 'build' && !!s.resShown && !!s.resShown.data,
        target: () => gq('#res-plates .res.data') || gq('#res-plates'),
        text: 'Mon cortex se réveille. Les <b>données</b> alimentent la recherche : c\'est notre ressource la plus rare. Le Centre de données en produit, et nos matériaux en trop peuvent y être raffinés.'
    },
    {
        id: 'resStability', urgent: true,
        trigger: s => s.phase === 'build' && !!s.resShown && !!s.resShown.stability,
        target: () => gq('#res-plates .res.stability') || gq('#res-plates'),
        text: 'Les habitants du dôme ont peur. La <b>stabilité</b> mesure leur moral : sous 30, nos unités faiblissent, et à 0 c\'est la révolte. Les sièges, les pertes et l\'occupation la font baisser.'
    },
    {
        id: 'resInfluence', urgent: true,
        trigger: s => s.phase === 'build' && !!s.resShown && !!s.resShown.influence,
        target: () => gq('#res-plates .res.influence') || gq('#res-plates'),
        text: 'Les cités libres nous écoutent enfin. L\'<b>influence</b> scelle les alliances, et permet de négocier un répit quand une menace approche.'
    },
    {
        id: 'surplus',
        trigger: s => s.phase === 'build' && s.resources.materials >= resMax('materials') * 0.8,
        target: () => railBtn('dome'),
        text: 'Nos entrepôts débordent : au-delà de la réserve max, la production est perdue. Raffinez des données au <b>Centre de données</b>, élevez des <b>remparts</b> sur nos territoires, ou éveillez le Cœur pour agrandir les réserves.'
    },
    {
        id: 'truce',
        trigger: s => s.phase === 'build' && !!s.resShown && !!s.resShown.influence && s.map.threats.some(t => !t.delayed && (t.nodeId === 'alpha7' || s.map.owner[t.nodeId] === 'player' || s.map.allied[t.nodeId])) && s.resources.influence >= BALANCE.truceCost,
        target: () => gq('#threats .threat-truce:not(:disabled)'),
        text: 'Une menace approche, mais la diplomatie a ses armes : contre de l\'influence, je peux négocier un <b>répit</b> d\'un tour. Le temps de ramener l\'armée ou de renforcer la garnison.'
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
        if (!gtw.done) {
            finishGuideType();
            guideKey = null;
        }
        return;
    }
    const isStep = cur.kind === 'step';
    const key = cur.kind + ':' + (isStep ? state.guide.step : cur.item.id) + ':' + state.guide.on;
    if (key !== guideKey) {
        guideKey = key;
        const count = isStep ? `<span class="gc-count">${state.guide.step + 1} / ${GUIDE_STEPS.length}</span>` : `<span class="gc-count${cur.item.vital ? ' vital' : ''}">${cur.item.vital ? 'Alerte' : 'Conseil'}</span>`;
        const actions = (isStep && !cur.item.ack)
            ? `<span class="gc-hint">${ic(cur.item.watch ? 'eye' : 'hand-pointing')}${cur.item.watch ? 'Observez le combat' : 'À vous de jouer'}</span>`
            : `<button class="btn btn-primary" onclick="guideAck()">Compris</button>`;
        initGuideCard();
        card.innerHTML = `<div class="gc-portrait">${PROMETHEUS_FACE}</div><div class="gc-body"><div class="gc-head"><span class="gc-name">PROMETHEUS<small>IA du dôme Alpha-7</small></span>${count}</div><p class="gc-text">${glossText(cur.item.text)}</p><div class="gc-actions">${actions}${state.guide.on ? '<button class="gc-skip" onclick="guideSkip()">Passer le guide</button>' : ''}</div></div>`;
        guideType(card.querySelector('.gc-text'));
        card.classList.remove('show');
        void card.offsetWidth;
    }
    card.classList.add('show');
    guideTarget = cur.item.target;
    if (!guideRaf) guideRaf = requestAnimationFrame(guideTrack);
}

function coversTarget(card, r) {
    const w = card.offsetWidth, h = card.offsetHeight;
    const bottom = window.innerHeight - (parseFloat(getComputedStyle(card).getPropertyValue('--gc-bottom')) || 84);
    const left = (window.innerWidth - w) / 2;
    return r.right > left - 8 && r.left < left + w + 8 && r.bottom > bottom - h - 8 && r.top < bottom + 8;
}

function guideTrack() {
    guideRaf = null;
    const ring = document.getElementById('guide-ring');
    const card = document.getElementById('guide-card');
    const el = guideTarget ? s0(guideTarget) : null;
    const r = el && el.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') {
        ring.classList.remove('show');
        card.classList.remove('flip');
    } else {
        card.classList.toggle('flip', coversTarget(card, r));
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
    else {
        ring.classList.remove('show');
        card.classList.remove('flip');
    }
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
