/* =========================================================================
   art.js — 모든 그래픽을 Canvas 벡터로 그린다 (외부 이미지 없음)
   · 조각/장애물/드롭: 오프스크린 캐시(sprites.js)에서 devicePixelRatio 반영
   · 레오 임금 6표정, 올리 집사, 성 일러스트(구역별·과제 반영), 배경
   ========================================================================= */
import { CFG } from '../config.js';

export const TAU = Math.PI * 2;

export function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return `rgb(${r},${g},${b})`;
}

/* =========================================================================
   조각 — 5가지 실루엣(하트·물방울·클로버·별·초승달), 광택 나는 장난감 질감
   ========================================================================= */
function gemPath(ctx, shape, r) {
  ctx.beginPath();
  switch (shape) {
    case 'heart': {
      const s = r * 1.06;
      ctx.moveTo(0, s * 0.78);
      ctx.bezierCurveTo(-s * 1.25, -s * 0.1, -s * 0.66, -s * 0.92, 0, -s * 0.34);
      ctx.bezierCurveTo(s * 0.66, -s * 0.92, s * 1.25, -s * 0.1, 0, s * 0.78);
      break;
    }
    case 'drop': {
      const s = r * 1.02;
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.92, -s * 0.12, s * 0.82, s * 0.72, 0, s * 0.86);
      ctx.bezierCurveTo(-s * 0.82, s * 0.72, -s * 0.92, -s * 0.12, 0, -s);
      break;
    }
    case 'clover': {
      const s = r * 0.60;
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i - Math.PI / 2;
        const cx = Math.cos(a) * s * 0.92, cy = Math.sin(a) * s * 0.92;
        ctx.moveTo(cx + s * 0.86, cy);
        ctx.arc(cx, cy, s * 0.86, 0, TAU);
      }
      break;
    }
    case 'star': {
      const s = r * 1.06, spikes = 5;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 ? s * 0.46 : s;
        const a = (i / (spikes * 2)) * TAU - Math.PI / 2;
        const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'crescent': {
      const s = r * 1.02;
      ctx.arc(0, 0, s, 0.62, TAU - 0.62, false);
      ctx.arc(s * 0.46, -s * 0.05, s * 0.82, TAU - 0.86, 0.86, true);
      ctx.closePath();
      break;
    }
    default:
      ctx.arc(0, 0, r, 0, TAU);
  }
}

export function drawGem(ctx, colorIdx, cx, cy, r, opts = {}) {
  const c = CFG.colors[colorIdx % CFG.colors.length];
  const { alpha = 1, scale = 1, rot = 0, shadow = true } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (shadow) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = '#1b2a63';
    ctx.beginPath(); ctx.ellipse(0, r * 0.86, r * 0.72, r * 0.20, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.rotate(rot);
  // 본체
  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.42, r * 0.12, 0, 0, r * 1.16);
  g.addColorStop(0, c.light);
  g.addColorStop(0.45, c.main);
  g.addColorStop(1, c.dark);
  ctx.fillStyle = g;
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = Math.max(1.6, r * 0.14);
  ctx.lineJoin = 'round';
  gemPath(ctx, c.shape, r);
  ctx.fill();
  ctx.stroke();
  // 위쪽 광택
  ctx.save();
  gemPath(ctx, c.shape, r);
  ctx.clip();
  ctx.globalAlpha = alpha * 0.75;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.30, -r * 0.42, r * 0.30, r * 0.17, -0.6, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.35;
  ctx.beginPath();
  ctx.ellipse(r * 0.28, r * 0.36, r * 0.20, r * 0.10, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
  // 외곽 하이라이트
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  gemPath(ctx, c.shape, r * 0.93);
  ctx.stroke();
  ctx.restore();
}

/* 파워업 장식 (조각 위에 얹는다) */
export function drawPowerOverlay(ctx, kind, cx, cy, r, t) {
  ctx.save();
  ctx.translate(cx, cy);
  switch (kind) {
    case 'rocket': {
      ctx.rotate(t * 0.002);
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#fff');
      g.addColorStop(.5, '#dfe8ff');
      g.addColorStop(1, '#8fa6d8');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#283a7a';
      ctx.lineWidth = r * 0.13;
      rr(ctx, -r * 0.34, -r * 0.78, r * 0.68, r * 1.36, r * 0.3);
      ctx.fill(); ctx.stroke();
      // 날개
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, r * 0.32);
      ctx.lineTo(-r * 0.78, r * 0.82);
      ctx.lineTo(-r * 0.34, r * 0.7);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.34, r * 0.32);
      ctx.lineTo(r * 0.78, r * 0.82);
      ctx.lineTo(r * 0.34, r * 0.7);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // 꼬리 불꽃
      const f = 0.7 + Math.sin(t * 0.015) * 0.3;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.78);
      ctx.lineTo(0, -r * (0.9 + f * 0.4));
      ctx.lineTo(r * 0.2, -r * 0.78);
      ctx.closePath(); ctx.fill();
      // 창
      ctx.fillStyle = '#3fa9ff';
      ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.16, 0, TAU); ctx.fill();
      break;
    }
    case 'tnt': {
      const pulse = 1 + Math.sin(t * 0.012) * 0.05;
      ctx.scale(pulse, pulse);
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#ff8f6b');
      g.addColorStop(.5, '#e63946');
      g.addColorStop(1, '#8f1010');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#5c0a0a';
      ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.arc(0, r * 0.08, r * 0.72, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${r * 0.42}px 'Baloo 2', system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('TNT', 0, r * 0.12);
      // 심지 + 불꽃
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r * 0.18, -r * 0.6); ctx.quadraticCurveTo(r * 0.5, -r * 0.9, r * 0.34, -r * 1.02); ctx.stroke();
      const sp = 0.75 + Math.sin(t * 0.03) * 0.25;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(r * 0.34, -r * 1.04, r * 0.16 * sp, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff7b00';
      ctx.beginPath(); ctx.arc(r * 0.34, -r * 1.04, r * 0.08 * sp, 0, TAU); ctx.fill();
      break;
    }
    case 'propeller': {
      const a = t * 0.006;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#283a7a';
      ctx.lineWidth = r * 0.12;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(a + (Math.PI / 2) * i);
        rr(ctx, -r * 0.16, -r * 1.02, r * 0.32, r * 0.62, r * 0.16);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.30, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9971f';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, TAU); ctx.fill();
      break;
    }
    case 'light': {
      const a = t * 0.004;
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate(a + (TAU / 8) * i);
        const g = ctx.createLinearGradient(0, -r * 0.4, 0, -r * 1.1);
        g.addColorStop(0, 'rgba(255,255,255,.95)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, -r * 0.35);
        ctx.lineTo(0, -r * 1.12);
        ctx.lineTo(r * 0.1, -r * 0.35);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r * 0.78);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(.4, '#a8e6ff');
      g.addColorStop(.75, '#b46bff');
      g.addColorStop(1, '#5b2bd6');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#3a1a8f';
      ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.ellipse(-r * 0.24, -r * 0.3, r * 0.2, r * 0.12, -0.6, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/* =========================================================================
   장애물
   ========================================================================= */
export function drawObstacle(ctx, ob, cx, cy, size, t) {
  const s = size * 0.46;
  ctx.save();
  ctx.translate(cx, cy);
  switch (ob.type) {
    case 'box': {
      const g = ctx.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, '#d99a52');
      g.addColorStop(.5, '#b9762f');
      g.addColorStop(1, '#8a4f18');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#5e3510';
      ctx.lineWidth = s * 0.14;
      rr(ctx, -s * 0.92, -s * 0.92, s * 1.84, s * 1.84, s * 0.22);
      ctx.fill(); ctx.stroke();
      // 나무판
      ctx.strokeStyle = 'rgba(94,53,16,.55)';
      ctx.lineWidth = s * 0.1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.9, -s * 0.9 + (s * 1.8 / 3) * i);
        ctx.lineTo(s * 0.9, -s * 0.9 + (s * 1.8 / 3) * i);
        ctx.stroke();
      }
      // 금색 테두리
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = s * 0.12;
      rr(ctx, -s * 0.78, -s * 0.78, s * 1.56, s * 1.56, s * 0.16);
      ctx.stroke();
      // 사자 발바닥 무늬
      ctx.fillStyle = '#ffce6b';
      ctx.beginPath(); ctx.ellipse(0, s * 0.14, s * 0.33, s * 0.28, 0, 0, TAU); ctx.fill();
      for (const [dx, dy] of [[-0.32, -0.22], [0, -0.34], [0.32, -0.22]]) {
        ctx.beginPath(); ctx.ellipse(dx * s, dy * s, s * 0.12, s * 0.15, 0, 0, TAU); ctx.fill();
      }
      // 금이 간 표시
      if (ob.hp < ob.maxHp) {
        ctx.strokeStyle = '#3b1f06';
        ctx.lineWidth = s * 0.09;
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, -s * 0.8);
        ctx.lineTo(-s * 0.05, -s * 0.2);
        ctx.lineTo(-s * 0.32, s * 0.1);
        ctx.lineTo(-s * 0.1, s * 0.7);
        ctx.stroke();
      }
      if (ob.maxHp > 1) badge(ctx, ob, s);
      break;
    }
    case 'colorBox': {
      const c = CFG.colors[ob.color ?? 0];
      const g = ctx.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, c.light);
      g.addColorStop(.55, c.main);
      g.addColorStop(1, c.dark);
      ctx.fillStyle = g;
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = s * 0.14;
      rr(ctx, -s * 0.92, -s * 0.92, s * 1.84, s * 1.84, s * 0.2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = s * 0.1;
      rr(ctx, -s * 0.66, -s * 0.66, s * 1.32, s * 1.32, s * 0.14);
      ctx.stroke();
      // 같은 색 조각 문양
      ctx.save(); ctx.scale(s * 0.02, s * 0.02);
      drawGem(ctx, ob.color ?? 0, 0, 0, 26, { shadow: false });
      ctx.restore();
      if (ob.maxHp > 1) badge(ctx, ob, s);
      break;
    }
    case 'grass': {
      ctx.fillStyle = '#4fbf5f';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.34;
        ctx.save();
        ctx.rotate(a);
        rr(ctx, -s * 0.1, -s * 1.0, s * 0.2, s * 0.9, s * 0.1);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#2f9440';
      ctx.beginPath(); ctx.ellipse(0, s * 0.6, s * 0.8, s * 0.26, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'mailbox': {
      ctx.fillStyle = '#3fa9ff';
      ctx.strokeStyle = '#0b4f91';
      ctx.lineWidth = s * 0.13;
      rr(ctx, -s * 0.7, -s * 0.7, s * 1.4, s * 1.1, s * 0.4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      rr(ctx, s * 0.2, -s * 0.85, s * 0.24, s * 0.6, s * 0.08); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = s * 0.16;
      ctx.beginPath(); ctx.moveTo(0, s * 0.4); ctx.lineTo(0, s * 1.0); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, -s * 0.15, s * 0.18, 0, TAU); ctx.fill();
      if (ob.maxHp > 1) badge(ctx, ob, s);
      break;
    }
    case 'vase': {
      const g = ctx.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, '#bde9ff'); g.addColorStop(.5, '#7cc4ff'); g.addColorStop(1, '#3a7fc0');
      ctx.fillStyle = g; ctx.strokeStyle = '#1d4e7a'; ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(-s * 0.36, -s * 0.86);
      ctx.bezierCurveTo(-s * 0.5, -s * 0.2, -s * 0.9, s * 0.2, -s * 0.5, s * 0.86);
      ctx.lineTo(s * 0.5, s * 0.86);
      ctx.bezierCurveTo(s * 0.9, s * 0.2, s * 0.5, -s * 0.2, s * 0.36, -s * 0.86);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff8fb0';
      for (const [dx, dy] of [[-0.3, -1.0], [0, -1.16], [0.3, -1.0]]) {
        ctx.beginPath(); ctx.arc(dx * s, dy * s, s * 0.2, 0, TAU); ctx.fill();
      }
      if (ob.maxHp > 1) badge(ctx, ob, s);
      break;
    }
    case 'chain': {
      ctx.strokeStyle = '#9aa7bd'; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s, -s * 0.55 + i * s * 0.55);
        ctx.lineTo(s, -s * 0.75 + i * s * 0.55);
        ctx.stroke();
      }
      ctx.strokeStyle = '#e6edf7'; ctx.lineWidth = s * 0.09;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s, -s * 0.55 + i * s * 0.55);
        ctx.lineTo(s, -s * 0.75 + i * s * 0.55);
        ctx.stroke();
      }
      break;
    }
    case 'ice': {
      ctx.fillStyle = 'rgba(190,235,255,.72)';
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, -s * 0.7);
      ctx.lineTo(s * 0.15, -s * 0.95);
      ctx.lineTo(s * 0.9, -s * 0.2);
      ctx.lineTo(s * 0.6, s * 0.88);
      ctx.lineTo(-s * 0.4, s * 0.92);
      ctx.lineTo(-s * 0.95, s * 0.1);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.6); ctx.lineTo(s * 0.2, s * 0.2); ctx.stroke();
      if (ob.maxHp > 1) badge(ctx, ob, s);
      break;
    }
    case 'birdNest': {
      ctx.fillStyle = '#a9743d';
      ctx.strokeStyle = '#6b4318';
      ctx.lineWidth = s * 0.12;
      ctx.beginPath(); ctx.ellipse(0, s * 0.2, s * 0.92, s * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#d9a465'; ctx.lineWidth = s * 0.08;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.ellipse(0, s * 0.2, s * (0.8 - i * 0.16), s * (0.48 - i * 0.09), 0, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      for (const [dx, dy] of [[-0.25, 0], [0.22, 0.1]]) {
        ctx.beginPath(); ctx.ellipse(dx * s, dy * s, s * 0.2, s * 0.24, 0, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'honey': {
      const g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, s * 0.1, 0, 0, s);
      g.addColorStop(0, '#ffe58a'); g.addColorStop(.6, '#ffc21f'); g.addColorStop(1, '#c98a00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.1, s * 0.92, s * 0.72, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.beginPath(); ctx.ellipse(-s * 0.3, -s * 0.2, s * 0.22, s * 0.12, -0.5, 0, TAU); ctx.fill();
      break;
    }
    case 'safe': {
      ctx.fillStyle = '#b9c4d6'; ctx.strokeStyle = '#5c6a83'; ctx.lineWidth = s * 0.13;
      rr(ctx, -s * 0.92, -s * 0.92, s * 1.84, s * 1.84, s * 0.18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8eef8';
      rr(ctx, -s * 0.62, -s * 0.62, s * 1.24, s * 1.24, s * 0.12); ctx.fill();
      ctx.fillStyle = '#5c6a83';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5c6a83'; ctx.lineWidth = s * 0.1;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, TAU); ctx.stroke();
      badge(ctx, ob, s);
      break;
    }
    case 'curtain': {
      const g = ctx.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, '#c85b8f'); g.addColorStop(.5, '#a63a72'); g.addColorStop(1, '#7a1f52');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-s * 0.95, -s);
      ctx.lineTo(s * 0.95, -s);
      ctx.bezierCurveTo(s * 0.5, -s * 0.2, s * 0.7, s * 0.6, s * 0.95, s);
      ctx.lineTo(-s * 0.95, s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = s * 0.09;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.5, -s);
        ctx.quadraticCurveTo(i * s * 0.6, 0, i * s * 0.45, s);
        ctx.stroke();
      }
      break;
    }
    default: {
      ctx.fillStyle = '#c9d2e6';
      rr(ctx, -s * 0.8, -s * 0.8, s * 1.6, s * 1.6, s * 0.2); ctx.fill();
    }
  }
  ctx.restore();
}

function badge(ctx, ob, s) {
  ctx.save();
  ctx.fillStyle = 'rgba(33,48,107,.85)';
  ctx.beginPath(); ctx.arc(s * 0.72, -s * 0.72, s * 0.34, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `400 ${s * 0.42}px 'Jua', system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(ob.hp), s * 0.72, -s * 0.7);
  ctx.restore();
}

/* 드롭 아이템 */
export function drawDrop(ctx, type, cx, cy, size, t) {
  const s = size * 0.28;
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t * 0.004 + cx) * size * 0.04);
  switch (type) {
    case 'coin':
      drawCoin(ctx, 0, 0, s);
      break;
    case 'moves':
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1470c8'; ctx.lineWidth = s * 0.22;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1470c8';
      ctx.font = `400 ${s * 0.9}px 'Jua', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+2', 0, s * 0.06);
      break;
    case 'star':
      drawStar(ctx, 0, 0, s * 1.05, '#ffd23f', '#c9971f');
      break;
    case 'gift':
      ctx.fillStyle = '#ff7bb0'; ctx.strokeStyle = '#b02d63'; ctx.lineWidth = s * 0.2;
      rr(ctx, -s * 0.85, -s * 0.6, s * 1.7, s * 1.4, s * 0.16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      rr(ctx, -s * 0.16, -s * 0.6, s * 0.32, s * 1.4, s * 0.06); ctx.fill();
      rr(ctx, -s * 0.85, -s * 0.16, s * 1.7, s * 0.32, s * 0.06); ctx.fill();
      break;
  }
  ctx.restore();
}

export function drawCoin(ctx, cx, cy, r) {
  ctx.save(); ctx.translate(cx, cy);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, '#ffe9a3'); g.addColorStop(.55, '#ffd23f'); g.addColorStop(1, '#c9971f');
  ctx.fillStyle = g; ctx.strokeStyle = '#a87b0c'; ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a87b0c';
  ctx.font = `400 ${r * 1.1}px 'Jua', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', 0, r * 0.06);
  ctx.restore();
}

export function drawStar(ctx, cx, cy, r, fill = '#ffd23f', stroke = '#c9971f') {
  ctx.save(); ctx.translate(cx, cy);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#fff3b0'); g.addColorStop(.5, fill); g.addColorStop(1, stroke);
  ctx.fillStyle = g; ctx.strokeStyle = stroke; ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.46 : r;
    const a = (i / 10) * TAU - Math.PI / 2;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawHeart(ctx, cx, cy, r, fill = '#ff4d6d') {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = fill;
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.82);
  ctx.bezierCurveTo(-r * 1.2, -r * 0.1, -r * 0.62, -r * 0.9, 0, -r * 0.3);
  ctx.bezierCurveTo(r * 0.62, -r * 0.9, r * 1.2, -r * 0.1, 0, r * 0.82);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

/* =========================================================================
   레오 임금 — 표정 6종
   expr: 'smile' | 'joy' | 'cheer' | 'tense' | 'sad' | 'surprised'
   ========================================================================= */
export function drawKing(ctx, cx, cy, r, expr = 'smile', t = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  const bob = Math.sin(t * 0.003) * r * 0.02;
  ctx.translate(0, bob);

  // 망토
  ctx.fillStyle = '#d63b4f';
  ctx.strokeStyle = '#8f1d2c';
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  ctx.moveTo(-r * 0.85, r * 0.2);
  ctx.quadraticCurveTo(-r * 1.05, r * 1.15, 0, r * 1.2);
  ctx.quadraticCurveTo(r * 1.05, r * 1.15, r * 0.85, r * 0.2);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // 갈기
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.2, 0, 0, r * 1.15);
  g.addColorStop(0, '#ffd98a');
  g.addColorStop(.6, '#f6a63a');
  g.addColorStop(1, '#c9721a');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#a85c12';
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  const spikes = 14;
  for (let i = 0; i <= spikes; i++) {
    const a = (i / spikes) * TAU;
    const rad = r * (i % 2 ? 1.02 : 0.86);
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // 얼굴
  const fg = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r * 0.8);
  fg.addColorStop(0, '#ffe3a8'); fg.addColorStop(.7, '#ffcb6b'); fg.addColorStop(1, '#eda13c');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.fill();

  // 귀
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#f6b453';
    ctx.beginPath(); ctx.arc(sx * r * 0.55, -r * 0.5, r * 0.18, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath(); ctx.arc(sx * r * 0.55, -r * 0.5, r * 0.09, 0, TAU); ctx.fill();
  }

  // 눈
  const eyeY = -r * 0.12, eyeX = r * 0.27, eyeR = r * 0.10;
  ctx.fillStyle = '#3a2410';
  const drawEye = (x, kind) => {
    if (kind === 'closed') {
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = r * 0.06; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, eyeY, eyeR * 1.3, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    } else if (kind === 'wide') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, eyeY, eyeR * 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2410';
      ctx.beginPath(); ctx.arc(x, eyeY, eyeR * 0.85, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.25, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#3a2410';
      ctx.beginPath(); ctx.ellipse(x, eyeY, eyeR, eyeR * 1.15, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - eyeR * 0.3, eyeY - eyeR * 0.4, eyeR * 0.3, 0, TAU); ctx.fill();
    }
  };
  switch (expr) {
    case 'joy': drawEye(-eyeX, 'closed'); drawEye(eyeX, 'closed'); break;
    case 'cheer': drawEye(-eyeX, 'wide'); drawEye(eyeX, 'wide'); break;
    case 'surprised': drawEye(-eyeX, 'wide'); drawEye(eyeX, 'wide'); break;
    case 'sad': drawEye(-eyeX, 'normal'); drawEye(eyeX, 'normal'); break;
    case 'tense': drawEye(-eyeX, 'normal'); drawEye(eyeX, 'normal'); break;
    default: drawEye(-eyeX, 'normal'); drawEye(eyeX, 'normal');
  }
  // 눈썹
  ctx.strokeStyle = '#a85c12'; ctx.lineWidth = r * 0.055; ctx.lineCap = 'round';
  if (expr === 'tense' || expr === 'sad') {
    ctx.beginPath(); ctx.moveTo(-eyeX - r * 0.12, eyeY - r * 0.26); ctx.lineTo(-eyeX + r * 0.1, eyeY - r * 0.16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(eyeX + r * 0.12, eyeY - r * 0.26); ctx.lineTo(eyeX - r * 0.1, eyeY - r * 0.16); ctx.stroke();
  }

  // 코와 입
  ctx.fillStyle = '#7a4416';
  ctx.beginPath(); ctx.ellipse(0, r * 0.18, r * 0.11, r * 0.085, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#7a4416'; ctx.lineWidth = r * 0.05; ctx.lineCap = 'round';
  if (expr === 'smile' || expr === 'joy' || expr === 'cheer') {
    ctx.beginPath(); ctx.arc(0, r * 0.26, r * 0.22, 0.16 * Math.PI, 0.84 * Math.PI); ctx.stroke();
    if (expr === 'cheer' || expr === 'joy') {
      ctx.fillStyle = '#c94a5a';
      ctx.beginPath(); ctx.ellipse(0, r * 0.42, r * 0.16, r * 0.11, 0, 0, TAU); ctx.fill();
    }
  } else if (expr === 'surprised') {
    ctx.fillStyle = '#c94a5a';
    ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 0.11, r * 0.14, 0, 0, TAU); ctx.fill();
  } else if (expr === 'sad') {
    ctx.beginPath(); ctx.arc(0, r * 0.5, r * 0.18, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-r * 0.16, r * 0.36); ctx.lineTo(r * 0.16, r * 0.36); ctx.stroke();
  }

  // 볼
  ctx.fillStyle = 'rgba(255,120,120,.35)';
  ctx.beginPath(); ctx.arc(-r * 0.44, r * 0.2, r * 0.1, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.44, r * 0.2, r * 0.1, 0, TAU); ctx.fill();

  // 왕관
  ctx.save();
  ctx.translate(0, -r * 0.86);
  const cg = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.2);
  cg.addColorStop(0, '#fff3b0'); cg.addColorStop(.5, '#ffd23f'); cg.addColorStop(1, '#c9971f');
  ctx.fillStyle = cg;
  ctx.strokeStyle = '#a87b0c';
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  ctx.moveTo(-r * 0.34, r * 0.16);
  ctx.lineTo(-r * 0.40, -r * 0.16);
  ctx.lineTo(-r * 0.16, -r * 0.02);
  ctx.lineTo(0, -r * 0.30);
  ctx.lineTo(r * 0.16, -r * 0.02);
  ctx.lineTo(r * 0.40, -r * 0.16);
  ctx.lineTo(r * 0.34, r * 0.16);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff4d6d';
  ctx.beginPath(); ctx.arc(0, -r * 0.02, r * 0.06, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.restore();
}

/* 올리 집사 — 부엉이 */
export function drawOllie(ctx, cx, cy, r, t = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 0.002) * 0.03);
  // 몸통
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.15, 0, 0, r);
  g.addColorStop(0, '#c89a6a'); g.addColorStop(.7, '#9b6b3f'); g.addColorStop(1, '#6f4522');
  ctx.fillStyle = g; ctx.strokeStyle = '#54320f'; ctx.lineWidth = r * 0.07;
  ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 0.72, r * 0.85, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // 배
  ctx.fillStyle = '#f6e3c6';
  ctx.beginPath(); ctx.ellipse(0, r * 0.34, r * 0.42, r * 0.5, 0, 0, TAU); ctx.fill();
  // 날개
  ctx.fillStyle = '#8a5c33';
  ctx.beginPath(); ctx.ellipse(-r * 0.66, r * 0.2, r * 0.18, r * 0.5, 0.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.66, r * 0.2, r * 0.18, r * 0.5, -0.2, 0, TAU); ctx.fill();
  // 눈
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#54320f'; ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.arc(sx * r * 0.28, -r * 0.34, r * 0.26, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#21306b';
    ctx.beginPath(); ctx.arc(sx * r * 0.28 + Math.sin(t * 0.001) * r * 0.05, -r * 0.34, r * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx * r * 0.28 - r * 0.04, -r * 0.4, r * 0.05, 0, TAU); ctx.fill();
  }
  // 부리
  ctx.fillStyle = '#ffb347'; ctx.strokeStyle = '#c9801f'; ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.05); ctx.lineTo(-r * 0.12, r * 0.08); ctx.lineTo(r * 0.12, r * 0.08);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 나비넥타이
  ctx.fillStyle = '#2fbd5f';
  ctx.beginPath(); ctx.moveTo(0, r * 0.62); ctx.lineTo(-r * 0.24, r * 0.5); ctx.lineTo(-r * 0.24, r * 0.74); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, r * 0.62); ctx.lineTo(r * 0.24, r * 0.5); ctx.lineTo(r * 0.24, r * 0.74); ctx.closePath(); ctx.fill();
  // 모자(집사)
  ctx.fillStyle = '#21306b';
  rr(ctx, -r * 0.42, -r * 0.95, r * 0.84, r * 0.22, r * 0.06); ctx.fill();
  ctx.fillStyle = '#14349a';
  rr(ctx, -r * 0.3, -r * 1.18, r * 0.6, r * 0.28, r * 0.08); ctx.fill();
  ctx.restore();
}

/* =========================================================================
   배경 — 하늘 그라데이션, 흐르는 구름, 잔디, 돌길, 울타리
   ========================================================================= */
export function drawBackground(ctx, W, H, area, t, opts = {}) {
  const a = CFG.areaDefs[(area - 1) % CFG.areaDefs.length];
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.72);
  sky.addColorStop(0, a.sky[0]);
  sky.addColorStop(1, a.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 해
  const sunX = W * 0.82, sunY = H * 0.1;
  const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, H * 0.16);
  sg.addColorStop(0, 'rgba(255,255,220,.95)');
  sg.addColorStop(.4, 'rgba(255,240,170,.45)');
  sg.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sunX, sunY, H * 0.16, 0, TAU); ctx.fill();

  // 구름
  const clouds = 5;
  for (let i = 0; i < clouds; i++) {
    const speed = 6 + i * 2.5;
    const span = W + 220;
    const x = ((t * 0.001 * speed + i * 173) % span) - 110;
    const y = H * (0.08 + i * 0.055);
    const s = (0.7 + (i % 3) * 0.22) * (W / 420);
    drawCloud(ctx, x, y, s, opts.alpha ?? 0.9);
  }

  // 언덕
  const hillY = H * 0.58;
  ctx.fillStyle = shade(a.grass[0], 18);
  ctx.beginPath();
  ctx.moveTo(0, hillY);
  ctx.quadraticCurveTo(W * 0.22, hillY - H * 0.09, W * 0.52, hillY + H * 0.01);
  ctx.quadraticCurveTo(W * 0.8, hillY + H * 0.08, W, hillY - H * 0.02);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  // 잔디
  const gg = ctx.createLinearGradient(0, hillY, 0, H);
  gg.addColorStop(0, a.grass[0]);
  gg.addColorStop(1, a.grass[1]);
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.moveTo(0, hillY + H * 0.05);
  ctx.quadraticCurveTo(W * 0.35, hillY - H * 0.02, W * 0.62, hillY + H * 0.05);
  ctx.quadraticCurveTo(W * 0.86, hillY + H * 0.1, W, hillY + H * 0.03);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  // 돌길
  ctx.save();
  ctx.fillStyle = a.stone;
  ctx.globalAlpha = .85;
  ctx.beginPath();
  ctx.moveTo(W * 0.42, H);
  ctx.lineTo(W * 0.48, hillY + H * 0.08);
  ctx.lineTo(W * 0.58, hillY + H * 0.08);
  ctx.lineTo(W * 0.62, H);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = .35;
  ctx.fillStyle = '#8f8271';
  for (let i = 0; i < 28; i++) {
    const p = i / 28;
    const y = H - (H - (hillY + H * 0.09)) * p;
    const width = W * (0.2 * (1 - p) + 0.03);
    ctx.beginPath();
    ctx.ellipse(W * 0.5 + Math.sin(i * 1.7) * width * 0.28, y, width * 0.13, width * 0.05, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 울타리
  drawFence(ctx, W, hillY + H * 0.09, a);
  if (opts.area === 2) drawLake(ctx, W, H, hillY, a);
}

function drawCloud(ctx, x, y, s, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y, 34 * s, 20 * s, 0, 0, TAU);
  ctx.ellipse(x + 26 * s, y - 8 * s, 26 * s, 17 * s, 0, 0, TAU);
  ctx.ellipse(x - 26 * s, y + 3 * s, 22 * s, 14 * s, 0, 0, TAU);
  ctx.ellipse(x + 8 * s, y + 8 * s, 30 * s, 15 * s, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = alpha * .55;
  ctx.fillStyle = '#dcefff';
  ctx.beginPath();
  ctx.ellipse(x + 4 * s, y + 12 * s, 30 * s, 10 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawFence(ctx, W, y, a) {
  ctx.save();
  const postW = W * 0.018;
  ctx.fillStyle = '#f4e6c8';
  ctx.strokeStyle = '#c9b48a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const x = W * (i / 11) * 0.98 - postW / 2;
    if (x > W * 0.22 && x < W * 0.78) continue;
    rr(ctx, x, y - W * 0.05, postW, W * 0.08, postW * 0.4);
    ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#f4e6c8';
  rr(ctx, 0, y - W * 0.028, W * 0.24, W * 0.016, 4); ctx.fill();
  rr(ctx, W * 0.76, y - W * 0.028, W * 0.24, W * 0.016, 4); ctx.fill();
  // 깃발
  ctx.fillStyle = a.flag;
  const fx = W * 0.06, fy = y - W * 0.16;
  ctx.strokeStyle = '#a88f60'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + W * 0.1); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(fx, fy); ctx.lineTo(fx + W * 0.05, fy + W * 0.018); ctx.lineTo(fx, fy + W * 0.04);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawLake(ctx, W, H, hillY, a) {
  ctx.save();
  const g = ctx.createLinearGradient(0, hillY, 0, H);
  g.addColorStop(0, 'rgba(120,200,255,.75)');
  g.addColorStop(1, 'rgba(40,130,210,.85)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(W * 0.5, H * 0.88, W * 0.55, H * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(W * (0.3 + i * 0.12), H * (0.84 + i * 0.02), W * 0.09, H * 0.008, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/* =========================================================================
   홈 — 구역 성 일러스트 (과제를 마치면 부분이 바뀐다)
   ========================================================================= */
export function drawCastle(ctx, W, H, area, tasksDone = [], t = 0) {
  const a = CFG.areaDefs[(area - 1) % CFG.areaDefs.length];
  const done = new Set(tasksDone);
  const baseY = H * 0.72;
  const cx = W * 0.5;

  // 무대 바닥
  ctx.save();
  const groundG = ctx.createLinearGradient(0, baseY - 20, 0, H);
  groundG.addColorStop(0, a.grass[0]);
  groundG.addColorStop(1, a.grass[1]);
  ctx.fillStyle = groundG;
  ctx.beginPath();
  ctx.ellipse(cx, baseY + H * 0.16, W * 0.62, H * 0.13, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 성 본체
  const stone = a.stone;
  ctx.save();
  drawTower(ctx, cx - W * 0.24, baseY - H * 0.06, W * 0.13, H * 0.30, stone, a, t, 0);
  drawTower(ctx, cx + W * 0.24, baseY - H * 0.06, W * 0.13, H * 0.30, stone, a, t, 1.4);
  drawTower(ctx, cx, baseY - H * 0.16, W * 0.17, H * 0.40, stone, a, t, 0.7);
  // 성벽
  ctx.fillStyle = shade(stone, -8);
  rr(ctx, cx - W * 0.34, baseY - H * 0.10, W * 0.68, H * 0.16, 8);
  ctx.fill();
  ctx.strokeStyle = shade(stone, -40); ctx.lineWidth = 2; ctx.stroke();
  // 총안
  ctx.fillStyle = '#6d5f4a';
  for (let i = 0; i < 9; i++) {
    rr(ctx, cx - W * 0.31 + i * W * 0.077, baseY - H * 0.075, W * 0.028, H * 0.026, 3);
    ctx.fill();
  }
  ctx.restore();

  // 성문
  const gateOpen = done.has('gate');
  ctx.save();
  ctx.fillStyle = gateOpen ? '#4a7fd0' : '#7a5a34';
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.07, baseY + H * 0.05);
  ctx.lineTo(cx - W * 0.07, baseY - H * 0.02);
  ctx.quadraticCurveTo(cx, baseY - H * 0.08, cx + W * 0.07, baseY - H * 0.02);
  ctx.lineTo(cx + W * 0.07, baseY + H * 0.05);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#4a3418'; ctx.lineWidth = 3; ctx.stroke();
  if (!gateOpen) {
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(cx - W * 0.07 + i * W * 0.035, baseY - H * 0.05); ctx.lineTo(cx - W * 0.07 + i * W * 0.035, baseY + H * 0.05); ctx.stroke();
    }
  }
  ctx.restore();

  // 창문 (닦으면 반짝)
  for (const [dx, dy, r] of [[-0.05, -0.30, 0.022], [0.05, -0.30, 0.022], [-0.26, -0.16, 0.016], [0.26, -0.16, 0.016]]) {
    const lit = done.has('window') || done.has('iceWindow');
    ctx.save();
    ctx.fillStyle = lit ? '#ffe9a3' : '#5a6b8f';
    rr(ctx, cx + W * dx - W * r, baseY + H * dy - W * r * 1.4, W * r * 2, W * r * 2.6, W * r);
    ctx.fill();
    ctx.strokeStyle = '#3f4a68'; ctx.lineWidth = 2; ctx.stroke();
    if (lit) {
      ctx.globalAlpha = .5;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx + W * dx, baseY + H * dy, W * r * 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // 깃발 (항상 흔들림)
  drawFlag(ctx, cx, baseY - H * 0.42, W * 0.055, t, a.flag, done.has('flag') || done.has('banner'));
  drawFlag(ctx, cx - W * 0.24, baseY - H * 0.20, W * 0.04, t + 1, a.accent, true);
  drawFlag(ctx, cx + W * 0.24, baseY - H * 0.20, W * 0.04, t + 2, a.accent, true);

  // 분수
  drawFountain(ctx, cx - W * 0.30, baseY + H * 0.09, W * 0.11, t, done.has('fountain') || done.has('iceFountain'));

  // 정원
  drawGarden(ctx, cx + W * 0.28, baseY + H * 0.10, W * 0.12, t, done.has('garden'));

  // 융단
  if (done.has('rug') || done.has('carpet')) {
    ctx.save();
    ctx.fillStyle = '#d63b4f';
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.06, baseY + H * 0.05);
    ctx.lineTo(cx + W * 0.06, baseY + H * 0.05);
    ctx.lineTo(cx + W * 0.11, baseY + H * 0.12);
    ctx.lineTo(cx - W * 0.11, baseY + H * 0.12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  // 샹들리에(문 위 반짝임)
  if (done.has('chandelier')) {
    ctx.save();
    ctx.translate(cx, baseY - H * 0.09);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#ffe9a3';
      ctx.beginPath(); ctx.arc(-W * 0.03 + i * W * 0.03, Math.sin(t * 0.003 + i) * 3, 3.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // 왕좌 / 왕관 / 무지개 / 열기구
  if (done.has('throne')) {
    ctx.save();
    ctx.fillStyle = '#f2c94c';
    ctx.strokeStyle = '#a87b0c'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + W * 0.34, baseY + H * 0.06);
    ctx.lineTo(cx + W * 0.38, baseY - H * 0.02);
    ctx.lineTo(cx + W * 0.42, baseY + H * 0.06);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  if (done.has('crown')) {
    ctx.save();
    ctx.font = `${W * 0.07}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('👑', cx, baseY - H * 0.30);
    ctx.restore();
  }
  if (done.has('rainbow')) {
    ctx.save();
    const colors = ['#ff5a5a', '#ffb347', '#ffd23f', '#3fd47a', '#3fa9ff', '#b46bff'];
    colors.forEach((c, i) => {
      ctx.strokeStyle = c; ctx.lineWidth = W * 0.012; ctx.globalAlpha = .8;
      ctx.beginPath();
      ctx.arc(cx - W * 0.30, baseY + H * 0.12, W * (0.18 + i * 0.019), Math.PI, TAU);
      ctx.stroke();
    });
    ctx.restore();
  }
  if (done.has('balloon')) {
    ctx.save();
    const bx = cx + W * 0.06 + Math.sin(t * 0.0012) * 10;
    const by = baseY - H * 0.5 + Math.cos(t * 0.001) * 6;
    ctx.fillStyle = '#ff7bb0';
    ctx.beginPath(); ctx.ellipse(bx, by, W * 0.045, W * 0.056, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b02d63'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#8a5a2b';
    rr(ctx, bx - W * 0.012, by + W * 0.06, W * 0.024, W * 0.02, 2); ctx.fill();
    ctx.restore();
  }
  // 새 소품
  if (done.has('palm')) {
    ctx.save();
    ctx.fillStyle = '#8a5a2b';
    rr(ctx, cx - W * 0.40, baseY + H * 0.02, W * 0.012, H * 0.07, 3); ctx.fill();
    ctx.fillStyle = '#2f9440';
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i - 2) * 0.45;
      ctx.save(); ctx.translate(cx - W * 0.394, baseY + H * 0.02); ctx.rotate(ang);
      ctx.beginPath(); ctx.ellipse(0, -W * 0.03, W * 0.008, W * 0.03, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  if (done.has('boat')) {
    ctx.save();
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath();
    ctx.moveTo(W * 0.12, H * 0.86); ctx.lineTo(W * 0.2, H * 0.86); ctx.lineTo(W * 0.18, H * 0.89); ctx.lineTo(W * 0.14, H * 0.89);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (done.has('fire') || done.has('fireplace')) {
    ctx.save();
    const fx = cx - W * 0.13, fy = baseY + H * 0.09;
    for (let i = 0; i < 3; i++) {
      const s = 1 + Math.sin(t * 0.01 + i) * 0.15;
      ctx.fillStyle = ['#ff5a5a', '#ffb347', '#ffe066'][i];
      ctx.beginPath();
      ctx.ellipse(fx, fy - i * 3, W * 0.014 * s, W * 0.026 * s, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTower(ctx, x, bottomY, w, h, stone, a, t, phase) {
  ctx.save();
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, shade(stone, -14));
  g.addColorStop(.4, shade(stone, 16));
  g.addColorStop(1, shade(stone, -26));
  ctx.fillStyle = g;
  ctx.strokeStyle = shade(stone, -50);
  ctx.lineWidth = 2.4;
  rr(ctx, x - w / 2, bottomY - h, w, h, w * 0.12);
  ctx.fill(); ctx.stroke();
  // 돌 블록
  ctx.strokeStyle = shade(stone, -34);
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = .55;
  for (let i = 1; i < 6; i++) {
    const y = bottomY - h + (h / 6) * i;
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 2, y); ctx.lineTo(x + w / 2 - 2, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // 지붕
  ctx.fillStyle = a.flag;
  ctx.strokeStyle = shade(a.flag, -50);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.62, bottomY - h);
  ctx.lineTo(x, bottomY - h - w * 0.85);
  ctx.lineTo(x + w * 0.62, bottomY - h);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawFlag(ctx, x, y, size, t, color, active) {
  ctx.save();
  ctx.strokeStyle = '#a88f60';
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + size * 1.5); ctx.stroke();
  if (active) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const wob = Math.sin(t * 0.004) * size * 0.18;
    ctx.quadraticCurveTo(x + size * 0.9, y + size * 0.25 + wob, x + size * 1.5, y + size * 0.05);
    ctx.lineTo(x + size * 1.45, y + size * 0.5);
    ctx.quadraticCurveTo(x + size * 0.8, y + size * 0.7 + wob, x, y + size * 0.6);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawFountain(ctx, x, y, r, t, fixed) {
  ctx.save();
  ctx.fillStyle = '#cfd8ea';
  ctx.strokeStyle = '#8a94a8';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.36, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fixed ? '#6fc0ff' : '#7f8aa0';
  ctx.beginPath(); ctx.ellipse(x, y - 2, r * 0.82, r * 0.26, 0, 0, TAU); ctx.fill();
  if (fixed) {
    ctx.strokeStyle = 'rgba(160,220,255,.9)';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.28;
      const len = r * (0.9 + Math.sin(t * 0.004 + i) * 0.12);
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y - 6 - len * 0.6, x + Math.cos(a) * len, y - 4 - len * 0.2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(x, y - r * 0.9, 2.4, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = '#a7b0c2';
    ctx.beginPath(); ctx.arc(x, y - 4, r * 0.12, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawGarden(ctx, x, y, r, t, grown) {
  ctx.save();
  const n = grown ? 9 : 4;
  for (let i = 0; i < n; i++) {
    const px = x + Math.cos(i * 2.1) * r * 0.9;
    const py = y + Math.sin(i * 1.7) * r * 0.28;
    ctx.strokeStyle = '#2f9440'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py + 8); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = grown ? ['#ff5a5a', '#ffd23f', '#b46bff', '#ff8fb0'][i % 4] : '#7fb069';
    ctx.beginPath(); ctx.arc(px, py - 1, grown ? 4 : 2.6, 0, TAU); ctx.fill();
  }
  if (grown) {
    ctx.fillStyle = '#ffe066';
    ctx.globalAlpha = .8;
    ctx.beginPath(); ctx.arc(x + Math.sin(t * 0.003) * 2, y - r * 0.8, 2.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* =========================================================================
   아이콘 — 목표 · 부스터 · 탭
   ========================================================================= */
export function drawIcon(ctx, kind, cx, cy, size, opts = {}) {
  const s = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  switch (kind) {
    case 'gem': {
      const idx = CFG.colors.findIndex(c => c.key === (opts.colorKey || 'red'));
      drawGem(ctx, idx < 0 ? 0 : idx, 0, 0, s * 0.92, { shadow: false });
      break;
    }
    case 'letter':
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#9aa7bd'; ctx.lineWidth = s * 0.12;
      rr(ctx, -s * 0.8, -s * 0.55, s * 1.6, s * 1.1, s * 0.14); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#3fa9ff'; ctx.lineWidth = s * 0.12;
      ctx.beginPath(); ctx.moveTo(-s * 0.75, -s * 0.5); ctx.lineTo(0, s * 0.08); ctx.lineTo(s * 0.75, -s * 0.5); ctx.stroke();
      break;
    case 'bird':
      ctx.fillStyle = '#7cc4ff'; ctx.strokeStyle = '#1470c8'; ctx.lineWidth = s * 0.1;
      ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.55, s * 0.45, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.05); ctx.lineTo(s * 0.85, s * 0.18); ctx.lineTo(s * 0.5, s * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#21306b';
      ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.1, s * 0.08, 0, TAU); ctx.fill();
      break;
    case 'coin': drawCoin(ctx, 0, 0, s * 0.9); break;
    case 'star': drawStar(ctx, 0, 0, s * 0.9); break;
    case 'heart': drawHeart(ctx, 0, 0, s * 0.8); break;
    case 'hammer':
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = s * 0.24; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.75); ctx.lineTo(s * 0.15, -s * 0.1); ctx.stroke();
      ctx.fillStyle = '#f2c94c'; ctx.strokeStyle = '#a87b0c'; ctx.lineWidth = s * 0.1;
      rr(ctx, -s * 0.5, -s * 0.75, s * 1.1, s * 0.5, s * 0.12); ctx.fill(); ctx.stroke();
      break;
    case 'arrow':
      ctx.fillStyle = '#3fd47a'; ctx.strokeStyle = '#127a41'; ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.3, 0); ctx.lineTo(s * 0.3, -s * 0.3);
      ctx.lineTo(s * 0.9, 0); ctx.lineTo(s * 0.3, s * 0.3); ctx.lineTo(s * 0.3, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'cannon':
      ctx.fillStyle = '#5c6a83'; ctx.strokeStyle = '#2f3850'; ctx.lineWidth = s * 0.1;
      rr(ctx, -s * 0.5, -s * 0.7, s * 0.5, s * 1.3, s * 0.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(-s * 0.25, s * 0.75, s * 0.22, 0, TAU); ctx.fill();
      break;
    case 'jester':
      ctx.fillStyle = '#b46bff'; ctx.strokeStyle = '#6a1bb5'; ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, s * 0.5); ctx.quadraticCurveTo(-s * 0.2, -s * 0.9, 0, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.2, -s * 0.9, s * 0.7, s * 0.5);
      ctx.quadraticCurveTo(0, s * 0.2, -s * 0.7, s * 0.5);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(-s * 0.55, s * 0.42, s * 0.13, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.55, s * 0.42, s * 0.13, 0, TAU); ctx.fill();
      break;
    case 'lightning':
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a87b0c'; ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.9); ctx.lineTo(-s * 0.55, s * 0.1); ctx.lineTo(-s * 0.05, s * 0.1);
      ctx.lineTo(-s * 0.2, s * 0.9); ctx.lineTo(s * 0.6, -s * 0.15); ctx.lineTo(s * 0.05, -s * 0.15);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'prism':
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = CFG.colors[i].main; ctx.lineWidth = s * 0.16;
        ctx.beginPath(); ctx.arc(0, 0, s * (0.4 + i * 0.12), Math.PI * 0.75, Math.PI * 1.9); ctx.stroke();
      }
      break;
    case 'glove':
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#8a94a8'; ctx.lineWidth = s * 0.12;
      rr(ctx, -s * 0.5, -s * 0.6, s * 0.5, s * 1.1, s * 0.2); ctx.fill(); ctx.stroke();
      rr(ctx, 0, -s * 0.85, s * 0.22, s * 1.2, s * 0.1); ctx.fill(); ctx.stroke();
      rr(ctx, s * 0.22, -s * 0.6, s * 0.22, s * 1.0, s * 0.1); ctx.fill(); ctx.stroke();
      break;
    case 'hourglass':
      ctx.fillStyle = '#bde9ff'; ctx.strokeStyle = '#1d4e7a'; ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.8); ctx.lineTo(s * 0.55, -s * 0.8);
      ctx.lineTo(0, 0); ctx.lineTo(s * 0.55, s * 0.8); ctx.lineTo(-s * 0.55, s * 0.8);
      ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.7); ctx.lineTo(s * 0.3, s * 0.7); ctx.lineTo(0, s * 0.2); ctx.closePath(); ctx.fill();
      break;
    case 'rocket': case 'tnt': case 'propeller': case 'light':
      drawPowerOverlay(ctx, kind, 0, 0, s * 0.95, opts.t || 0);
      break;
    case 'gift':
      ctx.fillStyle = '#ff7bb0'; ctx.strokeStyle = '#b02d63'; ctx.lineWidth = s * 0.12;
      rr(ctx, -s * 0.8, -s * 0.5, s * 1.6, s * 1.3, s * 0.16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      rr(ctx, -s * 0.14, -s * 0.5, s * 0.28, s * 1.3, s * 0.05); ctx.fill();
      rr(ctx, -s * 0.8, -s * 0.12, s * 1.6, s * 0.28, s * 0.05); ctx.fill();
      break;
    case 'lives':
      drawHeart(ctx, 0, 0, s * 0.8, '#ff4d6d');
      break;
    case 'box':
      drawObstacle(ctx, { type: 'box', hp: 2, maxHp: 2 }, 0, 0, size);
      break;
    case 'colorBox':
      drawObstacle(ctx, { type: 'colorBox', hp: 2, maxHp: 2, color: CFG.colors.findIndex(c => c.key === (opts.colorKey || 'red')) }, 0, 0, size);
      break;
    default:
      if (CFG.obstacles[kind]) drawObstacle(ctx, { type: kind, hp: 2, maxHp: 2 }, 0, 0, size);
  }
  ctx.restore();
}

/* 조각 스프라이트를 위한 각 조각의 실루엣 이름 */
export function gemShape(colorIdx) { return CFG.colors[colorIdx % CFG.colors.length].shape; }
