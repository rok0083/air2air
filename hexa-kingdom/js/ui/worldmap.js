/* =========================================================================
   월드 지도 화면 — 5개 월드, 구역별 스테이지와 복구 과제
   ========================================================================= */
import { CFG } from '../config.js';
import { WORLDS, districtIndexForLevel, isBossLevel } from '../meta/worldmap.js';
import { levelId } from '../meta/profile.js';
import { $, el, esc, fmt, toast, openModal, ICONS, timeLeft, PLAY_BADGE } from './dom.js';
import { lukeSvg, pipiSvg, worldSceneSvg, buildSvg } from './art.js';
import { openPreLevel } from './prelevel.js';

export function renderHome(app) {
  const screen = $('#screen-home');
  const p = app.profile;
  p.refreshLives();
  const worldId = app.state.world;
  app.backdrop?.setScene(worldId, 'home');
  const world = WORLDS.find(w => w.id === worldId) || WORLDS[0];
  const locked = !p.isWorldUnlocked(worldId);
  const restored = p.worldTaskCount(worldId);
  const next = p.nextLevel();
  const li = p.livesInfo();

  const starsTotal = p.totalStars;
  const maxStars = 100 * 3;

  screen.innerHTML = `
    <div class="topbar">
      <div class="brand"><span class="b1">HEXA</span><span class="b2">KINGDOM</span></div>
      <div class="stats">
        <span class="stat">${ICONS.coin}<span id="stat-coins">${fmt(p.coins)}</span></span>
        <span class="stat">${ICONS.star}<span>${starsTotal}</span></span>
        <button class="stat lives" id="stat-lives" aria-label="목숨">${ICONS.heart}<span>${li.count}/${li.max}</span></button>
        <span class="stat">${ICONS.gem}<span>Lv.${p.playerLevel}</span></span>
      </div>
    </div>
    <div class="home-scroll" id="home-scroll">
      <section class="hero">
        <div class="hero-text">
          <div class="kicker">${esc(app.profile.name || '견습 기사')}의 왕국 복구</div>
          <h2>${locked ? '아직 잠긴 월드예요' : `${world.name} · ${world.curse}`}</h2>
          <p>${locked ? '이전 월드의 5번째 스테이지를 깨면 열립니다.' : world.desc}</p>
          <div class="hero-progress">
            <span>복구 ${restored}/20</span>
            <div class="bar"><i style="width:${(restored / 20) * 100}%"></i></div>
          </div>
          ${locked ? '' : `<button class="btn btn-start btn-sm" id="quick-play" aria-label="이어서 하기 — 월드 ${next.world} 스테이지 ${next.level} 시작">${PLAY_BADGE}<span class="start-lbl">이어서 하기</span><span class="qp-chip">W${next.world}-${next.level}</span></button>`}
        </div>
        <div class="hero-art">
          ${lukeSvg(96, { cheer: true })}
          ${pipiSvg(56)}
        </div>
      </section>

      <div class="world-tabs" id="world-tabs">
        ${WORLDS.map(w => {
          const open = p.isWorldUnlocked(w.id);
          return `<button class="world-tab ${w.id === worldId ? 'on' : ''} ${open ? '' : 'locked'}" data-world="${w.id}">
            <span class="num">${w.id}</span> ${esc(w.name)} ${open ? '' : ICONS.lock}
          </button>`;
        }).join('')}
      </div>

      <div class="world-panel">
        <div class="world-scene">
          ${worldSceneSvg(worldId)}
          <div class="veil"></div>
          <div class="wt">
            <h3>${esc(world.name)} <span class="tiny muted">${esc(world.en)}</span></h3>
            <div class="wc">${esc(world.curse)}</div>
          </div>
          ${locked ? `<div class="lock-veil">${ICONS.lock}<div>이전 월드의 스테이지 5를 먼저 깨 주세요</div></div>` : ''}
        </div>
        ${world.districts.map(d => districtHtml(app, world, d, locked)).join('')}
      </div>

      <div class="center tiny muted" style="padding:2px 0 18px">
        별 ${starsTotal}/${maxStars} · 복구 과제 ${p.taskCount}/100 · 방 코드 ${esc(p.roomCode || '-')}
      </div>
    </div>

    <nav class="bottom-nav">
      <button class="nav-btn on" data-nav="map">${ICONS.gem}<span>지도</span></button>
      <button class="nav-btn" data-nav="shop">${ICONS.shop}<span>상점</span></button>
      <button class="nav-btn" data-nav="rank">${ICONS.chart}<span>랭킹</span></button>
      <button class="nav-btn" data-nav="blitz">${ICONS.bolt}<span>블리츠</span></button>
      <button class="nav-btn" data-nav="settings">${ICONS.gear}<span>설정</span></button>
    </nav>
  `;

  $('#world-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-world]');
    if (!btn) return;
    const id = Number(btn.dataset.world);
    if (!p.isWorldUnlocked(id)) { toast('이전 월드의 5번째 스테이지를 먼저 깨 주세요.', 'bad'); return; }
    app.state.world = id;
    app.audio.sfx('click');
    renderHome(app);
  });

  $('#stat-lives')?.addEventListener('click', () => showLivesInfo(app));
  $('#quick-play')?.addEventListener('click', () => {
    if (!p.isWorldUnlocked(next.world)) { toast('아직 잠긴 월드예요.', 'bad'); return; }
    openPreLevel(app, next.world, next.level);
  });

  screen.querySelectorAll('[data-level]').forEach(node => {
    node.addEventListener('click', () => {
      const w = Number(node.dataset.world);
      const lv = Number(node.dataset.level);
      if (!p.isWorldUnlocked(w)) { toast('이전 월드의 5번째 스테이지를 먼저 깨 주세요.', 'bad'); return; }
      if (!p.isLevelUnlocked(w, lv)) { toast('앞 스테이지를 먼저 클리어해 주세요.', 'bad'); return; }
      app.audio.sfx('click');
      openPreLevel(app, w, lv);
    });
  });

  screen.querySelectorAll('[data-task]').forEach(node => {
    node.addEventListener('click', () => restoreTask(app, node));
  });

  screen.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      app.audio.sfx('click');
      const nav = btn.dataset.nav;
      if (nav === 'shop') app.openShop();
      else if (nav === 'rank') app.openRanking();
      else if (nav === 'blitz') app.openBlitz();
      else if (nav === 'settings') app.openSettings();
      else $('#home-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // 목숨 회복 카운트다운
  clearInterval(app._livesTimer);
  app._livesTimer = setInterval(() => {
    const info = app.profile.livesInfo();
    const node = $('#stat-lives');
    if (!node) return clearInterval(app._livesTimer);
    const label = info.nextIn ? `${info.count}/${info.max} · ${timeLeft(info.nextIn)}` : `${info.count}/${info.max}`;
    node.innerHTML = `${ICONS.heart}<span>${label}</span>`;
  }, 1000);
}

function districtHtml(app, world, d, worldLocked) {
  const p = app.profile;
  const open = !worldLocked && p.districtOpen(world.id, d.index);
  const nxt = p.nextLevel();
  const levels = [];
  for (let i = 0; i < CFG.progression.levelsPerDistrict; i++) {
    const lv = (d.index - 1) * CFG.progression.levelsPerDistrict + i + 1;
    const unlocked = !worldLocked && p.isLevelUnlocked(world.id, lv);
    const cleared = p.isCleared(world.id, lv);
    const stars = p.starsOf(world.id, lv);
    const boss = isBossLevel(world.id, lv);
    const isNext = unlocked && !cleared && nxt.world === world.id && nxt.level === lv;
    levels.push(`
      <button class="level-node ${cleared ? 'done' : ''} ${unlocked ? '' : 'locked'} ${boss ? 'boss' : ''} ${isNext ? 'next' : ''}"
              data-level="${lv}" data-world="${world.id}" ${unlocked ? '' : 'aria-disabled="true"'}>
        ${boss ? `<span class="crown">${ICONS.crown}</span>` : ''}
        <span class="ln">${cleared ? (boss ? '★' : lv) : (unlocked ? lv : ICONS.lock)}</span>
        <span class="ls">${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 3 - stars))}</span>
      </button>`);
  }
  const tasks = d.tasks.map(t => {
    const done = p.taskDone(t.id);
    const unlocked = p.taskUnlocked(t);
    return `
      <button class="task ${done ? 'done' : ''} ${unlocked || done ? '' : 'locked'}" data-task="${t.id}" data-world="${world.id}" data-district="${d.index}">
        <span class="build-ic">${done ? ICONS.check : buildSvg(t.build)}</span>
        <span class="grow">
          <span class="tname">${esc(t.name)}</span>
          <span class="tmeta">${done ? '복구 완료' : `${ICONS.hammer} 망치 토큰 ${t.cost} · ${ICONS.coin} ${t.coins}`}</span>
        </span>
        ${done ? '' : `<span class="chip">${unlocked ? '복구' : '잠김'}</span>`}
      </button>`;
  }).join('');

  const districtStars = [0, 1, 2, 3, 4].reduce((s, i) => s + p.starsOf(world.id, (d.index - 1) * 5 + i + 1), 0);

  return `
    <section class="district ${open ? '' : 'locked'}">
      <div class="district-head">
        <span class="dname">${esc(d.name)}</span>
        <span class="dtag">구역 ${d.index}</span>
        <span class="dstars">★ ${districtStars}/15</span>
      </div>
      <div class="level-path">${levels.join('')}</div>
      <div class="tasks">${tasks}</div>
    </section>`;
}

/* 복구 과제 실행 + 망치 토큰 연출 */
function restoreTask(app, node) {
  const p = app.profile;
  const id = node.dataset.task;
  const worldId = Number(node.dataset.world);
  const districtIndex = Number(node.dataset.district);
  const district = WORLDS.find(w => w.id === worldId)?.districts.find(d => d.index === districtIndex);
  const task = district?.tasks.find(t => t.id === id);
  if (!task) return;
  if (p.taskDone(id)) return;
  if (!p.taskUnlocked(task)) { toast('같은 구역의 스테이지를 먼저 클리어해 주세요.', 'bad'); return; }
  if (p.hammerTokens < task.cost) { toast(`망치 토큰이 부족해요. (필요 ${task.cost}, 보유 ${p.hammerTokens})`, 'bad'); return; }

  const res = p.completeTask(task);
  if (!res) { toast('복구하지 못했어요.', 'bad'); return; }
  app.audio.sfx('restore');
  node.classList.add('restoring');
  node.style.position = 'relative';
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    const a = Math.random() * Math.PI * 2;
    s.style.setProperty('--dx', `${Math.cos(a) * (30 + Math.random() * 40)}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * (30 + Math.random() * 40)}px`);
    s.style.left = 50 + '%'; s.style.top = '50%';
    s.style.background = ['#ffe066', '#3ddc84', '#ffffff'][i % 3];
    node.append(s);
    setTimeout(() => s.remove(), 900);
  }
  toast(`${task.name} 완료! 코인 +${fmt(res.coins)}`, 'gold');
  app.syncSoon();
  setTimeout(() => renderHome(app), 950);
}

function showLivesInfo(app) {
  const p = app.profile;
  const info = p.livesInfo();
  openModal({
    title: '목숨',
    subtitle: `30분마다 목숨 1개가 회복됩니다. (최대 ${info.max}개)`,
    body: `
      <div class="center" style="padding:10px 0 4px;font-size:34px;color:#ff9db3">
        ${'♥'.repeat(info.count)}${'♡'.repeat(Math.max(0, info.max - info.count))}
      </div>
      <p class="center tiny muted">${info.nextIn ? `다음 목숨까지 ${timeLeft(info.nextIn)}` : '목숨이 가득 찼어요!'}</p>
    `,
    actions: [
      { label: '닫기', class: 'btn-ghost' },
      { label: '상점에서 회복', class: 'btn', onClick: (close) => { close(); app.openShop(); } },
    ],
  });
}
