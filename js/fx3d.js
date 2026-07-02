import * as THREE from 'three';

let scene = null;
const systems = [];

function spawn(x, y, z, opts) {
    const count = opts.count;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        opts.velocity(velocities, i);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: opts.color,
        size: opts.size,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    systems.push({
        points,
        velocities,
        life: opts.life,
        age: 0,
        gravity: opts.gravity,
        baseSize: opts.size
    });
}

function attach(s) {
    scene = s;
}

function burst(x, y, z, opts = {}) {
    if (!scene) return;
    try {
        const color = opts.color !== undefined ? opts.color : 0xffffff;
        const count = opts.count !== undefined ? opts.count : 14;
        const speed = opts.speed !== undefined ? opts.speed : 3;
        const size = opts.size !== undefined ? opts.size : 0.09;
        const life = opts.life !== undefined ? opts.life : 0.55;
        const gravity = opts.gravity !== undefined ? opts.gravity : 6;
        const spread = opts.spread !== undefined ? opts.spread : 1;

        spawn(x, y, z, {
            color, count, size, life, gravity,
            velocity(velocities, i) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const s = speed * (0.4 + Math.random() * 0.6);

                const vx = Math.sin(phi) * Math.cos(theta) * s;
                const vy = Math.cos(phi) * s + speed * 0.4 * spread;
                const vz = Math.sin(phi) * Math.sin(theta) * s;

                velocities[i * 3] = vx;
                velocities[i * 3 + 1] = vy;
                velocities[i * 3 + 2] = vz;
            }
        });
    } catch (e) {
    }
}

function rise(x, y, z, opts = {}) {
    if (!scene) return;
    try {
        const color = opts.color !== undefined ? opts.color : 0x22c55e;
        const count = opts.count !== undefined ? opts.count : 10;
        const size = opts.size !== undefined ? opts.size : 0.08;
        const life = opts.life !== undefined ? opts.life : 0.9;

        spawn(x, y, z, {
            color, count, size, life, gravity: 0,
            velocity(velocities, i) {
                velocities[i * 3] = (Math.random() * 2 - 1) * 0.4;
                velocities[i * 3 + 1] = 0.8 + Math.random() * 0.8;
                velocities[i * 3 + 2] = (Math.random() * 2 - 1) * 0.4;
            }
        });
    } catch (e) {
    }
}

function update(delta) {
    if (!scene) return;
    try {
        for (let i = systems.length - 1; i >= 0; i--) {
            const sys = systems[i];
            sys.age += delta;

            if (sys.age >= sys.life) {
                scene.remove(sys.points);
                sys.points.geometry.dispose();
                sys.points.material.dispose();
                systems.splice(i, 1);
                continue;
            }

            const positions = sys.points.geometry.attributes.position.array;
            const velocities = sys.velocities;
            const count = positions.length / 3;

            for (let p = 0; p < count; p++) {
                positions[p * 3] += velocities[p * 3] * delta;
                positions[p * 3 + 1] += velocities[p * 3 + 1] * delta;
                positions[p * 3 + 2] += velocities[p * 3 + 2] * delta;
                velocities[p * 3 + 1] -= sys.gravity * delta;
            }

            sys.points.geometry.attributes.position.needsUpdate = true;

            const t = sys.age / sys.life;
            sys.points.material.opacity = 1 - Math.pow(t, 1.5);
            sys.points.material.size = sys.baseSize * (1 - t * 0.4);
        }
    } catch (e) {
    }
}

window.FX3D = { attach, burst, rise, update };
