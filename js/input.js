// Keyboard, gamepad and on-screen touch controls merged into one state.
// Held directions: left/right/up/down/jump. One-shot presses: jumpPressed, start, pause, mute,
// plus cpu / help (the autopilot switches) and humanPressed (a game control was
// pressed, so a human takes over from the autopilot).

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyX: 'jump', KeyK: 'jump',
};

export class Input {
  constructor() {
    this.keys = { left: false, right: false, up: false, down: false, jump: false };
    this.touch = { left: false, right: false, up: false, down: false, jump: false };
    this.pad = { left: false, right: false, up: false, down: false, jump: false };
    this.prevPadButtons = [];
    this.edge = { jump: false, start: false, pause: false, mute: false, cpu: false, help: false, human: false };
    this.prevPadDirs = '';
    this.onGesture = null;
    this.left = this.right = this.up = this.down = this.jump = false;

    addEventListener('keydown', (e) => {
      const act = KEYMAP[e.code];
      this.gesture();
      if (act) {
        if (act === 'jump' && !e.repeat) this.edge.jump = true;
        if (!e.repeat) this.edge.human = true;
        this.keys[act] = true;
        e.preventDefault();
      } else if (e.code === 'Enter') {
        this.edge.start = true; e.preventDefault();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        this.edge.pause = true;
      } else if (e.code === 'KeyM') {
        this.edge.mute = true;
      } else if (e.code === 'KeyC' && !e.repeat) {
        this.edge.cpu = true;
      } else if (e.code === 'KeyH' && !e.repeat) {
        this.edge.help = true;
      }
    });
    addEventListener('keyup', (e) => {
      const act = KEYMAP[e.code];
      if (act) this.keys[act] = false;
    });
    addEventListener('blur', () => {
      for (const k in this.keys) this.keys[k] = false;
    });
  }

  gesture() { if (this.onGesture) this.onGesture(); }

  bindTouch(root) {
    const dpad = root.querySelector('#dpad');
    const knob = root.querySelector('#dpad-knob');
    const btnJump = root.querySelector('#btn-jump');
    const t = this.touch;
    let dpadId = null;

    const setDir = (e) => {
      const r = dpad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dead = r.width * 0.12;
      const dist = Math.hypot(dx, dy);
      t.left = dx < -dead && Math.abs(dx) > Math.abs(dy) * 0.5;
      t.right = dx > dead && Math.abs(dx) > Math.abs(dy) * 0.5;
      t.up = dy < -dead && Math.abs(dy) > Math.abs(dx) * 0.5;
      t.down = dy > dead && Math.abs(dy) > Math.abs(dx) * 0.5;
      const max = r.width * 0.3;
      const k = dist > max ? max / dist : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    };
    const clearDir = () => {
      t.left = t.right = t.up = t.down = false;
      knob.style.transform = '';
      dpadId = null;
    };

    dpad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.gesture();
      dpadId = e.pointerId;
      this.edge.human = true;
      try { dpad.setPointerCapture(e.pointerId); } catch { /* synthetic events have no pointer */ }
      setDir(e);
    });
    dpad.addEventListener('pointermove', (e) => { if (e.pointerId === dpadId) setDir(e); });
    dpad.addEventListener('pointerup', clearDir);
    dpad.addEventListener('pointercancel', clearDir);
    dpad.addEventListener('lostpointercapture', clearDir);

    btnJump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.gesture();
      try { btnJump.setPointerCapture(e.pointerId); } catch { /* synthetic events have no pointer */ }
      t.jump = true;
      this.edge.jump = true;
      this.edge.human = true;
      btnJump.classList.add('down');
    });
    const jumpUp = () => { t.jump = false; btnJump.classList.remove('down'); };
    btnJump.addEventListener('pointerup', jumpUp);
    btnJump.addEventListener('pointercancel', jumpUp);

    root.querySelector('#btn-pause').addEventListener('click', () => { this.gesture(); this.edge.pause = true; });
    root.querySelector('#btn-mute').addEventListener('click', () => { this.gesture(); this.edge.mute = true; });
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && Array.from(pads).find(Boolean);
    const p = this.pad;
    if (!gp) { p.left = p.right = p.up = p.down = p.jump = false; return; }
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    p.left = b(14) || ax < -0.5;
    p.right = b(15) || ax > 0.5;
    p.up = b(12) || ay < -0.5;
    p.down = b(13) || ay > 0.5;
    p.jump = b(0) || b(1);
    const prev = this.prevPadButtons;
    if ((b(0) && !prev[0]) || (b(1) && !prev[1])) { this.edge.jump = true; this.edge.human = true; this.gesture(); }
    const dirs = '' + +p.left + +p.right + +p.up + +p.down;
    if (dirs !== this.prevPadDirs && dirs !== '0000') this.edge.human = true;
    this.prevPadDirs = dirs;
    if (b(9) && !prev[9]) { this.edge.start = true; this.gesture(); }
    if (b(8) && !prev[8]) this.edge.pause = true;
    this.prevPadButtons = gp.buttons.map((x) => x.pressed);
  }

  // Called once per fixed update step.
  update() {
    this.pollGamepad();
    for (const k of ['left', 'right', 'up', 'down', 'jump']) {
      this[k] = this.keys[k] || this.touch[k] || this.pad[k];
    }
    this.jumpPressed = this.edge.jump;
    this.startPressed = this.edge.start;
    this.pausePressed = this.edge.pause;
    this.mutePressed = this.edge.mute;
    this.cpuPressed = this.edge.cpu;
    this.helpPressed = this.edge.help;
    this.humanPressed = this.edge.human;
    for (const k in this.edge) this.edge[k] = false;
  }
}
