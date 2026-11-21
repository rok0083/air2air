/* 4월드 · 수정 정글 — 덩굴, 열매 나무, 늪 */
export const WORLD4_OBSTACLES = {
  vine: {
    name: '덩굴', world: 4, hp: 2, overlay: true, material: 'vine',
    desc: '보석을 감은 덩굴. 두 번 매치하면 끊깁니다.',
  },
  fruitTree: {
    name: '열매 나무', world: 4, hp: 2, blocksTile: true, material: 'fruit',
    desc: '부수면 열매(드롭 아이템)를 떨어뜨립니다.',
    reward: 'item',
    onBreak(obs, ctx, board) { board?.spawnItemAt?.(obs.r, obs.c); },
  },
  swamp: {
    name: '늪', world: 4, hp: 1, overlay: true, material: 'mud',
    desc: '이 칸의 매치는 점수가 0.7배입니다. 매치로 메우세요.',
    slow: true,
  },
};
