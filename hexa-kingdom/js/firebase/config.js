/* =========================================================================
   Firebase 초기화 — v10 모듈러 SDK(CDN ESM)를 동적으로 불러옵니다.
   네트워크/설정 문제로 실패하면 게임은 로컬 전용 모드로 계속 동작합니다.
   프로젝트: samsung-brick-breaker (기존 hexa 블리츠와 같은 프로젝트, 다른 컬렉션)
   ========================================================================= */
import { CFG } from '../config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
let _promise = null;

export const FIREBASE_ENABLED = CFG.firebase.enabled && !!CFG.firebase.config.apiKey;

export async function getFirebase() {
  if (!FIREBASE_ENABLED) return null;
  if (_promise) return _promise;
  _promise = (async () => {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const app = appMod.initializeApp(CFG.firebase.config);
    const auth = authMod.getAuth(app);
    const db = fsMod.getFirestore(app);
    return { app, auth, db, authMod, fsMod, appMod };
  })().catch(err => {
    console.warn('[hexa-kingdom] Firebase 초기화 실패 — 로컬 모드로 동작합니다.', err);
    return null;
  });
  return _promise;
}
