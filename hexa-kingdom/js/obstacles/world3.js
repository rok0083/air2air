/* 3월드 · 불타는 사막 — 모래 번짐, 항아리, 선인장 */
export const WORLD3_OBSTACLES = {
  sand: {
    name: '모래', world: 3, hp: 1, overlay: true, material: 'sand',
    desc: '3수마다 옆 칸으로 번집니다. 매치로 걷어내세요.',
    spreader: true,
  },
  jar: {
    name: '항아리', world: 3, hp: 2, blocksTile: true, material: 'clay',
    desc: '부수면 특수 보석을 하나 뱉어냅니다.',
    reward: 'powerup',
    onBreak(obs, ctx, board) { board?.spawnRewardPowerup?.(obs.r, obs.c); },
  },
  cactus: {
    name: '선인장', world: 3, hp: 2, blocksTile: true, material: 'cactus',
    desc: '가시 때문에 매치 한 번에 1씩 닳습니다.',
  },
};
