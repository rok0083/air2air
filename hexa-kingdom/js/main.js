/* =========================================================================
   헥사 킹덤 — 앱 시작점
   첫 실행: 닉네임 → 익명 로그인 → 월드 지도
   이후 실행: 자동 로그인 → 바로 월드 지도
   ========================================================================= */
import { CFG } from './config.js';
import { Profile, weekIdOf } from './meta/profile.js';
import { AudioEngine } from './audio/audio.js';
import { waitForUser, authContext } from './firebase/auth.js';
import { pullProfile, queueSave, saveNow, initStore } from './firebase/store.js';
import { renderHome } from './ui/worldmap.js';
import { openShop } from './ui/shop.js';
import { openRanking } from './ui/ranking.js';
import { openSettings } from './ui/settings.js';
import { openBlitz } from './ui/blitz.js';
import { openPreLevel } from './ui/prelevel.js';
import { GameSession } from './ui/gameplay.js';
import { toast, $, el, closeAllModals } from './ui/dom.js';

class App {
  constructor() {
    this.profile = Profile.load();
    this.audio = new AudioEngine();
    this.audio.setEnabled(!this.profile.data.settings.muted);
    this.audio.musicOn = this.profile.data.settings.music;
    this.state = {
      world: this.profile.data.lastPlayed?.world || 1,
      session: null,
      online: false,
    };
    this.syncTimer = null;
    this._livesTimer = null;
  }

  async boot() {
    // 방 코드 자동 입력 (?room=CODE)
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) {
      const clean = this.profile.setRoomCode(room);
      if (clean.length === CFG.firebase.roomCodeLength) {
        this.profile.save();
        setTimeout(() => toast(`우리 방 ${clean} 에 참여했어요.`, 'gold'), 900);
      }
    }

    // 첫 상호작용에서 오디오 활성화(iOS 정책)
    const unlock = () => {
      this.audio.unlock();
      this.audio.setEnabled(!this.profile.data.settings.muted);
      this.audio.sfx('click');
      if (this.profile.data.settings.music) this.audio.startMusic(this.state.world);
      document.removeEventListener('pointerdown', unlock);
    };
    document.addEventListener('pointerdown', unlock);

    if (!this.profile.name) {
      this.showName();
      return;
    }
    await this.enterWorld();
  }

  showName() {
    $('#boot')?.classList.add('hidden');
    let screen = $('#screen-name');
    if (!screen) {
      screen = el('div', { class: 'screen name-screen', id: 'screen-name' });
      $('#app').insertBefore(screen, $('#screen-home'));
    }
    screen.classList.remove('hidden');
    screen.innerHTML = `
      <div class="name-hero">
        ${lukeArt()}
        ${pipiArt()}
      </div>
      <div class="name-card">
        <div class="center">
          <div class="tiny" style="color:#ffd166;letter-spacing:2px;font-weight:800">HEXA KINGDOM</div>
          <h1>견습 기사, 이름을 알려 주세요</h1>
          <p>그림자 군주에게 빼앗긴 5개 월드를 되살릴 기사가 필요해요.<br>이름은 랭킹에 표시되고, 설정에서 바꿀 수 있어요.</p>
        </div>
        <input class="input" id="name-input" maxlength="${CFG.ui.nicknameMax}" placeholder="닉네임 (2~12자)" autocomplete="off" />
        <div class="err" id="name-err"></div>
        <button class="btn btn-green wide" id="name-start">${'모험 시작'}</button>
        <div class="tiny muted center">익명 로그인으로 시작합니다 · 개인정보를 묻지 않아요</div>
      </div>
    `;
    const input = $('#name-input');
    input.focus();
    const submit = async () => {
      const v = input.value.trim();
      const err = $('#name-err');
      if (v.length < CFG.ui.nicknameMin) { err.textContent = `닉네임은 ${CFG.ui.nicknameMin}자 이상이에요.`; return; }
      if (v.length > CFG.ui.nicknameMax) { err.textContent = `닉네임은 ${CFG.ui.nicknameMax}자까지 가능해요.`; return; }
      if (CFG.ui.profanity.some(w => v.toLowerCase().includes(w))) { err.textContent = '사용할 수 없는 단어가 들어 있어요.'; return; }
      err.textContent = '';
      const btn = $('#name-start');
      btn.disabled = true;
      btn.textContent = '왕국으로 가는 중…';
      this.profile.name = v;
      this.profile.createdLocally = false;
      this.profile.save();
      await this.enterWorld();
      screen.remove();
    };
    $('#name-start').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  async enterWorld() {
    const boot = $('#boot');
    $('#screen-name')?.classList.add('hidden');
    try {
      await initStore();
      const ctx = await Promise.race([
        waitForUser(5000),
        new Promise(r => setTimeout(() => r({ uid: null, online: false }), 5200)),
      ]);
      if (ctx?.uid) {
        this.profile.data.uid = ctx.uid;
        this.state.online = true;
        const remote = await pullProfile(ctx.uid);
        if (remote) {
          this.profile.mergeRemote(remote);
          if (!this.profile.data.name && remote.name) this.profile.name = remote.name;
        }
        this.profile.save();
      }
    } catch (e) {
      console.warn('[hexa-kingdom] 로그인 지연 — 로컬 모드로 시작', e);
    }
    if (!this.profile.data.roomCode) this.profile.ensureRoomCode();
    boot?.classList.add('hidden');
    $('#screen-home').classList.remove('hidden');
    await this.showHome();
    this.syncSoon();
  }

  async showHome() {
    renderHome(this);
    if (this.audio.enabled && this.profile.data.settings.music) this.audio.startMusic(this.state.world);
  }

  goHome() {
    closeAllModals();
    this.state.session?.destroy?.();
    this.state.session = null;
    $('#screen-game').classList.add('hidden');
    $('#screen-home').classList.remove('hidden');
    document.querySelectorAll('.boss-portrait').forEach(n => n.remove());
    renderHome(this);
    this.audio.startMusic(this.state.world);
  }

  async startLevel(world, level, levelData, boosters = {}) {
    this.state.world = world;
    this.profile.data.lastPlayed = { world, level };
    this.profile.save();
    const session = new GameSession(this, { mode: 'level', world, level, levelData, startBoosters: boosters });
    try {
      await session.start();
    } catch (err) {
      console.error(err);
      toast('스테이지를 시작하지 못했어요.', 'bad');
      this.goHome();
    }
  }

  openShop() { openShop(this); }
  openRanking(tab = 'progress') { openRanking(this, tab); }
  openSettings() { openSettings(this); }
  openBlitz() { openBlitz(this); }
  openPreLevel(world, level) { openPreLevel(this, world, level); }

  syncSoon(immediate = false) {
    this.profile.save();
    if (immediate) { saveNow(this.profile); return; }
    queueSave(this.profile);
  }
}

/* 인라인 아트 (art.js 를 그대로 재사용) */
import { lukeSvg, pipiSvg } from './ui/art.js';
const lukeArt = () => lukeSvg(120, { cheer: true });
const pipiArt = () => pipiSvg(66);

/* ── 시작 ─────────────────────────────────────────────────── */
const app = new App();
window.__hk = { app, CFG, Profile, weekIdOf, GameSession };
window.addEventListener('error', (e) => {
  console.warn('[hexa-kingdom] window error', e.message);
});

app.boot().catch((err) => {
  console.error('[hexa-kingdom] 부팅 실패', err);
  $('#boot')?.classList.add('hidden');
  $('#screen-home')?.classList.remove('hidden');
  app.showHome();
});

export { app };
