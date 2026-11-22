/* =========================================================================
   gems.js — 보석(조각) 렌더링: 실루엣 + 커팅 면(facet)
   -------------------------------------------------------------------------
   실루엣을 점 배열로 뽑아 두고, 바깥 테두리(거들) → 중간 크라운 → 안쪽 테이블
   순서로 면을 나눠 그린다. 면마다 밝고 어두운 삼각형을 번갈아 칠해
   실제 보석처럼 각이 살아나는 질감을 만든다.
   · 스프라이트로 한 번만 그려 캐시하므로 연산 부담은 없다(sprites.js).
   ========================================================================= */
import { CFG } from '../config.js';

export const TAU = Math.PI * 2;

/* --------------------------------------------------------------- 유틸 */
function bez(p0, p1, p2, p3, n, out) {
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const mt = 1 - t;
    const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0];
    const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1];
    out.push([x, y]);
  }
  return out;
}

function arc(cx, cy, rad, a0, a1, n, out) {
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return out;
}

/* 실루엣(단위 반지름) — 캐시 */
const UNIT = new Map();

function unitOutline(shape) {
  let pts = UNIT.get(shape);
  if (pts) return pts;
  pts = [];
  switch (shape) {
    case 'heart': {
      // 표준 하트 곡선을 64점으로 샘플 (위쪽은 오목한 홈, 아래는 뾰족한 꼭짓점)
      const N = 64;
      for (let i = 0; i < N; i++) {
        const t = (i / N) * TAU;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        pts.push([x / 17, -y / 17]);
      }
      break;
    }
    case 'drop': {
      bez([0, -1], [0.54, -0.62], [0.86, -0.06], [0.78, 0.30], 13, pts);
      arc(0, 0.30, 0.78, 0, Math.PI, 15, pts);
      bez([-0.78, 0.30], [-0.86, -0.06], [-0.54, -0.62], [0, -1], 13, pts);
      break;
    }
    case 'clover': {
      // 중심에서 각 방향으로 4개 원의 합집합 경계까지의 거리를 계산
      const d = 0.46, rad = 0.52, N = 80;
      for (let i = 0; i < N; i++) {
        const th = (i / N) * TAU;
        let best = 0;
        for (let k = 0; k < 4; k++) {
          const a = (Math.PI / 2) * k - Math.PI / 2;
          const ox = Math.cos(a) * d, oy = Math.sin(a) * d;
          const proj = ox * Math.cos(th) + oy * Math.sin(th);
          const perp2 = ox * ox + oy * oy - proj * proj;
          const disc = rad * rad - perp2;
          if (disc <= 0) continue;
          const t = proj + Math.sqrt(disc);
          if (t > best) best = t;
        }
        pts.push([Math.cos(th) * best, Math.sin(th) * best]);
      }
      break;
    }
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 ? 0.47 : 1;
        const a = (i / 10) * TAU - Math.PI / 2;
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      break;
    }
    case 'crescent': {
      const N1 = 46, N2 = 34;
      arc(0, 0, 1, 0.62, TAU - 0.62, N1, pts);
      // 안쪽을 파내는 원(반대 방향)
      for (let i = 0; i <= N2; i++) {
        const a = (TAU - 0.86) - ((TAU - 0.86) - 0.86) * (i / N2);
        pts.push([0.46 + Math.cos(a) * 0.82, -0.05 + Math.sin(a) * 0.82]);
      }
      break;
    }
    default: {
      const N = 48;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU;
        pts.push([Math.cos(a), Math.sin(a)]);
      }
    }
  }
  // 최대 반지름을 1로 정규화
  let max = 0;
  for (const [x, y] of pts) max = Math.max(max, Math.hypot(x, y));
  const k = max > 0 ? 1 / max : 1;
  pts = pts.map(([x, y]) => [x * k, y * k]);
  UNIT.set(shape, pts);
  return pts;
}

function path(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function scaleAbout(pts, c, k) {
  return pts.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);
}

/* 실루엣 점을 m개로 균등 솎아 큰 면(facet)을 만든다 */
function dense(pts, m) {
  const stride = Math.max(1, Math.round(pts.length / m));
  const out = [];
  for (let i = 0; i < pts.length; i += stride) {
    if (out.length >= m) break;
    out.push(pts[i]);
  }
  return out;
}

function centroid(pts) {
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  return [sx / pts.length, sy / pts.length];
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function shade(hex, amt, a = 1) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

/* --------------------------------------------------------------- 본체 */
export function drawGem(ctx, colorIdx, cx, cy, r, opts = {}) {
  const c = CFG.colors[((colorIdx % CFG.colors.length) + CFG.colors.length) % CFG.colors.length];
  const { alpha = 1, scale = 1, rot = 0, shadow = true } = opts;
  const base = unitOutline(c.shape);
  const pts = base.map(([x, y]) => [x * r, y * r]);
  const C = centroid(pts);
  // 빛이 위에서 오므로 면의 중심을 살짝 위로 올린다
  const focus = [C[0], C[1] - r * 0.05];
  const outer = dense(pts, 14);
  const mid = scaleAbout(outer, focus, 0.70);
  const tab = scaleAbout(outer, focus, 0.36);
  const n = outer.length;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (shadow) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.26;
    ctx.fillStyle = '#1b2a63';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.92, r * 0.70, r * 0.17, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.rotate(rot);

  /* 1) 몸통 — 유리 같은 심도 */
  const body = ctx.createRadialGradient(-r * 0.30, -r * 0.38, r * 0.05, 0, 0, r * 1.30);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.18, c.light);
  body.addColorStop(0.46, shade(c.main, 16));
  body.addColorStop(0.82, shade(c.main, 4));
  body.addColorStop(1, shade(c.main, -28));
  path(ctx, pts);
  ctx.fillStyle = body;
  ctx.fill();

  /* 2) 커팅 면 — 실루엣 안쪽만 */
  ctx.save();
  path(ctx, pts);
  ctx.clip();

  // 거들(바깥 띠) 면들
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    ctx.beginPath();
    ctx.moveTo(mid[i][0], mid[i][1]);
    ctx.lineTo(mid[j][0], mid[j][1]);
    ctx.lineTo(outer[j][0], outer[j][1]);
    ctx.lineTo(outer[i][0], outer[i][1]);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(10,18,55,0.10)';
    ctx.fill();
  }
  // 크라운 면들
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    ctx.beginPath();
    ctx.moveTo(tab[i][0], tab[i][1]);
    ctx.lineTo(tab[j][0], tab[j][1]);
    ctx.lineTo(mid[j][0], mid[j][1]);
    ctx.lineTo(mid[i][0], mid[i][1]);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(6,14,48,0.09)';
    ctx.fill();
  }
  // 테이블(윗면) — 보석 색을 유지한 밝은 면
  path(ctx, tab);
  const tg = ctx.createLinearGradient(tab[0][0], C[1] - r * 0.6, C[0], C[1] + r * 0.55);
  tg.addColorStop(0, rgba(c.light, 0.98));
  tg.addColorStop(0.6, rgba(c.main, 0.86));
  tg.addColorStop(1, rgba(c.dark, 0.55));
  ctx.fillStyle = tg;
  ctx.fill();

  // 면 경계선 — 각진 컷이 드러나게
  ctx.strokeStyle = rgba(c.light, 0.45);
  ctx.lineWidth = Math.max(0.7, r * 0.026);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(tab[i][0], tab[i][1]);
    ctx.lineTo(mid[i][0], mid[i][1]);
    ctx.lineTo(outer[i][0], outer[i][1]);
    ctx.stroke();
  }
  // 거들 라인(중간 둘레)
  path(ctx, mid);
  ctx.strokeStyle = rgba(c.dark, 0.22);
  ctx.lineWidth = Math.max(0.8, r * 0.03);
  ctx.stroke();
  // 테이블 테두리
  path(ctx, tab);
  ctx.strokeStyle = 'rgba(255,255,255,0.62)';
  ctx.lineWidth = Math.max(0.9, r * 0.028);
  ctx.stroke();

  // 유리 반사광(좌상단 큰 하이라이트 + 작은 점광)
  const spec = ctx.createRadialGradient(-r * 0.34, -r * 0.42, 0, -r * 0.34, -r * 0.42, r * 0.42);
  spec.addColorStop(0, 'rgba(255,255,255,0.92)');
  spec.addColorStop(0.42, 'rgba(255,255,255,0.28)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.ellipse(-r * 0.30, -r * 0.38, r * 0.30, r * 0.19, -0.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.40, -r * 0.46, r * 0.085, r * 0.055, -0.7, 0, TAU);
  ctx.fill();

  // 우하단 은은한 반사(색 번짐)
  const bounce = ctx.createRadialGradient(r * 0.42, r * 0.46, 0, r * 0.42, r * 0.46, r * 0.55);
  bounce.addColorStop(0, rgba(c.light, 0.55));
  bounce.addColorStop(1, rgba(c.light, 0));
  ctx.fillStyle = bounce;
  ctx.fillRect(-r * 1.1, -r * 1.1, r * 2.2, r * 2.2);

  // 안쪽 테두리 빛(유리 가장자리)
  ctx.strokeStyle = rgba(c.light, 0.62);
  ctx.lineWidth = Math.max(1.4, r * 0.10);
  path(ctx, scaleAbout(pts, C, 0.965));
  ctx.stroke();
  // 위쪽 전체 광택
  const gloss = ctx.createLinearGradient(0, -r, 0, r * 0.35);
  gloss.addColorStop(0, 'rgba(255,255,255,0.34)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(-r * 1.1, -r * 1.1, r * 2.2, r * 1.6);
  ctx.restore();

  /* 3) 크리스프한 외곽선 + 안쪽 베벨 */
  path(ctx, pts);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = shade(c.dark, -20);
  ctx.lineWidth = Math.max(1.6, r * 0.080);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth = Math.max(1, r * 0.045);
  path(ctx, scaleAbout(pts, C, 0.88));
  ctx.stroke();

  /* 4) 아래쪽 접지 그림자 (몸통 안쪽 진한 톤) */
  ctx.save();
  path(ctx, pts);
  ctx.clip();
  const deep = ctx.createLinearGradient(0, r * 0.1, 0, r * 1.05);
  deep.addColorStop(0, 'rgba(0,0,0,0)');
  deep.addColorStop(1, shade(c.dark, -30, 0.24));
  ctx.fillStyle = deep;
  ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  ctx.restore();

  ctx.restore();
}

/* 반짝임(글린트) — 캐시 스프라이트 위에 매 프레임 얹는다 */
export function drawGemGlint(ctx, cx, cy, r, phase, strength = 1) {
  const a = Math.sin(Math.min(1, Math.max(0, phase)) * Math.PI) * strength;
  if (a <= 0.03) return;
  const gx = cx + (phase * 1.15 - 0.58) * r;
  const gy = cy + (phase * 0.75 - 0.42) * r;
  const rad = r * (0.26 + a * 0.34);
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.translate(gx, gy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
  g.addColorStop(0, 'rgba(255,255,255,0.98)');
  g.addColorStop(0.32, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr2 = i % 2 ? rad * 0.13 : rad;
    const an = (i / 8) * TAU;
    const x = Math.cos(an) * rr2, y = Math.sin(an) * rr2;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
