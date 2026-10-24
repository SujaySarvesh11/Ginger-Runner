// Ginger Dash: zero-dependency 8-bit sound synthesizer built on the Web Audio API.
(() => {
  const GD = window.GD = window.GD || {};
  const VOLUME = 0.32;
  let ac = null, master = null, noise = null, muted = false;

  // The context can only start after a user gesture, so it is created lazily.
  function init() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  // One enveloped oscillator. `steps` is a list of [offsetSeconds, frequency]; `glideTo` sweeps to a final pitch.
  function voice(type, t0, dur, vol, steps, glideTo) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(steps[0][1], t0);
    for (const [dt, f] of steps.slice(1)) o.frequency.setValueAtTime(f, t0 + dt);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // White noise through a sweeping low-pass filter.
  function hiss(t0, dur, vol, fFrom, fTo) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(fFrom, t0);
    f.frequency.exponentialRampToValueAtTime(fTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t0);
    s.stop(t0 + dur + 0.02);
  }

  const sound = (fn) => (...args) => {
    if (muted || !init()) return;
    fn(ac.currentTime + 0.005, ...args);
  };

  GD.Sfx = {
    unlock: () => init(),
    isMuted: () => muted,
    setMuted(v) {
      muted = v;
      if (master) master.gain.setTargetAtTime(v ? 0 : VOLUME, ac.currentTime, 0.02);
    },

    jump: sound((t) => voice('square', t, 0.16, 0.16, [[0, 150], [0.035, 220], [0.07, 310], [0.105, 420]])),
    doubleJump: sound((t) => voice('square', t, 0.14, 0.14, [[0, 300]], 750)),
    land: sound((t) => hiss(t, 0.06, 0.08, 900, 200)),
    powerup: sound((t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => voice('square', t + i * 0.07, 0.12, 0.14, [[0, f]]))),
    treat: sound((t) => voice('triangle', t, 0.08, 0.2, [[0, 988], [0.03, 1319]])),
    dodge: sound((t) => voice('square', t, 0.05, 0.06, [[0, 1568]])),
    combo: sound((t, n) => [0, 1, 2].forEach((i) => voice('square', t + i * 0.05, 0.09, 0.12, [[0, 660 * Math.pow(1.26, i) * (1 + Math.min(n, 10) * 0.04)]]))),
    hit: sound((t) => { hiss(t, 0.35, 0.5, 4000, 120); voice('square', t, 0.22, 0.12, [[0, 180]], 55); }),
    crush: sound((t) => { hiss(t, 0.28, 0.45, 2600, 150); voice('triangle', t, 0.18, 0.22, [[0, 120]], 40); }),
    shield: sound((t) => { hiss(t, 0.3, 0.35, 7000, 300); voice('triangle', t, 0.25, 0.14, [[0, 1400]], 280); }),
    thunder: sound((t) => { hiss(t, 0.7, 0.6, 9000, 70); voice('sawtooth', t, 0.45, 0.12, [[0, 95]], 32); }),
    dash: sound((t) => { voice('sawtooth', t, 0.35, 0.1, [[0, 200]], 1300); hiss(t, 0.35, 0.16, 1200, 7000); }),
    fish: sound((t) => [784, 988, 1175, 1568, 1319, 1568].forEach((f, i) => voice('square', t + i * 0.06, 0.1, 0.13, [[0, f]]))),
    firework: sound((t) => hiss(t, 0.4, 0.18, 5000, 400)),
    revive: sound((t) => [262, 330, 392, 523, 659, 784].forEach((f, i) => voice('triangle', t + i * 0.06, 0.28, 0.2, [[0, f]]))),
    record: sound((t) => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => voice('square', t + i * 0.1, 0.14, 0.13, [[0, f]]))),
    // Descending minor tri-tone: G4, Eb4, C4.
    gameOver: sound((t) => [[392, 0, 0.3], [311.13, 0.32, 0.3], [261.63, 0.64, 0.8]].forEach(([f, dt, d]) => {
      voice('square', t + dt, d, 0.12, [[0, f]], f * 0.97);
      voice('triangle', t + dt, d, 0.18, [[0, f / 2]]);
    })),
    click: sound((t) => voice('square', t, 0.05, 0.08, [[0, 880]])),
  };
})();
