const OBJ_KEY = 'pe2147_obj_folded';
const PRODUCTION_BUILDINGS = ['reacteur', 'usine', 'centreDonnees'];
let berlinOddsCache = {key: null, win: 0};
let targetCache = {key: null, best: null};

function frontier() {
    const m = state.map;
    const ids = new Set();
    for (const n of MAP_NODES) {
        if (!isHeld(n.id) && m.armyAt !== n.id) continue;
        n.links.forEach(l => ids.add(l.to));
    }
    return MAP_NODES.filter(n => ids.has(n.id) && n.type !== 'capital' && m.owner[n.id] !== 'player' && !m.allied[n.id]);
}

function oddsKey(...extra) {
    const mood = state.resources.stability < BALANCE.stabilityLow ? -1 : state.resources.stability > BALANCE.stabilityHigh ? 1 : 0;
    return [state.turn, state.army.join(','), state.heroes.join(','), state.research.join(','), JSON.stringify(state.map.allied), mood, state.retreatAt, ...extra].join('|');
}

function bestTarget() {
    if (!state.army.length) return null;
    const key = oddsKey(JSON.stringify(state.map.owner));
    if (targetCache.key === key) return targetCache.best;
    let best = null;
    const from = state.map.armyAt || 'alpha7';
    for (const n of frontier()) {
        const win = estimateBattle(assaultUnits(n.id, state.army), generateForce(garrisonBudgetFor(n), garrisonSeed(n.id)), 30, {retreatAt: state.retreatAt}).win;
        const turns = linkTurns(from, n.id) || MAP_NODES.filter(x => isHeld(x.id) || x.id === 'alpha7').map(x => linkTurns(x.id, n.id)).filter(Boolean).sort((a, b) => a - b)[0] || 9;
        const score = win - turns * 0.02;
        if (win >= 0.5 && (!best || score > best.score)) best = {node: n, win, turns, score};
    }
    targetCache = {key, best};
    return best;
}

function berlinOdds() {
    if (!state.army.length) return 0;
    const node = getNode('berlin');
    const key = oddsKey(garrisonBudgetFor(node), JSON.stringify(state.map.owner));
    if (berlinOddsCache.key !== key) berlinOddsCache = {key, win: estimateBattle(assaultUnits('berlin', state.army), generateForce(garrisonBudgetFor(node), garrisonSeed('berlin')), 40, {retreatAt: state.retreatAt}).win};
    return berlinOddsCache.win;
}

function researchTierDone() {
    if (state.core >= 3) return false;
    return !RESEARCH.some(r => canResearch(r)) && RESEARCH.some(r => r.tier === state.core + 1);
}

const OBJECTIVE_RULES = [
    s => s.map.threats.filter(t => s.map.owner[t.nodeId] === 'player').map(t => ({t, odds: defenseOdds(t)})).filter(x => x.odds === null || x.odds < 0.6).map(({t}) => ({
        urgent: true, icon: 'warning-diamond', go: `focusThreat('${t.nodeId}')`,
        text: `Défendre ${getNode(t.nodeId).name} · ${t.arrivesIn > 1 ? t.arrivesIn + ' tours' : 'prochain tour'}`,
        help: 'Une menace arrive et vos défenses risquent de ne pas suffire. Placez une garnison, ramenez l\'armée ou fortifiez le territoire.'
    })),
    s => PRODUCTION_BUILDINGS.some(id => s.buildings.includes(id)) ? [] : [{
        icon: 'buildings', go: `setCenterView('base')`,
        text: 'Bâtir une première production',
        help: 'Réacteur, Usine ou Centre de données : sans revenus, impossible de recruter ni d\'étudier.'
    }],
    s => s.turn >= 3 && !(s.map.garrisons.alpha7 || []).length && !(s.map.armyAt === 'alpha7' && !s.map.armyDest && s.army.length) ? [{
        icon: 'shield', go: `selectNode('alpha7')`,
        text: 'Laisser une garnison à Alpha-7',
        help: 'Si Alpha-7 est attaquée sans défenseurs, la partie est perdue. Les recrues vont en garnison quand l\'armée est loin du dôme.'
    }] : [],
    s => {
        const dest = s.map.armyDest && s.map.owner[s.map.armyDest] !== 'player' && !s.map.allied[s.map.armyDest] ? getNode(s.map.armyDest) : null;
        if (dest) return [{
            icon: 'path', go: `selectNode('${dest.id}')`,
            text: `Assaut en cours : ${dest.name} · ${s.map.armyEta > 1 ? s.map.armyEta + ' tours' : 'prochain tour'}`,
            help: 'L\'armée marche vers sa cible. Le combat aura lieu à son arrivée, à la fin du tour.'
        }];
        if (s.map.armyDest) return [];
        const t = bestTarget();
        if (t) return [{
            icon: 'sword', go: `selectNode('${t.node.id}')`,
            text: `Attaquer ${t.node.name} · ${Math.round(t.win * 100)} % · ${t.turns} tour${t.turns > 1 ? 's' : ''}`,
            help: 'La cible voisine la plus accessible pour votre armée actuelle, selon les estimations de PROMETHEUS.' + (t.node.unlocksChapter > state.chapter ? ' La tenir ouvre le chapitre ' + t.node.unlocksChapter + '.' : '')
        }];
        return state.chapter === 1 ? [{
            icon: 'shield-plus', go: `toggleDrawer('army')`,
            text: 'Renforcer l\'armée',
            help: 'Aucune cible voisine ne dépasse 50 % de chances. Recrutez, bâtissez la Caserne ou étudiez. Lyon, Marseille ou le CERN ouvriront le chapitre 2.'
        }] : [];
    },
    () => researchTierDone() ? [{
        icon: 'atom', go: `setCenterView('base'); selectBase('core')`,
        text: `Éveiller le Cœur (niveau ${state.core + 1})`,
        help: 'Toutes les recherches de ce palier sont faites. Éveiller le Cœur ouvre le palier suivant et agrandit l\'armée.'
    }] : [],
    s => MAP_NODES.filter(n => n.type === 'city' && s.map.owner[n.id] === 'neutral' && !s.map.allied[n.id] && (s.resources.influence || 0) >= getAllyCost(n)).slice(0, 1).map(n => ({
        icon: 'handshake', go: `selectNode('${n.id}')`,
        text: `S'allier à ${n.name} (${getAllyCost(n)}🌐)`,
        help: 'Vous avez assez d\'influence pour une alliance. Comparez d\'abord les deux voies dans le panneau de la cité.'
    })),
    s => s.chapter >= 2 && s.map.owner.outpost !== 'player' && s.map.owner.munich !== 'player' && !bestTarget() ? [{
        icon: 'scissors', go: `selectNode('outpost')`,
        text: 'Prendre un avant-poste',
        help: 'Strasbourg (−10) ou Munich (−6) : chaque avant-poste pris coupe le ravitaillement de Berlin et affaiblit sa garnison.'
    }] : [],
    s => s.chapter >= 3 && berlinOdds() >= 0.6 ? [{
        icon: 'sword', go: `selectNode('berlin')`,
        text: 'Lancer l\'assaut sur Berlin',
        help: 'PROMETHEUS estime vos chances suffisantes. Rapprochez l\'armée de Berlin, puis préparez l\'assaut.'
    }] : []
];

function shortObjectives() {
    const list = [];
    for (const rule of OBJECTIVE_RULES) {
        for (const o of rule(state)) list.push(o);
        if (list.length >= 2) break;
    }
    if (!list.length) list.push({icon: 'compass', go: `selectNode('berlin')`, text: 'Renforcer l\'armée pour Berlin', help: 'Recrutez, étudiez et prenez les territoires qui affaiblissent la capitale.'});
    return list.slice(0, 2);
}

function destinyTt() {
    const now = resolveEnding();
    const rows = Object.entries(ENDINGS).map(([k, e]) => {
        const ok = k === now;
        return `<div class="obj-end${ok ? ' ok' : ''}"><b>${esc(e.title)}</b> · ${richText(e.hint)}</div>`;
    }).join('');
    return tt('Destin en vue', 'La fin obtenue si Berlin tombait maintenant. Vos alliances, conquêtes et choix la font évoluer.' + rows);
}

function objectivesFolded() {
    return prefGet(OBJ_KEY) === '1';
}

function toggleObjectives() {
    prefSet(OBJ_KEY, objectivesFolded() ? '0' : '1');
    renderObjectives();
}

function renderObjectives() {
    const el = document.getElementById('objectives');
    if (!el) return;
    const hidden = !!openDrawer;
    el.classList.toggle('hidden', hidden);
    if (hidden) return;
    const folded = objectivesFolded();
    const items = shortObjectives();
    const node = getNode('berlin');
    const full = Math.round(node.garrisonBudget * BALANCE.garrisonMult);
    const now = garrisonBudgetFor(node);
    const destiny = resolveEnding();
    const urgent = items.some(o => o.urgent);
    el.classList.toggle('folded', folded);
    el.classList.toggle('urgent', urgent);
    const head = `<button class="obj-head" onclick="toggleObjectives()" aria-expanded="${!folded}"><span class="eyebrow">Objectifs</span><span class="obj-count">${items.length}</span>${ic(folded ? 'caret-down' : 'caret-up')}</button>`;
    if (folded) {
        el.innerHTML = head;
        return;
    }
    const berlin = `<div class="obj-long"><div class="obj-title">${ic('crown-simple')}Libérer Berlin</div><div class="obj-gauge" data-tt="${tt('Garnison de Berlin', glossText('Prendre les avant-postes de Strasbourg et Munich coupe son ravitaillement et retire des défenseurs. Plus elle est faible, plus l’assaut final est accessible.'))}"><span class="obj-bar"><i style="width:${Math.round(now / full * 100)}%"></i></span><span class="obj-num">${now < full ? full + ' → ' : ''}${now}</span></div><div class="obj-destiny" data-tt="${destinyTt()}">Destin en vue : <b>${esc(ENDINGS[destiny].title)}</b></div></div>`;
    const list = items.map(o => `<button class="obj-item${o.urgent ? ' urgent' : ''}" onclick="${o.go}" data-tt="${tt(esc(o.text), glossText(richText(o.help)))}">${ic(o.icon)}<span>${richText(o.text)}</span></button>`).join('');
    el.innerHTML = head + berlin + `<div class="obj-list">${list}</div>`;
}
