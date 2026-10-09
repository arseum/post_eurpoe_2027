import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildEmblem } from './emblem3d.js';

const SLOT_COUNT = 10;
const SLOT_RADIUS = 6.8;

let renderer = null;
let composer = null;
let bloomPass = null;
let scene = null;
let camera = null;
let controls = null;
let container = null;
let resizeObserver = null;
let rafId = null;
let clock = null;
let hqTop = null;
let hqGroup = null;
let hqCoreLevel = 1;
let hqRing2 = null;
let hqRing3 = null;
let slots = [];
let built = new Map();
let satellites = [];
const raycaster = new THREE.Raycaster();
const hitTargets = new Map();
let selectCb = null;
let hoverCb = null;
let hoverId = null;
let selectedId = null;
let pointerEv = null;
let pointerDown = null;
let hoverRing = null;
let selRing = null;
const banners = new Map();
const CITY_ORDER = ['lyon', 'marseille', 'turin'];
const KIND_COLOR = { take: 0x0ac8b9, ally: 0x5fb37e };

const KIT_PALETTE = {
    metal: { color: 0x8c99ab, roughness: 0.42, metalness: 0.65 },
    metalDark: { color: 0x34445c, roughness: 0.48, metalness: 0.7 },
    metalRed: { color: 0xc8aa6e, roughness: 0.42, metalness: 0.85 },
    dark: { color: 0x0a121c, roughness: 0.6, metalness: 0.2, emissive: 0x0ac8b9, emissiveIntensity: 0.55 },
    crystal: { color: 0x0e2a24, roughness: 0.25, metalness: 0.1, emissive: 0x0ac8b9, emissiveIntensity: 1.1 },
    rock: { color: 0x3a3f48, roughness: 0.9, metalness: 0.05 },
    rockTrack: { color: 0x2a2e36, roughness: 0.9, metalness: 0.05 },
    glass: { color: 0x9fe8e0, roughness: 0.05, metalness: 0.1, emissive: 0x0ac8b9, emissiveIntensity: 0.08, opacity: 0.28 },
    _defaultMat: { color: 0x7fd8d2, roughness: 0.08, metalness: 0.1, emissive: 0x0ac8b9, emissiveIntensity: 0.15, opacity: 0.4 }
};
const GLOWING = new Set(['dark', 'crystal']);
const kitCache = new Map();
const gltfLoader = new GLTFLoader();

function kitModel(name) {
    if (!kitCache.has(name)) kitCache.set(name, gltfLoader.loadAsync('assets/models/kit/' + name + '.glb').then(g => {
        const box = new THREE.Box3().setFromObject(g.scene);
        const c = box.getCenter(new THREE.Vector3());
        g.scene.position.set(-c.x, -box.min.y, -c.z);
        const wrap = new THREE.Group();
        wrap.add(g.scene);
        return wrap;
    }));
    return kitCache.get(name);
}

function kitMaterial(name, glow) {
    const p = KIT_PALETTE[name] || KIT_PALETTE.metal;
    const m = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: p.roughness,
        metalness: p.metalness,
        emissive: new THREE.Color(glow && GLOWING.has(name) ? glow : (p.emissive || 0)),
        emissiveIntensity: p.emissiveIntensity || 0
    });
    if (p.opacity) {
        m.transparent = true;
        m.opacity = p.opacity;
        m.depthWrite = false;
    }
    return m;
}

function shadowsOn(obj) {
    obj.traverse(o => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
}

function addKit(group, name, { x = 0, y = 0, z = 0, s = 1, ry = 0, glow = null, remap = {} } = {}) {
    return kitModel(name).then(src => {
        const obj = src.clone(true);
        const mats = new Map();
        obj.traverse(o => {
            if (!o.isMesh) return;
            const key = remap[o.material.name] || o.material.name;
            if (!mats.has(key)) mats.set(key, kitMaterial(key, glow));
            o.material = mats.get(key);
        });
        shadowsOn(obj);
        obj.position.set(x, y, z);
        obj.scale.setScalar(s);
        obj.rotation.y = ry;
        group.add(obj);
        return obj;
    }).catch(() => null);
}

function floorTexture() {
    const size = 1024, c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const mid = size / 2, k = size / 28;
    const bg = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
    bg.addColorStop(0, '#1b2433');
    bg.addColorStop(0.55, '#121924');
    bg.addColorStop(1, '#0a0f17');
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = 'rgba(120, 140, 170, 0.06)';
    g.lineWidth = 1;
    for (let i = -size; i < size * 2; i += 24) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i - size * 0.58, size);
        g.stroke();
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + size * 0.58, size);
        g.stroke();
    }
    g.strokeStyle = 'rgba(200, 170, 110, 0.32)';
    g.lineWidth = 3;
    [SLOT_RADIUS - 1.6, SLOT_RADIUS + 1.6].forEach(rad => {
        g.beginPath();
        g.arc(mid, mid, rad * k, 0, Math.PI * 2);
        g.stroke();
    });
    g.strokeStyle = 'rgba(10, 200, 185, 0.22)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(mid, mid, 2.6 * k, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(200, 170, 110, 0.18)';
    g.lineWidth = 6;
    for (let i = 0; i < SLOT_COUNT; i++) {
        const a = (i / SLOT_COUNT) * Math.PI * 2 + 0.3;
        g.beginPath();
        g.moveTo(mid + Math.cos(a) * 2.6 * k, mid + Math.sin(a) * 2.6 * k);
        g.lineTo(mid + Math.cos(a) * (SLOT_RADIUS - 1.3) * k, mid + Math.sin(a) * (SLOT_RADIUS - 1.3) * k);
        g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

function backdropTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    const bg = g.createRadialGradient(256, 210, 0, 256, 256, 360);
    bg.addColorStop(0, '#0d1d36');
    bg.addColorStop(1, '#04080f');
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

const RESEARCH_BRANCH_COLORS = Object.fromEntries(Object.entries(RESEARCH_BRANCHES).map(([k, b]) => [k, parseInt(b.color.slice(1), 16)]));

function ease(fn, dur, onUpdate) {
    return new Promise((resolve) => {
        const start = performance.now();
        function step(now) {
            const t = Math.min(1, (now - start) / dur);
            onUpdate(fn(t));
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}

function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function buildScene() {
    scene = new THREE.Scene();
    scene.background = backdropTexture();
    scene.fog = new THREE.FogExp2(0x04080f, 0.022);

    const hemi = new THREE.HemisphereLight(0x9ab8d8, 0x101820, 0.55);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff1dc, 2.2);
    dir.position.set(7, 14, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -12;
    dir.shadow.camera.right = 12;
    dir.shadow.camera.top = 12;
    dir.shadow.camera.bottom = -12;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 40;
    dir.shadow.bias = -0.0004;
    dir.shadow.normalBias = 0.03;
    scene.add(dir);
    const rim = new THREE.DirectionalLight(0x5fa8c8, 0.5);
    rim.position.set(-8, 5, -9);
    scene.add(rim);

    const groundGeo = new THREE.CircleGeometry(14, 72);
    const groundMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.82, metalness: 0.25 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const domeGeo = new THREE.SphereGeometry(13.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({
        color: 0x9fd8e0,
        transparent: true,
        opacity: 0.05,
        side: THREE.BackSide,
        depthWrite: false
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    scene.add(dome);

    const domeWireMat = new THREE.MeshBasicMaterial({
        color: 0xc8aa6e,
        transparent: true,
        opacity: 0.07,
        wireframe: true,
        depthWrite: false
    });
    const domeWire = new THREE.Mesh(domeGeo, domeWireMat);
    scene.add(domeWire);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(9, 8, 12);

    buildHq();
    buildSlots();
    const coreHit = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
    coreHit.position.y = 2.3;
    scene.add(coreHit);
    hitTargets.set(coreHit, () => 'core');
    hoverRing = markerRing(0xc8aa6e, 0.75);
    selRing = markerRing(0x0ac8b9, 0.95);
}

function markerRing(color, opacity) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 8, 72), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    scene.add(ring);
    return ring;
}

function placeRing(ring, id, grow) {
    if (!id) {
        ring.visible = false;
        return;
    }
    let x = 0, z = 0, rad = 2.5;
    if (id !== 'core') {
        const slot = id.startsWith('slot:') ? slots[+id.slice(5)] : (built.get(id) || {}).slot;
        if (!slot) {
            ring.visible = false;
            return;
        }
        x = slot.x;
        z = slot.z;
        rad = id.startsWith('slot:') ? 1.2 : 1.5 + (built.get(id).level - 1) * 0.2;
    }
    ring.position.set(x, 0.2, z);
    ring.scale.setScalar(rad + grow);
    ring.visible = true;
}

function pickAt(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([...hitTargets.keys()], false);
    return hits.length ? hitTargets.get(hits[0].object)() : null;
}

function setHover(id, ev) {
    if (id !== hoverId) {
        hoverId = id;
        placeRing(hoverRing, id === selectedId ? null : id, 0.08);
        renderer.domElement.style.cursor = id ? 'pointer' : '';
    }
    if (hoverCb) hoverCb(id, ev);
}

function onPointerDown(ev) {
    pointerDown = { x: ev.clientX, y: ev.clientY };
}

function onPointerUp(ev) {
    const down = pointerDown;
    pointerDown = null;
    if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5 || !selectCb) return;
    selectCb(pickAt(ev));
}

function onPointerMove(ev) {
    pointerEv = ev;
}

function onPointerLeave() {
    pointerEv = null;
    setHover(null, null);
}

function updateHover() {
    if (!pointerEv || pointerDown) return;
    const ev = pointerEv;
    pointerEv = null;
    setHover(pickAt(ev), ev);
}

function hexFace(k, apothem, y, w, h, mat) {
    const a = Math.PI / 6 + k * Math.PI / 3;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), mat);
    m.position.set(Math.sin(a) * apothem, y, Math.cos(a) * apothem);
    m.rotation.y = a;
    return m;
}

function buildHq() {
    const group = new THREE.Group();
    const dark = kitMaterial('metalDark');
    const steel = kitMaterial('metal');
    const gold = kitMaterial('metalRed');
    const glow = accentMat(0x0ac8b9, 1.4);
    const hex = (rt, rb, h, y, mat) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 6), mat);
        m.position.y = y;
        group.add(m);
        return m;
    };

    hex(2.1, 2.3, 0.25, 0.125, dark);
    hex(2.16, 2.16, 0.04, 0.27, gold);
    hex(1.7, 1.9, 0.22, 0.4, steel);
    const segs = [[1.05, 1.25, 1.2, 1.1], [0.85, 1.0, 1.1, 2.25], [0.66, 0.8, 0.8, 3.2]];
    segs.forEach(([rt, rb, h, y], i) => {
        hex(rt, rb, h, y, dark);
        hex(rt + 0.04, rt + 0.04, 0.06, y + h / 2, gold);
        if (i < 2) for (let k = 0; k < 6; k++) group.add(hexFace(k, (rt + rb) / 2 * Math.cos(Math.PI / 6) + 0.01, y, 0.08, h * 0.7, glow));
    });
    for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.6), steel);
        fin.position.set(Math.sin(a) * 1.35, 0.95, Math.cos(a) * 1.35);
        fin.rotation.y = a;
        group.add(fin);
        const claw = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.16), gold);
        claw.position.set(Math.sin(a) * 0.55, 3.85, Math.cos(a) * 0.55);
        claw.rotation.order = 'YXZ';
        claw.rotation.set(0.35, a, 0);
        group.add(claw);
    }

    const top = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 20), accentMat(0x0ac8b9, 1.6));
    top.position.y = 4.05;
    group.add(top);

    hqTop = top;
    hqGroup = group;
    shadowsOn(group);
    scene.add(group);
}

function pulse(group, targetScale) {
    const from = group.scale.x;
    const peak = from * 1.25;
    ease((t) => t, 160, (t) => {
        const s = from + (peak - from) * t;
        group.scale.set(s, s, s);
    }).then(() => {
        ease((t) => t, 240, (t) => {
            const s = peak + (targetScale - peak) * t;
            group.scale.set(s, s, s);
        });
    });
}

function flashEmissive(group, boost, dur) {
    const targets = [];
    group.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissive && o.material.emissiveIntensity > 0) {
            targets.push({ mat: o.material, base: o.material.emissiveIntensity });
        }
    });
    ease((t) => t, dur, (t) => {
        const k = Math.sin(t * Math.PI);
        targets.forEach((tg) => {
            tg.mat.emissiveIntensity = tg.base + tg.base * boost * k;
        });
    });
}

function applyCoreVisual(levelUp) {
    if (!hqGroup) return;
    if (hqCoreLevel >= 2 && !hqRing2) {
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.035, 8, 64), accentMat(0x0ac8b9, 1.3));
        ring2.rotation.x = Math.PI / 2;
        ring2.position.y = 2.3;
        hqGroup.add(ring2);
        hqRing2 = ring2;
    }
    if (hqCoreLevel >= 3 && !hqRing3) {
        const ring3 = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.035, 8, 64), kitMaterial('metalRed'));
        ring3.rotation.x = Math.PI / 2;
        ring3.position.y = 3.3;
        hqGroup.add(ring3);
        hqRing3 = ring3;
        if (hqTop) hqTop.scale.setScalar(1.3);
    }
    if (levelUp) {
        pulse(hqGroup, 1);
        flashEmissive(hqGroup, 1.2, 700);
    }
}

function buildSlots() {
    for (let i = 0; i < SLOT_COUNT; i++) {
        const angle = (i / SLOT_COUNT) * Math.PI * 2 + 0.3;
        const x = Math.cos(angle) * SLOT_RADIUS;
        const z = Math.sin(angle) * SLOT_RADIUS;

        const diskGeo = new THREE.RingGeometry(1.02, 1.1, 48);
        const diskMat = new THREE.MeshBasicMaterial({ color: 0xc8aa6e, transparent: true, opacity: 0.35 });
        const disk = new THREE.Mesh(diskGeo, diskMat);
        disk.rotation.x = -Math.PI / 2;
        disk.position.set(x, 0.02, z);
        scene.add(disk);

        const slot = { x, z, disk, occupied: false, buildingId: null };
        const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 2.4, 12), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.set(x, 1.2, z);
        scene.add(hit);
        hitTargets.set(hit, () => slot.buildingId || 'slot:' + i);
        slots.push(slot);
    }
}

function makeBase() {
    const base = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.15, 32), new THREE.MeshStandardMaterial({ color: 0x1c2433, roughness: 0.5, metalness: 0.7 }));
    base.add(plate);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.03, 8, 48), new THREE.MeshStandardMaterial({ color: 0xc8aa6e, roughness: 0.3, metalness: 0.9 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.075;
    base.add(rim);
    return base;
}

function accentMat(color, intensity) {
    return new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.5,
        metalness: 0.2,
        emissive: new THREE.Color(color),
        emissiveIntensity: intensity !== undefined ? intensity : 1
    });
}

function buildReacteur(group, anim) {
    addKit(group, 'machine_generatorLarge', { y: 0.15, s: 1.5 });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 10, 40), kitMaterial('metalRed'));
    torus.rotation.x = Math.PI / 2;
    torus.position.y = 1.5;
    group.add(torus);

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), accentMat(0x0ac8b9, 2.2));
    sphere.position.y = 1.5;
    group.add(sphere);

    anim.push((delta) => {
        torus.rotation.z += delta;
    });
}

function buildUsine(group) {
    addKit(group, 'hangar_largeA', { y: 0.15, s: 0.62, ry: Math.PI / 2 });
    addKit(group, 'chimney_detailed', { x: 0.95, y: 0.15, z: 0.2, s: 0.6 });
    addKit(group, 'chimney_detailed', { x: 0.95, y: 0.15, z: -0.25, s: 0.45 });
    addKit(group, 'barrels', { x: -0.95, y: 0.15, z: 0.1, s: 0.9 });
}

function buildCentreDonnees(group) {
    [-0.6, 0, 0.6].forEach((dx, i) => {
        addKit(group, 'structure_closed', { x: dx, y: 0.15, s: 0.55 });
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.34), accentMat(0xa855f7, 0.9));
        core.position.set(dx, 0.42, 0);
        group.add(core);
    });
    addKit(group, 'machine_wireless', { y: 0.7, s: 0.9, glow: 0xa855f7 });
}

function buildQuartiers(group) {
    addKit(group, 'hangar_roundB', { x: -0.35, y: 0.15, z: -0.25, s: 0.42, glow: 0xf59e0b });
    addKit(group, 'hangar_roundA', { x: 0.55, y: 0.15, z: 0.45, s: 0.32, glow: 0xf59e0b });
}

function buildCaserne(group) {
    addKit(group, 'hangar_smallA', { y: 0.15, s: 0.7, glow: 0xef4444 });
    addKit(group, 'turret_single', { y: 0.85, s: 1.1, glow: 0xef4444 });
}

function buildHangar(group, anim) {
    addKit(group, 'hangar_smallB', { y: 0.15, s: 0.7, glow: 0x22d3ee });
    const drone = new THREE.Group();
    drone.position.y = 1.55;
    group.add(drone);
    addKit(drone, 'craft_speederA', { s: 0.32, glow: 0x22d3ee });
    let t = 0;
    anim.push((delta) => {
        t += delta;
        drone.position.y = 1.55 + Math.sin(t * 1.6) * 0.08;
        drone.rotation.y += delta * 0.35;
    });
}

function buildLabo(group) {
    addKit(group, 'rock_crystalsLargeA', { y: 0.15, s: 0.85, glow: 0x22c55e });
    addKit(group, 'hangar_roundGlass', { y: 0.15, s: 0.4, remap: { dark: 'glass' } });
}

function buildAntenne(group) {
    addKit(group, 'structure_detailed', { y: 0.15, s: 0.7 });
    addKit(group, 'satelliteDish_large', { y: 0.85, s: 1.6, ry: Math.PI });
}

function buildBouclier(group, anim) {
    addKit(group, 'gate_complex', { y: 0.15, s: 1.5, glow: 0x38bdf8 });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 10, 64), accentMat(0x38bdf8, 1.3));
    torus.position.y = 0.95;
    group.add(torus);
    anim.push((delta) => {
        torus.rotation.y += delta * 0.5;
        torus.rotation.x += delta * 0.2;
    });
}

function buildTitan(group) {
    const dark = kitMaterial('metalDark');
    const steel = kitMaterial('metal');
    const gold = kitMaterial('metalRed');
    const box = (w, h, d, x, y, z, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        group.add(m);
        return m;
    };
    [-0.85, 0.85].forEach((dx) => {
        addKit(group, 'supports_high', { x: dx, y: 0.15, z: -0.45, s: 0.5 });
        addKit(group, 'supports_high', { x: dx, y: 0.65, z: -0.45, s: 0.5 });
        addKit(group, 'supports_high', { x: dx, y: 1.15, z: -0.45, s: 0.5 });
    });
    box(1.95, 0.1, 0.26, 0, 1.7, -0.45, gold);
    [-0.18, 0.18].forEach((dx) => {
        box(0.2, 0.55, 0.24, dx, 0.45, 0, dark);
        box(0.26, 0.08, 0.34, dx, 0.2, 0.03, steel);
    });
    box(0.62, 0.62, 0.4, 0, 1.0, 0, steel);
    box(0.64, 0.08, 0.42, 0, 0.82, 0, gold);
    [-0.44, 0.44].forEach((dx) => {
        box(0.24, 0.24, 0.3, dx, 1.2, 0, dark);
        box(0.14, 0.5, 0.16, dx, 0.85, 0, steel);
    });
    box(0.3, 0.26, 0.3, 0, 1.47, 0, dark);
    box(0.22, 0.05, 0.02, 0, 1.49, 0.16, accentMat(0xef4444, 1.6));
}

function removeBuilding(id) {
    const b = built.get(id);
    if (!b) return;
    scene.remove(b.group);
    b.group.traverse((o) => {
        if (o.isMesh) {
            o.geometry.dispose();
            o.material.dispose();
        }
    });
    b.slot.occupied = false;
    b.slot.buildingId = null;
    b.slot.disk.visible = true;
    built.delete(id);
}

const BUILDERS = {
    reacteur: buildReacteur,
    usine: buildUsine,
    centreDonnees: buildCentreDonnees,
    quartiers: buildQuartiers,
    caserne: buildCaserne,
    hangar: buildHangar,
    labo: buildLabo,
    antenne: buildAntenne,
    bouclier: buildBouclier,
    titan: buildTitan
};

function createBuildingGroup(id, slot) {
    const group = new THREE.Group();
    group.position.set(slot.x, 0, slot.z);
    group.lookAt(0, 0, 0);

    const base = makeBase();
    base.position.y = 0.075;
    group.add(base);

    const anim = [];
    const builder = BUILDERS[id];
    if (builder) builder(group, anim);
    shadowsOn(group);

    scene.add(group);

    return {group, animators: anim};
}

function levelRing(radius, mat) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 8, 64), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.17;
    return ring;
}

function applyBuildingLevel(entry, lvl, isLevelUp) {
    const targetScale = 1 + (lvl - 1) * 0.18;
    if (!entry.ring2 && lvl >= 2) {
        entry.ring2 = levelRing(1.05, accentMat(0x0ac8b9, 1.2));
        entry.group.add(entry.ring2);
    }
    if (!entry.ring3 && lvl >= 3) {
        entry.ring3 = levelRing(1.22, kitMaterial('metalRed'));
        entry.group.add(entry.ring3);
        entry.group.traverse((o) => {
            if (o.isMesh && o.material && o.material.emissive && o.material.emissive.getHex() !== 0x000000) {
                o.material.emissiveIntensity *= 1.35;
            }
        });
    }
    entry.level = lvl;
    if (isLevelUp) {
        pulse(entry.group, targetScale);
        flashEmissive(entry.group, 1, 500);
    } else {
        entry.group.scale.set(targetScale, targetScale, targetScale);
    }
}

function popIn(group, targetScale) {
    const target = targetScale || 1;
    group.scale.set(0.01, 0.01, 0.01);
    ease(easeOutBack, 500, (t) => {
        const s = t * target;
        group.scale.set(s, s, s);
    });
}

function animate() {
    rafId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    if (controls) controls.update();
    updateHover();
    if (selRing.visible) selRing.rotation.z += delta * 0.6;
    if (hqTop) {
        hqTop.material.emissiveIntensity = 1.15 + Math.sin(time * 1.4) * 0.45;
    }
    if (hqRing2) hqRing2.rotation.z += delta * 0.4;
    if (hqRing3) hqRing3.rotation.z -= delta * 0.4;
    built.forEach((b) => b.animators.forEach((fn) => fn(delta)));
    satellites.forEach((s) => {
        s.angle += s.speed * delta;
        s.mesh.position.set(
            Math.cos(s.angle) * s.radius,
            s.height + Math.sin(s.angle * 2) * 0.08,
            Math.sin(s.angle) * s.radius
        );
        s.mesh.rotation.y += delta;
    });

    if (composer) composer.render();
}

function mount(el) {
    if (rafId && container === el) {
        return;
    }
    container = el;
    if (!scene) buildScene();
    if (!clock) clock = new THREE.Clock();

    if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.35;
        pmrem.dispose();
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.92);
        composer.addPass(bloomPass);
        composer.addPass(new OutputPass());
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.inset = '0';
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerleave', onPointerLeave);
        container.appendChild(renderer.domElement);
    } else if (renderer.domElement.parentElement !== container) {
        container.appendChild(renderer.domElement);
    }

    if (!controls) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 6;
        controls.maxDistance = 19;
        controls.minPolarAngle = 0.15;
        controls.maxPolarAngle = Math.PI / 2.15;
        controls.enablePan = false;
        controls.target.set(0, 1, 0);
        controls.update();
    }

    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(() => {
        if (!container) return;
        const cw = container.clientWidth || 1;
        const ch = container.clientHeight || 1;
        renderer.setSize(cw, ch);
        composer.setSize(cw, ch);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    if (rafId) cancelAnimationFrame(rafId);
    animate();
}

function syncSatellites(researchBranches) {
    const branches = researchBranches || [];
    if (branches.length === satellites.length) return;

    satellites.forEach((s) => {
        scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
    });
    satellites = [];

    branches.forEach((branch, i) => {
        const color = RESEARCH_BRANCH_COLORS[branch] !== undefined ? RESEARCH_BRANCH_COLORS[branch] : 0xffffff;
        const mesh = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.14),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.3, emissive: new THREE.Color(color), emissiveIntensity: 1.1 })
        );
        scene.add(mesh);
        const s = {
            mesh,
            radius: 2.4 + (i % 3) * 0.5,
            height: 2.3 + i * 0.28,
            speed: 0.35 + (i % 4) * 0.12,
            angle: i * 2.4
        };
        satellites.push(s);
        popIn(mesh, 1);
    });
}

function sync(buildingIds, levels, coreLevel, researchBranches, cityTokens) {
    if (!scene) return;
    const ids = buildingIds || [];
    const lvls = levels || {};
    const core = coreLevel || 1;

    syncSatellites(researchBranches);

    [...built.keys()].forEach((id) => {
        if (!ids.includes(id)) removeBuilding(id);
    });
    ids.forEach((id) => {
        const lvl = lvls[id] || 1;
        if (built.has(id)) {
            const entry = built.get(id);
            if (lvl > entry.level) applyBuildingLevel(entry, lvl, true);
            return;
        }
        const slot = slots.find((s) => !s.occupied);
        if (!slot) return;
        slot.occupied = true;
        slot.buildingId = id;
        slot.disk.visible = false;

        const b = createBuildingGroup(id, slot);
        const entry = {group: b.group, animators: b.animators, slot, level: 1, ring2: null, ring3: null};
        built.set(id, entry);
        applyBuildingLevel(entry, lvl, false);
        popIn(b.group, 1 + (lvl - 1) * 0.18);
    });
    syncCityTokens(cityTokens);

    if (core > hqCoreLevel) {
        hqCoreLevel = core;
        applyCoreVisual(true);
    } else if (core < hqCoreLevel) {
        hqCoreLevel = core;
        if (hqRing2 && core < 2) {
            hqGroup.remove(hqRing2);
            hqRing2.geometry.dispose();
            hqRing2.material.dispose();
            hqRing2 = null;
        }
        if (hqRing3 && core < 3) {
            hqGroup.remove(hqRing3);
            hqRing3.geometry.dispose();
            hqRing3.material.dispose();
            hqRing3 = null;
            if (hqTop) hqTop.scale.setScalar(1);
        }
    }
}

function disposeTree(obj) {
    obj.traverse((o) => {
        if (o.isMesh) {
            o.geometry.dispose();
            o.material.dispose();
        }
    });
}

function makeBanner(token) {
    const i = Math.max(0, CITY_ORDER.indexOf(token.id));
    const a = 0.64 + [-1.2, 1.2, 2.55][i];
    const group = new THREE.Group();
    group.position.set(Math.sin(a) * 2.75, 0, Math.cos(a) * 2.75);
    group.rotation.y = 0.64;
    const gold = kitMaterial('metalRed');
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.9, 8), gold);
    pole.position.y = 1.45;
    group.add(pole);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.05), gold);
    bar.position.set(0, 2.62, 0.06);
    group.add(bar);
    const c = KIND_COLOR[token.kind];
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.15), new THREE.MeshStandardMaterial({ color: 0x0a121c, roughness: 0.75, emissive: new THREE.Color(c), emissiveIntensity: 0.55, side: THREE.DoubleSide }));
    cloth.position.set(0, 2.02, 0.07);
    group.add(cloth);
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.06), gold);
    trim.position.set(0, 1.46, 0.075);
    group.add(trim);
    const emblem = buildEmblem(token.emblem, accentMat(0xc8aa6e, 1.3));
    emblem.scale.setScalar(0.34);
    emblem.position.set(0, 1.86, 0.1);
    group.add(emblem);
    shadowsOn(group);
    scene.add(group);
    popIn(group, 1);
    return group;
}

function buildCrane(group, anim) {
    const dark = kitMaterial('metalDark');
    const gold = kitMaterial('metalRed');
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.08), dark);
    mast.position.set(1.15, 1.1, -0.45);
    group.add(mast);
    const pivot = new THREE.Group();
    pivot.position.set(1.15, 2.05, -0.45);
    group.add(pivot);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.07), gold);
    jib.position.x = -0.45;
    pivot.add(jib);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.16), dark);
    counter.position.x = 0.28;
    pivot.add(counter);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4), dark);
    cable.position.set(-1.05, -0.3, 0);
    pivot.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), gold);
    hook.position.set(-1.05, -0.62, 0);
    pivot.add(hook);
    let t = 0;
    anim.push((delta) => {
        t += delta;
        pivot.rotation.y = Math.sin(t * 0.35) * 0.9;
    });
}

function buildForge(group, anim) {
    const fire = accentMat(0xff7a2a, 1.6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.04, 8, 48), fire);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    group.add(ring);
    const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.26, 10), kitMaterial('metalDark'));
    brazier.position.set(0.95, 0.28, 0.45);
    group.add(brazier);
    const embers = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), fire);
    embers.position.set(0.95, 0.41, 0.45);
    group.add(embers);
    const light = new THREE.PointLight(0xff7a2a, 2.5, 3.5);
    light.position.set(0.95, 0.8, 0.45);
    group.add(light);
    let t = 0;
    anim.push((delta) => {
        t += delta;
        fire.emissiveIntensity = 1.4 + Math.sin(t * 3.1) * 0.35 + Math.sin(t * 7.3) * 0.15;
        light.intensity = 2.2 + Math.sin(t * 3.1) * 0.6;
    });
}

function buildListening(group, anim) {
    addKit(group, 'satelliteDish_large', { x: -1.0, y: 0.15, z: 0.35, s: 0.75, ry: Math.PI / 2 });
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), accentMat(0x0ac8b9, 2));
    blink.position.set(-1.0, 1.25, 0.35);
    group.add(blink);
    let t = 0;
    anim.push((delta) => {
        t += delta;
        blink.material.emissiveIntensity = (t % 1.6) < 0.25 ? 3 : 0.4;
    });
}

const ACCESSORIES = {
    lyon: { building: 'antenne', build: buildListening },
    marseille: { building: 'usine', build: buildCrane },
    turin: { building: 'caserne', build: buildForge }
};

function syncCityTokens(tokens) {
    const list = tokens || [];
    const want = new Map(list.map((t) => [t.id, t]));
    banners.forEach((b, id) => {
        const t = want.get(id);
        if (t && t.kind === b.kind) return;
        scene.remove(b.group);
        disposeTree(b.group);
        banners.delete(id);
    });
    list.forEach((t) => {
        if (!banners.has(t.id)) banners.set(t.id, { kind: t.kind, group: makeBanner(t) });
    });
    Object.entries(ACCESSORIES).forEach(([cityId, acc]) => {
        const entry = built.get(acc.building);
        if (!entry) return;
        const t = want.get(cityId);
        const on = !!t && t.kind === 'take';
        if (on && !entry.accessory) {
            const g = new THREE.Group();
            const anim = [];
            acc.build(g, anim);
            shadowsOn(g);
            entry.group.add(g);
            entry.accessory = { group: g, anim };
            entry.animators.push(...anim);
            popIn(g, 1);
        } else if (!on && entry.accessory) {
            entry.group.remove(entry.accessory.group);
            disposeTree(entry.accessory.group);
            entry.animators = entry.animators.filter((fn) => !entry.accessory.anim.includes(fn));
            entry.accessory = null;
        }
    });
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

function onSelect(cb) {
    selectCb = cb;
}

function onHover(cb) {
    hoverCb = cb;
}

function setSelected(id) {
    selectedId = id;
    if (!scene) return;
    placeRing(selRing, id, 0.18);
    if (hoverId === id) placeRing(hoverRing, null, 0);
}

window.Base3D = { mount, sync, stop, onSelect, onHover, setSelected };
