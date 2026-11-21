/* =========================================================================
   상점 — 단품 / 3개 묶음 / 레벨업 상자 / 구역 상자 / 목숨 회복
   구매는 코인만 사용하며, 실패 시 아무것도 차감하지 않습니다.
   ========================================================================= */
import { CFG } from '../config.js';

const RNG = () => Math.random();

export function shopItems(profile) {
  return CFG.shop.items.map(it => ({
    ...it,
    affordable: profile.coins >= it.price,
    own: it.kind === 'booster' ? profile.boosterCount(it.key) : it.kind === 'hammer' ? profile.hammerTokens : 0,
  }));
}

export function buy(item, profile) {
  if (!item) return { ok: false, message: '상품을 찾을 수 없어요.' };
  if (profile.coins < item.price) return { ok: false, message: '코인이 부족해요.' };
  const rewards = { coins: 0, boosters: {}, hammers: 0, lives: false };

  if (item.kind === 'booster') {
    profile.addBooster(item.key, item.amount);
    rewards.boosters[item.key] = item.amount;
  } else if (item.kind === 'hammer') {
    profile.addHammers(item.amount);
    rewards.hammers = item.amount;
  } else if (item.kind === 'lives') {
    profile.refillLives();
    rewards.lives = true;
  } else if (item.kind === 'chest') {
    if (item.chest === 'level') {
      const pool = ['hammer', 'drill', 'bomber', 'magicHat', 'startRocket', 'startTnt'];
      const picks = pool.sort(() => RNG() - 0.5).slice(0, 2);
      picks.forEach(k => { profile.addBooster(k, 1); rewards.boosters[k] = 1; });
      profile.addCoins(120);
      rewards.coins = 120;
    } else {
      ['hammer', 'drill', 'bomber', 'magicHat'].forEach(k => { profile.addBooster(k, 1); rewards.boosters[k] = (rewards.boosters[k] || 0) + 1; });
      profile.addHammers(2);
      rewards.hammers = 2;
      profile.addCoins(150);
      rewards.coins = 150;
    }
  }
  profile.spendCoins(item.price);
  profile.save();
  return { ok: true, message: `${item.name} 구매 완료!`, rewards };
}

export function boosterShopList() {
  return CFG.shop.items.filter(i => ['booster', 'hammer', 'chest', 'lives'].includes(i.kind));
}
