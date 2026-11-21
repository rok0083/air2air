/* =========================================================================
   주간 블리츠 — 60초 동안 최고 점수에 도전
   ========================================================================= */
import { CFG } from '../config.js';
import { openModal, toast, fmt, ICONS, PLAY_BADGE } from './dom.js';
import { weekIdOf } from '../meta/profile.js';
import { GameSession } from './gameplay.js';
import { fetchRanking } from '../firebase/rankings.js';

export async function openBlitz(app) {
  const p = app.profile;
  const best = p.blitzBest();
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="hero" style="min-height:0;padding:12px;background:linear-gradient(120deg,rgba(176,108,255,.25),rgba(77,157,255,.15))">
      <div class="hero-text">
        <div class="kicker">WEEKLY BLITZ</div>
        <h2 style="font-size:18px">${CFG.blitz.seconds}초 · 매치3 스프린트</h2>
        <p>이번 주 최고 <b style="color:#ffd166">${fmt(best)}점</b> · 목표 ${fmt(CFG.blitz.goalScore)}점</p>
      </div>
      <div style="width:74px;display:grid;place-items:center;font-size:30px;font-weight:900;color:#ffd166">⚡</div>
    </div>
    <div class="goal-list">
      <div class="goal-row">${ICONS.bolt}<span>${CFG.blitz.seconds}초 안에 최대 점수</span><span class="gcount">${CFG.blitz.colors}색</span></div>
      <div class="goal-row">${ICONS.star}<span>매치·연쇄·특수 보석으로 점수</span><span class="gcount">주간 랭킹</span></div>
      <div class="goal-row">${ICONS.users}<span>우리 방 코드</span><span class="gcount">${p.data.roomCode || '설정에서 생성'}</span></div>
    </div>
    <div id="blitz-top"><div class="empty">이번 주 순위 불러오는 중…</div></div>
    <p class="tiny muted center">${weekIdOf()} 주차 · 매주 월요일 초기화</p>
  `;
  openModal({
    title: '주간 블리츠',
    subtitle: '이번 주 왕국의 기사들과 점수를 겨뤄 보세요',
    body,
    actions: [
      { label: '닫기', class: 'btn-ghost' },
      { label: '랭킹', class: 'btn-ghost', onClick: (close) => { close(); app.openRanking('blitz'); } },
      { label: '시작', html: `${PLAY_BADGE}<span class="start-lbl">시작</span>`, ariaLabel: '블리츠 시작', class: 'btn-start btn-compact', onClick: (close) => { close(); startBlitz(app); } },
    ],
  });

  const res = await fetchRanking('blitz', { uid: p.uid || '' });
  const box = body.querySelector('#blitz-top');
  if (!box) return;
  if (!res.ok) { box.innerHTML = `<div class="empty">랭킹을 불러오지 못했어요.</div>`; return; }
  if (!res.rows.length) { box.innerHTML = `<div class="empty">이번 주 첫 기록을 세워 보세요!</div>`; return; }
  box.innerHTML = `<div class="rank-list">${res.rows.slice(0, 5).map((r, i) => `
    <div class="rank-row ${r.me ? 'me' : ''}"><span class="pos ${i < 3 ? 'top' : ''}">${i + 1}</span>
    <span class="rname grow">${(r.name || '기사').replace(/[<>&"]/g, '')}</span><span class="rval">${fmt(r.value)}점</span></div>`).join('')}
  </div>`;
}

export function startBlitz(app) {
  const p = app.profile;
  const levelData = {
    id: 'blitz',
    world: 5,
    level: 0,
    name: '주간 블리츠',
    cols: CFG.blitz.cols,
    rows: CFG.blitz.rows,
    colors: CFG.blitz.colors,
    moves: 9999,
    goals: [],
    stars: [CFG.blitz.goalScore * 0.33, CFG.blitz.goalScore * 0.66, CFG.blitz.goalScore],
    cells: [],
    voids: [],
    seed: (Date.now() % 100000) + 7,
    boss: null,
  };
  const session = new GameSession(app, { mode: 'blitz', world: 5, level: 0, levelData });
  session.start().catch(err => {
    console.error(err);
    toast('블리츠를 시작하지 못했어요.', 'bad');
    app.goHome();
  });
}
