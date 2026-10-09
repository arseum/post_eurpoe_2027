import * as THREE from 'three';

function part(g, geo, mat, x, y, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
}

function scales(g, mat) {
    part(g, new THREE.BoxGeometry(0.36, 0.05, 0.2), mat, 0, 0.025);
    part(g, new THREE.CylinderGeometry(0.035, 0.045, 0.86, 8), mat, 0, 0.45);
    part(g, new THREE.SphereGeometry(0.06, 10, 8), mat, 0, 0.92);
    part(g, new THREE.BoxGeometry(0.86, 0.045, 0.045), mat, 0, 0.84);
    for (const x of [-0.4, 0.4]) {
        part(g, new THREE.CylinderGeometry(0.008, 0.008, 0.32, 4), mat, x, 0.68);
        part(g, new THREE.CylinderGeometry(0.16, 0.1, 0.035, 16), mat, x, 0.5);
    }
}

function anchor(g, mat) {
    part(g, new THREE.CylinderGeometry(0.045, 0.045, 0.78, 8), mat, 0, 0.5);
    part(g, new THREE.TorusGeometry(0.09, 0.03, 8, 20), mat, 0, 0.98);
    part(g, new THREE.BoxGeometry(0.46, 0.05, 0.05), mat, 0, 0.8);
    const arc = part(g, new THREE.TorusGeometry(0.32, 0.045, 8, 24, Math.PI), mat, 0, 0.44);
    arc.rotation.z = Math.PI;
    for (const s of [-1, 1]) {
        const fluke = part(g, new THREE.ConeGeometry(0.07, 0.16, 8), mat, s * 0.32, 0.5);
        fluke.rotation.z = -s * 0.5;
    }
}

function anvil(g, mat) {
    part(g, new THREE.BoxGeometry(0.34, 0.12, 0.26), mat, 0, 0.06);
    part(g, new THREE.BoxGeometry(0.18, 0.22, 0.16), mat, 0, 0.23);
    part(g, new THREE.BoxGeometry(0.58, 0.16, 0.28), mat, -0.04, 0.42);
    const horn = part(g, new THREE.ConeGeometry(0.13, 0.34, 12), mat, 0.41, 0.44);
    horn.rotation.z = -Math.PI / 2;
}

const SHAPES = { scales, anchor, anvil };

export function buildEmblem(kind, mat) {
    const g = new THREE.Group();
    (SHAPES[kind] || scales)(g, mat);
    return g;
}
