/* =========================================================================
   tween.js — 이징 · 트윈 · 타임라인 · 지연/대기 헬퍼
   ========================================================================= */
export const Ease = {
  linear: t => t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inQuad: t => t * t,
  inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outBack: t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  outElastic: t => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export const wait = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));

/* 진행 중인 트윈 묶음 — 매 프레임 update(dt)를 호출한다 */
export class TweenSet {
  constructor() { this.list = []; }
  add({ from = 0, to = 1, dur = 300, ease = Ease.outQuad, onUpdate, onDone, delay = 0 }) {
    const tw = { from, to, dur, ease, onUpdate, onDone, delay, elapsed: 0, done: false };
    this.list.push(tw);
    return tw;
  }
  update(dt) {
    for (const tw of this.list) {
      if (tw.done) continue;
      tw.elapsed += dt;
      let t = tw.elapsed - tw.delay;
      if (t < 0) continue;
      const p = Math.min(1, t / tw.dur);
      tw.onUpdate?.(tw.from + (tw.to - tw.from) * tw.ease(p), p);
      if (p >= 1) { tw.done = true; tw.onDone?.(); }
    }
    if (this.list.length > 120) this.list = this.list.filter(t => !t.done);
  }
  clear() { this.list = []; }
  get busy() { return this.list.some(t => !t.done); }
}

/* 프레임 기반 애니메이션 루프 (60fps 목표) */
export class Loop {
  constructor(update) {
    this.update = update;
    this.running = false;
    this.last = 0;
    this._tick = this._tick.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }
  stop() { this.running = false; }
  _tick(now) {
    if (!this.running) return;
    const dt = Math.min(64, now - this.last);
    this.last = now;
    this.update(dt, now);
    requestAnimationFrame(this._tick);
  }
}
