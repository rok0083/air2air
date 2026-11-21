/* =========================================================================
   레벨 불러오기 — GitHub Pages 하위 경로(/air2air/hexa-kingdom/)에서도
   동작하도록 반드시 상대 경로('./levels/...')를 사용합니다.
   ========================================================================= */
import { CFG } from '../config.js';
import { BOSSES, levelName, isBossLevel } from './worldmap.js';

const cache = new Map();

export function levelPath(world, level) {
  return `./levels/world${world}/level${level}.json`;
}

export async function loadLevel(world, level) {
  const key = `${world}-${level}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const res = await fetch(levelPath(world, level), { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    data.name = data.name || levelName(world, level);
    if (isBossLevel(world, level) && !data.boss) data.boss = { ...BOSSES[world] };
    cache.set(key, data);
    return data;
  } catch (err) {
    // 레벨 파일이 아직 없으면(생성 전) 안전한 기본 레벨로 대체
    console.warn('[hexa-kingdom] 레벨 로드 실패:', key, err);
    const fallback = {
      id: `w${world}-${level}`, world, level,
      name: levelName(world, level),
      cols: CFG.board.cols, rows: CFG.board.rows,
      colors: 5, moves: 22, stars: [2500, 5000, 8000],
      goals: [{ type: 'collect', color: 0, count: 20 }],
      cells: [], voids: [], seed: 1000 + world * 100 + level,
      boss: isBossLevel(world, level) ? { ...BOSSES[world] } : null,
      fallback: true,
    };
    cache.set(key, fallback);
    return fallback;
  }
}

export function levelMeta(world, level) {
  return {
    id: `w${world}-${level}`,
    world, level,
    name: levelName(world, level),
    district: Math.floor((level - 1) / CFG.progression.levelsPerDistrict) + 1,
  };
}

export function starCount(score, thresholds = [2500, 5000, 8000]) {
  let stars = 1;
  if (score >= thresholds[1]) stars = 2;
  if (score >= thresholds[2]) stars = 3;
  return stars;
}
