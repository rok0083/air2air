/* =========================================================================
   중력 / 낙하 + 위에서 새 보석 보충
   - 장애물로 막힌 칸은 보석이 통과하지 못합니다.
   - 반환: { moves:[{tile, from:[r,c], to:[r,c]}], spawns:[{tile,r,c,fromRow}] }
   ========================================================================= */

export function applyGravity(board) {
  const moves = [];
  const spawns = [];
  const { cols, rows, grid } = board;

  for (let c = 0; c < cols; c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (board.isBlockedCell(r, c)) { write = r - 1; continue; }
      const t = grid[r][c];
      if (!t) continue;
      if (r !== write) {
        grid[write][c] = t;
        grid[r][c] = null;
        moves.push({ tile: t, from: [r, c], to: [write, c] });
      }
      write--;
    }
    // 남은 빈칸 위에서 새 보석
    let above = 1;
    for (let r = write; r >= 0; r--) {
      if (board.isBlockedCell(r, c)) continue;
      if (grid[r][c]) continue;
      const t = board.makeTile();
      grid[r][c] = t;
      spawns.push({ tile: t, r, c, fromRow: -above });
      above++;
    }
  }
  return { moves, spawns };
}
