function render() {
  renderRes();
  if (state.phase === 'build') { renderBuildPhase(); }
  else { renderBattle(); }
  document.getElementById('btn-battle').disabled = state.phase !== 'build' || state.army.length === 0;
  document.getElementById('btn-battle').style.display = state.phase === 'build' ? '' : 'none';
}

function renderRes() {
  const bar = document.getElementById('resource-bar');
  const prod = getProduction(); let html = '';
  for (const [k, meta] of Object.entries(RES_META)) {
    const v = state.resources[k];
    const p = prod[k] + (k === 'stability' ? (v > 40 ? -1 : v < 40 ? 1 : 0) : 0);
    const pc = p >= 0 ? 'pos' : 'neg';
    html += '<div class="res-item" style="border-color:' + meta.color + '22"><span>' + meta.icon + '</span> <span class="res-val" style="color:' + meta.color + '">' + v + '</span><span style="color:var(--dim);font-size:.72rem">/' + meta.max + '</span> <span class="res-prod ' + pc + '">' + (p >= 0 ? '+' : '') + p + '/t</span></div>';
  }
  html += '<div class="res-info"><span>Vague ' + state.wave + '/30</span><span>' + CHAPTERS[state.chapter - 1].name + '</span><span>Armée: ' + getArmySize() + '/' + getArmyCap() + '</span></div>';
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
  state.log.slice(-15).forEach(e => { lhtml += '<div class="log-entry ' + e.cls + '">' + e.text + '</div>'; });
  lhtml += '</div></div>';
  lp.innerHTML = lhtml;
  const logEl = lp.querySelector('.log-entries'); if (logEl) logEl.scrollTop = logEl.scrollHeight;

  const cp = document.getElementById('center-panel');
  let chtml = '<div class="panel army-section"><h3>Votre Armée (' + getArmySize() + '/' + getArmyCap() + ')</h3><div class="army-grid">';
  state.army.forEach((id, i) => {
    const u = UNITS.find(x => x.id === id);
    chtml += '<div class="army-unit"><span class="au-icon">' + u.icon + '</span><div><div class="au-name">' + u.name + (u.size > 1 ? ' (×' + u.size + ')' : '') + '</div><div class="au-stats">PV:' + u.hp + ' ATK:' + u.atk + ' DEF:' + u.def + ' SPD:' + u.spd + '</div></div><button class="au-dismiss" onclick="dismissUnit(' + i + ')">✕</button></div>';
  });
  if (!state.army.length) chtml += '<div style="color:var(--dim);font-size:.8rem;padding:8px">Aucune unité. Recrutez des troupes !</div>';
  chtml += '</div></div>';

  chtml += '<div class="panel recruit-section"><h3>Recruter</h3><div class="recruit-grid">';
  const available = UNITS.filter(u => u.always || (u.building && isBuilt(u.building)));
  available.forEach(u => {
    const aff = canAfford(u.cost) && getArmySize() + u.size <= getArmyCap();
    const costStr = Object.entries(u.cost).map(([k, v]) => v + RES_META[k].icon).join(' ');
    chtml += '<div class="recruit-card"><span class="rc-icon">' + u.icon + '</span><div class="rc-info"><div class="rc-name">' + u.name + (u.size > 1 ? ' (×' + u.size + ')' : '') + '</div><div class="rc-stats">PV:' + u.hp + ' ATK:' + u.atk + ' DEF:' + u.def + ' SPD:' + u.spd + (u.heals ? ' Regen:' + u.heals : '') + (u.dodge ? ' Esquive:' + (u.dodge * 100) + '%' : '') + '</div><div class="rc-cost">' + costStr + '</div></div><button ' + (aff ? '' : 'disabled') + ' onclick="recruitUnit(\'' + u.id + '\')">+</button></div>';
  });
  const locked = UNITS.filter(u => !u.always && (!u.building || !isBuilt(u.building)));
  locked.forEach(u => {
    const bName = BUILDINGS.find(b => b.id === u.building);
    chtml += '<div class="recruit-card" style="opacity:.3"><span class="rc-icon">' + u.icon + '</span><div class="rc-info"><div class="rc-name">' + u.name + '</div><div class="rc-stats" style="color:var(--dim)">Requiert: ' + (bName ? bName.name : '?') + '</div></div>🔒</div>';
  });
  chtml += '</div></div>';

  const preview = getWavePreview(state.wave);
  const wavePow = generateWave(state.wave).reduce((s, u) => s + u.maxHp + u.atk * 2, 0);
  const armyPow = state.army.reduce((s, id) => { const u = UNITS.find(x => x.id === id); return s + u.hp + u.atk * 2; }, 0);
  const maxPow = Math.max(wavePow, armyPow, 1);

  chtml += '<div class="panel wave-preview"><h3>Prochaine Vague — #' + state.wave + '</h3><div class="wp-enemies">';
  preview.forEach(e => { chtml += '<span class="wp-enemy">' + e.icon + ' ' + e.name + ' ×' + e.count + '</span>'; });
  chtml += '</div><div class="power-bar"><span>Vous</span><div style="flex:1;display:flex;gap:4px;align-items:center"><div style="flex:1;background:rgba(255,255,255,.05);border-radius:3px;height:6px;overflow:hidden"><div class="power-fill player" style="width:' + Math.round(armyPow / maxPow * 100) + '%"></div></div><div style="flex:1;background:rgba(255,255,255,.05);border-radius:3px;height:6px;overflow:hidden"><div class="power-fill enemy" style="width:' + Math.round(wavePow / maxPow * 100) + '%"></div></div></div><span>Ennemi</span></div></div>';

  cp.innerHTML = chtml;
}

function renderBattle() {
  if (!battleState) return;
  const cp = document.getElementById('center-panel');
  let html = '<div class="battlefield"><div class="bf-side">';
  battleState.player.forEach(u => { html += unitCardHtml(u); });
  html += '</div><div class="bf-center">ROUND ' + battleState.round + '</div><div class="bf-side">';
  battleState.enemy.forEach(u => { html += unitCardHtml(u); });
  html += '</div></div><div class="battle-log" id="blog">';
  battleState.log.slice(-20).forEach(e => { html += '<div class="bl-entry ' + e.type + '">' + e.text + '</div>'; });
  html += '</div>';
  cp.innerHTML = html;
  const blog = document.getElementById('blog'); if (blog) blog.scrollTop = blog.scrollHeight;

  const lp = document.getElementById('left-panel');
  lp.innerHTML = '<div class="panel"><h3>Combat en cours</h3><div style="font-size:.8rem;color:var(--dim);padding:8px">Vague ' + state.wave + ' / Round ' + battleState.round + '</div></div>';
}

function unitCardHtml(u) {
  const pct = u.maxHp > 0 ? Math.max(0, u.hp / u.maxHp * 100) : 0;
  const hpCls = pct > 50 ? '' : pct > 25 ? 'mid' : 'low';
  return '<div class="unit-card' + (u.hp <= 0 ? ' dead' : '') + '" data-uid="' + u.uid + '"><div class="uc-top"><span class="uc-icon">' + u.icon + '</span><span class="uc-name">' + u.name + '</span><span class="uc-hp-text">' + Math.max(0, u.hp) + '/' + u.maxHp + '</span></div><div class="hp-bar"><div class="hp-fill ' + hpCls + '" style="width:' + pct + '%"></div></div><div class="uc-stats">ATK:' + u.atk + ' DEF:' + u.def + ' SPD:' + u.spd + '</div></div>';
}
