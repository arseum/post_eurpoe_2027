function render() {
    renderRes();
    if (state.phase === 'build') {
        renderBuildPhase();
    } else {
        renderBattle();
    }
    document.getElementById('btn-battle').disabled = state.phase !== 'build' || state.army.length === 0;
    document.getElementById('btn-battle').style.display = state.phase === 'build' ? '' : 'none';
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
    const skulls = [0, 1, 2].map(i =>
        '<span style="font-size:1rem;opacity:' + (i < state.consecutiveLosses ? '1' : '0.2') + ';color:' + (i < state.consecutiveLosses ? 'var(--danger)' : 'inherit') + '">☠</span>'
    ).join('');
    html += '<div class="res-info">'
        + '<span>Vague ' + state.wave + '/30</span>'
        + '<span>' + CHAPTERS[state.chapter - 1].name + '</span>'
        + '<span>Armée: ' + getArmySize() + '/' + getArmyCap() + '</span>'
        + '<span data-tt="<div class=&quot;tt-title&quot;>Défaites consécutives</div><div class=&quot;tt-row&quot;><span>' + state.consecutiveLosses + ' / 3</span> — à 3 : annihilation</div>" style="display:flex;align-items:center;gap:2px;border-left:1px solid var(--gb);padding-left:16px;cursor:default">'
        + skulls
        + '</span>'
        + '</div>';
    bar.innerHTML = html;
}

function renderBuildPhase() {
    const lp = document.getElementById('left-panel');
    let lhtml = '<div class="panel"><h3>Bâtiments</h3>';
    for (let ch = 1; ch <= 3; ch++) {
        const cb = BUILDINGS.filter(b => b.chapter === ch);
        lhtml += '<div style="font-size:.6rem;color:var(--dim);letter-spacing:.1em;margin:6px 0 3px;text-transform:uppercase">Ch.' + ch + ' — ' + CHAPTERS[ch - 1].name + '</div>';
        cb.forEach(b => {
            const built = isBuilt(b.id), locked = b.chapter > state.chapter, aff = canAfford(b.cost);
            const cls = built ? 'build-item built' : locked ? 'build-item locked' : 'build-item';
            const costStr = Object.entries(b.cost).map(([k, v]) => v + RES_META[k].icon).join(' ');
            let btn = built ? '<span style="color:var(--stability);font-size:.7rem">✓</span>' : locked ? '🔒' : '<div class="bi-btn"><button ' + (aff ? '' : 'disabled') + ' onclick="buildBuilding(\'' + b.id + '\')">Bâtir</button></div>';
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
    if (!document.getElementById('base3d-wrap')) {
        cp.innerHTML = '<div id="base3d-wrap"><div id="base3d-view"></div><div id="base3d-hint">GLISSER POUR ORBITER · MOLETTE POUR ZOOMER</div></div>';
    }
    if (window.Base3D) {
        Base3D.mount(document.getElementById('base3d-view'));
        Base3D.sync(state.buildings);
    }

    let chtml = '<div class="panel army-section"><h3>Votre Armée (' + getArmySize() + '/' + getArmyCap() + ')</h3><div class="army-grid">';
    state.army.forEach((id, i) => {
        const u = UNITS.find(x => x.id === id);
        chtml += '<div class="army-unit" data-tt="' + unitTtData(u).replace(/"/g, '&quot;') + '"><span class="au-icon">' + u.icon + '</span><div><div class="au-name">' + u.name + (u.size > 1 ? ' (×' + u.size + ')' : '') + '</div><div class="au-stats">PV:' + u.hp + ' ATK:' + u.atk + ' DEF:' + u.def + ' SPD:' + u.spd + '</div></div><button class="au-dismiss" onclick="dismissUnit(' + i + ')">✕</button></div>';
    });
    if (!state.army.length) chtml += '<div style="color:var(--dim);font-size:.8rem;padding:8px">Aucune unité. Recrutez des troupes !</div>';
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

    const preview = getWavePreview(state.wave);
    const wavePow = generateWave(state.wave).reduce((s, u) => s + u.maxHp + u.atk * 2, 0);
    const armyPow = state.army.reduce((s, id) => {
        const u = UNITS.find(x => x.id === id);
        return s + u.hp + u.atk * 2;
    }, 0);
    const maxPow = Math.max(wavePow, armyPow, 1);

    chtml += '<div class="panel wave-preview"><h3>Prochaine Vague — #' + state.wave + '</h3><div class="wp-enemies">';
    preview.forEach(e => {
        chtml += '<span class="wp-enemy">' + e.icon + ' ' + e.name + ' ×' + e.count + '</span>';
    });
    chtml += '</div><div class="power-bar"><span>Vous</span><div style="flex:1;display:flex;gap:4px;align-items:center"><div style="flex:1;background:rgba(255,255,255,.05);border-radius:3px;height:6px;overflow:hidden"><div class="power-fill player" style="width:' + Math.round(armyPow / maxPow * 100) + '%"></div></div><div style="flex:1;background:rgba(255,255,255,.05);border-radius:3px;height:6px;overflow:hidden"><div class="power-fill enemy" style="width:' + Math.round(wavePow / maxPow * 100) + '%"></div></div></div><span>Ennemi</span></div></div>';

    document.getElementById('right-panel').innerHTML = chtml;
}

function renderBattle() {
    if (!battleState) return;
    if (battleState.mode === '3d') {
        renderBattle3D();
        return;
    }
    if (window.Base3D) Base3D.stop();
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
    lp.innerHTML = '<div class="panel"><h3>Combat en cours</h3><div style="font-size:.8rem;color:var(--dim);padding:8px">Vague ' + state.wave + ' / Round ' + battleState.round + '</div></div>';
}

function renderBattle3D() {
    const cp = document.getElementById('center-panel');
    if (!document.getElementById('battle3d-wrap')) {
        if (window.Base3D) Base3D.stop();
        cp.innerHTML = '<div id="battle3d-wrap"><div id="battle3d-view"></div><div id="b3d-round"></div></div>';
        document.getElementById('right-panel').innerHTML = '<div class="panel log-section"><h3>Combat</h3><div class="battle-log" id="blog"></div></div>';
    }
    document.getElementById('b3d-round').textContent = 'ROUND ' + battleState.round;
    const blog = document.getElementById('blog');
    blog.innerHTML = battleState.log.slice(-20).map(e => '<div class="bl-entry ' + e.type + '">' + e.text + '</div>').join('');
    blog.scrollTop = blog.scrollHeight;

    const lp = document.getElementById('left-panel');
    lp.innerHTML = '<div class="panel"><h3>Combat en cours</h3><div style="font-size:.8rem;color:var(--dim);padding:8px">Vague ' + state.wave + ' / Round ' + battleState.round + '</div></div>';
}

function unitCardHtml(u) {
    const pct = u.maxHp > 0 ? Math.max(0, u.hp / u.maxHp * 100) : 0;
    const hpCls = pct > 50 ? '' : pct > 25 ? 'mid' : 'low';
    return '<div class="unit-card' + (u.hp <= 0 ? ' dead' : '') + '" data-uid="' + u.uid + '"><div class="uc-top"><span class="uc-icon">' + u.icon + '</span><span class="uc-name">' + u.name + '</span><span class="uc-hp-text">' + Math.max(0, u.hp) + '/' + u.maxHp + '</span></div><div class="hp-bar"><div class="hp-fill ' + hpCls + '" style="width:' + pct + '%"></div></div><div class="uc-stats">ATK:' + u.atk + ' DEF:' + u.def + ' SPD:' + u.spd + '</div></div>';
}
