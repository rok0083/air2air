/* =========================================================================
   오디오 — Web Audio API 로 모든 소리를 즉석 합성합니다(외부 음원 없음).
     · 효과음: 교체·매치·연쇄(연쇄마다 음정 상승)·특수 발동·부스터·승리/패배
     · 배경음: 월드별 음계/템포가 다른 잔잔한 루프
     · 음소거 토글(설정에 저장)
   ========================================================================= */
import { CFG } from '../config.js';

const NOTE = (semi, base = 261.63) => base * Math.pow(2, semi / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.enabled = true;
    this.musicOn = true;
    this._musicTimer = null;
    this._world = null;
    this._step = 0;
    this.cascade = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = CFG.audio.masterVolume;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = CFG.audio.sfxVolume;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = CFG.audio.musicVolume;
    this.musicGain.connect(this.master);
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? CFG.audio.masterVolume : 0, this.ctx.currentTime, 0.05);
  }

  toggle() { this.setEnabled(!this.enabled); return this.enabled; }

  setMusic(on) {
    this.musicOn = !!on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on && this.enabled ? CFG.audio.musicVolume : 0, this.ctx.currentTime, 0.1);
    if (!on) this.stopMusic();
  }

  /* ── 기본 합성 헬퍼 ───────────────────────────────────── */
  tone(freq, dur = 0.18, opts = {}) {
    if (!this.ctx || !this.enabled) return;
    const { type = 'sine', vol = 0.25, delay = 0, dest = this.sfxGain, attack = 0.005, slideTo = null, filter = 0 } = opts;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filter;
      node.connect(f); f.connect(g);
    } else node.connect(g);
    g.connect(dest);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  noise(dur = 0.2, vol = 0.2, delay = 0, filterFreq = 1200) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = filterFreq; f.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  }

  /* ── 게임 효과음 ─────────────────────────────────────── */
  sfx(name, opts = {}) {
    if (!this.ctx) return;
    switch (name) {
      case 'click':
        this.tone(660, 0.06, { type: 'triangle', vol: 0.14 });
        this.tone(990, 0.05, { type: 'sine', vol: 0.08, delay: 0.02 });
        break;
      case 'swap':
        this.tone(520, 0.07, { type: 'triangle', vol: 0.1, slideTo: 660 });
        break;
      case 'invalid':
        this.tone(220, 0.12, { type: 'sawtooth', vol: 0.08, slideTo: 160 });
        break;
      case 'match': {
        // 연쇄 단계마다 반음씩 올라가는 음정
        const step = Math.min(12, (opts.cascade || 1) - 1);
        const base = NOTE(step + 7, 330);
        this.tone(base, 0.14, { type: 'sine', vol: 0.16 });
        this.tone(base * 1.5, 0.12, { type: 'triangle', vol: 0.08, delay: 0.03 });
        break;
      }
      case 'cascade': {
        const step = Math.min(14, opts.cascade || 2);
        this.tone(NOTE(step + 5, 300), 0.16, { type: 'triangle', vol: 0.15 });
        break;
      }
      case 'powerup':
        this.tone(880, 0.12, { type: 'square', vol: 0.08, slideTo: 1320 });
        this.tone(1320, 0.18, { type: 'sine', vol: 0.12, delay: 0.05 });
        break;
      case 'rocket':
        this.noise(0.28, 0.18, 0, 2400);
        this.tone(300, 0.25, { type: 'sawtooth', vol: 0.09, slideTo: 900 });
        break;
      case 'tnt':
        this.noise(0.4, 0.3, 0, 420);
        this.tone(90, 0.35, { type: 'sine', vol: 0.22, slideTo: 40 });
        break;
      case 'spinner':
        this.tone(700, 0.2, { type: 'sine', vol: 0.12, slideTo: 1400 });
        this.tone(1200, 0.25, { type: 'triangle', vol: 0.07, delay: 0.08, slideTo: 500 });
        break;
      case 'electro':
        this.noise(0.25, 0.16, 0, 3200);
        for (let i = 0; i < 3; i++) this.tone(1000 + i * 300, 0.08, { type: 'square', vol: 0.05, delay: i * 0.05 });
        break;
      case 'booster':
        this.tone(400, 0.15, { type: 'triangle', vol: 0.15, slideTo: 800 });
        this.noise(0.18, 0.12, 0.02, 1800);
        break;
      case 'obstacle':
        this.tone(180, 0.1, { type: 'square', vol: 0.07 });
        break;
      case 'break':
        this.noise(0.18, 0.16, 0, 900);
        break;
      case 'item':
        [880, 1100, 1320].forEach((f, i) => this.tone(f, 0.12, { type: 'sine', vol: 0.12, delay: i * 0.06 }));
        break;
      case 'star':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.12, delay: i * 0.12 }));
        break;
      case 'coin':
        this.tone(1200, 0.07, { type: 'square', vol: 0.07 });
        this.tone(1800, 0.12, { type: 'square', vol: 0.06, delay: 0.06 });
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.15, delay: i * 0.13 }));
        break;
      case 'lose':
        [392, 349, 294, 220].forEach((f, i) => this.tone(f, 0.35, { type: 'sine', vol: 0.14, delay: i * 0.15 }));
        break;
      case 'restore':
        this.noise(0.2, 0.12, 0, 1400);
        [523, 784, 1046].forEach((f, i) => this.tone(f, 0.3, { type: 'sine', vol: 0.1, delay: i * 0.1 }));
        break;
      case 'boss':
        this.tone(70, 0.5, { type: 'sawtooth', vol: 0.16, slideTo: 45 });
        break;
      default:
        break;
    }
  }

  /* ── 월드별 배경음 ───────────────────────────────────── */
  startMusic(worldId = 1) {
    this.stopMusic();
    if (!this.ctx || !this.musicOn || !this.enabled) { this._world = worldId; return; }
    this._world = worldId;
    const w = CFG.worlds[(worldId - 1) % CFG.worlds.length];
    const scale = w.scale;
    const root = worldId >= 4 ? 174.61 : 196;
    const beatMs = Math.round(60000 / w.tempo / 2); // 8분음표
    this._step = 0;
    const playStep = () => {
      if (!this.ctx || this._world !== worldId) return;
      const s = this._step++;
      const bar = Math.floor(s / 8) % 4;
      const deg = scale[(s * 3 + bar) % scale.length];
      const oct = (s % 8 === 0) ? 0 : (s % 4 === 0 ? 12 : 0);
      const f = NOTE(deg + oct, root);
      // 아르페지오(조용히)
      this.tone(f, 0.5, { type: 'sine', vol: 0.045, dest: this.musicGain, attack: 0.08 });
      if (s % 8 === 0) {
        // 베이스
        this.tone(NOTE(scale[bar % scale.length], root / 2), 1.2, { type: 'triangle', vol: 0.06, dest: this.musicGain, attack: 0.15 });
        // 패드 화음
        [0, 4, 7].forEach((iv, i) => this.tone(NOTE(scale[(bar + i) % scale.length] + iv, root), 1.6, { type: 'sine', vol: 0.022, dest: this.musicGain, attack: 0.3 }));
      }
      if (s % 16 === 12 && worldId % 2 === 0) this.tone(f * 2, 0.4, { type: 'sine', vol: 0.03, dest: this.musicGain });
    };
    playStep();
    this._musicTimer = setInterval(playStep, beatMs);
  }

  stopMusic() {
    if (this._musicTimer) clearInterval(this._musicTimer);
    this._musicTimer = null;
    this._world = null;
  }

  /* 화면 전환용 짧은 스팅 */
  sting(worldId = 1) {
    const w = CFG.worlds[(worldId - 1) % 5];
    [0, 4, 7].forEach((iv, i) => this.tone(NOTE(w.scale[i] + iv, 261), 0.5, { type: 'triangle', vol: 0.08, delay: i * 0.08 }));
  }
}
