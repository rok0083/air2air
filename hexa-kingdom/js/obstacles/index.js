/* =========================================================================
   장애물(Obstacle) — 공통 인터페이스와 월드 1~5 등록
   -------------------------------------------------------------------------
   모든 장애물은 아래 인터페이스를 구현합니다.
     · hp              : 남은 체력(층)
     · onAdjacentMatch : 인접한 곳에서 매치가 일어났을 때  → damage()
     · onPowerupHit    : 특수 보석/부스터 범위에 휩쓸렸을 때 → damage()
     · onTurnEnd       : 플레이어 이동이 끝날 때(번짐·낙하 등)
   월드별 정의는 world1.js ~ world5.js 에 있습니다.
   ========================================================================= */

import { WORLD1_OBSTACLES } from './world1.js';
import { WORLD2_OBSTACLES } from './world2.js';
import { WORLD3_OBSTACLES } from './world3.js';
import { WORLD4_OBSTACLES } from './world4.js';
import { WORLD5_OBSTACLES } from './world5.js';

export const MATERIALS = {
  leaf:  { debris: '#4cd97b', name: '잎' },
  wood:  { debris: '#b07a45', name: '나무' },
  grass: { debris: '#7bd44f', name: '풀' },
  ice:   { debris: '#9fe8ff', name: '얼음' },
  snow:  { debris: '#ffffff', name: '눈' },
  sand:  { debris: '#e8c98a', name: '모래' },
  clay:  { debris: '#d98b5f', name: '도자기' },
  cactus:{ debris: '#5fbf6a', name: '선인장' },
  vine:  { debris: '#3f9e57', name: '덩굴' },
  fruit: { debris: '#ff9a3c', name: '열매' },
  mud:   { debris: '#6b5c3e', name: '수렁' },
  stone: { debris: '#8b8fa3', name: '돌' },
  shadow:{ debris: '#8b6cff', name: '그림자' },
};

export const OBSTACLES = {
  ...WORLD1_OBSTACLES,
  ...WORLD2_OBSTACLES,
  ...WORLD3_OBSTACLES,
  ...WORLD4_OBSTACLES,
  ...WORLD5_OBSTACLES,
};

export class Obstacle {
  constructor(spec, board) {
    this.def = OBSTACLES[spec.type];
    if (!this.def) throw new Error('unknown obstacle: ' + spec.type);
    this.type = spec.type;
    this.r = spec.r;
    this.c = spec.c;
    this.board = board;
    this.maxHp = spec.hp ?? this.def.hp;
    this.hp = this.maxHp;
    this.data = spec.data || {};
    this.dead = false;
    this.flash = 0;
    this.spawnAt = 0;
  }

  get name() { return this.def.name; }
  get material() { return this.def.material; }
  get blocksTile() { return !!this.def.blocksTile; }
  get overlay() { return !!this.def.overlay; }
  get cell() { return `${this.r},${this.c}`; }

  /* 인접 매치 — 기본 1 피해 */
  onAdjacentMatch(ctx = {}) {
    this.damage(this.def.damageOnMatch ?? 1, 'match', ctx);
  }

  /* 특수 보석 피해 — 기본 1 피해(관통) */
  onPowerupHit(ctx = {}) {
    this.damage(this.def.damageOnPowerup ?? 1, 'powerup', ctx);
  }

  /* 턴 종료 — 기본 없음 (번짐·낙하는 개별 정의에서) */
  onTurnEnd(ctx = {}) {
    const b = this.board;
    if (!b || this.dead) return;
    if (this.def.faller && b.rng.next() < 0.12) {
      // 고드름: 아래 칸으로 떨어진다(비어 있으면)
      const nr = this.r + 1;
      if (nr < b.rows && !b.obstacleAt(nr, this.c) && !b.voids.has(`${nr},${this.c}`)) {
        b.moveObstacle(this.r, this.c, nr, this.c);
        b.hooks.onObstacleEvent?.('icicle-drop', this);
      }
    }
  }

  damage(n, cause, ctx = {}) {
    if (this.dead) return 0;
    const before = this.hp;
    this.hp = Math.max(0, this.hp - n);
    this.flash = 0.25;
    if (this.hp === 0) {
      this.dead = true;
      this.def.onBreak?.(this, ctx, this.board);
      this.board?.notifyObstacleCleared?.(this);
      this.board?.hooks.onObstacleBreak?.(this, cause);
    } else {
      this.board?.hooks.onObstacleHit?.(this, cause);
    }
    return before - this.hp;
  }

  toJSON() { return { r: this.r, c: this.c, type: this.type, hp: this.hp, data: this.data }; }
}

/* 레벨 JSON 배치 → Obstacle 인스턴스 */
export function makeObstacle(spec, board) {
  return new Obstacle(spec, board);
}

/* 재질별 파편 색 (effects 에서 사용) */
export function debrisColor(material) {
  return MATERIALS[material]?.debris || '#ffffff';
}
