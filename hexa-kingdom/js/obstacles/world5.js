/* 5월드 · 그림자 성 — 그림자 돌, 그림자 룬 (+ 보스가 매 턴 새로 소환) */
export const WORLD5_OBSTACLES = {
  shadowStone: {
    name: '그림자 돌', world: 5, hp: 2, blocksTile: true, material: 'shadow',
    desc: '그림자 군주의 마법석. 부수면 보스에게 피해를 줍니다.',
    onBreak(obs, ctx, board) { board?.damageBoss?.(2, 'obstacle'); },
  },
  shadowRune: {
    name: '그림자 룬', world: 5, hp: 2, overlay: true, material: 'shadow',
    desc: '덮인 보석을 매치하면 룬이 흩어집니다.',
  },
};
