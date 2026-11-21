/* =========================================================================
   헥사 킹덤(HEXA KINGDOM) — 게임 전체 밸런스 설정
   -------------------------------------------------------------------------
   이 파일 하나에 모든 수치(확률·보상·가격·회복 시간·연출 시간 등)를 모아
   두었습니다. 밸런스를 바꿀 때는 이 파일만 고치면 됩니다.
   주석은 한국어로, 값의 의미와 단위를 함께 적었습니다.
   ========================================================================= */

export const CFG = {
  version: '2.0.0',
  title: '헥사 킹덤',
  titleEn: 'HEXA KINGDOM',
  storageKey: 'hexaKingdom.profile.v1',

  /* ---------------------------------------------------------------------
     보드 / 격자
     --------------------------------------------------------------------- */
  board: {
    cols: 8,             // 기본 가로 칸 수
    rows: 8,             // 기본 세로 칸 수
    padding: 6,          // 보드 안쪽 여백(px)
    minCell: 34,         // 휴대폰에서 칸 크기 하한(px)
  },

  /* ---------------------------------------------------------------------
     연출 타이밍 (ms) — 너무 빠르면 손맛이 없고, 느리면 답답합니다.
     --------------------------------------------------------------------- */
  anim: {
    swap: 150,           // 인접 교체 1회
    swapBack: 170,       // 무효 교체 되돌리기
    clear: 210,          // 보석 제거 팝
    clearStagger: 18,    // 같은 그룹 내 순차 제거 간격
    drop: 230,           // 낙하 1칸당
    dropMax: 420,        // 낙하 최대 시간
    cascadeGap: 110,     // 연쇄 사이 숨 고르기
    hintDelay: 5200,     // 무입력 시 힌트까지
    shuffleDelay: 260,   // 셔플 연출
    turnEnd: 230,        // 턴 종료(장애물·보스) 처리
    slowmoScale: 0.35,   // 큰 폭발 시 시간 배율
    slowmoMs: 90,        // 슬로모 지속
    zoomPunch: 1.035,    // 큰 콤보 화면 확대
    comboBanner: 900,    // "N 연쇄!" 배너 표시
  },

  /* ---------------------------------------------------------------------
     점수 / 경험치 / 재화
     --------------------------------------------------------------------- */
  score: {
    perTile: 50,             // 보석 1개 기본 점수
    cascadeStep: 0.3,        // 연쇄 1단계마다 배수 +0.3
    powerupCreate: 150,      // 특수 보석 생성 보너스
    powerupActivate: 80,     // 특수 보석 발동 1회당
    bossPerTile: 1,          // 보석 1개 제거 = 보스 피해 1
    bossPerPowerup: 4,       // 특수 발동 1회 = 보스 피해 4
  },

  xp: {
    perLevelClear: 40,       // 스테이지 클리어 경험치
    perStar: 12,             // 별 1개당 추가 경험치
    base: 100,               // 플레이어 1레벨 → 2레벨 필요 경험치
    curve: 1.22,             // 레벨당 필요 경험치 증가율
    maxPlayerLevel: 60,
  },

  coins: {
    start: 600,              // 최초 지급 코인
    levelClear: 50,          // 클리어 기본 보상
    perStar: 20,             // 별 1개당 추가 코인
    districtClear: 250,      // 구역(5스테이지) 완료 보너스
    taskRestore: 40,         // 마을 복구 1개당 코인
    streakBonus: 15,         // 연승 1회당 추가 코인
    adsOff: true,            // 광고 없음(항상 true)
  },

  hammers: {
    start: 3,                // 최초 지급 망치 토큰
    perLevel: 1,             // 스테이지 첫 클리어 시
    perDistrict: 2,          // 구역 완료 시
    shopPrice: 120,          // 상점에서 망치 토큰 1개 가격
  },

  /* 목숨 규칙 (로열 킹덤·캔디크러시 방식)
     · 스테이지를 시작할 때는 목숨을 쓰지 않습니다.
     · 실패했을 때만 1개, 이동을 1번 이상 둔 뒤 중도 포기했을 때만 1개.
     · 클리어하면 그대로 유지 → 질 때까지 계속 이어서 플레이할 수 있습니다. */
  lives: {
    max: 5,                  // 최대 목숨
    recoveryMs: 15 * 60 * 1000, // 목숨 1개 회복 = 15분
    refillOnLevelUp: 1,      // 플레이어 레벨업 시 목숨 +1
    refillOnStar: false,     // 별 획득으로는 회복하지 않음
    costOnStart: 0,          // 시작 비용 없음
    costOnFail: 1,           // 실패 시 1 소모
    costOnQuit: 1,           // 이동 1회 이상 후 중도 포기 시 1 소모
    refillCoinCost: 400,     // 코인으로 목숨 가득 충전 가격
    refillToFull: true,      // 충전 시 최대치까지
    continueCost: 500,       // "+5 이동" 이어하기 코인 가격
    continueMoves: 5,        // 이어하기 시 지급 이동 수
    continueMax: 2,          // 이어하기 최대 횟수
  },

  /* ---------------------------------------------------------------------
     연승(윈 스트릭) 보상 — 3단계까지
     같은 스테이지를 연속 클리어할 때 다음 판 시작 특수 보석을 지급합니다.
     --------------------------------------------------------------------- */
  streak: {
    tiers: [
      { wins: 3, startRocket: 1, label: '3연승! 시작 로켓 +1' },
      { wins: 5, startRocket: 2, label: '5연승! 시작 로켓 +2' },
      { wins: 7, startRocket: 2, startTnt: 1, label: '7연승! 로켓 +2 · 폭탄 +1' },
    ],
  },

  /* ---------------------------------------------------------------------
     인게임 부스터 — 이동 수를 쓰지 않고 1회 사용, 개수는 프로필에 저장
     --------------------------------------------------------------------- */
  boosters: {
    hammer:    { name: '망치',      desc: '칸 하나를 부숩니다. 장애물에도 피해.', price: 120, icon: '🔨', target: 'cell' },
    drill:     { name: '드릴',      desc: '세로 한 줄을 뚫습니다. 장애물 관통.', price: 180, icon: '🪛', target: 'cell' },
    bomber:    { name: '폭탄',      desc: '3×3 범위를 폭발시킵니다.',            price: 200, icon: '💥', target: 'cell' },
    magicHat:  { name: '마법 모자', desc: '같은 색 보석을 모두 특수 보석으로!',   price: 260, icon: '🎩', target: 'cell' },
    // ── v2 신규 전술 부스터 ──
    swap:      { name: '자유 교체', desc: '이동 수 없이 이웃한 두 보석을 바꿉니다.', price: 160, icon: '🧤', target: 'pair', tag: 'NEW' },
    lightning: { name: '번개 지팡이', desc: '가로·세로·대각선 8방향을 한 번에 지웁니다.', price: 240, icon: '⚡', target: 'cell', tag: 'NEW' },
    prism:     { name: '무지개 프리즘', desc: '칸 하나를 전기구로 바꿔 즉시 터뜨립니다.', price: 280, icon: '🔮', target: 'cell', tag: 'NEW' },
    hourglass: { name: '시간 모래시계', desc: '이동 수 +3을 바로 받습니다.', price: 200, icon: '⌛', target: 'self', tag: 'NEW' },
    startRocket: { name: '시작 로켓', desc: '시작 시 로켓 1개를 놓습니다.',     price: 100, icon: '🚀' },
    startTnt:    { name: '시작 폭탄', desc: '시작 시 폭탄 1개를 놓습니다.',     price: 140, icon: '🧨' },
    startSpinner:{ name: '시작 프로펠러', desc: '시작 시 프로펠러 1개를 놓습니다.', price: 160, icon: '🌀' },
  },

  /* ---------------------------------------------------------------------
     보드에 떨어지는 보너스 보석 — 연쇄/콤보 중 가끔 등장합니다.
     --------------------------------------------------------------------- */
  bonus: {
    coin: 50,          // 코인 보석이 주는 코인
    moves: 2,          // 이동 +2
    strike: 2,         // 목표 2개 자동 타격
    x2Turns: 3,        // 다음 3수 점수 2배
    chanceCascade: 0.34, // 연쇄 2단계 이상일 때 등장 확률
    chanceTurn: 0.5,     // 3수마다 등장 확률
    maxOnBoard: 2,       // 동시에 보드에 있을 수 있는 수
    types: [
      { id: 'coin',  name: '코인 보석',  desc: '코인 +50',        color: '#ffc93c' },
      { id: 'moves', name: '이동 보석',  desc: '이동 수 +2',      color: '#48dbfb' },
      { id: 'strike',name: '별빛 타격',  desc: '목표 2개 자동 타격', color: '#ffe066' },
      { id: 'x2',    name: '2배 점수',   desc: '다음 3수 점수 2배', color: '#c56cf0' },
    ],
  },

  /* ---------------------------------------------------------------------
     특수 보석 확률/규칙
     --------------------------------------------------------------------- */
  powerups: {
    types: ['rocket', 'tnt', 'spinner', 'electro'],
    spawnPriority: ['electro5', 'tnt', 'spinner', 'rocket4'],
    // 4개 일렬 → 로켓(방향은 매치 방향과 같게), 5개 이상 → 전기구,
    // L/T자 → TNT, 2×2 사각 → 프로펠러
    chainDepth: 60,         // 연쇄 폭발 최대 깊이(무한 루프 방지)
    electroClearRatio: 1,   // 전기구가 지우는 색 보석 비율(1=전부)
    spinnerTargets: 1,      // 프로펠러가 날아가 추가로 터뜨리는 지점 수
  },

  /* ---------------------------------------------------------------------
     장애물 기본 수치 (월드별 세부는 js/obstacles/)
     --------------------------------------------------------------------- */
  obstacles: {
    hitAdjacentMatch: 1,   // 인접 매치 1회당 피해
    hitPowerup: 1,         // 특수 보석 1회당 피해
    sandSpreadEvery: 3,    // 모래가 번지는 주기(플레이어 이동 수)
    sandMaxSpread: 14,     // 모래 최대 칸 수(폭주 방지)
    bossSummonEvery: 2,    // 보스가 장애물을 소환하는 주기(이동 수)
    bossSummonMax: 6,      // 보스 소환 누적 상한
    icicleFallChance: 0.12,// 고드름이 떨어질 확률(턴 종료 시)
    swampSlow: true,       // 늪 위 보석은 매치 시 점수 0.7배
  },

  /* ---------------------------------------------------------------------
     상점 — 단품 / 3개 묶음 / 레벨업 상자 / 구역 상자
     --------------------------------------------------------------------- */
  shop: {
    items: [
      { id: 'hammer1',    kind: 'booster', key: 'hammer',    amount: 1, price: 120, name: '망치 1개',        tag: '단품' },
      { id: 'drill1',     kind: 'booster', key: 'drill',     amount: 1, price: 180, name: '드릴 1개',        tag: '단품' },
      { id: 'bomber1',    kind: 'booster', key: 'bomber',    amount: 1, price: 200, name: '폭탄 1개',        tag: '단품' },
      { id: 'magicHat1',  kind: 'booster', key: 'magicHat',  amount: 1, price: 260, name: '마법 모자 1개',   tag: '단품' },
      { id: 'swap1',      kind: 'booster', key: 'swap',      amount: 1, price: 160, name: '자유 교체 1개',   tag: 'NEW · 이동 수 0' },
      { id: 'lightning1', kind: 'booster', key: 'lightning', amount: 1, price: 240, name: '번개 지팡이 1개', tag: 'NEW · 8방향' },
      { id: 'prism1',     kind: 'booster', key: 'prism',     amount: 1, price: 280, name: '무지개 프리즘 1개', tag: 'NEW · 전기구 즉시' },
      { id: 'hourglass1', kind: 'booster', key: 'hourglass', amount: 1, price: 200, name: '시간 모래시계 1개', tag: 'NEW · 이동 +3' },
      { id: 'hammer3',    kind: 'booster', key: 'hammer',    amount: 3, price: 320, name: '망치 3개',        tag: '3개 묶음 · 11% 할인' },
      { id: 'drill3',     kind: 'booster', key: 'drill',     amount: 3, price: 480, name: '드릴 3개',        tag: '3개 묶음 · 11% 할인' },
      { id: 'bomber3',    kind: 'booster', key: 'bomber',    amount: 3, price: 540, name: '폭탄 3개',        tag: '3개 묶음 · 10% 할인' },
      { id: 'magicHat3',  kind: 'booster', key: 'magicHat',  amount: 3, price: 700, name: '마법 모자 3개',   tag: '3개 묶음 · 10% 할인' },
      { id: 'swap3',      kind: 'booster', key: 'swap',      amount: 3, price: 420, name: '자유 교체 3개',   tag: '3개 묶음 · 12% 할인' },
      { id: 'lightning3', kind: 'booster', key: 'lightning', amount: 3, price: 640, name: '번개 지팡이 3개', tag: '3개 묶음 · 11% 할인' },
      { id: 'prism3',     kind: 'booster', key: 'prism',     amount: 3, price: 740, name: '무지개 프리즘 3개', tag: '3개 묶음 · 12% 할인' },
      { id: 'hourglass3', kind: 'booster', key: 'hourglass', amount: 3, price: 520, name: '시간 모래시계 3개', tag: '3개 묶음 · 13% 할인' },
      { id: 'tacticPack', kind: 'pack',    amount: 1, price: 700, name: '전술 부스터 세트', tag: 'NEW 4종 각 1개 · 27% 할인',
        items: { swap: 1, lightning: 1, prism: 1, hourglass: 1 } },
      { id: 'startPack3', kind: 'booster', key: 'startRocket', amount: 3, price: 260, name: '시작 로켓 3개', tag: '3개 묶음' },
      { id: 'hammerToken',kind: 'hammer',  amount: 1, price: 120, name: '망치 토큰 1개', tag: '마을 복구용' },
      { id: 'hammerToken5',kind:'hammer',  amount: 5, price: 500, name: '망치 토큰 5개', tag: '마을 복구용 · 17% 할인' },
      { id: 'levelChest', kind: 'chest',   chest: 'level', price: 350, name: '레벨업 상자', tag: '부스터 2종 + 코인' },
      { id: 'districtChest', kind: 'chest', chest: 'district', price: 800, name: '구역 상자', tag: '부스터 4종 + 망치 토큰' },
      { id: 'livesRefill', kind: 'lives',  amount: 5, price: 400, name: '목숨 가득', tag: '즉시 5개 회복' },
    ],
  },

  /* ---------------------------------------------------------------------
     주간 블리츠 — 60초 점수 도전
     --------------------------------------------------------------------- */
  blitz: {
    mode: 'blitz60',            // Firestore 규칙과 맞춘 모드 이름(변경 금지)
    seconds: 60,                // 제한 시간
    colors: 6,                  // 색 수
    rows: 8,
    cols: 8,
    goalScore: 12000,           // 3성 목표(참고 표시)
    weekOffsetDays: 0,          // 주 시작 요일 보정(월요일 시작)
    reward: { xp: 30, coins: 60 },
  },

  /* ---------------------------------------------------------------------
     월드 해금 / 진행
     --------------------------------------------------------------------- */
  progression: {
    levelsPerWorld: 20,   // 4구역 × 5스테이지
    districtsPerWorld: 4,
    levelsPerDistrict: 5,
    tasksPerDistrict: 5,
    unlockNextWorldAtLevel: 5,  // 해당 월드 5번째 스테이지 클리어 시 다음 월드 해금
    taskLevelGate: 1,     // 복구 과제는 같은 구역 스테이지를 하나라도 깨면 열림
  },

  /* ---------------------------------------------------------------------
     Firebase — 기존 프로젝트(samsung-brick-breaker)를 그대로 재사용합니다.
     users/{uid} : 프로필(진행도·별·코인)
     blitzScores/{autoId} : 주간 블리츠 점수
     ※ hexa 블리츠의 scores 컬렉션은 건드리지 않습니다.
     --------------------------------------------------------------------- */
  firebase: {
    enabled: true,
    config: {
      apiKey: 'AIzaSyDa3IBi4cjEdpVG-8G-JVMPEIRY4nCjKoY',
      authDomain: 'samsung-brick-breaker.firebaseapp.com',
      databaseURL: 'https://samsung-brick-breaker-default-rtdb.asia-southeast1.firebasedatabase.app',
      projectId: 'samsung-brick-breaker',
      storageBucket: 'samsung-brick-breaker.firebasestorage.app',
      messagingSenderId: '542816731452',
      appId: '1:542816731452:web:8b5936181e76a4f9c39e39',
    },
    collectionUsers: 'users',
    collectionBlitz: 'blitzScores',
    syncDebounceMs: 2500,      // 진행도 저장 디바운스
    leaderboardLimit: 50,      // 랭킹 표시 인원
    roomCodeLength: 6,         // 방 코드 길이
    roomAlphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  },

  /* ---------------------------------------------------------------------
     UI / 접근성
     --------------------------------------------------------------------- */
  ui: {
    maxWidth: 480,          // 모바일 우선: 데스크톱에서는 480px 중앙 정렬
    toastMs: 2200,
    tileShapes: 6,          // 색약 대응: 6가지 모양
    nicknameMin: 2,
    nicknameMax: 12,
    profanity: ['시발', '씨발', '병신', '새끼', '좆', 'fuck', 'shit', 'bitch'],
  },

  audio: {
    masterVolume: 0.5,
    sfxVolume: 0.7,
    musicVolume: 0.28,
    bpm: 92,
  },

  /* 월드별 분위기(색감·음계) — 오디오와 지도 색에 함께 사용 */
  worlds: [
    { id: 1, name: '푸른 초원',  en: 'Emerald Meadow', hue: 145, scale: [0, 2, 4, 7, 9],  tempo: 96,  curse: '시든 풀과 잠든 마을' },
    { id: 2, name: '얼음 왕국',  en: 'Frost Kingdom',  hue: 200, scale: [0, 2, 3, 7, 10], tempo: 84,  curse: '얼어붙은 항구와 눈보라' },
    { id: 3, name: '불타는 사막', en: 'Scorched Desert', hue: 28,  scale: [0, 1, 5, 7, 8],  tempo: 104, curse: '타오르는 모래와 메마른 우물' },
    { id: 4, name: '수정 정글',  en: 'Crystal Jungle', hue: 95,  scale: [0, 2, 5, 7, 9],  tempo: 100, curse: '뒤엉킨 덩굴과 잠든 열매' },
    { id: 5, name: '그림자 성',  en: 'Shadow Castle',  hue: 268, scale: [0, 2, 3, 6, 8],  tempo: 78,  curse: '그림자 군주의 저주' },
  ],
};

/* 특수 보석 색(렌더링·UI 공통) */
export const PU_META = {
  rocket:  { name: '로켓',     color: '#ff9f43', icon: '🚀' },
  tnt:     { name: 'TNT',      color: '#ff5e57', icon: '🧨' },
  spinner: { name: '프로펠러', color: '#48dbfb', icon: '🌀' },
  electro: { name: '전기구',   color: '#c56cf0', icon: '⚡' },
};

/* 보석 색 정의 — 색 + 모양(색약 대응) + 이름 */
export const GEMS = [
  { name: '에메랄드', color: '#3ddc84', light: '#b8ffd9', dark: '#0d7a44', shape: 'circle' },
  { name: '사파이어', color: '#4d9dff', light: '#cfe4ff', dark: '#1a4f9e', shape: 'diamond' },
  { name: '루비',     color: '#ff5b7f', light: '#ffd3dd', dark: '#9d1c3d', shape: 'square' },
  { name: '앰버',     color: '#ffc93c', light: '#fff2c2', dark: '#a86f00', shape: 'triangle' },
  { name: '자수정',   color: '#b06cff', light: '#e9d7ff', dark: '#5a2b9c', shape: 'hexagon' },
  { name: '아쿠아',   color: '#2fe3d5', light: '#c6fff9', dark: '#0a7c74', shape: 'star' },
];

export const DISTRICTS = [
  { id: 1, name: '이슬마을',   en: 'Dew Village' },
  { id: 2, name: '바람언덕',   en: 'Windy Hill' },
  { id: 3, name: '꿀벌숲',     en: 'Bee Woods' },
  { id: 4, name: '루크의 초소', en: 'Luke’s Outpost' },
];

/* 월드별 4구역 이름 (지도 표기) */
export const WORLD_DISTRICTS = {
  1: ['이슬마을', '바람언덕', '꿀벌숲', '루크의 초소'],
  2: ['서리항구', '눈송이광장', '얼음동굴', '온천마을'],
  3: ['모래성', '오아시스', '향신료 시장', '잊힌 유적'],
  4: ['잎새마을', '덩굴다리', '열매농장', '수정신전'],
  5: ['잿빛 성문', '부서진 회랑', '그림자 예배당', '왕좌의 방'],
};

export default CFG;
