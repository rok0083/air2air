/* =========================================================================
   헥사 블리츠 — 연출(FX) 시스템
   파티클 풀 · 빔 · 충격파 · 전기 아크 · 프로펠러 비행 · 화면 플래시/흔들림/슬로모
   ========================================================================= */

const MAX_PARTICLES = 700;

export class FX {
  constructor() {
    this.particles = [];
    this.pool = [];
    this.beams = [];
    this.waves = [];
    this.arcs = [];
    this.texts = [];
    this.flights = [];
    this.flashAlpha = 0;
    this.shakeUntil = 0;
    this.shakeMag = 0;
    this.slowUntil = 0;
    this.slowScale = 1;
    this.w = 1;
    this.h = 1;
  }

  reset() {
    this.particles.length = 0;
    this.beams.length = 0;
    this.waves.length = 0;
    this.arcs.length = 0;
    this.texts.length = 0;
    this.flights.length = 0;
    this.flashAlpha = 0;
    this.shakeUntil = 0;
    this.slowUntil = 0;
    this.slowScale = 1;
  }

  resize(w, h) { this.w = w; this.h = h; }

  /* ── 파티클 ─────────────────────────────────────────────── */
  _spawn() {
    if (this.pool.length) return this.pool.pop();
    return { x: 0, y: 0, vx: 0, vy: 0, life: 1, decay: 0.02, size: 4, color: '#fff', gravity: 0.35, shape: 'dot' };
  }

  burst(x, y, color, count = 8, opts = {}) {
    const { speed = 1, size = 1, gravity = 0.35, shape = 'dot' } = opts;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const p = this._spawn();
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random() * 2.2) * speed;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - 0.5 * speed;
      p.life = 1;
      p.decay = 0.02 + Math.random() * 0.025;
      p.size = (2 + Math.random() * 4) * size;
      p.color = color;
      p.gravity = gravity;
      p.shape = shape;
      this.particles.push(p);
    }
  }

  /* ── 빔 (줄/열 제거) ─────────────────────────────────────── */
  beam(x1, y1, x2, y2, color = '#bff4ff', width = 14) {
    this.beams.push({ x1, y1, x2, y2, color, width, born: performance.now(), life: 380 });
  }

  /* ── 충격파 ─────────────────────────────────────────────── */
  shockwave(x, y, radius, color = '#ffd166') {
    this.waves.push({ x, y, radius, color, born: performance.now(), life: 460 });
  }

  /* ── 전기 아크 ──────────────────────────────────────────── */
  arc(points, color = '#fff3a0') {
    this.arcs.push({ points, color, born: performance.now(), life: 300 });
  }

  /* ── 프로펠러 비행 ──────────────────────────────────────── */
  flight(x1, y1, x2, y2, color = '#facc15') {
    this.flights.push({ x1, y1, x2, y2, color, born: performance.now(), life: 420 });
  }

  /* ── 점수 텍스트 ────────────────────────────────────────── */
  text(x, y, text, color = '#fff', size = 18) {
    this.texts.push({ x, y, text, color, size, born: performance.now(), life: 900 });
    if (this.texts.length > 24) this.texts.shift();
  }

  /* ── 화면 연출 ──────────────────────────────────────────── */
  flash(alpha = 0.4) { this.flashAlpha = Math.max(this.flashAlpha, alpha); }
  shake(ms = 240, mag = 8) {
    this.shakeUntil = Math.max(this.shakeUntil, performance.now() + ms);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }
  slowmo(ms = 80, scale = 0.35) {
    this.slowUntil = performance.now() + ms;
    this.slowScale = scale;
  }

  slowFactor() {
    return performance.now() < this.slowUntil ? this.slowScale : 1;
  }

  shakeOffset() {
    const now = performance.now();
    if (now >= this.shakeUntil) return { x: 0, y: 0 };
    const k = (this.shakeUntil - now) / this.shakeUntil;
    return { x: (Math.random() - 0.5) * this.shakeMag * k, y: (Math.random() - 0.5) * this.shakeMag * k };
  }

  /* ── 갱신 ───────────────────────────────────────────────── */
  update(dt) {
    const now = performance.now();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt * 0.12;
      p.y += p.vy * dt * 0.12;
      p.vy += p.gravity * dt * 0.02;
      p.vx *= 0.99;
      p.life -= p.decay * dt * 0.06;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        if (this.pool.length < MAX_PARTICLES) this.pool.push(p);
      }
    }
    this.beams = this.beams.filter(b => now - b.born < b.life);
    this.waves = this.waves.filter(w => now - w.born < w.life);
    this.arcs = this.arcs.filter(a => now - a.born < a.life);
    this.texts = this.texts.filter(t => now - t.born < t.life);
    this.flights = this.flights.filter(f => now - f.born < f.life);
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 0.004);
  }

  /* ── 렌더 ───────────────────────────────────────────────── */
  render(ctx) {
    const now = performance.now();

    // 빔
    for (const b of this.beams) {
      const k = 1 - (now - b.born) / b.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width * k + 2;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 22;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 전기 아크
    for (const a of this.arcs) {
      const k = 1 - (now - a.born) / a.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      for (let i = 0; i < a.points.length - 1; i++) {
        const p1 = a.points[i], p2 = a.points[i + 1];
        ctx.moveTo(p1.x, p1.y);
        const mx = (p1.x + p2.x) / 2 + (Math.random() - 0.5) * 14;
        const my = (p1.y + p2.y) / 2 + (Math.random() - 0.5) * 14;
        ctx.lineTo(mx, my);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 충격파
    for (const w of this.waves) {
      const k = (now - w.born) / w.life;
      const r = w.radius * k;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.8;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.shadowColor = w.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 프로펠러 비행
    for (const f of this.flights) {
      const k = (now - f.born) / f.life;
      const x = f.x1 + (f.x2 - f.x1) * k;
      const y = f.y1 + (f.y2 - f.y1) * k - Math.sin(k * Math.PI) * 40;
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.6;
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 18;
      for (let i = 0; i < 4; i++) {
        const a = now / 40 + (Math.PI / 2) * i;
        ctx.beginPath();
        ctx.ellipse(x, y, 10, 3.4, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      this.burst(x, y, f.color, 1, { speed: 0.4, size: 0.6 });
    }

    // 파티클
    for (const p of this.particles) {
      const a = Math.max(0, p.life);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'square') {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size * a, p.size * a);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.4, p.size * a), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 점수 텍스트
    for (const t of this.texts) {
      const k = (now - t.born) / t.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.font = `900 ${t.size}px "Pretendard", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(4,12,24,0.8)';
      ctx.strokeText(t.text, t.x, t.y - k * 46);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y - k * 46);
      ctx.restore();
    }

    // 화면 플래시
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, this.flashAlpha);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-this.w, -this.h, this.w * 3, this.h * 3);
      ctx.restore();
    }
  }
}
