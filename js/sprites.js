// All art is drawn in code with canvas paths and gradients, in the game's 224x256
// coordinate space. The canvas renders at up to 4x, so shapes stay smooth and detailed.

const TAU = Math.PI * 2;

// Fixed pseudo-random table so fur and textures look organic but never flicker.
const R = Array.from({ length: 256 }, (_, i) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
});

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), rot, 0, TAU);
}
function fillEll(ctx, x, y, rx, ry, fill, rot = 0) {
  ell(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = fill;
  ctx.fill();
}
function rg(ctx, x0, y0, r0, x1, y1, r1, stops) {
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function lg(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
// Soft contact shadow on the ground.
function shadow(ctx, x, y, rx, a = 0.4) {
  fillEll(ctx, x, y + 0.2, rx, rx * 0.28, rg(ctx, x, y, 0, x, y, rx, [[0, `rgba(0,8,30,${a})`], [1, 'rgba(0,8,30,0)']]));
}
// A ring of fur tufts around an ellipse, from angle a0 to a1.
function tufts(ctx, cx, cy, rx, ry, n, len, color, a0 = 0, a1 = TAU, seed = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i + 0.5) / n + (R[(seed + i) & 255] - 0.5) * 0.25;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const bx = cx + ca * rx * 0.9;
    const by = cy + sa * ry * 0.9;
    const l = len * (0.55 + R[(seed + i * 7) & 255] * 0.8);
    const w = len * 0.5;
    ctx.moveTo(bx - sa * w, by + ca * w);
    ctx.quadraticCurveTo(bx + ca * l * 0.6 - sa * w * 0.3, by + sa * l * 0.6 + ca * w * 0.3, bx + ca * l, by + sa * l);
    ctx.quadraticCurveTo(bx + ca * l * 0.6 + sa * w * 0.3, by + sa * l * 0.6 - ca * w * 0.3, bx + sa * w, by - ca * w);
  }
  ctx.fill();
}

export function initSprites() { /* nothing to prebuild: everything is drawn live */ }

// --- penguin ---------------------------------------------------------------------

const darkFeather = (ctx, x, y, r) => rg(ctx, x - r * 0.35, y - r * 0.5, r * 0.05, x, y, r * 1.15,
  [[0, '#6474a3'], [0.4, '#232b4f'], [1, '#080b19']]);

function penguinFeet(ctx, walk, lift) {
  const g = lg(ctx, 0, -1.6 - lift, 0, -lift, [[0, '#ffb54a'], [1, '#d9620b']]);
  fillEll(ctx, -1.9 + walk * 0.9, -0.7 - lift, 2.1, 0.95, g);
  fillEll(ctx, 2.1 - walk * 0.9, -0.7 - lift, 2.1, 0.95, g);
}

function scarfBand(ctx) {
  const sg = lg(ctx, 0, -9.7, 0, -7.9, [[0, '#ff6670'], [0.5, '#e8323f'], [1, '#a5182a']]);
  roundRect(ctx, -4.1, -9.7, 8.4, 1.9, 0.9);
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  for (const sx of [-2.4, 0.2, 2.8]) { ctx.moveTo(sx, -9.6); ctx.lineTo(sx - 0.4, -8); }
  ctx.stroke();
  return sg;
}

function penguinSide(ctx, frame) {
  const walk = frame === 'walk1' ? 1 : frame === 'walk2' ? -1 : 0;
  const jump = frame === 'jump';
  ctx.save();
  ctx.rotate(walk * 0.09);
  penguinFeet(ctx, walk, jump ? 0.8 : 0);

  // body with a cool rim light so it reads against the night sky
  fillEll(ctx, 0, -6.6, 5.2, 6.4, darkFeather(ctx, 0, -6.6, 6.4));
  ell(ctx, 0, -6.6, 5.2, 6.4);
  ctx.strokeStyle = 'rgba(170,200,255,0.45)';
  ctx.lineWidth = 0.4;
  ctx.stroke();
  // belly
  fillEll(ctx, 1.6, -5.4, 3.5, 4.9, rg(ctx, 2.4, -7.4, 0.3, 1.6, -5.4, 5.6,
    [[0, '#ffffff'], [0.65, '#eef3fa'], [1, '#aebfd6']]));
  // head
  fillEll(ctx, 0.8, -12.3, 3.9, 3.7, darkFeather(ctx, 0.8, -12.3, 3.9));
  ell(ctx, 0.8, -12.3, 3.9, 3.7);
  ctx.strokeStyle = 'rgba(170,200,255,0.4)';
  ctx.stroke();
  // cheek, with a golden ear patch
  fillEll(ctx, 2.7, -12.0, 1.7, 2.1, '#f3f7fc');
  fillEll(ctx, 0.6, -11.0, 1.3, 0.7, 'rgba(255,196,80,0.9)', -0.5);
  // eye
  fillEll(ctx, 2.8, -12.9, 0.85, 0.95, '#ffffff');
  fillEll(ctx, 3.1, -12.9, 0.52, 0.62, '#0b0f1e');
  fillEll(ctx, 3.25, -13.2, 0.2, 0.2, '#ffffff');
  // beak
  ctx.beginPath();
  ctx.moveTo(4.2, -12.7);
  ctx.quadraticCurveTo(6.3, -12.3, 7.1, -11.5);
  ctx.quadraticCurveTo(5.7, -10.9, 4.2, -11.1);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, 4, -12.7, 4, -11, [[0, '#ffc860'], [1, '#df600a']]);
  ctx.fill();

  // scarf and its tail streaming behind
  const sg = scarfBand(ctx);
  const sw = jump ? 1.2 : walk * 0.5;
  ctx.beginPath();
  ctx.moveTo(-3.4, -9.3);
  ctx.quadraticCurveTo(-5.4, -8.6 - sw, -7 - Math.abs(sw), -6.6 - sw);
  ctx.lineTo(-5.8 - Math.abs(sw), -5.9 - sw);
  ctx.quadraticCurveTo(-4.6, -7.4, -2.8, -8.0);
  ctx.closePath();
  ctx.fillStyle = sg;
  ctx.fill();

  // flipper
  const fa = jump ? -1.3 : 0.2 + walk * 0.25;
  ctx.save();
  ctx.translate(-1.2, -8.3);
  ctx.rotate(fa);
  fillEll(ctx, 0, 3.2, 1.4, 3.7, lg(ctx, -1.4, 0, 1.4, 0, [[0, '#0a0d1d'], [0.6, '#2a335c'], [1, '#55648f']]));
  ctx.restore();
  ctx.restore();
}

function penguinBack(ctx) {
  penguinFeet(ctx, 0, 0);
  // flippers: one reaching up for the next rung, one down
  ctx.save();
  ctx.translate(-3.6, -9.5); ctx.rotate(2.5);
  fillEll(ctx, 0, 3.1, 1.4, 3.6, '#161c38');
  ctx.restore();
  ctx.save();
  ctx.translate(3.6, -8.2); ctx.rotate(-0.35);
  fillEll(ctx, 0, 3.1, 1.4, 3.6, '#161c38');
  ctx.restore();
  fillEll(ctx, 0, -6.6, 5.2, 6.4, darkFeather(ctx, 0, -6.6, 6.4));
  fillEll(ctx, 0, -12.3, 3.9, 3.7, darkFeather(ctx, 0, -12.3, 3.9));
  ell(ctx, 0, -6.6, 5.2, 6.4);
  ctx.strokeStyle = 'rgba(170,200,255,0.45)';
  ctx.lineWidth = 0.4;
  ctx.stroke();
  const sg = scarfBand(ctx);
  ctx.beginPath();
  ctx.moveTo(-0.6, -8.2); ctx.lineTo(1.2, -8.2); ctx.lineTo(1.6, -4.8); ctx.lineTo(0, -5.2);
  ctx.closePath();
  ctx.fillStyle = sg;
  ctx.fill();
}

// x,y = feet center.
export function drawPenguin(ctx, frame, x, y, facing = 1) {
  ctx.save();
  ctx.translate(x, y);
  if (frame !== 'jump' && frame !== 'climb') shadow(ctx, 0, 0, 5.5);
  if (facing < 0) ctx.scale(-1, 1);
  if (frame === 'climb') penguinBack(ctx);
  else penguinSide(ctx, frame);
  ctx.restore();
}

export function drawPenguinRotated(ctx, frame, x, y, facing, angle) {
  ctx.save();
  ctx.translate(x, y - 8);
  ctx.rotate(angle);
  ctx.translate(0, 8);
  if (facing < 0) ctx.scale(-1, 1);
  penguinSide(ctx, frame);
  ctx.restore();
}

export function drawLifeIcon(ctx, x, y) {
  ctx.save();
  ctx.translate(x + 3, y + 8);
  ctx.scale(0.5, 0.5);
  penguinSide(ctx, 'stand');
  ctx.restore();
}

// --- snow shovel -----------------------------------------------------------------

// Shovel pointing down +y from its grip at the origin.
function shovelShape(ctx, len) {
  ctx.fillStyle = lg(ctx, -0.6, 0, 0.6, 0, [[0, '#7a4319'], [0.5, '#c8823f'], [1, '#7a4319']]);
  ctx.fillRect(-0.55, 0, 1.1, len);
  roundRect(ctx, -2, -0.6, 4, 1.2, 0.6);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2.2, len - 0.4);
  ctx.lineTo(2.2, len - 0.4);
  ctx.lineTo(3.3, len + 5);
  ctx.quadraticCurveTo(0, len + 5.8, -3.3, len + 5);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, -3.3, 0, 3.3, 0, [[0, '#6f8299'], [0.35, '#e8f0f8'], [0.6, '#b4c3d4'], [1, '#5d6f86']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,40,60,0.6)';
  ctx.lineWidth = 0.3;
  ctx.stroke();
  fillEll(ctx, 0, len + 4.3, 2.4, 0.7, 'rgba(255,255,255,0.85)'); // snow on the blade
}

// Floating pickup with its bottom at y.
export function drawShovelItem(ctx, x, y, t) {
  const bob = Math.sin(t / 12) * 0.8;
  ctx.save();
  fillEll(ctx, x, y - 6 + bob, 6, 6, rg(ctx, x, y - 6 + bob, 0, x, y - 6 + bob, 6,
    [[0, 'rgba(255,240,170,0.35)'], [1, 'rgba(255,240,170,0)']]));
  ctx.translate(x, y - 13 + bob);
  ctx.rotate(Math.sin(t / 20) * 0.15);
  shovelShape(ctx, 7);
  ctx.restore();
}

// Shovel held by the penguin: raised overhead or swung down in front.
export function drawShovelHeld(ctx, x, y, facing, raised) {
  ctx.save();
  if (raised) {
    ctx.translate(x + facing * 2, y - 12);
    ctx.rotate(Math.PI + facing * 0.15);
  } else {
    ctx.translate(x + facing * 3, y - 9);
    ctx.rotate(-facing * Math.PI / 2 + facing * 0.25);
  }
  shovelShape(ctx, 9);
  ctx.restore();
}

// --- snowballs and ice boulders ---------------------------------------------------

export function drawSnowball(ctx, x, y, kind, rot, withShadow = true) {
  const cy = y - 5;
  if (withShadow) shadow(ctx, x, y, 5, 0.45);
  if (kind === 'ice') {
    fillEll(ctx, x, cy, 5, 5, rg(ctx, x - 1.8, cy - 2, 0.3, x, cy, 5.4,
      [[0, '#e6f6ff'], [0.35, '#7cc4ff'], [0.8, '#2f7ad8'], [1, '#173f91']]));
    ctx.save();
    ctx.beginPath(); ctx.arc(x, cy, 5, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(220,245,255,0.55)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rot + i * 1.6;
      ctx.moveTo(x, cy);
      ctx.lineTo(x + Math.cos(a) * 6, cy + Math.sin(a) * 6);
    }
    ctx.stroke();
    ctx.restore();
    fillEll(ctx, x - 1.7, cy - 2, 1.4, 0.8, 'rgba(255,255,255,0.85)', -0.6);
  } else {
    fillEll(ctx, x, cy, 5, 5, rg(ctx, x - 1.8, cy - 2.2, 0.3, x, cy, 5.3,
      [[0, '#ffffff'], [0.55, '#e4eef9'], [0.85, '#a9c3e2'], [1, '#7f9cc4']]));
    // packed-snow lumps that turn as it rolls
    ctx.fillStyle = 'rgba(140,170,210,0.45)';
    for (let i = 0; i < 5; i++) {
      const a = rot + i * 1.26;
      const r = 1.8 + R[i * 9] * 2;
      ell(ctx, x + Math.cos(a) * r, cy + Math.sin(a) * r, 0.7, 0.5, a);
      ctx.fill();
    }
    fillEll(ctx, x - 1.6, cy - 2, 1.5, 1, 'rgba(255,255,255,0.9)', -0.6);
  }
}

// --- yeti ------------------------------------------------------------------------

const FUR_LIGHT = '#f7fafd';
const FUR_MID = '#d4dfeb';
const FUR_SHADE = '#9fb2c9';
const furGrad = (ctx, x, y, r) => rg(ctx, x - r * 0.4, y - r * 0.5, r * 0.1, x, y, r * 1.1,
  [[0, FUR_LIGHT], [0.55, FUR_MID], [1, FUR_SHADE]]);

function yetiArm(ctx, sx, sy, ang, len, seed) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  tufts(ctx, 0, len / 2, 3.4, len / 2, 14, 1.6, FUR_SHADE, 0, TAU, seed);
  fillEll(ctx, 0, len / 2, 3.4, len / 2 + 0.5, furGrad(ctx, 0, len / 2, len / 2));
  // big hand with a leathery palm
  fillEll(ctx, 0, len + 0.6, 3, 2.6, furGrad(ctx, 0, len + 0.6, 3));
  fillEll(ctx, 0, len + 1.6, 2, 1.3, '#5f7f9f');
  ctx.restore();
}

// x,y = feet center. pose: idle | grab | hold | throw | roar | climb | carry
export function drawYeti(ctx, x, y, pose = 'idle', t = 0, facing = 1) {
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 0, 14, 0.45);
  if (facing < 0) ctx.scale(-1, 1);
  const climbing = pose === 'climb' || pose === 'carry';
  const step = climbing ? Math.sin(t / 5) : 0;
  const breathe = Math.sin(t / 18) * 0.4;

  // arms behind the body when raised
  let armL = 0.35;
  let armR = -0.35;
  let up = false;
  switch (pose) {
    case 'grab': armL = 1.35; break;
    case 'hold': armL = Math.PI - 0.45; armR = -(Math.PI - 0.45); up = true; break;
    case 'roar': {
      const w = Math.sin(t / 3) * 0.2;
      armL = Math.PI - 0.6 + w; armR = -(Math.PI - 0.6) + w; up = true; break;
    }
    case 'throw': armR = -1.45; break;
    case 'climb': case 'carry':
      armL = Math.PI - 0.35 + step * 0.25; armR = -(Math.PI - 0.35) + step * 0.25; up = true; break;
  }
  if (up) { yetiArm(ctx, -8, -21, armL, 12, 10); yetiArm(ctx, 8, -21, armR, 12, 40); }

  // legs and feet
  for (const s of [-1, 1]) {
    const lift = climbing ? Math.max(0, s * step) * 2 : 0;
    tufts(ctx, s * 5.5, -5 - lift, 4.4, 5.5, 12, 1.4, FUR_SHADE, 0, TAU, 70 + s * 9);
    fillEll(ctx, s * 5.5, -5 - lift, 4.4, 5.6, furGrad(ctx, s * 5.5, -5 - lift, 5.6));
    fillEll(ctx, s * 5.8, -1 - lift, 4.8, 1.6, lg(ctx, 0, -2.6 - lift, 0, 0.6 - lift, [[0, '#7f97b5'], [1, '#4d6585']]));
  }

  // body: shaggy fur
  tufts(ctx, 0, -15.5 + breathe, 11, 11, 34, 2.4, FUR_SHADE, 0, TAU, 3);
  tufts(ctx, 0, -15.5 + breathe, 10.5, 10.5, 30, 1.8, FUR_MID, Math.PI * 1.05, Math.PI * 1.95, 17);
  fillEll(ctx, 0, -15.5 + breathe, 11, 11, furGrad(ctx, 0, -15.5 + breathe, 11));
  // chest
  fillEll(ctx, 0, -13 + breathe, 6.8, 7.4, rg(ctx, -1, -15, 0.5, 0, -13, 8,
    [[0, '#ffffff'], [0.7, '#e7eef6'], [1, 'rgba(200,214,230,0)']]));
  ctx.strokeStyle = 'rgba(150,170,195,0.5)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const fx = -6 + i * 1.5;
    const fy = -18 + (i % 3) * 3 + breathe;
    ctx.moveTo(fx, fy); ctx.lineTo(fx + 0.4, fy + 2);
  }
  ctx.stroke();

  // head
  tufts(ctx, 0, -27, 7.6, 6.8, 22, 1.9, FUR_MID, Math.PI * 0.95, Math.PI * 2.05, 29);
  fillEll(ctx, 0, -26.5, 7.6, 6.8, furGrad(ctx, 0, -26.5, 7.6));
  if (pose === 'climb') {
    tufts(ctx, 0, -26, 5, 4, 12, 1.4, FUR_SHADE, 0, TAU, 51);
  } else {
    // face
    fillEll(ctx, 0, -25.3, 5.1, 4.7, rg(ctx, -1.2, -27, 0.3, 0, -25.3, 5.4,
      [[0, '#a8c8e4'], [0.6, '#7299bf'], [1, '#4b6f96']]));
    // heavy brow
    ctx.fillStyle = '#3b5778';
    ctx.beginPath();
    ctx.moveTo(-4.3, -28.3); ctx.quadraticCurveTo(-2, -27, -0.4, -27.2);
    ctx.lineTo(0.4, -27.2); ctx.quadraticCurveTo(2, -27, 4.3, -28.3);
    ctx.lineTo(4, -27.2); ctx.quadraticCurveTo(2, -26.2, 0, -26.5); ctx.quadraticCurveTo(-2, -26.2, -4, -27.2);
    ctx.closePath();
    ctx.fill();
    // glowing eyes
    for (const s of [-1, 1]) {
      fillEll(ctx, s * 2.2, -26.1, 1.25, 0.9, '#f4fbff');
      fillEll(ctx, s * 2.0, -26.0, 0.65, 0.7, pose === 'roar' ? '#c2182d' : '#0d1626');
      fillEll(ctx, s * 1.8, -26.3, 0.22, 0.22, '#ffffff');
    }
    // nose
    fillEll(ctx, 0, -24.4, 1.3, 0.8, '#2d4563');
    fillEll(ctx, -0.4, -24.6, 0.3, 0.2, 'rgba(255,255,255,0.6)');
    if (pose === 'roar') {
      fillEll(ctx, 0, -21.8, 2.9, 2, '#4a0b18');
      fillEll(ctx, 0, -21.1, 1.6, 0.8, '#d4566a');
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (const s of [-1, 1]) {
        ctx.moveTo(s * 2.2, -23.3); ctx.lineTo(s * 1.4, -23.3); ctx.lineTo(s * 1.8, -21.8);
        ctx.moveTo(s * 2.2, -20.3); ctx.lineTo(s * 1.4, -20.3); ctx.lineTo(s * 1.8, -21.5);
      }
      ctx.fill();
    } else {
      ctx.strokeStyle = '#1d2e47';
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(-2, -22.3); ctx.quadraticCurveTo(0, -23, 2, -22.3);
      ctx.stroke();
    }
  }

  if (!up) {
    yetiArm(ctx, -9, -21, armL, 13, 10);
    yetiArm(ctx, 9, -21, armR, 13, 40);
  }
  ctx.restore();
  if (pose === 'hold') drawSnowball(ctx, x, y - 34, 'snow', 0, false);
}

// --- baby penguin chick ------------------------------------------------------------

export function drawChick(ctx, x, y, t, scared = true) {
  const flap = scared ? Math.sin(t / 3) : 0;
  const hop = scared ? Math.max(0, Math.sin(t / 8)) * 0.8 : 0;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 0, 4);
  ctx.translate(0, -hop);
  const fluff = (cx, cy, r) => rg(ctx, cx - r * 0.4, cy - r * 0.5, 0.2, cx, cy, r * 1.1,
    [[0, '#fff6c2'], [0.5, '#ffd84a'], [1, '#d99a17']]);
  fillEll(ctx, -1.2, -0.4, 1.3, 0.6, '#ff9a1f');
  fillEll(ctx, 1.2, -0.4, 1.3, 0.6, '#ff9a1f');
  tufts(ctx, 0, -4, 3.8, 3.8, 16, 0.9, '#f5c63a', 0, TAU, 90);
  fillEll(ctx, 0, -4, 3.8, 3.8, fluff(0, -4, 3.8));
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 3.2, -4.6);
    ctx.rotate(s * (0.4 + flap * 0.6));
    fillEll(ctx, 0, 1.4, 0.9, 1.8, '#e9b42c');
    ctx.restore();
  }
  tufts(ctx, 0, -8.8, 2.8, 2.7, 10, 0.8, '#f5c63a', Math.PI, TAU, 120);
  fillEll(ctx, 0, -8.6, 2.8, 2.7, fluff(0, -8.6, 2.8));
  for (const s of [-1, 1]) {
    fillEll(ctx, s * 1.1, -9.1, 0.5, 0.6, '#101830');
    fillEll(ctx, s * 1.1 - 0.15, -9.3, 0.15, 0.15, '#ffffff');
  }
  ctx.beginPath();
  ctx.moveTo(-0.8, -8.2); ctx.lineTo(0.8, -8.2); ctx.lineTo(0, -7.2);
  ctx.closePath();
  ctx.fillStyle = '#ff8a1a';
  ctx.fill();
  ctx.restore();
}

// --- seal --------------------------------------------------------------------------

export function drawSeal(ctx, x, y, dir, t) {
  const bob = Math.abs(Math.sin(t / 6)) * 0.9;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 0, 8);
  if (dir < 0) ctx.scale(-1, 1);
  ctx.translate(0, -bob);
  const skin = (cx, cy, r) => rg(ctx, cx - r * 0.3, cy - r * 0.6, 0.3, cx, cy, r * 1.2,
    [[0, '#b7c4d4'], [0.5, '#7b8aa0'], [1, '#424e63']]);
  // tail flippers
  ctx.fillStyle = '#4a566b';
  ctx.beginPath();
  ctx.moveTo(-6.5, -2.2); ctx.lineTo(-10.2, -4 - bob * 0.5); ctx.lineTo(-9.6, -1.6);
  ctx.lineTo(-10.2, 0.2 + bob * 0.3); ctx.closePath();
  ctx.fill();
  // body
  fillEll(ctx, -1.2, -3.8, 7.2, 3.9, skin(-1.2, -3.8, 7.2), -0.08);
  fillEll(ctx, 0, -1.8, 5.5, 1.8, 'rgba(220,228,238,0.55)');
  ctx.fillStyle = 'rgba(50,60,80,0.45)';
  for (let i = 0; i < 6; i++) { ell(ctx, -5 + i * 1.8, -5 + R[i * 5] * 2, 0.5, 0.4); ctx.fill(); }
  // head
  fillEll(ctx, 5.2, -7.2, 3.5, 3.2, skin(5.2, -7.2, 3.5));
  fillEll(ctx, 7.4, -6.4, 1.9, 1.4, '#a9b6c7');
  fillEll(ctx, 8.8, -6.9, 0.6, 0.45, '#141a26');
  // angry eye
  fillEll(ctx, 6.1, -8.1, 0.75, 0.75, '#0b0f18');
  fillEll(ctx, 6.3, -8.35, 0.22, 0.22, '#ffffff');
  ctx.strokeStyle = '#d63a4a';
  ctx.lineWidth = 0.55;
  ctx.beginPath(); ctx.moveTo(4.8, -9.8); ctx.lineTo(7.1, -8.9); ctx.stroke();
  // whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  for (const d of [-0.6, 0, 0.6]) { ctx.moveTo(8.2, -6.3); ctx.lineTo(10.6, -6.3 + d * 1.6); }
  ctx.stroke();
  // front flipper
  ctx.save();
  ctx.translate(2.2, -2.2);
  ctx.rotate(0.5 + Math.sin(t / 6) * 0.4);
  fillEll(ctx, 0, 1.4, 0.9, 1.8, '#4a566b');
  ctx.restore();
  ctx.restore();
}

// --- seal hole ---------------------------------------------------------------------

export function drawSealHole(ctx, x, y, t) {
  fillEll(ctx, x, y + 0.5, 12, 3.6, lg(ctx, 0, y - 3, 0, y + 4, [[0, '#ffffff'], [1, '#bcd6ee']]));
  fillEll(ctx, x, y + 0.9, 9.5, 2.6, rg(ctx, x, y + 1.5, 0.5, x, y + 0.9, 10,
    [[0, '#071a3a'], [0.7, '#0e3263'], [1, '#2d6aa8']]));
  ctx.strokeStyle = 'rgba(140,200,255,0.45)';
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 2; i++) {
    const k = ((t / 50 + i * 0.5) % 1);
    ell(ctx, x, y + 1, 2 + k * 7, 0.6 + k * 1.8);
    ctx.globalAlpha = 1 - k;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// --- hearts, effects -------------------------------------------------------------

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + 6 * s);
  ctx.bezierCurveTo(x - 7 * s, y + 1 * s, x - 4 * s, y - 4 * s, x, y - 0.5 * s);
  ctx.bezierCurveTo(x + 4 * s, y - 4 * s, x + 7 * s, y + 1 * s, x, y + 6 * s);
  ctx.closePath();
}

export function drawHeart(ctx, x, y, broken = false) {
  const g = rg(ctx, x - 1.5, y + 0.5, 0.3, x, y + 2, 6, [[0, '#ffc0cc'], [0.4, '#ff4a6a'], [1, '#b0102e']]);
  if (!broken) {
    fillEll(ctx, x, y + 2.5, 8, 8, rg(ctx, x, y + 2.5, 0, x, y + 2.5, 8, [[0, 'rgba(255,80,120,0.35)'], [1, 'rgba(255,80,120,0)']]));
    heartPath(ctx, x, y + 1, 1);
    ctx.fillStyle = g;
    ctx.fill();
    return;
  }
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 1.8, 0);
    ctx.rotate(s * 0.25);
    ctx.beginPath();
    ctx.rect(s < 0 ? x - 8 : x, y - 6, 8, 14);
    ctx.clip();
    heartPath(ctx, x, y + 1, 1);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
}

export function drawPoof(ctx, x, y, t) {
  const k = t / 20;
  for (let i = 0; i < 10; i++) {
    const a = i * TAU / 10 + R[i] * 0.5;
    const r = 2 + k * (7 + R[i + 20] * 4);
    ctx.globalAlpha = 1 - k;
    fillEll(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, 1.4 * (1 - k * 0.5), 1.4 * (1 - k * 0.5), '#ffffff');
  }
  ctx.globalAlpha = 1;
}

// --- stage 4: ice bolts ----------------------------------------------------------

// A frosted brass bolt plugged into the ledge; x = center, y = ledge surface.
export function drawBolt(ctx, x, y, t) {
  const cy = y + 3.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 + Math.PI / 6;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 4.2, cy + Math.sin(a) * 4.2);
  }
  ctx.closePath();
  ctx.fillStyle = lg(ctx, x - 4, cy - 4, x + 4, cy + 4, [[0, '#fff1b0'], [0.4, '#f0b53a'], [1, '#8a5a10']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,0,0.7)';
  ctx.lineWidth = 0.35;
  ctx.stroke();
  fillEll(ctx, x, cy, 1.8, 1.8, rg(ctx, x + 0.5, cy + 0.5, 0.2, x, cy, 2, [[0, '#5d3a06'], [1, '#c48a26']]));
  fillEll(ctx, x - 1.6, cy - 2.6, 1.6, 0.6, 'rgba(240,250,255,0.9)', -0.4);
  const glint = (t % 120) / 120;
  if (glint < 0.25) {
    ctx.globalAlpha = 1 - glint * 4;
    fillEll(ctx, x + 2, cy - 2, 0.4, 2.2, '#ffffff');
    fillEll(ctx, x + 2, cy - 2, 2.2, 0.4, '#ffffff');
    ctx.globalAlpha = 1;
  }
}

// --- bonus items (x = center, y = surface they sit on) ---------------------------

function itemGlow(ctx, x, y) {
  fillEll(ctx, x, y - 4, 7, 6, rg(ctx, x, y - 4, 0, x, y - 4, 7, [[0, 'rgba(255,240,170,0.3)'], [1, 'rgba(255,240,170,0)']]));
  shadow(ctx, x, y, 5);
}

export function drawScarf(ctx, x, y) {
  itemGlow(ctx, x, y);
  const g = lg(ctx, x, y - 7, x, y, [[0, '#ff6670'], [1, '#a5182a']]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 5.5);
  ctx.bezierCurveTo(x - 2, y - 8, x + 1, y - 3.5, x + 5, y - 6);
  ctx.lineTo(x + 5.5, y - 3.5);
  ctx.bezierCurveTo(x + 1.5, y - 1.2, x - 2, y - 5.6, x - 5.5, y - 3);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, x + 2.6, y - 4.6, 2.2, 4.4, 0.6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (const sx of [-3.5, -0.5, 2.5]) { ctx.moveTo(sx, y - 6.6 + Math.sin(sx) * 0.6); ctx.lineTo(sx + 0.3, y - 4); }
  ctx.moveTo(x + 2.7, y - 1.2); ctx.lineTo(x + 4.7, y - 1.2);
  ctx.stroke();
}

export function drawMittens(ctx, x, y) {
  itemGlow(ctx, x, y);
  for (const [ox, rot] of [[-3, -0.2], [3, 0.2]]) {
    ctx.save();
    ctx.translate(x + ox, y - 4);
    ctx.rotate(rot);
    fillEll(ctx, 0, -1, 2.5, 3, lg(ctx, -2.5, -4, 2.5, 2, [[0, '#8fd0ff'], [1, '#1f66c8']]));
    fillEll(ctx, (ox < 0 ? -1 : 1) * 2.1, -0.4, 0.9, 1.4, '#3a86e0');
    roundRect(ctx, -2.4, 1.4, 4.8, 2, 0.8);
    ctx.fillStyle = '#f4f8ff';
    ctx.fill();
    ctx.restore();
  }
}

export function drawFish(ctx, x, y) {
  itemGlow(ctx, x, y);
  ctx.beginPath();
  ctx.moveTo(x + 3.5, y - 3.2);
  ctx.lineTo(x + 6.5, y - 5.6);
  ctx.lineTo(x + 6.2, y - 0.8);
  ctx.closePath();
  ctx.fillStyle = '#7f93ac';
  ctx.fill();
  fillEll(ctx, x - 0.5, y - 3.2, 4.6, 2.3, lg(ctx, x, y - 5.5, x, y - 0.9, [[0, '#e6eef7'], [0.5, '#a8b9cc'], [1, '#62758e']]));
  ctx.strokeStyle = 'rgba(80,100,130,0.6)';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.arc(x - 2.4, y - 3.2, 1.8, -1, 1);
  ctx.stroke();
  fillEll(ctx, x - 3.4, y - 3.7, 0.55, 0.55, '#101830');
  fillEll(ctx, x - 0.5, y - 4.3, 2.4, 0.5, 'rgba(255,255,255,0.7)');
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// Little stars circling a dazed head.
export function drawDizzy(ctx, x, y, t) {
  for (let i = 0; i < 3; i++) {
    const a = t / 10 + i * 2.1;
    star(ctx, x + Math.cos(a) * 12, y + Math.sin(a) * 3, 1.8);
    ctx.fillStyle = '#ffd84a';
    ctx.fill();
  }
}
