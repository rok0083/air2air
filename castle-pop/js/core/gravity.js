/* =========================================================================
   낙하 — 빈 칸 0 보장
   a. 수직 낙하  b. 막힌 칸은 위 좌/우 대각선에서 흘러내림
   c. 구간 맨 위에서 새 조각 생성  d. 움직일 조각이 없을 때까지 반복
   planGravity() 는 논리 상태를 즉시 갱신하고, 애니메이션용 계획을 돌려준다.
   ========================================================================= */

export function planGravity(board) {
  const moves = [];   // {gem, fromX, fromY, toX, toY}
  const spawns = [];  // {gem, x, y, fromY}
  const cols = board.cols, rows = board.rows;

  for (let x = 0; x < cols; x++) {
    const segments = columnSegments(board, x);
    for (const seg of segments) {
      // 1) 수직 낙하 — 아래부터 채운다
      let write = seg.bottom;
      for (let y = seg.bottom; y >= seg.top; y--) {
        const cell = board.cell(x, y);
        if (!cell || !cell.gem) continue;
        if (y !== write) {
          const target = board.cell(x, write);
          moves.push({ gem: cell.gem, fromX: x, fromY: y, toX: x, toY: write, diag: false });
          target.gem = cell.gem;
          cell.gem = null;
        }
        write--;
      }
    }
  }

  // 2) 대각선 흘러내림 — 위가 장애물로 막힌 빈 칸을 좌/우 위에서 채운다
  for (let pass = 0; pass < 2; pass++) {
    for (let x = 0; x < cols; x++) {
      for (let y = board.rows - 1; y >= 0; y--) {
        const cell = board.cell(x, y);
        if (!cell || cell.hole || cell.gem || board.blocksFallAt(x, y)) continue;
        for (const dx of [-1, 1]) {
          const sx = x + dx, sy = y - 1;
          const src = board.cell(sx, sy);
          if (!src || src.hole || !src.gem) continue;
          if (board.blocksFallAt(sx, sy)) continue;
          moves.push({ gem: src.gem, fromX: sx, fromY: sy, toX: x, toY: y, diag: true });
          cell.gem = src.gem;
          src.gem = null;
          break;
        }
      }
    }
    // 대각선으로 빠진 칸도 다시 압축
    for (let x = 0; x < cols; x++) {
      for (const seg of columnSegments(board, x)) {
        let write = seg.bottom;
        for (let y = seg.bottom; y >= seg.top; y--) {
          const cell = board.cell(x, y);
          if (!cell || !cell.gem) continue;
          if (y !== write) {
            const target = board.cell(x, write);
            moves.push({ gem: cell.gem, fromX: x, fromY: y, toX: x, toY: write, diag: false });
            target.gem = cell.gem;
            cell.gem = null;
          }
          write--;
        }
      }
    }
  }

  // 3) 남은 빈 칸은 구간 위에서 새 조각이 솟아난다 (빈 칸 0 보장)
  for (let x = 0; x < cols; x++) {
    for (const seg of columnSegments(board, x)) {
      for (let y = seg.top; y <= seg.bottom; y++) {
        const cell = board.cell(x, y);
        if (!cell || cell.hole || cell.gem) continue;
        const gem = board.makeGem(board.randomColor(), null);
        cell.gem = gem;
        spawns.push({ gem, x, y, fromY: seg.top - 1 - (y - seg.top) });
      }
    }
  }

  return { moves, spawns };
}

/* 한 열에서 조각이 존재할 수 있는 연속 구간 (막는 장애물 / 구멍에서 끊김) */
export function columnSegments(board, x) {
  const segs = [];
  let top = null;
  for (let y = 0; y < board.rows; y++) {
    const cell = board.cell(x, y);
    const usable = cell && !cell.hole && !board.blocksFallAt(x, y);
    if (usable) {
      if (top === null) top = y;
    } else if (top !== null) {
      segs.push({ top, bottom: y - 1 });
      top = null;
    }
  }
  if (top !== null) segs.push({ top, bottom: board.rows - 1 });
  return segs;
}

export function emptyPlayableCells(board) {
  const out = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const c = board.cell(x, y);
      if (!c || c.hole) continue;
      if (board.blocksFallAt(x, y)) continue;
      if (!c.gem) out.push([x, y]);
    }
  }
  return out;
}
