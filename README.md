# Yeti

An arcade-style platformer that runs in the browser. A penguin climbs an icy
mountain to rescue a baby chick from a snowball-throwing yeti.

Play: **https://yeti.sala.company**

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move / climb | Arrows or WASD | D-pad / left stick | D-pad |
| Jump | Space, Z or X | A / B | JUMP |
| Start | Enter | Start | Tap the screen |
| Pause | P or Esc | Select | II |
| Mute | M | | ♫ |
| CPU plays | C | | CPU PLAY button |
| CPU clears this stage | H | | HELP ME button |

## Let the computer play

**CPU PLAY** (or **C**) hands the penguin to the computer: it starts a game and
plays stage after stage, level after level, at normal speed, and starts again
after a game over. Press any game control (arrows, WASD, jump, the D-pad or
JUMP on touch, a gamepad button) to take over instantly.

**HELP ME** (or **H**) is for a stage you're stuck on: the computer clears the
current stage and hands control back to you when the chick is rescued.

The computer plays by looking ahead. Before each move it copies the world and
runs the game's own physics a couple of seconds into the future for a few
dozen candidate moves (follow the route, wait, jump now or a little later,
back off, get off the ladder and jump) across several possible futures, then
takes the move that survives and gets closest to the chick. Routes come from
`js/nav.js`, which maps the ledges, ladders, jumps and ski-lift exits of each
stage by test-firing the jump physics; the player itself is `js/autopilot.js`.

## How to play

- Stage 1: climb the ledges and reach the chick at the top before the bonus timer runs out.
- Stage 2: conveyor belts carry you and blocks of frozen fish; some ladders slide out of reach, and the yeti paces past the ladder to the chick.
- Stage 3: ride the ski lifts up and down (jump off before the pulley!), dodge bouncing iceballs and reach the chick.
- Stage 4: walk or jump over all 8 ice bolts (100 pts each) to bring the yeti down.
- Grab the scarf, mittens and fish for 300 / 500 / 800 pts (by level).
- Jump over snowballs (100 pts) and seals. Grab a snow shovel to smash them (300–800 pts).
- Blue ice boulders that reach the seal hole bring out an angry seal.
- Don't fall more than a short hop. Extra life at 10,000 points.

## Stages

Levels follow the arcade order: level 1 plays stages 1 and 4, level 2 adds stage 3, and from level 3 on all four stages appear.

| Stage | Height | Status |
|---|---|---|
| Ice ledges | 1000 FT | playable |
| Frozen fish factory | 2000 FT | playable |
| Ski-lift elevators | 3000 FT | playable |
| Ice-bolt peak | 4000 FT | playable |

## Development

Plain JavaScript modules and a 224×256 canvas. No build step. Serve the folder
with any static server, e.g. `python3 -m http.server`, and open it in a browser.
All art (shaded vector drawing, rendered at up to 4x) and sound is generated in code. Pushing to `main` deploys to GitHub Pages.
