// Stage 1 (1000 FT): sloped ice ledges. The yeti rolls snowballs down; blue ice
// boulders that reach the seal hole bring out an angry seal.
import { surfaceY, inRange, downDir } from '../world.js';
import { drawSnowball } from '../sprites.js';

const rand = (a, b) => a + Math.random() * (b - a);

export default {
  id: 1,
  name: 'ICE LEDGES',

  layout() {
    return {
      platforms: [
        { x0: 0, x1: 224, yL: 248, yR: 240 }, // 0 ground, slopes down to the left (seal hole)
        { x0: 0, x1: 208, yL: 207, yR: 215 }, // 1
        { x0: 16, x1: 224, yL: 182, yR: 174 }, // 2
        { x0: 0, x1: 208, yL: 141, yR: 149 }, // 3
        { x0: 16, x1: 224, yL: 116, yR: 108 }, // 4
        { x0: 0, x1: 208, yL: 76, yR: 82 }, // 5 the yeti's ledge
        { x0: 88, x1: 136, yL: 48, yR: 48 }, // 6 the chick's ledge (goal)
      ],
      ladders: [
        { x: 76, lower: 0, upper: 1, broken: true },
        { x: 184, lower: 0, upper: 1 },
        { x: 28, lower: 1, upper: 2 },
        { x: 64, lower: 1, upper: 2, broken: true },
        { x: 100, lower: 1, upper: 2 },
        { x: 68, lower: 2, upper: 3, broken: true },
        { x: 112, lower: 2, upper: 3 },
        { x: 184, lower: 2, upper: 3 },
        { x: 24, lower: 3, upper: 4 },
        { x: 104, lower: 3, upper: 4 },
        { x: 160, lower: 3, upper: 4, broken: true },
        { x: 72, lower: 4, upper: 5, broken: true },
        { x: 184, lower: 4, upper: 5 },
        { x: 116, lower: 5, upper: 6, noSeal: true },
      ],
      items: [
        { type: 'shovel', x: 40, p: 2 },
        { type: 'shovel', x: 172, p: 4 },
      ],
      start: { x: 52, p: 0 },
      yeti: { x: 32, p: 5 },
      chick: { x: 104, p: 6 },
      goal: 6,
      hole: { x: 14, p: 0 },
      walls: [{ p: 0, min: 28 }],
    };
  },

  init(w) {
    w.balls = [];
    w.throwCount = 0;
    w.yeti.phase = 'wait';
    w.yeti.timer = 70;
    w.yeti.pose = 'idle';
  },

  difficulty(level) {
    return {
      ballSpeed: Math.min(0.85 + 0.12 * (level - 1), 1.5),
      ladderChance: Math.min(0.22 + 0.06 * (level - 1), 0.5),
      waitMin: Math.max(40, 80 - 10 * (level - 1)),
      waitMax: Math.max(80, 170 - 20 * (level - 1)),
      iceEvery: Math.max(4, 8 - (level - 1)),
      dropChance: level >= 2 ? Math.min(0.08 * (level - 1), 0.25) : 0,
    };
  },

  update(w, game) {
    const d = this.difficulty(game.level);
    const y = w.yeti;
    y.timer--;
    switch (y.phase) {
      case 'wait':
        y.pose = 'idle';
        if (y.timer <= 0) {
          if (w.throwCount > 0 && Math.random() < 0.15) { y.phase = 'roar'; y.timer = 40; game.sfx.play('roar'); }
          else { y.phase = 'grab'; y.timer = 18; }
        }
        break;
      case 'roar':
        y.pose = 'roar';
        if (y.timer <= 0) { y.phase = 'grab'; y.timer = 18; }
        break;
      case 'grab':
        y.pose = 'grab';
        if (y.timer <= 0) { y.phase = 'hold'; y.timer = 16; }
        break;
      case 'hold':
        y.pose = 'hold';
        if (y.timer <= 0) {
          const first = w.throwCount === 0;
          const kind = first || (w.throwCount % d.iceEvery === 0) ? 'ice' : 'snow';
          if (first || Math.random() < d.dropChance) this.spawnDrop(w, kind);
          else { this.spawnRoll(w, kind); y.phase = 'throw'; }
          w.throwCount++;
          game.sfx.play('throw');
          if (y.phase === 'hold') y.phase = 'throwDown';
          y.timer = 12;
        }
        break;
      case 'throw':
        y.pose = 'throw';
        if (y.timer <= 0) { y.phase = 'wait'; y.timer = rand(d.waitMin, d.waitMax); }
        break;
      case 'throwDown':
        y.pose = 'idle';
        if (y.timer <= 0) { y.phase = 'wait'; y.timer = rand(d.waitMin, d.waitMax); }
        break;
    }

    for (const b of w.balls) this.updateBall(w, game, b, d);
    w.balls = w.balls.filter((b) => !b.dead);
  },

  spawnRoll(w, kind) {
    const p = w.platforms[5];
    w.balls.push({ x: 52, y: surfaceY(p, 52), p: 5, dir: 1, mode: 'roll', kind, rot: 0, lastLadder: -1, vx: 0, vy: 0 });
  },

  // Thrown straight down the left side, through every ledge, to the ground.
  spawnDrop(w, kind) {
    w.balls.push({ x: 40, y: w.yeti.y - 34, p: -1, dir: -1, mode: 'drop', kind, rot: 0, lastLadder: -1, vx: 0, vy: 0.5 });
  },

  updateBall(w, game, b, d) {
    const spd = d.ballSpeed;
    if (b.mode === 'roll') {
      const p = w.platforms[b.p];
      b.x += b.dir * spd;
      b.rot += b.dir * spd / 4;
      if (!inRange(p, b.x)) {
        b.mode = 'fall'; b.vx = b.dir * 0.6; b.vy = 0; b.from = b.p;
        return;
      }
      b.y = surfaceY(p, b.x);
      if (b.p === w.hole.p && b.x <= w.hole.x + 6) {
        b.dead = true;
        game.sfx.play('splash');
        if (b.kind === 'ice') game.spawnSeal();
        return;
      }
      for (const L of w.ladders) {
        if (L.upper !== b.p || L.id === b.lastLadder || Math.abs(b.x - L.cx) > spd / 2 + 0.01) continue;
        b.lastLadder = L.id;
        const towardPlayer = game.player.y > b.y + 8 ? 0.2 : 0;
        if (Math.random() < d.ladderChance + towardPlayer) {
          b.mode = 'ladder'; b.x = L.cx; b.ladder = L;
        }
      }
    } else if (b.mode === 'ladder') {
      b.y += spd * 0.9;
      if (b.y >= b.ladder.yBot) {
        b.p = b.ladder.lower;
        b.y = b.ladder.yBot;
        b.dir = downDir(w.platforms[b.p]);
        b.mode = 'roll';
      }
    } else if (b.mode === 'fall') {
      const prevY = b.y;
      b.vy = Math.min(b.vy + 0.15, 3);
      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.vx / 4;
      w.platforms.forEach((p, i) => {
        if (b.mode !== 'fall' || i === b.from || !inRange(p, b.x)) return;
        const s = surfaceY(p, b.x);
        if (prevY <= s && b.y >= s) {
          b.y = s; b.p = i; b.dir = downDir(p); b.mode = 'roll'; b.lastLadder = -1;
        }
      });
      if (b.y > 270) b.dead = true;
    } else if (b.mode === 'drop') {
      b.vy = Math.min(b.vy + 0.12, 2.5);
      b.y += b.vy;
      b.rot += 0.2;
      const g = w.platforms[0];
      const s = surfaceY(g, b.x);
      if (b.y >= s) { b.y = s; b.p = 0; b.dir = downDir(g); b.mode = 'roll'; game.sfx.play('land'); }
    }
  },

  hazards(w) {
    return w.balls;
  },

  draw(ctx, w) {
    // spare snowballs piled next to the yeti
    drawSnowball(ctx, 6, surfaceY(w.platforms[5], 6), 'snow', 1);
    drawSnowball(ctx, 6, surfaceY(w.platforms[5], 6) - 9, 'snow', 2, false);
    drawSnowball(ctx, 6, surfaceY(w.platforms[5], 6) - 18, 'ice', 0.5, false);
    for (const b of w.balls) drawSnowball(ctx, b.x, b.y, b.kind, b.rot);
  },
};
