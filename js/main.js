import { Game, W, H } from './game.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { initSprites } from './sprites.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

initSprites();
const sfx = new Sfx();
const input = new Input();
input.onGesture = () => sfx.unlock();
input.bindTouch(document.getElementById('touch'));
canvas.addEventListener('pointerdown', () => {
  sfx.unlock();
  if (game.state !== 'play') input.edge.start = true;
});

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
input.touchMode = isTouch;
document.body.classList.toggle('touch', isTouch);
addEventListener('touchstart', () => {
  if (!input.touchMode) { input.touchMode = true; document.body.classList.add('touch'); resize(); }
}, { passive: true });

const game = new Game(sfx, input);

function resize() {
  const touchUi = document.body.classList.contains('touch');
  const portrait = innerHeight > innerWidth;
  const reserve = touchUi && portrait ? Math.min(220, innerHeight * 0.33) : 0;
  const availW = innerWidth - (touchUi && !portrait ? 0 : 16);
  const availH = innerHeight - reserve - 16;
  let scale = Math.min(availW / W, availH / H);
  canvas.style.width = Math.floor(W * scale) + 'px';
  canvas.style.height = Math.floor(H * scale) + 'px';
  // Render at the screen's real pixel density for crisp art: up to 4x, or 3x on
  // touch devices where the extra pixels aren't visible but cost battery.
  const res = Math.max(1, Math.min(touchUi ? 3 : 4, Math.ceil(scale * (window.devicePixelRatio || 1))));
  if (res !== game.res) {
    game.res = res;
    canvas.width = W * res;
    canvas.height = H * res;
  }
}
addEventListener('resize', resize);
resize();

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play') game.paused = true;
});

const STEP = 1000 / 60;
let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(now - last, 100);
  last = now;
  while (acc >= STEP) {
    input.update();
    game.update();
    acc -= STEP;
  }
  ctx.setTransform(game.res, 0, 0, game.res, 0, 0);
  ctx.imageSmoothingEnabled = true;
  game.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
