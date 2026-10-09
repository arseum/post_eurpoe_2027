const {createGame, mulberry32} = require('./loader');
const {BOTS, Ctx} = require('./bots');

const CHECKPOINTS = [5, 10, 15, 20, 30];
const RES_KEYS = ['energy', 'materials', 'data', 'stability', 'influence'];

function parseArgs(argv) {
    const o = {games: 50, bot: 'all', seed: 1, maxTurns: 40, json: false, aim: null};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') o.json = true;
        else if (a === '--games') o.games = parseInt(argv[++i], 10);
        else if (a === '--bot') o.bot = argv[++i];
        else if (a === '--seed') o.seed = parseInt(argv[++i], 10);
        else if (a === '--maxTurns') o.maxTurns = parseInt(argv[++i], 10);
        else if (a === '--aim') o.aim = argv[++i];
        else if (a === '--difficulty') o.difficulty = argv[++i];
        else if (a === '--help' || a === '-h') o.help = true;
    }
    return o;
}

function resolvePending(game, bot, c, Q, rec) {
    let guard = 0;
    while (game.sim.pending && !game.sim.result && guard++ < 50) {
        const p = game.sim.pending;
        game.sim.pending = null;
        if (p.type === 'event') {
            const i = bot.chooseEvent(c, Q, p.choices);
            rec.events.push(p.event.id + ':' + i);
            game.G.onEvtChoice(i);
        } else if (typeof game.G.dismissCh === 'function') {
            game.G.dismissCh();
        } else {
            game.G.processNext();
        }
    }
}

async function playGame(bot, seed, maxTurns, aim, difficulty) {
    const game = createGame(seed);
    const c = new Ctx(game);
    const Q = bot.jitter(mulberry32(seed * 7919 + 17), aim);
    const rec = {
        seed, aim: Q.aim, outcome: 'timeout', ending: null, endingsAvailable: [], defeat: null, endTurn: null,
        snapshots: {}, capTurns: Object.fromEntries(RES_KEYS.map(k => [k, 0])), turns: 0,
        firstThreat: null, firstThreatNode: null, firstHomeThreat: null, upkeep: {}, firstAlliance: null, firstConquest: null,
        armySizes: {}, maxArmy: 0, events: [], errors: [], cities: {}, unusedCmd: 0
    };
    game.G.newGame(difficulty);
    const meta = game.D('RES_META') || {};
    let lastTurn = 0;
    while (!game.sim.result) {
        resolvePending(game, bot, c, Q, rec);
        if (game.sim.result) break;
        const s = game.state();
        if (s.turn > maxTurns) break;
        if (s.turn === lastTurn) {
            rec.errors.push('turn stuck at ' + s.turn);
            break;
        }
        lastTurn = s.turn;
        rec.turns++;
        for (const k of RES_KEYS) if (meta[k] && s.resources[k] >= (game.G.resMax ? game.G.resMax(k) : meta[k].max)) rec.capTurns[k]++;
        if (CHECKPOINTS.includes(s.turn)) {
            rec.snapshots[s.turn] = {...s.resources};
            rec.armySizes[s.turn] = game.G.getArmySize();
            rec.upkeep[s.turn] = typeof game.G.getUpkeep === 'function' ? game.G.getUpkeep() : 0;
        }
        if (rec.firstThreat === null && s.map.threats.length) {
            rec.firstThreat = s.turn;
            rec.firstThreatNode = s.map.threats[0].nodeId;
        }
        if (rec.firstHomeThreat === null && s.map.threats.some(t => t.nodeId === 'alpha7')) rec.firstHomeThreat = s.turn;
        try {
            bot.turn(c, Q);
        } catch (e) {
            rec.errors.push('T' + s.turn + ' ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e));
        }
        resolvePending(game, bot, c, Q, rec);
        if (game.sim.result) break;
        if (s.command > 0) rec.unusedCmd++;
        rec.maxArmy = Math.max(rec.maxArmy, game.G.getArmySize());
        if (rec.firstAlliance === null && Object.keys(s.map.allied).length) rec.firstAlliance = s.turn;
        for (const id of ['lyon', 'marseille', 'turin']) if (!rec.cities[id]) rec.cities[id] = s.map.owner[id] === 'player' ? 'take' : s.map.allied[id] ? 'ally' : null;
        if (rec.firstConquest === null && Object.entries(s.map.owner).some(([k, v]) => k !== 'alpha7' && v === 'player')) rec.firstConquest = s.turn;
        try {
            await game.G.endTurn();
        } catch (e) {
            rec.errors.push('endTurn T' + s.turn + ' ' + (e && e.message));
            break;
        }
    }
    const s = game.state();
    const r = game.sim.result;
    if (r && r.kind === 'berlin') {
        rec.endingsAvailable = r.endings;
        rec.ending = r.chosen;
        rec.outcome = 'win';
        rec.endTurn = r.turn;
    } else if (r && r.kind === 'defeat') {
        rec.outcome = 'loss';
        rec.defeat = r.type;
        rec.endTurn = r.turn;
    } else {
        rec.endTurn = s.turn;
    }
    rec.combats = game.sim.combats;
    rec.alliedDefenses = game.sim.alliedDefenses;
    rec.final = {
        turn: s.turn,
        owned: Object.entries(s.map.owner).filter(([k, v]) => k !== 'alpha7' && v === 'player').map(([k]) => k),
        allied: Object.keys(s.map.allied).filter(k => s.map.allied[k]),
        lost: Object.keys(s.map.lost || {}),
        garrisonHome: (s.map.garrisons.alpha7 || []).length,
        army: s.army.length,
        armySize: game.G.getArmySize(),
        buildings: s.buildings.length,
        research: s.research.length,
        core: s.core
    };
    return rec;
}

const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);
const r1 = x => (x === null ? null : Math.round(x * 10) / 10);

function countBy(arr) {
    const o = {};
    for (const x of arr) o[x] = (o[x] || 0) + 1;
    return o;
}

function summarize(name, recs) {
    const n = recs.length;
    const wins = recs.filter(r => r.outcome === 'win');
    const losses = recs.filter(r => r.outcome === 'loss');
    const timeouts = recs.filter(r => r.outcome === 'timeout');
    const curves = {};
    for (const t of CHECKPOINTS) {
        const snaps = recs.map(r => r.snapshots[t]).filter(Boolean);
        if (!snaps.length) continue;
        curves[t] = {n: snaps.length};
        for (const k of RES_KEYS) curves[t][k] = r1(mean(snaps.map(x => x[k])));
        curves[t].army = r1(mean(recs.map(r => r.armySizes[t]).filter(x => x !== undefined)));
        curves[t].upkeep = r1(mean(recs.map(r => r.upkeep[t]).filter(x => x !== undefined)));
    }
    const totalTurns = recs.reduce((a, r) => a + r.turns, 0);
    const cap = {};
    for (const k of RES_KEYS) cap[k] = pct(recs.reduce((a, r) => a + r.capTurns[k], 0), totalTurns);
    const all = recs.flatMap(r => r.combats);
    const combat = {
        assaultWon: all.filter(x => x.kind === 'assault' && x.won).length,
        assaultLost: all.filter(x => x.kind === 'assault' && !x.won).length,
        defenseWon: all.filter(x => x.kind === 'defense' && x.won).length,
        defenseLost: all.filter(x => x.kind === 'defense' && !x.won).length,
        undefended: all.filter(x => x.kind === 'defense' && !x.battle).length,
        alliedHeld: recs.flatMap(r => r.alliedDefenses).filter(x => x.held).length,
        alliedLost: recs.flatMap(r => r.alliedDefenses).filter(x => !x.held).length
    };
    const firstOf = key => {
        const v = recs.map(r => r[key]).filter(x => x !== null);
        return {mean: r1(mean(v)), min: v.length ? Math.min(...v) : null, share: pct(v.length, n)};
    };
    return {
        bot: name,
        games: n,
        winRate: pct(wins.length, n),
        lossRate: pct(losses.length, n),
        timeoutRate: pct(timeouts.length, n),
        endings: countBy(wins.map(r => r.ending)),
        endingsAvailable: countBy(recs.flatMap(r => r.endingsAvailable)),
        defeats: countBy(losses.map(r => r.defeat)),
        winTurn: r1(mean(wins.map(r => r.endTurn))),
        winTurnMin: wins.length ? Math.min(...wins.map(r => r.endTurn)) : null,
        winTurnMax: wins.length ? Math.max(...wins.map(r => r.endTurn)) : null,
        aims: countBy(recs.map(r => r.aim + ':' + (r.outcome === 'win' ? r.ending : r.outcome === 'loss' ? 'D-' + r.defeat : 'timeout'))),
        firstThreatOnHome: pct(recs.filter(r => r.firstThreatNode === 'alpha7').length, recs.filter(r => r.firstThreatNode).length),
        firstThreatTurns: countBy(recs.map(r => r.firstThreat)),
        lossTurn: r1(mean(losses.map(r => r.endTurn))),
        curves,
        capPct: cap,
        combat,
        firstThreat: firstOf('firstThreat'),
        firstHomeThreat: firstOf('firstHomeThreat'),
        firstAlliance: firstOf('firstAlliance'),
        firstConquest: firstOf('firstConquest'),
        maxArmy: r1(mean(recs.map(r => r.maxArmy))),
        final: {
            owned: r1(mean(recs.map(r => r.final.owned.length))),
            allied: r1(mean(recs.map(r => r.final.allied.length))),
            lost: r1(mean(recs.map(r => r.final.lost.length))),
            garrisonHome: r1(mean(recs.map(r => r.final.garrisonHome))),
            buildings: r1(mean(recs.map(r => r.final.buildings))),
            research: r1(mean(recs.map(r => r.final.research)))
        },
        unusedCmdPct: r1(100 * recs.reduce((a, r) => a + r.unusedCmd, 0) / Math.max(1, recs.reduce((a, r) => a + r.turns, 0))),
        cities: Object.fromEntries(['lyon', 'marseille', 'turin'].map(id => [id, {take: recs.filter(r => r.cities[id] === 'take').length, ally: recs.filter(r => r.cities[id] === 'ally').length}])),
        errors: recs.flatMap(r => r.errors).slice(0, 5),
        errorGames: recs.filter(r => r.errors.length).length
    };
}

function fmtObj(o) {
    const e = Object.entries(o);
    return e.length ? e.map(([k, v]) => k + ' ' + v).join(', ') : '—';
}

function textReport(sums, opts, ms) {
    const L = [];
    L.push('Post-Europe 2147 — harnais d\'équilibrage · ' + opts.games + ' parties/bot · graine ' + opts.seed + ' · max ' + opts.maxTurns + ' tours · ' + ms + ' ms');
    for (const s of sums) {
        L.push('');
        L.push('== ' + s.bot.toUpperCase() + ' ==');
        L.push('Victoire ' + s.winRate + '% · défaite ' + s.lossRate + '% · limite de tours ' + s.timeoutRate + '%');
        L.push('Tour moyen : victoire ' + (s.winTurn ?? '—') + ' (min ' + (s.winTurnMin ?? '—') + ', max ' + (s.winTurnMax ?? '—') + ') · défaite ' + (s.lossTurn ?? '—'));
        L.push('Objectif → issue : ' + fmtObj(s.aims));
        L.push('Fins choisies : ' + fmtObj(s.endings));
        L.push('Fins débloquées (Berlin prise) : ' + fmtObj(s.endingsAvailable));
        L.push('Causes de défaite : ' + fmtObj(s.defeats));
        L.push('Combats : assauts ' + s.combat.assaultWon + 'V/' + s.combat.assaultLost + 'D · défenses ' + s.combat.defenseWon + 'V/' + s.combat.defenseLost + 'D (dont ' + s.combat.undefended + ' sans défenseur) · alliés ' + s.combat.alliedHeld + ' tenus/' + s.combat.alliedLost + ' tombés');
        L.push('Première menace : tours ' + fmtObj(s.firstThreatTurns) + ' · sur Alpha-7 ' + s.firstThreatOnHome + '%');
        L.push('Premier tour : menace ' + s.firstThreat.mean + ' · menace Alpha-7 ' + s.firstHomeThreat.mean + ' (' + s.firstHomeThreat.share + '%) · alliance ' + (s.firstAlliance.mean ?? '—') + ' (' + s.firstAlliance.share + '%) · conquête ' + (s.firstConquest.mean ?? '—') + ' (' + s.firstConquest.share + '%)');
        L.push('Tours finis avec des points de commandement inutilisés : ' + s.unusedCmdPct + ' %');
        L.push('Cités (premier statut, prise/alliance) : ' + Object.entries(s.cities).map(([id, v]) => id + ' ' + v.take + '/' + v.ally).join(' · '));
        L.push('Armée max (taille) ' + s.maxArmy + ' · fin : ' + s.final.owned + ' territoires, ' + s.final.allied + ' alliés, ' + s.final.lost + ' perdus, garnison Alpha-7 ' + s.final.garrisonHome + ', ' + s.final.buildings + ' bât., ' + s.final.research + ' rech.');
        L.push('Ressources au plafond (% des tours) : ' + RES_KEYS.map(k => k + ' ' + s.capPct[k]).join(' · '));
        L.push('Tour   n    énergie  matér.  données  stab.  influ.  armée  entret.');
        for (const t of CHECKPOINTS) {
            const c = s.curves[t];
            if (!c) continue;
            L.push(String(t).padEnd(6) + String(c.n).padEnd(5) + [c.energy, c.materials, c.data, c.stability, c.influence, c.army, c.upkeep].map(v => String(v).padStart(7)).join(' '));
        }
        if (s.errorGames) L.push('ERREURS dans ' + s.errorGames + ' parties : ' + s.errors.join(' | '));
    }
    return L.join('\n');
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        console.log('node tools/sim/run.js [--games N] [--bot ' + Object.keys(BOTS).join('|') + '|all] [--aim singularite|paxEuropaea|pax|europe|hegemon|bastion|exode] [--difficulty facile|normal|difficile] [--seed S] [--maxTurns T] [--json]');
        return;
    }
    const names = opts.bot === 'all' ? Object.keys(BOTS) : opts.bot.split(',');
    for (const n of names) if (!BOTS[n]) throw new Error('bot inconnu : ' + n);
    const t0 = Date.now();
    const sums = [];
    for (const name of names) {
        const recs = [];
        for (let i = 0; i < opts.games; i++) recs.push(await playGame(BOTS[name], opts.seed * 100003 + i, opts.maxTurns, opts.aim, opts.difficulty));
        sums.push(summarize(name, recs));
    }
    const ms = Date.now() - t0;
    if (opts.json) console.log(JSON.stringify({options: opts, elapsedMs: ms, bots: sums}, null, 2));
    else console.log(textReport(sums, opts, ms));
}

if (require.main === module) main().catch(e => {
    console.error(e);
    process.exit(1);
});

module.exports = {playGame, summarize};
