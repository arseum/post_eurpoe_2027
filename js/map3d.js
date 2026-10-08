import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const STATUS_COLOR = { player: 0x0ac8b9, allied: 0x5fb37e, neutral: 0xc8aa6e, hostile: 0xc8473c };
const K = 2.2;
const LON0 = 9;
const LAT0 = 48;
const COS0 = Math.cos(LAT0 * Math.PI / 180);
const BBOX = { lon0: -6, lon1: 20, lat0: 41, lat1: 56 };
const PX = 40;

let renderer = null;
let labelRenderer = null;
let scene = null;
let camera = null;
let controls = null;
let container = null;
let resizeObserver = null;
let rafId = null;
let clock = null;
let heightField = null;
let sunLight = null;
let skyLight = null;
let dayCycle = null;
const SUN_DAY = new THREE.Color(0xfff1dc);
const SUN_DUSK = new THREE.Color(0xff8a4a);

const nodesById = new Map();
const meshToNodeId = new Map();
const linksByKey = new Map();
const flags = [];
const pulses = [];
let armyGroup = null;
let pendingSnapshot = null;
let selectCb = null;
let attract = false;
let focusAnim = null;
let hoverId = null;
let pointerNdc = null;
let homeTarget = new THREE.Vector3();
const raycaster = new THREE.Raycaster();

let pointerDownX = 0;
let pointerDownY = 0;
let pointerDown = false;

function geoX(lon) {
    return (lon - LON0) * COS0 * K;
}

function geoZ(lat) {
    return -(lat - LAT0) * K;
}

function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < 4; i++) {
        s += vnoise(x * f, y * f) * a;
        f *= 2.03;
        a *= 0.5;
    }
    return s;
}

const RIDGES = [
    { pts: [[5.7, 44.1], [6.7, 44.8], [7.0, 45.9], [7.9, 46.1], [8.8, 46.5], [10.0, 46.5], [11.5, 47.0], [13.0, 47.2], [14.8, 47.4]], sigma: 0.32, peak: 0.62 },
    { pts: [[-1.6, 43.1], [0.5, 42.7], [3.0, 42.5]], sigma: 0.28, peak: 0.36 },
    { pts: [[8.4, 44.3], [10.5, 44.0], [12.5, 43.0], [14.2, 41.8]], sigma: 0.3, peak: 0.26 },
    { pts: [[5.9, 46.5], [7.4, 47.4]], sigma: 0.2, peak: 0.16 },
    { pts: [[6.9, 48.0], [7.2, 48.7]], sigma: 0.18, peak: 0.14 },
    { pts: [[8.1, 47.7], [8.4, 48.7]], sigma: 0.18, peak: 0.13 },
    { pts: [[12.2, 50.2], [15.2, 50.7]], sigma: 0.25, peak: 0.15 },
    { pts: [[13.0, 49.0], [14.0, 48.6]], sigma: 0.25, peak: 0.12 },
    { pts: [[2.6, 45.0], [3.3, 45.8]], sigma: 0.55, peak: 0.18 }
];

function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    const cx = ax + dx * t - px, cy = ay + dy * t - py;
    return Math.sqrt(cx * cx + cy * cy);
}

function relief(lon, lat) {
    const c = Math.cos(lat * Math.PI / 180);
    let h = 0;
    for (const r of RIDGES) {
        let d = Infinity;
        for (let i = 0; i < r.pts.length - 1; i++) {
            const [ax, ay] = r.pts[i], [bx, by] = r.pts[i + 1];
            d = Math.min(d, segDist(lon * c, lat, ax * c, ay, bx * c, by));
        }
        const ridged = 1 - Math.abs(2 * fbm(lon * 7.5, lat * 7.5) - 1);
        h += Math.exp(-((d / r.sigma) ** 2)) * r.peak * (0.35 + 0.75 * fbm(lon * 3.4, lat * 3.4) + 0.35 * ridged * ridged);
    }
    return h;
}

function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    const n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
        let acc = 0;
        for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
            tmp[y * w + x] = acc / n;
            acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
        }
    }
    for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
            out[y * w + x] = acc / n;
            acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
        }
    }
    return out;
}

function buildHeightField() {
    const w = (BBOX.lon1 - BBOX.lon0) * PX, h = (BBOX.lat1 - BBOX.lat0) * PX;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    const land = typeof EUROPE_LAND !== 'undefined' ? EUROPE_LAND : [];
    for (const ring of land) {
        ctx.beginPath();
        ring.forEach(([lon, lat], i) => {
            const x = (lon - BBOX.lon0) * PX, y = (BBOX.lat1 - lat) * PX;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
    }
    const raw = ctx.getImageData(0, 0, w, h).data;
    const mask = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = raw[i * 4] / 255;
    heightField = { w, h, soft: boxBlur(mask, w, h, 3), coast: boxBlur(boxBlur(mask, w, h, 12), w, h, 12) };
}

function sampleField(field, lon, lat) {
    const { w, h } = heightField;
    const fx = Math.max(0, Math.min(w - 1.001, (lon - BBOX.lon0) * PX));
    const fy = Math.max(0, Math.min(h - 1.001, (BBOX.lat1 - lat) * PX));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const a = field[y0 * w + x0], b = field[y0 * w + x0 + 1], c = field[(y0 + 1) * w + x0], d = field[(y0 + 1) * w + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

function terrainAt(lon, lat) {
    const land = sampleField(heightField.soft, lon, lat);
    const lm = smoothstep(0.3, 0.7, land);
    const inland = smoothstep(0.5, 0.95, land);
    const hLand = 0.04 + relief(lon, lat) * inland + fbm(lon * 4.1, lat * 4.1) * 0.05 * inland;
    return { h: -0.2 * (1 - lm) + hLand * lm, land: lm, coast: sampleField(heightField.coast, lon, lat) };
}

function heightAt(lon, lat) {
    return terrainAt(lon, lat).h;
}

const LAND_STOPS = [
    [0.0, new THREE.Color(0x353b35)],
    [0.1, new THREE.Color(0x3d433b)],
    [0.2, new THREE.Color(0x484b42)],
    [0.34, new THREE.Color(0x56585a)],
    [0.5, new THREE.Color(0x777b80)],
    [0.62, new THREE.Color(0xc9ccd0)]
];
const SEA_DEEP = new THREE.Color(0x061224);
const SEA_SHALLOW = new THREE.Color(0x0e2b42);
const CONTOUR = new THREE.Color(0x6a5530);
const VOID = new THREE.Color(0x04080f);

function landColor(h, out) {
    for (let i = 1; i < LAND_STOPS.length; i++) {
        if (h <= LAND_STOPS[i][0] || i === LAND_STOPS.length - 1) {
            const [a, ca] = LAND_STOPS[i - 1], [b, cb] = LAND_STOPS[i];
            return out.copy(ca).lerp(cb, Math.max(0, Math.min(1, (h - a) / (b - a))));
        }
    }
    return out;
}

function buildTerrain() {
    const lonSpan = BBOX.lon1 - BBOX.lon0, latSpan = BBOX.lat1 - BBOX.lat0;
    const width = lonSpan * COS0 * K, depth = latSpan * K;
    const segX = 460, segZ = 360;
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const cx = (geoX(BBOX.lon0) + geoX(BBOX.lon1)) / 2, cz = (geoZ(BBOX.lat0) + geoZ(BBOX.lat1)) / 2;
    geo.translate(cx, 0, cz);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color(), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const lon = pos.getX(i) / (COS0 * K) + LON0;
        const lat = -pos.getZ(i) / K + LAT0;
        const t = terrainAt(lon, lat);
        pos.setY(i, t.h);
        if (t.land > 0.5) {
            landColor(Math.max(0, t.h), col);
            col.multiplyScalar(0.88 + fbm(lon * 6, lat * 6) * 0.24);
        } else {
            col.copy(SEA_DEEP).lerp(SEA_SHALLOW, Math.min(1, t.coast * 1.8));
            col.lerp(CONTOUR, smoothstep(0.32, 0.5, t.land + t.coast * 0.3) * 0.35);
        }
        const ex = Math.min(lon - BBOX.lon0, BBOX.lon1 - lon) / 3.5, ez = Math.min(lat - BBOX.lat0, BBOX.lat1 - lat) / 2.5;
        col.lerp(VOID, 1 - smoothstep(0, 1, Math.min(ex, ez)));
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }));
    scene.add(mesh);

    const coastMat = new THREE.LineBasicMaterial({ color: 0xc8aa6e, transparent: true, opacity: 0.55 });
    for (const ring of (typeof EUROPE_LAND !== 'undefined' ? EUROPE_LAND : [])) {
        const pts = ring.map(([lon, lat]) => new THREE.Vector3(geoX(lon), Math.max(-0.08, heightAt(lon, lat)) + 0.02, geoZ(lat)));
        scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), coastMat));
    }
    const riverMat = new THREE.LineBasicMaterial({ color: 0x3f8fb0, transparent: true, opacity: 0.75 });
    for (const r of (typeof EUROPE_RIVERS !== 'undefined' ? EUROPE_RIVERS : [])) {
        const pts = r.pts.map(([lon, lat]) => new THREE.Vector3(geoX(lon), heightAt(lon, lat) + 0.025, geoZ(lat)));
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), riverMat));
    }
    const grat = [];
    for (let lon = -4; lon <= 18; lon += 2) grat.push(new THREE.Vector3(geoX(lon), -0.19, geoZ(BBOX.lat0 + 1)), new THREE.Vector3(geoX(lon), -0.19, geoZ(BBOX.lat1 - 1)));
    for (let lat = 42; lat <= 55; lat += 2) grat.push(new THREE.Vector3(geoX(BBOX.lon0 + 1), -0.19, geoZ(lat)), new THREE.Vector3(geoX(BBOX.lon1 - 1), -0.19, geoZ(lat)));
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grat), new THREE.LineBasicMaterial({ color: 0xc8aa6e, transparent: true, opacity: 0.07 })));
}

function buildScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x04080f, 30, 70);
    skyLight = new THREE.HemisphereLight(0x9ab8d8, 0x101820, 0.8);
    scene.add(skyLight);
    sunLight = new THREE.DirectionalLight(0xfff1dc, 2.1);
    sunLight.position.set(-9, 7, -4);
    scene.add(sunLight);
    const rim = new THREE.DirectionalLight(0x5fa8c8, 0.35);
    rim.position.set(6, 4, 8);
    scene.add(rim);
    buildHeightField();
    buildTerrain();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
}

const BRASS = new THREE.MeshStandardMaterial({ color: 0x8a6a34, roughness: 0.38, metalness: 0.85 });
const BRASS_DARK = new THREE.MeshStandardMaterial({ color: 0x3e2f16, roughness: 0.55, metalness: 0.7 });
const STONE = new THREE.MeshStandardMaterial({ color: 0x4a463e, roughness: 0.95 });
const IRON = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.55, metalness: 0.6 });

function glass(color) {
    return new THREE.MeshStandardMaterial({ color: 0xbfeaf0, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.22, emissive: new THREE.Color(color), emissiveIntensity: 0.12, depthWrite: false });
}

function glow(color, intensity = 1.4) {
    return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(color), emissiveIntensity: intensity });
}

function add(group, geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
}

function buildHome(g) {
    add(g, new THREE.CylinderGeometry(0.62, 0.66, 0.06, 32), BRASS, 0, 0.03);
    add(g, new THREE.CylinderGeometry(0.06, 0.1, 0.9, 10), BRASS, 0, 0.45);
    add(g, new THREE.OctahedronGeometry(0.11), glow(0x0ac8b9, 2.2), 0, 0.98);
    for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        add(g, new THREE.BoxGeometry(0.12, 0.18 + (i % 2) * 0.12, 0.12), IRON, Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3);
    }
    return add(g, new THREE.SphereGeometry(0.6, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass(0x0ac8b9));
}

function buildCity(g) {
    add(g, new THREE.CylinderGeometry(0.46, 0.5, 0.05, 28), BRASS, 0, 0.025);
    [[0, 0.28, 0], [-0.17, 0.18, 0.1], [0.16, 0.22, -0.08], [0.05, 0.14, 0.2]].forEach(([x, h, z]) => add(g, new THREE.BoxGeometry(0.11, h, 0.11), IRON, x, h / 2, z));
    return add(g, new THREE.SphereGeometry(0.44, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass(0xc8aa6e));
}

function buildRuin(g) {
    let last = null;
    [[-0.22, 0.1, 0.32, 0.25], [0.18, -0.14, 0.42, -0.2], [0.04, 0.24, 0.2, 0.35], [-0.05, -0.25, 0.26, 0.1]].forEach(([x, z, h, r]) => {
        last = add(g, new THREE.BoxGeometry(0.12, h, 0.12), STONE, x, h / 2, z);
        last.rotation.z = r;
    });
    add(g, new THREE.TorusGeometry(0.32, 0.03, 6, 20, Math.PI * 1.2), STONE, 0, 0.05, 0).rotation.x = Math.PI / 2;
    add(g, new THREE.OctahedronGeometry(0.07), glow(0xd9874e, 1.6), 0, 0.22, 0);
    return add(g, new THREE.CylinderGeometry(0.42, 0.46, 0.04, 7), STONE, 0, 0.02);
}

function buildOutpost(g) {
    add(g, new THREE.CylinderGeometry(0.42, 0.5, 0.06, 4), IRON, 0, 0.03).rotation.y = Math.PI / 4;
    const body = add(g, new THREE.CylinderGeometry(0.26, 0.36, 0.3, 4), IRON, 0, 0.21);
    body.rotation.y = Math.PI / 4;
    add(g, new THREE.BoxGeometry(0.4, 0.03, 0.03), glow(0xc8473c, 1.8), 0, 0.26, 0.2);
    add(g, new THREE.CylinderGeometry(0.08, 0.1, 0.2, 8), IRON, 0, 0.46);
    add(g, new THREE.BoxGeometry(0.26, 0.04, 0.04), IRON, 0.1, 0.5, 0);
    return body;
}

function buildCapital(g) {
    add(g, new THREE.CylinderGeometry(0.7, 0.78, 0.1, 8), IRON, 0, 0.05);
    add(g, new THREE.CylinderGeometry(0.5, 0.6, 0.22, 8), IRON, 0, 0.21);
    const keep = add(g, new THREE.CylinderGeometry(0.28, 0.4, 0.4, 8), IRON, 0, 0.52);
    add(g, new THREE.ConeGeometry(0.12, 0.7, 8), IRON, 0, 1.07);
    add(g, new THREE.OctahedronGeometry(0.08), glow(0xc8473c, 2.4), 0, 1.5);
    for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + Math.PI / 4;
        add(g, new THREE.CylinderGeometry(0.035, 0.05, 0.7, 6), IRON, Math.cos(a) * 0.62, 0.45, Math.sin(a) * 0.62);
        add(g, new THREE.SphereGeometry(0.05, 8, 6), glow(0xc8473c, 2), Math.cos(a) * 0.62, 0.82, Math.sin(a) * 0.62);
    }
    return keep;
}

function buildNexus(g) {
    add(g, new THREE.CylinderGeometry(0.44, 0.5, 0.1, 6), IRON, 0, 0.05);
    add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 6), glow(0xa98bd9, 0.9), 0, 0.12);
    const crystal = add(g, new THREE.OctahedronGeometry(0.13), new THREE.MeshStandardMaterial({ color: 0x2a1f3d, emissive: new THREE.Color(0xa98bd9), emissiveIntensity: 1.3, roughness: 0.2, metalness: 0.3 }), 0, 0.55);
    crystal.scale.y = 1.5;
    crystal.userData.spin = true;
    return crystal;
}

const BUILDERS = { home: buildHome, city: buildCity, ruin: buildRuin, outpost: buildOutpost, capital: buildCapital, nexus: buildNexus };

function makeFlag(color) {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.9, 6), BRASS, 0, 0.45);
    add(g, new THREE.SphereGeometry(0.03, 8, 6), BRASS, 0, 0.92);
    const geo = new THREE.PlaneGeometry(0.34, 0.2, 12, 1);
    geo.translate(0.17, 0, 0);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 0.8 });
    const cloth = add(g, geo, mat, 0.014, 0.78);
    flags.push({ cloth, base: geo.attributes.position.array.slice(), phase: Math.random() * 6 });
    return { group: g, mat };
}

function waveFlags(t) {
    for (const f of flags) {
        const arr = f.cloth.geometry.attributes.position.array;
        for (let i = 0; i < arr.length; i += 3) {
            const x = f.base[i];
            arr[i + 2] = Math.sin(x * 14 - t * 4 + f.phase) * 0.035 * (x / 0.34);
            arr[i + 1] = f.base[i + 1] - x * 0.06;
        }
        f.cloth.geometry.attributes.position.needsUpdate = true;
    }
}

function labelHtml(n) {
    return `<div class="m3d-name"><i class="ph-duotone ph-${n.glyph || 'circle'}"></i>${n.name}</div>` + (n.threat != null ? `<div class="m3d-threat"><i class="ph-fill ph-warning-diamond"></i>${n.threat} tour${n.threat > 1 ? 's' : ''}</div>` : '');
}

const haloGeo = new THREE.RingGeometry(0.68, 0.72, 48);
const discGeo = new THREE.CircleGeometry(0.66, 48);
const selGeo = new THREE.RingGeometry(0.84, 0.9, 6);
const threatGeo = new THREE.RingGeometry(0.96, 1.04, 48);

function createNode(n) {
    const group = new THREE.Group();
    const lon = n.lon, lat = n.lat;
    const y = Math.max(0.02, heightAt(lon, lat));
    group.position.set(geoX(lon), y, geoZ(lat));
    scene.add(group);
    add(group, new THREE.CylinderGeometry(0.62, 0.7, 0.5, 6), BRASS_DARK, 0, -0.22);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    const halo = add(group, haloGeo, haloMat, 0, 0.035);
    halo.rotation.x = -Math.PI / 2;
    const discMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false });
    const disc = add(group, discGeo, discMat, 0, 0.032);
    disc.rotation.x = -Math.PI / 2;
    const model = new THREE.Group();
    model.position.y = 0.04;
    group.add(model);
    const pick = (BUILDERS[n.type] || buildCity)(model);
    const flag = makeFlag(0xffffff);
    flag.group.position.set(0.5, 0.03, -0.32);
    group.add(flag.group);
    const sel = add(group, selGeo, new THREE.MeshBasicMaterial({ color: 0xf0e6d2, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }), 0, 0.04);
    sel.rotation.x = -Math.PI / 2;
    sel.visible = false;
    const threat = add(group, threatGeo, new THREE.MeshBasicMaterial({ color: 0xff5a48, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }), 0, 0.045);
    threat.rotation.x = -Math.PI / 2;
    threat.visible = false;
    const labelEl = document.createElement('div');
    labelEl.className = 'm3d-label';
    labelEl.dataset.node = n.id;
    const label = new CSS2DObject(labelEl);
    label.position.set(0, n.type === 'capital' ? 1.85 : 1.25, 0);
    group.add(label);
    const hit = add(group, new THREE.CylinderGeometry(0.75, 0.75, 1.2, 12), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.5);
    meshToNodeId.set(hit, n.id);
    const entry = { id: n.id, group, model, pick, haloMat, discMat, flagMat: flag.mat, sel, threat, labelEl, status: null, lon, lat, y };
    nodesById.set(n.id, entry);
    return entry;
}

function updateNode(e, n) {
    if (e.status !== n.status) {
        const c = STATUS_COLOR[n.status] ?? 0xc8aa6e;
        e.haloMat.color.set(c);
        e.discMat.color.set(c);
        e.flagMat.color.set(c);
        e.flagMat.emissive.set(c);
        e.status = n.status;
        e.labelEl.style.setProperty('--st', `var(--st-${n.status})`);
    }
    e.sel.visible = !!n.selected;
    e.threat.visible = n.threat != null;
    e.labelEl.classList.toggle('sel', !!n.selected);
    const html = labelHtml(n);
    if (e.labelEl._html !== html) {
        e.labelEl.innerHTML = html;
        e.labelEl._html = html;
    }
}

let stripeTex = null;

function getStripeTex() {
    if (stripeTex) return stripeTex;
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 4;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, 64, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 30, 4);
    stripeTex = new THREE.CanvasTexture(cv);
    stripeTex.wrapS = THREE.RepeatWrapping;
    return stripeTex;
}

function routeCurve(a, b) {
    const pts = [];
    const N = 28;
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        const lon = a.lon + (b.lon - a.lon) * t, lat = a.lat + (b.lat - a.lat) * t;
        const yA = a.y + 0.06, yB = b.y + 0.06;
        const ground = Math.max(0, heightAt(lon, lat)) + 0.06;
        const y = Math.max(ground, yA + (yB - yA) * t) + Math.sin(t * Math.PI) * 0.1;
        pts.push(new THREE.Vector3(geoX(lon), y, geoZ(lat)));
    }
    return new THREE.CatmullRomCurve3(pts);
}

function buildLinks(links) {
    for (const l of links) {
        const key = l.a + '|' + l.b;
        if (linksByKey.has(key)) continue;
        const a = nodesById.get(l.a), b = nodesById.get(l.b);
        if (!a || !b) continue;
        const curve = routeCurve(a, b);
        const len = curve.getLength();
        const idle = new THREE.MeshBasicMaterial({ color: 0x8a6a34, transparent: true, opacity: 0.55 });
        const tex = getStripeTex().clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(len * 3)), 1);
        const live = new THREE.MeshBasicMaterial({ color: 0x3ff5e6, map: tex, transparent: true, opacity: 0.95, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.026, 6, false), idle);
        scene.add(mesh);
        const tagEl = document.createElement('div');
        tagEl.className = 'm3d-route';
        tagEl.innerHTML = `<i class="ph-fill ph-hourglass-medium"></i>${l.turns} tour${l.turns > 1 ? 's' : ''}`;
        const tag = new CSS2DObject(tagEl);
        tag.position.copy(curve.getPoint(0.5)).add(new THREE.Vector3(0, 0.12, 0));
        tag.visible = false;
        scene.add(tag);
        linksByKey.set(key, { a: l.a, b: l.b, curve, mesh, idle, live, tex, tag, dir: 1 });
    }
}

function updateLinks(links, army, selected) {
    for (const l of links) {
        const e = linksByKey.get(l.a + '|' + l.b);
        if (!e) continue;
        const marching = army && army.to && ((army.from === l.a && army.to === l.b) || (army.from === l.b && army.to === l.a));
        const active = l.active || marching;
        e.mesh.material = active ? e.live : e.idle;
        e.tag.visible = !!l.active && (l.a === selected || l.b === selected) && !(army && army.at === selected);
        const origin = l.active ? (army && army.at) : (army && army.from);
        e.dir = origin === l.b ? -1 : 1;
    }
}

function ensureArmy() {
    if (armyGroup) return armyGroup;
    armyGroup = new THREE.Group();
    const f = makeFlag(0x0ac8b9);
    f.group.scale.setScalar(1.35);
    armyGroup.add(f.group);
    const gem = add(armyGroup, new THREE.OctahedronGeometry(0.09), glow(0x0ac8b9, 2.4), 0, 1.36);
    gem.userData.spin = true;
    const ring = add(armyGroup, new THREE.RingGeometry(0.12, 0.17, 24), new THREE.MeshBasicMaterial({ color: 0x0ac8b9, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), 0, 0.02);
    ring.rotation.x = -Math.PI / 2;
    scene.add(armyGroup);
    return armyGroup;
}

function updateArmy(army) {
    const g = ensureArmy();
    if (!army) {
        g.visible = false;
        return;
    }
    g.visible = true;
    if (army.at) {
        const n = nodesById.get(army.at);
        if (n) g.position.set(n.group.position.x - 0.55, n.y + 0.03, n.group.position.z + 0.36);
        return;
    }
    const key1 = army.from + '|' + army.to, key2 = army.to + '|' + army.from;
    const e = linksByKey.get(key1) || linksByKey.get(key2);
    if (!e) return;
    const t = linksByKey.has(key1) ? army.progress : 1 - army.progress;
    const p = e.curve.getPoint(Math.max(0.12, Math.min(0.88, t)));
    g.position.set(p.x, p.y - 0.05, p.z);
}

function applySnapshot(s) {
    for (const n of s.nodes || []) updateNode(nodesById.get(n.id) || createNode(n), n);
    buildLinks(s.links || []);
    updateLinks(s.links || [], s.army, (s.nodes || []).filter(n => n.selected).map(n => n.id)[0]);
    updateArmy(s.army);
    if (!homeTarget.lengthSq()) {
        const xs = [...nodesById.values()];
        const zs = xs.map(e => e.group.position.z);
        homeTarget.set(xs.reduce((a, e) => a + e.group.position.x, 0) / xs.length, 0, (Math.min(...zs) + Math.max(...zs)) / 2 + 1.4);
        resetCamera();
    }
}

function resetCamera() {
    if (!camera) return;
    camera.position.copy(homeTarget).add(new THREE.Vector3(0, 27, 16.5));
    camera.lookAt(homeTarget);
    if (controls) {
        controls.target.copy(homeTarget);
        controls.update();
    }
}

function pickAt(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([...meshToNodeId.keys()], false);
    return hits.length ? meshToNodeId.get(hits[0].object) : null;
}

function onPointerDown(ev) {
    pointerDown = true;
    pointerDownX = ev.clientX;
    pointerDownY = ev.clientY;
}

function onPointerUp(ev) {
    if (!pointerDown) return;
    pointerDown = false;
    if (attract || Math.hypot(ev.clientX - pointerDownX, ev.clientY - pointerDownY) > 5 || !selectCb) return;
    selectCb(pickAt(ev));
}

function onPointerMove(ev) {
    if (attract) return;
    pointerNdc = ev;
}

function updateHover() {
    if (!pointerNdc || pointerDown) return;
    const id = pickAt(pointerNdc);
    pointerNdc = null;
    if (id === hoverId) return;
    if (hoverId && nodesById.get(hoverId)) nodesById.get(hoverId).labelEl.classList.remove('hover');
    hoverId = id;
    if (id) nodesById.get(id).labelEl.classList.add('hover');
    renderer.domElement.style.cursor = id ? 'pointer' : '';
}

function spawnPulse(id, color) {
    const e = nodesById.get(id);
    if (!e) return;
    [0, 0.25].forEach(delay => {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.68, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(e.group.position.x, e.y + 0.06, e.group.position.z);
        scene.add(m);
        pulses.push({ m, t: -delay, dur: 1.3 });
    });
    e.model.scale.setScalar(1.25);
}

function updatePulses(dt) {
    for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += dt;
        if (p.t < 0) continue;
        const k = p.t / p.dur;
        p.m.scale.setScalar(1 + k * 2.6);
        p.m.material.opacity = Math.max(0, 1 - k) * 0.9;
        if (k >= 1) {
            scene.remove(p.m);
            p.m.geometry.dispose();
            p.m.material.dispose();
            pulses.splice(i, 1);
        }
    }
}

function animate() {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.getElapsedTime();
    if (attract) {
        const a = Math.sin(t * 0.06) * 0.5;
        camera.position.set(homeTarget.x + Math.sin(a) * 22, 17, homeTarget.z + Math.cos(a) * 22);
        camera.lookAt(homeTarget.x, 0, homeTarget.z - 1);
    } else if (controls) {
        if (focusAnim) {
            focusAnim.k = Math.min(1, focusAnim.k + dt / 0.7);
            const e = 1 - Math.pow(1 - focusAnim.k, 3);
            const next = focusAnim.from.clone().lerp(focusAnim.to, e);
            camera.position.add(next.clone().sub(controls.target));
            controls.target.copy(next);
            if (focusAnim.k >= 1) focusAnim = null;
        }
        controls.target.x = Math.max(homeTarget.x - 9, Math.min(homeTarget.x + 9, controls.target.x));
        controls.target.z = Math.max(homeTarget.z - 11, Math.min(homeTarget.z + 9, controls.target.z));
        controls.target.y = 0;
        controls.update();
        updateHover();
    }
    nodesById.forEach(e => {
        if (e.sel.visible) e.sel.rotation.z += dt * 0.5;
        if (e.threat.visible) e.threat.material.opacity = 0.55 + Math.sin(t * 4) * 0.35;
        const s = e.model.scale.x;
        if (s > 1) e.model.scale.setScalar(Math.max(1, s - dt * 0.6));
        e.model.traverse(o => {
            if (o.userData.spin) o.rotation.y += dt * 0.9;
        });
    });
    linksByKey.forEach(e => {
        if (e.mesh.material === e.live) e.tex.offset.x -= dt * 0.9 * e.dir;
    });
    if (armyGroup && armyGroup.visible) {
        armyGroup.children.forEach(o => {
            if (o.userData.spin) {
                o.rotation.y += dt * 1.6;
                o.position.y = 1.36 + Math.sin(t * 2.4) * 0.04;
            }
        });
    }
    waveFlags(t);
    updatePulses(dt);
    updateDayCycle(dt);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

function updateDayCycle(dt) {
    if (!dayCycle) return;
    dayCycle.k = Math.min(1, dayCycle.k + dt / dayCycle.dur);
    const k = dayCycle.k;
    const night = Math.sin(Math.PI * k);
    sunLight.intensity = 2.1 * (1 - night * 0.82);
    sunLight.color.copy(SUN_DAY).lerp(SUN_DUSK, Math.min(1, night * 1.6) * (1 - Math.pow(night, 6)));
    skyLight.intensity = 0.8 * (1 - night * 0.6);
    if (k >= 1) {
        sunLight.intensity = 2.1;
        sunLight.color.copy(SUN_DAY);
        skyLight.intensity = 0.8;
        dayCycle = null;
    }
}

function passDay(ms = 1800) {
    if (sunLight) dayCycle = { k: 0, dur: ms / 1000 };
}

function mount(el) {
    container = el;
    if (!scene) buildScene();
    if (!clock) clock = new THREE.Clock();
    if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.inset = '0';
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
    }
    if (renderer.domElement.parentElement !== container) container.appendChild(renderer.domElement);
    if (!labelRenderer) {
        labelRenderer = new CSS2DRenderer();
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.inset = '0';
        labelRenderer.domElement.style.pointerEvents = 'none';
    }
    if (labelRenderer.domElement.parentElement !== container) container.appendChild(labelRenderer.domElement);
    if (!controls) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.screenSpacePanning = false;
        controls.minDistance = 8;
        controls.maxDistance = 34;
        controls.minPolarAngle = 0.35;
        controls.maxPolarAngle = 1.05;
        controls.minAzimuthAngle = -0.6;
        controls.maxAzimuthAngle = 0.6;
        controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
        controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
        resetCamera();
    }
    controls.enabled = !attract;
    const resize = () => {
        const w = container.clientWidth || 1, h = container.clientHeight || 1;
        renderer.setSize(w, h);
        labelRenderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    };
    resize();
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    if (pendingSnapshot) {
        applySnapshot(pendingSnapshot);
        pendingSnapshot = null;
    }
    if (rafId) cancelAnimationFrame(rafId);
    animate();
}

function sync(snapshot) {
    if (!snapshot) return;
    if (!scene) {
        pendingSnapshot = snapshot;
        return;
    }
    applySnapshot(snapshot);
}

function onSelect(cb) {
    selectCb = cb;
}

function stop() {
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
}

function setAttract(on) {
    if (attract === on) return;
    attract = on;
    if (controls) controls.enabled = !on;
    if (!on) resetCamera();
}

function focus(id) {
    const e = nodesById.get(id);
    if (!e || !controls) return;
    focusAnim = { from: controls.target.clone(), to: new THREE.Vector3(e.group.position.x, 0, e.group.position.z + 0.6), k: 0 };
}

function pulse(id, color = 0x0ac8b9) {
    if (scene) spawnPulse(id, color);
}

window.Map3D = { mount, sync, onSelect, stop, setAttract, focus, pulse, passDay };
