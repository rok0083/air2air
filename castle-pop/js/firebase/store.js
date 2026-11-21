/* =========================================================================
   store.js — cp_users/{uid} 저장 · cp_leaderboard/{uid} 갱신
   · 오프라인이면 localStorage 에만 쓰고, 접속하면 밀린 변경을 올린다
   · 실패한 쓰기는 큐에 남겨 다음 기회에 재전송
   ========================================================================= */
import { CFG } from '../config.js';
import { getFirebase, FB } from './config.js';
import { initAuth } from './auth.js';

const QUEUE_KEY = 'castlePop.syncQueue.v1';
let saveTimer = null;
let lastSaved = 0;

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-30))); } catch {}
}

function sanitize(state) {
  return {
    uid: state.uid || '',
    name: (state.name || '플레이어').slice(0, 12),
    level: Math.max(1, Math.min(100, state.level | 0)),
    stars: Math.max(0, Math.min(3000, state.stars | 0)),
    coins: Math.max(0, Math.min(10000000, state.coins | 0)),
    lives: Math.max(0, Math.min(CFG.lives.max, state.lives | 0)),
    livesUpdatedAt: Math.max(0, state.livesUpdatedAt | 0),
    unlimitedLivesUntil: Math.max(0, state.unlimitedLivesUntil | 0),
    winStreak: Math.max(0, Math.min(999, state.winStreak | 0)),
    area: Math.max(1, Math.min(5, state.area | 0)),
    boosters: state.boosters || {},
    preBoosters: state.preBoosters || {},
    tasksDone: state.tasksDone || {},
    dailyReward: state.dailyReward || {},
    weeklyCrowns: Math.max(0, Math.min(100, state.weeklyCrowns | 0)),
    weekId: state.weekId || '',
    roomCode: (state.roomCode || '').slice(0, 6),
    rushBest: Math.max(0, Math.min(200000, state.rushBest | 0)),
    propellerTotal: Math.max(0, state.propellerTotal | 0),
    updatedAt: Date.now(),
  };
}

function sanitizeBoard(state) {
  return {
    uid: FB.uid,
    name: (state.name || '플레이어').slice(0, 12),
    level: Math.max(1, Math.min(100, state.level | 0)),
    weeklyCrowns: Math.max(0, Math.min(100, state.weeklyCrowns | 0)),
    weekId: state.weekId || '',
    rushBest: Math.max(0, Math.min(200000, state.rushBest | 0)),
    roomCodes: state.roomCode ? [state.roomCode] : [],
    updatedAt: Date.now(),
  };
}

export async function initStore() {
  await initAuth();
  if (!FB.online) return FB;
  const { mod, db } = FB;
  try {
    const ref = mod.fsMod.doc(db, CFG.firebase.collections.users, FB.uid);
    const snap = await mod.fsMod.getDoc(ref);
    if (snap.exists()) {
      FB.remote = snap.data();
    }
  } catch (e) {
    console.warn('[castle-pop] 프로필 읽기 실패', e?.code || e?.message);
  }
  await flushQueue();
  return FB;
}

export function queueSave(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(state), CFG.firebase.syncDebounceMs);
}

export async function saveNow(state) {
  state.uid = FB.uid || state.uid;
  const payload = sanitize(state);
  if (!FB.online) {
    const q = readQueue();
    q.push({ kind: 'profile', payload });
    writeQueue(q);
    return { ok: false, offline: true };
  }
  const { mod, db } = FB;
  try {
    await mod.fsMod.setDoc(mod.fsMod.doc(db, CFG.firebase.collections.users, FB.uid), payload, { merge: true });
    await mod.fsMod.setDoc(mod.fsMod.doc(db, CFG.firebase.collections.leaderboard, FB.uid), sanitizeBoard(state), { merge: true });
    lastSaved = Date.now();
    return { ok: true };
  } catch (e) {
    console.warn('[castle-pop] 저장 실패 — 큐에 보관', e?.code || e?.message);
    const q = readQueue();
    q.push({ kind: 'profile', payload });
    writeQueue(q);
    return { ok: false, error: e?.code || 'write-failed' };
  }
}

export async function flushQueue() {
  if (!FB.online) return;
  const q = readQueue();
  if (!q.length) return;
  writeQueue([]);
  for (const item of q) {
    try {
      const { mod, db } = FB;
      if (item.kind === 'profile') {
        await mod.fsMod.setDoc(mod.fsMod.doc(db, CFG.firebase.collections.users, FB.uid), { ...item.payload, uid: FB.uid }, { merge: true });
      }
    } catch (e) { /* 다음 기회에 */ }
  }
}

/* 주간 러시 점수 */
export async function submitRush(score, name, roomCode) {
  if (!FB.online) return false;
  const { mod, db } = FB;
  try {
    await mod.fsMod.setDoc(mod.fsMod.doc(db, CFG.firebase.collections.rush, FB.uid), {
      uid: FB.uid,
      name: (name || '플레이어').slice(0, 12),
      score: Math.max(0, Math.min(200000, score | 0)),
      weekId: weeklyId(),
      roomCode: roomCode || '',
      createdAt: Date.now(),
    }, { merge: true });
    return true;
  } catch (e) { return false; }
}

export function weeklyId() {
  const d = new Date();
  const t = new Date(d.getTime());
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const week1 = new Date(t.getFullYear(), 0, 4);
  const no = 1 + Math.round(((t - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${t.getFullYear()}-W${String(no).padStart(2, '0')}`;
}

export function lastSavedAt() { return lastSaved; }
