/* =========================================================================
   game.js — 레벨 화면: HUD · 보드 렌더러 · 입력 · 연출 · 승리/실패 피날레
   ========================================================================= */
import { CFG } from '../config.js';
import { Board } from '../core/board.js';
import { emptyPlayableCells } from '../core/gravity.js';
import { Profile } from '../meta/profile.js';
import { loadLevel, difficultyOf } from '../meta/levels.js';
import { Audio } from '../audio/audio.js';
import { FX } from '../anim/fx.js';
import { Ease, wait } from '../anim/tween.js';
import { drawGem, drawKing, drawPowerOverlay, drawObstacle, drawDrop, drawIcon, rr, TAU, drawCoin, drawStar } from '../art/art.js';
import { gemSprite, obstacleSprite, dropSprite, iconSprite, blit } from '../art/sprites.js';
import { modal, toast, fmt, curtainTransition, showScreen } from './dom.js';

export class GameScreen {
  constructor(opts = {}) {
    this.onHome = opts.onHome || (() => {});
    this.onNext = opts.onNext || (() => {});
    this.el = document.getElementById('screen-game');
    this.boardCanvas = document.getElementById('board');
    this.fxCanvas = document.getElementById('fx');
    this.kingCanvas = document.getElementById('king-canvas');
    this.boardCtx = this.boardCanvas.getContext('2d');
    this.fx = new FX(this.fxCanvas);
    this.anims = new Map();      // gemId -> {x,y,tx,ty,t0,dur,...}
    this.fades = [];             // 사라지는 조각
    this.pops = [];              // 팝업 텍스트(점수 등)
    this.board = null;
    this.level = null;
    this.kingExpr = 'smile';
    this.kingT = 0;
    this.running = false;
    this.resolving = 0;
    this.selected = null;
    this.armedBooster = null;
    this.gloveFirst = null;
    this.hint = null;
    this.hintAt = 0;
    this.lastInput = performance.now();
    this.skipFinale = false;
    this.finaleDone = false;
    this.raf = 0;
    this.lastTs = 0;
    this.cw = 0;
    this.ch = 0;
    this.gemSize = 0;
    this.originX = 0;
    this.originY = 0;
    this.busy = new Set();
    this.ended = false;
    this.stats = { cleared: 0, combos: 0, boosters: 0, powerups: 0 };
  }

  /* ---------------------------------------------------------------- 시작 */
  async start(levelOrId, opts = {}) {
    const level = (typeof levelOrId === 'object' && levelOrId) ? levelOrId : await loadLevel(levelOrId);
    this.levelId = level.id ?? levelOrId;
    this.level = level;
    this.opts = opts;
    this.timed = opts.mode === 'timed';
    this.secondsLeft = opts.seconds || level.seconds || 0;
    this.scoreAttack = !!opts.scoreAttack;
    this.ended = false;
    this.finaleDone = false;
    this.anims.clear();
    this.fades = [];
    this.pops = [];
    this.fx.pool.items.forEach(p => { p.alive = false; });
    this.selected = null;
    this.armedBooster = null;
    this.gloveFirst = null;
    this.hint = null;
    this.skipFinale = false;
    this.lastInput = performance.now();
    this.kingExpr = 'smile';

    const seed = (level.seed || 1) + Math.floor(Math.random() * 100000);
    this.board = new Board(level, { seed });
    this.board.startMoves = level.moves;
    if (this.timed) this.board.moves = 999;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }

    // 시작 전 부스터 배치
    const picked = opts.preBoosters || {};
    for (const [kind, n] of Object.entries(picked)) {
      for (let i = 0; i < n; i++) this.placePreBooster(kind);
    }

    showScreen('screen-game');
    this.layout();
    this.fx.reduce = Profile.settings.reduceEffects;
    this.renderGoals();
    this.renderTray();
    this.updateMoves(true);
    this.drawKingFrame();
    // 상단 패널 제목/표시를 모드에 맞춘다
    const movesRibbon = document.querySelector('#hud-moves .ribbon');
    if (movesRibbon) movesRibbon.textContent = this.timed ? '남은 시간' : '이동 횟수';
    if (this.timed) this.updateTimerUI();

    Audio.startMusic('level');
    Audio.setTempo(1);
    this.running = true;
    this.startLoop();

    // 어려운 레벨 경고
    if (level.difficulty !== 'normal') {
      const d = difficultyOf(level);
      toast(`${d.name} 레벨 · 보상 2배!`, 1600);
    }
    // 새 장애물 안내
    this.maybeIntroObstacles();
    // 첫 수 안내(레벨 1)
    if (level.tutorial === 'swap') this.showTutorialFinger();
    await wait(CFG.speeds.levelEnter);
    return true;
  }

  placePreBooster(kind) {
    const spots = [];
    for (let y = 0; y < this.board.rows; y++) {
      for (let x = 0; x < this.board.cols; x++) {
        const g = this.board.gem(x, y);
        if (g && !g.power) spots.push([x, y]);
      }
    }
    if (!spots.length) return;
    const [x, y] = spots[Math.floor(Math.random() * spots.length)];
    const g = this.board.gem(x, y);
    g.power = kind === 'light' ? 'light' : kind;
    g.orient = 'h';
  }

  maybeIntroObstacles() {
    const seen = Profile.state.seenIntro || {};
    const types = [];
    for (const o of this.level.obstacles || []) {
      if (!seen[o.type] && CFG.obstacleIntro[o.type] && !types.includes(o.type)) types.push(o.type);
    }
    if (!types.length) return;
    const type = types[0];
    Profile.state.seenIntro = { ...seen, [type]: true };
    Profile.save();
    setTimeout(() => {
      if (!this.running) return;
      modal({
        title: '새 장애물',
        body: `<div style="display:flex;gap:10px;align-items:center;text-align:left">
          <canvas id="intro-ob" width="64" height="64" style="width:64px;height:64px"></canvas>
          <div><b style="font-size:16px">${CFG.obstacles[type].name}</b><p style="margin:4px 0 0">${CFG.obstacleIntro[type]}</p></div>
        </div>`,
        buttons: [{ label: '알겠어요', cls: 'green' }],
        onClose: () => {},
      });
      const c = document.getElementById('intro-ob');
      if (c) {
        const ctx = c.getContext('2d');
        ctx.translate(32, 32);
        drawObstacle(ctx, { type, hp: 2, maxHp: 2, color: 0 }, 0, 0, 56, 0);
      }
    }, 380);
  }

  showTutorialFinger() {
    setTimeout(() => {
      if (!this.running) return;
      const h = this.board.findHint();
      if (!h) return;
      this.tutorialHint = { ...h, until: performance.now() + 9000 };
      toast('조각을 옆으로 밀어 같은 색 3개를 맞추세요', 2600);
    }, 700);
  }

  /* ---------------------------------------------------------------- 레이아웃 */
  layout() {
    const stage = this.el.querySelector('.board-stage');
    const W = stage.clientWidth, H = stage.clientHeight;
    const pad = 8;
    const cols = this.board.cols, rows = this.board.rows;
    const cw = Math.min((W - pad * 2) / cols, (H - pad * 2) / rows);
    const bw = cw * cols, bh = cw * rows;
    this.cw = cw;
    this.gemSize = cw * CFG.board.gemScale;
    this.boardW = bw;
    this.boardH = bh;
    this.originX = (W - bw) / 2;
    this.originY = (H - bh) * 0.58;
    this.stageW = W;
    this.stageH = H;

    for (const [canvas, ctx] of [[this.boardCanvas, this.boardCtx], [this.fxCanvas, this.fx.ctx]]) {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      canvas.style.left = '0px';
      canvas.style.top = '0px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.fx.W = W; this.fx.H = H; this.fx.dpr = this.dpr;
    this.kingCanvas.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);
    this.fitKing();
  }

  fitKing() {
    const c = this.kingCanvas;
    const w = c.clientWidth || 108, h = c.clientHeight || 142;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  cellPx(x, y) {
    return {
      x: this.originX + (x + 0.5) * this.cw,
      y: this.originY + (y + 0.5) * this.cw,
    };
  }
  pxToCell(px, py) {
    const x = Math.floor((px - this.originX) / this.cw);
    const y = Math.floor((py - this.originY) / this.cw);
    if (x < 0 || y < 0 || x >= this.board.cols || y >= this.board.rows) return null;
    return { x, y };
  }

  /* ---------------------------------------------------------------- 루프 */
  startLoop() {
    cancelAnimationFrame(this.raf);
    this.lastTs = performance.now();
    const tick = ts => {
      if (!this.running) return;
      const dt = Math.min(64, ts - this.lastTs);
      this.lastTs = ts;
      this.update(dt, ts);
      this.draw(ts);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stopLoop() { this.running = false; cancelAnimationFrame(this.raf); }

  update(dt, ts) {
    this.kingT += dt;
    if (this.timed && !this.ended) {
      this.secondsLeft -= dt / 1000;
      this.updateTimerUI();
      if (this.secondsLeft <= 10 && this.secondsLeft > 0 && this.kingExpr !== 'tense') this.setKing('tense');
      if (this.secondsLeft <= 0) { this.onTimeout(); return; }
    }
    this.fx.update(dt);
    for (const a of this.anims.values()) {
      a.p = Math.min(1, (ts - a.t0) / a.dur);
      if (a.p >= 1) a.done = true;
    }
    for (const [id, a] of this.anims) if (a.done) this.anims.delete(id);
    this.fades = this.fades.filter(f => (ts - f.t0) < f.dur);
    this.pops = this.pops.filter(p => (ts - p.t0) < p.dur);

    // 힌트: 5초 무입력
    if (!this.hint && ts - this.lastInput > CFG.board.hintDelay && !this.resolving) {
      const h = this.board.findHint();
      if (h) this.hint = h;
    } else if (this.hint && ts - this.lastInput < 400) {
      this.hint = null;
    }
    // 이동 수 5 이하 → 음악 템포 업 + 레오 긴장
    if (this.board && this.board.moves <= CFG.audio.tensionMoves && this.board.moves > 0 && !this.ended) {
      Audio.setTempo(CFG.audio.tensionTempo);
      if (this.kingExpr !== 'tense') this.setKing('tense');
    }
  }

  setKing(expr, ms = 1600) {
    this.kingExpr = expr;
    clearTimeout(this._kingTimer);
    if (ms) {
      this._kingTimer = setTimeout(() => {
        this.kingExpr = this.board && this.board.moves <= CFG.audio.tensionMoves ? 'tense' : 'smile';
      }, ms);
    }
  }

  /* ---------------------------------------------------------------- 그리기 */
  draw(ts) {
    const ctx = this.boardCtx;
    const W = this.stageW, H = this.stageH;
    ctx.clearRect(0, 0, W, H);
    const { originX, originY, cw } = this;

    // 보드 바탕
    const pad = 7;
    const bg = ctx.createLinearGradient(0, originY, 0, originY + this.boardH);
    bg.addColorStop(0, CFG.board.boardColorTop);
    bg.addColorStop(1, CFG.board.boardColorBottom);
    ctx.save();
    ctx.shadowColor = 'rgba(30,50,110,.25)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = bg;
    rr(ctx, originX - pad, originY - pad, this.boardW + pad * 2, this.boardH + pad * 2, CFG.board.boardRadius);
    ctx.fill();
    ctx.restore();
    // 금색 테두리
    ctx.strokeStyle = '#e2c477';
    ctx.lineWidth = 3;
    rr(ctx, originX - pad, originY - pad, this.boardW + pad * 2, this.boardH + pad * 2, CFG.board.boardRadius);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.65)';
    ctx.lineWidth = 1.5;
    rr(ctx, originX - pad + 3, originY - pad + 3, this.boardW + pad * 2 - 6, this.boardH + pad * 2 - 6, CFG.board.boardRadius - 3);
    ctx.stroke();

    // 격자
    ctx.strokeStyle = CFG.board.gridLine;
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.board.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(originX + x * cw, originY + 2);
      ctx.lineTo(originX + x * cw, originY + this.boardH - 2);
      ctx.stroke();
    }
    for (let y = 0; y <= this.board.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(originX + 2, originY + y * cw);
      ctx.lineTo(originX + this.boardW - 2, originY + y * cw);
      ctx.stroke();
    }

    // 셀 내용
    for (let y = 0; y < this.board.rows; y++) {
      for (let x = 0; x < this.board.cols; x++) {
        const cell = this.board.cell(x, y);
        if (!cell || cell.hole) continue;
        const px = this.cellPx(x, y);
        // 아래 장애물(풀/꿀)
        if (cell.ob && ['grass', 'honey'].includes(cell.ob.type)) {
          blit(ctx, obstacleSprite(cell.ob, this.gemSize), px.x, px.y, this.gemSize);
        }
        if (cell.drop) {
          blit(ctx, dropSprite(cell.drop, this.gemSize * 0.9), px.x, px.y + Math.sin(ts * 0.004 + x) * 2, this.gemSize * 0.9);
        }
        if (cell.gem) {
          const a = this.anims.get(cell.gem.id);
          let gx = x, gy = y, scale = 1, alpha = 1;
          if (a) {
            const e = a.ease(a.p);
            gx = a.x + (a.tx - a.x) * e;
            gy = a.y + (a.ty - a.y) * e;
            if (a.kind === 'spawn') alpha = 0.4 + 0.6 * e;
            if (a.squash) scale = 1 + Math.sin(a.p * Math.PI) * 0.12;
          }
          const p = { x: this.originX + (gx + 0.5) * cw, y: this.originY + (gy + 0.5) * cw };
          // 대기 중 광택
          const sparkle = (ts + (x * 7 + y * 13) * 260) % CFG.speeds.idleSparkle < 260;
          if (sparkle && !a) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(p.x - this.gemSize * 0.16, p.y - this.gemSize * 0.18, this.gemSize * 0.07, 0, TAU);
            ctx.fill();
            ctx.restore();
          }
          const sprite = gemSprite(cell.gem.color, cell.gem.power, cell.gem.orient, this.gemSize);
          const sz = this.gemSize * scale * (this.selected && this.selected.x === x && this.selected.y === y ? 1.08 : 1);
          blit(ctx, sprite, p.x, p.y, sz, alpha);
          if (cell.gem.power) {
            // 파워업은 살짝 움직인다
            ctx.save();
            ctx.translate(p.x, p.y);
            drawPowerOverlay(ctx, cell.gem.power, 0, 0, this.gemSize * 0.40, ts);
            ctx.restore();
          }
        }
        // 위 장애물(사슬/얼음/커튼)
        if (cell.ob && ['chain', 'ice', 'curtain'].includes(cell.ob.type)) {
          blit(ctx, obstacleSprite(cell.ob, this.gemSize), px.x, px.y, this.gemSize);
        }
        if (cell.ob && ['box', 'colorBox', 'mailbox', 'vase', 'birdNest', 'safe'].includes(cell.ob.type)) {
          blit(ctx, obstacleSprite(cell.ob, this.gemSize), px.x, px.y, this.gemSize);
        }
      }
    }

    // 선택 / 힌트 테두리
    const drawOutline = (x, y, color, dash, pulse) => {
      const px = this.cellPx(x, y);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.4;
      if (dash) ctx.setLineDash([6, 5]);
      ctx.setLineDash([]);
      const s = this.gemSize * (0.5 + (pulse ? Math.sin(ts * 0.012) * 0.03 : 0));
      rr(ctx, px.x - s, px.y - s, s * 2, s * 2, 10);
      ctx.stroke();
      ctx.restore();
    };
    if (this.selected) drawOutline(this.selected.x, this.selected.y, '#ffd23f', false, true);
    if (this.hint) { drawOutline(this.hint.a[0], this.hint.a[1], '#ffffff', true, true); drawOutline(this.hint.b[0], this.hint.b[1], '#ffffff', true, true); }
    if (this.tutorialHint && ts < this.tutorialHint.until) {
      drawOutline(this.tutorialHint.a[0], this.tutorialHint.a[1], '#fff', true, true);
      drawOutline(this.tutorialHint.b[0], this.tutorialHint.b[1], '#fff', true, true);
      const p = this.cellPx(this.tutorialHint.a[0], this.tutorialHint.a[1]);
      const p2 = this.cellPx(this.tutorialHint.b[0], this.tutorialHint.b[1]);
      const mx = (p.x + p2.x) / 2, my = (p.y + p2.y) / 2;
      ctx.save();
      ctx.font = `${this.cw * 0.5}px serif`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.9;
      const t = (ts % 1200) / 1200;
      ctx.fillText('👆', mx + Math.sin(t * TAU) * this.cw * 0.18, my + this.cw * 0.2);
      ctx.restore();
    }
    if (this.armedBooster) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,210,63,.9)';
      ctx.lineWidth = 4;
      rr(ctx, originX - 8, originY - 8, this.boardW + 16, this.boardH + 16, 22);
      ctx.stroke();
      ctx.restore();
    }

    // 사라지는 조각
    for (const f of this.fades) {
      const t = (ts - f.t0) / f.dur;
      if (t >= 1) continue;
      const px = this.cellPx(f.x, f.y);
      const sc = 1 + t * 0.5;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      drawGem(ctx, f.color, px.x, px.y, (this.gemSize * 0.42) * sc, { shadow: false });
      ctx.restore();
    }

    // 점수 팝업
    for (const p of this.pops) {
      const t = (ts - p.t0) / p.dur;
      const px = this.cellPx(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.font = `400 ${this.cw * 0.42}px 'Jua', sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#21306b';
      ctx.strokeText(p.text, px.x, px.y - t * this.cw * 0.8);
      ctx.fillStyle = '#fff';
      ctx.fillText(p.text, px.x, px.y - t * this.cw * 0.8);
      ctx.restore();
    }

    this.fx.draw();
    this.drawKing();
  }

  drawKingFrame() {
    this.fitKing();
  }

  drawKing() {
    const c = this.kingCanvas;
    const ctx = c.getContext('2d');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = c.clientWidth || 108, h = c.clientHeight || 142;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // 금색 아치 액자
    ctx.save();
    ctx.beginPath();
    const r = w * 0.5;
    ctx.moveTo(w * 0.08, h * 0.98);
    ctx.lineTo(w * 0.08, h * 0.42);
    ctx.arc(w * 0.5, h * 0.42, w * 0.42, Math.PI, 0);
    ctx.lineTo(w * 0.92, h * 0.98);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffe9a3');
    g.addColorStop(.5, '#f2c94c');
    g.addColorStop(1, '#c9971f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#a87b0c';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 내부 크림
    ctx.beginPath();
    ctx.moveTo(w * 0.14, h * 0.95);
    ctx.lineTo(w * 0.14, h * 0.43);
    ctx.arc(w * 0.5, h * 0.43, w * 0.36, Math.PI, 0);
    ctx.lineTo(w * 0.86, h * 0.95);
    ctx.closePath();
    const g2 = ctx.createLinearGradient(0, 0, 0, h);
    g2.addColorStop(0, '#eaf6ff');
    g2.addColorStop(1, '#bfe4ff');
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.clip();
    drawKing(ctx, w * 0.5, h * 0.66, w * 0.30, this.kingExpr, this.kingT);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- HUD */
  renderGoals() {
    const wrap = document.getElementById('hud-goals');
    wrap.innerHTML = '';
    const goals = this.board.goals;
    for (const g of goals) {
      const card = document.createElement('div');
      card.className = 'goal-card';
      card.dataset.goal = `${g.obstacle || g.type}:${g.colorKey || ''}`;
      card.innerHTML = `
        <div class="ribbon">${goalRibbon(g)}</div>
        <div class="cream panel-goal">
          <canvas class="goal-ico" width="44" height="44" style="width:34px;height:34px"></canvas>
          <span class="goal-num">${g.need - g.done}</span>
        </div>`;
      wrap.appendChild(card);
      const c = card.querySelector('canvas');
      const ctx = c.getContext('2d');
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      c.width = 44 * dpr; c.height = 44 * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(22, 22);
      const kind = g.type === 'collect' ? 'gem' : (g.type === 'letter' ? 'letter' : g.type === 'bird' ? 'bird' : (g.obstacle || g.type));
      drawIcon(ctx, kind, 0, 0, 34, { colorKey: g.colorKey });
    }
  }

  updateGoals(info) {
    const cards = document.querySelectorAll('#hud-goals .goal-card');
    this.board.goals.forEach((g, i) => {
      const card = cards[i];
      if (!card) return;
      card.querySelector('.goal-num').textContent = Math.max(0, g.need - g.done);
      if (g.done >= g.need) card.classList.add('done');
    });
    if (info?.goalDone?.length) Audio.play('collect');
  }

  updateTimerUI() {
    const num = document.getElementById('moves-num');
    const panel = num.parentElement;
    if (!num) return;
    num.textContent = Math.max(0, Math.ceil(this.secondsLeft));
    panel.classList.toggle('low', this.secondsLeft <= 10);
  }

  updateMoves(init = false) {
    if (this.timed) { this.updateTimerUI(); return; }
    const num = document.getElementById('moves-num');
    const panel = num.parentElement;
    num.textContent = Math.max(0, this.board.moves);
    panel.classList.toggle('low', this.board.moves <= CFG.audio.tensionMoves);
    if (!init) {
      num.classList.add('bump');
      setTimeout(() => num.classList.remove('bump'), 140);
    }
  }

  /* ---------------------------------------------------------------- 트레이 */
  renderTray() {
    const tray = document.getElementById('tray');
    tray.innerHTML = '';
    for (const key of CFG.boosters.order) {
      const def = CFG.boosters.defs[key];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bst';
      b.dataset.booster = key;
      b.innerHTML = `<canvas class="bico" width="40" height="40" style="width:34px;height:34px"></canvas><span>${def.short}</span><span class="bnum">0</span>`;
      tray.appendChild(b);
      const c = b.querySelector('canvas');
      const ctx = c.getContext('2d');
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      c.width = 40 * dpr; c.height = 40 * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(20, 20);
      drawIcon(ctx, def.icon, 0, 0, 34);
      b.addEventListener('click', () => this.tapBooster(key));
    }
    this.refreshTray();
  }

  refreshTray() {
    document.querySelectorAll('#tray .bst').forEach(b => {
      const key = b.dataset.booster;
      const n = Profile.boosterCount(key);
      b.querySelector('.bnum').textContent = n;
      b.classList.toggle('off', n <= 0);
      b.classList.toggle('armed', this.armedBooster === key);
    });
  }

  tapBooster(key) {
    if (this.ended || this.resolving > 2) return;
    if (Profile.boosterCount(key) <= 0) {
      toast('부스터가 없어요 — 상점 없이도 보상으로 모여요');
      Audio.play('swapback');
      return;
    }
    if (this.armedBooster === key) { this.armedBooster = null; this.refreshTray(); return; }
    this.armedBooster = key;
    this.refreshTray();
    Audio.play('select');
    const def = CFG.boosters.defs[key];
    if (def.target === 'none') this.useBooster(key);
    else toast(`${def.name} — 칸을 탭하세요`, 1400);
  }

  async useBooster(key, x, y, x2, y2) {
    if (!Profile.useBooster(key)) return;
    this.armedBooster = null;
    this.refreshTray();
    this.stats.boosters++;
    const b = this.board;
    Audio.play('button');
    if (key === 'hourglass') {
      b.moves += CFG.boosters.hourglassMoves;
      this.updateMoves();
      toast(`이동 +${CFG.boosters.hourglassMoves}`, 1200);
      return;
    }
    if (key === 'jester') {
      b.shuffle();
      this.fx.addShake(6);
      Audio.play('powerup');
      toast('보드를 섞었어요', 1200);
      const plan = { moves: [], spawns: [] };
      await this.settleView(plan, 260);
      return;
    }
    if (key === 'glove') {
      // 두 칸을 골라 교환
      if (x == null) { this.gloveFirst = null; toast('바꿀 첫 칸을 탭하세요', 1200); this.armedBooster = key; this.refreshTray(); return; }
      if (!this.gloveFirst) {
        this.gloveFirst = { x, y };
        this.armedBooster = key;
        this.refreshTray();
        toast('바꿀 두 번째 칸을 탭하세요', 1200);
        return;
      }
      const a = this.gloveFirst;
      this.gloveFirst = null;
      if (!b.canSwap(a.x, a.y, x, y)) { toast('붙어 있는 칸만 바꿀 수 있어요', 1200); Profile.addBooster('glove', 1); return; }
      b.rawSwap(a.x, a.y, x, y);
      Audio.play('swap');
      const ga = b.gem(a.x, a.y), gb = b.gem(x, y);
      this.animateSwap(ga, a, { x, y });
      this.animateSwap(gb, { x, y }, a);
      await wait(CFG.speeds.swap);
      await this.resolveAndAnimate();
      return;
    }
    const cells = b.boosterCells(key, x, y);
    const keys = new Set(cells.map(([cx, cy]) => `${cx},${cy}`));
    Audio.play(key === 'lightning' ? 'lightRelease' : key === 'prism' ? 'lightCharge' : 'powerup');
    if (key === 'lightning') {
      for (const [cx, cy] of cells.slice(0, 6)) {
        const p = this.cellPx(cx, cy);
        this.fx.beam(this.originX + this.boardW / 2, this.originY, p.x, p.y, '#ffd23f', { max: 260 });
      }
      this.fx.addShake(8);
    }
    this.applyBoosterClear(keys, key);
    await this.resolveAndAnimate();
  }

  applyBoosterClear(keys, key) {
    const info = this.board.applyClears(keys, { source: 'powerup', cascade: 0 });
    for (const [x, y] of info.cells) {
      const p = this.cellPx(x, y);
      this.fx.burst(p.x, p.y, '#ffffff', 6, { speed: 140 });
    }
    this.flyGoals(info);
  }

  /* ---------------------------------------------------------------- 입력 */
  bind() {
    if (this._bound) return;
    this._bound = true;
    const cv = this.boardCanvas;
    let down = null;
    const pos = e => {
      const r = cv.getBoundingClientRect();
      const t = e.touches?.[0] || e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const onDown = e => {
      if (this.ended) return;
      const p = pos(e);
      const c = this.pxToCell(p.x, p.y);
      if (!c) return;
      down = { c, p, t: performance.now(), moved: false };
      Audio.init();
      this.lastInput = performance.now();
      this.hint = null;
    };
    const onMove = e => {
      if (!down || this.ended) return;
      const p = pos(e);
      const dx = p.x - down.p.x, dy = p.y - down.p.y;
      const threshold = this.cw * CFG.speeds.swipeThreshold;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      down.moved = true;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? [1, 0] : [-1, 0]) : (dy > 0 ? [0, 1] : [0, -1]);
      const nx = down.c.x + dir[0], ny = down.c.y + dir[1];
      const from = down.c;
      down = null;
      this.swipe(from, { x: nx, y: ny });
    };
    const onUp = e => {
      if (!down || this.ended) { down = null; return; }
      const { c, moved } = down;
      down = null;
      if (moved) return;
      this.tapCell(c);
    };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', () => { down = null; });
    this._handlers = { onDown, onMove, onUp };
    document.getElementById('hud-close').addEventListener('click', () => this.openSettings());
  }

  unbind() {
    if (!this._bound) return;
    const cv = this.boardCanvas;
    cv.removeEventListener('pointerdown', this._handlers.onDown);
    cv.removeEventListener('pointermove', this._handlers.onMove);
    cv.removeEventListener('pointerup', this._handlers.onUp);
    this._bound = false;
  }

  tapCell(c) {
    Audio.init();
    if (this.armedBooster) {
      const key = this.armedBooster;
      if (key === 'glove') { this.useBooster('glove', c.x, c.y); return; }
      if (CFG.boosters.defs[key].target === 'cell') { this.useBooster(key, c.x, c.y); return; }
    }
    const gem = this.board.gem(c.x, c.y);
    if (!gem) return;
    if (gem.power) {
      this.activatePowerup(c);
      return;
    }
    if (this.selected) {
      const s = this.selected;
      if (Math.abs(s.x - c.x) + Math.abs(s.y - c.y) === 1) {
        this.selected = null;
        this.swipe(s, c);
        return;
      }
      if (s.x === c.x && s.y === c.y) { this.selected = null; return; }
    }
    this.selected = { x: c.x, y: c.y };
    Audio.play('select');
  }

  async swipe(a, b) {
    if (this.ended) return;
    if (this.busy.has(`${a.x},${a.y}`) || this.busy.has(`${b.x},${b.y}`)) return;
    const board = this.board;
    if (!board.canSwap(a.x, a.y, b.x, b.y)) {
      Audio.play('swapback');
      return;
    }
    this.selected = null;
    this.lastInput = performance.now();
    this.hint = null;
    const ga = board.gem(a.x, a.y), gb = board.gem(b.x, b.y);
    this.resolving++;
    const hooks = this.hooksFor();
    const res = await board.tryMove(a.x, a.y, b.x, b.y, hooks);
    this.resolving--;
    if (!res.ok && !res.activated) {
      this.animateSwap(ga, b, a);
      this.animateSwap(gb, a, b);
      Audio.play('swapback');
    }
    this.updateMoves();
    this.updateGoals();
    this.afterResolve();
  }

  async activatePowerup(c) {
    const gem = this.board.gem(c.x, c.y);
    if (!gem?.power) return;
    this.board.moves--;
    this.resolving++;
    await this.board.activateAt(c.x, c.y, this.hooksFor());
    this.resolving--;
    this.updateMoves();
    this.updateGoals();
    this.afterResolve();
  }

  hooksFor() {
    return {
      swap: async (ax, ay, bx, by) => {
        const ga = this.board.gem(ax, ay), gb = this.board.gem(bx, by);
        this.animateSwap(ga, { x: bx, y: by }, { x: ax, y: ay });
        this.animateSwap(gb, { x: ax, y: ay }, { x: bx, y: by });
        Audio.play('swap');
        await wait(CFG.speeds.swap);
      },
      swapBack: async (ax, ay, bx, by) => {
        const ga = this.board.gem(ax, ay), gb = this.board.gem(bx, by);
        this.animateSwap(ga, { x: ax, y: ay }, { x: bx, y: by });
        this.animateSwap(gb, { x: bx, y: by }, { x: ax, y: ay });
        await wait(CFG.speeds.swapBack);
      },
      clear: async (info, ms) => {
        this.onClear(info);
        await wait(ms);
      },
      fall: async (plan, ms) => {
        this.onFall(plan);
        await wait(ms);
      },
      combo: async (effect, ax, ay, bx, by) => {
        this.onCombo(effect, ax, ay, bx, by);
        this.fx.slowMo = 0.45;
        this.fx.punchZoom(1.05, CFG.speeds.comboSlowMo);
        setTimeout(() => { this.fx.slowMo = 1; }, CFG.speeds.comboSlowMo);
        await wait(effect.slowMo ? 150 : 80);
      },
      powerupCreated: (creations) => {
        this.stats.powerups += creations.length;
        Audio.play('powerup');
        for (const c of creations) {
          if (c.type === 'propeller') {
            Profile.state.propellerTotal = (Profile.state.propellerTotal || 0) + 1;
            Profile.save({ sync: false });
          }
          const p = this.cellPx(c.at[0], c.at[1]);
          this.fx.ring(p.x, p.y, '#ffffff', this.cw * 0.9, { max: 320 });
        }
      },
    };
  }

  animateSwap(gem, from, to) {
    if (!gem) return;
    this.anims.set(gem.id, { x: from.x, y: from.y, tx: to.x, ty: to.y, t0: performance.now(), dur: CFG.speeds.swap, ease: Ease.outQuad, kind: 'swap', squash: true });
  }

  onFall(plan) {
    const now = performance.now();
    let maxDist = 0;
    for (const mv of plan.moves) {
      maxDist = Math.max(maxDist, Math.abs(mv.toY - mv.fromY));
      this.anims.set(mv.gem.id, {
        x: mv.diag ? mv.fromX : mv.toX, y: mv.fromY,
        tx: mv.toX, ty: mv.toY,
        t0: now + Math.random() * 30, dur: Math.max(90, 60 * Math.max(1, Math.abs(mv.toY - mv.fromY))),
        ease: Ease.outQuad, kind: 'fall',
      });
    }
    for (const sp of plan.spawns) {
      if (!sp.gem) continue;
      this.anims.set(sp.gem.id, {
        x: sp.x, y: sp.fromY, tx: sp.x, ty: sp.y,
        t0: now, dur: 260, ease: Ease.outBack, kind: 'spawn',
      });
    }
    if (plan.moves.length) Audio.play('land');
  }

  onClear(info) {
    const now = performance.now();
    for (const [x, y] of info.cells) {
      this.fades.push({ x, y, color: 0, t0: now, dur: CFG.speeds.clear });
      const p = this.cellPx(x, y);
      this.fx.burst(p.x, p.y, '#ffffff', 4, { speed: 110, size: 4, life: 420 });
    }
    const chain = info.cascade || 0;
    Audio.play('match', { chain });
    // 장애물 파괴
    for (const d of info.destroyed || []) {
      const p = this.cellPx(d.x, d.y);
      const material = d.material || 'wood';
      Audio.play(material === 'glass' ? 'glass' : material === 'ice' ? 'ice' : material === 'metal' ? 'metal' : material === 'leaf' ? 'leaf' : 'crate');
      this.fx.burst(p.x, p.y, material === 'wood' ? '#b9762f' : material === 'ice' ? '#bfe4ff' : material === 'metal' ? '#9aa7bd' : '#4fbf5f', 9, { shape: 'square', speed: 190, size: 5 });
      this.fx.ring(p.x, p.y, '#ffffff', this.cw * 0.8, { max: 300 });
      if (material === 'wood' || material === 'metal') this.fx.addShake(3);
    }
    for (const dr of info.drops || []) {
      const p = this.cellPx(dr.x, dr.y);
      this.fx.burst(p.x, p.y, '#ffd23f', 8, { shape: 'star', speed: 160 });
      Audio.play(dr.type === 'coin' ? 'coin' : 'collect');
    }
    this.flyGoals(info);
    this.updateGoals(info);
    this.updateTrayCounts();
  }

  flyGoals(info) {
    if (!info?.destroyed?.length && !info?.goalDone?.length && !info?.drops?.length) return;
    const cards = document.querySelectorAll('#hud-goals .goal-card');
    cards.forEach((card, i) => {
      const g = this.board.goals[i];
      if (!g) return;
      const before = g.done;
      if (before <= 0) return;
      const rect = card.getBoundingClientRect();
      const stageRect = this.boardCanvas.getBoundingClientRect();
      const to = { x: rect.left + rect.width / 2 - stageRect.left, y: rect.top + rect.height / 2 - stageRect.top };
      // 목표 진행이 늘었으면 아이콘이 날아간다
      if (info.destroyed?.some(d => d.type === g.obstacle)) {
        const src = info.destroyed.find(d => d.type === g.obstacle);
        const from = this.cellPx(src.x, src.y);
        this.fx.fly(from, to, ctx => drawIcon(ctx, g.type === 'letter' ? 'letter' : (g.obstacle || 'box'), 0, 0, this.cw * 0.6, { colorKey: g.colorKey }), { dur: 460, curve: -60 });
      }
    });
    if (info.drops?.length) {
      const coinPill = document.querySelector('.pill.coins');
      if (coinPill) {
        const r = coinPill.getBoundingClientRect();
        const sr = this.boardCanvas.getBoundingClientRect();
        for (const dr of info.drops.filter(d => d.type === 'coin')) {
          const from = this.cellPx(dr.x, dr.y);
          this.fx.fly(from, { x: r.left + 18 - sr.left, y: r.top + 16 - sr.top }, ctx => drawCoin(ctx, 0, 0, this.cw * 0.22), { dur: 420, curve: -40 });
        }
      }
    }
  }

  updateTrayCounts() { this.refreshTray(); }

  onCombo(effect, ax, ay, bx, by) {
    this.stats.combos++;
    this.callout(effect.label || 'COMBO!');
    Audio.play('callout');
    Audio.play(effect.key === 'tnt' ? 'tnt' : effect.key?.includes('rocket') ? 'rocket' : 'lightRelease');
    this.fx.addShake(10);
    const p = this.cellPx(bx, by);
    this.fx.ring(p.x, p.y, '#ffffff', this.cw * 3.2, { max: 520, width: 8 });
    this.setKing('cheer', 1800);
    if (effect.key === 'light+light') {
      this.fx.ring(this.stageW / 2, this.stageH / 2, '#ffffff', this.stageW, { max: 620, width: 16 });
    }
  }

  callout(text) {
    const c = document.getElementById('callout');
    c.textContent = text;
    c.classList.remove('show');
    void c.offsetWidth;
    c.classList.add('show');
  }

  async resolveAndAnimate() {
    this.resolving++;
    await this.board.settle(this.hooksFor(), 1);
    this.resolving--;
    this.updateGoals();
    this.updateMoves();
    this.afterResolve();
  }

  afterResolve() {
    if (this.resolving > 0 || this.ended) return;
    const empties = emptyPlayableCells(this.board);
    if (empties.length) {
      // 안전망: 빈 칸이 있으면 즉시 채운다
      this.board.fillEmpty();
    }
    if (this.board.goalComplete()) { this.win(); return; }
    if (this.board.moves <= 0) { this.fail(); return; }
    if (!this.board.hasMove()) {
      toast('움직일 수 있는 수가 없어 보드를 섞어요', 1400);
      this.board.shuffle();
      Audio.play('powerup');
    }
  }

  /* ---------------------------------------------------------------- 승리 */
  async win() {
    if (this.ended) return;
    this.ended = true;
    this.resolving = 0;
    this.selected = null;
    this.hint = null;
    this.armedBooster = null;
    Audio.stopMusic();
    Audio.play('victory');
    this.setKing('cheer', 0);
    const movesLeft = Math.max(0, this.board.moves);
    const coins = CFG.economy.levelClearBase + movesLeft * CFG.economy.perRemainingMove;
    const mult = this.level.difficulty === 'normal' ? 1 : CFG.economy.hardRewardMultiplier;
    const totalCoins = Math.round(coins * mult);

    // 피날레: 남은 이동이 로켓/TNT가 되어 보드를 쓸고, 코인이 쏟아진다
    this.callout(movesLeft > 0 ? `남은 이동 ${movesLeft}발!` : 'CLEAR!');
    this.fx.addShake(6);
    this.board.moves = 0;
    this.updateMoves();
    await this.playFinale(movesLeft);

    // 별이 날아와 꽂힌다
    const starTo = { x: this.stageW / 2, y: this.stageH * 0.3 };
    this.fx.fly({ x: this.stageW * 0.5, y: this.stageH * 0.72 }, starTo, ctx => drawStar(ctx, 0, 0, this.cw * 0.5), { dur: 700, curve: -120, scale: 1.3 });
    Audio.play('coinShower');
    await wait(620);

    this.stats.cleared = movesLeft;
    const custom = !!this.opts.custom;
    const reward = this.opts.reward || {};
    if (!custom) {
      Profile.completeLevel(this.levelId);
      Profile.onLevelWin();
    }
    Profile.addCoins(totalCoins + (reward.coins || 0));
    for (const b of reward.boosters || []) Profile.addBooster(b, 1);
    if (this.opts.chestKey && !Profile.state.chests.includes(this.opts.chestKey)) {
      Profile.state.chests.push(this.opts.chestKey);
      Profile.save();
    }
    if (this.opts.scoreAttack) this.opts.app?.events?.submitRushScore?.(this.board.score);
    Audio.play('chest');
    if (custom) this.showEventWin(totalCoins + (reward.coins || 0));
    else this.showWinModal(totalCoins, movesLeft);
  }

  showEventWin(coins) {
    modal({
      title: `${this.level.title || '이벤트'} 성공!`,
      body: `<div style="font-size:44px">🎉</div><div class="result-coins">🪙 +${fmt(coins)}</div>
        <p>${this.level.title === '번개 러시' ? `점수 ${fmt(this.board.score)}점` : '보상이 도착했어요'}</p>`,
      closable: false,
      buttons: [
        { label: '홈', cls: 'blue small', onClick: () => { this.finish(); this.onHome(); }, close: false },
        { label: '한 번 더', cls: 'green', onClick: () => { this.finish(); this.start(this.level, { ...this.opts }); }, close: false },
      ],
    });
  }

  onTimeout() {
    if (this.ended) return;
    this.ended = true;
    Audio.stopMusic();
    Audio.play('failpop');
    this.setKing('SAD'.toLowerCase(), 0);
    const score = this.board.score;
    if (this.opts.scoreAttack) {
      this.opts.app?.events?.submitRushScore?.(score);
      modal({
        title: '시간 종료!',
        body: `<div class="result-coins">⚡ ${fmt(score)}점</div>
          <p>주간 최고 점수 ${fmt(Math.max(score, Profile.state.rushBest || 0))}점</p>`,
        closable: false,
        buttons: [
          { label: '홈', cls: 'blue small', onClick: () => { this.finish(); this.onHome(); }, close: false },
          { label: '다시 도전', cls: 'green', onClick: () => { this.finish(); this.start(this.level, { ...this.opts }); }, close: false },
        ],
      });
      return;
    }
    modal({
      title: '시간 종료!',
      body: `<p>${this.board.goalsRemainingText() || '목표를 다 채우지 못했어요'}</p>
        <p style="font-size:12px;color:#8a93ad">이 미니게임은 실패해도 목숨이 줄지 않아요</p>`,
      closable: false,
      buttons: [
        { label: '홈', cls: 'blue small', onClick: () => { this.finish(); this.onHome(); }, close: false },
        { label: '다시 도전', cls: 'green', onClick: () => { this.finish(); this.start(this.level, { ...this.opts }); }, close: false },
      ],
    });
  }

  async playFinale(movesLeft) {
    const shots = Math.min(movesLeft, 10);
    for (let i = 0; i < shots; i++) {
      if (this.skipFinale) break;
      const spots = [];
      for (let y = 0; y < this.board.rows; y++) for (let x = 0; x < this.board.cols; x++) {
        if (this.board.gem(x, y)) spots.push([x, y]);
      }
      if (!spots.length) break;
      const [x, y] = spots[Math.floor(Math.random() * spots.length)];
      const g = this.board.gem(x, y);
      if (!g) break;
      g.power = i % 2 === 0 ? 'rocket' : 'tnt';
      g.orient = 'h';
      const p = this.cellPx(x, y);
      Audio.play(g.power === 'rocket' ? 'rocket' : 'tnt');
      this.fx.addShake(7);
      await this.board.activateAt(x, y, this.hooksFor());
      this.fx.burst(p.x, p.y, '#ffd23f', 8, { shape: 'star', speed: 200 });
      await wait(CFG.speeds.finaleStep);
    }
    // 코인 쏟아짐
    for (let i = 0; i < 14; i++) {
      this.fx.fly(
        { x: Math.random() * this.stageW, y: -20 },
        { x: this.stageW * (0.15 + Math.random() * 0.7), y: this.stageH * 0.55 },
        ctx => drawCoin(ctx, 0, 0, this.cw * 0.2),
        { dur: 500 + Math.random() * 400, curve: 60 },
      );
    }
    this.board.fillEmpty();
    Audio.play('coinShower');
  }

  showWinModal(coins, movesLeft) {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="result-stars">⭐</div>
      <div class="result-coins">🪙 <b>+${fmt(coins)}</b></div>
      <p>남은 이동 ${movesLeft}발이 로켓과 TNT로 터졌어요.</p>
      <div class="result-goals">${this.board.goals.map(g => `<span class="result-goal">${goalRibbon(g)} ${g.done}/${g.need}</span>`).join('')}</div>
      ${Profile.state.winStreak > 1 ? `<p style="color:#b8860b">🔥 ${Profile.state.winStreak}연승! 다음 레벨 시작 선물이 커져요</p>` : ''}
    `;
    modal({
      title: '레벨 클리어!',
      body,
      closable: false,
      buttons: [
        { label: '🏠 홈', cls: 'blue small', onClick: () => { this.finish(); this.onHome(); }, close: false },
        { label: '계속 ▶', cls: 'green', onClick: () => { this.finish(); this.onNext(this.levelId + 1); }, close: false },
      ],
      onClose: () => {},
    });
  }

  /* ---------------------------------------------------------------- 실패 */
  async fail() {
    if (this.ended) return;
    if (this.opts?.custom) {
      this.ended = true;
      Audio.stopMusic();
      Audio.play('fail');
      this.setKing('sad', 0);
      modal({
        title: '이벤트 종료',
        body: `<p>${this.board.goalsRemainingText() || '이번 판은 여기까지예요'}</p>
          <div class="result-coins">🪙 ${fmt(this.board.score)}</div>`,
        closable: false,
        buttons: [
          { label: '홈', cls: 'blue small', onClick: () => { this.finish(); this.onHome(); }, close: false },
          { label: '다시 도전', cls: 'green', onClick: () => { this.finish(); this.start(this.level, { ...this.opts }); }, close: false },
        ],
      });
      return;
    }
    this.ended = true;
    this.resolving = 0;
    Audio.stopMusic();
    Audio.play('fail');
    this.setKing('sad', 0);
    this.fx.addShake(5);
    this.callout('거의 다 됐어요!');
    await wait(420);
    const remaining = this.board.goalsRemainingText();
    const canContinue = !this.continued;
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="font-size:15px">${remaining || '이동 수를 다 썼어요'}</p>
      <div class="result-goals">${this.board.goals.map(g => `<span class="result-goal">${goalRibbon(g)} ${Math.max(0, g.need - g.done)} 남음</span>`).join('')}</div>
      <div class="result-coins">🪙 ${fmt(Profile.state.coins)}</div>
      <p style="font-size:12px;color:#8a93ad">이어하기는 한 번만 가능해요</p>
    `;
    modal({
      title: '아깝다!',
      body,
      closable: false,
      buttons: [
        { label: `+${CFG.economy.continueMoves} 이동 (🪙${fmt(CFG.economy.continueCost)})`, cls: 'gold', close: false, onClick: () => {
          if (!canContinue) { toast('이미 이어하기를 사용했어요'); return false; }
          if (!Profile.spendCoins(CFG.economy.continueCost)) { toast('코인이 부족해요'); return false; }
          this.continued = true;
          this.ended = false;
          this.board.moves = CFG.economy.continueMoves;
          this.updateMoves();
          Audio.startMusic('level');
          this.setKing('tense');
          this.resumeFromFail();
          return true;
        } },
        { label: '다시 하기', cls: 'blue small', close: false, onClick: () => { this.loseLife(); this.finish(); this.restart(); } },
        { label: '나가기', cls: 'ghost small', close: false, onClick: () => { this.loseLife(); this.finish(); this.onHome(); } },
      ],
    });
  }

  resumeFromFail() {
    this.resolving = 0;
    this.afterResolve();
  }

  loseLife() {
    if (this.opts?.noLifeLoss) return;
    if (!Profile.unlimitedActive()) {
      Profile.spendLife(CFG.lives.failCost);
      toast('목숨 1개를 사용했어요');
    }
    Profile.onLevelFail();
  }

  /* ---------------------------------------------------------------- 설정/나가기 */
  openSettings() {
    modal({
      title: '잠시 멈춤',
      body: `
        <div class="setting-row"><span>🎵 음악</span><input type="range" min="0" max="100" value="${Math.round(Profile.settings.music * 100)}" data-set="music"></div>
        <div class="setting-row"><span>🔔 효과음</span><input type="range" min="0" max="100" value="${Math.round(Profile.settings.sfx * 100)}" data-set="sfx"></div>
        <p style="font-size:12px;color:#8a93ad">나가면 이번 레벨은 실패 처리돼요</p>`,
      buttons: [
        { label: '계속하기', cls: 'green', close: true },
        { label: '그만두기', cls: 'red small', onClick: () => { this.quitLevel(); }, close: false },
      ],
      onClose: () => {},
    });
    const root = document.getElementById('modal-root');
    root.querySelectorAll('input[type=range]').forEach(inp => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.set;
        const v = Number(inp.value) / 100;
        Profile.setSetting(key, v);
        if (key === 'music') Audio.setMusicVolume(v);
        if (key === 'sfx') Audio.setSfxVolume(v);
      });
    });
  }

  async quitLevel() {
    document.getElementById('modal-root').innerHTML = '';
    if (!this.ended) this.loseLife();
    this.finish();
    this.onHome();
  }

  finish() {
    this.running = false;
    this.stopLoop();
    this.unbind();
    Audio.stopMusic();
    document.getElementById('modal-root').innerHTML = '';
    this.ended = true;
  }

  async restart() {
    const id = this.levelId;
    this.running = false;
    this.stopLoop();
    this.ended = false;
    await this.start(id, {});
  }
}

function goalRibbon(g) {
  if (g.type === 'collect') return '모으기';
  if (g.type === 'letter') return '편지';
  if (g.type === 'bird') return '아기새';
  const short = {
    box: '상자', colorBox: '색상자', grass: '풀밭', mailbox: '우체통', vase: '꽃병',
    chain: '사슬', ice: '얼음', birdNest: '둥지', honey: '꿀', safe: '금고', curtain: '커튼',
  };
  return short[g.obstacle || g.type] || CFG.obstacles[g.obstacle || g.type]?.name || '목표';
}
