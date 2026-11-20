/* =========================================================================
   헥사 블리츠 — Firebase (Firestore + 익명 로그인)
   scores 문서: uid, name, score, maxCombo, specialsCreated, combosTriggered, mode, roomCode, createdAt
   · 오프라인/저장 실패 시 localStorage 대기열에 보관 후 재전송
   ========================================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs,
  serverTimestamp, Timestamp, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, FIREBASE_ENABLED } from './firebase-config.js';
import { MODE } from './config.js';

const PENDING_KEY = 'hexaBlitz.pending.v1';
const MINE_KEY = 'hexaBlitz.mine.v1';
const SCORES = 'scores';

export const FB = {
  enabled: FIREBASE_ENABLED,
  ready: false,
  uid: null,
  error: null,
  app: null,
  auth: null,
  db: null,

  async init() {
    if (!this.enabled) { this.error = 'disabled'; return this.status(); }
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      try {
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        const cred = await signInAnonymously(this.auth);
        this.uid = cred.user.uid;
        this.ready = true;
        this.error = null;
        onAuthStateChanged(this.auth, user => {
          if (user) { this.uid = user.uid; this.ready = true; }
          else { this.uid = null; }
        });
        this.flushPending();
      } catch (e) {
        console.warn('[HEXA BLITZ] firebase init failed', e && e.code, e && e.message);
        this.error = (e && e.code) || 'init-failed';
        this.ready = false;
      }
      return this.status();
    })();
    return this._initPromise;
  },

  status() {
    return { enabled: this.enabled, ready: this.ready, uid: this.uid, error: this.error };
  },

  awaitUid(timeoutMs = 6000) {
    if (this.uid) return Promise.resolve(this.uid);
    return new Promise(resolve => {
      const started = Date.now();
      const tick = () => {
        if (this.uid) return resolve(this.uid);
        if (Date.now() - started > timeoutMs) return resolve(null);
        setTimeout(tick, 150);
      };
      tick();
    });
  },

  buildPayload(result, uid) {
    return {
      uid,
      name: String(result.name || '').slice(0, 12),
      score: Math.max(0, Math.min(5000000, Math.round(result.score || 0))),
      maxCombo: Math.max(0, Math.min(999, Math.round(result.maxCombo || 0))),
      specialsCreated: Math.max(0, Math.min(9999, Math.round(result.specialsCreated || 0))),
      combosTriggered: Math.max(0, Math.min(9999, Math.round(result.combosTriggered || 0))),
      mode: MODE,
      roomCode: (result.roomCode && result.roomCode !== 'global')
        ? String(result.roomCode).toUpperCase().slice(0, 6) : 'global',
    };
  },

  async saveScore(result) {
    if (!this.enabled) return { ok: false, queued: false, reason: 'disabled' };
    if (!this.ready) await this.init();
    const uid = await this.awaitUid();
    if (!uid || !this.db) {
      this.queuePending(result);
      return { ok: false, queued: true, reason: 'offline' };
    }
    try {
      const data = this.buildPayload(result, uid);
      const ref = await addDoc(collection(this.db, SCORES), { ...data, createdAt: serverTimestamp() });
      this.rememberMine(ref.id, data.score);
      return { ok: true, id: ref.id };
    } catch (e) {
      console.warn('[HEXA BLITZ] save failed', e && e.code, e && e.message);
      this.queuePending(result);
      return { ok: false, queued: true, reason: (e && e.code) || 'save-failed' };
    }
  },

  readPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch (e) { return []; }
  },

  queuePending(result) {
    try {
      const list = this.readPending();
      list.push({ ...result, queuedAt: Date.now() });
      localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-20)));
    } catch (e) { /* 무시 */ }
  },

  async flushPending() {
    const list = this.readPending();
    if (!list.length) return 0;
    const uid = await this.awaitUid();
    if (!uid || !this.db) return 0;
    let sent = 0;
    const remain = [];
    for (const item of list) {
      try {
        const data = this.buildPayload(item, uid);
        const ref = await addDoc(collection(this.db, SCORES), { ...data, createdAt: serverTimestamp() });
        this.rememberMine(ref.id, data.score);
        sent++;
      } catch (e) { remain.push(item); }
    }
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(remain)); } catch (e) { /* 무시 */ }
    return sent;
  },

  pendingCount() { return this.readPending().length; },

  readMine() {
    try { return JSON.parse(localStorage.getItem(MINE_KEY) || '[]'); } catch (e) { return []; }
  },

  rememberMine(id, score) {
    try {
      const list = this.readMine();
      list.push({ id, score, at: Date.now() });
      localStorage.setItem(MINE_KEY, JSON.stringify(list.slice(-20)));
    } catch (e) { /* 무시 */ }
  },

  myIds() { return new Set(this.readMine().map(m => m.id)); },

  async fetchTop(scope = 'global', roomCode = '') {
    if (!this.enabled) return { ok: false, reason: 'disabled', list: [] };
    if (!this.ready) await this.init();
    if (!this.db) return { ok: false, reason: this.error || 'offline', list: [] };
    if (this.pendingCount()) this.flushPending();
    const col = collection(this.db, SCORES);
    const n = 50;
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(dayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    let q;
    try {
      if (scope === 'today') {
        q = query(col, where('createdAt', '>=', Timestamp.fromDate(dayStart)), orderBy('score', 'desc'), limit(n));
      } else if (scope === 'week') {
        q = query(col, where('createdAt', '>=', Timestamp.fromDate(weekStart)), orderBy('score', 'desc'), limit(n));
      } else if (scope === 'room') {
        const code = String(roomCode || '').toUpperCase();
        if (!code) return { ok: true, list: [], reason: 'no-room' };
        q = query(col, where('roomCode', '==', code), orderBy('score', 'desc'), limit(n));
      } else {
        q = query(col, orderBy('score', 'desc'), limit(n));
      }
      const snap = await getDocs(q);
      const list = snap.docs.map((d, i) => {
        const data = d.data();
        return {
          rank: i + 1,
          id: d.id,
          name: data.name || '이름없음',
          score: data.score || 0,
          maxCombo: data.maxCombo || 0,
          specialsCreated: data.specialsCreated || 0,
          roomCode: data.roomCode || 'global',
          createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : null,
        };
      });
      return { ok: true, list };
    } catch (e) {
      console.warn('[HEXA BLITZ] fetch failed', e && e.code, e && e.message);
      return { ok: false, reason: (e && e.code) || 'fetch-failed', list: [] };
    }
  },

  async rankOf(score) {
    if (!this.enabled || !this.db || !(score > 0)) return null;
    try {
      const snap = await getCountFromServer(
        query(collection(this.db, SCORES), where('score', '>', Math.round(score))),
      );
      return snap.data().count + 1;
    } catch (e) {
      return null;
    }
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { FB.flushPending().catch(() => {}); });
  window.addEventListener('load', () => { FB.init().catch(() => {}); });
}
