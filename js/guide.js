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
        text: 'Le reste vous appartient, Commandant. Je vous signalerai l\'essentiel en chemin. Le bouton <b>Guide</b> du rail me rappelle ou me fait taire.',
        target: () => gq('#btn-guide'), ack: true
    }
];

const GUIDE_TIPS = [
    {
        id: 'threat', urgent: true,
        trigger: s => s.phase === 'build' && s.map.threats.length > 0,
        target: () => gq('#threats .threat-card'),
        text: 'Une force hostile marche sur nos terres. Le chiffre indique les tours avant l\'attaque. Sans garnison ni armée sur place, la colonie tombera, et si c\'est Alpha-7, tout est perdu.'
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
    const tip = GUIDE_TIPS.find(t => !g.seen.includes(t.id) && (t.urgent || stepsDone) && t.trigger(state));
    if (tip) {
        g.tip = tip.id;
        save();
        return {kind: 'tip', item: tip};
    }
    return stepsDone ? null : {kind: 'step', item: GUIDE_STEPS[g.step]};
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
    const railGuide = document.getElementById('btn-guide');
    if (railGuide) railGuide.classList.toggle('active', state.guide.on);
    const cur = state.guide.on ? currentGuideItem() : null;
    if (!cur || !guideVisible(cur)) {
        card.classList.remove('show');
        guideTarget = null;
        return;
    }
    const isStep = cur.kind === 'step';
    const key = cur.kind + ':' + (isStep ? state.guide.step : cur.item.id);
    if (key !== guideKey) {
        guideKey = key;
        const count = isStep ? `<span class="gc-count">${state.guide.step + 1} / ${GUIDE_STEPS.length}</span>` : '<span class="gc-count">Conseil</span>';
        const actions = (isStep && !cur.item.ack)
            ? `<span class="gc-hint">${ic('hand-pointing')}À vous de jouer</span>`
            : `<button class="btn btn-primary" onclick="guideAck()">Compris</button>`;
        card.innerHTML = `<div class="gc-portrait"><span></span></div><div class="gc-body"><div class="gc-head"><span class="eyebrow">PROMETHEUS · Conseiller</span>${count}</div><p class="gc-text">${cur.item.text}</p><div class="gc-actions">${actions}<button class="gc-skip" onclick="guideSkip()">Passer le guide</button></div></div>`;
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
    toast('Guide en pause. Le bouton Guide du rail le rappelle.', '');
}

function toggleGuide() {
    state.guide.on = !state.guide.on;
    if (state.guide.on && state.guide.step >= GUIDE_STEPS.length && !state.guide.tip) {
        state.guide.step = 0;
        enterStep(state.guide);
    }
    guideKey = null;
    save();
    guideUpdate();
}
