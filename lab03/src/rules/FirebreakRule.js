import { FIREBREAK } from '../core/Cell.js';

/**
 * Ek Kural 4 — Yangın Kesme Şeridi
 * FIREBREAK hücreleri ateşe karşı tamamen dirençlidir.
 */
export function applyFirebreakRule(x, y, state, grid) {
  if (grid.get(x, y) === FIREBREAK) return FIREBREAK;
  return null;
}

export function drawFirebreakLine(grid, direction, position, thickness = 2) {
  for (let t = 0; t < thickness; t++) {
    if (direction === 'horizontal') {
      const row = Math.min(position + t, grid.rows - 1);
      for (let x = 0; x < grid.cols; x++) grid.set(x, row, FIREBREAK);
    } else {
      const col = Math.min(position + t, grid.cols - 1);
      for (let y = 0; y < grid.rows; y++) grid.set(col, y, FIREBREAK);
    }
  }
}
