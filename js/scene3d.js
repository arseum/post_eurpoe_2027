import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const UNIT3D = {
    sentinelle: { tint: 0x38bdf8, scale: 0.6 },
    mech: { tint: 0x0ea5e9, scale: 0.8 },
    drone: { tint: 0x22d3ee, scale: 0.45 },
    biosoldat: { tint: 0x22c55e, scale: 0.62 },
    agent: { tint: 0xa855f7, scale: 0.55 },
    titanUnit: { tint: 0xe2e8f0, scale: 1.0 },
    pillard: { tint: 0xef4444, scale: 0.55 },
    eclaireur: { tint: 0xf97316, scale: 0.5 },
    blinde: { tint: 0x991b1b, scale: 0.78 },
    commandant: { tint: 0xf59e0b, scale: 0.7 },
    destroyer: { tint: 0x7f1d1d, scale: 0.95 },
    valkyrie: { tint: 0xfacc15, scale: 0.85 },
    oracle: { tint: 0x34d399, scale: 0.72 },
    avatar: { tint: 0xc084fc, scale: 0.8 }
};

let modelGltf = null;
let modelPromise = null;

function loadModel() {
    if (!modelPromise) {
        modelPromise = new GLTFLoader().loadAsync('assets/models/RobotExpressive.glb')
            .then((g) => { modelGltf = g; })
            .catch(() => { modelGltf = null; });
    }
    return modelPromise;
}

let supported = false;
try {
    const c = document.createElement('canvas');
    supported = !!(c.getContext('webgl2') || c.getContext('webgl'));
} catch (e) {
    supported = false;
}

let renderer = null;
let labelRenderer = null;
let scene = null;
let camera = null;
let container = null;
let resizeObserver = null;
let rafId = null;
let clock = null;
let units = new Map();
const camBase = new THREE.Vector3(0, 7.5, 11.5);
let shakeAmt = 0;

function shake(i) {
    shakeAmt = Math.min(0.5, shakeAmt + i);
}

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

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t) {
    return t * t * t;
}

function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
}

function buildScene() {
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.028);

    const hemi = new THREE.HemisphereLight(0x8fb8ff, 0x0a0e1a, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(5, 10, 4);
    scene.add(dir);

    const groundGeo = new THREE.CircleGeometry(11, 48);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x101728, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const grid = new THREE.GridHelper(22, 22, 0x1e3a5f, 0x16233d);
    grid.position.y = 0.01;
    scene.add(grid);

    const ringPlayerGeo = new THREE.RingGeometry(1.4, 1.9, 32);
    const ringPlayerMat = new THREE.MeshBasicMaterial({ color: 0x0e7490, transparent: true, opacity: 0.35 });
    const ringPlayer = new THREE.Mesh(ringPlayerGeo, ringPlayerMat);
    ringPlayer.rotation.x = -Math.PI / 2;
    ringPlayer.position.set(-3, 0.015, 0);
    scene.add(ringPlayer);

    const ringEnemyGeo = new THREE.RingGeometry(1.4, 1.9, 32);
    const ringEnemyMat = new THREE.MeshBasicMaterial({ color: 0x7f1d1d, transparent: true, opacity: 0.35 });
    const ringEnemy = new THREE.Mesh(ringEnemyGeo, ringEnemyMat);
    ringEnemy.rotation.x = -Math.PI / 2;
    ringEnemy.position.set(3, 0.015, 0);
    scene.add(ringEnemy);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.copy(camBase);
    camera.lookAt(0, 0.8, 0);
    if (window.FX3D) FX3D.attach(scene);
}

function animate() {
    rafId = requestAnimationFrame(animate);
    const time = performance.now();
    const delta = clock ? clock.getDelta() : 0;
    units.forEach((u) => {
        if (u.mixer) {
            u.mixer.update(delta);
        } else if (u.alive) {
            u.group.position.y = Math.sin(time * 0.002 + u.phase) * 0.05;
        }
    });
    if (window.FX3D) FX3D.update(delta);
    if (camera) {
        camera.position.copy(camBase);
        if (shakeAmt > 0.001) {
            camera.position.x += (Math.random() - 0.5) * shakeAmt;
            camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.7;
            shakeAmt = Math.max(0, shakeAmt - delta * 1.6);
        }
        camera.lookAt(0, 0.8, 0);
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
    if (labelRenderer && scene && camera) labelRenderer.render(scene, camera);
}

function mount(el) {
    container = el;
    loadModel();
    if (!scene) buildScene();

    if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.inset = '0';
        container.appendChild(renderer.domElement);
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

    if (rafId) cancelAnimationFrame(rafId);
    animate();
}

function disposeUnits() {
    units.forEach((u) => {
        if (u.labelObj) u.group.remove(u.labelObj);
        if (u.mixer) {
            u.mixer.stopAllAction();
            u.group.traverse((o) => {
                if (o.isMesh && o.material) o.material.dispose();
            });
        } else {
            u.mesh.geometry.dispose();
            u.mesh.material.dispose();
            u.headMesh.geometry.dispose();
            u.headMesh.material.dispose();
        }
        scene.remove(u.group);
    });
    units.clear();
}

function colorFor(side, frontline) {
    if (side === 'player') return frontline ? 0x38bdf8 : 0x22d3ee;
    return frontline ? 0xef4444 : 0xf97316;
}

function makeLabelEl(u) {
    const div = document.createElement('div');
    div.className = 'b3d-label';
    div.innerHTML = `<div class="b3d-name">${u.icon || ''} ${u.name || ''}</div><div class="hp-bar"><div class="hp-fill"></div></div><div class="b3d-hp-text">${u.hp}/${u.maxHp}</div>`;
    return div;
}

function placeUnits(list, side) {
    const front = list.filter((u) => u.frontline);
    const back = list.filter((u) => !u.frontline);
    const layout = (arr, x) => {
        const n = arr.length;
        const spacing = 1.7;
        const startZ = -((n - 1) * spacing) / 2;
        arr.forEach((u, i) => {
            const z = startZ + i * spacing;
            createUnit(u, side, x, z);
        });
    };
    const xFront = side === 'player' ? -2.2 : 2.2;
    const xBack = side === 'player' ? -4.4 : 4.4;
    layout(front, xFront);
    layout(back, xBack);
}

function createModelUnit(u, side, x, z) {
    const cfg = UNIT3D[u.id] || { tint: side === 'player' ? 0x38bdf8 : 0xef4444, scale: 0.6 };
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = side === 'player' ? Math.PI / 2 : -Math.PI / 2;

    const inst = SkeletonUtils.clone(modelGltf.scene);
    inst.scale.setScalar(cfg.scale);
    const mats = [];
    inst.traverse((o) => {
        if (o.isMesh) {
            o.material = o.material.clone();
            if (o.material.name === 'Main') o.material.color.set(cfg.tint);
            mats.push(o.material);
        }
    });
    group.add(inst);

    if (u.hero) {
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.62, 0.035, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.3, emissive: new THREE.Color(0xfacc15), emissiveIntensity: 1.2 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.05;
        group.add(ring);
    }

    const mixer = new THREE.AnimationMixer(inst);
    const actions = {};
    for (const clip of modelGltf.animations) {
        if (['Idle', 'Punch', 'Death', 'Walking', 'Jump'].includes(clip.name)) {
            actions[clip.name] = mixer.clipAction(clip);
        }
    }
    if (actions.Idle) {
        actions.Idle.play();
        actions.Idle.time = Math.random() * actions.Idle.getClip().duration;
    }
    mixer.addEventListener('finished', (e) => {
        if (e.action === actions.Punch && actions.Idle) {
            actions.Punch.fadeOut(0.15);
            actions.Idle.reset().fadeIn(0.15).play();
        }
    });

    const box = new THREE.Box3().setFromObject(inst);
    const h = Math.max(1.2, box.max.y);

    const labelEl = makeLabelEl(u);
    const labelObj = new CSS2DObject(labelEl);
    labelObj.position.set(0, h + 0.5, 0);
    group.add(labelObj);

    scene.add(group);

    units.set(u.uid, {
        group,
        mixer,
        actions,
        mats,
        labelEl,
        hpFillEl: labelEl.querySelector('.hp-fill'),
        hpTextEl: labelEl.querySelector('.b3d-hp-text'),
        labelObj,
        alive: true,
        side,
        maxHp: u.maxHp,
        baseX: x,
        baseZ: z,
        floatY: h + 0.9,
        phase: Math.random() * Math.PI * 2
    });
}

function createUnit(u, side, x, z) {
    if (modelGltf) {
        createModelUnit(u, side, x, z);
        return;
    }
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    if (side === 'enemy') group.rotation.y = Math.PI;

    const color = colorFor(side, u.frontline);
    const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.2,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.15
    });

    const capGeo = new THREE.CapsuleGeometry(0.42, 0.85, 6, 14);
    const mesh = new THREE.Mesh(capGeo, mat);
    mesh.position.y = 0.85;
    group.add(mesh);

    const headGeo = new THREE.SphereGeometry(0.22);
    const headMesh = new THREE.Mesh(headGeo, mat);
    headMesh.position.y = 1.65;
    group.add(headMesh);

    const labelEl = makeLabelEl(u);
    const labelObj = new CSS2DObject(labelEl);
    labelObj.position.set(0, 2.15, 0);
    group.add(labelObj);

    scene.add(group);

    units.set(u.uid, {
        group,
        mesh,
        headMesh,
        labelEl,
        hpFillEl: labelEl.querySelector('.hp-fill'),
        hpTextEl: labelEl.querySelector('.b3d-hp-text'),
        labelObj,
        alive: true,
        side,
        maxHp: u.maxHp,
        baseX: x,
        baseZ: z,
        phase: Math.random() * Math.PI * 2
    });
}

function setup(playerUnits, enemyUnits) {
    if (!scene) buildScene();
    disposeUnits();
    placeUnits(playerUnits || [], 'player');
    placeUnits(enemyUnits || [], 'enemy');
    const from = new THREE.Vector3(0, 10.5, 15.5);
    const to = new THREE.Vector3(0, 7.5, 11.5);
    camBase.copy(from);
    ease(easeOutCubic, 900, (t) => {
        camBase.lerpVectors(from, to, t);
    });
}

function updateHp(u, hp, maxHp) {
    const mh = maxHp || u.maxHp;
    const pct = Math.max(0, Math.min(100, (hp / mh) * 100));
    if (u.hpFillEl) {
        u.hpFillEl.style.width = pct + '%';
        u.hpFillEl.classList.remove('mid', 'low');
        if (pct <= 25) u.hpFillEl.classList.add('low');
        else if (pct <= 50) u.hpFillEl.classList.add('mid');
    }
    if (u.hpTextEl) u.hpTextEl.textContent = Math.max(0, Math.round(hp)) + '/' + mh;
}

function spawnFloat(u, cls, text) {
    const wrap = document.createElement('div');
    const div = document.createElement('div');
    div.className = 'b3d-float ' + cls;
    div.textContent = text;
    wrap.appendChild(div);
    const obj = new CSS2DObject(wrap);
    obj.position.set(0, u.floatY || 2.6, 0);
    u.group.add(obj);
    setTimeout(() => {
        u.group.remove(obj);
    }, 800);
}

function flashMaterial(u) {
    const mats = u.mats || [u.mesh.material];
    const originals = mats.map((m) => ({ m, e: m.emissive.clone(), i: m.emissiveIntensity }));
    mats.forEach((m) => {
        m.emissive.set(0xffffff);
        m.emissiveIntensity = 1;
    });
    ease(easeOutCubic, 150, (t) => {
        originals.forEach((o) => {
            o.m.emissive.copy(o.e).lerp(new THREE.Color(0xffffff), 1 - t);
            o.m.emissiveIntensity = o.i + (1 - o.i) * (1 - t);
        });
    }).then(() => {
        originals.forEach((o) => {
            o.m.emissive.copy(o.e);
            o.m.emissiveIntensity = o.i;
        });
    });
}

async function killUnit(u, side, dur) {
    u.alive = false;
    u.labelEl.style.opacity = '0.25';
    if (u.mixer && u.actions.Death) {
        const death = u.actions.Death;
        death.reset();
        death.setLoop(THREE.LoopOnce);
        death.clampWhenFinished = true;
        Object.values(u.actions).forEach((a) => {
            if (a !== death) a.fadeOut(0.12);
        });
        death.fadeIn(0.12).play();
        u.mats.forEach((m) => { m.transparent = true; });
        await ease(easeOutCubic, Math.max(dur, 600), (t) => {
            u.mats.forEach((m) => { m.opacity = 1 - 0.6 * t; });
        });
        return;
    }
    u.group.position.y = 0;
    const mat = u.mesh.material;
    mat.transparent = true;
    const headMat = u.headMesh.material;
    headMat.transparent = true;
    const startRotZ = u.group.rotation.z;
    const targetZ = side === 'enemy' ? -Math.PI / 2 : Math.PI / 2;
    const startY = u.group.position.y;
    await ease(easeOutCubic, dur * 0.5, (t) => {
        u.group.rotation.z = startRotZ + (targetZ - startRotZ) * t;
        u.group.position.y = startY + (-0.2 - startY) * t;
        mat.opacity = 1 - 0.85 * t;
        headMat.opacity = 1 - 0.85 * t;
    });
}

async function handleAttack(ev, dur) {
    const src = units.get(ev.src);
    const tgt = units.get(ev.tgt);
    if (!src || !src.alive || !tgt) return;

    if (src.actions && src.actions.Punch) {
        const punch = src.actions.Punch;
        const fit = (punch.getClip().duration * 1000) / Math.max(dur * 0.9, 200);
        punch.reset();
        punch.setLoop(THREE.LoopOnce);
        punch.clampWhenFinished = true;
        punch.timeScale = Math.min(3.5, Math.max(0.9, fit));
        if (src.actions.Idle) src.actions.Idle.fadeOut(0.1);
        punch.fadeIn(0.1).play();
    }

    const dx = tgt.baseX - src.baseX;
    const dz = tgt.baseZ - src.baseZ;
    const advX = src.baseX + dx * 0.55;
    const advZ = src.baseZ + dz * 0.55;

    await ease(easeOutCubic, dur * 0.35, (t) => {
        src.group.position.x = src.baseX + (advX - src.baseX) * t;
        src.group.position.z = src.baseZ + (advZ - src.baseZ) * t;
    });

    if (tgt.alive) {
        const tgtBaseX = tgt.baseX;
        const tgtBaseZ = tgt.baseZ;
        const dirX = tgt.baseX - src.baseX;
        const dirZ = tgt.baseZ - src.baseZ;
        const len = Math.hypot(dirX, dirZ) || 1;
        const recoilX = tgt.baseX + (dirX / len) * 0.3;
        const recoilZ = tgt.baseZ + (dirZ / len) * 0.3;
        ease(easeOutCubic, 150, (t) => {
            tgt.group.position.x = tgtBaseX + (recoilX - tgtBaseX) * t;
            tgt.group.position.z = tgtBaseZ + (recoilZ - tgtBaseZ) * t;
        }).then(() => {
            ease(easeInCubic, 150, (t) => {
                tgt.group.position.x = recoilX + (tgtBaseX - recoilX) * t;
                tgt.group.position.z = recoilZ + (tgtBaseZ - recoilZ) * t;
            });
        });

        impactOn(tgt, ev.dmg, ev.kill, ev.hp, dur * 0.5);
    }

    await ease(easeInCubic, dur * 0.35, (t) => {
        src.group.position.x = advX + (src.baseX - advX) * t;
        src.group.position.z = advZ + (src.baseZ - advZ) * t;
    });
}

function impactOn(tgt, dmg, kill, hp, dur) {
    if (!tgt || !tgt.alive) return;
    flashMaterial(tgt);
    if (window.FX3D) {
        const iy = (tgt.floatY || 2.6) * 0.45;
        if (kill) {
            FX3D.burst(tgt.group.position.x, iy, tgt.group.position.z, { color: 0xef4444, count: 26, speed: 4.2, size: 0.11, life: 0.7 });
            shake(0.3);
        } else {
            FX3D.burst(tgt.group.position.x, iy, tgt.group.position.z, { color: 0xffc857, count: 12, speed: 3 });
            shake(0.07);
        }
    }
    spawnFloat(tgt, 'damage', '-' + dmg);
    if (typeof hp === 'number') updateHp(tgt, hp, tgt.maxHp);
    if (kill) killUnit(tgt, tgt.side, dur);
}

async function handleAbility(ev, dur) {
    const src = units.get(ev.src);
    if (ev.kind === 'aura') {
        if (src) {
            flashMaterial(src);
            if (window.FX3D) FX3D.rise(src.group.position.x, 0.5, src.group.position.z, { color: 0xc084fc, count: 24, life: 1.2 });
            units.forEach((u) => {
                if (u.alive && u.side === src.side && u !== src) flashMaterial(u);
            });
        }
        await new Promise((r) => setTimeout(r, dur));
        return;
    }
    if (ev.kind === 'cleave') {
        if (!src || !src.alive) return;
        const tgt = units.get(ev.tgt);
        const tgt2 = units.get(ev.tgt2);
        if (!tgt) return;

        if (src.actions && src.actions.Punch) {
            const punch = src.actions.Punch;
            const fit = (punch.getClip().duration * 1000) / Math.max(dur * 0.9, 200);
            punch.reset();
            punch.setLoop(THREE.LoopOnce);
            punch.clampWhenFinished = true;
            punch.timeScale = Math.min(3.5, Math.max(0.9, fit));
            if (src.actions.Idle) src.actions.Idle.fadeOut(0.1);
            punch.fadeIn(0.1).play();
        }

        const advX = src.baseX + (tgt.baseX - src.baseX) * 0.55;
        const advZ = src.baseZ + (tgt.baseZ - src.baseZ) * 0.55;
        await ease(easeOutCubic, dur * 0.35, (t) => {
            src.group.position.x = src.baseX + (advX - src.baseX) * t;
            src.group.position.z = src.baseZ + (advZ - src.baseZ) * t;
        });

        impactOn(tgt, ev.dmg, ev.kill, ev.hp, dur * 0.5);
        impactOn(tgt2, ev.dmg2, ev.kill2, ev.hp2, dur * 0.5);

        await ease(easeInCubic, dur * 0.35, (t) => {
            src.group.position.x = advX + (src.baseX - advX) * t;
            src.group.position.z = advZ + (src.baseZ - advZ) * t;
        });
        return;
    }
}

async function handleDodge(ev, dur) {
    const tgt = units.get(ev.tgt);
    if (!tgt || !tgt.alive) return;
    const baseZ = tgt.baseZ;
    spawnFloat(tgt, 'dodge', 'Esquivé');
    await ease(easeInOutSine, dur, (t) => {
        let f;
        if (t < 0.5) f = t / 0.5;
        else f = 1 - (t - 0.5) / 0.5;
        tgt.group.position.z = baseZ + f * 0.8;
    });
    tgt.group.position.z = baseZ;
}

function handleRoundEnd(ev, dur) {
    return new Promise((resolve) => {
        (ev.heals || []).forEach((h) => {
            const u = units.get(h.uid);
            if (!u || !u.alive) return;
            spawnFloat(u, 'heal', '+' + h.amount);
            if (window.FX3D) FX3D.rise(u.group.position.x, 0.4, u.group.position.z, {});
            if (typeof h.hp === 'number') updateHp(u, h.hp, u.maxHp);
        });
        setTimeout(resolve, dur);
    });
}

async function play(ev, dur) {
    if (!ev || typeof ev !== 'object') return;
    try {
        switch (ev.t) {
            case 'attack':
                await handleAttack(ev, dur);
                break;
            case 'dodge':
                await handleDodge(ev, dur);
                break;
            case 'ability':
                await handleAbility(ev, dur);
                break;
            case 'roundEnd':
                await handleRoundEnd(ev, dur);
                break;
            case 'round':
                break;
            default:
                break;
        }
    } catch (e) {
        return;
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

window.Battle3D = { mount, setup, play, stop, supported, ready: loadModel };
