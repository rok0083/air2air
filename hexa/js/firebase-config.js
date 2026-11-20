/* =========================================================================
   Firebase 웹 앱 설정 — 헥사 블리츠
   프로젝트: samsung-brick-breaker (Spark)
   Firestore: asia-southeast1 (Singapore) · Anonymous Auth · Web App "hexa-game"

   ▶ 다른 프로젝트에서 쓰려면 아래 값을 그 프로젝트의 웹 앱 설정으로 바꾸면 됩니다.
     (값이 비어 있거나 YOUR_ 로 시작하면 랭킹 없이 로컬 전용으로 동작합니다.)
   ========================================================================= */

export const firebaseConfig = {
  apiKey: 'AIzaSyDa3IBi4cjEdpVG-8G-JVMPEIRY4nCjKoY',
  authDomain: 'samsung-brick-breaker.firebaseapp.com',
  databaseURL: 'https://samsung-brick-breaker-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'samsung-brick-breaker',
  storageBucket: 'samsung-brick-breaker.firebasestorage.app',
  messagingSenderId: '542816731452',
  appId: '1:542816731452:web:8b5936181e76a4f9c39e39',
};

/* 설정이 비어 있으면(플레이스홀더) 게임은 로컬 전용 모드로 동작합니다. */
export const FIREBASE_ENABLED =
  !!firebaseConfig.apiKey && !/YOUR_|placeholder|example/i.test(firebaseConfig.apiKey + firebaseConfig.projectId);
