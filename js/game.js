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
        lastThreatTurn: 0,
        berlinWeakened: 0,
        transferTurn: 0,
        raided: {},
        fallenAllies: {},
        gifted: {}
    };
}

function newStats() {
    return {assaultsWon: 0, assaultsLost: 0, retreats: 0, defensesWon: 0, defensesLost: 0, unitsLost: 0, recruited: 0};
}

function defaultState() {
    return {
        version: 2,
        turn: 1,
        command: BALANCE.commandBase,
        map: makeMap(),
        chapter: 1,
        resources: {energy: BALANCE.startEnergy, materials: BALANCE.startMaterials, data: BALANCE.startData, stability: BALANCE.startStability, influence: BALANCE.startInfluence},
        buildings: [],
        buildingLevels: {},
        core: 1,
        research: [],
        heroes: [],
        heroWounded: {},
        army: [...BALANCE.startArmy],
        flags: {},
        seed: Math.floor(Math.random() * 1e6),
        retreatAt: BALANCE.retreatDefault,
        log: [],
        eventsSeen: [],
        phase: 'build',
        stats: newStats(),
        guide: newGuide(false)
    };
}

const SAVE_KEY = 'pe2147';

function save() {
    if (state.phase !== 'build' || endTurnBusy) return;
    state.savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    flashSaved();
}

function readSave() {
    try {
        return JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch (e) {
        return null;
    }
}

function deleteSave() {
    localStorage.removeItem(SAVE_KEY);
}

function loadSave() {
    try {
        state = readSave();
        if (!state) return false;
        state.phase = 'build';
        if (!DIFFICULTIES[state.difficulty]) state.difficulty = 'normal';
        applyDifficulty(state.difficulty);
        if (!state.buildingLevels) state.buildingLevels = {};
        for (const id of state.buildings) if (!state.buildingLevels[id]) state.buildingLevels[id] = 1;
        if (!state.core) state.core = 1;
        if (!state.research) state.research = [];
        if (!state.heroes) state.heroes = [];
        if (!state.heroWounded) state.heroWounded = {};
        if (!state.guide) state.guide = newGuide(false);
        if (!state.stats) state.stats = newStats();
        if (state.seed === undefined) state.seed = 0;
        if (state.retreatAt === undefined) state.retreatAt = BALANCE.retreatDefault;
        if (!state.map) {
            state.map = makeMap();
            state.turn = state.turn || state.wave || 1;
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
        if (!state.map.raided) state.map.raided = {};
        if (!state.map.fallenAllies) state.map.fallenAllies = {};
        if (!state.map.gifted) state.map.gifted = {};
        return true;
    } catch (e) {
        return false;
    }
}

function getArmyCap() {
    return BALANCE.armyCapBase + (isBuilt('quartiers') ? BALANCE.quartiersCapBase + getBuildingLevel('quartiers') * BALANCE.quartiersCapPerLevel : 0) + (state.core - 1) * BALANCE.armyCapPerCore + activeEffects().armyCap;
}

function getCommandMax() {
    return BALANCE.commandBase + activeEffects().command;
}

function spendCommand(n) {
    if (state.command < n) return false;
    state.command -= n;
    return true;
}

function getNode(id) {
    return MAP_NODES.find(n => n.id === id);
}

function getUnit(id) {
    return UNITS.find(u => u.id === id);
}

function isHeld(id, s = state) {
    return s.map.owner[id] === 'player' || !!s.map.allied[id];
}

function cityDividend(node, s = state) {
    if (!node.identity) return null;
    if (s.map.owner[node.id] === 'player') return node.identity.conquest;
    if (s.map.allied[node.id]) return node.identity.alliance;
    return null;
}

function nodeProd(node, s = state) {
    const d = cityDividend(node, s);
    return d ? d.prod : node.prod || {};
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
    if (!b || lvl < 1 || lvl >= BALANCE.maxBuildingLevel) return null;
    const cost = {};
    for (const [k, v] of Object.entries(b.cost)) cost[k] = Math.round(v * lvl * BALANCE.upgradeCostMult);
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
    sfx('build');
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
    addLog('◆ Cœur d\'Alpha-7 → niveau ' + state.core + ' (+' + BALANCE.armyCapPerCore + ' armée max)', 'chapter');
    sfx('build');
    save();
    render();
}

function getArmySize() {
    return sizeOf(state.army);
}

function getProduction() {
    const p = {energy: BALANCE.baseEnergy, materials: BALANCE.baseMaterials, data: BALANCE.baseData, stability: BALANCE.baseStability, influence: BALANCE.baseInfluence};
    for (const bid of state.buildings) {
        const b = BUILDINGS.find(x => x.id === bid);
        if (b && b.prod) for (const [k, v] of Object.entries(b.prod)) p[k] += v * getBuildingLevel(bid);
    }
    for (const [k, v] of Object.entries(activeEffects().prod)) p[k] += v;
    return p;
}

function stabilityDrift() {
    const d = BALANCE.stabilityAnchor - state.resources.stability;
    if (d >= 0) return Math.min(d, BALANCE.stabilityDrift);
    return -Math.max(Math.min(-d, BALANCE.stabilityDrift), Math.round(-d * BALANCE.stabilityDecayRate));
}

function canAfford(cost) {
    for (const [k, v] of Object.entries(cost)) if ((state.resources[k] || 0) < v) return false;
    return true;
}

function isBuilt(id) {
    return state.buildings.includes(id);
}

function sfx(name) {
    if (typeof Sfx !== 'undefined') Sfx.play(name);
}

function battleSfx(ev) {
    if (ev.t === 'attack') sfx(ev.kill ? 'kill' : 'hit');
    else if (ev.t === 'ability' && ev.kind === 'cleave') sfx(ev.kill || ev.kill2 ? 'kill' : 'hit');
    else if (ev.t === 'ability') sfx('research');
    else if (ev.t === 'roundEnd' && ev.heals.length) sfx('heal');
    else if (ev.t === 'retreat') sfx('retreat');
}

function addLog(t, c = '') {
    state.log.push({text: t, cls: c});
    if (state.phase === 'build' && !endTurnBusy) toast(t, c);
}

function pulseNode(id, status) {
    if (window.Map3D) Map3D.pulse(id, status);
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

function garrisonSeed(id) {
    return seedFor(id) + state.seed;
}

function seedFor(nodeId) {
    let s = 0;
    for (const c of nodeId) s = s * 31 + c.charCodeAt(0);
    return s;
}

function generateForce(budget, seed) {
    const wn = Math.max(1, Math.round((budget - 5) / 3));
    const rng = seededRng(seed);
    const mult = 1 + (wn - 1) * BALANCE.enemyScalePerWave;
    const avail = ENEMY_TYPES.filter(e => e.minTier <= wn);
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
    return forceCounts(generateForce(budget, seed));
}

function forceCounts(units) {
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

function addEffect(agg, e) {
    if (e.prod) for (const [k, v] of Object.entries(e.prod)) agg.prod[k] = (agg.prod[k] || 0) + v;
    if (e.mods) {
        agg.mods.atk += e.mods.atk || 0;
        agg.mods.def += e.mods.def || 0;
    }
    for (const k of ['armyCap', 'hpBonus', 'command', 'threatWarning', 'heroSlot', 'allyDiscount', 'homeDef', 'capitalWeaken', 'alliedHold', 'unitDiscount', 'homeRelief']) agg[k] += e[k] || 0;
}

function activeEffects() {
    const agg = {prod: {}, mods: {atk: 0, def: 0}, armyCap: 0, hpBonus: 0, command: 0, threatWarning: 0, heroSlot: 0, allyDiscount: 0, homeDef: 0, capitalWeaken: 0, alliedHold: 0, unitDiscount: 0, homeRelief: 0};
    for (const rid of state.research) {
        const r = RESEARCH.find(x => x.id === rid);
        if (r) addEffect(agg, r.effect);
    }
    for (const [f, on] of Object.entries(state.flags)) if (on && DECISIONS[f] && DECISIONS[f].effect) addEffect(agg, DECISIONS[f].effect);
    for (const node of MAP_NODES) {
        const d = cityDividend(node);
        if (d && d.effect) addEffect(agg, d.effect);
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
    sfx('research');
    save();
    render();
    renderResearch();
}

function getHeroSlots() {
    return 1 + activeEffects().heroSlot;
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
    sfx('recruit');
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
    if (state.resources.stability < BALANCE.stabilityLow) mods.atk -= BALANCE.stabilityAtkMod;
    else if (state.resources.stability > BALANCE.stabilityHigh) mods.atk += BALANCE.stabilityAtkMod;
    if (isBuilt('bouclier')) mods.def += BALANCE.bouclierDefBase + getBuildingLevel('bouclier') * BALANCE.bouclierDefPerLevel;
    const re = activeEffects();
    mods.atk += re.mods.atk;
    mods.def += re.mods.def;
    return mods;
}

function buildUnitsFrom(ids, prefix) {
    const mods = getCombatMods();
    const hpBonus = activeEffects().hpBonus;
    return ids.map((id, i) => {
        const d = getUnit(id);
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

function rollDmg(atk, def, mult = 1) {
    const v = BALANCE.dmgVariance;
    return Math.max(1, Math.round((atk - def) * mult * (1 - v + Math.random() * 2 * v)));
}

function estimateBattle(attackers, defenders, runs = BALANCE.estimateRuns, opts = {}) {
    let wins = 0, retreats = 0;
    for (let i = 0; i < runs; i++) {
        const r = simulateBattle(structuredClone(attackers), structuredClone(defenders), opts);
        if (r.won) wins++;
        else if (r.retreated) retreats++;
    }
    return {win: wins / runs, retreat: retreats / runs};
}

function simulateBattle(playerUnits, enemyUnits, opts = {}) {
    const initial = structuredClone({player: playerUnits, enemy: enemyUnits});
    const events = [];
    let round = 0, retreated = false;

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

            const dmg = rollDmg(unit.atk, target.def);
            target.hp = Math.max(0, target.hp - dmg);

            if (unit.ability === 'cleave') {
                const second = enemies.find(e => e !== target && e.hp > 0);
                if (second) {
                    const dmg2 = rollDmg(unit.atk, second.def, 0.6);
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
        if (opts.retreatAt && enemyUnits.some(u => u.hp > 0)) {
            const left = playerUnits.reduce((t, u) => t + Math.max(0, u.hp), 0);
            const full = playerUnits.reduce((t, u) => t + u.maxHp, 0) || 1;
            if (left > 0 && left / full < opts.retreatAt) {
                retreated = true;
                events.push({t: 'retreat'});
                break;
            }
        }
    }

    const won = !retreated && playerUnits.some(u => u.hp > 0);
    return {
        events,
        won,
        retreated,
        survivors: playerUnits.filter(u => u.hp > 0 && !u.hero).map(u => u.id),
        heroesDown: playerUnits.filter(u => u.hero && u.hp <= 0).map(u => u.id),
        finalUnits: playerUnits.map(u => ({uid: u.uid, id: u.id, hp: u.hp, hero: !!u.hero})),
        initial
    };
}

function startBattleState(sim, mode) {
    battleState = {player: sim.initial.player, enemy: sim.initial.enemy, log: [], round: 0, mode};
    const byUid = {};
    [...battleState.player, ...battleState.enemy].forEach(u => byUid[u.uid] = u);
    return byUid;
}

function applyBattleEvent(ev, byUid) {
    const log = (text, type) => battleState.log.push({text, type});
    const src = byUid[ev.src], tgt = byUid[ev.tgt];
    if (ev.t === 'round') {
        battleState.round = ev.round;
    } else if (ev.t === 'dodge') {
        log(src.icon + ' → ' + tgt.icon + ' Esquivé !', 'dodge');
    } else if (ev.t === 'attack') {
        tgt.hp = ev.hp;
        log(src.icon + ' ' + src.name + ' → ' + tgt.icon + ' ' + tgt.name + ' -' + ev.dmg + ' PV' + (ev.kill ? ' ☠️' : ''), ev.kill ? 'kill' : 'hit');
    } else if (ev.t === 'ability' && ev.kind === 'aura') {
        log(src.icon + ' Aura de Calcul — +2 ATK pour les alliés', 'heal');
    } else if (ev.t === 'ability' && ev.kind === 'cleave') {
        const tgt2 = byUid[ev.tgt2];
        tgt.hp = ev.hp;
        tgt2.hp = ev.hp2;
        log(src.icon + ' ' + src.name + ' Frappe Croisée → ' + tgt.icon + ' -' + ev.dmg + ' PV' + (ev.kill ? ' ☠️' : '') + ' / ' + tgt2.icon + ' -' + ev.dmg2 + ' PV' + (ev.kill2 ? ' ☠️' : ''), (ev.kill || ev.kill2) ? 'kill' : 'hit');
    } else if (ev.t === 'retreat') {
        log('🏳️ Repli ordonné — les survivants rompent le combat', 'dodge');
    } else if (ev.t === 'roundEnd') {
        for (const h of ev.heals) {
            const u = byUid[h.uid];
            u.hp = h.hp;
            log(u.icon + ' +' + h.amount + ' PV', 'heal');
        }
    }
}

async function playBattle(sim) {
    const byUid = startBattleState(sim, '2d');
    renderBattle();
    await delay(600 / battleSpeed);

    for (const ev of sim.events) {
        battleSfx(ev);
        applyBattleEvent(ev, byUid);
        if (ev.t === 'round') continue;
        renderBattle();
        if (ev.t === 'dodge') {
            showFloat(ev.tgt, 'Esquivé', 'dodge');
            await delay(300 / battleSpeed);
        } else if (ev.t === 'attack' || ev.kind === 'cleave') {
            highlightCard(ev.src, 'attacking');
            highlightCard(ev.tgt, 'hit');
            showFloat(ev.tgt, '-' + ev.dmg, 'damage');
            if (ev.tgt2) {
                highlightCard(ev.tgt2, 'hit');
                showFloat(ev.tgt2, '-' + ev.dmg2, 'damage');
            }
            await delay((ev.tgt2 ? 400 : 350) / battleSpeed);
            clearHighlights();
        } else if (ev.kind === 'aura') {
            await delay(300 / battleSpeed);
        } else if (ev.t === 'retreat') {
            await delay(500 / battleSpeed);
        } else if (ev.t === 'roundEnd') {
            for (const h of ev.heals) showFloat(h.uid, '+' + h.amount, 'heal');
            await delay(200 / battleSpeed);
        }
    }

    await showResult(sim.won, sim.retreated);
}

const BATTLE3D_MS = {dodge: 340, attack: 420, aura: 500, cleave: 460, roundEnd: 200};

async function playBattle3D(sim) {
    const byUid = startBattleState(sim, '3d');
    renderBattle();
    await Battle3D.ready();
    Battle3D.mount(document.getElementById('battle3d-view'));
    Battle3D.setup(battleState.player, battleState.enemy);
    await delay(600 / battleSpeed);

    for (const ev of sim.events) {
        battleSfx(ev);
        applyBattleEvent(ev, byUid);
        renderBattle();
        const ms = BATTLE3D_MS[ev.t === 'ability' ? ev.kind : ev.t];
        if (ev.t === 'retreat') await delay(500 / battleSpeed);
        else if (ms) await Battle3D.play(ev, ms / battleSpeed);
    }

    await showResult(sim.won, sim.retreated);
    Battle3D.stop();
}

async function runBattle(attackers, defenders, opts = {}) {
    const sim = simulateBattle(attackers, defenders, opts);
    for (const id of sim.heroesDown) {
        state.heroWounded[id] = BALANCE.heroWoundTurns;
        const h = HEROES.find(x => x.id === id);
        if (h) addLog(h.icon + ' ' + h.name + ' est blessé (' + BALANCE.heroWoundTurns + ' tours)', 'warning');
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

function showResult(won, retreated) {
    sfx(won ? 'victory' : retreated ? 'retreat' : 'defeat');
    return new Promise(resolve => {
        const div = document.createElement('div');
        div.className = 'result-overlay ' + (won ? 'win' : 'lose');
        div.innerHTML = '<div class="ro-band"><h2>' + (won ? 'Victoire' : retreated ? 'Repli' : 'Défaite') + '</h2></div>';
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
    sfx('build');
    save();
    render();
}

function unitCost(u) {
    const off = activeEffects().unitDiscount;
    if (!off || !u.cost.materials) return u.cost;
    return {...u.cost, materials: Math.max(1, u.cost.materials - off)};
}

function recruitUnit(id) {
    const u = getUnit(id);
    if (!u) return;
    const cost = unitCost(u);
    if (!canAfford(cost)) return;
    if (!u.always && u.building && !isBuilt(u.building)) return;
    const atHome = state.map.armyAt === 'alpha7' && !state.map.armyDest;
    const toArmy = atHome && getArmySize() + u.size <= getArmyCap();
    for (const [k, v] of Object.entries(cost)) state.resources[k] -= v;
    state.stats.recruited++;
    if (toArmy) {
        state.army.push(id);
        addLog(u.icon + ' ' + u.name + ' recruté (armée)', 'build');
    } else {
        state.map.garrisons.alpha7.push(id);
        addLog(u.icon + ' ' + u.name + ' recruté (garnison Alpha-7)', 'build');
    }
    sfx('recruit');
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
    const u = getUnit(g[idx]);
    if (!u || getArmySize() + u.size > getArmyCap()) return;
    if (!payTransfer()) return;
    state.army.push(g.splice(idx, 1)[0]);
    save();
    render();
}

function departArmy(dest, isAttack, leave = []) {
    const m = state.map;
    if (state.phase !== 'build' || m.armyDest || !m.armyAt) return;
    if (state.army.length === 0) return;
    const t = linkTurns(m.armyAt, dest);
    if (!t) return;
    const friendly = isHeld(dest);
    if (isAttack === friendly) return;
    const canLeave = m.owner[m.armyAt] === 'player';
    const kept = canLeave ? leave.filter(i => i >= 0 && i < state.army.length) : [];
    if (kept.length >= state.army.length) return;
    if (!spendCommand(1)) return;
    if (kept.length) {
        if (!m.garrisons[m.armyAt]) m.garrisons[m.armyAt] = [];
        const stay = new Set(kept);
        m.garrisons[m.armyAt].push(...state.army.filter((_, i) => stay.has(i)));
        state.army = state.army.filter((_, i) => !stay.has(i));
        addLog('🛡️ ' + kept.length + ' unité(s) restent en garnison à ' + getNode(m.armyAt).name, '');
    }
    m.armyFrom = m.armyAt;
    m.armyDest = dest;
    m.armyEta = t;
    m.armyAt = null;
    const node = getNode(dest);
    addLog((isAttack ? '⚔️ Assaut lancé sur ' : '🚚 Armée en route vers ') + node.name + ' — ' + t + ' tour(s)', isAttack ? 'warning' : '');
    save();
    render();
    pulseNode(dest, isAttack ? 'hostile' : 'player');
}

function moveArmy(dest) {
    departArmy(dest, false);
}

function attackNode(dest, leave = []) {
    departArmy(dest, true, leave);
}

function setRetreat(v) {
    state.retreatAt = v;
    save();
}

function getAllyCost(node) {
    const raids = state.map.raided[node.id] || 0;
    return Math.max(BALANCE.allyMinCost, node.allyCost - activeEffects().allyDiscount - raids * BALANCE.raidAllyDiscount);
}

function allyCity(id) {
    const m = state.map;
    const node = getNode(id);
    if (!node || node.type !== 'city' || m.owner[id] !== 'neutral' || m.allied[id]) return;
    const cost = getAllyCost(node);
    if ((state.resources.influence || 0) < cost) return;
    if (!spendCommand(1)) return;
    state.resources.influence -= cost;
    sealAlliance(id);
    save();
    render();
}

function sealAlliance(id, msg) {
    const m = state.map;
    const node = getNode(id);
    m.allied[id] = true;
    addLog(msg || '🤝 Alliance scellée avec ' + node.name, 'chapter');
    const d = cityDividend(node);
    if (d) addLog('↳ ' + d.name + ' : ' + d.desc, 'chapter');
    if (d && d.effect && d.effect.gift && !m.gifted[id]) {
        m.gifted[id] = true;
        const atHome = m.armyAt === 'alpha7' && !m.armyDest;
        for (const uid of d.effect.gift) {
            if (atHome && getArmySize() + getUnit(uid).size <= getArmyCap()) state.army.push(uid);
            else m.garrisons.alpha7.push(uid);
        }
        addLog('🎁 ' + node.name + ' envoie ' + d.effect.gift.map(u => getUnit(u).name).join(', '), 'build');
    }
    sfx('alliance');
    pulseNode(id, 'allied');
}

function fortifyNode(id) {
    const m = state.map;
    if (m.owner[id] !== 'player' || m.fortified[id]) return;
    if (!spendCommand(1)) return;
    m.fortified[id] = true;
    addLog('🧱 ' + getNode(id).name + ' fortifié — +' + BALANCE.fortifyDef + ' DEF au prochain combat', 'build');
    save();
    render();
    pulseNode(id, 'neutral');
}

function getChapterFromMap() {
    const m = state.map;
    let ch = 1;
    for (const node of MAP_NODES) {
        if (!node.unlocksChapter) continue;
        if (isHeld(node.id)) ch = Math.max(ch, node.unlocksChapter);
    }
    return ch;
}

function dismissUnit(idx) {
    if (idx < 0 || idx >= state.army.length) return;
    const id = state.army[idx];
    const u = getUnit(id);
    state.army.splice(idx, 1);
    addLog(u.icon + ' ' + u.name + ' libéré', '');
    save();
    render();
}

function dismissGarrison(nodeId, idx) {
    const g = state.map.garrisons[nodeId] || [];
    if (idx < 0 || idx >= g.length) return;
    const u = getUnit(g[idx]);
    g.splice(idx, 1);
    addLog(u.icon + ' ' + u.name + ' libéré de la garnison de ' + getNode(nodeId).name, '');
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

function sizeOf(ids) {
    return ids.reduce((s, id) => {
        const u = getUnit(id);
        return s + (u ? u.size : 1);
    }, 0);
}

function getUpkeep() {
    const g = Object.values(state.map.garrisons).reduce((s, ids) => s + sizeOf(ids), 0);
    return Math.round((getArmySize() + g) * BALANCE.upkeepEnergyPerSize);
}

function getCampaignProduction() {
    const p = getProduction();
    const m = state.map;
    for (const node of MAP_NODES) {
        if (node.id === 'alpha7') continue;
        if (isHeld(node.id)) {
            for (const [k, v] of Object.entries(nodeProd(node))) p[k] += v;
        }
    }
    p.energy -= getUpkeep();
    p.stability -= conqueredCities(state) * BALANCE.occupationStability;
    return p;
}

function garrisonBudgetFor(node, turn = state.turn) {
    const m = state.map;
    let budget = Math.round(node.garrisonBudget * BALANCE.garrisonMult);
    if (node.type === 'capital') budget += Math.round(turn * BALANCE.capitalGrowth) - m.berlinWeakened - activeEffects().capitalWeaken;
    if (m.lost[node.id]) budget += Math.round(turn * BALANCE.reconquestSlope);
    return Math.max(BALANCE.garrisonMinBudget, budget);
}

function assaultUnits(nodeId, ids) {
    const units = buildUnitsFrom(ids, 'a').concat(buildHeroUnits());
    if (state.flags.revanche && state.map.lost[nodeId]) units.forEach(u => u.atk += BALANCE.revengeAtk);
    return units;
}

function defenseUnits(nodeId) {
    const m = state.map;
    let units = buildUnitsFrom(m.garrisons[nodeId] || [], 'g');
    if (m.armyAt === nodeId && !m.armyDest) units = units.concat(buildUnitsFrom(state.army, 'a')).concat(buildHeroUnits());
    const bonus = (m.fortified[nodeId] ? BALANCE.fortifyDef : 0) + (nodeId === 'alpha7' ? activeEffects().homeDef : 0);
    units.forEach(u => u.def += bonus);
    if (nodeId === 'alpha7' && activeEffects().homeRelief) units = units.concat(reliefUnits());
    return units;
}

function reliefBudget() {
    return BALANCE.reliefBase + Math.round(state.turn * BALANCE.reliefSlope);
}

function reliefUnits() {
    return generateForce(reliefBudget(), seedFor('relief') + state.seed + state.turn).map(u => ({...u, uid: 'm' + u.uid, side: 'player', relief: true}));
}

function tallyCombat(sim, key) {
    state.stats.unitsLost += sim.finalUnits.filter(u => !u.hero && u.hp <= 0).length;
    state.stats[key]++;
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
        const attackers = assaultUnits(c.node, state.army);
        const vengeance = state.flags.revanche && m.lost[c.node];
        if (vengeance) {
            addLog('⚔️ Serment de revanche : +' + BALANCE.revengeAtk + ' ATK', 'chapter');
        }
        if (node.id === 'berlin' && activeEffects().capitalWeaken) addLog('Failles d\'Hegemonia exploitées : garnison −' + activeEffects().capitalWeaken, 'chapter');
        const defenders = generateForce(garrisonBudgetFor(node), garrisonSeed(c.node));
        sim = await runBattle(attackers, defenders, {retreatAt: state.retreatAt});
        battleState = null;
        tallyCombat(sim, sim.won ? 'assaultsWon' : sim.retreated ? 'retreats' : 'assaultsLost');
        if (sim.won && m.fallenAllies[c.node]) {
            m.owner[c.node] = 'neutral';
            delete m.fallenAllies[c.node];
            state.army = survivorsOf(sim, 'a');
            sealAlliance(c.node, '🕊️ ' + node.name + ' est libérée et redevient votre alliée');
        } else if (sim.won) {
            m.owner[c.node] = 'player';
            state.army = survivorsOf(sim, 'a');
            if (!m.garrisons[c.node]) m.garrisons[c.node] = [];
            addLog('🏴 ' + node.name + ' est sous votre contrôle', 'chapter');
            if (vengeance) {
                state.resources.stability += BALANCE.revengeStability;
                addLog('Serment tenu : +' + BALANCE.revengeStability + '🏛️', 'chapter');
            }
            if (node.type === 'ruin' && !m.cacheLooted[c.node] && node.cache) {
                for (const [k, v] of Object.entries(node.cache)) state.resources[k] += v;
                m.cacheLooted[c.node] = true;
                addLog('📦 Cache récupérée : ' + fmtProd(node.cache), 'build');
            }
            if (node.type === 'city') {
                state.flags.citeConquise = true;
                state.resources.stability -= BALANCE.cityConquestStability;
                state.resources.influence -= BALANCE.cityConquestInfluence;
                addLog('Occupation de ' + node.name + ' : -' + BALANCE.cityConquestStability + '🏛️ -' + BALANCE.cityConquestInfluence + '🌐', 'warning');
            }
            if (node.weakensCapital && !m.weakenedBy[c.node]) {
                m.berlinWeakened += node.weakensCapital;
                m.weakenedBy[c.node] = true;
                addLog('✂️ Ravitaillement de Berlin coupé — garnison affaiblie', 'chapter');
            }
            if (node.type === 'capital') {
                clampRes();
                showEnding(resolveEnding());
                return true;
            }
        } else if (sim.retreated) {
            state.army = survivorsOf(sim, 'a');
            m.armyAt = m.armyFrom && isHeld(m.armyFrom) ? m.armyFrom : 'alpha7';
            state.resources.stability -= BALANCE.retreatStability;
            addLog('🏳️ Repli devant ' + node.name + ' : ' + state.army.length + ' unité(s) regagnent ' + getNode(m.armyAt).name + ', -' + BALANCE.retreatStability + '🏛️', 'warning');
        } else {
            state.army = [];
            m.armyAt = 'alpha7';
            state.resources.stability -= BALANCE.assaultLostStability;
            addLog('✗ Assaut sur ' + node.name + ' repoussé — l\'armée est perdue, -' + BALANCE.assaultLostStability + '🏛️', 'warning');
        }
    } else if (c.kind === 'allyDefense') {
        addLog('🛡️ Votre armée défend ' + node.name + ', votre alliée', 'warning');
        sim = await runBattle(buildUnitsFrom(state.army, 'a').concat(buildHeroUnits()), generateForce(c.threat.budget, c.threat.seed));
        battleState = null;
        tallyCombat(sim, sim.won ? 'defensesWon' : 'defensesLost');
        if (sim.won) {
            state.army = survivorsOf(sim, 'a');
            state.resources.influence += BALANCE.allyDefendInfluence;
            addLog('✓ ' + node.name + ' tient grâce à votre armée — +' + BALANCE.allyDefendInfluence + '🌐', 'build');
        } else {
            state.army = [];
            m.armyAt = 'alpha7';
            allyFalls(node);
        }
    } else {
        addLog('🛡️ ' + node.name + ' attaqué !', 'warning');
        const armyHere = m.armyAt === c.node && !m.armyDest;
        const defUnits = defenseUnits(c.node);
        delete m.fortified[c.node];
        const hd = c.node === 'alpha7' ? activeEffects().homeDef : 0;
        if (hd && defUnits.length) {
            addLog('🧱 Défenses préparées : +' + hd + ' DEF', 'build');
        }
        if (!defUnits.length) {
            sim = {won: false, finalUnits: []};
            addLog(node.name + ' est sans défense', 'warning');
        } else {
            sim = await runBattle(defUnits, generateForce(c.threat.budget, c.threat.seed));
            battleState = null;
        }
        tallyCombat(sim, sim.won ? 'defensesWon' : 'defensesLost');
        if (sim.won) {
            m.garrisons[c.node] = survivorsOf(sim, 'g');
            if (armyHere) state.army = survivorsOf(sim, 'a');
            if (c.node === 'alpha7' && BALANCE.siegeStability) {
                state.resources.stability -= BALANCE.siegeStability;
                addLog('✓ Alpha-7 tient bon — le siège use la population : -' + BALANCE.siegeStability + '🏛️', 'build');
            } else addLog('✓ ' + node.name + ' tient bon', 'build');
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
            state.resources.stability -= BALANCE.nodeLostStability;
            addLog('🔥 ' + node.name + ' est tombé — -' + BALANCE.nodeLostStability + '🏛️', 'warning');
        }
    }
    state.phase = 'build';
    clampRes();
    await phaseSwitch(() => render());
    return false;
}

function alliedStrength(node) {
    return node.garrisonBudget + BALANCE.alliedDefenseBase + Math.round(state.turn * BALANCE.alliedDefenseSlope) + activeEffects().alliedHold;
}

function allyFalls(node) {
    const m = state.map;
    delete m.allied[node.id];
    m.owner[node.id] = 'hostile';
    m.lost[node.id] = true;
    m.fallenAllies[node.id] = true;
    state.resources.influence -= BALANCE.allyFallInfluence;
    addLog('🔥 ' + node.name + ' (allié) est tombé aux mains d\'Hegemonia — -' + BALANCE.allyFallInfluence + '🌐. Reprenez-la pour la libérer', 'warning');
}

function alliedHolds(th) {
    const node = getNode(th.nodeId);
    const militia = generateForce(alliedStrength(node), th.seed + seedFor(node.id)).map(u => ({...u, uid: 'm' + u.uid, side: 'player'}));
    return simulateBattle(militia, generateForce(th.budget, th.seed)).won;
}

function resolveAlliedDefense(th, holds = alliedHolds(th)) {
    const node = getNode(th.nodeId);
    if (!holds) allyFalls(node);
    else addLog('🛡️ ' + node.name + ' (allié) a repoussé la menace seul', 'build');
}

function resolveRaid(th) {
    const m = state.map;
    const node = getNode(th.nodeId);
    m.raided[node.id] = (m.raided[node.id] || 0) + 1;
    addLog('⚔️ Hegemonia a razzié ' + node.name + ' — la cité cherche des alliés : alliance −' + BALANCE.raidAllyDiscount + '🌐', 'warning');
}

function armyGuards(nodeId) {
    const m = state.map;
    return m.armyAt === nodeId && !m.armyDest && state.army.length > 0;
}

function heldTerritories(s = state) {
    return MAP_NODES.filter(n => n.id !== 'alpha7' && isHeld(n.id, s)).length;
}

function threatBudget(turn) {
    return Math.round(BALANCE.threatBudgetBase + turn * BALANCE.threatBudgetSlope + heldTerritories() * BALANCE.threatBudgetPerTerritory);
}

function firstThreatTurn() {
    return BALANCE.threatFirstTurn + state.seed % (BALANCE.threatFirstWindow + 1);
}

function threatSeed(turn) {
    return turn * 917 + 3 + state.seed;
}

function spawnThreats() {
    const m = state.map;
    const late = state.turn >= BALANCE.threatLateTurn;
    const held = heldTerritories();
    const cap = (late ? BALANCE.threatCapLate : BALANCE.threatCapEarly) + Math.floor(held / BALANCE.threatCapTerritoryStep);
    const cadence = Math.max(1, (late ? BALANCE.threatCadenceLate : BALANCE.threatCadenceEarly) - Math.floor(held / BALANCE.threatCadenceTerritoryStep));
    if (state.turn < firstThreatTurn()) return;
    if (m.threats.length >= cap) return;
    if (state.turn - m.lastThreatTurn < cadence) return;
    const targets = [];
    let total = 0;
    for (const node of MAP_NODES) {
        const w = node.id === 'alpha7' ? BALANCE.threatHomeWeight : m.owner[node.id] === 'player' ? BALANCE.threatOwnedWeight : m.allied[node.id] ? BALANCE.threatAlliedWeight : node.type === 'city' && m.owner[node.id] === 'neutral' ? BALANCE.threatNeutralWeight : 0;
        if (w > 0) {
            targets.push({id: node.id, w});
            total += w;
        }
    }
    if (!total) return;
    const rng = seededRng(state.turn * 6151 + 41 + state.seed);
    let r = rng() * total;
    const nodeId = (targets.find(t => (r -= t.w) < 0) || targets[targets.length - 1]).id;
    const preavis = BALANCE.threatWarning + activeEffects().threatWarning;
    m.threats.push({nodeId, arrivesIn: preavis, budget: threatBudget(state.turn), seed: threatSeed(state.turn)});
    m.lastThreatTurn = state.turn;
    addLog('⚠️ Menace détectée sur ' + getNode(nodeId).name + ' — arrivée dans ' + preavis + ' tours', 'warning');
}

let endTurnBusy = false;

function checkCollapse() {
    if (state.resources.stability <= 0) showDefeat('revolte');
    else if (state.resources.energy <= 0) showDefeat('blackout');
    else return false;
    return true;
}

async function endTurn() {
    if (state.phase !== 'build' || endTurnBusy) return;
    endTurnBusy = true;
    try {
        await runTurn();
    } finally {
        endTurnBusy = false;
    }
}

async function runTurn() {
    const m = state.map;

    const prod = getCampaignProduction();
    for (const [k, v] of Object.entries(prod)) state.resources[k] += v;
    state.resources.stability += stabilityDrift();
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
        else if (m.allied[th.nodeId]) {
            const holds = alliedHolds(th);
            if (!holds && armyGuards(th.nodeId)) combats.push({kind: 'allyDefense', node: th.nodeId, threat: th});
            else resolveAlliedDefense(th, holds);
        }
        else if (m.owner[th.nodeId] === 'neutral') resolveRaid(th);
    }

    for (const c of combats) {
        if (await resolveCombat(c)) return;
    }

    if (checkCollapse()) return;

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
    if (newCh > state.chapter) {
        state.chapter = newCh;
        pendingScreens.push({type: 'chapter', chapter: newCh});
    }

    state.turn++;
    state.command = getCommandMax();
    tickHeroWounds();
    state.phase = 'build';
    endTurnBusy = false;
    save();
    render();
    toast('Tour ' + state.turn + ' · production ' + fmtProd(prod), '');
    sfx('turn');
    const fresh = m.lastThreatTurn === state.turn - 1 ? m.threats[m.threats.length - 1] : null;
    if (fresh) {
        toast('Menace détectée sur ' + getNode(fresh.nodeId).name, 'warning');
        sfx('threat');
        pulseNode(fresh.nodeId, 'hostile');
    }
    processNext();
}

function fmtProd(p) {
    const icons = {energy: '⚡', materials: '🔩', data: '💾', stability: '🏛️', influence: '🌐'};
    return Object.entries(p).filter(([, v]) => v).map(([k, v]) => (v > 0 ? '+' : '') + v + icons[k]).join(' ');
}

function eventTurn(e) {
    return e.turn + (e.window ? ((seedFor(e.id) % 9973) + state.seed) % (e.window + 1) : 0);
}

function findEvent() {
    return EVENTS.find(e => !state.eventsSeen.includes(e.id) && state.turn >= eventTurn(e) && state.turn <= e.turn + (e.window || 0) && (!e.requires || e.requires(state)));
}

function findMilestone() {
    return MILESTONES.find(mi => !state.eventsSeen.includes(mi.id) && mi.trigger(state));
}

function processNext() {
    if (!pendingScreens.length) return;
    const s = pendingScreens.shift();
    if (s.type === 'chapter') showChapter(s.chapter);
    else if (s.type === 'event') showEvent(s.event);
    guideUpdate();
}

function showEvent(evt) {
    sfx('event');
    const ov = document.getElementById('event-overlay');
    const avail = evt.choices.filter(c => !c.requires || c.requires(state));
    let html = '<div id="event-modal" class="plate"><div class="eyebrow">' + (evt.id.startsWith('ms_') ? 'Jalon' : 'Événement') + ' · Tour ' + state.turn + '</div><h2>' + evt.title + '</h2><div class="rule"></div><div class="event-text" id="evt-text"></div><div class="event-choices" id="evt-ch" style="display:none">';
    avail.forEach((c, i) => {
        html += '<button class="choice" onclick="onEvtChoice(' + i + ')"><span>' + richText(c.text) + (c.hint ? '<small class="choice-hint">' + richText(c.hint) + '</small>' : '') + '</span>' + (c.effects ? fxHtml(c.effects) : '') + '</button>';
    });
    html += '</div></div>';
    ov.innerHTML = html;
    ov.classList.add('active');
    ov._choices = avail;
    const text = evt.text + (evt.echoes || []).filter(x => x.if(state)).map(x => ' ' + x.text).join('');
    startTw(text, document.getElementById('evt-text'), () => {
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
    if (c.ally && state.map.owner[c.ally] === 'neutral' && !state.map.allied[c.ally]) sealAlliance(c.ally);
    if (c.hint) addLog('↳ ' + c.hint, 'chapter');
    clampRes();
    ov.classList.remove('active');
    ov.innerHTML = '';
    if (c.defeat) {
        showDefeat(c.defeat);
        return;
    }
    if (c.ending) {
        showEnding(c.ending);
        return;
    }
    if (checkCollapse()) return;
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
    ov.innerHTML = '<div class="chapter-box plate"><div class="eyebrow">Chapitre</div><div class="ch-num">' + roman(info.num) + '</div><h2>' + chapterTitle(info) + '</h2><div class="ch-sub">' + info.sub + '</div><div class="rule"></div><p>' + info.desc + '</p><button class="btn btn-primary" onclick="dismissCh()">Continuer</button></div>';
    ov.classList.add('active');
    addLog('═══ Chapitre ' + info.num + ' : ' + info.name + ' ═══', 'chapter');
}

function dismissCh() {
    document.getElementById('chapter-overlay').classList.remove('active');
    processNext();
    guideUpdate();
}

function showDefeat(type) {
    sfx('defeat');
    pendingScreens = [];
    const d = DEFEATS[type];
    document.getElementById('end-content').innerHTML = '<div class="defeat"><h1>' + d.title + '</h1></div><div class="end-sub">Défaite · Tour ' + state.turn + '</div><div class="rule"></div><div class="end-text">' + d.text + '</div>' + recapHtml(null) + statsHtml() + '<button class="btn btn-primary" onclick="backToTitle()">Retour au menu</button>';
    showScreen('end-screen');
    deleteSave();
}

function resolveEnding() {
    return Object.keys(ENDINGS).find(k => ENDINGS[k].check && ENDINGS[k].check(state));
}

function recapHtml(id) {
    const e = id ? ENDINGS[id] : null;
    const items = Object.entries(DECISIONS).filter(([f, d]) => state.flags[f] && d.recap).map(([, d]) => '<li>' + esc(d.recap) + '</li>').join('');
    const others = Object.entries(ENDINGS).filter(([k]) => k !== id).map(([, o]) => '<li><b>' + o.title + '</b> — ' + esc(o.hint) + '</li>').join('');
    return '<div class="end-why">' + (e ? '<h3>Pourquoi cette fin</h3><p>' + esc(e.why) + '</p>' : '') + '<p class="end-facts">Cités alliées : ' + alliedCities(state) + ' · Cités conquises : ' + conqueredCities(state) + ' · Confiance en PROMETHEUS : ' + iaTrust(state) + '/6</p>' + (items ? '<h3>Vos choix marquants</h3><ul>' + items + '</ul>' : '') + '<h3>Autres destins possibles</h3><ul class="end-others">' + others + '</ul></div>';
}

function showEnding(id) {
    sfx('victory');
    pendingScreens = [];
    const e = ENDINGS[id];
    document.getElementById('end-content').innerHTML = '<h1>' + e.title + '</h1><div class="end-sub">Victoire · ' + e.sub + ' · Tour ' + state.turn + '</div><div class="rule"></div><div class="end-text">' + e.text + '</div>' + recapHtml(id) + statsHtml() + '<button class="btn btn-primary" onclick="backToTitle()">Retour au menu</button>';
    showScreen('end-screen');
    deleteSave();
}

function statsHtml() {
    const st = state.stats;
    const box = (v, l) => '<div class="stat-box"><div class="sv">' + v + '</div><div class="sl">' + l + '</div></div>';
    return '<div class="end-stats">' + box(state.turn, 'Tours') + box(state.buildings.length, 'Bâtiments') + box(state.eventsSeen.length, 'Événements') + box(st.assaultsWon, 'Assauts gagnés') + box(st.assaultsLost, 'Assauts perdus') + box(st.retreats, 'Replis') + box(st.defensesWon, 'Défenses tenues') + box(st.defensesLost, 'Défenses perdues') + box(st.recruited, 'Recrues') + box(st.unitsLost, 'Unités perdues') + '</div>';
}

function backToTitle() {
    deleteSave();
    showScreen('title-screen');
    checkContinue();
    mountTitleMap();
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    guideUpdate();
}

function checkContinue() {
    const s = readSave();
    document.getElementById('btn-continue').style.display = s ? '' : 'none';
    document.getElementById('btn-new').className = 'btn ' + (s ? 'btn-ghost' : 'btn-primary');
    renderSaveInfo(s);
}

function askNewGame() {
    const s = readSave();
    if (!s) return newGame();
    showNewGameConfirm(s);
}

function setSpeed(s) {
    battleSpeed = s;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('spd' + s).classList.add('active');
}

function resetView() {
    selectedNode = null;
    openDrawer = null;
    centerView = 'map';
    lastCommand = null;
    lastResources = null;
}

function newGame(diff) {
    deleteSave();
    const d = DIFFICULTIES[diff] ? diff : difficultyPref();
    applyDifficulty(d);
    state = defaultState();
    state.difficulty = d;
    state.guide = newGuide(guidePref());
    resetView();
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
    resetView();
    showScreen('game-screen');
    render();
}
