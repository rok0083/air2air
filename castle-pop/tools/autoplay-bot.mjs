#!/usr/bin/env node
/* =========================================================================
   자동 플레이 봇 — CASTLE POP 레벨 검증 · 밸런스 측정
   사용:
     node tools/autoplay-bot.mjs --level 1 --sims 200
     node tools/autoplay-bot.mjs --area 1 --sims 200
     node tools/autoplay-bot.mjs --validate             # 100레벨 검증(빈 칸·가능 수)
     node tools/autoplay-bot.mjs --tune --sims 200      # 이동 수 자동 조정 후 저장
     node tools/autoplay-bot.mjs --tune --area 2 --sims 120
   봇은 "보통 실력 플레이어"를 흉내낸다:
     · 55% 확률로 힌트(파워업 생성 우선) 를, 나머지는 목표 근처의 수를 고른다
     · 파워업이 있으면 절반 정도는 바로 발동한다
   ========================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Board } from '../js/core/board.js';
import { validMoves } from '../js/core/match.js';
import { emptyPlayableCells } from '../js/core/gravity.js';
import { CFG } from '../js/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
export const BANDS = {
  normal: [0.70, 0.85],
  hard: [0.40, 0.55],
  veryhard: [0.25, 0.35],
};
const MIN_MOVES = 8;
const MAX_MOVES = 40;

export function readLevel(area, level) {
  const p = path.join(ROOT, 'levels', `area${area}`, `level${level}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeLevel(area, level, data) {
  const p = path.join(ROOT, 'levels', `area${area}`, `level${level}.json`);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

export function allLevels() {
  const out = [];
  for (let area = 1; area <= 5; area++) {
    for (let n = 1; n <= 20; n++) {
      try { out.push({ area, n, level: readLevel(area, n) }); } catch { /* skip */ }
    }
  }
  return out;
}

/* 한 번의 시뮬레이션 */
export async function simulate(level, opts = {}) {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const board = new Board(level, { seed });
  const maxMoves = level.moves;
  let used = 0;
  let guard = 0;
  const rng = mulberry(seed ^ 0x9e3779b9);

  while (board.moves > 0 && !board.goalComplete() && guard++ < 400) {
    // 파워업 발동 기회
    if (rng() < 0.5) {
      const pws = [];
      for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.cols; x++) {
        if (board.cell(x, y)?.gem?.power) pws.push([x, y]);
      }
      if (pws.length) {
        const [x, y] = pws[Math.floor(rng() * pws.length)];
        board.moves--;
        await board.activateAt(x, y, {});
        board.endTurn();
        used++;
        continue;
      }
    }
    const moves = validMoves(board);
    if (!moves.length) { board.shuffle(); continue; }
    let pick;
    if (rng() < 0.55) {
      pick = board.findHint() || { a: moves[0][0], b: moves[0][1] };
    } else {
      pick = { a: moves[Math.floor(rng() * moves.length)][0], b: moves[Math.floor(rng() * moves.length)][1] };
      pick = { a: moves[Math.floor(rng() * moves.length)][0], b: moves[Math.floor(rng() * moves.length)][1] };
      const m = moves[Math.floor(rng() * moves.length)];
      pick = { a: m[0], b: m[1] };
    }
    const res = await board.tryMove(pick.a[0], pick.a[1], pick.b[0], pick.b[1], {});
    used++;
    if (!res.ok) continue;
    board.endTurn();
    // 빈 칸 검증
    if (emptyPlayableCells(board).length) {
      return { won: false, emptyCells: emptyPlayableCells(board).length, movesUsed: used, invalid: true };
    }
  }
  return {
    won: board.goalComplete(),
    movesLeft: board.moves,
    movesUsed: used,
    emptyCells: emptyPlayableCells(board).length,
    goals: board.goals.map(g => `${g.obstacle || g.type}:${g.done}/${g.need}`),
  };
}

export async function measure(level, sims = 200) {
  let wins = 0, emptyErrors = 0, movesLeftSum = 0;
  const seedBase = (level.area || 1) * 10000 + (level.level || 1) * 97;
  for (let i = 0; i < sims; i++) {
    const r = await simulate(level, { seed: seedBase + i * 7919 });
    if (r.emptyCells) emptyErrors++;
    if (r.won) { wins++; movesLeftSum += r.movesLeft || 0; }
  }
  return { clearRate: wins / sims, wins, sims, emptyErrors, avgMovesLeft: wins ? movesLeftSum / wins : 0 };
}

/* 이동 수 자동 조정 — 목표 클리어율 범위에 들어오게 */
export async function tune(level, opts = {}) {
  const sims = opts.sims ?? 60;
  const band = BANDS[level.difficulty] || BANDS.normal;
  const original = level.moves;
  let lo = MIN_MOVES, hi = MAX_MOVES;
  let best = null;
  const evaluated = new Map();

  // 이분 탐색: 이동 수가 늘면 클리어율이 오른다
  for (let iter = 0; iter < 7; iter++) {
    const mid = Math.round((lo + hi) / 2);
    if (evaluated.has(mid)) break;
    const lv = { ...level, moves: mid };
    const m = await measure(lv, sims);
    evaluated.set(mid, m);
    if (m.clearRate >= band[0] && m.clearRate <= band[1]) { best = { moves: mid, m }; break; }
    if (m.clearRate > band[1]) hi = mid - 1; else lo = mid + 1;
    if (lo > hi) break;
  }
  if (!best) {
    // 범위에 못 들어가면 가장 가까운 값
    let bestDist = Infinity;
    for (const [mv, m] of evaluated) {
      const target = (band[0] + band[1]) / 2;
      const d = Math.abs(m.clearRate - target);
      if (d < bestDist) { bestDist = d; best = { moves: mv, m }; }
    }
  }
  if (!best) best = { moves: original, m: await measure(level, sims) };
  // 최종 200회 검증 + 벗어나면 ±1 로 한 번 더 보정
  let finalMoves = best.moves;
  let finalM = await measure({ ...level, moves: finalMoves }, 200);
  for (let fix = 0; fix < 2; fix++) {
    if (finalM.clearRate > band[1] && finalMoves > MIN_MOVES) {
      finalMoves--;
      finalM = await measure({ ...level, moves: finalMoves }, 200);
    } else if (finalM.clearRate < band[0] && finalMoves < MAX_MOVES) {
      finalMoves++;
      finalM = await measure({ ...level, moves: finalMoves }, 200);
    } else break;
  }
  return { moves: finalMoves, band, measured: finalM, evaluated: [...evaluated.entries()].length };
}

export async function validate(level) {
  const b = new Board(level, { seed: level.seed || 7 });
  const empties = emptyPlayableCells(b).length;
  const moves = validMoves(b).length;
  const haveObstacles = (level.obstacles || []).length;
  const goalTotal = (level.goals || []).reduce((s, g) => s + (g.count || 0), 0);
  return {
    ok: empties === 0 && moves > 0 && goalTotal > 0,
    empties, moves, haveObstacles, goalTotal,
    cols: b.cols, rows: b.rows, colors: b.colorCount,
  };
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- CLI */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const sims = Number(get('--sims', 200));
  const areaArg = get('--area', null);
  const levelArg = get('--level', null);

  const targets = [];
  if (levelArg && areaArg) targets.push({ area: Number(areaArg), n: Number(levelArg) });
  else if (areaArg) for (let n = 1; n <= 20; n++) targets.push({ area: Number(areaArg), n });
  else for (let a = 1; a <= 5; a++) for (let n = 1; n <= 20; n++) targets.push({ area: a, n });

  if (args.includes('--validate')) {
    let bad = 0;
    for (const t of targets) {
      const lv = readLevel(t.area, t.n);
      const v = await validate(lv);
      if (!v.ok) { bad++; console.log(`FAIL ${t.area}-${t.n}`, JSON.stringify(v)); }
    }
    console.log(`검증: ${targets.length}개 중 실패 ${bad}개`);
    process.exit(bad ? 1 : 0);
  }

  if (args.includes('--tune')) {
    const summary = [];
    for (const t of targets) {
      const lv = readLevel(t.area, t.n);
      const r = await tune(lv, { sims: Math.min(sims, 60) });
      lv.moves = r.moves;
      lv.tunedClearRate = Math.round(r.measured.clearRate * 1000) / 1000;
      lv.tunedAt = new Date().toISOString().slice(0, 10);
      writeLevel(t.area, t.n, lv);
      const ok = r.measured.clearRate >= r.band[0] && r.measured.clearRate <= r.band[1];
      summary.push({ level: `${t.area}-${t.n}`, difficulty: lv.difficulty, moves: r.moves, rate: r.measured.clearRate, ok });
      console.log(`${ok ? 'OK  ' : 'CHECK'} ${t.area}-${t.n} ${lv.difficulty} moves=${r.moves} clear=${(r.measured.clearRate * 100).toFixed(1)}% (목표 ${(r.band[0] * 100)}~${(r.band[1] * 100)}%)`);
    }
    fs.writeFileSync(path.join(ROOT, 'levels', 'balance-report.json'), JSON.stringify({
      generatedAt: new Date().toISOString(), sims, bands: BANDS, levels: summary,
    }, null, 2) + '\n');
    const oks = summary.filter(s => s.ok).length;
    console.log(`\n밸런스: ${summary.length}개 중 목표 범위 ${oks}개`);
    process.exit(0);
  }

  for (const t of targets) {
    const lv = readLevel(t.area, t.n);
    const m = await measure(lv, sims);
    console.log(`${t.area}-${t.n} ${lv.difficulty.padEnd(8)} moves=${String(lv.moves).padStart(2)} clear=${(m.clearRate * 100).toFixed(1)}% avgLeft=${m.avgMovesLeft.toFixed(1)} emptyErr=${m.emptyErrors}`);
  }
}
