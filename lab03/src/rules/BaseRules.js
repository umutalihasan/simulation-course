import { EMPTY, TREE, BURNING, BURNED, WET, FIREBREAK } from '../core/Cell.js';

/**
 * Temel Forest Fire CA kuralları
 */
export function applyBaseRules(x, y, state, grid, params) {
  switch (state) {
    case FIREBREAK: return FIREBREAK;
    case BURNING:   return BURNED;
    case BURNED:    return EMPTY;
    case WET:       return Math.random() < 0.015 ? TREE : WET;
    case EMPTY:
      if (params.enableGrowth && Math.random() < params.growProb) return TREE;
      return EMPTY;
    case TREE: {
      const nb = grid.neighbors(x, y);
      const onFire = nb.some(([nx, ny]) => grid.get(nx, ny) === BURNING);
      if (onFire && Math.random() < params.spreadProb) return BURNING;
      return TREE;
    }
    default: return state;
  }
}
