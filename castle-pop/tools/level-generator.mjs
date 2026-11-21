#!/usr/bin/env node
/* =========================================================================
   레벨 생성기 — CASTLE POP
   사용:
     node tools/level-generator.mjs --all            # 100개 생성(levels/area1~5)
     node tools/level-generator.mjs --area 2         # 한 구역만
     node tools/level-generator.mjs --area 1 --level 3 --print
   · 1구역 1~20은 초반 안내 순서를 지키는 손설계 패턴
   · 2~5구역은 구역 팔레트(장애물)로 20개씩 생성
   · 난이도: 6레벨마다 어려움, 10의 배수·구역 마지막은 매우 어려움
   ========================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export function makeRng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

/* 구역별 장애물 팔레트 */
const PALETTES = {
  1: ['box', 'grass', 'chain', 'colorBox', 'mailbox'],
  2: ['box', 'ice', 'vase', 'birdNest', 'colorBox'],
  3: ['box', 'honey', 'vase', 'mailbox', 'safe'],
  4: ['box', 'ice', 'chain', 'curtain', 'colorBox'],
  5: ['box', 'colorBox', 'ice', 'birdNest', 'honey', 'curtain', 'vase'],
};

/* ---------- 패턴들 : 장애물 배치를 돌려준다 ---------- */
function crateWall(rng, hpMax = 1, rows = 3, cols = 9, r = 8) {
  const out = [];
  for (let y = r - rows; y < r; y++) {
    for (let x = 0; x < cols; x++) {
      if (rng() < 0.14) continue;
      out.push({ type: 'box', x, y, hp: 1 + Math.floor(rng() * hpMax) });
    }
  }
  return out;
}

function crateStairs(rng, cols = 9, rows = 8) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    for (let y = rows - 1 - i; y < rows; y++) {
      for (const x of [i + 1, i + 2]) {
        if (x < cols && y >= 0 && rng() < 0.9) out.push({ type: 'box', x, y, hp: 1 });
      }
    }
  }
  return out;
}

function crateIslands(rng, cols = 9, rows = 8) {
  const out = [];
  const spots = [[1, 5], [4, 6], [7, 5], [2, 3], [6, 3]];
  for (const [sx, sy] of spots) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      if (rng() < 0.2) continue;
      const x = sx + dx, y = sy + dy;
      if (x < cols && y < rows) out.push({ type: 'box', x, y, hp: 1 + Math.floor(rng() * 2) });
    }
  }
  return out;
}

function colorBoxes(rng, cols = 9, n = 2, size = 2, hp = 2) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const w = size, h = size;
    const x = 1 + Math.floor(rng() * (cols - w - 2));
    const y = 2 + Math.floor(rng() * 4);
    const color = COLORS[Math.floor(rng() * 4)];
    out.push({ type: 'colorBox', x, y, w, h, hp, color });
  }
  return out;
}

function grassField(rng, cols = 9, rows = 8, n = 14) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 300) {
    const x = Math.floor(rng() * cols), y = 2 + Math.floor(rng() * (rows - 2));
    if (out.some(o => o.x === x && o.y === y)) continue;
    out.push({ type: 'grass', x, y, hp: 1 });
  }
  return out;
}

function chains(rng, cols = 9, rows = 8, n = 8) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 300) {
    const x = Math.floor(rng() * cols), y = 1 + Math.floor(rng() * (rows - 1));
    if (out.some(o => o.x === x && o.y === y)) continue;
    out.push({ type: 'chain', x, y, hp: 1 + (rng() < 0.3 ? 1 : 0) });
  }
  return out;
}

function iceCells(rng, cols = 9, rows = 8, n = 10) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 300) {
    const x = Math.floor(rng() * cols), y = 2 + Math.floor(rng() * (rows - 2));
    if (out.some(o => o.x === x && o.y === y)) continue;
    out.push({ type: 'ice', x, y, hp: 1 + Math.floor(rng() * 2) });
  }
  return out;
}

function mailboxes(rng, cols = 9, rows = 8, n = 2) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ type: 'mailbox', x: 1 + i * 4, y: rows - 1, hp: 2 });
  }
  return out;
}

function vases(rng, cols = 9, rows = 8, n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ type: 'vase', x: 2 + i * 2, y: rows - 2, hp: 2 });
  }
  return out;
}

function nests(rng, cols = 9, rows = 8, n = 2) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ type: 'birdNest', x: 2 + i * 4, y: 3, hp: 2 });
  return out;
}

function honey(rng, cols = 9, rows = 8, n = 6) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const x = 1 + Math.floor(rng() * (cols - 2));
    const y = 3 + Math.floor(rng() * (rows - 3));
    if (out.some(o => o.x === x && o.y === y)) continue;
    out.push({ type: 'honey', x, y, hp: 1 });
  }
  return out;
}

function safes(rng, cols = 9, rows = 8, n = 1) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ type: 'safe', x: 4, y: rows - 4, hp: 3 });
  return out;
}

function curtains(rng, cols = 9, rows = 8, n = 1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = 2 + i * 3;
    for (let x = 0; x < cols; x++) out.push({ type: 'curtain', x, y, hp: 1 });
  }
  return out;
}

export function tierFor(area, n) {
  if (n === 20) return 'veryhard';
  if (n % 10 === 0) return 'veryhard';
  if (n % 6 === 0) return 'hard';
  if (n % 5 === 0 && area >= 3) return 'hard';
  return 'normal';
}

const TUTORIALS = {
  1: 'swap', 2: 'rocket', 3: 'tnt', 4: 'propeller', 5: 'light',
  6: 'combo', 7: 'booster', 8: null, 9: null, 10: null,
};

/* 하나의 레벨 설계 */
export function designLevel(area, n) {
  const seed = area * 1000 + n * 7 + 13;
  const rng = makeRng(seed);
  const cols = 9;
  const rows = 8;
  const difficulty = tierFor(area, n);
  let obstacles = [];
  let colors = 5;
  let goals = [];
  let intro = null;
  let note = '';

  const push = list => { obstacles.push(...list); };

  if (area === 1) {
    // 1구역: 상자 → 파워업 안내 → 장애물 소개 순서
    if (n === 1) {
      obstacles = crateWall(rng, 1, 4);
      goals = [{ type: 'box', count: 27 }];
      colors = 4; note = '상자만 깨는 첫 레벨';
    } else if (n === 2) {
      obstacles = crateWall(rng, 1, 3);
      goals = [{ type: 'box', count: 20 }];
      colors = 4; note = '로켓 만들기 안내';
    } else if (n === 3) {
      obstacles = crateWall(rng, 2, 3);
      goals = [{ type: 'box', count: 22 }];
      colors = 4; note = 'TNT 안내';
    } else if (n === 4) {
      obstacles = [...crateWall(rng, 1, 2), ...colorBoxes(rng, cols, 1, 2, 2)];
      goals = [{ type: 'box', count: 16 }, { type: 'colorBox', count: 4 }];
      colors = 5; note = '프로펠러 안내';
    } else if (n === 5) {
      obstacles = [...crateWall(rng, 2, 2), ...grassField(rng, cols, rows, 10)];
      goals = [{ type: 'box', count: 14 }, { type: 'grass', count: 10 }];
      colors = 5; note = '빛구슬 안내';
    } else if (n === 6) {
      obstacles = [...crateIslands(rng, cols, rows), ...grassField(rng, cols, rows, 8)];
      goals = [{ type: 'box', count: 14 }, { type: 'grass', count: 8 }];
      note = '파워업 조합 안내';
    } else if (n === 7) {
      obstacles = [...crateStairs(rng, cols, rows), ...chains(rng, cols, rows, 6)];
      goals = [{ type: 'box', count: 15 }, { type: 'chain', count: 6 }];
      note = '부스터(망치) 무료 체험';
    } else if (n === 8) {
      obstacles = [...crateWall(rng, 1, 2), ...grassField(rng, cols, rows, 12)];
      goals = [{ type: 'box', count: 12 }, { type: 'grass', count: 12 }];
      note = '자유 플레이';
    } else if (n === 9) {
      obstacles = [...crateIslands(rng, cols, rows), ...mailboxes(rng, cols, rows, 2)];
      goals = [{ type: 'box', count: 14 }, { type: 'letter', count: 2 }];
      note = '구역 과제 첫 수행';
    } else if (n === 10) {
      obstacles = [...crateWall(rng, 2, 3), ...grassField(rng, cols, rows, 10)];
      goals = [{ type: 'box', count: 18 }, { type: 'grass', count: 10 }];
      note = '10레벨 기념 상자';
    } else if (n === 11) {
      obstacles = [...crateWall(rng, 2, 2), ...iceCells(rng, cols, rows, 8)];
      goals = [{ type: 'box', count: 14 }, { type: 'ice', count: 8 }];
      note = '얼음 첫 등장';
    } else if (n === 12) {
      obstacles = [...colorBoxes(rng, cols, 2, 2, 2), ...crateWall(rng, 2, 2)];
      goals = [{ type: 'colorBox', count: 8 }, { type: 'box', count: 12 }];
    } else if (n === 13) {
      obstacles = [...vases(rng, cols, rows, 3), ...crateIslands(rng, cols, rows)];
      goals = [{ type: 'vase', count: 3 }, { type: 'box', count: 12 }];
      note = '꽃병 첫 등장';
    } else if (n === 14) {
      obstacles = [...crateWall(rng, 2, 3), ...mailboxes(rng, cols, rows, 2)];
      goals = [{ type: 'box', count: 16 }, { type: 'letter', count: 2 }];
      intro = 'mailbox';
    } else if (n === 15) {
      obstacles = [...crateWall(rng, 2, 3), ...colorBoxes(rng, cols, 2, 2, 3), ...grassField(rng, cols, rows, 8)];
      goals = [{ type: 'box', count: 16 }, { type: 'colorBox', count: 8 }, { type: 'grass', count: 8 }];
    } else if (n === 16) {
      obstacles = [...crateIslands(rng, cols, rows), ...iceCells(rng, cols, rows, 10)];
      goals = [{ type: 'box', count: 12 }, { type: 'ice', count: 10 }];
    } else if (n === 17) {
      obstacles = [...crateWall(rng, 3, 3), ...chains(rng, cols, rows, 8)];
      goals = [{ type: 'box', count: 18 }, { type: 'chain', count: 8 }];
    } else if (n === 18) {
      obstacles = [...crateWall(rng, 2, 3), ...vases(rng, cols, rows, 3), ...colorBoxes(rng, cols, 1, 2, 2)];
      goals = [{ type: 'box', count: 16 }, { type: 'vase', count: 3 }, { type: 'colorBox', count: 4 }];
    } else if (n === 19) {
      obstacles = [...crateIslands(rng, cols, rows), ...grassField(rng, cols, rows, 14), ...mailboxes(rng, cols, rows, 2)];
      goals = [{ type: 'box', count: 12 }, { type: 'grass', count: 14 }, { type: 'letter', count: 2 }];
    } else {
      obstacles = [...crateWall(rng, 3, 4), ...iceCellsSafe(rng, cols, rows)];
      goals = [{ type: 'box', count: 20 }, { type: 'ice', count: 10 }];
    }
  } else {
    // 2~5구역: 팔레트 기반 믹스
    const palette = PALETTES[area];
    const kinds = [];
    for (let i = 0; i < 3; i++) kinds.push(palette[Math.floor(rng() * palette.length)]);
    const uniq = [...new Set(kinds)];
    for (const kind of uniq) {
      switch (kind) {
        case 'box': push(rng() < 0.5 ? crateWall(rng, 2, 3) : crateIslands(rng, cols, rows)); break;
        case 'grass': push(grassField(rng, cols, rows, 12)); break;
        case 'chain': push(chains(rng, cols, rows, 8)); break;
        case 'colorBox': push(colorBoxes(rng, cols, 1 + Math.floor(rng() * 2), 2, 2 + (area > 3 ? 1 : 0))); break;
        case 'mailbox': push(mailboxes(rng, cols, rows, 2)); break;
        case 'ice': push(iceCells(rng, cols, rows, 10)); break;
        case 'vase': push(vases(rng, cols, rows, 3)); break;
        case 'birdNest': push(nests(rng, cols, rows, 2)); break;
        case 'honey': push(honey(rng, cols, rows, 6)); break;
        case 'safe': push([...mailboxes(rng, cols, rows, 2), ...safes(rng, cols, rows, 1)]); break;
        case 'curtain': push(curtains(rng, cols, rows, 1)); break;
      }
    }
    if (rng() < 0.5) push(crateWall(rng, 1, 2));
    // 목표: 등장한 장애물 종류별
    const counts = new Map();
    for (const o of obstacles) counts.set(o.type, (counts.get(o.type) || 0) + (o.w && o.h ? o.w * o.h : 1));
    const entries = [...counts.entries()].filter(([t]) => t !== 'curtain');
    const picks = entries.slice(0, 3);
    for (const [type, cnt] of picks) {
      goals.push(type === 'mailbox'
        ? { type: 'letter', count: Math.max(1, Math.round(cnt / 2)) }
        : type === 'safe' ? { type: 'safe', count: cnt }
        : type === 'birdNest' ? { type: 'bird', count: cnt }
        : { type, count: cnt });
    }
    if (!goals.length) goals.push({ type: 'box', count: 12 });
    colors = area >= 3 ? 5 : 5;
  }

  // 초반 5레벨은 4색(연쇄가 잘 일어나도록)
  if (area === 1 && n <= 5) colors = 4;

  // 목표가 너무 적으면 색 수집 목표를 하나 더 (레벨당 1~4개)
  if (goals.length < 2 && n > 5) {
    goals.push({ type: 'collect', color: COLORS[Math.floor(rng() * 4)], count: 20 + Math.floor(rng() * 20) });
  }

  const tutorial = area === 1 ? (TUTORIALS[n] || null) : null;

  // 장애물이 겹치지 않게 정리 (먼저 놓인 것이 우선)
  const used = new Set();
  const cleaned = [];
  for (const o of obstacles) {
    const w = o.w || 1, h = o.h || 1;
    let clear = true;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      if (used.has(`${o.x + dx},${o.y + dy}`)) clear = false;
    }
    if (!clear && !(o.w > 1 || o.h > 1)) continue;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) used.add(`${o.x + dx},${o.y + dy}`);
    cleaned.push(o);
  }
  obstacles = cleaned;

  // 목표를 실제 배치된 장애물 수에 맞춘다
  const actual = new Map();
  for (const o of obstacles) actual.set(o.type, (actual.get(o.type) || 0) + 1);
  goals = goals.map(g => {
    const t = g.type === 'letter' ? 'mailbox' : g.type === 'bird' ? 'birdNest' : g.type;
    if (['box', 'colorBox', 'grass', 'mailbox', 'vase', 'chain', 'ice', 'birdNest', 'honey', 'safe', 'curtain'].includes(t)) {
      const n = actual.get(t) || 0;
      return { ...g, count: Math.max(1, Math.min(g.count || 1, n)) };
    }
    return g;
  }).filter(g => {
    const t = g.type === 'letter' ? 'mailbox' : g.type === 'bird' ? 'birdNest' : g.type;
    if (['box', 'colorBox', 'grass', 'mailbox', 'vase', 'chain', 'ice', 'birdNest', 'honey', 'safe', 'curtain'].includes(t)) return (actual.get(t) || 0) > 0;
    return true;
  });
  if (!goals.length) goals.push({ type: 'box', count: Math.max(1, actual.get('box') || 8) });

  return {
    id: (area - 1) * 20 + n,
    area,
    level: n,
    name: `${area}-${n}`,
    moves: 26,
    colors,
    cols,
    rows,
    difficulty,
    goals,
    obstacles,
    blocked: [],
    tutorial,
    intro,
    drops: 2 + Math.floor(rng() * 3),
    seed,
    note,
    _tuned: false,
  };
}

/* 20번 레벨(구역 마지막)용 얼음+안전 금고 믹스 */
function iceCellsSafe(rng, cols, rows) {
  return [...iceCells(rng, cols, rows, 10)];
}

export function writeLevel(area, n, level) {
  const dir = path.join(ROOT, 'levels', `area${area}`);
  fs.mkdirSync(dir, { recursive: true });
  const clean = { ...level };
  delete clean._tuned;
  fs.writeFileSync(path.join(dir, `level${n}.json`), JSON.stringify(clean, null, 2) + '\n');
}

export function generateAll(areas = [1, 2, 3, 4, 5]) {
  let count = 0;
  for (const area of areas) {
    for (let n = 1; n <= 20; n++) {
      writeLevel(area, n, designLevel(area, n));
      count++;
    }
  }
  return count;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const get = (k, d) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : d;
  };
  if (args.includes('--print')) {
    const area = Number(get('--area', 1)), level = Number(get('--level', 1));
    console.log(JSON.stringify(designLevel(area, level), null, 2));
  } else if (args.includes('--area')) {
    const area = Number(get('--area', 1));
    for (let n = 1; n <= 20; n++) writeLevel(area, n, designLevel(area, n));
    console.log(`area${area}: 20 levels written`);
  } else {
    const n = generateAll();
    console.log(`${n} levels written to ${path.join(ROOT, 'levels')}`);
  }
}
