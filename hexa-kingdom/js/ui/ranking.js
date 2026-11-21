/* =========================================================================
   랭킹 — 진행 레벨 / 총 별 / 주간 블리츠 / 우리 방 (6자리 코드, ?room=CODE)
   ========================================================================= */
import { CFG } from '../config.js';
import { fetchRanking } from '../firebase/rankings.js';
import { weekIdOf } from '../meta/profile.js';
import { openModal, toast, fmt, ICONS, el } from './dom.js';

const TABS = [
  { key: 'progress', label: '진행 레벨' },
  { key: 'stars', label: '총 별' },
  { key: 'blitz', label: '주간 블리츠' },
  { key: 'room', label: '우리 방' },
];

export function openRanking(app, initialTab = 'progress') {
  const state = { tab: initialTab };
  const body = el('div', {});
  const modal = openModal({
    title: '랭킹',
    subtitle: '왕국의 기사들과 실력을 겨뤄 보세요',
    body,
    className: 'rank-modal',
  });

  const render = async () => {
    const p = app.profile;
    const roomCode = p.data.roomCode;
    body.innerHTML = `
      <div class="tabs" id="rank-tabs">
        ${TABS.map(t => `<button class="tab ${state.tab === t.key ? 'on' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}
      </div>
      <div id="rank-content"><div class="empty">불러오는 중…</div></div>
    `;
    body.querySelector('#rank-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      state.tab = btn.dataset.tab;
      app.audio.sfx('click');
      render();
    });

    if (state.tab === 'room') {
      const code = roomCode || p.ensureRoomCode();
      const url = `${location.origin}${location.pathname}?room=${code}`;
      const box = body.querySelector('#rank-content');
      box.innerHTML = `
        <div class="room-code">
          <input class="input" id="room-input" maxlength="6" value="${code}" aria-label="방 코드" />
          <button class="btn btn-sm" id="room-save">저장</button>
        </div>
        <div class="row" style="gap:6px">
          <button class="btn btn-sm btn-ghost grow" id="room-copy">링크 복사</button>
          <button class="btn btn-sm btn-ghost grow" id="room-share">공유</button>
        </div>
        <p class="tiny muted center">같은 방 코드를 쓰는 기사들끼리 순위가 모입니다.</p>
        <div id="rank-rows"><div class="empty">불러오는 중…</div></div>
      `;
      box.querySelector('#room-save').addEventListener('click', () => {
        const v = box.querySelector('#room-input').value;
        const clean = p.setRoomCode(v);
        if (clean.length < CFG.firebase.roomCodeLength) { toast('6자리 코드를 입력해 주세요.', 'bad'); return; }
        app.syncSoon(true);
        toast(`우리 방 코드: ${clean}`, 'gold');
        render();
      });
      box.querySelector('#room-copy').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했어요.', 'gold'); }
        catch { toast(url, 'info', 4000); }
      });
      box.querySelector('#room-share').addEventListener('click', async () => {
        if (navigator.share) {
          try { await navigator.share({ title: '헥사 킹덤 우리 방', text: `방 코드 ${code} 로 함께 플레이!`, url }); } catch { /* 취소 */ }
        } else {
          try { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했어요.', 'gold'); } catch { toast(url, 'info', 4000); }
        }
      });
    }

    const res = await fetchRanking(state.tab, { roomCode: roomCode || '', uid: p.uid || '' });
    const target = body.querySelector('#rank-rows') || body.querySelector('#rank-content');
    if (!target) return;
    if (!res.ok) {
      target.innerHTML = `<div class="empty">${res.error === 'offline' ? '오프라인이라 랭킹을 불러올 수 없어요.<br>연결되면 다시 시도해 주세요.' : '랭킹을 불러오지 못했어요.<br>잠시 뒤 다시 시도해 주세요.'}</div>`;
      return;
    }
    if (!res.rows.length) {
      target.innerHTML = `<div class="empty">아직 기록이 없어요.<br>첫 번째 기사가 되어 보세요!</div>`;
      return;
    }
    const valLabel = state.tab === 'blitz' ? '점' : state.tab === 'stars' ? '★' : '단계';
    target.innerHTML = `<div class="rank-list">
      ${res.rows.slice(0, 50).map((r, idx) => `
        <div class="rank-row ${r.me ? 'me' : ''}">
          <span class="pos ${idx < 3 ? 'top' : ''}">${idx + 1}</span>
          <span class="grow">
            <span class="rname">${escapeHtml(r.name || '기사')}${r.me ? ' (나)' : ''}</span>
            <span class="rsub">${escapeHtml(r.sub || '')}</span>
          </span>
          <span class="rval">${fmt(r.value)}${valLabel === '단계' ? '' : ' ' + valLabel}</span>
        </div>`).join('')}
    </div>
    <p class="tiny muted center" style="margin-top:6px">${state.tab === 'blitz' ? `이번 주 (${weekIdOf()}) 블리츠 점수` : '상위 50명'}</p>`;
  };

  render();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
