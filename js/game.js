// Ginger Dash: game loop, physics, spawning, collisions, rendering and input.
(() => {
  'use strict';
  const GD = window.GD;
  const ui = GD.UI, sfx = GD.Sfx;

  const W = 720, H = 200;
  const GROUND_Y = 158;
  const GRAVITY = 0.62;
  const BASE_JUMP_POWER = -11.8;
  const BASE_MOVE_SPEED = 3.8;
  const JUMP_CUT = -4.2;          // releasing jump early caps upward speed here (variable jump height)
  const JUMP_BUFFER = 6;          // frames a jump press is remembered before landing
  const COYOTE_FRAMES = 5;        // frames a ground jump is still allowed after leaving the ground
  const COMBO_WINDOW = 168;       // ~2.8s at 60 FPS
  const DASH_FRAMES = 180;
  const STEP = 1000 / 60;
  const FONT = '"Press Start 2P", monospace';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const art = GD.Art.build();
  const skyGrad = (() => {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, '#07041a');
    g.addColorStop(0.45, '#1c0d45');
    g.addColorStop(0.8, '#4a1a66');
    g.addColorStop(1, '#7a2a6e');
    return g;
  })();

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const weighted = (weights) => {
    const total = Object.values(weights).reduce((s, w) => s + w, 0);
    let roll = Math.random() * total;
    for (const [k, w] of Object.entries(weights)) if ((roll -= w) < 0) return k;
    return Object.keys(weights)[0];
  };

  // ---------- Persistence ----------

  const SAVE_KEY = 'gingerDash.v1';
  const save = (() => {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { raw = {}; }
    const s = { best: { easy: 0, normal: 0, hard: 0, intense: 0 }, skin: 'ginger', equipped: [], difficulty: 'normal', muted: false };
    if (raw.best && typeof raw.best === 'object') for (const k of Object.keys(s.best)) s.best[k] = Number(raw.best[k]) || 0;
    if (GD.SKINS.some((k) => k.id === raw.skin)) s.skin = raw.skin;
    if (Array.isArray(raw.equipped)) s.equipped = raw.equipped.filter((id) => GD.ITEMS.some((i) => i.id === id)).slice(0, GD.MAX_SLOTS);
    if (GD.DIFFICULTIES[raw.difficulty]) s.difficulty = raw.difficulty;
    s.muted = !!raw.muted;
    return s;
  })();
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage unavailable: progress lasts this session only */ }
  }
  const skin = () => GD.SKINS.find((s) => s.id === save.skin);

  // ---------- Run state ----------

  let state = 'menu';             // menu | playing | paused | dying | over
  let run = null;
  let demo = newRun(true);        // attract-mode run shown behind the menus
  let tick = 0;
  let overAt = 0;
  const input = { left: false, right: false, down: false, jumpHeld: false, jumpPressed: false };
  const demoInput = { left: false, right: false, down: false, jumpHeld: false, jumpPressed: false, hold: 0 };

  function newRun(isDemo) {
    const d = GD.DIFFICULTIES[isDemo ? 'normal' : save.difficulty];
    const m = GD.computeMods(isDemo ? [] : save.equipped);
    const dashMax = Math.round(DASH_FRAMES * m.dashMul);
    return {
      demo: isDemo, d, m, t: 0, dist: 0, score: 0, speed: d.speed,
      scoreMul: d.mult * m.scoreMul,
      cat: {
        x: 110, y: GROUND_Y, vx: 0, vy: 0, onGround: true, jumps: 0, coyote: COYOTE_FRAMES, buffer: 0,
        sx: 1, sy: 1, phase: 0, tailLag: 0, blink: 0, blinkT: 90, twitch: 0, twitchT: 140, rot: 0, trail: [],
      },
      maxLives: 3 + m.maxLivesAdd, lives: 3 + m.maxLivesAdd,
      shield: m.startShield ? 1 : 0, revive: m.revive, invuln: 0,
      dash: m.startDash ? 180 : 0, dashMax: m.startDash ? 180 : dashMax, dashLen: dashMax,
      obstacles: [], pickups: [], treats: [], particles: [], texts: [], bolts: [], fireworks: [],
      spawnIn: isDemo ? 60 : 100, puIn: randi(240, 360), treatIn: randi(120, 220),
      combo: 0, comboTimer: 0, comboWindow: Math.round(COMBO_WINDOW * m.comboWindowMul), mult: Math.max(1, m.comboMin),
      mjolnirCd: 60, regenT: 0, shake: 0, flash: 0, dying: 0, textSlot: 0,
      stats: { dodged: 0, rock: 0, bush: 0, log: 0, perfect: 0, maxCombo: 0, maxMult: 1, smashed: 0, treats: 0, fish: 0, blocked: 0 },
    };
  }

  const comboMult = (n, m) => Math.max(m.comboMin, n >= 20 ? 10 : n >= 12 ? 5 : n >= 7 ? 3 : n >= 3 ? 2 : 1);
  const catBox = (c) => ({ x: c.x - 9, y: c.y - 18, w: 20, h: 16 });
  const obsBox = (o) => ({ x: o.x + o.ix, y: o.y + o.iy, w: o.w - o.ix * 2, h: o.h - o.iy - 1 });

  // ---------- Spawning ----------

  function makeObstacle(kind, x) {
    let spr, roll = 0, ix = 4, iy = 4;
    if (kind === 'rock') spr = pick(art.rocks);
    else if (kind === 'smallrock') { spr = art.rocks[0]; kind = 'rock'; }
    else if (kind === 'bush') { spr = pick(art.bushes); iy = 5; }
    else if (kind === 'log') { spr = art.log; iy = 3; }
    else { spr = art.logDisc; roll = rand(1.2, 2); ix = 4; iy = 4; }
    return {
      kind, spr, x, y: GROUND_Y + 1 - (spr.height - 2), w: spr.width, h: spr.height,
      ix, iy, roll, rot: 0, passed: false, hit: false, dead: false, minClear: Infinity,
    };
  }

  function spawnObstacle(r) {
    const kinds = r.d.id === 'easy' ? ['rock', 'rock', 'bush', 'bush', 'log'] : ['rock', 'rock', 'bush', 'bush', 'log', 'roll'];
    const kind = r.demo ? pick(['rock', 'bush', 'log']) : pick(kinds);
    // Rolling logs travel faster than the ground, so they start further out to keep the gap fair.
    const x = W + 10 + (kind === 'roll' ? 150 : 0);
    const first = makeObstacle(kind, x);
    r.obstacles.push(first);
    let last = first;
    if (!r.demo && (kind === 'rock' || kind === 'bush') && Math.random() < r.d.cluster) {
      last = makeObstacle(pick(['smallrock', 'bush']), x + first.w + randi(0, 10));
      r.obstacles.push(last);
      if (r.d.id === 'intense' && Math.random() < 0.3) {
        last = makeObstacle('smallrock', last.x + last.w + randi(0, 6));
        r.obstacles.push(last);
      }
    }
    if (!r.demo && kind !== 'roll' && Math.random() < 0.45) {
      const cx = (first.x + last.x + last.w) / 2;
      for (let i = -2; i <= 2; i++) {
        r.treats.push({ x: cx + i * 16, y: GROUND_Y - 30 - 52 * (1 - (i / 2.6) ** 2), dead: false });
      }
    }
  }

  function spawnTreatRow(r) {
    if (r.obstacles.some((o) => o.x > W - 120)) return false;
    const y = Math.random() < 0.5 ? GROUND_Y - 12 : GROUND_Y - 62;
    for (let i = 0; i < 4; i++) r.treats.push({ x: W + 20 + i * 18, y, dead: false });
    return true;
  }

  function spawnPickup(r) {
    const type = weighted(r.d.puWeights);
    r.pickups.push({ type, x: W + 20, y: rand(80, 126), bob: rand(0, 6), mag: false, dead: false });
  }

  // ---------- Effects ----------

  function burst(r, x, y, n, colors, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2) : Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 2) * rand(0.4, 1.2);
      const life = Math.round((o.life ?? 30) * rand(0.7, 1.3));
      r.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g ?? 0.12, drag: o.drag ?? 0.98,
        life, max: life, size: o.size ?? (Math.random() < 0.3 ? 2 : 1), color: pick(colors), world: o.world ?? true,
      });
    }
    if (r.particles.length > 500) r.particles.splice(0, r.particles.length - 500);
  }

  function addText(r, text, color, o = {}) {
    const c = r.cat;
    const slot = r.textSlot++ % 3;
    const size = o.size ?? 8, half = (text.length * size) / 2 + 4;
    r.texts.push({
      text, color, size,
      x: clamp(o.x ?? c.x + 2, half, W - half),
      y: Math.max(12 + slot * 11, o.y ?? c.y - 36 - slot * 11),
      life: o.life ?? 55, max: o.life ?? 55,
    });
  }

  function dust(r, x, n) {
    burst(r, x, GROUND_Y - 1, n, ['#c9b49a', '#9a8670', '#e6d6bf'], { angle: -Math.PI / 2, spread: Math.PI * 0.9, speed: 1.4, g: 0.05, life: 22, size: 1 });
  }

  function makeBolt(tx, ty) {
    const pts = [[tx + rand(-30, 30), -4]];
    for (let i = 1; i < 8; i++) {
      const k = i / 8;
      pts.push([pts[0][0] + (tx - pts[0][0]) * k + rand(-9, 9), -4 + (ty + 4) * k]);
    }
    pts.push([tx, ty]);
    return { pts, life: 14 };
  }

  // ---------- Gameplay ----------

  function tryJump(r) {
    const c = r.cat, power = BASE_JUMP_POWER * r.m.jumpMul;
    if (c.onGround || c.coyote > 0) {
      c.vy = power;
      c.onGround = false;
      c.coyote = 0;
      c.jumps = 1;
      c.sx = 0.78;
      c.sy = 1.3;
      dust(r, c.x, 6);
      if (!r.demo) sfx.jump();
      return true;
    }
    // About to land: keep the press buffered so it becomes a full ground jump on touchdown.
    if (c.vy > 0 && c.y + c.vy * 4 >= GROUND_Y) return false;
    if (c.jumps < 2 + r.m.extraJumps) {
      c.jumps = Math.max(c.jumps, 1) + 1;
      c.vy = power * 0.9;
      c.sx = 0.85;
      c.sy = 1.2;
      burst(r, c.x, c.y - 2, 12, [skin().glow || '#ffffff', '#fff6a0', '#bfe6ff'], { angle: Math.PI / 2, spread: Math.PI * 1.2, speed: 1.8, g: 0.02, life: 18, world: false });
      if (!r.demo) sfx.doubleJump();
      return true;
    }
    return false;
  }

  function land(r, impact) {
    const c = r.cat, k = Math.min(impact * 0.028, 0.38);
    c.sx = 1 + k;
    c.sy = 1 - k;
    if (impact > 4) {
      dust(r, c.x - 4, Math.round(impact / 1.5));
      if (!r.demo) sfx.land();
    }
  }

  function dodge(r, o, label) {
    if (r.demo) return;
    const st = r.stats, prevMult = r.mult;
    st.dodged++;
    st[o.kind === 'roll' ? 'log' : o.kind]++;
    r.combo = r.comboTimer > 0 ? r.combo + 1 : 1;
    r.comboTimer = r.comboWindow;
    r.mult = comboMult(r.combo, r.m);
    st.maxCombo = Math.max(st.maxCombo, r.combo);
    st.maxMult = Math.max(st.maxMult, r.mult);

    let pts = 50 * r.mult * r.m.dodgeMul * r.scoreMul;
    const perfect = !label && o.minClear >= 0 && o.minClear <= 10;
    if (perfect) {
      pts += 100 * r.mult * r.scoreMul;
      st.perfect++;
      addText(r, 'PERFECT!', '#2ef5ff', { size: 9 });
      burst(r, r.cat.x, r.cat.y - 6, 10, ['#2ef5ff', '#ffffff'], { speed: 1.6, g: 0, life: 20, world: false });
    }
    if (label) addText(r, label, '#9fd8ff', { size: 9 });
    r.score += pts;
    addText(r, `+${Math.round(pts)} PTS`, '#ffd23f');
    if (r.mult > prevMult) {
      addText(r, `COMBO x${r.mult}!`, r.mult >= 5 ? '#ff4fa3' : '#ff9a3c', { size: 10, life: 70 });
      sfx.combo(r.mult);
    } else {
      sfx.dodge();
    }
  }

  function smash(r, o, label) {
    o.dead = true;
    r.stats.smashed++;
    const colors = o.kind === 'rock' ? ['#7b7f8c', '#a9adb9', '#4b4e5a', '#3f9a3a'] : o.kind === 'bush' ? ['#2f8a3c', '#5cc85a', '#b0708a'] : ['#6e4427', '#d9a566', '#8f5e36'];
    burst(r, o.x + o.w / 2, o.y + o.h / 2, 26, colors, { speed: 3.2, g: 0.18, life: 34, size: 2 });
    r.shake = Math.max(r.shake, 5);
    sfx.crush();
    dodge(r, o, label);
  }

  function hurt(r, o) {
    o.hit = true;
    const c = r.cat;
    if (r.shield > 0) {
      r.shield--;
      r.stats.blocked++;
      o.dead = true;
      r.invuln = 45;
      r.shake = 5;
      burst(r, c.x + 2, c.y - 12, 30, ['#2ef5ff', '#9fdcff', '#ffffff'], { speed: 3, g: 0.08, life: 30, size: 2, world: false });
      addText(r, 'BLOCKED!', '#2ef5ff', { size: 9 });
      sfx.shield();
      return;
    }
    r.lives--;
    r.shake = 10;
    r.flash = 6;
    r.combo = 0;
    r.comboTimer = 0;
    r.mult = comboMult(0, r.m);
    burst(r, c.x, c.y - 12, 22, ['#ff3b5c', '#ffd23f', '#ffffff'], { speed: 2.6, g: 0.12, life: 28, world: false });
    sfx.hit();
    if (r.lives > 0) {
      r.invuln = Math.round(90 * r.m.invulnMul);
      addText(r, 'OUCH!', '#ff3b5c', { size: 9 });
      return;
    }
    if (r.revive > 0) {
      r.revive--;
      r.lives = 1;
      r.invuln = 150;
      for (const ob of r.obstacles) if (ob.x < c.x + 220) ob.dead = true;
      burst(r, c.x, c.y - 12, 60, ['#ffd23f', '#fff6d0', '#ffb020'], { speed: 3.5, g: -0.02, life: 50, size: 2, world: false });
      addText(r, 'DIVINE REVIVE!', '#ffd23f', { size: 10, life: 90 });
      sfx.revive();
      return;
    }
    die(r);
  }

  function collect(r, p) {
    p.dead = true;
    const c = r.cat;
    if (p.type === 'shield') {
      if (r.shield < r.m.shieldCap) {
        r.shield++;
        addText(r, 'SHIELD!', '#2ef5ff', { size: 9 });
      } else {
        const pts = 100 * r.scoreMul;
        r.score += pts;
        addText(r, `+${Math.round(pts)} PTS`, '#ffd23f');
      }
      sfx.powerup();
    } else if (p.type === 'speed') {
      r.dash = r.dashMax = r.dashLen;
      addText(r, 'ROCKET DASH!', '#ffd23f', { size: 9 });
      sfx.dash();
      sfx.powerup();
    } else {
      const pts = 200 * r.m.fishMul;
      r.score += pts;
      r.stats.fish++;
      addText(r, `+${pts} GOLDEN FISH!`, '#ffd23f', { size: 9, life: 70 });
      for (let i = 0; i < 3; i++) r.fireworks.push({ at: r.t + i * 9, x: clamp(c.x + rand(-40, 120), 40, W - 40), y: rand(40, 90) });
      sfx.fish();
    }
    burst(r, p.x, p.y, 14, ['#ffffff', '#ffd23f', '#2ef5ff'], { speed: 2, g: 0, life: 20, world: false });
  }

  function die(r) {
    r.dying = 1;
    r.cat.vy = -7;
    r.cat.onGround = false;
    state = 'dying';
    sfx.gameOver();
  }

  function finishRun(r) {
    state = 'over';
    overAt = performance.now();
    const score = Math.floor(r.score);
    const prev = save.best[r.d.id] || 0;
    const record = score > prev && score > 0;
    if (record) {
      save.best[r.d.id] = score;
      persist();
      sfx.record();
    }
    const secs = Math.floor(r.t / 60);
    ui.showOver({
      score, best: Math.max(prev, score), record, difficulty: r.d, stats: r.stats,
      distance: r.dist / 24, time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
    });
  }

  // Attract mode: a simple autopilot that hops over whatever is coming.
  function autopilot(r) {
    const c = r.cat;
    demoInput.jumpPressed = false;
    if (demoInput.hold > 0) demoInput.hold--;
    demoInput.jumpHeld = demoInput.hold > 0;
    const next = r.obstacles.find((o) => o.x + o.w > c.x);
    if (next && c.onGround && next.x - (c.x + 11) < r.speed * 9 + 8) {
      demoInput.jumpPressed = true;
      demoInput.hold = 16;
      demoInput.jumpHeld = true;
    }
    return demoInput;
  }

  function update(r, inp) {
    r.t++;
    const c = r.cat, m = r.m, d = r.d;

    if (r.dying) {
      r.dying++;
      r.speed *= 0.95;
      r.dist += r.speed;
      c.vy += 0.45;
      c.y += c.vy;
      c.rot -= 0.18;
      stepEffects(r);
      if (r.dying > 75) finishRun(r);
      return;
    }

    // World speed ramps up over time.
    const base = r.demo ? d.speed : (d.speed + Math.min(d.ramp * r.t, d.maxAdd)) * m.worldSpeedMul;
    r.speed = base * (r.dash > 0 ? 1.75 : 1);
    r.dist += r.speed;
    if (!r.demo) r.score += r.speed * 0.1 * r.scoreMul;

    // Horizontal maneuvering
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    c.vx += (dir * BASE_MOVE_SPEED * m.moveMul - c.vx) * 0.35;
    if (r.dash > 0 && c.x < 300) c.x += 2.2;
    c.x = clamp(c.x + c.vx, 16, W - 60);

    // Jumping: buffer the press, then try every frame until it lands or expires.
    if (inp.jumpPressed) c.buffer = JUMP_BUFFER;
    if (c.buffer > 0) {
      if (tryJump(r)) c.buffer = 0;
      else c.buffer--;
    }
    if (!inp.jumpHeld && c.vy < JUMP_CUT) c.vy = JUMP_CUT;

    let g = GRAVITY;
    if (inp.down && !c.onGround) g *= 2.2;
    const gliding = m.glide && inp.jumpHeld && c.vy > 0 && !c.onGround;
    if (gliding) g *= 0.3;
    c.vy = Math.min(c.vy + g, gliding ? 2 : 14);
    const impact = c.vy;
    c.y += c.vy;
    if (c.y >= GROUND_Y) {
      c.y = GROUND_Y;
      if (!c.onGround) land(r, impact);
      c.vy = 0;
      c.onGround = true;
      c.jumps = 0;
      c.coyote = COYOTE_FRAMES;
    } else {
      c.onGround = false;
      if (c.coyote > 0) c.coyote--;
    }

    // Animation: squash/stretch recovery, run cycle, tail physics, blinks and ear twitches.
    c.sx += (1 - c.sx) * 0.2;
    c.sy += (1 - c.sy) * 0.2;
    if (c.onGround) c.phase += 0.2 + r.speed * 0.035 + Math.abs(c.vx) * 0.03;
    c.tailLag += (clamp(c.vy * 0.06, -0.7, 0.7) - c.tailLag) * 0.15;
    if (--c.blinkT <= 0) { c.blink = 7; c.blinkT = randi(110, 300); }
    if (c.blink > 0) c.blink--;
    if (--c.twitchT <= 0) { c.twitch = 9; c.twitchT = randi(120, 360); }
    if (c.twitch > 0) c.twitch--;
    if (r.t % 2 === 0) {
      c.trail.unshift({ x: c.x, y: c.y, phase: c.phase, air: !c.onGround, vy: c.vy, t: r.t });
      if (c.trail.length > 6) c.trail.pop();
    }
    for (const p of c.trail) p.x -= r.speed * 0.5;
    if (c.onGround && r.t % 7 === 0) dust(r, c.x - 8, 1);
    if (r.dash > 0) burst(r, c.x - 14, c.y - 10, 2, ['#ffd23f', '#ff9a3c', '#ff4fa3'], { angle: Math.PI, spread: 0.6, speed: 3, g: 0, life: 14, size: 2, world: false });

    // Spawning
    if (--r.spawnIn <= 0) {
      spawnObstacle(r);
      r.spawnIn = r.demo ? randi(80, 140) : randi(d.gap[0], d.gap[1]);
    }
    if (!r.demo) {
      if (--r.puIn <= 0) {
        spawnPickup(r);
        r.puIn = Math.round(randi(d.puEvery[0], d.puEvery[1]) / m.puFreqMul);
      }
      if (--r.treatIn <= 0) r.treatIn = spawnTreatRow(r) ? randi(160, 320) : 30;
    }

    // Movement
    for (const o of r.obstacles) {
      o.x -= r.speed + o.roll;
      if (o.roll) o.rot -= (r.speed + o.roll) / 9;
    }
    for (const p of r.pickups) { p.x -= r.speed; p.bob += 0.08; }
    for (const t of r.treats) t.x -= r.speed;
    if (m.magnet) {
      const cx = c.x + 2, cy = c.y - 12;
      for (const it of [...r.treats, ...r.pickups]) {
        const dx = cx - it.x, dy = cy - it.y, dd = Math.hypot(dx, dy);
        if (dd < 120 && dd > 1) {
          const pull = Math.min(dd, 7);
          it.x += (dx / dd) * pull;
          it.y += (dy / dd) * pull;
          it.mag = true;
        }
      }
    }

    // Mjolnir: a thunderbolt crushes the next incoming rock.
    if (m.mjolnir && !r.demo) {
      if (r.mjolnirCd > 0) r.mjolnirCd--;
      else {
        const rock = r.obstacles.find((o) => !o.dead && !o.passed && o.kind === 'rock' && o.x > c.x + 30 && o.x < c.x + 230);
        if (rock) {
          r.bolts.push(makeBolt(rock.x + rock.w / 2, rock.y + rock.h / 2));
          r.flash = 4;
          sfx.thunder();
          smash(r, rock, 'THUNDER!');
          r.mjolnirCd = 210;
        }
      }
    }

    // Obstacle collisions and dodges
    const hb = catBox(c);
    for (const o of r.obstacles) {
      if (o.dead) continue;
      const ob = obsBox(o);
      if (ob.x < hb.x + hb.w && ob.x + ob.w > hb.x) o.minClear = Math.min(o.minClear, ob.y - (hb.y + hb.h));
      if (!o.passed && !o.hit && !r.demo && overlap(hb, ob)) {
        if (r.dash > 0) smash(r, o, 'SMASH!');
        else if (r.invuln > 0) o.hit = true;   // passing through while blinking earns no dodge credit
        else hurt(r, o);
        if (state !== 'playing') return;
      }
      if (!o.passed && !o.dead && ob.x + ob.w < hb.x) {
        o.passed = true;
        if (!o.hit) dodge(r, o);
      }
    }
    r.obstacles = r.obstacles.filter((o) => !o.dead && o.x > -80);

    // Pickups and treats
    const cx = c.x + 2, cy = c.y - 12;
    if (!r.demo) {
      for (const p of r.pickups) {
        const py = p.mag ? p.y : p.y + Math.sin(p.bob) * 3;
        if (Math.hypot(cx - p.x, cy - py) < 18) collect(r, p);
      }
      for (const t of r.treats) {
        if (Math.hypot(cx - t.x, cy - t.y) < 14) {
          t.dead = true;
          const pts = 10 * r.mult * m.treatMul * r.scoreMul;
          r.score += pts;
          r.stats.treats++;
          burst(r, t.x, t.y, 5, ['#ff9a3c', '#ffd23f', '#ffffff'], { speed: 1.2, g: 0, life: 14, world: false });
          sfx.treat();
        }
      }
    }
    r.pickups = r.pickups.filter((p) => !p.dead && p.x > -30);
    r.treats = r.treats.filter((t) => !t.dead && t.x > -20);

    // Timers
    if (r.comboTimer > 0 && --r.comboTimer === 0) {
      if (r.combo >= 3) addText(r, 'COMBO LOST', '#a99bc4');
      r.combo = 0;
      r.mult = comboMult(0, m);
    }
    if (r.invuln > 0) r.invuln--;
    if (r.dash > 0 && --r.dash === 0) r.invuln = Math.max(r.invuln, 40);
    if (m.regen && r.lives < r.maxLives && ++r.regenT >= 2400) {
      r.regenT = 0;
      r.lives++;
      addText(r, '+1 LIFE', '#ff3b5c', { size: 9 });
      sfx.powerup();
    }
    stepEffects(r);
  }

  function stepEffects(r) {
    for (const p of r.particles) {
      p.x += p.vx - (p.world ? r.speed : 0);
      p.y += p.vy;
      p.vy += p.g;
      p.vx *= p.drag;
      p.life--;
    }
    r.particles = r.particles.filter((p) => p.life > 0);
    for (const t of r.texts) { t.y -= 0.45; t.life--; }
    r.texts = r.texts.filter((t) => t.life > 0);
    for (const b of r.bolts) b.life--;
    r.bolts = r.bolts.filter((b) => b.life > 0);
    for (const f of r.fireworks) {
      if (f.at <= r.t) {
        burst(r, f.x, f.y, 30, ['#ff4fa3', '#2ef5ff', '#ffd23f', '#5dff8a', '#ffffff'], { speed: 2.4, g: 0.035, drag: 0.97, life: 45, world: false });
        sfx.firework();
        f.done = true;
      }
    }
    r.fireworks = r.fireworks.filter((f) => !f.done);
    r.shake *= 0.85;
    if (r.flash > 0) r.flash--;
  }

  // ---------- Rendering ----------

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function tile(img, offset, y) {
    const o = Math.round(offset) % W;
    ctx.drawImage(img, -o, y);
    ctx.drawImage(img, W - o, y);
  }

  function drawBackground(r) {
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-12, -12, W + 24, GROUND_Y + 12);
    for (const s of art.stars) {
      const x = (((s.x - r.dist * 0.02) % W) + W) % W;
      const a = 0.3 + 0.7 * Math.abs(Math.sin(tick * s.sp + s.ph));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.c;
      ctx.fillRect(Math.round(x), s.y, s.s, s.s);
      if (s.s === 2 && a > 0.92) {
        ctx.fillRect(Math.round(x) - 1, s.y, 4, 1);
        ctx.fillRect(Math.round(x), s.y - 1, 1, 4);
      }
    }
    ctx.globalAlpha = 1;
    GD.Art.glow(ctx, 591, 41, 34, '#fff3c0', 0.35);
    ctx.drawImage(art.moon, 580, 30);
    tile(art.mountains, r.dist * 0.1, 0);
    tile(art.trees, r.dist * 0.35, 0);
    tile(art.ground, r.dist, 150);
  }

  function drawObstacle(o) {
    const x = Math.round(o.x), y = Math.round(o.y);
    ctx.drawImage(o.spr, x, y);
    if (o.kind === 'roll') {
      // Spinning notches show the log is rolling.
      const cx = x + o.w / 2, cy = y + o.h / 2;
      ctx.fillStyle = '#3a2210';
      for (let k = 0; k < 3; k++) {
        const a = o.rot + (k * Math.PI * 2) / 3;
        ctx.fillRect(Math.round(cx + Math.cos(a) * 6) - 1, Math.round(cy + Math.sin(a) * 6) - 1, 2, 2);
      }
    }
  }

  function drawPickup(p) {
    const y = p.mag ? p.y : p.y + Math.sin(p.bob) * 3;
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.15 + p.bob);
    const color = p.type === 'shield' ? '#2ef5ff' : p.type === 'speed' ? '#ffb020' : '#ffd23f';
    GD.Art.glow(ctx, p.x, y, 14 + pulse * 4, color, 0.45);
    const spr = p.type === 'shield' ? art.shieldOrb : p.type === 'speed' ? art.speedOrb : art.fish;
    ctx.drawImage(spr, Math.round(p.x - spr.width / 2), Math.round(y - spr.height / 2));
    if (p.type === 'fish' && Math.floor(tick / 8) % 3 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(p.x + 4), Math.round(y - 7), 1, 3);
      ctx.fillRect(Math.round(p.x + 3), Math.round(y - 6), 3, 1);
    }
  }

  function catState(c, r) {
    return {
      t: r.t, phase: c.phase, air: !c.onGround, vy: c.vy, sx: c.sx, sy: c.sy,
      blink: c.blink > 0, twitch: c.twitch > 0, tailLag: c.tailLag, rot: c.rot,
    };
  }

  function drawCatAndAura(r) {
    const c = r.cat, sk = skin();
    if (r.dash > 0 || sk.trail) {
      c.trail.forEach((p, i) => {
        if (i === 0) return;
        GD.Art.drawCat(ctx, sk, { t: p.t, phase: p.phase, air: p.air, vy: p.vy, alpha: (r.dash > 0 ? 0.3 : 0.18) * (1 - i / c.trail.length) }, p.x, p.y);
      });
    }
    if (r.dash > 0) {
      // Rocket flame
      const fl = Math.random() * 4;
      ctx.fillStyle = '#ff4fa3';
      ctx.fillRect(Math.round(c.x - 22 - fl), Math.round(c.y - 13), 8 + fl, 4);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(Math.round(c.x - 18 - fl / 2), Math.round(c.y - 12), 5 + fl / 2, 2);
      GD.Art.glow(ctx, c.x, c.y - 12, 26, '#ffd23f', 0.35);
    }
    const blinkOut = r.invuln > 0 && r.dash <= 0 && !r.dying && Math.floor(r.invuln / 4) % 2 === 0;
    if (!blinkOut) GD.Art.drawCat(ctx, sk, catState(c, r), c.x, c.y);
    if (r.shield > 0 && !r.dying) {
      const pulse = Math.sin(tick * 0.12) * 1.5;
      for (let i = 0; i < r.shield; i++) {
        ctx.globalAlpha = 0.55 - i * 0.15;
        ctx.strokeStyle = i ? '#b45cff' : '#2ef5ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x + 2, c.y - 12, 19 + i * 4 + pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawText(t) {
    const a = Math.min(1, t.life / 15);
    const pop = t.max - t.life < 6 ? 1 + (6 - (t.max - t.life)) * 0.06 : 1;
    ctx.globalAlpha = a;
    ctx.font = `${Math.round(t.size * pop)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#12041f';
    ctx.fillText(t.text, Math.round(t.x) + 1, Math.round(t.y) + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, Math.round(t.x), Math.round(t.y));
    ctx.globalAlpha = 1;
  }

  function render() {
    const r = run || demo;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05020a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (r.shake > 0.5 && state !== 'paused') ctx.translate(Math.round(rand(-1, 1) * r.shake), Math.round(rand(-1, 1) * r.shake));

    drawBackground(r);

    for (const t of r.treats) ctx.drawImage(art.treat, Math.round(t.x - 5), Math.round(t.y - 3 + Math.sin(tick * 0.1 + t.x * 0.05)));
    for (const p of r.pickups) drawPickup(p);
    for (const o of r.obstacles) drawObstacle(o);

    for (const b of r.bolts) {
      ctx.globalAlpha = b.life / 14;
      for (const [w, col] of [[4, '#2ef5ff'], [1.5, '#ffffff']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    drawCatAndAura(r);

    for (const p of r.particles) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    if (r.dash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 6; i++) {
        const y = (i * 37 + tick * 7) % (GROUND_Y - 10);
        ctx.fillRect((W - ((tick * 23 + i * 131) % (W + 80))), y, 40 + (i % 3) * 20, 1);
      }
    }
    for (const t of r.texts) drawText(t);
    ctx.restore();

    if (r.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${r.flash * 0.06})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Flow ----------

  function startGame() {
    sfx.unlock();
    ui.closeModal();
    run = newRun(false);
    state = 'playing';
    clearInput();
    ui.showScreen(null);
    if (run.m.startDash) addText(run, 'SOLAR DASH!', '#ffd23f', { size: 9 });
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    clearInput();
    ui.showScreen('pause');
  }

  function resume() {
    if (state !== 'paused') return;
    ui.closeModal();
    state = 'playing';
    ui.showScreen(null);
  }

  function toMenu() {
    ui.closeModal();
    state = 'menu';
    run = null;
    demo = newRun(true);
    ui.showScreen('start');
    ui.refreshStart();
  }

  function openModal(name) {
    if (state === 'playing') pause();
    if (state === 'dying') return;
    ui.showModal(ui.modalOpen() === name ? null : name);
    if (!ui.modalOpen()) ui.refreshStart();
  }

  function toggleMute() {
    save.muted = !save.muted;
    sfx.setMuted(save.muted);
    ui.setMuted(save.muted);
    persist();
  }

  const controller = {
    save,
    action(name) {
      if (name === 'start') startGame();
      else if (name === 'resume') resume();
      else if (name === 'pause') (state === 'paused' ? resume() : pause());
      else if (name === 'menu') toMenu();
      else if (name === 'skins') openModal('skins');
      else if (name === 'gear') openModal('gear');
      else if (name === 'closeModal') ui.closeModal();
      else if (name === 'mute') toggleMute();
    },
    setDifficulty(id) {
      save.difficulty = id;
      persist();
      ui.refreshStart();
    },
    setSkin(id) {
      save.skin = id;
      persist();
    },
    toggleItem(id) {
      const i = save.equipped.indexOf(id);
      if (i >= 0) save.equipped.splice(i, 1);
      else if (save.equipped.length < GD.MAX_SLOTS) save.equipped.push(id);
      persist();
    },
  };

  // ---------- Input ----------

  function clearInput() {
    input.left = input.right = input.down = input.jumpHeld = input.jumpPressed = false;
    document.querySelectorAll('.tbtn.active').forEach((b) => b.classList.remove('active'));
  }

  function pressJump() {
    if (state === 'playing') input.jumpPressed = true;
    input.jumpHeld = true;
  }

  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  };

  window.addEventListener('keydown', (e) => {
    sfx.unlock();
    const k = KEYS[e.code];
    if (k || e.code === 'Space') e.preventDefault();
    const modal = ui.modalOpen();

    if (e.code === 'Escape' && modal) { ui.closeModal(); return; }
    if (e.code === 'KeyC') { openModal('skins'); return; }
    if (e.code === 'KeyE') { openModal('gear'); return; }
    if (e.code === 'KeyM') { toggleMute(); return; }
    if (modal) return;

    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'playing') pause();
      else if (state === 'paused') resume();
      return;
    }
    if (e.code === 'Enter' || (k === 'jump' && !e.repeat)) {
      if (state === 'menu') { startGame(); return; }
      if (state === 'over' && performance.now() - overAt > 500) { startGame(); return; }
      if (state === 'paused' && e.code === 'Enter') { resume(); return; }
    }
    if (state === 'menu' && (k === 'left' || k === 'right') && !e.repeat) {
      const order = GD.DIFFICULTY_ORDER, i = order.indexOf(save.difficulty);
      controller.setDifficulty(order[(i + (k === 'right' ? 1 : order.length - 1)) % order.length]);
      sfx.click();
      return;
    }
    if (k === 'jump') { if (!e.repeat) pressJump(); }
    else if (k) input[k] = true;
  });

  window.addEventListener('keyup', (e) => {
    const k = KEYS[e.code];
    if (k === 'jump') input.jumpHeld = false;
    else if (k) input[k] = false;
  });

  // Touch / pointer buttons: act on pointerdown for zero delay, release on up/cancel.
  for (const btn of document.querySelectorAll('[data-key]')) {
    const key = btn.dataset.key;
    const release = () => {
      btn.classList.remove('active');
      if (key === 'jump') input.jumpHeld = false;
      else if (key !== 'pause') input[key] = false;
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sfx.unlock();
      btn.setPointerCapture?.(e.pointerId);
      btn.classList.add('active');
      if (key === 'jump') {
        if (state === 'menu' || (state === 'over' && performance.now() - overAt > 500)) startGame();
        else pressJump();
      } else if (key === 'pause') {
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
      } else input[key] = true;
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Tapping the game screen itself also jumps.
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sfx.unlock();
    if (state === 'playing') pressJump();
  });
  canvas.addEventListener('pointerup', () => { input.jumpHeld = false; });
  canvas.addEventListener('pointercancel', () => { input.jumpHeld = false; });

  const markTouch = () => document.body.classList.add('touch');
  if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) markTouch();
  window.addEventListener('touchstart', markTouch, { once: true, passive: true });

  window.addEventListener('blur', () => { pause(); clearInput(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); clearInput(); } });

  // ---------- Main loop (fixed 60 Hz physics, render every animation frame) ----------

  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(now - last, 100);
    last = now;
    while (acc >= STEP) {
      acc -= STEP;
      tick++;
      if (state === 'playing' || state === 'dying') {
        update(run, input);
        input.jumpPressed = false;
      } else if (state === 'menu') {
        update(demo, autopilot(demo));
      } else if (state === 'over') {
        run.t++;
        stepEffects(run);
      }
      if (ui.modalOpen() === 'skins') ui.drawSkinPreviews(tick);
    }
    ui.updateHud(run, save.best[run ? run.d.id : save.difficulty] || 0);
    render();
    requestAnimationFrame(frame);
  }

  sfx.setMuted(save.muted);
  ui.init(controller);
  ui.setMuted(save.muted);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  resize();
  if (document.fonts && document.fonts.load) document.fonts.load(`8px ${FONT}`);
  requestAnimationFrame(frame);
})();
