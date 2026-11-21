/* =========================================================================
   장애물 — 공통 인터페이스
     hp, size, blocksFall, onAdjacentMatch(color), onPowerupHit, onTurnEnd
   실제 피해 계산은 Board 가 하고, 이 파일은 종류별 성질과 생성만 담당한다.
   ========================================================================= */
import { CFG, COLOR_KEYS } from '../config.js';

export const OB_DEFS = CFG.obstacles;

let _gid = 1;

export function makeObstacle(type, props = {}) {
  const def = OB_DEFS[type];
  if (!def) throw new Error(`unknown obstacle: ${type}`);
  const hp = props.hp ?? def.hp;
  return {
    type,
    hp,
    maxHp: hp,
    size: props.size ?? { w: props.w || 1, h: props.h || 1 },
    blocksFall: def.blocksFall,
    gid: props.gid || null,
    colorKey: props.color || null,          // 색 상자 전용
    color: props.color ? Math.max(0, COLOR_KEYS.indexOf(props.color)) : null,
    keys: 0,
    revealed: false,
    id: `ob${_gid++}`,
  };
}

export function obstacleDef(ob) { return ob ? OB_DEFS[ob.type] : null; }

/* 조각이 들어갈 수 없는(장애물이 차지한) 칸인가 */
export function isBlocking(ob) {
  if (!ob) return false;
  return ob.blocksFall && !['grass', 'honey', 'chain', 'ice', 'curtain'].includes(ob.type);
}

/* 조각 위에 덮여 조각을 잠그는가 */
export function locksGem(ob) {
  if (!ob) return false;
  return ob.type === 'chain' || ob.type === 'ice';
}

/* 옆 매치로 피해를 받을 수 있는가 */
export function canHitFromAdjacent(ob, matchColor) {
  if (!ob) return false;
  const def = OB_DEFS[ob.type];
  if (!def || !def.adjacent) return false;
  if (def.colorOnly) return ob.color === matchColor;
  return true;
}

/* 재질별 파괴음 */
export function obstacleMaterial(ob) {
  const def = ob && OB_DEFS[ob.type];
  return def ? def.material : 'wood';
}

/* 턴 종료 처리용 목록 */
export function obstaclesWithTurnEnd(board) {
  const out = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const ob = board.cell(x, y)?.ob;
      if (ob && OB_DEFS[ob.type]?.spreads) out.push({ x, y, ob });
    }
  }
  return out;
}
