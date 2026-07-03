import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const STATUS_COLOR = { player: 0x38bdf8, allied: 0x22c55e, neutral: 0xf59e0b, hostile: 0xef4444 };

let renderer = null;
let labelRenderer = null;
let scene = null;
let camera = null;
let controls = null;
let container = null;
let resizeObserver = null;
let rafId = null;
let clock = null;

let nodesById = new Map();
let meshToNodeId = new Map();
let linksBuilt = false;
let linkLines = [];
let armyMesh = null;
let pendingSnapshot = null;
let currentSnapshot = null;
let selectCb = null;

let pointerDownX = 0;
let pointerDownY = 0;
let pointerDown = false;

function worldX(x) {
    return (x / 100 - 0.5) * 22;
}

function worldZ(y) {
    return (y / 100 - 0.5) * 16;
}

function seededRand(seed) {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}

function buildScene() {
    scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.015);

    const hemi = new THREE.HemisphereLight(0x8fb8ff, 0x0a0e1a, 0.85);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(5, 14, 4);
    scene.add(dir);

    const groundGeo = new THREE.PlaneGeometry(30, 22);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0d1322, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const grid = new THREE.GridHelper(30, 30, 0x16233d, 0x101a2e);
    grid.position.y = 0.01;
    scene.add(grid);

    buildRuinsDecor();

    camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
    camera.position.set(0, 15, 11);
    camera.lookAt(0, 0, 0);
}

function buildRuinsDecor() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 1 });
    let seed = 1;
    for (let i = 0; i < 12; i++) {
        const rx = seededRand(seed++) * 26 - 13;
        const rz = seededRand(seed++) * 20 - 10;
        const w = 0.4 + seededRand(seed++) * 1.1;
        const h = 0.3 + seededRand(seed++) * 0.9;
        const d = 0.4 + seededRand(seed++) * 1.1;
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        box.position.set(rx, h / 2, rz);
        box.rotation.y = seededRand(seed++) * Math.PI;
        scene.add(box);
    }
}

function domeMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.6,
        metalness: 0.25,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.5
    });
}

function buildHome(group, mat) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.position.y = 0.18;
    group.add(dome);

    const towerMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.5,
        metalness: 0.3,
        emissive: new THREE.Color(0x00d4ff),
        emissiveIntensity: 0.9
    });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 10), towerMat);
    tower.position.y = 0.7;
    group.add(tower);

    return dome;
}

function buildCity(group, mat) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.position.y = 0.18;
    group.add(dome);

    [-0.5, 0.5].forEach((dx) => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.28), mat);
        box.position.set(dx, 0.38, 0.1);
        group.add(box);
    });

    return dome;
}

function buildRuin(group, mat) {
    const positions = [
        { x: -0.3, z: 0.1, w: 0.4, h: 0.25, d: 0.35 },
        { x: 0.25, z: -0.2, w: 0.3, h: 0.35, d: 0.3 },
        { x: 0.1, z: 0.3, w: 0.35, h: 0.18, d: 0.3 }
    ];
    let last = null;
    positions.forEach((p) => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
        box.position.set(p.x, 0.18 + p.h / 2, p.z);
        box.rotation.z = 0.15;
        group.add(box);
        last = box;
    });
    return last;
}

function buildOutpost(group, mat) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.7), mat);
    box.position.y = 0.18 + 0.25;
    group.add(box);

    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 10), mat);
    turret.position.y = 0.18 + 0.5 + 0.17;
    group.add(turret);

    return box;
}

function buildCapital(group, mat) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.position.y = 0.18;
    group.add(dome);

    const pylonMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.5,
        metalness: 0.3,
        emissive: new THREE.Color(0x00d4ff),
        emissiveIntensity: 0.7
    });
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const px = Math.cos(angle) * 0.95;
        const pz = Math.sin(angle) * 0.95;
        const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), pylonMat);
        pylon.position.set(px, 0.18 + 0.45, pz);
        group.add(pylon);
    }

    return dome;
}

const DOME_BUILDERS = {
    home: buildHome,
    city: buildCity,
    ruin: buildRuin,
    outpost: buildOutpost,
    capital: buildCapital
};

function createLabelEl(node) {
    const div = document.createElement('div');
    div.className = 'm3d-label';
    let html = `<div class="m3d-name">${node.icon || ''} ${node.name || ''}</div>`;
    if (node.threat != null) {
        html += `<div class="m3d-threat">⚠️ ${node.threat} tour(s)</div>`;
    }
    div.innerHTML = html;
    return div;
}

const nodeBaseGeo = new THREE.CylinderGeometry(0.85, 1, 0.18, 24);
const nodeBaseMat = new THREE.MeshStandardMaterial({ color: 0x16233d, roughness: 0.6, metalness: 0.25 });
const selRingGeo = new THREE.TorusGeometry(1.15, 0.04, 8, 32);
const selRingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1 });
const threatRingGeo = new THREE.TorusGeometry(1.3, 0.05, 8, 32);
const threatRingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(0xef4444), emissiveIntensity: 0.5 });

function createNodeEntry(node) {
    const group = new THREE.Group();
    group.position.set(worldX(node.x), 0, worldZ(node.y));
    scene.add(group);

    const base = new THREE.Mesh(nodeBaseGeo, nodeBaseMat);
    base.position.y = 0.09;
    group.add(base);

    const mat = domeMaterial();
    const builder = DOME_BUILDERS[node.type] || buildCity;
    const domeMesh = builder(group, mat);

    const selRing = new THREE.Mesh(selRingGeo, selRingMat);
    selRing.rotation.x = Math.PI / 2;
    selRing.position.y = 0.05;
    selRing.visible = false;
    group.add(selRing);

    const threatRing = new THREE.Mesh(threatRingGeo, threatRingMat);
    threatRing.rotation.x = Math.PI / 2;
    threatRing.position.y = 0.06;
    threatRing.visible = false;
    group.add(threatRing);

    const labelEl = createLabelEl(node);
    const labelObj = new CSS2DObject(labelEl);
    labelObj.position.set(0, 1.6, 0);
    group.add(labelObj);

    meshToNodeId.set(base, node.id);
    meshToNodeId.set(domeMesh, node.id);

    const entry = {
        group,
        base,
        domeMesh,
        mat,
        selRing,
        threatRing,
        labelEl,
        labelObj,
        status: null,
        selected: false,
        threat: null
    };
    nodesById.set(node.id, entry);
    return entry;
}

function updateNodeEntry(entry, node) {
    entry.group.position.set(worldX(node.x), 0, worldZ(node.y));

    const color = STATUS_COLOR[node.status] !== undefined ? STATUS_COLOR[node.status] : 0x38bdf8;
    if (entry.status !== node.status) {
        entry.mat.emissive.set(color);
        entry.mat.emissiveIntensity = 0.5;
        entry.status = node.status;
    }

    entry.selRing.visible = !!node.selected;
    entry.selected = !!node.selected;

    entry.threatRing.visible = node.threat != null;
    entry.threat = node.threat;

    entry.labelEl.innerHTML = `<div class="m3d-name">${node.icon || ''} ${node.name || ''}</div>` +
        (node.threat != null ? `<div class="m3d-threat">⚠️ ${node.threat} tour(s)</div>` : '');
}

function buildLinks(links) {
    linkLines.forEach((l) => {
        scene.remove(l);
        l.geometry.dispose();
        l.material.dispose();
    });
    linkLines = [];
    (links || []).forEach((link) => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(worldX(link.ax), 0.06, worldZ(link.ay)),
            new THREE.Vector3(worldX(link.bx), 0.06, worldZ(link.by))
        ]);
        const mat = new THREE.LineBasicMaterial({ color: 0x27405f, transparent: true, opacity: 0.7 });
        const line = new THREE.Line(geo, mat);
        scene.add(line);
        linkLines.push(line);
    });
    linksBuilt = true;
}

function ensureArmyMesh() {
    if (armyMesh) return armyMesh;
    const mat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.4,
        metalness: 0.3,
        emissive: new THREE.Color(0x00d4ff),
        emissiveIntensity: 1.2
    });
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 8), mat);
    mesh.visible = false;
    scene.add(mesh);
    armyMesh = mesh;
    return mesh;
}

function updateArmy(army) {
    const mesh = ensureArmyMesh();
    if (!army) {
        mesh.visible = false;
        return;
    }
    mesh.visible = true;
    if (army.progress != null) {
        const fromX = worldX(army.fromX);
        const fromZ = worldZ(army.fromY);
        const toX = worldX(army.toX);
        const toZ = worldZ(army.toY);
        const t = Math.max(0, Math.min(1, army.progress));
        mesh.position.x = fromX + (toX - fromX) * t;
        mesh.position.z = fromZ + (toZ - fromZ) * t;
    } else {
        mesh.position.x = worldX(army.x) + 0.9;
        mesh.position.z = worldZ(army.y);
    }
    mesh.userData.baseY = 0.55;
}

function applySnapshot(snapshot) {
    if (!scene) return;
    currentSnapshot = snapshot;
    const nodes = snapshot.nodes || [];
    nodes.forEach((node) => {
        let entry = nodesById.get(node.id);
        if (!entry) entry = createNodeEntry(node);
        updateNodeEntry(entry, node);
    });
    if (!linksBuilt) buildLinks(snapshot.links);
    updateArmy(snapshot.army);
}

function onPointerDown(ev) {
    pointerDown = true;
    pointerDownX = ev.clientX;
    pointerDownY = ev.clientY;
}

function onPointerUp(ev) {
    if (!pointerDown) return;
    pointerDown = false;
    const dx = ev.clientX - pointerDownX;
    const dy = ev.clientY - pointerDownY;
    if (Math.hypot(dx, dy) > 5) return;
    if (!selectCb) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const meshes = [...meshToNodeId.keys()];
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
        const nodeId = meshToNodeId.get(hits[0].object);
        if (nodeId) selectCb(nodeId);
    }
}

function animate() {
    rafId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    if (controls) {
        controls.target.x = Math.max(-8, Math.min(8, controls.target.x));
        controls.target.z = Math.max(-6, Math.min(6, controls.target.z));
        controls.update();
    }

    nodesById.forEach((entry) => {
        if (entry.selRing.visible) entry.selRing.rotation.z += delta * 0.6;
        if (entry.threatRing.visible) {
            entry.threatRing.rotation.z -= delta * 0.4;
            entry.threatRing.material.emissiveIntensity = 1 + Math.sin(time * 4) * 0.5;
        }
    });

    if (armyMesh && armyMesh.visible) {
        const baseY = armyMesh.userData.baseY || 0.55;
        armyMesh.position.y = baseY + Math.sin(time * 2) * 0.06;
        armyMesh.rotation.y += delta * 0.8;
    }

    if (renderer && scene && camera) renderer.render(scene, camera);
    if (labelRenderer && scene && camera) labelRenderer.render(scene, camera);
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
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
    } else if (renderer.domElement.parentElement !== container) {
        container.appendChild(renderer.domElement);
    }

    if (!labelRenderer) {
        labelRenderer = new CSS2DRenderer();
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.inset = '0';
        labelRenderer.domElement.style.pointerEvents = 'none';
        container.appendChild(labelRenderer.domElement);
    } else if (labelRenderer.domElement.parentElement !== container) {
        container.appendChild(labelRenderer.domElement);
    }

    if (!controls) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = true;
        controls.minDistance = 8;
        controls.maxDistance = 24;
        controls.maxPolarAngle = Math.PI / 2.3;
        controls.minPolarAngle = 0.2;
        controls.target.set(0, 0, 0);
        controls.update();
    }

    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(() => {
        if (!container) return;
        const cw = container.clientWidth || 1;
        const ch = container.clientHeight || 1;
        renderer.setSize(cw, ch);
        labelRenderer.setSize(cw, ch);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
    });
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

window.Map3D = { mount, sync, onSelect, stop };
