/* =========================================================================
   헥사 블리츠(HEXA BLITZ) — 게임 밸런스 설정
   점수·시간·콤보·특수 보석·드롭 아이템·부스터의 모든 수치를 이 파일 하나에서 조절합니다.
   ========================================================================= */

export const CFG = {
  /* ── 보드 ──────────────────────────────────────────────────
     8×8 격자, 보석 색 7가지 (색약 접근성을 위해 모양도 7가지로 구분) */
  board: {
    cols: 8,
    rows: 8,
    startSpecials: 0,      // 시작 시 미리 깔리는 특수 보석 수
  },

  /* ── 보석 색/모양 ─────────────────────────────────────────── */
  colors: [
    { key: 'ruby',    name: '루비',    shape: 'circle',   base: '#ff4d63', light: '#ffc2ca', dark: '#8f0e22' },
    { key: 'sapphire', name: '사파이어', shape: 'diamond',  base: '#3f8dff', light: '#bfd8ff', dark: '#0f3d8f' },
    { key: 'emerald', name: '에메랄드', shape: 'square',   base: '#2ed47a', light: '#c2ffdd', dark: '#0a6b3a' },
    { key: 'topaz',   name: '토파즈',   shape: 'triangle', base: '#ffd23d', light: '#fff4c2', dark: '#9c6e00' },
    { key: 'amethyst', name: '자수정',  shape: 'hexagon',  base: '#b56bff', light: '#e7d1ff', dark: '#4f1a91' },
    { key: 'amber',   name: '앰버',    shape: 'star',     base: '#ff9038', light: '#ffd8b3', dark: '#994500' },
    { key: 'aqua',    name: '아쿠아',   shape: 'heart',    base: '#2ee6e6', light: '#ccffff', dark: '#067070' },
  ],

  /* ── 제한 시간 ─────────────────────────────────────────────
     2분(120초) 블리츠. 시간 보석은 +5초, 게임당 최대 3번까지만 적용 */
  time: {
    total: 120000,
    timeGemBonus: 5000,
    timeGemMax: 3,
    warnAt: 10000,         // 남은 10초부터 경고 연출
  },

  /* ── 애니메이션 속도 ───────────────────────────────────────
     교체 220ms(부드러운 감속) · 되돌리기 210ms · 제거 240ms
     낙하는 가속 후 착지 직전 감속 + 착지 스쿼시 */
  anim: {
    swapMs: 220,           // 교체 이동 시간
    swapEase: 'easeOutCubic',
    invalidBackMs: 210,    // 되돌리기 이동 시간
    invalidEase: 'easeInOutQuad',
    clearMs: 240,          // 제거 팝/축소 연출
    clearWaveMs: 52,       // 연쇄 웨이브 사이 간격
    dropAccel: 0.0006,     // 칸/ms² (낙하 가속)
    dropMaxSpeed: 0.0125,  // 칸/ms (최고 낙하 속도)
    dropSoftCells: 1.2,    // 착지 직전 감속 구간(칸)
    landSquashMs: 200,     // 착지 스쿼시 지속
    cascadeDelay: 60,      // 연쇄 사이 최소 간격
    hintPulseMs: 900,
  },

  /* ── 점수 ────────────────────────────────────────────────── */
  score: {
    perGem: 25,            // 보석 1개 기본 점수
    specialCreated: 200,   // 특수 보석 생성 보너스
    specialTriggered: 60,  // 특수 보석 발동 1회당 추가
    itemCollected: 120,    // 드롭 아이템 획득 보너스
    lastHurrahPerSpecial: 500, // 라스트 허라 특수 1개당 보너스
  },

  /* ── 콤보 ──────────────────────────────────────────────────
     1.5초 안에 다시 매치하면 콤보 +1, 배율 = 1 + 콤보 × 0.25 */
  combo: {
    windowMs: 1500,
    step: 0.25,
    max: 30,
  },

  /* ── 블레이징 스피드 ───────────────────────────────────────
     3초 안에 콤보 5회 → 화염 테두리, 점수 ×2, 매치마다 인접 폭발 */
  blaze: {
    combosNeeded: 5,
    withinMs: 3000,
    durationMs: 5000,
    scoreMult: 2,
    explosionRadius: 1,
  },

  /* ── 피버 ──────────────────────────────────────────────────
     게이지가 가득 차면 8초간 점수 ×3 + 특수 보석 생성 확률 상승 */
  fever: {
    max: 100,
    perGem: 1.6,
    perCombo: 6,
    durationMs: 8000,
    scoreMult: 3,
    specialBoost: 1.7,          // 특수 보석 생성 가중치 배율
    specialSpawnChance: 0.045,  // 피버 중 새 보석이 특수 보석으로 등장할 확률
  },

  /* ── 특수 보석 ─────────────────────────────────────────────
     매치 모양에 따라 만들어지는 특수 보석 종류 */
  specials: {
    stripedRow:   { name: '가로 줄 보석', color: '#7dd3fc' }, // 세로 4매치
    stripedCol:   { name: '세로 줄 보석', color: '#7dd3fc' }, // 가로 4매치
    bomb:         { name: '폭탄 보석',   color: '#fb7185' }, // L/T 매치
    propeller:    { name: '프로펠러',    color: '#facc15' }, // 2×2 사각 매치
    hyper:        { name: '하이퍼 큐브', color: '#f472b6' }, // 5개 일렬
    nova:         { name: '슈퍼노바',    color: '#c084fc' }, // 6개 이상 일렬
    star:         { name: '스타 보석',   color: '#fde68a' }, // +자 5매치
    bombRadius: 1,       // 폭탄 1차 폭발 반경 (3×3)
    bombSecondRadius: 2, // 폭탄 2차 폭발 반경
    propArm: 2,          // 프로펠러 십자 팔 길이
    novaRows: 3,
    novaCols: 3,
  },

  /* ── 드롭 아이템 ───────────────────────────────────────────
     새 보석이 생길 때 확률적으로 아이템이 붙어 내려옵니다. */
  items: {
    spawnChance: 0.09,      // 새 보석 1개당 아이템 부착 확률 (기존 5.5% → 9%)
    maxOnBoard: 4,          // 보드 위 동시 아이템 수
    feverSpawnBoost: 1.8,   // 피버 중 아이템 등장 확률 배율
    feverGoodScale: 1.6,    // 피버 중 좋은 아이템 가중치 배율
    feverHazardScale: 0.35, // 피버 중 방해 아이템 가중치 배율
    time:     { name: '시간 보석',  chance: 18 },
    x2:       { name: '점수 ×2',   chance: 18, durationMs: 10000, mult: 2 },
    bolt:     { name: '번개 보석',  chance: 18, targets: 12 },
    wild:     { name: '무지개 보석', chance: 16 },
    chest:    { name: '보물 상자',  chance: 16, specials: 2 },
    ice:      { name: '얼음 보석',  chance: 8, hits: 2 },
    fuse:     { name: '시한 폭탄',  chance: 8, turns: 5, timePenaltyMs: 3000 },
  },

  /* ── 부스터 (피버 게이지 소모) ────────────────────────────── */
  boosters: {
    hammer:    { name: '망치',     cost: 30, icon: '🔨', desc: '원하는 보석 1개 파괴' },
    shuffle:   { name: '셔플',     cost: 25, icon: '🔀', desc: '보드 전체 재배치' },
    freeze:    { name: '시간 정지', cost: 40, icon: '⏸️', desc: '4초간 타이머 정지' },
    colorBomb: { name: '컬러 봄',   cost: 50, icon: '💥', desc: '한 색 보석 모두 제거' },
    freezeMs: 4000,
  },

  /* ── 입력 / 힌트 ─────────────────────────────────────────── */
  input: {
    dragThreshold: 14,     // 드래그로 인식하는 최소 이동(px)
    idleHintMs: 3000,      // 3초 조작 없으면 힌트 표시
  },

  /* ── 이름 규칙 (간단 비속어 필터) ────────────────────────── */
  name: {
    min: 2,
    max: 12,
    banned: [
      '시발', '씨발', '씨바', 'ㅅㅂ', '개새', '병신', '븅신', '존나', '좆', '지랄',
      '니미', '엠창', '섹스', '미친놈', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'sex',
    ],
  },

  /* ── 랭킹 ────────────────────────────────────────────────── */
  leaderboard: { limit: 50 },
};

/* 모드 이름 (Firestore `mode` 필드)
   제한 시간이 2분으로 바뀌어도 값은 'blitz60' 그대로 둡니다.
   기존 Firestore 보안 규칙(mode == 'blitz60')과 복합 색인이 그대로 동작해야
   랭킹 점수 저장이 끊기지 않기 때문입니다. */
export const MODE = 'blitz60';

/* 콤보 배율 계산 */
export function comboMultiplier(combo) {
  return 1 + Math.min(combo, CFG.combo.max) * CFG.combo.step;
}
