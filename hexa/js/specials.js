/* =========================================================================
   헥사 블리츠 — 특수 보석
   매치 모양으로 만들어지는 7종 특수 보석, 특수+특수 콤보 스왑, 연쇄 반응
   ========================================================================= */

import { CFG } from './config.js';

export const SPECIAL_INFO = {
  row:   { name: '가로 줄 보석', icon: '⇔', color: '#7dd3fc' },
  col:   { name: '세로 줄 보석', icon: '⇕', color: '#7dd3fc' },
  bomb:  { name: '폭탄 보석',   icon: '✸', color: '#fb7185' },
  prop:  { name: '프로펠러',    icon: '✜', color: '#facc15' },
  hyper: { name: '하이퍼 큐브', icon: '◈', color: '#f472b6' },
  nova:  { name: '슈퍼노바',    icon: '✷', color: '#c084fc' },
  star:  { name: '스타 보석',   icon: '★', color: '#fde68a' },
};

/* ── 매치 그룹 → 만들어질 특수 보석 결정 ───────────────────── */
export function specialForGroup(group) {
  if (!group) return null;
  if (group.shape === 'square') return 'prop';       // 2×2 사각 매치
  if (group.maxRun >= 6) return 'nova';             // 6개 이상 일렬
  if (group.shape === 'plus') return 'star';        // +자 5매치
  if (group.maxRun === 5) return 'hyper';           // 5개 일렬
  if (group.shape === 'lt') return 'bomb';          // L/T 매치
  if (group.maxRun === 4) {
    // 세로 4매치 → 가로 줄 보석, 가로 4매치 → 세로 줄 보석
    return group.dir === 'v' ? 'row' : 'col';
  }
  return null;
}

/* ── 특수 보석 발동 ─────────────────────────────────────────
   board 위에서 효과를 연출하고, 이어서 지워야 할 셀 목록을 돌려줍니다. */
export function activateSpecial(board, r, c, gem, ctx = {}) {
  const type = gem.special;
  if (!type) return [];
  const info = SPECIAL_INFO[type];
  const cells = [];
  const center = board.cellCenter(r, c);
  const push = (list) => { for (const p of list) cells.push(p); };

  board.addScoreLog(CFG.score.specialTriggered);
  if (board.fx) board.fx.text(center.x, center.y - 10, info.name, info.color, 15);

  switch (type) {
    case 'row': {
      push(board.rowCells(r));
      if (board.fx) board.fx.beam(board.edge('left', r).x, center.y, board.edge('right', r).x, center.y, info.color, 16);
      board.audio && board.audio.play('beam');
      board.fx && board.fx.shake(160, 5);
      break;
    }
    case 'col': {
      push(board.colCells(c));
      if (board.fx) board.fx.beam(center.x, board.edge('top', c).y, center.x, board.edge('bottom', c).y, info.color, 16);
      board.audio && board.audio.play('beam');
      board.fx && board.fx.shake(160, 5);
      break;
    }
    case 'bomb': {
      push(board.radiusCells(r, c, CFG.specials.bombRadius));
      if (board.fx) {
        board.fx.shockwave(center.x, center.y, board.cell * 2.4, '#ffb4a2');
        board.fx.flash(0.22);
        board.fx.shake(280, 10);
      }
      board.audio && board.audio.play('bomb');
      // 두 번째 폭발: 반경 확대
      board.later(150, () => {
        const wide = board.radiusCells(r, c, CFG.specials.bombSecondRadius);
        board.fx && board.fx.shockwave(center.x, center.y, board.cell * 3.6, '#ffd6c9');
        board.audio && board.audio.play('bomb');
        board.clearCells(wide, { source: 'special', depth: (ctx.depth || 0) + 1 });
      });
      break;
    }
    case 'prop': {
      const arm = CFG.specials.propArm;
      for (let d = 1; d <= arm; d++) {
        if (r - d >= 0) cells.push({ r: r - d, c });
        if (r + d < board.rows) cells.push({ r: r + d, c });
        if (c - d >= 0) cells.push({ r, c: c - d });
        if (c + d < board.cols) cells.push({ r, c: c + d });
      }
      if (board.fx) {
        board.fx.beam(center.x, board.edge('top', c).y, center.x, board.edge('bottom', c).y, '#fde68a', 10);
        board.fx.beam(board.edge('left', r).x, center.y, board.edge('right', r).x, center.y, '#fde68a', 10);
      }
      board.audio && board.audio.play('propeller');
      // 목표 보석 1개로 날아가 파괴
      const targets = board.randomCells(1, (p) => !(p.r === r && p.c === c));
      if (targets.length) {
        const t = targets[0];
        const tp = board.cellCenter(t.r, t.c);
        board.fx && board.fx.flight(center.x, center.y, tp.x, tp.y, '#facc15');
        board.later(220, () => {
          board.clearCells([t], { source: 'special', depth: (ctx.depth || 0) + 1 });
        });
      }
      break;
    }
    case 'hyper': {
      const color = ctx.targetColor != null ? ctx.targetColor : board.mostCommonColor();
      const targets = board.colorCells(color);
      push(targets);
      if (board.fx) {
        board.fx.flash(0.3);
        board.fx.shockwave(center.x, center.y, board.w, '#f9a8d4');
        for (const p of targets.slice(0, 16)) {
          const tp = board.cellCenter(p.r, p.c);
          board.fx.arc([{ x: center.x, y: center.y }, { x: tp.x, y: tp.y }], '#fbcfe8');
        }
      }
      board.audio && board.audio.play('hyper');
      break;
    }
    case 'nova': {
      for (let d = -1; d <= 1; d++) {
        if (r + d >= 0 && r + d < board.rows) push(board.rowCells(r + d));
        if (c + d >= 0 && c + d < board.cols) push(board.colCells(c + d));
      }
      if (board.fx) {
        board.fx.flash(0.45);
        board.fx.shockwave(center.x, center.y, board.w * 1.2, '#d8b4fe');
        board.fx.shake(420, 14);
        board.fx.slowmo(80, 0.35);
      }
      board.audio && board.audio.play('nova');
      break;
    }
    case 'star': {
      push(board.rowCells(r));
      push(board.colCells(c));
      if (board.fx) {
        board.fx.beam(board.edge('left', r).x, center.y, board.edge('right', r).x, center.y, '#fde68a', 14);
        board.fx.beam(center.x, board.edge('top', c).y, center.x, board.edge('bottom', c).y, '#fde68a', 14);
        board.fx.flash(0.3);
        board.fx.shake(320, 11);
      }
      board.audio && board.audio.play('beam');
      break;
    }
    default:
      break;
  }
  return cells;
}

/* ── 특수 + 특수 콤보 스왑 ──────────────────────────────────
   두 특수 보석을 맞바꿨을 때의 강화 효과 */
export async function specialSwapCombo(board, a, b) {
  const A = a.gem, B = b.gem;
  const sa = A.special, sb = B.special;
  const pos = { r: b.r, c: b.c };
  const center = board.cellCenter(pos.r, pos.c);
  const striped = (s) => s === 'row' || s === 'col';
  const work = [];

  // 1) 하이퍼 큐브 조합
  if (sa === 'hyper' && sb === 'hyper') {
    board.fx && board.fx.flash(0.6);
    board.audio && board.audio.play('nova');
    board.clearCells(board.allCells(), { source: 'combo' });
    return true;
  }
  if (sa === 'hyper' || sb === 'hyper') {
    const other = sa === 'hyper' ? b : a;
    const otherSpecial = other.gem.special;
    const color = other.gem.color;
    if (otherSpecial && otherSpecial !== 'hyper') {
      // 그 색 전부를 상대 특수 보석으로 변환 후 발동
      const cells = board.colorCells(color);
      board.convertCells(cells, otherSpecial);
      board.fx && board.fx.flash(0.35);
      board.audio && board.audio.play('hyper');
      await board.delay(120);
      board.clearCells(cells, { source: 'combo' });
    } else {
      // 일반 보석과 교체: 그 색 전부 제거
      const cells = board.colorCells(color);
      board.fx && board.fx.shockwave(center.x, center.y, board.w, '#f9a8d4');
      board.audio && board.audio.play('hyper');
      board.clearCells(cells, { source: 'combo' });
    }
    return true;
  }

  // 2) 슈퍼노바 + 아무 특수: 2배 범위
  if (sa === 'nova' || sb === 'nova') {
    const novaPos = sa === 'nova' ? a : b;
    const nc = board.cellCenter(novaPos.r, novaPos.c);
    for (let d = -2; d <= 2; d++) {
      if (novaPos.r + d >= 0 && novaPos.r + d < board.rows) work.push(...board.rowCells(novaPos.r + d));
      if (novaPos.c + d >= 0 && novaPos.c + d < board.cols) work.push(...board.colCells(novaPos.c + d));
    }
    board.fx && board.fx.flash(0.5);
    board.fx && board.fx.shockwave(nc.x, nc.y, board.w * 1.4, '#e9d5ff');
    board.fx && board.fx.shake(420, 14);
    board.audio && board.audio.play('nova');
    board.clearCells(work, { source: 'combo' });
    return true;
  }

  // 3) 프로펠러 조합
  if (sa === 'prop' && sb === 'prop') {
    // 3개로 분열해 무작위 위치에서 연쇄 발동
    const spots = board.randomCells(3);
    board.fx && board.fx.flash(0.25);
    board.audio && board.audio.play('propeller');
    for (const spot of spots) {
      const sp = board.cellCenter(spot.r, spot.c);
      board.fx && board.fx.flight(center.x, center.y, sp.x, sp.y, '#facc15');
    }
    await board.delay(200);
    for (const spot of spots) {
      board.clearCells(
        [...board.rowCells(spot.r).slice(Math.max(0, spot.c - 2), spot.c + 3),
         ...board.colCells(spot.c).slice(Math.max(0, spot.r - 2), spot.r + 3)],
        { source: 'combo' },
      );
    }
    return true;
  }
  if ((sa === 'prop' && (striped(sb) || sb === 'bomb')) || (sb === 'prop' && (striped(sa) || sa === 'bomb'))) {
    // 프로펠러가 상대 특수를 3개로 복제해 목표 지점에서 발동
    const otherType = sa === 'prop' ? sb : sa;
    const spots = board.randomCells(3);
    board.convertCells(spots, otherType);
    board.fx && board.fx.flash(0.25);
    board.audio && board.audio.play('propeller');
    for (const spot of spots) {
      const sp = board.cellCenter(spot.r, spot.c);
      board.fx && board.fx.flight(center.x, center.y, sp.x, sp.y, '#facc15');
    }
    await board.delay(220);
    board.clearCells(spots, { source: 'combo' });
    return true;
  }

  // 4) 줄 + 폭탄: 3줄 + 3열
  if ((striped(sa) && sb === 'bomb') || (striped(sb) && sa === 'bomb')) {
    const p = sa === 'bomb' ? a : b;
    for (let d = -1; d <= 1; d++) {
      if (p.r + d >= 0 && p.r + d < board.rows) work.push(...board.rowCells(p.r + d));
      if (p.c + d >= 0 && p.c + d < board.cols) work.push(...board.colCells(p.c + d));
    }
    board.fx && board.fx.flash(0.4);
    board.fx && board.fx.shake(360, 12);
    board.audio && board.audio.play('bomb');
    board.clearCells(work, { source: 'combo' });
    return true;
  }

  // 5) 폭탄 + 폭탄: 5×5
  if (sa === 'bomb' && sb === 'bomb') {
    board.fx && board.fx.flash(0.5);
    board.fx && board.fx.shockwave(center.x, center.y, board.cell * 5, '#ffb4a2');
    board.fx && board.fx.shake(420, 15);
    board.audio && board.audio.play('bomb');
    board.clearCells(board.radiusCells(pos.r, pos.c, 2), { source: 'combo' });
    return true;
  }

  // 6) 줄 + 줄: 십자
  if (striped(sa) && striped(sb)) {
    work.push(...board.rowCells(pos.r), ...board.colCells(pos.c));
    board.fx && board.fx.flash(0.32);
    board.audio && board.audio.play('beam');
    board.fx && board.fx.shake(300, 10);
    board.clearCells(work, { source: 'combo' });
    return true;
  }

  return false;
}
