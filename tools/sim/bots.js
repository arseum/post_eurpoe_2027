const RES_KEYS = ['energy', 'materials', 'data', 'stability', 'influence'];

class Ctx {
    constructor(game) {
        this.g = game;
        this.G = game.G;
        this.D = game.D;
        this.rng = game.rng;
    }

    get s() {
        return this.g.state();
    }

    get m() {
        return this.s.map;
    }

    nodes() {
        return this.D('MAP_NODES') || [];
    }

    node(id) {
        return this.nodes().find(n => n.id === id);
    }

    unit(id) {
        return (this.D('UNITS') || []).find(u => u.id === id);
    }

    building(id) {
        return (this.D('BUILDINGS') || []).find(b => b.id === id);
    }

    research(id) {
        return (this.D('RESEARCH') || []).find(r => r.id === id);
    }

    neighbors(id) {
        const out = new Map();
        const n = this.node(id);
        if (n) for (const l of n.links) out.set(l.to, l.turns);
        for (const o of this.nodes()) for (const l of o.links) if (l.to === id && !out.has(o.id)) out.set(o.id, l.turns);
        return [...out.entries()].map(([to, turns]) => ({to, turns}));
    }

    friendly(id) {
        return this.m.owner[id] === 'player' || !!this.m.allied[id];
    }

    cmd() {
        return this.s.command;
    }

    tryCmd(fn) {
        const before = this.s.command;
        const snap = JSON.stringify(this.s.resources) + this.s.buildings.length + this.s.research.length + this.s.core;
        fn();
        return this.s.command < before || snap !== JSON.stringify(this.s.resources) + this.s.buildings.length + this.s.research.length + this.s.core;
    }

    afford(cost, reserve, raw) {
        for (const [k, v] of Object.entries(cost || {})) if ((this.s.resources[k] || 0) - v < (reserve && reserve[k] || 0)) return false;
        if (!raw && cost && cost.energy && this.s.resources.energy - cost.energy + Math.min(0, this.netEnergy()) < 10) return false;
        return true;
    }

    canRecruit(id) {
        const u = this.unit(id);
        if (!u) return false;
        return !!(u.always || !u.building || this.G.isBuilt(u.building));
    }

    armyHome() {
        return this.m.armyAt === 'alpha7' && !this.m.armyDest;
    }

    armySize() {
        return this.G.getArmySize();
    }

    armyCap() {
        return this.G.getArmyCap();
    }

    garrison(id) {
        return this.m.garrisons[id] || [];
    }

    units(ids, prefix) {
        return this.G.buildUnitsFrom(ids, prefix);
    }

    battle(attackers, budget, seed) {
        const enemy = this.G.generateForce(budget, seed);
        const r = this.G.simulateBattle(attackers, enemy);
        const hpLeft = r.finalUnits.reduce((s, u) => s + Math.max(0, u.hp), 0);
        const hpMax = attackers.reduce((s, u) => s + u.maxHp, 0) || 1;
        return {won: r.won, margin: r.won ? hpLeft / hpMax : 0};
    }

    hasDodge(ids) {
        return ids.some(id => (this.unit(id) || {}).dodge);
    }

    estimate(makeUnits, budget, seeds, ids) {
        const trials = this.hasDodge(ids) ? 4 : 1;
        let wins = 0, margin = 0, n = 0;
        for (const seed of seeds) {
            for (let t = 0; t < trials; t++) {
                const r = this.battle(makeUnits(), budget, seed);
                wins += r.won ? 1 : 0;
                margin += r.margin;
                n++;
            }
        }
        return {p: wins / n, margin: margin / n};
    }

    assaultEstimate(target, eta) {
        const s = this.s;
        const arrival = s.turn + Math.max(0, eta - 1);
        const node = this.node(target);
        const saved = s.turn;
        let budgetNow, budgetArr;
        try {
            budgetNow = this.G.garrisonBudgetFor(node);
            s.turn = arrival;
            budgetArr = this.G.garrisonBudgetFor(node);
        } finally {
            s.turn = saved;
        }
        const seedBase = this.G.seedFor(target);
        const ids = s.army;
        const mk = () => this.units(ids, 'a').concat(this.G.buildHeroUnits());
        const a = this.estimate(mk, budgetNow, [seedBase + s.turn], ids);
        const b = this.estimate(mk, budgetArr, [seedBase + arrival, seedBase + arrival + 1], ids);
        return {p: Math.min(a.p, b.p), margin: Math.min(a.margin, b.margin)};
    }

    defenseEstimate(nodeId, budget, seed, opts = {}) {
        const g = (opts.garrison || this.garrison(nodeId)).slice();
        const withArmy = opts.withArmy !== undefined ? opts.withArmy : (this.m.armyAt === nodeId && !this.m.armyDest);
        const fort = opts.fortify || !!this.m.fortified[nodeId];
        const ids = withArmy ? g.concat(this.s.army) : g;
        if (!ids.length && !(withArmy && this.G.buildHeroUnits().length)) return {p: 0, margin: 0};
        const mk = () => {
            let u = this.units(g, 'g');
            if (withArmy) u = u.concat(this.units(this.s.army, 'a')).concat(this.G.buildHeroUnits());
            if (fort) u.forEach(x => x.def += 3);
            return u;
        };
        return this.estimate(mk, budget, [seed], ids);
    }

    projectedThreatBudget(turnsAhead) {
        return this.G.threatBudget(this.s.turn + turnsAhead);
    }

    projectedThreatSeed(turnsAhead) {
        return (this.s.turn + turnsAhead) * 917 + 3 + (this.s.seed || 0);
    }

    bal(k) {
        return (this.D('BALANCE') || {})[k];
    }

    netEnergy() {
        return this.G.getCampaignProduction().energy;
    }

    upkeepOk(id, horizon) {
        const u = this.unit(id);
        const rate = this.bal('upkeepEnergyPerSize') || 0;
        if (!u || !rate) return true;
        const after = this.netEnergy() - Math.ceil(u.size * rate);
        const stock = this.s.resources.energy - (u.cost.energy || 0);
        return after >= 0 || stock + after * horizon > 30;
    }

    path(from, to) {
        const dist = {[from]: 0}, prev = {}, done = new Set();
        while (true) {
            let cur = null;
            for (const [k, v] of Object.entries(dist)) if (!done.has(k) && (cur === null || v < dist[cur])) cur = k;
            if (cur === null) return null;
            if (cur === to) break;
            done.add(cur);
            for (const {to: nb, turns} of this.neighbors(cur)) {
                if (nb !== to && !this.friendly(nb)) continue;
                if (nb === to && !this.friendly(nb)) continue;
                const d = dist[cur] + turns;
                if (dist[nb] === undefined || d < dist[nb]) {
                    dist[nb] = d;
                    prev[nb] = cur;
                }
            }
        }
        const steps = [];
        let c = to;
        while (c !== from) {
            steps.unshift(c);
            c = prev[c];
        }
        return {turns: dist[to], steps};
    }

    approach(from, target) {
        if (!this.friendly(from)) return null;
        let best = null;
        for (const {to: f, turns} of this.neighbors(target)) {
            if (!this.friendly(f)) continue;
            const p = f === from ? {turns: 0, steps: []} : this.path(from, f);
            if (!p) continue;
            const total = p.turns + turns;
            if (!best || total < best.total) best = {total, staging: f, steps: p.steps, last: turns};
        }
        return best;
    }
}

function unitScore(u) {
    return (u.hp + (u.heals || 0) * 5) * (u.atk + u.def * 0.8) * (1 + (u.dodge || 0)) * (u.spd >= 6 ? 1.1 : 1);
}

function costSum(cost) {
    return Object.values(cost || {}).reduce((a, b) => a + b, 0);
}

function bestArmyUnit(c, room, reserve) {
    let best = null;
    for (const u of c.D('UNITS') || []) {
        if (!c.canRecruit(u.id) || u.size > room || !c.afford(u.cost, reserve) || !c.upkeepOk(u.id, 15)) continue;
        const score = unitScore(u) / u.size;
        if (!best || score > best.score) best = {id: u.id, score, size: u.size};
    }
    return best;
}

function bestGarrisonUnit(c, reserve, horizon = 15) {
    let best = null;
    for (const u of c.D('UNITS') || []) {
        if (!c.canRecruit(u.id) || !c.afford(u.cost, reserve) || !c.upkeepOk(u.id, horizon)) continue;
        const score = unitScore(u) / Math.max(1, costSum(u.cost));
        if (!best || score > best.score) best = {id: u.id, score};
    }
    return best;
}

function recruitTo(c, id) {
    const s = c.s;
    const before = s.army.length + c.garrison('alpha7').length;
    c.G.recruitUnit(id);
    return s.army.length + c.garrison('alpha7').length > before;
}

function affordableGarrison(c, reserve) {
    const res = {...c.s.resources};
    const ids = [];
    let guard = 0;
    while (guard++ < 60) {
        let best = null;
        for (const u of c.D('UNITS') || []) {
            if (!c.canRecruit(u.id)) continue;
            let ok = true;
            for (const [k, v] of Object.entries(u.cost)) if ((res[k] || 0) - v < (reserve[k] || 0)) ok = false;
            if (!ok) continue;
            const score = unitScore(u) / Math.max(1, costSum(u.cost));
            if (!best || score > best.score) best = {u, score};
        }
        if (!best) break;
        for (const [k, v] of Object.entries(best.u.cost)) res[k] -= v;
        ids.push(best.u.id);
    }
    return ids;
}

function upkeepGuard(c) {
    const s = c.s;
    let guard = 0;
    while (c.netEnergy() < 0 && s.resources.energy + c.netEnergy() * 4 < 15 && guard++ < 20) {
        const g = c.garrison('alpha7');
        const homeSafe = !c.m.threats.some(t => t.nodeId === 'alpha7' && t.arrivesIn <= 2);
        if (g.length > 2 && homeSafe) {
            const i = g.map((id, j) => ({j, u: c.unit(id)})).sort((a, b) => unitScore(a.u) / costSum(a.u.cost) - unitScore(b.u) / costSum(b.u.cost))[0].j;
            c.G.dismissGarrison('alpha7', i);
        } else if (s.army.length) {
            const weakest = s.army.map((id, i) => ({i, u: c.unit(id)})).filter(x => x.u).sort((a, b) => unitScore(a.u) - unitScore(b.u))[0];
            c.G.dismissUnit(weakest.i);
        } else break;
    }
}

function homeHoldsWithoutArmy(c, P) {
    const m = c.m;
    const g = c.garrison('alpha7').concat(affordableGarrison(c, {}));
    for (const th of m.threats.filter(t => t.nodeId === 'alpha7')) {
        const e = c.defenseEstimate('alpha7', th.budget, th.seed, {withArmy: false, garrison: g, fortify: th.arrivesIn <= 1});
        if (e.p < 1) return false;
    }
    const e = c.defenseEstimate('alpha7', c.projectedThreatBudget(P.homeLookahead), c.projectedThreatSeed(P.homeLookahead), {withArmy: false, garrison: g});
    return e.p >= 1 && e.margin >= P.defMargin * 0.5;
}

function defendHome(c, P, plan) {
    const m = c.m;
    const homeThreats = m.threats.filter(t => t.nodeId === 'alpha7').sort((a, b) => a.arrivesIn - b.arrivesIn);
    const armyHome = c.armyHome();
    for (const th of homeThreats) {
        let guard = 0;
        const withArmy = armyHome;
        let est = c.defenseEstimate('alpha7', th.budget, th.seed, {withArmy});
        while ((est.p < 1 || est.margin < P.defMargin) && guard++ < 40) {
            const u = bestGarrisonUnit(c, {}, th.arrivesIn <= 1 ? 3 : 6);
            if (!u || !recruitTo(c, u.id)) break;
            est = c.defenseEstimate('alpha7', th.budget, th.seed, {withArmy});
        }
        if (est.p < 1 && th.arrivesIn <= 1 && !m.fortified.alpha7 && c.cmd() > 0) {
            c.G.fortifyNode('alpha7');
            est = c.defenseEstimate('alpha7', th.budget, th.seed, {withArmy});
        }
        if (armyHome) {
            const alone = c.defenseEstimate('alpha7', th.budget, th.seed, {withArmy: false, garrison: c.garrison('alpha7').concat(affordableGarrison(c, {}))});
            if (alone.p < 1) plan.holdArmy = true;
        }
        if (est.p < 1 && !armyHome && !m.armyDest && m.armyAt && !plan.moved && c.cmd() > 0) {
            const p = c.path(m.armyAt, 'alpha7');
            if (p && p.turns <= th.arrivesIn) {
                c.G.moveArmy(p.steps[0]);
                plan.moved = true;
            }
        }
    }
}

function defendOutposts(c, P, plan) {
    const m = c.m, s = c.s;
    if (m.armyDest || !m.armyAt || m.armyAt === 'alpha7') return;
    const here = m.armyAt;
    const th = m.threats.filter(t => t.nodeId === here).sort((a, b) => a.arrivesIn - b.arrivesIn)[0];
    if (!th || th.arrivesIn > 3) return;
    if (P.garrisonConquests && c.cmd() > 0) {
        const order = s.army.map((id, i) => ({id, i, u: c.unit(id)})).filter(x => x.u).sort((a, b) => unitScore(a.u) - unitScore(b.u));
        const pick = [];
        for (const x of order) {
            if (pick.length >= Math.floor(s.army.length / 2)) break;
            pick.push(x);
            const g = c.garrison(here).concat(pick.map(y => y.id));
            const e = c.defenseEstimate(here, th.budget, th.seed, {withArmy: false, garrison: g, fortify: th.arrivesIn <= 1});
            if (e.p >= 1) {
                for (const y of pick.sort((a, b) => b.i - a.i)) c.G.transferToGarrison(y.i);
                return;
            }
        }
    }
    const est = c.defenseEstimate(here, th.budget, th.seed, {withArmy: true});
    if (est.p >= 1) {
        if (th.arrivesIn <= 1 && !m.fortified[here] && c.cmd() > 0 && est.margin < 0.5) c.G.fortifyNode(here);
        if (th.arrivesIn <= 2) plan.holdArmy = true;
    } else if (th.arrivesIn <= 1 && c.cmd() > 0) {
        const away = c.neighbors(here).filter(n => c.friendly(n.to)).sort((a, b) => a.turns - b.turns)[0];
        if (away) {
            c.G.moveArmy(away.to);
            plan.moved = true;
        }
    }
}

function defendAllies(c, P, plan) {
    const m = c.m;
    if (!P.ally || plan.moved || m.armyDest || !m.armyAt || c.cmd() <= 0) return;
    for (const th of m.threats.filter(t => m.allied[t.nodeId]).sort((a, b) => a.arrivesIn - b.arrivesIn)) {
        if (c.G.alliedHolds(th)) continue;
        const e = c.defenseEstimate(th.nodeId, th.budget, th.seed, {withArmy: true, garrison: []});
        if (m.armyAt === th.nodeId) {
            if (e.p >= 0.9) plan.holdArmy = true;
            continue;
        }
        const p = c.path(m.armyAt, th.nodeId);
        if (!p || p.turns > th.arrivesIn || e.p < 0.9) continue;
        if (m.armyAt === 'alpha7' && !homeHoldsWithoutArmy(c, P)) continue;
        c.G.moveArmy(p.steps[0]);
        plan.moved = true;
        return;
    }
}

function holdCity(c) {
    const s = c.s, m = c.m, here = m.armyAt;
    if (!here || m.armyDest || c.node(here).type !== 'city' || m.owner[here] !== 'player' || c.garrison(here).length || s.army.length < 4 || c.cmd() < 2) return;
    const order = s.army.map((id, i) => ({i, u: c.unit(id)})).sort((a, b) => unitScore(a.u) - unitScore(b.u)).slice(0, Math.floor(s.army.length / 2)).sort((a, b) => b.i - a.i);
    for (const x of order) c.G.transferToGarrison(x.i);
}

function guardHomeWhileAway(c, P) {
    if (c.armyHome()) return;
    const budget = c.projectedThreatBudget(P.homeLookahead);
    const seed = c.projectedThreatSeed(P.homeLookahead);
    let guard = 0;
    let e = c.defenseEstimate('alpha7', budget, seed, {withArmy: false});
    while (e.p < 1 && guard++ < 30) {
        const u = bestGarrisonUnit(c, {});
        if (!u || !recruitTo(c, u.id)) break;
        e = c.defenseEstimate('alpha7', budget, seed, {withArmy: false});
    }
}

function doEconomy(c, P, plan, budgetCmd) {
    let used = 0;
    for (const step of P.econ) {
        if (used >= budgetCmd || c.cmd() <= plan.keepCmd) break;
        const [kind, id, extra] = step;
        if (extra && extra.minTurn && c.s.turn < extra.minTurn) continue;
        const reserve = extra && extra.noReserve ? {} : P.reserve;
        let ok = false;
        if (kind === 'build') {
            const b = c.building(id);
            if (!b || c.G.isBuilt(id) || !c.G.isBuildingUnlocked(b)) continue;
            ok = c.afford(b.cost, reserve) && c.tryCmd(() => c.G.buildBuilding(id));
        } else if (kind === 'up') {
            const lvl = c.G.getBuildingLevel(id);
            if (lvl < 1 || lvl >= (extra && extra.max || 3)) continue;
            const cost = c.G.getUpgradeCost(id);
            ok = cost && c.afford(cost, reserve) && c.tryCmd(() => c.G.upgradeBuilding(id));
        } else if (kind === 'core') {
            if (c.s.core >= (id || 3)) continue;
            const cost = c.G.getCoreUpgradeCost();
            ok = cost && c.afford(cost, reserve) && c.tryCmd(() => c.G.upgradeCore());
        } else if (kind === 'res') {
            const r = c.research(id);
            if (!r || c.G.hasResearch(id) || !c.G.canResearch(r)) continue;
            ok = c.afford(r.cost, reserve) && c.tryCmd(() => c.G.doResearch(id));
        } else if (kind === 'hero') {
            const h = (c.D('HEROES') || []).find(x => x.id === id);
            if (h && c.G.canRecruitHero(h)) c.G.recruitHero(id);
            continue;
        }
        if (ok) used++;
        else if (extra && extra.block) break;
    }
    return used;
}

function upgradeArmy(c, P, plan) {
    const s = c.s;
    if (!c.armyHome()) return;
    let room = c.armyCap() - c.armySize();
    let guard = 0;
    while (room > 0 && guard++ < 20) {
        const u = bestArmyUnit(c, room, P.armyReserve);
        if (!u) break;
        const before = s.army.length;
        c.G.recruitUnit(u.id);
        if (s.army.length === before) break;
        room = c.armyCap() - c.armySize();
    }
    if (room <= 0 && c.cmd() > plan.keepCmd) {
        const weakest = s.army.map((id, i) => ({i, u: c.unit(id)})).filter(x => x.u).sort((a, b) => unitScore(a.u) / a.u.size - unitScore(b.u) / b.u.size)[0];
        if (!weakest) return;
        const cand = bestArmyUnit(c, weakest.u.size + 2, P.armyReserve);
        if (cand && cand.score > unitScore(weakest.u) / weakest.u.size * 1.4 && cand.size <= weakest.u.size + (c.armyCap() - c.armySize())) {
            const freeAfter = c.armyCap() - c.armySize() + weakest.u.size;
            if (cand.size <= freeAfter) {
                c.G.transferToGarrison(weakest.i);
                c.G.recruitUnit(cand.id);
            }
        }
    }
}

function fillGarrison(c, P) {
    if (c.s.turn < P.garrisonFrom) return;
    const target = P.garrisonTarget(c);
    let guard = 0;
    while (c.garrison('alpha7').length < target && guard++ < 10) {
        const u = bestGarrisonUnit(c, P.garrisonReserve);
        if (!u || !recruitTo(c, u.id)) break;
    }
}

function nodeValue(c, P, id) {
    const n = c.node(id), m = c.m;
    if (!n) return 0;
    if (n.type === 'capital') return P.values.capital;
    if (n.type === 'city' && m.fallenAllies && m.fallenAllies[id]) return P.ally ? 7 : P.conquerCities ? P.values.city : 0;
    if (n.type === 'city') return P.conquerCities ? P.values.city : 0;
    let v = P.values[n.type] || 0;
    if (n.cache && !m.cacheLooted[id]) v += P.values.cache;
    if (n.weakensCapital && !m.weakenedBy[id]) v += P.values.weaken;
    return v;
}

function campaign(c, P, plan) {
    const s = c.s, m = c.m;
    if (plan.holdArmy || plan.moved || m.armyDest || !m.armyAt || c.cmd() <= 0) return;
    if (s.turn < P.attackFrom) return;
    if (!s.army.length) return;
    const atHome = m.armyAt === 'alpha7';
    if (atHome && !homeHoldsWithoutArmy(c, P) && s.turn < P.desperateTurn) return;
    let best = null;
    for (const n of c.nodes()) {
        if (c.friendly(n.id)) continue;
        const val = nodeValue(c, P, n.id);
        if (val <= 0) continue;
        const ap = c.approach(m.armyAt, n.id);
        if (!ap) continue;
        const est = c.assaultEstimate(n.id, ap.total);
        if (n.type === 'capital' && (s.turn < (P.berlinFrom || 0) || (P.berlinWhen && s.turn < (P.berlinDeadline || 30) && !P.berlinWhen(c)))) continue;
        const thr = n.type === 'capital' ? P.capitalThreshold : P.threshold;
        if (est.p < thr || est.margin < P.assaultMargin) continue;
        const score = val / (2 + ap.total);
        if (!best || score > best.score) best = {id: n.id, ap, score, est};
    }
    if (best) {
        if (best.ap.staging === m.armyAt) c.G.attackNode(best.id);
        else c.G.moveArmy(best.ap.steps[0]);
        plan.moved = true;
        return;
    }
    if (!atHome && P.returnHome) {
        const p = c.path(m.armyAt, 'alpha7');
        if (p && p.steps.length) {
            c.G.moveArmy(p.steps[0]);
            plan.moved = true;
        }
    }
}

function diplomacy(c, P, plan) {
    if (!P.ally) return;
    const s = c.s, m = c.m;
    const cities = c.nodes().filter(n => n.type === 'city' && m.owner[n.id] === 'neutral' && !m.allied[n.id]).sort((a, b) => a.allyCost - b.allyCost);
    for (const n of cities) {
        if (c.cmd() <= 0) break;
        if ((s.resources.influence || 0) >= n.allyCost) c.G.allyCity(n.id);
    }
}

function chooseEvent(c, P, choices) {
    const s = c.s;
    let best = 0, bestScore = -Infinity;
    choices.forEach((ch, i) => {
        if (ch.defeat) return;
        const fx = ch.effects || {};
        let score = ch.ending && P.takeExode ? 1000 : 0;
        for (const k of RES_KEYS) {
            const v = fx[k] || 0;
            const after = (s.resources[k] || 0) + v;
            score += v * (P.eventWeights[k] || 1);
            if (k === 'stability' && after < 25) score -= 30;
            if (k === 'energy' && after + Math.min(0, c.netEnergy()) * 2 < 8) score -= 50;
        }
        for (const f of Object.keys(ch.flags || {})) score += (P.flagPrefs[f] || 0);
        score += (c.rng() - 0.5) * P.eventNoise;
        if (score > bestScore) {
            bestScore = score;
            best = i;
        }
    });
    return best;
}

const AIMS = {
    singularite: q => {
        q.flagPrefs = {...q.flagPrefs, iaLibre: 40, nexusSingularite: 40, iaFusion: 20, iaGestion: 15, iaEvolution: 10, iaDialogue: 10, iaRestreinte: -20};
        q.econ = [['res', 'eveilCognitif'], ['res', 'conscienceEmergente']].concat(q.econ.filter(x => x[1] !== 'eveilCognitif' && x[1] !== 'conscienceEmergente'));
        if (!q.econ.some(x => x[1] === 'transcendance')) q.econ.push(['res', 'transcendance']);
        q.berlinWhen = c => c.G.iaTrust(c.s) >= 4 && (c.s.flags.iaLibre || c.s.flags.nexusSingularite);
    },
    pax: q => {
        avoidSingularity(q);
        q.ally = true;
        q.conquerCities = false;
        if (!q.order.includes('diplo')) q.order = q.order.concat('diplo');
        q.flagPrefs = {...q.flagPrefs, voieLiberatrice: 40, voieImperiale: -40, allianceLyon: 10, sommetPropose: 10};
        q.berlinWhen = c => c.s.flags.voieLiberatrice && c.G.alliedCities(c.s) >= 2;
    },
    europe: q => {
        avoidSingularity(q);
        q.ally = true;
        if (!q.order.includes('diplo')) q.order = q.order.concat('diplo');
        q.flagPrefs = {...q.flagPrefs, allianceLyon: 10, sommetPropose: 6};
    },
    hegemon: q => {
        avoidSingularity(q);
        q.ally = false;
        q.order = q.order.filter(x => x !== 'diplo');
        q.conquerCities = true;
        q.values = {...q.values, city: 10};
        q.flagPrefs = {...q.flagPrefs, voieImperiale: 30, allianceLyon: -40};
        q.berlinWhen = c => c.G.conqueredCities(c.s) >= 2 || (c.G.conqueredCities(c.s) >= 1 && c.s.flags.voieImperiale);
        q.berlinDeadline = 26;
    },
    bastion: q => {
        avoidSingularity(q);
        q.ally = false;
        q.order = q.order.filter(x => x !== 'diplo');
        q.conquerCities = false;
        q.flagPrefs = {...q.flagPrefs, allianceLyon: -40, voieImperiale: -5};
    },
    exode: q => {
        avoidSingularity(q);
        q.takeExode = true;
        q.berlinFrom = 32;
        q.econ = q.econ.filter(x => x[1] !== 'titan').concat([['res', 'bastionDome', {noReserve: true}], ['res', 'protocoleTitan', {noReserve: true}], ['build', 'titan', {noReserve: true}], ['up', 'titan', {max: 2, noReserve: true}]]);
        const i = q.econ.findIndex(x => x[0] === 'core' && x[1] === 3);
        if (i > 0) q.econ = [['core', 3, {noReserve: true}]].concat(q.econ.slice(0, i), q.econ.slice(i + 1));
        q.reserveFrom = {turn: 18, energy: 100};
    }
};

function avoidSingularity(q) {
    q.flagPrefs = {...q.flagPrefs, iaLibre: -40, nexusSingularite: -40};
    q.econ = q.econ.filter(x => x[1] !== 'transcendance');
}

function applyAim(q, aim) {
    q.aim = aim;
    q.takeExode = false;
    if (AIMS[aim]) AIMS[aim](q);
    return q;
}

function makeBot(P) {
    return {
        name: P.name,
        P,
        jitter(rng, aim) {
            const q = applyAim({...P}, aim || P.aims[Math.floor(rng() * P.aims.length)]);
            q.threshold = Math.min(1, P.threshold + (rng() - 0.5) * 0.1);
            q.attackFrom = P.attackFrom + Math.floor((rng() - 0.5) * 4);
            q.econ = q.econ.slice();
            for (let i = 0; i < q.econ.length - 1; i++) if (rng() < 0.15) [q.econ[i], q.econ[i + 1]] = [q.econ[i + 1], q.econ[i]];
            return q;
        },
        turn(c, Q) {
            const plan = {holdArmy: false, moved: false, keepCmd: 0};
            if (Q.reserveFrom && c.s.turn >= Q.reserveFrom.turn && !Q.reserveOn) {
                Q.reserveOn = true;
                const e = {energy: Q.reserveFrom.energy};
                Q.reserve = {...Q.reserve, ...e};
                Q.armyReserve = {...Q.armyReserve, ...e};
                Q.garrisonReserve = {...Q.garrisonReserve, ...e};
            }
            upkeepGuard(c);
            defendHome(c, Q, plan);
            defendOutposts(c, Q, plan);
            defendAllies(c, Q, plan);
            guardHomeWhileAway(c, Q);
            if (Q.order.includes('diplo')) diplomacy(c, Q, plan);
            plan.keepCmd = Q.campaignFirst && c.s.turn >= Q.attackFrom ? 1 : 0;
            doEconomy(c, Q, plan, Q.econCmd);
            for (const h of (c.D('HEROES') || [])) if (c.G.canRecruitHero(h) && Q.heroes.includes(h.id)) c.G.recruitHero(h.id);
            plan.keepCmd = 0;
            upgradeArmy(c, Q, plan);
            const wasHome = c.armyHome();
            if (Q.aim === 'hegemon') holdCity(c);
            campaign(c, Q, plan);
            if (wasHome && !c.armyHome()) {
                defendHome(c, Q, plan);
                guardHomeWhileAway(c, Q);
            }
            fillGarrison(c, Q);
            if (Q.order.includes('diplo')) diplomacy(c, Q, plan);
            doEconomy(c, Q, plan, 9);
            if (c.cmd() > 0 && Q.fortifyIdle) {
                const th = c.m.threats.find(t => c.m.owner[t.nodeId] === 'player' && t.arrivesIn <= 1 && !c.m.fortified[t.nodeId]);
                if (th) c.G.fortifyNode(th.nodeId);
            }
        },
        chooseEvent: (c, Q, choices) => chooseEvent(c, Q, choices)
    };
}

function roughPower(list) {
    let hp = 0, atk = 0;
    for (const u of list) {
        hp += u.hp;
        atk += u.atk;
    }
    return hp * atk;
}

function myRough(c, ids, heroes) {
    const list = ids.map(id => c.unit(id)).filter(Boolean);
    if (heroes) for (const id of c.s.heroes) if (!c.G.isHeroWounded(id)) list.push((c.D('HEROES') || []).find(h => h.id === id));
    return roughPower(list);
}

function enemyRough(c, budget, seed) {
    return roughPower(c.G.generateForce(budget, seed));
}

function humanPick(c, room, careless) {
    let best = null;
    const net = c.netEnergy(), rate = c.bal('upkeepEnergyPerSize') || 0;
    for (const u of c.D('UNITS') || []) {
        if (!c.canRecruit(u.id) || u.size > room || !c.afford(u.cost, {}, true)) continue;
        const after = c.s.resources.energy - (u.cost.energy || 0);
        if (!careless && (after + Math.min(0, net) < 8 || (net - u.size * rate < 0 && after < 40))) continue;
        const score = (u.hp + u.atk * 3) / u.size;
        if (!best || score > best.score) best = {id: u.id, score};
    }
    return best;
}

function medEcon(c, Q, keep) {
    for (const [kind, id, extra] of Q.econ) {
        if (c.cmd() <= keep) return;
        if (kind === 'build') {
            const b = c.building(id);
            if (b && !c.G.isBuilt(id) && c.G.isBuildingUnlocked(b) && c.afford(b.cost, {})) c.G.buildBuilding(id);
        } else if (kind === 'up') {
            const lvl = c.G.getBuildingLevel(id);
            const cost = c.G.getUpgradeCost(id);
            if (lvl >= 1 && lvl < (extra && extra.max || 3) && cost && c.afford(cost, {})) c.G.upgradeBuilding(id);
        } else if (kind === 'core') {
            const cost = c.G.getCoreUpgradeCost();
            if (c.s.core < id && cost && c.afford(cost, {})) c.G.upgradeCore();
        } else if (kind === 'res') {
            const r = c.research(id);
            if (r && c.G.canResearch(r) && c.afford(r.cost, {})) c.G.doResearch(id);
        }
    }
}

function medDefend(c, Q) {
    const m = c.m;
    for (const th of m.threats.slice().sort((a, b) => a.arrivesIn - b.arrivesIn)) {
        if (m.owner[th.nodeId] !== 'player') continue;
        const home = th.nodeId === 'alpha7';
        const forget = c.rng() < (home ? Q.forgetHome : Q.forgetOutpost);
        if (forget) continue;
        const enemy = enemyRough(c, th.budget, th.seed) * Q.defRatio * (1 + Math.max(0, c.s.turn - 10) / Q.learn);
        const armyHere = m.armyAt === th.nodeId && !m.armyDest;
        const mine = () => myRough(c, c.garrison(th.nodeId).concat(armyHere ? c.s.army : []), armyHere);
        if (home) {
            let guard = 0;
            const careless = c.rng() < Q.forgetUpkeep * 0.25;
            while (mine() < enemy && guard++ < 25) {
                const u = humanPick(c, 99, careless);
                if (!u || !recruitTo(c, u.id)) break;
            }
        } else if (armyHere && th.arrivesIn <= 2) {
            Q.hold = true;
        }
        if (th.arrivesIn <= 1 && mine() < enemy * 1.3 && !m.fortified[th.nodeId] && c.cmd() > 0) c.G.fortifyNode(th.nodeId);
    }
}

function medHelpAllies(c, Q) {
    const m = c.m;
    if (!Q.ally || m.armyDest || !m.armyAt || c.cmd() <= 0 || !c.s.army.length) return;
    for (const th of m.threats.filter(t => m.allied[t.nodeId])) {
        if (m.armyAt === th.nodeId) {
            if (th.arrivesIn <= 2) Q.hold = true;
            continue;
        }
        if (m.armyAt !== 'alpha7' || c.rng() > Q.helpAllies) continue;
        const p = c.path('alpha7', th.nodeId);
        if (!p || p.turns > th.arrivesIn) continue;
        if (myRough(c, c.s.army, true) < enemyRough(c, th.budget, th.seed) * Q.defRatio) continue;
        c.G.moveArmy(p.steps[0]);
        Q.hold = true;
        return;
    }
}

function medCampaign(c, Q) {
    const s = c.s, m = c.m;
    if (Q.hold || m.armyDest || !m.armyAt || c.cmd() <= 0 || !s.army.length || s.turn < Q.attackFrom) return;
    const atHome = m.armyAt === 'alpha7';
    if (atHome && m.threats.some(t => t.nodeId === 'alpha7' && t.arrivesIn <= 2) && c.rng() > Q.recklessness) return;
    const myP = myRough(c, s.army, true);
    let best = null;
    for (const n of c.nodes()) {
        if (c.friendly(n.id)) continue;
        const fallen = m.fallenAllies && m.fallenAllies[n.id];
        if (n.type === 'city' && !Q.conquerCities && !(fallen && Q.ally)) continue;
        if (n.type === 'capital' && s.turn < Q.berlinFrom) continue;
        const ap = c.approach(m.armyAt, n.id);
        if (!ap) continue;
        const ratio = myP / Math.max(1, enemyRough(c, c.G.garrisonBudgetFor(n), c.G.garrisonSeed(n.id))) * (1 + (c.rng() - 0.5) * Q.misjudge);
        const need = n.type === 'capital' ? Q.risk * 1.15 : Q.risk;
        if (ratio < need) continue;
        const val = n.type === 'capital' ? 100 : (Q.values[n.type] || 3) + (n.cache && !m.cacheLooted[n.id] ? 3 : 0) + (n.weakensCapital && !m.weakenedBy[n.id] ? 4 : 0);
        const score = val / (2 + ap.total);
        if (!best || score > best.score) best = {id: n.id, ap, score};
    }
    if (best) {
        if (best.ap.staging === m.armyAt) c.G.attackNode(best.id);
        else c.G.moveArmy(best.ap.steps[0]);
        return;
    }
    if (!atHome && c.rng() < 0.5) {
        const p = c.path(m.armyAt, 'alpha7');
        if (p && p.steps.length) c.G.moveArmy(p.steps[0]);
    }
}

function medLeaveGarrison(c, Q) {
    const m = c.m, s = c.s;
    const here = m.armyAt;
    if (!here || m.armyDest || here === 'alpha7' || m.owner[here] !== 'player') return;
    if (c.garrison(here).length || s.army.length < 3 || c.rng() < Q.forgetOutpost) return;
    const n = Math.max(1, Math.floor(s.army.length * Q.garrisonShare));
    const order = s.army.map((id, i) => ({i, u: c.unit(id)})).sort((a, b) => (a.u.hp + a.u.atk) - (b.u.hp + b.u.atk)).slice(0, n).sort((a, b) => b.i - a.i);
    for (const x of order) c.G.transferToGarrison(x.i);
}

function medChooseEvent(c, Q, choices) {
    const s = c.s;
    const w = choices.map(ch => {
        if (ch.defeat) return 0;
        if (ch.ending) return Q.takeExode ? 50 : 0.3;
        let score = 0;
        for (const k of RES_KEYS) score += (ch.effects && ch.effects[k] || 0) * (k === 'influence' ? Q.influenceTaste : 1);
        if (ch.effects && (s.resources.stability + (ch.effects.stability || 0)) < 15) score -= 15;
        if (ch.effects && (s.resources.energy + (ch.effects.energy || 0)) < 5) score -= 15;
        for (const f of Object.keys(ch.flags || {})) score += Q.flagPrefs[f] || 0;
        if (ch.hint) score += 2;
        return Math.exp(score / Q.eventTemp);
    });
    const tot = w.reduce((a, b) => a + b, 0);
    let r = c.rng() * tot;
    for (let i = 0; i < w.length; i++) {
        r -= w[i];
        if (r <= 0 && w[i] > 0) return i;
    }
    return w.findIndex(x => x > 0);
}

function makeMedium(P) {
    return {
        name: P.name,
        P,
        jitter(rng, aim) {
            const q = {...P, aim: aim || 'libre'};
            q.risk = P.risk + (rng() - 0.5) * 0.8;
            q.defRatio = P.defRatio + (rng() - 0.5) * 0.6;
            q.attackFrom = P.attackFrom + Math.floor(rng() * 6);
            q.berlinFrom = P.berlinFrom + Math.floor(rng() * 6);
            q.conquerCities = rng() < 0.4;
            q.ally = rng() < 0.7;
            q.takeExode = rng() < 0.5;
            q.influenceTaste = q.ally ? 1.5 : 0.5;
            q.econ = P.econ.slice();
            for (let i = 0; i < q.econ.length - 1; i++) if (rng() < 0.3) [q.econ[i], q.econ[i + 1]] = [q.econ[i + 1], q.econ[i]];
            const pick = ['iaLibre', 'nexusSingularite', 'voieLiberatrice', 'voieImperiale', 'iaDialogue', 'iaEvolution'];
            q.flagPrefs = Object.fromEntries(pick.map(f => [f, Math.round((rng() - 0.4) * 10)]));
            return q;
        },
        turn(c, Q) {
            Q.hold = false;
            if (c.netEnergy() < 0 && c.s.resources.energy + c.netEnergy() * 4 < 12 && c.rng() > Q.forgetUpkeep) {
                let guard = 0;
                while (c.netEnergy() < 0 && guard++ < 12) {
                    const g = c.garrison('alpha7');
                    if (g.length > 4) c.G.dismissGarrison('alpha7', 0);
                    else if (c.s.army.length) c.G.dismissUnit(c.s.army.length - 1);
                    else break;
                }
            }
            medDefend(c, Q);
            if (Q.ally) for (const n of c.nodes().filter(x => x.type === 'city' && c.m.owner[x.id] === 'neutral' && !c.m.allied[x.id])) {
                if (c.cmd() > 0 && c.s.resources.influence >= c.G.getAllyCost(n) && c.rng() < 0.8) c.G.allyCity(n.id);
            }
            medEcon(c, Q, 1);
            for (const h of (c.D('HEROES') || [])) if (c.G.canRecruitHero(h) && c.rng() < 0.6) c.G.recruitHero(h.id);
            if (c.armyHome()) {
                let guard = 0;
                while (guard++ < 12) {
                    const u = humanPick(c, c.armyCap() - c.armySize());
                    if (!u || !recruitTo(c, u.id)) break;
                }
            }
            medLeaveGarrison(c, Q);
            medHelpAllies(c, Q);
            medCampaign(c, Q);
            const rich = c.s.resources.materials > 120 && c.s.resources.energy > 60 && c.netEnergy() > 2;
            if (c.s.turn >= 8 && (rich || c.garrison('alpha7').length < Math.floor(c.s.turn / Q.homeGarrisonEvery)) && c.rng() > Q.forgetHome) {
                const u = humanPick(c, 99);
                if (u && c.afford(c.unit(u.id).cost, {energy: 15, materials: 10})) recruitTo(c, u.id);
            }
            medEcon(c, Q, 0);
        },
        chooseEvent: (c, Q, choices) => medChooseEvent(c, Q, choices)
    };
}

const BASE = {
    defMargin: 0.25,
    homeLookahead: 3,
    threshold: 0.9,
    capitalThreshold: 0.95,
    assaultMargin: 0.15,
    desperateTurn: 999,
    returnHome: true,
    eventNoise: 4,
    fortifyIdle: true,
    garrisonFrom: 1,
    reserve: {},
    armyReserve: {},
    garrisonReserve: {energy: 10, materials: 10},
    flagPrefs: {},
    heroes: ['valkyrie', 'oracle', 'avatar'],
    econCmd: 2,
    campaignFirst: true
};

const BOTS = {
    conquete: makeBot({
        ...BASE,
        name: 'conquete',
        aims: ['bastion', 'hegemon', 'hegemon', 'singularite'],
        order: [],
        attackFrom: 6,
        conquerCities: true,
        garrisonConquests: true,
        ally: false,
        values: {capital: 100, city: 5, ruin: 4, outpost: 6, nexus: 9, cache: 4, weaken: 6},
        eventWeights: {energy: 1, materials: 1.2, data: 1, stability: 0.8, influence: 0.2},
        flagPrefs: {nexusSingularite: 40, iaLibre: 20},
        garrisonTarget: c => 2 + Math.floor(c.s.turn / 4),
        econ: [
            ['build', 'usine'], ['build', 'reacteur'], ['build', 'centreDonnees'], ['build', 'caserne'], ['res', 'disciplineFer'], ['build', 'quartiers'], ['res', 'blindageReactif'], ['core', 2],
            ['res', 'mobilisation'], ['res', 'rendementNano'], ['res', 'geneseBiotech'], ['build', 'labo'],
            ['up', 'usine'], ['up', 'reacteur'], ['up', 'quartiers'], ['core', 3], ['res', 'bastionDome'],
            ['res', 'protocoleTitan'], ['build', 'titan'], ['build', 'bouclier'], ['up', 'centreDonnees'],
            ['res', 'eveilCognitif'], ['res', 'conscienceEmergente'], ['res', 'essaimDrones'], ['build', 'hangar'],
            ['res', 'oraclePredictif'], ['up', 'bouclier'], ['res', 'coeurProductif']
        ]
    }),
    diplomatie: makeBot({
        ...BASE,
        name: 'diplomatie',
        aims: ['pax', 'europe', 'singularite'],
        order: ['diplo'],
        attackFrom: 14,
        conquerCities: false,
        ally: true,
        values: {capital: 100, city: 0, ruin: 3, outpost: 6, nexus: 5, cache: 3, weaken: 6},
        eventWeights: {energy: 0.8, materials: 0.8, data: 1, stability: 1, influence: 3},
        flagPrefs: {sommetPropose: 2, allianceLyon: 3, hegemoniaContact: 2, voieLiberatrice: 3},
        garrisonTarget: c => 2 + Math.floor(c.s.turn / 3),
        econ: [
            ['build', 'usine'], ['build', 'centreDonnees'], ['build', 'reacteur'], ['core', 2],
            ['res', 'canauxDiplo'], ['build', 'antenne'], ['res', 'eveilCognitif'], ['up', 'antenne'],
            ['res', 'conscienceEmergente'], ['build', 'quartiers'], ['up', 'antenne'], ['build', 'caserne'],
            ['res', 'disciplineFer'], ['res', 'oraclePredictif'], ['up', 'centreDonnees'], ['core', 3],
            ['res', 'blindageReactif'], ['res', 'mobilisation'], ['res', 'rendementNano'], ['res', 'geneseBiotech'],
            ['build', 'labo'], ['res', 'transcendance'], ['up', 'usine'], ['up', 'reacteur'], ['res', 'bastionDome'],
            ['build', 'bouclier'], ['res', 'protocoleTitan'], ['build', 'titan']
        ]
    }),
    tortue: makeBot({
        ...BASE,
        name: 'tortue',
        aims: ['europe', 'bastion', 'pax'],
        order: ['diplo'],
        attackFrom: 18,
        conquerCities: true,
        ally: true,
        econCmd: 3,
        campaignFirst: false,
        defMargin: 0.4,
        homeLookahead: 5,
        values: {capital: 100, city: 3, ruin: 4, outpost: 6, nexus: 5, cache: 4, weaken: 6},
        eventWeights: {energy: 1, materials: 1, data: 1.2, stability: 1.2, influence: 0.8},
        garrisonTarget: c => 3 + Math.floor(c.s.turn / 2),
        econ: [
            ['build', 'usine'], ['build', 'reacteur'], ['build', 'centreDonnees'], ['build', 'quartiers'],
            ['res', 'rendementNano'], ['core', 2], ['build', 'caserne'], ['up', 'usine'], ['up', 'reacteur'],
            ['res', 'disciplineFer'], ['res', 'blindageReactif'], ['res', 'geneseBiotech'], ['build', 'labo'],
            ['up', 'centreDonnees'], ['res', 'bastionDome'], ['build', 'bouclier'], ['core', 3], ['res', 'coeurProductif'],
            ['res', 'mobilisation'], ['res', 'eveilCognitif'], ['res', 'conscienceEmergente'], ['res', 'canauxDiplo'],
            ['build', 'antenne'], ['res', 'protocoleTitan'], ['build', 'titan'], ['up', 'quartiers'], ['up', 'bouclier'],
            ['res', 'oraclePredictif'], ['res', 'transcendance'], ['up', 'usine'], ['up', 'reacteur'], ['up', 'centreDonnees'],
            ['res', 'essaimDrones'], ['build', 'hangar'], ['up', 'antenne']
        ]
    })
};

BOTS.moyen = makeMedium({
    name: 'moyen',
    risk: 1.15,
    defRatio: 1.3,
    attackFrom: 6,
    berlinFrom: 16,
    forgetHome: 0.12,
    forgetOutpost: 0.35,
    forgetUpkeep: 0.4,
    recklessness: 0.25,
    misjudge: 0.8,
    helpAllies: 0.5,
    learn: 20,
    garrisonShare: 0.35,
    homeGarrisonEvery: 3,
    eventTemp: 6,
    values: {ruin: 4, outpost: 5, nexus: 5, city: 4},
    econ: [
        ['build', 'reacteur'], ['build', 'usine'], ['build', 'centreDonnees'], ['build', 'caserne'], ['build', 'quartiers'],
        ['res', 'disciplineFer'], ['core', 2], ['res', 'canauxDiplo'], ['build', 'antenne'], ['res', 'blindageReactif'],
        ['res', 'eveilCognitif'], ['up', 'reacteur'], ['up', 'usine'], ['res', 'mobilisation'], ['res', 'rendementNano'],
        ['up', 'centreDonnees'], ['res', 'geneseBiotech'], ['build', 'labo'], ['core', 3], ['res', 'bastionDome'],
        ['build', 'bouclier'], ['res', 'conscienceEmergente'], ['res', 'essaimDrones'], ['build', 'hangar'],
        ['res', 'protocoleTitan'], ['build', 'titan'], ['up', 'quartiers'], ['res', 'oraclePredictif'], ['res', 'transcendance'],
        ['up', 'titan'], ['res', 'coeurProductif'], ['up', 'antenne'], ['up', 'bouclier']
    ]
});

module.exports = {BOTS, Ctx};
