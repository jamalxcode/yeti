// All art is drawn in code: the penguin from pixel strings, everything else from rectangles.

const PAL = { k: '#262c4a', w: '#f4f8ff', o: '#ff9a1f', r: '#e83a4a' };
const OUTLINE = 'rgba(150,175,255,0.85)';

const STAND = [
  '................',
  '......kkkk......',
  '.....kkkkkk.....',
  '....kkkkkkkk....',
  '....kkkkkkwk....',
  '....kkkkkkkkoo..',
  '....kkkkkkkoo...',
  '....rrrrrrrr....',
  '...kkkwwwwwk....',
  '..kkkwwwwwwwk...',
  '..kkkwwwwwwwk...',
  '...kkwwwwwwwk...',
  '....kwwwwwwk....',
  '....kkwwwwkk....',
  '.....kkkkkk.....',
  '....ooo..ooo....',
];

const withRows = (base, rows) => base.map((r, i) => rows[i] ?? r);

const FRAMES = {
  stand: STAND,
  walk1: withRows(STAND, { 15: '...ooo....ooo...' }),
  walk2: withRows(STAND, { 9: '...kkwwwwwwwk...', 10: '..kkkwwwwwwwk...', 15: '.....oooooo.....' }),
  jump: withRows(STAND, { 9: 'kkkkwwwwwwwk....', 10: 'k..kwwwwwwwk....', 15: '....oooooo......' }),
  climb: [
    '................',
    '......kkkk......',
    '.....kkkkkk.....',
    '..kk.kkkkkk.....',
    '..kkkkkkkkkk....',
    '...kkkkkkkkk....',
    '....kkkkkkkk....',
    '....rrrrrrrr....',
    '....kkkkkkkkk...',
    '....kkkkkkkkkk..',
    '....kkkkkkkk.kk.',
    '....kkkkkkkk....',
    '....kkkkkkkk....',
    '.....kkkkkk.....',
    '.....kkkkkk.....',
    '....oo....oo....',
  ],
};

// Each frame becomes an 18x18 canvas (1px outline margin), in both facings.
const built = {};

function buildFrame(rows, flip) {
  const c = document.createElement('canvas');
  c.width = 18; c.height = 18;
  const g = c.getContext('2d');
  const at = (x, y) => {
    if (y < 0 || y > 15 || x < 0 || x > 15) return '.';
    return rows[y][flip ? 15 - x : x] || '.';
  };
  for (let y = -1; y <= 16; y++) {
    for (let x = -1; x <= 16; x++) {
      const ch = at(x, y);
      if (ch !== '.') {
        g.fillStyle = PAL[ch];
      } else if (at(x - 1, y) !== '.' || at(x + 1, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '.') {
        g.fillStyle = OUTLINE;
      } else continue;
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  return c;
}

export function initSprites() {
  for (const [name, rows] of Object.entries(FRAMES)) {
    built[name] = { 1: buildFrame(rows, false), [-1]: buildFrame(rows, true) };
  }
}

// x,y = feet center.
export function drawPenguin(ctx, frame, x, y, facing = 1) {
  ctx.drawImage(built[frame][facing < 0 ? -1 : 1], Math.round(x) - 9, Math.round(y) - 17);
}

export function drawPenguinRotated(ctx, frame, x, y, facing, angle) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y) - 8);
  ctx.rotate(angle);
  ctx.drawImage(built[frame][facing < 0 ? -1 : 1], -9, -9);
  ctx.restore();
}

export function drawLifeIcon(ctx, x, y) {
  ctx.fillStyle = PAL.k; ctx.fillRect(x + 1, y, 4, 7); ctx.fillRect(x, y + 2, 6, 4);
  ctx.fillStyle = PAL.w; ctx.fillRect(x + 2, y + 3, 3, 3);
  ctx.fillStyle = PAL.o; ctx.fillRect(x + 5, y + 1, 1, 1); ctx.fillRect(x + 1, y + 7, 4, 1);
}

// --- snow shovel ---------------------------------------------------------------
const HANDLE = '#a8662c';
const BLADE = '#c9d4e0';
const BLADE_DARK = '#7d8ea3';

// Floating pickup, drawn with its bottom at y.
export function drawShovelItem(ctx, x, y, t) {
  const bob = (t >> 4) & 1;
  x = Math.round(x); y = Math.round(y) - bob;
  ctx.fillStyle = HANDLE;
  ctx.fillRect(x - 2, y - 12, 4, 1);
  ctx.fillRect(x, y - 12, 1, 8);
  ctx.fillStyle = BLADE;
  ctx.fillRect(x - 2, y - 4, 5, 4);
  ctx.fillStyle = BLADE_DARK;
  ctx.fillRect(x - 2, y - 1, 5, 1);
}

// Shovel held by the penguin: raised overhead or swung down in front.
export function drawShovelHeld(ctx, x, y, facing, raised) {
  x = Math.round(x); y = Math.round(y);
  if (raised) {
    ctx.fillStyle = HANDLE;
    ctx.fillRect(x + facing * 2, y - 26, 1, 12);
    ctx.fillStyle = BLADE;
    ctx.fillRect(x + facing * 2 - 3, y - 30, 7, 5);
    ctx.fillStyle = BLADE_DARK;
    ctx.fillRect(x + facing * 2 - 3, y - 30, 7, 1);
  } else {
    ctx.fillStyle = HANDLE;
    const hx = facing > 0 ? x + 5 : x - 15;
    ctx.fillRect(hx, y - 9, 10, 1);
    ctx.fillStyle = BLADE;
    const bx = facing > 0 ? x + 14 : x - 19;
    ctx.fillRect(bx, y - 12, 5, 7);
    ctx.fillStyle = BLADE_DARK;
    ctx.fillRect(facing > 0 ? bx + 4 : bx, y - 12, 1, 7);
  }
}

// --- snowballs -------------------------------------------------------------------
const BALL_ROWS = [4, 8, 10, 10, 10, 10, 10, 10, 8, 4];

export function drawSnowball(ctx, x, y, kind, rot) {
  x = Math.round(x); y = Math.round(y);
  const ice = kind === 'ice';
  const main = ice ? '#4aa3ff' : '#f0f6ff';
  const shade = ice ? '#1f5fbf' : '#a9c4e0';
  BALL_ROWS.forEach((w, i) => {
    ctx.fillStyle = i > 6 ? shade : main;
    ctx.fillRect(x - w / 2, y - 10 + i, w, 1);
  });
  ctx.fillStyle = shade;
  ctx.fillRect(x + 3, y - 7, 1, 4);
  ctx.fillStyle = ice ? '#dff0ff' : '#7f9fc4';
  const a = rot;
  ctx.fillRect(Math.round(x + Math.cos(a) * 3) - 1, Math.round(y - 5 + Math.sin(a) * 3) - 1, 2, 2);
  ctx.fillRect(Math.round(x + Math.cos(a + Math.PI) * 2), Math.round(y - 5 + Math.sin(a + Math.PI) * 2), 1, 1);
}

// --- yeti ------------------------------------------------------------------------
const FUR = '#f2f6fa';
const FUR_SH = '#c3d2e2';
const SKIN = '#7aa6c9';
const DARK = '#101830';

// x,y = feet center. pose: idle | grab | hold | throw | roar | climb | carry
export function drawYeti(ctx, x, y, pose = 'idle', t = 0, facing = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (facing < 0) ctx.scale(-1, 1);
  const o = -16, top = -32;
  const R = (c, rx, ry, w, h) => { ctx.fillStyle = c; ctx.fillRect(o + rx, top + ry, w, h); };

  const climbing = pose === 'climb' || pose === 'carry';
  const step = climbing ? ((t >> 3) & 1) : 0;
  // legs
  R(FUR, 8, 24 - step * 2, 6, 8); R(FUR, 18, 24 - (1 - step) * 2, 6, 8);
  R(FUR_SH, 7, 30 - step * 2, 8, 2); R(FUR_SH, 17, 30 - (1 - step) * 2, 8, 2);
  // body
  R(FUR, 6, 10, 20, 16);
  R('#dfe8f0', 10, 14, 12, 10);
  R(FUR_SH, 6, 10, 2, 16);
  // head
  R(FUR, 9, 1, 14, 11); R(FUR, 11, 0, 10, 1); R(FUR_SH, 9, 1, 1, 11);
  if (climbing && pose === 'climb') {
    // back of the head
    R(FUR_SH, 12, 4, 8, 5);
  } else {
    R(SKIN, 11, 4, 10, 7);
    R(DARK, 12, 5, 2, 2); R(DARK, 18, 5, 2, 2);
    R(DARK, 11, 4, 3, 1); R(DARK, 18, 4, 3, 1);
    R('#ffffff', 12, 5, 1, 1); R('#ffffff', 18, 5, 1, 1);
    if (pose === 'roar') {
      R('#b03040', 13, 8, 6, 3); R('#ffffff', 13, 8, 6, 1);
    } else {
      R(DARK, 13, 9, 6, 1);
    }
  }
  // arms
  const armL = (rx, ry, w, h) => { R(FUR, rx, ry, w, h); };
  switch (pose) {
    case 'grab': armL(-2, 16, 9, 5); R(FUR_SH, -2, 19, 3, 2); armL(25, 11, 5, 13); break;
    case 'hold': case 'roar': {
      const lift = pose === 'roar' ? ((t >> 2) & 1) : 0;
      armL(3, -3 + lift, 5, 14); armL(24, -3 + (1 - lift), 5, 14);
      R(FUR_SH, 3, -3 + lift, 5, 2); R(FUR_SH, 24, -3 + (1 - lift), 5, 2);
      break;
    }
    case 'throw': armL(2, 11, 5, 13); armL(25, 12, 10, 5); R(FUR_SH, 32, 12, 3, 5); break;
    case 'climb': case 'carry':
      armL(3, -2 + step * 3, 5, 14); armL(24, -2 + (1 - step) * 3, 5, 14);
      break;
    default: armL(2, 11, 5, 13); armL(25, 11, 5, 13); R(FUR_SH, 2, 21, 5, 3); R(FUR_SH, 25, 21, 5, 3);
  }
  ctx.restore();
  if (pose === 'hold') drawSnowball(ctx, x, y - 34, 'snow', 0);
}

// --- baby penguin chick ----------------------------------------------------------
export function drawChick(ctx, x, y, t, scared = true) {
  x = Math.round(x); y = Math.round(y);
  const flap = scared ? (t >> 3) & 1 : 0;
  ctx.fillStyle = '#ffd84a';
  ctx.fillRect(x - 4, y - 7, 8, 7);
  ctx.fillRect(x - 3, y - 11, 6, 4);
  ctx.fillStyle = '#e8b52a';
  ctx.fillRect(x - 5, y - 6 - flap * 2, 1, 3);
  ctx.fillRect(x + 4, y - 6 - flap * 2, 1, 3);
  ctx.fillStyle = DARK;
  ctx.fillRect(x - 2, y - 10, 1, 1); ctx.fillRect(x + 1, y - 10, 1, 1);
  ctx.fillStyle = '#ff9a1f';
  ctx.fillRect(x - 1, y - 9, 2, 1);
  ctx.fillRect(x - 3, y, 2, 1); ctx.fillRect(x + 1, y, 2, 1);
}

// --- seal ------------------------------------------------------------------------
export function drawSeal(ctx, x, y, dir, t) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y) - ((t >> 3) & 1));
  if (dir < 0) ctx.scale(-1, 1);
  const R = (c, rx, ry, w, h) => { ctx.fillStyle = c; ctx.fillRect(rx, ry, w, h); };
  R('#a7b4c4', -8, -8, 16, 1);
  R('#6b7c93', -6, -8, 12, 7); R('#6b7c93', -4, -9, 8, 1);
  R('#a9b8c9', -4, -3, 9, 2);
  R('#6b7c93', 3, -11, 6, 6);
  R(DARK, 8, -9, 1, 1);
  R(DARK, 5, -10, 1, 1);
  R('#ff4a4a', 4, -11, 3, 1);
  R('#ffffff', 7, -7, 2, 1);
  R('#4f5e73', -8, -4, 3, 2); R('#4f5e73', -9, -6, 1, 2);
  R('#4f5e73', 1 + ((t >> 3) & 1), -1, 3, 1);
  ctx.restore();
}

// --- seal hole -------------------------------------------------------------------
// A hole cut into the ice with dark water; x,y = center of the ledge surface.
export function drawSealHole(ctx, x, y, t) {
  ctx.fillStyle = '#eef8ff'; // snow rim
  ctx.fillRect(x - 12, y - 3, 24, 3);
  ctx.fillRect(x - 10, y - 4, 20, 1);
  ctx.fillStyle = '#06142e';
  ctx.fillRect(x - 10, y - 2, 20, 6);
  ctx.fillRect(x - 8, y + 4, 16, 2);
  ctx.fillStyle = '#2e6fb3';
  const w = (t >> 4) & 1;
  ctx.fillRect(x - 7 + w * 2, y, 5, 1);
  ctx.fillRect(x + 1 - w * 2, y + 2, 5, 1);
  ctx.fillStyle = '#9fd8ff';
  ctx.fillRect(x - 9, y - 2, 2, 1);
}

// --- misc ------------------------------------------------------------------------
export function drawHeart(ctx, x, y, broken = false) {
  const rows = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
  ctx.fillStyle = '#ff4a6a';
  rows.forEach((r, j) => {
    for (let i = 0; i < 7; i++) {
      if (r[i] !== 'x') continue;
      const off = broken ? (i < 4 ? -2 : 2) : 0;
      if (broken && i === 3) continue;
      ctx.fillRect(Math.round(x) - 3 + i + off, Math.round(y) + j, 1, 1);
    }
  });
}

export function drawPoof(ctx, x, y, t) {
  const r = 2 + t / 3;
  ctx.fillStyle = t < 10 ? '#ffffff' : '#a9c4e0';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 2, 2);
  }
}
