// Stage 2: the frozen fish factory. Conveyor belts carry the penguin and blocks
// of frozen fish; the two long belts reverse now and then. The middle floor's
// belts feed a tank of icy water that seals climb out of. Some ladders slide up
// out of reach, and the yeti paces the top ledge across the ladder to the chick.
import { surfaceY, inRange } from '../world.js';

const rand = (a, b) => a + Math.random() * (b - a);
const TANK = { x0: 104, x1: 120 };

// belt platforms: which end feeds blocks in and whether the belt reverses
const BELTS = [
  { p: 1, dir: 1, reverses: true },
  { p: 2, dir: 1, reverses: false },
  { p: 3, dir: -1, reverses: false },
  { p: 4, dir: -1, reverses: true },
];

export default {
  id: 2,
  name: 'FISH FACTORY',
  yetiPaces: true, // for the autopilot

  layout() {
    return {
      platforms: [
        { x0: 0, x1: 224, yL: 248, yR: 248 }, // 0 ground
        { x0: 16, x1: 208, yL: 208, yR: 208, dynamic: true }, // 1 belt
        { x0: 8, x1: TANK.x0, yL: 168, yR: 168, dynamic: true }, // 2 belt into the tank
        { x0: TANK.x1, x1: 216, yL: 168, yR: 168, dynamic: true }, // 3 belt into the tank
        { x0: 16, x1: 208, yL: 128, yR: 128, dynamic: true }, // 4 belt
        { x0: 24, x1: 200, yL: 88, yR: 88 }, // 5 the yeti's ledge
        { x0: 96, x1: 128, yL: 44, yR: 44 }, // 6 the chick's ledge (goal)
      ],
      ladders: [
        { x: 40, lower: 0, upper: 1 },
        { x: 176, lower: 0, upper: 1 },
        { x: 24, lower: 1, upper: 2 },
        { x: 72, lower: 1, upper: 2, retract: true },
        { x: 196, lower: 1, upper: 3 },
        { x: 88, lower: 2, upper: 4 },
        { x: 136, lower: 3, upper: 4, retract: true },
        { x: 32, lower: 4, upper: 5 },
        { x: 184, lower: 4, upper: 5 },
        { x: 108, lower: 5, upper: 6, noSeal: true },
      ],
      items: [
        { type: 'shovel', x: 120, p: 1 },
        { type: 'shovel', x: 60, p: 4 },
        { type: 'scarf', x: 204, p: 3 },
        { type: 'mittens', x: 44, p: 5 },
        { type: 'fish', x: 170, p: 4 },
      ],
      start: { x: 24, p: 0 },
      yeti: { x: 112, p: 5 },
      chick: { x: 120, p: 6 },
      goal: 6,
      hole: { x: (TANK.x0 + TANK.x1) / 2, p: 3 }, // seals hop out of the tank
    };
  },

  setup(w) {
    w.belts = BELTS.map((b) => ({ ...b, timer: rand(400, 700), feed: rand(30, 90) }));
  },

  init(w, game) {
    w.crates = [];
    w.crateCount = 0;
    w.sealTimer = 300;
    w.yeti.dir = 1;
    w.yeti.phase = 'walk';
    w.yeti.timer = 120;
    for (const L of w.ladders) if (L.retract) { L.ext = 1; L.phase = 'down'; L.t = rand(120, 300); L.retracted = false; }
  },

  difficulty(level) {
    return {
      belt: Math.min(0.35 + 0.04 * (level - 3), 0.55),
      feedMin: Math.max(70, 140 - 15 * (level - 3)),
      feedMax: Math.max(140, 260 - 20 * (level - 3)),
      yetiSpeed: Math.min(0.35 + 0.05 * (level - 3), 0.6),
    };
  },

  update(w, game) {
    const d = this.difficulty(Math.max(3, game.level));

    // belts: set their speed, reverse the long ones now and then, feed in blocks
    for (const b of w.belts) {
      const p = w.platforms[b.p];
      if (b.reverses && --b.timer <= 0) { b.dir = -b.dir; b.timer = rand(400, 700); }
      p.belt = b.dir * d.belt;
      if (--b.feed <= 0) {
        b.feed = rand(d.feedMin, d.feedMax);
        const x = b.dir > 0 ? p.x0 + 5 : p.x1 - 5;
        const pl = game.player;
        if (!(pl.p === b.p && Math.abs(pl.x - x) < 20)) {
          w.crates.push({ x, y: p.yL, p: b.p, mode: 'ride', rot: 0, vy: 0, vx: 0 });
        }
      }
    }

    // crates ride belts, tumble off the ends, and drop into the tank
    for (const c of w.crates) {
      if (c.mode === 'ride') {
        const p = w.platforms[c.p];
        c.x += p.belt;
        if (c.p === 2 || c.p === 3) {
          if (c.x > TANK.x0 - 1 && c.x < TANK.x1 + 1) {
            c.dead = true;
            game.sfx.play('splash');
            if (++w.crateCount % 4 === 0) game.spawnSeal();
            continue;
          }
        }
        if (!inRange(p, c.x)) { c.mode = 'fall'; c.from = c.p; c.vx = Math.sign(p.belt) * 0.5; c.vy = 0; }
        else c.y = surfaceY(p, c.x);
      } else {
        const prevY = c.y;
        c.vy = Math.min(c.vy + 0.15, 3);
        c.y += c.vy;
        c.x += c.vx;
        c.rot += c.vx * 0.15;
        for (let i = 0; i < w.platforms.length; i++) {
          const p = w.platforms[i];
          if (i === c.from || !inRange(p, c.x)) continue;
          const s = surfaceY(p, c.x);
          if (prevY <= s && c.y >= s) {
            if (i === 0) { c.dead = true; game.world.fx.push({ x: c.x, y: s - 4, t: 0 }); game.sfx.play('smash'); }
            else { c.p = i; c.y = s; c.mode = 'ride'; c.rot = 0; game.sfx.play('land'); }
            break;
          }
        }
        if (c.y > 270) c.dead = true;
      }
    }
    w.crates = w.crates.filter((c) => !c.dead);

    // a seal now and then from the tank
    if (--w.sealTimer <= 0) { w.sealTimer = Math.max(300, 700 - 60 * game.level); game.spawnSeal(); }

    // sliding ladders
    for (const L of w.ladders) {
      if (!L.retract) continue;
      L.t--;
      if (L.phase === 'down' && L.t <= 0) { L.phase = 'rising'; }
      if (L.phase === 'rising') { L.ext = Math.max(0.3, L.ext - 0.025); if (L.ext <= 0.3) { L.phase = 'up'; L.t = 150; } }
      if (L.phase === 'up' && L.t <= 0) L.phase = 'lowering';
      if (L.phase === 'lowering') { L.ext = Math.min(1, L.ext + 0.025); if (L.ext >= 1) { L.phase = 'down'; L.t = rand(200, 360); } }
      // only the penguin already on it may keep using it
      L.retracted = L.ext < 1 && !(game.player.state === 'climb' && game.player.ladder === L);
    }

    // the yeti paces the top ledge, across the ladder to the chick
    const yt = w.yeti;
    if (yt.phase === 'roar') {
      yt.pose = 'roar';
      if (--yt.timer <= 0) { yt.phase = 'walk'; yt.timer = rand(150, 300); }
    } else {
      yt.pose = 'idle';
      yt.x += yt.dir * d.yetiSpeed;
      if (yt.x < 64 || yt.x > 160) yt.dir = -yt.dir;
      yt.facing = yt.dir;
      if (--yt.timer <= 0) { yt.phase = 'roar'; yt.timer = 45; game.sfx.play('roar'); }
    }
  },

  hazards(w) { return w.crates; },

  drawStatic(ctx, w) {
    // the tank of icy water between the middle belts
    const y = w.platforms[2].yL;
    const g = ctx.createLinearGradient(TANK.x0 - 4, 0, TANK.x1 + 4, 0);
    g.addColorStop(0, '#46546b');
    g.addColorStop(0.5, '#a7b4c6');
    g.addColorStop(1, '#46546b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(TANK.x0 - 3, y + 2, TANK.x1 - TANK.x0 + 6, 16, 2);
    ctx.fill();
    ctx.fillStyle = '#0b2a55';
    ctx.fillRect(TANK.x0 - 1, y + 3, TANK.x1 - TANK.x0 + 2, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(TANK.x0 - 3, y + 16, TANK.x1 - TANK.x0 + 6, 0.6);
    // feed hoppers above the ends of the long belts
    for (const pi of [1, 4]) {
      const p = w.platforms[pi];
      for (const x of [p.x0 + 5, p.x1 - 5]) hopper(ctx, x, p.yL - 9);
    }
    hopper(ctx, w.platforms[2].x0 + 5, w.platforms[2].yL - 9);
    hopper(ctx, w.platforms[3].x1 - 5, w.platforms[3].yL - 9);
  },

  draw(ctx, w, game) {
    for (const L of w.ladders) {
      if (!L.retract) continue;
      const top = L.yTop + 8;
      const full = L.yBot - top;
      drawRetractLadder(ctx, L.x, top, top + full * L.ext);
    }
    for (const b of w.belts) drawBelt(ctx, w.platforms[b.p], game.frame);
    for (const c of w.crates) drawCrate(ctx, c.x, c.y, c.rot);
  },
};

// --- art ---------------------------------------------------------------------

function hopper(ctx, x, y) {
  const g = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
  g.addColorStop(0, '#4a566b');
  g.addColorStop(0.5, '#b8c4d4');
  g.addColorStop(1, '#4a566b');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 6);
  ctx.lineTo(x + 6, y - 6);
  ctx.lineTo(x + 3.5, y + 1);
  ctx.lineTo(x - 3.5, y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.ellipse(x, y - 6, 6.3, 1, 0, 0, Math.PI * 2); ctx.fill();
}

function drawBelt(ctx, p, t) {
  const y = p.yL;
  const w = p.x1 - p.x0;
  // steel frame
  const fg = ctx.createLinearGradient(0, y + 2, 0, y + 8);
  fg.addColorStop(0, '#9aa8bb');
  fg.addColorStop(1, '#3d4759');
  ctx.fillStyle = fg;
  ctx.fillRect(p.x0, y + 2, w, 6);
  // rollers
  for (let x = p.x0 + 3; x < p.x1; x += 12) {
    ctx.fillStyle = '#c9d3e0';
    ctx.beginPath(); ctx.arc(x, y + 5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a566b';
    ctx.lineWidth = 0.4;
    const a = (t * (p.belt || 0)) / 2.2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 2, y + 5 + Math.sin(a) * 2);
    ctx.lineTo(x - Math.cos(a) * 2, y + 5 - Math.sin(a) * 2);
    ctx.stroke();
  }
  // rubber belt with moving treads
  ctx.fillStyle = '#262c3a';
  ctx.fillRect(p.x0, y, w, 2.4);
  ctx.save();
  ctx.beginPath(); ctx.rect(p.x0, y, w, 2.4); ctx.clip();
  ctx.fillStyle = '#5a6580';
  const off = ((t * (p.belt || 0)) % 6 + 6) % 6;
  for (let x = p.x0 - 6 + off; x < p.x1; x += 6) ctx.fillRect(x, y + 0.3, 2, 1.6);
  ctx.restore();
  // frost along the edge and direction arrows
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let x = p.x0 + 2; x < p.x1; x += 9) ctx.fillRect(x, y + 2.2, 3, 0.5);
  ctx.fillStyle = '#f2c230';
  const dir = Math.sign(p.belt || 1);
  for (let x = p.x0 + 16; x < p.x1 - 8; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x - dir * 1.5, y + 3.6);
    ctx.lineTo(x + dir * 1.5, y + 5);
    ctx.lineTo(x - dir * 1.5, y + 6.4);
    ctx.closePath();
    ctx.fill();
  }
}

// A block of ice with a fish frozen inside; x = center, y = surface.
function drawCrate(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y - 4.5);
  ctx.rotate(rot);
  const g = ctx.createLinearGradient(-5, -4.5, 5, 4.5);
  g.addColorStop(0, 'rgba(225,246,255,0.95)');
  g.addColorStop(0.6, 'rgba(120,190,240,0.9)');
  g.addColorStop(1, 'rgba(50,110,190,0.95)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-5, -4.5, 10, 9, 1.4); ctx.fill();
  // the fish inside
  ctx.fillStyle = 'rgba(255,160,90,0.85)';
  ctx.beginPath(); ctx.ellipse(-0.6, 0.3, 3, 1.5, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(4, -1.6); ctx.lineTo(4, 1.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#101830';
  ctx.fillRect(-2.8, -0.4, 0.6, 0.6);
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(-4, -3.6, 5, 0.6);
  ctx.fillRect(-4, -3.6, 0.6, 3);
  ctx.restore();
}

function drawRetractLadder(ctx, x, y0, y1) {
  const rail = ctx.createLinearGradient(x, 0, x + 1.2, 0);
  rail.addColorStop(0, '#5d6a80');
  rail.addColorStop(0.5, '#d2dbe6');
  rail.addColorStop(1, '#5d6a80');
  ctx.fillStyle = '#8a97aa';
  for (let y = y0 + 3; y < y1; y += 4) ctx.fillRect(x + 1, y, 6, 0.8);
  ctx.fillStyle = rail;
  ctx.fillRect(x - 0.2, y0, 1.2, y1 - y0);
  ctx.fillRect(x + 6.8, y0, 1.2, y1 - y0);
  ctx.fillStyle = '#f2c230'; // yellow-black warning band at the foot
  ctx.fillRect(x - 0.4, y1 - 1.2, 8.8, 1.2);
}
