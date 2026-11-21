/* =========================================================================
   스테이지 시작 전 모달 — 목표·별 기준·시작 부스터 선택
   ========================================================================= */
import { CFG, GEMS } from '../config.js';
import { loadLevel } from '../meta/levels.js';
import { levelName, isBossLevel } from '../meta/worldmap.js';
import { openModal, toast, ICONS, fmt, el, PLAY_BADGE } from './dom.js';
import { bossSvg } from './art.js';

export async function openPreLevel(app, world, level) {
  const p = app.profile;
  if (!p.isLevelUnlocked(world, level)) { toast('앞 스테이지를 먼저 클리어해 주세요.', 'bad'); return; }
  let data;
  try { data = await loadLevel(world, level); }
  catch { toast('스테이지를 불러오지 못했어요.', 'bad'); return; }

  const stars = p.starsOf(world, level);
  const bestScore = p.data.bestScores[`w${world}-${level}`] || 0;
  const thresholds = data.stars || [2500, 5000, 8000];
  const lives = p.livesInfo();
  const boss = data.boss;

  const selected = { startRocket: false, startTnt: false, startSpinner: false };
  const owned = {
    startRocket: p.boosterCount('startRocket'),
    startTnt: p.boosterCount('startTnt'),
    startSpinner: p.boosterCount('startSpinner'),
  };

  const goalRows = (data.goals || []).map(g => goalRowHtml(g, data)).join('');

  const body = el('div', {});
  body.innerHTML = `
    <div class="level-banner">
      <div class="lb-art">${boss ? bossSvg(boss.kind || 'slime', 64) : `<div style="font-size:22px;font-weight:900;color:#ffd166">${level}</div>`}</div>
      <div class="grow">
        <div class="tiny muted">월드 ${world} · ${boss ? '보스 스테이지' : `스테이지 ${level}`}</div>
        <h2>${data.name || levelName(world, level)}</h2>
        <div class="lb-sub">이동 ${data.moves}수 · 색 ${data.colors || 5}종 ${boss ? `· 보스 HP ${boss.hp}` : ''}</div>
      </div>
    </div>

    <div class="stars-row">
      ${[0, 1, 2].map(i => `<div class="star-slot ${i < stars ? 'on' : ''}">${ICONS.star}</div>`).join('')}
    </div>
    <div class="center tiny muted">${stars ? `최고 별 ${stars}개 · 최고 점수 ${fmt(bestScore)}` : `별 기준 ${thresholds.map(t => fmt(t)).join(' / ')}`}</div>

    <div class="goal-list">${goalRows}</div>

    <div>
      <div class="spread" style="margin-bottom:6px">
        <span class="tiny muted">시작 부스터</span>
        <span class="tiny muted">보유 ${owned.startRocket + owned.startTnt + owned.startSpinner}개</span>
      </div>
      <div class="pre-boosters" id="pre-boosters">
        ${preBoosterHtml('startRocket', '시작 로켓', owned.startRocket)}
        ${preBoosterHtml('startTnt', '시작 폭탄', owned.startTnt)}
        ${preBoosterHtml('startSpinner', '시작 프로펠러', owned.startSpinner)}
      </div>
    </div>

    <div class="spread tiny muted" style="padding-top:2px">
      <span>${ICONS.heart} 목숨 ${lives.count}/${lives.max} · 실패 시에만 1 소모</span>
      <span>${lives.nextIn ? `다음 회복 ${Math.ceil(lives.nextIn / 60000)}분` : '가득 참'}</span>
    </div>
    <div class="tiny muted center" style="line-height:1.5">스테이지를 시작할 때는 목숨을 쓰지 않아요.<br>클리어하면 그대로라 질 때까지 계속 이어서 할 수 있어요.</div>
    ${boss ? `<div class="tiny" style="color:#d9c2ff">${ICONS.boss} ${boss.name} — ${boss.summonEvery ?? 2}수마다 장애물을 소환합니다.</div>` : ''}
  `;

  const actions = [];
  if (lives.count <= 0) {
    actions.push({
      label: `코인 ${fmt(CFG.lives.refillCoinCost)}으로 목숨 가득 충전`,
      class: 'btn btn-sm',
      full: true,
      onClick: (close) => {
        if (p.coins < CFG.lives.refillCoinCost) { toast('코인이 부족해요. 블리츠나 복구로 모을 수 있어요.', 'bad'); return; }
        p.spendCoins(CFG.lives.refillCoinCost);
        p.refillLives();
        p.save();
        app.syncSoon();
        app.audio.sfx('coin');
        toast('목숨을 가득 채웠어요!', 'gold');
        close();
        openPreLevel(app, world, level);
      },
    });
  }
  actions.push({
    label: '플레이',
    // ▶ 배지 + 굵은 라벨을 실제 HTML 로 (예전엔 SVG 문자열이 글자로 보였음)
    html: lives.count > 0
      ? `${PLAY_BADGE}<span class="start-lbl">플레이</span>`
      : `<span class="start-lbl">목숨 부족</span>`,
    ariaLabel: lives.count > 0 ? '플레이 — 이 스테이지 시작' : '목숨 부족',
    class: 'btn-start',
    full: true,
    disabled: lives.count <= 0,
    onClick: (close) => {
      // v2: 시작할 때 목숨을 쓰지 않는다 (실패했을 때만 1개)
      if (lives.count <= 0) { toast('목숨이 없어요. 15분마다 회복되거나 코인으로 충전할 수 있어요.', 'bad'); return; }
      // 선택한 시작 부스터 차감
      const extra = {};
      for (const key of Object.keys(selected)) {
        if (selected[key] && p.useBooster(key)) extra[key] = (extra[key] || 0) + 1;
      }
      p.save();
      close();
      app.startLevel(world, level, data, extra);
    },
  });
  actions.push({ label: '지도로', class: 'btn-ghost full' });

  const modal = openModal({
    title: '출발 준비',
    subtitle: `${world}월드 · ${levelName(world, level)}`,
    body,
    className: 'prelevel-modal',
    actions,
  });

  // 부스터 토글
  modal.body.querySelectorAll('[data-pb]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.pb;
      if (!owned[key]) { toast('상점에서 시작 부스터를 살 수 있어요.', 'bad'); return; }
      selected[key] = !selected[key];
      btn.classList.toggle('on', selected[key]);
      app.audio.sfx('click');
    });
  });
  if (lives.count <= 0) {
    toast('목숨이 모두 떨어졌어요. 15분마다 1개씩 회복되고, 코인으로 바로 충전할 수 있어요.', 'bad', 3000);
  }
}

function preBoosterHtml(key, name, count) {
  const svg = {
    startRocket: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 19l6-6M14 4c4 0 6 2 6 6-3 0-6 3-6 6-2-2-2-4-2-4z" fill="#ff9f43" stroke="#fff" stroke-width="1"/><circle cx="16" cy="8" r="1.6" fill="#fff"/></svg>',
    startTnt: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="11" cy="14" r="6" fill="#ff5e57"/><path d="M15 9c2-3 4-2 4-2" stroke="#ffd166" stroke-width="2" fill="none"/><circle cx="20" cy="6" r="2" fill="#ffd166"/></svg>',
    startSpinner: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="2.6" fill="#48dbfb"/><path d="M12 4c3 0 4 2 4 2l-3 3M20 12c0 3-2 4-2 4l-3-3M12 20c-3 0-4-2-4-2l3-3M4 12c0-3 2-4 2-4l3 3" stroke="#9be9ff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  };
  return `<button class="pre-booster" data-pb="${key}">
    ${svg[key]}
    <span class="pbn">${name}</span>
    <span class="pbc">${count}개</span>
  </button>`;
}

function goalRowHtml(g, data) {
  if (g.type === 'collect') {
    const gem = GEMS[g.color] || GEMS[0];
    return goalRow(`<span class="gem-dot" style="background:${gem.color}"></span>`, `${gem.name} ${g.count}개 모으기`, g.count);
  }
  if (g.type === 'clear') {
    return goalRow(ICONS.brick, `장애물 ${g.obstacle && g.obstacle !== 'any' ? obstacleName(g.obstacle) : ''} ${g.count}개 없애기`, g.count);
  }
  if (g.type === 'drop') {
    return goalRow(ICONS.seed, `마법 씨앗 ${g.count}개를 바닥까지 떨어뜨리기`, g.count);
  }
  if (g.type === 'boss') {
    const hp = data.boss?.hp || g.count;
    return goalRow(ICONS.boss, `${data.boss?.name || '보스'} 처치 (HP ${hp})`, hp);
  }
  return '';
}

/* 목표 한 줄 — 아이콘은 실제 SVG 요소로, 글자와 개수는 따로 정렬 */
function goalRow(iconHtml, text, count) {
  return `<div class="goal-row"><span class="gic">${iconHtml}</span><span class="gtx">${text}</span><span class="gcount">0/${count}</span></div>`;
}

function obstacleName(type) {
  return {
    bush: '덤불', crate: '나무 상자', grass: '풀밭', ice: '얼음', snowman: '눈사람', icicle: '고드름',
    sand: '모래', jar: '항아리', cactus: '선인장', vine: '덩굴', fruitTree: '열매 나무', swamp: '늪',
    shadowStone: '그림자 돌', shadowRune: '그림자 룬',
  }[type] || '';
}
