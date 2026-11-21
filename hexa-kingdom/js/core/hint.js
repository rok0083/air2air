/* 가능한 한 수 찾기 — 교체하면 3개 이상이 되는 인접 쌍을 찾습니다. */
export function findHint(board) {
  const { grid, cols, rows } = board;
  const colorAt = (r, c) => {
    const t = grid[r]?.[c];
    return t ? t.color : -1;
  };
  const makesMatch = (r1, c1, r2, c2) => {
    const a = colorAt(r1, c1), b = colorAt(r2, c2);
    if (a < 0 || b < 0 || a === b) return false;
    // 가상 교체
    const g = grid.map(row => row.slice());
    const tmp = g[r1][c1];
    g[r1][c1] = g[r2][c2];
    g[r2][c2] = tmp;
    const eq = (r, c, col) => g[r]?.[c] && g[r][c].color === col;
    // 가로
    for (const [r, c0, col] of [[r1, c1, g[r1][c1].color], [r2, c2, g[r2][c2].color]]) {
      let n = 1;
      let cc = c0 - 1;
      while (cc >= 0 && eq(r, cc, col)) { n++; cc--; }
      cc = c0 + 1;
      while (cc < cols && eq(r, cc, col)) { n++; cc++; }
      if (n >= 3) return true;
      n = 1;
      let rr = r - 1;
      while (rr >= 0 && eq(rr, c0, col)) { n++; rr--; }
      rr = r + 1;
      while (rr < rows && eq(rr, c0, col)) { n++; rr++; }
      if (n >= 3) return true;
    }
    // 특수 보석끼리 교체는 항상 가능
    const t1 = grid[r1][c1], t2 = grid[r2][c2];
    if (t1?.pu || t2?.pu) return true;
    return false;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && makesMatch(r, c, r, c + 1)) return { a: { r, c }, b: { r, c: c + 1 } };
      if (r + 1 < rows && makesMatch(r, c, r + 1, c)) return { a: { r, c }, b: { r: r + 1, c } };
    }
  }
  return null;
}

/* 남은 이동 수에서 목표 달성이 가능한지 대략 판정(검증 스크립트용) */
export function hasMove(board) {
  return !!findHint(board);
}
