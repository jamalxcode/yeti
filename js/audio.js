// Original sound effects synthesized with Web Audio. No audio files.

export class Sfx {
  constructor() {
    this.ctx = null;
    try { this.muted = localStorage.getItem('yeti.muted') === '1'; } catch { this.muted = false; }
  }

  // Browsers only allow audio after a user gesture.
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* audio unavailable */ }
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('yeti.muted', this.muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, dur, { type = 'square', vol = 0.12, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, { vol = 0.15, delay = 0, freq = 1200 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  notes(seq, { type = 'square', vol = 0.1, gap = 0.09, len = 0.08 } = {}) {
    seq.forEach((f, i) => { if (f) this.tone(f, len, { type, vol, delay: i * gap }); });
  }

  play(name) {
    switch (name) {
      case 'jump': this.tone(330, 0.14, { slide: 330, vol: 0.08 }); break;
      case 'step': this.tone(1400, 0.025, { type: 'triangle', vol: 0.05 }); break;
      case 'land': this.tone(140, 0.05, { type: 'triangle', vol: 0.1 }); break;
      case 'climb': this.tone(700, 0.02, { type: 'triangle', vol: 0.04 }); break;
      case 'score': this.notes([1046, 1568], { vol: 0.07, gap: 0.06, len: 0.06 }); break;
      case 'pickup': this.notes([523, 659, 784, 1046], { vol: 0.08, gap: 0.06 }); break;
      case 'smash': this.noise(0.18, { vol: 0.25, freq: 2500 }); this.tone(160, 0.12, { slide: -100, vol: 0.1 }); break;
      case 'throw': this.tone(160, 0.18, { type: 'sawtooth', slide: -90, vol: 0.08 }); break;
      case 'roar':
        this.tone(95, 0.5, { type: 'sawtooth', slide: -40, vol: 0.12 });
        this.tone(100, 0.5, { type: 'sawtooth', slide: -45, vol: 0.08, delay: 0.03 });
        this.noise(0.4, { vol: 0.08, freq: 600 });
        break;
      case 'stomp': this.noise(0.25, { vol: 0.3, freq: 400 }); this.tone(70, 0.2, { slide: -30, vol: 0.15 }); break;
      case 'splash': this.noise(0.25, { vol: 0.12, freq: 1800 }); break;
      case 'seal': this.notes([392, 330], { type: 'triangle', vol: 0.08, gap: 0.07 }); break;
      case 'die':
        this.notes([784, 740, 698, 659, 622, 587, 554, 523, 0, 392, 0, 262], { vol: 0.09, gap: 0.08, len: 0.07 });
        break;
      case 'clear':
        this.notes([523, 659, 784, 1046, 0, 784, 1046], { vol: 0.09, gap: 0.1, len: 0.12 });
        break;
      case 'start':
        this.notes([392, 523, 659, 523, 659, 784], { vol: 0.08, gap: 0.1, len: 0.09 });
        break;
      case 'extra': this.notes([659, 784, 1046, 1318, 1568], { vol: 0.08, gap: 0.07 }); break;
      case 'gameover':
        this.notes([523, 0, 392, 0, 330, 0, 262], { type: 'triangle', vol: 0.12, gap: 0.14, len: 0.14 });
        break;
      case 'tick': this.tone(220, 0.04, { vol: 0.05 }); break;
    }
  }
}
