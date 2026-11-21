#!/usr/bin/env node
/* 밸런스 목표 범위를 벗어난 레벨만 집중 조정한다.
   사용: node tools/tune-outliers.mjs 1-7 3-11 ...   (인자 없으면 balance-report.json 의 범위 밖 레벨) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLevel, measure, BANDS } from './autoplay-bot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(ROOT, 'levels', 'balance-report.json');
let targets = process.argv.slice(2);
if (!targets.length && fs.existsSync(reportPath)) {
  const rep = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  targets = rep.levels.filter(l => !l.inBand).map(l => `${l.area}-${l.level}`);
}
for (const t of targets) {
  const [area, n] = t.split('-').map(Number);
  const lv = readLevel(area, n);
  const band = BANDS[lv.difficulty] || BANDS.normal;
  let best = { moves: lv.moves, rate: -1 };
  const lo = Math.max(8, lv.moves - 8), hi = Math.min(40, lv.moves + 8);
  for (let mv = lo; mv <= hi; mv++) {
    const r = await measure({ ...lv, moves: mv }, 120);
    const dist = r.clearRate > band[1] ? r.clearRate - band[1] : r.clearRate < band[0] ? band[0] - r.clearRate : 0;
    if (best.rate < 0 || dist < best.dist) best = { moves: mv, rate: r.clearRate, dist };
  }
  // 최종 200회 확인
  let final = await measure({ ...lv, moves: best.moves }, 200);
  let moves = best.moves;
  for (let i = 0; i < 3 && (final.clearRate > band[1] || final.clearRate < band[0]); i++) {
    moves += final.clearRate > band[1] ? -1 : 1;
    if (moves < 8 || moves > 40) break;
    final = await measure({ ...lv, moves }, 200);
  }
  lv.moves = moves;
  lv.tunedClearRate = Math.round(final.clearRate * 1000) / 1000;
  lv.tunedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(ROOT, 'levels', `area${area}`, `level${n}.json`), JSON.stringify(lv, null, 2) + '\n');
  const ok = final.clearRate >= band[0] && final.clearRate <= band[1];
  console.log(`${ok ? 'OK  ' : 'MISS'} ${t} ${lv.difficulty} moves=${moves} clear=${(final.clearRate * 100).toFixed(1)}% (${band[0] * 100}~${band[1] * 100}%)`);
}
