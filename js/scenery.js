// Moonlit mountain backdrop. The static part is painted once per render scale
// into an offscreen canvas; twinkling stars and falling snow are drawn live.
const W = 224;
const H = 256;

let cache = null;
let cacheScale = 0;

const hash = (n) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: hash(i) * W, y: hash(i + 300) * 150, r: 0.2 + hash(i + 600) * 0.6, tw: hash(i + 900) < 0.25,
}));

function ridge(x, base, amp, seed) {
  return base - amp * (0.55 * Math.sin(x / 29 + seed) + 0.3 * Math.sin(x / 13 + seed * 2.1) + 0.15 * Math.sin(x / 6 + seed * 3.7));
}

function mountains(g, base, amp, seed, colors, snowLine) {
  const top = base - amp;
  const grad = g.createLinearGradient(0, top - 5, 0, H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(snowLine, colors[1]);
  grad.addColorStop(Math.min(1, snowLine + 0.12), colors[2]);
  grad.addColorStop(1, colors[3]);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 1) g.lineTo(x, ridge(x, base, amp, seed));
  g.lineTo(W, H);
  g.closePath();
  g.fill();
}

function pines(g, base, seed) {
  for (let i = 0; i < 26; i++) {
    const x = hash(seed + i) * W;
    const h = 7 + hash(seed + i + 50) * 9;
    const y = ridge(x, base, 6, seed) + 2;
    g.fillStyle = '#081026';
    g.beginPath();
    g.moveTo(x, y - h);
    g.lineTo(x - h * 0.35, y);
    g.lineTo(x + h * 0.35, y);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(220,235,255,0.55)';
    g.beginPath();
    g.moveTo(x, y - h);
    g.lineTo(x - h * 0.12, y - h * 0.62);
    g.lineTo(x + h * 0.12, y - h * 0.62);
    g.closePath();
    g.fill();
  }
}

function build(scale) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);

  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#03061a');
  sky.addColorStop(0.45, '#0c1640');
  sky.addColorStop(0.8, '#1d2d66');
  sky.addColorStop(1, '#2a3c7a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  for (const s of STARS) {
    g.fillStyle = `rgba(220,230,255,${0.35 + s.r})`;
    g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
  }

  // aurora ribbons
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const yb = 70 + k * 14;
    const a = g.createLinearGradient(0, yb - 40, 0, yb + 10);
    a.addColorStop(0, 'rgba(60,255,180,0)');
    a.addColorStop(0.7, `rgba(${60 + k * 40},${220 - k * 30},${190 + k * 20},0.10)`);
    a.addColorStop(1, 'rgba(60,255,180,0)');
    g.fillStyle = a;
    g.beginPath();
    g.moveTo(0, yb);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, yb + Math.sin(x / 30 + k * 1.7) * 9 - 30 * (x / W) * (k === 1 ? 1 : 0.4));
    for (let x = W; x >= 0; x -= 4) g.lineTo(x, yb - 40 + Math.sin(x / 25 + k) * 6);
    g.closePath();
    g.fill();
  }
  g.restore();

  // moon
  const mx = 178, my = 62;
  const glow = g.createRadialGradient(mx, my, 4, mx, my, 46);
  glow.addColorStop(0, 'rgba(200,220,255,0.35)');
  glow.addColorStop(1, 'rgba(200,220,255,0)');
  g.fillStyle = glow;
  g.fillRect(mx - 46, my - 46, 92, 92);
  const moon = g.createRadialGradient(mx - 3, my - 3, 1, mx, my, 11);
  moon.addColorStop(0, '#ffffff');
  moon.addColorStop(0.7, '#e3ebf7');
  moon.addColorStop(1, '#b9c7dd');
  g.fillStyle = moon;
  g.beginPath(); g.arc(mx, my, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(150,165,195,0.45)';
  for (const [dx, dy, r] of [[-3, 2, 2.2], [4, -3, 1.6], [2, 5, 1.2], [-5, -4, 1]]) {
    g.beginPath(); g.arc(mx + dx, my + dy, r, 0, Math.PI * 2); g.fill();
  }

  // three ranges of snowy peaks, hazier with distance
  mountains(g, 150, 46, 1.3, ['#c4d4f0', '#7d92c4', '#2a3a72', '#18245a'], 0.18);
  mountains(g, 196, 38, 4.1, ['#b2c4e6', '#5c74ad', '#1a275a', '#101a45'], 0.15);
  mountains(g, 236, 18, 7.7, ['#8ea4d0', '#33467f', '#111c45', '#0b1433'], 0.2);
  pines(g, 244, 11);

  // vignette
  const v = g.createRadialGradient(W / 2, H / 2, 70, W / 2, H / 2, 190);
  v.addColorStop(0, 'rgba(0,0,10,0)');
  v.addColorStop(1, 'rgba(0,0,10,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return c;
}

export function drawScenery(ctx, scale, frame) {
  if (!cache || cacheScale !== scale) { cache = build(scale); cacheScale = scale; }
  ctx.drawImage(cache, 0, 0, W, H);
  if (!frame) return;
  for (const s of STARS) {
    if (!s.tw) continue;
    const a = 0.5 + 0.5 * Math.sin(frame / 20 + s.x);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 0.3, 0, Math.PI * 2); ctx.fill();
  }
}

// flakes: {x, y, s} with s = 0.15..0.5 (speed, also used as size/nearness)
export function drawSnowfall(ctx, flakes) {
  for (const f of flakes) {
    const r = 0.3 + (f.s - 0.15) * 3;
    ctx.fillStyle = `rgba(235,242,255,${0.45 + f.s})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
  }
}
