const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const FILES = ['js/data.js', 'js/game.js'];
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'await', 'async', 'with', 'super', 'import', 'delete', 'void', 'in', 'of', 'do', 'else', 'case', 'throw', 'yield']);

let compiled = null;

function load() {
    if (compiled) return compiled;
    const parts = FILES.map(f => ({file: f, src: fs.readFileSync(path.join(ROOT, f), 'utf8')}));
    const called = new Set();
    for (const p of parts) {
        for (const m of p.src.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) if (!KEYWORDS.has(m[1])) called.add(m[1]);
    }
    compiled = {
        scripts: parts.map(p => new vm.Script(p.src, {filename: p.file})),
        called: [...called],
        overrides: new vm.Script(OVERRIDES, {filename: 'sim-overrides.js'})
    };
    return compiled;
}

function universal() {
    const store = {};
    let proxy;
    const target = function () {
    };
    proxy = new Proxy(target, {
        get(t, k) {
            if (k === Symbol.toPrimitive) return () => '';
            if (k === Symbol.iterator) return function* () {
            };
            if (k === 'then') return undefined;
            if (k === 'length') return 0;
            if (k in store) return store[k];
            return universal();
        },
        set(t, k, v) {
            store[k] = v;
            return true;
        },
        has() {
            return true;
        },
        apply() {
            return proxy;
        },
        construct() {
            return proxy;
        }
    });
    return proxy;
}

function makeDocument() {
    const elements = new Map();
    const doc = universal();
    doc.getElementById = id => {
        if (!elements.has(id)) elements.set(id, universal());
        return elements.get(id);
    };
    doc.querySelector = () => null;
    doc.querySelectorAll = () => [];
    doc.createElement = () => universal();
    doc.body = universal();
    return doc;
}

function makeStorage() {
    const m = new Map();
    return {
        getItem: k => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: k => m.delete(k),
        clear: () => m.clear(),
        key: i => [...m.keys()][i] ?? null,
        get length() {
            return m.size;
        }
    };
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const OVERRIDES = `
var window = globalThis;
var Map3D = undefined;
var Battle3D = undefined;
function __S() { return state; }
function __E(expr) { return eval(expr); }
Math.random = __sim.random;
startTw = function () {};
finishTw = function () {};
playBattle = async function () {};
playBattle3D = async function () {};
showResult = async function () {};
phaseSwitch = async function (cb) { cb(); };
(function () {
    const origShowEvent = showEvent;
    showEvent = function (evt) {
        try { origShowEvent(evt); } catch (e) {}
        const ov = document.getElementById('event-overlay');
        if (!Array.isArray(ov._choices)) ov._choices = evt.choices.filter(c => !c.requires || c.requires(state));
        __sim.pending = {type: 'event', event: evt, choices: ov._choices};
    };
    const origShowChapter = showChapter;
    showChapter = function (ch) {
        try { origShowChapter(ch); } catch (e) {}
        __sim.pending = {type: 'chapter', chapter: ch};
    };
    const origShowDefeat = showDefeat;
    showDefeat = function (type) {
        if (!__sim.result) __sim.result = {kind: 'defeat', type, turn: state.turn};
        try { origShowDefeat(type); } catch (e) {}
    };
    const origShowEnding = showEnding;
    showEnding = function (id) {
        if (!__sim.result) __sim.result = {kind: 'berlin', endings: [id], chosen: id, turn: state.turn};
        try { origShowEnding(id); } catch (e) {}
    };
    const origResolve = resolveCombat;
    resolveCombat = async function (c) {
        const rec = {kind: c.kind, node: c.node, turn: state.turn, battle: false, won: false};
        __sim.current = rec;
        const ended = await origResolve(c);
        __sim.current = null;
        const defeated = __sim.result && __sim.result.kind === 'defeat';
        rec.won = !defeated && (c.kind === 'allyDefense' ? !!state.map.allied[c.node] : state.map.owner[c.node] === 'player' || !!state.map.allied[c.node]);
        __sim.combats.push(rec);
        return ended;
    };
    const origRun = runBattle;
    runBattle = async function (a, d, o) {
        const sim = await origRun(a, d, o);
        if (__sim.current) __sim.current.battle = true;
        return sim;
    };
    if (typeof resolveAlliedDefense === 'function') {
        const origAllied = resolveAlliedDefense;
        resolveAlliedDefense = function (th) {
            const had = !!state.map.allied[th.nodeId];
            origAllied(th);
            __sim.alliedDefenses.push({node: th.nodeId, turn: state.turn, held: !had || !!state.map.allied[th.nodeId]});
        };
    }
})();
`;

function createGame(seed) {
    const c = load();
    const sim = {random: mulberry32(seed), pending: null, result: null, combats: [], alliedDefenses: [], current: null};
    const sandbox = {
        __sim: sim,
        console,
        structuredClone,
        document: makeDocument(),
        localStorage: makeStorage(),
        sessionStorage: makeStorage(),
        navigator: universal(),
        location: universal(),
        performance: {now: () => 0},
        requestAnimationFrame: () => 0,
        cancelAnimationFrame: () => {
        },
        setTimeout: f => {
            if (typeof f === 'function') Promise.resolve().then(() => f());
            return 0;
        },
        clearTimeout: () => {
        },
        setInterval: () => 0,
        clearInterval: () => {
        }
    };
    const ctx = vm.createContext(sandbox);
    for (const s of c.scripts) s.runInContext(ctx);
    for (const name of c.called) {
        let t;
        try {
            t = vm.runInContext('typeof ' + name, ctx);
        } catch (e) {
            continue;
        }
        if (t === 'undefined') sandbox[name] = universal();
    }
    c.overrides.runInContext(ctx);
    const cache = {};
    const D = name => {
        if (!(name in cache)) cache[name] = vm.runInContext('typeof ' + name + ' === "undefined" ? undefined : ' + name, ctx);
        return cache[name];
    };
    return {G: sandbox, sim, D, state: () => sandbox.__S(), rng: mulberry32(seed ^ 0x9e3779b9)};
}

module.exports = {createGame, mulberry32, ROOT};
