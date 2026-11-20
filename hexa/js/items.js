/* =========================================================================
   헥사(HEXA) — 아이템 정의 / 발동 효과 / 효과음
   좋은 아이템 17종, 방해 아이템 7종. 각 아이템은 고유 아이콘·색·연출·효과음을 가집니다.
   (아이템 확률·가중치는 js/config.js 의 CONFIG.items.weights)
   ========================================================================= */

import { CONFIG, COLORS, COLOR_KEYS } from './config.js';

/* =========================================================================
   효과음 — Web Audio API 로 직접 합성 (외부 파일 없음)
   ========================================================================= */
export const SFX = {
  ctx: null,
  master: null,
  muted: false,
  volume: 0.32,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },

  mute(on) {
    this.muted = !!on;
    this.init();
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  },

  tone({ freq = 440, to = null, type = 'sine', dur = 0.15, gain = 0.14, delay = 0, attack = 0.005 }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },

  noise({ dur = 0.2, gain = 0.12, freq = 1200, q = 1, type = 'bandpass', delay = 0 }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  play(name, arg) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const A = (delay = 0) => delay;
    switch (name) {
      case 'move':
        this.tone({ freq: 540, to: 620, type: 'square', dur: 0.045, gain: 0.05 });
        break;
      case 'rotate':
        this.tone({ freq: 680, to: 880, type: 'triangle', dur: 0.07, gain: 0.08 });
        break;
      case 'drop':
        this.tone({ freq: 240, to: 120, type: 'sine', dur: 0.1, gain: 0.1 });
        this.noise({ dur: 0.06, gain: 0.05, freq: 900 });
        break;
      case 'lock':
        this.tone({ freq: 170, to: 130, type: 'sine', dur: 0.09, gain: 0.09 });
        break;
      case 'clear': {
        const chain = Math.max(1, arg || 1);
        const base = 520 * Math.pow(1.13, chain - 1);
        this.tone({ freq: base, to: base * 1.6, type: 'triangle', dur: 0.12, gain: 0.12 });
        this.tone({ freq: base * 1.5, to: base * 2.1, type: 'sine', dur: 0.16, gain: 0.07, delay: 0.05 });
        this.noise({ dur: 0.14, gain: 0.05, freq: 2600, q: 0.8 });
        break;
      }
      case 'item':
        this.tone({ freq: 660, type: 'triangle', dur: 0.09, gain: 0.11 });
        this.tone({ freq: 880, type: 'triangle', dur: 0.09, gain: 0.1, delay: 0.07 });
        this.tone({ freq: 1180, type: 'sine', dur: 0.14, gain: 0.09, delay: 0.14 });
        break;
      case 'obstacle':
        this.tone({ freq: 240, to: 90, type: 'sawtooth', dur: 0.4, gain: 0.12 });
        this.noise({ dur: 0.3, gain: 0.07, freq: 400, type: 'lowpass' });
        break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone({ freq: f, type: 'triangle', dur: 0.18, gain: 0.11, delay: A(i * 0.09) }));
        break;
      case 'fever':
        this.tone({ freq: 300, to: 1400, type: 'sawtooth', dur: 0.7, gain: 0.1 });
        this.tone({ freq: 600, to: 2000, type: 'sine', dur: 0.7, gain: 0.07, delay: 0.05 });
        break;
      case 'gameover':
        [440, 392, 330, 247, 165].forEach((f, i) =>
          this.tone({ freq: f, type: 'triangle', dur: 0.32, gain: 0.12, delay: A(i * 0.14) }));
        break;
      case 'ui':
        this.tone({ freq: 760, type: 'square', dur: 0.04, gain: 0.05 });
        break;
      case 'shield':
        this.tone({ freq: 900, to: 1400, type: 'sine', dur: 0.4, gain: 0.12 });
        this.noise({ dur: 0.3, gain: 0.06, freq: 3000 });
        break;
      case 'laser':
        this.tone({ freq: 1500, to: 280, type: 'sawtooth', dur: 0.22, gain: 0.11 });
        this.noise({ dur: 0.18, gain: 0.06, freq: 2200 });
        break;
      case 'bomb':
        this.noise({ dur: 0.45, gain: 0.16, freq: 220, type: 'lowpass' });
        this.tone({ freq: 120, to: 45, type: 'sine', dur: 0.45, gain: 0.13 });
        break;
      case 'lightning':
        this.noise({ dur: 0.18, gain: 0.13, freq: 4200, type: 'highpass' });
        this.tone({ freq: 1400, to: 500, type: 'square', dur: 0.16, gain: 0.08 });
        break;
      case 'hammer':
        this.noise({ dur: 0.12, gain: 0.14, freq: 320, type: 'lowpass' });
        this.tone({ freq: 300, to: 150, type: 'square', dur: 0.1, gain: 0.08 });
        break;
      default:
        this.tone({ freq: 600, type: 'sine', dur: 0.08, gain: 0.07 });
    }
  },
};

/* =========================================================================
   공용 헬퍼
   ========================================================================= */
function weightedPick(weights) {
  const keys = Object.keys(weights);
  let total = 0;
  for (const k of keys) total += Math.max(0, weights[k] || 0);
  let r = Math.random() * total;
  for (const k of keys) {
    r -= Math.max(0, weights[k] || 0);
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

export function pickGoodItemId() {
  return weightedPick(CONFIG.items.weights);
}

export function pickObstacleId() {
  return weightedPick(CONFIG.obstacles.weights);
}

function randomInt(n) { return Math.floor(Math.random() * n); }

function allGemCells(g) {
  const out = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const cell = g.grid[r][c];
      if (cell && !cell.stone) out.push({ r, c });
    }
  }
  return out;
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mostCommonColor(g) {
  const count = {};
  for (const { r, c } of allGemCells(g)) {
    const cell = g.grid[r][c];
    if (cell.wild) continue;
    count[cell.color] = (count[cell.color] || 0) + 1;
  }
  let best = null, bestN = -1;
  for (const k in count) if (count[k] > bestN) { bestN = count[k]; best = k; }
  return best;
}

/* =========================================================================
   좋은 아이템 17종
   ========================================================================= */
export const GOOD_ITEMS = [
  {
    id: 'magic', name: '매직 보석', icon: '🔮', color: '#c084fc',
    desc: '착지 지점 아래 보석과 같은 색을 전부 제거',
    sfx: 'item',
    apply(g) {
      const a = g.anchor();
      let below = null;
      for (let r = a.r + 1; r < g.rows; r++) if (g.grid[r][a.c]) { below = g.grid[r][a.c].color; break; }
      const target = below || mostCommonColor(g);
      if (!target) { g.toast('제거할 보석이 없습니다', 'warn'); return; }
      const cells = allGemCells(g).filter(({ r, c }) => {
        const cell = g.grid[r][c];
        return !cell.wild && cell.color === target;
      });
      g.shake();
      g.removeCells(cells, { score: true, chain: 1, color: target });
      g.resolve({ chain: 2, delay: 220 });
    },
  },
  {
    id: 'bomb', name: '폭탄', icon: '💣', color: '#fb7185',
    desc: '착지 지점 3×3 제거',
    sfx: 'bomb',
    apply(g) {
      const a = g.anchor();
      g.shake();
      g.clearArea(a.r, a.c, 1);
      g.resolve({ chain: 2, delay: 260 });
    },
  },
  {
    id: 'hlaser', name: '가로 레이저', icon: '↔️', color: '#38bdf8',
    desc: '한 줄 전체 제거',
    sfx: 'laser',
    apply(g) {
      const a = g.anchor();
      g.shake();
      g.laserEffect('h', a.r);
      g.clearRow(a.r);
      g.resolve({ chain: 2, delay: 240 });
    },
  },
  {
    id: 'vlaser', name: '세로 레이저', icon: '↕️', color: '#22d3ee',
    desc: '한 열 전체 제거',
    sfx: 'laser',
    apply(g) {
      const a = g.anchor();
      g.shake();
      g.laserEffect('v', a.c);
      g.clearCol(a.c);
      g.resolve({ chain: 2, delay: 240 });
    },
  },
  {
    id: 'cross', name: '십자 폭발', icon: '✳️', color: '#fbbf24',
    desc: '가로 + 세로 동시 제거',
    sfx: 'bomb',
    apply(g) {
      const a = g.anchor();
      g.shake();
      g.laserEffect('h', a.r);
      g.laserEffect('v', a.c);
      g.clearRow(a.r);
      g.clearCol(a.c);
      g.resolve({ chain: 2, delay: 280 });
    },
  },
  {
    id: 'rainbow', name: '무지개 보석', icon: '🌈', color: '#f472b6',
    desc: '어떤 색과도 매치되는 와일드카드 보석 생성',
    sfx: 'item',
    apply(g) {
      const a = g.anchor();
      let target = null;
      for (let r = g.rows - 1; r >= 0; r--) if (!g.grid[r][a.c]) { target = { r, c: a.c }; break; }
      if (!target) { target = { r: Math.max(0, a.r), c: a.c }; }
      g.setCell(target.r, target.c, { color: 'rainbow', wild: true, lock: 0, born: g.now() });
      g.particlesAt(target.r, target.c, '#ffffff', 18);
      g.resolve({ chain: 2, delay: 320 });
    },
  },
  {
    id: 'lightning', name: '번개', icon: '⚡', color: '#facc15',
    desc: '무작위 보석 10개 제거',
    sfx: 'lightning',
    apply(g) {
      const cells = shuffleArray(allGemCells(g)).slice(0, 10);
      g.shake();
      g.lightningEffect(cells);
      g.removeCells(cells, { score: true, chain: 1 });
      g.resolve({ chain: 2, delay: 240 });
    },
  },
  {
    id: 'hammer', name: '망치', icon: '🔨', color: '#f97316',
    desc: '원하는 보석 1개를 골라 파괴',
    sfx: 'hammer',
    apply(g) {
      g.toast('파괴할 보석을 터치하세요', 'info');
      g.pickCell((r, c) => {
        g.shake();
        g.removeCells([{ r, c }], { score: true, chain: 1 });
        g.resolve({ chain: 2, delay: 200 });
      }, CONFIG.items.hammerTimeoutMs);
    },
  },
  {
    id: 'freeze', name: '시간 정지', icon: '⏸️', color: '#a5b4fc',
    desc: '5초간 낙하 정지',
    sfx: 'item',
    apply(g) { g.startEffect('freeze', CONFIG.effects.freezeMs); },
  },
  {
    id: 'slow', name: '슬로우', icon: '🐢', color: '#34d399',
    desc: '15초간 낙하 속도 절반',
    sfx: 'item',
    apply(g) { g.startEffect('slow', CONFIG.effects.slowMs); },
  },
  {
    id: 'colorchange', name: '컬러 체인저', icon: '🎨', color: '#e879f9',
    desc: '다음 블록을 모두 같은 색으로',
    sfx: 'item',
    apply(g) { g.makeNextPieceSameColor(); },
  },
  {
    id: 'magnet', name: '자석', icon: '🧲', color: '#60a5fa',
    desc: '지정 색 보석을 바닥으로 끌어모음',
    sfx: 'item',
    apply(g) {
      const target = mostCommonColor(g);
      if (!target || g.grid.every(row => row.every(c => !c))) { g.toast('보석이 없습니다', 'warn'); return; }
      const picked = allGemCells(g).filter(({ r, c }) => g.grid[r][c].color === target && !g.grid[r][c].wild);
      // 모두 제거하고
      for (const { r, c } of picked) g.grid[r][c] = null;
      // 바닥부터 채워 넣는다 (끌어모음)
      const perCol = Math.ceil(picked.length / g.cols);
      let idx = 0;
      for (let c = 0; c < g.cols && idx < picked.length; c++) {
        let placed = 0;
        for (let r = g.rows - 1; r >= 0 && placed < perCol && idx < picked.length; r--) {
          if (!g.grid[r][c]) {
            g.grid[r][c] = { color: target, wild: false, lock: 0, stone: false, born: g.now() };
            placed++; idx++;
          }
        }
      }
      // 남은 보석은 원래 자리로 복원
      for (let i = idx; i < picked.length; i++) {
        const { r, c } = picked[i];
        if (!g.grid[r][c]) g.grid[r][c] = { color: target, wild: false, lock: 0, stone: false, born: g.now() };
      }
      g.shake();
      g.particlesAt(g.rows - 1, Math.floor(g.cols / 2), COLORS[target].base, 20);
      g.applyGravity();
      g.resolve({ chain: 2, delay: 320 });
    },
  },
  {
    id: 'floor', name: '바닥 정리', icon: '🧹', color: '#4ade80',
    desc: '아래 3줄 제거',
    sfx: 'laser',
    apply(g) {
      g.shake();
      const cells = [];
      for (let r = g.rows - 3; r < g.rows; r++) for (let c = 0; c < g.cols; c++) cells.push({ r, c });
      g.removeCells(cells, { score: true, chain: 1 });
      g.resolve({ chain: 2, delay: 260 });
    },
  },
  {
    id: 'shield', name: '쉴드', icon: '🛡️', color: '#93c5fd',
    desc: '게임 오버 1회 방지 (발동 시 위쪽 5줄 제거)',
    sfx: 'shield',
    apply(g) {
      g.setShield(true);
      g.toast('쉴드 장착! 게임 오버 1회 방지', 'good');
      g.showBanner('SHIELD', '게임 오버 1회 방지', '#93c5fd');
    },
  },
  {
    id: 'boost', name: '점수 부스터', icon: '🚀', color: '#fb923c',
    desc: '20초간 점수 2배',
    sfx: 'item',
    apply(g) { g.startEffect('boost', CONFIG.effects.boostMs); },
  },
  {
    id: 'shuffle', name: '셔플', icon: '🔀', color: '#a3e635',
    desc: '보드 전체 재배치 (바로 매치되지 않게)',
    sfx: 'item',
    apply(g) {
      g.shuffleBoard();
      g.shake();
      g.resolve({ chain: 1, delay: 200 });
    },
  },
  {
    id: 'future', name: '미래시', icon: '👁️', color: '#c4b5fd',
    desc: '30초간 NEXT 5개 표시',
    sfx: 'item',
    apply(g) { g.startEffect('future', CONFIG.effects.futureMs); },
  },
];

/* =========================================================================
   방해 아이템 7종 (자동 발생)
   ========================================================================= */
export const OBSTACLES = [
  {
    id: 'stone', name: '돌 블록', icon: '🪨', color: '#94a3b8',
    desc: '매치되지 않는 돌 1줄 생성 (인접 매치로 파괴)',
    sfx: 'obstacle',
    apply(g) {
      const row = Math.min(g.rows - 2, 3 + randomInt(2));
      for (let c = 0; c < g.cols; c++) {
        g.grid[row][c] = { color: 'stone', stone: true, wild: false, lock: 0, born: g.now() };
      }
      g.particlesAt(row, Math.floor(g.cols / 2), '#cbd5e1', 16);
      g.applyGravity();
    },
  },
  {
    id: 'rise', name: '바닥 상승', icon: '⛰️', color: '#f59e0b',
    desc: '쓰레기 2줄이 밑에서 올라옴',
    sfx: 'obstacle',
    apply(g) {
      const colors = g.colors();
      const newRows = [];
      for (let i = 0; i < 2; i++) {
        const row = [];
        for (let c = 0; c < g.cols; c++) {
          row.push({ color: colors[randomInt(colors.length)], stone: false, wild: false, lock: 0, born: g.now() });
        }
        newRows.push(row);
      }
      for (let r = 0; r < g.rows - 2; r++) g.grid[r] = g.grid[r + 2];
      g.grid[g.rows - 2] = newRows[0];
      g.grid[g.rows - 1] = newRows[1];
      g.checkTopOut();
    },
  },
  {
    id: 'speed', name: '가속', icon: '⏩', color: '#ef4444',
    desc: '10초간 낙하 속도 2배',
    sfx: 'obstacle',
    apply(g) { g.startEffect('speedUp', CONFIG.effects.speedUpMs); },
  },
  {
    id: 'dark', name: '어둠', icon: '🌑', color: '#4b5563',
    desc: '10초간 보드 상단 절반이 가려짐',
    sfx: 'obstacle',
    apply(g) { g.startEffect('dark', CONFIG.effects.darkMs); },
  },
  {
    id: 'invert', name: '조작 반전', icon: '🔄', color: '#8b5cf6',
    desc: '8초간 좌우 조작 반전',
    sfx: 'obstacle',
    apply(g) { g.startEffect('invert', CONFIG.effects.invertMs); },
  },
  {
    id: 'lock', name: '잠금 보석', icon: '🔒', color: '#22c55e',
    desc: '랜덤 보석 3개가 잠김 (2회 매치해야 제거)',
    sfx: 'obstacle',
    apply(g) {
      const cells = shuffleArray(allGemCells(g)).slice(0, 3);
      for (const { r, c } of cells) {
        const cell = g.grid[r][c];
        cell.lock = 2;
        g.particlesAt(r, c, '#86efac', 8);
      }
    },
  },
  {
    id: 'confusion', name: '색 혼란', icon: '🎭', color: '#d946ef',
    desc: '10초간 두 색이 비슷하게 보임',
    sfx: 'obstacle',
    apply(g) {
      const colors = shuffleArray([...COLOR_KEYS]);
      g.startEffect('confusion', CONFIG.effects.confusionMs, { map: { [colors[0]]: colors[1], [colors[1]]: colors[0] } });
    },
  },
];

export const GOOD_BY_ID = Object.fromEntries(GOOD_ITEMS.map(i => [i.id, i]));
export const OBSTACLE_BY_ID = Object.fromEntries(OBSTACLES.map(i => [i.id, i]));
