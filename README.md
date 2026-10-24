# Ginger Dash

A retro 8-bit endless runner starring a cat. It runs on HTML5 Canvas and vanilla JS, with no build step and no dependencies. All pixel art and sound effects are generated in code.

## Run locally

Open `index.html` in a modern desktop or mobile browser. It works straight from the file system. The only network request is the Google Font *Press Start 2P*.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `←` `→` / `A` `D` | ◀ ▶ |
| Jump / double jump (hold for height) | `Space` / `↑` / `W` | JUMP or tap the screen |
| Fast fall | `↓` / `S` | |
| Pause | `P` / `Esc` | PAUSE |
| Skins / Gear | `C` / `E` | menu buttons |
| Mute | `M` | 🔊 button |

## Features

- **Fixed 60 Hz physics**: gravity, variable-height jumps, double jump, a 6-frame jump buffer and 5-frame coyote time.
- **Combo system**: chain dodges within about 2.8s to climb x1 → x2 → x3 → x5 → x10. Near-miss clears score `PERFECT!`.
- **Four difficulties**: Easy 1x, Normal 2x, Hard 3x, Intense 5x. Each keeps its own high score.
- **Five cat skins**: Ginger, Midnight, Snowball, Calico and Cheshire. Each has a procedural walk cycle, tail physics, blinks, ear twitches, and squash and stretch.
- **21 mythic items** in five rarity tiers, with up to 3 equipped at once.
- **Obstacles**: rocks, briar bushes, fallen logs and rolling logs. Hitboxes are generous so near misses feel fair.
- **Power-ups**: Shield, Rocket Dash (invincible) and Golden Fish (+200 with fireworks), plus collectible fish treats.
- Progress (high scores, skin, loadout, mute) is saved in `localStorage`.

## Structure

- `index.html`: page shell, HUD, screens and modals
- `css/style.css`: neon arcade-cabinet styling and responsive layout
- `js/data.js`: difficulties, skins and equipment data
- `js/audio.js`: Web Audio 8-bit sound synthesizer
- `js/sprites.js`: procedural pixel-art sprites, scenery and the cat renderer
- `js/ui.js`: DOM screens, HUD, skin selector and armory
- `js/game.js`: game loop, physics, spawning, collisions, rendering and input
- `assets/`: reserved for hand-made art and audio (currently unused)
