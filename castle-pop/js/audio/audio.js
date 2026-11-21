/* =========================================================================
   audio.js — 100% Web Audio API 합성 (외부 음원 파일 없음)
   · BGM: 홈 왈츠 / 레벨 / 러시(미니게임), 이동 5 이하이면 템포 업
   · 효과음: 선택, 교환, 실패 교환, 착지, 매치(연쇄마다 음정 상승), 파워업 생성,
     로켓, TNT(저음 포함), 프로펠러, 빛구슬 충전·방출, 재질별 파괴, 수집, 콜아웃,
     버튼, 팝업, 코인, 상자 열림, 클리어 팡파르, 실패, 순위 상승
   · 첫 터치에서 오디오 시작, 음악/효과음 음량 분리
   ========================================================================= */
import { CFG } from '../config.js';

const NOTE = {};
(() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let oct = 1; oct <= 7; oct++) {
    names.forEach((n, i) => { NOTE[`${n}${oct}`] = 440 * Math.pow(2, (i - 9) / 12 + (oct - 4)); });
  }
})();

const MELODIES = {
  home: {
    bpm: CFG.audio.bpm.home, beat: 0.75,
    melody: ['C5', 'E5', 'G5', 'E5', 'D5', 'F5', 'A5', 'G5', 'C5', 'E5', 'G5', 'C6', 'B5', 'G5', 'E5', 'D5'],
    bass: ['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'G2'],
    wave: 'triangle', bassWave: 'sine',
  },
  level: {
    bpm: CFG.audio.bpm.level, beat: 0.5,
    melody: ['G4', 'G4', 'B4', 'D5', 'G5', 'D5', 'B4', 'D5', 'E5', 'D5', 'B4', 'G4', 'A4', 'B4', 'D5', 'E5'],
    bass: ['G2', 'G2', 'D3', 'D3', 'E3', 'E3', 'C3', 'C3'],
    wave: 'square', bassWave: 'triangle',
  },
  rush: {
    bpm: CFG.audio.bpm.rush, beat: 0.5,
    melody: ['E5', 'G5', 'B5', 'E6', 'D6', 'B5', 'G5', 'B5', 'A5', 'C6', 'E6', 'A6', 'G6', 'E6', 'C6', 'E6'],
    bass: ['E2', 'E2', 'B2', 'B2', 'A2', 'A2', 'C3', 'C3'],
    wave: 'sawtooth', bassWave: 'square',
  },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicVol = CFG.audio.musicVolume;
    this.sfxVol = CFG.audio.sfxVolume;
    this.muted = false;
    this.track = null;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.tempo = 1;
    this.ready = false;
    this.lastPlayed = new Map();
  }

  init() {
    if (this.ready) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVol;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.master);
      this.ready = true;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    } catch { return false; }
  }

  setMusicVolume(v) {
    this.musicVol = v;
    if (this.musicGain) this.musicGain.gain.value = this.muted ? 0 : v;
  }
  setSfxVolume(v) {
    this.sfxVol = v;
    if (this.sfxGain) this.sfxGain.gain.value = this.muted ? 0 : v;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  /* ---------------- 저수준 톤 ---------------- */
  tone({ freq = 440, dur = 0.16, type = 'sine', gain = 0.2, when = 0, glide = 0, attack = 0.006, bus = 'sfx', detune = 0 }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * glide), t0 + dur);
    if (detune) osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus === 'music' ? this.musicGain : this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.12, gain = 0.12, when = 0, hp = 400, lp = 6000, bus = 'sfx' }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hp;
    bp.Q.value = 0.8;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(lpf); lpf.connect(g); g.connect(bus === 'music' ? this.musicGain : this.sfxGain);
    src.start(t0);
  }

  /* ---------------- 효과음 ---------------- */
  play(name, opts = {}) {
    if (!this.ready || this.muted) return;
    const now = performance.now();
    const last = this.lastPlayed.get(name) || 0;
    if (now - last < 24) return;
    this.lastPlayed.set(name, now);
    const pitch = opts.pitch || 0;
    const p = Math.pow(2, pitch / 12);
    switch (name) {
      case 'select':
        this.tone({ freq: 660 * p, dur: 0.07, type: 'triangle', gain: 0.16 });
        break;
      case 'swap':
        this.tone({ freq: 520 * p, dur: 0.1, type: 'sine', gain: 0.18, glide: 1.35 });
        this.noise({ dur: 0.06, gain: 0.05, hp: 1800 });
        break;
      case 'swapback':
        this.tone({ freq: 300 * p, dur: 0.12, type: 'square', gain: 0.10, glide: 0.7 });
        break;
      case 'land':
        this.tone({ freq: 180 * p, dur: 0.07, type: 'sine', gain: 0.1, glide: 0.85 });
        break;
      case 'match': {
        const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
        const semi = scale[Math.min(scale.length - 1, opts.chain || 0)];
        this.tone({ freq: 523.25 * Math.pow(2, semi / 12), dur: 0.13, type: 'triangle', gain: 0.17, glide: 1.04 });
        this.tone({ freq: 784 * Math.pow(2, semi / 12), dur: 0.09, type: 'sine', gain: 0.08 });
        break;
      }
      case 'powerup':
        [0, 4, 7, 12].forEach((s, i) => this.tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.16, when: i * 0.045, type: 'triangle', gain: 0.14 }));
        break;
      case 'rocket':
        this.noise({ dur: 0.3, gain: 0.16, hp: 900, lp: 5000 });
        this.tone({ freq: 900, dur: 0.28, type: 'sawtooth', gain: 0.1, glide: 0.25 });
        break;
      case 'tnt':
        this.noise({ dur: 0.4, gain: 0.28, hp: 200, lp: 1800 });
        this.tone({ freq: 90, dur: 0.4, type: 'sine', gain: 0.3, glide: 0.4 });
        this.tone({ freq: 140, dur: 0.2, type: 'square', gain: 0.12, glide: 0.5 });
        if (navigator.vibrate) navigator.vibrate(18);
        break;
      case 'propeller':
        for (let i = 0; i < 5; i++) this.tone({ freq: 700 + i * 60, dur: 0.06, when: i * 0.04, type: 'sine', gain: 0.09 });
        break;
      case 'lightCharge':
        this.tone({ freq: 300, dur: 0.35, type: 'sine', gain: 0.14, glide: 3.2 });
        break;
      case 'lightRelease':
        this.tone({ freq: 1300, dur: 0.3, type: 'triangle', gain: 0.2, glide: 0.4 });
        this.noise({ dur: 0.25, gain: 0.1, hp: 3000 });
        break;
      case 'crate':
        this.noise({ dur: 0.14, gain: 0.16, hp: 700, lp: 2600 });
        this.tone({ freq: 220, dur: 0.09, type: 'square', gain: 0.08, glide: 0.7 });
        break;
      case 'glass':
        this.noise({ dur: 0.16, gain: 0.13, hp: 3800 });
        this.tone({ freq: 1800, dur: 0.12, type: 'sine', gain: 0.1, glide: 1.4 });
        break;
      case 'ice':
        this.noise({ dur: 0.18, gain: 0.12, hp: 2600 });
        this.tone({ freq: 2400, dur: 0.1, type: 'triangle', gain: 0.08, glide: 0.7 });
        break;
      case 'metal':
        this.tone({ freq: 900, dur: 0.2, type: 'square', gain: 0.09, glide: 0.9 });
        this.noise({ dur: 0.1, gain: 0.08, hp: 2400 });
        break;
      case 'leaf':
        this.noise({ dur: 0.12, gain: 0.09, hp: 1500 });
        break;
      case 'collect':
        this.tone({ freq: 1046, dur: 0.1, type: 'sine', gain: 0.16, glide: 1.2 });
        break;
      case 'callout':
        [0, 5, 9, 12].forEach((s, i) => this.tone({ freq: 587 * Math.pow(2, s / 12), dur: 0.18, when: i * 0.06, type: 'square', gain: 0.11 }));
        break;
      case 'button':
        this.tone({ freq: 700, dur: 0.06, type: 'sine', gain: 0.14 });
        this.tone({ freq: 1050, dur: 0.05, when: 0.04, type: 'sine', gain: 0.08 });
        break;
      case 'popup':
        this.tone({ freq: 420, dur: 0.14, type: 'triangle', gain: 0.14, glide: 1.6 });
        break;
      case 'close':
        this.tone({ freq: 420, dur: 0.12, type: 'triangle', gain: 0.12, glide: 0.7 });
        break;
      case 'coin':
        this.tone({ freq: 1568, dur: 0.08, type: 'square', gain: 0.08 });
        this.tone({ freq: 2093, dur: 0.09, when: 0.05, type: 'square', gain: 0.07 });
        break;
      case 'coinShower':
        for (let i = 0; i < 10; i++) {
          this.tone({ freq: 1300 + Math.random() * 900, dur: 0.08, when: i * 0.055, type: 'square', gain: 0.06 });
        }
        break;
      case 'chest':
        this.tone({ freq: 200, dur: 0.2, type: 'sawtooth', gain: 0.12, glide: 1.6 });
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.2, when: 0.12 + i * 0.07, type: 'triangle', gain: 0.13 }));
        break;
      case 'victory':
        [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => this.tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.22, when: i * 0.09, type: 'triangle', gain: 0.15 }));
        break;
      case 'fail':
        [0, -2, -5, -9].forEach((s, i) => this.tone({ freq: 440 * Math.pow(2, s / 12), dur: 0.28, when: i * 0.13, type: 'sine', gain: 0.16 }));
        break;
      case 'rankup':
        [0, 7, 12, 16].forEach((s, i) => this.tone({ freq: 660 * Math.pow(2, s / 12), dur: 0.16, when: i * 0.07, type: 'square', gain: 0.11 }));
        break;
      case 'failpop':
        this.tone({ freq: 260, dur: 0.18, type: 'sine', gain: 0.14, glide: 0.6 });
        break;
    }
  }

  /* ---------------- BGM ---------------- */
  startMusic(trackName) {
    if (!this.ready) return;
    if (this.track === trackName) return;
    this.stopMusic();
    this.track = trackName;
    this.step = 0;
    this.tempo = 1;
    this.nextTime = this.ctx.currentTime + 0.08;
    const loopFn = () => {
      if (!this.track) return;
      const m = MELODIES[this.track];
      if (!m) return;
      const beat = m.beat / this.tempo;
      while (this.nextTime < this.ctx.currentTime + 0.5) {
        const i = this.step % m.melody.length;
        const when = this.nextTime - this.ctx.currentTime;
        const note = m.melody[i];
        if (note) {
          this.tone({ freq: NOTE[note], dur: beat * 0.9, when, type: m.wave, gain: 0.055, bus: 'music' });
          this.tone({ freq: NOTE[note] / 2, dur: beat * 0.9, when, type: 'sine', gain: 0.02, bus: 'music' });
        }
        if (i % 2 === 0) {
          const bass = m.bass[(this.step / 2) % m.bass.length | 0];
          if (bass) this.tone({ freq: NOTE[bass], dur: beat * 1.7, when, type: m.bassWave, gain: 0.05, bus: 'music' });
          this.noise({ dur: 0.03, gain: 0.018, hp: 6000, when, bus: 'music' });
        }
        if (i % 4 === 2) this.noise({ dur: 0.05, gain: 0.03, hp: 3200, when, bus: 'music' });
        this.step++;
        this.nextTime += beat;
      }
      this.timer = setTimeout(loopFn, 180);
    };
    loopFn();
  }

  setTempo(t) {
    this.tempo = t;
  }

  stopMusic() {
    this.track = null;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  duck(on) {
    if (!this.musicGain) return;
    this.musicGain.gain.value = (this.muted ? 0 : this.musicVol) * (on ? 0.35 : 1);
  }
}

export const Audio = new AudioEngine();
