/* =========================================================================
   부스터 — 인게임(8종) / 시작 전(로켓·폭탄·프로펠러) + 연승 보너스(3단계)
   실제 효과 처리는 js/core/board.js 의 useBooster() / freeSwap() 이 담당하고,
   이 파일은 정의·가격·보유량 계산을 담당합니다.

   v2 신규 전술 부스터
     · swap      자유 교체 : 이동 수 없이 이웃한 두 보석 교체 (target: pair)
     · lightning 번개 지팡이 : 가로+세로+대각선 8방향 타격 (target: cell)
     · prism     무지개 프리즘 : 칸 하나를 전기구로 바꿔 즉시 발동 (target: cell)
     · hourglass 시간 모래시계 : 이동 +3 즉시 (target: self)
   ========================================================================= */
import { CFG } from '../config.js';

export const IN_GAME_BOOSTERS = ['hammer', 'drill', 'bomber', 'magicHat', 'swap', 'lightning', 'prism', 'hourglass'];
export const PRE_LEVEL_BOOSTERS = ['startRocket', 'startTnt', 'startSpinner'];
/* 상자·레벨업에서 나오는 인게임 부스터 풀 */
export const BOOSTER_POOL = ['hammer', 'drill', 'bomber', 'magicHat', 'swap', 'lightning', 'prism', 'hourglass'];

export const BOOSTER_META = CFG.boosters;

export function boosterDef(key) {
  return CFG.boosters[key] || null;
}

export function priceOf(key) {
  return CFG.boosters[key]?.price ?? 100;
}

/* 부스터가 가리키는 대상 방식 — cell / pair / self */
export function targetOf(key) {
  return CFG.boosters[key]?.target || 'cell';
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
