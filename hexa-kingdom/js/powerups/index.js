/* =========================================================================
   특수 보석(Powerups) — 로켓 / TNT / 프로펠러 / 전기구
   -------------------------------------------------------------------------
   · 생성: 4개 일렬 → 로켓(줄 방향), L·T자 → TNT, 2×2 사각 → 프로펠러,
           5개 이상 일렬 → 전기구
   · 발동: 매치에 포함되거나, 다른 특수 보석에 휩쓸리면 연쇄 발동
   · 콤보: 두 특수 보석을 맞바꾸면 9가지 이상의 조합 효과
   ========================================================================= */
import { CFG, PU_META } from '../config.js';

export const POWERUPS = {
  rocket:  { name: '로켓',     clears: 'row/col',  desc: '가로 또는 세로 한 줄을 지웁니다.' },
  tnt:     { name: 'TNT',      clears: '3x3',      desc: '3×3 범위를 두 번 폭발시킵니다.' },
  spinner: { name: '프로펠러', clears: 'cross+fly',desc: '십자로 지우고 목표 지점으로 날아가 3×3을 터뜨립니다.' },
  electro: { name: '전기구',   clears: 'color',    desc: '같은 색 보석을 전부 지웁니다.' },
};

let puSeq = 1;

export function makePowerupTile(type, color, dir = 'h') {
  return {
    id: 't' + (puSeq++),
    color,
    pu: { type, dir, id: puSeq },
    item: null,
  };
}

export function inBounds(board, r, c) {
  return r >= 0 && c >= 0 && r < board.rows && c < board.cols;
}

/* 한 칸의 타일을 기준으로 "이 특수 보석이 지우는 칸들" 계산 */
export function effectCells(board, tile, r, c, refColor) {
  const out = [];
  const push = (rr, cc) => { if (inBounds(board, rr, cc)) out.push([rr, cc]); };
  const pu = tile.pu;
  if (!pu) return out;
  switch (pu.type) {
    case 'rocket': {
      if (pu.dir === 'v') for (let rr = 0; rr < board.rows; rr++) push(rr, c);
      else for (let cc = 0; cc < board.cols; cc++) push(r, cc);
      break;
    }
    case 'tnt': {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) push(r + dr, c + dc);
      break;
    }
    case 'spinner': {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) push(r + dr, c + dc);
      for (let cc = 0; cc < board.cols; cc++) push(r, cc);
      for (let rr = 0; rr < board.rows; rr++) push(rr, c);
      // 목표 지점(장애물/목표색)으로 날아가 3×3
      const target = board.findSpinnerTarget(r, c, refColor);
      if (target) {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) push(target.r + dr, target.c + dc);
        board.hooks.onSpinnerFly?.(r, c, target.r, target.c);
      }
      break;
    }
    case 'electro': {
      const col = tile.color;
      for (let rr = 0; rr < board.rows; rr++) {
        for (let cc = 0; cc < board.cols; cc++) {
          const t = board.grid[rr][cc];
          if (t && t.color === col) push(rr, cc);
        }
      }
      break;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------
   콤보 — 두 특수 보석을 맞바꿀 때의 효과 계획을 만든다.
   반환: { cells, conversions, spawns, label, flash }
     cells       : 즉시 지울 칸
     conversions : {color, type, dir, count|'all'} — 같은 색을 특수로 바꿔 연쇄
     spawns      : 새로 만들 특수 보석 위치
   ------------------------------------------------------------------------- */
export function comboPlan(board, a, b, mid) {
  const ta = a.tile.pu.type, tb = b.tile.pu.type;
  const cells = new Set();
  const conversions = [];
  const spawns = [];
  const push = (r, c) => { if (inBounds(board, r, c)) cells.add(`${r},${c}`); };
  const row = (r, c0, c1) => { for (let c = c0; c <= c1; c++) push(r, c); };
  const col = (c, r0, r1) => { for (let r = r0; r <= r1; r++) push(r, c); };
  const box = (r, c, rad) => { for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) push(r + dr, c + dc); };
  const label = POWERUPS[ta].name + ' + ' + POWERUPS[tb].name;

  const pair = [ta, tb].sort().join('+');
  if (pair === 'electro+electro') {
    for (let r = 0; r < board.rows; r++) for (let c = 0; c < board.cols; c++) push(r, c);
    return { cells: [...cells], conversions, spawns, label: '전기구 + 전기구 · 보드 전체', flash: 1 };
  }
  if (pair === 'electro+rocket' || pair === 'electro+tnt' || pair === 'electro+spinner') {
    const other = ta === 'electro' ? tb : ta;
    const otherTile = ta === 'electro' ? b.tile : a.tile;
    conversions.push({ color: (ta === 'electro' ? a.tile.color : b.tile.color), type: other, dir: otherTile.pu.dir || 'h' });
    push(a.r, a.c); push(b.r, b.c);
    return { cells: [...cells], conversions, spawns, label: label + ' · 같은 색 전부 변환', flash: 0.8 };
  }
  if (pair === 'rocket+rocket') {
    row(mid.r, 0, board.cols - 1);
    col(mid.c, 0, board.rows - 1);
    push(a.r, a.c); push(b.r, b.c);
    return { cells: [...cells], conversions, spawns, label: label + ' · 십자', flash: 0.6 };
  }
  if (pair === 'rocket+tnt') {
    for (let d = -1; d <= 1; d++) {
      if (mid.r + d >= 0 && mid.r + d < board.rows) row(mid.r + d, 0, board.cols - 1);
      if (mid.c + d >= 0 && mid.c + d < board.cols) col(mid.c + d, 0, board.rows - 1);
    }
    push(a.r, a.c); push(b.r, b.c);
    return { cells: [...cells], conversions, spawns, label: label + ' · 3줄 + 3열', flash: 0.9 };
  }
  if (pair === 'tnt+tnt') {
    box(mid.r, mid.c, 2);
    push(a.r, a.c); push(b.r, b.c);
    return { cells: [...cells], conversions, spawns, label: label + ' · 5×5', flash: 1 };
  }
  if (pair === 'spinner+spinner') {
    push(a.r, a.c); push(b.r, b.c);
    for (let i = 0; i < 3; i++) spawns.push({ type: 'spinner', dir: 'h', r: 1 + i * 2, c: 1 + ((i * 3) % (board.cols - 2)) });
    box(mid.r, mid.c, 1);
    return { cells: [...cells], conversions, spawns, label: label + ' · 프로펠러 3개 분열', flash: 0.7 };
  }
  if (pair === 'rocket+spinner' || pair === 'spinner+tnt') {
    const other = ta === 'spinner' ? tb : ta;
    push(a.r, a.c); push(b.r, b.c);
    for (let i = 0; i < 3; i++) spawns.push({ type: other, dir: i % 2 ? 'v' : 'h', r: 1 + i * 2, c: 2 + ((i * 2) % (board.cols - 3)) });
    return { cells: [...cells], conversions, spawns, label: label + ' · ' + POWERUPS[other].name + ' 3개 복제', flash: 0.7 };
  }
  // 예외 조합 — 둘 다 발동
  push(a.r, a.c); push(b.r, b.c);
  box(a.r, a.c, 1); box(b.r, b.c, 1);
  return { cells: [...cells], conversions, spawns, label, flash: 0.4 };
}

export function puIcon(type) { return PU_META[type]?.icon || '✦'; }

/* 특수 보석의 남은 연쇄 깊이 제한 */
export const CHAIN_LIMIT = CFG.powerups.chainDepth;
