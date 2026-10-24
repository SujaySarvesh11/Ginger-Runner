// Ginger Dash: procedural pixel art. Every sprite is generated at load time; no image files are fetched.
(() => {
  const GD = window.GD = window.GD || {};
  const W = 720;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Small seeded PRNG (mulberry32) so the scenery looks the same every load.
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Rasterises a shape: fn(x, y) returns a colour or null. A 1px outline is added around the silhouette,
  // so the returned canvas is (w + 2) x (h + 2).
  function pixelSprite(w, h, fn, outline) {
    const grid = new Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) grid[y * w + x] = fn(x, y);
    const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? grid[y * w + x] : null);
    const c = makeCanvas(w + 2, h + 2), g = c.getContext('2d');
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        const col = at(x, y);
        if (col) {
          g.fillStyle = col;
          g.fillRect(x + 1, y + 1, 1, 1);
        } else if (outline && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) {
          g.fillStyle = outline;
          g.fillRect(x + 1, y + 1, 1, 1);
        }
      }
    }
    return c;
  }

  // ---------- Obstacles ----------

  function makeRock(seed, w, h) {
    const r = rng(seed);
    const jag = Array.from({ length: 14 }, () => 0.82 + r() * 0.22);
    const moss = Array.from({ length: w }, () => r());
    const cx = w / 2, cy = h * 0.68, rx = w / 2, ry = h * 0.7;
    return pixelSprite(w, h, (x, y) => {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const k = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 14) % 14;
      if (Math.hypot(dx, dy) > jag[k]) return null;
      if (y < h * 0.22 + moss[x] * 3 && moss[x] > 0.25) return moss[x] > 0.7 ? '#7ad35a' : '#3f9a3a';
      const s = dx + dy;
      if (s < -0.55) return '#a9adb9';
      if (s > 0.45) return '#4b4e5a';
      if ((x * 7 + y * 3 + seed) % 11 === 0) return '#55586a';
      return '#7b7f8c';
    }, '#1d1e26');
  }

  // Spiky briar patch: overlapping leafy blobs with thorns radiating out.
  function makeBush(seed, w, h) {
    const r = rng(seed);
    const blobs = Array.from({ length: 5 }, () => ({
      x: 5 + r() * (w - 10), y: h * 0.55 + r() * h * 0.35, r: h * 0.38 + r() * h * 0.2,
      k: 7 + Math.floor(r() * 4), p: r() * 6,
    }));
    return pixelSprite(w, h, (x, y) => {
      let col = null;
      for (const b of blobs) {
        const dx = x + 0.5 - b.x, dy = y + 0.5 - b.y, d = Math.hypot(dx, dy) / b.r;
        if (d < 0.8) {
          if ((x * 31 + y * 17 + seed) % 23 === 0) return '#ff3b5c';
          return dy < -b.r * 0.35 ? '#5cc85a' : dy > b.r * 0.3 ? '#1d5a2a' : '#2f8a3c';
        }
        const spike = Math.pow(Math.max(0, Math.sin(Math.atan2(dy, dx) * b.k + b.p)), 8) * 0.6;
        if (d < 0.8 + spike) col = '#b0708a';
      }
      return col;
    }, '#10240f');
  }

  function makeLog(seed, w, h) {
    const r = rng(seed), moss = Array.from({ length: w }, () => r());
    const cap = w - 5;
    return pixelSprite(w, h, (x, y) => {
      if (x >= cap) {
        const d = Math.hypot((x + 0.5 - cap) / 5, (y + 0.5 - h / 2) / (h / 2));
        if (d > 1) return null;
        return d < 0.25 ? '#7a4a22' : Math.floor(d * 4) % 2 ? '#d9a566' : '#b67d45';
      }
      if (x < 2 && (y === 0 || y === h - 1)) return null;
      if (y <= 1 && moss[x] > 0.55) return moss[x] > 0.8 ? '#7ad35a' : '#3f9a3a';
      if ((y === 3 || y === 7 || y === 10) && (x * 7 + seed) % 9 > 1) return '#4a2c18';
      if (y <= 2) return '#8f5e36';
      if (y >= h - 2) return '#55331d';
      return '#6e4427';
    }, '#1f1209');
  }

  // Cross-section of a rolling log; the spin is drawn on top at render time.
  function makeLogDisc(n) {
    return pixelSprite(n, n, (x, y) => {
      const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      if (d > 1) return null;
      if (d > 0.8) return '#5a3820';
      return d < 0.15 ? '#7a4a22' : Math.floor(d * 5) % 2 ? '#d9a566' : '#b67d45';
    }, '#1f1209');
  }

  // ---------- Pickups ----------

  function makeFish(w, h, pal) {
    const cx = w * 0.4, rx = w * 0.4, cy = h / 2, ry = h / 2 - 0.5;
    const tailStart = Math.floor(w * 0.72);
    const eyeX = Math.round(cx - rx * 0.55), eyeY = Math.floor(cy - 1);
    return pixelSprite(w, h, (x, y) => {
      const bx = (x + 0.5 - cx) / rx, by = (y + 0.5 - cy) / ry;
      const body = bx * bx + by * by <= 1;
      const tail = x >= tailStart && Math.abs(y + 0.5 - cy) <= ((x - tailStart + 1) * (h / 2)) / (w - tailStart);
      if (!body && !tail) return null;
      if (body && x === eyeX && y === eyeY) return pal.eye;
      if (tail && !body) return pal.tail;
      if (by < -0.4) return pal.light;
      if (by > 0.45) return pal.dark;
      return pal.base;
    }, pal.outline);
  }

  function makeOrb(base, light, dark, emblem) {
    return pixelSprite(14, 14, (x, y) => {
      const dx = x + 0.5 - 7, dy = y + 0.5 - 7, d = Math.hypot(dx, dy);
      if (d > 6.6) return null;
      const e = emblem(x, y);
      if (e) return e;
      if (dx + dy < -5) return light;
      if (d > 5.2 && dx + dy > 2) return dark;
      return base;
    }, '#0a0820');
  }

  const shieldEmblem = (x, y) => {
    if (y < 3 || y > 10) return null;
    const hw = y <= 7 ? 3 : 3 - (y - 7) * 0.9, dx = Math.abs(x + 0.5 - 7);
    if (dx > hw) return null;
    return dx < hw - 1.2 && y > 3 && y < 9 ? '#bfe6ff' : '#ffffff';
  };
  const BOLT = ['...##', '..##.', '.##..', '#####', '..##.', '.##..', '##...'];
  const boltEmblem = (x, y) => (BOLT[y - 3] && BOLT[y - 3][x - 4] === '#' ? '#fff6a0' : null);

  // ---------- Scenery ----------

  function makeMoon() {
    const craters = [[7, 8, 2.2], [14, 13, 3], [9, 15, 1.6], [15, 6, 1.4]];
    return pixelSprite(22, 22, (x, y) => {
      const dx = x + 0.5 - 11, dy = y + 0.5 - 11;
      if (Math.hypot(dx, dy) > 10.5) return null;
      if (craters.some(([cx, cy, cr]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < cr)) return '#dcd2a4';
      return dx + dy > 8 ? '#e6dcae' : '#fff6d0';
    }, null);
  }

  function makeStars() {
    const r = rng(42), colors = ['#ffffff', '#ffe9a8', '#9fd8ff', '#ff9fe0', '#b5ffb0', '#ffffff'];
    return Array.from({ length: 120 }, () => ({
      x: r() * W, y: Math.floor(r() * 118), s: r() < 0.14 ? 2 : 1,
      c: colors[Math.floor(r() * colors.length)], sp: 0.02 + r() * 0.07, ph: r() * 6.28,
    }));
  }

  // All scrolling layers are 720px wide and tile seamlessly.
  function makeMountains() {
    const c = makeCanvas(W, 158), g = c.getContext('2d');
    const ridge = (amp, base, fill, rim, phase) => {
      for (let x = 0; x < W; x += 3) {
        const t = (x / W) * Math.PI * 2;
        const h = base + amp * (Math.sin(t * 2 + phase) + 0.55 * Math.sin(t * 5 + phase * 2) + 0.28 * Math.sin(t * 13));
        const top = Math.round(150 - h);
        g.fillStyle = fill;
        g.fillRect(x, top, 3, 158 - top);
        g.fillStyle = rim;
        g.fillRect(x, top, 3, 2);
      }
    };
    ridge(20, 68, '#311a58', '#6a3a9a', 2.2);
    ridge(16, 46, '#231240', '#4c2a7a', 1);
    return c;
  }

  function pine(g, x, base, h) {
    g.fillRect(x - 1, base - 3, 3, 6);
    const tier = Math.ceil(h / 3);
    for (let row = 0; row < h; row++) {
      const hw = Math.round(1 + row * 0.2 + ((row % tier) / tier) * 3.2);
      g.fillRect(x - hw, base - h + row, hw * 2 + 1, 1);
    }
  }

  function makeTrees() {
    const c = makeCanvas(W, 158), g = c.getContext('2d'), r = rng(77);
    g.fillStyle = '#170b2c';
    for (let x = 0; x < W; x += 2) {
      const t = (x / W) * Math.PI * 2;
      const top = Math.round(142 + 4 * Math.sin(t * 3) + 2 * Math.sin(t * 7));
      g.fillRect(x, top, 2, 158 - top);
    }
    for (let i = 0; i < 48; i++) {
      const x = Math.floor(r() * W), h = 18 + Math.floor(r() * 40);
      g.fillStyle = r() < 0.5 ? '#170b2c' : '#120824';
      for (const ox of [x - W, x, x + W]) pine(g, ox, 148, h);
    }
    return c;
  }

  // Ground strip drawn from y = 150; the grass surface sits at local y 8 (GROUND_Y = 158).
  function makeGround() {
    const c = makeCanvas(W, 50), g = c.getContext('2d'), r = rng(5);
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    px(0, 8, W, 42, '#3b2619');
    for (let i = 0; i < 40; i++) px(Math.floor(r() * (W - 26)), 18 + Math.floor(r() * 28), 6 + Math.floor(r() * 20), 1, '#2c1b11');
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(r() * (W - 5)), y = 15 + Math.floor(r() * 33);
      const w = 2 + Math.floor(r() * 3), h = 1 + Math.floor(r() * 2);
      px(x, y, w, h, r() < 0.5 ? '#6f6872' : '#5a5560');
      px(x, y, w - 1, 1, '#9a93a0');
    }
    px(0, 8, W, 4, '#2e8b3a');
    px(0, 8, W, 1, '#62d35e');
    const blades = ['#62d35e', '#3fae4a', '#86ea76'];
    for (let x = 0; x < W; x++) {
      if (r() < 0.35) px(x, 12, 1, 1 + Math.floor(r() * 3), '#1f5e2a');
      if (r() < 0.6) {
        const h = 1 + Math.floor(r() * 4);
        px(x, 8 - h, 1, h, blades[Math.floor(r() * 3)]);
        if (r() < 0.03) px(x, 7 - h, 1, 1, r() < 0.5 ? '#ff7ab8' : '#ffe066');
      }
    }
    return c;
  }

  // ---------- Cat ----------

  const LEGS = [
    // [baseX, phaseOffset, far]
    [-11, 0, true],
    [-8, Math.PI, false],
    [0, Math.PI * 0.5, true],
    [3, Math.PI * 1.5, false],
  ];

  // Draws a cat with its feet at (x, y), facing right.
  // s: { t, phase, air, vy, sx, sy, blink, twitch, tailLag, rot, alpha }
  function drawCat(g, skin, s, x, y) {
    const bob = s.air ? 0 : Math.sin(s.phase * 2) > 0.2 ? -1 : 0;
    const sil = [], det = [];
    const fluffy = skin.pattern === 'fluffy';
    const striped = skin.pattern === 'tabby' || skin.pattern === 'neon';

    // Tail: a chain of segments that curls upward, wags, and lags behind vertical motion.
    let tx = -12, ty = -13 + bob, ang = -2.55 + (s.tailLag || 0);
    const ts = fluffy ? 3 : 2;
    for (let i = 0; i < 7; i++) {
      ang += 0.13 + Math.sin(s.t * 0.18 - i * 0.7) * 0.16;
      tx += Math.cos(ang) * 2;
      ty += Math.sin(ang) * 2;
      let col = skin.fur;
      if (i === 6) col = skin.pattern === 'calico' ? skin.patchB : skin.furDark;
      else if (striped && i % 2) col = skin.stripe;
      sil.push([Math.round(tx) - 1, Math.round(ty) - 1, ts, ts, col]);
    }

    // Legs
    for (const [lx, po, far] of LEGS) {
      let dx, lift;
      if (s.air) {
        const back = lx < -4;
        if (s.vy < 0) { dx = back ? -3 : 3; lift = 2; } else { dx = back ? -1 : 2; lift = 0; }
      } else {
        dx = Math.round(Math.sin(s.phase + po) * 2);
        lift = Math.max(0, Math.round(Math.cos(s.phase + po) * 2));
      }
      const top = -6 + bob, bottom = -lift;
      sil.push([lx + dx, top, 3, bottom - top, far ? skin.furDark : skin.fur]);
      det.push([lx + dx, bottom - 2, 3, 2, far && skin.paws === '#ffffff' ? '#e8e2da' : skin.paws]);
    }

    // Body and head
    sil.push([-12, -15 + bob, 18, 10, skin.fur]);
    sil.push([2, -22 + bob, 12, 11, skin.fur]);
    sil.push([1, -15 + bob, 14, 3, skin.fur]);
    const ey = -22 + bob, e1 = 3, e2 = 9 + (s.twitch ? 1 : 0), e2y = ey + (s.twitch ? 1 : 0);
    const e1col = skin.pattern === 'calico' ? skin.patchA : skin.fur;
    const e2col = skin.pattern === 'calico' ? skin.patchB : skin.fur;
    sil.push([e1 + 1, ey - 3, 2, 1, e1col], [e1, ey - 2, 4, 2, e1col]);
    sil.push([e2 + 1, e2y - 3, 2, 1, e2col], [e2, e2y - 2, 4, 2, e2col]);
    if (fluffy) {
      sil.push([-13, -14 + bob, 1, 3, skin.fur], [-10, -16 + bob, 2, 1, skin.fur], [-4, -16 + bob, 2, 1, skin.fur]);
      sil.push([15, -14 + bob, 1, 2, skin.fur], [2, -12 + bob, 3, 4, skin.belly]);
    }

    // Details (no outline)
    det.push([-8, -15 + bob, 8, 1, skin.furLight]);
    det.push([-9, -7 + bob, 13, 2, skin.belly]);
    det.push([10, -15 + bob, 5, 3, skin.belly]);
    if (skin.pattern === 'tabby' || skin.pattern === 'neon') {
      for (const sx of [-10, -6, -2]) det.push([sx, -15 + bob, 2, sx === -6 ? 5 : 4, skin.stripe]);
      det.push([7, -22 + bob, 1, 2, skin.stripe], [9, -22 + bob, 1, 3, skin.stripe], [11, -22 + bob, 1, 2, skin.stripe]);
      det.push([3, -17 + bob, 2, 1, skin.stripe]);
    } else if (skin.pattern === 'calico') {
      det.push([-12, -15 + bob, 7, 5, skin.patchA], [-5, -15 + bob, 3, 3, skin.patchA], [2, -22 + bob, 5, 4, skin.patchA]);
      det.push([0, -15 + bob, 5, 4, skin.patchB], [-12, -10 + bob, 3, 3, skin.patchB], [10, -22 + bob, 4, 2, skin.patchB]);
    }
    det.push([e1 + 1, ey - 2, 2, 1, skin.earIn], [e2 + 1, e2y - 2, 2, 1, skin.earIn]);
    for (const ex of [6, 11]) {
      if (s.blink) det.push([ex, -18 + bob, 2, 1, skin.outline]);
      else det.push([ex, -19 + bob, 2, 2, skin.eye], [ex + 1, -19 + bob, 1, 2, skin.pupil]);
    }
    det.push([14, -16 + bob, 2, 1, skin.nose], [13, -14 + bob, 1, 1, skin.outline]);
    det.push([15, -15 + bob, 4, 1, skin.whisker], [15, -13 + bob, 4, 1, skin.whisker]);

    g.save();
    g.translate(Math.round(x), Math.round(y));
    if (s.alpha !== undefined) g.globalAlpha = s.alpha;
    if (s.rot) { g.translate(0, -12); g.rotate(s.rot); g.translate(0, 12); }
    g.scale(s.sx || 1, s.sy || 1);

    // Soft glows are radial fills rather than shadowBlur, which is much cheaper per frame.
    if (skin.glow) glow(g, 0, -13, 26, skin.glow, 0.28);
    g.fillStyle = skin.outline;
    for (const p of sil) g.fillRect(p[0] - 1, p[1] - 1, p[2] + 2, p[3] + 2);
    for (const p of sil) { g.fillStyle = p[4]; g.fillRect(p[0], p[1], p[2], p[3]); }
    for (const p of det) { g.fillStyle = p[4]; g.fillRect(p[0], p[1], p[2], p[3]); }
    if (skin.eyeGlow && !s.blink) {
      glow(g, 7, -18 + bob, 4, skin.eyeGlow, 0.5);
      glow(g, 12, -18 + bob, 4, skin.eyeGlow, 0.5);
    }
    g.restore();
  }

  function glow(g, x, y, r, color, alpha) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    const a = g.globalAlpha;
    g.globalAlpha = a * alpha;
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalAlpha = a;
  }

  GD.Art = {
    build() {
      return {
        rocks: [makeRock(11, 20, 16), makeRock(23, 24, 20), makeRock(37, 28, 22)],
        bushes: [makeBush(5, 30, 16), makeBush(9, 26, 18)],
        log: makeLog(3, 44, 12),
        logDisc: makeLogDisc(18),
        fish: makeFish(16, 10, { base: '#ffd23f', light: '#fff3a8', dark: '#f0a800', tail: '#ffb300', eye: '#2a1a00', outline: '#7a4300' }),
        treat: makeFish(8, 5, { base: '#ff9a3c', light: '#ffc27a', dark: '#d9661a', tail: '#e8782a', eye: '#3a1a00', outline: '#4a1e05' }),
        shieldOrb: makeOrb('#2f8cff', '#9fdcff', '#1a4fb0', shieldEmblem),
        speedOrb: makeOrb('#ff7a1a', '#ffc36b', '#c4400a', boltEmblem),
        moon: makeMoon(),
        stars: makeStars(),
        mountains: makeMountains(),
        trees: makeTrees(),
        ground: makeGround(),
      };
    },
    drawCat,
    glow,
  };
})();
