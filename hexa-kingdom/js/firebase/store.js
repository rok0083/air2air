/* =========================================================================
   프로필 동기화 — users/{uid}
   · 변경 시 디바운스 후 저장(updatedAt = serverTimestamp)
   · 오프라인이면 localStorage 대기열에 넣었다가 복구되면 재전송
   ========================================================================= */
import { CFG } from '../config.js';
import { getFirebase } from './config.js';

const QUEUE_KEY = 'hexaKingdom.syncQueue.v1';
let timer = null;
let ctx = null;

export async function initStore() {
  ctx = await getFirebase();
  return !!ctx;
}

export function storeReady() { return !!ctx?.db; }

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-30))); } catch { /* ignore */ }
}

/* 원격에서 내 문서 읽기 */
export async function pullProfile(uid) {
  if (!ctx?.db || !uid) return null;
  const { fsMod, db } = ctx;
  try {
    const snap = await fsMod.getDoc(fsMod.doc(db, CFG.firebase.collectionUsers, uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('[hexa-kingdom] 프로필 불러오기 실패', err?.code || err);
    return null;
  }
}

async function flushOne(uid, docData) {
  const { fsMod, db } = ctx;
  await fsMod.setDoc(
    fsMod.doc(db, CFG.firebase.collectionUsers, uid),
    { ...docData, updatedAt: fsMod.serverTimestamp() },
    { merge: true },
  );
}

/* 디바운스 저장 */
export function queueSave(profile, delay = CFG.firebase.syncDebounceMs) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { saveNow(profile); }, delay);
}

export async function saveNow(profile) {
  if (!profile?.uid) return false;
  if (!ctx?.db) {
    const q = readQueue();
    q.push({ uid: profile.uid, doc: profile.remoteDoc(), at: Date.now() });
    writeQueue(q);
    return false;
  }
  const doc = profile.remoteDoc();
  try {
    await flushOne(profile.uid, doc);
    await flushQueue();
    return true;
  } catch (err) {
    console.warn('[hexa-kingdom] 프로필 저장 실패 — 대기열에 보관', err?.code || err);
    const q = readQueue();
    q.push({ uid: profile.uid, doc, at: Date.now() });
    writeQueue(q);
    return false;
  }
}

export async function flushQueue() {
  if (!ctx?.db) return;
  const q = readQueue();
  if (!q.length) return;
  const rest = [];
  for (const item of q) {
    try { await flushOne(item.uid, item.doc); }
    catch { rest.push(item); }
  }
  writeQueue(rest);
}

/* 닉네임 변경 — 설정에서만 호출 */
export async function renameUser(profile, name) {
  profile.name = name;
  profile.save();
  return saveNow(profile);
}

/* 테스트/검증용 문서 삭제(본인 문서만) */
export async function deleteMyDocs(uid) {
  if (!ctx?.db || !uid) return false;
  const { fsMod, db } = ctx;
  try {
    await fsMod.deleteDoc(fsMod.doc(db, CFG.firebase.collectionUsers, uid));
    return true;
  } catch { return false; }
}
