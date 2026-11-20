/* =========================================================================
   헥사(HEXA) — 게임 설정 / 밸런스
   아이템 확률, 점수, 속도, 피버 지속시간 등 모든 수치를 이 파일 하나에서 조절합니다.
   ========================================================================= */

export const COLS = 6;
export const ROWS = 13;

/* 보석 색상 정의 (레벨 10부터 7번째 색이 추가됨) */
export const COLOR_KEYS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
export const EXTRA_COLOR = 'cyan';

export const COLORS = {
  red:    { base: '#ff4d63', light: '#ffc2ca', dark: '#8f0e22', name: '루비' },
  blue:   { base: '#3f8dff', light: '#bfd8ff', dark: '#0f3d8f', name: '사파이어' },
  green:  { base: '#2ed47a', light: '#c2ffdd', dark: '#0a6b3a', name: '에메랄드' },
  yellow: { base: '#ffd23d', light: '#fff4c2', dark: '#9c6e00', name: '토파즈' },
  purple: { base: '#b56bff', light: '#e7d1ff', dark: '#4f1a91', name: '자수정' },
  orange: { base: '#ff9038', light: '#ffd8b3', dark: '#994500', name: '앰버' },
  cyan:   { base: '#2ee6e6', light: '#ccffff', dark: '#067070', name: '아쿠아' },
  stone:  { base: '#7b8698', light: '#c3ccd8', dark: '#3a4351', name: '돌' },
  rainbow: { base: '#ff5fd2', light: '#ffffff', dark: '#5a1a86', name: '무지개' },
};

export const CONFIG = {
  /* ── 보드 / 블록 ───────────────────────────────────────────── */
  board: { cols: COLS, rows: ROWS },
  piece: { height: 3 },

  /* ── 레벨 ─────────────────────────────────────────────────── */
  levels: {
    gemsPerLevel: 30,     // 보석 30개 제거마다 레벨업
    maxLevel: 99,
    extraColorFrom: 10,   // 레벨 10부터 7색
  },

  /* ── 낙하 속도 (ms per row) ──────────────────────────────── */
  speed: {
    startDropMs: 880,
    minDropMs: 190,
    dropMsPerLevel: 52,
    softDropFactor: 0.09,   // ↓ 소프트드롭: 한 칸당 간격 ×0.09
    lockDelayMs: 60,
  },

  /* ── 점수 ─────────────────────────────────────────────────── */
  score: {
    perGem: 10,                              // 보석 1개 = 10점 × 레벨
    chainTable: [1, 1, 2, 4, 8, 16, 32, 64], // 1연쇄 ×1, 2연쇄 ×2, 3연쇄 ×4 ...
    fourPlusBonus: 1.5,                      // 4개 이상 동시 매치
    diagonalBonus: 1.2,                      // 대각선 매치 +20%
  },

  /* ── 피버 ─────────────────────────────────────────────────── */
  fever: {
    max: 100,
    gainPerGem: 0.9,
    gainPerChain: 20,
    durationMs: 10000,   // 10초
    multiplier: 3,
  },

  /* ── 아이템 ───────────────────────────────────────────────── */
  items: {
    inventory: 3,             // 인벤토리 3칸 (가득 차면 가장 오래된 것 자동 발동)
    dropBaseChance: 0.12,     // 보석 제거 시 기본 12%
    dropChainBonus: 0.05,     // 연쇄 1단계마다 +5%
    dropMaxChance: 0.45,
    // 좋은 아이템 등장 확률(가중치) — 합계 대비 비율
    weights: {
      magic: 10, bomb: 9, hlaser: 8, vlaser: 8, cross: 7, rainbow: 7, lightning: 8,
      hammer: 8, freeze: 5, slow: 6, colorchange: 6, magnet: 5, floor: 8,
      shield: 4, boost: 6, shuffle: 5, future: 4,
    },
    hammerTimeoutMs: 6000,
  },

  /* ── 방해 아이템 ──────────────────────────────────────────── */
  obstacles: {
    startDelayMs: 22000,      // 첫 방해 아이템까지
    intervalMs: 27000,        // 이후 주기
    perLevelMs: 1800,         // 레벨당 주기 단축
    minIntervalMs: 9000,
    levelUpChance: 0.7,       // 레벨업 때 추가 발생 확률
    weights: { stone: 10, rise: 9, speed: 9, dark: 8, invert: 8, lock: 10, confusion: 7 },
  },

  /* ── 아이템 지속 효과 (ms) ────────────────────────────────── */
  effects: {
    freezeMs: 5000,
    slowMs: 15000, slowFactor: 0.5,
    boostMs: 20000, boostFactor: 2,
    futureMs: 30000, futurePreviews: 5,
    speedUpMs: 10000, speedUpFactor: 2,
    darkMs: 10000,
    invertMs: 8000,
    confusionMs: 10000,
  },

  /* ── 연출 ─────────────────────────────────────────────────── */
  visuals: {
    particlesPerGem: 7,
    popupMs: 1000,
    bannerMs: 1400,
    shakeMs: 340,
    flashMs: 220,
  },

  /* ── 이름 규칙 ────────────────────────────────────────────── */
  name: {
    min: 2,
    max: 12,
    // 간단한 비속어 필터 (부분 일치)
    banned: [
      '시발', '씨발', '씨바', '시바', 'ㅅㅂ', '개새', '개색', '병신', '븅신', '빙신',
      '존나', '존내', '좆', '지랄', '니미', '엠창', '섹스', '야설', '미친놈',
      'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'sex',
    ],
  },

  /* ── 랭킹 ─────────────────────────────────────────────────── */
  leaderboard: { limit: 50 },
};

/* 현재 레벨에서 사용할 보석 색상 목록 */
export function colorsForLevel(level) {
  if (level >= CONFIG.levels.extraColorFrom) return [...COLOR_KEYS, EXTRA_COLOR];
  return [...COLOR_KEYS];
}

/* 레벨별 낙하 간격 */
export function dropIntervalForLevel(level) {
  const { startDropMs, minDropMs, dropMsPerLevel } = CONFIG.speed;
  return Math.max(minDropMs, startDropMs - (level - 1) * dropMsPerLevel);
}
