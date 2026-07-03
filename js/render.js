let centerView = 'map';
let selectedNode = 'alpha7';
let mapLinksCache = null;

function render() {
    renderRes();
    if (state.phase === 'build') {
        renderBuildPhase();
    } else {
        renderBattle();
    }
    document.getElementById('btn-endturn').disabled = state.phase !== 'build';
    document.getElementById('btn-endturn').style.display = state.phase === 'build' ? '' : 'none';
    document.getElementById('btn-research').style.display = state.phase === 'build' ? '' : 'none';
}

const gt = { el: null };

function initTooltip() {
    gt.el = document.getElementById('g-tooltip');
    document.addEventListener('mouseover', e => {
        const wrap = e.target.closest('[data-tt]');
        if (!wrap) { gt.el.classList.remove('visible'); return; }
        gt.el.innerHTML = wrap.dataset.tt;
        gt.el.classList.add('visible');
        positionTooltip(wrap);
    });
    document.addEventListener('mouseout', e => {
        if (!e.target.closest('[data-tt]')) gt.el.classList.remove('visible');
    });
    document.addEventListener('mousemove', e => {
        if (!gt.el.classList.contains('visible')) return;
        const wrap = e.target.closest('[data-tt]');
        if (wrap) positionTooltip(wrap);
    });
}

function positionTooltip(el) {
    const r = el.getBoundingClientRect();
    const tw = gt.el.offsetWidth, th = gt.el.offsetHeight;
    let top = r.bottom + 8;
    let left = r.left + r.width / 2 - tw / 2;
    if (top + th > window.innerHeight - 8) top = r.top - th - 8;
    if (left < 8) left = 8;
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    gt.el.style.top = top + 'px';
    gt.el.style.left = left + 'px';
}

function unitTtData(u) {
    const specials = [];
    if (u.heals) specials.push('Régénère <span>' + u.heals + ' PV</span>/tour');
    if (u.dodge) specials.push('Esquive <span>' + (u.dodge * 100) + '%</span> des attaques');
    if (u.frontline) specials.push('Ligne avant');
    if (!u.frontline) specials.push('Ligne arrière — passe la ligne si <span>SPD ≥ 6</span>');
    if (u.size > 1) specials.push('Occupe <span>' + u.size + '</span> slots d\'armée');
    return '<div class="tt-title">' + u.icon + ' ' + u.name + '</div>'
        + '<div class="tt-row">PV <span>' + u.hp + '</span> · ATK <span>' + u.atk + '</span> · DEF <span>' + u.def + '</span> · SPD <span>' + u.spd + '</span></div>'
        + (specials.length ? '<div class="tt-row" style="margin-top:5px">' + specials.join('<br>') + '</div>' : '');
}

function renderRes() {
    const bar = document.getElementById('resource-bar');
    const prod = getProduction();
    let html = '';
    for (const [k, meta] of Object.entries(RES_META)) {
        const v = state.resources[k];
        const p = prod[k] + (k === 'stability' ? (v > 40 ? -1 : v < 40 ? 1 : 0) : 0);
        const pc = p >= 0 ? 'pos' : 'neg';
        const critical = k === 'stability' && v <= 20;
        const ttContent = '<div class=&quot;tt-title&quot;>' + meta.icon + ' ' + meta.label + '</div>'
            + '<div class=&quot;tt-row&quot;>Valeur : <span>' + v + ' / ' + meta.max + '</span></div>'
            + '<div class=&quot;tt-row&quot;>Production : <span>' + (p >= 0 ? '+' : '') + p + ' / tour</span></div>'
            + (critical ? '<div class=&quot;tt-row&quot; style=&quot;color:var(--danger);margin-top:4px&quot;>⚠ Stabilité critique !</div>' : '');
        html += '<div class="res-item" data-tt="' + ttContent + '" style="border-color:' + (critical ? 'var(--danger)' : meta.color + '22') + '">'
            + '<span>' + meta.icon + '</span>'
            + ' <span class="res-val' + (critical ? ' stab-critical' : '') + '" style="color:' + meta.color + '">' + v + '</span>'
            + '<span style="color:var(--dim);font-size:.72rem">/' + meta.max + '</span>'
            + ' <span class="res-prod ' + pc + '">' + (p >= 0 ? '+' : '') + p + '/t</span>'
            + '</div>';
    }
    const cmdTt = '<div class=&quot;tt-title&quot;>Points de commandement</div><div class=&quot;tt-row&quot;>Chaque action stratégique (bâtir, améliorer, rechercher, déplacer, fortifier) coûte 1 point.<br>Réinitialisés chaque tour.</div>';
    html += '<div class="res-info">'
        + '<span>Tour ' + state.turn + '</span>'
        + '<span>' + CHAPTERS[state.chapter - 1].name + '</span>'
        + '<span>Armée: ' + getArmySize() + '/' + getArmyCap() + '</span>'
        + '<span class="' + (state.command === 0 ? 'cmd-zero' : '') + '" data-tt="' + cmdTt + '" style="display:flex;align-items:center;gap:2px;border-left:1px solid var(--gb);padding-left:16px;cursor:default">'
        + '⚡ CMD ' + state.command + '/' + getCommandMax()
        + '</span>'
        + '</div>';
    bar.innerHTML = html;
}

function setCenterView(v) {
    centerView = v;
    renderBuildPhase();
}

function buildMapSnapshot() {
    const m = state.map;
    const nodes = MAP_NODES.map(n => {
        const status = m.owner[n.id] === 'player' ? 'player' : (m.allied[n.id] ? 'allied' : m.owner[n.id]);
        const threat = m.threats.filter(t => t.nodeId === n.id).sort((a, b) => a.arrivesIn - b.arrivesIn)[0];
        return {
            id: n.id, name: n.name, icon: n.icon, x: n.pos.x, y: n.pos.y,
            status, selected: n.id === selectedNode,
            threat: threat ? threat.arrivesIn : null,
            tier: n.tier, type: n.type
        };
    });
    if (!mapLinksCache) {
        const seen = new Set();
        mapLinksCache = [];
        MAP_NODES.forEach(n => {
            n.links.forEach(l => {
                const key = [n.id, l.to].sort().join('|');
                if (seen.has(key)) return;
                seen.add(key);
                const other = getNode(l.to);
                if (!other) return;
                mapLinksCache.push({ax: n.pos.x, ay: n.pos.y, bx: other.pos.x, by: other.pos.y});
            });
        });
    }
    const links = mapLinksCache;
    let army = null;
    if (m.armyAt) {
        const n = getNode(m.armyAt);
        if (n) army = {x: n.pos.x, y: n.pos.y};
    } else if (m.armyDest) {
        const from = getNode(m.armyFrom);
        const dest = getNode(m.armyDest);
        if (from && dest) {
            const total = linkTurns(m.armyFrom, m.armyDest) || 1;
            const progress = Math.max(0, Math.min(1, 1 - m.armyEta / total));
            army = {fromX: from.pos.x, fromY: from.pos.y, toX: dest.pos.x, toY: dest.pos.y, progress};
        }
    }
    return {nodes, links, army};
}

function renderBuildPhase() {
    const lp = document.getElementById('left-panel');
    const coreCost = getCoreUpgradeCost();
    const coreDiamonds = [1, 2, 3].map(i => '<span style="opacity:' + (i <= state.core ? '1' : '0.3') + '">' + (i <= state.core ? '◆' : '◇') + '</span>').join('');
    let lhtml = '<div class="panel" id="core-panel"><h3>Cœur d\'Alpha-7</h3>'
        + '<div class="core-lvl">' + coreDiamonds + '</div>'
        + '<div class="core-desc">+2 armée max / niveau · niv. requis pour les recherches avancées</div>'
        + (coreCost
            ? '<div class="core-upgrade"><button ' + (canAfford(coreCost) ? '' : 'disabled') + ' onclick="upgradeCore()">Améliorer — ' + Object.entries(coreCost).map(([k, v]) => v + RES_META[k].icon).join(' ') + '</button></div>'
            : '<div class="core-max">NIVEAU MAX</div>')
        + '</div>';
    lhtml += '<div class="panel"><h3>Bâtiments</h3>';
    for (let ch = 1; ch <= 3; ch++) {
        const cb = BUILDINGS.filter(b => b.chapter === ch);
        lhtml += '<div style="font-size:.6rem;color:var(--dim);letter-spacing:.1em;margin:6px 0 3px;text-transform:uppercase">Ch.' + ch + ' — ' + CHAPTERS[ch - 1].name + '</div>';
        cb.forEach(b => {
            const built = isBuilt(b.id), locked = !isBuildingUnlocked(b), aff = canAfford(b.cost);
            const cls = built ? 'build-item built' : locked ? 'build-item locked' : 'build-item';
            const costStr = Object.entries(b.cost).map(([k, v]) => v + RES_META[k].icon).join(' ');
            let btn;
            if (built) {
                const lvl = getBuildingLevel(b.id);
                const upCost = getUpgradeCost(b.id);
                btn = '<div class="bi-lvl-wrap"><span class="bi-lvl">Nv.' + lvl + (upCost ? '' : ' MAX') + '</span>'
                    + (upCost
                        ? '<button class="bi-upgrade" data-tt="Améliorer → Nv.' + (lvl + 1) + '<br>' + Object.entries(upCost).map(([k, v]) => v + RES_META[k].icon).join(' ') + '<br>production ×' + (lvl + 1) + '" ' + (canAfford(upCost) ? '' : 'disabled') + ' onclick="upgradeBuilding(\'' + b.id + '\')">⬆</button>'
                        : '')
                    + '</div>';
            } else if (locked) {
                if (b.research && !hasResearch(b.research)) {
                    const r = RESEARCH.find(x => x.id === b.research);
                    btn = '<span data-tt="Requiert la recherche : ' + (r ? r.icon + ' ' + r.name : b.research) + '">🔬</span>';
                } else {
                    btn = '🔒';
                }
            } else {
                btn = '<div class="bi-btn"><button ' + (aff ? '' : 'disabled') + ' onclick="buildBuilding(\'' + b.id + '\')">Bâtir</button></div>';
            }
            lhtml += '<div class="' + cls + '"><div class="bi-icon">' + b.icon + '</div><div class="bi-info"><div class="bi-name">' + b.name + '</div><div class="bi-detail">' + costStr + ' — ' + b.desc + '</div></div>' + btn + '</div>';
        });
    }
    lhtml += '</div>';

    lhtml += '<div class="panel log-section"><h3>Journal</h3><div class="log-entries">';
    state.log.slice(-15).forEach(e => {
        lhtml += '<div class="log-entry ' + e.cls + '">' + e.text + '</div>';
    });
    lhtml += '</div></div>';
    lp.innerHTML = lhtml;
    const logEl = lp.querySelector('.log-entries');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;

    const cp = document.getElementById('center-panel');
    if (!document.getElementById('view-tabs')) {
        cp.innerHTML = '<div id="view-tabs">'
            + '<button id="tab-map" onclick="setCenterView(\'map\')">🗺️ CARTE</button>'
            + '<button id="tab-base" onclick="setCenterView(\'base\')">🏠 BASE</button>'
            + '</div>'
            + '<div id="base3d-wrap"><div id="base3d-view"></div><div id="base3d-hint">GLISSER POUR ORBITER · MOLETTE POUR ZOOMER</div></div>'
            + '<div id="map3d-wrap"><div id="map3d-view"></div></div>';
    }
    document.getElementById('tab-map').classList.toggle('active', centerView === 'map');
    document.getElementById('tab-base').classList.toggle('active', centerView === 'base');
    document.getElementById('base3d-wrap').style.display = centerView === 'base' ? 'block' : 'none';
    document.getElementById('map3d-wrap').style.display = centerView === 'map' ? 'block' : 'none';
    if (centerView === 'base') {
        if (window.Map3D) Map3D.stop();
        if (window.Base3D) {
            Base3D.mount(document.getElementById('base3d-view'));
            Base3D.sync(state.buildings, state.buildingLevels, state.core, state.research.map(id => (RESEARCH.find(r => r.id === id) || {}).branch));
        }
    } else {
        if (window.Base3D) Base3D.stop();
        if (window.Map3D) {
            Map3D.mount(document.getElementById('map3d-view'));
            Map3D.sync(buildMapSnapshot());
            Map3D.onSelect(id => { selectedNode = id; renderBuildPhase(); });
        }
    }

    const node = getNode(selectedNode);
    const nOwner = state.map.owner[selectedNode];
    const nAllied = state.map.allied[selectedNode];
    const nStatus = nOwner === 'player' ? 'player' : (nAllied ? 'allied' : nOwner);
    const statusLabel = {player: 'VÔTRE', allied: 'ALLIÉ', neutral: 'NEUTRE', hostile: 'HOSTILE'}[nStatus] || nStatus;
    let chtml = '<div class="panel node-panel"><h3>' + node.icon + ' ' + node.name + '</h3>'
        + '<div class="node-badge ' + nStatus + '">' + statusLabel + '</div>'
        + '<div class="node-desc">' + node.desc + '</div>';
    if (nOwner === 'player' || nAllied) {
        const prodStr = Object.entries(node.prod || {}).map(([k, v]) => '+' + v + RES_META[k].icon).join(' ');
        if (prodStr) chtml += '<div class="node-prod">' + prodStr + ' /tour</div>';
    }
    const nodeThreat = state.map.threats.filter(t => t.nodeId === selectedNode).sort((a, b) => a.arrivesIn - b.arrivesIn)[0];
    if (nodeThreat) {
        const preview = getForcePreview(nodeThreat.budget, nodeThreat.seed);
        chtml += '<div class="node-threat">⚠️ Menace dans ' + nodeThreat.arrivesIn + ' tour(s) — ' + preview.map(e => e.icon + '×' + e.count).join(' ') + '</div>';
    }
    if (nOwner !== 'player' && !nAllied) {
        const garrisonPreview = getForcePreview(garrisonBudgetFor(node), seedFor(selectedNode) + state.turn);
        chtml += '<div class="node-garrison">🛡️ Garnison estimée — ' + garrisonPreview.map(e => e.icon + '×' + e.count).join(' ') + '</div>';
    }
    const cmdBtnTt = '1 CMD';
    const linkedToArmy = state.map.armyAt ? linkTurns(state.map.armyAt, selectedNode) : null;
    chtml += '<div class="node-actions">';
    if (nOwner === 'player' && !state.map.fortified[selectedNode]) {
        chtml += '<button ' + (state.command < 1 ? 'disabled' : '') + ' data-tt="' + cmdBtnTt + '" onclick="fortifyNode(\'' + selectedNode + '\')">🧱 Fortifier</button>';
    }
    if (node.type === 'city' && nOwner === 'neutral' && !nAllied) {
        chtml += '<button ' + (state.command < 1 || (state.resources.influence || 0) < node.allyCost ? 'disabled' : '') + ' data-tt="' + cmdBtnTt + '" onclick="allyCity(\'' + selectedNode + '\')">🤝 Allier (' + node.allyCost + '🌐)</button>';
    }
    if (linkedToArmy && !state.map.armyDest && (nStatus === 'hostile' || (node.type === 'city' && nStatus === 'neutral'))) {
        chtml += '<button ' + (state.command < 1 ? 'disabled' : '') + ' data-tt="' + cmdBtnTt + '" onclick="attackNode(\'' + selectedNode + '\')">⚔️ Attaquer</button>';
    }
    if (linkedToArmy && !state.map.armyDest && (nStatus === 'player' || nStatus === 'allied') && state.map.armyAt !== selectedNode) {
        chtml += '<button ' + (state.command < 1 ? 'disabled' : '') + ' data-tt="' + cmdBtnTt + '" onclick="moveArmy(\'' + selectedNode + '\')">🚚 Déplacer l\'armée ici</button>';
    }
    chtml += '</div>';
    if (linkedToArmy) {
        chtml += '<div class="node-distance">Distance depuis l\'armée : ' + linkedToArmy + ' tour(s)</div>';
    } else if (state.map.armyAt) {
        chtml += '<div class="node-distance">Pas de route directe depuis la position de l\'armée</div>';
    }
    chtml += '</div>';

    const armyAt = state.map.armyAt;
    const armyDest = state.map.armyDest;
    const armyAtNode = armyAt ? getNode(armyAt) : null;
    const armyTitle = armyDest
        ? 'Armée (' + getArmySize() + '/' + getArmyCap() + ') — en transit vers ' + getNode(armyDest).name + ', arrivée dans ' + state.map.armyEta + ' tour(s)'
        : 'Armée (' + getArmySize() + '/' + getArmyCap() + ') — à ' + (armyAtNode ? armyAtNode.name : '?');
    const onOwnedNode = armyAt && !armyDest && state.map.owner[armyAt] === 'player';
    chtml += '<div class="panel army-section"><h3>' + armyTitle + '</h3><div class="army-grid">';
    state.army.forEach((id, i) => {
        const u = UNITS.find(x => x.id === id);
        chtml += '<div class="army-unit" data-tt="' + unitTtData(u).replace(/"/g, '&quot;') + '"><span class="au-icon">' + u.icon + '</span><div><div class="au-name">' + u.name + (u.size > 1 ? ' (×' + u.size + ')' : '') + '</div><div class="au-stats">PV:' + u.hp + ' ATK:' + u.atk + ' DEF:' + u.def + ' SPD:' + u.spd + '</div></div>'
            + (onOwnedNode ? '<button class="au-transfer" data-tt="Transfert — 1 CMD par tour (toutes les unités du tour)" onclick="transferToGarrison(' + i + ')">⤓</button>' : '')
            + '<button class="au-dismiss" onclick="dismissUnit(' + i + ')">✕</button></div>';
    });
    if (!state.army.length) chtml += '<div style="color:var(--dim);font-size:.8rem;padding:8px">Aucune unité. Recrutez des troupes !</div>';
    chtml += '</div>';
    if (onOwnedNode) {
        const g = state.map.garrisons[armyAt] || [];
        chtml += '<div class="garrison-block"><div class="garrison-title">Garnison de ' + armyAtNode.name + ' (' + g.length + ')</div><div class="army-grid">';
        g.forEach((id, i) => {
            const u = UNITS.find(x => x.id === id);
            chtml += '<div class="army-unit garrison-row" data-tt="' + unitTtData(u).replace(/"/g, '&quot;') + '"><span class="au-icon">' + u.icon + '</span><div><div class="au-name">' + u.name + (u.size > 1 ? ' (×' + u.size + ')' : '') + '</div></div><button class="au-transfer" data-tt="Transfert — 1 CMD par tour (toutes les unités du tour)" onclick="transferToArmy(' + i + ')">⤒</button></div>';
        });
        if (!g.length) chtml += '<div style="color:var(--dim);font-size:.75rem;padding:6px">Vide</div>';
        chtml += '</div></div>';
    }
    chtml += '</div>';

    chtml += '<div class="panel threats-section"><h3>Menaces</h3>';
    const sortedThreats = [...state.map.threats].sort((a, b) => a.arrivesIn - b.arrivesIn);
    if (!sortedThreats.length) {
        chtml += '<div style="color:var(--dim);font-size:.8rem;padding:8px">Aucune menace détectée.</div>';
    } else {
        sortedThreats.forEach(t => {
            const tn = getNode(t.nodeId);
            const preview = getForcePreview(t.budget, t.seed);
            chtml += '<div class="threat-item"><span class="threat-node">' + (tn ? tn.icon + ' ' + tn.name : t.nodeId) + '</span><span class="threat-eta">⚠️ ' + t.arrivesIn + ' tour(s)</span><span class="threat-preview">' + preview.map(e => e.icon + '×' + e.count).join(' ') + '</span></div>';
        });
    }
    chtml += '</div>';

    const heroTt = 'Les héros combattent automatiquement aux côtés de votre armée. Blessés 2 vagues s\'ils tombent. +1 slot via la recherche Éveil du TITAN.';
    chtml += '<div class="panel hero-section"><h3 data-tt="' + heroTt + '">Héros (' + state.heroes.length + '/' + getHeroSlots() + ')</h3><div class="hero-grid">';
    HEROES.forEach(h => {
        const heroTtData = h.name + ' — ' + h.abilityName + '<br>' + h.abilityDesc + '<br>PV:' + h.hp + ' ATK:' + h.atk + ' DEF:' + h.def + ' SPD:' + h.spd;
        if (state.heroes.includes(h.id)) {
            const wounded = isHeroWounded(h.id);
            chtml += '<div class="hero-card' + (wounded ? ' wounded' : '') + '" data-tt="' + heroTtData.replace(/"/g, '&quot;') + '"><span class="hero-icon">' + h.icon + '</span><div class="hero-info"><div class="hero-name"><span class="hero-star">★</span> ' + h.name + '</div><div class="hero-stats">PV:' + h.hp + ' ATK:' + h.atk + ' DEF:' + h.def + ' SPD:' + h.spd + '</div><div class="hero-ability">' + h.abilityName + ' — ' + h.abilityDesc + '</div>'
                + (wounded ? '<div class="hero-wounded-badge">Blessé — ' + state.heroWounded[h.id] + ' vague(s)</div>' : '')
                + '</div></div>';
        } else if (hasResearch(h.research)) {
            const costStr = Object.entries(h.cost).map(([k, v]) => v + RES_META[k].icon).join(' ');
            const slotsFull = state.heroes.length >= getHeroSlots();
            const aff = canRecruitHero(h);
            chtml += '<div class="hero-card" data-tt="' + heroTtData.replace(/"/g, '&quot;') + '"><span class="hero-icon">' + h.icon + '</span><div class="hero-info"><div class="hero-name">' + h.name + '</div><div class="hero-stats">PV:' + h.hp + ' ATK:' + h.atk + ' DEF:' + h.def + ' SPD:' + h.spd + '</div><div class="hero-ability">' + h.abilityName + ' — ' + h.abilityDesc + '</div><div class="rc-cost">' + costStr + '</div></div>'
                + (slotsFull ? '<span style="color:var(--dim);font-size:.7rem">Slots pleins</span>' : '<button ' + (aff ? '' : 'disabled') + ' onclick="recruitHero(\'' + h.id + '\')">+</button>')
                + '</div>';
        } else {
            const r = RESEARCH.find(x => x.id === h.research);
            chtml += '<div class="hero-card" style="opacity:.3"><span class="hero-icon">' + h.icon + '</span><div class="hero-info"><div class="hero-name">' + h.name + '</div><div class="hero-stats" style="color:var(--dim)">Requiert : ' + (r ? r.icon + ' ' + r.name : h.research) + '</div></div>🔬</div>';
        }
    });
    chtml += '</div></div>';

    chtml += '<div class="panel recruit-section"><h3>Recruter</h3><div class="recruit-grid">';
    const available = UNITS.filter(u => u.always || (u.building && isBuilt(u.building)));
    available.forEach(u => {
        const aff = canAfford(u.cost) && getArmySize() + u.size <= getArmyCap();
        const costStr = Object.entries(u.cost).map(([k, v]) => v + RES_META[k].icon).join(' ');
        chtml += '<div class="recruit-card" data-tt="' + unitTtData(u).replace(/"/g, '&quot;') + '"><span class="rc-icon">' + u.icon + '</span><div class="rc-info"><div class="rc-name">' + u.name + (u.size > 1 ? ' (×' + u.size + ')' : '') + '</div><div class="rc-stats">PV:' + u.hp + ' ATK:' + u.atk + ' DEF:' + u.def + ' SPD:' + u.spd + (u.heals ? ' Regen:' + u.heals : '') + (u.dodge ? ' Esquive:' + (u.dodge * 100) + '%' : '') + '</div><div class="rc-cost">' + costStr + '</div></div><button ' + (aff ? '' : 'disabled') + ' onclick="recruitUnit(\'' + u.id + '\')">+</button></div>';
    });
    const locked = UNITS.filter(u => !u.always && (!u.building || !isBuilt(u.building)));
    locked.forEach(u => {
        const bName = BUILDINGS.find(b => b.id === u.building);
        chtml += '<div class="recruit-card" style="opacity:.3"><span class="rc-icon">' + u.icon + '</span><div class="rc-info"><div class="rc-name">' + u.name + '</div><div class="rc-stats" style="color:var(--dim)">Requiert: ' + (bName ? bName.name : '?') + '</div></div>🔒</div>';
    });
    chtml += '</div></div>';

    document.getElementById('right-panel').innerHTML = chtml;
}

function renderBattle() {
    if (!battleState) return;
    if (battleState.mode === '3d') {
        renderBattle3D();
        return;
    }
    if (window.Base3D) Base3D.stop();
    if (window.Map3D) Map3D.stop();
    document.getElementById('right-panel').innerHTML = '';
    const cp = document.getElementById('center-panel');
    let html = '<div class="battlefield"><div class="bf-side">';
    battleState.player.forEach(u => {
        html += unitCardHtml(u);
    });
    html += '</div><div class="bf-center">ROUND ' + battleState.round + '</div><div class="bf-side">';
    battleState.enemy.forEach(u => {
        html += unitCardHtml(u);
    });
    html += '</div></div><div class="battle-log" id="blog">';
    battleState.log.slice(-20).forEach(e => {
        html += '<div class="bl-entry ' + e.type + '">' + e.text + '</div>';
    });
    html += '</div>';
    cp.innerHTML = html;
    const blog = document.getElementById('blog');
    if (blog) blog.scrollTop = blog.scrollHeight;

    const lp = document.getElementById('left-panel');
    lp.innerHTML = '<div class="panel"><h3>Combat en cours</h3><div style="font-size:.8rem;color:var(--dim);padding:8px">Vague ' + state.turn + ' / Round ' + battleState.round + '</div></div>';
}

function renderBattle3D() {
    const cp = document.getElementById('center-panel');
    if (!document.getElementById('battle3d-wrap')) {
        if (window.Base3D) Base3D.stop();
        if (window.Map3D) Map3D.stop();
        cp.innerHTML = '<div id="battle3d-wrap"><div id="battle3d-view"></div><div id="b3d-round"></div></div>';
        document.getElementById('right-panel').innerHTML = '<div class="panel log-section"><h3>Combat</h3><div class="battle-log" id="blog"></div></div>';
    }
    document.getElementById('b3d-round').textContent = 'ROUND ' + battleState.round;
    const blog = document.getElementById('blog');
    blog.innerHTML = battleState.log.slice(-20).map(e => '<div class="bl-entry ' + e.type + '">' + e.text + '</div>').join('');
    blog.scrollTop = blog.scrollHeight;

    const lp = document.getElementById('left-panel');
    lp.innerHTML = '<div class="panel"><h3>Combat en cours</h3><div style="font-size:.8rem;color:var(--dim);padding:8px">Vague ' + state.turn + ' / Round ' + battleState.round + '</div></div>';
}

function unitCardHtml(u) {
    const pct = u.maxHp > 0 ? Math.max(0, u.hp / u.maxHp * 100) : 0;
    const hpCls = pct > 50 ? '' : pct > 25 ? 'mid' : 'low';
    return '<div class="unit-card' + (u.hp <= 0 ? ' dead' : '') + '" data-uid="' + u.uid + '"><div class="uc-top"><span class="uc-icon">' + u.icon + '</span><span class="uc-name">' + u.name + '</span><span class="uc-hp-text">' + Math.max(0, u.hp) + '/' + u.maxHp + '</span></div><div class="hp-bar"><div class="hp-fill ' + hpCls + '" style="width:' + pct + '%"></div></div><div class="uc-stats">ATK:' + u.atk + ' DEF:' + u.def + ' SPD:' + u.spd + '</div></div>';
}

function toggleResearch() {
    const overlay = document.getElementById('research-overlay');
    overlay.classList.toggle('active');
    if (overlay.classList.contains('active')) renderResearch();
}

function renderResearch() {
    const overlay = document.getElementById('research-overlay');
    if (!overlay.classList.contains('active')) return;
    overlay.onclick = e => {
        if (e.target === overlay) toggleResearch();
    };

    const branchOrder = ['DOCTRINE', 'GUERRE', 'SINGULARITE'];
    let cols = '';
    branchOrder.forEach(bk => {
        const meta = RESEARCH_BRANCHES[bk];
        const items = RESEARCH.filter(r => r.branch === bk).sort((a, b) => a.tier - b.tier);
        let colHtml = '<div class="rs-branch" style="--bc:' + meta.color + '">'
            + '<div class="rs-branch-head"><span>' + meta.icon + ' ' + meta.name + '</span><div class="rs-desc">' + meta.desc + '</div></div>';
        let lastTier = 0;
        items.forEach(r => {
            if (r.tier !== lastTier) {
                lastTier = r.tier;
                colHtml += '<div class="rs-tier-label">TIER ' + r.tier + (r.tier > state.core ? ' <span style="color:var(--danger)">· Cœur ' + r.tier + ' requis</span>' : '') + '</div>';
            }
            const done = hasResearch(r.id);
            const costStr = Object.entries(r.cost).map(([k, v]) => v + RES_META[k].icon).join(' ');
            let cls = 'rs-item', right;
            if (done) {
                cls += ' rs-done';
                right = '<div class="rs-cost">✓</div>';
            } else if (canResearch(r)) {
                right = '<div class="rs-cost">' + costStr + '</div><button ' + (canAfford(r.cost) && state.command >= 1 ? '' : 'disabled') + ' data-tt="1 CMD" onclick="doResearch(\'' + r.id + '\')">Rechercher</button>';
            } else {
                cls += ' rs-locked';
                let reason;
                if (r.tier > state.core) {
                    reason = 'Cœur niv.' + r.tier + ' requis';
                } else {
                    const missing = r.requires.find(id => !hasResearch(id));
                    const mr = RESEARCH.find(x => x.id === missing);
                    reason = mr ? 'Requiert : ' + mr.name : 'Indisponible';
                }
                right = '<div class="rs-cost">' + reason + '</div>';
            }
            colHtml += '<div class="' + cls + '"><div class="rs-name">' + r.icon + ' ' + r.name + '</div><div class="rs-desc">' + r.desc + '</div>' + right + '</div>';
        });
        colHtml += '</div>';
        cols += colHtml;
    });

    overlay.innerHTML = '<div id="research-modal">'
        + '<div class="rs-head"><h2>🧠 Cortex de PROMETHEUS</h2><span>Cœur niveau ' + state.core + ' — les tiers supérieurs exigent un Cœur amélioré</span><button class="rs-close" onclick="toggleResearch()">✕</button></div>'
        + '<div class="rs-cols">' + cols + '</div>'
        + '</div>';
}
