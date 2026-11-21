/* =========================================================================
   settings.js — 설정 팝업 (음악/효과음 음량, 효과 줄이기, 이름, 초기화)
   ========================================================================= */
import { CFG } from '../config.js';
import { Profile } from '../meta/profile.js';
import { Audio } from '../audio/audio.js';
import { modal, toast, fmt, confirmModal } from './dom.js';

export function openSettings(app) {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="setting-row"><span>🎵 음악</span><input type="range" min="0" max="100" value="${Math.round(Profile.settings.music * 100)}" data-set="music"></div>
    <div class="setting-row"><span>🔔 효과음</span><input type="range" min="0" max="100" value="${Math.round(Profile.settings.sfx * 100)}" data-set="sfx"></div>
    <div class="setting-row"><span>✨ 효과 줄이기</span><button class="switch ${Profile.settings.reduceEffects ? 'on' : ''}" data-toggle="reduce"></button></div>
    <div class="setting-row"><span>🔇 소리 끄기</span><button class="switch ${Profile.settings.muted ? 'on' : ''}" data-toggle="mute"></button></div>
    <div class="setting-row" style="border-top:2px solid #f0e6cc;margin-top:6px;padding-top:10px">
      <span>이름</span><span style="color:#1f4fd8">${Profile.state.name || '플레이어'}</span>
    </div>
    <p style="font-size:12px;color:#8a93ad;margin-top:6px">${app?.online ? '온라인 · 랭킹에 기록돼요' : '오프라인 · 기기에만 저장돼요'}</p>
    <p style="font-size:11px;color:#b0b8cc">CASTLE POP v${CFG.version} · 모든 그림과 소리는 직접 그려 합성합니다</p>
    <div class="btn-row">
      <button class="btn blue small" id="rename-btn" type="button">이름 바꾸기</button>
      <button class="btn ghost small" id="reset-btn" type="button">진행 초기화</button>
    </div>
  `;
  const m = modal({ title: '설정', body, buttons: [{ label: '닫기', cls: 'ghost' }] });

  body.querySelectorAll('input[type=range]').forEach(inp => {
    inp.addEventListener('input', () => {
      const key = inp.dataset.set;
      const v = Number(inp.value) / 100;
      Profile.setSetting(key, v);
      if (key === 'music') Audio.setMusicVolume(v);
      if (key === 'sfx') Audio.setSfxVolume(v);
      if (key === 'sfx') Audio.play('button');
    });
  });
  body.querySelectorAll('.switch').forEach(sw => {
    sw.addEventListener('click', () => {
      const key = sw.dataset.toggle;
      if (key === 'reduce') {
        Profile.setSetting('reduceEffects', !Profile.settings.reduceEffects);
        sw.classList.toggle('on', Profile.settings.reduceEffects);
        if (app?.game) app.game.fx.reduce = Profile.settings.reduceEffects;
        toast(Profile.settings.reduceEffects ? '연출 효과를 줄였어요' : '연출 효과를 켰어요');
      } else {
        Profile.setSetting('muted', !Profile.settings.muted);
        Audio.setMuted(Profile.settings.muted);
        sw.classList.toggle('on', Profile.settings.muted);
      }
      Audio.play('button');
    });
  });
  body.querySelector('#rename-btn').addEventListener('click', async () => {
    const name = (window.prompt('새 이름 (2~12자)', Profile.state.name) || '').trim();
    if (name.length < 2 || name.length > 12) { toast('2~12자로 입력하세요'); return; }
    Profile.state.name = name;
    Profile.save();
    toast(`이름을 ${name} 로 바꿨어요`);
    app?.refreshHome?.();
  });
  body.querySelector('#reset-btn').addEventListener('click', async () => {
    const ok = await confirmModal({
      title: '진행 초기화',
      text: '레벨 진행·코인·별·부스터가 모두 사라져요. 정말 초기화할까요?',
      yes: '초기화',
      no: '그대로',
    });
    if (!ok) return;
    try { localStorage.removeItem('castlePop.profile.v1'); } catch {}
    location.reload();
  });
  return m;
}
