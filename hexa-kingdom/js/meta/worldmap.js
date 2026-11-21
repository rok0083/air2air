/* =========================================================================
   월드 지도 데이터 — 5개 월드 × 4개 구역 × 5개 복구 과제 = 100개 과제
   각 과제를 완료하면 마을이 하나씩 되살아납니다(망치 토큰 사용).
   ========================================================================= */
import { WORLD_DISTRICTS } from '../config.js';

const TASK_COST = [1, 1, 2, 2, 3]; // 구역 내 과제 순서별 망치 토큰 비용

const TASK_NAMES = {
  1: [
    ['물레방아 복구', '빵집 굴뚝 세우기', '돌다리 놓기', '마을 우물 청소', '가로등 불 밝히기'],
    ['풍차 날개 달기', '목책 세우기', '방앗간 수리', '염소 우리 만들기', '바람종 달기'],
    ['벌통 돌려놓기', '과수원 가지치기', '꽃길 심기', '꿀 저장고 짓기', '나무다리 놓기'],
    ['망대 세우기', '깃발 게양대', '훈련장 정비', '말먹이 창고', '횃불탑 점화'],
  ],
  2: [
    ['부두 널빤지 갈기', '등대 불 켜기', '그물 창고 수리', '썰매길 다지기', '얼음배 진수'],
    ['눈 조각상 세우기', '얼음 분수 돌리기', '온돌 쉼터 짓기', '광장 눈 치우기', '종탑 종 달기'],
    ['얼음 통로 뚫기', '수정 등불 달기', '얼음 다리 놓기', '광부 오두막', '동굴 입구 봉인'],
    ['온천탕 파기', '나무 울타리', '탈의막 짓기', '증기관 잇기', '온천 여관 재건'],
  ],
  3: [
    ['성벽 쌓기', '우물 파기', '대상단 숙소', '그늘 천막', '모래시계 탑'],
    ['수로 내기', '야자수 심기', '물 저장고', '오아시스 정자', '개구리 연못'],
    ['시장 천막 펴기', '향신료 창고', '저울대 세우기', '노점 계단', '등불 줄 걸기'],
    ['봉인문 열기', '모래 털기', '벽화 복원', '제단 세우기', '사막의 성소'],
  ],
  4: [
    ['나무집 재건', '넝쿨 사다리', '버섯 등불', '잎새 학교', '빗물 저수조'],
    ['다리 엮기', '안전 로프', '이끼 길 닦기', '원숭이 통로', '나무 계단'],
    ['과수원 울타리', '관개 수로', '열매 건조대', '벌레잡이 꽃', '창고 지붕'],
    ['수정 제단', '빛의 창', '정글 제단 청소', '수호상 세우기', '정령의 샘'],
  ],
  5: [
    ['성문 수리', '사슬 끊기', '횃불 밝히기', '성문 초소', '그림자 봉인'],
    ['기둥 세우기', '유리창 복원', '갑옷 정리', '회랑 등불', '벽화 되살리기'],
    ['제단 정화', '촛대 밝히기', '종소리 되찾기', '성가대 계단', '빛의 창'],
    ['왕좌 닦기', '왕관 회수', '깃발 걸기', '왕의 창', '왕국 재건'],
  ],
};

const WORLD_META = [
  { id: 1, name: '푸른 초원', en: 'Emerald Meadow', curse: '시든 풀과 잠든 마을', hue: 145, desc: '따뜻한 초원의 마을들이 마법에 잠들었어요.' },
  { id: 2, name: '얼음 왕국', en: 'Frost Kingdom', curse: '얼어붙은 항구와 눈보라', hue: 200, desc: '영원한 겨울에 갇힌 항구를 깨워요.' },
  { id: 3, name: '불타는 사막', en: 'Scorched Desert', curse: '타오르는 모래와 메마른 우물', hue: 28, desc: '불꽃 저주에 그을린 사막을 식혀요.' },
  { id: 4, name: '수정 정글', en: 'Crystal Jungle', curse: '뒤엉킨 덩굴과 잠든 열매', hue: 95, desc: '수정빛 열매가 잠든 정글을 되살려요.' },
  { id: 5, name: '그림자 성', en: 'Shadow Castle', curse: '그림자 군주의 저주', hue: 268, desc: '모든 저주의 근원, 그림자 군주와 맞서요.' },
];

export const WORLDS = WORLD_META.map(w => ({
  ...w,
  districts: (WORLD_DISTRICTS[w.id] || []).map((dname, di) => ({
    id: w.id * 10 + (di + 1),
    index: di + 1,
    name: dname,
    tasks: (TASK_NAMES[w.id][di] || []).map((tname, ti) => ({
      id: `w${w.id}d${di + 1}t${ti + 1}`,
      name: tname,
      cost: TASK_COST[ti] ?? 1,
      coins: 30 + ti * 15,
      xp: 15 + ti * 8,
      build: ['mill', 'tower', 'bridge', 'well', 'lamp'][ti] || 'house',
    })),
  })),
}));

export const ALL_TASKS = WORLDS.flatMap(w => w.districts.flatMap(d => d.tasks));
export const TASK_BY_ID = Object.fromEntries(ALL_TASKS.map(t => [t.id, t]));

export function worldById(id) { return WORLDS.find(w => w.id === id) || WORLDS[0]; }
export function districtOf(worldId, districtIndex) {
  return worldById(worldId)?.districts.find(d => d.index === districtIndex) || null;
}

/* 스테이지 번호 ↔ 구역 */
export function districtIndexForLevel(level) {
  return Math.floor((level - 1) / 5) + 1;
}

/* 월드별 스테이지 이름 */
const LEVEL_NAMES = {
  1: ['초원 입구', '덤불의 속삭임', '이슬 맺힌 길', '나무 상자 창고', '풀밭 너머로',
      '물레방아 마을', '도토리 소동', '바람의 언덕', '덤불 미로', '상자 더미',
      '꿀벌의 정원', '풍차 날개', '초원의 심장', '메마른 개울', '루크의 훈련',
      '덤불 군락', '상자의 비밀', '초원의 수호자', '그림자 전조', '보스 · 슬라임 경비대장'],
  2: ['서리 입구', '얼음 장벽', '눈사람 마당', '고드름 동굴', '보스 · 눈보라 골렘'],
  3: ['모래 언덕', '항아리 창고', '선인장 길', '모래 폭풍', '보스 · 사막의 스핑크스'],
  4: ['정글 입구', '덩굴 덮인 길', '열매 나무숲', '늪의 속삭임', '보스 · 그림자 덩굴'],
  5: ['잿빛 성문', '무너진 회랑', '그림자 예배당', '왕좌로 가는 길', '보스 · 그림자 군주'],
};

export function levelName(world, level) {
  const arr = LEVEL_NAMES[world] || [];
  if (level === 20 && BOSSES[world]) return `보스 · ${BOSSES[world].name}`;
  if (arr[level - 1]) return arr[level - 1];
  const d = districtOf(world, districtIndexForLevel(level));
  return `${d ? d.name : '미지의 길'} ${((level - 1) % 5) + 1}번길`;
}

export const BOSSES = {
  1: { name: '슬라임 경비대장', hp: 140, summon: 'bush', summonEvery: 2, kind: 'slime' },
  2: { name: '눈보라 골렘', hp: 200, summon: 'icicle', summonEvery: 2, kind: 'golem' },
  3: { name: '사막의 스핑크스', hp: 240, summon: 'jar', summonEvery: 3, kind: 'sphinx' },
  4: { name: '그림자 덩굴', hp: 280, summon: 'vine', summonEvery: 2, kind: 'vine' },
  5: { name: '그림자 군주', hp: 360, summon: 'shadowStone', summonEvery: 2, kind: 'shadow' },
};

/* 보스: 각 월드의 마지막(20) + 샘플 구간(2~5월드의 5번째, 미니 보스) */
export function isBossLevel(world, level) {
  return !!BOSSES[world] && (level === 20 || (world > 1 && level === 5));
}
