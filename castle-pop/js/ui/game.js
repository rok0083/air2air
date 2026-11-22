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
import { drawGem, drawGemGlint, drawKing, drawPowerOverlay, drawObstacle, drawDrop, drawIcon, rr, TAU, drawCoin, drawStar } from '../art/art.js';
import { gemSprite, obstacleSprite, dropSprite, iconSprite, blit } from '../art/sprites.js';
import { modal, toast, fmt, curtainTransition, showScreen } from './dom.js';

/* 스프라이트를 가로·세로 다른 배율로 찍는다 (낙하 늘어남 · 착지 스쿼시) */
function drawSprite(ctx, sprite, x, y, w, h, alpha = 1) {
  if (!sprite || alpha <= 0.004) return;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h);
  ctx.globalAlpha = 1;
}

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
    this.fades = [];             // (구) 사라지는 조각
    this.clears = [];            // 팝 애니메이션(부풀어 터짐)
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
    this.clears = [];
    this.pops = [];
    this.fx.pool.items.forEach(p => { p.alive = false; });
    this.selected = null;
    this.armedBooster = null;
    this.gloveFirst = null;
    this.hint = null;
    this.skipFinale = false;
    this.lastInput = performance.now();
    this.kingExpr = 'smile';
    // 판마다 초기화해야 하는 상태 — 이전 판의 실패/이어하기 흔적을 남기지 않는다
    this.resolving = 0;
    this.continued = false;
    this.busy.clear();
    this.stats = { cleared: 0, combos: 0, boosters: 0, powerups: 0 };
    this.tutorialHint = null;
    clearTimeout(this._kingTimer);

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
    this.goalSeen = this.board.goals.map(g => g.done);
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
    this.bind();            // finish() 가 입력을 떼어냈어도 새 판은 항상 조작 가능해야 한다
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
    const cw = Math.min((W - 30) / cols, (H - 30) / rows);
    const bw = cw * cols, bh = cw * rows;
    this.cw = cw;
    this.gemSize = cw * CFG.board.gemScale;
    this.boardW = bw;
    this.boardH = bh;
    this.originX = (W - bw) / 2;
    this.originY = (H - bh) * 0.52;
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
    this.clears = this.clears.filter(f => (ts - f.t0) < (f.delay || 0) + f.dur);
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
    // HUD 아래 왕실 깃발 장식 — 보드 위 빈 하늘을 채운다
    if (originY > 56) drawBunting(ctx, W, 4, ts);

    // 보드 바탕 — 금색 이중 베젤 + 라벤더 우물
    const pad = 10;
    const bx0 = originX - pad, by0 = originY - pad;
    const bw2 = this.boardW + pad * 2, bh2 = this.boardH + pad * 2;
    const rad = CFG.board.boardRadius;
    ctx.save();
    ctx.shadowColor = 'rgba(24,44,110,.30)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 9;
    const frame = ctx.createLinearGradient(0, by0, 0, by0 + bh2);
    frame.addColorStop(0, '#ffeeb2');
    frame.addColorStop(0.30, '#f2c94c');
    frame.addColorStop(0.72, '#dcae33');
    frame.addColorStop(1, '#b8871a');
    ctx.fillStyle = frame;
    rr(ctx, bx0, by0, bw2, bh2, rad + 4);
    ctx.fill();
    ctx.restore();
    // 금 프레임 안쪽 어두운 홈 + 하이라이트
    ctx.strokeStyle = 'rgba(120,80,6,.55)';
    ctx.lineWidth = 2;
    rr(ctx, bx0 + 2.5, by0 + 2.5, bw2 - 5, bh2 - 5, rad + 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 1.6;
    rr(ctx, bx0 + 5, by0 + 5, bw2 - 10, bh2 - 10, rad);
    ctx.stroke();
    // 라벤더 보드 우물
    const bg = ctx.createLinearGradient(0, originY, 0, originY + this.boardH);
    bg.addColorStop(0, '#e6ebff');
    bg.addColorStop(0.5, CFG.board.boardColorTop);
    bg.addColorStop(1, CFG.board.boardColorBottom);
    ctx.fillStyle = bg;
    rr(ctx, originX - 3, originY - 3, this.boardW + 6, this.boardH + 6, rad);
    ctx.fill();
    // 우물 안쪽 그림자(위) — 깊이감
    ctx.save();
    rr(ctx, originX - 3, originY - 3, this.boardW + 6, this.boardH + 6, rad);
    ctx.clip();
    const inner = ctx.createLinearGradient(0, originY - 3, 0, originY + this.cw * 0.7);
    inner.addColorStop(0, 'rgba(40,60,130,.22)');
    inner.addColorStop(1, 'rgba(40,60,130,0)');
    ctx.fillStyle = inner;
    ctx.fillRect(originX - 3, originY - 3, this.boardW + 6, this.cw);
    ctx.restore();

    // 칸 우물 — 체커 톤 + 안쪽 음영으로 조각이 떠 보이게
    for (let y = 0; y < this.board.rows; y++) {
      for (let x = 0; x < this.board.cols; x++) {
        const cell = this.board.cell(x, y);
        if (!cell || cell.hole) continue;
        const cx0 = originX + x * cw, cy0 = originY + y * cw;
        const inset = cw * 0.05;
        rr(ctx, cx0 + inset, cy0 + inset, cw - inset * 2, cw - inset * 2, cw * 0.20);
        ctx.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.34)' : 'rgba(160,178,235,.20)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.42)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx0 + inset + cw * 0.12, cy0 + inset + 0.5);
        ctx.lineTo(cx0 + cw - inset - cw * 0.12, cy0 + inset + 0.5);
        ctx.stroke();
      }
    }
    // 모서리 장식 (프레임 안쪽에 박힌 금 장식)
    const so = Math.max(8, this.cw * 0.22);
    for (const [cx2, cy2] of [[bx0 + so, by0 + so], [bx0 + bw2 - so, by0 + so], [bx0 + so, by0 + bh2 - so], [bx0 + bw2 - so, by0 + bh2 - so]]) {
      drawCornerStud(ctx, cx2, cy2, this.cw * 0.20);
    }

    // 셀 내용 — 보드 안쪽으로 클립해서 위에서 떨어지는 조각이 하늘에 뜨지 않게
    ctx.save();
    rr(ctx, originX - 2, originY - 2, this.boardW + 4, this.boardH + 4, rad - 2);
    ctx.clip();
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
          const st = a ? this.animState(a, ts) : null;
          const gx = st ? st.x : x;
          const gy = st ? st.y : y;
          const sx2 = st ? st.sx : 1;
          const sy2 = st ? st.sy : 1;
          const alpha = st ? st.a : 1;
          const p = { x: this.originX + (gx + 0.5) * cw, y: this.originY + (gy + 0.5) * cw };
          const sprite = gemSprite(cell.gem.color, cell.gem.power, cell.gem.orient, this.gemSize);
          const sel = this.selected && this.selected.x === x && this.selected.y === y ? 1.08 : 1;
          // 낙하 잔상 — 떨어지는 궤적이 눈에 남도록 위쪽에 반투명 잔상을 겹친다
          if (st && st.moving && (a.dist || 0) >= 2) {
            const trail = Math.min(2, Math.round((a.dist || 2) / 2));
            for (let k = trail; k >= 1; k--) {
              drawSprite(ctx, sprite, p.x, p.y - this.gemSize * 0.30 * k,
                this.gemSize * sel * sx2 * (1 - k * 0.05), this.gemSize * sel * sy2, alpha * (0.14 / k));
            }
          }
          drawSprite(ctx, sprite, p.x, p.y, this.gemSize * sel * sx2, this.gemSize * sel * sy2, alpha);
          // 대기 중 광택이 조각 위를 가로지른다
          if (!st || !st.moving) {
            const period = CFG.speeds.idleSparkle;
            const phase = ((ts + (x * 7 + y * 13) * 97) % period) / period;
            const win = CFG.speeds.glintMs / period;
            const gp = phase / win;
            if (gp <= 1) drawGemGlint(ctx, p.x, p.y + this.gemSize * 0.06, this.gemSize * 0.60, gp, 0.9);
          }
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

    ctx.restore();

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

    // 사라지는 조각 — 부풀어 터지는 팝
    for (const f of this.clears) {
      const t = Math.max(0, (ts - f.t0 - (f.delay || 0)) / f.dur);
      if (t >= 1) continue;
      const px = this.cellPx(f.x, f.y);
      const sprite = gemSprite(f.color, f.power, f.orient, this.gemSize);
      if (t < 0.42) {
        const u = t / 0.42;
        const s = 1 + Ease.outQuad(u) * 0.30;
        drawSprite(ctx, sprite, px.x, px.y, this.gemSize * s, this.gemSize * s, 1);
        // 하얀 번쩍임
        ctx.save();
        const g = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, this.gemSize * (0.35 + u * 0.5));
        g.addColorStop(0, `rgba(255,255,255,${0.75 * (1 - u)})`);
        g.addColorStop(0.55, `rgba(255,255,255,${0.32 * (1 - u)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px.x, px.y, this.gemSize * (0.35 + u * 0.5), 0, TAU);
        ctx.fill();
        ctx.restore();
      } else {
        const u = (t - 0.42) / 0.58;
        const s = 1.30 * (1 - Ease.inQuad(u));
        drawSprite(ctx, sprite, px.x, px.y, this.gemSize * s, this.gemSize * s, 1 - u);
      }
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
    this.goalSeen = this.board.goals.map(g => g.done);
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
    const onCancel = () => { down = null; };
    cv.addEventListener('pointercancel', onCancel);
    this._handlers = { onDown, onMove, onUp, onCancel };
    this._hudCloseHandler = () => this.openSettings();
    document.getElementById('hud-close').addEventListener('click', this._hudCloseHandler);
  }

  unbind() {
    if (!this._bound) return;
    const cv = this.boardCanvas;
    cv.removeEventListener('pointerdown', this._handlers.onDown);
    cv.removeEventListener('pointermove', this._handlers.onMove);
    cv.removeEventListener('pointerup', this._handlers.onUp);
    cv.removeEventListener('pointercancel', this._handlers.onCancel);
    if (this._hudCloseHandler) {
      document.getElementById('hud-close').removeEventListener('click', this._hudCloseHandler);
      this._hudCloseHandler = null;
    }
    this._handlers = null;
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
        this.onClear(info, ms);
        await wait(ms);
      },
      fall: async (plan, ms) => {
        this.onFall(plan, ms);
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
    this.anims.set(gem.id, { x: from.x, y: from.y, tx: to.x, ty: to.y, t0: performance.now(), dur: CFG.speeds.swap, ease: Ease.outCubic, kind: 'swap' });
  }

  /* 애니메이션 상태 계산 — 위치 · 가로세로 배율 · 투명도 */
  animState(a, now) {
    const t = Math.max(0, Math.min(1, (now - (a.t0 || 0)) / Math.max(1, a.dur)));
    if (a.kind === 'fall' || a.kind === 'spawn') {
      const p1 = a.posShare ?? 0.74;
      if (t < p1) {
        const u = t / p1;
        const e = u * u;                        // 중력 가속: 처음엔 느리게, 곸에 빠르게
        const stretch = Math.sin(u * Math.PI);
        const alpha = a.kind === 'spawn' ? Math.min(1, 0.15 + u * 3) : 1;
        return {
          x: a.x + (a.tx - a.x) * e,
          y: a.y + (a.ty - a.y) * e,
          sx: 1 - 0.11 * stretch,
          sy: 1 + 0.20 * stretch,
          a: alpha,
          moving: true,
        };
      }
      // 착지 — 스쿼시 후 되튀는 바운스
      const q = (t - p1) / Math.max(0.0001, 1 - p1);
      const damp = Math.pow(1 - q, 1.7);
      const sq = Math.sin(q * Math.PI * 1.7) * damp * 0.32;
      return { x: a.tx, y: a.ty, sx: 1 + sq, sy: 1 - sq, a: 1, moving: false };
    }
    const e = (a.ease || Ease.outCubic)(t);
    return { x: a.x + (a.tx - a.x) * e, y: a.y + (a.ty - a.y) * e, sx: 1, sy: 1, a: 1, moving: t < 0.999 };
  }

  onFall(plan, budget) {
    if (!plan) return;
    const now = performance.now();
    const land = CFG.speeds.landingBounce;
    const perCell = CFG.speeds.fallPerCell;
    const base = Math.max(200, (budget || 400) - land);
    let maxDrop = 0;
    for (const mv of plan.moves) {
      const d = Math.max(1, Math.abs(mv.toY - mv.fromY));
      const drop = Math.max(120, Math.min(base, d * perCell));
      maxDrop = Math.max(maxDrop, drop);
      const dur = drop + land;
      this.anims.set(mv.gem.id, {
        kind: 'fall',
        x: mv.fromX, y: mv.fromY, tx: mv.toX, ty: mv.toY,
        t0: now + ((mv.toX * 37) % 26), dur,
        posShare: drop / dur, dist: d,
      });
    }
    for (const sp of plan.spawns || []) {
      if (!sp.gem) continue;
      const d = Math.max(1, sp.y - sp.fromY);
      const drop = Math.max(150, Math.min(520, d * perCell));
      maxDrop = Math.max(maxDrop, drop);
      const dur = drop + land;
      this.anims.set(sp.gem.id, {
        kind: 'spawn',
        x: sp.x, y: sp.fromY, tx: sp.x, ty: sp.y,
        t0: now + ((sp.x * 37) % 26), dur,
        posShare: drop / dur, dist: d,
      });
    }
    // 착지음은 발끝이 닿는 순간에
    if (maxDrop > 0) setTimeout(() => { if (this.running) Audio.play('land'); }, maxDrop);
  }

  onClear(info, ms = CFG.speeds.clear) {
    const now = performance.now();
    const dur = Math.max(170, Math.min(ms + 50, 330));
    const list = info.pops && info.pops.length ? info.pops : info.cells.map(([x, y]) => ({ x, y, color: 0 }));
    list.forEach((cp, i) => {
      this.clears.push({
        x: cp.x, y: cp.y, color: cp.color ?? 0, power: cp.power || null, orient: cp.orient || null,
        t0: now, dur, delay: (i % 6) * 7,
      });
      const p = this.cellPx(cp.x, cp.y);
      const col = CFG.colors[(cp.color || 0) % CFG.colors.length];
      this.fx.burst(p.x, p.y, col.main, 5, { shape: 'square', speed: 220, size: this.cw * 0.11, life: 500, grav: 820 });
      this.fx.burst(p.x, p.y, '#ffffff', 3, { shape: 'star', speed: 170, size: this.cw * 0.12, life: 360, grav: 400 });
      this.fx.ring(p.x, p.y, col.light, this.cw * 0.66, { max: 300, width: 3.5 });
    });
    Audio.play('match', { chain: info.cascade || 0 });
    // 연쇄가 이어지면 콜아웃이 단계별로 올라간다
    const casc = info.cascade || 0;
    if (casc >= 2) {
      const co = CFG.ui.callouts.filter(c => casc >= c.at).pop();
      if (co) this.callout(co.text);
    }
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
    if (!info) return;
    const cards = document.querySelectorAll('#hud-goals .goal-card');
    const stageRect = this.boardCanvas.getBoundingClientRect();
    const prev = this.goalSeen || [];
    const srcs = (info.destroyed || []).map(d => ({ x: d.x, y: d.y, type: d.type }));
    const gemSrcs = (info.pops || []).slice(0, 8);
    cards.forEach((card, i) => {
      const g = this.board.goals[i];
      if (!g) return;
      const gained = g.done - (prev[i] ?? g.done);
      if (gained <= 0) return;
      let src = null;
      if (g.obstacle) src = srcs.find(s => s.type === g.obstacle);
      else if (gemSrcs.length) src = gemSrcs[Math.min(gemSrcs.length - 1, i)];
      if (!src) src = { x: (this.board.cols - 1) / 2, y: (this.board.rows - 1) / 2 };
      const rect = card.getBoundingClientRect();
      const to = { x: rect.left + rect.width / 2 - stageRect.left, y: rect.top + rect.height / 2 - stageRect.top };
      const from = this.cellPx(src.x, src.y);
      const kind = g.type === 'collect' ? 'gem' : (g.obstacle || 'box');
      this.fx.fly(from, to, ctx => drawIcon(ctx, kind, 0, 0, this.cw * 0.55, { colorKey: g.colorKey }), { dur: 520, curve: -80, color: '#ffe066' });
      this.fx.ring(from.x, from.y, '#ffe9a3', this.cw * 0.7, { max: 320 });
      card.classList.remove('gain');
      void card.offsetWidth;
      card.classList.add('gain');
    });
    if (info.drops?.length) {
      const coinPill = document.querySelector('.pill.coins');
      if (coinPill) {
        const r = coinPill.getBoundingClientRect();
        const sr = this.boardCanvas.getBoundingClientRect();
        for (const dr of info.drops.filter(d => d.type === 'coin')) {
          const from = this.cellPx(dr.x, dr.y);
          this.fx.fly(from, { x: r.left + 18 - sr.left, y: r.top + 16 - sr.top }, ctx => drawCoin(ctx, 0, 0, this.cw * 0.22), { dur: 460, curve: -50, color: '#ffd23f' });
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
    // 10레벨마다 보물 상자
    let chest = null;
    const localLv = this.level.level || 0;
    const chestKey = `lvl-${this.level.area || 1}-${localLv}`;
    if (!custom && localLv > 0 && localLv % CFG.economy.chestEveryLevels === 0 && !Profile.state.chests.includes(chestKey)) {
      Profile.state.chests.push(chestKey);
      Profile.addCoins(CFG.economy.chestCoins);
      for (const b of ['hammer', 'arrow', 'jester', 'lightning']) Profile.addBooster(b, CFG.economy.chestBoosters);
      chest = { coins: CFG.economy.chestCoins };
      Audio.play('chest');
    }
    Audio.play('chest');
    if (custom) this.showEventWin(totalCoins + (reward.coins || 0));
    else this.showWinModal(totalCoins, movesLeft, chest);
  }

  showEventWin(coins) {
    modal({
      title: `${this.level.title || '이벤트'} 성공!`,
      body: `<div style="font-size:44px">🎉</div><div class="result-coins">🪙 +${fmt(coins)}</div>
        <p>${this.level.title === '번개 러시' ? `점수 ${fmt(this.board.score)}점` : '보상이 도착했어요'}</p>`,
      closable: false,
      buttons: [
        { label: '홈', cls: 'blue small', onClick: () => { this.finish(); this.onHome(); }, close: false },
        { label: '한 번 더', cls: 'green', onClick: () => { this.restart(); }, close: false },
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
          { label: '다시 도전', cls: 'green', onClick: () => { this.restart(); }, close: false },
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
        { label: '다시 도전', cls: 'green', onClick: () => { this.restart(); }, close: false },
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

  showWinModal(coins, movesLeft, chest = null) {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="result-stars"><span class="on">★</span><span>★</span><span>★</span></div>
      <div class="result-coins">🪙 <b>+${fmt(coins)}</b></div>
      <p>남은 이동 ${movesLeft}발이 로켓과 TNT로 터졌어요.</p>
      <div class="result-goals">${this.board.goals.map(g => `<span class="result-goal">${goalRibbon(g)} ${g.done}/${g.need}</span>`).join('')}</div>
      ${Profile.state.winStreak > 1 ? `<p style="color:#b8860b">🔥 ${Profile.state.winStreak}연승! 다음 레벨 시작 선물이 커져요</p>` : ''}
      ${chest ? `<p style="color:#b8860b">🎁 10레벨 보물 상자! 🪙${fmt(chest.coins)} + 부스터 ${CFG.economy.chestBoosters}개씩</p>` : ''}
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
          { label: '다시 도전', cls: 'green', onClick: () => { this.restart(); }, close: false },
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
      <p style="font-size:12px;color:#8a93ad">${canContinue ? '이어하기는 한 번만 가능해요' : '이 판은 여기까지 — 다시 하면 새로 시작해요'}</p>
    `;
    const failButtons = [];
    // 이어하기는 한 번만 — 이미 쓴 판에서는 누를 수 없는 버튼을 남기지 않는다
    if (canContinue) {
      failButtons.push({ label: `+${CFG.economy.continueMoves} 이동 (🪙<span style="display:inline-block;width:5px"></span>${fmt(CFG.economy.continueCost)})`, cls: 'gold', close: false, onClick: () => {
        if (!Profile.spendCoins(CFG.economy.continueCost)) { toast('코인이 부족해요'); return false; }
        this.continued = true;
        this.ended = false;
        this.board.moves = CFG.economy.continueMoves;
        this.updateMoves();
        Audio.startMusic('level');
        this.setKing('tense');
        this.resumeFromFail();
        return true;
      } });
    }
    failButtons.push(
      { label: '다시 하기', cls: 'blue small', close: false, onClick: () => { this.loseLife(); this.restart(); } },
      { label: '나가기', cls: 'ghost small', close: false, onClick: () => { this.loseLife(); this.finish(); this.onHome(); } },
    );
    modal({
      title: '아깝다!',
      body,
      closable: false,
      buttons: failButtons,
    });
  }

  resumeFromFail() {
    this.resolving = 0;
    this.bind();            // 이어하기 직후에는 보드 입력이 반드시 살아 있어야 한다
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

  /* 같은 레벨을 처음부터 다시 — 루프·입력·음악·팝업을 모두 정리하고 새 판을 연다 */
  async restart() {
    const target = (this.opts?.custom && this.level) ? { ...this.level } : this.levelId;
    // 시작 부스터는 레벨 시작 때 이미 차감됐으므로 다시 주지 않는다(모드 설정만 유지)
    const opts = { ...(this.opts || {}), preBoosters: {} };
    this.finish();
    this.ended = false;
    await this.start(target, opts);
    this.bind();
  }
}


/* HUD 아래로 늘어지는 왕실 깃발(번팅) */
function drawBunting(ctx, W, y0, ts) {
  const x0 = 6, x1 = W - 6, sag = 16, n = 9;
  const cord = t => y0 + 2 * t * (1 - t) * sag * 1.6;
  ctx.save();
  // 줄
  ctx.strokeStyle = 'rgba(150,112,26,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, cord(0));
  ctx.quadraticCurveTo(W / 2, y0 + sag * 1.9, x1, cord(1));
  ctx.stroke();
  const cols = [['#5b93ff', '#1f4fd8'], ['#ffe9a3', '#f2c94c'], ['#ff8fa3', '#e63e5c']];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = x0 + t * (x1 - x0);
    const y = cord(t);
    const sway = Math.sin(ts * 0.0016 + i * 1.1) * 1.6;
    const c = cols[i % 3];
    const w = Math.min(20, (W / n) * 0.52);
    ctx.save();
    ctx.translate(x + sway, y);
    const g = ctx.createLinearGradient(0, 0, 0, 26);
    g.addColorStop(0, c[0]);
    g.addColorStop(1, c[1]);
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(120,86,14,.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(0, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 2, 1);
    ctx.lineTo(-w / 6, 1);
    ctx.lineTo(-w / 2 + 2, 22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawCornerStud(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#fff7d6');
  g.addColorStop(0.45, '#f2c94c');
  g.addColorStop(1, '#b8871a');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#8a6209';
  ctx.lineWidth = 1.6;
  rr(ctx, -r * 0.60, -r * 0.60, r * 1.20, r * 1.20, r * 0.20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath();
  ctx.arc(-r * 0.16, -r * 0.18, r * 0.15, 0, TAU);
  ctx.fill();
  ctx.restore();
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
