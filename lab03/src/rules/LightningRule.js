import { TREE, BURNING } from '../core/Cell.js';

/**
 * Ek Kural 3 — Yıldırım / Kendiliğinden Tutuşma
 *
 * igniteProb: her adımda herhangi bir TREE hücresinin tutuşma olasılığı.
 * Beklenen tutuşma sayısı = igniteProb * treeCount
 * Her adımda Poisson yaklaşımıyla kaç yıldırım çakacağı hesaplanır.
 */
export function applyLightningRule(grid, params) {
  const stats     = grid.stats();
  const treeCount = stats[TREE] ?? 0;
  if (treeCount === 0) return;

  // Beklenen yıldırım sayısı
  const expected = params.igniteProb * treeCount;

  // Poisson: kaç tane çakacak?
  const strikes = poissonSample(expected);
  if (strikes === 0) return;

  // Rastgele TREE hücrelerine çak
  let attempts = 0;
  let hit = 0;
  while (hit < strikes && attempts < strikes * 20) {
    attempts++;
    const x = Math.floor(Math.random() * grid.cols);
    const y = Math.floor(Math.random() * grid.rows);
    if (grid.get(x, y) === TREE) {
      grid.set(x, y, BURNING);
      params._lastLightning = { x, y, age: 0 };
      hit++;
    }
  }
}

/**
 * Poisson dağılımından örnek çeker (Knuth algoritması).
 * Küçük lambda değerleri için yeterince hızlı.
 */
function poissonSample(lambda) {
  if (lambda <= 0) return 0;
  // Büyük lambda için normal yaklaşım
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * randn()));
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function randn() {
  // Box-Muller
  return Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
}
