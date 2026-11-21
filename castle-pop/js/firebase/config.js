/* =========================================================================
   firebase/config.js — v10 모듈러 SDK 동적 로드
   프로젝트: samsung-brick-breaker (기존 hexa / hexa-kingdom 과 같은 프로젝트)
   Castle Pop 은 cp_ 접두사 컬렉션만 사용한다.
   네트워크·설정 문제가 있으면 게임은 로컬 모드로 계속 동작한다.
   ========================================================================= */
import { CFG } from '../config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

let promise = null;

export const FB = {
  ready: false,
  online: false,
  uid: null,
  db: null,
  auth: null,
  mod: null,
};

export function firebaseEnabled() {
  return CFG.firebase.enabled && !!CFG.firebase.config.apiKey;
}

export function getFirebase() {
  if (!firebaseEnabled()) return Promise.resolve(null);
  if (promise) return promise;
  promise = (async () => {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const app = appMod.initializeApp(CFG.firebase.config);
    const auth = authMod.getAuth(app);
    const db = fsMod.getFirestore(app);
    FB.ready = true;
    FB.db = db;
    FB.auth = auth;
    FB.mod = { appMod, authMod, fsMod };
    return FB;
  })().catch(err => {
    console.warn('[castle-pop] Firebase 초기화 실패 — 로컬 모드로 동작합니다', err?.message || err);
    return null;
  });
  return promise;
}
