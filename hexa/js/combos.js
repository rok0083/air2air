/* =========================================================================
   헥사 블리츠 — 콤보 · 블레이징 스피드 · 피버 게이지
   콤보 배율 = 1 + 콤보 × 0.25 (최대 30콤보까지)
   ========================================================================= */

import { CFG, comboMultiplier } from './config.js';

export class ComboMeter {
  constructor({ audio, fx, onEvent } = {}) {
    this.audio = audio;
    this.fx = fx;
    this.onEvent = onEvent || (() => {});
    this.reset();
  }

  reset() {
    this.combo = 0;
    this.maxCombo = 0;
    this.lastMatchAt = 0;
    this.comboHistory = [];
    this.blazeUntil = 0;
    this.feverGauge = 0;
    this.feverUntil = 0;
    this.x2Until = 0;
    this.combosTriggered = 0;
    this.specialsCreated = 0;
    this.matchCount = 0;
  }

  now() { return performance.now(); }

  /* 매치가 성사되었을 때 호출 — 콤보 증가/초기화 */
  registerMatch(gems = 1) {
    const now = this.now();
    const withinWindow = this.combo > 0 && now - this.lastMatchAt <= CFG.combo.windowMs;
    this.combo = withinWindow ? this.combo + 1 : 1;
    this.lastMatchAt = now;
    this.matchCount++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.combo >= 2) {
      this.combosTriggered++;
      if (this.audio) this.audio.play('combo', this.combo);
    }

    // 블레이징 스피드: 3초 안에 콤보 5회
    this.comboHistory.push(now);
    this.comboHistory = this.comboHistory.filter(t => now - t <= CFG.blaze.withinMs);
    if (this.comboHistory.length >= CFG.blaze.combosNeeded && now > this.blazeUntil) {
      this.blazeUntil = now + CFG.blaze.durationMs;
      if (this.audio) this.audio.play('blaze');
      this.onEvent('blaze', { until: this.blazeUntil });
    }

    // 피버 게이지 충전
    this.addFever(gems * CFG.fever.perGem + (this.combo > 1 ? CFG.fever.perCombo : 0));

    this.onEvent('combo', { combo: this.combo, mult: comboMultiplier(this.combo) });
    return this.combo;
  }

  addFever(amount) {
    if (this.isFever()) return;
    this.feverGauge = Math.min(CFG.fever.max, this.feverGauge + amount);
    if (this.feverGauge >= CFG.fever.max) this.startFever();
  }

  startFever() {
    const now = this.now();
    if (now < this.feverUntil) return;
    this.feverUntil = now + CFG.fever.durationMs;
    this.feverGauge = CFG.fever.max;
    if (this.audio) { this.audio.play('fever'); this.audio.setFeverMode(true); }
    this.onEvent('fever', { until: this.feverUntil });
  }

  /* 부스터가 피버 게이지를 소모 */
  spendFever(cost) {
    if (this.isFever()) return false;
    if (this.feverGauge < cost) return false;
    this.feverGauge -= cost;
    this.onEvent('feverSpend', { cost, gauge: this.feverGauge });
    return true;
  }

  addX2(ms = CFG.items.x2.durationMs) {
    this.x2Until = this.now() + ms;
    this.onEvent('x2', { until: this.x2Until });
  }

  isFever() { return this.now() < this.feverUntil; }
  isBlaze() { return this.now() < this.blazeUntil; }
  isX2() { return this.now() < this.x2Until; }

  /* 최종 점수 배율 */
  multiplier() {
    let m = comboMultiplier(this.combo);
    if (this.isFever()) m *= CFG.fever.scoreMult;
    if (this.isBlaze()) m *= CFG.blaze.scoreMult;
    if (this.isX2()) m *= CFG.items.x2.mult;
    return m;
  }

  /* 특수 보석 생성 확률 가중치 (피버 중 상승) */
  specialBoost() {
    return this.isFever() ? CFG.fever.specialBoost : (this.isBlaze() ? 1.25 : 1);
  }

  /* 프레임마다 호출: 만료 처리 */
  update() {
    const now = this.now();
    if (this.combo > 0 && now - this.lastMatchAt > CFG.combo.windowMs) {
      this.combo = 0;
      this.onEvent('combo', { combo: 0, mult: 1 });
    }
    if (this.feverUntil && now >= this.feverUntil) {
      this.feverUntil = 0;
      this.feverGauge = 0;
      if (this.audio) this.audio.setFeverMode(false);
      this.onEvent('feverEnd', {});
    }
    if (this.feverUntil && now < this.feverUntil) {
      // 남은 시간에 비례해 게이지 표시
      this.feverGauge = CFG.fever.max * ((this.feverUntil - now) / CFG.fever.durationMs);
    }
    if (this.blazeUntil && now >= this.blazeUntil) {
      this.blazeUntil = 0;
      this.onEvent('blazeEnd', {});
    }
    if (this.x2Until && now >= this.x2Until) {
      this.x2Until = 0;
      this.onEvent('x2End', {});
    }
  }

  state() {
    return {
      combo: this.combo,
      maxCombo: this.maxCombo,
      mult: this.multiplier(),
      fever: this.feverGauge / CFG.fever.max,
      feverActive: this.isFever(),
      blaze: this.isBlaze(),
      x2: this.isX2(),
    };
  }
}
