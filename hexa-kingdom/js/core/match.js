/* =========================================================================
   매치 판정 — 가로/세로 3개 이상을 찾아 그룹으로 묶고, 그룹 모양으로
   만들어질 특수 보석 종류를 결정합니다.
   반환: [{ cells:[[r,c]...], color, type, spawn:{r,c}, dir, len }]
   type: null | 'rocket' | 'tnt' | 'spinner' | 'electro'
   dir : 'h' | 'v' (로켓 방향)
   ========================================================================= */

const key = (r, c) => r + ',' + c;

function runInfo(run) {
  const cells = [];
  if (run.dir === 'h') for (let c = run.c0; c <= run.c1; c++) cells.push([run.r, c]);
  else for (let r = run.r0; r <= run.r1; r++) cells.push([r, run.c]);
  return cells;
}

export function findMatches(grid, cols, rows, opts = {}) {
  const runs = [];

  // 가로
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const t = grid[r][c];
      if (!t) { c++; continue; }
      let c1 = c;
      while (c1 + 1 < cols && grid[r][c1 + 1] && grid[r][c1 + 1].color === t.color) c1++;
      if (c1 - c + 1 >= 3) runs.push({ r, c0: c, c1, dir: 'h', color: t.color, len: c1 - c + 1 });
      c = c1 + 1;
    }
  }
  // 세로
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const t = grid[r][c];
      if (!t) { r++; continue; }
      let r1 = r;
      while (r1 + 1 < rows && grid[r1 + 1][c] && grid[r1 + 1][c].color === t.color) r1++;
      if (r1 - r + 1 >= 3) runs.push({ r0: r, r1, c, dir: 'v', color: t.color, len: r1 - r + 1 });
      r = r1 + 1;
    }
  }
  if (!runs.length) return opts.squares ? findSquares(grid, cols, rows) : [];

  // 같은 칸을 공유하는 런들을 하나의 그룹으로 병합
  const parent = runs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  const cellToRuns = new Map();
  runs.forEach((run, i) => {
    for (const [r, c] of runInfo(run)) {
      const k = key(r, c);
      if (cellToRuns.has(k)) union(i, cellToRuns.get(k));
      else cellToRuns.set(k, i);
    }
  });

  const comps = new Map();
  runs.forEach((run, i) => {
    const root = find(i);
    if (!comps.has(root)) comps.set(root, []);
    comps.get(root).push(run);
  });

  const groups = [];
  for (const comp of comps.values()) {
    const cellMap = new Map();
    for (const run of comp) for (const [r, c] of runInfo(run)) cellMap.set(key(r, c), [r, c]);
    const cells = [...cellMap.values()];
    const color = comp[0].color;

    const hRuns = comp.filter(x => x.dir === 'h');
    const vRuns = comp.filter(x => x.dir === 'v');
    const maxH = Math.max(0, ...hRuns.map(x => x.len));
    const maxV = Math.max(0, ...vRuns.map(x => x.len));

    // 2×2 사각형 판정 (프로펠러)
    let square = null;
    for (const [r, c] of cells) {
      const k2 = [[r + 1, c], [r, c + 1], [r + 1, c + 1]];
      if (k2.every(([rr, cc]) => cellMap.has(key(rr, cc)))) { square = { r, c }; break; }
    }

    // L / T 자 판정: 가로 런과 세로 런이 한 칸에서 교차
    let cross = null;
    for (const [r, c] of cells) {
      const hasH = hRuns.some(x => x.r === r && c >= x.c0 && c <= x.c1);
      const hasV = vRuns.some(x => x.c === c && r >= x.r0 && r <= x.r1);
      if (hasH && hasV) { cross = { r, c }; break; }
    }

    let type = null, dir = maxH >= maxV ? 'h' : 'v';
    let spawn = cells[Math.floor(cells.length / 2)];
    if (maxH >= 5 || maxV >= 5) {
      type = 'electro';
      const run = maxH >= maxV ? hRuns.find(x => x.len === maxH) : vRuns.find(x => x.len === maxV);
      if (run) spawn = run.dir === 'h' ? [run.r, Math.floor((run.c0 + run.c1) / 2)] : [Math.floor((run.r0 + run.r1) / 2), run.c];
      dir = maxH >= maxV ? 'h' : 'v';
    } else if (square && cells.length === 4) {
      type = 'spinner';
      spawn = [square.r, square.c];
    } else if (cross) {
      type = 'tnt';
      spawn = [cross.r, cross.c];
      dir = 'h';
    } else if (maxH >= 4 || maxV >= 4) {
      type = 'rocket';
      const run = maxH >= 4 ? hRuns.find(x => x.len === maxH) : vRuns.find(x => x.len === maxV);
      if (run) {
        spawn = run.dir === 'h' ? [run.r, Math.floor((run.c0 + run.c1) / 2)] : [Math.floor((run.r0 + run.r1) / 2), run.c];
        dir = run.dir; // 가로 4개 → 가로 줄 로켓
      }
    }

    groups.push({ cells, color, type, spawn: { r: spawn[0], c: spawn[1] }, dir, len: cells.length });
  }

  /* 2×2 사각 매치 → 프로펠러.
     무작위로 흘러내린 보석들까지 매번 2×2 로 지우면 게임이 너무 쉬워지므로,
     플레이어가 교체한 직후(opts.squares=true)에만 판정합니다. */
  if (opts.squares) {
    for (const sq of findSquares(grid, cols, rows)) {
      const overlaps = groups.some(g => g.cells.some(([r, c]) => sq.cells.some(([sr, sc]) => sr === r && sc === c)));
      if (overlaps) continue;
      groups.push(sq);
    }
  }
  return groups;
}

function findSquares(grid, cols, rows) {
  const out = [];
  const used = new Set();
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = grid[r][c], b = grid[r][c + 1], d = grid[r + 1][c], e = grid[r + 1][c + 1];
      if (!a || !b || !d || !e) continue;
      if (a.color !== b.color || a.color !== d.color || a.color !== e.color) continue;
      const key = `${r},${c}`;
      if (used.has(key) || used.has(`${r},${c + 1}`) || used.has(`${r + 1},${c}`) || used.has(`${r + 1},${c + 1}`)) continue;
      const cells = [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
      cells.forEach(([rr, cc]) => used.add(`${rr},${cc}`));
      out.push({ cells, color: a.color, type: 'spinner', spawn: { r, c }, dir: 'h', len: 4 });
    }
  }
  return out;
}

/* 교체한 두 칸 중 하나가 그룹에 속하면 그 칸을 특수 보석 생성 위치로 삼는다. */
export function withPreferredSpawn(groups, a, b) {
  for (const g of groups) {
    for (const p of [a, b]) {
      if (!p) continue;
      if (g.cells.some(([r, c]) => r === p.r && c === p.c)) {
        if (g.type) g.spawn = { r: p.r, c: p.c };
        else g.spawn = { r: p.r, c: p.c };
        return;
      }
    }
  }
}
