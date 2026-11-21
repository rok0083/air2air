/* =========================================================================
   이펙트 — 60fps 목표, 객체 풀 기반 파티클
     · 보석 파편, 로켓 궤적, TNT 충격파 + 화면 흔들림
     · 프로펠러 비행, 전기 아크, 큰 콤보 슬로모/줌
     · 재질별 장애물 파편(나무·얼음·모래·덩굴·그림자)
   ========================================================================= */
import { debrisColor } from '../obstacles/index.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export class Effects {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.w = 0; this.h = 0;
    this.pool = [];
    this.active = [];
    this.rings = [];
    this.beams = [];
    this.arcs = [];
    this.flights = [];
    this.flash = 0;
    this.shake = 0;
    this.t = 0;
    this.paused = false;
    for (let i = 0; i < 260; i++) this.pool.push(this.blank());
  }

  blank() {
    return { used: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', gravity: 0, spin: 0, rot: 0, kind: 'dot', drag: 0.98 };
  }

  resize(cssW, cssH) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = cssW; this.h = cssH;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get(cb) {
    const p = this.pool.find(x => !x.used) || this.pool[0];
    p.used = true;
    Object.assign(p, this.blank(), { used: true });
    cb?.(p);
    this.active.push(p);
    return p;
  }

  burst(x, y, opts = {}) {
    const { color = '#fff', count = 12, speed = 130, size = 4, life = 0.6, gravity = 280, kind = 'dot' } = opts;
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.35, speed);
      this.get(p => {
        p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
        p.life = p.maxLife = rand(life * 0.6, life); p.size = rand(size * 0.6, size);
        p.color = color; p.gravity = gravity; p.kind = kind; p.rot = rand(0, TAU); p.spin = rand(-8, 8);
      });
    }
  }

  trail(x1, y1, x2, y2, color = '#ffb703', width = 10) {
    this.beams.push({ x1, y1, x2, y2, color, width, life: 0.42, max: 0.42 });
  }

  shock(x, y, color = '#ff6b6b', radius = 90) {
    this.rings.push({ x, y, r0: 8, r1: radius, color, life: 0.5, max: 0.5 });
    this.burst(x, y, { color, count: 18, speed: 220, size: 5, life: 0.5, gravity: 60 });
  }

  arc(x1, y1, x2, y2, color = '#c56cf0') {
    this.arcs.push({ x1, y1, x2, y2, color, life: 0.32, max: 0.32, seed: Math.random() * 1000 });
  }

  fly(x1, y1, x2, y2, color = '#48dbfb') {
    this.flights.push({ x1, y1, x2, y2, color, life: 0.42, max: 0.42 });
  }

  debris(x, y, material = 'wood', count = 10) {
    const color = debrisColor(material);
    const shape = material === 'ice' || material === 'snow' ? 'shard' : material === 'sand' ? 'dot' : 'chip';
    this.burst(x, y, { color, count, speed: 170, size: 4.5, life: 0.75, gravity: 420, kind: shape });
  }

  sparkle(x, y, color = '#ffe066', count = 14) {
    this.burst(x, y, { color, count, speed: 90, size: 3, life: 0.9, gravity: -40, kind: 'star' });
  }

  /* 로켓 애프터버너 — 지나간 줄을 따라 불꽃과 연기가 남는다 */
  afterburner(x1, y1, x2, y2, color = '#ffb703') {
    this.trail(x1, y1, x2, y2, color, 14);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const x = x1 + (x2 - x1) * k, y = y1 + (y2 - y1) * k;
      this.get(p => {
        p.x = x; p.y = y;
        p.vx = rand(-34, 34); p.vy = rand(-80, -16);
        p.life = p.maxLife = rand(0.24, 0.52);
        p.size = rand(1.6, 3.8);
        p.color = i % 3 ? '#ffd166' : '#ff7a3d';
        p.gravity = -36; p.kind = 'dot';
        p.rot = rand(0, TAU); p.spin = rand(-6, 6);
      });
    }
  }

  /* TNT — 링 두 겹 + 튀는 스파크 */
  shockwave(x, y, color = '#ff9f43', radius = 90) {
    this.rings.push({ x, y, r0: 6, r1: radius, color, life: 0.42, max: 0.42 });
    this.rings.push({ x, y, r0: 2, r1: radius * 1.5, color: '#fff3c4', life: 0.62, max: 0.62 });
    this.burst(x, y, { color, count: 26, speed: 300, size: 4.6, life: 0.55, gravity: 120 });
    this.burst(x, y, { color: '#ffe066', count: 12, speed: 430, size: 2.6, life: 0.4, gravity: 60, kind: 'star' });
  }

  /* 무지개 프리즘 — 색이 퍼지는 동심원 + 하얀 별 */
  prism(x, y, radius = 90) {
    const cols = ['#ff5b7f', '#ffc93c', '#3ddc84', '#4d9dff', '#b06cff'];
    cols.forEach((c, i) => {
      const life = 0.55 + i * 0.05;
      this.rings.push({ x, y, r0: 4 + i * 3, r1: radius * (1 + i * 0.14), color: c, life, max: life });
    });
    this.burst(x, y, { color: '#ffffff', count: 20, speed: 250, size: 4, life: 0.55, gravity: -60, kind: 'star' });
  }

  punch(strength = 6) { this.shake = Math.max(this.shake, strength); }
  screenFlash(v = 0.4) { this.flash = Math.max(this.flash, v); }

  update(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    for (const p of this.active) {
      if (!p.used) continue;
      p.life -= dt;
      if (p.life <= 0) { p.used = false; continue; }
      p.vy += p.gravity * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    this.active = this.active.filter(p => p.used);
    for (const r of this.rings) r.life -= dt;
    for (const b of this.beams) b.life -= dt;
    for (const a of this.arcs) a.life -= dt;
    for (const f of this.flights) f.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
    this.beams = this.beams.filter(b => b.life > 0);
    this.arcs = this.arcs.filter(a => a.life > 0);
    this.flights = this.flights.filter(f => f.life > 0);
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.save();
    ctx.translate(sx, sy);

    for (const b of this.beams) {
      const k = b.life / b.max;
      ctx.globalAlpha = k;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width * k;
      ctx.lineCap = 'round';
      ctx.shadowColor = b.color; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, TAU); ctx.stroke();
    }

    for (const a of this.arcs) {
      const k = a.life / a.max;
      ctx.globalAlpha = k;
      ctx.strokeStyle = a.color; ctx.lineWidth = 2.5;
      ctx.shadowColor = a.color; ctx.shadowBlur = 12;
      ctx.beginPath();
      const seg = 6;
      ctx.moveTo(a.x1, a.y1);
      for (let i = 1; i <= seg; i++) {
        const t = i / seg;
        const nx = a.x1 + (a.x2 - a.x1) * t + Math.sin(a.seed + i * 2.7) * 9;
        const ny = a.y1 + (a.y2 - a.y1) * t + Math.cos(a.seed + i * 1.9) * 9;
        ctx.lineTo(nx, ny);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    for (const f of this.flights) {
      const k = 1 - f.life / f.max;
      const x = f.x1 + (f.x2 - f.x1) * k;
      const y = f.y1 + (f.y2 - f.y1) * k - Math.sin(k * Math.PI) * 40;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke();
    }

    for (const p of this.active) {
      if (!p.used) continue;
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 'star') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const ang = -Math.PI / 2 + i * TAU / 5;
          const ang2 = ang + TAU / 10;
          ctx.lineTo(Math.cos(ang) * p.size * 1.8, Math.sin(ang) * p.size * 1.8);
          ctx.lineTo(Math.cos(ang2) * p.size * 0.7, Math.sin(ang2) * p.size * 0.7);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else if (p.kind === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2); ctx.restore();
      } else if (p.kind === 'chip') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.5})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  clear() {
    this.active.forEach(p => { p.used = false; });
    this.active = [];
    this.rings = []; this.beams = []; this.arcs = []; this.flights = [];
    this.flash = 0; this.shake = 0;
  }
}
