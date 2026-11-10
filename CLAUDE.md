# CLAUDE.md

This file gives Claude Code guidance for working in this repository.

## Overview

Yeti is an arcade-style browser platformer, live at https://yeti.sala.company. A penguin climbs an icy mountain to rescue a baby chick from a snowball-throwing yeti. It has four stages (ice ledges, frozen fish factory, ski-lift elevators, ice-bolt peak), keyboard, gamepad and touch controls, and a built-in AI ("CPU PLAY" plays the whole game, "HELP ME" clears the current stage). It is plain JavaScript ES modules drawing to a 224x256 `<canvas>`. There is no framework, no build step and no dependencies. All art (vector drawing, rendered at up to 4x) and all sound are generated in code, so the repo has no image or audio assets.

## Commands

No package.json, tests or linter. ES modules need a server, so don't open `index.html` from `file://`:

```bash
python3 -m http.server   # then open http://localhost:8000
```

## Architecture

- `index.html` contains the canvas `#screen`, the CPU buttons (`#btn-cpu`, `#btn-help`), the touch controls (`#touch`: d-pad, jump, pause, mute) and `<script type="module" src="js/main.js">`. Fonts load from Google Fonts (Fredoka). `css/style.css` styles the page.
- `js/main.js` is the entry point. It wires `Game`, `Input`, `Sfx` and `Autopilot`, detects touch (adds `body.touch`), handles resize (picks render resolution `game.res`: up to 4x, or 3x on touch) and auto-pauses on `visibilitychange`. It runs a **fixed 60 Hz step loop** (`input.update()` then `autopilot.step(input)` then `game.update()`) and draws once per animation frame.
- `js/game.js` exports `Game`, `W`/`H` (224/256) and `PHYS` (walk, climb, jump velocity, gravity, max fall, `FALL_DEATH`). It holds game states, scoring, lives (extra life at 10,000) and the level/stage flow.
- `js/stages/stage1..4.js` each default-export a stage object (`id`, `name`, `layout()` with platforms/ladders/items, plus hooks such as `setup`, `init`, `difficulty`, `update`, `hazards`, `drawStatic`, `draw`). `js/stages/index.js` registers them in `STAGES` and defines the arcade per-level order in `SEQUENCES` (`stageSequence(level)`).
- `js/world.js` holds platform geometry (`surfaceY`, `inRange`, sloped ledges with gaps), ladders and platform/ladder drawing.
- `js/nav.js` builds the autopilot route graph per stage. It finds jump links by test-firing the real jump physics (`flight()`), so it depends on `PHYS` and stage layouts.
- `js/autopilot.js` (`Autopilot`) chooses moves by cloning the world and simulating the game's own physics a couple of seconds ahead for many candidate moves. Any player input takes control back.
- `js/input.js`: keyboard, gamepad (`navigator.getGamepads`) and touch, with edge-triggered actions (`input.edge.*`). `js/audio.js` (`Sfx`): synthesized sound, unlocked on the first gesture. `js/sprites.js`, `js/scenery.js`, `js/font.js`: procedural drawing.

### localStorage keys

`yeti.hi` (high score) and `yeti.muted`. Access is wrapped in try/catch.

## Deployment

`.github/workflows/pages.yml` ("Deploy site") runs on push to `main` (and on manual dispatch). It uploads the **whole repo root** (`path: .`) with `actions/upload-pages-artifact` and deploys with `actions/deploy-pages` (GitHub Pages via Actions). **Pushing to `main` deploys live.** `CNAME` sets `yeti.sala.company`, and `.nojekyll` disables Jekyll processing.

## Conventions and gotchas

- Because the entire repo root is published, don't commit logs, scratch files or secrets. A past commit removed stray log files that had been published with the site.
- Keep the GoatCounter analytics snippet at the end of `index.html` intact (endpoint `https://salacompany.goatcounter.com/count`, skipped on localhost, paths prefixed with `location.host`).
- Changing `PHYS` constants or stage layouts affects the autopilot too (`nav.js` derives jumps from physics). Re-check CPU PLAY / HELP ME after such changes.
- Mobile: the viewport disables zoom (`user-scalable=no`, `viewport-fit=cover`). In portrait touch mode, `resize()` reserves space for the touch controls. Test both orientations when changing layout.
- The CPU buttons use `tabindex="-1"` and `preventDefault` on pointerdown so they never take keyboard focus. Keep that behavior.
- English only (`lang="en"`). In-game text is drawn on the canvas by `font.js`.
- No version strings or service worker, so there is no cache-busting to maintain.
