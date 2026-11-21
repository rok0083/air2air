/* =========================================================================
   파워업 — 4종 생성 효과 + 모든 조합
   blastFor(): 한 파워업이 지우는 칸 목록
   comboEffect(): 두 파워업을 붙였을 때의 효과 (연출 정보 포함)
   ========================================================================= */
import { CFG } from '../config.js';

const K = CFG.combo;

export function inBoard(board, x, y) {
  return x >= 0 && y >= 0 && x < board.cols && y < board.rows;
}

export function mostCommonColor(board, exclude = -1) {
  const count = new Map();
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const g = board.cell(x, y)?.gem;
      if (!g || g.color < 0) continue;
      count.set(g.color, (count.get(g.color) || 0) + 1);
    }
  }
  let best = -1, bestN = -1;
  for (const [c, n] of count) if (n > bestN) { best = c; bestN = n; }
  return best < 0 ? exclude : best;
}

/* 목표와 맞닿은(피해를 줄 수 있는) 장애물 칸들 — 프로펠러/번개 지팡이 목표 */
export function goalObstacleCells(board) {
  const out = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const ob = board.cell(x, y)?.ob;
      if (ob) out.push([x, y]);
    }
  }
  return out;
}

export function nearestObstacle(board, x, y) {
  const list = goalObstacleCells(board);
  if (!list.length) return null;
  list.sort((a, b) => (Math.abs(a[0] - x) + Math.abs(a[1] - y)) - (Math.abs(b[0] - x) + Math.abs(b[1] - y)));
  return list[0];
}

function lineCells(board, x, y, dir, span = null) {
  const out = [];
  if (dir === 'h') {
    const x0 = span ? Math.max(0, x - span) : 0;
    const x1 = span ? Math.min(board.cols - 1, x + span) : board.cols - 1;
    for (let i = x0; i <= x1; i++) out.push([i, y]);
  } else {
    const y0 = span ? Math.max(0, y - span) : 0;
    const y1 = span ? Math.min(board.rows - 1, y + span) : board.rows - 1;
    for (let i = y0; i <= y1; i++) out.push([x, i]);
  }
  return out;
}

function areaCells(board, x, y, radius) {
  const out = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (inBoard(board, x + dx, y + dy)) out.push([x + dx, y + dy]);
    }
  }
  return out;
}

/* 파워업 하나의 효과 범위 */
export function blastFor(board, x, y, kind, opts = {}) {
  const gem = board.cell(x, y)?.gem;
  switch (kind) {
    case 'rocket': {
      const orient = opts.orient || gem?.orient || 'h';
      return { cells: lineCells(board, x, y, orient), kind };
    }
    case 'tnt':
      return { cells: areaCells(board, x, y, CFG.powerups.tnt.radius), kind };
    case 'propeller': {
      const cells = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
        .filter(([a, b]) => inBoard(board, a, b));
      const target = nearestObstacle(board, x, y);
      return { cells, kind, flyTo: target, hit: target };
    }
    case 'light': {
      const color = opts.color ?? mostCommonColor(board);
      const cells = [];
      for (let yy = 0; yy < board.rows; yy++) {
        for (let xx = 0; xx < board.cols; xx++) {
          const g = board.cell(xx, yy)?.gem;
          if (g && g.color === color) cells.push([xx, yy]);
        }
      }
      return { cells, kind, color };
    }
    default:
      return { cells: [[x, y]], kind: 'none' };
  }
}

/* 두 파워업 조합 — cells: 지울 칸, conversions: 그 자리에서 변해 연쇄 발동할 파워업 */
export function comboEffect(board, ax, ay, bx, by) {
  const a = board.cell(ax, ay)?.gem;
  const b = board.cell(bx, by)?.gem;
  if (!a?.power || !b?.power) return null;
  const ka = a.power, kb = b.power;
  const px = bx, py = by;
  const pair = [ka, kb].sort().join('+');

  const out = { cells: [], conversions: [], label: '', key: pair, slowMo: true };

  const add = list => { for (const c of list) out.cells.push(c); };

  const special = (type) => {
    switch (type) {
      case 'rocket+rocket':
        out.label = '크로스 로켓!';
        add(lineCells(board, px, py, 'h'));
        add(lineCells(board, px, py, 'v'));
        break;
      case 'rocket+tnt':
        out.label = '로켓 TNT 세례!';
        for (let d = -1; d <= 1; d++) {
          add(lineCells(board, px + d, py, 'v', 0));
          add(lineCells(board, px, py + d, 'h', 0));
        }
        for (let i = 0; i < K.rocketTntLines; i++) {
          if (inBoard(board, px, py + i)) add(lineCells(board, px, py + i, 'h'));
          if (inBoard(board, px, py - i)) add(lineCells(board, px, py - i, 'h'));
          if (inBoard(board, px + i, py)) add(lineCells(board, px + i, py, 'v'));
          if (inBoard(board, px - i, py)) add(lineCells(board, px - i, py, 'v'));
        }
        break;
      case 'tnt+tnt':
        out.label = '초대형 폭발!';
        add(areaCells(board, px, py, K.tntTntRadius));
        break;
      case 'propeller+rocket':
      case 'propeller+tnt': {
        const heavy = ka === 'propeller' ? kb : ka;
        out.label = heavy === 'tnt' ? '프로펠러 TNT!': '프로펠러 로켓!';
        add([[px, py]]);
        for (let i = 0; i < 3; i++) {
          const target = nearestObstacle(board, px + i * 2, py + i);
          const tx = target ? target[0] : px, ty = target ? target[1] : py;
          if (heavy === 'tnt') add(areaCells(board, tx, ty, 2));
          else { add(lineCells(board, tx, ty, 'h')); add(lineCells(board, tx, ty, 'v')); }
        }
        break;
      }
      case 'propeller+propeller':
        out.label = '프로펠러 3기 출격!';
        for (let i = 0; i < K.propellerCount; i++) {
          const target = nearestObstacle(board, px + i * 3, py);
          const tx = target ? target[0] : px, ty = target ? target[1] : py;
          add([[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1], [tx, ty]]);
        }
        break;
      default: {
        // 빛구슬 + 파워업
        const other = ka === 'light' ? kb : ka;
        out.label = '빛구슬 대폭발!';
        const color = mostCommonColor(board);
        for (let y = 0; y < board.rows; y++) {
          for (let x = 0; x < board.cols; x++) {
            const g = board.cell(x, y)?.gem;
            if (g && g.color === color) {
              out.conversions.push({ x, y, kind: other });
              out.cells.push([x, y]);
            }
          }
        }
        add([[px, py], [ax, ay]]);
        break;
      }
    }
    return out;
  };

  if (ka === 'light' && kb === 'light') {
    out.label = '보드 전체 정화!';
    for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.cols; x++) out.cells.push([x, y]);
    out.fullClear = true;
    return out;
  }
  return special();
}
