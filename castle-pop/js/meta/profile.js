/* =========================================================================
   profile.js — 플레이어 상태 (목숨·코인·별·부스터·연승·일일보상·과제)
   localStorage 캐시 + Firestore 동기화 (오프라인에서도 그대로 플레이)
   ========================================================================= */
import { CFG } from '../config.js';

const KEY = 'castlePop.profile.v1';
const SETTINGS_KEY = 'castlePop.settings.v1';

export function todayId(d = new Date()) {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}
export function weekId(d = new Date()) {
  const t = new Date(d.getTime());
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const week1 = new Date(t.getFullYear(), 0, 4);
  const no = 1 + Math.round(((t - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${t.getFullYear()}-W${String(no).padStart(2, '0')}`;
}
export function dayDiff(a, b) {
  const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}

function defaultState() {
  return {
    uid: null,
    name: '',
    level: 1,                 // 도달한 최고 레벨 (1~100)
    stars: 0,
    coins: CFG.economy.startCoins,
    lives: CFG.lives.max,
    livesUpdatedAt: Date.now(),
    unlimitedLivesUntil: 0,
    winStreak: 0,
    bestStreak: 0,
    boosters: Object.fromEntries(CFG.boosters.order.map(b => [b, CFG.boosters.starterCount])),
    preBoosters: Object.fromEntries(CFG.preBoosters.order.map(b => [b, 3])),
    area: 1,
    tasksDone: {},            // {areaId: [taskKey...]}
    dailyReward: { lastClaim: '', day: 0 },
    roulette: { lastSpin: '' },
    chests: [],               // 열어 둔 상자 키
    seenIntro: {},            // 장애물 안내 팝업
    tutorialsSeen: {},
    freeRefills: { day: '', used: 0 },
    weeklyCrowns: 0,
    weekId: weekId(),
    rushBest: 0,
    propellerTotal: 0,
    roomCode: '',
    starterGift: false,
    firstRun: true,
    updatedAt: Date.now(),
  };
}

export const Profile = {
  state: defaultState(),
  settings: {
    music: CFG.audio.musicVolume,
    sfx: CFG.audio.sfxVolume,
    muted: false,
    reduceEffects: CFG.ui.reduceEffectsDefault,
  },
  listeners: new Set(),

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state = { ...defaultState(), ...parsed };
      }
      const sraw = localStorage.getItem(SETTINGS_KEY);
      if (sraw) this.settings = { ...this.settings, ...JSON.parse(sraw) };
    } catch (e) { console.warn('[castle-pop] 프로필 로드 실패', e); }
    this.normalize();
    return this.state;
  },

  normalize() {
    const s = this.state;
    if (!s.boosters) s.boosters = {};
    for (const b of CFG.boosters.order) if (typeof s.boosters[b] !== 'number') s.boosters[b] = 0;
    if (!s.preBoosters) s.preBoosters = {};
    for (const b of CFG.preBoosters.order) if (typeof s.preBoosters[b] !== 'number') s.preBoosters[b] = 0;
    if (!s.tasksDone) s.tasksDone = {};
    if (!Array.isArray(s.chests)) s.chests = [];
    if (s.weekId !== weekId()) { s.weekId = weekId(); s.weeklyCrowns = 0; }
    if (!s.starterGift) {
      s.coins += 0; // 첫 실행 선물은 main 에서 지급(중복 방지 플래그)
    }
    this.refreshLives(false);
  },

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch (e) { console.warn(e); } } },

  save({ sync = true } = {}) {
    this.state.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* 용량 초과 등 */ }
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
    this.emit();
    if (sync) this.onSync?.(this.state);
  },

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
    this.emit();
  },

  /* ---------------- 목숨 ---------------- */
  refreshLives(save = true) {
    const s = this.state;
    const now = Date.now();
    if (s.unlimitedLivesUntil > now) { if (save) this.save(); return s.lives; }
    if (s.lives >= CFG.lives.max) { s.livesUpdatedAt = now; return s.lives; }
    const elapsed = now - (s.livesUpdatedAt || now);
    const gained = Math.floor(elapsed / CFG.lives.regenMs);
    if (gained > 0) {
      s.lives = Math.min(CFG.lives.max, s.lives + gained);
      s.livesUpdatedAt += gained * CFG.lives.regenMs;
      if (s.lives >= CFG.lives.max) s.livesUpdatedAt = now;
      if (save) this.save();
    }
    return s.lives;
  },
  livesLeftMs() {
    const s = this.state;
    if (s.unlimitedLivesUntil > Date.now()) return 0;
    if (s.lives >= CFG.lives.max) return 0;
    return Math.max(0, CFG.lives.regenMs - (Date.now() - s.livesUpdatedAt));
  },
  unlimitedActive() { return this.state.unlimitedLivesUntil > Date.now(); },
  spendLife(n = 1) {
    if (this.unlimitedActive()) return true;
    this.refreshLives(false);
    if (this.state.lives < n) return false;
    this.state.lives -= n;
    if (this.state.lives === CFG.lives.max - 1) this.state.livesUpdatedAt = Date.now();
    this.save();
    return true;
  },
  addLives(n) {
    this.refreshLives(false);
    this.state.lives = Math.min(CFG.lives.max, this.state.lives + n);
    this.save();
  },
  grantUnlimitedLives(ms) {
    this.state.unlimitedLivesUntil = Math.max(Date.now(), this.state.unlimitedLivesUntil) + ms;
    this.save();
  },
  freeRefillLeft() {
    const s = this.state;
    if (s.freeRefills.day !== todayId()) return CFG.lives.freeRefillsPerDay;
    return Math.max(0, CFG.lives.freeRefillsPerDay - s.freeRefills.used);
  },
  useFreeRefill() {
    if (this.freeRefillLeft() <= 0) return false;
    const s = this.state;
    if (s.freeRefills.day !== todayId()) s.freeRefills = { day: todayId(), used: 0 };
    s.freeRefills.used++;
    this.state.lives = CFG.lives.max;
    this.state.livesUpdatedAt = Date.now();
    this.save();
    return true;
  },
  refillWithCoins() {
    if (this.state.coins < CFG.lives.refillCost) return false;
    this.state.coins -= CFG.lives.refillCost;
    this.state.lives = CFG.lives.max;
    this.state.livesUpdatedAt = Date.now();
    this.save();
    return true;
  },

  /* ---------------- 재화 ---------------- */
  addCoins(n) { this.state.coins += n; this.save(); },
  spendCoins(n) {
    if (this.state.coins < n) return false;
    this.state.coins -= n;
    this.save();
    return true;
  },
  addStars(n) { this.state.stars += n; this.save(); },
  boosterCount(b) { return this.state.boosters[b] || 0; },
  useBooster(b) {
    if ((this.state.boosters[b] || 0) <= 0) return false;
    this.state.boosters[b]--;
    this.save();
    return true;
  },
  addBooster(b, n = 1) {
    this.state.boosters[b] = (this.state.boosters[b] || 0) + n;
    this.save();
  },
  usePreBooster(b) {
    if ((this.state.preBoosters[b] || 0) <= 0) return false;
    this.state.preBoosters[b]--;
    this.save();
    return true;
  },
  addPreBooster(b, n = 1) {
    this.state.preBoosters[b] = (this.state.preBoosters[b] || 0) + n;
    this.save();
  },

  /* ---------------- 연승 ---------------- */
  streakGift() {
    const st = this.state.winStreak;
    let gift = null;
    for (const g of CFG.reward.streak) if (st >= g.at) gift = g;
    return gift;
  },
  onLevelWin() {
    this.state.winStreak++;
    this.state.bestStreak = Math.max(this.state.bestStreak, this.state.winStreak);
    this.state.weeklyCrowns++;
    this.save();
  },
  onLevelFail() {
    this.state.winStreak = 0;
    this.save();
  },

  /* ---------------- 일일 보상 / 룰렛 ---------------- */
  dailyAvailable() { return this.state.dailyReward.lastClaim !== todayId(); },
  claimDaily() {
    const s = this.state;
    if (!this.dailyAvailable()) return null;
    const last = s.dailyReward.lastClaim;
    const cont = last && dayDiff(last, todayId()) === 1;
    const day = cont ? (s.dailyReward.day % CFG.reward.dailyCycleDays) + 1 : 1;
    const prize = CFG.reward.daily[day - 1];
    s.dailyReward = { lastClaim: todayId(), day };
    s.coins += prize.coins;
    if (prize.booster) s.boosters[prize.booster] = (s.boosters[prize.booster] || 0) + 1;
    this.save();
    return { ...prize, day };
  },
  rouletteAvailable() { return this.state.roulette.lastSpin !== todayId(); },
  spinRoulette() {
    if (!this.rouletteAvailable()) return null;
    const total = CFG.reward.roulettePrize.reduce((s, p) => s + p.weight, 0);
    let roll = Math.random() * total;
    let pick = CFG.reward.roulettePrize[0];
    for (const p of CFG.reward.roulettePrize) { roll -= p.weight; if (roll <= 0) { pick = p; break; } }
    this.state.roulette.lastSpin = todayId();
    if (pick.kind === 'coins') this.state.coins += pick.amount;
    if (pick.kind === 'booster') this.state.boosters[pick.booster] = (this.state.boosters[pick.booster] || 0) + 1;
    if (pick.kind === 'lives') this.addLives(pick.amount);
    if (pick.kind === 'unlimited') this.grantUnlimitedLives(pick.minutes * 60000);
    this.save();
    return pick;
  },

  /* ---------------- 과제 / 구역 ---------------- */
  areaTasks(areaId) {
    return CFG.areaDefs[(areaId - 1) % CFG.areaDefs.length].tasks;
  },
  tasksDoneIn(areaId) {
    return this.state.tasksDone[areaId] || [];
  },
  taskDone(areaId, key) {
    return this.tasksDoneIn(areaId).includes(key);
  },
  completeTask(areaId, key) {
    const list = this.tasksDoneIn(areaId);
    if (list.includes(key)) return false;
    const task = this.areaTasks(areaId).find(t => t.key === key);
    if (!task) return false;
    if (this.state.stars < task.stars) return false;
    this.state.stars -= task.stars;
    this.state.tasksDone[areaId] = [...list, key];
    this.save();
    return true;
  },
  areaComplete(areaId) {
    const tasks = this.areaTasks(areaId);
    return tasks.every(t => this.taskDone(areaId, t.key));
  },
  areaStarsNeeded(areaId) {
    return this.areaTasks(areaId).filter(t => !this.taskDone(areaId, t.key)).length;
  },
  currentArea() {
    const lvl = this.state.level;
    return Math.min(CFG.areas, Math.floor((lvl - 1) / CFG.levelsPerArea) + 1);
  },

  /* ---------------- 진행 ---------------- */
  completeLevel(levelId) {
    const s = this.state;
    const next = Math.min(CFG.areas * CFG.levelsPerArea, levelId + 1);
    s.level = Math.max(s.level, next);
    s.stars += 1;
    this.save();
    return s.level;
  },
  levelIndex() { return Math.min(CFG.areas * CFG.levelsPerArea, this.state.level); },

  /* ---------------- 설정 ---------------- */
  setSetting(key, value) {
    this.settings[key] = value;
    this.saveSettings();
  },

  /* 서버 병합 */
  mergeRemote(remote) {
    if (!remote) return;
    const local = this.state;
    if ((remote.updatedAt || 0) > (local.updatedAt || 0) + 1500) {
      this.state = { ...local, ...remote, uid: local.uid || remote.uid };
      this.normalize();
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch {}
      this.emit();
    }
  },
};
