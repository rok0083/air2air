/* =========================================================================
   목표 — 정규화 · 아이콘 · 표시 문구
   목표 유형: 장애물 제거(box, colorBox, ...), 색 수집(collect), 편지, 아기 새
   ========================================================================= */
import { CFG, COLOR_KEYS } from '../config.js';

export function normalizeGoals(goals = []) {
  return goals.map(g => {
    const type = g.type;
    const isObstacle = Object.prototype.hasOwnProperty.call(CFG.obstacles, type);
    return {
      type: isObstacle ? 'obstacle' : type,
      obstacle: isObstacle ? type : (g.obstacle || null),
      colorKey: g.color || null,
      color: g.color ? COLOR_KEYS.indexOf(g.color) : null,
      need: g.count ?? g.need ?? 1,
      done: 0,
    };
  });
}

export function goalIconKind(g) {
  if (g.type === 'collect') return 'gem';
  if (g.type === 'letter') return 'letter';
  if (g.type === 'bird') return 'bird';
  return g.obstacle || 'box';
}

export function goalShortLabel(g) {
  if (g.type === 'collect') return CFG.colors.find(c => c.key === g.colorKey)?.name.split(' ')[0] || '조각';
  if (g.type === 'letter') return '편지';
  if (g.type === 'bird') return '아기 새';
  return CFG.obstacles[g.obstacle]?.name || '목표';
}

export function goalListText(goals) {
  return goals.map(g => `${goalShortLabel(g)} ${Math.max(0, g.need - g.done)}`).join(' · ');
}
