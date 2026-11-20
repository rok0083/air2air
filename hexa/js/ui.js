/* =========================================================================
   헥사 블리츠 — 화면 · 입력 · 진행
   2분(120초) 타이머, 부스터, 라스트 허라, 게임오버, 랭킹 연결
   ========================================================================= */

import { CFG, MODE, comboMultiplier } from './config.js';
import { Board } from './board.js';
import { ComboMeter } from './combos.js';
import { FX } from './effects.js';
import { Audio } from './audio.js';
import { Leaderboard } from './leaderboard.js';
import { FB } from './firebase.js';

const $ = sel => document.querySelector(sel);
const fmt = n => Number(n || 0).toLocaleString('ko-KR');
const fmtTime = ms => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

const LS = { name: 'hexaBlitz.name', room: 'hexaBlitz.room', mute: 'hexaBlitz.mute' };

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
  hudCombo: $('#hud-combo'),
  hudMult: $('#hud-mult'),
  timeFill: $('#time-fill'),
  timeText: $('#time-text'),
  feverFill: $('#fever-fill'),
  feverText: $('#fever-text'),
  boosters: $('#boosters'),
  board: $('#board'),
  banner: $('#banner'),
  pauseOverlay: $('#pause-overlay'),
  btnPause: $('#btn-pause'),
  btnResume: $('#btn-resume'),
  btnQuit: $('#btn-quit'),
  btnQuit2: $('#btn-quit2'),
  overScore: $('#over-score'),
  overRank: $('#over-rank'),
  overCombo: $('#over-combo'),
  overSpecials: $('#over-specials'),
  overCombos: $('#over-combos'),
  overHurrah: $('#over-hurrah'),
  overMult: $('#over-mult'),
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

const audio = new Audio();
const fx = new FX();
const combos = new ComboMeter({
  audio,
  fx,
  onEvent: (type, data) => {
    if (type === 'fever') { banner('FEVER!', '8초간 점수 ×3', '#ff5fd2'); syncBoosters(); }
    if (type === 'blaze') { banner('BLAZING!', '점수 ×2 · 인접 폭발', '#ff9f43'); audio.play('blaze'); }
    if (type === 'feverSpend') syncBoosters();
    if (type === 'blazeEnd' || type === 'feverEnd') syncBoosters();
  },
});

let board = null;
let lb = null;
let currentName = '';
let currentRoom = '';
let currentScreen = 'start';
let rankReturn = 'start';
let playing = false;
let paused = false;
let finalizing = false;
let timeLeft = CFG.time.total;
let freezeUntil = 0;
let hurrahCount = 0;
let bestMult = 1;
let lastResult = null;
let pickMode = null;      // 'hammer' | 'colorBomb'
let selected = null;
let dragStart = null;
let lastTs = 0;
let hudAt = 0;
let lastTickSecond = -1;

/* ───────────────────────── 화면 ───────────────────────── */
function showScreen(name) {
  Object.entries(els.screens).forEach(([key, el]) => el.classList.toggle('active', key === name));
  currentScreen = name;
  document.body.classList.toggle('in-game', name === 'game');
  if (name === 'game') requestAnimationFrame(() => board && board.resize());
  if (name === 'rank' && lb) requestAnimationFrame(() => lb.show(lb.scope || 'global'));
}

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  els.toasts.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 1800);
  while (els.toasts.children.length > 3) els.toasts.firstElementChild.remove();
}

let bannerTimer = null;
function banner(text, sub = '', color = '#fff') {
  els.banner.innerHTML = `<b style="color:${color}">${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
  els.banner.classList.add('on');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => els.banner.classList.remove('on'), 1200);
}

/* ───────────────────────── 이름 / 방 코드 ───────────────────────── */
function validateName(raw) {
  const name = String(raw || '').replace(/\s+/g, '');
  if (name.length < CFG.name.min || name.length > CFG.name.max) {
    return { ok: false, msg: `닉네임은 ${CFG.name.min}~${CFG.name.max}자로 입력해 주세요.` };
  }
  if (!/^[가-힣a-zA-Z0-9]+$/.test(name)) return { ok: false, msg: '한글·영문·숫자만 사용할 수 있어요.' };
  const lower = name.toLowerCase();
  if (CFG.name.banned.some(w => lower.includes(w.toLowerCase()))) {
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

/* ───────────────────────── HUD ───────────────────────── */
function updateHud(force = false) {
  const now = performance.now();
  if (!force && now - hudAt < 70) return;
  hudAt = now;
  els.hudScore.textContent = fmt(board ? board.score : 0);
  els.hudCombo.textContent = combos.combo > 1 ? `${combos.combo} COMBO` : (combos.combo || 0);
  els.hudMult.textContent = '×' + combos.multiplier().toFixed(1);
  const ratio = Math.max(0, Math.min(1, timeLeft / CFG.time.total));
  els.timeFill.style.width = (ratio * 100).toFixed(1) + '%';
  els.timeFill.classList.toggle('low', timeLeft <= CFG.time.warnAt);
  els.timeText.textContent = fmtTime(timeLeft);
  const fever = combos.feverGauge / CFG.fever.max;
  els.feverFill.style.width = (fever * 100).toFixed(1) + '%';
  els.feverFill.classList.toggle('active', combos.isFever());
  els.feverText.textContent = combos.isFever() ? 'FEVER!' : Math.round(fever * 100) + '%';
  els.hudCombo.classList.toggle('hot', combos.combo >= 5);
  if (combos.multiplier() > bestMult) bestMult = combos.multiplier();
  syncBoosters();
}

function buildBoosters() {
  els.boosters.innerHTML = '';
  Object.entries(CFG.boosters).forEach(([key, b]) => {
    if (!b.cost) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'booster';
    btn.dataset.key = key;
    btn.innerHTML = `<i>${b.icon}</i><span>${b.name}</span><em>${b.cost}</em>`;
    btn.title = `${b.name} — ${b.desc} (피버 ${b.cost} 소모)`;
    btn.addEventListener('click', () => useBooster(key));
    els.boosters.appendChild(btn);
  });
}

function syncBoosters() {
  if (!els.boosters.children.length) return;
  const gauge = combos.feverGauge;
  [...els.boosters.children].forEach(btn => {
    const b = CFG.boosters[btn.dataset.key];
    const ready = !combos.isFever() && gauge >= b.cost && playing;
    btn.classList.toggle('ready', ready);
    btn.disabled = !ready;
    btn.classList.toggle('armed', pickMode === btn.dataset.key);
  });
}

/* ───────────────────────── 부스터 ───────────────────────── */
async function useBooster(key) {
  if (!playing || paused || finalizing) return;
  const b = CFG.boosters[key];
  if (!b) return;
  if (combos.isFever()) { toast('피버 중에는 부스터를 쓸 수 없어요', 'warn'); return; }
  if (combos.feverGauge < b.cost) { toast(`피버 게이지가 부족해요 (${b.cost} 필요)`, 'warn'); audio.play('invalid'); return; }

  if (key === 'hammer' || key === 'colorBomb') {
    pickMode = key;
    selected = null;
    board.selected = null;
    toast(key === 'hammer' ? '🔨 파괴할 보석을 선택하세요' : '💥 색을 지정할 보석을 선택하세요', 'info');
    syncBoosters();
    return;
  }

  if (!combos.spendFever(b.cost)) return;
  audio.play('booster');
  if (key === 'shuffle') {
    toast('🔀 보드 셔플!', 'good');
    board.busy = true;
    await board.shuffle();
    board.releaseLock();
  } else if (key === 'freeze') {
    freezeUntil = performance.now() + CFG.boosters.freezeMs;
    banner('TIME FREEZE', '4초간 타이머 정지', '#93c5fd');
    audio.play('time');
  }
  updateHud(true);
}

async function resolvePick(r, c) {
  const key = pickMode;
  pickMode = null;
  if (!combos.spendFever(CFG.boosters[key].cost)) { syncBoosters(); return; }
  audio.play('booster');
  board.busy = true;
  if (key === 'hammer') {
    await board.destroyCell(r, c);
  } else if (key === 'colorBomb') {
    const gem = board.gemAt(r, c);
    if (gem && !gem.wild) await board.colorBomb(gem.color);
  }
  board.releaseLock();
  updateHud(true);
  syncBoosters();
}

/* ───────────────────────── 게임 진행 ───────────────────────── */
function startGame() {
  const check = validateName(els.inputName.value);
  if (!check.ok) { setStartMsg(check.msg, true); els.inputName.focus(); return; }
  const room = normalizeRoom(els.inputRoom.value);
  if (els.inputRoom.value && room.length !== 6) {
    setStartMsg('방 코드는 6자리(영대문자+숫자)입니다.', true);
    els.inputRoom.focus();
    return;
  }
  currentName = check.name;
  currentRoom = room;
  try {
    localStorage.setItem(LS.name, currentName);
    if (room) localStorage.setItem(LS.room, room); else localStorage.removeItem(LS.room);
  } catch (e) { /* 무시 */ }

  setStartMsg('');
  audio.resume();
  audio.startMusic();
  fx.reset();
  combos.reset();
  board.reset();
  board.resize();

  timeLeft = CFG.time.total;
  freezeUntil = 0;
  hurrahCount = 0;
  bestMult = 1;
  finalizing = false;
  playing = true;
  paused = false;
  pickMode = null;
  selected = null;
  board.selected = null;
  board.lastMoveAt = performance.now();
  els.pauseOverlay.hidden = true;
  els.btnPause.textContent = '⏸';
  showScreen('game');
  updateHud(true);
  syncUrlRoom(room);
  banner('START!', '2분 블리츠', '#7dd3fc');
}

function syncUrlRoom(room) {
  try {
    const url = new URL(location.href);
    if (room) url.searchParams.set('room', room); else url.searchParams.delete('room');
    history.replaceState(null, '', url.toString());
  } catch (e) { /* 무시 */ }
}

function togglePause(force) {
  if (!playing || finalizing) return;
  const toPause = typeof force === 'boolean' ? force : !paused;
  paused = toPause;
  els.pauseOverlay.hidden = !toPause;
  els.btnPause.textContent = toPause ? '▶' : '⏸';
}

function quitGame() {
  playing = false;
  finalizing = false;
  paused = false;
  pickMode = null;
  els.pauseOverlay.hidden = true;
  audio.stopMusic();
  showScreen('start');
}

async function startLastHurrah() {
  if (finalizing) return;
  finalizing = true;
  playing = false;
  pickMode = null;
  board.busy = true;
  audio.play('nova');
  banner('LAST HURRAH!', '남은 특수 보석 전부 발동', '#ffd23d');
  fx.flash(0.4);

  const specials = board.specialCells();
  hurrahCount = 0;
  for (const s of specials) {
    const gem = board.gemAt(s.r, s.c);
    if (!gem || !gem.special) continue;
    hurrahCount++;
    board.addScore(CFG.score.lastHurrahPerSpecial);
    const pos = board.cellCenter(s.r, s.c);
    fx.text(pos.x, pos.y, `+${CFG.score.lastHurrahPerSpecial}`, '#ffe9a8', 18);
    await board.clearCells([s], { source: 'hurrah' });
    await board.delay(110);
  }
  board.applyGravity();
  board.refill();
  await board.delay(160);
  await board.resolveMatches();
  board.busy = false;
  await board.delay(220);
  finishGame();
}

async function finishGame() {
  audio.stopMusic();
  audio.play('over');
  const result = {
    name: currentName,
    score: board.score,
    maxCombo: combos.maxCombo,
    specialsCreated: combos.specialsCreated,
    combosTriggered: combos.combosTriggered,
    hurrah: hurrahCount,
    bestMult,
    roomCode: currentRoom || 'global',
    mode: MODE,
  };
  lastResult = result;

  els.overScore.textContent = fmt(result.score);
  els.overCombo.textContent = result.maxCombo;
  els.overSpecials.textContent = result.specialsCreated;
  els.overCombos.textContent = result.combosTriggered;
  els.overHurrah.textContent = result.hurrah;
  els.overMult.textContent = '×' + result.bestMult.toFixed(1);
  els.overRoom.textContent = result.roomCode === 'global' ? '전체' : result.roomCode;
  els.overRank.textContent = '';
  els.overSave.textContent = '기록 저장 중…';
  els.overSave.classList.remove('bad');
  showScreen('over');

  if (!(result.score > 0)) {
    els.overSave.textContent = '0점은 랭킹에 올리지 않았어요. 다시 도전!';
    els.overRank.textContent = '보석을 3개 이상 맞춰 점수를 만들어 보세요';
    return;
  }
  const res = await FB.saveScore(result);
  if (res.ok) els.overSave.textContent = '기록을 저장했어요! 랭킹에서 확인해 보세요.';
  else if (res.reason === 'disabled') els.overSave.textContent = '이 기기에만 기록됩니다 (랭킹 서버 미설정)';
  else els.overSave.textContent = '오프라인 상태예요. 연결되면 자동으로 저장됩니다.';

  const rank = await FB.rankOf(result.score);
  els.overRank.textContent = rank
    ? `전체 ${fmt(rank)}위 · ${result.maxCombo}콤보 · 특수 ${result.specialsCreated}개`
    : `최고 ${result.maxCombo}콤보 · 특수 보석 ${result.specialsCreated}개`;
}

async function shareResult() {
  const url = new URL(location.href);
  const room = (lastResult && lastResult.roomCode !== 'global') ? lastResult.roomCode : currentRoom;
  if (room) url.searchParams.set('room', room); else url.searchParams.delete('room');
  const score = lastResult ? lastResult.score : 0;
  const text = `헥사 블리츠 2분에서 ${fmt(score)}점! 나보다 높으면 도전해 봐 🎮`;
  if (navigator.share) {
    try { await navigator.share({ title: '헥사 블리츠 HEXA BLITZ', text, url: url.toString() }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url.toString()}`);
    toast('공유 링크를 복사했어요!', 'good');
  } catch (e) {
    toast(url.toString());
  }
}

function openRank(from = 'start', scope = null) {
  rankReturn = from;
  const room = currentRoom || normalizeRoom(els.inputRoom.value);
  els.rankRoom.textContent = room ? `방 ${room}` : '전체';
  if (lb) lb.scope = scope || (room ? 'room' : 'global');
  showScreen('rank');
}

/* ───────────────────────── 입력 ───────────────────────── */
function bindInput() {
  const canvas = els.board;
  const toCell = (e) => {
    const rect = canvas.getBoundingClientRect();
    return board.cellFromPoint(e.clientX - rect.left, e.clientY - rect.top);
  };

  canvas.addEventListener('pointerdown', e => {
    if (!playing || paused || finalizing) return;
    const cell = toCell(e);
    if (!cell) return;
    audio.resume();
    if (pickMode) { resolvePick(cell.r, cell.c); return; }
    dragStart = { ...cell, x: e.clientX, y: e.clientY, moved: false };
    board.lastMoveAt = performance.now();
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.hypot(dx, dy) > CFG.input.dragThreshold) dragStart.moved = true;
  });

  canvas.addEventListener('pointerup', e => {
    if (!dragStart || !playing || paused || finalizing) { dragStart = null; return; }
    const start = dragStart;
    dragStart = null;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);

    if (dist >= CFG.input.dragThreshold) {
      let dr = 0, dc = 0;
      if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1;
      else dr = dy > 0 ? 1 : -1;
      const target = { r: start.r + dr, c: start.c + dc };
      if (target.r >= 0 && target.r < board.rows && target.c >= 0 && target.c < board.cols) {
        selected = null;
        board.selected = null;
        board.trySwap(start.r, start.c, target.r, target.c);
      }
      return;
    }

    // 탭: 선택 / 인접 교체
    if (selected && selected.r === start.r && selected.c === start.c) {
      selected = null;
      board.selected = null;
      return;
    }
    if (selected && Math.abs(selected.r - start.r) + Math.abs(selected.c - start.c) === 1) {
      const from = selected;
      selected = null;
      board.selected = null;
      board.trySwap(from.r, from.c, start.r, start.c);
      return;
    }
    selected = { r: start.r, c: start.c };
    board.selected = selected;
    audio.play('ui');
  });

  canvas.addEventListener('pointercancel', () => { dragStart = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

/* ───────────────────────── 메인 루프 ───────────────────────── */
function loop(ts) {
  const dt = Math.min(60, ts - (lastTs || ts));
  lastTs = ts;
  const now = performance.now();

  if (playing && !paused && !finalizing) {
    if (now >= freezeUntil) {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; startLastHurrah(); }
    }
    // 3초 무입력 → 힌트
    if (now - board.lastMoveAt > CFG.input.idleHintMs && !board.hintPair && !board.busy) {
      board.showHint();
    }
    // 유효 수 없음 → 자동 셔플 (0.7초에 한 번만 검사)
    if (!board.busy && now - board.lastMoveAt > 700 && now > (board._nextMoveCheck || 0)) {
      board._nextMoveCheck = now + 700;
      if (!board.findValidMove()) {
        board.ensurePlayable();
        banner('NO MOVES', '보드 자동 셔플', '#7dd3fc');
      }
    }
    // 남은 10초 이하 카운트다운 비프
    const sec = Math.ceil(timeLeft / 1000);
    if (timeLeft <= CFG.time.warnAt && sec !== lastTickSecond) {
      lastTickSecond = sec;
      audio.play('tick');
    }
    combos.update();
  }
  updateHud();
  requestAnimationFrame(loop);
}

/* ───────────────────────── 설정 복원 / 초기화 ───────────────────────── */
function restoreSettings() {
  try {
    els.inputName.value = localStorage.getItem(LS.name) || '';
    els.inputRoom.value = normalizeRoom(localStorage.getItem(LS.room) || '');
    const muted = localStorage.getItem(LS.mute) === '1';
    audio.setMuted(muted);
    els.btnSound.textContent = muted ? '🔇' : '🔊';
    els.btnSound.classList.toggle('muted', muted);
  } catch (e) { /* 무시 */ }
  const params = new URLSearchParams(location.search);
  const room = normalizeRoom(params.get('room') || '');
  if (room) els.inputRoom.value = room;
}

function bindButtons() {
  els.btnStart.addEventListener('click', () => { audio.play('ui'); startGame(); });
  els.btnRank.addEventListener('click', () => { audio.play('ui'); openRank('start'); });
  els.btnMakeRoom.addEventListener('click', () => {
    els.inputRoom.value = makeRoomCode();
    els.inputRoom.focus();
    audio.play('ui');
    toast('방 코드를 만들었어요. 친구에게 알려 주세요!', 'good');
  });
  els.inputRoom.addEventListener('input', () => { els.inputRoom.value = normalizeRoom(els.inputRoom.value); });
  els.inputName.addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });
  els.btnPause.addEventListener('click', () => togglePause());
  els.btnQuit.addEventListener('click', () => togglePause(true));
  els.btnResume.addEventListener('click', () => togglePause(false));
  els.btnQuit2.addEventListener('click', quitGame);
  els.btnAgain.addEventListener('click', () => { audio.play('ui'); startGame(); });
  els.btnOverRank.addEventListener('click', () => { audio.play('ui'); openRank('over'); });
  els.btnShare.addEventListener('click', () => { audio.play('ui'); shareResult(); });
  els.btnOverHome.addEventListener('click', () => showScreen('start'));
  els.btnRankBack.addEventListener('click', () => { audio.play('ui'); showScreen(rankReturn === 'over' ? 'over' : 'start'); });
  els.btnSound.addEventListener('click', () => {
    const muted = !audio.muted;
    audio.setMuted(muted);
    els.btnSound.textContent = muted ? '🔇' : '🔊';
    els.btnSound.classList.toggle('muted', muted);
    try { localStorage.setItem(LS.mute, muted ? '1' : '0'); } catch (e) { /* 무시 */ }
    if (!muted) { audio.play('ui'); if (playing) audio.startMusic(); }
  });
  window.addEventListener('resize', () => { board && board.resize(); });
  window.addEventListener('orientationchange', () => setTimeout(() => board && board.resize(), 220));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing && !paused) togglePause(true);
  });
  document.addEventListener('keydown', e => {
    if (currentScreen === 'start' && e.target === els.inputName) return;
    if (currentScreen === 'start' && e.key === 'Enter') { startGame(); return; }
    if (currentScreen === 'rank' && e.key === 'Escape') els.btnRankBack.click();
    if (currentScreen === 'game' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) togglePause();
  });
}

let inited = false;
function init() {
  if (inited) return;
  inited = true;
  restoreSettings();
  board = new Board({
    canvas: els.board,
    fx,
    audio,
    combos,
    hooks: {
      onScore: () => updateHud(),
      onTimeBonus: (ms) => {
        timeLeft = Math.max(0, Math.min(CFG.time.total + 20000, timeLeft + ms));
        updateHud(true);
      },
      onToast: toast,
    },
  });
  lb = new Leaderboard({
    tabsEl: els.rankTabs,
    listEl: els.rankList,
    statusEl: els.rankStatus,
    footEl: els.rankFoot,
    getRoom: () => currentRoom || normalizeRoom(els.inputRoom.value),
    getName: () => currentName || els.inputName.value,
  });
  buildBoosters();
  bindButtons();
  bindInput();
  updateHud(true);
  window.__hexa = { board, combos, fx, audio, CFG };
  requestAnimationFrame(loop);

  FB.init().then(status => {
    if (status && status.ready) console.info('[HEXA BLITZ] firebase ready');
    else console.info('[HEXA BLITZ] firebase not ready', status && status.error);
  }).catch(() => {});
  const unlock = () => { audio.resume(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock, { once: true });
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();
