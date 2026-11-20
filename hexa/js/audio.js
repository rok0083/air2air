/* =========================================================================
   헥사 블리츠 — 사운드 (Web Audio API 합성, 외부 파일 없음)
   · 콤보가 올라갈수록 효과음 음정이 올라갑니다.
   · 피버 구간에서는 배경 음악의 조성과 템포가 바뀝니다.
   ========================================================================= */

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicOn = false;
    this.feverMode = false;
    this._musicTimer = null;
    this._step = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    } catch (e) {
      this.ctx = null;
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(on) {
    this.muted = !!on;
    this.init();
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    if (this.muted) this.stopMusic();
  }

  /* ── 기본 합성기 ─────────────────────────────────────────── */
  tone({ freq = 440, to = null, type = 'sine', dur = 0.14, gain = 0.16, delay = 0, attack = 0.004, dest = null }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise({ dur = 0.2, gain = 0.12, freq = 1400, q = 1, type = 'bandpass', delay = 0 }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  }

  /* ── 효과음 ──────────────────────────────────────────────── */
  play(name, arg = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    switch (name) {
      case 'swap':
        this.tone({ freq: 520, to: 640, type: 'triangle', dur: 0.07, gain: 0.1 });
        break;
      case 'invalid':
        this.tone({ freq: 220, to: 150, type: 'square', dur: 0.12, gain: 0.09 });
        break;
      case 'clear': {
        // 콤보가 높을수록 음정 상승
        const step = Math.min(12, Math.max(0, arg - 1));
        const base = 440 * Math.pow(2, step / 12);
        this.tone({ freq: base, to: base * 1.5, type: 'triangle', dur: 0.11, gain: 0.13 });
        this.tone({ freq: base * 2, type: 'sine', dur: 0.09, gain: 0.06, delay: 0.03 });
        this.noise({ dur: 0.1, gain: 0.04, freq: 3000 });
        break;
      }
      case 'special':
        this.tone({ freq: 700, to: 1500, type: 'sawtooth', dur: 0.2, gain: 0.1 });
        this.tone({ freq: 1200, to: 1800, type: 'sine', dur: 0.24, gain: 0.07, delay: 0.05 });
        break;
      case 'beam':
        this.tone({ freq: 1600, to: 300, type: 'sawtooth', dur: 0.22, gain: 0.12 });
        this.noise({ dur: 0.16, gain: 0.07, freq: 2400 });
        break;
      case 'bomb':
        this.noise({ dur: 0.45, gain: 0.18, freq: 220, type: 'lowpass' });
        this.tone({ freq: 120, to: 45, type: 'sine', dur: 0.42, gain: 0.14 });
        break;
      case 'propeller':
        this.tone({ freq: 600, to: 1400, type: 'square', dur: 0.18, gain: 0.08 });
        this.noise({ dur: 0.2, gain: 0.06, freq: 1800, q: 2 });
        break;
      case 'hyper':
        [440, 660, 880, 1320].forEach((f, i) =>
          this.tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.09, delay: i * 0.05 }));
        break;
      case 'nova':
        this.noise({ dur: 0.6, gain: 0.16, freq: 350, type: 'lowpass' });
        this.tone({ freq: 160, to: 820, type: 'sawtooth', dur: 0.6, gain: 0.1 });
        break;
      case 'combo': {
        const step = Math.min(14, Math.max(0, (arg || 2) - 1));
        const f = 620 * Math.pow(2, step / 12);
        this.tone({ freq: f, to: f * 1.25, type: 'triangle', dur: 0.13, gain: 0.11 });
        break;
      }
      case 'blaze':
        this.tone({ freq: 300, to: 900, type: 'sawtooth', dur: 0.5, gain: 0.12 });
        this.noise({ dur: 0.5, gain: 0.1, freq: 700 });
        break;
      case 'fever':
        [523, 659, 784, 1046, 1318].forEach((f, i) =>
          this.tone({ freq: f, type: 'square', dur: 0.2, gain: 0.09, delay: i * 0.08 }));
        break;
      case 'item':
        this.tone({ freq: 880, type: 'triangle', dur: 0.1, gain: 0.1 });
        this.tone({ freq: 1320, type: 'sine', dur: 0.14, gain: 0.08, delay: 0.07 });
        break;
      case 'time':
        this.tone({ freq: 900, to: 1500, type: 'sine', dur: 0.3, gain: 0.12 });
        break;
      case 'tick':
        this.tone({ freq: 1200, type: 'square', dur: 0.04, gain: 0.06 });
        break;
      case 'booster':
        this.tone({ freq: 500, to: 900, type: 'triangle', dur: 0.16, gain: 0.1 });
        break;
      case 'level':
        [660, 880, 1100].forEach((f, i) =>
          this.tone({ freq: f, type: 'triangle', dur: 0.15, gain: 0.1, delay: i * 0.07 }));
        break;
      case 'over':
        [520, 440, 350, 260, 180].forEach((f, i) =>
          this.tone({ freq: f, type: 'triangle', dur: 0.3, gain: 0.12, delay: i * 0.13 }));
        break;
      case 'ui':
        this.tone({ freq: 780, type: 'square', dur: 0.04, gain: 0.05 });
        break;
      default:
        this.tone({ freq: 600, type: 'sine', dur: 0.07, gain: 0.07 });
    }
  }

  /* ── 배경 음악 (간단한 아르페지오) ───────────────────────── */
  startMusic() {
    if (this.muted) return;
    this.init();
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this._step = 0;
    const schedule = () => {
      if (!this.musicOn) return;
      const fever = this.feverMode;
      const scale = fever ? [0, 3, 5, 7, 10, 12] : [0, 2, 4, 7, 9, 12];
      const root = fever ? 196 : 174.6;
      const note = scale[this._step % scale.length];
      const freq = root * Math.pow(2, note / 12);
      this.tone({ freq, type: fever ? 'square' : 'sine', dur: 0.28, gain: fever ? 0.05 : 0.04, dest: this.musicGain });
      if (this._step % 4 === 0) {
        this.tone({ freq: freq / 2, type: 'triangle', dur: 0.4, gain: 0.03, dest: this.musicGain });
      }
      this._step++;
      this._musicTimer = setTimeout(schedule, fever ? 170 : 240);
    };
    schedule();
  }

  stopMusic() {
    this.musicOn = false;
    if (this._musicTimer) clearTimeout(this._musicTimer);
    this._musicTimer = null;
  }

  setFeverMode(on) {
    this.feverMode = !!on;
  }
}
