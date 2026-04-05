# Scoundrel

A solo dungeon-crawl card game playable entirely in the browser — no installation, no dependencies, no build step required.

---

## Overview

Scoundrel is a turn-based survival game built on a standard card deck. You are a scoundrel venturing through a dungeon one room at a time. Each room presents four cards: monsters to fight, weapons to equip, and potions to drink. Your goal is to survive all 44 cards with at least 1 HP remaining.

The game runs entirely in the browser using vanilla HTML, CSS, and JavaScript. All audio is generated procedurally via the Web Audio API — no audio files are shipped. Card art is loaded from local images. Game state, scores, and achievements are persisted in `localStorage`.

---

## Rules

### The Deck

The deck contains **44 cards**, built from a standard 52-card deck with all red face cards (J♥, Q♥, K♥, J♦, Q♦, K♦) and red Aces (A♥, A♦) removed:

| Cards | Type | Count |
|---|---|---|
| ♣ and ♠ (2–A) | Monsters | 26 |
| ♦ (2–10) | Weapons | 9 |
| ♥ (2–10) | Potions | 9 |

### Each Turn

Four cards are drawn and dealt face-down, then flipped one by one. You must **select exactly 3 cards** to resolve. The 4th card carries forward to the next room as the first card of the next turn.

### Resolving Cards

- **Monster (♣ ♠):** You take damage equal to the monster's value. If you have a weapon equipped and the monster's value is **strictly less than** the last monster you defeated with that weapon, the weapon absorbs part of the damage: you take `monster value − weapon value` damage (minimum 0). Otherwise the weapon breaks, you lose it, and you take the monster's full value as damage.
- **Weapon (♦):** You equip it. If you already had a weapon, the old weapon and all monsters it defeated are discarded.
- **Potion (♥):** You heal HP equal to the card's value, up to a maximum of 20. Only **one potion** may be used per room — any further potions drawn that turn are discarded without effect.

### Avoid Room

Once per turn (and never twice in a row) you may **Avoid Room** — all four cards are placed back at the bottom of the deck and a new room is drawn. This does not count as a turn.

### Scoring

- **Victory** (deck exhausted, still alive): score = remaining HP + equipped weapon value (if any).
- **Defeat** (HP reaches 0): score = negative sum of all remaining monster values in the deck and room.

### Maximum Health

Your maximum HP is **20**. Potions cannot heal above this cap.

---

## How to Run

No build tools or package manager is needed.

1. Clone or download the repository.
2. Open `index.html` directly in a modern browser.

```
git clone https://github.com/Gustav-DEVhub/Scoundrel-Game.git
cd Scoundrel-Game
# Open index.html in your browser
```

> **Note:** Some browsers block the Web Audio API when a page is opened as a `file://` URL. If you hear no sound, serve the project through a local HTTP server:
>
> ```
> npx serve .
> # or
> python3 -m http.server
> ```

### Browser Compatibility

The game uses standard Web APIs available in all modern browsers: CSS custom properties, `localStorage`, Web Audio API, `requestAnimationFrame`, CSS grid and flexbox. No polyfills are included.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `N` | New Game |
| `A` | Avoid Room |
| `H` or `?` | Open Help / Rules |
| `L` | Open Leaderboard |
| `1` – `4` | Resolve card in that slot directly |
| `Escape` | Close any open dialog |

### Mobile / Touch

- Swipe **left** on the card grid → Avoid Room  
- Swipe **up** on the card grid → Face Selected (if 3 cards are selected)

---

## File Responsibilities

```
index.html          Markup and structure for the entire application.
style.css           All visual styles: layout, card flip animations,
                    HUD, log, dialogs, responsive breakpoints,
                    and accessibility/reduced-motion overrides.

js/
  main.js           Core game logic and UI controller.
                    Contains: deck generation (Fisher-Yates shuffle),
                    game state machine (newGame, drawRoom, avoidRoom,
                    resolveCard), weapon rule enforcement, scoring,
                    localStorage persistence, DOM rendering,
                    event listeners, keyboard and swipe controls,
                    and the onboarding/end-game overlay logic.

  audio.js          Procedural audio via Web Audio API.
                    Generates all sound effects (damage, heal, equip,
                    weapon break, deal, defeat, victory) and ambient
                    background music with two moods: dungeon and danger.
                    Exposes the SFX and BGM objects.

  achievements.js   14 dungeon-themed achievements tracked per session
                    and persisted in localStorage. Unlocks trigger
                    in-game toast notifications. Exposes Achievements.

  leaderboard.js    Top-10 score board persisted in localStorage.
                    Exposes Leaderboard.add(), show(), and hide().

  particles.js      Lightweight DOM-based particle system. Bursts of
                    coloured particles are spawned on events such as
                    damage, heal, equip, and victory. Exposes Particles.

assets/
  images.jpg/       Card background images used on the front face of
                    each card type. Monsters (clubs, spades) and weapons
                    (diamonds) have three tier images each based on card
                    value. Potions (hearts) share one image.
```

---

## Technical Notes

- **Zero dependencies.** No frameworks, no bundler, no package manager.
- **Progressive enhancement.** The game is playable without sound if the Web Audio API is unavailable or blocked.
- **Accessibility.** Semantic HTML, ARIA roles and live regions, focus trapping in dialogs, skip link, screen-reader labels on all interactive elements, and a `prefers-reduced-motion` override that disables all animations.
- **Persistence.** Game state is saved to `localStorage` after every action under the key `scoundrel_v1`. Resuming a saved run is automatic on page load.
- **`'use strict'`** is used throughout all JavaScript files.
