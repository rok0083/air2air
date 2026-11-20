/* =========================================================================
   헥사 블리츠 — 보드 (8×8)
   매치 판정(가로/세로/대각 없음·2×2·+자·L/T) · 특수 보석 생성 · 낙하/보충
   특수 연쇄 반응 · 드롭 아이템 · 캔버스 렌더링
   ========================================================================= */

import { CFG } from './config.js';
import { specialForGroup, activateSpecial, specialSwapCombo, SPECIAL_INFO } from './specials.js';

const ITEM_ICON = {
  time: '⏱', x2: '×2', bolt: '⚡', wild: '🌈', chest: '🎁', ice: '❄', fuse: '💣',
};

export class Board {
  constructor({ canvas, fx, audio, combos, hooks = {} }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fx = fx;
    this.audio = audio;
    this.combos = combos;
    this.hooks = hooks;
    this.rows = CFG.board.rows;
    this.cols = CFG.board.cols;
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.ghosts = [];
    this.score = 0;
    this.cell = 40;
    this.ox = 0;
    this.oy = 0;
    this.w = 1;
    this.h = 1;
    this.hintPair = null;
    this.hintUntil = 0;
    this.selected = null;
    this.busy = false;
    this.startedAt = 0;
    this.lastMoveAt = 0;
    this._lastFrame = 0;
    this._raf = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop = this.loop.bind(this);
    this._raf = requestAnimationFrame(this.loop);
  }

  /* ══════════════ 기본 상태 ══════════════ */
  reset() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.ghosts = [];
    this.score = 0;
    this.selected = null;
    this.busy = false;
    this.hintPair = null;
    this.startedAt = performance.now();
    this.lastMoveAt = this.startedAt;
    this.timeBonusUsed = 0;
    this.itemSerial = 0;
    this.fillBoard();
    this.ensurePlayable();
  }

  fillBoard() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let gem = this.newGem();
        let guard = 0;
        // 시작 보드에 즉시 매치가 생기지 않도록
        while (guard++ < 30 && this.wouldMatchAt(r, c, gem.color)) gem = this.newGem();
        gem.dy = 0;
        this.grid[r][c] = gem;
      }
    }
    // 시작 시 약간의 낙하 연출
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) this.grid[r][c].dy = (this.rows - r) * 0.6;
    }
  }

  wouldMatchAt(r, c, color) {
    const same = (rr, cc) => {
      const g = this.grid[rr] && this.grid[rr][cc];
      return g && !g.wild && g.color === color;
    };
    if (same(r, c - 1) && same(r, c - 2)) return true;
    if (same(r, c + 1) && same(r, c + 2)) return true;
    if (same(r - 1, c) && same(r - 2, c)) return true;
    if (same(r + 1, c) && same(r + 2, c)) return true;
    return false;
  }

  newGem(color = null, opts = {}) {
    const key = color == null ? this.randomColor() : color;
    return {
      id: ++this.itemSerial,
      color: key,
      wild: key < 0,
      special: null,
      item: opts.item || null,
      ice: opts.ice || 0,
      fuse: opts.fuse || 0,
      dx: 0,
      dy: 0,
      vy: 0,
      born: performance.now(),
    };
  }

  randomColor() {
    return Math.floor(Math.random() * CFG.colors.length);
  }

  gemAt(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    return this.grid[r][c];
  }

  setGem(r, c, gem) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return;
    this.grid[r][c] = gem;
  }

  /* ══════════════ 좌표 / 조회 ══════════════ */
  resize() {
    const wrap = this.canvas.parentElement;
    const availW = wrap ? wrap.clientWidth : 320;
    const availH = wrap ? wrap.clientHeight : 320;
    const size = Math.max(160, Math.floor(Math.min(availW, availH)));
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
    const pad = Math.max(4, Math.min(w, h) * 0.012);
    this.cell = Math.min((w - pad * 2) / this.cols, (h - pad * 2) / this.rows);
    this.ox = (w - this.cell * this.cols) / 2;
    this.oy = (h - this.cell * this.rows) / 2;
    if (this.fx) this.fx.resize(w, h);
  }

  cellCenter(r, c) {
    return { x: this.ox + (c + 0.5) * this.cell, y: this.oy + (r + 0.5) * this.cell };
  }

  edge(side, idx) {
    const mid = side === 'left' || side === 'right'
      ? this.oy + (idx + 0.5) * this.cell
      : this.ox + (idx + 0.5) * this.cell;
    if (side === 'left') return { x: this.ox - this.cell, y: mid };
    if (side === 'right') return { x: this.ox + this.cols * this.cell + this.cell, y: mid };
    if (side === 'top') return { x: mid, y: this.oy - this.cell };
    return { x: mid, y: this.oy + this.rows * this.cell + this.cell };
  }

  cellFromPoint(x, y) {
    const c = Math.floor((x - this.ox) / this.cell);
    const r = Math.floor((y - this.oy) / this.cell);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    return { r, c };
  }

  rowCells(r) {
    const out = [];
    for (let c = 0; c < this.cols; c++) out.push({ r, c });
    return out;
  }

  colCells(c) {
    const out = [];
    for (let r = 0; r < this.rows; r++) out.push({ r, c });
    return out;
  }

  radiusCells(r0, c0, radius) {
    const out = [];
    for (let r = r0 - radius; r <= r0 + radius; r++) {
      for (let c = c0 - radius; c <= c0 + radius; c++) {
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) out.push({ r, c });
      }
    }
    return out;
  }

  allCells() {
    const out = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) out.push({ r, c });
    return out;
  }

  colorCells(color) {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const g = this.grid[r][c];
        if (g && !g.wild && g.color === color) out.push({ r, c });
      }
    }
    return out;
  }

  randomCells(n, filter) {
    const pool = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.grid[r][c]) continue;
        if (filter && !filter({ r, c })) continue;
        pool.push({ r, c });
      }
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  }

  mostCommonColor() {
    const counts = new Array(CFG.colors.length).fill(0);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const g = this.grid[r][c];
        if (g && !g.wild) counts[g.color]++;
      }
    }
    let best = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
    return best;
  }

  specialCells() {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const g = this.grid[r][c];
        if (g && g.special) out.push({ r, c });
      }
    }
    return out;
  }

  /* ══════════════ 매치 탐지 ══════════════ */
  colorOf(gem) {
    if (!gem) return null;
    return gem.wild ? -1 : gem.color;
  }

  findGroups() {
    const runs = [];
    // 가로
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const g = this.grid[r][c];
        if (!g) { c++; continue; }
        const color = this.colorOf(g);
        let c2 = c + 1;
        let nonWild = g.wild ? 0 : 1;
        while (c2 < this.cols) {
          const n = this.grid[r][c2];
          if (!n) break;
          const nc = this.colorOf(n);
          if (nc !== -1 && color !== -1 && nc !== color) break;
          if (nc !== -1) nonWild++;
          c2++;
        }
        const len = c2 - c;
        if (len >= 3 && nonWild >= 2) {
          const cells = [];
          for (let k = c; k < c2; k++) cells.push({ r, c: k });
          runs.push({ dir: 'h', cells, maxRun: len, color: color === -1 ? this.dominantColor(cells) : color });
        }
        c = Math.max(c2, c + 1);
      }
    }
    // 세로
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const g = this.grid[r][c];
        if (!g) { r++; continue; }
        const color = this.colorOf(g);
        let r2 = r + 1;
        let nonWild = g.wild ? 0 : 1;
        while (r2 < this.rows) {
          const n = this.grid[r2][c];
          if (!n) break;
          const nc = this.colorOf(n);
          if (nc !== -1 && color !== -1 && nc !== color) break;
          if (nc !== -1) nonWild++;
          r2++;
        }
        const len = r2 - r;
        if (len >= 3 && nonWild >= 2) {
          const cells = [];
          for (let k = r; k < r2; k++) cells.push({ r: k, c });
          runs.push({ dir: 'v', cells, maxRun: len, color: color === -1 ? this.dominantColor(cells) : color });
        }
        r = Math.max(r2, r + 1);
      }
    }

    // 셀 공유 기준으로 run 병합
    const groups = [];
    const cellKey = (p) => p.r * this.cols + p.c;
    for (const run of runs) {
      const keys = new Set(run.cells.map(cellKey));
      let merged = null;
      for (const g of groups) {
        if (g.keys && [...keys].some(k => g.keys.has(k))) { merged = g; break; }
      }
      if (merged) {
        for (const k of keys) merged.keys.add(k);
        merged.cells = mergeCells(merged.cells, run.cells);
        merged.maxRun = Math.max(merged.maxRun, run.maxRun);
        merged.dirs.add(run.dir);
        merged.dir = merged.dirs.size > 1 ? 'cross' : run.dir;
        merged.color = run.color;
      } else {
        groups.push({
          cells: run.cells.slice(),
          keys,
          maxRun: run.maxRun,
          dir: run.dir,
          dirs: new Set([run.dir]),
          color: run.color,
          shape: 'line',
        });
      }
    }
    // 병합 후 모양 판정
    for (const g of groups) {
      const keySet = new Set(g.cells.map(cellKey));
      g.keys = keySet;
      if (g.dirs.size > 1) {
        g.shape = this.hasPlusShape(g, keySet) ? 'plus' : 'lt';
        g.dir = 'lt';
      } else {
        g.shape = 'line';
      }
    }

    // 2×2 사각 매치 (선 매치에 포함되지 않은 셀만)
    const used = new Set();
    groups.forEach(g => g.cells.forEach(p => used.add(cellKey(p))));
    for (let r = 0; r < this.rows - 1; r++) {
      for (let c = 0; c < this.cols - 1; c++) {
        const a = this.grid[r][c], b = this.grid[r][c + 1], d = this.grid[r + 1][c], e = this.grid[r + 1][c + 1];
        if (!a || !b || !d || !e) continue;
        if (a.wild || b.wild || d.wild || e.wild) continue;
        const color = a.color;
        if (b.color !== color || d.color !== color || e.color !== color) continue;
        const cells = [{ r, c }, { r, c: c + 1 }, { r: r + 1, c }, { r: r + 1, c: c + 1 }];
        if (cells.some(p => used.has(cellKey(p)))) continue;
        groups.push({
          cells, keys: new Set(cells.map(cellKey)), maxRun: 2, dir: 'square',
          dirs: new Set(['square']), color, shape: 'square',
        });
        cells.forEach(p => used.add(cellKey(p)));
      }
    }
    return groups;
  }

  dominantColor(cells) {
    const counts = {};
    for (const p of cells) {
      const g = this.grid[p.r][p.c];
      if (g && !g.wild) counts[g.color] = (counts[g.color] || 0) + 1;
    }
    let best = 0, bestN = -1;
    for (const k in counts) if (counts[k] > bestN) { bestN = counts[k]; best = Number(k); }
    return best;
  }

  hasPlusShape(group, keySet) {
    for (const p of group.cells) {
      const g = this.grid[p.r][p.c];
      if (!g) continue;
      const up = this.gemAt(p.r - 1, p.c);
      const down = this.gemAt(p.r + 1, p.c);
      const left = this.gemAt(p.r, p.c - 1);
      const right = this.gemAt(p.r, p.c + 1);
      if (!up || !down || !left || !right) continue;
      const same = [up, down, left, right].every(n => (n.wild || g.wild) || n.color === g.color);
      if (same && [up, down, left, right].every(n => keySet.has(n.__k ?? -1) || keySet.has(this.keyOfGem(n)))) {
        return true;
      }
    }
    return false;
  }

  keyOfGem(gem) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === gem) return r * this.cols + c;
      }
    }
    return -1;
  }

  /* ══════════════ 스왑 ══════════════ */
  isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  canInteract(r, c) {
    const gem = this.gemAt(r, c);
    return !!gem && gem.dy < 0.35;
  }

  async trySwap(r1, c1, r2, c2) {
    if (this.busy) return false;
    if (!this.isAdjacent({ r: r1, c: c1 }, { r: r2, c: c2 })) return false;
    if (!this.canInteract(r1, c1) || !this.canInteract(r2, c2)) return false;
    const a = this.gemAt(r1, c1);
    const b = this.gemAt(r2, c2);
    if (!a || !b) return false;

    this.busy = true;
    this.hintPair = null;
    this.lastMoveAt = performance.now();

    // 데이터 교체 + 시각 오프셋
    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;
    const dx = c2 - c1, dr = r2 - r1;
    b.dx = -dx; b.dy = (b.dy || 0) - dr;
    a.dx = dx; a.dy = (a.dy || 0) + dr;
    this.audio && this.audio.play('swap');
    await this.delay(CFG.anim.swapMs);

    const a2 = this.gemAt(r1, c1);
    const b2 = this.gemAt(r2, c2);
    const specialCombo = a2.special && b2.special;
    const hyperSwap = (a2.special === 'hyper') !== (b2.special === 'hyper');

    if (specialCombo) {
      this.tickFuses();
      await specialSwapCombo(this, { r: r1, c: c1, gem: a2 }, { r: r2, c: c2, gem: b2 });
      await this.settleAfterClear();
      this.busy = false;
      return true;
    }

    if (hyperSwap) {
      const hyperPos = a2.special === 'hyper' ? { r: r1, c: c1 } : { r: r2, c: c2 };
      const other = a2.special === 'hyper' ? b2 : a2;
      this.tickFuses();
      const cells = this.colorCells(other.color);
      this.fx && this.fx.flash(0.35);
      this.fx && this.fx.shockwave(
        this.cellCenter(hyperPos.r, hyperPos.c).x,
        this.cellCenter(hyperPos.r, hyperPos.c).y,
        this.w, '#f9a8d4',
      );
      this.audio && this.audio.play('hyper');
      await this.clearCells(cells, { source: 'special' });
      await this.settleAfterClear();
      this.busy = false;
      return true;
    }

    if (this.findGroups().length) {
      this.tickFuses();
      await this.resolveMatches([{ r: r1, c: c1 }, { r: r2, c: c2 }]);
      await this.settleAfterClear();
      this.busy = false;
      return true;
    }

    // 되돌리기
    this.grid[r1][c1] = a2;
    this.grid[r2][c2] = b2;
    a2.dx = dx; a2.dy = (a2.dy || 0) + dr;
    b2.dx = -dx; b2.dy = (b2.dy || 0) - dr;
    this.audio && this.audio.play('invalid');
    await this.delay(CFG.anim.invalidBackMs + 40);
    a2.dx = 0; a2.dy = 0; b2.dx = 0; b2.dy = 0;
    this.busy = false;
    return false;
  }

  /* 매치 → 특수 보석 생성 → 제거 → 낙하 반복 */
  async resolveMatches(prefer = []) {
    let cascade = 0;
    while (cascade < 40) {
      const groups = this.findGroups();
      if (!groups.length) break;
      cascade++;

      const toClear = [];
      for (const group of groups) {
        const type = specialForGroup(group);
        const pos = this.pickCreationCell(group, prefer);
        this.combos.registerMatch(group.cells.length);
        if (type && pos) {
          const gem = this.gemAt(pos.r, pos.c);
          if (gem) {
            gem.special = type;
            gem.born = performance.now();
            this.addScoreLog(CFG.score.specialCreated);
            this.combos.specialsCreated++;
            const c0 = this.cellCenter(pos.r, pos.c);
            this.fx && this.fx.burst(c0.x, c0.y, SPECIAL_INFO[type].color, 14, { speed: 1.6 });
            this.fx && this.fx.text(c0.x, c0.y, SPECIAL_INFO[type].name, SPECIAL_INFO[type].color, 15);
            this.audio && this.audio.play('special');
          }
        }
        for (const p of group.cells) {
          if (pos && p.r === pos.r && p.c === pos.c && type) continue;
          toClear.push(p);
        }
      }
      prefer = [];
      this.audio && this.audio.play('clear', Math.max(1, this.combos.combo));
      await this.clearCells(toClear, { source: 'match' });

      // 블레이징: 매치마다 인접 폭발
      if (this.combos.isBlaze()) {
        const spot = toClear[Math.floor(Math.random() * Math.max(1, toClear.length))];
        if (spot) {
          this.fx && this.fx.shockwave(
            this.cellCenter(spot.r, spot.c).x, this.cellCenter(spot.r, spot.c).y,
            this.cell * 1.6, '#ffb347',
          );
          await this.clearCells(this.radiusCells(spot.r, spot.c, CFG.blaze.explosionRadius), { source: 'blaze' });
        }
      }

      this.applyGravity();
      this.refill();
      await this.delay(CFG.anim.cascadeDelay + 30);
    }
  }

  pickCreationCell(group, prefer) {
    for (const p of prefer) {
      if (group.cells.some(q => q.r === p.r && q.c === p.c)) return p;
    }
    // +자/L/T 는 교차점, 그 외에는 가운데
    if (group.shape === 'plus' || group.shape === 'lt') {
      const mid = group.cells.find(p => {
        const up = group.cells.some(q => q.r === p.r - 1 && q.c === p.c);
        const down = group.cells.some(q => q.r === p.r + 1 && q.c === p.c);
        const left = group.cells.some(q => q.r === p.r && q.c === p.c - 1);
        const right = group.cells.some(q => q.r === p.r && q.c === p.c + 1);
        return (up || down) && (left || right);
      });
      if (mid) return mid;
    }
    return group.cells[Math.floor(group.cells.length / 2)];
  }

  /* 제거 + 연쇄 반응 (특수 보석이 맞으면 연달아 발동) */
  async clearCells(cells, ctx = {}) {
    const seen = new Set();
    let work = (cells || []).map(p => ({ r: p.r, c: p.c }));
    let waves = 0;
    while (work.length && waves < 60) {
      const wave = work;
      work = [];
      const list = [];
      for (const p of wave) {
        if (p.r < 0 || p.r >= this.rows || p.c < 0 || p.c >= this.cols) continue;
        const key = p.r * this.cols + p.c;
        if (seen.has(key)) continue;
        seen.add(key);
        const gem = this.grid[p.r][p.c];
        if (!gem) continue;
        if (gem.ice > 0) {
          gem.ice--;
          const pos = this.cellCenter(p.r, p.c);
          this.fx && this.fx.burst(pos.x, pos.y, '#bae6fd', 10, { speed: 1.2 });
          this.audio && this.audio.play('tick');
          continue;
        }
        list.push({ r: p.r, c: p.c, gem });
      }
      if (!list.length) break;

      const points = Math.round(list.length * CFG.score.perGem * this.combos.multiplier());
      this.addScore(points);
      if (list.length >= 4) {
        const c0 = this.cellCenter(list[0].r, list[0].c);
        this.fx && this.fx.text(c0.x, c0.y - 18, `+${points}`, '#fff7ae', 16);
      }

      const specials = [];
      for (const { r, c, gem } of list) {
        this.removeGem(r, c, gem);
        if (gem.special) specials.push({ r, c, gem });
      }
      for (const s of specials) {
        const affected = activateSpecial(this, s.r, s.c, s.gem, { ...ctx, depth: (ctx.depth || 0) + 1 });
        for (const p of affected || []) work.push(p);
      }
      waves++;
      await this.delay(40);
    }
  }

  removeGem(r, c, gem) {
    const pos = this.cellCenter(r, c);
    this.grid[r][c] = null;
    this.ghosts.push({
      color: gem.color,
      wild: gem.wild,
      special: gem.special,
      x: pos.x,
      y: pos.y - (gem.dy || 0) * this.cell,
      born: performance.now(),
      scale: 1,
    });
    if (this.ghosts.length > 160) this.ghosts.splice(0, this.ghosts.length - 160);
    const color = gem.wild ? '#ffffff' : (CFG.colors[gem.color] ? CFG.colors[gem.color].base : '#fff');
    this.fx && this.fx.burst(pos.x, pos.y, color, gem.special ? 16 : 8, { speed: gem.special ? 1.8 : 1 });
    if (gem.item) this.collectItem(r, c, gem);
    if (gem.item === 'wild') this.addScoreLog(CFG.score.itemCollected);
  }

  /* ══════════════ 드롭 아이템 ══════════════ */
  collectItem(r, c, gem) {
    const item = gem.item;
    if (!item) return;
    const pos = this.cellCenter(r, c);
    this.addScoreLog(CFG.score.itemCollected);
    this.audio && this.audio.play('item');
    this.fx && this.fx.text(pos.x, pos.y, ITEM_ICON[item] || '?', '#ffe9a8', 20);
    this.fx && this.fx.burst(pos.x, pos.y, '#ffe9a8', 12, { speed: 1.6 });

    switch (item) {
      case 'time': {
        if (this.timeBonusUsed < CFG.time.timeGemMax) {
          this.timeBonusUsed++;
          this.hooks.onTimeBonus && this.hooks.onTimeBonus(CFG.time.timeGemBonus);
          this.audio && this.audio.play('time');
          this.hooks.onToast && this.hooks.onToast(`⏱ 시간 +${CFG.time.timeGemBonus / 1000}초!`, 'good');
        } else {
          this.addScoreLog(CFG.score.perGem * 40);
          this.hooks.onToast && this.hooks.onToast('⏱ 시간 보너스는 최대 3번까지!', 'warn');
        }
        break;
      }
      case 'x2': {
        this.combos.addX2();
        this.hooks.onToast && this.hooks.onToast('×2 점수 10초!', 'good');
        break;
      }
      case 'bolt': {
        const targets = this.randomCells(CFG.items.bolt.targets);
        this.fx && this.fx.flash(0.18);
        this.audio && this.audio.play('bolt');
        for (const t of targets) {
          const tp = this.cellCenter(t.r, t.c);
          this.fx && this.fx.arc([{ x: pos.x, y: pos.y }, { x: tp.x, y: tp.y }], '#fff3a0');
        }
        this.clearCells(targets, { source: 'item' });
        break;
      }
      case 'chest': {
        this.fx && this.fx.flash(0.2);
        this.audio && this.audio.play('special');
        this.spawnRandomSpecials(CFG.items.chest.specials);
        this.hooks.onToast && this.hooks.onToast('🎁 보물 상자! 특수 보석 2개 등장', 'good');
        break;
      }
      case 'wild':
        this.hooks.onToast && this.hooks.onToast('🌈 무지개 보석은 어떤 색과도 맞습니다', 'info');
        break;
      default:
        break;
    }
  }

  spawnRandomSpecials(n) {
    const keys = Object.keys(SPECIAL_INFO);
    const spots = this.randomCells(n);
    spots.forEach((spot, i) => {
      const gem = this.gemAt(spot.r, spot.c);
      if (!gem) return;
      gem.special = keys[Math.floor(Math.random() * keys.length)];
      gem.born = performance.now();
      this.combos.specialsCreated++;
      const pos = this.cellCenter(spot.r, spot.c);
      this.fx && this.fx.burst(pos.x, pos.y, SPECIAL_INFO[gem.special].color, 12, { speed: 1.4 });
    });
  }

  tickFuses() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const gem = this.grid[r][c];
        if (!gem || !gem.fuse) continue;
        gem.fuse--;
        if (gem.fuse <= 0) {
          const pos = this.cellCenter(r, c);
          this.fx && this.fx.flash(0.3);
          this.audio && this.audio.play('bomb');
          this.fx && this.fx.shockwave(pos.x, pos.y, this.cell * 2.4, '#ff9f9f');
          this.hooks.onTimeBonus && this.hooks.onTimeBonus(-CFG.items.fuse.timePenaltyMs);
          this.hooks.onToast && this.hooks.onToast('💣 시한 폭탄 폭발! -3초', 'bad');
          this.clearCells(this.radiusCells(r, c, 1), { source: 'fuse' });
        }
      }
    }
  }

  /* ══════════════ 낙하 / 보충 ══════════════ */
  applyGravity() {
    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        const gem = this.grid[r][c];
        if (!gem) continue;
        if (write !== r) {
          this.grid[write][c] = gem;
          this.grid[r][c] = null;
          gem.dy = (gem.dy || 0) + (write - r);
          gem.vy = 0;
        }
        write--;
      }
    }
  }

  refill() {
    const itemsOnBoard = this.countItems();
    let budget = CFG.items.maxOnBoard - itemsOnBoard;
    for (let c = 0; c < this.cols; c++) {
      let spawnIdx = 0;
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.grid[r][c]) continue;
        const gem = this.newGem();
        gem.dy = r + 1 + spawnIdx;
        gem.vy = 0;
        // 드롭 아이템 부착
        if (budget > 0 && Math.random() < CFG.items.spawnChance) {
          const item = this.pickItemType();
          if (item === 'ice') gem.ice = CFG.items.ice.hits;
          else if (item === 'fuse') gem.fuse = CFG.items.fuse.turns;
          else if (item === 'wild') { gem.wild = true; gem.item = 'wild'; }
          else gem.item = item;
          budget--;
          this.hooks.onItemSpawn && this.hooks.onItemSpawn(item);
        }
        this.grid[r][c] = gem;
        spawnIdx++;
      }
    }
  }

  countItems() {
    let n = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const g = this.grid[r][c];
        if (g && (g.item || g.ice || g.fuse)) n++;
      }
    }
    return n;
  }

  pickItemType() {
    const keys = ['time', 'x2', 'bolt', 'wild', 'chest', 'ice', 'fuse'];
    const weights = keys.map(k => CFG.items[k].chance);
    const total = weights.reduce((a, b) => a + b, 0);
    let rnd = Math.random() * total;
    for (let i = 0; i < keys.length; i++) {
      rnd -= weights[i];
      if (rnd <= 0) return keys[i];
    }
    return 'time';
  }

  /* 제거 후 안정화 */
  async settleAfterClear() {
    this.applyGravity();
    this.refill();
    await this.delay(CFG.anim.clearMs * 0.5);
    // 낙하 후 새로 만들어진 매치까지 처리
    await this.resolveMatches();
    this.applyGravity();
    this.refill();
    await this.delay(60);
  }

  /* ══════════════ 보조 동작 ══════════════ */
  async shuffle() {
    const gems = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) if (this.grid[r][c]) gems.push(this.grid[r][c]);
    }
    let guard = 0;
    do {
      for (let i = gems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gems[i], gems[j]] = [gems[j], gems[i]];
      }
      let i = 0;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) this.grid[r][c] = gems[i++];
      }
      guard++;
    } while (guard < 40 && (this.findGroups().length > 0 || !this.findValidMove()));
    this.fx && this.fx.flash(0.12);
    const pos = this.cellCenter(this.rows >> 1, this.cols >> 1);
    this.fx && this.fx.shockwave(pos.x, pos.y, this.w * 0.7, '#7dd3fc');
    await this.delay(120);
    await this.resolveMatches();
    await this.settleAfterClear();
  }

  async destroyCell(r, c) {
    const gem = this.gemAt(r, c);
    if (!gem) return;
    this.fx && this.fx.burst(this.cellCenter(r, c).x, this.cellCenter(r, c).y, '#fff', 10, { speed: 1.4 });
    await this.clearCells([{ r, c }], { source: 'booster' });
    await this.settleAfterClear();
  }

  async colorBomb(color) {
    const cells = this.colorCells(color);
    this.fx && this.fx.flash(0.3);
    this.audio && this.audio.play('hyper');
    await this.clearCells(cells, { source: 'booster' });
    await this.settleAfterClear();
  }

  convertCells(cells, specialType) {
    for (const p of cells) {
      const gem = this.gemAt(p.r, p.c);
      if (!gem) continue;
      gem.special = specialType;
      gem.born = performance.now();
      const pos = this.cellCenter(p.r, p.c);
      this.fx && this.fx.burst(pos.x, pos.y, SPECIAL_INFO[specialType].color, 6, { speed: 1 });
    }
  }

  addScore(pts) {
    this.score += Math.max(0, Math.round(pts));
    this.hooks.onScore && this.hooks.onScore(this.score);
  }

  addScoreLog(pts) {
    this.addScore(pts * (this.combos ? this.combos.multiplier() : 1));
  }

  /* 유효한 수 찾기 (힌트 / 자동 셔플) */
  findValidMove() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= this.rows || c2 >= this.cols) continue;
          const a = this.grid[r][c], b = this.grid[r2][c2];
          if (!a || !b) continue;
          if (a.special || b.special) return [{ r, c }, { r: r2, c: c2 }];
          this.grid[r][c] = b; this.grid[r2][c2] = a;
          const ok = this.findGroups().length > 0;
          this.grid[r][c] = a; this.grid[r2][c2] = b;
          if (ok) return [{ r, c }, { r: r2, c: c2 }];
        }
      }
    }
    return null;
  }

  ensurePlayable() {
    if (!this.findValidMove()) {
      // 자동 셔플 (연출 없이)
      const gems = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c]) gems.push(this.grid[r][c]);
      let guard = 0;
      do {
        for (let i = gems.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [gems[i], gems[j]] = [gems[j], gems[i]];
        }
        let i = 0;
        for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.grid[r][c] = gems[i++];
        guard++;
      } while (guard < 40 && (this.findGroups().length > 0 || !this.findValidMove()));
    }
  }

  showHint() {
    const pair = this.findValidMove();
    this.hintPair = pair;
    this.hintUntil = performance.now() + CFG.anim.hintPulseMs * 2;
  }

  /* ══════════════ 시간 / 타이머 유틸 ══════════════ */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms * (this.fx ? this.fx.slowFactor() : 1))));
  }

  later(ms, fn) {
    setTimeout(() => { try { fn(); } catch (e) { console.warn(e); } }, Math.max(0, ms));
  }

  /* ══════════════ 렌더 루프 ══════════════ */
  loop(ts) {
    const dt = Math.min(48, ts - (this._lastFrame || ts));
    this._lastFrame = ts;
    this.update(dt);
    this.render();
    this._raf = requestAnimationFrame(this.loop);
  }

  update(dt) {
    const now = performance.now();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const gem = this.grid[r][c];
        if (!gem) continue;
        if (gem.dx) {
          const step = dt / CFG.anim.swapMs;
          gem.dx = Math.abs(gem.dx) <= step ? 0 : gem.dx - Math.sign(gem.dx) * step;
        }
        if (gem.dy) {
          gem.vy = Math.min(CFG.anim.dropMaxSpeed, (gem.vy || 0) + CFG.anim.dropAccel * dt);
          const step = gem.vy * dt;
          if (Math.abs(gem.dy) <= step) { gem.dy = 0; gem.vy = 0; }
          else gem.dy -= Math.sign(gem.dy) * step;
        }
      }
    }
    this.ghosts = this.ghosts.filter(g => now - g.born < CFG.anim.clearMs + 40);
    this.fx && this.fx.update(dt);
    if (this.hintPair && now > this.hintUntil) this.hintPair = null;
  }

  render() {
    const ctx = this.ctx;
    const now = performance.now();
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    const shake = this.fx ? this.fx.shakeOffset() : { x: 0, y: 0 };
    ctx.translate(shake.x, shake.y);

    // 셀 배경
    const pad = this.cell * 0.06;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.ox + c * this.cell + pad;
        const y = this.oy + r * this.cell + pad;
        const size = this.cell - pad * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.042)';
        this.roundRect(ctx, x, y, size, size, this.cell * 0.2);
        ctx.fill();
      }
    }

    // 힌트 강조
    if (this.hintPair) {
      const k = 0.5 + 0.5 * Math.sin(now / 120);
      ctx.save();
      ctx.strokeStyle = `rgba(255,240,150,${0.45 + k * 0.5})`;
      ctx.lineWidth = 3;
      for (const p of this.hintPair) {
        const x = this.ox + p.c * this.cell + pad;
        const y = this.oy + p.r * this.cell + pad;
        this.roundRect(ctx, x, y, this.cell - pad * 2, this.cell - pad * 2, this.cell * 0.22);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 선택 셀
    if (this.selected) {
      const p = this.selected;
      ctx.save();
      ctx.strokeStyle = 'rgba(120,240,255,0.95)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#7dd3fc';
      ctx.shadowBlur = 16;
      this.roundRect(ctx, this.ox + p.c * this.cell + pad, this.oy + p.r * this.cell + pad,
        this.cell - pad * 2, this.cell - pad * 2, this.cell * 0.22);
      ctx.stroke();
      ctx.restore();
    }

    // 보석
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const gem = this.grid[r][c];
        if (!gem) continue;
        const cx = this.ox + (c + 0.5 + (gem.dx || 0)) * this.cell;
        const cy = this.oy + (r + 0.5 - (gem.dy || 0)) * this.cell;
        this.drawGem(ctx, gem, cx, cy, this.cell * 0.44);
      }
    }

    // 사라지는 잔상
    for (const g of this.ghosts) {
      const k = (now - g.born) / CFG.anim.clearMs;
      const scale = 1 - k * 0.7;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      this.drawGem(ctx, { color: g.color, wild: g.wild, special: g.special, born: g.born }, g.x, g.y, this.cell * 0.44 * scale);
      ctx.restore();
    }

    // 특수/아이템 효과 레이어
    this.fx && this.fx.render(ctx);

    // 화염 테두리 (블레이징)
    if (this.combos && this.combos.isBlaze()) {
      const k = 0.5 + 0.5 * Math.sin(now / 90);
      ctx.save();
      const grad = ctx.createLinearGradient(0, 0, this.w, this.h);
      grad.addColorStop(0, `rgba(255,120,40,${0.25 + k * 0.25})`);
      grad.addColorStop(0.5, `rgba(255,210,60,${0.15 + k * 0.2})`);
      grad.addColorStop(1, `rgba(255,80,30,${0.25 + k * 0.25})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 8;
      this.roundRect(ctx, 2, 2, this.w - 4, this.h - 4, 18);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /* ── 보석 그리기 (7가지 모양 + 특수/아이템 표시) ─────────── */
  drawGem(ctx, gem, cx, cy, r) {
    const def = CFG.colors[gem.color] || CFG.colors[0];
    const now = performance.now();
    const pop = Math.min(1, (now - (gem.born || 0)) / 160);
    const scale = 0.82 + pop * 0.18;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 그림자
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    this.shapePath(ctx, gem.wild ? 'hexagon' : def.shape, 0, r * 0.14, r * 0.98);
    ctx.fill();
    ctx.restore();

    // 본체
    const grd = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.15);
    if (gem.wild) {
      const hue = (now / 10) % 360;
      grd.addColorStop(0, `hsl(${(hue + 40) % 360}, 100%, 88%)`);
      grd.addColorStop(0.45, `hsl(${hue}, 95%, 62%)`);
      grd.addColorStop(1, `hsl(${(hue + 200) % 360}, 75%, 38%)`);
    } else {
      grd.addColorStop(0, def.light);
      grd.addColorStop(0.45, def.base);
      grd.addColorStop(1, def.dark);
    }
    this.shapePath(ctx, gem.wild ? 'hexagon' : def.shape, 0, 0, r);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, r * 0.09);
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.stroke();

    // 광택
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.36, r * 0.32, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fill();

    // 특수 보석 장식
    if (gem.special) this.drawSpecialMark(ctx, gem.special, r, now);

    // 얼음
    if (gem.ice > 0) {
      ctx.beginPath();
      this.shapePath(ctx, 'hexagon', 0, 0, r * 0.98);
      ctx.fillStyle = 'rgba(190,235,255,0.42)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,250,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `900 ${r * 0.7}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#eaf8ff';
      ctx.fillText(String(gem.ice), 0, r * 0.25);
    }

    // 시한 폭탄
    if (gem.fuse > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,10,20,0.72)';
      ctx.fill();
      ctx.strokeStyle = '#ff8a8a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.font = `900 ${r * 0.7}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd7d7';
      ctx.fillText(String(gem.fuse), 0, 0);
    }

    // 아이템 배지
    if (gem.item && ITEM_ICON[gem.item]) {
      const bx = r * 0.62, by = -r * 0.62;
      ctx.beginPath();
      ctx.arc(bx, by, r * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8,16,28,0.88)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,235,160,0.9)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.font = `900 ${r * 0.42}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(ITEM_ICON[gem.item], bx, by + 0.5);
    }

    ctx.restore();
  }

  drawSpecialMark(ctx, type, r, now) {
    const info = SPECIAL_INFO[type];
    ctx.save();
    if (type === 'row' || type === 'col') {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      if (type === 'row') {
        ctx.moveTo(-r * 0.7, -r * 0.34);
        ctx.lineTo(r * 0.7, -r * 0.34);
        ctx.moveTo(-r * 0.7, r * 0.34);
        ctx.lineTo(r * 0.7, r * 0.34);
      } else {
        ctx.moveTo(-r * 0.34, -r * 0.7);
        ctx.lineTo(-r * 0.34, r * 0.7);
        ctx.moveTo(r * 0.34, -r * 0.7);
        ctx.lineTo(r * 0.34, r * 0.7);
      }
      ctx.stroke();
    } else if (type === 'bomb') {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.46, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,8,14,0.82)';
      ctx.fill();
      ctx.strokeStyle = '#ffb4a2';
      ctx.lineWidth = r * 0.1;
      ctx.stroke();
      ctx.fillStyle = '#ffd6c9';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'prop') {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      for (let i = 0; i < 4; i++) {
        const a = now / 90 + (Math.PI / 2) * i;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.68, r * 0.16, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = '#1b2330';
      ctx.fill();
    } else if (type === 'hyper') {
      const hue = (now / 8) % 360;
      ctx.strokeStyle = `hsl(${hue}, 100%, 75%)`;
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `hsl(${(hue + 120) % 360}, 100%, 80%)`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'nova') {
      ctx.strokeStyle = '#f5e6ff';
      ctx.lineWidth = r * 0.1;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + now / 500;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
        ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
        ctx.stroke();
      }
    } else if (type === 'star') {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      this.shapePath(ctx, 'star', 0, 0, r * 0.6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,210,61,0.95)';
      this.shapePath(ctx, 'star', 0, 0, r * 0.38);
      ctx.fill();
    }
    ctx.restore();
  }

  shapePath(ctx, shape, cx, cy, r) {
    ctx.beginPath();
    switch (shape) {
      case 'circle':
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
      case 'diamond':
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.82, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r * 0.82, cy);
        ctx.closePath();
        break;
      case 'square': {
        const s = r * 0.82;
        this.roundRect(ctx, cx - s, cy - s, s * 2, s * 2, r * 0.24);
        break;
      }
      case 'triangle':
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.92, cy + r * 0.72);
        ctx.lineTo(cx - r * 0.92, cy + r * 0.72);
        ctx.closePath();
        break;
      case 'hexagon':
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? r : r * 0.45;
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const x = cx + rad * Math.cos(a);
          const y = cy + rad * Math.sin(a);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      case 'heart': {
        const s = r * 0.92;
        ctx.moveTo(cx, cy + s * 0.75);
        ctx.bezierCurveTo(cx - s * 1.25, cy - s * 0.15, cx - s * 0.6, cy - s * 0.95, cx, cy - s * 0.42);
        ctx.bezierCurveTo(cx + s * 0.6, cy - s * 0.95, cx + s * 1.25, cy - s * 0.15, cx, cy + s * 0.75);
        ctx.closePath();
        break;
      }
      default:
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
  }
}

function mergeCells(a, b) {
  const map = new Map();
  for (const p of a) map.set(p.r * 100 + p.c, p);
  for (const p of b) map.set(p.r * 100 + p.c, p);
  return [...map.values()];
}
