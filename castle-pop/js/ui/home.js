/* =========================================================================
   home.js — 성 홈 화면: 구역 일러스트 · 과제 · 이벤트 · 일일 보상 · 룰렛
   ========================================================================= */
import { CFG } from '../config.js';
import { Profile, todayId } from '../meta/profile.js';
import { areaOf } from '../meta/levels.js';
import { drawCastle, drawIcon, drawCoin, drawStar } from '../art/art.js';
import { Audio } from '../audio/audio.js';
import { modal, toast, fmt, el, showScreen, curtainTransition } from './dom.js';

export class HomeScreen {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('screen-home');
    this.canvas = document.getElementById('castle');
    this.ctx = this.canvas.getContext('2d');
    this.running = false;
    this.t = 0;
    this.last = 0;
    this.raf = 0;
    this.dust = [];
    this.bind();
  }

  bind() {
    document.getElementById('play-btn').addEventListener('click', () => this.play());
    document.getElementById('task-btn').addEventListener('click', () => this.openTasks());
    document.getElementById('home-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      Audio.play('button');
      const tab = btn.dataset.tab;
      if (tab === 'home') { this.setTab('home'); return; }
      if (tab === 'rank') { this.setTab('rank'); this.app.openRanking(); }
      if (tab === 'event') { this.setTab('event'); this.app.openEvents(); }
      if (tab === 'setting') { this.setTab('setting'); this.app.openSettings(); }
    });
  }

  setTab(id) {
    document.querySelectorAll('#home-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  }

  show() {
    showScreen('screen-home');
    this.setTab('home');
    this.refresh();
    this.startLoop();
    Audio.init();
    Audio.startMusic('home');
    Audio.setTempo(1);
    // 하루 첫 방문: 일일 보상
    setTimeout(() => {
      if (Profile.dailyAvailable()) this.openDaily();
      else if (Profile.rouletteAvailable()) this.showRouletteHint();
    }, 700);
  }

  hide() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  refresh() {
    const s = Profile.state;
    Profile.refreshLives(false);
    const top = document.getElementById('home-top');
    top.innerHTML = `
      <div class="pill lives" id="pill-lives"><span class="ico">❤️</span><b>${Profile.unlimitedActive() ? '∞' : s.lives}</b>${Profile.unlimitedActive() ? '<small>무제한</small>' : ''}</div>
      <div class="pill coins" id="pill-coins"><span class="ico">🪙</span><b>${fmt(s.coins)}</b></div>
      <div class="pill stars" id="pill-stars"><span class="ico">⭐</span><b>${s.stars}</b></div>
    `;
    top.querySelector('#pill-lives').addEventListener('click', () => this.openLives());
    top.querySelector('#pill-coins').addEventListener('click', () => toast('코인은 레벨 클리어·상자·이벤트로 모여요'));
    top.querySelector('#pill-stars').addEventListener('click', () => this.openTasks());

    document.getElementById('play-level').textContent = Math.min(CFG.areas * CFG.levelsPerArea, s.level);
    const area = areaOf(Math.min(s.level, CFG.areas * CFG.levelsPerArea));
    const tasksLeft = Profile.areaStarsNeeded(area);
    const badge = document.getElementById('task-badge');
    badge.textContent = tasksLeft;
    badge.style.display = tasksLeft ? 'flex' : 'none';

    const st = document.getElementById('home-streak');
    const gift = Profile.streakGift();
    st.textContent = s.winStreak > 0
      ? `🔥 ${s.winStreak}연승${gift ? ` · 다음 레벨 선물 ${gift.boosters.map(b => b === 'light' ? '빛구슬' : b === 'rocket' ? '로켓' : 'TNT').join('+')}` : ''}`
      : '첫 클리어부터 연승 선물이 쌓여요';

    this.renderEventButtons();
  }

  renderEventButtons() {
    const ev = this.app.events.current();
    const left = document.getElementById('home-events-left');
    const right = document.getElementById('home-events-right');
    left.innerHTML = '';
    right.innerHTML = '';
    const mk = (icon, label, badge, fn) => {
      const b = el('button', 'event-btn', `${badge ? '<i class="dot"></i>' : ''}${icon}<span>${label}</span>`);
      b.type = 'button';
      b.addEventListener('click', () => { Audio.play('button'); fn(); });
      return b;
    };
    left.appendChild(mk(ev.icon, ev.short, Profile.dailyAvailable(), () => this.openDaily()));
    left.appendChild(mk('🎡', '룰렛', Profile.rouletteAvailable(), () => this.openRoulette()));
    right.appendChild(mk('🎪', '이벤트', true, () => this.app.openEvents()));
    right.appendChild(mk('🏆', '랭킹', false, () => this.app.openRanking()));
  }

  startLoop() {
    this.running = true;
    this.last = performance.now();
    const tick = now => {
      if (!this.running) return;
      const dt = Math.min(50, now - this.last);
      this.last = now;
      this.t += dt;
      this.draw(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  draw(dt) {
    const c = this.canvas;
    const W = this.el.clientWidth, H = this.el.clientHeight;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.style.width = `${W}px`;
      c.style.height = `${H}px`;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const area = Profile.currentArea();
    const done = Profile.tasksDoneIn(area);
    drawCastle(ctx, W, H, area, done, this.t);
    // 과제 완료 먼지/반짝임
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.life -= dt;
      if (d.life <= 0) { this.dust.splice(i, 1); continue; }
      d.x += d.vx * dt * 0.06;
      d.y += d.vy * dt * 0.06;
      d.vy += 0.05;
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life / d.max);
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  sparkle(x, y) {
    for (let i = 0; i < 24; i++) {
      this.dust.push({
        x, y,
        vx: (Math.random() - 0.5) * 9,
        vy: (Math.random() - 0.8) * 9,
        r: 1.5 + Math.random() * 2.6,
        color: ['#fff', '#ffe9a3', '#ffd23f', '#bfe4ff'][i % 4],
        life: 700 + Math.random() * 500,
        max: 1200,
      });
    }
  }

  /* ---------------------------------------------------------------- 플레이 */
  async play() {
    Audio.play('button');
    const levelId = Math.min(CFG.areas * CFG.levelsPerArea, Profile.state.level);
    await this.app.launchLevel(levelId);
  }

  /* ---------------------------------------------------------------- 과제 */
  openTasks() {
    const area = Profile.currentArea();
    const def = CFG.areaDefs[area - 1];
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="font-size:13px;color:#8a93ad;margin-bottom:6px">${def.name} · ⭐ ${Profile.state.stars} 보유</div>
      <div class="task-list" id="task-list"></div>
    `;
    const m = modal({ title: '구역 과제', body, buttons: [{ label: '닫기', cls: 'ghost' }] });
    const list = body.querySelector('#task-list');
    const render = () => {
      list.innerHTML = '';
      for (const t of def.tasks) {
        const done = Profile.taskDone(area, t.key);
        const row = el('div', `task-row${done ? ' done' : ''}`);
        row.innerHTML = `
          <span style="font-size:18px">${done ? '✅' : '⭐'}</span>
          <span class="tn">${t.name}</span>
          <span class="tc">${done ? '완료' : `별 ${t.stars}개`}</span>`;
        if (!done) {
          const btn = el('button', `btn ${Profile.state.stars >= t.stars ? 'green' : 'ghost'} small`, '하기');
          btn.type = 'button';
          btn.style.minWidth = '56px';
          btn.disabled = Profile.state.stars < t.stars;
          btn.addEventListener('click', () => {
            if (Profile.completeTask(area, t.key)) {
              Audio.play('chest');
              this.sparkle(this.el.clientWidth * 0.5, this.el.clientHeight * 0.5);
              toast(`${t.name} 완료! 성이 조금씩 되살아나요`);
              this.refresh();
              render();
              if (Profile.areaComplete(area)) this.openAreaChest(area);
            } else {
              toast('별이 부족해요 — 레벨을 깨면 별을 받아요');
            }
          });
          row.appendChild(btn);
        }
        list.appendChild(row);
      }
      const allDone = Profile.areaComplete(area);
      if (allDone) {
        const p = el('p', '', '🎉 이 구역의 과제를 모두 마쳤어요!');
        list.appendChild(p);
      }
    };
    render();
    return m;
  }

  openAreaChest(area) {
    const key = `area-${area}`;
    if (Profile.state.chests.includes(key)) return;
    Profile.state.chests.push(key);
    Profile.addCoins(CFG.economy.areaChestCoins);
    const nextArea = Math.min(CFG.areas, area + 1);
    Profile.state.area = nextArea;
    if (nextArea > area) Profile.state.level = Math.max(Profile.state.level, (area) * CFG.levelsPerArea + 1);
    Profile.grantUnlimitedLives(CFG.economy.unlimitedLivesMs);
    Profile.save();
    Audio.play('chest');
    modal({
      title: '구역 완성!',
      body: `<div style="font-size:46px">🎁</div>
        <div class="result-coins">🪙 +${fmt(CFG.economy.areaChestCoins)}</div>
        <p>무제한 목숨 30분 + <b>${CFG.areaDefs[nextArea - 1]?.name || ''}</b> 해금!</p>`,
      buttons: [{ label: '좋아요!', cls: 'green', onClick: () => this.refresh() }],
    });
  }

  /* ---------------------------------------------------------------- 일일 보상 */
  openDaily() {
    const s = Profile.state;
    const day = s.dailyReward.lastClaim && s.dailyReward.lastClaim === todayId() ? s.dailyReward.day : ((s.dailyReward.day || 0) % 7) + 1;
    const body = document.createElement('div');
    const cells = CFG.reward.daily.map((p, i) => {
      const d = i + 1;
      const claimed = s.dailyReward.lastClaim === todayId() && d <= s.dailyReward.day;
      return `<div style="flex:1;min-width:38px;border-radius:10px;border:2px solid ${d === day ? '#2fbd5f' : '#eef2fb'};background:${claimed ? '#eaffef' : '#fff'};padding:6px 2px;font-size:10px">
        <div style="font-size:10px;color:#8a93ad">${d}일</div>
        <div style="font-size:16px">${p.booster ? '🎁' : '🪙'}</div>
        <div>${p.booster ? CFG.boosters.defs[p.booster].short : fmt(p.coins)}</div>
      </div>`;
    }).join('');
    body.innerHTML = `<div style="display:flex;gap:4px;margin-bottom:8px">${cells}</div>
      <p style="font-size:13px">7일 연속 접속하면 큰 보상이 기다려요</p>`;
    const m = modal({
      title: '집사의 일일 선물',
      body,
      closable: false,
      buttons: [{ label: Profile.dailyAvailable() ? '받기' : '오늘은 받았어요', cls: Profile.dailyAvailable() ? 'green' : 'ghost', close: false, onClick: () => {
        const prize = Profile.claimDaily();
        if (prize) {
          Audio.play('chest');
          toast(`${prize.day}일차 보상: 🪙${fmt(prize.coins)}${prize.booster ? ' + ' + CFG.boosters.defs[prize.booster].short : ''}`, 2200);
          this.refresh();
          m.close();
        } else {
          m.close();
        }
        return false;
      } }],
    });
  }

  showRouletteHint() {}

  openRoulette() {
    const body = document.createElement('div');
    const prizes = CFG.reward.roulettePrize;
    const total = prizes.reduce((s, p) => s + p.weight, 0);
    let angle = 0;
    body.innerHTML = `
      <canvas id="roulette-c" width="260" height="260" style="width:230px;height:230px;margin:0 auto;display:block"></canvas>
      <p style="font-size:13px">하루 1회 무료! 상자를 돌려 보상을 받아요</p>`;
    const m = modal({
      title: '행운의 룰렛',
      body,
      closable: true,
      buttons: [{
        label: Profile.rouletteAvailable() ? '돌리기 🎡' : '오늘은 완료', cls: Profile.rouletteAvailable() ? 'gold' : 'ghost', close: false,
        onClick: () => {
          if (!Profile.rouletteAvailable()) { m.close(); return false; }
          this.spin(prizes, total, angle, body, m);
          return false;
        },
      }],
    });
    this.drawRoulette(body, prizes, angle);
  }

  drawRoulette(body, prizes, angle) {
    const c = body.querySelector('#roulette-c');
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = 260, cx = 130, cy = 130, R = 118;
    ctx.clearRect(0, 0, W, W);
    const total = prizes.reduce((s, p) => s + p.weight, 0);
    let a0 = angle;
    prizes.forEach((p, i) => {
      const span = (p.weight / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a0 + span);
      ctx.closePath();
      ctx.fillStyle = ['#ffd9e2', '#d9ecff', '#fff2c2', '#e6d9ff', '#d9ffe6', '#ffe4cc', '#d9f4ff'][i % 7];
      ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      // 라벨
      ctx.save();
      ctx.translate(cx + Math.cos(a0 + span / 2) * R * 0.66, cy + Math.sin(a0 + span / 2) * R * 0.66);
      ctx.rotate(a0 + span / 2 + Math.PI / 2);
      ctx.fillStyle = '#21306b';
      ctx.font = '400 12px Jua, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.kind === 'coins' ? `🪙${p.amount}` : p.kind === 'booster' ? CFG.boosters.defs[p.booster].short : p.kind === 'lives' ? '❤️3' : '무제한', 0, 0);
      ctx.restore();
      a0 += span;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#f2c94c'; ctx.fill();
    ctx.strokeStyle = '#a87b0c'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '400 16px Jua'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GO', cx, cy);
    // 포인터
    ctx.beginPath();
    ctx.moveTo(cx, 8); ctx.lineTo(cx - 9, 28); ctx.lineTo(cx + 9, 28); ctx.closePath();
    ctx.fillStyle = '#ff5a5a'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }

  async spin(prizes, total, angle, body, m) {
    Audio.play('powerup');
    const spin = 6 * Math.PI + Math.random() * Math.PI * 2;
    const start = angle;
    const t0 = performance.now();
    const dur = 2200;
    const anim = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      angle = start + spin * e;
      this.drawRoulette(body, prizes, angle);
      if (p < 1) requestAnimationFrame(anim);
      else {
        const prize = Profile.spinRoulette();
        Audio.play('chest');
        const label = prize.kind === 'coins' ? `🪙 ${fmt(prize.amount)}` :
          prize.kind === 'booster' ? `🎁 ${CFG.boosters.defs[prize.booster].name}` :
          prize.kind === 'lives' ? `❤️ ${prize.amount}개` : `⏱ 무제한 목숨 ${prize.minutes}분`;
        toast(`룰렛 당첨: ${label}`, 2400);
        m.close();
        this.refresh();
      }
    };
    requestAnimationFrame(anim);
  }

  /* ---------------------------------------------------------------- 목숨 */
  openLives() {
    Profile.refreshLives();
    const s = Profile.state;
    const leftMs = Profile.livesLeftMs();
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="display:flex;justify-content:center;gap:4px;flex-wrap:wrap;margin:4px 0 8px">${Array.from({ length: CFG.lives.max }, (_, i) => `<span style="font-size:22px;filter:${i < s.lives ? 'none' : 'grayscale(1) opacity(.35)'}">❤️</span>`).join('')}</div>
      <p style="font-size:13px">${Profile.unlimitedActive() ? '무제한 목숨 사용 중!' : leftMs ? `다음 목숨까지 ${Math.ceil(leftMs / 60000)}분` : '가득 찼어요'}</p>
      <p style="font-size:12px;color:#8a93ad">레벨 시작은 무료, 실패했을 때만 1개를 써요</p>`;
    modal({
      title: '목숨',
      body,
      buttons: [
        { label: `무료 충전 (${Profile.freeRefillLeft()}/3)`, cls: 'green small', onClick: () => {
          if (Profile.useFreeRefill()) { Audio.play('chest'); toast('목숨을 가득 채웠어요'); this.refresh(); }
          else toast('오늘 무료 충전을 모두 썼어요');
        } },
        { label: `코인 충전 (🪙${CFG.lives.refillCost})`, cls: 'gold small', onClick: () => {
          if (Profile.refillWithCoins()) { Audio.play('chest'); toast('목숨을 가득 채웠어요'); this.refresh(); }
          else toast('코인이 부족해요');
        } },
      ],
    });
  }
}
