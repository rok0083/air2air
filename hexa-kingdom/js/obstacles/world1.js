/* 1월드 · 푸른 초원 — 덤불(1~2단), 나무 상자(2단), 풀밭 */
export const WORLD1_OBSTACLES = {
  bush: {
    name: '덤불', world: 1, hp: 1, blocksTile: true, material: 'leaf',
    desc: '인접 매치로 베어냅니다. 2단 덤불은 두 번 베어야 합니다.',
    // 2단은 레벨 JSON 에서 hp:2 로 지정
  },
  crate: {
    name: '나무 상자', world: 1, hp: 2, blocksTile: true, material: 'wood',
    desc: '단단한 상자. 인접 매치 두 번이면 부서집니다.',
  },
  grass: {
    name: '풀밭', world: 1, hp: 1, overlay: true, material: 'grass',
    desc: '보석을 덮은 마른 풀. 그 보석을 매치하면 사라집니다.',
  },
};
