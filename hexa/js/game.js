/* =========================================================================
   헥사(HEXA) — 게임 엔진
   6×13 보드 · 3개 세로 블록 · 가로/세로/대각선 3매치 · 연쇄 · 피버 · 레벨
   ========================================================================= */

import {
  COLS, ROWS, CONFIG, COLORS, colorsForLevel, dropIntervalForLevel, COLOR_KEYS,
} from './config.js';
import {
  GOOD_ITEMS, GOOD_BY_ID, OBSTACLES, OBSTACLE_BY_ID, SFX, pickGoodItemId, pickObstacleId,
} from './items.js';

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const easeOut = t => 1 - Math.pow(1 - t, 3);

export class HexaGame {
  constructor({ boardCanvas, nextCanvas, hooks = {} }) {
    this.boardCanvas = boardCanvas;
    this.nextCanvas = nextCanvas;
    this.hooks = hooks;
    this.ctx = boardCanvas.getContext('2d');
    this.nctx = nextCanvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.rows = ROWS;
    this.cols = COLS;
    this.state = 'idle';
    this.time = 0;
    this.timers = [];
    this.resetState();
    this.boardCanvas.addEventListener('pointerdown', e => this._onPointer(e));
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame(t => this._frame(t));
  }

  /* ─────────────────────────── 상태 초기화 ─────────────────────────── */
  resetState() {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.piece = null;
    this.queue = [];
    this.score = 0;
    this.level = 1;
    this.chain = 0;
    this.maxChain = 0;
    this.totalGems = 0;
    this.inventory = [];
    this.itemsUsed = 0;
    this.feverGauge = 0;
    this.feverUntil = 0;
    this.shield = false;
    this.busy = false;
    this.paused = false;
    this.effects = {
      freeze: 0, slow: 0, boost: 0, future: 0, speedUp: 0, dark: 0, invert: 0,
      confusion: 0, confusionMap: null,
    };
    this.particles = [];
    this.popups = [];
    this.banners = [];
    this.lasers = [];
    this.sparks = [];
    this.dropAcc = 0;
    this.shakeUntil = 0;
    this.flashUntil = 0;
    this.pickMode = null;
    this.pickAt = 0;
    this.nextObstacleAt = 0;
    this.startedAt = 0;
    this.timers = [];
    this.floatText = null;
  }

  /* ─────────────────────────── 시작 / 종료 ─────────────────────────── */
  start({ name, roomCode }) {
    this.resetState();
    this.name = name;
    this.roomCode = roomCode || 'global';
    this.state = 'running';
    this.startedAt = performance.now();
    this.time = 0;
    this.nextObstacleAt = performance.now() + CONFIG.obstacles.startDelayMs;
    this.ensureQueue();
    this.spawn();
    this.emitHud();
    this.emitInventory();
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.emitHud();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.emitHud();
  }

  gameOver(reason = 'blocked') {
    if (this.state === 'over') return;
    if (this.shield) {
      this.shield = false;
      SFX.play('shield');
      this.toast('쉴드 발동! 위쪽 5줄 정리', 'good');
      this.showBanner('SHIELD!', '게임 오버 1회 방지', '#93c5fd');
      for (let r = 0; r < 5; r++) for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c]) { this.particlesAt(r, c, '#bfdbfe', 8); this.grid[r][c] = null; }
      }
      this.applyGravity();
      this.shake(420);
      this.flashUntil = performance.now() + 260;
      this.emitInventory();
      this.after(220, () => { if (this.state === 'running') this.spawn(true); });
      return;
    }
    this.state = 'over';
    this.piece = null;
    SFX.play('gameover');
    this.shake(600);
    const result = {
      name: this.name,
      score: this.score,
      level: this.level,
      maxChain: this.maxChain,
      itemsUsed: this.itemsUsed,
      gems: this.totalGems,
      playTimeSec: Math.max(1, Math.round((performance.now() - this.startedAt) / 1000)),
      roomCode: this.roomCode,
      reason,
    };
    if (this.hooks.onGameOver) this.hooks.onGameOver(result);
  }

  /* ─────────────────────────── 타이머 ─────────────────────────── */
  now() { return performance.now(); }
  after(ms, fn) { this.timers.push({ at: performance.now() + ms, fn }); }

  _runTimers() {
    if (!this.timers.length) return;
    const now = performance.now();
    const due = [];
    this.timers = this.timers.filter(t => {
      if (t.at <= now) { due.push(t); return false; }
      return true;
    });
    for (const t of due) { try { t.fn(); } catch (e) { console.warn('timer', e); } }
  }

  /* ─────────────────────────── 블록 / 보드 ─────────────────────────── */
  colors() { return colorsForLevel(this.level); }

  ensureQueue() {
    while (this.queue.length < 8) {
      const colors = this.colors();
      const piece = [0, 1, 2].map(() => colors[Math.floor(Math.random() * colors.length)]);
      this.queue.push(piece);
    }
  }

  spawn(fromShield = false) {
    this.ensureQueue();
    const col = Math.floor((COLS - 1) / 2);
    const colors = this.queue.shift();
    this.ensureQueue();
    const piece = { col, row: 2, colors: colors.slice() };
    // 맨 위 줄(중앙 열)이 막혀 있으면 게임 오버
    const blocked = [0, 1, 2].some(r => this.grid[r][col]);
    if (blocked) { this.piece = piece; this.gameOver('blocked'); return; }
    this.piece = piece;
    this.dropAcc = 0;
    this.emitNext();
  }

  cellAt(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return this.grid[r][c];
  }

  setCell(r, c, cell) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    this.grid[r][c] = cell;
  }

  pieceCells(piece, row = piece.row, col = piece.col) {
    return piece.colors.map((color, i) => ({ r: row - 2 + i, c: col, color }));
  }

  canPlace(piece, row, col) {
    if (col < 0 || col >= COLS) return false;
    for (let i = 0; i < 3; i++) {
      const r = row - 2 + i;
      if (r >= ROWS) return false;
      if (r < 0) continue;
      if (this.grid[r][col]) return false;
    }
    return true;
  }

  move(dir) {
    if (this.state !== 'running' || !this.piece || this.busy) return;
    const d = this.isActive('invert') ? -dir : dir;
    if (this.canPlace(this.piece, this.piece.row, this.piece.col + d)) {
      this.piece.col += d;
      SFX.play('move');
    }
  }

  rotate() {
    if (this.state !== 'running' || !this.piece || this.busy) return;
    const c = this.piece.colors;
    this.piece.colors = [c[2], c[0], c[1]];
    SFX.play('rotate');
  }

  softDrop() {
    if (this.state !== 'running' || !this.piece || this.busy) return;
    if (this.canPlace(this.piece, this.piece.row + 1, this.piece.col)) {
      this.piece.row++;
      this.dropAcc = 0;
    } else {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (this.state !== 'running' || !this.piece || this.busy) return;
    while (this.canPlace(this.piece, this.piece.row + 1, this.piece.col)) this.piece.row++;
    SFX.play('drop');
    this.shake(90);
    this.lockPiece();
  }

  lockPiece() {
    if (!this.piece) return;
    const cells = this.pieceCells(this.piece);
    for (const { r, c, color } of cells) {
      if (r >= 0 && r < ROWS) this.grid[r][c] = { color, wild: false, stone: false, lock: 0, born: this.now() };
    }
    SFX.play('lock');
    this.piece = null;
    this.busy = true;
    this.chain = 0;
    this.resolve({ chain: 1, delay: 90 });
  }

  /* ─────────────────────────── 매치 판정 ─────────────────────────── */
  _extends(prev, cell) {
    if (!prev || prev.stone) return false;
    if (cell.wild && prev.wild) return true;
    if (cell.wild || prev.wild) return true;
    return prev.color === cell.color;
  }

  _runFrom(r, c, dr, dc) {
    const start = this.grid[r][c];
    if (!start || start.stone) return null;
    const cells = [];
    let color = start.wild ? null : start.color;
    let nonWild = 0;
    let rr = r, cc = c;
    while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
      const cell = this.grid[rr][cc];
      if (!cell || cell.stone) break;
      if (cell.wild) {
        cells.push({ r: rr, c: cc });
      } else {
        if (color === null) color = cell.color;
        if (cell.color !== color) break;
        cells.push({ r: rr, c: cc });
        nonWild++;
      }
      rr += dr; cc += dc;
    }
    if (cells.length >= 3 && nonWild >= 2) {
      return { cells, color: color || 'rainbow', diag: dr !== 0 && dc !== 0 };
    }
    return null;
  }

  findRuns() {
    const runs = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid[r][c];
        if (!cell || cell.stone) continue;
        for (const [dr, dc] of DIRS) {
          const pr = r - dr, pc = c - dc;
          const prev = this.cellAt(pr, pc);
          if (this._extends(prev, cell)) continue;
          const run = this._runFrom(r, c, dr, dc);
          if (run) runs.push(run);
        }
      }
    }
    return runs;
  }

  resolve(opts = {}) {
    const chain = opts.chain || 1;
    const delay = opts.delay == null ? 120 : opts.delay;
    this.after(delay, () => this._matchStep(chain));
  }

  _matchStep(chain) {
    if (this.state === 'paused') { this.after(120, () => this._matchStep(chain)); return; }
    if (this.state !== 'running') { this.busy = false; return; }
    const runs = this.findRuns();
    if (!runs.length) {
      this.chain = 0;
      this.busy = false;
      this.emitHud();
      this.after(70, () => {
        if (this.state === 'running' && !this.piece && !this.busy) this.spawn();
      });
      return;
    }

    const chainIdx = Math.min(chain - 1, CONFIG.score.chainTable.length - 1);
    const chainMult = CONFIG.score.chainTable[chainIdx];
    this.chain = chain;
    if (chain > this.maxChain) this.maxChain = chain;

    const all = new Map();
    let points = 0;
    for (const run of runs) {
      const len = run.cells.length;
      let mult = chainMult;
      if (len >= 4) mult *= CONFIG.score.fourPlusBonus;
      if (run.diag) mult *= CONFIG.score.diagonalBonus;
      points += len * CONFIG.score.perGem * this.level * mult;
      for (const p of run.cells) all.set(p.r * COLS + p.c, p);
    }
    points *= this.scoreMultiplier();

    const cells = [...all.values()];
    const removed = this.removeCells(cells, { score: false, points, chain });
    if (removed <= 0) {
      // 모두 잠금 보석이었던 경우
      this.busy = false;
      this.after(60, () => { if (this.state === 'running' && !this.piece) this.spawn(); });
      return;
    }

    SFX.play('clear', chain);
    this.flashUntil = this.now() + 120;
    if (chain >= 2) {
      this.popups.push({
        text: `${chain} CHAIN!`, x: this.boardCanvas.clientWidth / 2,
        y: this.boardCanvas.clientHeight * 0.42, life: 1, born: this.now(),
        color: chain >= 4 ? '#ffd23d' : chain >= 3 ? '#7dd3fc' : '#ffffff',
        size: Math.min(48, 24 + chain * 4),
      });
      this.shake(90 + chain * 20);
    }

    // 피버 게이지 충전
    if (!this.isFever()) {
      this.feverGauge = Math.min(CONFIG.fever.max,
        this.feverGauge + removed * CONFIG.fever.gainPerGem + chain * CONFIG.fever.gainPerChain);
      if (this.feverGauge >= CONFIG.fever.max) this.startFever();
    }

    // 아이템 생성
    const chance = Math.min(
      CONFIG.items.dropMaxChance,
      CONFIG.items.dropBaseChance + (chain - 1) * CONFIG.items.dropChainBonus,
    );
    if (Math.random() < chance) this.grantItem(pickGoodItemId(), chain);

    this.emitHud();

    this.after(150, () => {
      this.applyGravity();
      this.after(120, () => this._matchStep(chain + 1));
    });
  }

  /* 보석 제거 (잠금 보석은 내구도 감소) */
  removeCells(cells, opts = {}) {
    const { score = true, points = null, chain = 1, spark = true } = opts;
    const uniq = new Map();
    for (const p of cells) {
      if (!p) continue;
      const { r, c } = p;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (!this.grid[r][c]) continue;
      uniq.set(r * COLS + c, { r, c });
    }
    let removed = 0;
    const cleared = [];
    for (const { r, c } of uniq.values()) {
      const cell = this.grid[r][c];
      if (!cell) continue;
      if (cell.lock > 0) {
        cell.lock--;
        this.particlesAt(r, c, '#86efac', 5);
        continue;
      }
      const colKey = cell.wild ? 'rainbow' : cell.color;
      this.grid[r][c] = null;
      removed++;
      cleared.push({ r, c });
      if (spark) this.particlesAt(r, c, (COLORS[colKey] || COLORS.stone).base, CONFIG.visuals.particlesPerGem);
    }

    // 인접한 돌 블록 파괴
    const stoneKill = new Set();
    for (const { r, c } of cleared) {
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const cell = this.cellAt(r + dr, c + dc);
        if (cell && cell.stone) stoneKill.add((r + dr) * COLS + (c + dc));
      }
    }
    for (const key of stoneKill) {
      const r = Math.floor(key / COLS), c = key % COLS;
      if (this.grid[r][c] && this.grid[r][c].stone) {
        this.grid[r][c] = null;
        this.particlesAt(r, c, COLORS.stone.light, 8);
      }
    }

    if (removed > 0) {
      if (score) {
        this.addScore(points != null ? points : removed * CONFIG.score.perGem * this.level);
      } else if (points != null) {
        this.addScore(points);
      }
      this.totalGems += removed;
      this.checkLevelUp();
    }
    return removed;
  }

  clearRow(r) {
    if (r < 0 || r >= ROWS) return;
    const cells = [];
    for (let c = 0; c < COLS; c++) cells.push({ r, c });
    this.removeCells(cells, { score: true });
  }

  clearCol(c) {
    if (c < 0 || c >= COLS) return;
    const cells = [];
    for (let r = 0; r < ROWS; r++) cells.push({ r, c });
    this.removeCells(cells, { score: true });
  }

  clearArea(r0, c0, radius) {
    const cells = [];
    for (let r = r0 - radius; r <= r0 + radius; r++) {
      for (let c = c0 - radius; c <= c0 + radius; c++) cells.push({ r, c });
    }
    this.removeCells(cells, { score: true });
  }

  applyGravity() {
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const cell = this.grid[r][c];
        if (cell) {
          if (r !== write) {
            this.grid[write][c] = cell;
            this.grid[r][c] = null;
          }
          write--;
        }
      }
    }
  }

  addScore(points) {
    const add = Math.round(points);
    if (!(add > 0)) return;
    this.score += add;
    this.emitHud();
  }

  checkLevelUp() {
    let leveled = false;
    while (this.totalGems >= this.level * CONFIG.levels.gemsPerLevel && this.level < CONFIG.levels.maxLevel) {
      this.level++;
      leveled = true;
    }
    if (leveled) {
      SFX.play('levelup');
      this.showBanner(`LEVEL ${this.level}`, this.level >= CONFIG.levels.extraColorFrom
        ? '7가지 색의 보석이 등장합니다!' : '보석 30개마다 레벨 업!', '#ffd23d');
      this.flashUntil = this.now() + 200;
      if (Math.random() < CONFIG.obstacles.levelUpChance) this.triggerObstacle();
      this.emitHud();
    }
  }

  /* ─────────────────────────── 피버 ─────────────────────────── */
  isFever() { return this.now() < this.feverUntil; }
  isActive(name) { return this.now() < (this.effects[name] || 0); }
  scoreMultiplier() {
    let m = 1;
    if (this.isFever()) m *= CONFIG.fever.multiplier;
    if (this.isActive('boost')) m *= CONFIG.effects.boostFactor;
    return m;
  }

  startFever() {
    this.feverUntil = this.now() + CONFIG.fever.durationMs;
    this.feverGauge = CONFIG.fever.max;
    SFX.play('fever');
    this.showBanner('FEVER!', '10초간 점수 ×3', '#ff5fd2');
    this.shake(500);
    this.emitHud();
  }

  startEffect(name, ms, data) {
    this.effects[name] = this.now() + ms;
    if (name === 'confusion' && data) this.effects.confusionMap = data.map || null;
    this.emitHud();
  }

  setShield(on) {
    this.shield = !!on;
    this.emitHud();
  }

  /* ─────────────────────────── 아이템 ─────────────────────────── */
  grantItem(itemId, chain) {
    const item = GOOD_BY_ID[itemId];
    if (!item) return;
    if (this.inventory.length >= CONFIG.items.inventory) {
      const oldest = this.inventory.shift();
      this.toast(`인벤토리 가득! ${GOOD_BY_ID[oldest.id] ? GOOD_BY_ID[oldest.id].name : ''} 자동 발동`, 'info');
      this.after(60, () => this.fireItem(oldest.id, true));
    }
    this.inventory.push({ id: itemId, at: this.now() });
    this.emitInventory();
    if (this.hooks.onItem) this.hooks.onItem(item, false);
  }

  useItem(index) {
    if (this.state !== 'running') return;
    const slot = this.inventory[index];
    if (!slot) { SFX.play('ui'); return; }
    this.inventory.splice(index, 1);
    this.emitInventory();
    this.fireItem(slot.id, false);
  }

  fireItem(itemId, auto) {
    const item = GOOD_BY_ID[itemId];
    if (!item) return;
    this.itemsUsed++;
    this.toast(`${item.icon} ${item.name}${auto ? ' (자동)' : ''}`, 'item');
    if (item.sfx) SFX.play(item.sfx);
    try { item.apply(this); } catch (e) { console.warn('item failed', itemId, e); }
    this.emitHud();
    this.emitInventory();
    if (this.hooks.onItemUsed) this.hooks.onItemUsed(item, auto);
  }

  makeNextPieceSameColor() {
    const colors = this.colors();
    const color = colors[Math.floor(Math.random() * colors.length)];
    if (this.queue[0]) this.queue[0] = [color, color, color];
    this.emitNext();
    this.toast(`${COLORS[color].name} 3개가 다음 블록!`, 'good');
  }

  shuffleBoard() {
    const positions = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] && !this.grid[r][c].stone) positions.push({ r, c });
      }
    }
    if (positions.length < 3) return;
    const pool = positions.map(({ r, c }) => this.grid[r][c]);
    const backup = pool.slice();
    for (let attempt = 0; attempt < 40; attempt++) {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      positions.forEach(({ r, c }, i) => { this.grid[r][c] = pool[i]; });
      if (this.findRuns().length === 0) return;
    }
    positions.forEach(({ r, c }, i) => { this.grid[r][c] = backup[i]; });
  }

  pickCell(cb, timeoutMs) {
    this.pickMode = cb;
    this.pickAt = performance.now() + (timeoutMs || 6000);
    this.toast('보드를 터치해 보석을 고르세요', 'info');
  }

  _onPointer(e) {
    if (!this.pickMode) return;
    const rect = this.boardCanvas.getBoundingClientRect();
    const g = this.layout();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor((x - g.ox) / g.cell);
    const r = Math.floor((y - g.oy) / g.cell);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    if (!this.grid[r][c]) return;
    const cb = this.pickMode;
    this.pickMode = null;
    cb(r, c);
  }

  anchor() {
    const col = this.piece ? this.piece.col : Math.floor((COLS - 1) / 2);
    let row = this.piece ? this.piece.row : ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r][col]) continue;
      row = r;
      break;
    }
    return { r: Math.max(0, Math.min(ROWS - 1, row)), c: col };
  }

  /* ─────────────────────────── 방해 아이템 ─────────────────────────── */
  triggerObstacle(forceId) {
    if (this.state !== 'running') return;
    const id = forceId || pickObstacleId();
    const ob = OBSTACLE_BY_ID[id];
    if (!ob) return;
    SFX.play('obstacle');
    this.toast(`${ob.icon} 방해! ${ob.name}`, 'bad');
    try { ob.apply(this); } catch (e) { console.warn('obstacle failed', id, e); }
    this.applyGravity();
    this.shake(320);
    const now = performance.now();
    const interval = Math.max(
      CONFIG.obstacles.minIntervalMs,
      CONFIG.obstacles.intervalMs - (this.level - 1) * CONFIG.obstacles.perLevelMs,
    );
    this.nextObstacleAt = now + interval;
    this.emitHud();
  }

  checkTopOut() {
    const col = Math.floor((COLS - 1) / 2);
    if (this.grid[0][col] || this.grid[1][col] || this.grid[2][col]) this.gameOver('rise');
  }

  /* ─────────────────────────── 연출 헬퍼 ─────────────────────────── */
  toast(text, kind = 'info') {
    if (this.hooks.onToast) this.hooks.onToast(text, kind);
  }

  showBanner(text, sub, color) {
    this.banners.push({ text, sub, color: color || '#fff', born: this.now(), life: CONFIG.visuals.bannerMs });
    if (this.banners.length > 2) this.banners.shift();
  }

  shake(ms = CONFIG.visuals.shakeMs) {
    this.shakeUntil = Math.max(this.shakeUntil, this.now() + ms);
  }

  particlesAt(r, c, color, count = 6) {
    const g = this.layout();
    const cx = g.ox + (c + 0.5) * g.cell;
    const cy = g.oy + (r + 0.5) * g.cell;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 1.6) * (g.cell / 22);
      this.particles.push({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6,
        life: 1, decay: 0.012 + Math.random() * 0.02,
        size: g.cell * (0.08 + Math.random() * 0.13), color,
      });
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  }

  laserEffect(dir, index) {
    this.lasers.push({ dir, index, born: this.now(), life: 420 });
  }

  lightningEffect(cells) {
    this.sparks.push({ cells: cells.slice(0, 12), born: this.now(), life: 380 });
  }

  /* ─────────────────────────── 루프 ─────────────────────────── */
  _frame(t) {
    const dt = Math.min(50, t - (this._last || t));
    this._last = t;
    this.time = t;
    this._runTimers();
    this._update(dt);
    this.render();
    requestAnimationFrame(tt => this._frame(tt));
  }

  _update(dt) {
    const now = performance.now();

    // 연출 수명
    for (const p of this.particles) {
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.vy += dt * 0.0016;
      p.vx *= 0.995;
      p.life -= p.decay * dt * 0.06;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    this.popups = this.popups.filter(p => now - p.born < CONFIG.visuals.popupMs);
    this.banners = this.banners.filter(b => now - b.born < b.life);
    this.lasers = this.lasers.filter(l => now - l.born < l.life);
    this.sparks = this.sparks.filter(s => now - s.born < s.life);

    if (this.pickMode && now > this.pickAt) {
      this.pickMode = null;
      this.toast('망치 시간이 끝났습니다', 'warn');
    }

    if (this.state !== 'running') return;

    // 피버 게이지 소모 (HUD는 10fps로만 갱신)
    if (this.isFever()) {
      const remain = this.feverUntil - now;
      this.feverGauge = Math.max(0, CONFIG.fever.max * (remain / CONFIG.fever.durationMs));
      if (remain <= 0) { this.feverGauge = 0; this.emitHud(); }
      else if (now > (this._feverHudAt || 0)) { this._feverHudAt = now + 100; this.emitHud(); }
    }

    // 방해 아이템 스케줄
    if (now >= this.nextObstacleAt && !this.busy) this.triggerObstacle();

    // 낙하
    if (this.piece && !this.busy) {
      if (this.isActive('freeze')) {
        this.dropAcc = 0;
      } else {
        this.dropAcc += dt;
        const interval = this.dropInterval();
        if (this.dropAcc >= interval) {
          this.dropAcc = 0;
          if (this.canPlace(this.piece, this.piece.row + 1, this.piece.col)) {
            this.piece.row++;
          } else {
            this.lockPiece();
          }
        }
      }
    }
  }

  dropInterval() {
    let ms = dropIntervalForLevel(this.level);
    if (this.isActive('slow')) ms /= CONFIG.effects.slowFactor;
    if (this.isActive('speedUp')) ms /= CONFIG.effects.speedUpFactor;
    return Math.max(60, ms);
  }

  /* ─────────────────────────── 레이아웃 / 렌더 ─────────────────────────── */
  resize() {
    const setup = (canvas) => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    };
    this._boardSize = setup(this.boardCanvas);
    this._nextSize = setup(this.nextCanvas);
  }

  layout() {
    const cw = this._boardSize ? this._boardSize.w : this.boardCanvas.clientWidth;
    const ch = this._boardSize ? this._boardSize.h : this.boardCanvas.clientHeight;
    const pad = 6;
    const cell = Math.max(4, Math.min((cw - pad * 2) / COLS, (ch - pad * 2) / ROWS));
    const ox = (cw - cell * COLS) / 2;
    const oy = (ch - cell * ROWS) / 2;
    return { cell, ox, oy, cw, ch };
  }

  render() {
    if (!this._boardSize || this._boardSize.w !== this.boardCanvas.clientWidth) this.resize();
    const g = this.layout();
    if (g.cw < 40 || g.ch < 40) return; // 화면에 보이지 않을 때는 그리지 않음
    const ctx = this.ctx;
    const now = performance.now();

    ctx.clearRect(0, 0, g.cw, g.ch);
    ctx.save();
    if (now < this.shakeUntil) {
      const k = (this.shakeUntil - now) / CONFIG.visuals.shakeMs;
      ctx.translate((Math.random() - 0.5) * 9 * k, (Math.random() - 0.5) * 9 * k);
    }

    // 보드 격자
    const r0 = Math.round(g.cell * 0.08);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = g.ox + c * g.cell, y = g.oy + r * g.cell;
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        this.roundRect(ctx, x + r0, y + r0, g.cell - r0 * 2, g.cell - r0 * 2, g.cell * 0.18);
        ctx.fill();
      }
    }

    // 보석
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid[r][c];
        if (!cell) continue;
        this.drawGem(ctx, g, r, c, cell);
      }
    }

    // 낙하 중 블록
    if (this.piece) {
      const ghost = this.ghostRow();
      for (const { r, c, color } of this.pieceCells(this.piece, ghost, this.piece.col)) {
        if (r >= 0) this.drawGhost(ctx, g, r, c, color);
      }
      for (const { r, c, color } of this.pieceCells(this.piece)) {
        if (r >= 0) this.drawGem(ctx, g, r, c, { color, wild: false }, true);
      }
    }

    // 레이저
    for (const l of this.lasers) {
      const k = 1 - (now - l.born) / l.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      if (l.dir === 'h') {
        const y = g.oy + l.index * g.cell + g.cell / 2;
        const grad = ctx.createLinearGradient(g.ox, y, g.ox + g.cell * COLS, y);
        grad.addColorStop(0, 'rgba(56,189,248,0)');
        grad.addColorStop(0.5, 'rgba(240,255,255,0.95)');
        grad.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(g.ox, y - g.cell * 0.18 * k - 2, g.cell * COLS, g.cell * 0.36 * k + 4);
      } else {
        const x = g.ox + l.index * g.cell + g.cell / 2;
        const grad = ctx.createLinearGradient(x, g.oy, x, g.oy + g.cell * ROWS);
        grad.addColorStop(0, 'rgba(34,211,238,0)');
        grad.addColorStop(0.5, 'rgba(240,255,255,0.95)');
        grad.addColorStop(1, 'rgba(34,211,238,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - g.cell * 0.18 * k - 2, g.oy, g.cell * 0.36 * k + 4, g.cell * ROWS);
      }
      ctx.restore();
    }

    // 번개
    for (const s of this.sparks) {
      const k = 1 - (now - s.born) / s.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      ctx.strokeStyle = '#fff7ae';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 14;
      for (const { r, c } of s.cells) {
        const x = g.ox + (c + 0.5) * g.cell;
        const y = g.oy + (r + 0.5) * g.cell;
        ctx.beginPath();
        ctx.moveTo(x, g.oy - 10);
        let yy = g.oy - 10, xx = x + (Math.random() - 0.5) * g.cell;
        while (yy < y) {
          yy += g.cell * 0.7;
          xx += (Math.random() - 0.5) * g.cell * 0.8;
          ctx.lineTo(xx, Math.min(yy, y));
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 파티클
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 어둠 효과
    if (this.isActive('dark')) {
      const h = g.oy + g.cell * Math.ceil(ROWS / 2);
      const grad = ctx.createLinearGradient(0, g.oy, 0, h);
      grad.addColorStop(0, 'rgba(2,6,16,0.94)');
      grad.addColorStop(1, 'rgba(2,6,16,0.78)');
      ctx.fillStyle = grad;
      ctx.fillRect(g.ox - 4, g.oy - 4, g.cell * COLS + 8, h - g.oy + 16);
    }

    // 피버 연출
    if (this.isFever()) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 120);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,80,200,${0.05 + pulse * 0.06})`;
      ctx.fillRect(0, 0, g.cw, g.ch);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = `rgba(255,120,220,${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, g.cw - 4, g.ch - 4);
      ctx.restore();
    }

    // 망치(아이템 지정) 표시
    if (this.pickMode) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,200,80,0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(g.ox - 2, g.oy - 2, g.cell * COLS + 4, g.cell * ROWS + 4);
      ctx.restore();
    }

    // 배너
    for (const b of this.banners) {
      const k = (now - b.born) / b.life;
      const alpha = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      const scale = 1 + Math.sin(Math.min(1, k * 3) * Math.PI) * 0.06;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(g.cw / 2, g.ch * 0.34);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(3,10,20,0.55)';
      const tw = Math.max(220, b.text.length * 26 + 60);
      this.roundRect(ctx, -tw / 2, -46, tw, b.sub ? 96 : 70, 18);
      ctx.fill();
      ctx.font = '900 40px "Pretendard", system-ui, sans-serif';
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 22;
      ctx.fillText(b.text, 0, 0);
      ctx.shadowBlur = 0;
      if (b.sub) {
        ctx.font = '600 16px "Pretendard", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText(b.sub, 0, 30);
      }
      ctx.restore();
    }

    // CHAIN 팝업
    for (const p of this.popups) {
      const k = (now - p.born) / CONFIG.visuals.popupMs;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.translate(p.x, p.y - k * 40);
      const scale = 1 + easeOut(Math.min(1, k * 3)) * 0.15;
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.font = `900 ${p.size}px "Pretendard", system-ui, sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(4,12,24,0.85)';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }

    // 화면 플래시
    if (now < this.flashUntil) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, (this.flashUntil - now) / 240) * 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, g.cw, g.ch);
      ctx.restore();
    }

    ctx.restore();
    this.renderNext();
  }

  ghostRow() {
    if (!this.piece) return 0;
    let row = this.piece.row;
    while (this.canPlace(this.piece, row + 1, this.piece.col)) row++;
    return row;
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

  renderColor(color, cell) {
    if (color === 'rainbow') return 'rainbow';
    if (cell && this.isActive('confusion') && this.effects.confusionMap) {
      return this.effects.confusionMap[color] || color;
    }
    return color;
  }

  drawGem(ctx, g, r, c, cell, isPiece = false) {
    const cx = g.ox + (c + 0.5) * g.cell;
    const cy = g.oy + (r + 0.5) * g.cell;
    const rr = g.cell * 0.44;

    if (cell.stone) {
      this.hexPath(ctx, cx, cy, rr * 0.95);
      const grd = ctx.createLinearGradient(cx - rr, cy - rr, cx + rr, cy + rr);
      grd.addColorStop(0, '#9aa6b6');
      grd.addColorStop(0.5, '#6c7889');
      grd.addColorStop(1, '#434d5c');
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,26,36,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220,230,245,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - rr * 0.4, cy - rr * 0.2);
      ctx.lineTo(cx + rr * 0.1, cy + rr * 0.35);
      ctx.lineTo(cx + rr * 0.45, cy - rr * 0.3);
      ctx.stroke();
      return;
    }

    const key = this.renderColor(cell.wild ? 'rainbow' : cell.color, cell);
    let base, light, dark;
    if (key === 'rainbow') {
      const hue = (this.now() / 12) % 360;
      base = `hsl(${hue}, 95%, 62%)`;
      light = `hsl(${(hue + 60) % 360}, 100%, 88%)`;
      dark = `hsl(${(hue + 200) % 360}, 70%, 34%)`;
    } else {
      const def = COLORS[key] || COLORS.red;
      base = def.base; light = def.light; dark = def.dark;
    }

    // 바닥 그림자
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.hexPath(ctx, cx, cy + rr * 0.12, rr * 0.98);
    ctx.fill();
    ctx.restore();

    // 몸통
    this.hexPath(ctx, cx, cy, rr);
    const grd = ctx.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.12, cx, cy, rr * 1.15);
    grd.addColorStop(0, light);
    grd.addColorStop(0.45, base);
    grd.addColorStop(1, dark);
    ctx.fillStyle = grd;
    ctx.fill();

    // 테두리
    ctx.lineWidth = Math.max(1.2, g.cell * 0.035);
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.stroke();

    // 광택
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx - rr * 0.26, cy - rr * 0.34, rr * 0.34, rr * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fill();
    ctx.restore();

    // 중심 반짝임
    ctx.beginPath();
    ctx.arc(cx + rr * 0.12, cy + rr * 0.1, rr * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();

    // 잠금 표시
    if (cell.lock > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#1b2330';
      ctx.lineWidth = Math.max(2, g.cell * 0.07);
      ctx.beginPath();
      ctx.arc(cx, cy, rr * 0.55, -0.2, Math.PI + 0.2);
      ctx.stroke();
      ctx.strokeStyle = cell.lock > 1 ? '#86efac' : '#fbbf24';
      ctx.lineWidth = Math.max(1.6, g.cell * 0.045);
      ctx.beginPath();
      ctx.arc(cx, cy, rr * 0.55, -0.2, Math.PI + 0.2);
      ctx.stroke();
      ctx.restore();
    }

    if (isPiece) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.4;
      this.hexPath(ctx, cx, cy, rr * 0.99);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawGhost(ctx, g, r, c, color) {
    const cx = g.ox + (c + 0.5) * g.cell;
    const cy = g.oy + (r + 0.5) * g.cell;
    const rr = g.cell * 0.44;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = (COLORS[color] || COLORS.red).base;
    this.hexPath(ctx, cx, cy, rr);
    ctx.fill();
    ctx.restore();
  }

  hexPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  previewCount() {
    return this.isActive('future') ? CONFIG.effects.futurePreviews : 2;
  }

  renderNext() {
    const g = this._nextSize || { w: this.nextCanvas.clientWidth, h: this.nextCanvas.clientHeight };
    const ctx = this.nctx;
    if (!g || !g.w) return;
    ctx.clearRect(0, 0, g.w, g.h);
    const count = this.previewCount();
    const slot = g.w / count;
    const gem = Math.min(slot * 0.62, g.h / 3.6) / 2;
    for (let i = 0; i < count; i++) {
      const piece = this.queue[i];
      if (!piece) continue;
      const cx = slot * (i + 0.5);
      const cy = g.h / 2;
      const alpha = i === 0 ? 1 : Math.max(0.42, 1 - i * 0.16);
      ctx.save();
      ctx.globalAlpha = alpha;
      piece.forEach((color, k) => {
        const y = cy + (k - 1) * (gem * 1.85);
        const def = COLORS[color] || COLORS.red;
        const grd = ctx.createRadialGradient(cx - gem * 0.3, y - gem * 0.35, gem * 0.1, cx, y, gem * 1.1);
        grd.addColorStop(0, def.light);
        grd.addColorStop(0.5, def.base);
        grd.addColorStop(1, def.dark);
        this.hexPath(ctx, cx, y, gem);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      if (i === 0) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = 'rgba(120,240,255,0.8)';
        ctx.lineWidth = 1.5;
        this.roundRect(ctx, slot * i + 4, 4, slot - 8, g.h - 8, 10);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ─────────────────────────── HUD / 인벤토리 ─────────────────────────── */
  hudState() {
    return {
      score: this.score,
      level: this.level,
      chain: this.chain,
      maxChain: this.maxChain,
      remaining: Math.max(0, this.level * CONFIG.levels.gemsPerLevel - this.totalGems),
      perLevel: CONFIG.levels.gemsPerLevel,
      fever: this.feverGauge / CONFIG.fever.max,
      feverActive: this.isFever(),
      shield: this.shield,
      effects: {
        freeze: this.isActive('freeze'),
        slow: this.isActive('slow'),
        boost: this.isActive('boost'),
        future: this.isActive('future'),
        speedUp: this.isActive('speedUp'),
        dark: this.isActive('dark'),
        invert: this.isActive('invert'),
        confusion: this.isActive('confusion'),
      },
      state: this.state,
      paused: this.state === 'paused',
    };
  }

  emitHud() { if (this.hooks.onHud) this.hooks.onHud(this.hudState()); }
  emitInventory() { if (this.hooks.onInventory) this.hooks.onInventory(this.inventory.map(s => s.id)); }
  emitNext() { /* renderNext 는 매 프레임 그립니다 */ }
}
