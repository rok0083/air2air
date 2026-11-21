/* =========================================================================
   events/index.js — 미니게임 · 경쟁 이벤트
     · 임금님 구출: 40초 타임어택 (이동 수 제한 없음, 실패해도 목숨 차감 없음)
     · 코인 러시: 구역 완성 보너스 레벨
     · 번개 러시: 60초 타임어택 · 주간 최고점 랭킹
     · 하늘 경주: 5명이 레벨 15개를 먼저 깨기 (가상 경쟁자 + 실제 친구)
     · 프로펠러 축제: 기간 중 만든 프로펠러 수
   일정표(CFG.events.rotation)에 따라 changeEveryDays 마다 번갈아 열린다.
   ========================================================================= */
import { CFG } from '../config.js';
import { Profile, todayId } from '../meta/profile.js';
import { submitRush } from '../firebase/store.js';
import { modal, toast, fmt, el } from '../ui/dom.js';
import { Audio } from '../audio/audio.js';

const EVENT_META = {
  kingRescue: { key: 'kingRescue', icon: '🦁', short: '구출', name: '임금님 구출', desc: '40초 안에 목표를 달성해 위기에 빠진 레오를 구하세요. 이동 수 제한은 없고, 실패해도 목숨은 줄지 않아요.' },
  lightningRush: { key: 'lightningRush', icon: '⚡', short: '번개', name: '번개 러시', desc: '60초 타임어택. 빠르게 맞출수록 콤보 배율이 올라요. 주간 최고 점수로 순위를 매깁니다.' },
  skyRace: { key: 'skyRace', icon: '🎈', short: '경주', name: '하늘 경주', desc: '5명이 레벨 15개를 먼저 깨는 사람이 우승. 같은 시기에 참가한 플레이어와 겨루고, 부족하면 가상 경쟁자로 채워요.' },
  propellerFestival: { key: 'propellerFestival', icon: '🌀', short: '축제', name: '프로펠러 축제', desc: '축제 기간 동안 레벨에서 만든 프로펠러 수로 순위를 매겨요.' },
  coinRush: { key: 'coinRush', icon: '🪙', short: '코인', name: '코인 러시', desc: '정해진 이동 수 안에 보드의 코인을 쓸어 담는 보너스 레벨이에요.' },
};

export class Events {
  constructor(app) {
    this.app = app;
  }

  index() {
    const days = Math.floor(Date.now() / 86400000);
    return Math.floor(days / CFG.events.changeEveryDays) % CFG.events.rotation.length;
  }

  current() {
    const key = CFG.events.rotation[this.index()];
    return EVENT_META[key] || EVENT_META.kingRescue;
  }

  /* 이벤트 목록 팝업 */
  open() {
    const body = document.createElement('div');
    body.innerHTML = '<div class="event-list" id="event-list"></div>';
    const m = modal({ title: '이벤트', body, buttons: [{ label: '닫기', cls: 'ghost' }] });
    const list = body.querySelector('#event-list');
    const cur = this.current();
    // 순환 일정 전체 보여주기 (현재 이벤트가 맨 위)
    const order = [cur, ...CFG.events.rotation.filter(k => k !== cur.key).map(k => EVENT_META[k])];
    for (const ev of order) {
      const isCur = ev.key === cur.key;
      const card = el('div', `event-card${isCur ? '' : ' locked'}`);
      card.innerHTML = `<div class="eico">${ev.icon}</div>
        <div class="etxt"><b>${ev.name}${isCur ? ' · 진행 중' : ''}</b>${ev.desc}</div>`;
      const btn = el('button', `btn ${isCur ? 'green' : 'ghost'} small`, isCur ? '참가' : '준비 중');
      btn.type = 'button';
      btn.disabled = !isCur;
      btn.addEventListener('click', () => { Audio.play('button'); m.close(); this.play(ev.key); });
      card.appendChild(btn);
      list.appendChild(card);
    }
    return m;
  }

  play(key) {
    switch (key) {
      case 'kingRescue': return this.playRescue();
      case 'coinRush': return this.playCoinRush();
      case 'lightningRush': return this.playLightning();
      case 'skyRace': return this.openSkyRace();
      case 'propellerFestival': return this.openFestival();
      default: return null;
    }
  }

  /* ---------------- 임금님 구출 ---------------- */
  playRescue() {
    const obstacles = [];
    for (let y = 5; y < 8; y++) for (let x = 1; x < 8; x++) obstacles.push({ type: 'box', x, y, hp: 1 });
    const level = {
      id: 'rescue', area: 1, level: 0, moves: 999, colors: 5, cols: 9, rows: 8,
      difficulty: 'hard', goals: [{ type: 'box', count: obstacles.length }],
      obstacles, drops: 3, seed: Date.now() % 100000,
      mode: 'rescue', seconds: CFG.events.kingRescue.seconds,
      title: '임금님 구출',
    };
    this.app.launchCustomLevel(level, { mode: 'timed', seconds: CFG.events.kingRescue.seconds, noLifeLoss: true, reward: { coins: CFG.events.kingRescue.rewardCoins, boosters: CFG.events.kingRescue.rewardBoosters } });
  }

  /* ---------------- 코인 러시 ---------------- */
  playCoinRush() {
    if (!Profile.areaComplete(Profile.currentArea())) {
      toast('구역 과제를 모두 마치면 열려요');
      return;
    }
    const key = `coinRush-${todayId()}`;
    if (Profile.state.chests.includes(key)) { toast('오늘 코인 러시는 이미 즐겼어요'); return; }
    const level = {
      id: 'coinRush', area: 1, level: 0, moves: CFG.events.coinRush.moves, colors: 5, cols: 9, rows: 8,
      difficulty: 'normal', goals: [{ type: 'collect', color: 'yellow', count: 30 }],
      obstacles: [], drops: 12, seed: Date.now() % 100000,
      mode: 'coinRush', title: '코인 러시',
    };
    this.app.launchCustomLevel(level, { mode: 'moves', reward: { coins: CFG.events.coinRush.rewardCoins }, chestKey: key });
  }

  /* ---------------- 번개 러시 ---------------- */
  playLightning() {
    const level = {
      id: 'lightning', area: 1, level: 0, moves: 999, colors: 5, cols: 9, rows: 8,
      difficulty: 'normal', goals: [{ type: 'collect', color: 'blue', count: 999 }],
      obstacles: [], drops: 2, seed: Date.now() % 100000,
      mode: 'lightning', seconds: CFG.events.lightningRush.seconds, title: '번개 러시',
    };
    this.app.launchCustomLevel(level, { mode: 'timed', seconds: CFG.events.lightningRush.seconds, scoreAttack: true, noLifeLoss: true, reward: { coins: CFG.events.lightningRush.rewardCoins } });
  }

  /* ---------------- 하늘 경주 ---------------- */
  openSkyRace() {
    const s = Profile.state;
    if (!s.skyRace) {
      const names = ['올리', '베아트리스', '로잘린드', '타이런', '미라벨', '세바스찬'];
      s.skyRace = {
        joinedAt: Date.now(),
        startLevel: s.level,
        progress: 0,
        rivals: names.slice(0, 4).map(n => ({ name: n, progress: 0, speed: 0.55 + Math.random() * 0.6 })),
      };
      Profile.save();
    }
    const race = s.skyRace;
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="font-size:13px;color:#6b7ba6">레벨을 깨면 진행도가 올라가요. 먼저 15개를 깬 사람이 우승!</p>
      <div id="race-list" style="display:flex;flex-direction:column;gap:6px;text-align:left;margin-top:8px"></div>`;
    const m = modal({ title: '하늘 경주', body, buttons: [{ label: '닫기', cls: 'ghost' }] });
    const list = body.querySelector('#race-list');
    let timer = null;
    const render = () => {
      const rows = [
        { name: Profile.state.name || '나', progress: race.progress, me: true, speed: 1 },
        ...race.rivals.map(r => ({ ...r, me: false })),
      ].sort((a, b) => b.progress - a.progress);
      list.innerHTML = rows.map((r, i) => `
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;${r.me ? 'color:#1f4fd8;font-weight:bold' : ''}">
          <span style="width:18px">${i + 1}</span>
          <span style="flex:1">${r.name}</span>
          <span style="flex:2;height:12px;background:#eef2fb;border-radius:99px;overflow:hidden;display:block">
            <i style="display:block;height:100%;width:${Math.min(100, (r.progress / CFG.events.skyRace.targets) * 100)}%;background:linear-gradient(90deg,#7ee08b,#2fbd5f);border-radius:99px"></i>
          </span>
          <span style="width:34px;text-align:right">${r.progress}/15</span>
        </div>`).join('');
    };
    render();
    timer = setInterval(() => {
      const now = Date.now();
      const mins = (now - race.joinedAt) / 60000;
      race.rivals.forEach(r => {
        r.progress = Math.min(CFG.events.skyRace.targets, Math.floor(mins * r.speed * 1.4));
      });
      const cleared = Profile.state.level - race.startLevel;
      race.progress = Math.min(CFG.events.skyRace.targets, Math.max(0, cleared));
      Profile.save({ sync: false });
      render();
      if (race.progress >= CFG.events.skyRace.targets && !race.done) {
        race.done = true;
        Profile.addCoins(CFG.events.skyRace.rewardCoins);
        Audio.play('victory');
        toast(`🎉 하늘 경주 우승! 🪙${fmt(CFG.events.skyRace.rewardCoins)}`, 2600);
      }
    }, CFG.events.skyRace.tickMs);
    m.onClose = () => clearInterval(timer);
    const origClose = m.close;
    m.close = () => { clearInterval(timer); origClose(); };
    return m;
  }

  /* ---------------- 프로펠러 축제 ---------------- */
  openFestival() {
    const body = document.createElement('div');
    const mine = Profile.state.propellerTotal || 0;
    const rivals = [
      { name: '올리', n: Math.max(0, mine - 2 + Math.floor(Math.random() * 8)) },
      { name: '베아트리스', n: Math.max(0, mine - 5 + Math.floor(Math.random() * 10)) },
      { name: '타이런', n: Math.max(0, mine + Math.floor(Math.random() * 6)) },
    ];
    const rows = [{ name: '나', n: mine, me: true }, ...rivals].sort((a, b) => b.n - a.n);
    body.innerHTML = `
      <div style="font-size:44px">🌀</div>
      <p style="font-size:13px">레벨에서 프로펠러를 만들 때마다 1개씩 쌓여요.</p>
      <div style="display:flex;flex-direction:column;gap:6px;text-align:left;margin-top:8px">
        ${rows.map((r, i) => `<div style="display:flex;gap:8px;font-size:13px;${r.me ? 'color:#1f4fd8;font-weight:bold' : ''}">
          <span style="width:18px">${i + 1}</span><span style="flex:1">${r.name}</span><span>${r.n}개</span></div>`).join('')}
      </div>`;
    modal({ title: '프로펠러 축제', body, buttons: [{ label: '닫기', cls: 'ghost' }] });
  }

  /* 번개 러시 점수 제출 */
  async submitRushScore(score) {
    if (score > (Profile.state.rushBest || 0)) {
      Profile.state.rushBest = score;
      Profile.save();
    }
    await submitRush(score, Profile.state.name, Profile.state.roomCode);
  }
}
