/* =========================================================================
   익명 로그인 — 다른 로그인 UI 는 제공하지 않습니다.
   · 첫 실행: 닉네임 입력 → 익명 uid 생성 → users/{uid} 문서 저장
   · 이후 실행: 익명 세션이 자동 복원되어 바로 월드 지도로 진입
   ========================================================================= */
import { getFirebase } from './config.js';

let _ctx = null;
let _user = null;

export async function initAuth() {
  if (_ctx) return _ctx;
  const fb = await getFirebase();
  if (!fb) { _ctx = { online: false, uid: null, auth: null, db: null }; return _ctx; }
  const { auth, authMod, db } = fb;
  try {
    if (!auth.currentUser) {
      await authMod.signInAnonymously(auth);
    }
    _user = auth.currentUser;
    _ctx = { online: true, uid: _user?.uid || null, auth, db, fb };
  } catch (err) {
    console.warn('[hexa-kingdom] 익명 로그인 실패 — 로컬 모드로 동작합니다.', err?.code || err?.message || err);
    _ctx = { online: false, uid: null, auth: null, db: null, error: err?.code || 'auth-failed' };
  }
  return _ctx;
}

export function currentUser() { return _user; }
export function authContext() { return _ctx; }

/* 익명 세션이 준비될 때까지 최대 ms 대기 */
export async function waitForUser(ms = 6000) {
  const start = Date.now();
  let ctx = await initAuth();
  while (!ctx.uid && Date.now() - start < ms) {
    await new Promise(r => setTimeout(r, 200));
    if (ctx.auth?.currentUser) ctx.uid = ctx.auth.currentUser.uid;
  }
  return ctx;
}
