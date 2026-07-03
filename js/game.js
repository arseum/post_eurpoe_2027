let state = null, battleState = null, battleSpeed = 1, pendingScreens = [], twInterval = null, twDone = false;

function makeMap() {
    return {
        owner: {alpha7: 'player', lyon: 'neutral', marseille: 'neutral', turin: 'neutral', ruine: 'hostile', zurich: 'hostile', outpost: 'hostile', munich: 'hostile', nexus: 'hostile', berlin: 'hostile'},
        weakenedBy: {},
        allied: {},
        garrisons: {alpha7: []},
        fortified: {},
        armyAt: 'alpha7',
        armyDest: null,
        armyEta: 0,
        threats: [],
        cacheLooted: {},
        lost: {},
        lastThreatTurn: 2,
        berlinWeakened: 0,
        transferTurn: 0
    };
}

function defaultState() {
    return {
        version: 2,
        turn: 1,
        command: 3,
        map: makeMap(),
        chapter: 1,
        resources: {energy: 25, materials: 20, data: 10, stability: 50, influence: 5},
        buildings: [],
        buildingLevels: {},
        core: 1,
        research: [],
        heroes: [],
        heroWounded: {},
        army: ['sentinelle', 'sentinelle', 'sentinelle'],
        flags: {},
        log: [],
        eventsSeen: [],
        phase: 'build'
    };
}

function save() {
    localStorage.setItem('pe2147', JSON.stringify(state));
}

function hasSave() {
    return !!localStorage.getItem('pe2147');
}

function deleteSave() {
    localStorage.removeItem('pe2147');
}

function loadSave() {
    try {
        state = JSON.parse(localStorage.getItem('pe2147'));
        if (!state) return false;
        if (!state.buildingLevels) state.buildingLevels = {};
        for (const id of state.buildings) if (!state.buildingLevels[id]) state.buildingLevels[id] = 1;
        if (!state.core) state.core = 1;
        if (!state.research) state.research = [];
        if (!state.heroes) state.heroes = [];
        if (!state.heroWounded) state.heroWounded = {};
        if (!state.map) {
            state.map = makeMap();
            state.turn = state.wave || 1;
            state.command = getCommandMax();
            state.version = 2;
        }
        if (!state.map.garrisons.alpha7) state.map.garrisons.alpha7 = [];
        for (const node of MAP_NODES) {
            if (!state.map.owner[node.id]) state.map.owner[node.id] = node.type === 'city' ? 'neutral' : 'hostile';
        }
        if (!state.map.weakenedBy) {
            state.map.weakenedBy = {};
            if (state.map.outpostBonusDone) state.map.weakenedBy.outpost = true;
        }
        return true;
    } catch (e) {
        return false;
    }
}

function getArmyCap() {
    return 5 + (state.buildings.includes('quartiers') ? 2 + getBuildingLevel('quartiers') : 0) + (state.core - 1) * 2 + researchEffects().armyCap;
}

function getCommandMax() {
    return 3 + researchEffects().command;
}

function spendCommand(n) {
    if (state.command < n) return false;
    state.command -= n;
    return true;
}

function getNode(id) {
    return MAP_NODES.find(n => n.id === id);
}

function linkTurns(a, b) {
    const na = getNode(a);
    let l = na && na.links.find(x => x.to === b);
    if (l) return l.turns;
    const nb = getNode(b);
    l = nb && nb.links.find(x => x.to === a);
    return l ? l.turns : null;
}

function getBuildingLevel(id) {
    return isBuilt(id) ? (state.buildingLevels[id] || 1) : 0;
}

function getUpgradeCost(id) {
    const b = BUILDINGS.find(x => x.id === id);
    const lvl = getBuildingLevel(id);
    if (!b || lvl < 1 || lvl >= 3) return null;
    const cost = {};
    for (const [k, v] of Object.entries(b.cost)) cost[k] = Math.round(v * lvl * 1.5);
    return cost;
}

function upgradeBuilding(id) {
    const b = BUILDINGS.find(x => x.id === id);
    const cost = getUpgradeCost(id);
    if (!b || !cost || !canAfford(cost)) return;
    if (!spendCommand(1)) return;
    for (const [k, v] of Object.entries(cost)) state.resources[k] -= v;
    state.buildingLevels[id]++;
    addLog('⬆ ' + b.icon + ' ' + b.name + ' → niveau ' + state.buildingLevels[id], 'build');
    save();
    render();
}

function getCoreUpgradeCost() {
    return state.core >= 3 ? null : CORE_UPGRADE_COSTS[state.core];
}

function upgradeCore() {
    const cost = getCoreUpgradeCost();
    if (!cost || !canAfford(cost)) return;
    if (!spendCommand(1)) return;
    for (const [k, v] of Object.entries(cost)) state.resources[k] -= v;
    state.core++;
    addLog('◆ Cœur d\'Alpha-7 → niveau ' + state.core + ' (+2 armée max)', 'chapter');
    save();
    render();
}

function getArmySize() {
    return state.army.reduce((s, id) => {
        const u = UNITS.find(x => x.id === id);
        return s + (u ? u.size : 1);
    }, 0);
}

function getProduction() {
    const p = {energy: 5, materials: 3, data: 2, stability: 0, influence: 0};
    for (const bid of state.buildings) {
        const b = BUILDINGS.find(x => x.id === bid);
        if (b && b.prod) for (const [k, v] of Object.entries(b.prod)) p[k] += v * getBuildingLevel(bid);
    }
    for (const [k, v] of Object.entries(researchEffects().prod)) p[k] += v;
    return p;
}

function canAfford(cost) {
    for (const [k, v] of Object.entries(cost)) if ((state.resources[k] || 0) < v) return false;
    return true;
}

function isBuilt(id) {
    return state.buildings.includes(id);
}

function addLog(t, c = '') {
    state.log.push({text: t, cls: c});
}

function clampRes() {
    for (const [k, m] of Object.entries(RES_META)) state.resources[k] = Math.min(m.max, Math.max(0, state.resources[k]));
}

function seededRng(seed) {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

function seedFor(nodeId) {
    let s = 0;
    for (const c of nodeId) s = s * 31 + c.charCodeAt(0);
    return s;
}

function generateForce(budget, seed) {
    const wn = Math.max(1, Math.round((budget - 5) / 3));
    const rng = seededRng(seed);
    const mult = 1 + (wn - 1) * 0.06;
    const avail = ENEMY_TYPES.filter(e => e.minWave <= wn);
    const units = [];
    let rem = budget, idx = 0;
    while (rem > 0) {
        const af = avail.filter(e => e.cost <= rem);
        if (!af.length) break;
        const t = af[Math.floor(rng() * af.length)];
        rem -= t.cost;
        units.push({
            uid: 'e' + (idx++),
            id: t.id,
            name: t.name,
            icon: t.icon,
            hp: Math.round(t.hp * mult),
            maxHp: Math.round(t.hp * mult),
            atk: Math.round(t.atk * mult),
            def: Math.round(t.def * mult),
            spd: t.spd,
            frontline: t.frontline,
            side: 'enemy'
        });
    }
    units.sort((a, b) => (b.frontline ? 1 : 0) - (a.frontline ? 1 : 0));
    return units;
}

function getForcePreview(budget, seed) {
    const units = generateForce(budget, seed);
    const counts = {};
    units.forEach(u => {
        if (!counts[u.id]) counts[u.id] = {...u, count: 0};
        counts[u.id].count++;
    });
    return Object.values(counts);
}

function selectTarget(attacker, targets) {
    const alive = targets.filter(t => t.hp > 0);
    const front = alive.filter(t => t.frontline);
    const back = alive.filter(t => !t.frontline);
    if (attacker.spd >= 6 && back.length > 0) return back[0];
    return front.length > 0 ? front[0] : alive[0];
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function hasResearch(id) {
    return state.research.includes(id);
}

function researchEffects() {
    const agg = {prod: {}, mods: {atk: 0, def: 0}, armyCap: 0, hpBonus: 0, command: 0, threatWarning: 0, heroSlot: 0};
    for (const rid of state.research) {
        const r = RESEARCH.find(x => x.id === rid);
        if (!r) continue;
        const e = r.effect;
        if (e.prod) for (const [k, v] of Object.entries(e.prod)) agg.prod[k] = (agg.prod[k] || 0) + v;
        if (e.mods) {
            agg.mods.atk += e.mods.atk || 0;
            agg.mods.def += e.mods.def || 0;
        }
        agg.armyCap += e.armyCap || 0;
        agg.hpBonus += e.hpBonus || 0;
        agg.command += e.command || 0;
        agg.threatWarning += e.threatWarning || 0;
        agg.heroSlot += e.heroSlot || 0;
    }
    return agg;
}

function canResearch(r) {
    return !hasResearch(r.id) && r.tier <= state.core && r.requires.every(hasResearch);
}

function doResearch(id) {
    const r = RESEARCH.find(x => x.id === id);
    if (!r || !canResearch(r) || !canAfford(r.cost)) return;
    if (!spendCommand(1)) return;
    for (const [k, v] of Object.entries(r.cost)) state.resources[k] -= v;
    state.research.push(id);
    if (r.effect.flags) Object.assign(state.flags, r.effect.flags);
    addLog(r.icon + ' Recherche : ' + r.name, 'chapter');
    save();
    render();
    if (typeof renderResearch === 'function') renderResearch();
}

function getHeroSlots() {
    return 1 + researchEffects().heroSlot;
}

function isHeroWounded(id) {
    return (state.heroWounded[id] || 0) > 0;
}

function canRecruitHero(h) {
    return !state.heroes.includes(h.id) && hasResearch(h.research) && state.heroes.length < getHeroSlots() && canAfford(h.cost);
}

function recruitHero(id) {
    const h = HEROES.find(x => x.id === id);
    if (!h || !canRecruitHero(h)) return;
    for (const [k, v] of Object.entries(h.cost)) state.resources[k] -= v;
    state.heroes.push(id);
    addLog(h.icon + ' ' + h.name + ' rejoint Alpha-7', 'chapter');
    save();
    render();
}

function tickHeroWounds() {
    for (const [id, n] of Object.entries(state.heroWounded)) {
        if (n > 1) state.heroWounded[id] = n - 1;
        else {
            delete state.heroWounded[id];
            const h = HEROES.find(x => x.id === id);
            if (h) addLog(h.icon + ' ' + h.name + ' est rétabli', 'build');
        }
    }
}

function buildHeroUnits() {
    const mods = getCombatMods();
    return state.heroes.filter(id => !isHeroWounded(id)).map((id, i) => {
        const h = HEROES.find(x => x.id === id);
        return {
            uid: 'h' + i,
            id: h.id,
            name: h.name,
            icon: h.icon,
            hp: h.hp,
            maxHp: h.hp,
            atk: h.atk + mods.atk,
            def: h.def + mods.def,
            spd: h.spd,
            frontline: h.frontline,
            side: 'player',
            hero: true,
            ability: h.ability,
            heals: 0,
            dodge: 0
        };
    });
}

function isBuildingUnlocked(b) {
    if (b.research) return hasResearch(b.research);
    return b.chapter <= state.chapter;
}

function getCombatMods() {
    const mods = {atk: 0, def: 0};
    if (state.resources.stability < 30) mods.atk -= 2;
    else if (state.resources.stability > 70) mods.atk += 2;
    if (state.buildings.includes('bouclier')) mods.def += 1 + getBuildingLevel('bouclier');
    const re = researchEffects();
    mods.atk += re.mods.atk;
    mods.def += re.mods.def;
    return mods;
}

function buildPlayerUnits() {
    return buildUnitsFrom(state.army, 'p');
}

function buildUnitsFrom(ids, prefix) {
    const mods = getCombatMods();
    const hpBonus = researchEffects().hpBonus;
    return ids.map((id, i) => {
        const d = UNITS.find(u => u.id === id);
        return {
            uid: prefix + i,
            id: d.id,
            name: d.name,
            icon: d.icon,
            hp: d.hp + hpBonus,
            maxHp: d.hp + hpBonus,
            atk: d.atk + mods.atk,
            def: d.def + mods.def,
            spd: d.spd,
            frontline: d.frontline,
            side: 'player',
            heals: d.heals || 0,
            dodge: d.dodge || 0
        };
    });
}

function simulateBattle(playerUnits, enemyUnits) {
    const initial = structuredClone({player: playerUnits, enemy: enemyUnits});
    const events = [];
    let round = 0;

    for (const u of playerUnits) {
        if (u.ability === 'aura') {
            for (const a of playerUnits) if (a !== u) a.atk += 2;
            events.push({t: 'ability', kind: 'aura', src: u.uid});
        }
    }

    while (playerUnits.some(u => u.hp > 0) && enemyUnits.some(u => u.hp > 0)) {
        round++;
        events.push({t: 'round', round});
        const order = [...playerUnits, ...enemyUnits].filter(u => u.hp > 0).sort((a, b) => b.spd - a.spd);

        for (const unit of order) {
            if (unit.hp <= 0) continue;
            const enemies = (unit.side === 'player' ? enemyUnits : playerUnits).filter(u => u.hp > 0);
            if (!enemies.length) break;
            const target = selectTarget(unit, enemies);

            if (target.dodge && Math.random() < target.dodge) {
                events.push({t: 'dodge', src: unit.uid, tgt: target.uid});
                continue;
            }

            const dmg = Math.max(1, unit.atk - target.def);
            target.hp = Math.max(0, target.hp - dmg);

            if (unit.ability === 'cleave') {
                const second = enemies.find(e => e !== target && e.hp > 0);
                if (second) {
                    const dmg2 = Math.max(1, Math.round((unit.atk - second.def) * 0.6));
                    second.hp = Math.max(0, second.hp - dmg2);
                    events.push({
                        t: 'ability', kind: 'cleave', src: unit.uid,
                        tgt: target.uid, dmg, kill: target.hp <= 0, hp: target.hp,
                        tgt2: second.uid, dmg2, kill2: second.hp <= 0, hp2: second.hp
                    });
                    continue;
                }
            }

            events.push({t: 'attack', src: unit.uid, tgt: target.uid, dmg, kill: target.hp <= 0, hp: target.hp});
        }

        const massHeal = playerUnits.filter(u => u.hp > 0 && u.ability === 'massHeal').length * 6;
        const heals = [];
        for (const u of playerUnits) {
            if (u.hp > 0 && (u.heals > 0 || massHeal > 0)) {
                const heal = Math.min((u.heals || 0) + massHeal, u.maxHp - u.hp);
                if (heal > 0) {
                    u.hp += heal;
                    heals.push({uid: u.uid, amount: heal, hp: u.hp});
                }
            }
        }
        events.push({t: 'roundEnd', heals});
    }

    const won = playerUnits.some(u => u.hp > 0);
    return {
        events,
        won,
        survivors: playerUnits.filter(u => u.hp > 0 && !u.hero).map(u => u.id),
        heroesDown: playerUnits.filter(u => u.hero && u.hp <= 0).map(u => u.id),
        finalUnits: playerUnits.map(u => ({uid: u.uid, id: u.id, hp: u.hp, hero: !!u.hero})),
        initial
    };
}

async function playBattle(sim) {
    battleState = {player: sim.initial.player, enemy: sim.initial.enemy, log: [], round: 0};
    const byUid = {};
    [...battleState.player, ...battleState.enemy].forEach(u => byUid[u.uid] = u);
    renderBattle();
    await delay(600 / battleSpeed);

    for (const ev of sim.events) {
        if (ev.t === 'round') {
            battleState.round = ev.round;
        } else if (ev.t === 'dodge') {
            const src = byUid[ev.src], tgt = byUid[ev.tgt];
            battleState.log.push({text: src.icon + ' → ' + tgt.icon + ' Esquivé !', type: 'dodge'});
            renderBattle();
            showFloat(tgt.uid, 'Esquivé', 'dodge');
            await delay(300 / battleSpeed);
        } else if (ev.t === 'attack') {
            const src = byUid[ev.src], tgt = byUid[ev.tgt];
            tgt.hp = ev.hp;
            battleState.log.push({
                text: src.icon + ' ' + src.name + ' → ' + tgt.icon + ' ' + tgt.name + ' -' + ev.dmg + ' PV' + (ev.kill ? ' ☠️' : ''),
                type: ev.kill ? 'kill' : 'hit'
            });
            renderBattle();
            highlightCard(src.uid, 'attacking');
            highlightCard(tgt.uid, 'hit');
            showFloat(tgt.uid, '-' + ev.dmg, 'damage');
            await delay(350 / battleSpeed);
            clearHighlights();
        } else if (ev.t === 'ability') {
            if (ev.kind === 'aura') {
                const src = byUid[ev.src];
                battleState.log.push({text: src.icon + ' Aura de Calcul — +2 ATK pour les alliés', type: 'heal'});
                renderBattle();
                await delay(300 / battleSpeed);
            } else if (ev.kind === 'cleave') {
                const src = byUid[ev.src], tgt = byUid[ev.tgt], tgt2 = byUid[ev.tgt2];
                tgt.hp = ev.hp;
                tgt2.hp = ev.hp2;
                battleState.log.push({
                    text: src.icon + ' ' + src.name + ' Frappe Croisée → ' + tgt.icon + ' -' + ev.dmg + ' PV' + (ev.kill ? ' ☠️' : '') + ' / ' + tgt2.icon + ' -' + ev.dmg2 + ' PV' + (ev.kill2 ? ' ☠️' : ''),
                    type: (ev.kill || ev.kill2) ? 'kill' : 'hit'
                });
                renderBattle();
                highlightCard(src.uid, 'attacking');
                highlightCard(tgt.uid, 'hit');
                highlightCard(tgt2.uid, 'hit');
                showFloat(tgt.uid, '-' + ev.dmg, 'damage');
                showFloat(tgt2.uid, '-' + ev.dmg2, 'damage');
                await delay(400 / battleSpeed);
                clearHighlights();
            }
        } else if (ev.t === 'roundEnd') {
            for (const h of ev.heals) {
                const u = byUid[h.uid];
                u.hp = h.hp;
                battleState.log.push({text: u.icon + ' +' + h.amount + ' PV', type: 'heal'});
                showFloat(u.uid, '+' + h.amount, 'heal');
            }
            renderBattle();
            await delay(200 / battleSpeed);
        }
    }

    await showResult(sim.won);
}

async function playBattle3D(sim) {
    battleState = {player: sim.initial.player, enemy: sim.initial.enemy, log: [], round: 0, mode: '3d'};
    renderBattle();
    await Battle3D.ready();
    Battle3D.mount(document.getElementById('battle3d-view'));
    Battle3D.setup(battleState.player, battleState.enemy);
    const byUid = {};
    [...battleState.player, ...battleState.enemy].forEach(u => byUid[u.uid] = u);
    await delay(600 / battleSpeed);

    for (const ev of sim.events) {
        if (ev.t === 'round') {
            battleState.round = ev.round;
            renderBattle();
        } else if (ev.t === 'dodge') {
            const src = byUid[ev.src], tgt = byUid[ev.tgt];
            battleState.log.push({text: src.icon + ' → ' + tgt.icon + ' Esquivé !', type: 'dodge'});
            renderBattle();
            await Battle3D.play(ev, 340 / battleSpeed);
        } else if (ev.t === 'attack') {
            const src = byUid[ev.src], tgt = byUid[ev.tgt];
            tgt.hp = ev.hp;
            battleState.log.push({
                text: src.icon + ' ' + src.name + ' → ' + tgt.icon + ' ' + tgt.name + ' -' + ev.dmg + ' PV' + (ev.kill ? ' ☠️' : ''),
                type: ev.kill ? 'kill' : 'hit'
            });
            renderBattle();
            await Battle3D.play(ev, 420 / battleSpeed);
        } else if (ev.t === 'ability') {
            const src = byUid[ev.src];
            if (ev.kind === 'aura') {
                battleState.log.push({text: src.icon + ' Aura de Calcul — +2 ATK pour les alliés', type: 'heal'});
                renderBattle();
                await Battle3D.play(ev, 500 / battleSpeed);
            } else if (ev.kind === 'cleave') {
                const tgt = byUid[ev.tgt], tgt2 = byUid[ev.tgt2];
                tgt.hp = ev.hp;
                tgt2.hp = ev.hp2;
                battleState.log.push({
                    text: src.icon + ' ' + src.name + ' Frappe Croisée → ' + tgt.icon + ' -' + ev.dmg + ' PV' + (ev.kill ? ' ☠️' : '') + ' / ' + tgt2.icon + ' -' + ev.dmg2 + ' PV' + (ev.kill2 ? ' ☠️' : ''),
                    type: (ev.kill || ev.kill2) ? 'kill' : 'hit'
                });
                renderBattle();
                await Battle3D.play(ev, 460 / battleSpeed);
            }
        } else if (ev.t === 'roundEnd') {
            for (const h of ev.heals) {
                const u = byUid[h.uid];
                u.hp = h.hp;
                battleState.log.push({text: u.icon + ' +' + h.amount + ' PV', type: 'heal'});
            }
            renderBattle();
            await Battle3D.play(ev, 200 / battleSpeed);
        }
    }

    await showResult(sim.won);
    Battle3D.stop();
}

async function runBattle(attackers, defenders) {
    const sim = simulateBattle(attackers, defenders);
    for (const id of sim.heroesDown) {
        state.heroWounded[id] = 2;
        const h = HEROES.find(x => x.id === id);
        if (h) addLog(h.icon + ' ' + h.name + ' est blessé (2 tours)', 'warning');
    }
    if (window.Battle3D && Battle3D.supported) {
        try {
            await playBattle3D(sim);
        } catch (e) {
            Battle3D.stop();
            await playBattle(sim);
        }
    } else {
        await playBattle(sim);
    }
    return sim;
}

function highlightCard(uid, cls) {
    const el = document.querySelector('[data-uid="' + uid + '"]');
    if (el) el.classList.add(cls);
}

function clearHighlights() {
    document.querySelectorAll('.unit-card').forEach(el => {
        el.classList.remove('attacking', 'hit');
    });
}

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
        setTimeout(() => {
            div.remove();
            resolve();
        }, 1500);
    });
}

function buildBuilding(id) {
    const b = BUILDINGS.find(x => x.id === id);
    if (!b || isBuilt(id) || !canAfford(b.cost) || !isBuildingUnlocked(b)) return;
    if (!spendCommand(1)) return;
    for (const [k, v] of Object.entries(b.cost)) state.resources[k] -= v;
    state.buildings.push(id);
    state.buildingLevels[id] = 1;
    addLog(b.icon + ' ' + b.name + ' construit', 'build');
    save();
    render();
}

function recruitUnit(id) {
    const u = UNITS.find(x => x.id === id);
    if (!u || !canAfford(u.cost)) return;
    if (!u.always && u.building && !isBuilt(u.building)) return;
    const atHome = state.map.armyAt === 'alpha7' && !state.map.armyDest;
    const toArmy = atHome && getArmySize() + u.size <= getArmyCap();
    for (const [k, v] of Object.entries(u.cost)) state.resources[k] -= v;
    if (toArmy) {
        state.army.push(id);
        addLog(u.icon + ' ' + u.name + ' recruté (armée)', 'build');
    } else {
        state.map.garrisons.alpha7.push(id);
        addLog(u.icon + ' ' + u.name + ' recruté (garnison Alpha-7)', 'build');
    }
    save();
    render();
}

function payTransfer() {
    if (state.map.transferTurn === state.turn) return true;
    if (!spendCommand(1)) return false;
    state.map.transferTurn = state.turn;
    return true;
}

function transferToGarrison(idx) {
    const at = state.map.armyAt;
    if (!at || state.map.armyDest || state.map.owner[at] !== 'player') return;
    if (idx < 0 || idx >= state.army.length) return;
    if (!payTransfer()) return;
    if (!state.map.garrisons[at]) state.map.garrisons[at] = [];
    const id = state.army.splice(idx, 1)[0];
    state.map.garrisons[at].push(id);
    save();
    render();
}

function transferToArmy(idx) {
    const at = state.map.armyAt;
    if (!at || state.map.armyDest || state.map.owner[at] !== 'player') return;
    const g = state.map.garrisons[at] || [];
    if (idx < 0 || idx >= g.length) return;
    const u = UNITS.find(x => x.id === g[idx]);
    if (!u || getArmySize() + u.size > getArmyCap()) return;
    if (!payTransfer()) return;
    state.army.push(g.splice(idx, 1)[0]);
    save();
    render();
}

function departArmy(dest, isAttack) {
    const m = state.map;
    if (state.phase !== 'build' || m.armyDest || !m.armyAt) return;
    if (state.army.length === 0) return;
    const t = linkTurns(m.armyAt, dest);
    if (!t) return;
    const friendly = m.owner[dest] === 'player' || m.allied[dest];
    if (isAttack === friendly) return;
    if (!spendCommand(1)) return;
    m.armyFrom = m.armyAt;
    m.armyDest = dest;
    m.armyEta = t;
    m.armyAt = null;
    const node = getNode(dest);
    addLog((isAttack ? '⚔️ Assaut lancé sur ' : '🚚 Armée en route vers ') + node.name + ' — ' + t + ' tour(s)', isAttack ? 'warning' : '');
    save();
    render();
}

function moveArmy(dest) {
    departArmy(dest, false);
}

function attackNode(dest) {
    departArmy(dest, true);
}

function allyCity(id) {
    const m = state.map;
    const node = getNode(id);
    if (!node || node.type !== 'city' || m.owner[id] !== 'neutral' || m.allied[id]) return;
    if ((state.resources.influence || 0) < node.allyCost) return;
    if (!spendCommand(1)) return;
    state.resources.influence -= node.allyCost;
    m.allied[id] = true;
    addLog('🤝 Alliance scellée avec ' + node.name, 'chapter');
    save();
    render();
}

function fortifyNode(id) {
    const m = state.map;
    if (m.owner[id] !== 'player' || m.fortified[id]) return;
    if (!spendCommand(1)) return;
    m.fortified[id] = true;
    addLog('🧱 ' + getNode(id).name + ' fortifié — +3 DEF au prochain combat', 'build');
    save();
    render();
}

function getChapterFromMap() {
    const m = state.map;
    let ch = state.turn >= 20 ? 3 : 1;
    for (const node of MAP_NODES) {
        if (!node.unlocksChapter) continue;
        if (m.owner[node.id] === 'player' || m.allied[node.id]) ch = Math.max(ch, node.unlocksChapter);
    }
    return ch;
}

function dismissUnit(idx) {
    if (idx < 0 || idx >= state.army.length) return;
    const id = state.army[idx];
    const u = UNITS.find(x => x.id === id);
    state.army.splice(idx, 1);
    addLog(u.icon + ' ' + u.name + ' libéré', '');
    save();
    render();
}

function phaseSwitch(cb) {
    const f = document.getElementById('phase-fade');
    f.classList.add('active');
    return new Promise(resolve => {
        setTimeout(() => {
            cb();
            setTimeout(() => {
                f.classList.remove('active');
                resolve();
            }, 60);
        }, 460);
    });
}

function getCampaignProduction() {
    const p = getProduction();
    const m = state.map;
    for (const node of MAP_NODES) {
        if (node.id === 'alpha7') continue;
        if (m.owner[node.id] === 'player' || m.allied[node.id]) {
            for (const [k, v] of Object.entries(node.prod)) p[k] += v;
        }
    }
    return p;
}

function garrisonBudgetFor(node) {
    const m = state.map;
    let budget = node.garrisonBudget;
    if (node.id === 'berlin') budget -= m.berlinWeakened;
    if (m.lost[node.id]) budget += Math.round(state.turn * 1.2);
    return Math.max(4, budget);
}

function survivorsOf(sim, prefix) {
    return sim.finalUnits.filter(u => !u.hero && u.hp > 0 && u.uid[0] === prefix).map(u => u.id);
}

async function resolveCombat(c) {
    const m = state.map;
    const node = getNode(c.node);
    state.phase = 'battle';
    await phaseSwitch(() => render());

    let sim;
    if (c.kind === 'assault') {
        addLog('⚔️ Assaut sur ' + node.name, 'warning');
        const attackers = buildUnitsFrom(state.army, 'a').concat(buildHeroUnits());
        const defenders = generateForce(garrisonBudgetFor(node), seedFor(c.node) + state.turn);
        sim = await runBattle(attackers, defenders);
        battleState = null;
        if (sim.won) {
            m.owner[c.node] = 'player';
            state.army = survivorsOf(sim, 'a');
            if (!m.garrisons[c.node]) m.garrisons[c.node] = [];
            addLog('🏴 ' + node.name + ' est sous votre contrôle', 'chapter');
            if (node.type === 'ruin' && !m.cacheLooted[c.node] && node.cache) {
                for (const [k, v] of Object.entries(node.cache)) state.resources[k] += v;
                m.cacheLooted[c.node] = true;
                addLog('📦 Cache récupérée : ' + fmtProd(node.cache), 'build');
            }
            if (node.type === 'city') {
                state.resources.stability -= 10;
                state.resources.influence -= 5;
                addLog('Occupation de ' + node.name + ' : -10🏛️ -5🌐', 'warning');
            }
            if (node.weakensCapital && !m.weakenedBy[c.node]) {
                m.berlinWeakened += node.weakensCapital;
                m.weakenedBy[c.node] = true;
                addLog('✂️ Ravitaillement de Berlin coupé — garnison affaiblie', 'chapter');
            }
            if (node.type === 'capital') {
                clampRes();
                save();
                triggerEnding();
                return true;
            }
        } else {
            state.army = [];
            m.armyAt = 'alpha7';
            addLog('✗ Assaut sur ' + node.name + ' repoussé — l\'armée est perdue', 'warning');
        }
    } else {
        addLog('🛡️ ' + node.name + ' attaqué !', 'warning');
        const g = m.garrisons[c.node] || [];
        const armyHere = m.armyAt === c.node && !m.armyDest;
        let defUnits = buildUnitsFrom(g, 'g');
        if (armyHere) defUnits = defUnits.concat(buildUnitsFrom(state.army, 'a')).concat(buildHeroUnits());
        if (m.fortified[c.node]) {
            defUnits.forEach(u => u.def += 3);
            delete m.fortified[c.node];
        }
        if (!defUnits.length) {
            sim = {won: false, finalUnits: []};
            addLog(node.name + ' est sans défense', 'warning');
        } else {
            sim = await runBattle(defUnits, generateForce(c.threat.budget, c.threat.seed));
            battleState = null;
        }
        if (sim.won) {
            m.garrisons[c.node] = survivorsOf(sim, 'g');
            if (armyHere) state.army = survivorsOf(sim, 'a');
            addLog('✓ ' + node.name + ' tient bon', 'build');
        } else {
            if (c.node === 'alpha7') {
                showDefeat('annihilation');
                return true;
            }
            m.owner[c.node] = 'hostile';
            m.garrisons[c.node] = [];
            delete m.allied[c.node];
            m.lost[c.node] = true;
            if (armyHere) {
                state.army = [];
                m.armyAt = 'alpha7';
            }
            state.resources.stability -= 8;
            addLog('🔥 ' + node.name + ' est tombé — -8🏛️', 'warning');
        }
    }
    state.phase = 'build';
    clampRes();
    save();
    await phaseSwitch(() => render());
    return false;
}

function resolveAlliedDefense(th) {
    const node = getNode(th.nodeId);
    const m = state.map;
    if (th.budget > node.garrisonBudget + 6 + Math.round(state.turn * 0.8)) {
        delete m.allied[th.nodeId];
        state.resources.influence -= 8;
        addLog('🔥 ' + node.name + ' (allié) est tombé face à la menace — -8🌐', 'warning');
    } else {
        addLog('🛡️ ' + node.name + ' (allié) a repoussé la menace seul', 'build');
    }
}

function spawnThreats() {
    const m = state.map;
    const cap = state.turn < 15 ? 2 : 3;
    const cadence = state.turn < 15 ? 3 : 2;
    if (m.threats.length >= cap) return;
    if (state.turn - m.lastThreatTurn < cadence) return;
    const targets = [];
    for (const node of MAP_NODES) {
        if (m.owner[node.id] === 'player') {
            targets.push(node.id);
            if (node.id === 'alpha7') targets.push(node.id);
        } else if (m.allied[node.id]) {
            targets.push(node.id);
        }
    }
    if (!targets.length) return;
    const rng = seededRng(state.turn * 6151 + 41);
    const nodeId = targets[Math.floor(rng() * targets.length)];
    const preavis = 2 + researchEffects().threatWarning;
    m.threats.push({nodeId, arrivesIn: preavis, budget: Math.round(5 + state.turn * 2.0), seed: state.turn * 917 + 3});
    m.lastThreatTurn = state.turn;
    addLog('⚠️ Menace détectée sur ' + getNode(nodeId).name + ' — arrivée dans ' + preavis + ' tours', 'warning');
}

let endTurnBusy = false;

async function endTurn() {
    if (state.phase !== 'build' || endTurnBusy) return;
    endTurnBusy = true;
    const m = state.map;

    const prod = getCampaignProduction();
    for (const [k, v] of Object.entries(prod)) state.resources[k] += v;
    if (state.resources.stability > 40) state.resources.stability--;
    else if (state.resources.stability < 40) state.resources.stability++;
    clampRes();
    addLog('— Tour ' + state.turn + ' · production : ' + fmtProd(prod), '');

    const combats = [];
    if (m.armyDest) {
        m.armyEta--;
        if (m.armyEta <= 0) {
            const dest = m.armyDest;
            m.armyDest = null;
            m.armyAt = dest;
            if (m.owner[dest] !== 'player' && !m.allied[dest]) {
                combats.push({kind: 'assault', node: dest});
            } else {
                addLog('🚚 Armée arrivée à ' + getNode(dest).name, '');
            }
        }
    }

    for (const th of m.threats) th.arrivesIn--;
    const arriving = m.threats.filter(t => t.arrivesIn <= 0);
    m.threats = m.threats.filter(t => t.arrivesIn > 0);
    for (const th of arriving) {
        if (m.owner[th.nodeId] === 'player') combats.push({kind: 'defense', node: th.nodeId, threat: th});
        else if (m.allied[th.nodeId]) resolveAlliedDefense(th);
    }

    for (const c of combats) {
        const ended = await resolveCombat(c);
        if (ended) {
            endTurnBusy = false;
            return;
        }
    }

    if (state.resources.stability <= 0) {
        showDefeat('revolte');
        endTurnBusy = false;
        return;
    }
    if (state.resources.energy <= 0) {
        showDefeat('blackout');
        endTurnBusy = false;
        return;
    }

    spawnThreats();

    const evt = findEvent();
    if (evt) {
        state.eventsSeen.push(evt.id);
        pendingScreens.push({type: 'event', event: evt});
    }
    const ms = findMilestone();
    if (ms) {
        state.eventsSeen.push(ms.id);
        pendingScreens.push({type: 'event', event: ms});
    }
    const newCh = getChapterFromMap();
    if (newCh !== state.chapter) {
        state.chapter = newCh;
        pendingScreens.push({type: 'chapter', chapter: newCh});
    }

    state.turn++;
    state.command = getCommandMax();
    tickHeroWounds();
    state.phase = 'build';
    save();
    render();
    processNext();
    endTurnBusy = false;
}

function fmtProd(p) {
    const icons = {energy: '⚡', materials: '🔩', data: '💾', stability: '🏛️', influence: '🌐'};
    return Object.entries(p).filter(([, v]) => v).map(([k, v]) => (v > 0 ? '+' : '') + v + icons[k]).join(' ');
}

function findEvent() {
    return EVENTS.find(e => !state.eventsSeen.includes(e.id) && e.wave === state.turn && (!e.requires || e.requires(state)));
}

function findMilestone() {
    return MILESTONES.find(mi => !state.eventsSeen.includes(mi.id) && mi.trigger(state));
}

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
    avail.forEach((c, i) => {
        html += '<button onclick="onEvtChoice(' + i + ')">' + c.text + '<span class="choice-effect">' + c.effect + '</span></button>';
    });
    html += '</div></div>';
    ov.innerHTML = html;
    ov.classList.add('active');
    ov._choices = avail;
    startTw(evt.text, document.getElementById('evt-text'), () => {
        document.getElementById('evt-ch').style.display = 'flex';
    });
    ov.onclick = e => {
        if (!twDone && e.target === ov) finishTw();
    };
}

function onEvtChoice(i) {
    const ov = document.getElementById('event-overlay');
    const c = ov._choices[i];
    addLog('► ' + c.text, 'event');
    if (c.effects) for (const [k, v] of Object.entries(c.effects)) state.resources[k] += v;
    if (c.flags) Object.assign(state.flags, c.flags);
    clampRes();
    ov.classList.remove('active');
    ov.innerHTML = '';
    if (state.resources.stability <= 0) {
        showDefeat('revolte');
        return;
    }
    if (state.resources.energy <= 0) {
        showDefeat('blackout');
        return;
    }
    save();
    render();
    processNext();
}

function startTw(text, el, cb) {
    if (twInterval) clearInterval(twInterval);
    twDone = false;
    let i = 0;
    el.textContent = '';
    const cur = document.createElement('span');
    cur.className = 'cursor';
    el.appendChild(cur);
    el._ft = text;
    el._cb = cb;
    twInterval = setInterval(() => {
        if (i < text.length) {
            el.insertBefore(document.createTextNode(text[i]), cur);
            i++;
        } else {
            clearInterval(twInterval);
            twInterval = null;
            twDone = true;
            cur.remove();
            if (cb) cb();
        }
    }, 20);
}

function finishTw() {
    if (twInterval) clearInterval(twInterval);
    twInterval = null;
    twDone = true;
    const el = document.getElementById('evt-text');
    if (el && el._ft) {
        el.textContent = el._ft;
        if (el._cb) el._cb();
    }
}

function showChapter(ch) {
    const info = CHAPTERS[ch - 1];
    const ov = document.getElementById('chapter-overlay');
    ov.innerHTML = '<div class="chapter-box"><div class="ch-label">CHAPITRE ' + info.num + '</div><h2>' + info.name + '</h2><div class="ch-sub">' + info.sub + '</div><p>' + info.desc + '</p><button onclick="dismissCh()">CONTINUER</button></div>';
    ov.classList.add('active');
    addLog('═══ Chapitre ' + info.num + ' : ' + info.name + ' ═══', 'chapter');
}

function dismissCh() {
    document.getElementById('chapter-overlay').classList.remove('active');
    processNext();
}

function showDefeat(type) {
    const d = DEFEATS[type];
    document.getElementById('end-content').innerHTML = '<div class="defeat"><h1>' + d.icon + ' ' + d.title + '</h1></div><div class="end-sub">DÉFAITE — Vague ' + state.turn + '</div><div class="end-text">' + d.text + '</div>' + statsHtml() + '<button onclick="backToTitle()">RETOUR AU MENU</button>';
    showScreen('end-screen');
    deleteSave();
}

function triggerEnding() {
    const avail = [];
    for (const [id, e] of Object.entries(ENDINGS)) if (e.check(state)) avail.push({id, ...e});
    let html = '<h1>Le Destin d\'Alpha-7</h1><div class="end-sub">VAGUE 30 — LE CHOIX FINAL</div><p style="color:var(--dim);margin-bottom:24px;line-height:1.6">Vos actions ont ouvert les voies suivantes :</p><div class="ending-choices">';
    avail.forEach(e => {
        html += '<button onclick="selectEnd(\'' + e.id + '\')"><h3>' + e.icon + ' ' + e.title + '</h3><p>' + e.sub + '</p></button>';
    });
    html += '</div>';
    document.getElementById('end-content').innerHTML = html;
    showScreen('end-screen');
}

function selectEnd(id) {
    const e = ENDINGS[id];
    const isCap = id === 'capitulation';
    document.getElementById('end-content').innerHTML = (isCap ? '<div class="defeat">' : '') + '<h1>' + e.icon + ' ' + e.title + '</h1>' + (isCap ? '</div>' : '') + '<div class="end-sub">' + (isCap ? 'DÉFAITE' : 'VICTOIRE') + '</div><div class="end-text">' + e.text + '</div>' + statsHtml() + '<button onclick="backToTitle()">RETOUR AU MENU</button>';
    deleteSave();
}

function statsHtml() {
    return '<div class="end-stats"><div class="stat-box"><div class="sv">' + state.turn + '</div><div class="sl">Tours</div></div><div class="stat-box"><div class="sv">' + state.buildings.length + '</div><div class="sl">Bâtiments</div></div><div class="stat-box"><div class="sv">' + state.eventsSeen.length + '</div><div class="sl">Événements</div></div></div>';
}

function backToTitle() {
    deleteSave();
    showScreen('title-screen');
    checkContinue();
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function checkContinue() {
    document.getElementById('btn-continue').style.display = hasSave() ? 'block' : 'none';
}

function setSpeed(s) {
    battleSpeed = s;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('spd' + s).classList.add('active');
}

function newGame() {
    deleteSave();
    state = defaultState();
    showScreen('game-screen');
    save();
    render();
    const evt = findEvent();
    if (evt) {
        state.eventsSeen.push(evt.id);
        pendingScreens.push({type: 'event', event: evt});
        processNext();
    }
}

function continueGame() {
    if (!loadSave()) return;
    showScreen('game-screen');
    render();
}
