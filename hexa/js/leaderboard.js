/* =========================================================================
   헥사 블리츠 — 랭킹 화면 (전체 / 오늘 / 주간 / 우리 방, Top 50, 내 기록 강조)
   ========================================================================= */

import { FB } from './firebase.js';
import { CFG } from './config.js';

const TABS = [
  { id: 'global', label: '전체' },
  { id: 'today', label: '오늘' },
  { id: 'week', label: '주간' },
  { id: 'room', label: '우리 방' },
];

const fmt = n => Number(n || 0).toLocaleString('ko-KR');

export class Leaderboard {
  constructor({ tabsEl, listEl, statusEl, footEl, getRoom, getName }) {
    this.tabsEl = tabsEl;
    this.listEl = listEl;
    this.statusEl = statusEl;
    this.footEl = footEl;
    this.getRoom = getRoom || (() => '');
    this.getName = getName || (() => '');
    this.scope = 'global';
    this.renderTabs();
  }

  renderTabs() {
    this.tabsEl.innerHTML = '';
    TABS.forEach(tab => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab' + (tab.id === this.scope ? ' active' : '');
      btn.dataset.scope = tab.id;
      btn.textContent = tab.label;
      btn.addEventListener('click', () => this.show(tab.id));
      this.tabsEl.appendChild(btn);
    });
  }

  setActive(scope) {
    this.scope = scope;
    [...this.tabsEl.children].forEach(btn => btn.classList.toggle('active', btn.dataset.scope === scope));
  }

  async show(scope = this.scope) {
    this.setActive(scope);
    const room = (this.getRoom() || '').toUpperCase();
    if (scope === 'room' && !room) {
      this.listEl.innerHTML = '';
      this.setStatus('info', '방 코드를 입력하면 친구들과 같은 방 랭킹을 볼 수 있어요.');
      this.setFoot('');
      return;
    }
    this.listEl.innerHTML = '';
    this.setStatus('loading', '랭킹을 불러오는 중…');

    if (!FB.enabled) {
      this.setStatus('info', '랭킹 서버 설정이 비어 있어 이 기기에서만 플레이할 수 있습니다.');
      return;
    }
    const res = await FB.fetchTop(scope, room);
    if (!res.ok) {
      this.setStatus('error', (res.reason === 'offline' || res.reason === 'unavailable')
        ? '오프라인 상태예요. 연결되면 자동으로 다시 시도합니다.'
        : '랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ghost small';
      btn.textContent = '다시 시도';
      btn.addEventListener('click', () => this.show(this.scope));
      this.statusEl.appendChild(btn);
      const pending = FB.pendingCount();
      if (pending) this.setFoot(`저장 대기 중인 기록 ${pending}건 · 온라인이 되면 자동 전송됩니다.`);
      return;
    }
    this.renderList(res.list);
  }

  setStatus(kind, text) {
    this.statusEl.className = 'rank-status ' + (kind || '');
    this.statusEl.innerHTML = '';
    this.statusEl.textContent = text || '';
    this.statusEl.hidden = !text;
  }

  setFoot(text) {
    if (!this.footEl) return;
    this.footEl.textContent = text || '';
    this.footEl.hidden = !text;
  }

  renderList(list) {
    this.listEl.innerHTML = '';
    if (!list.length) {
      this.setStatus('info', this.scope === 'room'
        ? '아직 이 방에 기록이 없습니다. 첫 기록을 남겨 보세요!'
        : '아직 기록이 없습니다. 첫 번째 주인공이 되어 보세요!');
      this.setFoot('');
      return;
    }
    this.setStatus(null, '');
    const mine = FB.myIds();
    list.forEach(row => {
      const li = document.createElement('li');
      const isMine = mine.has(row.id) || (this.getName() && row.name === this.getName() && row.createdAt && Date.now() - row.createdAt.getTime() < 120000);
      li.className = 'rank-row' + (isMine ? ' me' : '');
      if (row.rank <= 3) li.classList.add('top' + row.rank);
      const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank;
      li.innerHTML = `
        <span class="rk">${medal}</span>
        <span class="nm">${escapeHtml(row.name)}${isMine ? '<em>나</em>' : ''}</span>
        <span class="lv">${row.maxCombo ? row.maxCombo + '콤보' : 'Lv.—'}</span>
        <span class="sc">${fmt(row.score)}</span>`;
      this.listEl.appendChild(li);
    });
    const pending = FB.pendingCount();
    this.setFoot(pending
      ? `저장 대기 중인 기록 ${pending}건 · 온라인이 되면 자동 전송됩니다.`
      : `상위 ${Math.min(CFG.leaderboard.limit, list.length)}개 기록 · 60초 블리츠`);
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
