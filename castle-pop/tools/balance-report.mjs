#!/usr/bin/env node
/* =========================================================================
   밸런스 리포트 — 100개 레벨을 200회씩 자동 플레이해 클리어율을 측정한다.
   사용: node tools/balance-report.mjs [--sims 200]
   출력: levels/balance-report.json + 콘솔 요약
   ========================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allLevels, measure, BANDS } from './autoplay-bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SIMS = Number((process.argv.find(a => a.startsWith('--sims=')) || '').split('=')[1]) ||
  Number(process.argv[process.argv.indexOf('--sims') + 1]) || 200;

const levels = allLevels();
const rows = [];
for (const { area, n, level } of levels) {
  const m = await measure(level, SIMS);
  const band = BANDS[level.difficulty] || BANDS.normal;
  const ok = m.clearRate >= band[0] && m.clearRate <= band[1];
  rows.push({
    id: level.id, area, level: n, difficulty: level.difficulty, moves: level.moves,
    clearRate: Math.round(m.clearRate * 1000) / 1000,
    band: [Math.round(band[0] * 100), Math.round(band[1] * 100)],
    inBand: ok, avgMovesLeft: Math.round(m.avgMovesLeft * 10) / 10,
    emptyCellErrors: m.emptyErrors,
  });
}
const byTier = {};
for (const r of rows) {
  const t = r.difficulty;
  byTier[t] = byTier[t] || { n: 0, sum: 0, ok: 0 };
  byTier[t].n++; byTier[t].sum += r.clearRate; if (r.inBand) byTier[t].ok++;
}
const report = {
  generatedAt: new Date().toISOString(),
  simsPerLevel: SIMS,
  engine: 'tools/autoplay-bot.mjs (내장 봇)',
  bands: Object.fromEntries(Object.entries(BANDS).map(([k, v]) => [k, v.map(x => Math.round(x * 100))])),
  summary: {
    levels: rows.length,
    inBand: rows.filter(r => r.inBand).length,
    emptyCellErrors: rows.reduce((s, r) => s + r.emptyCellErrors, 0),
    avgClearAll: Math.round(rows.reduce((s, r) => s + r.clearRate, 0) / rows.length * 1000) / 1000,
    byTier: Object.fromEntries(Object.entries(byTier).map(([k, v]) => [k, {
      levels: v.n, inBand: v.ok, avgClear: Math.round(v.sum / v.n * 1000) / 1000,
    }])),
  },
  levels: rows,
};
fs.writeFileSync(path.join(ROOT, 'levels', 'balance-report.json'), JSON.stringify(report, null, 2) + '\n');

for (const [tier, v] of Object.entries(report.summary.byTier)) {
  console.log(`${tier.padEnd(9)} ${v.levels}개 · 범위 안 ${v.inBand}개 · 평균 클리어율 ${(v.avgClear * 100).toFixed(1)}%`);
}
console.log(`전체 ${rows.length}개 중 ${report.summary.inBand}개가 목표 범위 · 빈 칸 오류 ${report.summary.emptyCellErrors}건`);
const out = rows.filter(r => !r.inBand);
if (out.length) console.log('범위 밖:', out.map(r => `${r.area}-${r.level}(${(r.clearRate * 100).toFixed(0)}%)`).join(' '));
