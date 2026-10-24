// Ginger Dash: DOM screens, HUD, and the skin / armory modals.
(() => {
  const GD = window.GD;
  const $ = (s) => document.querySelector(s);

  const HEART_SVG = '<svg viewBox="0 0 7 6" shape-rendering="crispEdges"><path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/></svg>';
  const SCREENS = { start: $('#screen-start'), pause: $('#screen-pause'), over: $('#screen-over') };
  const MODALS = { skins: $('#modal-skins'), gear: $('#modal-gear') };
  const hud = {
    hearts: $('#hud-hearts'), score: $('#hud-score'), best: $('#hud-best'), combo: $('#hud-combo'),
    mult: $('#hud-mult'), fill: $('#hud-combo-fill'), powers: $('#hud-powers'), mute: $('#btn-mute'),
  };
  const cache = {};
  let ctrl = null, openModal = null, gearTab = 'all', previews = [];

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');

  function init(controller) {
    ctrl = controller;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      GD.Sfx.click();
      btn.blur();
      ctrl.action(btn.dataset.action);
    });
    buildDifficulty();
    buildSkins();
    $('#gear-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (!tab) return;
      GD.Sfx.click();
      gearTab = tab.dataset.tab;
      renderGear();
    });
    $('#item-grid').addEventListener('click', onItemClick);
    $('#loadout').addEventListener('click', onItemClick);
    refreshStart();
    renderGear();
    setMuted(GD.Sfx.isMuted());
  }

  function onItemClick(e) {
    const btn = e.target.closest('[data-item]');
    if (!btn || btn.disabled) return;
    GD.Sfx.click();
    ctrl.toggleItem(btn.dataset.item);
    renderGear();
    refreshStart();
  }

  // ---------- Screens ----------

  function showScreen(name) {
    for (const [k, el] of Object.entries(SCREENS)) el.classList.toggle('show', k === name);
  }

  function showModal(name) {
    openModal = name;
    for (const [k, el] of Object.entries(MODALS)) el.classList.toggle('show', k === name);
    if (name === 'gear') renderGear();
    if (name === 'skins') renderSkinSelection();
  }

  function closeModal() {
    showModal(null);
    refreshStart();
  }

  // ---------- Start screen ----------

  function buildDifficulty() {
    const grid = $('#diff-grid');
    grid.innerHTML = GD.DIFFICULTY_ORDER.map((id) => {
      const d = GD.DIFFICULTIES[id];
      return `<button class="diff-btn" data-diff="${id}" style="--c:${d.color}"><span>${d.label}</span><span class="mult">${d.mult}x</span></button>`;
    }).join('');
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-diff]');
      if (!btn) return;
      GD.Sfx.click();
      ctrl.setDifficulty(btn.dataset.diff);
    });
  }

  function refreshStart() {
    const save = ctrl.save;
    for (const btn of document.querySelectorAll('.diff-btn')) btn.classList.toggle('selected', btn.dataset.diff === save.difficulty);
    $('#score-table').innerHTML = GD.DIFFICULTY_ORDER.map((id) => {
      const d = GD.DIFFICULTIES[id];
      return `<div style="--c:${d.color}">${d.label}<b>${fmt(save.best[id] || 0)}</b></div>`;
    }).join('');
    const skin = GD.SKINS.find((s) => s.id === save.skin);
    const gear = save.equipped.map((id) => GD.ITEMS.find((i) => i.id === id).icon).join(' ') || 'NONE';
    $('#start-meta').innerHTML = `<span>CAT: <b>${esc(skin.name)}</b></span><span>GEAR: <b>${gear}</b></span>`;
  }

  // ---------- HUD ----------

  // Writes only when a value changed, so the per-frame call stays cheap.
  function set(key, el, prop, value) {
    if (cache[key] === value) return;
    cache[key] = value;
    if (prop === 'width') el.style.width = value;
    else el[prop] = value;
  }

  function updateHud(r, best) {
    const lives = r ? r.lives : 3, max = r ? r.maxLives : 3;
    const heartsKey = `${lives}/${max}`;
    if (cache.hearts !== heartsKey) {
      const prev = cache.heartsLives;
      hud.hearts.innerHTML = Array.from({ length: max }, (_, i) => {
        const cls = i < lives ? 'heart' : 'heart empty';
        const pop = prev !== undefined && (i === lives - 1 && lives > prev || i === lives && lives < prev) ? ' pop' : '';
        return `<span class="${cls}${pop}">${HEART_SVG}</span>`;
      }).join('');
      cache.hearts = heartsKey;
      cache.heartsLives = lives;
    }
    set('score', hud.score, 'textContent', fmt(r ? r.score : 0));
    set('best', hud.best, 'textContent', fmt(Math.max(best, r ? r.score : 0)));

    const mult = r ? r.mult : 1;
    set('mult', hud.mult, 'textContent', `x${mult}`);
    const pct = r && r.comboTimer > 0 ? Math.round((r.comboTimer / r.comboWindow) * 100) : 0;
    set('fill', hud.fill, 'width', `${pct}%`);
    set('comboCls', hud.combo, 'className', `hud-block combo${mult >= 5 ? ' hot blaze' : mult >= 3 ? ' hot' : ''}`);

    // Power-up chips: rebuilt when the set changes, timers updated in place.
    const chips = [];
    if (r) {
      if (r.shield > 0) chips.push(['shield', '🛡️', `x${r.shield}`, null]);
      if (r.revive > 0) chips.push(['revive', '✝', `x${r.revive}`, null]);
      if (r.dash > 0) chips.push(['dash', '⚡', (r.dash / 60).toFixed(1), r.dash / r.dashMax]);
      if (r.m.mjolnir) chips.push([r.mjolnirCd > 0 ? 'thunder cool' : 'thunder', '🔨', r.mjolnirCd > 0 ? (r.mjolnirCd / 60).toFixed(1) : 'RDY', null]);
    }
    const key = chips.map((c) => c[0]).join(',');
    if (cache.chipKey !== key) {
      cache.chipKey = key;
      hud.powers.innerHTML = chips.map((c) => `<div class="chip chip-${c[0]}"><span>${c[1]}</span><b></b><i></i></div>`).join('');
      cache.chipVals = [];
    }
    chips.forEach((c, i) => {
      const el = hud.powers.children[i];
      if (!el || cache.chipVals[i] === c[2]) return;
      cache.chipVals[i] = c[2];
      el.querySelector('b').textContent = c[2];
      el.querySelector('i').style.width = c[3] === null ? '0' : `${Math.round(c[3] * 100)}%`;
    });
  }

  function setMuted(m) {
    hud.mute.textContent = m ? '🔇' : '🔊';
  }

  // ---------- Game over ----------

  function showOver(sum) {
    $('#over-record').classList.toggle('show', sum.record);
    $('#over-score').textContent = fmt(sum.score);
    $('#over-best').textContent = fmt(sum.best);
    $('#over-diff').textContent = `${sum.difficulty.label} MODE · ${sum.difficulty.mult}x SCORE`;
    const s = sum.stats;
    const rows = [
      ['DISTANCE', `${fmt(sum.distance)}M`],
      ['TIME', sum.time],
      ['DODGED', s.dodged],
      ['ROCKS', s.rock],
      ['BUSHES', s.bush],
      ['LOGS', s.log],
      ['PERFECT', s.perfect],
      ['MAX COMBO', `${s.maxCombo} (x${s.maxMult})`],
      ['SMASHED', s.smashed],
      ['TREATS', s.treats],
      ['GOLD FISH', s.fish],
      ['SHIELD SAVES', s.blocked],
    ];
    $('#over-stats').innerHTML = rows.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
    showScreen('over');
  }

  // ---------- Skins ----------

  function buildSkins() {
    const grid = $('#skin-grid');
    grid.innerHTML = GD.SKINS.map((s) => `
      <button class="skin-card" data-skin="${s.id}">
        <canvas width="120" height="80"></canvas>
        <span class="skin-name">${esc(s.name)}</span>
        <span class="skin-sub">${esc(s.sub)}</span>
        <span class="skin-desc">${esc(s.desc)}</span>
        <span class="skin-tag"></span>
      </button>`).join('');
    previews = [...grid.querySelectorAll('canvas')].map((c) => {
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      return g;
    });
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-skin]');
      if (!card) return;
      GD.Sfx.powerup();
      ctrl.setSkin(card.dataset.skin);
      renderSkinSelection();
    });
  }

  function renderSkinSelection() {
    for (const card of document.querySelectorAll('.skin-card')) {
      const sel = card.dataset.skin === ctrl.save.skin;
      card.classList.toggle('selected', sel);
      card.querySelector('.skin-tag').textContent = sel ? '★ SELECTED' : 'SELECT';
    }
  }

  // Animated preview cards: each cat runs in place and hops now and then.
  function drawSkinPreviews(t) {
    if (openModal !== 'skins') return;
    GD.SKINS.forEach((skin, i) => {
      const g = previews[i];
      g.setTransform(2, 0, 0, 2, 0, 0);
      g.clearRect(0, 0, 60, 40);
      g.fillStyle = '#2e8b3a';
      g.fillRect(0, 36, 60, 4);
      g.fillStyle = '#62d35e';
      g.fillRect(0, 36, 60, 1);
      const hop = (t + i * 37) % 160;
      const air = hop < 28;
      const lift = air ? Math.sin((hop / 28) * Math.PI) * 9 : 0;
      if (skin.trail) {
        for (let k = 3; k >= 1; k--) {
          GD.Art.drawCat(g, skin, { t: t - k * 3, phase: (t - k * 3) * 0.3, air, vy: hop < 14 ? -1 : 1, alpha: 0.12 * (4 - k) }, 26 - k * 5, 37 - lift);
        }
      }
      GD.Art.drawCat(g, skin, {
        t, phase: t * 0.3, air, vy: hop < 14 ? -1 : 1,
        sx: hop === 28 || hop === 29 ? 1.2 : 1, sy: hop === 28 || hop === 29 ? 0.8 : 1,
        blink: (t + i * 50) % 200 < 8, twitch: (t + i * 70) % 260 < 10, tailLag: air ? (hop < 14 ? -0.4 : 0.4) : 0,
      }, 26, 37 - lift);
    });
  }

  // ---------- Armory ----------

  function renderGear() {
    const save = ctrl.save;
    const full = save.equipped.length >= GD.MAX_SLOTS;

    const slots = [];
    for (let i = 0; i < GD.MAX_SLOTS; i++) {
      const item = GD.ITEMS.find((it) => it.id === save.equipped[i]);
      slots.push(item
        ? `<button class="slot filled tier-${item.tier}" data-item="${item.id}" title="Unequip"><span class="slot-icon">${item.icon}</span>${esc(item.name)}</button>`
        : '<div class="slot"><span class="slot-icon">·</span>EMPTY SLOT</div>');
    }
    $('#loadout').innerHTML = `<span class="loadout-label">LOADOUT ${save.equipped.length}/${GD.MAX_SLOTS}</span>${slots.join('')}`;

    const tabs = [{ id: 'all', label: 'ALL' }, ...GD.TIERS];
    $('#gear-tabs').innerHTML = tabs.map((t) => {
      const n = t.id === 'all' ? GD.ITEMS.length : GD.ITEMS.filter((i) => i.tier === t.id).length;
      return `<button class="tab tier-${t.id} ${gearTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label} ${n}</button>`;
    }).join('');

    const items = GD.ITEMS.filter((i) => gearTab === 'all' || i.tier === gearTab);
    $('#item-grid').innerHTML = items.map((item) => {
      const on = save.equipped.includes(item.id);
      const label = on ? 'UNEQUIP' : full ? 'SLOTS FULL' : 'EQUIP';
      const tier = GD.TIERS.find((t) => t.id === item.tier).label;
      return `
        <div class="item-card tier-${item.tier} ${on ? 'equipped' : ''}">
          <div class="item-icon">${item.icon}</div>
          <div><div class="item-name">${esc(item.name)}</div><div class="item-tier">${tier}${on ? ' · EQUIPPED' : ''}</div></div>
          <p class="item-lore">${esc(item.lore)}</p>
          <p class="item-effect">▸ ${esc(item.effect)}</p>
          <button class="btn btn-small" data-item="${item.id}" ${!on && full ? 'disabled' : ''}>${label}</button>
        </div>`;
    }).join('');
  }

  GD.UI = {
    init, showScreen, showModal, closeModal, refreshStart, updateHud, showOver, setMuted, drawSkinPreviews,
    modalOpen: () => openModal,
  };
})();
