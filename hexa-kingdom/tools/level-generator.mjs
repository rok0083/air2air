/* =========================================================================
   레벨 생성기 — 헥사 킹덤 (HEXA KINGDOM)
   -------------------------------------------------------------------------
   사용법(노드가 있을 때) :
     node tools/level-generator.mjs --world 1 --out levels      # 월드 1의 20개 생성
     node tools/level-generator.mjs --all --out levels          # 5월드 100개 생성
     node tools/level-generator.mjs --world 3 --level 7          # 한 개를 JSON으로 출력
   브라우저/검증 스크립트에서 :
     import { generateLevel, generateAll, validateLevel } from './tools/level-generator.mjs'

   모든 레벨은 시드 기반이라 같은 (world, level) 이면 항상 같은 JSON 이 나옵니다.
   배치 후 아래를 스스로 검사합니다.
     · 시작 보드에 즉시 매치가 없도록 색을 채움(게임 엔진과 같은 규칙)
     · 가능한 수가 최소 1개 이상
     · 막힌 칸이 보드의 35% 를 넘지 않음
   ========================================================================= */
import { levelName, BOSSES, worldById } from '../js/meta/worldmap.js';

const GEN_VERSION = '1.0.0';

/* ── 시드 난수 (게임 js/core/rng.js 와 같은 mulberry32) ─────────── */
function RNG(seed) {
  let s = seed >>> 0 || 1;
  return {
    next() {
      let t = (s += 0x6d2b79f5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(this.next() * n); },
    pick(a) { return a[this.int(a.length)]; },
    shuffled(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
  };
}

/* ── 월드별 테마 / 장애물 ────────────────────────────────────────── */
export const WORLD_THEMES = {
  1: { colors: [5, 5, 5, 6], obstacles: ['bush', 'crate', 'grass'], overlay: ['grass'], intro: ['bush', 'crate', 'grass'] },
  2: { colors: [5, 5, 6, 6], obstacles: ['ice', 'snowman', 'icicle'], overlay: ['ice'], intro: ['ice', 'snowman', 'icicle'] },
  3: { colors: [5, 6, 6, 6], obstacles: ['sand', 'jar', 'cactus'], overlay: ['sand'], intro: ['sand', 'jar', 'cactus'] },
  4: { colors: [5, 6, 6, 6], obstacles: ['vine', 'fruitTree', 'swamp'], overlay: ['vine', 'swamp'], intro: ['vine', 'fruitTree', 'swamp'] },
  5: { colors: [6, 6, 6, 6], obstacles: ['shadowRune', 'shadowStone'], overlay: ['shadowRune'], intro: ['shadowRune', 'shadowStone'] },
};

/* 월드 1 — 20개 큐레이션 설계(장애물·목표 도입 순서) */
const W1_BLUEPRINTS = [
  { goals: [{ t: 'collect', color: 0, count: 18 }], moves: 24, cells: [] },
  { goals: [{ t: 'collect', color: 0, count: 20 }], moves: 22, cells: [['bush', 2]] },
  { goals: [{ t: 'clear', obstacle: 'bush', count: 5 }, { t: 'collect', color: 1, count: 14 }], moves: 22, cells: [['bush', 6]] },
  { goals: [{ t: 'collect', color: 2, count: 22 }], moves: 24, cells: [['crate', 3]] },
  { goals: [{ t: 'clear', obstacle: 'crate', count: 3 }, { t: 'collect', color: 0, count: 16 }], moves: 24, cells: [['crate', 4], ['bush', 2]] },
  { goals: [{ t: 'drop', count: 2 }, { t: 'collect', color: 1, count: 16 }], moves: 24, cells: [['bush', 3]] },
  { goals: [{ t: 'collect', color: 3, count: 24 }], moves: 22, cells: [['bush', 4], ['crate', 1]] },
  { goals: [{ t: 'clear', obstacle: 'grass', count: 5 }, { t: 'collect', color: 0, count: 20 }], moves: 24, cells: [['grass', 6]] },
  { goals: [{ t: 'clear', obstacle: 'any', count: 7 }], moves: 24, cells: [['bush', 4], ['crate', 3]] },
  { goals: [{ t: 'drop', count: 3 }, { t: 'clear', obstacle: 'grass', count: 4 }], moves: 26, cells: [['grass', 6]] },
  { goals: [{ t: 'collect', color: 2, count: 20 }, { t: 'collect', color: 4, count: 20 }], moves: 24, cells: [['bush', 4], ['grass', 3]] },
  { goals: [{ t: 'clear', obstacle: 'crate', count: 4 }, { t: 'collect', color: 1, count: 18 }], moves: 26, cells: [['crate', 5], ['bush', 3]] },
  { goals: [{ t: 'collect', color: 3, count: 28 }], moves: 24, cells: [['crate', 3], ['grass', 4]] },
  { goals: [{ t: 'drop', count: 2 }, { t: 'clear', obstacle: 'bush', count: 6 }], moves: 26, cells: [['bush', 7]] },
  { goals: [{ t: 'collect', color: 4, count: 26 }, { t: 'clear', obstacle: 'any', count: 4 }], moves: 24, cells: [['crate', 3], ['bush', 3]] },
  { goals: [{ t: 'clear', obstacle: 'bush', count: 8 }], moves: 24, cells: [['bush', 9]] },
  { goals: [{ t: 'collect', color: 1, count: 24 }, { t: 'collect', color: 4, count: 24 }], moves: 26, cells: [['bush', 3], ['crate', 2], ['grass', 3]] },
  { goals: [{ t: 'clear', obstacle: 'any', count: 10 }], moves: 26, cells: [['crate', 4], ['bush', 5], ['grass', 3]] },
  { goals: [{ t: 'drop', count: 2 }, { t: 'collect', color: 5, count: 22 }], moves: 26, cells: [['bush', 4], ['crate', 3], ['grass', 2]] },
  { goals: [{ t: 'boss' }, { t: 'collect', color: 0, count: 20 }], moves: 30, cells: [['bush', 4]], boss: true },
];

/* 월드 2~5 — 각 월드 1~5 는 손수 설계(장애물 소개), 6~20 은 규칙 생성 */
const THEME_BLUEPRINTS = {
  2: [
    { goals: [{ t: 'collect', color: 1, count: 18 }], moves: 22, mix: [['ice', 4]] },
    { goals: [{ t: 'clear', obstacle: 'ice', count: 5 }, { t: 'collect', color: 0, count: 16 }], moves: 24, mix: [['ice', 7]] },
    { goals: [{ t: 'clear', obstacle: 'snowman', count: 3 }], moves: 24, mix: [['snowman', 3], ['ice', 3]] },
    { goals: [{ t: 'drop', count: 2 }, { t: 'clear', obstacle: 'icicle', count: 3 }], moves: 26, mix: [['icicle', 3], ['ice', 4]] },
    { goals: [{ t: 'boss' }], moves: 28, mix: [['ice', 4], ['snowman', 2]], boss: true },
  ],
  3: [
    { goals: [{ t: 'collect', color: 2, count: 20 }], moves: 22, mix: [['sand', 4]] },
    { goals: [{ t: 'clear', obstacle: 'jar', count: 2 }], moves: 24, mix: [['jar', 2], ['cactus', 2]] },
    { goals: [{ t: 'clear', obstacle: 'cactus', count: 3 }, { t: 'collect', color: 3, count: 18 }], moves: 24, mix: [['cactus', 4]] },
    { goals: [{ t: 'drop', count: 2 }, { t: 'clear', obstacle: 'sand', count: 6 }], moves: 26, mix: [['sand', 8]] },
    { goals: [{ t: 'boss' }], moves: 28, mix: [['jar', 3], ['cactus', 2]], boss: true },
  ],
  4: [
    { goals: [{ t: 'collect', color: 0, count: 22 }], moves: 22, mix: [['vine', 4]] },
    { goals: [{ t: 'clear', obstacle: 'fruitTree', count: 2 }, { t: 'drop', count: 2 }], moves: 26, mix: [['fruitTree', 2], ['vine', 3]] },
    { goals: [{ t: 'clear', obstacle: 'swamp', count: 5 }], moves: 24, mix: [['swamp', 6], ['vine', 2]] },
    { goals: [{ t: 'collect', color: 4, count: 26 }, { t: 'clear', obstacle: 'vine', count: 5 }], moves: 26, mix: [['vine', 6], ['swamp', 3]] },
    { goals: [{ t: 'boss' }], moves: 28, mix: [['vine', 4], ['fruitTree', 2]], boss: true },
  ],
  5: [
    { goals: [{ t: 'collect', color: 3, count: 22 }], moves: 22, mix: [['shadowRune', 4]] },
    { goals: [{ t: 'clear', obstacle: 'shadowStone', count: 3 }], moves: 24, mix: [['shadowStone', 3], ['shadowRune', 2]] },
    { goals: [{ t: 'clear', obstacle: 'shadowRune', count: 6 }], moves: 24, mix: [['shadowRune', 7]] },
    { goals: [{ t: 'drop', count: 2 }, { t: 'collect', color: 1, count: 20 }], moves: 26, mix: [['shadowStone', 3], ['shadowRune', 3]] },
    { goals: [{ t: 'boss' }], moves: 28, mix: [['shadowStone', 3], ['shadowRune', 3]], boss: true },
  ],
};

/* ── 장애물 배치 ────────────────────────────────────────────────── */
function placeCells(rng, rows, cols, specs, overlayTypes) {
  const used = new Set();
  const cells = [];
  const perTypeCounts = {};
  const target = [];
  for (const [type, count] of specs) {
    const isOverlay = overlayTypes.includes(type);
    for (let i = 0; i < count; i++) target.push({ type, isOverlay, hp: type === 'bush' && rng.next() < 0.3 ? 2 : undefined });
  }
  const order = rng.shuffled(target);
  for (const t of order) {
    let placed = false;
    for (let tries = 0; tries < 120 && !placed; tries++) {
      const r = t.isOverlay ? 1 + rng.int(rows - 2) : rng.int(rows);
      const c = rng.int(cols);
      const k = `${r},${c}`;
      if (used.has(k)) continue;
      // 한 열을 지나치게 막지 않는다
      const blockedInCol = cells.filter(x => x.c === c && !overlayTypes.includes(x.type)).length;
      if (!t.isOverlay && blockedInCol >= Math.max(2, Math.floor(rows * 0.3))) continue;
      used.add(k);
      cells.push({ r, c, type: t.type, ...(t.hp ? { hp: t.hp } : {}) });
      perTypeCounts[t.type] = (perTypeCounts[t.type] || 0) + 1;
      placed = true;
    }
  }
  return { cells, perTypeCounts, overlayTypes };
}

/* 시작 보드 색 배치 — 게임 엔진(Board.makeTile/safeColor)과 같은 규칙 */
function simulateColors(rng, rows, cols, colors, cells) {
  const blocked = new Set(cells.filter(c => !['grass', 'ice', 'sand', 'vine', 'swamp', 'shadowRune'].includes(c.type)).map(c => `${c.r},${c.c}`));
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  const pickSafe = (r, c) => {
    const bad = new Set();
    if (c >= 2 && grid[r][c - 1] !== null && grid[r][c - 1] === grid[r][c - 2]) bad.add(grid[r][c - 1]);
    if (r >= 2 && grid[r - 1][c] !== null && grid[r - 1][c] === grid[r - 2][c]) bad.add(grid[r - 1][c]);
    const opts = [];
    for (let i = 0; i < colors; i++) if (!bad.has(i)) opts.push(i);
    return opts.length ? opts[rng.int(opts.length)] : 0;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (blocked.has(`${r},${c}`)) continue;
      grid[r][c] = pickSafe(r, c);
    }
  }
  // 가능한 수 검사(같은 색 3개가 되는 교체가 있는지)
  let hasMove = false;
  const ok = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && grid[r][c] !== null;
  const matchAt = (r, c, col) => {
    let n = 1;
    for (let cc = c - 1; ok(r, cc) && grid[r][cc] === col; cc--) n++;
    for (let cc = c + 1; ok(r, cc) && grid[r][cc] === col; cc++) n++;
    if (n >= 3) return true;
    n = 1;
    for (let rr = r - 1; ok(rr, c) && grid[rr][c] === col; rr--) n++;
    for (let rr = r + 1; ok(rr, c) && grid[rr][c] === col; rr++) n++;
    return n >= 3;
  };
  outer: for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (!ok(r, c) || !ok(r2, c2) || grid[r][c] === grid[r2][c2]) continue;
        const a = grid[r][c], b = grid[r2][c2];
        grid[r][c] = b; grid[r2][c2] = a;
        const made = matchAt(r, c, b) || matchAt(r2, c2, a);
        grid[r][c] = a; grid[r2][c2] = b;
        if (made) { hasMove = true; break outer; }
      }
    }
  }
  const free = grid.flat().filter(v => v !== null).length;
  return { hasMove, free, total: rows * cols };
}

function buildGoals(specGoals, perTypeCounts, boss) {
  const goals = [];
  for (const g of specGoals) {
    if (g.t === 'collect') goals.push({ type: 'collect', color: g.color, count: g.count });
    else if (g.t === 'clear') {
      const available = g.obstacle === 'any'
        ? Object.values(perTypeCounts).reduce((a, b) => a + b, 0)
        : (perTypeCounts[g.obstacle] || 0);
      if (available <= 0) continue;
      goals.push({ type: 'clear', obstacle: g.obstacle || 'any', count: Math.min(g.count, available) });
    } else if (g.t === 'drop') goals.push({ type: 'drop', count: g.count, item: 'seed' });
    else if (g.t === 'boss' && boss) goals.push({ type: 'boss' });
  }
  if (!goals.length) goals.push({ type: 'collect', color: 0, count: 18 });
  return goals;
}

const COLLECT_GOAL_CACHE = {};

/* ── 메인 생성 ──────────────────────────────────────────────────── */
export function generateLevel(world, level, opts = {}) {
  const theme = WORLD_THEMES[world] || WORLD_THEMES[1];
  const worldMeta = worldById(world);
  const seed = opts.seed ?? (world * 10000 + level * 137 + 1103);
  const rng = RNG(seed);
  const rows = 8, cols = 8;
  const colors = theme.colors[Math.min(theme.colors.length - 1, Math.floor((level - 1) / 5))];
  const boss = !!opts.boss;
  const isBoss = boss || (level === 20) || (world > 1 && level === 5);

  let blueprint;
  if (world === 1 && W1_BLUEPRINTS[level - 1]) blueprint = W1_BLUEPRINTS[level - 1];
  else if (THEME_BLUEPRINTS[world]?.[level - 1]) blueprint = THEME_BLUEPRINTS[world][level - 1];
  else blueprint = proceduralBlueprint(world, level, rng);

  let mix = blueprint.mix;
  if (!mix) {
    // 큐레이션 월드1: cells 는 [type,count] 목록
    mix = (blueprint.cells || []).filter(c => c.length === 2).map(c => [c[0], c[1]]);
  }
  const { cells, perTypeCounts } = placeCells(rng, rows, cols, mix, theme.overlay);

  const bossCfg = isBoss ? { ...(BOSSES[world] || BOSSES[1]) } : null;
  if (bossCfg) {
    const isMini = world > 1 && level === 5;
    if (isMini) bossCfg.hp = Math.round(bossCfg.hp * 0.62);
    bossCfg.summonEvery = bossCfg.summonEvery || 2;
  }

  const goals = buildGoals(blueprint.goals, perTypeCounts, bossCfg);
  const moves = blueprint.moves ?? (22 + Math.floor(level / 4));
  const base = 2400 + level * 130 + cells.length * 160 + (bossCfg ? bossCfg.hp * 12 : 0);
  const stars = [round100(base), round100(base * 1.75), round100(base * 2.6)];

  const sim = simulateColors(RNG(seed + 7), rows, cols, colors, cells);

  const data = {
    id: `w${world}-${level}`,
    world,
    level,
    name: levelName(world, level),
    story: storyFor(world, level, goals),
    cols, rows, colors, moves, stars,
    goals,
    cells,
    voids: [],
    seed,
    boss: bossCfg,
    generator: { version: GEN_VERSION, seed, obstacles: cells.length, free: sim.free },
  };
  data.analysis = validateLevel(data, { sim });
  return data;
}

function proceduralBlueprint(world, level, rng) {
  const theme = WORLD_THEMES[world];
  const stage = Math.floor((level - 1) / 5); // 0..3
  const total = 3 + stage * 2 + Math.floor((level % 5) / 2);
  const mix = [];
  const primary = theme.obstacles[(level + stage) % theme.obstacles.length];
  const secondary = theme.obstacles[(level + stage + 1) % theme.obstacles.length];
  mix.push([primary, Math.max(2, Math.round(total * 0.6))]);
  if (level % 3 !== 0) mix.push([secondary, Math.max(1, total - Math.round(total * 0.6))]);
  const goalKinds = [(level + world) % 4, (level + world + 2) % 4];
  const goals = [];
  for (const k of goalKinds.slice(0, level % 5 === 0 ? 2 : 1)) {
    if (k === 0) goals.push({ t: 'collect', color: (level + world) % 6, count: 16 + stage * 4 });
    else if (k === 1) goals.push({ t: 'clear', obstacle: 'any', count: 4 + stage * 2 });
    else if (k === 2) goals.push({ t: 'drop', count: 2 + (stage >= 2 ? 1 : 0) });
    else goals.push({ t: 'clear', obstacle: primary, count: 3 + stage });
  }
  if (!goals.length) goals.push({ t: 'collect', color: 0, count: 18 });
  const isBoss = level === 20;
  if (isBoss) goals.push({ t: 'boss' });
  return { goals, moves: 22 + Math.floor(level / 5) + (isBoss ? 4 : 0), mix, boss: isBoss };
}

function round100(n) { return Math.round(n / 100) * 100; }

function storyFor(world, level, goals) {
  const w = worldById(world);
  const d = Math.floor((level - 1) / 5) + 1;
  if (level === 20 || (world > 1 && level === 5)) return `${w.name}의 끝, 그림자 군주의 부하가 기다린다.`;
  if (goals.some(g => g.type === 'boss')) return `${w.name}를 되찾을 마지막 싸움.`;
  if (goals.some(g => g.type === 'drop')) return '마법 씨앗을 바닥까지 떨어뜨려 마을을 되살려요.';
  if (goals.some(g => g.type === 'clear')) return '저주가 남긴 장애물을 걷어내요.';
  return `${w.name} ${d}구역의 기운을 모아요.`;
}

/* ── 자체 검증 ──────────────────────────────────────────────────── */
export function validateLevel(data, opts = {}) {
  const problems = [];
  if (!data.id || !data.world || !data.level) problems.push('id/world/level 누락');
  if (!data.goals?.length) problems.push('목표 없음');
  if (!data.moves || data.moves < 12) problems.push('이동 수 부족');
  if (!data.colors || data.colors < 4 || data.colors > 6) problems.push('색 수 범위 오류');
  if (!data.cells) problems.push('cells 없음');
  const blocked = (data.cells || []).filter(c => !['grass', 'ice', 'sand', 'vine', 'swamp', 'shadowRune'].includes(c.type));
  const blockedRatio = blocked.length / (data.rows * data.cols);
  if (blockedRatio > 0.35) problems.push('막힌 칸 35% 초과');
  if (data.goals.some(g => g.type === 'boss') && !data.boss) problems.push('보스 목표인데 보스 없음');
  const sim = opts.sim || simulateColors(RNG((data.seed || 1) + 7), data.rows, data.cols, data.colors, data.cells);
  if (!sim.hasMove) problems.push('가능한 수 없음');
  if (sim.free < data.rows * data.cols * 0.6) problems.push('빈 칸 부족');
  return { validated: problems.length === 0, problems, free: sim.free, hasMove: sim.hasMove, blockedRatio: +blockedRatio.toFixed(2) };
}

export function generateAll(opts = {}) {
  const out = [];
  for (let world = 1; world <= 5; world++) {
    for (let level = 1; level <= (opts.perWorld || 20); level++) {
      out.push(generateLevel(world, level));
    }
  }
  return out;
}

/* ── CLI (node 에서만 실행) ─────────────────────────────────────── */
const isNode = typeof process !== 'undefined' && process.versions?.node;
if (isNode && typeof process.argv !== 'undefined' && /level-generator\.mjs$/.test(process.argv[1] || '')) {
  const args = process.argv.slice(2);
  const get = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  const outDir = get('out', 'levels');
  const perWorld = Number(get('perWorld', 20));
  const worldArg = get('world');
  const levelArg = get('level');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  if (worldArg && levelArg) {
    const data = generateLevel(Number(worldArg), Number(levelArg));
    console.log(JSON.stringify(data, null, 2));
  } else {
    const worlds = worldArg ? [Number(worldArg)] : [1, 2, 3, 4, 5];
    for (const w of worlds) {
      for (let l = 1; l <= perWorld; l++) {
        const data = generateLevel(w, l);
        const file = join(outDir, `world${w}`, `level${l}.json`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(data, null, 2) + '\n');
        if (!data.analysis.validated) console.error('INVALID', file, data.analysis.problems);
      }
      console.log(`world${w}: ${perWorld} levels -> ${outDir}/world${w}/`);
    }
  }
}
