/* =========================================================================
   보드 렌더러 — HTML5 Canvas
   board.grid(논리 상태) + board.anims(애니메이션)를 읽어 그립니다.
   보석은 색 + 모양(원·다이아·사각·삼각·육각·별)으로 구분해 색약 접근성을 지킵니다.
   ========================================================================= */
import { CFG, GEMS } from '../config.js';
import { debrisColor } from '../obstacles/index.js';

const TAU = Math.PI * 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeDrop = (t) => 1 - Math.pow(1 - t, 2.2);

function pathShape(ctx, shape, x, y, r) {
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(x, y, r, 0, TAU);
      break;
    case 'diamond':
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.86, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.86, y);
      ctx.closePath();
      break;
    case 'square':
      ctx.roundRect ? ctx.roundRect(x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64, r * 0.28)
        : ctx.rect(x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64);
      break;
    case 'triangle':
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.95, y + r * 0.7); ctx.lineTo(x - r * 0.95, y + r * 0.7);
      ctx.closePath();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 6;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.46 : r;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      break;
    default:
      ctx.arc(x, y, r, 0, TAU);
  }
}

export class BoardView {
  constructor(canvas, board) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.board = board;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.pad = 4;
    this.cell = 40;
    this.w = 320; this.h = 320;
    this.hover = null;
    this.selected = null;
    this.flashT = 0;
    this.zoom = 1;
  }

  layout(cssW, cssH) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const b = this.board;
    this.w = cssW; this.h = cssH;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cell = Math.min((cssW - this.pad * 2) / b.cols, (cssH - this.pad * 2) / b.rows);
    this.bx = (cssW - this.cell * b.cols) / 2;
    this.by = (cssH - this.cell * b.rows) / 2;
  }

  cellCenter(r, c) {
    return { x: this.bx + c * this.cell + this.cell / 2, y: this.by + r * this.cell + this.cell / 2 };
  }

  cellAt(px, py) {
    const c = Math.floor((px - this.bx) / this.cell);
    const r = Math.floor((py - this.by) / this.cell);
    if (r < 0 || c < 0 || r >= this.board.rows || c >= this.board.cols) return null;
    return { r, c };
  }

  /* ── 그리기 ─────────────────────────────────────────────── */
  render(now = performance.now()) {
    const ctx = this.ctx;
    const b = this.board;
    ctx.clearRect(0, 0, this.w, this.h);

    // 보드 배경
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, 'rgba(16,32,26,0.86)');
    g.addColorStop(1, 'rgba(8,18,15,0.92)');
    ctx.fillStyle = g;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(0, 0, this.w, this.h, 16); else ctx.rect(0, 0, this.w, this.h);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,120,0.22)';
    ctx.lineWidth = 1.5; ctx.stroke();

    // 체커
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        const { x, y } = this.cellCenter(r, c);
        ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.012)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - this.cell / 2 + 1.5, y - this.cell / 2 + 1.5, this.cell - 3, this.cell - 3, 8);
        else ctx.rect(x - this.cell / 2 + 1.5, y - this.cell / 2 + 1.5, this.cell - 3, this.cell - 3);
        ctx.fill();
      }
    }

    // void 칸
    for (const key of b.voids) {
      const [r, c] = key.split(',').map(Number);
      const { x, y } = this.cellCenter(r, c);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - this.cell / 2 + 2, y - this.cell / 2 + 2, this.cell - 4, this.cell - 4, 8);
      else ctx.rect(x - this.cell / 2 + 2, y - this.cell / 2 + 2, this.cell - 4, this.cell - 4);
      ctx.fill();
    }

    // 움직이는 타일 집합
    const moving = new Map();
    for (const a of b.anims) {
      if (a.kind !== 'move') continue;
      const t = (now - a.t0) / a.dur;
      if (t >= 1) continue; // 끝난 이동은 정지 상태로만 그린다(잔상 방지)
      moving.set(a.tile.id, { anim: a, t });
    }

    // 정적 타일
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        const tile = b.grid[r][c];
        if (!tile || moving.has(tile.id)) continue;
        const { x, y } = this.cellCenter(r, c);
        this.drawTile(ctx, tile, x, y, this.cell, 1);
      }
    }

    // 장애물(블록형) 먼저, 덮는형은 타일 위에
    for (const obs of b.obstacles.values()) {
      if (obs.dead || obs.overlay) continue;
      const { x, y } = this.cellCenter(obs.r, obs.c);
      this.drawObstacle(ctx, obs, x, y, this.cell);
    }
    for (const obs of b.obstacles.values()) {
      if (obs.dead || !obs.overlay) continue;
      const { x, y } = this.cellCenter(obs.r, obs.c);
      this.drawOverlayObstacle(ctx, obs, x, y, this.cell);
    }

    // 움직이는 타일
    for (const [id, { anim, t }] of moving) {
      const e = anim.ease === 'inout' ? easeInOut(t) : anim.ease === 'drop' ? easeDrop(t) : easeOut(t);
      const x0 = this.bx + anim.from.c * this.cell + this.cell / 2;
      const y0 = this.by + anim.from.r * this.cell + this.cell / 2;
      const x1 = this.bx + anim.to.c * this.cell + this.cell / 2;
      const y1 = this.by + anim.to.r * this.cell + this.cell / 2;
      this.drawTile(ctx, anim.tile, x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, this.cell, 1);
    }

    // 제거 팝
    for (const a of b.anims) {
      if (a.kind !== 'pop') continue;
      const t = Math.min(1, (now - a.t0) / a.dur);
      if (t >= 1) continue;
      const { x, y } = this.cellCenter(a.r, a.c);
      const s = 1 + t * 0.25;
      ctx.globalAlpha = 1 - t;
      this.drawTile(ctx, a.tile, x, y, this.cell * s, 1);
      ctx.globalAlpha = 1;
    }

    // 특수 보석 생성 반짝임
    for (const a of b.anims) {
      if (a.kind !== 'pucreate') continue;
      const t = Math.min(1, (now - a.t0) / a.dur);
      if (t >= 1) continue;
      const { x, y } = this.cellCenter(a.r, a.c);
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, this.cell * (0.3 + t * 0.55), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 힌트
    if (b.hintCells) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 160);
      ctx.strokeStyle = `rgba(255,214,102,${0.35 + pulse * 0.5})`;
      ctx.lineWidth = 3;
      for (const cell of b.hintCells) {
        const { x, y } = this.cellCenter(cell.r, cell.c);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - this.cell / 2 + 3, y - this.cell / 2 + 3, this.cell - 6, this.cell - 6, 9);
        else ctx.rect(x - this.cell / 2 + 3, y - this.cell / 2 + 3, this.cell - 6, this.cell - 6);
        ctx.stroke();
      }
    }

    // 선택
    if (this.selected) {
      const { x, y } = this.cellCenter(this.selected.r, this.selected.c);
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - this.cell / 2 + 2, y - this.cell / 2 + 2, this.cell - 4, this.cell - 4, 10);
      else ctx.rect(x - this.cell / 2 + 2, y - this.cell / 2 + 2, this.cell - 4, this.cell - 4);
      ctx.stroke();
    }

    // 보스 오라
    if (b.boss && b.boss.hp > 0) {
      const { x, y } = this.cellCenter(0, b.cols / 2);
      ctx.globalAlpha = 0.18 + 0.1 * Math.sin(now / 300);
      ctx.fillStyle = '#b06cff';
      ctx.beginPath(); ctx.ellipse(x, y - this.cell, this.cell * 1.5, this.cell * 0.5, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /* 보석 */
  drawTile(ctx, tile, x, y, cell, alpha = 1) {
    const gem = GEMS[tile.color] || GEMS[0];
    const r = cell * 0.36;
    const hue = gem.color;
    ctx.globalAlpha = alpha;

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.72, r * 0.85, r * 0.34, 0, 0, TAU); ctx.fill();

    // 본체
    const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    grad.addColorStop(0, gem.light);
    grad.addColorStop(0.45, hue);
    grad.addColorStop(1, gem.dark);
    ctx.fillStyle = grad;
    pathShape(ctx, gem.shape, x, y, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 광택
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.28, y - r * 0.34, r * 0.24, r * 0.14, -0.7, 0, TAU); ctx.fill();
    ctx.globalAlpha = alpha;

    // 특수 보석 표시
    if (tile.pu) this.drawPowerupBadge(ctx, tile.pu, x, y, r);

    // 아이템(도토리·씨앗)
    if (tile.item) {
      ctx.fillStyle = '#fff4d6';
      ctx.beginPath(); ctx.arc(x + r * 0.62, y - r * 0.66, r * 0.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a4a12'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#a4651f';
      ctx.beginPath(); ctx.ellipse(x + r * 0.62, y - r * 0.6, r * 0.24, r * 0.16, -0.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5d3a0d'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x + r * 0.62, y - r * 0.95); ctx.lineTo(x + r * 0.74, y - r * 1.15); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawPowerupBadge(ctx, pu, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(12,18,28,0.55)';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2;
    if (pu.type === 'rocket') {
      ctx.rotate(pu.dir === 'v' ? -Math.PI / 2 : 0);
      ctx.beginPath(); ctx.moveTo(-r * 0.42, 0); ctx.lineTo(r * 0.12, 0); ctx.lineTo(r * 0.12, -r * 0.16); ctx.lineTo(r * 0.5, 0); ctx.lineTo(r * 0.12, r * 0.16); ctx.lineTo(r * 0.12, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.42, -r * 0.18); ctx.lineTo(-r * 0.42, r * 0.18); ctx.stroke();
    } else if (pu.type === 'tnt') {
      ctx.beginPath(); ctx.arc(0, r * 0.08, r * 0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.2); ctx.quadraticCurveTo(r * 0.3, -r * 0.45, r * 0.42, -r * 0.28); ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.3, r * 0.1, 0, TAU); ctx.fill();
    } else if (pu.type === 'spinner') {
      ctx.fillStyle = '#9be9ff';
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate((i * TAU) / 3 + performance.now() / 600);
        ctx.beginPath(); ctx.ellipse(r * 0.28, 0, r * 0.26, r * 0.11, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, TAU); ctx.fill();
    } else if (pu.type === 'electro') {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(r * 0.08, -r * 0.5); ctx.lineTo(-r * 0.26, r * 0.08); ctx.lineTo(0, r * 0.08);
      ctx.lineTo(-r * 0.12, r * 0.5); ctx.lineTo(r * 0.3, -r * 0.12); ctx.lineTo(r * 0.04, -r * 0.12);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* 블록형 장애물 */
  drawObstacle(ctx, obs, x, y, cell) {
    const s = cell * 0.78;
    const fl = obs.flash;
    ctx.save();
    ctx.translate(x, y);
    if (fl > 0) { ctx.globalAlpha = 0.75 + 0.25 * Math.sin(fl * 60); }
    switch (obs.type) {
      case 'bush': {
        ctx.fillStyle = '#2f7d43';
        for (const [dx, dy, rr] of [[-0.22, 0.1, 0.28], [0.2, 0.12, 0.26], [0, -0.16, 0.3]]) {
          ctx.beginPath(); ctx.arc(dx * s, dy * s, rr * s, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#4cd97b';
        for (const [dx, dy] of [[-0.18, -0.02], [0.16, 0.02], [0, -0.28]]) {
          ctx.beginPath(); ctx.arc(dx * s, dy * s, s * 0.12, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'crate': {
        const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
        g.addColorStop(0, '#c58a52'); g.addColorStop(1, '#8a5a2b');
        ctx.fillStyle = g;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.12); else ctx.rect(-s / 2, -s / 2, s, s);
        ctx.fill();
        ctx.strokeStyle = '#5c3a18'; ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s / 2, -s / 4); ctx.lineTo(s / 2, -s / 4);
        ctx.moveTo(-s / 2, s / 4); ctx.lineTo(s / 2, s / 4);
        ctx.moveTo(-s / 4, -s / 2); ctx.lineTo(-s / 4, s / 2);
        ctx.moveTo(s / 4, -s / 2); ctx.lineTo(s / 4, s / 2);
        ctx.stroke();
        break;
      }
      case 'snowman': {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, s * 0.16, s * 0.3, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.22, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff9f43';
        ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 0.13); ctx.lineTo(s * 0.26, -s * 0.09); ctx.lineTo(s * 0.06, -s * 0.06); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(-s * 0.06, -s * 0.16, s * 0.035, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.03, -s * 0.16, s * 0.035, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = s * 0.06;
        ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.3); ctx.lineTo(s * 0.16, -s * 0.3); ctx.stroke();
        break;
      }
      case 'icicle': {
        ctx.fillStyle = 'rgba(220,245,255,0.92)';
        ctx.beginPath();
        ctx.moveTo(-s * 0.22, -s * 0.45); ctx.lineTo(s * 0.22, -s * 0.45);
        ctx.lineTo(s * 0.05, s * 0.42); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.42); ctx.lineTo(-s * 0.02, -s * 0.42); ctx.lineTo(-s * 0.06, s * 0.1); ctx.closePath(); ctx.fill();
        break;
      }
      case 'jar': {
        const g = ctx.createLinearGradient(-s / 2, 0, s / 2, 0);
        g.addColorStop(0, '#b96a3f'); g.addColorStop(0.5, '#e0a071'); g.addColorStop(1, '#8d4a26');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, s * 0.05, s * 0.34, s * 0.4, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#6d3a1c';
        ctx.beginPath(); ctx.ellipse(0, -s * 0.34, s * 0.2, s * 0.08, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.34, s * 0.4, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
        break;
      }
      case 'cactus': {
        ctx.fillStyle = '#3f9e57';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-s * 0.12, -s * 0.42, s * 0.24, s * 0.84, s * 0.12); else ctx.rect(-s * 0.12, -s * 0.42, s * 0.24, s * 0.84);
        ctx.fill();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-s * 0.34, -s * 0.16, s * 0.2, s * 0.34, s * 0.1); else ctx.rect(-s * 0.34, -s * 0.16, s * 0.2, s * 0.34);
        ctx.fill();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(s * 0.14, -s * 0.3, s * 0.2, s * 0.3, s * 0.1); else ctx.rect(s * 0.14, -s * 0.3, s * 0.2, s * 0.3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.3 + i * s * 0.18); ctx.lineTo(s * 0.1, -s * 0.3 + i * s * 0.18); ctx.stroke(); }
        break;
      }
      case 'fruitTree': {
        ctx.fillStyle = '#7a4a26';
        ctx.fillRect(-s * 0.08, -s * 0.05, s * 0.16, s * 0.45);
        ctx.fillStyle = '#2f8f47';
        ctx.beginPath(); ctx.arc(0, -s * 0.18, s * 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff8b3d';
        for (const [dx, dy] of [[-0.14, -0.18], [0.14, -0.08], [0.02, -0.32]]) {
          ctx.beginPath(); ctx.arc(dx * s, dy * s, s * 0.09, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'shadowStone': {
        const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
        g.addColorStop(0, '#5a4a86'); g.addColorStop(1, '#2a2340');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-s * 0.34, s * 0.36); ctx.lineTo(-s * 0.42, -s * 0.06); ctx.lineTo(-s * 0.1, -s * 0.4);
        ctx.lineTo(s * 0.3, -s * 0.28); ctx.lineTo(s * 0.4, s * 0.14); ctx.lineTo(s * 0.16, s * 0.4);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(180,140,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(200,160,255,0.8)';
        ctx.beginPath(); ctx.arc(-s * 0.06, 0, s * 0.08, 0, TAU); ctx.fill();
        break;
      }
      default: {
        ctx.fillStyle = '#666';
        ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    // 체력 표시(2 이상)
    if (obs.maxHp > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.arc(x + cell * 0.28, y - cell * 0.28, cell * 0.13, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${Math.round(cell * 0.18)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(obs.hp), x + cell * 0.28, y - cell * 0.28 + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  /* 덮는형 장애물 (얼음·풀·덩굴·모래·늪·룬) */
  drawOverlayObstacle(ctx, obs, x, y, cell) {
    const s = cell * 0.9;
    ctx.save();
    ctx.translate(x, y);
    if (obs.type === 'ice') {
      const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(200,245,255,0.78)');
      g.addColorStop(0.5, 'rgba(120,210,255,0.5)');
      g.addColorStop(1, 'rgba(240,255,255,0.7)');
      ctx.fillStyle = g;
      if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.18); else ctx.rect(-s / 2, -s / 2, s, s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.34); ctx.lineTo(-s * 0.05, 0); ctx.lineTo(-s * 0.2, s * 0.3); ctx.stroke();
      if (obs.hp >= 2) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(s * 0.32, -s * 0.2); ctx.lineTo(s * 0.05, s * 0.05); ctx.stroke(); }
    } else if (obs.type === 'grass') {
      ctx.strokeStyle = '#6fae4a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const bx = -s * 0.4 + i * s * 0.16;
        ctx.beginPath(); ctx.moveTo(bx, s * 0.42); ctx.quadraticCurveTo(bx + s * 0.06, s * 0.05, bx + (i % 2 ? s * 0.14 : -s * 0.12), -s * 0.34); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(111,174,74,0.22)';
      ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.42, 0, TAU); ctx.fill();
    } else if (obs.type === 'sand') {
      ctx.fillStyle = 'rgba(232,201,138,0.85)';
      ctx.beginPath();
      ctx.moveTo(-s / 2, s * 0.15);
      ctx.quadraticCurveTo(-s * 0.2, -s * 0.4, s * 0.1, -s * 0.25);
      ctx.quadraticCurveTo(s * 0.5, -s * 0.1, s * 0.4, s * 0.25);
      ctx.quadraticCurveTo(s * 0.1, s * 0.5, -s / 2, s * 0.15);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,235,190,0.8)';
      for (const [dx, dy] of [[-0.2, 0.05], [0.12, -0.1], [0.24, 0.16]]) {
        ctx.beginPath(); ctx.arc(dx * s, dy * s, s * 0.04, 0, TAU); ctx.fill();
      }
    } else if (obs.type === 'swamp') {
      ctx.fillStyle = 'rgba(72,60,34,0.55)';
      if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.3); else ctx.rect(-s / 2, -s / 2, s, s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,190,90,0.55)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(-s * 0.16 + i * s * 0.18, s * 0.06 * i, s * 0.12, s * 0.04, 0, 0, TAU); ctx.stroke();
      }
    } else if (obs.type === 'vine') {
      ctx.strokeStyle = '#3f9e57'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.4);
      ctx.bezierCurveTo(-s * 0.1, -s * 0.1, -s * 0.3, s * 0.25, s * 0.45, s * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.4, -s * 0.4);
      ctx.bezierCurveTo(s * 0.05, 0, s * 0.25, s * 0.2, -s * 0.4, s * 0.42);
      ctx.stroke();
      ctx.fillStyle = '#7bd44f';
      for (const [dx, dy] of [[-0.15, -0.18], [0.2, 0.08], [0.05, 0.3]]) {
        ctx.beginPath(); ctx.ellipse(dx * s, dy * s, s * 0.1, s * 0.05, 0.7, 0, TAU); ctx.fill();
      }
    } else if (obs.type === 'shadowRune') {
      ctx.strokeStyle = 'rgba(178,130,255,0.9)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, TAU); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6 + obs.spawnAt;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14);
        ctx.lineTo(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(90,60,160,0.28)';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (obs.maxHp > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.arc(x + cell * 0.28, y - cell * 0.28, cell * 0.12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${Math.round(cell * 0.17)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(obs.hp), x + cell * 0.28, y - cell * 0.28 + 0.5);
    }
  }
}
