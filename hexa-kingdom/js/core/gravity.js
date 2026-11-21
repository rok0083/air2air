/* =========================================================================
   중력 / 낙하 + 위에서 새 보석 보충
   -------------------------------------------------------------------------
   1.0 은 세로 한 줄을 통째로 압축했습니다. 그래서 덤불·상자처럼 '보석을 막는'
   장애물(blocksTile)이 있는 줄에서는 그 장애물 '아래' 구간이 위에서 새 보석을
   받지 못해, 지운 칸이 검은 빈 칸으로 영원히 남았습니다.
   (예: (3,7) 덤불 아래 (4,7), (5,7) … )

   2.0 은 이렇게 고칩니다.
     · 세로를 '구간'으로 나눠(장애물이 끊는 지점) 각 구간을 따로 압축합니다.
     · 구간 맨 위의 빈 칸은 위 좌/우 대각선 칸의 보석을 끌어와 채웁니다
       (로열 킹덤·캔디크러시의 대각선 흘림). 그 보석의 원래 자리는 다음
       스윕에서 다시 채워지며 연쇄가 자연스럽게 위로 이어집니다.
     · 그래도 남는 빈 칸은 구간 맨 위에서 '보석이 솟아나듯' 채웁니다.
       위쪽 구간은 화면 밖에서, 장애물 아래 구간은 장애물 뒤에서 나오는 것처럼
       보이도록 fromRow 를 살짝 위로 잡습니다.
     · 마지막으로 아주 작은 안전망: 어떤 이유로든 플레이 가능한 칸이 비어 있으면
       무조건 보석을 만듭니다. → 검은 빈 칸 0.

   반환: { moves:[{tile, from:[r,c], to:[r,c]}], spawns:[{tile,r,c,fromRow}] }
   ========================================================================= */

const MAX_SWEEPS = 12;

export function applyGravity(board) {
  const moves = [];
  const spawns = [];
  const { cols, rows, grid } = board;
  const blocked = (r, c) => board.isBlockedCell(r, c);

  /* 1) 세로 압축 — 장애물이 끊는 구간마다 아래로 내린다 */
  const compact = () => {
    let moved = 0;
    for (let c = 0; c < cols; c++) {
      let write = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (blocked(r, c)) { write = r - 1; continue; }
        const t = grid[r][c];
        if (!t) continue;
        if (r !== write) {
          grid[write][c] = t;
          grid[r][c] = null;
          moves.push({ tile: t, from: [r, c], to: [write, c] });
          moved++;
        }
        write--;
      }
    }
    return moved;
  };

  /* 한 열의 플레이 가능한 세로 구간 목록 [[top,bottom], …] */
  const segmentsOf = (c) => {
    const segs = [];
    let start = null;
    for (let r = 0; r < rows; r++) {
      if (blocked(r, c)) {
        if (start !== null) { segs.push([start, r - 1]); start = null; }
      } else if (start === null) start = r;
    }
    if (start !== null) segs.push([start, rows - 1]);
    return segs;
  };

  /* 2) 대각선 흘림 — 구간 맨 위의 빈 칸을 위 좌/우 칸에서 끌어온다 */
  const diagonalFill = () => {
    let filled = 0;
    for (let c = 0; c < cols; c++) {
      for (const [top] of segmentsOf(c)) {
        if (grid[top][c]) continue;                  // 이 구간은 꽉 차 있음
        const cands = [];
        for (const dc of [-1, 1]) {
          const sc = c + dc;
          if (sc < 0 || sc >= cols) continue;
          if (top - 1 < 0) continue;
          if (blocked(top - 1, sc)) continue;
          const t = grid[top - 1][sc];
          if (t) cands.push({ sr: top - 1, sc, t });
        }
        if (!cands.length) continue;
        const pick = board.rng ? board.rng.pick(cands) : cands[0];
        grid[top][c] = pick.t;
        grid[pick.sr][pick.sc] = null;
        moves.push({ tile: pick.t, from: [pick.sr, pick.sc], to: [top, c] });
        filled++;
      }
    }
    return filled;
  };

  /* 3) 압축 ↔ 대각선 흘림을 빈 칸이 줄어들 때까지 반복 */
  for (let i = 0; i < MAX_SWEEPS; i++) {
    const a = compact();
    const b = diagonalFill();
    if (!a && !b) break;
  }
  compact();

  /* 4) 남은 빈 칸 채우기 — 구간 맨 위에서 보석이 솟아난다 */
  for (let c = 0; c < cols; c++) {
    for (const [top, bottom] of segmentsOf(c)) {
      let above = 1;                       // 위쪽 구간은 화면 밖에서
      for (let r = top; r <= bottom; r++) {
        if (grid[r][c]) continue;
        const t = board.makeTile();
        grid[r][c] = t;
        const fromRow = top === 0 ? -above++ : top - 1;
        spawns.push({ tile: t, r, c, fromRow });
      }
    }
  }

  /* 5) 안전망 — 여기까지 와서도 비어 있는 플레이 칸은 없다(방어적) */
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] || blocked(r, c)) continue;
      const t = board.makeTile();
      grid[r][c] = t;
      spawns.push({ tile: t, r, c, fromRow: r - 0.9 });
    }
  }

  return { moves, spawns };
}

/* 보드에 남은 '플레이 가능한 빈 칸' 개수 — 검증/디버그용 */
export function countEmptyPlayable(board) {
  let n = 0;
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (!board.grid[r][c] && !board.isBlockedCell(r, c)) n++;
    }
  }
  return n;
}
