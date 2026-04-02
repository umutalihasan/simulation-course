/**
 * lcg.js — Мультипликативный конгруэнтный генератор (МКГ)
 *
 * Формула: Xₙ₊₁ = (mult · Xₙ) mod m
 *   mult = 16807       (= 7⁵, Park–Miller)
 *   mod  = 2 147 483 647  (= 2³¹ − 1, простое число Мерсенна)
 *   C    = 0           → мультипликативный (без слагаемого)
 *
 * Зерно ≠ 0 (иначе генератор вырождается).
 */
class CustomRNG {
  constructor(seed) {
    this.mod   = 2147483647; // 2^31 - 1
    this.mult  = 16807;
    this.state = seed % this.mod;
    if (this.state === 0) this.state = 1;
  }
  next() {
    this.state = (this.mult * this.state) % this.mod;
    return this.state / this.mod; // [0, 1)
  }
  getSeed() { return this.state; }
}

let rng = new CustomRNG(Date.now());

// Глобальный интерфейс — используется всеми модулями
const LCG = {
  next()      { return rng.next(); },
  getSeed()   { return rng.getSeed(); },
  reset(seed) { rng = new CustomRNG(seed); }
};
