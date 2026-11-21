/* =========================================================================
   sprrites.js — 오프스크린 캔버스 캐시 (devicePixelRatio 반영)
   조각·장애물·드롭 아이콘을 한 번만 그려 두고 drawImage 로 빠르게 찍는다.
   ========================================================================= */
import { drawGem, drawPowerOverlay, drawObstacle, drawDrop, drawIcon } from './art.js';

const DPR = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
const cache = new Map();

function make(size, draw) {
  const c = document.createElement('canvas');
  const px = Math.ceil(size * DPR);
  c.width = px; c.height = px;
  const ctx = c.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.translate(size / 2, size / 2);
  draw(ctx, size);
  return c;
}

function cached(key, size, draw) {
  const k = `${key}@${Math.round(size)}`;
  let c = cache.get(k);
  if (!c) { c = make(size, draw); cache.set(k, c); }
  return c;
}

export function gemSprite(colorIdx, power, orient, size) {
  return cached(`gem:${colorIdx}:${power || '-'}:${orient || '-'}`, size, (ctx, s) => {
    drawGem(ctx, colorIdx, 0, 0, s * 0.42);
    if (power) drawPowerOverlay(ctx, power, 0, 0, s * 0.40, 0);
  });
}

export function obstacleSprite(ob, size) {
  const key = `ob:${ob.type}:${Math.min(ob.hp, 4)}:${ob.color ?? '-'}`;
  return cached(key, size, (ctx, s) => {
    drawObstacle(ctx, { ...ob, hp: Math.min(ob.hp, 4), maxHp: Math.min(ob.maxHp || 4, 4) }, 0, 0, s * 0.96, 0);
  });
}

export function dropSprite(type, size) {
  return cached(`drop:${type}`, size, (ctx, s) => drawDrop(ctx, type, 0, 0, s * 1.5, 0));
}

export function iconSprite(kind, size, opts = {}) {
  return cached(`icon:${kind}:${opts.colorKey || ''}`, size, (ctx, s) => drawIcon(ctx, kind, 0, 0, s * 0.92, opts));
}

export function blit(ctx, sprite, cx, cy, size, alpha = 1) {
  if (!sprite) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, cx - size / 2, cy - size / 2, size, size);
  ctx.globalAlpha = 1;
}

export function clearSpriteCache() { cache.clear(); }
export { DPR };
