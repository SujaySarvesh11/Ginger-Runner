# Ginger Dash: Images Needed

The game currently draws all of its art in code (`js/sprites.js`). These images will replace that art. Any image that's missing keeps the drawn version, so you can add them a few at a time.

## Rules for every image

- **Format:** PNG with a transparent background.
- **Style:** hard pixel edges, no anti-aliasing, blur or soft shadows.
- **Scale:** sizes below are in the game's 720×200 scale. Draw at exactly that size, or at exactly 2× or 4×.
- **Placement:** characters face **right** and sit on the **bottom edge** of the frame (the ground line).
- **Sprite sheets:** one horizontal row per animation, with every frame the same size and no gaps between frames.

---

## 1. Cat characters (highest priority)

Folder: `assets/images/characters/`

One sprite sheet per skin, with every frame **40×32 px** (the cat itself is about 34×28 px).

| Skin | File | Look |
|---|---|---|
| Ginger | `ginger.png` | Orange tabby stripes, cream belly, russet whiskers, white paws, green eyes |
| Midnight | `midnight.png` | Void-black panther, glowing amber/gold eyes |
| Snowball | `snowball.png` | Fluffy white Turkish Angora, electric blue eyes, pink nose |
| Calico | `calico.png` | Cream, orange and black patches; warm amber eyes |
| Cheshire | `cheshire.png` | Purple fur, neon cyan stripes and paws, glowing look |

Animations in each sheet:

| Row | Animation | Frames | Notes |
|---|---|---|---|
| 1 | Run | 6–8 | Loops smoothly; tail swing is part of the drawing |
| 2 | Jump (rising) | 1–2 | Stretched body, legs tucked |
| 3 | Fall | 1–2 | Legs reaching down |
| 4 | Land | 1 | Squashed |
| 5 | Idle / blink | 2–4 | Used on the skin picker cards |
| 6 | Hurt | 1 | |
| 7 | Knocked out | 1 | For the game-over tumble |

- [ ] ginger.png
- [ ] midnight.png
- [ ] snowball.png
- [ ] calico.png
- [ ] cheshire.png

---

## 2. Obstacles

Folder: `assets/images/obstacles/`

| Obstacle | File | Size (px) | Notes |
|---|---|---|---|
| Rock, small | `rock-1.png` | 22×18 | Jagged mossy boulder |
| Rock, medium | `rock-2.png` | 26×22 | |
| Rock, large | `rock-3.png` | 30×24 | |
| Briar bush A | `bush-1.png` | 32×18 | Spiky thorns, a few red berries |
| Briar bush B | `bush-2.png` | 28×20 | |
| Fallen log | `log.png` | 46×14 | Lying sideways, bark and moss, cut end showing tree rings on the right |
| Rolling log | `log-roll.png` | 20×20 | Cut end seen face-on; optionally a 4–8 frame spin sheet |

- [ ] rock-1.png
- [ ] rock-2.png
- [ ] rock-3.png
- [ ] bush-1.png
- [ ] bush-2.png
- [ ] log.png
- [ ] log-roll.png

---

## 3. Power-ups and pickups

Folder: `assets/images/ui/`

| Item | File | Size (px) | Frames |
|---|---|---|---|
| Shield bubble | `pu-shield.png` | 16×16 | 1–4 (shimmer) |
| Speed boost (lightning) | `pu-speed.png` | 16×16 | 1–4 |
| Golden fish | `pu-fish.png` | 18×12 | 2–4 (sparkle) |
| Fish treat | `treat.png` | 10×7 | 1 |
| Heart (full + empty) | `heart.png` | 7×6 per frame | 2 |

- [ ] pu-shield.png
- [ ] pu-speed.png
- [ ] pu-fish.png
- [ ] treat.png
- [ ] heart.png

---

## 4. Equipment icons (21)

Folder: `assets/images/equipment/`

Each icon is **32×32 px** (16×16 also works). These replace the emoji, which look different on every device. Each file name is the item's ID from `js/data.js`.

| Tier | File | Item | Idea |
|---|---|---|---|
| Common | `caligae.png` | Roman Caligae | Hobnailed leather sandal |
| Common | `celtic.png` | Celtic Knot Charm | Green endless-knot pendant |
| Common | `scarab.png` | Scarab Amulet | Blue-gold Egyptian beetle |
| Common | `rune.png` | Norse Rune Shard | Grey stone with glowing rune |
| Common | `bell.png` | Maneki-Neko Bell | Gold bell on red collar |
| Rare | `talaria.png` | Hermes' Talaria | Winged sandal |
| Rare | `huginn.png` | Huginn's Feather | Black raven feather |
| Rare | `fleece.png` | Golden Fleece | Golden ram fleece |
| Rare | `pyxis.png` | Pandora's Pyxis | Small ornate jar |
| Rare | `helm.png` | Trojan Bronze Helm | Crested bronze helmet |
| Epic | `horus.png` | Eye of Horus | Wedjat eye, gold and lapis |
| Epic | `mjolnir.png` | Mjolnir Pendant | Hammer with lightning |
| Epic | `amaterasu.png` | Amaterasu Mirror | Round bronze sun mirror |
| Epic | `aegis.png` | Aegis of Athena | Round shield with Gorgon face |
| Epic | `chronos.png` | Hourglass of Chronos | Ornate hourglass |
| Legendary | `excalibur.png` | Excalibur Scabbard | Jeweled sword sheath |
| Legendary | `philosopher.png` | Philosopher's Stone | Glowing red crystal |
| Legendary | `gungnir.png` | Gungnir Spearhead | Rune-etched spear tip |
| Legendary | `grail.png` | Holy Grail | Golden chalice with light |
| Mythic | `ouroboros.png` | Ouroboros Ring | Snake eating its tail |
| Mythic | `ra.png` | Crown of Ra | Sun disc crown with cobra |

The card borders already glow in the tier colour, so the icons don't need their own frames.

---

## 5. Backgrounds (optional)

Folder: `assets/images/backgrounds/`

The current drawn scenery holds up reasonably well; replace it only for a consistent art style. Every layer is **720 px wide** and must repeat seamlessly from left to right.

| Layer | File | Size (px) | Scroll speed |
|---|---|---|---|
| Night sky + moon | `sky.png` | 720×158 | Static (stars twinkle in code) |
| Distant mountains | `mountains.png` | 720×158, transparent | 0.1× |
| Pine forest | `trees.png` | 720×158, transparent | 0.35× |
| Ground strip | `ground.png` | 720×50 | 1× (grass surface 8 px from the top) |
