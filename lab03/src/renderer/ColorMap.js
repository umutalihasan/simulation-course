import { EMPTY, TREE, BURNING, BURNED, WET, FIREBREAK } from '../core/Cell.js';

export const COLORS = {
  [EMPTY]:     '#1a0f0a',
  [BURNED]:    '#111111',
  [WET]:       '#0a3d6b',
  [FIREBREAK]: '#c8a800',
};

export function getCellColor(state) {
  if (state === BURNING) {
    const r = 180 + (Math.random() * 75 | 0);
    const g = Math.random() * 100 | 0;
    return `rgb(${r},${g},0)`;
  }
  if (state === TREE) {
    const g = 90 + (Math.random() * 70 | 0);
    return `rgb(10,${g},15)`;
  }
  return COLORS[state] ?? '#000';
}
