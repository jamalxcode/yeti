// Stage 3: ski lifts. Lift platforms ride up the left shaft and down the right
// one; staying on a lift into the pulley at the end of its shaft is fatal. From
// a perch at the top right the yeti hurls bouncing iceballs that hop left along
// the top ledge and plunge down past its end.
import { inRange } from '../world.js';
import { drawSnowball } from '../sprites.js';

const rand = (a, b) => a + Math.random() * (b - a);

const SHAFTS = [
  { x0: 50, x1: 74, top: 92, bottom: 252, dir: -1 }, // going up
  { x0: 132, x1: 156, top: 96, bottom: 252, dir: 1 }, // going down, out from under the top ledge
];
const LIFTS_PER_SHAFT = 3;
const LIFT_SPEED = 0.45;
const TOP = 7; // index of the top ledge the iceballs bounce along

export default {
  id: 3,
  name: 'SKI LIFTS',
  shafts: SHAFTS, // for the autopilot
  liftSpeed: LIFT_SPEED,

  layout() {
    const platforms = [
      { x0: 0, x1: 46, yL: 240, yR: 240 }, // 0 start
      { x0: 82, x1: 126, yL: 222, yR: 222 }, // 1 middle column
      { x0: 82, x1: 126, yL: 178, yR: 178 }, // 2
      { x0: 82, x1: 126, yL: 134, yR: 134 }, // 3
      { x0: 162, x1: 200, yL: 196, yR: 196 }, // 4 right tower
      { x0: 170, x1: 224, yL: 156, yR: 156 }, // 5
      { x0: 162, x1: 208, yL: 116, yR: 116 }, // 6
      { x0: 84, x1: 176, yL: 84, yR: 84 }, // 7 top ledge
      { x0: 180, x1: 224, yL: 74, yR: 74 }, // 8 the yeti's perch
      { x0: 86, x1: 118, yL: 44, yR: 44 }, // 9 the chick's ledge (goal)
      { x0: 162, x1: 224, yL: 236, yR: 236 }, // 10 bottom right
    ];
    // lift platforms go last so ladder indexes above stay put
    for (const [si, s] of SHAFTS.entries()) {
      const span = s.bottom - s.top;
      for (let k = 0; k < LIFTS_PER_SHAFT; k++) {
        const y = s.top + span * (k + 0.5) / LIFTS_PER_SHAFT;
        platforms.push({ x0: s.x0, x1: s.x1, yL: y, yR: y, lift: si, dynamic: true });
      }
    }
    return {
      platforms,
      ladders: [
        { x: 112, lower: 1, upper: 2 },
        { x: 88, lower: 2, upper: 3 },
        { x: 190, lower: 10, upper: 4 },
        { x: 178, lower: 4, upper: 5 },
        { x: 200, lower: 5, upper: 6 },
        { x: 166, lower: 6, upper: 7 },
        { x: 88, lower: 7, upper: 9, noSeal: true },
      ],
      items: [
        { type: 'scarf', x: 100, p: 2 },
        { type: 'mittens', x: 214, p: 5 },
        { type: 'fish', x: 140, p: 7 },
      ],
      start: { x: 16, p: 0 },
      yeti: { x: 202, p: 8 },
      chick: { x: 108, p: 9 },
      goal: 9,
    };
  },

  init(w, game) {
    w.balls = [];
    w.yeti.timer = 60;
    w.yeti.phase = 'wait';
    w.yeti.facing = -1;
    game.spawnSeal({ x: 112, p: 3 });
    game.spawnSeal({ x: 190, p: 6 });
  },

  difficulty(level) {
    return {
      ballSpeed: Math.min(1.0 + 0.1 * (level - 1), 1.5),
      waitMin: Math.max(50, 90 - 10 * (level - 1)),
      waitMax: Math.max(90, 170 - 15 * (level - 1)),
    };
  },

  update(w, game) {
    const d = this.difficulty(game.level);
    const pl = game.player;

    // lifts
    w.platforms.forEach((p, i) => {
      if (p.lift === undefined) return;
      const s = SHAFTS[p.lift];
      let y = p.yL + s.dir * LIFT_SPEED;
      const span = s.bottom - s.top;
      let wrapped = false;
      if (y < s.top) { y += span; wrapped = true; }
      if (y > s.bottom) { y -= span; wrapped = true; }
      p.yL = p.yR = y;
      if (wrapped && pl.p === i && pl.state === 'walk') game.die();
    });

    // the yeti hurls an iceball every so often
    const yt = w.yeti;
    yt.timer--;
    if (yt.phase === 'wait') {
      yt.pose = 'idle';
      if (yt.timer <= 0) { yt.phase = 'hold'; yt.timer = 20; }
    } else if (yt.phase === 'hold') {
      yt.pose = 'hold';
      if (yt.timer <= 0) {
        w.balls.push({ x: yt.x - 16, y: yt.y - 30, vx: -d.ballSpeed, vy: -1, mode: 'bounce', kind: 'ice', rot: 0 });
        game.sfx.play('throw');
        yt.phase = 'throw';
        yt.timer = 14;
      }
    } else {
      yt.pose = 'roar';
      if (yt.timer <= 0) { yt.phase = 'wait'; yt.timer = rand(d.waitMin, d.waitMax); }
    }

    const top = w.platforms[TOP];
    for (const b of w.balls) {
      const prevY = b.y;
      b.vy = Math.min(b.vy + 0.12, 3.5);
      b.y += b.vy;
      b.x += b.vx;
      b.rot += b.vx / 3;
      if (b.mode === 'bounce') {
        if (b.vy > 0 && inRange(top, b.x) && prevY <= top.yL && b.y >= top.yL) {
          b.y = top.yL;
          b.vy = -2.1;
          game.sfx.play('land');
        } else if (b.x < top.x0 - 2) {
          b.mode = 'drop'; // off the end: straight down
          b.vx = 0;
        }
      }
      if (b.y > 275) b.dead = true;
    }
    w.balls = w.balls.filter((b) => !b.dead);
  },

  hazards(w) { return w.balls; },

  // Cables and pulley housings, painted once into the level layer.
  drawStatic(ctx) {
    for (const s of SHAFTS) {
      const cables = [s.x0 + 3, s.x1 - 3];
      for (const cx of cables) {
        const g = ctx.createLinearGradient(cx - 0.5, 0, cx + 0.5, 0);
        g.addColorStop(0, '#3a4357');
        g.addColorStop(0.5, '#aab6c8');
        g.addColorStop(1, '#3a4357');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 0.45, s.top - 8, 0.9, 256 - s.top + 8);
      }
      for (const hy of [s.top - 11, 250]) {
        const hg = ctx.createLinearGradient(0, hy, 0, hy + 6);
        hg.addColorStop(0, '#e0503c');
        hg.addColorStop(1, '#7a1d14');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.roundRect(s.x0 - 2, hy, s.x1 - s.x0 + 4, 6, 1.5);
        ctx.fill();
        for (const cx of cables) {
          const wy = hy + 3;
          const wg = ctx.createRadialGradient(cx - 0.8, wy - 0.8, 0.2, cx, wy, 3);
          wg.addColorStop(0, '#e8eef6');
          wg.addColorStop(1, '#4b566b');
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.arc(cx, wy, 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#2a3142';
          ctx.beginPath(); ctx.arc(cx, wy, 0.7, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; // snow on the housing
        ctx.beginPath();
        ctx.ellipse((s.x0 + s.x1) / 2, hy, (s.x1 - s.x0) / 2 + 1.5, 1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // which way this lift runs
      ctx.fillStyle = 'rgba(255,225,110,0.95)';
      const ax = (s.x0 + s.x1) / 2;
      const ay = s.top - 8;
      ctx.beginPath();
      if (s.dir < 0) { ctx.moveTo(ax - 2.5, ay + 1.3); ctx.lineTo(ax + 2.5, ay + 1.3); ctx.lineTo(ax, ay - 1.5); }
      else { ctx.moveTo(ax - 2.5, ay - 1.3); ctx.lineTo(ax + 2.5, ay - 1.3); ctx.lineTo(ax, ay + 1.5); }
      ctx.closePath();
      ctx.fill();
    }
  },

  draw(ctx, w) {
    for (const p of w.platforms) if (p.lift !== undefined) drawLift(ctx, p);
    for (const b of w.balls) drawSnowball(ctx, b.x, b.y, b.kind, b.rot, b.mode === 'bounce' && b.vy > -1);
  },
};

// A steel lift platform clamped to the two cables.
function drawLift(ctx, p) {
  const y = p.yL;
  const g = ctx.createLinearGradient(0, y, 0, y + 4);
  g.addColorStop(0, '#e2e9f2');
  g.addColorStop(0.5, '#8d9bb0');
  g.addColorStop(1, '#4a566b');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(p.x0, y, p.x1 - p.x0, 4, 1);
  ctx.fill();
  // yellow safety edge and clamps
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(p.x0 + 1, y + 3, p.x1 - p.x0 - 2, 0.8);
  ctx.fillStyle = '#2f3746';
  for (const cx of [p.x0 + 3, p.x1 - 3]) ctx.fillRect(cx - 1.2, y + 0.6, 2.4, 2.6);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse((p.x0 + p.x1) / 2, y + 0.2, (p.x1 - p.x0) / 2 - 2, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}
