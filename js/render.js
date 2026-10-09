let centerView = 'map';
let selectedNode = null;
let selectedBase = null;
let openDrawer = null;
let mapLinksCache = null;
let lastCommand = null;
let lastResources = null;

const ICONS = {
    res: {energy: 'lightning', materials: 'nut', data: 'database', stability: 'bank', influence: 'globe-hemisphere-west'},
    node: {home: 'castle-turret', city: 'buildings', ruin: 'radioactive', outpost: 'barricade', capital: 'skull', nexus: 'cpu'},
    unit: {sentinelle: 'shield', mech: 'robot', drone: 'drone', biosoldat: 'dna', agent: 'detective', titanUnit: 'robot'},
    hero: {valkyrie: 'bird', oracle: 'sparkle', avatar: 'eye'},
    building: {reacteur: 'atom', usine: 'factory', centreDonnees: 'hard-drives', quartiers: 'house-line', caserne: 'sword', hangar: 'warehouse', labo: 'flask', antenne: 'broadcast', bouclier: 'shield-check', titan: 'robot'},
    branch: {DOCTRINE: 'gear-six', GUERRE: 'sword', SINGULARITE: 'brain'},
    toast: {build: 'hammer', warning: 'warning-diamond', chapter: 'seal-check', event: 'scroll', '': 'info'}
};

const BRANCH_COLOR = {DOCTRINE: 'var(--materials)', GUERRE: 'var(--st-hostile)', SINGULARITE: 'var(--data)'};
const STATUS_LABEL = {player: 'Sous contrôle', allied: 'Allié', neutral: 'Neutre', hostile: 'Hostile'};
const TYPE_LABEL = {home: 'Dôme souverain', city: 'Cité-État', ruin: 'Ruines', outpost: 'Avant-poste d\'Hegemonia', capital: 'Capitale ennemie', nexus: 'Site interdit'};
const EMOJI_RES = [['🏛️', 'stability'], ['🏛', 'stability'], ['⚡', 'energy'], ['🔩', 'materials'], ['💾', 'data'], ['🌐', 'influence']];

function ic(name, cls = '') {
    return `<i class="ph-duotone ph-${name}${cls ? ' ' + cls : ''}"></i>`;
}

function resIcon(k) {
    return ic(ICONS.res[k], 'ri ' + k);
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function richText(s) {
    let out = esc(s);
    const marks = [];
    EMOJI_RES.forEach(([emo, k]) => {
        out = out.split(emo).join('\u0000' + marks.length + '\u0000');
        marks.push(resIcon(k));
    });
    out = out.replace(/[\p{Extended_Pictographic}\u2B06\u2B07\u2702\u25B6\u25BA\u2550]\uFE0F?/gu, '').replace(/\uFE0F/g, '').replace(/\s{2,}/g, ' ').trim();
    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => marks[i]);
}

const GLOSS_RE = Object.entries(GLOSSARY).map(([k, g]) => [k, new RegExp('(?<![\\p{L}])(' + g.match + ')(?![\\p{L}])', g.exact ? 'u' : 'iu')]);

function termTt(k) {
    return tt(esc(GLOSSARY[k].title), richText(GLOSSARY[k].text));
}

function term(k, label) {
    return `<dfn class="term" data-tt="${termTt(k)}">${label}</dfn>`;
}

function glossText(html) {
    const used = new Set(), marks = [];
    const out = html.split(/(<[^>]+>)/).map(part => {
        if (part.startsWith('<')) return part;
        for (const [k, re] of GLOSS_RE) {
            if (used.has(k)) continue;
            part = part.replace(re, m => {
                used.add(k);
                marks.push(`<dfn class="term" data-tt="${termTt(k)}">${m}</dfn>`);
                return '\u0001' + (marks.length - 1) + '\u0001';
            });
        }
        return part;
    }).join('');
    return out.replace(/\u0001(\d+)\u0001/g, (_, i) => marks[i]);
}

function costSpans(cost) {
    return Object.entries(cost).map(([k, v]) => `<span class="${(state.resources[k] || 0) < v ? 'short' : ''}">${resIcon(k)}${v}</span>`).join('');
}

function costHtml(cost) {
    return '<span class="cost">' + costSpans(cost) + '</span>';
}

function fxHtml(effects) {
    return '<span class="fx">' + Object.entries(effects).map(([k, v]) =>
        `<span class="${v >= 0 ? 'pos' : 'neg'}">${resIcon(k)}${v > 0 ? '+' : ''}${v}</span>`).join('') + '</span>';
}

function cmdChip() {
    return `<span class="cmd-chip">${ic('diamond')}1</span>`;
}

function blockReason(cost, needsCmd) {
    if (needsCmd && state.command < 1) return 'Plus de points de commandement ce tour';
    if (cost && !canAfford(cost)) return 'Ressources insuffisantes';
    return '';
}

function render() {
    const inBattle = state.phase !== 'build';
    document.body.classList.toggle('in-battle', inBattle);
    renderTop();
    if (inBattle) {
        renderBattle();
        guideUpdate();
    } else renderBuildPhase();
}

const gt = {el: null, timer: null, target: null};
const TT_DELAY = 400;

function hideTooltip() {
    clearTimeout(gt.timer);
    gt.target = null;
    gt.el.classList.remove('visible');
}

function initTooltip() {
    gt.el = document.getElementById('g-tooltip');
    document.addEventListener('mouseover', e => {
        const wrap = e.target.closest('[data-tt]');
        if (wrap === gt.target) return;
        hideTooltip();
        if (!wrap || !wrap.dataset.tt) return;
        gt.target = wrap;
        gt.timer = setTimeout(() => {
            if (gt.target !== wrap || !wrap.isConnected) return;
            gt.el.innerHTML = wrap.dataset.tt;
            gt.el.classList.add('visible');
            positionTooltip(wrap);
        }, TT_DELAY);
    });
    document.addEventListener('mouseout', e => {
        if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('[data-tt]')) hideTooltip();
    });
    document.addEventListener('mousedown', hideTooltip);
}

function positionTooltip(el) {
    const r = el.getBoundingClientRect();
    const tw = gt.el.offsetWidth, th = gt.el.offsetHeight;
    let top = r.bottom + 10;
    let left = r.left + r.width / 2 - tw / 2;
    if (top + th > window.innerHeight - 8) top = r.top - th - 10;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    gt.el.style.top = top + 'px';
    gt.el.style.left = left + 'px';
}

function initKeys() {
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (document.getElementById('confirm-overlay').classList.contains('active')) return confirmDismiss();
        const rs = document.getElementById('research-overlay');
        if (rs.classList.contains('active')) return toggleResearch();
        if (openDrawer) return toggleDrawer(openDrawer);
        if (selectedNode || selectedBase) closeNodePanel();
    });
}

function ttHtml(title, body) {
    return `<div class="tt-title">${title}</div><div class="tt-row">${body}</div>`;
}

function tt(title, body) {
    return esc(ttHtml(title, body));
}

function unitTtData(u) {
    const specials = [];
    if (u.heals) specials.push('Régénère <span>' + u.heals + ' PV</span> par round');
    if (u.dodge) specials.push('Esquive <span>' + (u.dodge * 100) + '%</span> des attaques');
    specials.push(u.frontline ? 'Ligne avant' : 'Ligne arrière, frappe l\'arrière ennemi si <span>VIT ≥ 6</span>');
    if (u.size > 1) specials.push('Occupe <span>' + u.size + '</span> places');
    return tt(u.name, `PV <span>${u.hp}</span> · ATK <span>${u.atk}</span> · DEF <span>${u.def}</span> · VIT <span>${u.spd}</span><br>${specials.join('<br>')}`);
}

function statsHtmlUnit(u) {
    return `<span class="stats"><span data-tt="${termTt('pv')}">PV<b>${u.hp}</b></span><span data-tt="${termTt('atk')}">ATK<b>${u.atk}</b></span><span data-tt="${termTt('def')}">DEF<b>${u.def}</b></span><span data-tt="${termTt('vit')}">VIT<b>${u.spd}</b></span></span>`;
}

function resShown(k) {
    return !state.resShown || !!state.resShown[k];
}

function revealRes(k) {
    if (resShown(k)) return;
    state.resShown[k] = true;
    toast('Nouvelle ressource : ' + RES_META[k].label, 'chapter');
    save();
}

function checkResReveal() {
    if (!state.resShown) return;
    const researchOpen = document.getElementById('research-overlay').classList.contains('active');
    if (state.turn >= 2 || researchOpen || isBuilt('centreDonnees') || state.research.length) revealRes('data');
    if (state.turn >= 3 || state.map.threats.length) revealRes('stability');
    const cityPicked = selectedNode && getNode(selectedNode).type === 'city';
    if (state.chapter >= 2 || state.turn >= 5 || cityPicked || alliedCities(state)) revealRes('influence');
}

function renderTop() {
    checkResReveal();
    const prod = getCampaignProduction();
    const bumped = [];
    let html = '';
    for (const [k, meta] of Object.entries(RES_META)) {
        if (!resShown(k)) continue;
        const v = state.resources[k];
        const p = prod[k] + (k === 'stability' ? stabilityDrift() : 0);
        const critical = k === 'stability' && v <= 20;
        if (lastResources && lastResources[k] !== v) bumped.push(k);
        const upkeep = k === 'energy' ? getUpkeep() : 0;
        const cities = MAP_NODES.map(n => [n, cityDividend(n)]).filter(([, d]) => d && d.prod[k]).map(([n, d]) => `<br>Dont ${esc(n.name)}, ${esc(d.name)} <span>+${d.prod[k]}</span>`).join('');
        const g = GLOSSARY[{stability: 'stabilite', influence: 'influence'}[k]];
        const cap = k === 'stability' ? '' : `<br><small>Éveiller le Cœur augmente la réserve max.</small>`;
        const body = (g ? `<div class="tt-def">${richText(g.text)}</div>` : '') + `Réserve <span>${v} / ${resMax(k)}</span>${cap}<br>Par tour <span>${p >= 0 ? '+' : ''}${p}</span>` + cities + (upkeep ? `<br>Dont entretien des unités <span>−${upkeep}</span>` : '') + (critical ? '<br><span style="color:var(--danger)">Stabilité critique : risque de révolte</span>' : '');
        html += `<div class="res ${k}${critical ? ' critical' : ''}${bumped.includes(k) ? ' bump' : ''}" data-tt="${tt(meta.label, body)}">${resIcon(k)}<span class="res-val">${v}</span><span class="res-prod${p < 0 ? ' neg' : ''}">${p >= 0 ? '+' : ''}${p}</span></div>`;
    }
    lastResources = {...state.resources};
    document.getElementById('res-plates').innerHTML = html;

    const ch = CHAPTERS[state.chapter - 1];
    document.getElementById('turn-cartouche').innerHTML = `<span class="tc-turn">Tour ${state.turn}</span><span class="tc-chapter">Chapitre ${ch.num} · ${ch.name}</span>`;

    const max = getCommandMax();
    let pips = '';
    for (let i = 0; i < max; i++) {
        const spent = lastCommand !== null && i >= state.command && i < lastCommand;
        pips += `<i class="pip${i < state.command ? ' on' : ''}${spent ? ' spent' : ''}"></i>`;
    }
    lastCommand = state.command;
    document.getElementById('cmd').innerHTML = `<span class="cmd-label">Commandement</span><span class="pips">${pips}</span>`;
    document.getElementById('cmd').dataset.tt = ttHtml('Points de commandement', `Bâtir, améliorer, rechercher, déplacer l'armée, attaquer, fortifier ou s'allier coûte <span>1 point</span>.<br>Recruter est gratuit. Les points reviennent à chaque tour.`);
}

function setCenterView(v) {
    centerView = v;
    selectedBase = null;
    if (v === 'base' && openDrawer === 'dome') openDrawer = null;
    renderBuildPhase();
}

function toggleDrawer(name) {
    openDrawer = openDrawer === name ? null : name;
    renderBuildPhase();
}

function selectNode(id) {
    selectedNode = id;
    if (centerView !== 'map') centerView = 'map';
    renderBuildPhase();
    if (state.resShown && !state.resShown.influence) renderTop();
}

function selectBase(id) {
    if (id && id.startsWith('slot:')) {
        selectedBase = null;
        openDrawer = 'dome';
    } else selectedBase = id;
    renderBuildPhase();
}

function hoverBase(id, ev) {
    if (!id || !ev) {
        gt.el.classList.remove('visible');
        return;
    }
    const b = BUILDINGS.find(x => x.id === id);
    const title = id === 'core' ? 'Cœur de PROMETHEUS' : b ? b.name : 'Emplacement libre';
    const sub = id === 'core' ? `Niveau ${state.core} sur 3 · cliquer pour gérer` : b ? `Niveau ${getBuildingLevel(id)} sur ${BALANCE.maxBuildingLevel} · cliquer pour gérer` : 'Cliquer pour bâtir';
    gt.el.innerHTML = ttHtml(esc(title), sub);
    gt.el.classList.add('visible');
    const tw = gt.el.offsetWidth, th = gt.el.offsetHeight;
    gt.el.style.left = Math.min(ev.clientX + 16, window.innerWidth - tw - 8) + 'px';
    gt.el.style.top = Math.min(ev.clientY + 18, window.innerHeight - th - 8) + 'px';
}

function closeNodePanel() {
    selectedNode = null;
    selectedBase = null;
    renderBuildPhase();
}

function focusThreat(id) {
    selectNode(id);
    if (window.Map3D) Map3D.focus(id);
}

function nextThreatAt(m, id) {
    return m.threats.filter(t => t.nodeId === id).sort((a, b) => a.arrivesIn - b.arrivesIn)[0];
}

function roman(n) {
    return ['', 'I', 'II', 'III'][n];
}

function chapterTitle(ch) {
    return ch.name.charAt(0) + ch.name.slice(1).toLowerCase();
}

function nodeStatus(id, s = state) {
    return s.map.owner[id] === 'player' ? 'player' : (s.map.allied[id] ? 'allied' : s.map.owner[id]);
}

function cityTokens() {
    return MAP_NODES.filter(n => n.identity && cityDividend(n)).map(n => ({id: n.id, kind: state.map.owner[n.id] === 'player' ? 'take' : 'ally', emblem: n.identity.emblem}));
}

function buildMapSnapshot(s = state) {
    const m = s.map;
    const reach = new Set();
    if (m.armyAt && !m.armyDest) getNode(m.armyAt).links.forEach(l => reach.add(l.to));
    const nodes = MAP_NODES.map(n => {
        const threat = nextThreatAt(m, n.id);
        return {
            id: n.id, name: n.name, glyph: ICONS.node[n.type], lon: n.geo.lon, lat: n.geo.lat,
            status: nodeStatus(n.id, s), selected: s === state && n.id === selectedNode,
            threat: threat ? threat.arrivesIn : null, type: n.type, emblem: n.identity ? n.identity.emblem : null
        };
    });
    if (!mapLinksCache) {
        const seen = new Set();
        mapLinksCache = [];
        MAP_NODES.forEach(n => n.links.forEach(l => {
            const key = [n.id, l.to].sort().join('|');
            if (seen.has(key)) return;
            seen.add(key);
            mapLinksCache.push({a: n.id, b: l.to, turns: l.turns});
        }));
    }
    const links = mapLinksCache.map(l => ({...l, active: !!m.armyAt && !m.armyDest && (l.a === m.armyAt || l.b === m.armyAt)}));
    let army = null;
    if (m.armyAt) army = {at: m.armyAt};
    else if (m.armyDest) {
        const total = linkTurns(m.armyFrom, m.armyDest) || 1;
        army = {from: m.armyFrom, to: m.armyDest, progress: Math.max(0, Math.min(1, 1 - m.armyEta / total))};
    }
    return {nodes, links, army, reach: [...reach]};
}

function mountTitleMap() {
    if (!window.Map3D || !document.getElementById('title-screen').classList.contains('active')) return;
    Map3D.mount(document.getElementById('title-map'));
    Map3D.sync(buildMapSnapshot(defaultState()));
    Map3D.setAttract(true);
}

function setStageView(id) {
    document.querySelectorAll('.stage-view').forEach(el => el.classList.toggle('on', el.id === id));
}

function renderBuildPhase() {
    if (window.Battle3D && Battle3D.stop) Battle3D.stop();
    document.getElementById('vs-map').classList.toggle('active', centerView === 'map');
    document.getElementById('vs-base').classList.toggle('active', centerView === 'base');
    if (centerView === 'base') {
        if (window.Map3D) Map3D.stop();
        setStageView('base3d-view');
        if (window.Base3D) {
            Base3D.mount(document.getElementById('base3d-view'));
            Base3D.sync(state.buildings, state.buildingLevels, state.core, state.research.map(id => (RESEARCH.find(r => r.id === id) || {}).branch), cityTokens());
            Base3D.onSelect(id => id ? selectBase(id) : (selectedBase && closeNodePanel()));
            Base3D.onHover(hoverBase);
            Base3D.setSelected(selectedBase);
        }
    } else {
        if (window.Base3D) Base3D.stop();
        setStageView('map3d-view');
        if (window.Map3D) {
            Map3D.setAttract(false);
            Map3D.mount(document.getElementById('map3d-view'));
            Map3D.sync(buildMapSnapshot());
            Map3D.onSelect(id => id ? selectNode(id) : (selectedNode && closeNodePanel()));
        }
    }

    document.querySelectorAll('.rail-btn[data-drawer]').forEach(b => b.classList.toggle('active', b.dataset.drawer === openDrawer));
    renderRailDots();
    renderDrawer();
    renderNodePanel();
    renderThreats();
    renderObjectives();
    renderEndTurn();
    guideUpdate();
}

function renderRailDots() {
    const dots = {
        dome: BUILDINGS.some(b => !isBuilt(b.id) && isBuildingUnlocked(b) && canAfford(b.cost)) && state.command > 0,
        heroes: HEROES.some(h => canRecruitHero(h)),
        research: RESEARCH.some(r => canResearch(r) && canAfford(r.cost)) && state.command > 0
    };
    document.querySelectorAll('.rail-btn').forEach(b => {
        const key = b.dataset.drawer || (b.id === 'btn-research' ? 'research' : null);
        const has = !!dots[key];
        let d = b.querySelector('.rail-dot');
        if (has && !d) b.insertAdjacentHTML('beforeend', '<i class="rail-dot"></i>');
        if (!has && d) d.remove();
    });
}

function drawerShell(eyebrow, title, body) {
    return `<div class="dr-head"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div><button class="dr-close" onclick="toggleDrawer(openDrawer)" aria-label="Fermer">${ic('x')}</button></div><div class="dr-body">${body}</div>`;
}

function renderDrawer() {
    const el = document.getElementById('drawer');
    el.classList.toggle('open', !!openDrawer);
    if (!openDrawer) return;
    const scroll = el.querySelector('.dr-body') ? el.querySelector('.dr-body').scrollTop : 0;
    const same = el.dataset.kind === openDrawer;
    el.dataset.kind = openDrawer;
    if (openDrawer === 'dome') el.innerHTML = drawerShell('Alpha-7', 'Le Dôme', domeBody());
    else if (openDrawer === 'army') el.innerHTML = drawerShell('Forces', 'Armée de campagne', armyBody());
    else if (openDrawer === 'heroes') el.innerHTML = drawerShell('Champions', 'Héros', heroesBody());
    else if (openDrawer === 'log') el.innerHTML = drawerShell('Chroniques', 'Journal', logBody());
    else if (openDrawer === 'help') el.innerHTML = drawerShell('PROMETHEUS', 'Aide', helpBody());
    const body = el.querySelector('.dr-body');
    if (openDrawer === 'log') body.scrollTop = body.scrollHeight;
    else if (same) body.scrollTop = scroll;
}

function domeBody() {
    const coreCost = getCoreUpgradeCost();
    let h = `<button class="btn btn-ghost btn-block enter-dome" onclick="setCenterView('${centerView === 'base' ? 'map' : 'base'}')">${ic(centerView === 'base' ? 'map-trifold' : 'sign-in')}${centerView === 'base' ? 'Retour à la carte' : 'Entrer dans le dôme'}</button>`;
    h += '<div class="sec-label">Cœur de PROMETHEUS</div>';
    const reason = coreCost ? blockReason(coreCost, true) : '';
    h += `<div class="core-card"><div class="core-gem"><span>${roman(state.core)}</span></div><div class="core-info"><div class="row-title">Niveau ${state.core} sur 3</div><div class="row-sub">Chaque niveau ajoute ${BALANCE.armyCapPerCore} places à l'armée et ouvre un palier de recherche.</div></div>`
        + (coreCost
            ? `<button class="btn btn-primary btn-block" ${reason ? 'disabled' : ''} data-tt="${esc(reason)}" onclick="upgradeCore()">${ic('arrow-up')}Éveiller ${costHtml(coreCost)}</button>`
            : '<span class="tag">Éveil complet</span>')
        + '</div>';
    for (let ch = 1; ch <= 3; ch++) {
        const list = BUILDINGS.filter(b => b.chapter === ch);
        h += `<div class="sec-label">${chapterTitle(CHAPTERS[ch - 1])}<span class="count">Ch. ${ch}</span></div>`;
        list.forEach(b => {
            const built = isBuilt(b.id), locked = !isBuildingUnlocked(b);
            const lvl = getBuildingLevel(b.id);
            let action = '', meta = '';
            if (built) {
                const up = getUpgradeCost(b.id);
                meta = `<span class="lvl">${[1, 2, 3].map(i => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('')}</span>` + (up ? costHtml(up) : '<span class="tag">Max</span>');
                if (up) {
                    const r = blockReason(up, true);
                    action = `<button class="btn btn-primary btn-icon" ${r ? 'disabled' : ''} data-tt="${esc(r || 'Améliorer au niveau ' + (lvl + 1) + ' : production ×' + (lvl + 1))}" onclick="upgradeBuilding('${b.id}')" aria-label="Améliorer">${ic('arrow-up')}</button>`;
                }
            } else if (locked) {
                const r = b.research && RESEARCH.find(x => x.id === b.research);
                meta = `<span class="req">${ic('lock-simple')}${r ? 'Recherche : ' + esc(r.name) : 'Chapitre ' + b.chapter}</span>`;
            } else {
                const r = blockReason(b.cost, true);
                meta = costHtml(b.cost);
                action = `<button class="btn btn-primary" ${r ? 'disabled' : ''} data-tt="${esc(r)}" onclick="buildBuilding('${b.id}')">Bâtir</button>`;
            }
            h += `<div class="row${locked ? ' locked' : ''}"><div class="crest${built ? ' teal' : ''}">${ic(ICONS.building[b.id] || 'cube')}</div><div class="row-main"><div class="row-title">${esc(b.name)}</div><div class="row-sub">${richText(b.desc)}</div><div class="row-meta">${meta}</div></div>${action}</div>`;
        });
    }
    return h;
}

function armyBody() {
    const m = state.map;
    const atNode = m.armyAt ? getNode(m.armyAt) : null;
    const cap = getArmyCap(), size = getArmySize();
    let where = m.armyDest
        ? `En marche vers <b>${esc(getNode(m.armyDest).name)}</b>, arrivée dans ${m.armyEta} tour(s)`
        : `Stationnée à <b>${esc(atNode ? atNode.name : '?')}</b>`;
    let h = `<div class="fact">${ic('map-pin')}<span class="fact-l">${where}</span></div>`;
    h += `<div class="sec-label">Effectifs<span class="count">${size} / ${cap}</span></div><div class="slots-bar">${Array.from({length: cap}, (_, i) => `<i class="${i < size ? 'on' : ''}"></i>`).join('')}</div>`;
    const onOwned = m.armyAt && !m.armyDest && m.owner[m.armyAt] === 'player';
    const transferTt = 'Transférer : 1 point de commandement couvre tous les transferts du tour';
    if (!state.army.length) h += '<div class="empty">Aucune unité. Recrutez ci-dessous.</div>';
    state.army.forEach((id, i) => {
        const u = getUnit(id);
        h += `<div class="row" data-tt="${unitTtData(u)}"><div class="crest">${ic(ICONS.unit[u.id])}</div><div class="row-main"><div class="row-title">${esc(u.name)}${u.size > 1 ? `<span class="tag">×${u.size}</span>` : ''}</div><div class="row-meta">${statsHtmlUnit(u)}</div></div>`
            + (onOwned ? `<button class="btn btn-ghost btn-icon" data-tt="${esc(transferTt)}" onclick="transferToGarrison(${i})" aria-label="Vers la garnison">${ic('arrow-down')}</button>` : '')
            + `<button class="btn btn-ghost btn-icon" data-tt="Libérer l'unité" onclick="dismissUnit(${i})" aria-label="Libérer">${ic('x')}</button></div>`;
    });
    if (onOwned) {
        const g = m.garrisons[m.armyAt] || [];
        h += `<div class="sec-label">Garnison de ${esc(atNode.name)}<span class="count">${g.length}</span></div>`;
        if (!g.length) h += '<div class="empty">Garnison vide. Ce lieu tombera s\'il est attaqué sans armée.</div>';
        g.forEach((id, i) => {
            const u = getUnit(id);
            h += `<div class="row" data-tt="${unitTtData(u)}"><div class="crest">${ic(ICONS.unit[u.id])}</div><div class="row-main"><div class="row-title">${esc(u.name)}</div><div class="row-meta">${statsHtmlUnit(u)}</div></div><button class="btn btn-ghost btn-icon" data-tt="${esc(transferTt)}" onclick="transferToArmy(${i})" aria-label="Vers l'armée">${ic('arrow-up')}</button><button class="btn btn-ghost btn-icon" data-tt="Libérer l'unité (supprime son entretien)" onclick="dismissGarrison('${m.armyAt}', ${i})" aria-label="Libérer">${ic('x')}</button></div>`;
        });
    }
    const atHome = m.armyAt === 'alpha7' && !m.armyDest;
    h += `<div class="sec-label">Recruter<span class="count">gratuit en commandement</span></div>`;
    if (!atHome) h += `<div class="fact" style="margin-bottom:10px">${ic('info')}<span class="fact-l">L'armée est loin du dôme : les recrues rejoignent la garnison d'Alpha-7.</span></div>`;
    h += '<div class="recruit-grid">';
    UNITS.forEach(u => {
        const unlocked = u.always || (u.building && isBuilt(u.building));
        if (!unlocked) {
            const b = BUILDINGS.find(x => x.id === u.building);
            h += `<button class="recruit" disabled data-tt="${esc('Requiert : ' + (b ? b.name : '?'))}"><span class="r-top"><span class="crest">${ic(ICONS.unit[u.id])}</span><span class="r-name">${esc(u.name)}</span></span><span class="req">${ic('lock-simple')}${esc(b ? b.name : '?')}</span></button>`;
            return;
        }
        const cost = unitCost(u);
        h += `<button class="recruit" ${canAfford(cost) ? '' : 'disabled'} data-tt="${unitTtData(u)}" onclick="recruitUnit('${u.id}')"><span class="r-top"><span class="crest">${ic(ICONS.unit[u.id])}</span><span class="r-name">${esc(u.name)}${u.size > 1 ? ' ×' + u.size : ''}</span></span><span class="r-foot">${costHtml(cost)}<span class="r-plus">${ic('plus-circle')}</span></span></button>`;
    });
    return h + '</div>';
}

function heroesBody() {
    let h = `<div class="row-sub" style="margin-bottom:14px">Les héros combattent aux côtés de l'armée. Tombés au combat, ils sont blessés pendant ${BALANCE.heroWoundTurns} tours. Places : <b style="color:var(--gold-hi)">${state.heroes.length} / ${getHeroSlots()}</b></div>`;
    HEROES.forEach(hero => {
        const owned = state.heroes.includes(hero.id);
        const unlocked = hasResearch(hero.research);
        const stats = statsHtmlUnit(hero);
        let foot = '';
        if (owned) {
            foot = isHeroWounded(hero.id) ? `<span class="tag warn">Blessé · ${state.heroWounded[hero.id]} tour(s)</span>` : '<span class="tag">Prêt au combat</span>';
        } else if (unlocked) {
            const full = state.heroes.length >= getHeroSlots();
            const r = full ? 'Toutes les places de héros sont prises' : blockReason(hero.cost, false);
            foot = `<button class="btn btn-primary" ${r ? 'disabled' : ''} data-tt="${esc(r)}" onclick="recruitHero('${hero.id}')">Recruter ${costHtml(hero.cost)}</button>`;
        } else {
            const r = RESEARCH.find(x => x.id === hero.research);
            foot = `<span class="req">${ic('lock-simple')}Recherche : ${esc(r ? r.name : hero.research)}</span>`;
        }
        h += `<div class="hero-card${owned ? ' owned' : ''}${!owned && !unlocked ? ' locked' : ''}"><div class="hero-portrait">${ic(ICONS.hero[hero.id])}</div><div class="row-main"><div class="row-title">${esc(hero.name)}</div><div class="row-meta">${stats}</div><div class="hero-ability"><b>${esc(hero.abilityName)}</b> · ${esc(hero.abilityDesc)}</div><div class="row-meta">${foot}</div></div></div>`;
    });
    return h;
}

function logBody() {
    if (!state.log.length) return '<div class="empty">Rien à signaler pour l\'instant.</div>';
    return '<div class="log-list">' + state.log.slice(-40).map(e => `<div class="log-entry ${e.cls}">${richText(e.text)}</div>`).join('') + '</div>';
}

function renderNodePanel() {
    const el = document.getElementById('node-panel');
    if (centerView === 'base') return renderBasePanel(el);
    const open = !!selectedNode && centerView === 'map';
    el.classList.toggle('open', open);
    if (!open) return;
    const id = selectedNode;
    const node = getNode(id);
    const m = state.map;
    const st = nodeStatus(id);
    const owned = st === 'player', allied = st === 'allied';
    let body = (node.identity ? `<div class="np-identity">${esc(node.identity.title)}</div>` : '') + `<p class="np-desc">${esc(node.desc)}</p><div class="np-facts">`;
    const prod = nodeProd(node);
    if ((owned || allied) && !node.identity && Object.keys(prod).length) {
        body += `<div class="fact">${ic('coins')}<span class="fact-l">Rapporte chaque tour</span>${fxHtml(prod)}</div>`;
    }
    if (node.cache && !m.cacheLooted[id] && !owned) {
        body += `<div class="fact">${ic('package')}<span class="fact-l">Cache à piller</span>${fxHtml(node.cache)}</div>`;
    }
    const threat = nextThreatAt(m, id);
    if (threat) {
        const pv = getForcePreview(threat.budget, threat.seed);
        body += `<div class="fact threat">${ic('warning-diamond')}<span class="fact-l">Attaque dans ${threat.arrivesIn} tour(s)</span>${forceHtml(pv)}</div>`;
    }
    if (!owned && !allied && !(node.identity && m.owner[id] === 'neutral')) {
        const pv = getForcePreview(garrisonBudgetFor(node), garrisonSeed(id));
        body += `<div class="fact">${ic('shield-warning')}<span class="fact-l">${glossText('Garnison estimée')}</span>${forceHtml(pv)}</div>`;
        if (m.fallenAllies[id]) body += `<div class="fact">${ic('handshake')}<span class="fact-l">Ancienne alliée occupée : la reprendre la libère et renoue l'alliance</span></div>`;
    }
    if (owned) {
        const g = m.garrisons[id] || [];
        const rl = rampartLevel(id);
        if (rl) body += `<div class="fact">${ic('castle-turret')}<span class="fact-l">${glossText('Remparts niveau ' + rl + ' : +' + rl * BALANCE.rampartDef + ' DEF permanente')}</span></div>`;
        body += `<div class="fact">${ic('users-three')}<span class="fact-l">${glossText('Garnison')}</span><span class="force">${g.length ? g.length + ' unité(s)' : '<span style="color:var(--danger)">aucune</span>'}</span></div>`;
    }
    if (node.type === 'home') {
        const decs = Object.entries(DECISIONS).filter(([f, d]) => state.flags[f] && d.desc);
        body += `<div class="fact">${ic('brain')}<span class="fact-l">Confiance en PROMETHEUS</span><span class="force">${iaTrust(state)}/6</span></div>`;
        decs.forEach(([, d]) => body += `<div class="fact">${ic('seal-check')}<span class="fact-l">${richText(d.desc)}</span></div>`);
        body += `<button class="btn btn-ghost btn-block" style="margin-top:2px" onclick="setCenterView('base')">${ic('sign-in')}Entrer dans le dôme</button>`;
    }
    if (m.armyAt === id && !m.armyDest) {
        body += `<div class="fact">${ic('flag-banner')}<span class="fact-l">Votre armée stationne ici</span><button class="btn btn-ghost" style="min-height:28px;padding:0 10px" onclick="toggleDrawer('army')">Gérer</button></div>`;
    }
    body += '</div>';
    const linked = m.armyAt ? linkTurns(m.armyAt, id) : null;
    const canMarch = linked && !m.armyDest;
    const noArmy = !state.army.length;
    const action = (icon, label, fn, reason, extra = '') => `<button class="btn btn-primary" ${reason ? 'disabled' : ''} data-tt="${esc(reason)}" onclick="${fn}"><span class="lbl">${ic(icon)}${label}</span><span class="cost">${extra}${cmdChip()}</span></button>`;
    const neutralCity = node.type === 'city' && m.owner[id] === 'neutral' && !allied;
    if (node.identity) body += cityCards(node, st, neutralCity ? {
        take: canMarch ? action('sword', 'Préparer l\'assaut', `openAssault('${id}')`, noArmy ? 'Votre armée est vide' : blockReason(null, true), `<span>${ic('hourglass-medium')}${linked}</span>`) : '',
        ally: allyAction(node, action)
    } : {});
    body += '<div class="np-actions">';
    if (owned) {
        const lvl = rampartLevel(id), rc = rampartCost(id);
        if (rc !== null) {
            const short = (state.resources.materials || 0) < rc;
            body += action('castle-turret', `Remparts niv. ${lvl + 1}`, `buildRampart('${id}')`, blockReason(null, true) || (short ? 'Matériaux insuffisants' : ''), `<span class="${short ? 'short' : ''}">${resIcon('materials')}${rc}</span>`);
        }
    }
    if (owned && !m.fortified[id]) {
        body += action('wall', 'Fortifier', `fortifyNode('${id}')`, blockReason(null, true), '<span>+' + BALANCE.fortifyDef + ' DEF</span>');
    } else if (owned && m.fortified[id]) {
        body += `<div class="fact">${ic('wall')}<span class="fact-l">${glossText('Fortifié : +' + BALANCE.fortifyDef + ' DEF au prochain combat')}</span></div>`;
    }
    if (st === 'hostile' && canMarch) {
        body += action('sword', 'Préparer l\'assaut', `openAssault('${id}')`, noArmy ? 'Votre armée est vide' : blockReason(null, true), `<span>${ic('hourglass-medium')}${linked}</span>`);
    }
    if ((owned || allied) && canMarch && m.armyAt !== id) {
        body += action('path', 'Déplacer l\'armée ici', `moveArmy('${id}')`, noArmy ? 'Votre armée est vide' : blockReason(null, true), `<span>${ic('hourglass-medium')}${linked}</span>`);
    }
    body += '</div>';
    if (m.armyDest) body += `<div class="np-hint">${ic('info')}L'armée est en marche, aucun nouvel ordre possible.</div>`;
    else if (m.armyAt && m.armyAt !== id && !linked) body += `<div class="np-hint">${ic('info')}Aucune route directe depuis ${esc(getNode(m.armyAt).name)}.</div>`;
    else if (linked) body += `<div class="np-hint">${ic('path')}À ${linked} tour(s) de marche de votre armée.</div>`;

    el.style.setProperty('--st', `var(--st-${st})`);
    el.innerHTML = `<div class="np-banner"><span class="np-glyph">${ic(ICONS.node[node.type])}</span><span class="flag">${STATUS_LABEL[st]}</span><h2>${esc(node.name)}</h2><div class="eyebrow" style="color:var(--text-2)">${TYPE_LABEL[node.type]}</div><button class="dr-close" style="position:absolute;top:14px;right:14px" onclick="closeNodePanel()" aria-label="Fermer">${ic('x')}</button></div><div class="dr-body">${body}</div>`;
}

function allyAction(node, action) {
    const cost = getAllyCost(node);
    const short = (state.resources.influence || 0) < cost;
    const r = blockReason(null, true) || (short ? 'Influence insuffisante' : '');
    return action('handshake', 'Proposer une alliance', `allyCity('${node.id}')`, r, `<span class="${short ? 'short' : ''}">${resIcon('influence')}${cost}</span>`);
}

function cityCard(kind, d, opts) {
    const label = kind === 'take' ? 'Prendre' : 'S\'allier';
    const flag = opts.active ? '<span class="cc-flag">Actif</span>' : '';
    const extra = opts.extra || '';
    const note = opts.note ? `<div class="cc-note">${ic(opts.noteIcon || 'info')}<span>${glossText(opts.note)}</span></div>` : '';
    return `<div class="city-card ${kind}${opts.active ? ' active' : ''}${opts.dim ? ' dim' : ''}"><div class="cc-head"><span class="cc-kind">${ic(kind === 'take' ? 'sword' : 'handshake')}${label}</span><span class="cc-prod" data-tt="${tt('Chaque tour', 'Production de la cité tant que ce statut dure')}">${fxHtml(d.prod)}</span></div><div class="cc-name">${esc(d.name)}${flag}</div><div class="cc-line" data-tt="${tt(esc(d.name), richText(d.help))}">${ic('seal-check')}<span class="cc-l">${glossText(richText(d.desc.charAt(0).toUpperCase() + d.desc.slice(1)))}</span></div>${extra}${note}${opts.action || ''}</div>`;
}

function cityCards(node, st, actions) {
    const m = state.map, idt = node.identity;
    const takeNote = `Occupation : −${BALANCE.cityConquestStability}${resIcon('stability')} −${BALANCE.cityConquestInfluence}${resIcon('influence')}, puis −${BALANCE.occupationStability}${resIcon('stability')} par tour`;
    const allyNote = 'Se défend seule, mais peut tomber';
    if (st === 'player') return cityCard('take', idt.conquest, {active: true});
    if (st === 'allied') return cityCard('ally', idt.alliance, {active: true});
    if (m.fallenAllies[node.id]) return cityCard('ally', idt.alliance, {dim: true, note: 'Reprenez-la pour rétablir ce pacte.', noteIcon: 'arrow-counter-clockwise'});
    if (m.lost[node.id]) return cityCard('take', idt.conquest, {dim: true, note: 'Reprenez-la pour rétablir cet atout.', noteIcon: 'arrow-counter-clockwise'});
    const garrison = `<div class="cc-line">${ic('shield-warning')}<span class="cc-l">${term('garnisonAdverse', 'Garnison')}</span>${forceHtml(getForcePreview(garrisonBudgetFor(node), garrisonSeed(node.id)))}</div>`;
    return `<div class="city-cards">${cityCard('take', idt.conquest, {extra: garrison, note: takeNote, noteIcon: 'warning', action: actions.take})}${cityCard('ally', idt.alliance, {note: allyNote, action: actions.ally})}</div>`;
}

function scaledProd(prod, lvl) {
    return Object.fromEntries(Object.entries(prod).map(([k, v]) => [k, v * lvl]));
}

function renderBasePanel(el) {
    const isCore = selectedBase === 'core';
    const b = isCore ? null : BUILDINGS.find(x => x.id === selectedBase);
    const open = isCore || (!!b && isBuilt(b.id));
    el.classList.toggle('open', open);
    if (!open) {
        selectedBase = null;
        return;
    }
    const lvl = isCore ? state.core : getBuildingLevel(b.id);
    const max = isCore ? 3 : BALANCE.maxBuildingLevel;
    const cost = isCore ? getCoreUpgradeCost() : getUpgradeCost(b.id);
    const pips = `<span class="lvl">${Array.from({length: max}, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>`;
    let body = `<p class="np-desc">${isCore ? `Le cœur d'Alpha-7, siège de PROMETHEUS. Chaque éveil ajoute ${BALANCE.armyCapPerCore} places à l'armée et ouvre un palier de recherche.` : richText(b.desc)}</p><div class="np-facts">`;
    body += `<div class="fact">${ic('stack')}<span class="fact-l">Niveau ${lvl} sur ${max}</span>${pips}</div>`;
    if (b && b.prod && Object.keys(b.prod).length) {
        body += `<div class="fact">${ic('coins')}<span class="fact-l">Produit chaque tour</span>${fxHtml(scaledProd(b.prod, lvl))}</div>`;
        if (cost) body += `<div class="fact">${ic('trend-up')}<span class="fact-l">Au niveau ${lvl + 1}</span>${fxHtml(scaledProd(b.prod, lvl + 1))}</div>`;
    }
    if (isCore && cost) body += `<div class="fact">${ic('trend-up')}<span class="fact-l">Au niveau ${lvl + 1}</span><span class="force">+${BALANCE.armyCapPerCore} armée max · palier ${roman(lvl + 1)}</span></div>`;
    body += '</div><div class="np-actions">';
    if (cost) {
        const reason = blockReason(cost, true);
        body += `<button class="btn btn-primary" ${reason ? 'disabled' : ''} data-tt="${esc(reason)}" onclick="${isCore ? 'upgradeCore()' : `upgradeBuilding('${b.id}')`}"><span class="lbl">${ic('arrow-up')}${isCore ? 'Éveiller' : 'Améliorer'}</span><span class="cost">${costSpans(cost)}${cmdChip()}</span></button>`;
    } else {
        body += `<div class="fact">${ic('seal-check')}<span class="fact-l">Niveau maximum atteint</span></div>`;
    }
    if (b && b.id === 'centreDonnees') {
        const used = state.refineTurn === state.turn;
        const reason = used ? 'Déjà raffiné ce tour' : blockReason({materials: BALANCE.refineCost}, true);
        body += `<button class="btn btn-primary" ${reason ? 'disabled' : ''} data-tt="${tt('Raffiner les données', richText(GLOSSARY.raffiner.text))}" onclick="refineData()"><span class="lbl">${ic('flask')}Raffiner · +${refineGain()}${resIcon('data')}</span><span class="cost">${costSpans({materials: BALANCE.refineCost})}${cmdChip()}</span></button>`;
    }
    body += '</div>';
    el.style.setProperty('--st', 'var(--st-player)');
    el.innerHTML = `<div class="np-banner"><span class="np-glyph">${ic(isCore ? 'cpu' : ICONS.building[b.id] || 'cube')}</span><span class="flag">Alpha-7</span><h2>${esc(isCore ? 'Cœur de PROMETHEUS' : b.name)}</h2><div class="eyebrow" style="color:var(--text-2)">${isCore ? 'Cœur du dôme' : 'Bâtiment · ' + chapterTitle(CHAPTERS[b.chapter - 1])}</div><button class="dr-close" style="position:absolute;top:14px;right:14px" onclick="closeNodePanel()" aria-label="Fermer">${ic('x')}</button></div><div class="dr-body">${body}</div>`;
}

const RETREAT_OPTIONS = [[0, 'Jusqu\'au bout', 'Le combat continue jusqu\'au dernier soldat'], [0.35, 'Prudent', 'Repli quand l\'armée perd 65 % de ses PV'], [0.6, 'Très prudent', 'Repli dès 40 % de PV perdus']];
let assaultPlan = null;
const oddsCache = new Map();

function oddsPct(x) {
    return Math.round(x * 100) + ' %';
}

function oddsClass(x) {
    return x >= 0.75 ? 'good' : x >= 0.4 ? 'mid' : 'bad';
}

function openAssault(id) {
    assaultPlan = {dest: id, leave: new Set()};
    renderAssault();
    openConfirm(null, closeAssault);
    guideUpdate();
}

function closeAssault() {
    assaultPlan = null;
    closeConfirm();
    guideUpdate();
}

function toggleEngage(i) {
    if (!assaultPlan) return;
    if (assaultPlan.leave.has(i)) assaultPlan.leave.delete(i);
    else if (assaultPlan.leave.size < state.army.length - 1) assaultPlan.leave.add(i);
    renderAssault();
}

function pickRetreat(v) {
    setRetreat(v);
    renderAssault();
}

function launchAssault() {
    if (!assaultPlan) return;
    const plan = assaultPlan;
    closeAssault();
    attackNode(plan.dest, [...plan.leave]);
}

function renderAssault() {
    const ov = document.getElementById('confirm-overlay');
    const m = state.map, node = getNode(assaultPlan.dest);
    const eta = linkTurns(m.armyAt, node.id);
    const canLeave = m.owner[m.armyAt] === 'player';
    const engaged = state.army.filter((_, i) => !assaultPlan.leave.has(i));
    const defenders = generateForce(garrisonBudgetFor(node, state.turn + eta - 1), garrisonSeed(node.id));
    const est = estimateBattle(assaultUnits(node.id, engaged), defenders, BALANCE.estimateRuns, {retreatAt: state.retreatAt});
    const lose = Math.max(0, 1 - est.win - est.retreat);
    const rows = state.army.map((id, i) => {
        const u = getUnit(id);
        const on = !assaultPlan.leave.has(i);
        const btn = canLeave ? `<button class="btn btn-ghost engage${on ? ' on' : ''}" onclick="toggleEngage(${i})">${on ? ic('sword') + 'Engagée' : ic('shield') + 'Reste'}</button>` : '';
        return `<div class="row${on ? '' : ' off'}"><div class="crest">${ic(ICONS.unit[u.id])}</div><div class="row-main"><div class="row-title">${esc(u.name)}</div><div class="row-meta">${statsHtmlUnit(u)}</div></div>${btn}</div>`;
    }).join('');
    const heroes = buildHeroUnits().map(h => `<span class="tag">${esc(h.name)}</span>`).join(' ');
    const seg = RETREAT_OPTIONS.map(([v, l, tt]) => `<button class="speed-btn${state.retreatAt === v ? ' active' : ''}" data-tt="${esc(tt)}" onclick="pickRetreat(${v})">${l}</button>`).join('');
    ov.innerHTML = `<div class="confirm-box assault-box plate" role="dialog" aria-labelledby="as-title"><div class="eyebrow">Préparer l'assaut · arrivée dans ${eta} tour(s)</div><h2 id="as-title">${esc(node.name)}</h2><div class="rule"></div>`
        + `<div class="odds"><div class="odd ${oddsClass(est.win)}"><b>${oddsPct(est.win)}</b><span>Victoire</span></div><div class="odd"><b>${oddsPct(est.retreat)}</b><span>Repli</span></div><div class="odd ${lose > 0.25 ? 'bad' : ''}"><b>${oddsPct(lose)}</b><span>Armée perdue</span></div></div>`
        + `<div class="fact">${ic('shield-warning')}<span class="fact-l">${glossText('Garnison à l\'arrivée')}</span>${forceHtml(forceCounts(defenders))}</div>`
        + `<div class="sec-label">Unités engagées<span class="count">${engaged.length} / ${state.army.length}</span></div>${canLeave ? '' : `<div class="np-hint">${ic('info')}Hors d'un territoire à vous, toute l'armée marche.</div>`}<div class="assault-units">${rows}</div>`
        + (heroes ? `<div class="fact">${ic('star-four')}<span class="fact-l">Héros présents</span>${heroes}</div>` : '')
        + `<div class="sec-label">Consigne de repli</div><div class="seg">${seg}</div>`
        + `<div class="confirm-actions"><button class="btn btn-ghost" onclick="closeAssault()">Annuler</button><button class="btn btn-primary" onclick="launchAssault()" ${state.command < 1 ? 'disabled' : ''}>${ic('sword')}Lancer l'assaut ${cmdChip()}</button></div></div>`;
}

function defenseOdds(t) {
    const units = defenseUnits(t.nodeId);
    if (!units.length) return null;
    const key = [state.turn, t.nodeId, t.seed, t.budget, state.retreatAt, JSON.stringify(units.map(u => [u.id, u.hp, u.atk, u.def]))].join('|');
    if (!oddsCache.has(key)) {
        if (oddsCache.size > 50) oddsCache.clear();
        oddsCache.set(key, estimateBattle(units, generateForce(t.budget, t.seed), 60).win);
    }
    return oddsCache.get(key);
}

function forceHtml(preview) {
    return '<span class="force">' + preview.map(e => `<span>${e.count} ${esc(e.name)}</span>`).join('') + '</span>';
}

function renderThreats() {
    const list = [...state.map.threats].sort((a, b) => a.arrivesIn - b.arrivesIn);
    document.getElementById('threats').innerHTML = list.map(t => {
        const n = getNode(t.nodeId);
        const units = getForcePreview(t.budget, t.seed).reduce((s, e) => s + e.count, 0);
        const own = state.map.owner[t.nodeId] === 'player';
        const odds = own ? defenseOdds(t) : null;
        const oddsTxt = own ? ` · <span class="odds-inline ${oddsClass(odds)}">${odds === null ? 'sans défense' : oddsPct(odds) + ' de tenir'}</span>` : '';
        const danger = own && (odds === null || odds < 0.6);
        const i = state.map.threats.indexOf(t);
        const truce = resShown('influence') && (own || t.nodeId === 'alpha7' || state.map.allied[t.nodeId]) && !t.delayed ? `<button class="threat-truce" ${canTruce(t) ? '' : 'disabled'} onclick="negotiateTruce(${i})" data-tt="${tt('Négocier un répit', richText(GLOSSARY.repit.text) + '<br>Coût <span>' + BALANCE.truceCost + '🌐</span>')}" aria-label="Négocier un répit">${ic('handshake')}<span>+1 tour</span></button>` : '';
        return `<div class="threat-wrap"><button class="threat-card${t.arrivesIn <= 1 ? ' imminent' : ''}${danger ? ' danger' : ''}" onclick="focusThreat('${t.nodeId}')" data-tt="${esc('Voir ' + n.name + (own ? ' — chances estimées avec la garnison actuelle' : ''))}"><span class="t-eta"><span>${t.arrivesIn}</span></span><span><span class="t-name">${esc(n.name)}</span><br><span class="t-sub">${units} assaillants · ${t.arrivesIn > 1 ? 'dans ' + t.arrivesIn + ' tours' : 'au prochain tour'}${t.delayed ? ' · répit obtenu' : ''}${oddsTxt}</span></span></button>${truce}</div>`;
    }).join('');
}

function renderEndTurn() {
    const b = document.getElementById('btn-endturn');
    b.classList.toggle('ready', state.command === 0);
    b.innerHTML = `<span class="et-inner">${ic('sun-horizon')}<span class="et-label">Fin du tour</span><span class="et-num">${state.turn} → ${state.turn + 1}</span></span>`;
}

function fallingNext() {
    return state.map.threats.filter(t => t.arrivesIn <= 1 && state.map.owner[t.nodeId] === 'player').map(t => ({t, odds: defenseOdds(t)})).filter(x => x.odds === null || x.odds < 0.5);
}

function requestEndTurn(skipDanger) {
    if (state.phase !== 'build' || endTurnBusy || dayVeilBusy) return;
    const falling = skipDanger ? [] : fallingNext();
    if (falling.length) return showDangerConfirm(falling);
    if (state.command > 0 && !state.skipEndConfirm) return showEndTurnConfirm();
    passDay();
}

function showDangerConfirm(falling) {
    const home = falling.some(x => x.t.nodeId === 'alpha7');
    const rows = falling.map(({t, odds}) => `<div class="fact threat">${ic('warning-diamond')}<span class="fact-l">${esc(getNode(t.nodeId).name)}</span><span class="force">${odds === null ? 'sans défense' : oddsPct(odds) + ' de tenir'}</span></div>`).join('');
    const msg = home ? 'Si Alpha-7 tombe, la partie est perdue. Placez des unités en garnison, ramenez l\'armée ou fortifiez avant de finir le tour.' : 'Ces territoires seront attaqués au prochain tour et risquent de tomber. Une garnison, l\'armée ou une fortification peuvent encore changer l\'issue.';
    openConfirm(`<div class="confirm-box plate danger" role="alertdialog" aria-labelledby="cf-title"><div class="eyebrow">Fin du tour ${state.turn}</div><h2 id="cf-title">${home ? 'Alpha-7 est en danger' : 'Une colonie va tomber'}</h2><div class="rule"></div><p>${glossText(msg)}</p>${rows}<div class="confirm-actions"><button class="btn btn-primary" onclick="closeConfirm()">${ic('arrow-left')}Revenir aux ordres</button><button class="btn btn-ghost" onclick="closeConfirm(); requestEndTurn(true)">${ic('sun-horizon')}Finir quand même</button></div></div>`).querySelector('.btn-primary').focus();
}

function showEndTurnConfirm() {
    const n = state.command;
    openConfirm(`<div class="confirm-box plate" role="alertdialog" aria-labelledby="cf-title"><div class="eyebrow">Fin du tour ${state.turn}</div><h2 id="cf-title">Des ordres restent à donner</h2><div class="rule"></div><p>Les points de commandement ne se cumulent pas : ceux qui ne sont pas utilisés sont perdus à la fin du tour.</p><div class="fact">${ic('diamond')}<span class="fact-l">${n} point${n > 1 ? 's' : ''} de commandement inutilisé${n > 1 ? 's' : ''}</span><span class="force">sur ${getCommandMax()}</span></div><label class="ask-again"><input type="checkbox" id="cf-skip"><span>Ne plus me demander pendant cette campagne</span></label><div class="confirm-actions"><button class="btn btn-primary" onclick="closeConfirm()">${ic('arrow-left')}Revenir aux ordres</button><button class="btn btn-ghost" onclick="confirmEndTurn()">${ic('sun-horizon')}Finir le tour</button></div></div>`).querySelector('.btn-primary').focus();
}

function confirmEndTurn() {
    const skip = document.getElementById('cf-skip');
    if (skip && skip.checked) state.skipEndConfirm = true;
    closeConfirm();
    passDay();
}

function prefGet(key, fallback = null) {
    try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
    } catch (e) {
        return fallback;
    }
}

function prefSet(key, v) {
    try {
        localStorage.setItem(key, v);
    } catch (e) {
    }
}

function syncSwitch(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('on', on);
    el.setAttribute('aria-checked', on ? 'true' : 'false');
}

let dayVeilBusy = false;

function passDay() {
    if (state.phase !== 'build' || endTurnBusy || dayVeilBusy) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return endTurn();
    dayVeilBusy = true;
    const veil = document.getElementById('day-veil');
    veil.innerHTML = `<div class="dv-inner"><div class="dv-sun">${ic('sun-horizon')}</div><div class="eyebrow">Une nuit passe sur l'Europe</div><div class="dv-turns"><span class="dv-old">${state.turn}</span><span class="dv-new">${state.turn + 1}</span></div><div class="dv-label">Tour</div><div class="rule"></div></div>`;
    veil.classList.remove('out');
    veil.classList.add('on');
    if (window.Map3D) Map3D.passDay(1900);
    setTimeout(() => {
        endTurn();
        veil.classList.add('out');
        setTimeout(() => {
            veil.classList.remove('on', 'out');
            veil.innerHTML = '';
            dayVeilBusy = false;
        }, 700);
    }, 1150);
}

function toast(text, kind = '') {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = ic(ICONS.toast[kind] || 'info') + '<span>' + richText(text) + '</span>';
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => {
        t.classList.add('out');
        setTimeout(() => t.remove(), 400);
    }, 3200);
}

function renderBattle() {
    if (!battleState) return;
    if (window.Map3D) Map3D.stop();
    if (window.Base3D) Base3D.stop();
    gt.el && gt.el.classList.remove('visible');
    const sum = (list, k) => list.reduce((s, u) => s + Math.max(0, u[k]), 0);
    const bar = (cls, label, list) => {
        const hp = sum(list, 'hp'), max = sum(list, 'maxHp') || 1;
        const alive = list.filter(u => u.hp > 0).length;
        return `<div class="force-bar ${cls}"><div class="fb-head"><span>${label}</span><b>${alive} / ${list.length}</b></div><div class="fb-track"><div class="fb-fill" style="width:${hp / max * 100}%"></div></div></div>`;
    };
    document.getElementById('battle-top').innerHTML = bar('ally', 'Vos forces', battleState.player)
        + `<div id="battle-round" class="plate"><small>Round</small>${battleState.round || '—'}</div>`
        + bar('enemy', 'Ennemis', battleState.enemy);
    const blog = document.getElementById('blog');
    blog.innerHTML = battleState.log.slice(-30).map(e => `<div class="bl-entry ${e.type}">${richText(e.text)}</div>`).join('');
    blog.scrollTop = blog.scrollHeight;
    if (battleState.mode === '3d') {
        setStageView('battle3d-view');
        return;
    }
    setStageView('battle2d');
    document.getElementById('battle2d').innerHTML = '<div class="bf-side">' + battleState.player.map(unitCardHtml).join('') + '</div><div></div><div class="bf-side">' + battleState.enemy.map(unitCardHtml).join('') + '</div>';
}

function unitCardHtml(u) {
    const pct = u.maxHp > 0 ? Math.max(0, u.hp / u.maxHp * 100) : 0;
    const hpCls = pct > 50 ? '' : pct > 25 ? 'mid' : 'low';
    return `<div class="unit-card${u.hp <= 0 ? ' dead' : ''}" data-uid="${u.uid}"><div class="uc-top"><span>${esc(u.name)}</span><span>${Math.max(0, u.hp)}/${u.maxHp}</span></div><div class="hp-bar"><div class="hp-fill ${hpCls}" style="width:${pct}%"></div></div><div class="uc-stats">ATK ${u.atk} · DEF ${u.def} · VIT ${u.spd}</div></div>`;
}

function toggleResearch() {
    const overlay = document.getElementById('research-overlay');
    overlay.classList.toggle('active');
    if (overlay.classList.contains('active')) renderResearch();
    guideUpdate();
}

function renderResearch() {
    const overlay = document.getElementById('research-overlay');
    if (!overlay.classList.contains('active')) return;
    overlay.onclick = e => {
        if (e.target === overlay) toggleResearch();
    };
    const cols = ['DOCTRINE', 'GUERRE', 'SINGULARITE'].map(bk => {
        const meta = RESEARCH_BRANCHES[bk];
        const items = RESEARCH.filter(r => r.branch === bk).sort((a, b) => a.tier - b.tier);
        let col = `<div class="rs-branch" style="--bc:${BRANCH_COLOR[bk]}"><div class="rs-branch-head"><div class="crest">${ic(ICONS.branch[bk])}</div><div><h3>${esc(meta.name)}</h3><p>${esc(meta.desc)}</p></div></div>`;
        [1, 2, 3].forEach(tier => {
            const tierItems = items.filter(r => r.tier === tier);
            if (!tierItems.length) return;
            const open = tier <= state.core;
            col += `<div class="rs-tier${open ? ' open' : ''}">PALIER ${roman(tier)}${open ? '' : `<span class="tag warn">Cœur ${tier} requis</span>`}</div><div class="rs-nodes">`;
            tierItems.forEach(r => {
                const done = hasResearch(r.id);
                let cls = 'rs-item', foot;
                if (done) {
                    cls += ' done';
                    foot = '<span class="tag">Acquis</span>';
                } else if (canResearch(r)) {
                    cls += ' avail';
                    const reason = blockReason(r.cost, true);
                    foot = `${costHtml(r.cost)}<button class="btn btn-primary" ${reason ? 'disabled' : ''} data-tt="${esc(reason)}" onclick="doResearch('${r.id}')">Étudier ${cmdChip()}</button>`;
                } else {
                    cls += ' locked';
                    let reason;
                    if (r.tier > state.core) reason = 'Cœur niveau ' + r.tier + ' requis';
                    else {
                        const mr = RESEARCH.find(x => x.id === r.requires.find(id => !hasResearch(id)));
                        reason = mr ? 'Après : ' + mr.name : 'Indisponible';
                    }
                    foot = `<span class="req">${ic('lock-simple')}${esc(reason)}</span>${costHtml(r.cost)}`;
                }
                col += `<div class="${cls}"><div class="rs-name"><span>${esc(r.name)}</span>${done ? `<span class="done-mark">${ic('seal-check')}</span>` : ''}</div><div class="rs-desc">${richText(r.desc)}</div><div class="rs-foot">${foot}</div></div>`;
            });
            col += '</div>';
        });
        return col + '</div>';
    }).join('');
    overlay.innerHTML = `<div id="research-modal" class="plate"><div class="dr-head"><div><div class="eyebrow">Savoir · Cœur niveau ${state.core}</div><h2>Cortex de PROMETHEUS</h2></div><button class="dr-close" onclick="toggleResearch()" aria-label="Fermer">${ic('x')}</button></div><div class="rs-cols">${cols}</div></div>`;
}

function timeAgo(ts) {
    if (!ts) return '';
    const min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return 'à l\'instant';
    if (min < 60) return 'il y a ' + min + ' min';
    const h = Math.round(min / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    const d = Math.round(h / 24);
    return 'il y a ' + d + ' jour' + (d > 1 ? 's' : '');
}

function saveSummary(s) {
    const ch = CHAPTERS[(s.chapter || 1) - 1] || CHAPTERS[0];
    return `Tour ${s.turn || 1} · Chapitre ${roman(ch.num)} · ${chapterTitle(ch)}`;
}

function renderSaveInfo(s) {
    const el = document.getElementById('save-info');
    if (!el) return;
    if (!s) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = `${ic('floppy-disk')}<span><b>Campagne en cours</b> · ${saveSummary(s)}<small>${s.savedAt ? 'Sauvegardée ' + timeAgo(s.savedAt) + ' sur ce navigateur' : 'Sauvegardée sur ce navigateur'}</small></span>`;
}

function showNewGameConfirm(s) {
    openConfirm(`<div class="confirm-box plate" role="alertdialog" aria-labelledby="cf-title"><div class="eyebrow">Nouvelle campagne</div><h2 id="cf-title">Abandonner la campagne en cours ?</h2><div class="rule"></div><p>Il n'existe qu'une sauvegarde. Commencer une nouvelle campagne effacera définitivement celle-ci :</p><div class="fact">${ic('floppy-disk')}<span class="fact-l">${saveSummary(s)}</span><span class="force">${s.savedAt ? timeAgo(s.savedAt) : ''}</span></div><div class="confirm-actions"><button class="btn btn-primary" onclick="closeConfirm();continueGame()">${ic('play')}Reprendre</button><button class="btn btn-danger" onclick="closeConfirm();newGame()">${ic('warning')}Tout effacer</button></div></div>`).querySelector('.btn-primary').focus();
}

let confirmDismiss = closeConfirm;

function openConfirm(html, onDismiss = closeConfirm) {
    const ov = document.getElementById('confirm-overlay');
    if (html) ov.innerHTML = html;
    confirmDismiss = onDismiss;
    ov.onclick = e => {
        if (e.target === ov) confirmDismiss();
    };
    ov.classList.add('active');
    return ov;
}

function closeConfirm() {
    const ov = document.getElementById('confirm-overlay');
    ov.classList.remove('active');
    ov.innerHTML = '';
}

let savedTimer = null;

function flashSaved() {
    const el = document.getElementById('save-flag');
    if (!el || !document.getElementById('game-screen').classList.contains('active')) return;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

const DIFF_KEY = 'pe2147_diff';

function difficultyPref() {
    const v = prefGet(DIFF_KEY);
    return DIFFICULTIES[v] ? v : 'normal';
}

function difficultyInit() {
    const el = document.getElementById('opt-diff');
    if (!el) return;
    const cur = difficultyPref();
    el.innerHTML = Object.entries(DIFFICULTIES).map(([k, d]) => `<button class="speed-btn${k === cur ? ' active' : ''}" onclick="pickDifficulty('${k}')">${d.label}</button>`).join('');
    document.getElementById('opt-diff-desc').textContent = DIFFICULTIES[cur].desc;
}

function pickDifficulty(k) {
    prefSet(DIFF_KEY, k);
    difficultyInit();
    Sfx.play('click');
}

function soundInit() {
    const b = document.getElementById('btn-sound');
    if (!b) return;
    const on = Sfx.isOn();
    b.classList.toggle('muted', !on);
    b.querySelector('i').className = 'ph-duotone ' + (on ? 'ph-speaker-high' : 'ph-speaker-slash');
    b.setAttribute('data-tt', on ? 'Couper le son' : 'Activer le son');
}

function toggleSound() {
    Sfx.toggle();
    soundInit();
    Sfx.play('click');
}
