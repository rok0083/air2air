/* =========================================================================
   particles.js — 객체 풀 기반 파티클
   ========================================================================= */
const MAX = 420;

export class ParticlePool {
  constructor() {
    this.items = [];
    for (let i = 0; i < MAX; i++) {
      this.items.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 4, color: '#fff', shape: 'dot', rot: 0, vr: 0, grav: 900, fade: 1 });
    }
    this.cursor = 0;
  }

  spawn(opts) {
    for (let n = 0; n < MAX; n++) {
      const p = this.items[(this.cursor + n) % MAX];
      if (!p.alive) {
        this.cursor = (this.cursor + n + 1) % MAX;
        Object.assign(p, {
          alive: true, x: 0, y: 0, vx: 0, vy: -120, life: 0, max: 600, size: 5,
          color: '#fff', shape: 'dot', rot: 0, vr: 0, grav: 900, fade: 1, drag: 0.0016,
        }, opts);
        p.life = 0;
        return p;
      }
    }
    return null;
  }

  burst(x, y, color, count = 8, opts = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 180) * (0.4 + Math.random() * 0.9);
      this.spawn({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opts.lift ?? 60),
        size: (opts.size ?? 5) * (0.6 + Math.random() * 0.8),
        color,
        shape: opts.shape || 'dot',
        max: (opts.life ?? 620) * (0.6 + Math.random() * 0.7),
        grav: opts.grav ?? 900,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 8,
      });
    }
  }

  update(dt) {
    for (const p of this.items) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) { p.alive = false; continue; }
      const drag = Math.pow(p.drag, dt / 16.6);
      p.vx *= drag;
      p.vy = p.vy * drag + p.grav * (dt / 1000);
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      p.rot += p.vr * (dt / 1000);
    }
  }

  draw(ctx) {
    for (const p of this.items) {
      if (!p.alive) continue;
      const t = p.life / p.max;
      const a = 1 - t;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a * p.fade);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'square') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (p.shape === 'spark') {
        ctx.fillRect(-p.size * 0.18, -p.size * 1.1, p.size * 0.36, p.size * 2.2);
      } else if (p.shape === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 ? p.size * 0.45 : p.size;
          const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, p.size * (1 - t * 0.45), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }
}
