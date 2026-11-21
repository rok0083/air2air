/* =========================================================================
   CASTLE POP — 모든 수치의 단일 출처
   -------------------------------------------------------------------------
   이 파일의 값만 바꾸면 밸런스·연출 속도·경제·이벤트 일정이 함께 바뀝니다.
   (레벨 데이터는 levels/*.json — 이동 수/목표/장애물 배치는 레벨 파일 소관)
   ========================================================================= */

export const CFG = {
  version: '1.0.0',
  title: 'CASTLE POP',
  titleKo: '캐슬 팝',

  /* ---------------------------------------------------------------------
     보드 기본값 — 레벨 JSON 이 개별 지정하지 않았을 때 쓰는 값
     --------------------------------------------------------------------- */
  board: {
    cols: 9,                  // 기본 가로 9칸
    rows: 8,                  // 기본 세로 8칸 (레벨에 따라 최대 9×10)
    maxCols: 9,
    maxRows: 10,
    colorsDefault: 5,         // 1구역 초반은 레벨 JSON 이 4색으로 낮춘다
    gemScale: 0.90,           // 조각은 칸의 90% 크기
    spacing: 1.0,             // 칸 간격 계수(1.0 = 딱 맞춤)
    boardRadius: 18,
    frameColor: '#e2c477',
    boardColorTop: '#dfe4fb', // 옅은 라벤더 블루
    boardColorBottom: '#cfd7f6',
    gridLine: 'rgba(120,132,190,0.20)',
    hintDelay: 5000,          // 5초 입력이 없으면 힌트
  },

  /* 조각 색 — 색과 실루엣이 모두 다른 5종 (오리지널 문양) */
  colors: [
    { key: 'red',    main: '#ff4d6d', dark: '#c1123a', light: '#ffb3c2', shape: 'heart',    name: '하트 루비' },
    { key: 'blue',   main: '#3fa9ff', dark: '#0b5fb0', light: '#bfe4ff', shape: 'drop',     name: '물방울 사파이어' },
    { key: 'green',  main: '#3fd47a', dark: '#127a41', light: '#b6f7cf', shape: 'clover',   name: '네잎 클로버' },
    { key: 'yellow', main: '#ffd23f', dark: '#b07b00', light: '#fff0a8', shape: 'star',     name: '별 토파즈' },
    { key: 'purple', main: '#b46bff', dark: '#6a1bb5', light: '#e6ccff', shape: 'crescent', name: '초승달 자수정' },
  ],

  /* ---------------------------------------------------------------------
     속도 — 조작감 (14번 항목)
     --------------------------------------------------------------------- */
  speeds: {
    swap: 110,                // 교환 110ms
    swapBack: 110,            // 무효 교환 되돌림
    clear: 130,               // 제거 130ms
    fallPerCell: 60,          // 낙하 칸당 60ms(가속도 기반)
    fallMin: 90,
    fallMax: 420,
    spawnDrop: 140,           // 새 조각이 솟아날 때
    cascadeSpeedUp: 0.88,     // 연쇄가 길어질수록 간격을 조금씩 줄인다
    cascadeSpeedUpCap: 0.55,
    landingBounce: 90,
    powerupBeam: 260,
    comboSlowMo: 220,         // 조합 발동 슬로모션
    screenTransition: 520,    // 금색 커튼
    levelEnter: 500,          // 레벨 진입 0.5초 이내
    hintPulse: 900,
    swipeThreshold: 0.25,     // 칸 크기의 25%만 움직여도 인식
    tapThreshold: 0.18,       // 탭 판정
    finaleStep: 190,          // 피날레 로켓/TNT 한 발 간격
    idleSparkle: 3200,        // 대기 중 광택이 스치는 주기
  },

  /* ---------------------------------------------------------------------
     파워업 정의
     --------------------------------------------------------------------- */
  powerups: {
    rocket:    { name: '로켓',       radius: 0,    desc: '한 줄을 지웁니다' },
    tnt:       { name: 'TNT',        radius: 2,    desc: '주변 5×5를 폭발시킵니다' },
    propeller: { name: '프로펠러',   radius: 1,    desc: '상하좌우 4칸을 지우고 목표로 날아갑니다' },
    light:     { name: '빛구슬',     radius: 0,    desc: '같은 색 조각을 모두 지웁니다' },
  },
  combo: {
    tntTntRadius: 4,          // 9×9
    rocketTntLines: 3,        // 가로 3줄 + 세로 3줄
    propellerCount: 3,        // 프로펠러+프로펠러 = 3개 출격
    lightOrbConvertMin: 4,    // 빛구슬+파워업: 가장 많은 색이 파워업으로 변환
  },

  /* ---------------------------------------------------------------------
     부스터 — 이동 수를 쓰지 않는다
     --------------------------------------------------------------------- */
  boosters: {
    order: ['hammer', 'arrow', 'cannon', 'jester', 'lightning', 'prism', 'glove', 'hourglass'],
    defs: {
      hammer:    { name: '임금의 망치',   short: '망치',   icon: 'hammer',    price: 250, tray: true,  target: 'cell' },
      arrow:     { name: '화살',          short: '화살',   icon: 'arrow',     price: 300, tray: true,  target: 'cell' },
      cannon:    { name: '대포',          short: '대포',   icon: 'cannon',    price: 300, tray: true,  target: 'cell' },
      jester:    { name: '광대 모자',     short: '모자',   icon: 'jester',    price: 200, tray: true,  target: 'none' },
      lightning: { name: '번개 지팡이',   short: '번개',   icon: 'lightning', price: 350, tray: false, target: 'none' },
      prism:     { name: '무지개 프리즘', short: '프리즘', icon: 'prism',     price: 350, tray: false, target: 'cell' },
      glove:     { name: '자유 교체 글러브', short: '글러브', icon: 'glove',  price: 400, tray: false, target: 'cell' },
      hourglass: { name: '모래시계',      short: '모래시계', icon: 'hourglass', price: 300, tray: false, target: 'none' },
    },
    starterCount: 3,          // 시작 선물: 모든 부스터 3개
    lightningTargets: 10,     // 가까운 10곳
    hourglassMoves: 3,
  },
  preBoosters: {
    order: ['rocket', 'tnt', 'light'],
    maxPick: 3,
  },

  /* 보너스 드롭 — 보드에 가끔 등장, 매치하면 획득 */
  drops: {
    types: ['coin', 'moves', 'star', 'gift'],
    weights: { coin: 46, moves: 20, star: 22, gift: 12 },
    perLevelMin: 2, perLevelMax: 4,
    coinValue: 30,
    movesValue: 2,
    starHits: 3,
  },

  /* ---------------------------------------------------------------------
     장애물 — hp / size / blocksFall / onAdjacentMatch / onPowerupHit / onTurnEnd
     --------------------------------------------------------------------- */
  obstacles: {
    box:       { name: '나무 상자',   hp: 1, blocksFall: true,  adjacent: true,  powerup: true,  material: 'wood',  goal: true,  cracks: 4 },
    colorBox:  { name: '색 상자',     hp: 1, blocksFall: true,  adjacent: true,  powerup: true,  material: 'wood',  goal: true,  colorOnly: true },
    grass:     { name: '풀밭',        hp: 1, blocksFall: false, adjacent: true,  powerup: true,  material: 'leaf',  goal: true },
    mailbox:   { name: '우체통',      hp: 2, blocksFall: true,  adjacent: true,  powerup: true,  material: 'wood',  goal: true },
    vase:      { name: '꽃병',        hp: 2, blocksFall: true,  adjacent: true,  powerup: true,  material: 'glass', goal: true },
    chain:     { name: '사슬',        hp: 1, blocksFall: false, adjacent: true,  powerup: true,  material: 'metal', goal: true, locks: true },
    ice:       { name: '얼음',        hp: 2, blocksFall: false, adjacent: true,  powerup: true,  material: 'ice',   goal: true, locks: true },
    birdNest:  { name: '새 둥지',     hp: 2, blocksFall: true,  adjacent: true,  powerup: true,  material: 'wood',  goal: true },
    honey:     { name: '꿀',          hp: 1, blocksFall: false, adjacent: true,  powerup: true,  material: 'goo',   goal: true, spreads: true },
    safe:      { name: '금고',        hp: 3, blocksFall: true,  adjacent: true,  powerup: true,  material: 'metal', goal: true, needsKey: true },
    curtain:   { name: '커튼',        hp: 1, blocksFall: false, adjacent: false, powerup: true,  material: 'cloth', goal: true, hides: true },
  },
  honeySpreadTurns: 2,        // 꿀은 두 턴마다 한 칸씩 번진다
  obstacleIntro: {
    box: '옆에서 조각을 맞추면 한 겹씩 깨져요. 파워업도 통합니다.',
    colorBox: '같은 색 조각을 붙여서 맞춰야만 깨져요.',
    grass: '그 칸에서 매치하면 풀이 베어져요.',
    mailbox: '편지를 모아 우체통을 비워요.',
    vase: '두 번 맞추면 꽃병이 깨져요.',
    chain: '사슬에 묶인 조각은 움직이지 못해요. 옆에서 맞추세요.',
    ice: '얼음을 두 번 깨면 조각이 풀려요.',
    birdNest: '둥지를 깨면 아기 새가 날아가요.',
    honey: '꿀은 매 턴 번져요. 빨리 지우세요.',
    safe: '열쇠를 모으면 금고가 열려요.',
    curtain: '커튼이 한 줄을 가려요. 그 줄에서 맞추면 걷혀요.',
  },

  /* ---------------------------------------------------------------------
     목숨 · 경제 · 보상
     --------------------------------------------------------------------- */
  lives: {
    max: 10,
    regenMs: 10 * 60 * 1000,       // 10분에 1개
    freeRefillsPerDay: 3,          // 하루 3회 무료 전체 충전
    refillCost: 300,               // 코인 전체 충전
    failCost: 1,                   // 실패/중도 포기 시 1개
    friendRequestCooldownMs: 30 * 60 * 1000,
  },
  economy: {
    startCoins: 2000,             // 첫 실행 선물 코인
    levelClearBase: 60,           // 기본 클리어 코인
    perRemainingMove: 25,         // 피날레에서 남은 이동 1개당 코인
    coinDropValue: 30,
    continueCost: 900,            // +5 이동 이어하기
    continueMoves: 5,
    continueMax: 1,               // 한 레벨에서 한 번만
    hardRewardMultiplier: 2,      // 어려움/매우 어려움 2배
    chestEveryLevels: 10,
    chestCoins: 500,
    chestBoosters: 2,
    areaChestCoins: 1500,
    unlimitedLivesMs: 30 * 60 * 1000,
  },
  reward: {
    dailyCycleDays: 7,
    daily: [
      { coins: 150, booster: null },
      { coins: 250, booster: 'hammer' },
      { coins: 300, booster: null },
      { coins: 400, booster: 'arrow' },
      { coins: 500, booster: null },
      { coins: 700, booster: 'jester' },
      { coins: 1200, booster: 'lightning' },
    ],
    rouletteDailyFree: 1,
    roulettePrize: [
      { kind: 'coins', amount: 100, weight: 30 },
      { kind: 'coins', amount: 300, weight: 22 },
      { kind: 'booster', booster: 'hammer', weight: 16 },
      { kind: 'booster', booster: 'jester', weight: 12 },
      { kind: 'lives', amount: 3, weight: 12 },
      { kind: 'coins', amount: 1000, weight: 6 },
      { kind: 'unlimited', minutes: 15, weight: 2 },
    ],
    streak: [
      { at: 1, boosters: ['rocket'] },
      { at: 2, boosters: ['rocket', 'tnt'] },
      { at: 3, boosters: ['rocket', 'tnt', 'light'] },
      { at: 10, boosters: ['rocket', 'tnt', 'light'], superLight: true },
    ],
  },

  /* ---------------------------------------------------------------------
     난이도 3단계 (도장·배경 색)
     --------------------------------------------------------------------- */
  difficulty: {
    normal:    { name: '보통',     clearRate: [0.70, 0.85], color: '#3fd47a', ring: '#1f9c56', moveBonus: 0 },
    hard:      { name: '어려움',   clearRate: [0.40, 0.55], color: '#b46bff', ring: '#6a1bb5', moveBonus: 0 },
    veryhard:  { name: '매우 어려움', clearRate: [0.25, 0.35], color: '#ff5a5a', ring: '#b31b1b', moveBonus: 0 },
  },
  levelsPerArea: 20,
  areas: 5,
  hardLevelPattern: { every: 6, offset: 4 },     // 5~7레벨마다 어려운 레벨

  /* ---------------------------------------------------------------------
     구역(성) — 과제를 마치면 일러스트가 눈앞에서 바뀐다
     --------------------------------------------------------------------- */
  areaDefs: [
    {
      id: 1, name: '새벽 정원 성', sky: ['#8fd3ff', '#dff3ff'], grass: ['#7ed957', '#3fa34d'],
      stone: '#cfc3ae', flag: '#ff4d6d', accent: '#ffd23f',
      tasks: [
        { key: 'fountain', name: '분수 고치기', stars: 1, icon: 'fountain' },
        { key: 'rug',      name: '융단 깔기',   stars: 1, icon: 'rug' },
        { key: 'chandelier', name: '샹들리에 달기', stars: 2, icon: 'chandelier' },
        { key: 'gate',     name: '성문 닦기',   stars: 1, icon: 'gate' },
        { key: 'garden',   name: '정원 가꾸기', stars: 2, icon: 'garden' },
        { key: 'flag',     name: '깃발 세우기', stars: 1, icon: 'flag' },
        { key: 'throne',   name: '왕좌 되살리기', stars: 3, icon: 'throne' },
      ],
    },
    {
      id: 2, name: '호수 성', sky: ['#7fc9ff', '#e6f7ff'], grass: ['#69d6a8', '#25876a'],
      stone: '#c3d4e2', flag: '#3fa9ff', accent: '#8ef0ff',
      tasks: [
        { key: 'bridge',  name: '다리 놓기',     stars: 1, icon: 'bridge' },
        { key: 'boat',    name: '보트 띄우기',   stars: 1, icon: 'boat' },
        { key: 'lamp',    name: '호수 등불 켜기', stars: 2, icon: 'lamp' },
        { key: 'pier',    name: '부두 세우기',   stars: 2, icon: 'pier' },
        { key: 'fish',    name: '물고기 풀기',   stars: 1, icon: 'fish' },
        { key: 'window',  name: '유리창 닦기',   stars: 2, icon: 'window' },
        { key: 'terrace', name: '테라스 꾸미기', stars: 3, icon: 'terrace' },
      ],
    },
    {
      id: 3, name: '사막 성', sky: ['#ffd9a0', '#fff4dd'], grass: ['#f4d58a', '#c99a4b'],
      stone: '#e4cfa8', flag: '#ff8a3d', accent: '#ffd23f',
      tasks: [
        { key: 'carpet',  name: '붉은 융단 펴기', stars: 1, icon: 'carpet' },
        { key: 'palm',    name: '야자수 심기',   stars: 1, icon: 'palm' },
        { key: 'well',    name: '우물 파기',     stars: 2, icon: 'well' },
        { key: 'market',  name: '시장 열기',     stars: 2, icon: 'market' },
        { key: 'dome',    name: '돔 장식하기',   stars: 2, icon: 'dome' },
        { key: 'fire',    name: '모닥불 피우기', stars: 1, icon: 'fire' },
        { key: 'tower',   name: '탑 올리기',     stars: 3, icon: 'tower' },
      ],
    },
    {
      id: 4, name: '서리 성', sky: ['#bfe6ff', '#f2fbff'], grass: ['#dff3ff', '#9cc9e8'],
      stone: '#dbe8f5', flag: '#6f8bff', accent: '#bfe4ff',
      tasks: [
        { key: 'iceFountain', name: '얼음 분수 녹이기', stars: 1, icon: 'fountain' },
        { key: 'fireplace',   name: '벽난로 피우기',   stars: 2, icon: 'fireplace' },
        { key: 'iceWindow',   name: '서리 유리 닦기',  stars: 1, icon: 'window' },
        { key: 'tree',        name: '소나무 장식하기', stars: 2, icon: 'tree' },
        { key: 'sled',        name: '썰매 꺼내기',     stars: 1, icon: 'sled' },
        { key: 'chandelier',  name: '얼음 샹들리에',   stars: 2, icon: 'chandelier' },
        { key: 'throne',      name: '왕좌 데우기',     stars: 3, icon: 'throne' },
      ],
    },
    {
      id: 5, name: '무지개 왕성', sky: ['#a8d8ff', '#ffe9f7'], grass: ['#8ff0b6', '#35a86e'],
      stone: '#e8dcff', flag: '#ff6fd8', accent: '#ffe066',
      tasks: [
        { key: 'rainbow',  name: '무지개 세우기',   stars: 2, icon: 'rainbow' },
        { key: 'balloon',  name: '열기구 띄우기',   stars: 1, icon: 'balloon' },
        { key: 'fountain', name: '무지개 분수',     stars: 1, icon: 'fountain' },
        { key: 'garden',   name: '꽃길 만들기',     stars: 2, icon: 'garden' },
        { key: 'throne',   name: '왕좌 완성하기',   stars: 3, icon: 'throne' },
        { key: 'banner',   name: '왕실 깃발 달기',  stars: 1, icon: 'flag' },
        { key: 'crown',    name: '왕관 걸기',       stars: 3, icon: 'crown' },
      ],
    },
  ],

  /* ---------------------------------------------------------------------
     이벤트·미니게임 일정 (config 일정표에 따라 번갈아 열린다)
     --------------------------------------------------------------------- */
  events: {
    rotation: ['kingRescue', 'lightningRush', 'skyRace', 'propellerFestival', 'coinRush'],
    changeEveryDays: 3,        // 3일마다 다음 이벤트로 교체
    kingRescue: { seconds: 40, rewardCoins: 800, rewardBoosters: ['lightning'], levelsEvery: 10 },
    coinRush:   { moves: 14, coinPerTile: 40, rewardCoins: 600 },
    lightningRush: { seconds: 60, weekLeaderboard: true, rewardCoins: 900, minComboMul: 1 },
    skyRace:    { targets: 15, players: 5, rewardCoins: 1200, tickMs: 900 },
    propellerFestival: { days: 5, rewardCoins: 700, perPropeller: 1 },
  },

  /* ---------------------------------------------------------------------
     Firebase — 기존 samsung-brick-breaker 프로젝트를 그대로 쓰되
     Castle Pop 은 cp_ 접두사 컬렉션만 사용한다 (hexa/hexa-kingdom 무수정)
     --------------------------------------------------------------------- */
  firebase: {
    enabled: true,
    config: {
      apiKey: 'AIzaSyDa3IBi4cjEdpVG-8G-JVMPEIRY4nCjKoY',
      authDomain: 'samsung-brick-breaker.firebaseapp.com',
      projectId: 'samsung-brick-breaker',
      storageBucket: 'samsung-brick-breaker.firebasestorage.app',
      messagingSenderId: '542816731452',
      appId: '1:542816731452:web:8b5936181e76a4f9c39e39',
    },
    collections: {
      users: 'cp_users',
      leaderboard: 'cp_leaderboard',
      rooms: 'cp_rooms',
      gifts: 'cp_gifts',
      races: 'cp_races',
      rush: 'cp_rush',
    },
    syncDebounceMs: 2000,
    leaderboardLimit: 100,
    roomCodeLength: 6,
    roomAlphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  },

  /* ---------------------------------------------------------------------
     음향
     --------------------------------------------------------------------- */
  audio: {
    musicVolume: 0.32,
    sfxVolume: 0.55,
    tensionMoves: 5,           // 남은 이동 5 이하 → 템포 업
    tensionTempo: 1.18,
    bpm: { home: 84, level: 112, rush: 138 },
  },

  ui: {
    hudHeightRatio: 0.22,      // 상단 HUD 는 화면 높이의 약 22%
    maxDesktopWidth: 480,
    callouts: [
      { at: 2, text: 'NICE!' },
      { at: 3, text: 'GREAT!' },
      { at: 4, text: 'AMAZING!' },
      { at: 5, text: 'UNBELIEVABLE!' },
    ],
    reduceEffectsDefault: false,
  },

  debug: {
    assertEmptyCells: true,    // 개발용: 빈 칸 0 검증
  },
};

export const COLOR_KEYS = CFG.colors.map(c => c.key);

export function colorIndex(key) {
  const i = CFG.colors.findIndex(c => c.key === key);
  return i < 0 ? 0 : i;
}
