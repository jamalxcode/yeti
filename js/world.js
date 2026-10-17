// Platform and ladder geometry plus their drawing.
// A platform is a ledge from x0..x1 whose top surface goes from yL (at x0) to yR (at x1).
// The surface is stepped every SEG pixels like an arcade girder; `t` (0..1) is the tilt,
// used by the intro where the yeti's stomps bend flat ledges into slopes.

export const SEG = 16;

export function surfaceY(p, x) {
  const avg = (p.yL + p.yR) / 2;
  if (p.yL === p.yR) return p.yL;
  const span = p.x1 - p.x0;
  const maxSeg = Math.ceil(span / SEG) - 1;
  const seg = Math.max(0, Math.min(maxSeg, Math.floor((x - p.x0) / SEG)));
  const mid = Math.min(p.x0 + seg * SEG + SEG / 2, p.x1);
  const stepped = p.yL + (p.yR - p.yL) * (mid - p.x0) / span;
  const t = p.t ?? 1;
  return Math.round(avg + (stepped - avg) * t);
}

// On the ledge and not over a gap (stage 4's pulled ice bolts leave gaps).
export const inRange = (p, x) => x >= p.x0 && x <= p.x1 && !(p.gaps && p.gaps.some((g) => x > g.x0 && x < g.x1));

// Direction a ball rolls on a platform: downhill.
export const downDir = (p) => (p.yR > p.yL ? 1 : -1);

export function buildLadders(platforms, defs) {
  return defs.map((d, id) => {
    const cx = d.x + 4;
    const up = platforms[d.upper];
    const lo = platforms[d.lower];
    return {
      id, x: d.x, cx, upper: d.upper, lower: d.lower,
      broken: !!d.broken, noSeal: !!d.noSeal,
      get yTop() { return surfaceY(up, cx); },
      get yBot() { return surfaceY(lo, cx); },
    };
  });
}

const ICE_TOP = '#eef8ff';
const ICE = '#6cc9f2';
const ICE_MARK = '#3d9fd8';
const ICE_DARK = '#1d5f99';

export function drawPlatform(ctx, p) {
  if (p.gaps && p.gaps.length) {
    ctx.save();
    ctx.beginPath();
    let x = p.x0;
    for (const g of [...p.gaps].sort((a, b) => a.x0 - b.x0)) {
      ctx.rect(x, 0, g.x0 - x, 300);
      x = g.x1;
    }
    ctx.rect(x, 0, p.x1 - x, 300);
    ctx.clip();
    drawLedge(ctx, p);
    ctx.restore();
  } else {
    drawLedge(ctx, p);
  }
}

function drawLedge(ctx, p) {
  for (let x = p.x0; x < p.x1; x += SEG) {
    const w = Math.min(SEG, p.x1 - x);
    const y = surfaceY(p, x + 1);
    ctx.fillStyle = ICE;
    ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = ICE_TOP;
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = ICE_MARK;
    for (let o = 0; o < w; o += 8) {
      for (let k = 0; k < 4; k++) {
        if (o + k < w) ctx.fillRect(x + o + k, y + 3 + k, 1, 1);
        if (o + 7 - k < w) ctx.fillRect(x + o + 7 - k, y + 3 + k, 1, 1);
      }
    }
    ctx.fillStyle = ICE_DARK;
    ctx.fillRect(x, y + 7, w, 1);
    // little icicles under the ledge
    if (((x >> 4) & 1) === 0) {
      ctx.fillStyle = ICE_TOP;
      ctx.fillRect(x + 5, y + 8, 1, 2);
      ctx.fillRect(x + 11, y + 8, 1, 1);
    }
  }
}

const RAIL = '#e3a35c';
const RUNG = '#b9772f';

function ladderPart(ctx, x, y0, y1) {
  if (y1 <= y0) return;
  ctx.fillStyle = RUNG;
  for (let y = Math.ceil(y0 / 4) * 4; y < y1; y += 4) ctx.fillRect(x + 1, y, 6, 1);
  ctx.fillStyle = RAIL;
  ctx.fillRect(x, y0, 1, y1 - y0);
  ctx.fillRect(x + 7, y0, 1, y1 - y0);
}

export function drawLadder(ctx, L) {
  const top = L.yTop + 8;
  const bot = L.yBot;
  if (L.broken) {
    ladderPart(ctx, L.x, top, Math.min(top + 5, bot));
    ladderPart(ctx, L.x, Math.max(bot - 9, top), bot);
  } else {
    ladderPart(ctx, L.x, top, bot);
  }
}
