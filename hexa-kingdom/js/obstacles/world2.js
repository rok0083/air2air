/* 2월드 · 얼음 왕국 — 얼음 블록(2단), 눈사람(3단), 고드름 */
export const WORLD2_OBSTACLES = {
  ice: {
    name: '얼음 블록', world: 2, hp: 2, overlay: true, material: 'ice',
    desc: '보석을 얼려 둡니다. 그 보석이 매치될 때마다 한 겹씩 깨집니다.',
  },
  snowman: {
    name: '눈사람', world: 2, hp: 3, blocksTile: true, material: 'snow',
    desc: '3단 눈사람. 인접 매치 세 번에 녹습니다.',
  },
  icicle: {
    name: '고드름', world: 2, hp: 2, blocksTile: true, material: 'ice',
    desc: '천장에 매달린 고드름. 턴이 끝날 때 아래 칸으로 떨어지기도 합니다.',
    faller: true,
  },
};
