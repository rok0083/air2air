/* =========================================================================
   목표(Goals) — 네 가지 목표 유형
     · collect : 색 보석 N개 모으기
     · clear   : 장애물 N개 없애기 (특정 종류 또는 any)
     · drop    : 아이템 N개를 바닥까지 떨어뜨리기
     · boss    : 보스 HP 0으로 만들기
   ========================================================================= */
import { GEMS } from '../config.js';
import { ICONS } from '../ui/dom.js';

export class Goals {
  constructor(level) {
    this.list = (level.goals || []).map(g => ({
      ...g,
      total: g.type === 'boss' ? (level.boss?.hp ?? g.count ?? g.hp ?? 1) : (g.count ?? 1),
      done: 0,
    }));
    // boss 목표가 따로 없지만 boss 가 있으면 자동 추가
    if (level.boss && !this.list.some(g => g.type === 'boss')) {
      this.list.push({ type: 'boss', total: level.boss.hp, done: 0 });
    }
    this.completed = false;
  }

  get all() { return this.list; }

  label(g) {
    switch (g.type) {
      case 'collect': return `${GEMS[g.color]?.name ?? '보석'} ${Math.min(g.done, g.total)}/${g.total}`;
      case 'clear': return `${g.obstacle && g.obstacle !== 'any' ? obstacleName(g.obstacle) : '장애물'} ${Math.min(g.done, g.total)}/${g.total}`;
      case 'drop': return `${g.item === 'acorn' ? '도토리' : '마법 씨앗'} ${Math.min(g.done, g.total)}/${g.total}`;
      case 'boss': return `보스 ${Math.max(0, g.total - g.done)}/${g.total}`;
      default: return `${g.done}/${g.total}`;
    }
  }

  icon(g) {
    switch (g.type) {
      case 'collect': return '<span class="gem-dot" style="background:' + (GEMS[g.color]?.color || '#fff') + '"></span>';
      case 'clear': return ICONS.brick;
      case 'drop': return ICONS.seed;
      case 'boss': return ICONS.boss;
      default: return ICONS.star;
    }
  }

  onTileCleared(tile) {
    if (!tile) return;
    let changed = false;
    for (const g of this.list) {
      if (g.type === 'collect' && g.color === tile.color && g.done < g.total) { g.done++; changed = true; }
    }
    return changed;
  }

  onObstacleCleared(type) {
    let changed = false;
    for (const g of this.list) {
      if (g.type === 'clear' && (g.obstacle === 'any' || !g.obstacle || g.obstacle === type) && g.done < g.total) { g.done++; changed = true; }
    }
    return changed;
  }

  onItemCollected(n = 1) {
    let changed = false;
    for (const g of this.list) {
      if (g.type === 'drop' && g.done < g.total) { g.done = Math.min(g.total, g.done + n); changed = true; }
    }
    return changed;
  }

  onBossDamage(n = 1) {
    let changed = false;
    for (const g of this.list) {
      if (g.type === 'boss' && g.done < g.total) { g.done = Math.min(g.total, g.done + n); changed = true; }
    }
    return changed;
  }

  isDone() { return this.list.length > 0 && this.list.every(g => g.done >= g.total); }
  progress() {
    const total = this.list.reduce((s, g) => s + g.total, 0) || 1;
    const done = this.list.reduce((s, g) => s + Math.min(g.done, g.total), 0);
    return done / total;
  }
  toJSON() { return this.list.map(g => ({ ...g })); }
}

function obstacleName(type) {
  const map = {
    bush: '덤불', crate: '나무 상자', grass: '풀밭', ice: '얼음', snowman: '눈사람', icicle: '고드름',
    sand: '모래', jar: '항아리', cactus: '선인장', vine: '덩굴', fruitTree: '열매 나무', swamp: '늪',
    shadowStone: '그림자 돌', shadowRune: '그림자 룬',
  };
  return map[type] || '장애물';
}
