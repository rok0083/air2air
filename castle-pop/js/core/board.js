/* =========================================================================
   Board — 매치3 코어 (DOM 없음)
   · 셀: { gem, ob, drop, hole }
   · gem: { id, color, power, orient, powerColor }
   · 목표/이동 수/낙하/폭발/연쇄/드롭/장애물 피해를 모두 여기서 판정한다.
   · UI 는 hooks 로 애니메이션만 담당한다.
   ========================================================================= */
import { CFG, COLOR_KEYS } from '../config.js';
import { makeRng, findGroups, decidePowerup, swapMakesMatch, validMoves, lineLengthAt } from './match.js';
import { planGravity, emptyPlayableCells } from './gravity.js';
import { makeObstacle, isBlocking, locksGem, canHitFromAdjacent, obstacleMaterial } from '../obstacles/index.js';
import { blastFor, comboEffect, nearestObstacle, mostCommonColor } from '../powerups/index.js';

let _gemId = 1;
const key = (x, y) => `${x},${y}`;
const parseKey = k => k.split(',').map(Number);

export class Board {
  constructor(level, opts = {}) {
    this.level = level || {};
    this.cols = level.cols || CFG.board.cols;
    this.rows = level.rows || CFG.board.rows;
    this.colorCount = Math.min(level.colors || CFG.board.colorsDefault, CFG.colors.length);
    this.seed = opts.seed ?? level.seed ?? 12345;
    this.rng = makeRng(this.seed);
    this.moves = level.moves ?? 25;
    this.startMoves = this.moves;
    this.grid = [];
    this.lastSwap = [];
    this.chain = 0;
    this.keys = 0;
    this.collected = { coin: 0, moves: 0, star: 0, gift: 0 };
    this.letters = 0;
    this.birds = 0;
    this.obstaclesSpawnedIntro = [];
    this.won = false;
    this.quit = false;
    this.score = 0;

    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) row.push({ gem: null, ob: null, drop: null, hole: false });
      this.grid.push(row);
    }
    // 구멍(보드 모양)
    for (const [x, y] of level.blocked || []) {
      const n = this.cell(x, y);
      if (n) n.hole = true;
    }
    this.placeInitialObstacles();
    this.buildGoals(level.goals || []);
    this.fillNewBoard();
    this.bonusDrops = level.drops ?? (CFG.drops.perLevelMin + Math.floor(this.rng() * (CFG.drops.perLevelMax - CFG.drops.perLevelMin + 1)));
    this.placeDrops(this.bonusDrops);
  }

  /* ---------------------------------------------------------------- 기본 */
  cell(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
    return this.grid[y][x];
  }
  gem(x, y) { return this.cell(x, y)?.gem || null; }
  blocksFallAt(x, y) { return isBlocking(this.cell(x, y)?.ob); }
  randomColor() { return Math.floor(this.rng() * this.colorCount); }
  makeGem(color, power = null, extra = {}) {
    return { id: `g${_gemId++}`, color, power, orient: extra.orient || null, powerColor: extra.powerColor ?? null };
  }

  placeInitialObstacles() {
    const seenGid = new Map();
    for (const spec of this.level.obstacles || []) {
      const n = this.cell(spec.x, spec.y);
      if (!n || n.hole) continue;
      if (n.ob) continue;                       // 이미 놓인 칸은 건너뛴다
      let gid = null;
      if (spec.type === 'colorBox' && (spec.w > 1 || spec.h > 1)) {
        gid = seenGid.get(`${spec.x},${spec.y}`) || `cb${_gemId++}`;
      }
      if (spec.type === 'colorBox' && (spec.w > 1 || spec.h > 1)) {
        for (let dy = 0; dy < (spec.h || 1); dy++) {
          for (let dx = 0; dx < (spec.w || 1); dx++) {
            const c = this.cell(spec.x + dx, spec.y + dy);
            if (!c || c.hole) continue;
            c.ob = makeObstacle(spec.type, { ...spec, gid, w: 1, h: 1 });
            if (!this.obstaclesSpawnedIntro.includes(spec.type)) this.obstaclesSpawnedIntro.push(spec.type);
          }
        }
      } else {
        n.ob = makeObstacle(spec.type, spec);
        if (!this.obstaclesSpawnedIntro.includes(spec.type)) this.obstaclesSpawnedIntro.push(spec.type);
      }
    }
  }

  /* ---------------------------------------------------------------- 초기 보드 */
  fillNewBoard() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const c = this.cell(x, y);
        if (!c || c.hole || isBlocking(c.ob)) continue;
        let color, guard = 0;
        do {
          color = this.randomColor();
          guard++;
        } while (guard < 40 && (
          (this.gem(x - 1, y)?.color === color && this.gem(x - 2, y)?.color === color) ||
          (this.gem(x, y - 1)?.color === color && this.gem(x, y - 2)?.color === color)
        ));
        c.gem = this.makeGem(color);
      }
    }
    let guard = 0;
    while (!this.hasMove() && guard++ < 30) this.shuffle();
    // 낙하 검증: 처음부터 빈 칸이 없어야 한다
    this.fillEmpty();
  }

  fillEmpty() {
    for (const [x, y] of emptyPlayableCells(this)) {
      const c = this.cell(x, y);
      if (!c.gem) c.gem = this.makeGem(this.randomColor());
    }
  }

  placeDrops(n) {
    const spots = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const c = this.cell(x, y);
        if (c && c.gem && !c.drop && !isBlocking(c.ob)) spots.push([x, y]);
      }
    }
    const chosen = new Set();
    for (let i = 0; i < n && spots.length; i++) {
      let p, guard = 0;
      do { p = spots[Math.floor(this.rng() * spots.length)]; guard++; } while (chosen.has(key(p[0], p[1])) && guard < 50);
      chosen.add(key(p[0], p[1]));
      const roll = this.rng() * 100;
      let acc = 0, type = 'coin';
      for (const [t, w] of Object.entries(CFG.drops.weights)) { acc += w; if (roll <= acc) { type = t; break; } }
      this.cell(p[0], p[1]).drop = type;
    }
  }

  /* ---------------------------------------------------------------- 목표 */
  buildGoals(goals) {
    this.goals = goals.map(g => {
      const type = g.type;
      const base = {
        type,
        obstacle: ['box', 'colorBox', 'mailbox', 'vase', 'birdNest', 'grass', 'ice', 'chain', 'honey', 'safe', 'curtain'].includes(type) ? type : (g.obstacle || null),
        color: g.color ? COLOR_KEYS.indexOf(g.color) : null,
        colorKey: g.color || null,
        need: g.count ?? g.need ?? 1,
        done: 0,
        label: '',
      };
      base.label = goalLabel(base);
      return base;
    });
    // 레벨 JSON 이 목표를 지정하지 않으면 장애물 수로 자동 생성
    if (!this.goals.length) {
      const counts = new Map();
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const ob = this.cell(x, y)?.ob;
          if (ob) counts.set(ob.type, (counts.get(ob.type) || 0) + 1);
        }
      }
      for (const [type, n] of counts) {
        this.goals.push({ type, obstacle: type, color: null, colorKey: null, need: n, done: 0, label: goalLabel({ type, colorKey: null }) });
      }
    }
    // 목표 수가 실제 장애물 수보다 많으면 보정하고, 아예 없으면 목표에서 뺀다
    this.goals = this.goals.filter(g => {
      if (g.type === 'collect') return true;
      const obType = g.obstacle || (g.type === 'letter' ? 'mailbox' : g.type === 'bird' ? 'birdNest' : null);
      if (!obType) return true;
      const n = this.countObstacle(obType);
      if (n <= 0) return false;
      if (g.need > n) g.need = n;
      return true;
    });
    if (!this.goals.length) {
      const color = this.mostFrequentColor();
      this.goals.push({ type: 'collect', obstacle: null, color, colorKey: COLOR_KEYS[color], need: 20, done: 0, label: goalLabel({ type: 'collect', color }) });
    }
  }

  mostFrequentColor() {
    const counts = new Array(this.colorCount).fill(0);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const g = this.gem(x, y);
      if (g) counts[g.color] = (counts[g.color] || 0) + 1;
    }
    let best = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
    return best;
  }

  countObstacle(type) {
    let n = 0;
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const ob = this.cell(x, y)?.ob;
      if (ob && ob.type === type) n++;
    }
    return n;
  }

  goalComplete() { return this.goals.length > 0 && this.goals.every(g => g.done >= g.need); }
  goalProgress() { return this.goals.map(g => ({ ...g, remaining: Math.max(0, g.need - g.done) })); }
  goalsRemainingText() {
    const g = this.goals.find(x => x.done < x.need);
    if (!g) return '';
    return `${g.label} ${g.need - g.done}개만 더!`;
  }

  recordObstacleCleared(ob) {
    this.score += 40;
    let matched = false;
    for (const g of this.goals) {
      if (g.obstacle && g.obstacle === ob.type && g.done < g.need) { g.done++; matched = true; }
      if (g.type === 'letter' && ob.type === 'mailbox' && g.done < g.need) { g.done++; matched = true; }
      if (g.type === 'bird' && ob.type === 'birdNest' && g.done < g.need) { g.done++; matched = true; }
    }
    return matched;
  }

  recordColor(color, n = 1) {
    this.score += 20 * n;
    for (const g of this.goals) {
      if (g.type === 'collect' && g.color === color && g.done < g.need) {
        g.done = Math.min(g.need, g.done + n);
        return true;
      }
    }
    return false;
  }

  /* ---------------------------------------------------------------- 교환 */
  canSwap(ax, ay, bx, by) {
    if (!this.cell(ax, ay) || !this.cell(bx, by)) return false;
    if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return false;
    const a = this.cell(ax, ay), b = this.cell(bx, by);
    if (!a.gem || !b.gem) return false;
    if (a.hole || b.hole) return false;
    if (a.drop || b.drop) { /* 드롭은 조각과 함께 움직이지 않는다 */ }
    if (locksGem(a.ob) || locksGem(b.ob)) return false;
    return true;
  }

  rawSwap(ax, ay, bx, by) {
    const a = this.cell(ax, ay), b = this.cell(bx, by);
    const t = a.gem; a.gem = b.gem; b.gem = t;
  }

  /* 플레이어/봇의 한 수. hooks 로 연출. */
  async tryMove(ax, ay, bx, by, hooks = {}, opts = {}) {
    if (this.won) return { ok: false, reason: 'won' };
    if (!this.canSwap(ax, ay, bx, by)) return { ok: false, reason: 'invalid' };
    const ga = this.cell(ax, ay).gem, gb = this.cell(bx, by).gem;
    this.lastSwap = [[ax, ay], [bx, by]];
    this.chain = 0;

    // 1) 파워업 + 파워업 → 조합
    if (ga.power && gb.power) {
      const effect = comboEffect(this, ax, ay, bx, by);
      this.moves--;
      await hooks.combo?.(effect, ax, ay, bx, by);
      // 두 조각을 제거하고 효과 범위를 지운다
      this.cell(ax, ay).gem = null;
      this.cell(bx, by).gem = null;
      for (const conv of effect.conversions || []) {
        const g = this.cell(conv.x, conv.y)?.gem;
        if (g) { g.power = conv.kind; g.orient = 'h'; }
      }
      const cells = new Set((effect.cells || []).map(([x, y]) => key(x, y)));
      const info = this.applyClears(cells, { source: 'powerup', cascade: 0, effect });
      await hooks.clear?.(info, CFG.speeds.clear);
      await this.settle(hooks, 1);
      return { ok: true, combo: effect.key, cascade: this.chain };
    }

    // 2) 빛구슬 + 일반 조각 → 그 색 전부
    if (ga.power === 'light' || gb.power === 'light') {
      const lightAt = ga.power === 'light' ? [ax, ay] : [bx, by];
      const otherCell = ga.power === 'light' ? gb : ga;
      const color = otherCell.color;
      this.moves--;
      this.cell(ax, ay).gem = null; this.cell(bx, by).gem = null;
      const b = blastFor(this, lightAt[0], lightAt[1], 'light', { color });
      const cells = new Set(b.cells.map(([x, y]) => key(x, y)));
      cells.add(key(ax, ay)); cells.add(key(bx, by));
      await hooks.combo?.({ label: '빛구슬!', cells: [...cells].map(parseKey), key: 'light', slowMo: true }, ax, ay, bx, by);
      const info = this.applyClears(cells, { source: 'powerup', cascade: 0 });
      await hooks.clear?.(info, CFG.speeds.clear);
      await this.settle(hooks, 1);
      return { ok: true, combo: 'light', cascade: this.chain };
    }

    // 3) 파워업 하나만 교환 → 그 파워업 발동 (이동 1 소모)
    if (ga.power || gb.power) {
      const at = ga.power ? [ax, ay] : [bx, by];
      this.moves--;
      await this.activateAt(at[0], at[1], hooks);
      return { ok: true, activated: true, cascade: this.chain };
    }

    // 4) 일반 교환
    this.rawSwap(ax, ay, bx, by);
    await hooks.swap?.(ax, ay, bx, by, CFG.speeds.swap);
    const groups = findGroups(this);
    if (!groups.length) {
      this.rawSwap(ax, ay, bx, by);
      await hooks.swapBack?.(ax, ay, bx, by, CFG.speeds.swapBack);
      return { ok: false, reason: 'no-match' };
    }
    this.moves--;
    await this.settle(hooks, 0);
    return { ok: true, cascade: this.chain };
  }

  /* 파워업 발동 (탭 또는 부스터 대신 사용) */
  async activateAt(x, y, hooks = {}) {
    const gem = this.gem(x, y);
    if (!gem?.power) return { ok: false };
    const kind = gem.power;
    const orient = gem.orient || 'h';
    gem.power = null;
    const b = blastFor(this, x, y, kind, { orient, color: gem.powerColor ?? mostCommonColor(this) });
    const cells = new Set(b.cells.map(([cx, cy]) => key(cx, cy)));
    await hooks.combo?.({ label: `${CFG.powerups[kind].name}!`, cells: b.cells, key: kind, slowMo: kind === 'tnt' }, x, y, x, y);
    const info = this.applyClears(cells, { source: 'powerup', cascade: 0, hit: b.hit });
    this.cell(x, y).gem = null;
    info.cells.push([x, y]);
    await hooks.clear?.(info, CFG.speeds.clear);
    await this.settle(hooks, 1);
    return { ok: true, cascade: this.chain };
  }

  /* 연쇄 + 낙하 루프 */
  async settle(hooks = {}, startCascade = 0) {
    let cascade = startCascade;
    for (let iter = 0; iter < 80; iter++) {
      const groups = findGroups(this);
      if (!groups.length) break;
      const clears = new Set();
      const creations = [];
      for (const g of groups) {
        const pw = decidePowerup(g, this.lastSwap);
        let skipKey = null;
        if (pw) { skipKey = key(pw.at[0], pw.at[1]); creations.push(pw); }
        for (const [cx, cy] of g.cells) {
          if (skipKey && key(cx, cy) === skipKey) continue;
          clears.add(key(cx, cy));
        }
        if (!clears.size && pw) clears.add(skipKey); // 안전장치
      }
      const info = this.applyClears(clears, { source: 'match', cascade });
      for (const c of creations) this.placePowerup(c);
      if (creations.length) hooks.powerupCreated?.(creations);
      this.chain = cascade + 1;
      await hooks.clear?.(info, Math.max(130, CFG.speeds.clear - cascade * 12));
      if (this.goalComplete()) break;
      const plan = planGravity(this);
      await hooks.fall?.(plan, this.fallDuration(plan, cascade));
      cascade++;
      if (cascade > 60) break;
      if (hooks.signal?.() === 'stop') break;
    }
    // 빈 칸 0 보장 (모든 상황의 안전망)
    const empties = emptyPlayableCells(this);
    if (empties.length) {
      this.fillEmpty();
      await hooks.fall?.({ moves: [], spawns: empties.map(([x, y]) => ({ x, y, fromY: -1 })) }, 140);
    }
    if (CFG.debug.assertEmptyCells && emptyPlayableCells(this).length) {
      console.assert(false, '[castle-pop] 빈 칸이 남았습니다', emptyPlayableCells(this));
    }
    this.won = this.goalComplete();
    return { cascade: this.chain };
  }

  fallDuration(plan, cascade) {
    const per = CFG.speeds.fallPerCell * Math.max(CFG.speeds.cascadeSpeedUpCap, Math.pow(CFG.speeds.cascadeSpeedUp, cascade));
    const maxDist = plan.moves.reduce((m, mv) => Math.max(m, Math.abs(mv.toY - mv.fromY)), 1);
    const drop = Math.min(CFG.speeds.fallMax, Math.max(CFG.speeds.fallMin, per * maxDist));
    return drop + (plan.moves.length ? CFG.speeds.landingBounce : 0);
  }

  placePowerup(creation) {
    const [x, y] = creation.at;
    const c = this.cell(x, y);
    if (!c) return;
    c.gem = this.makeGem(creation.color, creation.type, { orient: creation.orient || 'h' });
  }

  /* 지울 칸 집합 → 실제 제거 + 장애물 피해 + 목표/드롭 집계 */
  applyClears(keys, ctx = {}) {
    const list = keys instanceof Set ? [...keys] : (keys || []).map(k => Array.isArray(k) ? k : parseKey(k));
    const coords = list.map(c => Array.isArray(c) ? c : parseKey(c));
    const info = { cells: [], pops: [], cascade: ctx.cascade || 0, goalDone: [], drops: [], destroyed: [], combos: this.chain, byPower: ctx.source === 'powerup' };
    const damageDone = new Set();
    const queue = [...coords];
    const seen = new Set(coords.map(([x, y]) => key(x, y)));

    // 폭발 연쇄: 지워지는 칸 안의 파워업도 발동
    const fired = new Set();
    while (queue.length) {
      const [x, y] = queue.shift();
      if (fired.has(key(x, y))) continue;
      fired.add(key(x, y));
      const gem = this.gem(x, y);
      if (gem?.power) {
        const b = blastFor(this, x, y, gem.power, { orient: gem.orient, color: gem.powerColor ?? mostCommonColor(this) });
        for (const [bx, by] of b.cells) {
          if (!this.cell(bx, by)) continue;
          if (seen.has(key(bx, by))) continue;
          seen.add(key(bx, by));
          queue.push([bx, by]);
        }
        if (b.hit && !seen.has(key(b.hit[0], b.hit[1]))) { seen.add(key(b.hit[0], b.hit[1])); queue.push(b.hit); }
      }
    }

    for (const k of seen) {
      const [x, y] = parseKey(k);
      const c = this.cell(x, y);
      if (!c) continue;
      let color = -1;
      if (c.gem) {
        color = c.gem.color;
        const pw = c.gem.power || null;
        const orient = c.gem.orient || null;
        c.gem = null;
        info.cells.push([x, y]);
        info.pops.push({ x, y, color, power: pw, orient });
        if (this.recordColor(color)) info.goalDone.push('collect');
        if (c.drop) {
          info.drops.push({ type: c.drop, x, y });
          this.collectDrop(c.drop, x, y, info);
          c.drop = null;
        }
      }
      if (c.ob) {
        const res = this.damageObstacle(x, y, 1, { source: ctx.source || 'match', color, info });
        if (res?.destroyed) info.destroyed.push(res);
        damageDone.add(c.ob?.id || `${x},${y}`);
      }
      // 옆 장애물 피해
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = this.cell(x + dx, y + dy);
        if (!n || !n.ob) continue;
        if (damageDone.has(n.ob.id)) continue;
        if (ctx.source === 'powerup') {
          damageDone.add(n.ob.id);
          const res = this.damageObstacle(x + dx, y + dy, 1, { source: 'powerup', color, info });
          if (res?.destroyed) info.destroyed.push(res);
        } else if (canHitFromAdjacent(n.ob, color)) {
          damageDone.add(n.ob.id);
          const res = this.damageObstacle(x + dx, y + dy, 1, { source: 'match', color, info });
          if (res?.destroyed) info.destroyed.push(res);
        }
      }
    }
    this.score += info.cells.length * 30;
    return info;
  }

  damageObstacle(x, y, amount, ctx = {}) {
    const c = this.cell(x, y);
    const ob = c?.ob;
    if (!ob) return null;
    const group = ob.gid
      ? this.allObstaclesWithGid(ob.gid)
      : [{ x, y, ob }];
    let destroyed = null;
    for (const g of group) {
      if (g.ob.hp <= 0) continue;
      g.ob.hp -= amount;
      if (g.ob.hp <= 0) {
        const cell = this.cell(g.x, g.y);
        if (cell) cell.ob = null;
        this.recordObstacleCleared(g.ob);
        if (g.ob.type === 'mailbox') { this.letters++; this.keys++; this.damageSafes(1, ctx); }
        if (g.ob.type === 'birdNest') { this.birds++; }
        destroyed = { type: g.ob.type, x: g.x, y: g.y, material: obstacleMaterial(g.ob), color: g.ob.color };
      }
    }
    return destroyed;
  }

  allObstaclesWithGid(gid) {
    const out = [];
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const ob = this.cell(x, y)?.ob;
      if (ob && ob.gid === gid) out.push({ x, y, ob });
    }
    return out;
  }

  damageSafes(n) {
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const ob = this.cell(x, y)?.ob;
      if (ob?.type === 'safe') { this.damageObstacle(x, y, n, { source: 'key' }); return; }
    }
  }

  collectDrop(type, x, y, info) {
    this.collected[type] = (this.collected[type] || 0) + 1;
    if (type === 'coin') this.score += CFG.drops.coinValue;
    if (type === 'moves') this.moves += CFG.drops.movesValue;
    if (type === 'gift') {
      // 랜덤 파워업을 보드에 하나 놓는다
      const pw = ['rocket', 'tnt', 'propeller', 'light'][Math.floor(this.rng() * 4)];
      const c = this.cell(x, y);
      if (c) c.gem = this.makeGem(this.randomColor(), pw, { orient: 'h' });
    }
    if (type === 'star') {
      // 목표 장애물 3곳 타격
      let hits = 0;
      outer: for (let yy = this.rows - 1; yy >= 0; yy--) for (let xx = 0; xx < this.cols; xx++) {
        const ob = this.cell(xx, yy)?.ob;
        if (ob) { this.damageObstacle(xx, yy, 1, { source: 'powerup' }); if (++hits >= CFG.drops.starHits) break outer; }
      }
    }
  }

  /* ---------------------------------------------------------------- 턴 종료 */
  endTurn() {
    this.honeyTurn = (this.honeyTurn || 0) + 1;
    if (this.honeyTurn % CFG.honeySpreadTurns === 0) {
      const honey = [];
      for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
        if (this.cell(x, y)?.ob?.type === 'honey') honey.push([x, y]);
      }
      for (const [x, y] of honey) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c = this.cell(x + dx, y + dy);
          if (c && !c.hole && c.gem && !c.ob) { c.ob = makeObstacle('honey'); break; }
        }
      }
    }
  }

  /* ---------------------------------------------------------------- 힌트·셔플 */
  hasMove() { return !!this.findHint(); }

  findHint() {
    const moves = validMoves(this);
    if (!moves.length) return null;
    const nearObstacle = (x, y) => {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) {
        if (this.cell(x + dx, y + dy)?.ob) return true;
      }
      return false;
    };
    const scored = moves.map(([a, b]) => {
      const ga = this.gem(a[0], a[1]), gb = this.gem(b[0], b[1]);
      this.rawSwap(a[0], a[1], b[0], b[1]);
      let score = Math.max(lineLengthAt(this, b[0], b[1], ga.color), lineLengthAt(this, a[0], a[1], gb.color));
      this.rawSwap(a[0], a[1], b[0], b[1]);
      if (nearObstacle(a[0], a[1]) || nearObstacle(b[0], b[1])) score += 1.5;
      if (ga.power || gb.power) score += 4;
      return { a, b, score };
    }).sort((p, q) => q.score - p.score);

    // 상위 후보만 정확한 그룹 판정으로 파워업 보너스를 더한다
    let best = scored[0], bestScore = -1;
    for (const cand of scored.slice(0, 6)) {
      this.rawSwap(cand.a[0], cand.a[1], cand.b[0], cand.b[1]);
      const groups = findGroups(this);
      this.rawSwap(cand.a[0], cand.a[1], cand.b[0], cand.b[1]);
      let score = cand.score;
      for (const g of groups) if (decidePowerup(g, [cand.a, cand.b])) score += 10;
      if (score > bestScore) { bestScore = score; best = cand; }
    }
    return best;
  }

  shuffle() {
    const cells = [];
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const c = this.cell(x, y);
      if (c && c.gem && !locksGem(c.ob)) cells.push(c);
    }
    const gems = cells.map(c => c.gem);
    for (let i = gems.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [gems[i], gems[j]] = [gems[j], gems[i]];
    }
    cells.forEach((c, i) => { c.gem = gems[i]; });
    // 즉시 매치가 있으면 색을 바꿔 없앤다
    for (let guard = 0; guard < 20; guard++) {
      const groups = findGroups(this);
      if (!groups.length) break;
      for (const g of groups) {
        for (const [x, y] of g.cells) {
          const c = this.cell(x, y);
          if (c?.gem) c.gem.color = this.randomColor();
        }
      }
    }
    return cells.length;
  }

  /* ---------------------------------------------------------------- 부스터 */
  boosterCells(type, x, y) {
    switch (type) {
      case 'hammer': return [[x, y]];
      case 'arrow': return Array.from({ length: this.cols }, (_, i) => [i, y]);
      case 'cannon': return Array.from({ length: this.rows }, (_, i) => [x, i]);
      case 'lightning': {
        const obs = nearestObstacle(this, x, y);
        const out = [];
        const order = [];
        for (let yy = 0; yy < this.rows; yy++) for (let xx = 0; xx < this.cols; xx++) {
          const d = Math.abs(xx - x) + Math.abs(yy - y);
          order.push({ x: xx, y: yy, d, hasOb: !!this.cell(xx, yy)?.ob });
        }
        order.sort((a, b) => (b.hasOb - a.hasOb) || a.d - b.d);
        for (const o of order.slice(0, CFG.boosters.lightningTargets)) out.push([o.x, o.y]);
        return out;
      }
      case 'prism': {
        const g = this.gem(x, y);
        const color = g ? g.color : 0;
        const out = [];
        for (let yy = 0; yy < this.rows; yy++) for (let xx = 0; xx < this.cols; xx++) {
          if (this.gem(xx, yy)?.color === color) out.push([xx, yy]);
        }
        return out;
      }
      default: return [[x, y]];
    }
  }

  /* ---------------------------------------------------------------- 요약 */
  summary() {
    const empties = emptyPlayableCells(this);
    return {
      emptyCells: empties.length,
      movesLeft: this.moves,
      won: this.goalComplete(),
      lost: this.moves <= 0 && !this.goalComplete(),
      goals: this.goalProgress(),
      score: this.score,
      chain: this.chain,
    };
  }
}

export function goalLabel(g) {
  if (g.type === 'collect') {
    const c = CFG.colors.find(c => c.key === g.colorKey || c.key === COLOR_KEYS[g.color]);
    return `${c ? c.name.split(' ')[0] : '조각'} 모으기`;
  }
  if (g.type === 'letter') return '편지 모으기';
  if (g.type === 'bird') return '아기 새 구하기';
  const ob = CFG.obstacles[g.obstacle || g.type];
  return ob ? `${ob.name} 제거` : '목표';
}
