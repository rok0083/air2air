/* =========================================================================
   firebase/auth.js — 익명 로그인만 사용 (기기 단위 식별)
   ========================================================================= */
import { getFirebase, FB } from './config.js';

let initPromise = null;

export function initAuth() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const fb = await getFirebase();
    if (!fb) { FB.online = false; return FB; }
    const { auth } = fb;
    const authMod = fb.mod?.authMod;
    try {
      if (!auth.currentUser) await authMod.signInAnonymously(auth);
      FB.uid = auth.currentUser?.uid || null;
      FB.online = !!FB.uid;
      try { authMod.onAuthStateChanged(auth, u => { FB.uid = u?.uid || null; FB.online = !!u; }); } catch (e) { /* 구버전 SDK 무시 */ }
      return FB;
    } catch (err) {
      console.warn('[castle-pop] 익명 로그인 실패 — 로컬 모드', err?.code || err?.message);
      FB.online = false;
      return FB;
    }
  })();
  return initPromise;
}

export function currentUid() { return FB.uid; }
