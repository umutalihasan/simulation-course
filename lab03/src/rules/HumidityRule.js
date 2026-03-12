import { TREE, BURNING, WET } from '../core/Cell.js';

/**
 * Ek Kural 2 — Nem / Yağış Etkisi
 * Yüksek nemde BURNING yerine WET'e geçebilir.
 */
export function applyHumidityRule(x, y, proposedNext, params) {
  if (proposedNext !== BURNING) return null;
  // Sadece humidity > 0.5 üzerinde etkili, daha az agresif
  if (params.humidity < 0.5) return null;
  if (Math.random() < (params.humidity - 0.5) * 0.6) return WET;
  return null;
}

export function applyRainEffect(grid, params) {
  // Rain sadece humidity > 0.7 üzerinde devreye girer
  if (!params.enableHumidity || params.humidity < 0.7) return;
  const prob = (params.humidity - 0.7) * 0.02; // max ~0.006 at humidity=1.0
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const s = grid.get(x, y);
      if (s === TREE    && Math.random() < prob)       grid.set(x, y, WET);
      if (s === BURNING && Math.random() < prob * 0.3) grid.set(x, y, WET);
    }
  }
}