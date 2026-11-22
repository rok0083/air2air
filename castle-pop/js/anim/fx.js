/* =========================================================================
   fx.js — 보드 위 연출 레이어 (파티클 · 충격파 · 빔 · 코인 비행 · 별 · 화면 흔들림)
   fx 캔버스는 보드 캔버스와 같은 좌표계를 쓴다.
   ========================================================================= */
import { ParticlePool } from './particles.js';
import { Ease, TweenSet } from './tween.js';

export class FX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pool = new ParticlePool();
    this.tweens = new TweenSet();
    this.rings = [];
    this.beams = [];
    this.fliers = [];
    this.shake = 0;
    this.shakeDecay = 0.9;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.slowMo = 1;
    this.reduce = false;
    this.W = 1; this.H = 1; this.dpr = 1;
  }

  resize(w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  burst(x, y, color, count = 10, opts = {}) {
    if (this.reduce) count = Math.ceil(count / 2);
    this.pool.burst(x, y, color, count, opts);
  }

  ring(x, y, color, radius = 40, opts = {}) {
    if (this.reduce) return;
    this.rings.push({ x, y, color, r0: opts.r0 ?? 6, r1: radius, life: 0, max: opts.max ?? 360, width: opts.width ?? 5 });
  }

  beam(x1, y1, x2, y2, color, opts = {}) {
    if (this.reduce) return;
    this.beams.push({ x1, y1, x2, y2, color, life: 0, max: opts.max ?? 240, width: opts.width ?? 7 });
  }

  fly(from, to, drawFn, opts = {}) {
    this.fliers.push({
      x: from.x, y: from.y, x0: from.x, y0: from.y, x1: to.x, y1: to.y,
      life: 0, max: opts.dur ?? 480, curve: opts.curve ?? -70, draw: drawFn, onDone: opts.onDone,
      scale: opts.scale ?? 1, color: opts.color ?? '#ffe9a3', trail: 0, lastTrail: -999,
    });
  }

  addShake(amount = 8) {
    if (this.reduce) amount *= 0.4;
    this.shake = Math.min(26, this.shake + amount);
  }

  punchZoom(scale = 1.04, ms = 260) {
    if (this.reduce) return;
    this.zoom = scale;
    this.tweens.add({ from: scale, to: 1, dur: ms, ease: Ease.outCubic, onUpdate: v => { this.zoom = v; } });
  }

  update(dt) {
    const d = dt * this.slowMo;
    this.pool.update(d);
    this.tweens.update(dt);
    for (const r of this.rings) r.life += d;
    this.rings = this.rings.filter(r => r.life < r.max);
    for (const b of this.beams) b.life += d;
    this.beams = this.beams.filter(b => b.life < b.max);
    for (const f of this.fliers) {
      f.life += d;
      const p = Math.min(1, f.life / f.max);
      const e = Ease.outQuad(p);
      f.x = f.x0 + (f.x1 - f.x0) * e;
      f.y = f.y0 + (f.y1 - f.y0) * e + Math.sin(p * Math.PI) * f.curve;
      // 빛 꼬리 — 지나간 자리에 반짝이가 남는다
      if (!this.reduce && f.life - f.lastTrail > 26) {
        f.lastTrail = f.life;
        this.pool.spawn({
          x: f.x + (Math.random() - 0.5) * 8, y: f.y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 50, vy: 26 + Math.random() * 50,
          size: 2.4 + Math.random() * 3.4, color: f.color, shape: 'star',
          max: 300 + Math.random() * 180, grav: 60, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6,
        });
      }
      if (p >= 1) { f.onDone?.(); f.dead = true; }
    }
    this.fliers = this.fliers.filter(f => !f.dead);
    this.shake *= Math.pow(this.shakeDecay, dt / 16.6);
    if (this.shake < 0.3) this.shake = 0;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.save();
    if (this.zoom !== 1) {
      ctx.translate(this.W / 2, this.H / 2);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.W / 2, -this.H / 2);
    }
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    // 빔
    for (const b of this.beams) {
      const p = b.life / b.max;
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.9;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width * (1 - p * 0.6);
      ctx.lineCap = 'round';
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x1 + (b.x2 - b.x1) * Math.min(1, p * 2.4), b.y1 + (b.y2 - b.y1) * Math.min(1, p * 2.4));
      ctx.stroke();
      ctx.restore();
    }
    // 링
    for (const r of this.rings) {
      const p = r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * Ease.outCubic(p);
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 16 * (1 - p);
      ctx.lineWidth = r.width * (1 - p * 0.7);
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    this.pool.draw(ctx);
    // 날아가는 아이콘
    for (const f of this.fliers) {
      ctx.save();
      ctx.translate(f.x, f.y);
      const s = f.scale;
      ctx.scale(s, s);
      // 뒤에 따라오는 빛무리
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
      glow.addColorStop(0, 'rgba(255,246,190,0.85)');
      glow.addColorStop(0.5, 'rgba(255,220,110,0.35)');
      glow.addColorStop(1, 'rgba(255,220,110,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 14;
      f.draw(ctx);
      ctx.restore();
    }
    ctx.restore();
  }
}
