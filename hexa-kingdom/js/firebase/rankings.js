/* =========================================================================
   랭킹 — 4개 탭
     1) 진행 레벨 : users 를 progressIndex 내림차순
     2) 총 별     : users 를 stars 내림차순
     3) 주간 블리츠: blitzScores 중 이번 주(weekId) 점수
     4) 우리 방   : roomCode 가 같은 유저/점수 (+ URL ?room=CODE)
   복합 색인이 필요 없도록 정렬은 클라이언트에서 처리합니다.
   ========================================================================= */
import { CFG } from '../config.js';
import { getFirebase } from './config.js';
import { weekIdOf } from '../meta/profile.js';

let ctx = null;
const get = async () => (ctx ||= await getFirebase());

export async function saveBlitzScore({ uid, name, score, roomCode, playerLevel = 1 }) {
  const fb = await get();
  if (!fb?.db) return { ok: false, reason: 'offline' };
  const { fsMod, db } = fb;
  try {
    const ref = await fsMod.addDoc(fsMod.collection(db, CFG.firebase.collectionBlitz), {
      uid, name, score: Math.max(0, Math.round(score)),
      roomCode: roomCode || 'GLOBAL',
      weekId: weekIdOf(),
      mode: CFG.blitz.mode,
      playerLevel,
      createdAt: fsMod.serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  } catch (err) {
    console.warn('[hexa-kingdom] 블리츠 점수 저장 실패', err?.code || err);
    return { ok: false, reason: err?.code || 'error' };
  }
}

export async function deleteBlitz(id) {
  const fb = await get();
  if (!fb?.db || !id) return false;
  try { await fb.fsMod.deleteDoc(fb.fsMod.doc(fb.db, CFG.firebase.collectionBlitz, id)); return true; }
  catch { return false; }
}

async function fetchUsers(orderField) {
  const fb = await get();
  if (!fb?.db) throw new Error('offline');
  const { fsMod, db } = fb;
  const q = fsMod.query(
    fsMod.collection(db, CFG.firebase.collectionUsers),
    fsMod.orderBy(orderField, 'desc'),
    fsMod.limit(CFG.firebase.leaderboardLimit),
  );
  const snap = await fsMod.getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchRoomUsers(roomCode) {
  const fb = await get();
  if (!fb?.db) throw new Error('offline');
  const { fsMod, db } = fb;
  const q = fsMod.query(
    fsMod.collection(db, CFG.firebase.collectionUsers),
    fsMod.where('roomCode', '==', roomCode),
    fsMod.limit(50),
  );
  const snap = await fsMod.getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchBlitz(roomCode = null) {
  const fb = await get();
  if (!fb?.db) throw new Error('offline');
  const { fsMod, db } = fb;
  const week = weekIdOf();
  const conds = [fsMod.where('weekId', '==', week)];
  if (roomCode) conds.push(fsMod.where('roomCode', '==', roomCode));
  const q = fsMod.query(fsMod.collection(db, CFG.firebase.collectionBlitz), ...conds, fsMod.limit(80));
  const snap = await fsMod.getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.score || 0) - (a.score || 0));
}

/* tab: 'progress' | 'stars' | 'blitz' | 'room' */
export async function fetchRanking(tab, { roomCode = '', uid = '' } = {}) {
  try {
    if (tab === 'progress') {
      const rows = await fetchUsers('progressIndex');
      return { ok: true, rows: rows.map(r => ({ uid: r.uid, name: r.name, value: r.progressIndex || 0, sub: `W${r.progressWorld || 1}-${r.progressLevel || 1}`, me: r.uid === uid })) };
    }
    if (tab === 'stars') {
      const rows = await fetchUsers('stars');
      return { ok: true, rows: rows.map(r => ({ uid: r.uid, name: r.name, value: r.stars || 0, sub: `Lv.${r.playerLevel || 1}`, me: r.uid === uid })) };
    }
    if (tab === 'blitz') {
      const rows = await fetchBlitz(null);
      return { ok: true, rows: rows.map(r => ({ uid: r.uid, name: r.name, value: r.score || 0, sub: weekIdOf(), me: r.uid === uid })) };
    }
    if (tab === 'room') {
      if (!roomCode) return { ok: true, rows: [], roomCode };
      const [users, blitz] = await Promise.all([fetchRoomUsers(roomCode), fetchBlitz(roomCode)]);
      const rows = users.map(u => ({ uid: u.uid, name: u.name, value: u.progressIndex || 0, sub: `★${u.stars || 0}`, me: u.uid === uid }));
      const best = new Map();
      for (const b of blitz) if (!best.has(b.uid) || best.get(b.uid).score < b.score) best.set(b.uid, b);
      for (const b of best.values()) {
        const hit = rows.find(r => r.uid === b.uid);
        if (hit) hit.sub += ` · 블리츠 ${b.score}`;
        else rows.push({ uid: b.uid, name: b.name, value: b.kind === 'blitz' ? 0 : 0, sub: `블리츠 ${b.score}`, me: b.uid === uid, blitzOnly: true });
      }
      return { ok: true, rows, roomCode };
    }
  } catch (err) {
    return { ok: false, error: err?.code || err?.message || 'error', rows: [] };
  }
  return { ok: false, rows: [] };
}

export async function saveMyRecord(profile) {
  const fb = await get();
  if (!fb?.db || !profile.uid) return false;
  const { fsMod, db } = fb;
  try {
    const doc = profile.remoteDoc();
    await fsMod.setDoc(fsMod.doc(db, CFG.firebase.collectionUsers, profile.uid), { ...doc, updatedAt: fsMod.serverTimestamp() }, { merge: true });
    return true;
  } catch { return false; }
}
