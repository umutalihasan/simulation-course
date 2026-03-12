import { bus } from '../utils/EventBus.js';
import { EMPTY, TREE, BURNING, BURNED, WET, FIREBREAK } from '../core/Cell.js';

/**
 * Toolbar — Fırça araçları ve özel aksiyon butonları
 *
 * Yayımlanan eventler:
 *   'toolbar:brushChange'    → { state: number }   aktif fırça durumu
 *   'toolbar:firebreak'      → {}                  firebreak çiz
 *   'toolbar:export:png'     → {}
 *   'toolbar:export:json'    → {}
 */
export class Toolbar {
  constructor() {
    this._activeBrush = TREE;
    this._bindBrushButtons();
    this._bindActionButtons();
  }

  get activeBrush() {
    return this._activeBrush;
  }

  _bindBrushButtons() {
    const buttons = document.querySelectorAll('.brush-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._activeBrush = parseInt(btn.dataset.state, 10);
        bus.emit('toolbar:brushChange', { state: this._activeBrush });
      });
    });
  }

  _bindActionButtons() {
    const map = {
      'btn-firebreak': 'toolbar:firebreak',
      'btn-png':       'toolbar:export:png',
      'btn-json':      'toolbar:export:json',
    };

    for (const [id, event] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => bus.emit(event));
    }
  }
}
