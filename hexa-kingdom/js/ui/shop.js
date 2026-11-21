/* =========================================================================
   상점 — 단품 · 3개 묶음 · 레벨업 상자 · 구역 상자 · 망치 토큰 · 목숨
   ========================================================================= */
import { CFG } from '../config.js';
import { shopItems, buy } from '../meta/shop.js';
import { openModal, toast, fmt, ICONS } from './dom.js';
import { boosterSvg } from './hud.js';

export function openShop(app) {
  const render = () => {
    const p = app.profile;
    const items = shopItems(p);
    const groups = [
      { name: '인게임 부스터', list: items.filter(i => i.kind === 'booster' && !i.id.includes('3') && !i.id.startsWith('start')) },
      { name: '3개 묶음', list: items.filter(i => i.kind === 'booster' && i.id.includes('3')) },
      { name: '세트', list: items.filter(i => i.kind === 'pack') },
      { name: '상자', list: items.filter(i => i.kind === 'chest') },
      { name: '복구·기타', list: items.filter(i => i.kind === 'hammer' || i.kind === 'lives') },
    ];
    return `
      <div class="spread" style="margin-bottom:2px">
        <span class="chip">${ICONS.coin} ${fmt(p.coins)} 코인</span>
        <span class="chip">${ICONS.hammer} 망치 토큰 ${p.hammerTokens}</span>
      </div>
      ${groups.map(g => g.list.length ? `
        <div class="tiny muted" style="margin-top:6px">${g.name}</div>
        <div class="shop-grid">
          ${g.list.map(i => shopCard(i)).join('')}
        </div>` : '').join('')}
      <p class="tiny muted center" style="margin-top:6px">코인은 스테이지 클리어·복구·블리츠로 모을 수 있어요.</p>
    `;
  };

  const modal = openModal({
    title: '상점',
    subtitle: '루크의 배낭 속 물건들',
    body: render(),
    className: 'shop-modal',
  });

  const bind = () => {
    modal.body.querySelectorAll('[data-buy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.buy;
        const item = CFG.shop.items.find(i => i.id === id);
        const res = buy(item, app.profile);
        if (!res.ok) { toast(res.message, 'bad'); app.audio.sfx('invalid'); return; }
        app.audio.sfx('coin');
        toast(res.message, 'gold');
        app.syncSoon();
        modal.body.innerHTML = render();
        bind();
      });
    });
  };
  bind();
  app.audio.sfx('click');
}

function shopCard(i) {
  const icon = i.kind === 'booster' ? boosterSvg(i.key)
    : i.kind === 'hammer' ? ICONS.hammer
    : i.kind === 'lives' ? ICONS.heart
    : i.kind === 'pack' ? ICONS.star
    : ICONS.shop;
  const desc = i.kind === 'chest'
    ? (i.chest === 'level' ? '부스터 2종 + 코인 120' : '부스터 5종 + 망치 토큰 2 + 코인 150')
    : i.kind === 'lives' ? '목숨을 즉시 가득 채웁니다.'
    : i.kind === 'hammer' ? '마을 복구에 쓰는 토큰입니다.'
    : i.kind === 'pack' ? '새 전술 부스터 4종(자유 교체·번개 지팡이·무지개 프리즘·시간 모래시계)을 한 번에.'
    : (CFG.boosters[i.key]?.desc || '');
  return `
    <div class="shop-card ${i.affordable ? '' : 'no'}">
      <div class="row"><span style="width:24px;height:24px;display:grid;place-items:center">${icon}</span><span class="sc-name">${i.name}</span></div>
      <div class="sc-tag">${i.tag || ''}${i.kind === 'booster' ? ` · 보유 ${i.own}` : ''}</div>
      <div class="sc-desc">${desc}</div>
      <div class="sc-buy">${ICONS.coin} ${fmt(i.price)}</div>
      <button class="btn btn-sm ${i.affordable ? '' : 'btn-ghost'}" data-buy="${i.id}">구매</button>
    </div>`;
}
