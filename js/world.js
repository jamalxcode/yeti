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

// Fixed pseudo-random values so the ice texture never flickers.
const hash = (n) => {
  const v = Math.sin(n * 91.345 + 47.853) * 43758.5453;
  return v - Math.floor(v);
};

export function drawPlatform(ctx, p) {
  if (p.gaps && p.gaps.length) {
    ctx.save();
    ctx.beginPath();
    let x = p.x0;
    for (const g of [...p.gaps].sort((a, b) => a.x0 - b.x0)) {
      ctx.rect(x, -20, g.x0 - x, 300);
      x = g.x1;
    }
    ctx.rect(x, -20, p.x1 - x, 300);
    ctx.clip();
    drawLedge(ctx, p);
    ctx.restore();
  } else {
    drawLedge(ctx, p);
  }
}

// A slab of blue glacier ice with a snow cap and icicles, drawn per 16px step.
function drawLedge(ctx, p) {
  for (let x = p.x0; x < p.x1; x += SEG) {
    const w = Math.min(SEG, p.x1 - x);
    const y = surfaceY(p, x + 1);
    const seed = x * 7 + y;

    // icicles
    for (let i = 0; i < 2; i++) {
      const ix = x + 3 + hash(seed + i) * (w - 6);
      const len = 2 + hash(seed + i + 9) * 4.5;
      const g = ctx.createLinearGradient(0, y + 7, 0, y + 7 + len);
      g.addColorStop(0, 'rgba(200,236,255,0.95)');
      g.addColorStop(1, 'rgba(120,190,240,0.2)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ix - 1, y + 7);
      ctx.lineTo(ix + 1, y + 7);
      ctx.lineTo(ix, y + 7 + len);
      ctx.closePath();
      ctx.fill();
    }

    // ice body
    const body = ctx.createLinearGradient(0, y + 1, 0, y + 8);
    body.addColorStop(0, '#9fdcff');
    body.addColorStop(0.45, '#4fa6e3');
    body.addColorStop(1, '#1d5aa6');
    ctx.fillStyle = body;
    ctx.fillRect(x, y + 1, w, 7);
    // glints and cracks inside the ice
    ctx.strokeStyle = 'rgba(235,250,255,0.55)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    const cx = x + hash(seed + 3) * w;
    ctx.moveTo(cx, y + 3);
    ctx.lineTo(cx + 2.5, y + 5.5);
    ctx.lineTo(cx + 1.5, y + 7.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x, y + 3.2, w, 0.5);
    ctx.fillStyle = 'rgba(10,30,80,0.45)';
    ctx.fillRect(x, y + 7.4, w, 0.6);

    // snow cap with soft lumps
    const snow = ctx.createLinearGradient(0, y - 1.5, 0, y + 2.6);
    snow.addColorStop(0, '#ffffff');
    snow.addColorStop(1, '#cfe3f7');
    ctx.fillStyle = snow;
    ctx.beginPath();
    ctx.moveTo(x, y + 2.6);
    ctx.lineTo(x, y + 0.2);
    const bumps = Math.max(1, Math.round(w / 5));
    for (let i = 0; i < bumps; i++) {
      const bx = x + (i + 0.5) * w / bumps;
      ctx.quadraticCurveTo(bx, y - 0.8 - hash(seed + i + 20) * 0.9, x + (i + 1) * w / bumps, y + 0.2);
    }
    ctx.lineTo(x + w, y + 2.6);
    ctx.quadraticCurveTo(x + w * 0.7, y + 3.4, x + w * 0.5, y + 2.4);
    ctx.quadraticCurveTo(x + w * 0.25, y + 3.4, x, y + 2.6);
    ctx.closePath();
    ctx.fill();
    // sparkle
    if (hash(seed + 31) > 0.6) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(x + hash(seed + 32) * w, y - 0.2, 0.5, 0.5);
    }
  }
}

function ladderPart(ctx, x, y0, y1) {
  if (y1 <= y0) return;
  const rail = ctx.createLinearGradient(x, 0, x + 1.2, 0);
  rail.addColorStop(0, '#6b3f17');
  rail.addColorStop(0.5, '#c88a4a');
  rail.addColorStop(1, '#6b3f17');
  for (let y = Math.ceil(y0 / 4) * 4; y < y1; y += 4) {
    ctx.fillStyle = '#5a3412';
    ctx.fillRect(x + 1, y + 0.45, 6, 0.6);
    ctx.fillStyle = '#b97a3c';
    ctx.fillRect(x + 1, y - 0.3, 6, 0.8);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; // frost on the rung
    ctx.fillRect(x + 1.5 + ((y * 3) % 3), y - 0.5, 2, 0.35);
  }
  ctx.fillStyle = rail;
  ctx.fillRect(x - 0.2, y0, 1.2, y1 - y0);
  ctx.save();
  ctx.translate(7, 0);
  ctx.fillRect(x - 0.2, y0, 1.2, y1 - y0);
  ctx.restore();
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
