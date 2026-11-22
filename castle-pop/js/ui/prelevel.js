/* =========================================================================
   prelevel.js — 레벨 시작 전 팝업 (레벨 번호 · 목표 · 시작 부스터 · 난이도)
   ========================================================================= */
import { CFG } from '../config.js';
import { Profile } from '../meta/profile.js';
import { difficultyOf } from '../meta/levels.js';
import { drawIcon } from '../art/art.js';
import { modal, fmt } from './dom.js';

export function openPreLevel(level, { onStart }) {
  const diff = difficultyOf(level);
  const body = document.createElement('div');
  const diffTag = level.difficulty === 'normal' ? '' :
    `<div class="diff-tag" style="background:${diff.color}">${level.difficulty === 'hard' ? '★' : '★★'} ${diff.name} · 보상 2배</div>`;
  body.innerHTML = `
    <div class="lvl-badge">${level.area}구역 · 레벨 ${level.level}</div>
    ${diffTag}
    <div class="panel-divider"><i></i></div>
    <div class="pre-label">목표</div>
    <div class="pre-goals" id="pre-goals"></div>
    <div class="panel-divider"><i></i></div>
    <div class="pre-label">시작 부스터 · 보유 ${Object.values(Profile.state.preBoosters).reduce((a, b) => a + b, 0)}개</div>
    <div class="pre-start" id="pre-start"></div>
    <div class="pre-wallet">🪙 ${fmt(Profile.state.coins)} · ⭐ ${Profile.state.stars}</div>
  `;
  const picked = {};
  const m = modal({
    title: '레벨 ' + level.level,
    body,
    closable: true,
    buttons: [{ label: '플레이 ▶', cls: 'green', close: false, onClick: () => { onStart(picked); m.close(); } }],
  });
  const goalsWrap = body.querySelector('#pre-goals');
  for (const g of level.goals || []) {
    const div = document.createElement('div');
    div.className = 'pre-goal';
    div.innerHTML = `<canvas width="48" height="48" style="width:34px;height:34px"></canvas><b>${g.count}</b>`;
    goalsWrap.appendChild(div);
    const c = div.querySelector('canvas');
    const ctx = c.getContext('2d');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = 48 * dpr; c.height = 48 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(24, 24);
    const kind = g.type === 'collect' ? 'gem' : g.type === 'letter' ? 'letter' : g.type === 'bird' ? 'bird' : (g.type || 'box');
    drawIcon(ctx, kind, 0, 0, 34, { colorKey: g.color });
  }
  const startWrap = body.querySelector('#pre-start');
  for (const kind of CFG.preBoosters.order) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const count = Profile.state.preBoosters[kind] || 0;
    btn.innerHTML = `<canvas width="48" height="48" style="width:40px;height:40px"></canvas><span class="chk">✓</span>
      <span style="position:absolute;right:-2px;bottom:-6px;background:#21306b;color:#fff;border-radius:99px;font-size:11px;padding:0 6px;border:2px solid #fff">${count}</span>`;
    if (count <= 0) btn.style.opacity = '.45';
    startWrap.appendChild(btn);
    const c = btn.querySelector('canvas');
    const ctx = c.getContext('2d');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = 48 * dpr; c.height = 48 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(24, 24);
    drawIcon(ctx, kind === 'light' ? 'light' : kind, 0, 0, 40);
    btn.addEventListener('click', () => {
      if (count <= 0) return;
      if (picked[kind]) { delete picked[kind]; btn.classList.remove('on'); return; }
      if (Object.keys(picked).length >= CFG.preBoosters.maxPick) return;
      picked[kind] = 1;
      btn.classList.add('on');
    });
  }
  return m;
}
