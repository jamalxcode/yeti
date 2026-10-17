import { surfaceY, inRange, buildLadders, drawPlatform, drawLadder } from './world.js';
import { drawText, drawTextC, FAMILY } from './font.js';
import { drawScenery, drawSnowfall } from './scenery.js';
import * as S from './sprites.js';
import { STAGES, stageSequence } from './stages/index.js';

export const W = 224;
export const H = 256;

const GAME_TITLE = 'YETI';
const WALK = 0.9;
const CLIMB = 0.62;
const JUMP_V = 1.7;
const GRAV = 0.106;
const MAX_FALL = 3;
const FALL_DEATH = 16; // landing further below the takeoff point than this is fatal
const SHOVEL_TIME = 600;
const START_LIVES = 3;
const EXTRA_LIFE_AT = 10000;
const MAX_SEALS = 5;

const rand = (a, b) => a + Math.random() * (b - a);
const pad = (n, len) => String(Math.max(0, Math.floor(n))).padStart(len, '0');
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const playerBox = (pl) => ({ x0: pl.x - 3, x1: pl.x + 3, y0: pl.y - 12, y1: pl.y - 1 });
const ballBox = (b) => ({ x0: b.x - 3, x1: b.x + 3, y0: b.y - 8, y1: b.y - 1 });
const sealBox = (s) => ({ x0: s.x - 5, x1: s.x + 5, y0: s.y - 8, y1: s.y });

// Frosted-glass box for HUD and overlays.
function panel(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fillStyle = 'rgba(8,18,52,0.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,210,255,0.75)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function loadHi() {
  try { return parseInt(localStorage.getItem('yeti.hi') || '0', 10) || 0; } catch { return 0; }
}
function saveHi(v) {
  try { localStorage.setItem('yeti.hi', String(v)); } catch { /* ignore */ }
}

export class Game {
  constructor(sfx, input) {
    this.sfx = sfx;
    this.input = input;
    this.hi = loadHi();
    this.score = 0;
    this.level = 1;
    this.lives = START_LIVES;
    this.paused = false;
    this.frame = 0;
    this.shake = 0;
    this.flakes = Array.from({ length: 36 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(0.15, 0.5), d: rand(0, 6) }));
    this.res = 1; // canvas pixels per game pixel, set by main.js
    this.setState('title');
    window.yeti = this; // handy for debugging from the console
  }

  setState(s) { this.state = s; this.t = 0; }

  // --- game flow -----------------------------------------------------------------

  newGame() {
    this.score = 0;
    this.level = 1;
    this.lives = START_LIVES;
    this.seqIdx = 0;
    this.extraGiven = false;
    this.sfx.play('start');
    this.loadStage();
    this.setupIntro();
    this.setState('intro');
  }

  get stageId() { return stageSequence(this.level)[this.seqIdx]; }

  loadStage() {
    const stage = STAGES[this.stageId];
    const L = stage.layout();
    const platforms = L.platforms.map((p) => ({ ...p, t: 1 }));
    const w = {
      stage, platforms,
      ladders: buildLadders(platforms, L.ladders),
      layout: L,
      goal: L.goal, hole: L.hole, walls: L.walls || [],
      yeti: { x: L.yeti.x, y: surfaceY(platforms[L.yeti.p], L.yeti.x), p: L.yeti.p, pose: 'idle', facing: 1 },
      chick: { x: L.chick.x, y: surfaceY(platforms[L.chick.p], L.chick.x), visible: true },
    };
    this.world = w;
    if (stage.setup) stage.setup(w, this);
    this.resetStage();
  }

  // (Re)start the current stage: after loading it or after losing a life.
  resetStage() {
    const w = this.world;
    const L = w.layout;
    // the shovel floats at jump height; bonus items sit on the ledge
    w.items = L.items.map((it) => ({ ...it, y: surfaceY(w.platforms[it.p], it.x) - (it.type === 'shovel' ? 12 : 0), taken: false }));
    w.seals = [];
    w.fx = [];
    w.popups = [];
    w.yeti.x = L.yeti.x;
    w.yeti.y = surfaceY(w.platforms[L.yeti.p], L.yeti.x);
    w.yeti.pose = 'idle';
    w.chick.visible = true;
    w.stage.init(w, this);
    const sp = L.start;
    this.player = {
      x: sp.x, y: surfaceY(w.platforms[sp.p], sp.x), p: sp.p,
      state: 'walk', facing: 1, vx: 0, vy: 0, fromY: 0,
      walkT: 0, climbT: 0, shovel: 0, jumped: [], dead: false,
    };
    this.bonus = Math.min(4000 + 1000 * this.level, 8000);
    this.bonusT = 0;
  }

  nextStage() {
    this.seqIdx++;
    if (this.seqIdx >= stageSequence(this.level).length) {
      this.seqIdx = 0;
      this.level++;
    }
    this.loadStage();
    this.setState('howhigh');
  }

  addScore(n, x, y) {
    const before = this.score;
    this.score += n;
    if (!this.extraGiven && before < EXTRA_LIFE_AT && this.score >= EXTRA_LIFE_AT) {
      this.extraGiven = true;
      this.lives++;
      this.sfx.play('extra');
    }
    if (this.score > this.hi) this.hi = this.score;
    if (x !== undefined) this.world.popups.push({ x, y, text: String(n), t: 60 });
  }

  // From the seal hole (hopping out), or popping up at a given spot.
  spawnSeal(at) {
    const w = this.world;
    if (w.seals.length >= MAX_SEALS) return;
    if (at) {
      const dir = this.player && this.player.x < at.x ? -1 : 1;
      w.seals.push({ x: at.x, y: surfaceY(w.platforms[at.p], at.x), p: at.p, dir, mode: 'appear', t: 0, cd: 30 });
    } else {
      const h = w.hole;
      w.seals.push({ x: h.x, y: surfaceY(w.platforms[h.p], h.x), p: h.p, dir: 1, mode: 'hop', vy: -2.2, t: 0, cd: 30 });
    }
    this.sfx.play('seal');
  }

  die() {
    const pl = this.player;
    if (pl.dead) return;
    pl.dead = true;
    pl.shovel = 0;
    this.sfx.play('die');
    this.setState('dying');
  }

  // --- update ----------------------------------------------------------------------

  update() {
    const inp = this.input;
    this.frame++;
    this.t++;
    if (this.shake > 0) this.shake--;
    if (inp.mutePressed) this.sfx.toggleMute();
    for (const f of this.flakes) {
      f.y += f.s; f.x += Math.sin((this.frame / 60) + f.d) * 0.15;
      if (f.y > H) { f.y = -2; f.x = rand(0, W); }
    }

    switch (this.state) {
      case 'title':
        if (inp.startPressed || inp.jumpPressed) this.newGame();
        break;
      case 'intro':
        if ((inp.startPressed || inp.jumpPressed) && this.t > 10) this.endIntro();
        else this.updateIntro();
        break;
      case 'howhigh':
        if (this.t > 150 || ((inp.startPressed || inp.jumpPressed) && this.t > 30)) this.setState('play');
        break;
      case 'play':
        if (inp.pausePressed || (inp.startPressed && !this.paused)) { this.paused = !this.paused; break; }
        if (this.paused) { if (inp.startPressed) this.paused = false; break; }
        this.updatePlay();
        break;
      case 'dying':
        if (this.t >= 150) {
          this.lives--;
          if (this.lives <= 0) {
            if (this.score >= this.hi) saveHi(this.hi);
            this.sfx.play('gameover');
            this.setState('gameover');
          } else {
            this.resetStage();
            this.setState('play');
          }
        }
        break;
      case 'clear':
        this.updateClear();
        break;
      case 'gameover':
        if (this.t > 240 || ((inp.startPressed || inp.jumpPressed) && this.t > 60)) this.setState('title');
        break;
    }
  }

  updatePlay() {
    const w = this.world;
    this.updatePlayer();
    if (this.state !== 'play') return;
    w.stage.update(w, this);
    if (w.stage.cleared && w.stage.cleared(w)) { this.startClear(); return; }
    this.updateSeals();
    this.updateItems();
    this.checkHits();
    if (this.state !== 'play') return;

    for (const f of w.fx) f.t++;
    w.fx = w.fx.filter((f) => f.t < 20);
    for (const p of w.popups) { p.t--; p.y -= 0.2; }
    w.popups = w.popups.filter((p) => p.t > 0);

    if (++this.bonusT >= 120) {
      this.bonusT = 0;
      this.bonus = Math.max(0, this.bonus - 100);
      if (this.bonus <= 1000 && this.bonus > 0) this.sfx.play('tick');
      if (this.bonus === 0) this.die();
    }
  }

  updatePlayer() {
    const w = this.world;
    const pl = this.player;
    const inp = this.input;
    if (pl.shovel > 0) pl.shovel--;

    if (pl.state === 'walk') {
      const p = w.platforms[pl.p];
      const mx = inp.left ? -1 : inp.right ? 1 : 0;
      if (p === w.platforms[w.goal]) { this.startClear(); return; }
      if (inp.jumpPressed && !pl.shovel) {
        pl.state = 'air';
        pl.vy = -JUMP_V;
        pl.vx = mx * WALK;
        if (mx) pl.facing = mx;
        pl.fromY = pl.y;
        pl.jumped = [];
        this.sfx.play('jump');
        return;
      }
      if (!pl.shovel && (inp.up || inp.down)) {
        const L = w.ladders.find((L) => Math.abs(pl.x - L.cx) <= 3 &&
          ((inp.up && L.lower === pl.p) || (inp.down && L.upper === pl.p && !L.broken)));
        if (L) { pl.state = 'climb'; pl.ladder = L; pl.x = L.cx; return; }
      }
      if (mx) {
        pl.facing = mx;
        pl.x += mx * WALK;
        if (pl.walkT++ % 10 === 0) this.sfx.play('step');
      } else {
        pl.walkT = 0;
      }
      pl.x = Math.max(6, Math.min(W - 6, pl.x));
      for (const wall of w.walls) if (wall.p === pl.p && pl.x < wall.min) pl.x = wall.min;
      if (!inRange(p, pl.x)) {
        pl.state = 'air'; pl.vy = 0; pl.vx = mx * 0.5; pl.fromY = pl.y; pl.jumped = [];
      } else {
        pl.y = surfaceY(p, pl.x);
      }
    } else if (pl.state === 'air') {
      const prevY = pl.y;
      pl.vy = Math.min(pl.vy + GRAV, MAX_FALL);
      pl.x += pl.vx;
      if (pl.x < 6 || pl.x > W - 6) { pl.x = Math.max(6, Math.min(W - 6, pl.x)); pl.vx = -pl.vx; }
      pl.y += pl.vy;
      // count hazards jumped over
      for (const h of this.hazardList()) {
        if (!pl.jumped.includes(h) && Math.abs(h.x - pl.x) < 7 && h.y > pl.y && h.y - pl.y < 26) pl.jumped.push(h);
      }
      if (pl.vy > 0) {
        for (let i = 0; i < w.platforms.length; i++) {
          const p = w.platforms[i];
          if (!inRange(p, pl.x)) continue;
          const s = surfaceY(p, pl.x);
          // a rising lift can pass the feet between frames, so allow a little slack
          if (prevY <= s + (p.lift !== undefined ? 2 : 0) && pl.y >= s) {
            pl.y = s; pl.p = i; pl.state = 'walk';
            if (s - pl.fromY > FALL_DEATH) { this.die(); return; }
            this.sfx.play('land');
            const n = pl.jumped.filter((h) => !h.dead).length;
            if (n) { this.addScore([0, 100, 300, 500][Math.min(n, 3)], pl.x, pl.y - 20); this.sfx.play('score'); }
            break;
          }
        }
      }
      if (pl.y > H + 10) this.die();
    } else if (pl.state === 'climb') {
      const L = pl.ladder;
      const minY = L.broken ? L.yBot - 10 : L.yTop;
      if (inp.up) {
        pl.y -= CLIMB; pl.climbT++;
        if (pl.y <= minY) {
          pl.y = minY;
          if (!L.broken) { pl.state = 'walk'; pl.p = L.upper; }
        }
      } else if (inp.down) {
        pl.y += CLIMB; pl.climbT++;
        if (pl.y >= L.yBot) { pl.y = L.yBot; pl.state = 'walk'; pl.p = L.lower; }
      }
      if ((inp.up || inp.down) && pl.climbT % 14 === 0) this.sfx.play('climb');
    }
  }

  hazardList() {
    const w = this.world;
    return w.stage.hazards(w).concat(w.seals);
  }

  updateSeals() {
    const w = this.world;
    const pl = this.player;
    const spd = Math.min(0.45 + 0.05 * this.level, 0.8);
    for (const s of w.seals) {
      s.t++;
      if (s.cd > 0) s.cd--;
      if (s.mode === 'appear') {
        if (s.t >= 45) s.mode = 'walk';
      } else if (s.mode === 'hop') {
        s.vy += 0.12; s.y += s.vy; s.x += 0.6;
        const g = surfaceY(w.platforms[s.p], s.x);
        if (s.vy > 0 && s.y >= g) { s.y = g; s.mode = 'walk'; }
      } else if (s.mode === 'walk') {
        const p = w.platforms[s.p];
        if (s.t % 90 === 0) {
          if (pl.p === s.p && pl.state === 'walk' && Math.random() < 0.7) s.dir = Math.sign(pl.x - s.x) || s.dir;
          else if (Math.random() < 0.3) s.dir = -s.dir;
        }
        s.x += s.dir * spd;
        let min = p.x0 + 5, max = p.x1 - 5;
        for (const wall of w.walls) if (wall.p === s.p) min = Math.max(min, wall.min);
        min = Math.max(min, 6); max = Math.min(max, W - 6);
        if (s.x < min) { s.x = min; s.dir = 1; }
        if (s.x > max) { s.x = max; s.dir = -1; }
        if (!inRange(p, s.x)) { s.x -= s.dir * spd; s.dir = -s.dir; }
        s.y = surfaceY(p, s.x);
        if (s.cd <= 0) {
          for (const L of w.ladders) {
            if (L.broken || L.noSeal || Math.abs(s.x - L.cx) > spd) continue;
            if (L.lower === s.p && pl.y < s.y - 8 && Math.random() < 0.6) {
              s.mode = 'climb'; s.ladder = L; s.vyDir = -1; s.x = L.cx; break;
            }
            if (L.upper === s.p && pl.y > s.y + 8 && Math.random() < 0.4) {
              s.mode = 'climb'; s.ladder = L; s.vyDir = 1; s.x = L.cx; break;
            }
            s.cd = 30;
          }
        }
      } else if (s.mode === 'climb') {
        const L = s.ladder;
        s.y += s.vyDir * 0.45;
        if (s.vyDir < 0 && s.y <= L.yTop) { s.y = L.yTop; s.p = L.upper; s.mode = 'walk'; s.cd = 60; }
        if (s.vyDir > 0 && s.y >= L.yBot) { s.y = L.yBot; s.p = L.lower; s.mode = 'walk'; s.cd = 60; }
      }
    }
    w.seals = w.seals.filter((s) => !s.dead);
  }

  updateItems() {
    const w = this.world;
    const pl = this.player;
    const box = playerBox(pl);
    for (const it of w.items) {
      if (it.taken) continue;
      const ib = { x0: it.x - 3, x1: it.x + 3, y0: it.y - 12, y1: it.y };
      if (overlap(box, ib)) {
        it.taken = true;
        if (it.type === 'shovel') {
          pl.shovel = SHOVEL_TIME;
          this.sfx.play('pickup');
        } else {
          this.addScore([300, 500, 800][Math.min(this.level, 3) - 1], it.x, it.y - 16);
          this.sfx.play('score');
        }
      }
    }
  }

  shovelBox() {
    const pl = this.player;
    if (pl.shovel <= 0) return null;
    const raised = ((pl.shovel >> 3) & 1) === 0;
    if (raised) return { x0: pl.x - 7, x1: pl.x + 7, y0: pl.y - 30, y1: pl.y - 12 };
    return pl.facing > 0
      ? { x0: pl.x + 2, x1: pl.x + 20, y0: pl.y - 14, y1: pl.y }
      : { x0: pl.x - 20, x1: pl.x - 2, y0: pl.y - 14, y1: pl.y };
  }

  checkHits() {
    const w = this.world;
    const pl = this.player;
    const sb = this.shovelBox();
    const smash = (h, pts) => {
      h.dead = true;
      w.fx.push({ x: h.x, y: h.y - 5, t: 0 });
      this.addScore(pts, h.x, h.y - 14);
      this.sfx.play('smash');
    };
    if (sb) {
      for (const b of w.stage.hazards(w)) if (!b.dead && overlap(sb, ballBox(b))) smash(b, b.kind === 'ice' ? (Math.random() < 0.5 ? 500 : 800) : 300);
      for (const s of w.seals) if (!s.dead && s.mode !== 'appear' && overlap(sb, sealBox(s))) smash(s, Math.random() < 0.5 ? 500 : 800);
    }
    const box = playerBox(pl);
    for (const b of w.stage.hazards(w)) if (!b.dead && overlap(box, ballBox(b))) { this.die(); return; }
    for (const s of w.seals) if (!s.dead && s.mode !== 'appear' && overlap(box, sealBox(s))) { this.die(); return; }
    const y = w.yeti;
    if (overlap(box, { x0: y.x - 13, x1: y.x + 13, y0: y.y - 30, y1: y.y })) this.die();
  }

  // --- cutscenes -------------------------------------------------------------------

  setupIntro() {
    const w = this.world;
    for (const p of w.platforms) p.t = 0;
    this.intro = { phase: 'climb', y: H + 30, tilted: 0 };
    w.chick.visible = false;
  }

  endIntro() {
    const w = this.world;
    for (const p of w.platforms) p.t = 1;
    w.chick.visible = true;
    this.resetStage();
    this.setState('howhigh');
  }

  updateIntro() {
    const w = this.world;
    const it = this.intro;
    const y = w.yeti;
    const top = w.platforms[w.goal];
    if (it.phase === 'climb') {
      y.x = 120; it.y -= 1.4; y.y = it.y; y.pose = 'carry';
      if (it.y <= top.yL) {
        y.y = top.yL; it.phase = 'hop'; it.k = 0; w.chick.visible = true;
        it.from = { x: y.x, y: y.y };
      }
    } else if (it.phase === 'hop') {
      it.k++;
      const f = it.k / 36;
      const tx = w.layout.yeti.x;
      const ty = surfaceY(w.platforms[w.layout.yeti.p], tx);
      y.x = it.from.x + (tx - it.from.x) * f;
      y.y = it.from.y + (ty - it.from.y) * f - Math.sin(f * Math.PI) * 18;
      y.pose = 'hold';
      if (it.k >= 36) { y.x = tx; y.y = ty; it.phase = 'stomp'; it.k = 0; it.n = 0; }
    } else if (it.phase === 'stomp') {
      it.k++;
      const base = surfaceY(w.platforms[w.layout.yeti.p], y.x);
      y.pose = 'roar';
      y.y = base - Math.abs(Math.sin(it.k / 24 * Math.PI)) * 8;
      if (it.k === 24) {
        const idx = w.platforms.length - 2 - it.n; // tilt ledges top to bottom, not the goal
        if (idx >= 0) { it.tilting = idx; it.tk = 0; }
        this.shake = 8;
        this.sfx.play('stomp');
        it.k = 0;
        it.n++;
        if (it.n >= w.platforms.length - 1) { it.phase = 'roar'; it.k = 0; this.sfx.play('roar'); }
      }
    } else if (it.phase === 'roar') {
      it.k++;
      y.pose = 'roar';
      y.y = surfaceY(w.platforms[w.layout.yeti.p], y.x);
      if (it.k > 70) this.endIntro();
    }
    if (it.tilting !== undefined) {
      it.tk++;
      w.platforms[it.tilting].t = Math.min(1, it.tk / 8);
      if (it.tk >= 8) it.tilting = undefined;
    }
  }

  startClear() {
    const w = this.world;
    w.popups = [];
    w.flyingBolts = [];
    this.addScore(this.bonus, this.player.x, this.player.y - 24);
    this.sfx.play('clear');
    this.player.state = 'walk';
    this.clear = { from: { x: w.yeti.x, y: w.yeti.y }, kind: w.stage.clearKind || 'carry', debris: [] };
    w.seals = [];
    this.setState('clear');
  }

  updateClear() {
    for (const p of this.world.popups) { p.t--; p.y -= 0.2; }
    this.world.popups = this.world.popups.filter((p) => p.t > 0);
    if (this.clear.kind === 'fall') { this.updateClearFall(); return; }
    const w = this.world;
    const y = w.yeti;
    const c = this.clear;
    const t = this.t;
    if (t < 60) {
      y.pose = 'roar';
    } else if (t < 96) {
      const f = (t - 60) / 36;
      y.x = c.from.x + (w.chick.x - c.from.x) * f;
      y.y = c.from.y + (w.chick.y - c.from.y) * f - Math.sin(f * Math.PI) * 20;
      y.pose = 'hold';
      if (t === 95) { w.chick.visible = false; this.sfx.play('roar'); }
    } else {
      y.pose = 'carry';
      y.y -= 1.2;
    }
    if (t > 240) this.nextStage();
  }

  // Last stage of a level: the ledges give way, the yeti tumbles down and the
  // penguin is reunited with the chick on top.
  updateClearFall() {
    const w = this.world;
    const y = w.yeti;
    const c = this.clear;
    const t = this.t;
    if (t < 50) {
      y.pose = 'roar';
      y.x = c.from.x + ((t >> 1) & 1 ? 1 : -1);
      this.shake = 2;
    } else if (t === 50) {
      y.x = c.from.x;
      y.falling = true;
      y.vy = -1.5;
      this.sfx.play('stomp');
      this.shake = 10;
      // the middle of every bolted ledge drops away
      w.items = [];
      for (let i = 1; i < w.platforms.length - 1; i++) {
        const p = w.platforms[i];
        p.gaps.push({ x0: 60, x1: 164 });
        c.debris.push({ x0: 60, x1: 164, yL: p.yL, yR: p.yL, vy: rand(-1, 0) });
      }
      // penguin meets the chick on the perch
      const perch = w.platforms[w.platforms.length - 1];
      Object.assign(this.player, { x: perch.x0 + 6, y: perch.yL, p: w.platforms.length - 1, state: 'walk', facing: 1, walkT: 0, shovel: 0 });
    } else if (y.falling) {
      y.vy = Math.min(y.vy + 0.15, 4);
      y.y += y.vy;
      const ground = w.platforms[0].yL;
      if (y.y >= ground) { y.y = ground; y.falling = false; y.dazed = true; this.shake = 8; this.sfx.play('stomp'); }
    }
    for (const d of c.debris) { d.vy += 0.15; d.yL += d.vy; d.yR = d.yL; }
    c.debris = c.debris.filter((d) => d.yL < H + 10);
    if (t === 120) this.sfx.play('clear');
    if (t > 330) { y.dazed = false; this.nextStage(); }
  }

  // --- drawing ---------------------------------------------------------------------

  draw(ctx) {
    ctx.save();
    if (this.shake) ctx.translate(Math.round(rand(-2, 2)), Math.round(rand(-2, 2)));
    this.drawBackground(ctx);
    switch (this.state) {
      case 'title': this.drawTitle(ctx); break;
      case 'howhigh': this.drawHowHigh(ctx); break;
      case 'gameover':
        this.drawWorld(ctx);
        panel(ctx, 40, 104, 144, 48);
        drawTextC(ctx, 'GAME OVER', W / 2, 112, '#ff6a6a', 2);
        drawTextC(ctx, 'SCORE ' + pad(this.score, 6), W / 2, 136, '#ffffff');
        this.drawHud(ctx);
        break;
      default:
        this.drawWorld(ctx);
        this.drawHud(ctx);
        if (this.state === 'intro') drawTextC(ctx, 'PRESS JUMP TO SKIP', W / 2, 26, '#7f9cff');
        if (this.paused) {
          panel(ctx, 56, 110, 112, 32);
          drawTextC(ctx, 'PAUSED', W / 2, 118, '#ffffff', 2);
        }
    }
    ctx.restore();
  }

  drawBackground(ctx) {
    // in-game the scenery is baked into the level layer
    if (!this.world || this.state === 'title' || this.state === 'howhigh') drawScenery(ctx, this.res, this.frame);
  }

  // Scenery, ledges and ladders only change during the intro and when bolts are
  // pulled, so they're painted together into one offscreen layer and reused.
  drawLevelLayer(ctx) {
    const w = this.world;
    const fixed = w.platforms.filter((p) => p.lift === undefined); // moving lifts are drawn live
    const key = this.res + '|' + fixed.map((p) => (p.t ?? 1) + ':' + (p.gaps ? p.gaps.length : 0)).join(',');
    if (w.layerKey !== key) {
      const c = w.layer || document.createElement('canvas');
      c.width = W * this.res;
      c.height = H * this.res;
      const g = c.getContext('2d');
      g.setTransform(this.res, 0, 0, this.res, 0, 0);
      drawScenery(g, this.res, 0);
      if (w.stage.drawStatic) w.stage.drawStatic(g, w);
      for (const L of w.ladders) drawLadder(g, L);
      for (const p of fixed) drawPlatform(g, p);
      w.layer = c;
      w.layerKey = key;
    }
    ctx.drawImage(w.layer, 0, 0, W, H);
  }

  drawWorld(ctx) {
    const w = this.world;
    const pl = this.player;
    if (this.state === 'intro' && this.intro.phase === 'climb') {
      drawLadder(ctx, { x: 116, yTop: 40, yBot: H, broken: false });
    }
    this.drawLevelLayer(ctx);
    if (this.state === 'clear') for (const d of this.clear.debris) drawPlatform(ctx, d);
    if (w.hole) S.drawSealHole(ctx, w.hole.x, surfaceY(w.platforms[w.hole.p], w.hole.x), this.frame);
    for (const it of w.items) {
      if (it.taken) continue;
      if (it.type === 'shovel') S.drawShovelItem(ctx, it.x, it.y, this.frame);
      else if (it.type === 'scarf') S.drawScarf(ctx, it.x, it.y);
      else if (it.type === 'mittens') S.drawMittens(ctx, it.x, it.y);
      else if (it.type === 'fish') S.drawFish(ctx, it.x, it.y);
    }

    // chick and its call for help
    const ch = w.chick;
    if (ch.visible) {
      S.drawChick(ctx, ch.x, ch.y, this.frame, this.state !== 'clear');
      if (this.state === 'play' && (this.frame >> 6) % 2 === 0) {
        const hx = Math.min(ch.x + 8, W - 32);
        drawText(ctx, 'HELP!', hx, ch.y - 22, '#ffd84a');
      }
    }
    if (this.state === 'clear') {
      if (this.clear.kind === 'fall') { if (this.t >= 70) S.drawHeart(ctx, (pl.x + ch.x) / 2, ch.y - 22); }
      else S.drawHeart(ctx, (pl.x + ch.x) / 2, ch.y - 22, this.t >= 60);
    }

    w.stage.draw(ctx, w, this);
    const y = w.yeti;
    if (y.falling || y.dazed) {
      // upside down, head first
      ctx.save();
      ctx.translate(y.x, y.y - 16);
      ctx.scale(1, -1);
      S.drawYeti(ctx, 0, 16, 'roar', this.frame, 1);
      ctx.restore();
      if (y.dazed) S.drawDizzy(ctx, y.x, y.y - 4, this.frame);
    } else {
      S.drawYeti(ctx, y.x, y.y, y.pose, this.frame, y.facing);
    }
    if (y.pose === 'carry') S.drawChick(ctx, y.x, y.y - 32, this.frame, true);

    for (const s of w.seals) {
      if (s.mode === 'appear' && (s.t >> 2) & 1) continue; // flicker while popping up
      S.drawSeal(ctx, s.x, s.y, s.dir, s.t);
    }
    this.drawPlayer(ctx);
    for (const f of w.fx) S.drawPoof(ctx, f.x, f.y, f.t);
    for (const p of w.popups) drawTextC(ctx, p.text, p.x, p.y, '#ffe27a');
    drawSnowfall(ctx, this.flakes);
  }

  drawPlayer(ctx) {
    if (this.state === 'intro') return;
    const pl = this.player;
    if (pl.dead) {
      const t = this.t;
      if (t < 72) {
        S.drawPenguinRotated(ctx, 'stand', pl.x, pl.y, 1, Math.floor(t / 8) * Math.PI / 2);
      } else {
        S.drawPenguinRotated(ctx, 'stand', pl.x, pl.y + 2, 1, Math.PI / 2);
        S.drawDizzy(ctx, pl.x, pl.y - 8, this.frame);
      }
      return;
    }
    let frame = 'stand';
    if (pl.state === 'air') frame = 'jump';
    else if (pl.state === 'climb') {
      S.drawPenguin(ctx, 'climb', pl.x, pl.y, ((pl.climbT >> 3) & 1) ? 1 : -1);
      return;
    } else if (pl.walkT > 0) frame = ['walk1', 'stand', 'walk2', 'stand'][(pl.walkT >> 2) & 3];
    if (pl.shovel > 0 && pl.shovel < 120 && (pl.shovel >> 2) & 1) {
      S.drawPenguin(ctx, frame, pl.x, pl.y, pl.facing);
      return; // flicker the shovel when it's about to run out
    }
    S.drawPenguin(ctx, frame, pl.x, pl.y, pl.facing);
    if (pl.shovel > 0) S.drawShovelHeld(ctx, pl.x, pl.y, pl.facing, ((pl.shovel >> 3) & 1) === 0);
  }

  drawHud(ctx) {
    const blink = (this.frame >> 4) & 1;
    this.drawHudTop(ctx, blink || this.state !== 'play');
    for (let i = 0; i < Math.min(this.lives - 1, 8); i++) S.drawLifeIcon(ctx, 8 + i * 9, 22);
    drawText(ctx, 'L=' + pad(this.level, 2), 184, 1, '#7fd4ff');
    panel(ctx, 176, 11, 42, 21);
    drawTextC(ctx, 'BONUS', 197, 13, '#ffb04a');
    const low = this.bonus <= 1000;
    drawTextC(ctx, pad(this.bonus, 4), 197, 22, low && blink ? '#ff4a4a' : '#ffffff');
  }

  drawTitle(ctx) {
    const t = this.t;
    // icy logo
    ctx.save();
    ctx.font = `700 54px ${FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(80,170,255,0.25)';
    for (let i = 0; i < 3; i++) ctx.fillText(GAME_TITLE, W / 2, 22 + i);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0d2c66';
    ctx.strokeText(GAME_TITLE, W / 2, 22);
    const g = ctx.createLinearGradient(0, 26, 0, 70);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#bfe6ff');
    g.addColorStop(1, '#4a9be8');
    ctx.fillStyle = g;
    ctx.fillText(GAME_TITLE, W / 2, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; // snow on the letters
    for (const [sx, sw] of [[-20, 16], [8, 15], [36, 9]]) {
      ctx.beginPath(); ctx.ellipse(W / 2 + sx + sw / 2, 30.5, sw / 2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    drawTextC(ctx, 'A PENGUIN VS YETI ADVENTURE', W / 2, 84, '#ffd84a');
    drawTextC(ctx, 'HIGH SCORE ' + pad(this.hi, 6), W / 2, 100, '#ff8a8a');
    // little scene on a ledge
    drawPlatform(ctx, { x0: 32, x1: 192, yL: 152, yR: 152 });
    S.drawYeti(ctx, 152, 152, (t >> 5) % 3 === 0 ? 'roar' : 'hold', this.frame, -1);
    S.drawChick(ctx, 178, 152, this.frame);
    S.drawPenguin(ctx, ['walk1', 'stand', 'walk2', 'stand'][(t >> 3) & 3], 62, 152, 1);
    S.drawSnowball(ctx, 96 + ((t * 0.5) % 34), 152, 'snow', -t / 6);
    if ((t >> 5) & 1) drawTextC(ctx, this.input.touchMode ? 'TAP JUMP TO START' : 'PRESS START', W / 2, 176, '#ffffff', 1.4);
    panel(ctx, 24, 196, 176, 26);
    drawTextC(ctx, 'ARROWS MOVE / CLIMB   SPACE JUMP', W / 2, 200, '#a9c0ff');
    drawTextC(ctx, 'ENTER START   P PAUSE   M MUTE', W / 2, 210, '#a9c0ff');
    drawTextC(ctx, 'RESCUE THE CHICK FROM THE YETI!', W / 2, 232, '#e3ecff');
    drawSnowfall(ctx, this.flakes);
  }

  drawHowHigh(ctx) {
    const n = this.seqIdx + 1;
    for (let i = 0; i < n; i++) {
      const y = 214 - i * 38;
      S.drawYeti(ctx, 92, y, 'idle', 0, 1);
      drawText(ctx, (i + 1) * 1000 + ' FT', 122, y - 18, '#ffffff');
    }
    drawTextC(ctx, 'CAN YOU REACH THE SUMMIT?', W / 2, 236, '#ffffff');
    drawTextC(ctx, 'LEVEL ' + this.level, W / 2, 30, '#7fd4ff');
    this.drawHudTop(ctx);
  }

  drawHudTop(ctx, show1up = true) {
    if (show1up) drawText(ctx, '1UP', 14, 2, '#ff6a6a');
    drawText(ctx, pad(this.score, 6), 8, 11, '#ffffff');
    drawTextC(ctx, 'HIGH SCORE', 112, 2, '#ff6a6a');
    drawTextC(ctx, pad(this.hi, 6), 112, 11, '#ffffff');
  }
}
