/* =========================================================================
   설정 — 닉네임 변경(여기서만), 소리/음악, 방 코드, 데이터 초기화, 정보
   ========================================================================= */
import { CFG } from '../config.js';
import { openModal, toast, closeAllModals, ICONS, fmt } from './dom.js';
import { renameUser } from '../firebase/store.js';

export function openSettings(app) {
  const p = app.profile;
  const s = p.data.settings;
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="setting-row">
      <div><div class="sl">닉네임</div><div class="sd">랭킹에 표시되는 이름 (설정에서만 변경)</div></div>
      <div class="row"><input class="input" id="set-name" maxlength="${CFG.ui.nicknameMax}" value="${escapeAttr(p.name)}" style="width:120px;padding:9px 10px;font-size:14px" />
      <button class="btn btn-sm btn-ghost" id="set-name-save">저장</button></div>
    </div>
    <div class="setting-row">
      <div><div class="sl">효과음</div><div class="sd">교체·연쇄·특수 보석 소리</div></div>
      <button class="switch ${!s.muted ? 'on' : ''}" data-toggle="sfx" aria-label="효과음"></button>
    </div>
    <div class="setting-row">
      <div><div class="sl">배경음</div><div class="sd">월드마다 다른 분위기의 합성 음악</div></div>
      <button class="switch ${s.music && !s.muted ? 'on' : ''}" data-toggle="music" aria-label="배경음"></button>
    </div>
    <div class="setting-row">
      <div><div class="sl">힌트 자동 표시</div><div class="sd">5초 동안 조작이 없으면 힌트</div></div>
      <span class="chip">켜짐</span>
    </div>
    <div class="setting-row">
      <div><div class="sl">우리 방 코드</div><div class="sd">친구와 같은 코드를 쓰면 함께 랭킹</div></div>
      <span class="chip">${p.data.roomCode || '없음'}</span>
    </div>
    <div class="setting-row">
      <div><div class="sl">계정</div><div class="sd">익명 로그인 · ${p.uid ? '연결됨' : '로컬 모드'}</div></div>
      <span class="chip">${p.uid ? p.uid.slice(0, 8) + '…' : 'offline'}</span>
    </div>
    <div class="setting-row">
      <div><div class="sl">진행도 백업</div><div class="sd">이 기기에 자동 저장 + 연결 시 서버 동기화</div></div>
      <button class="btn btn-sm btn-ghost" id="set-sync">지금 동기화</button>
    </div>
    <input type="hidden" id="set-room" />
    <div class="setting-row" style="border-bottom:0">
      <div><div class="sl">기록 초기화</div><div class="sd">진행도·코인·복구 과제가 모두 사라집니다</div></div>
      <button class="btn btn-sm btn-ghost" id="set-reset">초기화</button>
    </div>
    <p class="tiny muted" style="line-height:1.6;margin-top:6px">
      헥사 킹덤 ${CFG.version} · 원본 IP (루크 · 피피 · 그림자 군주)<br>
      플레이 기록은 기기에 먼저 저장되고, 연결되면 익명 계정으로 랭킹에 동기화됩니다.<br>
      닉네임·진행도 외의 개인정보는 수집하지 않습니다.
    </p>
  `;

  const modal = openModal({ title: '설정', subtitle: '왕국 설정', body });
  const refresh = () => { modal.close(); openSettings(app); };

  body.querySelector('#set-name-save').addEventListener('click', async () => {
    const v = body.querySelector('#set-name').value.trim();
    if (v.length < CFG.ui.nicknameMin) { toast(`닉네임은 ${CFG.ui.nicknameMin}자 이상이에요.`, 'bad'); return; }
    if (CFG.ui.profanity.some(w => v.toLowerCase().includes(w))) { toast('사용할 수 없는 단어가 들어 있어요.', 'bad'); return; }
    await renameUser(p, v);
    app.syncSoon(true);
    toast('닉네임을 바꿨어요.', 'gold');
    app.goHome();
    refresh();
  });

  body.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.toggle;
      if (key === 'sfx') {
        s.muted = !s.muted;
        app.audio.setEnabled(!s.muted);
        app.audio.setMusic(!s.muted && s.music);
      } else {
        s.music = !s.music;
        app.audio.setMusic(s.music && !s.muted);
      }
      p.save();
      app.audio.sfx('click');
      refresh();
    });
  });

  body.querySelector('#set-sync').addEventListener('click', async () => {
    await app.syncSoon(true);
    toast(p.uid ? '서버에 동기화했어요.' : '오프라인 모드라 기기에만 저장했어요.', p.uid ? 'gold' : 'info');
  });

  body.querySelector('#set-reset').addEventListener('click', () => {
    openModal({
      title: '정말 초기화할까요?',
      subtitle: '코인·별·복구 과제·부스터가 모두 사라집니다. 되돌릴 수 없어요.',
      body: `<p class="tiny muted center">랭킹에 이미 올린 기록은 남습니다.</p>`,
      actions: [
        { label: '취소', class: 'btn-ghost' },
        {
          label: '초기화', class: 'btn-rose',
          onClick: (close) => {
            p.reset();
            p.name = p.name || '';
            closeAllModals();
            toast('기록을 초기화했어요.', 'info');
            app.goHome();
          },
        },
      ],
    });
  });
}

function escapeAttr(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
