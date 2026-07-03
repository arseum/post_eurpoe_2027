import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SLOT_COUNT = 10;
const SLOT_RADIUS = 6.8;

let renderer = null;
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
    scene.background = null;
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.02);

    const hemi = new THREE.HemisphereLight(0x8fb8ff, 0x0a0e1a, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.3);
    dir.position.set(6, 12, 5);
    scene.add(dir);

    const groundGeo = new THREE.CircleGeometry(14, 56);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x101728, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const grid = new THREE.GridHelper(26, 26, 0x1e3a5f, 0x16233d);
    grid.position.y = 0.01;
    scene.add(grid);

    const domeGeo = new THREE.SphereGeometry(13.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.05,
        side: THREE.BackSide,
        depthWrite: false
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    scene.add(dome);

    const domeWireMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.06,
        wireframe: true,
        depthWrite: false
    });
    const domeWire = new THREE.Mesh(domeGeo, domeWireMat);
    scene.add(domeWire);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(9, 8, 12);

    buildHq();
    buildSlots();
}

function buildHq() {
    const group = new THREE.Group();

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x16233d, roughness: 0.6, metalness: 0.25 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 0.3, 6), baseMat);
    base.position.y = 0.15;
    group.add(base);

    const towerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.3 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 3, 6), towerMat);
    tower.position.y = 1.8;
    group.add(tower);

    const topMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.5,
        metalness: 0.3,
        emissive: new THREE.Color(0x00d4ff),
        emissiveIntensity: 1.2
    });
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.35), topMat);
    top.position.y = 3.6;
    group.add(top);

    hqTop = top;
    hqGroup = group;
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
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05), accentMat(0x00d4ff, 1.2));
        ring2.rotation.x = Math.PI / 2;
        ring2.position.y = 2.0;
        hqGroup.add(ring2);
        hqRing2 = ring2;
    }
    if (hqCoreLevel >= 3 && !hqRing3) {
        const ring3 = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.05), accentMat(0x00d4ff, 1.2));
        ring3.rotation.x = Math.PI / 2;
        ring3.position.y = 2.7;
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

        const diskGeo = new THREE.CircleGeometry(1.1, 24);
        const diskMat = new THREE.MeshBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.18 });
        const disk = new THREE.Mesh(diskGeo, diskMat);
        disk.rotation.x = -Math.PI / 2;
        disk.position.set(x, 0.02, z);
        scene.add(disk);

        slots.push({ x, z, disk, occupied: false });
    }
}

function makeBase() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x16233d, roughness: 0.6, metalness: 0.25 });
    return new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.15, 24), mat);
}

function bodyMat(color, roughness, metalness) {
    return new THREE.MeshStandardMaterial({
        color: color !== undefined ? color : 0x1e293b,
        roughness: roughness !== undefined ? roughness : 0.6,
        metalness: metalness !== undefined ? metalness : 0.25
    });
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
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.16), bodyMat(0x334155));
    torus.rotation.x = Math.PI / 2;
    torus.position.y = 1;
    group.add(torus);

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.42), accentMat(0x00d4ff, 1.3));
    sphere.position.y = 1;
    group.add(sphere);

    anim.push((delta) => {
        torus.rotation.z += delta;
    });
}

function buildUsine(group) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.1), bodyMat(0x1e293b));
    box.position.y = 0.6;
    group.add(box);

    const chimMat = bodyMat(0x334155);
    [-0.4, 0.4].forEach((dx) => {
        const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 12), chimMat);
        chim.position.set(dx, 1.5, 0);
        group.add(chim);
    });

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 0.05), accentMat(0xff6b35, 0.9));
    stripe.position.set(0, 0.6, 0.58);
    group.add(stripe);
}

function buildCentreDonnees(group) {
    [-0.5, 0, 0.5].forEach((dx) => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.5, 0.42), bodyMat(0x1e293b));
        box.position.set(dx, 0.75, 0);
        group.add(box);

        const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.04), accentMat(0xa855f7, 0.8));
        face.position.set(dx, 0.75, 0.23);
        group.add(face);
    });
}

function buildQuartiers(group) {
    const heights = [0.7, 1.1, 0.9];
    const offsets = [-0.5, 0, 0.5];
    heights.forEach((h, i) => {
        const dx = offsets[i];
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, h, 0.55), bodyMat(0x334155));
        box.position.set(dx, h / 2, 0);
        group.add(box);

        const win = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.04), accentMat(0xf59e0b, 0.9));
        win.position.set(dx, h * 0.6, 0.29);
        group.add(win);
    });
}

function buildCaserne(group) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1), bodyMat(0x1e293b));
    box.position.y = 0.35;
    group.add(box);

    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.75, 0.55, 4), bodyMat(0x334155));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 0.98;
    group.add(roof);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.04), accentMat(0xef4444, 0.9));
    stripe.position.set(0, 0.35, 0.52);
    group.add(stripe);
}

function buildHangar(group) {
    const geo = new THREE.CylinderGeometry(0.7, 0.7, 1.5, 16, 1, false, 0, Math.PI);
    const tube = new THREE.Mesh(geo, bodyMat(0x1e293b));
    tube.rotation.z = Math.PI / 2;
    tube.rotation.y = Math.PI / 2;
    tube.position.y = 0.7;
    group.add(tube);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 24, Math.PI), accentMat(0x22d3ee, 0.9));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0.76, 0.7, 0);
    group.add(ring);
}

function buildLabo(group) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.35, 24), bodyMat(0x1e293b));
    base.position.y = 0.175;
    group.add(base);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat(0x334155));
    dome.position.y = 0.35;
    group.add(dome);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.05, 8, 24), accentMat(0x22c55e, 0.9));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.35;
    group.add(ring);
}

function buildAntenne(group) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 2.2, 12), bodyMat(0x334155));
    mast.position.y = 1.1;
    group.add(mast);

    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.1, 0.18, 20), bodyMat(0x1e293b));
    dish.rotation.z = Math.PI / 4;
    dish.position.set(0.3, 2, 0);
    group.add(dish);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09), accentMat(0xa855f7, 1.2));
    tip.position.y = 2.2;
    group.add(tip);
}

function buildBouclier(group, anim) {
    const torus = new THREE.Mesh(
        new THREE.TorusGeometry(0.85, 0.09),
        accentMat(0x38bdf8, 1.1)
    );
    torus.position.y = 0.95;
    group.add(torus);

    anim.push((delta) => {
        torus.rotation.y += delta * 0.5;
    });
}

function buildTitan(group) {
    const bodyM = bodyMat(0x334155);

    [-0.2, 0.2].forEach((dx) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), bodyM);
        leg.position.set(dx, 0.3, 0);
        group.add(leg);
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.45), bodyM);
    torso.position.y = 1.15;
    group.add(torso);

    [-0.55, 0.55].forEach((dx) => {
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), bodyM);
        shoulder.position.set(dx, 1.4, 0);
        group.add(shoulder);
    });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.4), bodyM);
    head.position.y = 1.75;
    group.add(head);

    [-0.1, 0.1].forEach((dx) => {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), accentMat(0xef4444, 1.2));
        eye.position.set(dx, 1.78, 0.21);
        group.add(eye);
    });
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

    scene.add(group);

    return {group, animators: anim};
}

function levelRing(radius) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035), accentMat(0x00d4ff, 1));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    return ring;
}

function applyBuildingLevel(entry, lvl, isLevelUp) {
    const targetScale = 1 + (lvl - 1) * 0.18;
    if (!entry.ring2 && lvl >= 2) {
        entry.ring2 = levelRing(1.05);
        entry.group.add(entry.ring2);
    }
    if (!entry.ring3 && lvl >= 3) {
        entry.ring3 = levelRing(1.25);
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

    if (renderer && scene && camera) renderer.render(scene, camera);
}

function mount(el) {
    container = el;
    if (!scene) buildScene();
    if (!clock) clock = new THREE.Clock();

    if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.inset = '0';
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
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(() => {
        if (!container) return;
        const cw = container.clientWidth || 1;
        const ch = container.clientHeight || 1;
        renderer.setSize(cw, ch);
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

function sync(buildingIds, levels, coreLevel, researchBranches) {
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
        slot.disk.visible = false;

        const b = createBuildingGroup(id, slot);
        const entry = {group: b.group, animators: b.animators, slot, level: 1, ring2: null, ring3: null};
        built.set(id, entry);
        applyBuildingLevel(entry, lvl, false);
        popIn(b.group, 1 + (lvl - 1) * 0.18);
    });

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

window.Base3D = { mount, sync, stop };
