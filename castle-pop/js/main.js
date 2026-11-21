/* =========================================================================
   main.js — 앱 부트스트랩: 프로필 · 배경 · 화면 전환 · Firebase 동기화
   ========================================================================= */
import { CFG } from './config.js';
import { Profile, todayId } from './meta/profile.js';
import { loadLevel } from './meta/levels.js';
import { Audio } from './audio/audio.js';
import { drawBackground } from './art/art.js';
import { HomeScreen } from './ui/home.js';
import { GameScreen } from './ui/game.js';
import { openPreLevel } from './ui/prelevel.js';
import { openRanking } from './ui/ranking.js';
import { openSettings } from './ui/settings.js';
import { modal, toast, fmt, showScreen, curtainTransition, el, confirmModal } from './ui/dom.js';
import { Events } from './events/index.js';
import { initAuth } from './firebase/auth.js';
import { initStore, queueSave, saveNow } from './firebase/store.js';
import { ensureRoom, topLevels, initRankings } from './firebase/rankings.js';

class App {
  constructor() {
    this.online = false;
    this.game = new GameScreen({
      onHome: () => this.toHome(),
      onNext: (id) => this.launchLevel(id, { skipPre: true }),
    });
    this.home = new HomeScreen(this);
    this.events = new Events(this);
    this.bgCanvas = document.getElementById('bg');
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.bgT = 0;
    this.screen = 'boot';
    this.overtakeTarget = null;
  }

  async boot() {
    Profile.load();
    Audio.setMusicVolume(Profile.settings.music);
    Audio.setSfxVolume(Profile.settings.sfx);
    Audio.setMuted(Profile.settings.muted);
    Profile.onSync = state => queueSave(state);
    this.startBackgroundLoop();
    this.bindFirstTouch();

    const bootText = document.getElementById('boot-text');
    const bar = document.querySelector('.boot-bar i');
    const step = (p, text) => { if (bar) bar.style.width = `${p}%`; if (bootText && text) bootText.textContent = text; };

    step(30, '성문을 여는 중…');
    // URL 방 코드
    const roomFromUrl = this.roomFromUrl();
    if (roomFromUrl) { Profile.state.roomCode = roomFromUrl; Profile.save({ sync: false }); }

    // Firebase: 익명 로그인 + 프로필 동기화
    try {
      const fb = await initAuth();
      this.online = !!fb?.online;
      if (this.online) {
        const s = await initStore();
        Profile.state.uid = s.uid;
        if (s.remote) Profile.mergeRemote(normalizeRemote(s.remote));
        if (Profile.state.roomCode) await ensureRoom(Profile.state.roomCode, Profile.state.name);
      }
    } catch (e) { console.warn('[castle-pop] 동기화 없이 시작', e); }
    step(62, this.online ? '왕국 기록을 맞추는 중…' : '오프라인으로 시작해요');

    // 첫 실행: 이름 입력 + 시작 선물
    if (!Profile.state.name) await this.askName();
    if (!Profile.state.starterGift) {
      Profile.state.starterGift = true;
      for (const b of CFG.boosters.order) Profile.state.boosters[b] = (Profile.state.boosters[b] || 0) + CFG.boosters.starterCount;
      Profile.state.coins += CFG.economy.startCoins - (Profile.state.coins < CFG.economy.startCoins ? 0 : 0);
      Profile.save({ sync: false });   // 첫 방문만으로는 랭킹 문서를 만들지 않는다
    }
    step(86, '레벨을 준비하는 중…');
    // 다음 레벨 데이터 미리 받기
    try { await loadLevel(Math.min(CFG.areas * CFG.levelsPerArea, Profile.state.level)); } catch {}
    step(100, '준비 완료!');
    Profile.save({ sync: false });

    setTimeout(() => {
      document.getElementById('screen-boot').classList.add('hidden');
      this.toHome();
      if (roomFromUrl) toast(`친구 방 ${roomFromUrl} 에 참가했어요`, 2400);
    }, 260);
    this.game.bind();
  }

  roomFromUrl() {
    try {
      const q = new URLSearchParams(location.search);
      const code = (q.get('room') || '').toUpperCase();
      return /^[A-Z0-9]{6}$/.test(code) ? code : '';
    } catch { return ''; }
  }

  bindFirstTouch() {
    const start = () => {
      if (Audio.init()) {
        Audio.setMusicVolume(Profile.settings.music);
        Audio.setSfxVolume(Profile.settings.sfx);
        Audio.setMuted(Profile.settings.muted);
      }
      window.removeEventListener('pointerdown', start);
    };
    window.addEventListener('pointerdown', start, { once: true });
  }

  askName() {
    return new Promise(resolve => {
      const body = document.createElement('div');
      body.innerHTML = `
        <p style="font-size:14px">왕국에서 불릴 이름을 정해 주세요 (2~12자)</p>
        <input id="name-input" maxlength="12" placeholder="예: 상봉" style="width:80%;font-family:inherit;font-size:18px;text-align:center;padding:10px;border-radius:12px;border:3px solid #f2c94c;background:#fffdf5;color:#21306b" />
        <p style="font-size:11px;color:#8a93ad;margin-top:8px">익명으로 저장되며, 기기 안에서만 식별됩니다.</p>`;
      const m = modal({
        title: '어서 오세요!',
        body,
        closable: false,
        buttons: [{
          label: '시작하기', cls: 'green', close: false,
          onClick: () => {
            const v = (document.getElementById('name-input').value || '').trim();
            if (v.length < 2 || v.length > 12) { toast('2~12자로 입력해 주세요'); return false; }
            Profile.state.name = v;
            Profile.state.firstRun = false;
            Profile.save({ sync: false });
            m.close();
            resolve(v);
            return false;
          },
        }],
      });
      setTimeout(() => document.getElementById('name-input')?.focus(), 150);
    });
  }

  normalizeRemote(r) { return r; }

  toHome() {
    this.screen = 'home';
    this.game.finish();
    this.home.show();
    this.refreshHome();
  }

  refreshHome() {
    if (this.screen === 'home') this.home.refresh();
  }

  async launchLevel(levelId, opts = {}) {
    const id = Math.min(CFG.areas * CFG.levelsPerArea, Math.max(1, levelId));
    const level = await loadLevel(id);
    if (!opts.skipPre) {
      if (!opts.force && levelId > Profile.state.level) {
        // 아직 도달하지 않은 레벨은 열 수 없다
      }
      const proceed = await new Promise(resolve => {
        const m = openPreLevel(level, {
          onStart: picked => {
            for (const k of Object.keys(picked)) Profile.usePreBooster(k);
            this.prePicked = picked;
            resolve(true);
            m.close();
          },
        });
        m.overlay.addEventListener('click', e => { if (e.target === m.overlay) resolve(false); });
      });
      if (!proceed) return;
    } else {
      this.prePicked = {};
    }
    this.rememberOvertakeTarget();
    this.home.hide();
    this.screen = 'game';
    await curtainTransition(async () => {
      await this.game.start(level, { preBoosters: this.prePicked || {}, app: this });
    });
    this.game.bind();
  }

  async launchCustomLevel(level, opts = {}) {
    this.prePicked = {};
    this.home.hide();
    this.screen = 'game';
    await curtainTransition(async () => {
      await this.game.start(level, { ...opts, custom: true, app: this });
    });
    this.game.bind();
  }

  /* 승리 시 "친구 OO를 추월했어요" — 현재 나보다 한 단계 위 플레이어를 기억 */
  async rememberOvertakeTarget() {
    if (!this.online) return;
    try {
      const rows = await topLevels(60);
      if (!rows?.length) return;
      const mine = rows.find(r => r.uid === Profile.state.uid || r.name === Profile.state.name);
      const above = rows.filter(r => (r.level || 0) > (mine?.level || 0) && r.name !== Profile.state.name)[0];
      this.overtakeTarget = above ? { name: above.name, level: above.level } : null;
    } catch { this.overtakeTarget = null; }
  }

  checkOvertake() {
    const t = this.overtakeTarget;
    if (!t) return;
    if (Profile.state.level > t.level) {
      toast(`🎉 ${t.name}님을 추월했어요!`, 2600);
      Audio.play('rankup');
      this.overtakeTarget = null;
    }
  }

  openRanking() { if (this.screen === 'home') this.home.setTab('rank'); openRanking(this); }
  openEvents() { if (this.screen === 'home') this.home.setTab('event'); this.events.open(); }
  openSettings() {
    if (this.screen === 'home') this.home.setTab('setting');
    openSettings(this);
  }

  /* 배경 */
  startBackgroundLoop() {
    const canvas = this.bgCanvas;
    const ctx = this.bgCtx;
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(60, now - last);
      last = now;
      this.bgT += dt;
      const W = canvas.clientWidth || window.innerWidth;
      const H = canvas.clientHeight || window.innerHeight;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const area = this.screen === 'game' && this.game.level ? (this.game.level.area || 1) : Profile.currentArea();
      drawBackground(ctx, W, H, area, this.bgT, { area });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // 목숨 회복 타이머
    setInterval(() => { Profile.refreshLives(true); this.refreshHome(); }, 30000);
  }
}

const app = new App();
window.__castlepop = app;
app.boot().catch(err => {
  console.error('[castle-pop] 부팅 실패', err);
  const t = document.getElementById('boot-text');
  if (t) t.textContent = '불러오지 못했어요 — 새로고침해 주세요';
});

/* 승리 후 추월 알림 연결 */
const origToHome = app.toHome.bind(app);
app.toHome = () => { app.checkOvertake(); origToHome(); };
