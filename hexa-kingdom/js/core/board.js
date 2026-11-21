/* =========================================================================
   보드(Board) — 매치3 퍼즐의 핵심 로직 (DOM 없이 동작)
   -------------------------------------------------------------------------
   · 교체 → 매치 → 특수 보석 생성 → 제거 → 낙하 → 연쇄
   · 장애물 피해 / 목표 진행 / 보스 HP / 아이템 드롭
   · 부스터(망치·드릴·폭탄·마법모자) 사용
   · 렌더러(js/ui/boardview.js)는 이 객체의 grid 와 anims 를 읽어 그립니다.
   ========================================================================= */
import { CFG } from '../config.js';
import { RNG } from './rng.js';
import { findMatches, withPreferredSpawn } from './match.js';
import { applyGravity } from './gravity.js';
import { findHint } from './hint.js';
import { shuffleGrid } from './shuffle.js';
import { makeObstacle, OBSTACLES, debrisColor } from '../obstacles/index.js';
import { Goals } from '../goals/index.js';
import {
  effectCells, comboPlan, makePowerupTile, POWERUPS, inBounds,
} from '../powerups/index.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const K = (r, c) => r + ',' + c;
let tileSeq = 1;

export class Board {
  constructor(level, hooks = {}) {
    this.level = level;
    this.cols = level.cols ?? CFG.board.cols;
    this.rows = level.rows ?? CFG.board.rows;
    this.colorCount = Math.min(level.colors ?? 5, 6);
    this.rng = new RNG(level.seed ?? 12345);
    this.hooks = hooks;
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.obstacles = new Map();
    this.voids = new Set((level.voids || []).map(([r, c]) => K(r, c)));
    this.goals = new Goals(level);
    this.boss = level.boss ? { ...level.boss, hp: level.boss.hp, maxHp: level.boss.hp } : null;
    this.moves = level.moves ?? 20;
    this.score = 0;
    this.state = 'idle';
    this.busy = false;
    this.anims = [];
    this.cascade = 0;
    this.turn = 0;
    this.dropSpawnsLeft = this.goals.list.find(g => g.type === 'drop')?.total ?? 0;
    this.itemsCollected = 0;
    this.hintCells = null;
    this.lastSwap = null;
    this.stats = { moves: 0, powerupsCreated: 0, powerupActivations: 0, maxCascade: 0, tilesCleared: 0, obstaclesCleared: 0, bossDamage: 0 };
    this.slowmo = false;
    this.zoom = 1;
    this.flash = 0;
    this.shake = 0;
    this.pendingFx = [];
  }

  /* ── 초기화 ────────────────────────────────────────────── */
  async init(opts = {}) {
    // 1) 장애물
    for (const spec of (this.level.cells || [])) {
      if (!inBounds(this, spec.r, spec.c)) continue;
      const obs = makeObstacle(spec, this);
      this.obstacles.set(K(spec.r, spec.c), obs);
    }
    // 2) 보석 채우기(즉시 매치 없이)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.isBlockedCell(r, c)) continue;
        this.grid[r][c] = this.makeTile(this.safeColor(r, c));
      }
    }
    // 3) 레벨에 지정된 특수 보석/아이템
    for (const p of (this.level.presets || [])) {
      if (this.isBlockedCell(p.r, p.c)) continue;
      this.grid[p.r][p.c] = makePowerupTile(p.type, p.color ?? this.rng.int(this.colorCount), p.dir || 'h');
    }
    for (const it of (this.level.items || [])) {
      if (this.isBlockedCell(it.r, it.c)) continue;
      const t = this.grid[it.r][it.c] || this.makeTile();
      t.item = it.item || 'seed';
      this.grid[it.r][it.c] = t;
    }
    // 4) 시작 부스터
    if (opts.startRocket) this.placeStartPowerup('rocket', opts.startRocket);
    if (opts.startTnt) this.placeStartPowerup('tnt', opts.startTnt);
    if (opts.startSpinner) this.placeStartPowerup('spinner', opts.startSpinner);

    // 5) 가능한 수 보장
    if (!this.hasMove()) shuffleGrid(this);
    this.state = 'playing';
    this.hooks.onReady?.(this);
  }

  makeTile(color) {
    const c = color ?? this.rng.int(this.colorCount);
    return { id: 't' + (tileSeq++), color: c, pu: null, item: null };
  }

  /* 초기 배치에서 3연속이 생기지 않는 색 고르기 */
  safeColor(r, c) {
    const bad = new Set();
    if (c >= 2 && this.grid[r][c - 1] && this.grid[r][c - 2] && this.grid[r][c - 1].color === this.grid[r][c - 2].color) bad.add(this.grid[r][c - 1].color);
    if (r >= 2 && this.grid[r - 1][c] && this.grid[r - 2][c] && this.grid[r - 1][c].color === this.grid[r - 2][c].color) bad.add(this.grid[r - 1][c].color);
    const opts = [];
    for (let i = 0; i < this.colorCount; i++) if (!bad.has(i)) opts.push(i);
    return this.rng.pick(opts.length ? opts : [0]);
  }

  isBlockedCell(r, c) {
    if (this.voids.has(K(r, c))) return true;
    const o = this.obstacles.get(K(r, c));
    return !!o && !o.dead && o.blocksTile;
  }

  obstacleAt(r, c) {
    const o = this.obstacles.get(K(r, c));
    return o && !o.dead ? o : null;
  }

  moveObstacle(r, c, nr, nc) {
    const o = this.obstacles.get(K(r, c));
    if (!o) return;
    if (this.obstacles.has(K(nr, nc))) return;
    this.obstacles.delete(K(r, c));
    o.r = nr; o.c = nc;
    this.obstacles.set(K(nr, nc), o);
  }

  hasAnyMatch() {
    return findMatches(this.grid, this.cols, this.rows).length > 0;
  }

  hasMove() {
    return !!findHint(this);
  }

  findHintMove() {
    return findHint(this);
  }

  /* ── 교체 ─────────────────────────────────────────────── */
  async trySwap(r1, c1, r2, c2) {
    if (this.busy || this.state !== 'playing') return false;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
    const t1 = this.grid[r1][c1];
    const t2 = this.grid[r2][c2];
    if (!t1 || !t2) return false;

    this.busy = true;
    this.hintCells = null;
    this.grid[r1][c1] = t2;
    this.grid[r2][c2] = t1;
    this.anims.push(
      { kind: 'move', tile: t1, from: { r: r1, c: c1 }, to: { r: r2, c: c2 }, t0: performance.now(), dur: CFG.anim.swap },
      { kind: 'move', tile: t2, from: { r: r2, c: c2 }, to: { r: r1, c: c1 }, t0: performance.now(), dur: CFG.anim.swap },
    );
    this.hooks.onSwap?.(r1, c1, r2, c2);
    await sleep(CFG.anim.swap);

    const puSwap = !!(t1.pu || t2.pu);
    const groups = findMatches(this.grid, this.cols, this.rows, { squares: true });

    if (!puSwap && groups.length === 0) {
      // 되돌리기
      this.grid[r1][c1] = t1;
      this.grid[r2][c2] = t2;
      this.anims.push(
        { kind: 'move', tile: t1, from: { r: r2, c: c2 }, to: { r: r1, c: c1 }, t0: performance.now(), dur: CFG.anim.swapBack, ease: 'inout' },
        { kind: 'move', tile: t2, from: { r: r1, c: c1 }, to: { r: r2, c: c2 }, t0: performance.now(), dur: CFG.anim.swapBack, ease: 'inout' },
      );
      this.hooks.onInvalidSwap?.(r1, c1, r2, c2);
      await sleep(CFG.anim.swapBack);
      this.busy = false;
      this.hooks.onStateChange?.(this.state);
      return false;
    }

    this.lastSwap = { a: { r: r1, c: c1 }, b: { r: r2, c: c2 } };
    this.moves--;
    this.turn++;
    this.stats.moves++;

    if (puSwap) {
      if (t1.pu && t2.pu) await this.activateCombo({ r: r1, c: c1, tile: t2 }, { r: r2, c: c2, tile: t1 });
      else {
        const cell = t1.pu ? { r: r2, c: c2, tile: t1 } : { r: r1, c: c1, tile: t2 };
        const other = t1.pu ? { r: r1, c: c1, tile: t2 } : { r: r2, c: c2, tile: t1 };
        await this.detonate([cell], other.tile?.color);
        await this.collapse();
        await this.resolveBoard(0);
      }
    } else {
      withPreferredSpawn(groups, { r: r1, c: c1 }, { r: r2, c: c2 });
      await this.resolveBoard(0, groups);
    }

    await this.endTurn();
    this.busy = false;
    this.hooks.onStateChange?.(this.state);
    return true;
  }

  /* ── 매치 처리 루프 ────────────────────────────────────── */
  async resolveBoard(startCascade = 0, preGroups = null) {
    let cascade = startCascade;
    let groups = preGroups || findMatches(this.grid, this.cols, this.rows);
    let guard = 0;
    while (groups.length && guard++ < 48) {
      cascade++;
      this.cascade = cascade;
      this.stats.maxCascade = Math.max(this.stats.maxCascade, cascade);
      this.hooks.onCascade?.(cascade);
      if (cascade >= 2) this.hooks.onComboBanner?.(cascade);
      await this.applyGroups(groups, cascade);
      await this.collapse();
      // 목표를 모두 채웠다면(승리) 더 연쇄를 만들지 않고 여기서 멈춘다.
      // (여기서 멈추지 않으면 같은 매치를 무한히 다시 찾게 됩니다.)
      if (this.state !== 'playing') break;
      groups = findMatches(this.grid, this.cols, this.rows);
      if (groups.length) await sleep(CFG.anim.cascadeGap);
    }
    this.cascade = 0;
    this.checkGoals();
  }

  async applyGroups(groups, cascade) {
    for (const g of groups) {
      // 이미 승리/패배가 확정돼도 "지금 터진 매치"는 끝까지 정리합니다.
      await this.applyGroup(g, cascade);
    }
  }

  async applyGroup(group, cascade) {
    const spawn = group.spawn;
    const spawnTile = this.grid[spawn.r]?.[spawn.c];
    const canSpawn = group.type && spawnTile && !spawnTile.pu;

    const clearList = [];
    const chain = [];
    for (const [r, c] of group.cells) {
      const t = this.grid[r][c];
      if (!t) continue;
      if (canSpawn && r === spawn.r && c === spawn.c) continue;
      if (t.pu) chain.push({ r, c, tile: t });
      else clearList.push({ r, c, tile: t });
    }

    // 특수 보석 생성
    if (canSpawn) {
      const color = group.color;
      const pu = makePowerupTile(group.type, color, group.dir || 'h');
      this.grid[spawn.r][spawn.c] = pu;
      this.anims.push({ kind: 'pucreate', r: spawn.r, c: spawn.c, t0: performance.now(), dur: 420, type: group.type });
      this.stats.powerupsCreated++;
      this.score += CFG.score.powerupCreate;
      this.hooks.onPowerupCreate?.(group.type, spawn.r, spawn.c, group.dir);
    }

    // 같은 그룹의 기존 특수 보석은 연쇄 발동
    if (chain.length) await this.detonate(chain, group.color);

    if (clearList.length) await this.clearCells(clearList, { cascade, group, spawn });
    this.hooks.onScore?.(this.score, { cascade });
  }

  /* ── 제거 ─────────────────────────────────────────────── */
  async clearCells(list, meta = {}) {
    const cascade = meta.cascade || 1;
    const mult = 1 + CFG.score.cascadeStep * (cascade - 1);
    let gained = 0;
    const adjacentObstacles = new Map();
    const center = meta.spawn || (list[0] ? { r: list[0].r, c: list[0].c } : null);

    for (const { r, c, tile } of list) {
      const cur = this.grid[r]?.[c];
      if (!cur || cur !== tile) continue;
      const obsHere = this.obstacleAt(r, c);
      let slow = false;
      if (obsHere?.overlay) {
        obsHere.onAdjacentMatch({ cause: 'own' });
        if (obsHere.def.slow) slow = true;
      }
      // 인접 장애물 수집(그룹당 1회 피해)
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        const o = this.obstacleAt(nr, nc);
        if (o && !o.overlay) adjacentObstacles.set(o.cell, o);
      }
      this.grid[r][c] = null;
      this.anims.push({ kind: 'pop', tile, r, c, t0: performance.now(), dur: CFG.anim.clear, color: tile.color, pu: tile.pu });
      this.goals.onTileCleared(tile);
      gained += CFG.score.perTile * mult * (slow ? 0.7 : 1);
      this.stats.tilesCleared++;
      if (this.boss) this.damageBoss(CFG.score.bossPerTile, 'tile');
      if (tile.item) this.collectItem(r, c, tile);
      this.hooks.onClear?.(tile, r, c, { cascade, center });
      await sleep(CFG.anim.clearStagger);
    }

    for (const o of adjacentObstacles.values()) o.onAdjacentMatch({ cause: 'adjacent' });

    this.score += Math.round(gained);
    this.hooks.onScore?.(this.score, { gained, cascade });
    if (gained > 400) { this.shake = Math.min(6, gained / 400); this.hooks.onShake?.(this.shake); }
    this.checkGoals();
    await sleep(CFG.anim.clear - CFG.anim.clearStagger * Math.min(list.length, 6));
  }

  /* ── 특수 보석 발동 + 연쇄 ─────────────────────────────── */
  async detonate(initial, refColor) {
    const queue = initial.slice();
    const cleared = new Map();
    const processed = new Set();
    let depth = 0;
    let obsHits = new Map();

    while (queue.length && depth < CFG.powerups.chainDepth) {
      depth++;
      const item = queue.pop();
      const t = this.grid[item.r]?.[item.c];
      if (!t || !t.pu) continue;
      const k = K(item.r, item.c);
      if (processed.has(k)) continue;
      processed.add(k);

      const pu = t.pu;
      this.stats.powerupActivations++;
      this.score += CFG.score.powerupActivate;
      if (this.boss) this.damageBoss(CFG.score.bossPerPowerup, 'powerup');
      this.hooks.onPowerupActivate?.(pu.type, item.r, item.c, t.color);
      const cells = effectCells(this, t, item.r, item.c, refColor ?? t.color);
      this.hooks.onPowerupFx?.(pu.type, item.r, item.c, cells, t.color);
      if (pu.type === 'tnt' || pu.type === 'electro') { this.flash = 0.5; this.hooks.onFlash?.(0.5); }
      if (pu.type === 'tnt') { this.shake = 8; this.hooks.onShake?.(8); }

      for (const [r, c] of cells) {
        const tt = this.grid[r][c];
        if (tt) {
          if (tt.pu && !processed.has(K(r, c))) queue.push({ r, c });
          cleared.set(K(r, c), { r, c, tile: tt });
        } else {
          const o = this.obstacleAt(r, c);
          if (o) obsHits.set(o.cell, o);
        }
      }
      cleared.set(k, { r: item.r, c: item.c, tile: t });
      if (depth > 1) await sleep(40);
    }

    for (const o of obsHits.values()) o.onPowerupHit({ cause: 'powerup' });

    if (cleared.size) {
      const cascade = Math.max(2, Math.min(6, Math.ceil(cleared.size / 8)));
      await this.clearCells([...cleared.values()].filter(({ r, c, tile }) => this.grid[r]?.[c] === tile), { cascade, center: initial[0] ? { r: initial[0].r, c: initial[0].c } : null });
      this.hooks.onBigBlast?.(cleared.size);
    }
  }

  /* 두 특수 보석 콤보 */
  async activateCombo(a, b) {
    const mid = { r: Math.round((a.r + b.r) / 2), c: Math.round((a.c + b.c) / 2) };
    const plan = comboPlan(this, a, b, mid);
    this.flash = plan.flash || 0.4;
    this.hooks.onFlash?.(this.flash);
    this.hooks.onComboBlast?.(plan.label);
    this.shake = 10;
    this.hooks.onShake?.(10);
    this.slowmo = true;
    this.hooks.onSlowmo?.(CFG.anim.slowmoMs);
    setTimeout(() => { this.slowmo = false; }, CFG.anim.slowmoMs);

    // 같은 색 → 특수 보석 변환
    for (const conv of plan.conversions) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = this.grid[r][c];
          if (t && t.color === conv.color && !t.pu) {
            this.grid[r][c] = makePowerupTile(conv.type, t.color, conv.dir || 'h');
          }
        }
      }
    }
    // 추가 특수 보석 생성
    for (const s of plan.spawns) {
      if (inBounds(this, s.r, s.c) && !this.isBlockedCell(s.r, s.c)) {
        this.grid[s.r][s.c] = makePowerupTile(s.type, this.rng.int(this.colorCount), s.dir || 'h');
        this.anims.push({ kind: 'pucreate', r: s.r, c: s.c, t0: performance.now(), dur: 420, type: s.type });
      }
    }
    // 계획된 칸 + 보드의 모든 특수 보석을 연쇄 발동
    const queue = [];
    for (const key of plan.cells) {
      const [r, c] = key.split(',').map(Number);
      const t = this.grid[r][c];
      if (t) {
        if (t.pu) queue.push({ r, c });
        else {
          this.grid[r][c] = null;
          this.anims.push({ kind: 'pop', tile: t, r, c, t0: performance.now(), dur: CFG.anim.clear, color: t.color });
          this.goals.onTileCleared(t);
          this.score += CFG.score.perTile * 2;
          this.hooks.onClear?.(t, r, c, { cascade: 3 });
          if (t.item) this.collectItem(r, c, t);
        }
      } else {
        const o = this.obstacleAt(r, c);
        if (o) o.onPowerupHit({ cause: 'combo' });
      }
    }
    // 변환된 특수 보석들도 발동
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.grid[r][c];
        if (t?.pu) {
          const isElectro = t.pu.type === 'electro';
          if (isElectro || plan.cells.includes(K(r, c)) || plan.conversions.some(cv => cv.type === t.pu.type)) {
            queue.push({ r, c });
          }
        }
      }
    }
    await this.detonate(queue, a.tile.color);
    await this.collapse();
    await this.resolveBoard(0);
  }

  /* ── 낙하 ─────────────────────────────────────────────── */
  async collapse() {
    const { moves, spawns } = applyGravity(this);
    if (!moves.length && !spawns.length) return;
    const now = performance.now();
    let maxDur = 0;
    for (const m of moves) {
      const dist = m.to[0] - m.from[0];
      const dur = Math.min(CFG.anim.dropMax, 70 + dist * 46);
      maxDur = Math.max(maxDur, dur);
      this.anims.push({ kind: 'move', tile: m.tile, from: { r: m.from[0], c: m.from[1] }, to: { r: m.to[0], c: m.to[1] }, t0: now, dur, ease: 'drop' });
    }
    for (const s of spawns) {
      const dist = s.r - s.fromRow;
      const dur = Math.min(CFG.anim.dropMax + 120, 90 + dist * 42);
      maxDur = Math.max(maxDur, dur);
      this.anims.push({ kind: 'move', tile: s.tile, from: { r: s.fromRow, c: s.c }, to: { r: s.r, c: s.c }, t0: now, dur, ease: 'drop' });
    }
    this.hooks.onDrop?.();
    await sleep(maxDur);
    this.collectBottomItems();
    // 오래된 애니메이션 정리(메모리·잔상 방지)
    const now2 = performance.now();
    this.anims = this.anims.filter(a => now2 - a.t0 < (a.dur || 400) + 800);
  }

  collectBottomItems() {
    for (let c = 0; c < this.cols; c++) {
      const t = this.grid[this.rows - 1][c];
      if (t?.item) this.collectItem(this.rows - 1, c, t);
    }
  }

  collectItem(r, c, tile) {
    this.itemsCollected++;
    this.goals.onItemCollected(1);
    this.hooks.onItemCollected?.(r, c, tile);
    this.score += 120;
    if (tile) tile.item = null;
  }

  /* ── 목표/보스/턴 종료 ─────────────────────────────────── */
  damageBoss(n, cause) {
    if (!this.boss || this.boss.hp <= 0) return;
    this.boss.hp = Math.max(0, this.boss.hp - n);
    this.stats.bossDamage += n;
    this.goals.onBossDamage(n);
    this.hooks.onBossDamage?.(n, this.boss);
  }

  checkGoals() {
    if (this.state !== 'playing') return false;
    if (this.goals.isDone()) {
      this.state = 'won';
      this.hooks.onGoalsComplete?.();
      return true;
    }
    return false;
  }

  async endTurn() {
    if (this.state !== 'playing') return;
    // 아이템 스폰(드롭 목표)
    if (this.dropSpawnsLeft > 0 && this.turn % 2 === 1) this.spawnDropItem();

    // 장애물 턴 종료
    for (const o of [...this.obstacles.values()]) {
      if (o.dead) continue;
      o.onTurnEnd({ board: this, turn: this.turn });
      if (o.def.spreader && this.turn % CFG.obstacles.sandSpreadEvery === 0) this.spreadSand(o);
    }
    // 보스 소환
    if (this.boss && this.boss.hp > 0 && this.level.boss?.summon) {
      const every = this.level.boss.summonEvery ?? CFG.obstacles.bossSummonEvery;
      if (this.turn % every === 0) this.bossSummon();
    }
    this.obstacles.forEach((o) => { if (o.dead) this.obstacles.delete(o.cell); });
    this.hooks.onTurnEnd?.(this.turn);
    if (this.checkGoals()) return;

    if (this.moves <= 0) {
      this.state = 'lost';
      this.hooks.onOutOfMoves?.();
    }
  }

  spreadSand(src) {
    const sandCount = [...this.obstacles.values()].filter(o => o.type === 'sand').length;
    if (sandCount >= CFG.obstacles.sandMaxSpread) return;
    const opts = [];
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = src.r + dr, c = src.c + dc;
      if (!inBounds(this, r, c) || this.voids.has(K(r, c))) continue;
      if (this.obstacleAt(r, c)) continue;
      if (!this.grid[r][c]) continue;
      opts.push([r, c]);
    }
    if (!opts.length) return;
    const [r, c] = this.rng.pick(opts);
    const o = makeObstacle({ r, c, type: 'sand' }, this);
    this.obstacles.set(K(r, c), o);
    this.hooks.onObstacleSpawn?.(o);
  }

  bossSummon() {
    const type = this.level.boss.summon || 'bush';
    const alive = [...this.obstacles.values()].filter(o => !o.dead && o.type === type).length;
    if (alive >= CFG.obstacles.bossSummonMax) return;
    const candidates = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.voids.has(K(r, c)) || this.obstacleAt(r, c)) continue;
        if (r < 2) continue; // 너무 위쪽은 피함
        candidates.push([r, c]);
      }
    }
    if (!candidates.length) return;
    const [r, c] = this.rng.pick(candidates);
    const def = OBSTACLES[type];
    const o = makeObstacle({ r, c, type, hp: def?.hp ?? 1 }, this);
    this.obstacles.set(K(r, c), o);
    if (o.blocksTile) this.grid[r][c] = null;
    this.hooks.onObstacleSpawn?.(o);
    this.hooks.onBossSummon?.(o);
  }

  spawnDropItem() {
    const cols = [];
    for (let c = 0; c < this.cols; c++) {
      if (this.isBlockedCell(0, c)) continue;
      if (!this.grid[0][c]) continue;
      cols.push(c);
    }
    if (!cols.length) return;
    const c = this.rng.pick(cols);
    const t = this.grid[0][c];
    t.item = this.rng.next() < 0.5 ? 'seed' : 'acorn';
    this.dropSpawnsLeft--;
    this.anims.push({ kind: 'itemspawn', r: 0, c, t0: performance.now(), dur: 500 });
  }

  spawnItemAt(r, c) {
    const t = this.grid[r]?.[c];
    if (t) { t.item = 'acorn'; this.hooks.onItemSpawned?.(r, c); }
  }

  spawnRewardPowerup(r, c) {
    if (this.isBlockedCell(r, c)) return;
    const t = this.grid[r][c] || this.makeTile();
    const type = this.rng.pick(['rocket', 'tnt', 'spinner']);
    const pu = makePowerupTile(type, t.color, 'h');
    this.grid[r][c] = pu;
    this.anims.push({ kind: 'pucreate', r, c, t0: performance.now(), dur: 420, type });
    this.hooks.onPowerupCreate?.(type, r, c, 'h');
  }

  placeStartPowerup(type, n) {
    let placed = 0;
    for (let tries = 0; tries < 200 && placed < n; tries++) {
      const r = this.rng.int(this.rows);
      const c = this.rng.int(this.cols);
      if (this.isBlockedCell(r, c) || !this.grid[r][c]) continue;
      const t = this.grid[r][c];
      if (t.pu) continue;
      this.grid[r][c] = makePowerupTile(type, t.color, 'h');
      placed++;
    }
  }

  /* ── 부스터 ───────────────────────────────────────────── */
  async useBooster(kind, r, c) {
    if (this.busy || this.state !== 'playing') return false;
    this.busy = true;
    try {
      if (kind === 'hammer') {
        await this.clearCells([{ r, c, tile: this.grid[r][c] }], { cascade: 1 });
        const o = this.obstacleAt(r, c);
        if (o) o.damage(2, 'booster');
        this.hooks.onBoosterUse?.(kind, r, c);
      } else if (kind === 'drill') {
        const list = [];
        const obs = [];
        for (let rr = 0; rr < this.rows; rr++) {
          const t = this.grid[rr][c];
          if (t) list.push({ r: rr, c, tile: t });
          const o = this.obstacleAt(rr, c);
          if (o) obs.push(o);
        }
        for (const o of obs) o.onPowerupHit({ cause: 'booster' });
        await this.clearCells(list, { cascade: 2 });
        this.hooks.onPowerupFx?.('drill', r, c, list.map(x => [x.r, x.c]), 0);
        this.hooks.onBoosterUse?.(kind, r, c);
      } else if (kind === 'bomber') {
        const list = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (!inBounds(this, rr, cc)) continue;
          const t = this.grid[rr][cc];
          if (t) list.push({ r: rr, c: cc, tile: t });
          const o = this.obstacleAt(rr, cc);
          if (o) o.damage(2, 'booster');
        }
        this.hooks.onPowerupFx?.('tnt', r, c, list.map(x => [x.r, x.c]), 0);
        this.flash = 0.4; this.shake = 6;
        await this.clearCells(list, { cascade: 2 });
        this.hooks.onBoosterUse?.(kind, r, c);
      } else if (kind === 'magicHat') {
        const t = this.grid[r]?.[c];
        if (!t) return false;
        const color = t.color;
        const types = ['rocket', 'tnt', 'spinner', 'electro'];
        for (let rr = 0; rr < this.rows; rr++) for (let cc = 0; cc < this.cols; cc++) {
          const tt = this.grid[rr][cc];
          if (tt && tt.color === color && !tt.pu) {
            this.grid[rr][cc] = makePowerupTile(this.rng.pick(types), color, this.rng.int(2) ? 'h' : 'v');
            this.anims.push({ kind: 'pucreate', r: rr, c: cc, t0: performance.now(), dur: 420, type: 'rocket' });
          }
        }
        this.hooks.onBoosterUse?.(kind, r, c);
      } else return false;
      await this.collapse();
      await this.resolveBoard(0);
      this.checkGoals();
      return true;
    } finally {
      this.busy = false;
      this.hooks.onStateChange?.(this.state);
    }
  }

  /* 프로펠러가 날아갈 목표 — 목표 색/장애물/특수 보석 순으로 가까운 칸 */
  findSpinnerTarget(fromR, fromC, refColor) {
    const targets = [];
    const collectColors = this.goals.list.filter(g => g.type === 'collect' && g.done < g.total).map(g => g.color);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (r === fromR && c === fromC) continue;
        const t = this.grid[r][c];
        if (!t) continue;
        let score = 0;
        if (collectColors.includes(t.color)) score += 3;
        if (t.pu) score += 2;
        if (this.obstacleAt(r, c)) score += 2;
        if (score > 0) targets.push({ r, c, score, d: Math.abs(r - fromR) + Math.abs(c - fromC) });
      }
    }
    if (!targets.length) {
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        if ((r !== fromR || c !== fromC) && this.grid[r][c]) targets.push({ r, c, score: 0, d: Math.abs(r - fromR) + Math.abs(c - fromC) });
      }
    }
    targets.sort((a, b) => (b.score - a.score) || (a.d - b.d));
    return targets[0] || null;
  }

  /* 장애물이 부서졌을 때 — 목표 카운트와 통계를 갱신 */
  notifyObstacleCleared(obs) {
    if (!obs) return;
    this.stats.obstaclesCleared++;
    this.goals.onObstacleCleared(obs.type);
    this.checkGoals();
    this.hooks.onGoalProgress?.();
  }

  getHint() {
    const mv = findHint(this);
    this.hintCells = mv ? [mv.a, mv.b] : null;
    return this.hintCells;
  }

  async shuffle() {
    if (this.busy) return false;
    this.busy = true;
    this.hooks.onShuffleStart?.();
    await sleep(CFG.anim.shuffleDelay);
    const ok = shuffleGrid(this);
    this.hooks.onShuffleEnd?.(ok);
    await sleep(CFG.anim.shuffleDelay);
    this.busy = false;
    return ok;
  }

  /* 이어하기(+5 이동) */
  addMoves(n) {
    this.moves += n;
    if (this.state === 'lost') this.state = 'playing';
    this.hooks.onStateChange?.(this.state);
  }

  /* 디버그/검증용 요약 */
  summary() {
    return {
      moves: this.moves, score: this.score, state: this.state,
      goals: this.goals.toJSON(), boss: this.boss ? { hp: this.boss.hp, max: this.boss.maxHp } : null,
      obstacles: [...this.obstacles.values()].map(o => o.toJSON()),
      stats: { ...this.stats }, itemsCollected: this.itemsCollected,
    };
  }
}

export { CFG };
