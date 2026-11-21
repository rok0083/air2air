/* =========================================================================
   levels.js — 레벨 데이터 로딩·캐시·난이도 표시
   levels/area{N}/level{M}.json (모든 경로 상대 경로)
   ========================================================================= */
import { CFG } from '../config.js';

const cache = new Map();

export function levelPath(area, n) { return `./levels/area${area}/level${n}.json`; }

export function areaOf(levelId) {
  return Math.min(CFG.areas, Math.floor((levelId - 1) / CFG.levelsPerArea) + 1);
}
export function localOf(levelId) {
  return ((levelId - 1) % CFG.levelsPerArea) + 1;
}

export async function loadLevel(levelId) {
  const area = areaOf(levelId), n = localOf(levelId);
  const key = `${area}-${n}`;
  if (cache.has(key)) return cache.get(key);
  let data = null;
  try {
    const res = await fetch(levelPath(area, n), { cache: 'force-cache' });
    if (res.ok) data = await res.json();
  } catch (e) { /* 오프라인 */ }
  if (!data) {
    data = fallbackLevel(area, n);
    console.warn('[castle-pop] 레벨 파일을 불러오지 못해 기본 레벨을 사용합니다', key);
  }
  data.area = area;
  data.level = n;
  data.id = levelId;
  cache.set(key, data);
  return data;
}

/* 파일을 못 읽는 경우(오프라인 첫 실행)의 안전한 기본 레벨 */
function fallbackLevel(area, n) {
  const obstacles = [];
  for (let y = 5; y < 8; y++) for (let x = 0; x < 9; x++) obstacles.push({ type: 'box', x, y, hp: 1 });
  return {
    moves: 22, colors: 5, cols: 9, rows: 8,
    difficulty: n % 10 === 0 ? 'veryhard' : n % 6 === 0 ? 'hard' : 'normal',
    goals: [{ type: 'box', count: obstacles.length }],
    obstacles, drops: 3, seed: area * 100 + n,
  };
}

export function difficultyOf(level) {
  return CFG.difficulty[level.difficulty] || CFG.difficulty.normal;
}

export function totalLevels() { return CFG.areas * CFG.levelsPerArea; }
