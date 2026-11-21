/* =========================================================================
   rankings.js — 4탭 실시간 랭킹 (onSnapshot)
     ① 전체(도달 레벨) ② 주간 리그(이번 주 왕관) ③ 번개 러시 ④ 우리 방
   · 6자리 친구 방 코드(?room=CODE), 방 친구끼리 목숨 선물
   · 추월 감지: 내 순위가 오르면 축하 연출 (main 에서 알림)
   ========================================================================= */
import { CFG } from '../config.js';
import { FB } from './config.js';
import { initAuth } from './auth.js';
import { weeklyId } from './store.js';

const C = CFG.firebase.collections;

export function makeRoomCode() {
  const alphabet = CFG.firebase.roomAlphabet;
  let out = '';
  for (let i = 0; i < CFG.firebase.roomCodeLength; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function ensureRoom(code, name) {
  if (!FB.online) return false;
  const { mod, db } = FB;
  const ref = mod.fsMod.doc(db, C.rooms, code);
  try {
    const snap = await mod.fsMod.getDoc(ref);
    if (!snap.exists()) {
      await mod.fsMod.setDoc(ref, { code, name: code, members: [FB.uid], names: { [FB.uid]: name }, createdAt: Date.now(), updatedAt: Date.now() });
    } else {
      const data = snap.data();
      const members = Array.isArray(data.members) ? data.members : [];
      if (!members.includes(FB.uid) && members.length < 30) {
        await mod.fsMod.setDoc(ref, {
          members: [...members, FB.uid],
          names: { ...(data.names || {}), [FB.uid]: name },
          updatedAt: Date.now(),
        }, { merge: true });
      }
    }
    return true;
  } catch (e) {
    console.warn('[castle-pop] 방 참가 실패', e?.code || e?.message);
    return false;
  }
}

export async function sendLifeGift(toUid, fromName) {
  if (!FB.online || !toUid || toUid === FB.uid) return false;
  const { mod, db } = FB;
  try {
    const id = `${FB.uid}_${toUid}_${Date.now()}`;
    await mod.fsMod.setDoc(mod.fsMod.doc(db, C.gifts, id), {
      fromUid: FB.uid, toUid, type: 'life', claimed: false,
      fromName: (fromName || '친구').slice(0, 12), createdAt: Date.now(),
    });
    return true;
  } catch (e) { return false; }
}

/* 랭킹 구독 */
export function subscribe(tab, { roomCode, limit = 50 }, cb) {
  if (!FB.online) { cb({ rows: [], me: null, offline: true }); return () => {}; }
  const { mod, db } = FB;
  const fs = mod.fsMod;
  let q;
  const col = tab === 'rush' ? fs.collection(db, C.rush) : fs.collection(db, C.leaderboard);
  if (tab === 'level') {
    q = fs.query(col, fs.orderBy('level', 'desc'), fs.limit(limit));
  } else if (tab === 'weekly') {
    // 복합 색인이 필요 없는 형태로 가져와 브라우저에서 정렬한다
    q = fs.query(col, fs.where('weekId', '==', weeklyId()), fs.limit(100));
  } else if (tab === 'rush') {
    q = fs.query(col, fs.where('weekId', '==', weeklyId()), fs.limit(100));
  } else {
    if (!roomCode) { cb({ rows: [], me: null, empty: true }); return () => {}; }
    q = fs.query(col, fs.where('roomCodes', 'array-contains', roomCode), fs.limit(100));
  }
  try {
    return fs.onSnapshot(q, snap => {
      let docs = snap.docs;
      if (tab === 'weekly') docs = [...docs].sort((a, b) => (b.data().weeklyCrowns || 0) - (a.data().weeklyCrowns || 0)).slice(0, limit);
      if (tab === 'rush') docs = [...docs].sort((a, b) => (b.data().score || 0) - (a.data().score || 0)).slice(0, limit);
      if (tab === 'room') docs = [...docs].sort((a, b) => (b.data().level || 0) - (a.data().level || 0)).slice(0, limit);
      const rows = docs.map((d, i) => {
        const v = d.data();
        return {
          uid: d.id, rank: i + 1,
          name: v.name || '플레이어',
          level: v.level ?? 0,
          weeklyCrowns: v.weeklyCrowns ?? 0,
          rush: v.score ?? 0,
          weeklyScore: v.score ?? 0,
          me: d.id === FB.uid,
        };
      });
      const me = rows.find(r => r.me) || null;
      cb({ rows, me, offline: false });
    }, err => {
      console.warn('[castle-pop] 랭킹 구독 오류', err?.code || err?.message);
      cb({ rows: [], me: null, error: err?.code || 'subscribe-failed' });
    });
  } catch (e) {
    console.warn('[castle-pop] 랭킹 쿼리 실패', e?.message);
    cb({ rows: [], me: null, error: 'query-failed' });
    return () => {};
  }
}

export async function fetchRoom(code) {
  if (!FB.online) return null;
  const { mod, db } = FB;
  try {
    const snap = await mod.fsMod.getDoc(mod.fsMod.doc(db, C.rooms, code));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

export async function myGifts() {
  if (!FB.online) return [];
  const { mod, db } = FB;
  try {
    const q = mod.fsMod.query(mod.fsMod.collection(db, C.gifts),
      mod.fsMod.where('toUid', '==', FB.uid), mod.fsMod.where('claimed', '==', false), mod.fsMod.limit(20));
    const snap = await mod.fsMod.getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function claimGift(id) {
  if (!FB.online) return false;
  const { mod, db } = FB;
  try {
    await mod.fsMod.updateDoc(mod.fsMod.doc(db, C.gifts, id), { claimed: true });
    return true;
  } catch { return false; }
}

export async function initRankings() {
  await initAuth();
  return FB.online;
}

/* 한 번만 읽는 상위 레벨 목록 (추월 알림용) */
export async function topLevels(limit = 60) {
  if (!FB.online) return null;
  const { mod, db } = FB;
  try {
    const q = mod.fsMod.query(mod.fsMod.collection(db, C.leaderboard),
      mod.fsMod.orderBy('level', 'desc'), mod.fsMod.limit(limit));
    const snap = await mod.fsMod.getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[castle-pop] topLevels 실패', e?.code || e?.message);
    return null;
  }
}
