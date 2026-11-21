/* =========================================================================
   부스터 — 인게임(망치·드릴·폭탄·마법모자) / 시작 전(로켓·폭탄·프로펠러)
   + 연승 보너스(3단계)
   실제 효과 처리는 js/core/board.js 의 useBooster() 가 담당하고,
   이 파일은 정의·가격·보유량 계산을 담당합니다.
   ========================================================================= */
import { CFG } from '../config.js';

export const IN_GAME_BOOSTERS = ['hammer', 'drill', 'bomber', 'magicHat'];
export const PRE_LEVEL_BOOSTERS = ['startRocket', 'startTnt', 'startSpinner'];

export const BOOSTER_META = CFG.boosters;

export function boosterDef(key) {
  return CFG.boosters[key] || null;
}

export function priceOf(key) {
  return CFG.boosters[key]?.price ?? 100;
}

/* 연승 단계 계산 — 같은 스테이지를 연속 클리어한 횟수 */
export function streakTier(wins) {
  let tier = null;
  for (const t of CFG.streak.tiers) if (wins >= t.wins) tier = t;
  return tier;
}

/* 시작 보너스로 받을 특수 보석 수량 */
export function streakStartBonus(wins) {
  const t = streakTier(wins);
  return {
    startRocket: t?.startRocket || 0,
    startTnt: t?.startTnt || 0,
    startSpinner: t?.startSpinner || 0,
    label: t?.label || '',
  };
}

/* 인게임 부스터 버튼 목록 */
export function inGameButtons() {
  return IN_GAME_BOOSTERS.map(key => ({ key, ...CFG.boosters[key] }));
}
