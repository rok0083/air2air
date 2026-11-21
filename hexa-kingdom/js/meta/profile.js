/* =========================================================================
   플레이어 프로필 — 진행도·별·코인·경험치·목숨·부스터·복구 과제를 담고
   localStorage 에 저장합니다. Firebase 와는 js/firebase/store.js 가 동기화합니다.
   ========================================================================= */
import { CFG } from '../config.js';
import { WORLDS, ALL_TASKS, levelName, worldById, districtOf } from './worldmap.js';

const KEY = CFG.storageKey;

function defaults() {
  return {
    version: 1,
    uid: null,
    name: '',
    createdAt: Date.now(),
    coins: CFG.coins.start,
    hammerTokens: CFG.hammers.start,
    xp: 0,
    playerLevel: 1,
    stars: {},            // { 'w1-3': 3 }
    cleared: {},          // { 'w1-3': true }
    bestScores: {},
    tasks: {},            // { 'w1d1t1': true }
    lives: { count: CFG.lives.max, nextAt: 0 },
    streak: { levelId: '', count: 0 },
    boosters: { hammer: 2, drill: 1, bomber: 1, magicHat: 0, startRocket: 1, startTnt: 1, startSpinner: 0 },
    settings: { muted: false, music: true, sfx: true },
    lastPlayed: { world: 1, level: 1 },
    weekly: { weekId: '', best: 0 },
    roomCode: '',
    stats: { plays: 0, wins: 0, blitzPlays: 0, tasks: 0 },
    updatedAt: 0,
    createdLocally: true,
  };
}

export const levelId = (world, level) => `w${world}-${level}`;

/* 이번 주 키 (월요일 시작) */
export function weekIdOf(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 월=0
  d.setDate(d.getDate() - day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export class Profile {
  constructor(data) {
    this.data = Object.assign(defaults(), data || {});
    this.data.lives = Object.assign(defaults().lives, this.data.lives || {});
    this.data.boosters = Object.assign(defaults().boosters, this.data.boosters || {});
    this.data.settings = Object.assign(defaults().settings, this.data.settings || {});
    this.data.streak = Object.assign(defaults().streak, this.data.streak || {});
    this.data.weekly = Object.assign(defaults().weekly, this.data.weekly || {});
    this.data.stats = Object.assign(defaults().stats, this.data.stats || {});
    this.refreshLives();
  }

  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return new Profile(null);
      return new Profile(JSON.parse(raw));
    } catch { return new Profile(null); }
  }

  save() {
    this.data.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* 저장 공간 부족 무시 */ }
  }

  reset() {
    this.data = defaults();
    this.save();
  }

  get name() { return this.data.name; }
  set name(v) { this.data.name = String(v || '').slice(0, CFG.ui.nicknameMax); }
  get coins() { return this.data.coins; }
  get hammerTokens() { return this.data.hammerTokens; }
  get xp() { return this.data.xp; }
  get playerLevel() { return this.data.playerLevel; }
  get roomCode() { return this.data.roomCode; }
  get uid() { return this.data.uid; }

  /* ── 진행도 ──────────────────────────────────────────── */
  starsOf(world, level) { return this.data.stars[levelId(world, level)] || 0; }
  isCleared(world, level) { return !!this.data.cleared[levelId(world, level)]; }
  get totalStars() { return Object.values(this.data.stars).reduce((a, b) => a + (b || 0), 0); }
  get clearedCount() { return Object.keys(this.data.cleared).length; }

  get highestCleared() {
    let best = { world: 0, level: 0, index: 0 };
    for (const key of Object.keys(this.data.cleared)) {
      const m = key.match(/^w(\d+)-(\d+)$/);
      if (!m) continue;
      const world = +m[1], level = +m[2];
      const index = (world - 1) * CFG.progression.levelsPerWorld + level;
      if (index > best.index) best = { world, level, index };
    }
    return best;
  }

  isWorldUnlocked(world) {
    if (world <= 1) return true;
    return this.isCleared(world - 1, CFG.progression.unlockNextWorldAtLevel);
  }

  isLevelUnlocked(world, level) {
    if (!this.isWorldUnlocked(world)) return false;
    if (level <= 1) return true;
    if (level > CFG.progression.levelsPerWorld) return false;
    return this.isCleared(world, level - 1);
  }

  districtCleared(world, districtIndex) {
    for (let i = 0; i < CFG.progression.levelsPerDistrict; i++) {
      const lv = (districtIndex - 1) * CFG.progression.levelsPerDistrict + i + 1;
      if (!this.isCleared(world, lv)) return false;
    }
    return true;
  }

  districtOpen(world, districtIndex) {
    const lv = (districtIndex - 1) * CFG.progression.levelsPerDistrict + 1;
    return this.isLevelUnlocked(world, lv) || this.isCleared(world, lv);
  }

  /* 다음에 플레이할 스테이지 */
  nextLevel() {
    for (const w of WORLDS) {
      if (!this.isWorldUnlocked(w.id)) continue;
      for (let lv = 1; lv <= CFG.progression.levelsPerWorld; lv++) {
        if (!this.isCleared(w.id, lv)) {
          return this.isLevelUnlocked(w.id, lv) ? { world: w.id, level: lv } : { world: w.id, level: Math.max(1, lv - 1) };
        }
      }
    }
    return { world: 1, level: 1 };
  }

  /* ── 코인 / 경험치 / 망치 ────────────────────────────── */
  addCoins(n) { this.data.coins = Math.max(0, this.data.coins + Math.round(n)); return this.data.coins; }
  spendCoins(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n; return true;
  }
  addHammers(n) { this.data.hammerTokens += n; }
  spendHammer(n = 1) {
    if (this.data.hammerTokens < n) return false;
    this.data.hammerTokens -= n; return true;
  }

  xpNeeded(level = this.data.playerLevel) {
    return Math.round(CFG.xp.base * Math.pow(CFG.xp.curve, level - 1));
  }

  addXp(n) {
    const ups = [];
    this.data.xp += Math.max(0, Math.round(n));
    while (this.data.playerLevel < CFG.xp.maxPlayerLevel && this.data.xp >= this.xpNeeded()) {
      this.data.xp -= this.xpNeeded();
      this.data.playerLevel++;
      ups.push(this.data.playerLevel);
      this.data.lives.count = Math.min(CFG.lives.max, this.data.lives.count + CFG.lives.refillOnLevelUp);
    }
    if (this.data.playerLevel >= CFG.xp.maxPlayerLevel) this.data.xp = Math.min(this.data.xp, this.xpNeeded());
    return ups;
  }

  /* ── 목숨 (30분 회복) ─────────────────────────────────── */
  refreshLives(now = Date.now()) {
    const L = this.data.lives;
    const max = CFG.lives.max;
    if (L.count >= max) { L.count = max; L.nextAt = 0; return L; }
    if (!L.nextAt) L.nextAt = now + CFG.lives.recoveryMs;
    let guard = 0;
    while (L.count < max && now >= L.nextAt && guard++ < 100) {
      L.count++;
      L.nextAt += CFG.lives.recoveryMs;
    }
    if (L.count >= max) { L.count = max; L.nextAt = 0; }
    return L;
  }

  livesInfo(now = Date.now()) {
    this.refreshLives(now);
    const L = this.data.lives;
    return {
      count: L.count,
      max: CFG.lives.max,
      nextIn: L.nextAt ? Math.max(0, L.nextAt - now) : 0,
    };
  }

  consumeLife() {
    this.refreshLives();
    if (this.data.lives.count <= 0) return false;
    this.data.lives.count--;
    if (this.data.lives.count < CFG.lives.max && !this.data.lives.nextAt) {
      this.data.lives.nextAt = Date.now() + CFG.lives.recoveryMs;
    }
    return true;
  }

  refillLives() {
    this.data.lives = { count: CFG.lives.max, nextAt: 0 };
  }

  /* ── 부스터 ──────────────────────────────────────────── */
  boosterCount(key) { return this.data.boosters[key] || 0; }
  addBooster(key, n = 1) { this.data.boosters[key] = (this.data.boosters[key] || 0) + n; }
  useBooster(key) {
    if (!this.data.boosters[key]) return false;
    this.data.boosters[key]--;
    return true;
  }

  /* ── 클리어 기록 ─────────────────────────────────────── */
  recordClear(world, level, stars, score) {
    const key = levelId(world, level);
    const first = !this.data.cleared[key];
    const prevStars = this.data.stars[key] || 0;
    const newStars = Math.max(prevStars, stars);
    this.data.cleared[key] = true;
    this.data.stars[key] = newStars;
    this.data.bestScores[key] = Math.max(this.data.bestScores[key] || 0, score);
    this.data.lastPlayed = { world, level };

    // 연승(같은 스테이지 연속 클리어)
    const s = this.data.streak;
    if (s.levelId === key) s.count++;
    else { s.levelId = key; s.count = 1; }

    const rewards = { coins: 0, xp: 0, hammers: 0, stars: newStars, starDelta: newStars - prevStars, levelUps: [], first };
    if (first) {
      rewards.coins += CFG.coins.levelClear;
      rewards.xp += CFG.xp.perLevelClear;
      rewards.hammers += CFG.hammers.perLevel;
    }
    rewards.coins += (newStars - prevStars) * CFG.coins.perStar;
    rewards.xp += (newStars - prevStars) * CFG.xp.perStar;
    rewards.coins += Math.min(3, s.count - 1) * CFG.coins.streakBonus;

    // 구역 완료 보너스
    const di = Math.floor((level - 1) / CFG.progression.levelsPerDistrict) + 1;
    if (this.districtCleared(world, di) && !this.data.cleared[`district-${world}-${di}`]) {
      this.data.cleared[`district-${world}-${di}`] = true;
      rewards.coins += CFG.coins.districtClear;
      rewards.hammers += CFG.hammers.perDistrict;
    }

    this.addCoins(rewards.coins);
    rewards.hammers && this.addHammers(rewards.hammers);
    rewards.levelUps = this.addXp(rewards.xp);
    this.save();
    return rewards;
  }

  recordFail(world, level, score) {
    this.data.streak.count = 0;
    this.data.lastPlayed = { world, level };
    this.data.bestScores[levelId(world, level)] = Math.max(this.data.bestScores[levelId(world, level)] || 0, score);
    this.save();
  }

  /* ── 복구 과제 ───────────────────────────────────────── */
  taskDone(id) { return !!this.data.tasks[id]; }
  taskUnlocked(task) {
    const m = task.id.match(/^w(\d+)d(\d+)t(\d+)$/);
    if (!m) return false;
    const world = +m[1], di = +m[2], ti = +m[3];
    if (!this.isWorldUnlocked(world)) return false;
    // 같은 구역의 스테이지를 하나라도 깨면 열림
    const firstLv = (di - 1) * CFG.progression.levelsPerDistrict + 1;
    const anyCleared = [0, 1, 2, 3, 4].some(i => this.isCleared(world, firstLv + i));
    if (!anyCleared) return false;
    // 이전 과제 완료 필요
    if (ti > 1) return this.taskDone(`w${world}d${di}t${ti - 1}`);
    return true;
  }

  completeTask(task) {
    if (!this.taskUnlocked(task) || this.taskDone(task.id)) return null;
    if (!this.spendHammer(task.cost)) return null;
    this.data.tasks[task.id] = true;
    this.data.stats.tasks++;
    const rewards = { coins: task.coins + Math.round(CFG.coins.taskRestore), xp: task.xp };
    this.addCoins(rewards.coins);
    rewards.levelUps = this.addXp(rewards.xp);
    this.save();
    return rewards;
  }

  get taskCount() { return Object.keys(this.data.tasks).length; }
  worldTaskCount(world) {
    return WORLDS.find(w => w.id === world)?.districts.flatMap(d => d.tasks).filter(t => this.taskDone(t.id)).length || 0;
  }
  restoredRatio(world) {
    return this.worldTaskCount(world) / 20;
  }

  /* ── 방 코드 ─────────────────────────────────────────── */
  ensureRoomCode() {
    if (this.data.roomCode) return this.data.roomCode;
    const chars = CFG.firebase.roomAlphabet;
    let code = '';
    for (let i = 0; i < CFG.firebase.roomCodeLength; i++) code += chars[Math.floor(Math.random() * chars.length)];
    this.data.roomCode = code;
    this.save();
    return code;
  }
  setRoomCode(code) {
    const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CFG.firebase.roomCodeLength);
    this.data.roomCode = clean;
    this.save();
    return clean;
  }

  /* ── 주간 블리츠 ─────────────────────────────────────── */
  blitzBest() {
    if (this.data.weekly.weekId !== weekIdOf()) return 0;
    return this.data.weekly.best || 0;
  }
  recordBlitz(score) {
    const w = weekIdOf();
    if (this.data.weekly.weekId !== w) this.data.weekly = { weekId: w, best: score };
    else this.data.weekly.best = Math.max(this.data.weekly.best || 0, score);
    this.data.stats.blitzPlays++;
    const rewards = { coins: CFG.blitz.reward.coins, xp: CFG.blitz.reward.xp };
    this.addCoins(rewards.coins);
    rewards.levelUps = this.addXp(rewards.xp);
    this.save();
    return rewards;
  }

  /* ── 랭킹(Firestore)용 요약 ───────────────────────────── */
  remoteDoc() {
    const h = this.highestCleared;
    return {
      uid: this.data.uid || '',
      name: this.data.name || '이름없는 기사',
      playerLevel: this.data.playerLevel,
      xp: this.data.xp,
      coins: this.data.coins,
      stars: this.totalStars,
      progressIndex: h.index,
      progressWorld: h.world,
      progressLevel: h.level,
      roomCode: this.data.roomCode || '',
      tasks: this.taskCount,
      updatedAt: this.data.updatedAt || Date.now(),
    };
  }

  /* 서버 문서 병합(로컬이 더 최신이면 로컬 유지) */
  mergeRemote(remote) {
    if (!remote) return;
    const localTs = this.data.updatedAt || 0;
    const remoteTs = remote.updatedAt?.seconds ? remote.updatedAt.seconds * 1000 : (remote.updatedAt || 0);
    if (remoteTs > localTs + 5000 && remote.progressIndex > this.highestCleared.index) {
      // 서버가 더 앞서 있으면 진행도만 참고(로컬 저장은 유지)
      this.data.serverProgress = { index: remote.progressIndex, world: remote.progressWorld, level: remote.progressLevel };
    }
  }

  summary() {
    return {
      name: this.data.name,
      coins: this.data.coins,
      hammers: this.data.hammerTokens,
      level: this.data.playerLevel,
      xp: this.data.xp,
      stars: this.totalStars,
      cleared: this.clearedCount,
      tasks: this.taskCount,
      lives: this.livesInfo(),
      roomCode: this.data.roomCode,
    };
  }
}

export { ALL_TASKS, WORLDS, levelName, worldById, districtOf };
