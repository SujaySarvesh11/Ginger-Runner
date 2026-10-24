// Ginger Dash: static game data (difficulties, cat skins, equipment).
(() => {
  const GD = window.GD = window.GD || {};

  // gap: frames between obstacle spawns. puEvery: frames between power-ups.
  GD.DIFFICULTIES = {
    easy:    { id: 'easy',    label: 'EASY',    mult: 1, speed: 4.2, ramp: 0.0006, maxAdd: 2.0, gap: [80, 130], cluster: 0,    puEvery: [380, 560], puWeights: { shield: 5, speed: 2, fish: 3 }, color: '#5dff8a' },
    normal:  { id: 'normal',  label: 'NORMAL',  mult: 2, speed: 5.2, ramp: 0.0008, maxAdd: 2.8, gap: [62, 110], cluster: 0.12, puEvery: [520, 780], puWeights: { shield: 3, speed: 3, fish: 3 }, color: '#2ef5ff' },
    hard:    { id: 'hard',    label: 'HARD',    mult: 3, speed: 6.4, ramp: 0.0010, maxAdd: 3.2, gap: [52, 94],  cluster: 0.32, puEvery: [600, 900], puWeights: { shield: 2, speed: 3, fish: 3 }, color: '#ffb347' },
    intense: { id: 'intense', label: 'INTENSE', mult: 5, speed: 8.2, ramp: 0.0012, maxAdd: 3.6, gap: [46, 82],  cluster: 0.4,  puEvery: [240, 400], puWeights: { shield: 3, speed: 4, fish: 4 }, color: '#ff4fa3' },
  };
  GD.DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'intense'];

  GD.SKINS = [
    {
      id: 'ginger', name: 'GINGER', sub: 'Classic Tabby',
      desc: 'Orange tabby stripes, cream belly, russet whiskers and white paws.',
      fur: '#f28a2e', furDark: '#c4561a', furLight: '#ffb866', belly: '#ffe7c2', paws: '#ffffff',
      stripe: '#b8461a', earIn: '#ff9fb0', eye: '#7ed957', pupil: '#1a1a1a', nose: '#e8637a',
      whisker: '#8a3a1a', outline: '#3a1a0e', pattern: 'tabby',
    },
    {
      id: 'midnight', name: 'MIDNIGHT', sub: 'Void Panther',
      desc: 'Sleek void-black fur and piercing glowing amber eyes.',
      fur: '#1d1d2a', furDark: '#0e0e16', furLight: '#3a3a52', belly: '#24243a', paws: '#16161f',
      stripe: '#282838', earIn: '#4a2f45', eye: '#ffc21a', eyeGlow: '#ffb000', pupil: '#000000', nose: '#3a2a35',
      whisker: '#6b6b80', outline: '#000000', pattern: 'solid',
    },
    {
      id: 'snowball', name: 'SNOWBALL', sub: 'Turkish Angora',
      desc: 'Fluffy white coat, electric blue eyes and a soft pink nose.',
      fur: '#f4f5fb', furDark: '#d3d6e6', furLight: '#ffffff', belly: '#ffffff', paws: '#ffffff',
      stripe: '#e4e6f2', earIn: '#ffb3c7', eye: '#2fb8ff', eyeGlow: '#4fd0ff', pupil: '#0a1a3a', nose: '#ff8fb1',
      whisker: '#b8bbd0', outline: '#4f5470', pattern: 'fluffy',
    },
    {
      id: 'calico', name: 'CALICO', sub: 'Lucky Tri-Color',
      desc: 'Japanese tri-color patchwork of cream, orange and black with warm amber eyes.',
      fur: '#fbf3e4', furDark: '#d9cbb2', furLight: '#ffffff', belly: '#ffffff', paws: '#ffffff',
      stripe: '#e8862e', patchA: '#e8862e', patchB: '#2a2220', earIn: '#ff9fb0', eye: '#ffb020', pupil: '#2a1500',
      nose: '#e8637a', whisker: '#8a7a6a', outline: '#3a2a1e', pattern: 'calico',
    },
    {
      id: 'neon', name: 'CHESHIRE', sub: 'Neon Synthwave',
      desc: 'Glowing purple and neon cyan fur that leaves a radiant trail.',
      fur: '#7b2cff', furDark: '#4a12b0', furLight: '#a86bff', belly: '#c39bff', paws: '#2ef5ff',
      stripe: '#2ef5ff', earIn: '#ff4fd8', eye: '#2ef5ff', eyeGlow: '#2ef5ff', pupil: '#ffffff', nose: '#ff4fd8',
      whisker: '#2ef5ff', outline: '#1a0638', pattern: 'neon', glow: '#2ef5ff', trail: true,
    },
  ];

  GD.TIERS = [
    { id: 'common', label: 'COMMON' },
    { id: 'rare', label: 'RARE' },
    { id: 'epic', label: 'EPIC' },
    { id: 'legendary', label: 'LEGENDARY' },
    { id: 'mythic', label: 'MYTHIC' },
  ];
  GD.MAX_SLOTS = 3;

  GD.ITEMS = [
    // Common
    { id: 'caligae', name: 'Roman Caligae', tier: 'common', icon: '🥾', lore: 'Hobnailed legionary sandals built for forced marches.', effect: '+15% run speed', mods: { moveMul: 1.15 } },
    { id: 'celtic', name: 'Celtic Knot Charm', tier: 'common', icon: '🍀', lore: 'An endless knot that keeps momentum flowing.', effect: 'Combo timer lasts 30% longer', mods: { comboWindowMul: 1.3 } },
    { id: 'scarab', name: 'Scarab Amulet', tier: 'common', icon: '🪲', lore: 'Khepri rolls good fortune your way.', effect: 'Fish treats are worth 2x', mods: { treatMul: 2 } },
    { id: 'rune', name: 'Norse Rune Shard', tier: 'common', icon: '🪨', lore: 'Carved with Raidho, the rune of the journey.', effect: '+6% jump height', mods: { jumpMul: 1.03 } },
    { id: 'bell', name: 'Maneki-Neko Bell', tier: 'common', icon: '🔔', lore: 'The beckoning cat calls luck a little closer.', effect: 'Power-ups appear 25% more often', mods: { puFreqMul: 1.25 } },
    // Rare
    { id: 'talaria', name: "Hermes' Talaria", tier: 'rare', icon: '👡', lore: 'Winged sandals of the messenger of Olympus.', effect: '+1 air jump (triple jump)', mods: { extraJumps: 1 } },
    { id: 'huginn', name: "Huginn's Feather", tier: 'rare', icon: '🪶', lore: "A quill from Odin's raven of thought.", effect: 'Hold JUMP while falling to glide', mods: { glide: true } },
    { id: 'fleece', name: 'Golden Fleece', tier: 'rare', icon: '🐑', lore: 'The shimmering prize of the Argonauts.', effect: '+1 max life (4 hearts)', mods: { maxLivesAdd: 1 } },
    { id: 'pyxis', name: "Pandora's Pyxis", tier: 'rare', icon: '🏺', lore: 'Hope was the last thing inside. Also fish.', effect: 'Golden Fish bonus doubled', mods: { fishMul: 2 } },
    { id: 'helm', name: 'Trojan Bronze Helm', tier: 'rare', icon: '⛑️', lore: "Hector's crest still gleams on the plain.", effect: '+60% invulnerability after a hit', mods: { invulnMul: 1.6 } },
    // Epic
    { id: 'horus', name: 'Eye of Horus', tier: 'epic', icon: '👁️', lore: 'The all-seeing wedjat draws blessings near.', effect: 'Magnet: auto-collects nearby treats and power-ups', mods: { magnet: true } },
    { id: 'mjolnir', name: 'Mjolnir Pendant', tier: 'epic', icon: '🔨', lore: 'A sliver of the storm-hammer of Thor.', effect: 'Thunder blast crushes incoming rocks (3.5s cooldown)', mods: { mjolnir: true } },
    { id: 'amaterasu', name: 'Amaterasu Mirror', tier: 'epic', icon: '🪞', lore: 'Yata no Kagami, which lured the sun from her cave.', effect: 'Invincible dash lasts 75% longer', mods: { dashMul: 1.75 } },
    { id: 'aegis', name: 'Aegis of Athena', tier: 'epic', icon: '🛡️', lore: "The goddess's own reinforced war-shield.", effect: 'Hold up to 2 shields at once', mods: { shieldCap: 2 } },
    { id: 'chronos', name: 'Hourglass of Chronos', tier: 'epic', icon: '⏳', lore: 'Sand stolen from the titan of time.', effect: 'World scrolls 12% slower', mods: { worldSpeedMul: 0.88 } },
    // Legendary
    { id: 'excalibur', name: 'Excalibur Scabbard', tier: 'legendary', icon: '🗡️', lore: 'Whoever wears it shall lose no blood.', effect: '+1 Divine Revive: survive one fatal hit', mods: { revive: 1 } },
    { id: 'philosopher', name: "Philosopher's Stone", tier: 'legendary', icon: '🔴', lore: 'The alchemist’s dream: turns every step to gold.', effect: '+50% score multiplier', mods: { scoreMul: 1.5 } },
    { id: 'gungnir', name: 'Gungnir Spearhead', tier: 'legendary', icon: '🔱', lore: 'The spear that never misses its mark.', effect: 'Dodge bonus points doubled', mods: { dodgeMul: 2 } },
    { id: 'grail', name: 'Holy Grail', tier: 'legendary', icon: '🏆', lore: 'The cup of endless renewal.', effect: 'Regenerate 1 heart every 40 seconds', mods: { regen: true } },
    // Mythic
    { id: 'ouroboros', name: 'Ouroboros Ring', tier: 'mythic', icon: '💍', lore: 'The serpent that devours its own tail, forever.', effect: 'Combo never drops below x2; combo timer x2', mods: { comboMin: 2, comboWindowMul: 2 } },
    { id: 'ra', name: 'Crown of Ra', tier: 'mythic', icon: '👑', lore: 'Worn by the sun god on his daily voyage.', effect: 'Start with a shield and a 3s solar dash; +25% score', mods: { startShield: true, startDash: true, scoreMul: 1.25 } },
  ];

  // Folds the equipped items into one modifier object.
  GD.computeMods = (ids) => {
    const m = {
      moveMul: 1, jumpMul: 1, extraJumps: 0, glide: false, maxLivesAdd: 0, comboWindowMul: 1, comboMin: 1,
      treatMul: 1, puFreqMul: 1, fishMul: 1, invulnMul: 1, magnet: false, mjolnir: false, dashMul: 1,
      shieldCap: 1, worldSpeedMul: 1, revive: 0, scoreMul: 1, dodgeMul: 1, regen: false,
      startShield: false, startDash: false,
    };
    for (const id of ids) {
      const item = GD.ITEMS.find((i) => i.id === id);
      if (!item) continue;
      for (const [k, v] of Object.entries(item.mods)) {
        if (typeof v === 'boolean') m[k] = m[k] || v;
        else if (k.endsWith('Mul')) m[k] *= v;
        else if (k === 'comboMin' || k === 'shieldCap') m[k] = Math.max(m[k], v);
        else m[k] += v;
      }
    }
    return m;
  };
})();
