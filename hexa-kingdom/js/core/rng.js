/* 시드 기반 난수 — 레벨 JSON의 seed로 항상 같은 보드를 재현합니다. */
export class RNG {
  constructor(seed = 1) {
    this.seed = (seed >>> 0) || 1;
    this.state = this.seed;
  }
  next() {
    // mulberry32
    let t = (this.state += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
  pick(arr) { return arr[this.int(arr.length)]; }
  float(a, b) { return a + this.next() * (b - a); }
  shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
