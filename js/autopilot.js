// The CPU player. It plays the penguin by looking ahead: it copies the world,
// runs the game's own update code on the copy for a couple of seconds with a
// few dozen candidate moves (follow the route, wait, jump now or a little later,
// back off) and a few possible futures, and picks the move that survives and
// gets closest to the chick. The route comes from nav.js.
//
// Modes: 'off', 'watch' (plays the whole game, starting new games by itself) and
// 'assist' (clears the current stage, then hands back). Pressing any game
// control takes over at once.
import { Nav, navKey } from './nav.js';
import { PHYS, H } from './game.js';

const NOSFX = { play() {}, toggleMute() {}, unlock() {} };
const IDLE = { mx: 0, up: false, down: false, jump: false };
const GO = { type: 'go' };
const GATE_H = 90;    // frames looked ahead when just following the route
const COARSE_H = 70;  // first pass over all candidate moves
const FULL_H = 110;   // careful pass over the best few
const LIFT_H = 160;   // careful pass while riding a lift
const LIFT_COARSE_H = 130; // first pass while riding a lift
const FALL_PEN = 20000;   // a deliberate fatal fall is never better than a hit it might dodge
const STALL_FRAMES = 420; // 7 s without getting closer: accept some risk

// Small seeded random generator, so every candidate sees the same futures.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deep copy of plain game data that keeps shared references shared. The stage
// module, the layout and the cached level picture are reused, not copied.
function clone(v, memo) {
  if (v === null || typeof v !== 'object') return v;
  let c = memo.get(v);
  if (c) return c;
  if (Array.isArray(v)) {
    c = new Array(v.length);
    memo.set(v, c);
    for (let i = 0; i < v.length; i++) c[i] = clone(v[i], memo);
    return c;
  }
  c = {};
  memo.set(v, c);
  for (const k in v) {
    if (k === 'stage' || k === 'layout') c[k] = v[k];
    else if (k !== 'layer' && k !== 'layerKey') c[k] = clone(v[k], memo);
  }
  return c;
}

// Did the penguin just die by a fatal landing or by falling off the world? That is
// a sure thing, unlike a hazard that the CPU may still dodge on the way.
const fatalFall = (s) => {
  const pl = s.player;
  // once it has dropped further than the fatal distance, any landing kills it
  return pl.y > H + 10 || pl.y - pl.fromY > PHYS.FALL_DEATH;
};

const COPY = ['score', 'level', 'lives', 'extraGiven', 'hi', 'seqIdx', 'bonus', 'bonusT', 'frame', 't'];

export class Autopilot {
  constructor(game) {
    this.game = game;
    this.mode = 'off';
    this.navs = new Map();
    this.plan = null;
    this.toast = null;
    this.onChange = null;
    this.lastState = game.state;
    this.out = { mx: 0, up: false, down: false, jump: false }; // reused scripted output
    this.search = null;
    this.alarm = 0;
    this.stall = 0;
    this.best = Infinity;
    this.progKey = '';
    game.autopilot = this;
  }

  get active() { return this.mode !== 'off'; }

  setMode(m, msg) {
    if (m === this.mode) return;
    this.mode = m;
    this.plan = null;
    this.search = null;
    if (msg) this.say(msg);
    if (this.onChange) this.onChange(m);
  }

  say(text) { this.toast = { text, t: 150 }; }

  // Called once per update step, after input.update() and before game.update().
  step(input) {
    const g = this.game;
    if (this.toast && --this.toast.t <= 0) this.toast = null;

    if (input.cpuPressed) {
      if (this.mode === 'watch') this.setMode('off', 'YOU HAVE CONTROL');
      else this.setMode('watch', 'CPU PLAYING');
    }
    if (input.helpPressed) {
      if (this.mode === 'assist') this.setMode('off', 'YOU HAVE CONTROL');
      else if (g.state === 'title' || g.state === 'gameover') this.setMode('watch', 'CPU PLAYING');
      else this.setMode('assist', 'CPU WILL CLEAR THIS STAGE');
    }

    // stage cleared or game over: hand back after 'help me'
    if (g.state !== this.lastState) {
      if (this.mode === 'assist' && (g.state === 'clear' || g.state === 'gameover')) {
        this.setMode('off', g.state === 'clear' ? 'STAGE CLEARED! YOUR TURN' : 'YOUR TURN');
      }
      this.lastState = g.state;
    }

    if (!this.active) return;
    if (input.humanPressed) { this.setMode('off', 'YOU HAVE CONTROL'); return; }

    this.watchProgress();
    let out = IDLE;
    if (g.state === 'title' && this.mode === 'watch') {
      if (g.t > 90) out = { ...IDLE, jump: true };
    } else if (g.state === 'howhigh') {
      if (g.world) this.navFor(g.world); // build the route map now, not on the first frame of play
    } else if (g.state === 'play' && !g.paused) {
      out = this.think();
    }
    input.left = out.mx < 0;
    input.right = out.mx > 0;
    input.up = !!out.up;
    input.down = !!out.down;
    input.jump = !!out.jump;
    input.jumpPressed = !!out.jump;
  }

  navFor(w) {
    const key = navKey(w);
    let nav = this.navs.get(key);
    if (!nav) {
      if (this.navs.size > 400) this.navs.clear();
      nav = new Nav(w);
      this.navs.set(key, nav);
    }
    return nav;
  }

  // --- live play -------------------------------------------------------------------

  think() {
    const g = this.game;
    const pl = g.player;
    if (pl.state === 'air' || pl.dead) { this.plan = null; this.search = null; return IDLE; }

    // second half of a search started last frame
    if (this.search) {
      const c = this.finishSearch(this.search);
      this.search = null;
      const commit = c.type === 'go' ? 6 : c.type === 'leave' ? c.k + 40 : Math.min(c.k + 2, 36);
      this.plan = { c, f: 0, commit };
    }
    // a scripted move is carried out in full
    if (this.plan && this.plan.f < this.plan.commit) return this.scriptOut(g, this.plan.c, this.plan.f++);
    this.plan = null;

    // Following the route. Every other frame, test it against one possible future;
    // if that future ends badly, start a proper search (finished next frame).
    if ((g.frame & 1) === 0 || this.alarm) {
      const r = this.run(GO, (Math.random() * 2 ** 31) | 0, this.horizon());
      if (r.dead) {
        this.alarm = 0;
        this.search = this.startSearch();
      } else if (this.alarm) this.alarm--;
    }
    return this.scriptOut(g, GO, 0);
  }

  horizon() {
    const g = this.game;
    const here = g.world.platforms[g.player.p];
    return here && here.lift !== undefined ? LIFT_H : GATE_H;
  }

  // What a candidate move presses on frame f of its script.
  scriptOut(g, c, f) {
    // reflex: something on our ladder means get off it, whatever the plan was
    const pl = g.player;
    if (pl.state === 'climb') {
      const nav = this.navFor(g.world);
      if (nav.ladderBusy(g.world, pl.ladder)) return nav.policy(g);
    }
    const o = this.out;
    switch (c.type) {
      case 'wait': if (f < c.k) return IDLE; break;
      case 'jump': if (f === c.k) { o.mx = c.dir; o.up = o.down = false; o.jump = true; return o; } break;
      case 'hold':
        if (f < c.k) return IDLE;
        if (f === c.k) { o.mx = 0; o.up = o.down = false; o.jump = true; return o; }
        break;
      case 'leave':
        if (pl.state === 'climb') { o.mx = 0; o.up = c.off === 'up'; o.down = c.off === 'down'; o.jump = false; c.t0 = f + 1; return o; }
        if (f < (c.t0 || 0) + c.k) return IDLE;
        if (f === (c.t0 || 0) + c.k) { o.mx = c.dir; o.up = o.down = false; o.jump = true; return o; }
        break;
      case 'back':
        if (f < c.k) {
          if (c.climb) { o.mx = 0; o.up = c.climb === 'up'; o.down = c.climb === 'down'; o.jump = false; }
          else { o.mx = c.dir; o.up = o.down = o.jump = false; }
          return o;
        }
        break;
    }
    return this.navFor(g.world).policy(g);
  }

  candidates(pol) {
    const pl = this.game.player;
    const fwd = pol.mx || pl.facing;
    const list = [{ type: 'go' }];
    for (const k of [6, 14, 28, 50, 90]) list.push({ type: 'wait', k });
    if (pl.state === 'climb') {
      const climb = pol.up ? 'down' : 'up';
      for (const k of [10, 22, 40]) list.push({ type: 'back', k, climb });
      // get off at the nearer end, then jump one way or the other after a short wait
      const L = pl.ladder;
      const off = pl.y - L.yTop < L.yBot - pl.y && !L.broken ? 'up' : 'down';
      for (const dir of [1, -1]) for (const k of [2, 8, 16, 26]) list.push({ type: 'leave', k, dir, off });
      return list;
    }
    for (const k of [0, 3, 6, 9, 12, 16, 20, 25, 30]) list.push({ type: 'jump', k, dir: fwd });
    for (const k of [0, 6, 14]) list.push({ type: 'jump', k, dir: 0 });
    for (const k of [0, 8]) list.push({ type: 'jump', k, dir: -fwd });
    for (const k of [4, 10, 18, 28]) list.push({ type: 'hold', k });
    for (const k of [8, 16, 28]) list.push({ type: 'back', k, dir: -fwd });
    return list;
  }

  // Phase 1: a quick look at every candidate move in one possible future.
  startSearch() {
    const g = this.game;
    const base = { score: g.score, shovel: g.player.shovel };
    const pol = this.navFor(g.world).policy(g);
    const seed0 = (Math.random() * 2 ** 31) | 0;
    const coarseH = this.horizon() === LIFT_H ? LIFT_COARSE_H : COARSE_H;
    const scored = this.candidates(pol).map((c) => ({ c, v: this.value(this.run(c, seed0, coarseH), base) }));
    scored.sort((x, y) => y.v - x.v);
    const top = scored.slice(0, 5);
    if (!top.some((t) => t.c.type === 'go')) top.push({ c: GO, v: 0 });
    return { top, base };
  }

  // Phase 2: a careful look at the best few across several futures.
  finishSearch({ top, base }) {
    const fullH = this.horizon() === LIFT_H ? LIFT_H : FULL_H;
    // seals turn at random, so look at more futures when one is close
    const pl = this.game.player;
    const sealNear = this.game.world.seals.some((h) => Math.abs(h.x - pl.x) < 70 && Math.abs(h.y - pl.y) < 50);
    const nSeeds = this.stall >= STALL_FRAMES ? 2 : sealNear ? 5 : 3;
    const seeds = Array.from({ length: nSeeds }, () => (Math.random() * 2 ** 31) | 0);
    for (const t of top) {
      let sum = 0;
      for (const sd of seeds) sum += this.value(this.run(t.c, sd, fullH), base);
      t.v = sum / seeds.length + (t.c.type === 'go' ? 2 : 0);
    }
    top.sort((x, y) => y.v - x.v);
    // stay watchful for a bit after a scare
    this.alarm = 8;
    return top[0].c;
  }

  // kept for tests: a whole search in one go
  decide() { return this.finishSearch(this.startSearch()); }

  value(r, base) {
    const pen = this.stall < STALL_FRAMES ? 1e5 : this.stall < 2 * STALL_FRAMES ? 1200 : 250;
    if (r.clear) return 1e6 - r.t;
    if (r.dead) return r.fall ? -pen - FALL_PEN : -pen + r.t * 40;
    const g = r.g;
    let v = -this.navFor(g.world).cost(g);
    v += 0.12 * (g.score - base.score);
    if (g.player.shovel > base.shovel + 10) v -= 150; // a shovel stops you jumping and climbing for 10 s
    return v;
  }

  // Track whether the route cost keeps improving; if not, take more risks to get unstuck.
  watchProgress() {
    const g = this.game;
    const key = g.level + ':' + g.seqIdx + ':' + g.lives;
    if (key !== this.progKey || g.state !== 'play') { this.progKey = key; this.best = Infinity; this.stall = 0; }
    if (g.state !== 'play' || g.paused || g.frame % 20) return;
    const c = this.navFor(g.world).cost(g);
    if (c < this.best - 4) { this.best = c; this.stall = 0; } else this.stall += 20;
  }

  // --- look-ahead ------------------------------------------------------------------

  shadow() {
    const g = this.game;
    const memo = new Map();
    const s = Object.create(Object.getPrototypeOf(g));
    s.world = clone(g.world, memo);
    s.player = clone(g.player, memo);
    for (const k of COPY) s[k] = g[k];
    s.state = 'play';
    s.paused = false;
    s.shake = 0;
    s.sfx = NOSFX;
    s.input = { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false };
    return s;
  }

  run(c, seed, horizon) {
    const s = this.shadow();
    const inp = s.input;
    const real = Math.random;
    Math.random = mulberry32(seed);
    try {
      let f = 0;
      for (; f < horizon; f++) {
        const o = this.scriptOut(s, c, f);
        inp.left = o.mx < 0; inp.right = o.mx > 0; inp.up = o.up; inp.down = o.down; inp.jumpPressed = o.jump;
        s.updatePlay();
        if (s.state === 'dying') return { dead: true, t: f, g: s, fall: fatalFall(s) };
        if (s.state === 'clear') return { clear: true, t: f, g: s };
      }
      // let a jump in progress land before judging where we are
      inp.left = inp.right = inp.up = inp.down = inp.jumpPressed = false;
      for (let k = 0; k < 90 && s.player.state === 'air'; k++) {
        s.updatePlay();
        if (s.state === 'dying') return { dead: true, t: f + k, g: s, fall: fatalFall(s) };
        if (s.state === 'clear') return { clear: true, t: f + k, g: s };
      }
      return { t: f, g: s };
    } finally {
      Math.random = real;
    }
  }
}
