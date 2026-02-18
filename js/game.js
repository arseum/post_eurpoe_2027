let state = null, battleState = null, battleSpeed = 1, pendingScreens = [], twInterval = null, twDone = false;

function defaultState() {
  return {
    wave: 1,
    chapter: 1,
    resources: { energy: 25, materials: 20, data: 10, stability: 50, influence: 5 },
    buildings: [],
    army: ['sentinelle', 'sentinelle', 'sentinelle'],
    flags: {},
    log: [],
    eventsSeen: [],
    consecutiveLosses: 0,
    phase: 'build'
  };
}

function save() { localStorage.setItem('pe2147', JSON.stringify(state)); }
function hasSave() { return !!localStorage.getItem('pe2147'); }
function deleteSave() { localStorage.removeItem('pe2147'); }
function loadSave() { try { state = JSON.parse(localStorage.getItem('pe2147')); return true; } catch(e) { return false; } }

function getChapter(w) { return w <= 10 ? 1 : w <= 20 ? 2 : 3; }
function getArmyCap() { return 5 + (state.buildings.includes('quartiers') ? 3 : 0); }
function getArmySize() { return state.army.reduce((s, id) => { const u = UNITS.find(x => x.id === id); return s + (u ? u.size : 1); }, 0); }

function getProduction() {
  const p = { energy: 5, materials: 3, data: 2, stability: 0, influence: 0 };
  for (const bid of state.buildings) {
    const b = BUILDINGS.find(x => x.id === bid);
    if (b && b.prod) for (const [k, v] of Object.entries(b.prod)) p[k] += v;
  }
  return p;
}

function canAfford(cost) { for (const [k, v] of Object.entries(cost)) if ((state.resources[k] || 0) < v) return false; return true; }
function isBuilt(id) { return state.buildings.includes(id); }
function addLog(t, c = '') { state.log.push({ text: t, cls: c }); }
function clampRes() { for (const [k, m] of Object.entries(RES_META)) state.resources[k] = Math.min(m.max, Math.max(0, state.resources[k])); }

function seededRng(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

function generateWave(wn) {
  const rng = seededRng(wn * 7919 + 13);
  const budget = 5 + wn * 3;
  const mult = 1 + (wn - 1) * 0.06;
  const avail = ENEMY_TYPES.filter(e => e.minWave <= wn);
  const units = []; let rem = budget, idx = 0;
  while (rem > 0) {
    const af = avail.filter(e => e.cost <= rem);
    if (!af.length) break;
    const t = af[Math.floor(rng() * af.length)];
    rem -= t.cost;
    units.push({ uid: 'e' + (idx++), id: t.id, name: t.name, icon: t.icon, hp: Math.round(t.hp * mult), maxHp: Math.round(t.hp * mult), atk: Math.round(t.atk * mult), def: Math.round(t.def * mult), spd: t.spd, frontline: t.frontline, side: 'enemy' });
  }
  units.sort((a, b) => (b.frontline ? 1 : 0) - (a.frontline ? 1 : 0));
  return units;
}

function getWavePreview(wn) {
  const units = generateWave(wn);
  const counts = {};
  units.forEach(u => { if (!counts[u.id]) counts[u.id] = { ...u, count: 0 }; counts[u.id].count++; });
  return Object.values(counts);
}

function selectTarget(attacker, targets) {
  const alive = targets.filter(t => t.hp > 0);
  const front = alive.filter(t => t.frontline);
  const back = alive.filter(t => !t.frontline);
  if (attacker.spd >= 6 && back.length > 0) return back[0];
  return front.length > 0 ? front[0] : alive[0];
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runBattle() {
  const stabBonus = state.resources.stability < 30 ? -2 : state.resources.stability > 70 ? 2 : 0;
  const defBonus = state.buildings.includes('bouclier') ? 2 : 0;
  const playerUnits = state.army.map((id, i) => {
    const d = UNITS.find(u => u.id === id);
    return { uid: 'p' + i, id: d.id, name: d.name, icon: d.icon, hp: d.hp, maxHp: d.hp, atk: d.atk + stabBonus, def: d.def + defBonus, spd: d.spd, frontline: d.frontline, side: 'player', heals: d.heals || 0, dodge: d.dodge || 0 };
  });
  const enemyUnits = generateWave(state.wave);
  battleState = { player: playerUnits, enemy: enemyUnits, log: [], round: 0 };
  renderBattle();
  await delay(600 / battleSpeed);

  while (playerUnits.some(u => u.hp > 0) && enemyUnits.some(u => u.hp > 0)) {
    battleState.round++;
    const order = [...playerUnits, ...enemyUnits].filter(u => u.hp > 0).sort((a, b) => b.spd - a.spd);

    for (const unit of order) {
      if (unit.hp <= 0) continue;
      const enemies = (unit.side === 'player' ? enemyUnits : playerUnits).filter(u => u.hp > 0);
      if (!enemies.length) break;
      const target = selectTarget(unit, enemies);

      if (target.dodge && Math.random() < target.dodge) {
        battleState.log.push({ text: unit.icon + ' → ' + target.icon + ' Esquivé !', type: 'dodge' });
        renderBattle();
        showFloat(target.uid, 'Esquivé', 'dodge');
        await delay(300 / battleSpeed);
        continue;
      }

      const dmg = Math.max(1, unit.atk - target.def);
      target.hp = Math.max(0, target.hp - dmg);
      const killed = target.hp <= 0;
      battleState.log.push({ text: unit.icon + ' ' + unit.name + ' → ' + target.icon + ' ' + target.name + ' -' + dmg + ' PV' + (killed ? ' ☠️' : ''), type: killed ? 'kill' : 'hit' });
      renderBattle();
      highlightCard(unit.uid, 'attacking');
      highlightCard(target.uid, 'hit');
      showFloat(target.uid, '-' + dmg, 'damage');
      await delay(350 / battleSpeed);
      clearHighlights();
    }

    for (const u of playerUnits) {
      if (u.hp > 0 && u.heals > 0) {
        const heal = Math.min(u.heals, u.maxHp - u.hp);
        if (heal > 0) { u.hp += heal; battleState.log.push({ text: u.icon + ' +' + heal + ' PV', type: 'heal' }); showFloat(u.uid, '+' + heal, 'heal'); }
      }
    }
    renderBattle();
    await delay(200 / battleSpeed);
  }

  const won = playerUnits.some(u => u.hp > 0);
  await showResult(won);
  return { won, survivors: playerUnits.filter(u => u.hp > 0).map(u => u.id) };
}

function highlightCard(uid, cls) { const el = document.querySelector('[data-uid="' + uid + '"]'); if (el) el.classList.add(cls); }
function clearHighlights() { document.querySelectorAll('.unit-card').forEach(el => { el.classList.remove('attacking', 'hit'); }); }

function showFloat(uid, text, type) {
  const el = document.querySelector('[data-uid="' + uid + '"]');
  if (!el) return;
  const f = document.createElement('div');
  f.className = 'float-dmg ' + type;
  f.textContent = text;
  el.appendChild(f);
  setTimeout(() => f.remove(), 800);
}

function showResult(won) {
  return new Promise(resolve => {
    const div = document.createElement('div');
    div.className = 'result-overlay ' + (won ? 'win' : 'lose');
    div.innerHTML = '<h2>' + (won ? 'VICTOIRE' : 'DÉFAITE') + '</h2>';
    document.body.appendChild(div);
    setTimeout(() => { div.remove(); resolve(); }, 1500);
  });
}

function buildBuilding(id) {
  const b = BUILDINGS.find(x => x.id === id);
  if (!b || isBuilt(id) || !canAfford(b.cost) || b.chapter > state.chapter) return;
  for (const [k, v] of Object.entries(b.cost)) state.resources[k] -= v;
  state.buildings.push(id);
  addLog(b.icon + ' ' + b.name + ' construit', 'build');
  save(); render();
}

function recruitUnit(id) {
  const u = UNITS.find(x => x.id === id);
  if (!u || !canAfford(u.cost)) return;
  if (getArmySize() + u.size > getArmyCap()) return;
  if (!u.always && u.building && !isBuilt(u.building)) return;
  for (const [k, v] of Object.entries(u.cost)) state.resources[k] -= v;
  state.army.push(id);
  addLog(u.icon + ' ' + u.name + ' recruté', 'build');
  save(); render();
}

function dismissUnit(idx) {
  if (idx < 0 || idx >= state.army.length) return;
  const id = state.army[idx];
  const u = UNITS.find(x => x.id === id);
  state.army.splice(idx, 1);
  addLog(u.icon + ' ' + u.name + ' libéré', '');
  save(); render();
}

async function launchBattle() {
  if (state.army.length === 0 || state.phase !== 'build') return;
  state.phase = 'battle';
  render();
  const result = await runBattle();
  battleState = null;

  if (result.won) {
    state.army = result.survivors;
    state.consecutiveLosses = 0;
    addLog('✓ Vague ' + state.wave + ' repoussée !', 'build');
  } else {
    state.army = [];
    state.consecutiveLosses++;
    state.resources.stability -= 5;
    addLog('✗ Vague ' + state.wave + ' perdue...', 'warning');
  }

  state.wave++;

  if (state.consecutiveLosses >= 3) { showDefeat('annihilation'); return; }
  if (state.resources.stability <= 0) { showDefeat('revolte'); return; }
  if (state.resources.energy <= 0) { showDefeat('blackout'); return; }

  if (state.wave > 30) { triggerEnding(); return; }

  const prod = getProduction();
  for (const [k, v] of Object.entries(prod)) state.resources[k] += v;
  if (state.resources.stability > 40) state.resources.stability--;
  else if (state.resources.stability < 40) state.resources.stability++;
  clampRes();

  if (state.resources.stability <= 0) { showDefeat('revolte'); return; }
  if (state.resources.energy <= 0) { showDefeat('blackout'); return; }

  addLog('Production: ' + fmtProd(prod), '');

  const newCh = getChapter(state.wave);
  if (newCh !== state.chapter) { state.chapter = newCh; pendingScreens.push({ type: 'chapter', chapter: newCh }); }
  const evt = findEvent();
  if (evt) { state.eventsSeen.push(evt.id); pendingScreens.push({ type: 'event', event: evt }); }

  state.phase = 'build';
  save(); render();
  processNext();
}

function fmtProd(p) {
  const icons = { energy: '⚡', materials: '🔩', data: '💾', stability: '🏛️', influence: '🌐' };
  return Object.entries(p).filter(([, v]) => v).map(([k, v]) => (v > 0 ? '+' : '') + v + icons[k]).join(' ');
}

function findEvent() { return EVENTS.find(e => !state.eventsSeen.includes(e.id) && e.wave === state.wave && (!e.requires || e.requires(state))); }

function processNext() {
  if (!pendingScreens.length) return;
  const s = pendingScreens.shift();
  if (s.type === 'chapter') showChapter(s.chapter);
  else if (s.type === 'event') showEvent(s.event);
}

function showEvent(evt) {
  const ov = document.getElementById('event-overlay');
  const avail = evt.choices.filter(c => !c.requires || c.requires(state));
  let html = '<div id="event-modal"><h2>' + evt.title + '</h2><div class="event-text" id="evt-text"></div><div class="event-choices" id="evt-ch" style="display:none">';
  avail.forEach((c, i) => { html += '<button onclick="onEvtChoice(' + i + ')">' + c.text + '<span class="choice-effect">' + c.effect + '</span></button>'; });
  html += '</div></div>';
  ov.innerHTML = html; ov.classList.add('active'); ov._choices = avail;
  startTw(evt.text, document.getElementById('evt-text'), () => { document.getElementById('evt-ch').style.display = 'flex'; });
  ov.onclick = e => { if (!twDone && e.target === ov) finishTw(); };
}

function onEvtChoice(i) {
  const ov = document.getElementById('event-overlay');
  const c = ov._choices[i];
  addLog('► ' + c.text, 'event');
  if (c.effects) for (const [k, v] of Object.entries(c.effects)) state.resources[k] += v;
  if (c.flags) Object.assign(state.flags, c.flags);
  clampRes(); ov.classList.remove('active'); ov.innerHTML = '';
  if (state.resources.stability <= 0) { showDefeat('revolte'); return; }
  if (state.resources.energy <= 0) { showDefeat('blackout'); return; }
  save(); render(); processNext();
}

function startTw(text, el, cb) {
  if (twInterval) clearInterval(twInterval); twDone = false; let i = 0; el.textContent = '';
  const cur = document.createElement('span'); cur.className = 'cursor'; el.appendChild(cur);
  el._ft = text; el._cb = cb;
  twInterval = setInterval(() => {
    if (i < text.length) { el.insertBefore(document.createTextNode(text[i]), cur); i++; }
    else { clearInterval(twInterval); twInterval = null; twDone = true; cur.remove(); if (cb) cb(); }
  }, 20);
}

function finishTw() {
  if (twInterval) clearInterval(twInterval); twInterval = null; twDone = true;
  const el = document.getElementById('evt-text');
  if (el && el._ft) { el.textContent = el._ft; if (el._cb) el._cb(); }
}

function showChapter(ch) {
  const info = CHAPTERS[ch - 1];
  const ov = document.getElementById('chapter-overlay');
  ov.innerHTML = '<div class="chapter-box"><div class="ch-label">CHAPITRE ' + info.num + '</div><h2>' + info.name + '</h2><div class="ch-sub">' + info.sub + '</div><p>' + info.desc + '</p><button onclick="dismissCh()">CONTINUER</button></div>';
  ov.classList.add('active'); addLog('═══ Chapitre ' + info.num + ' : ' + info.name + ' ═══', 'chapter');
}

function dismissCh() { document.getElementById('chapter-overlay').classList.remove('active'); processNext(); }

function showDefeat(type) {
  const d = DEFEATS[type];
  document.getElementById('end-content').innerHTML = '<div class="defeat"><h1>' + d.icon + ' ' + d.title + '</h1></div><div class="end-sub">DÉFAITE — Vague ' + state.wave + '</div><div class="end-text">' + d.text + '</div>' + statsHtml() + '<button onclick="backToTitle()">RETOUR AU MENU</button>';
  showScreen('end-screen'); deleteSave();
}

function triggerEnding() {
  const avail = [];
  for (const [id, e] of Object.entries(ENDINGS)) if (e.check(state)) avail.push({ id, ...e });
  let html = '<h1>Le Destin d\'Alpha-7</h1><div class="end-sub">VAGUE 30 — LE CHOIX FINAL</div><p style="color:var(--dim);margin-bottom:24px;line-height:1.6">Vos actions ont ouvert les voies suivantes :</p><div class="ending-choices">';
  avail.forEach(e => { html += '<button onclick="selectEnd(\'' + e.id + '\')"><h3>' + e.icon + ' ' + e.title + '</h3><p>' + e.sub + '</p></button>'; });
  html += '</div>';
  document.getElementById('end-content').innerHTML = html;
  showScreen('end-screen');
}

function selectEnd(id) {
  const e = ENDINGS[id]; const isCap = id === 'capitulation';
  document.getElementById('end-content').innerHTML = (isCap ? '<div class="defeat">' : '') + '<h1>' + e.icon + ' ' + e.title + '</h1>' + (isCap ? '</div>' : '') + '<div class="end-sub">' + (isCap ? 'DÉFAITE' : 'VICTOIRE') + '</div><div class="end-text">' + e.text + '</div>' + statsHtml() + '<button onclick="backToTitle()">RETOUR AU MENU</button>';
  deleteSave();
}

function statsHtml() {
  return '<div class="end-stats"><div class="stat-box"><div class="sv">' + state.wave + '</div><div class="sl">Vagues</div></div><div class="stat-box"><div class="sv">' + state.buildings.length + '</div><div class="sl">Bâtiments</div></div><div class="stat-box"><div class="sv">' + state.eventsSeen.length + '</div><div class="sl">Événements</div></div></div>';
}

function backToTitle() { deleteSave(); showScreen('title-screen'); checkContinue(); }
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function checkContinue() { document.getElementById('btn-continue').style.display = hasSave() ? 'block' : 'none'; }
function setSpeed(s) { battleSpeed = s; document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active')); document.getElementById('spd' + s).classList.add('active'); }

function newGame() {
  deleteSave(); state = defaultState(); showScreen('game-screen'); save(); render();
  const evt = findEvent();
  if (evt) { state.eventsSeen.push(evt.id); pendingScreens.push({ type: 'event', event: evt }); processNext(); }
}

function continueGame() { if (!loadSave()) return; showScreen('game-screen'); render(); }
