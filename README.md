# Yeti (Barrel Climber)

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

## How to play

- Climb the ledges and reach the chick at the top before the bonus timer runs out.
- Jump over snowballs (100 pts) and seals. Grab a snow shovel to smash them (300–800 pts).
- Blue ice boulders that reach the seal hole bring out an angry seal.
- Don't fall more than a short hop. Extra life at 10,000 points.

## Stages

| Stage | Height | Status |
|---|---|---|
| Ice ledges | 1000 FT | playable |
| Frozen fish factory | 2000 FT | coming |
| Ski-lift elevators | 3000 FT | coming |
| Ice-bolt peak | 4000 FT | coming |

## Development

Plain JavaScript modules and a 224×256 canvas. No build step. Serve the folder
with any static server, e.g. `python3 -m http.server`, and open it in a browser.
All art and sound is generated in code. Pushing to `main` deploys to GitHub Pages.
