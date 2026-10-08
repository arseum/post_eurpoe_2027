const Sfx = (() => {
    const KEY = 'pe2147_sound';
    let ctx = null, master = null, ambient = false, noiseBuf = null;
    let on = true;
    try {
        on = localStorage.getItem(KEY) !== '0';
    } catch (e) {
        on = true;
    }

    function ensure() {
        if (ctx) return ctx;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = on ? 0.5 : 0;
        master.connect(ctx.destination);
        return ctx;
    }

    function tone(freq, dur, opts = {}) {
        const c = ensure();
        if (!c || !on) return;
        const t0 = c.currentTime + (opts.delay || 0);
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = opts.type || 'sine';
        o.frequency.setValueAtTime(freq, t0);
        if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
        const v = opts.vol || 0.2;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(v, t0 + Math.min(0.02, dur / 4));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
    }

    function noise(dur, opts = {}) {
        const c = ensure();
        if (!c || !on) return;
        const t0 = c.currentTime + (opts.delay || 0);
        if (!noiseBuf) {
            noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        const src = c.createBufferSource();
        src.buffer = noiseBuf;
        const f = c.createBiquadFilter();
        f.type = opts.filter || 'lowpass';
        f.frequency.value = opts.freq || 1200;
        const g = c.createGain();
        g.gain.setValueAtTime(opts.vol || 0.2, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f);
        f.connect(g);
        g.connect(master);
        src.start(t0, Math.random() * (1 - dur), dur);
    }

    function chord(notes, dur, opts = {}) {
        notes.forEach((n, i) => tone(n, dur, {...opts, delay: (opts.delay || 0) + i * (opts.spread || 0)}));
    }

    const SOUNDS = {
        click: () => tone(660, 0.06, {type: 'triangle', vol: 0.08}),
        build: () => {
            noise(0.12, {freq: 900, vol: 0.18});
            tone(220, 0.25, {type: 'square', vol: 0.06, delay: 0.05});
            tone(330, 0.3, {type: 'triangle', vol: 0.1, delay: 0.12});
        },
        recruit: () => {
            tone(392, 0.12, {type: 'triangle', vol: 0.12});
            tone(523, 0.18, {type: 'triangle', vol: 0.12, delay: 0.08});
        },
        research: () => chord([523, 659, 784, 1046], 0.6, {type: 'sine', vol: 0.07, spread: 0.07}),
        turn: () => {
            tone(196, 0.5, {type: 'sine', vol: 0.12});
            tone(294, 0.6, {type: 'sine', vol: 0.08, delay: 0.1});
        },
        threat: () => {
            tone(440, 0.35, {type: 'sawtooth', vol: 0.06, to: 330});
            tone(440, 0.35, {type: 'sawtooth', vol: 0.06, to: 330, delay: 0.4});
        },
        alliance: () => chord([392, 494, 587], 0.9, {type: 'triangle', vol: 0.08, spread: 0.12}),
        event: () => tone(880, 0.5, {type: 'sine', vol: 0.06, to: 1320}),
        hit: () => {
            noise(0.08, {freq: 2400, vol: 0.12, filter: 'bandpass'});
            tone(140, 0.1, {type: 'square', vol: 0.05, to: 80});
        },
        kill: () => {
            noise(0.3, {freq: 600, vol: 0.2});
            tone(110, 0.35, {type: 'sawtooth', vol: 0.07, to: 50});
        },
        heal: () => tone(740, 0.25, {type: 'sine', vol: 0.06, to: 990}),
        victory: () => chord([392, 523, 659, 784], 1.2, {type: 'triangle', vol: 0.1, spread: 0.14}),
        defeat: () => chord([330, 277, 220, 165], 1.4, {type: 'sawtooth', vol: 0.05, spread: 0.22}),
        retreat: () => chord([392, 349, 294], 0.8, {type: 'triangle', vol: 0.07, spread: 0.18})
    };

    function play(name) {
        if (!on || !SOUNDS[name]) return;
        if (!ensure()) return;
        if (ctx.state === 'suspended') ctx.resume();
        try {
            SOUNDS[name]();
        } catch (e) {
            return;
        }
    }

    function startAmbient() {
        const c = ensure();
        if (!c || ambient) return;
        const g = c.createGain();
        g.gain.value = 0.035;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        const lfo = c.createOscillator();
        const lfoGain = c.createGain();
        lfo.frequency.value = 0.07;
        lfoGain.gain.value = 160;
        lfo.connect(lfoGain);
        lfoGain.connect(f.frequency);
        [55, 82.4, 110.2].forEach(fr => {
            const o = c.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = fr;
            o.connect(f);
            o.start();
        });
        f.connect(g);
        g.connect(master);
        lfo.start();
        ambient = true;
    }

    function unlock() {
        if (!ensure()) return;
        if (ctx.state === 'suspended') ctx.resume();
        startAmbient();
    }

    function toggle() {
        on = !on;
        try {
            localStorage.setItem(KEY, on ? '1' : '0');
        } catch (e) {
        }
        if (ensure()) {
            master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05);
            if (on) unlock();
        }
        return on;
    }

    function isOn() {
        return on;
    }

    document.addEventListener('pointerdown', unlock, {once: true});
    document.addEventListener('keydown', unlock, {once: true});

    return {play, toggle, isOn};
})();
