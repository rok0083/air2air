/* =========================================================================
   ranking.js — 4탭 랭킹 UI (전체 · 주간 리그 · 번개 러시 · 우리 방)
   ========================================================================= */
import { CFG } from '../config.js';
import { Profile } from '../meta/profile.js';
import { FB } from '../firebase/config.js';
import { subscribe, ensureRoom, makeRoomCode, sendLifeGift, fetchRoom, myGifts, claimGift } from '../firebase/rankings.js';
import { modal, toast, fmt, el } from './dom.js';
import { Audio } from '../audio/audio.js';

const TABS = [
  { id: 'level', label: '전체' },
  { id: 'weekly', label: '주간 리그' },
  { id: 'rush', label: '번개 러시' },
  { id: 'room', label: '우리 방' },
];

export function openRanking(app) {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="rank-tabs" id="rank-tabs"></div>
    <div class="rank-list" id="rank-list"><div class="rank-empty">불러오는 중…</div></div>
    <div class="rank-foot" id="rank-foot" style="margin-top:8px;font-size:12px;color:#6b7ba6"></div>
  `;
  const m = modal({ title: '랭킹', body, buttons: [{ label: '닫기', cls: 'ghost' }] });
  let tab = 'level';
  let unsub = null;
  let roomCode = Profile.state.roomCode || readRoomFromUrl() || '';

  const tabs = body.querySelector('#rank-tabs');
  for (const t of TABS) {
    const b = el('button', t.id === tab ? 'on' : '', t.label);
    b.type = 'button';
    b.dataset.tab = t.id;
    b.addEventListener('click', () => {
      tab = t.id;
      Audio.play('button');
      [...tabs.children].forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
      load();
    });
    tabs.appendChild(b);
  }

  const list = body.querySelector('#rank-list');
  const foot = body.querySelector('#rank-foot');

  function readRoomFromUrl() {
    try {
      const q = new URLSearchParams(location.search);
      const code = (q.get('room') || '').toUpperCase();
      return /^[A-Z0-9]{6}$/.test(code) ? code : '';
    } catch { return ''; }
  }

  function renderRows(state) {
    if (state.offline) {
      list.innerHTML = `<div class="rank-empty">오프라인 모드예요.<br>인터넷에 연결하면 다른 기기와 같은 랭킹이 보여요.</div>`;
      return;
    }
    if (!state.rows.length) {
      list.innerHTML = `<div class="rank-empty">아직 기록이 없어요.<br>${tab === 'room' ? '방 코드를 만들어 친구를 초대하세요.' : '첫 플레이어가 1위가 됩니다!'}</div>`;
      return;
    }
    list.innerHTML = state.rows.map(r => {
      const value = tab === 'rush' ? `${fmt(r.rush)}점` : tab === 'weekly' ? `👑 ${r.weeklyCrowns}` : `Lv.${r.level}`;
      const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank;
      return `<div class="rank-row${r.me ? ' me' : ''}">
        <span class="rk">${medal}</span>
        <span class="nm">${escapeHtml(r.name)}${r.me ? ' <small style="color:#b8860b">(나)</small>' : ''}</span>
        <span class="vl">${value}</span>
        ${tab === 'room' && !r.me ? `<button class="btn ghost small" data-gift="${r.uid}" style="min-width:44px;padding:2px 6px 3px;font-size:11px">❤️</button>` : ''}
      </div>`;
    }).join('');
    list.querySelectorAll('[data-gift]').forEach(b => {
      b.addEventListener('click', async () => {
        const ok = await sendLifeGift(b.dataset.gift, Profile.state.name);
        toast(ok ? '친구에게 목숨을 보냈어요 ❤️' : '보내지 못했어요');
        Audio.play('collect');
      });
    });
    if (state.me) {
      foot.textContent = `내 순위 ${state.me.rank}위 · ${tab === 'rush' ? fmt(state.me.rush) + '점' : tab === 'weekly' ? '왕관 ' + state.me.weeklyCrowns : 'Lv.' + state.me.level}`;
    } else foot.textContent = '이번 주에 한 번 플레이하면 순위에 올라요';
  }

  async function load() {
    if (unsub) { try { unsub(); } catch {} unsub = null; }
    if (tab === 'room') {
      if (!roomCode) {
        list.innerHTML = `<div class="rank-empty">친구 방이 없어요</div>`;
        foot.innerHTML = `<button class="btn green small" id="make-room">방 만들기</button>
          <button class="btn blue small" id="join-room">코드로 참가</button>`;
        foot.querySelector('#make-room').addEventListener('click', async () => {
          roomCode = makeRoomCode();
          const ok = await ensureRoom(roomCode, Profile.state.name);
          Profile.state.roomCode = roomCode;
          Profile.save();
          toast(ok ? `방 ${roomCode} 를 만들었어요` : '방을 만들지 못했어요');
          load();
        });
        foot.querySelector('#join-room').addEventListener('click', async () => {
          const code = (window.prompt('6자리 방 코드') || '').trim().toUpperCase();
          if (!/^[A-Z0-9]{6}$/.test(code)) { toast('6자리 코드를 입력하세요'); return; }
          roomCode = code;
          await ensureRoom(code, Profile.state.name);
          Profile.state.roomCode = code;
          Profile.save();
          load();
        });
        return;
      }
      foot.innerHTML = `<span style="color:#21306b">방 코드 <b class="room-code">${roomCode}</b></span>
        <button class="btn blue small" id="share-room" style="margin-left:6px">공유</button>`;
      foot.querySelector('#share-room').addEventListener('click', async () => {
        const url = `${location.origin}${location.pathname}?room=${roomCode}`;
        try {
          if (navigator.share) await navigator.share({ title: '캐슬 팝 친구 방', text: `함께 캐슬 팝! 방 코드 ${roomCode}`, url });
          else { await navigator.clipboard.writeText(url); toast('링크를 복사했어요'); }
        } catch { toast(`방 코드 ${roomCode} 를 알려 주세요`); }
      });
      await ensureRoom(roomCode, Profile.state.name);
    }
    unsub = subscribe(tab, { roomCode }, renderRows);
  }

  load();
  myGifts().then(async gifts => {
    if (!gifts.length) return;
    toast(`친구가 보낸 목숨 ${gifts.length}개가 도착했어요`, 2400);
    for (const g of gifts) {
      Profile.addLives(1);
      await claimGift(g.id);
    }
  });
  m.onClose = () => { if (unsub) unsub(); };
  return m;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
