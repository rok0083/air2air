/* =========================================================================
   게임 세션 — 스테이지/블리츠 플레이 화면 전체를 관리합니다.
   보드(로직) + 렌더러 + 이펙트 + HUD + 입력 + 결과 처리
   ========================================================================= */
import { CFG, GEMS } from '../config.js';
import { Board } from '../core/board.js';
import { BoardView } from './boardview.js';
import { Effects } from '../effects/particles.js';
import { buildHud, updateHud, updateBoosterCounts } from './hud.js';
import { $, el, fmt, toast, openModal, closeAllModals, ICONS, timeLeft } from './dom.js';
import { openPreLevel } from './prelevel.js';
import { starCount } from '../meta/levels.js';
import { levelName, isBossLevel } from '../meta/worldmap.js';
import { saveBlitzScore } from '../firebase/rankings.js';

export class GameSession {
  constructor(app, opts) {
    this.app = app;
    this.mode = opts.mode || 'level';
    this.world = opts.world || 1;
    this.level = opts.level || 1;
    this.levelData = opts.levelData;
    this.startBoosters = opts.startBoosters || {};
    this.continues = 0;
    this.finished = false;
    this.selectedBooster = null;
    this.tapCell = null;
    this.drag = null;
    this.lastAction = performance.now();
    this.raf = 0;
    this.lastT = 0;
    this.timeLeftMs = CFG.blitz.seconds * 1000;
    this._hudDirty = false;
    this.destroyed = false;
  }

  async start() {
    const { app } = this;
    closeAllModals();
    $('#screen-home').classList.add('hidden');
    $('#screen-game').classList.remove('hidden');
    document.querySelectorAll('.boss-portrait').forEach(n => n.remove());
    const canvas = $('#board');
    const fx = $('#fx');

    this.board = new Board(this.levelData, this.makeHooks());
    this.view = new BoardView(canvas, this.board);
    this.effects = new Effects(fx);
    this.inner = $('#board-inner');

    if (this.mode === 'level') {
      this.world = this.levelData.world || this.world;
    }
    buildHud(this);

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(document.querySelector('.board-stage'));
    window.addEventListener('orientationchange', this.resizeBound = () => setTimeout(() => this.resize(), 250));

    this.bindInput();
    this.bindHud();

    app.audio.unlock();
    app.audio.startMusic(this.mode === 'blitz' ? 4 : this.world);

    await this.board.init(this.startBoosters);
    updateBoosterCounts(this);
    updateHud(this);

    if (this.mode === 'blitz') {
      this.blitzEnd = performance.now() + this.timeLeftMs;
    }
    this.lastT = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.app.state.session = this;
  }

  /* ── 훅 ───────────────────────────────────────────────── */
  makeHooks() {
    const cellFx = (r, c) => this.view.cellCenter(r, c);
    return {
      onReady: () => { this.markHud(); },
      onStateChange: () => this.markHud(),
      onSwap: () => this.app.audio.sfx('swap'),
      onInvalidSwap: () => this.app.audio.sfx('invalid'),
      onCascade: (n) => { this.app.audio.sfx('match', { cascade: n }); if (n >= 2) this.app.audio.sfx('cascade', { cascade: n }); },
      onComboBanner: (n) => this.showBanner(`${n} 연쇄!`),
      onScore: () => this.markHud(),
      onClear: (tile, r, c) => {
        const { x, y } = cellFx(r, c);
        const gem = GEMS[tile.color] || GEMS[0];
        this.effects.burst(x, y, { color: gem.color, count: 6, speed: 110, size: 3.6, life: 0.5, gravity: 260 });
      },
      onPowerupCreate: (type, r, c) => {
        const { x, y } = cellFx(r, c);
        this.effects.sparkle(x, y, type === 'tnt' ? '#ff8b6b' : type === 'electro' ? '#c56cf0' : '#ffe066', 12);
        this.app.audio.sfx('powerup');
        this.markHud();
      },
      onPowerupActivate: (type, r, c) => {
        const { x, y } = cellFx(r, c);
        this.app.audio.sfx(type === 'tnt' ? 'tnt' : type === 'electro' ? 'electro' : type === 'spinner' ? 'spinner' : 'rocket');
        if (type === 'tnt') this.effects.shock(x, y, '#ff9f43', this.view.cell * 1.6);
      },
      onPowerupFx: (type, r, c, cells) => {
        const from = cellFx(r, c);
        if (type === 'rocket') {
          const ends = cells.length ? cells[cells.length - 1] : null;
          for (const [rr, cc] of [...cells.slice(0, 1), ...cells.slice(-1)]) {
            const to = cellFx(rr, cc);
            this.effects.trail(from.x, from.y, to.x, to.y, '#ffb703', 9);
          }
        } else if (type === 'electro') {
          for (const [rr, cc] of cells.slice(0, 14)) {
            const to = cellFx(rr, cc);
            this.effects.arc(from.x, from.y, to.x, to.y, '#c56cf0');
          }
          this.effects.screenFlash(0.35);
        } else if (type === 'drill') {
          const to = cellFx(cells[0]?.[0] ?? r, c);
          this.effects.trail(from.x, from.y, to.x, to.y, '#9fe8ff', 12);
        }
      },
      onSpinnerFly: (r, c, tr, tc) => {
        const a = cellFx(r, c), b = cellFx(tr, tc);
        this.effects.fly(a.x, a.y, b.x, b.y, '#48dbfb');
        this.effects.shock(b.x, b.y, '#48dbfb', this.view.cell * 1.4);
      },
      onComboBlast: (label) => {
        this.showBanner(label);
        this.punchZoom();
      },
      onBigBlast: (n) => {
        if (n >= 10) { this.effects.punch(7); this.punchZoom(); }
      },
      onShake: (v) => this.effects.punch(v),
      onFlash: (v) => this.effects.screenFlash(v),
      onSlowmo: () => {},
      onObstacleHit: (obs) => {
        const { x, y } = cellFx(obs.r, obs.c);
        this.effects.burst(x, y, { color: obs.def.material === 'ice' ? '#9fe8ff' : '#ffffff', count: 3, speed: 70, size: 2.6, life: 0.35, gravity: 120 });
        this.app.audio.sfx('obstacle');
        this.markHud();
      },
      onObstacleBreak: (obs) => {
        const { x, y } = cellFx(obs.r, obs.c);
        this.effects.debris(x, y, obs.def.material, 12);
        this.app.audio.sfx('break');
        this.markHud();
      },
      onObstacleSpawn: (obs) => {
        const { x, y } = cellFx(obs.r, obs.c);
        this.effects.sparkle(x, y, '#b06cff', 6);
        this.markHud();
      },
      onObstacleEvent: () => this.app.audio.sfx('obstacle'),
      onBossDamage: () => this.markHud(),
      onBossSummon: (obs) => {
        toast('보스가 장애물을 소환했어요!', 'bad', 1500);
        this.app.audio.sfx('boss');
      },
      onItemCollected: (r, c) => {
        const { x, y } = cellFx(r, c);
        this.effects.sparkle(x, y, '#ffe066', 16);
        this.app.audio.sfx('item');
        toast('마법 씨앗 획득!', 'gold', 1200);
        this.markHud();
      },
      onGoalsComplete: () => {
        this.markHud();
        setTimeout(() => this.finish(true), 700);
      },
      onOutOfMoves: () => {
        this.markHud();
        setTimeout(() => this.finish(false), 500);
      },
      onDrop: () => {},
      onTurnEnd: () => this.markHud(),
      onShuffleStart: () => {},
      onShuffleEnd: (ok) => { if (!ok) toast('보드를 섞었어요!', 'info', 1200); },
      onItemSpawned: () => {},
      onBoosterUse: () => {},
    };
  }

  markHud() { this._hudDirty = true; }

  /* ── 레이아웃 ─────────────────────────────────────────── */
  resize() {
    if (!this.view) return;
    const stage = document.querySelector('.board-stage');
    if (!stage) return;
    const w = Math.min(stage.clientWidth - 20, CFG.ui.maxWidth - 20);
    const h = stage.clientHeight - 10;
    const size = Math.max(220, Math.floor(Math.min(w, h)));
    this.inner.style.width = size + 'px';
    this.inner.style.height = size + 'px';
    this.view.layout(size, size);
    this.effects.resize(size, size);
  }

  /* ── 입력 ─────────────────────────────────────────────── */
  bindInput() {
    const canvas = $('#board');
    const getCell = (e) => {
      const rect = canvas.getBoundingClientRect();
      return this.view.cellAt(e.clientX - rect.left, e.clientY - rect.top);
    };
    this.onDown = async (e) => {
      if (this.finished) return;
      this.lastAction = performance.now();
      this.board.hintCells = null;
      const cell = getCell(e);
      if (!cell) return;
      if (this.selectedBooster) {
        const key = this.selectedBooster;
        this.selectedBooster = null;
        document.querySelectorAll('[data-booster]').forEach(b => b.classList.remove('active'));
        this.app.profile.useBooster(key);
        this.app.profile.save();
        updateBoosterCounts(this);
        const ok = await this.board.useBooster(key, cell.r, cell.c);
        if (ok) this.app.audio.sfx('booster');
        this.markHud();
        return;
      }
      if (this.board.busy || this.board.state !== 'playing') return;
      this.drag = { cell, x: e.clientX, y: e.clientY, moved: false };
      this.view.selected = cell;
      canvas.setPointerCapture?.(e.pointerId);
    };
    this.onMove = (e) => {
      if (!this.drag || this.drag.moved) return;
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (Math.hypot(dx, dy) < this.view.cell * 0.32) return;
      this.drag.moved = true;
      let r2 = this.drag.cell.r, c2 = this.drag.cell.c;
      if (Math.abs(dx) > Math.abs(dy)) c2 += dx > 0 ? 1 : -1;
      else r2 += dy > 0 ? 1 : -1;
      const from = this.drag.cell;
      this.drag = null;
      this.view.selected = null;
      this.doSwap(from.r, from.c, r2, c2);
    };
    this.onUp = (e) => {
      if (!this.drag) { this.view.selected = null; return; }
      const { cell } = this.drag;
      this.drag = null;
      if (this.board.busy || this.board.state !== 'playing') return;
      const prev = this.tapCell;
      if (prev && Math.abs(prev.r - cell.r) + Math.abs(prev.c - cell.c) === 1) {
        this.tapCell = null;
        this.view.selected = null;
        this.doSwap(prev.r, prev.c, cell.r, cell.c);
      } else {
        this.tapCell = cell;
        this.view.selected = cell;
      }
    };
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
  }

  async doSwap(r1, c1, r2, c2) {
    if (this.finished) return;
    this.lastAction = performance.now();
    this.tapCell = null;
    const ok = await this.board.trySwap(r1, c1, r2, c2);
    this.markHud();
    if (ok && this.board.state === 'playing' && !this.board.hasMove()) {
      await this.board.shuffle();
      toast('가능한 수가 없어 보드를 섞었어요.', 'info', 1400);
    }
    if (this.board.state === 'lost' && this.mode === 'level') this.finish(false);
  }

  bindHud() {
    $('#hud-back')?.addEventListener('click', () => this.confirmQuit());
    $('#hud-sound')?.addEventListener('click', (e) => {
      const on = this.app.audio.toggle();
      this.app.profile.data.settings.muted = !on;
      this.app.profile.save();
      e.currentTarget.innerHTML = on ? ICONS.sound : ICONS.mute;
    });
    document.querySelectorAll('[data-booster]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.booster;
        if (this.app.profile.boosterCount(key) <= 0) { toast('부스터가 없어요. 상점에서 살 수 있어요.', 'bad'); return; }
        if (this.selectedBooster === key) {
          this.selectedBooster = null; btn.classList.remove('active'); return;
        }
        this.selectedBooster = key;
        document.querySelectorAll('[data-booster]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.app.audio.sfx('click');
        toast(`${CFG.boosters[key].name}: 사용할 칸을 탭하세요.`, 'info', 1600);
      });
    });
    $('#hud-hint')?.addEventListener('click', () => {
      const hint = this.board.getHint();
      if (hint) toast('반짝이는 두 칸을 바꿔 보세요!', 'info', 1400);
    });
  }

  confirmQuit() {
    if (this.finished) { this.app.goHome(); return; }
    openModal({
      title: '스테이지에서 나갈까요?',
      subtitle: '지금 나가면 이번 판 기록은 사라집니다. (목숨은 돌아오지 않아요)',
      body: `<p class="tiny muted center">다시 도전하려면 목숨 1개가 필요합니다.</p>`,
      actions: [
        { label: '계속 하기', class: 'btn-green' },
        { label: '나가기', class: 'btn-ghost', onClick: (close) => { close(); this.destroy(); this.app.goHome(); } },
      ],
    });
  }

  /* ── 루프 ─────────────────────────────────────────────── */
  loop(t) {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;

    if (this.mode === 'blitz' && !this.finished) {
      this.timeLeftMs = Math.max(0, this.blitzEnd - t);
      const sec = Math.ceil(this.timeLeftMs / 1000);
      const mv = $('#hud-moves');
      if (mv) mv.textContent = String(sec);
      const gt = $('#goal-time');
      if (gt) gt.textContent = sec + 's';
      const pct = Math.min(100, Math.round((this.board.score / CFG.blitz.goalScore) * 100));
      const gp = $('#goal-blitz');
      if (gp) gp.textContent = pct + '%';
      if (this.timeLeftMs <= 0) this.finishBlitz();
    }

    this.view.render(t);
    this.effects.update(dt);
    this.effects.draw();

    if (this.board.state === 'playing' && !this.board.busy && !this.finished) {
      const idle = t - this.lastAction;
      if (idle > CFG.anim.hintDelay && !this.board.hintCells) this.board.getHint();
    }
    if (this._hudDirty && t % 3 < 1.2) { this._hudDirty = false; updateHud(this); }
  }

  showBanner(text) {
    const b = $('#banner');
    if (!b) return;
    b.textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  punchZoom() {
    if (!this.inner?.animate) return;
    this.inner.animate([{ transform: 'scale(1.035)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
  }

  /* ── 결과 ─────────────────────────────────────────────── */
  finish(win) {
    if (this.finished || this.destroyed) return;
    this.finished = true;
    this.board.busy = true;
    const p = this.app.profile;
    const score = this.board.score;
    if (win) {
      if (this.mode === 'blitz') { this.finishBlitz(); return; }
      const thresholds = this.levelData.stars || [2500, 5000, 8000];
      const stars = starCount(score, thresholds);
      const rewards = p.recordClear(this.world, this.level, stars, score);
      this.app.audio.sfx('win');
      this.app.audio.stopMusic();
      this.app.syncSoon(true);
      this.showWinModal(stars, rewards, score);
    } else {
      p.recordFail(this.world, this.level, score);
      this.app.audio.sfx('lose');
      this.app.syncSoon(true);
      this.showLoseModal(score);
    }
  }

  showWinModal(stars, rewards, score) {
    const { world, level } = this;
    const nextLevel = Math.min(CFG.progression.levelsPerWorld, level + 1);
    const hasNext = level < CFG.progression.levelsPerWorld;
    const levelUps = rewards.levelUps || [];
    const body = el('div', {});
    body.innerHTML = `
      <div class="result-score">
        <div class="rs">${fmt(score)}</div>
        <div class="rl">${escTitle(this.levelData.name || levelName(world, level))} 클리어!</div>
      </div>
      <div class="stars-row">
        ${[0, 1, 2].map(i => `<div class="star-slot ${i < stars ? 'on' : ''}" style="animation-delay:${i * 0.12}s">${ICONS.star}</div>`).join('')}
      </div>
      ${levelUps.length ? `<div class="center chip" style="margin:0 auto">플레이어 레벨 업! Lv.${this.app.profile.playerLevel}</div>` : ''}
      <div class="reward-grid">
        <div class="reward">${ICONS.coin}<b>+${fmt(rewards.coins)}</b>코인</div>
        <div class="reward">${ICONS.gem}<b>+${fmt(rewards.xp)}</b>경험치</div>
        <div class="reward">${ICONS.hammer}<b>+${rewards.hammers}</b>망치 토큰</div>
      </div>
      <p class="tiny muted center">연승 ${this.app.profile.data.streak.count}회 · 별 ${this.app.profile.starsOf(world, level)}/3</p>
    `;
    openModal({
      title: '스테이지 클리어!',
      subtitle: `${world}월드 · ${level}번째 길`,
      body,
      closable: false,
      actions: [
        { label: '지도로', class: 'btn-ghost', onClick: (close) => { close(); this.destroy(); this.app.goHome(); } },
        hasNext
          ? { label: '다음 스테이지', class: 'btn-green', onClick: (close) => { close(); this.destroy(); openPreLevel(this.app, world, nextLevel); } }
          : { label: '다시 하기', class: 'btn-green', onClick: (close) => { close(); this.destroy(); openPreLevel(this.app, world, level); } },
      ],
    });
  }

  showLoseModal(score) {
    const { world, level } = this;
    const canContinue = this.continues < CFG.lives.continueMax && this.app.profile.coins >= CFG.lives.continueCost;
    const body = el('div', {});
    body.innerHTML = `
      <div class="result-score">
        <div class="rs" style="color:#ff9db3">${fmt(score)}</div>
        <div class="rl">이동 수를 다 썼어요</div>
      </div>
      <div class="goal-list">
        ${this.board.goals.list.map(g => `<div class="goal-row">${this.board.goals.icon(g)}<span>${this.board.goals.label(g)}</span><span class="gcount">${Math.min(g.done, g.total)}/${g.total}</span></div>`).join('')}
      </div>
      <p class="tiny muted center">${canContinue ? `코인 ${fmt(CFG.lives.continueCost)}개로 +${CFG.lives.continueMoves} 이동을 받을 수 있어요.` : '이번 판은 여기까지예요. 다시 도전해 봐요!'}</p>
    `;
    openModal({
      title: '아쉬워요!',
      subtitle: `${levelName(world, level)} · 목표를 거의 다 채웠어요`,
      body,
      closable: false,
      actions: [
        { label: '지도로', class: 'btn-ghost', onClick: (close) => { close(); this.destroy(); this.app.goHome(); } },
        ...(canContinue ? [{
          label: `+${CFG.lives.continueMoves} 이동 (${fmt(CFG.lives.continueCost)} 코인)`, class: 'btn',
          onClick: (close) => {
            if (!this.app.profile.spendCoins(CFG.lives.continueCost)) { toast('코인이 부족해요.', 'bad'); return; }
            this.continues++;
            this.app.profile.save();
            this.app.syncSoon();
            close();
            this.finished = false;
            this.board.busy = false;
            this.board.addMoves(CFG.lives.continueMoves);
            this.lastAction = performance.now();
            this.app.audio.sfx('coin');
            toast(`+${CFG.lives.continueMoves} 이동! 마지막 힘을 내요.`, 'gold');
            this.markHud();
          },
        }] : []),
      ],
    });
  }

  async finishBlitz() {
    if (this.finished) return;
    this.finished = true;
    const score = this.board.score;
    const p = this.app.profile;
    const rewards = p.recordBlitz(score);
    this.app.audio.sfx('win');
    this.app.audio.stopMusic();
    const best = Math.max(score, p.blitzBest());
    this.app.syncSoon(true);
    const body = el('div', {});
    body.innerHTML = `
      <div class="result-score"><div class="rs">${fmt(score)}</div><div class="rl">이번 주 최고 ${fmt(best)}점</div></div>
      <div class="reward-grid">
        <div class="reward">${ICONS.coin}<b>+${rewards.coins}</b>코인</div>
        <div class="reward">${ICONS.gem}<b>+${rewards.xp}</b>경험치</div>
        <div class="reward">${ICONS.star}<b>${Math.round((score / CFG.blitz.goalScore) * 100)}%</b>목표 달성</div>
      </div>
      <p class="tiny muted center" id="blitz-save-status">주간 랭킹에 기록을 올리는 중…</p>
    `;
    openModal({
      title: '블리츠 종료!',
      subtitle: '60초 동안의 점수',
      body,
      closable: false,
      actions: [
        { label: '지도로', class: 'btn-ghost', onClick: (close) => { close(); this.destroy(); this.app.goHome(); } },
        { label: '랭킹 보기', class: 'btn', onClick: (close) => { close(); this.destroy(); this.app.openRanking('blitz'); } },
        { label: '한 번 더', class: 'btn-green', onClick: (close) => { close(); this.destroy(); this.app.openBlitz(); } },
      ],
    });
    // 저장은 화면을 띄운 뒤 백그라운드로
    saveBlitzScore({ uid: p.uid, name: p.name, score, roomCode: p.roomCode || 'GLOBAL', playerLevel: p.playerLevel })
      .then((saved) => {
        const elx = document.getElementById('blitz-save-status');
        if (elx) elx.textContent = saved.ok ? '주간 블리츠 랭킹에 기록을 올렸어요.' : '오프라인이라 이 기기에만 기록했어요.';
      });
  }

  destroy() {
    this.destroyed = true;
    closeAllModals();
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    this.ro?.disconnect();
    window.removeEventListener('orientationchange', this.resizeBound);
    this.app.audio.stopMusic();
    document.querySelectorAll('.boss-portrait').forEach(n => n.remove());
    $('#screen-game').classList.add('hidden');
    const canvas = $('#board');
    if (canvas) {
      canvas.onpointerdown = null;
    }
    this.app.state.session = null;
  }
}

function escTitle(s) { return String(s || '').replace(/[<>&]/g, ''); }
