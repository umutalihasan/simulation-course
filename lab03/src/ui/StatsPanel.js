import { bus } from '../utils/EventBus.js';
import { TREE, BURNING, BURNED, WET } from '../core/Cell.js';

/**
 * StatsPanel — Canlı istatistik paneli
 *
 * Dinlenen eventler:
 *   'stats:update' → { counts: number[], generation: number, total: number }
 *
 * counts dizisi: [EMPTY, TREE, BURNING, BURNED, WET, FIREBREAK]
 * (Grid.stats() döndürdüğü sırayla)
 */
export class StatsPanel {
  constructor() {
    this._els = {
      gen:    document.getElementById('stat-gen'),
      tree:   document.getElementById('stat-tree'),
      fire:   document.getElementById('stat-fire'),
      burned: document.getElementById('stat-burned'),
      wet:    document.getElementById('stat-wet'),
      cover:  document.getElementById('stat-cover'),
      // Topbar
      tbTree:  document.getElementById('tb-tree'),
      tbFire:  document.getElementById('tb-fire'),
      tbCover: document.getElementById('tb-cover'),
    };

    bus.on('stats:update', ({ counts, generation, total }) => {
      this._render(counts, generation, total);
    });
  }

  _render(counts, generation, total) {
    const { gen, tree, fire, burned, wet, cover, tbTree, tbFire, tbCover } = this._els;
    const coverPct = (((counts[TREE] ?? 0) + (counts[WET] ?? 0)) / total * 100).toFixed(1) + '%';

    if (gen)    gen.textContent    = generation;
    if (tree)   tree.textContent   = counts[TREE]    ?? 0;
    if (fire)   fire.textContent   = counts[BURNING] ?? 0;
    if (burned) burned.textContent = counts[BURNED]  ?? 0;
    if (wet)    wet.textContent    = counts[WET]     ?? 0;
    if (cover)  cover.textContent  = coverPct;

    if (tbTree)  tbTree.textContent  = counts[TREE]    ?? 0;
    if (tbFire)  tbFire.textContent  = counts[BURNING] ?? 0;
    if (tbCover) tbCover.textContent = coverPct;
  }
}
