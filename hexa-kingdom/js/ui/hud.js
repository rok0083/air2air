/* =========================================================================
   인게임 HUD — 점수·이동·목표·보스 HP·부스터·힌트
   ========================================================================= */
import { CFG, GEMS } from '../config.js';
import { ICONS, fmt, $ } from './dom.js';
import { inGameButtons } from '../boosters/index.js';
import { bossSvg } from './art.js';

export function buildHud(session) {
  const { board, mode, levelData, world } = session;
  const head = $('#game-head');
  const isBlitz = mode === 'blitz';

  head.innerHTML = `
    <div class="line1">
      <button class="icon-btn" id="hud-back" aria-label="나가기">${ICONS.back}</button>
      <div class="game-title grow">
        <span class="w">${isBlitz ? '주간 블리츠' : `월드 ${world} · ${levelData.name || ''}`}</span>
        <span class="n">${isBlitz ? '60초 매치 챌린지' : (levelData.name || '스테이지')}</span>
      </div>
      <div class="${isBlitz ? 'moves-pill' : 'moves-pill'}" id="hud-moves-pill">
        <span class="m" id="hud-moves">${isBlitz ? CFG.blitz.seconds : board.moves}</span>
        <span class="l">${isBlitz ? '초' : '이동'}</span>
      </div>
      <div class="game-score" style="min-width:66px">
        <div class="s" id="hud-score">0</div>
        <div class="l">점수</div>
      </div>
      <button class="icon-btn" id="hud-sound" aria-label="소리">${session.app.audio.enabled ? ICONS.sound : ICONS.mute}</button>
    </div>
  `;

  const bossSlot = $('#boss-slot');
  bossSlot.innerHTML = '';
  if (board.boss) {
    bossSlot.innerHTML = `
      <div class="boss-bar" id="boss-bar">
        <div class="row">
          <span class="row" style="gap:5px">${ICONS.boss}<b id="boss-name">${board.boss.name || '보스'}</b></span>
          <span class="tiny" id="boss-hp-text">${board.boss.maxHp}</span>
        </div>
        <div class="hp"><i id="boss-hp" style="width:100%"></i></div>
      </div>`;
    const portrait = document.createElement('div');
    portrait.className = 'boss-portrait';
    portrait.innerHTML = bossSvg(board.boss.kind || 'slime', 54);
    portrait.style.cssText = 'position:absolute;right:12px;top:56px;opacity:.9;pointer-events:none;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5));z-index:2';
    $('#screen-game').append(portrait);
    session.bossPortrait = portrait;
  }

  // 목표
  const goals = $('#game-goals');
  if (isBlitz) {
    goals.innerHTML = `<div class="goal">${ICONS.star}<span>목표 ${fmt(CFG.blitz.goalScore)}점</span><span class="gcount" id="goal-blitz">0%</span></div>
      <div class="goal">${ICONS.bolt}<span>남은 시간</span><span class="gcount" id="goal-time">60s</span></div>`;
  } else {
    goals.innerHTML = board.goals.list.map((g, i) => `
      <div class="goal" id="goal-${i}">
        ${board.goals.icon(g)}
        <span>${goalText(g)}</span>
        <span class="gcount" id="goal-count-${i}">${Math.min(g.done, g.total)}/${g.total}</span>
      </div>`).join('');
  }

  // 부스터
  const boosters = $('#game-boosters');
  boosters.innerHTML = inGameButtons().map(b => `
    <button class="booster-btn" data-booster="${b.key}" aria-label="${b.name}">
      ${boosterSvg(b.key)}
      <span class="bn">${b.name}</span>
      <span class="cnt" data-count="${b.key}">${session.app.profile.boosterCount(b.key)}</span>
    </button>`).join('') + `
    <button class="booster-btn hint-btn" id="hud-hint" aria-label="힌트">${ICONS.hint}<span class="bn">힌트</span></button>`;
}

export function updateHud(session) {
  const { board, mode } = session;
  const isBlitz = mode === 'blitz';
  const scoreEl = $('#hud-score');
  if (scoreEl) scoreEl.textContent = fmt(board.score);
  const movesEl = $('#hud-moves');
  if (movesEl && !isBlitz) movesEl.textContent = String(Math.max(0, board.moves));

  if (board.boss) {
    const pct = Math.max(0, (board.boss.hp / board.boss.maxHp) * 100);
    const hp = $('#boss-hp');
    if (hp) hp.style.width = pct + '%';
    const txt = $('#boss-hp-text');
    if (txt) txt.textContent = `${Math.max(0, board.boss.hp)}/${board.boss.maxHp}`;
    if (board.boss.hp <= 0) {
      $('#boss-bar')?.classList.add('dead');
      if (session.bossPortrait) session.bossPortrait.style.opacity = '.25';
    }
  }

  if (!isBlitz) {
    board.goals.list.forEach((g, i) => {
      const el = $(`#goal-count-${i}`);
      if (el) el.textContent = `${Math.min(g.done, g.total)}/${g.total}`;
      if (g.done >= g.total) $(`#goal-${i}`)?.classList.add('done');
    });
  }
}

export function updateBoosterCounts(session) {
  const p = session.app.profile;
  document.querySelectorAll('[data-count]').forEach(node => {
    const key = node.dataset.count;
    node.textContent = p.boosterCount(key);
    node.style.display = p.boosterCount(key) ? 'grid' : 'none';
  });
  document.querySelectorAll('[data-booster]').forEach(btn => {
    const key = btn.dataset.booster;
    btn.disabled = p.boosterCount(key) <= 0;
  });
}

function goalText(g) {
  if (g.type === 'collect') return `${GEMS[g.color]?.name || '보석'}`;
  if (g.type === 'clear') return g.obstacle && g.obstacle !== 'any' ? `${obstacleName(g.obstacle)}` : '장애물';
  if (g.type === 'drop') return '마법 씨앗';
  if (g.type === 'boss') return '보스 처치';
  return '목표';
}

function obstacleName(type) {
  return {
    bush: '덤불', crate: '나무 상자', grass: '풀밭', ice: '얼음', snowman: '눈사람', icicle: '고드름',
    sand: '모래', jar: '항아리', cactus: '선인장', vine: '덩굴', fruitTree: '열매 나무', swamp: '늪',
    shadowStone: '그림자 돌', shadowRune: '그림자 룬',
  }[type] || '장애물';
}

export function boosterSvg(key) {
  const common = 'width="24" height="24" viewBox="0 0 24 24"';
  const map = {
    hammer: `<svg ${common}><rect x="10" y="9" width="4" height="12" rx="2" transform="rotate(35 12 15)" fill="#b07a45"/><path d="M8 5l7 7-3 3-7-7z" fill="#c9d3e0"/></svg>`,
    drill: `<svg ${common}><path d="M12 3l2 4v8h-4V7z" fill="#9fb6c8"/><path d="M10 15h4l-2 6z" fill="#ffd166"/><path d="M8 6h8" stroke="#c9d3e0" stroke-width="2"/></svg>`,
    bomber: `<svg ${common}><circle cx="11" cy="14" r="6.4" fill="#ff5e57"/><path d="M15 9c2-3 4-2 4-2" stroke="#ffd166" stroke-width="2" fill="none"/><circle cx="20" cy="6" r="2.2" fill="#ffe066"/></svg>`,
    magicHat: `<svg ${common}><path d="M5 17h14l-2-8-4-4H9L7 9z" fill="#3b2d5c"/><path d="M4 18h16" stroke="#b06cff" stroke-width="2.4" stroke-linecap="round"/><path d="M12 5l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#ffe066"/></svg>`,
  };
  return map[key] || '';
}
