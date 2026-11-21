/* =========================================================================
   셔플 — 보석 색을 섞되, 즉시 매치가 생기지 않고 가능한 수가 있도록 재시도.
   ========================================================================= */
export function shuffleGrid(board) {
  const { cols, rows, grid } = board;
  const cells = [];
  const colors = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      if (t) { cells.push([r, c]); colors.push(t.color); }
    }
  }
  for (let attempt = 0; attempt < 80; attempt++) {
    const mixed = board.rng.shuffled(colors);
    cells.forEach(([r, c], i) => { grid[r][c].color = mixed[i]; });
    if (!board.hasAnyMatch() && board.hasMove()) return true;
  }
  return false;
}
