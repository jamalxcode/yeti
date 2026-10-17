// Stage 4 (the peak): flat ice ledges held up by 8 frozen bolts. Walk or jump over
// every bolt to pull it out; when the last one goes, the yeti tumbles off the peak.
// Seals pop up on the ledges and hunt the penguin.
import { inRange } from '../world.js';
import { drawBolt } from '../sprites.js';

const BOLT_X = [56, 168];
const rand = (a, b) => a + Math.random() * (b - a);

export default {
  id: 4,
  name: 'ICE-BOLT PEAK',
  clearKind: 'fall',

  layout() {
    return {
      platforms: [
        { x0: 8, x1: 216, yL: 248, yR: 248 }, // 0 ground
        { x0: 16, x1: 208, yL: 208, yR: 208 }, // 1
        { x0: 24, x1: 200, yL: 168, yR: 168 }, // 2
        { x0: 32, x1: 192, yL: 128, yR: 128 }, // 3
        { x0: 40, x1: 184, yL: 88, yR: 88 }, // 4 the yeti's ledge
        { x0: 96, x1: 128, yL: 44, yR: 44 }, // 5 the chick's perch
      ],
      ladders: [
        { x: 16, lower: 0, upper: 1 }, { x: 104, lower: 0, upper: 1 }, { x: 200, lower: 0, upper: 1 },
        { x: 28, lower: 1, upper: 2 }, { x: 72, lower: 1, upper: 2 }, { x: 144, lower: 1, upper: 2 }, { x: 188, lower: 1, upper: 2 },
        { x: 36, lower: 2, upper: 3 }, { x: 104, lower: 2, upper: 3 }, { x: 180, lower: 2, upper: 3 },
        { x: 44, lower: 3, upper: 4 }, { x: 172, lower: 3, upper: 4 },
      ],
      items: [
        { type: 'shovel', x: 128, p: 1 },
        { type: 'shovel', x: 84, p: 3 },
        { type: 'fish', x: 120, p: 0 },
        { type: 'scarf', x: 132, p: 2 },
        { type: 'mittens', x: 140, p: 3 },
      ],
      start: { x: 40, p: 0 },
      yeti: { x: 112, p: 4 },
      chick: { x: 120, p: 5 },
    };
  },

  // Once per stage visit: bolts stay pulled even if the penguin loses a life.
  setup(w) {
    w.bolts = [];
    for (let p = 1; p <= 4; p++) for (const x of BOLT_X) w.bolts.push({ x, p, pulled: false, armed: false });
    for (const p of w.platforms) p.gaps = [];
  },

  init(w) {
    for (const b of w.bolts) b.armed = false;
    w.sealTimer = 120;
    w.yeti.timer = 90;
    w.yeti.phase = 'idle';
    w.yeti.pose = 'idle';
    w.flyingBolts = [];
  },

  maxSeals(level) { return Math.min(2 + level, 5); },

  update(w, game) {
    const pl = game.player;
    const yt = w.yeti;

    // the yeti stomps about and roars
    if (--yt.timer <= 0) {
      if (yt.phase === 'idle') { yt.phase = 'roar'; yt.timer = 50; game.sfx.play('roar'); }
      else { yt.phase = 'idle'; yt.timer = rand(90, 200); }
    }
    yt.pose = yt.phase === 'roar' ? 'roar' : 'idle';
    yt.facing = pl.x < yt.x ? -1 : 1;

    // bolts: stepping onto one arms it; leaving it pulls it out
    for (const b of w.bolts) {
      if (b.pulled || pl.p !== b.p) continue;
      const floorY = w.platforms[b.p].yL;
      const near = Math.abs(pl.x - b.x) < 3 && pl.y <= floorY && floorY - pl.y < 26;
      if (near) b.armed = true;
      else if (b.armed && Math.abs(pl.x - b.x) > 5) this.pull(w, game, b);
    }

    // seals pop up on random ledges, away from the penguin
    if (w.seals.length < this.maxSeals(game.level) && --w.sealTimer <= 0) {
      w.sealTimer = Math.max(150, 400 - 40 * game.level);
      for (let tries = 0; tries < 10; tries++) {
        const p = Math.floor(rand(0, 5));
        const plat = w.platforms[p];
        const x = rand(plat.x0 + 12, plat.x1 - 12);
        if (!inRange(plat, x) || Math.abs(x - yt.x) < 24) continue;
        if (Math.abs(plat.yL - pl.y) < 20 && Math.abs(x - pl.x) < 60) continue;
        game.spawnSeal({ x, p });
        break;
      }
    }

    for (const f of w.flyingBolts) { f.vy += 0.15; f.y += f.vy; f.x += f.vx; }
    w.flyingBolts = w.flyingBolts.filter((f) => f.y < 270);
  },

  pull(w, game, b) {
    b.pulled = true;
    w.platforms[b.p].gaps.push({ x0: b.x - 4, x1: b.x + 4 });
    w.flyingBolts.push({ x: b.x, y: w.platforms[b.p].yL, vx: (Math.random() - 0.5) * 1.5, vy: -2.5 });
    game.addScore(100, b.x, w.platforms[b.p].yL - 22);
    game.sfx.play('pickup');
  },

  cleared(w) { return w.bolts.every((b) => b.pulled); },

  hazards() { return []; },

  draw(ctx, w, game) {
    for (const b of w.bolts) if (!b.pulled) drawBolt(ctx, b.x, w.platforms[b.p].yL, game.frame);
    for (const f of w.flyingBolts) drawBolt(ctx, f.x, f.y, 0);
  },
};
