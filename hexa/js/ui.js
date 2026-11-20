/* =========================================================================
   헥사(HEXA) — 화면 / 입력 / 게임 흐름
   ========================================================================= */

import { HexaGame } from './game.js';
import { Leaderboard } from './leaderboard.js';
import { FB } from './firebase.js';
import { SFX, GOOD_BY_ID } from './items.js';
import { CONFIG } from './config.js';

const $ = sel => document.querySelector(sel);
const fmt = n => Number(n || 0).toLocaleString('ko-KR');

const els = {
  screens: {
    start: $('#screen-start'),
    game: $('#screen-game'),
    over: $('#screen-over'),
    rank: $('#screen-rank'),
  },
  inputName: $('#input-name'),
  inputRoom: $('#input-room'),
  btnMakeRoom: $('#btn-make-room'),
  startMsg: $('#start-msg'),
  btnStart: $('#btn-start'),
  btnRank: $('#btn-rank'),
  hudScore: $('#hud-score'),
  hudLevel: $('#hud-level'),
  hudChain: $('#hud-chain'),
  hudRemain: $('#hud-remain'),
  feverFill: $('#fever-fill'),
  shieldTag: $('#shield-tag'),
  fxTags: $('#fx-tags'),
  itemSlots: $('#item-slots'),
  boardPanel: document.querySelector('.board-panel'),
  pauseOverlay: $('#pause-overlay'),
  btnPause: $('#btn-pause'),
  btnResume: $('#btn-resume'),
  btnQuit: $('#btn-quit'),
  btnHome: $('#btn-home'),
  board: $('#board'),
  next: $('#next'),
  overScore: $('#over-score'),
  overRank: $('#over-rank'),
  overLevel: $('#over-level'),
  overChain: $('#over-chain'),
  overGems: $('#over-gems'),
  overItems: $('#over-items'),
  overTime: $('#over-time'),
  overRoom: $('#over-room'),
  overSave: $('#over-save'),
  btnAgain: $('#btn-again'),
  btnOverRank: $('#btn-over-rank'),
  btnShare: $('#btn-share'),
  btnOverHome: $('#btn-over-home'),
  rankTabs: $('#rank-tabs'),
  rankList: $('#rank-list'),
  rankStatus: $('#rank-status'),
  rankFoot: $('#rank-foot'),
  rankRoom: $('#rank-room'),
  btnRankBack: $('#btn-rank-back'),
  toasts: $('#toasts'),
  btnSound: $('#btn-sound'),
};

const LS = {
  name: 'hexa.name',
  room: 'hexa.room',
  mute: 'hexa.mute',
};

let currentScreen = 'start';
let currentName = '';
let currentRoom = '';
let rankReturn = 'start';
let lastResult = null;
let game = null;
let lb = null;

/* ───────────────────────── 화면 전환 ───────────────────────── */
function showScreen(name) {
  Object.entries(els.screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
  currentScreen = name;
  if (name === 'game') requestAnimationFrame(() => game.resize());
  if (name === 'rank') requestAnimationFrame(() => lb && lb.show(lb.scope || 'global'));
}

/* ───────────────────────── 토스트 ───────────────────────── */
function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  els.toasts.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, 1900);
  while (els.toasts.children.length > 3) els.toasts.firstElementChild.remove();
}

/* ───────────────────────── 닉네임 / 방 코드 ───────────────────────── */
function validateName(raw) {
  const name = String(raw || '').replace(/\s+/g, '');
  if (name.length < CONFIG.name.min || name.length > CONFIG.name.max) {
    return { ok: false, msg: `닉네임은 ${CONFIG.name.min}~${CONFIG.name.max}자로 입력해 주세요.` };
  }
  if (!/^[가-힣a-zA-Z0-9]+$/.test(name)) {
    return { ok: false, msg: '한글·영문·숫자만 사용할 수 있어요.' };
  }
  const lower = name.toLowerCase();
  if (CONFIG.name.banned.some(word => lower.includes(word.toLowerCase()))) {
    return { ok: false, msg: '사용할 수 없는 단어가 포함되어 있어요.' };
  }
  return { ok: true, name };
}

function normalizeRoom(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function setStartMsg(text, bad = false) {
  els.startMsg.textContent = text || '';
  els.startMsg.classList.toggle('bad', !!bad);
}

/* ───────────────────────── HUD / 인벤토리 ───────────────────────── */
const FX_LABELS = {
  freeze: { text: '⏸ 정지', bad: false },
  slow: { text: '🐢 슬로우', bad: false },
  boost: { text: '🚀 ×2', bad: false },
  future: { text: '👁 NEXT5', bad: false },
  speedUp: { text: '⏩ 가속', bad: true },
  dark: { text: '🌑 어둠', bad: true },
  invert: { text: '🔄 반전', bad: true },
  confusion: { text: '🎭 색혼란', bad: true },
};

function renderHud(s) {
  els.hudScore.textContent = fmt(s.score);
  els.hudLevel.textContent = s.level;
  els.hudChain.textContent = s.chain > 0 ? `${s.chain}★` : '0';
  els.hudRemain.textContent = s.remaining;
  els.feverFill.style.width = Math.min(100, Math.round(s.fever * 100)) + '%';
  els.feverFill.style.filter = s.feverActive ? 'brightness(1.35)' : 'none';
  els.shieldTag.hidden = !s.shield;

  const tags = [];
  Object.entries(s.effects).forEach(([key, on]) => {
    if (!on) return;
    const fx = FX_LABELS[key];
    if (fx) tags.push(`<span class="fx-tag${fx.bad ? ' bad' : ''}">${fx.text}</span>`);
  });
  els.fxTags.innerHTML = tags.join('');
}

function renderInventory(ids) {
  els.itemSlots.innerHTML = '';
  for (let i = 0; i < CONFIG.items.inventory; i++) {
    const id = ids[i];
    const item = id ? GOOD_BY_ID[id] : null;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'item-slot ' + (item ? 'filled' : 'empty');
    if (item) {
      btn.innerHTML = `<span class="ico">${item.icon}</span><span class="nm">${item.name}</span><span class="key">${i + 1}</span>`;
      btn.title = `${item.name} — ${item.desc}`;
      btn.addEventListener('click', () => { SFX.resume(); game.useItem(i); });
    } else {
      btn.innerHTML = '빈 칸';
      btn.disabled = true;
    }
    els.itemSlots.appendChild(btn);
  }
}

/* ───────────────────────── 게임 흐름 ───────────────────────── */
function startGame() {
  const nameCheck = validateName(els.inputName.value);
  if (!nameCheck.ok) { setStartMsg(nameCheck.msg, true); els.inputName.focus(); return; }
  const room = normalizeRoom(els.inputRoom.value);
  if (els.inputRoom.value && room.length !== 6) {
    setStartMsg('방 코드는 6자리(영대문자+숫자)입니다.', true);
    els.inputRoom.focus();
    return;
  }
  currentName = nameCheck.name;
  currentRoom = room;
  try {
    localStorage.setItem(LS.name, currentName);
    if (room) localStorage.setItem(LS.room, room); else localStorage.removeItem(LS.room);
  } catch (e) { /* 무시 */ }
  setStartMsg('');
  SFX.resume();
  els.pauseOverlay.hidden = true;
  if (!game) createGame();
  showScreen('game');
  game.start({ name: currentName, roomCode: currentRoom || 'global' });
  syncUrlRoom(room);
}

function syncUrlRoom(room) {
  try {
    const url = new URL(location.href);
    if (room) url.searchParams.set('room', room); else url.searchParams.delete('room');
    history.replaceState(null, '', url.toString());
  } catch (e) { /* 무시 */ }
}

function togglePause(force) {
  if (!game || game.state === 'over' || game.state === 'idle') return;
  const toPause = typeof force === 'boolean' ? force : game.state === 'running';
  if (toPause) {
    game.pause();
    els.pauseOverlay.hidden = false;
    els.btnPause.textContent = '▶';
  } else {
    game.resume();
    els.pauseOverlay.hidden = true;
    els.btnPause.textContent = '⏸';
  }
}

function quitGame() {
  els.pauseOverlay.hidden = true;
  if (game) game.state = 'idle';
  els.btnPause.textContent = '⏸';
  showScreen('start');
}

async function handleGameOver(result) {
  lastResult = result;
  els.overScore.textContent = fmt(result.score);
  els.overLevel.textContent = result.level;
  els.overChain.textContent = result.maxChain;
  els.overGems.textContent = fmt(result.gems);
  els.overItems.textContent = result.itemsUsed;
  const mm = Math.floor(result.playTimeSec / 60);
  const ss = String(result.playTimeSec % 60).padStart(2, '0');
  els.overTime.textContent = `${mm}:${ss}`;
  els.overRoom.textContent = result.roomCode === 'global' ? '전체' : result.roomCode;
  els.overRank.textContent = '';
  els.overSave.textContent = '기록 저장 중…';
  els.overSave.classList.remove('bad');
  showScreen('over');

  if (!(result.score > 0)) {
    els.overSave.textContent = '0점은 랭킹에 올리지 않았어요. 다음엔 더 높은 점수에 도전!';
    els.overRank.textContent = '아직 점수가 없어요 · 보석을 3개 이상 맞춰 보세요';
    return;
  }

  const res = await FB.saveScore(result);
  if (res.ok) {
    els.overSave.textContent = '기록을 저장했어요! 랭킹에서 확인해 보세요.';
  } else if (res.reason === 'disabled') {
    els.overSave.textContent = '이 기기에만 기록됩니다 (랭킹 서버 미설정)';
  } else {
    els.overSave.textContent = '오프라인 상태예요. 연결되면 자동으로 저장됩니다.';
  }

  const rank = await FB.rankOf(result.score);
  if (rank) {
    els.overRank.textContent = `전체 ${fmt(rank)}위 · 최고 ${result.maxChain}연쇄`;
  } else {
    els.overRank.textContent = `최고 ${result.maxChain}연쇄 · ${result.level}레벨 달성!`;
  }
}

function openRank(from = 'start', scope = null) {
  rankReturn = from;
  const room = currentRoom || normalizeRoom(els.inputRoom.value);
  els.rankRoom.textContent = room ? `방 ${room}` : '전체';
  const target = scope || (room ? 'room' : 'global');
  if (lb) lb.scope = target;
  showScreen('rank');
}

async function shareResult() {
  const url = new URL(location.href);
  const room = (lastResult && lastResult.roomCode && lastResult.roomCode !== 'global')
    ? lastResult.roomCode : currentRoom;
  if (room) url.searchParams.set('room', room); else url.searchParams.delete('room');
  const score = lastResult ? lastResult.score : 0;
  const text = `헥사(HEXA)에서 ${fmt(score)}점! 나보다 높으면 도전해 봐 🎮`;
  const shareData = { title: '헥사 HEXA', text, url: url.toString() };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url.toString()}`);
    toast('공유 링크를 복사했어요!', 'good');
  } catch (e) {
    toast(url.toString(), '');
  }
}

/* ───────────────────────── 입력 ───────────────────────── */
function bindKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target && /input|textarea/i.test(e.target.tagName)) {
      if (e.key === 'Enter' && currentScreen === 'start') { e.preventDefault(); startGame(); }
      return;
    }
    if (currentScreen === 'start' && e.key === 'Enter') { startGame(); return; }
    if (currentScreen !== 'game' || !game) {
      if (currentScreen === 'rank' && e.key === 'Escape') els.btnRankBack.click();
      return;
    }
    switch (e.key) {
      case 'ArrowLeft': game.move(-1); e.preventDefault(); break;
      case 'ArrowRight': game.move(1); e.preventDefault(); break;
      case 'ArrowUp': case ' ': game.rotate(); e.preventDefault(); break;
      case 'ArrowDown': game.softDrop(); e.preventDefault(); break;
      case 'Shift': game.hardDrop(); e.preventDefault(); break;
      case '1': case '2': case '3': game.useItem(Number(e.key) - 1); break;
      case 'p': case 'P': case 'Escape': togglePause(); break;
      default: break;
    }
  });
}

function bindTouch() {
  let start = null;
  const panel = els.boardPanel;
  const reset = () => { start = null; };
  panel.addEventListener('pointerdown', e => {
    start = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  panel.addEventListener('pointercancel', reset);
  panel.addEventListener('pointerup', e => {
    if (!start || !game || game.state !== 'running') { reset(); return; }
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = performance.now() - start.t;
    const dist = Math.hypot(dx, dy);
    reset();
    if (game.pickMode) return;
    if (dt < 500 && dist < 16) { game.rotate(); return; }
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 16) {
      const steps = Math.min(5, Math.max(1, Math.round(Math.abs(dx) / 26)));
      for (let i = 0; i < steps; i++) game.move(dx > 0 ? 1 : -1);
      return;
    }
    if (dy > 28) { game.hardDrop(); return; }
    if (dy < -28) { game.rotate(); }
  });
  panel.addEventListener('contextmenu', e => e.preventDefault());
}

/* ───────────────────────── 초기화 ───────────────────────── */
function createGame() {
  game = new HexaGame({
    boardCanvas: els.board,
    nextCanvas: els.next,
    hooks: {
      onHud: renderHud,
      onInventory: renderInventory,
      onGameOver: handleGameOver,
      onToast: toast,
    },
  });
  window.__hexa = game; // 검증/디버그용 핸들
}

function bindButtons() {
  els.btnStart.addEventListener('click', () => { SFX.play('ui'); startGame(); });
  els.btnRank.addEventListener('click', () => { SFX.play('ui'); openRank('start'); });
  els.btnMakeRoom.addEventListener('click', () => {
    els.inputRoom.value = makeRoomCode();
    els.inputRoom.focus();
    SFX.play('ui');
    toast('방 코드를 만들었어요. 친구에게 알려 주세요!', 'good');
  });
  els.inputRoom.addEventListener('input', () => {
    els.inputRoom.value = normalizeRoom(els.inputRoom.value);
  });
  els.btnPause.addEventListener('click', () => togglePause());
  els.btnHome.addEventListener('click', () => togglePause(true));
  els.btnResume.addEventListener('click', () => togglePause(false));
  els.btnQuit.addEventListener('click', quitGame);
  els.btnAgain.addEventListener('click', () => { SFX.play('ui'); startGame(); });
  els.btnOverRank.addEventListener('click', () => { SFX.play('ui'); openRank('over'); });
  els.btnShare.addEventListener('click', () => { SFX.play('ui'); shareResult(); });
  els.btnOverHome.addEventListener('click', () => showScreen('start'));
  els.btnRankBack.addEventListener('click', () => { SFX.play('ui'); showScreen(rankReturn === 'over' ? 'over' : 'start'); });
  els.btnSound.addEventListener('click', () => {
    const muted = !SFX.muted;
    SFX.mute(muted);
    els.btnSound.textContent = muted ? '🔇' : '🔊';
    els.btnSound.classList.toggle('muted', muted);
    try { localStorage.setItem(LS.mute, muted ? '1' : '0'); } catch (e) { /* 무시 */ }
    if (!muted) SFX.play('ui');
  });
  window.addEventListener('resize', () => { if (game) game.resize(); });
  window.addEventListener('orientationchange', () => setTimeout(() => game && game.resize(), 220));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game && game.state === 'running') togglePause(true);
  });
}

function restoreSettings() {
  try {
    els.inputName.value = localStorage.getItem(LS.name) || '';
    els.inputRoom.value = normalizeRoom(localStorage.getItem(LS.room) || '');
    const muted = localStorage.getItem(LS.mute) === '1';
    SFX.mute(muted);
    els.btnSound.textContent = muted ? '🔇' : '🔊';
    els.btnSound.classList.toggle('muted', muted);
  } catch (e) { /* 무시 */ }
  const params = new URLSearchParams(location.search);
  const room = normalizeRoom(params.get('room') || '');
  if (room) els.inputRoom.value = room;
  const nameParam = params.get('name');
  if (nameParam && !els.inputName.value) els.inputName.value = nameParam.slice(0, 12);
}

let inited = false;
function init() {
  if (inited) return;
  inited = true;
  restoreSettings();
  createGame();
  bindButtons();
  bindKeyboard();
  bindTouch();
  renderInventory([]);
  renderHud({ score: 0, level: 1, chain: 0, remaining: CONFIG.levels.gemsPerLevel, fever: 0, feverActive: false, shield: false, effects: {} });
  lb = new Leaderboard({
    tabsEl: els.rankTabs,
    listEl: els.rankList,
    statusEl: els.rankStatus,
    footEl: els.rankFoot,
    getRoom: () => currentRoom || normalizeRoom(els.inputRoom.value),
    getName: () => currentName || els.inputName.value,
  });
  FB.init().then(status => {
    if (status && status.ready) console.info('[HEXA] firebase ready', status.uid);
    else console.info('[HEXA] firebase not ready', status && status.error);
  }).catch(() => {});
  // 첫 사용자 제스처에서 오디오 컨텍스트 활성화
  const unlock = () => { SFX.resume(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock, { once: true });
  game.resize();
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();