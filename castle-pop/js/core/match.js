/* =========================================================================
   매치 판정 — 보드 격자에서 가로/세로 3개 이상 줄을 찾고, 겹친 줄을 묶어
   하나의 "매치 그룹"으로 만든 뒤 만들어질 파워업을 결정한다.
   (DOM 의존 없음 — Node 자동 플레이 봇이 그대로 import 한다)
   ========================================================================= */

/* 시드 기반 난수 (봇 재현성) */
export function makeRng(seed = 1) {
  let a = seed >>> 0 || 1;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gemColor(board, x, y) {
  const c = board.cell(x, y);
  if (!c || !c.gem) return -1;
  return c.gem.color;
}

/* 가로/세로 3개 이상 같은 색 줄 */
export function findRuns(board) {
  const h = [], v = [];
  for (let y = 0; y < board.rows; y++) {
    let run = 1;
    for (let x = 1; x <= board.cols; x++) {
      const same = x < board.cols && gemColor(board, x, y) >= 0
        && gemColor(board, x, y) === gemColor(board, x - 1, y);
      if (same) run++;
      else {
        if (run >= 3) h.push({ y, x0: x - run, x1: x - 1, len: run, color: gemColor(board, x - 1, y) });
        run = 1;
      }
    }
  }
  for (let x = 0; x < board.cols; x++) {
    let run = 1;
    for (let y = 1; y <= board.rows; y++) {
      const same = y < board.rows && gemColor(board, x, y) >= 0
        && gemColor(board, x, y) === gemColor(board, x, y - 1);
      if (same) run++;
      else {
        if (run >= 3) v.push({ x, y0: y - run, y1: y - 1, len: run, color: gemColor(board, x, y - 1) });
        run = 1;
      }
    }
  }
  return { h, v };
}

/* 2×2 사각 매치가 있는지 (프로펠러) */
function findSquare(cells) {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of cells) {
    if (set.has(`${x + 1},${y}`) && set.has(`${x},${y + 1}`) && set.has(`${x + 1},${y + 1}`)) {
      return [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
    }
  }
  return null;
}

/* 겹친 줄을 묶어 그룹으로. cells 는 [x,y] 배열 */
export function findGroups(board) {
  const { h, v } = findRuns(board);
  if (!h.length && !v.length) return [];

  const runs = [
    ...h.map(r => ({ dir: 'h', cells: range(r.x0, r.x1).map(x => [x, r.y]), len: r.len, color: r.color, run: r })),
    ...v.map(r => ({ dir: 'v', cells: range(r.y0, r.y1).map(y => [r.x, y]), len: r.len, color: r.color, run: r })),
  ];

  const parent = new Map();
  const find = k => {
    while (parent.get(k) !== k) {
      parent.set(k, parent.get(parent.get(k)));
      k = parent.get(k);
    }
    return k;
  };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

  runs.forEach((r, i) => {
    r.cells.forEach(([x, y]) => {
      const k = `${x},${y}`;
      if (!parent.has(k)) parent.set(k, k);
      union(k, `run${i}`);
    });
    parent.set(`run${i}`, `run${i}`);
  });

  const buckets = new Map();
  runs.forEach((r, i) => {
    const root = find(`run${i}`);
    if (!buckets.has(root)) buckets.set(root, { runs: [] });
    buckets.get(root).runs.push(r);
  });

  const groups = [];
  for (const { runs: gruns } of buckets.values()) {
    const cellSet = new Set();
    for (const r of gruns) for (const [x, y] of r.cells) cellSet.add(`${x},${y}`);
    const cells = [...cellSet].map(k => k.split(',').map(Number));
    const colors = new Set(gruns.map(r => r.color));
    const maxH = Math.max(0, ...gruns.filter(r => r.dir === 'h').map(r => r.len));
    const maxV = Math.max(0, ...gruns.filter(r => r.dir === 'v').map(r => r.len));
    const hasH = gruns.some(r => r.dir === 'h');
    const hasV = gruns.some(r => r.dir === 'v');
    groups.push({
      cells,
      runs: gruns,
      maxH, maxV, hasH, hasV,
      color: gruns[0].color,
      multiColor: colors.size > 1,
      square: findSquare(cells),
    });
  }
  return groups;
}

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/* 그룹에서 어떤 파워업이 만들어질지 결정.
   우선순위: 빛구슬(5줄) > TNT(L/T) > 프로펠러(2×2) > 로켓(4줄)
   swapCells: 이번 교환에 참여한 두 칸 — 생성 위치를 그쪽으로 우선 */
export function decidePowerup(group, swapCells = []) {
  if (group.multiColor) return null;
  const swapKeys = swapCells.map(([x, y]) => `${x},${y}`);
  const prefer = group.cells.find(([x, y]) => swapKeys.includes(`${x},${y}`));
  const center = group.runs
    .slice()
    .sort((a, b) => b.len - a.len)
    .map(r => r.cells[Math.floor(r.cells.length / 2)])[0];

  const at = prefer || center || group.cells[0];

  if (group.maxH >= 5 || group.maxV >= 5) {
    return { type: 'light', at, color: group.color };
  }
  if (group.hasH && group.hasV && group.cells.length >= 5) {
    return { type: 'tnt', at, color: group.color };
  }
  if (group.square && group.cells.length >= 4) {
    return { type: 'propeller', at, color: group.color };
  }
  if (group.maxH === 4 || group.maxV === 4) {
    // 가로 매치 → 세로 로켓(세로로 발사), 세로 매치 → 가로 로켓
    const orient = group.maxH === 4 ? 'v' : 'h';
    return { type: 'rocket', at, color: group.color, orient };
  }
  return null;
}

/* (x,y) 를 지나는 3개 이상 줄이 있는가 — 국소 판정(빠름) */
export function lineLengthAt(board, x, y, color) {
  if (color < 0) return 0;
  let best = 0;
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    let n = 1;
    for (const s of [1, -1]) {
      let cx = x + dx * s, cy = y + dy * s;
      while (board.cell(cx, cy)?.gem?.color === color) { n++; cx += dx * s; cy += dy * s; }
    }
    if (n > best) best = n;
  }
  return best;
}

/* 스왑이 매치를 만드는지 (힌트/봇이 사용) — 바뀐 두 칸만 본다 */
export function swapMakesMatch(board, ax, ay, bx, by) {
  if (!board.canSwap(ax, ay, bx, by)) return false;
  const a = board.cell(ax, ay), b = board.cell(bx, by);
  const ga = a.gem, gb = b.gem;
  a.gem = gb; b.gem = ga;
  const madeA = lineLengthAt(board, ax, ay, gb.color) >= 3;
  const madeB = lineLengthAt(board, bx, by, ga.color) >= 3;
  let ok = madeA || madeB;
  if (!ok && (ga.power === 'light' || gb.power === 'light')) ok = true;
  if (!ok && ga.power && gb.power) ok = true;
  a.gem = ga; b.gem = gb;
  return ok;
}

/* 가능한 모든 수 (봇·힌트) */
export function validMoves(board) {
  const out = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (swapMakesMatch(board, x, y, x + dx, y + dy)) out.push([[x, y], [x + dx, y + dy]]);
      }
    }
  }
  return out;
}
