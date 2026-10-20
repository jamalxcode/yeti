// Route map for the autopilot.
// The ledges are cut into walkable segments (stage 4's pulled bolts leave gaps).
// Points of interest on them — ladder feet and tops, jump-off spots, spots to
// board a ski lift, bolts still to pull — are linked into a graph, and each gets
// a cost: roughly how many frames it takes to reach the goal from there. Jump
// links are found by test-firing the real jump physics, so nothing is hand-placed.
import { surfaceY, inRange } from './world.js';
import { PHYS, W, H } from './game.js';

export const FAR = 5e5;
const { WALK, CLIMB, JUMP_V, GRAV, MAX_FALL, FALL_DEATH } = PHYS;
const LIFT_WAIT = 50;
const HOT_LEDGE = 300; // extra cost of a lift exit onto a ledge with a hazard on it
const BALL_TRAVEL = 70; // frames for a thrown ball to cross from the yeti to a ledge's far side
const CLEAR_TIME = 45;  // frames to land and climb out of a ball's way // rough frames spent waiting for a lift to come by

// Fly a jump (or a step off an edge) over the fixed ledges. `mover` is an
// optional moving lift {x0, x1, y0, vy}. Returns where it lands, or null.
export function flight(platforms, x, y, vx, vy, mover) {
  const fromY = y;
  for (let t = 1; t <= 150; t++) {
    const prevY = y;
    vy = Math.min(vy + GRAV, MAX_FALL);
    x += vx;
    if (x < 6 || x > W - 6) { x = Math.max(6, Math.min(W - 6, x)); vx = -vx; }
    y += vy;
    if (vy > 0) {
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (p.lift !== undefined || !inRange(p, x)) continue;
        const s = surfaceY(p, x);
        if (prevY <= s && y >= s) return { p: i, x, t, safe: s - fromY <= FALL_DEATH };
      }
      if (mover && x >= mover.x0 && x <= mover.x1) {
        const s = mover.y0 + mover.vy * t;
        if (prevY <= s + 2 && y >= s) return { lift: true, x, t, s, safe: s - fromY <= FALL_DEATH };
      }
    }
    if (y > H + 10) return null;
  }
  return null;
}

// Key for the parts of the map that change during play (stage 4's bolts).
export function navKey(w) {
  let key = w.stage.id;
  if (w.bolts) {
    let m = 0;
    w.bolts.forEach((b, i) => {
      if (b.pulled) m |= 1 << i;
      if (b.pulled || b.armed) m |= 1 << (i + 8);
    });
    key += m * 10;
  }
  return key;
}

export class Nav {
  constructor(w) {
    const P = w.platforms;
    this.goal = w.goal;
    this.segs = [];
    this.shafts = [];
    this.buildSegments(w);
    this.buildLadders(w);
    this.buildJumps(P);
    this.buildLifts(w, P);
    if (w.goal !== undefined) for (const s of this.segs) if (s.p === w.goal) s.goal = true;
    if (w.bolts) {
      for (const b of w.bolts) if (!b.pulled && !b.armed) this.add(this.segAt(b.p, b.x), b.x, 'target', {});
    }
    this.solve();
    this.tabulate();
    this.out = { mx: 0, up: false, down: false, jump: false };
  }

  // --- building ------------------------------------------------------------------

  buildSegments(w) {
    w.platforms.forEach((p, i) => {
      if (p.lift !== undefined) return;
      let a = Math.max(p.x0, 6);
      const b = Math.min(p.x1, W - 6);
      let walled = false;
      for (const wall of w.walls || []) if (wall.p === i && wall.min > a) { a = wall.min; walled = true; }
      const gaps = (p.gaps || []).map((g) => ({ ...g, hole: true }));
      // a yeti standing on a ledge blocks it like a wall (stage 2's paces, so it's left to the look-ahead)
      const yt = w.yeti;
      if (!w.stage.yetiPaces && yt.p === i) gaps.push({ x0: yt.x - 18, x1: yt.x + 18, hole: false });
      gaps.sort((g, h) => g.x0 - h.x0);
      let cur = a;
      let fallL = !walled && a > 6;
      for (const g of gaps) {
        if (g.x0 > cur) this.segs.push({ p: i, a: cur, b: Math.min(g.x0, b), fallL, fallR: g.hole, pois: [] });
        cur = Math.max(cur, g.x1);
        fallL = g.hole;
      }
      if (b > cur) this.segs.push({ p: i, a: cur, b, fallL, fallR: b < W - 6, pois: [] });
    });
  }

  segAt(p, x) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      if (s.p !== p) continue;
      const d = x < s.a ? s.a - x : x > s.b ? x - s.b : 0;
      if (d < bd) { bd = d; best = i; }
    }
    return bd < 6 ? best : -1;
  }

  add(si, x, kind, extra) {
    if (si < 0) return;
    const q = { si, x, kind, c: FAR, ...extra };
    this.segs[si].pois.push(q);
  }

  buildLadders(w) {
    for (const L of w.ladders) {
      if (L.broken) continue;
      const lo = this.segAt(L.lower, L.cx);
      const up = this.segAt(L.upper, L.cx);
      if (lo < 0 || up < 0) continue;
      const time = (L.yBot - L.yTop) / CLIMB + (L.retract ? 40 : 0);
      this.add(lo, L.cx, 'up', { to: up, toX: L.cx, time, L });
      this.add(up, L.cx, 'down', { to: lo, toX: L.cx, time, L });
    }
  }

  buildJumps(P) {
    const n = this.segs.length;
    for (let si = 0; si < n; si++) {
      const s = this.segs[si];
      const p = P[s.p];
      for (const dir of [-1, 1]) {
        const found = new Map();
        for (let x = s.a + 0.5; x <= s.b - 0.5; x += 2) {
          const r = flight(P, x, surfaceY(p, x), dir * WALK, -JUMP_V);
          if (!r || !r.safe) continue;
          const sj = this.segAt(r.p, r.x);
          if (sj < 0 || sj === si) continue;
          if (!found.has(sj)) found.set(sj, []);
          found.get(sj).push({ x, toX: r.x, time: r.t });
        }
        for (const [sj, list] of found) {
          const pick = new Set([list[0], list[list.length >> 1], list[list.length - 1]]);
          for (const j of pick) this.add(si, j.x, 'jump', { dir, to: sj, toX: j.toX, time: j.time });
        }
        // stepping off the end of the segment
        if (dir > 0 ? s.fallR : s.fallL) {
          const ex = dir > 0 ? s.b : s.a;
          const r = flight(P, ex + dir * 0.5, surfaceY(p, ex), dir * 0.5, 0);
          if (r && r.safe) {
            const sj = this.segAt(r.p, r.x);
            if (sj >= 0 && sj !== si) this.add(si, ex, 'walk', { dir, to: sj, toX: r.x, time: r.t });
          }
        }
      }
    }
  }

  // Ski lifts (stage 3): when you can jump or step off each lift onto a ledge,
  // and when you can get on one from a ledge next to its shaft.
  buildLifts(w, P) {
    const shafts = w.stage.shafts;
    if (!shafts) return;
    const speed = w.stage.liftSpeed;
    shafts.forEach((s, k) => {
      const exits = [];
      for (const dir of [-1, 1]) {
        for (const how of ['jump', 'walk']) {
          const runs = new Map();
          for (let Y = s.top; Y <= s.bottom; Y++) {
            const r = how === 'jump'
              ? flight(P, dir > 0 ? s.x1 - 2 : s.x0 + 2, Y, dir * WALK, -JUMP_V)
              : flight(P, (dir > 0 ? s.x1 : s.x0) + dir * 0.5, Y, dir * 0.5, 0);
            if (!r || !r.safe) continue;
            const sj = this.segAt(r.p, r.x);
            if (sj < 0) continue;
            const run = runs.get(sj);
            if (run) { run.hi = Y; } else runs.set(sj, { lo: Y, hi: Y, toX: r.x, time: r.t });
          }
          for (const [sj, run] of runs) {
            if (run.hi - run.lo < 3) continue;
            exits.push({
              dir, how, to: sj, toX: run.toX, time: run.time,
              x: how === 'jump' ? (dir > 0 ? s.x1 - 2 : s.x0 + 2) : (dir > 0 ? s.x1 - 1 : s.x0 + 1),
              lo: run.lo + 1, hi: run.hi - 1,
            });
          }
        }
      }
      this.shafts.push({ ...s, speed, exits });

      // boarding from the ledge ends that face this shaft
      this.segs.forEach((seg, si) => {
        const p = P[seg.p];
        for (const dir of [-1, 1]) {
          const edge = dir > 0 ? seg.b : seg.a;
          const gap = dir > 0 ? s.x0 - edge : edge - s.x1;
          if (gap < 0 || gap > 30 || !(dir > 0 ? seg.fallR : seg.fallL)) continue;
          for (const how of ['jump', 'walk']) {
            let lo = null, hi = null, arrive = 0, time = 0;
            const x = how === 'jump' ? edge - dir : edge;
            for (let Y = s.top; Y <= s.bottom; Y++) {
              const mover = { x0: s.x0, x1: s.x1, y0: Y, vy: s.dir * speed };
              const r = how === 'jump'
                ? flight(P, x, surfaceY(p, x), dir * WALK, -JUMP_V, mover)
                : flight(P, edge + dir * 0.5, surfaceY(p, edge), dir * 0.5, 0, mover);
              if (!r || !r.lift || !r.safe) continue;
              if (lo === null) { lo = Y; arrive = r.s; time = r.t; }
              hi = Y;
            }
            if (lo !== null && hi - lo >= 3) {
              this.add(si, x, 'board', { dir, how, shaft: k, lo: lo + 1, hi: hi - 1, arrive, time });
            }
          }
        }
      });
    });
  }

  // Bellman-style relaxation; the graph is tiny.
  solve() {
    const all = this.segs.flatMap((s) => s.pois);
    for (const q of all) q.c = q.kind === 'target' ? 0 : FAR;
    for (let it = 0; it < 60; it++) {
      let changed = false;
      for (const q of all) {
        let c;
        if (q.kind === 'target') continue;
        if (q.kind === 'board') c = LIFT_WAIT + q.time + this.shaftCost(q.shaft, q.arrive, null);
        else c = q.time + this.segCost(q.to, q.toX);
        if (c < q.c - 1e-6) { q.c = c; changed = true; }
      }
      if (!changed) break;
    }
  }

  // Per-segment tables: the cheapest point to head for from each integer x, and the
  // cost from there. policy() and segCost() are called every simulated frame.
  tabulate() {
    for (const s of this.segs) {
      const a = Math.floor(s.a), b = Math.ceil(s.b);
      s.x0 = a;
      s.best = new Array(b - a + 1);
      s.costAt = new Float64Array(b - a + 1);
      for (let x = a; x <= b; x++) {
        let q = null, bc = FAR;
        for (const o of s.pois) {
          const c = Math.abs(x - o.x) / WALK + o.c;
          if (c < bc) { bc = c; q = o; }
        }
        s.best[x - a] = q;
        s.costAt[x - a] = s.goal ? 0 : bc;
      }
    }
    for (const sh of this.shafts) for (const e of sh.exits) e.base = e.time + this.segCost(e.to, e.toX);
  }

  // --- queries ---------------------------------------------------------------------

  segCost(si, x) {
    const s = this.segs[si];
    if (!s) return FAR;
    if (s.goal) return 0;
    if (s.costAt) {
      const i = Math.max(0, Math.min(s.costAt.length - 1, Math.round(x) - s.x0));
      return s.costAt[i];
    }
    let best = FAR;
    for (const q of s.pois) {
      const c = Math.abs(x - q.x) / WALK + q.c;
      if (c < best) best = c;
    }
    return best;
  }

  liftWait(sh, e, Y) {
    if (sh.dir < 0) return Y > e.hi ? (Y - e.hi) / sh.speed : Y >= e.lo ? 0 : FAR;
    return Y < e.lo ? (e.lo - Y) / sh.speed : Y <= e.hi ? 0 : FAR;
  }

  // Is a ledge dangerous to land on right now: a hazard on it or bouncing over it,
  // or the yeti about to throw one along it?
  hotLedge(w, si) {
    if (!w) return false;
    const seg = this.segs[si];
    const p = w.platforms[seg.p];
    for (const h of w.stage.hazards(w)) {
      if (h.dead) continue;
      if (h.x >= p.x0 - 8 && h.x <= p.x1 + 8 && h.y <= p.yL + 2 && h.y > p.yL - 40) return true;
    }
    for (const h of w.seals) {
      if (h.dead) continue;
      if (h.x >= p.x0 - 8 && h.x <= p.x1 + 8 && Math.abs(h.y - p.yL) < 12) return true;
    }
    const yt = w.yeti;
    return (yt.phase === 'hold' || yt.phase === 'grab') && Math.abs(yt.y - p.yL) < 20;
  }

  // Frames until a ball the yeti throws next could reach a ledge it throws along;
  // Infinity when the yeti isn't a thrower or the ledge is out of its reach.
  throwArrives(w, si) {
    const yt = w.yeti;
    if (yt.timer === undefined || !yt.phase) return Infinity;
    const p = w.platforms[this.segs[si].p];
    if (Math.abs(yt.y - p.yL) > 24) return Infinity;
    const until = yt.phase === 'wait' ? Math.max(0, yt.timer) + 20 : yt.phase === 'hold' ? Math.max(0, yt.timer) : 0;
    return until + BALL_TRAVEL;
  }

  bestExit(k, Y, x, w) {
    const sh = this.shafts[k];
    let best = null, bc = FAR;
    if (!sh) { this.exitCost = FAR; return null; }
    for (const e of sh.exits) {
      const wait = this.liftWait(sh, e, Y);
      let c = wait + (e.base !== undefined ? e.base : e.time + this.segCost(e.to, e.toX)) + (x === null ? 0 : Math.abs(x - e.x) / WALK);
      if (w) {
        if (this.hotLedge(w, e.to)) c += HOT_LEDGE;
        // don't ride into a throw: the landing and the climb away must be done before the ball gets there
        else if (wait + e.time + CLEAR_TIME > this.throwArrives(w, e.to)) c += HOT_LEDGE;
      }
      if (c < bc) { bc = c; best = e; }
    }
    this.exitCost = bc;
    return best;
  }

  shaftCost(k, Y, x, w) { this.bestExit(k, Y, x, w); return this.exitCost; }

  climbCosts(L, y) {
    const up = L.broken ? FAR : (y - L.yTop) / CLIMB + this.segCost(this.segAt(L.upper, L.cx), L.cx);
    const down = (L.yBot - y) / CLIMB + this.segCost(this.segAt(L.lower, L.cx), L.cx);
    return { up, down };
  }

  // Frames from the goal for the penguin as it stands now.
  cost(game) {
    const pl = game.player;
    const w = game.world;
    let c;
    if (pl.state === 'climb') {
      const k = this.climbCosts(pl.ladder, pl.y);
      c = Math.min(k.up, k.down);
    } else if (pl.state === 'walk') {
      const p = w.platforms[pl.p];
      if (pl.p === w.goal) c = 0;
      else if (p.lift !== undefined) c = this.shaftCost(p.lift, p.yL, pl.x, w);
      else c = this.segCost(this.segAt(pl.p, pl.x), pl.x);
    } else {
      c = FAR * 0.8;
    }
    if (w.bolts) for (const b of w.bolts) if (b.pulled || b.armed) c -= 2000;
    return c;
  }

  // Is something dangerous on this ladder, or about to roll onto it from the top?
  ladderBusy(w, L) {
    for (const b of w.stage.hazards(w)) {
      if (b.dead) continue;
      if (b.mode === 'ladder' && b.ladder === L) return true;
      if (b.mode === 'roll' && b.p === L.upper && Math.abs(b.x - L.cx) < 48 && Math.sign(L.cx - b.x) === b.dir) return true;
      // something bouncing or rolling along the foot of the ladder, heading for it
      const dx = L.cx - b.x;
      const vx = b.vx !== undefined && b.mode !== 'roll' ? b.vx : (b.dir || 0);
      if (Math.abs(dx) < 36 && Math.sign(dx) === Math.sign(vx) && b.y <= L.yBot + 2 && b.y > L.yBot - 30) return true;
    }
    for (const s of w.seals) if (!s.dead && s.mode === 'climb' && s.ladder === L) return true;
    return false;
  }

  // What to press to follow the route: {mx, up, down, jump}.
  policy(game) {
    const pl = game.player;
    const w = game.world;
    const out = this.out; // reused: callers read it before the next call
    out.mx = 0; out.up = out.down = out.jump = false;
    if (pl.state === 'climb') {
      const L = pl.ladder;
      const k = this.climbCosts(L, pl.y);
      // something on the ladder with us: get off at the far end
      for (const h of w.stage.hazards(w).concat(w.seals)) {
        if (h.dead) continue;
        const on = (h.mode === 'ladder' || h.mode === 'climb') && h.ladder === L;
        // a ball rolling along the top ledge toward the ladder may well take it
        const coming = h.mode === 'roll' && h.p === L.upper && Math.abs(h.x - L.cx) < 48 && Math.sign(L.cx - h.x) === h.dir;
        if (!on && !coming) continue;
        const above = on ? h.y < pl.y : true;
        if (above) { out.down = true; pl.cdir = false; } else if (!L.broken) { out.up = true; pl.cdir = true; }
        return out;
      }
      // Commit to a direction: the two ways often cost the same at the very top or bottom.
      let up;
      if (pl.y - L.yTop < 1) up = k.up < k.down - 6 && !L.broken; // just stepped on from above
      else if (L.yBot - pl.y < 1) up = k.up <= k.down + 6; // just stepped on from below
      else if (k.up < k.down - 12) up = true;
      else if (k.down < k.up - 12) up = false;
      else up = pl.cdir !== undefined ? pl.cdir : k.up <= k.down;
      pl.cdir = up;
      if (up) out.up = true; else out.down = true;
      return out;
    }
    if (pl.state !== 'walk') return out;
    const p = w.platforms[pl.p];
    if (p.lift !== undefined) {
      const e = this.bestExit(p.lift, p.yL, pl.x, w);
      if (!e) return out;
      const dx = e.x - pl.x;
      if (Math.abs(dx) > 1) { out.mx = Math.sign(dx); return out; }
      if (p.yL >= e.lo && p.yL <= e.hi) { out.mx = e.dir; out.jump = e.how === 'jump'; }
      return out;
    }
    const seg = this.segs[this.segAt(pl.p, pl.x)];
    if (!seg || seg.goal) return out;
    // the route map is shared between the live game and its look-ahead copies, so
    // match ladders by id rather than by object
    const ladderOf = (o) => w.ladders[o.L.id];
    let q = seg.best[Math.max(0, Math.min(seg.best.length - 1, Math.round(pl.x) - seg.x0))];
    if (q && q.L && this.ladderBusy(w, ladderOf(q))) {
      q = null;
      let bc = FAR;
      for (const o of seg.pois) {
        let c = Math.abs(pl.x - o.x) / WALK + o.c;
        if (o.L && this.ladderBusy(w, ladderOf(o))) c += 400;
        if (c < bc) { bc = c; q = o; }
      }
    }
    if (!q) return out;
    // a busy ladder is the only way on: keep clear of its foot until it's free
    if (q.L && this.ladderBusy(w, ladderOf(q))) {
      const dx = pl.x - q.x;
      if (Math.abs(dx) < 16) out.mx = dx >= 0 ? 1 : -1;
      return out;
    }
    if (q.kind === 'walk') { out.mx = q.dir; return out; }
    const dx = q.x - pl.x;
    const tol = q.kind === 'up' || q.kind === 'down' ? 2 : 1;
    if (Math.abs(dx) > tol) { out.mx = Math.sign(dx); return out; }
    if (q.kind === 'up') out.up = true;
    else if (q.kind === 'down') out.down = true;
    else if (q.kind === 'jump') { out.mx = q.dir; out.jump = true; }
    else if (q.kind === 'board') {
      const ready = w.platforms.some((l) => l.lift === q.shaft && l.yL >= q.lo && l.yL <= q.hi);
      if (ready) { out.mx = q.dir; out.jump = q.how === 'jump'; }
    }
    return out;
  }
}
