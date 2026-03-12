import { TREE, BURNING } from '../core/Cell.js';

/**
 * Ek Kural 1 — Rüzgar Etkisi
 * Rüzgar yönünden gelen ateş, yayılma olasılığını artırır.
 */
const VECTORS = {
  N:  [  0, -1 ], S:  [ 0,  1 ], E:  [  1, 0 ], W:  [ -1, 0 ],
  NE: [  1, -1 ], NW: [-1, -1 ], SE: [  1, 1 ], SW: [ -1, 1 ],
};

export function applyWindRule(x, y, state, grid, params) {
  if (state !== TREE) return null;

  const [dx, dy] = VECTORS[params.windDir] ?? VECTORS['N'];

  const upwindBurning   = grid.get(x - dx, y - dy) === BURNING;
  const downwindBurning = grid.get(x + dx, y + dy) === BURNING;

  if (upwindBurning) {
    const boost = params.spreadProb + params.windStrength * (1 - params.spreadProb);
    if (Math.random() < boost) return BURNING;
  }

  if (downwindBurning && !upwindBurning) {
    const reduced = params.spreadProb * (1 - params.windStrength * 0.5);
    if (Math.random() < reduced) return BURNING;
  }

  return null;
}
