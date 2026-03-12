import { bus } from '../utils/EventBus.js';

/**
 * ParameterPanel — Slider'lar, wind direction seçimi, rule toggle'ları
 *
 * Yayımlanan eventler:
 *   'params:change' → { key: string, value: number|string|boolean }
 *
 * Her slider veya toggle değişince ilgili param key'i ile event gönderilir.
 * main.js veya Automaton bu eventleri dinleyerek params objesini günceller.
 */
export class ParameterPanel {
  constructor() {
    this._bindSliders();
    this._bindWindDirection();
    this._bindToggles();
  }

  // ── Sliders ───────────────────────────────────────────────────
  _bindSliders() {
    const sliders = [
      { id: 'sl-speed',    displayId: 'val-speed',    key: '__speed',      fmt: v => Math.round(v).toString() },
      { id: 'sl-density',  displayId: 'val-density',  key: 'treeDensity',  fmt: v => v.toFixed(2)  },
      { id: 'sl-spread',   displayId: 'val-spread',   key: 'spreadProb',   fmt: v => v.toFixed(2)  },
      { id: 'sl-ignite',   displayId: 'val-ignite',   key: 'igniteProb',   fmt: v => v.toFixed(4)  },
      { id: 'sl-humidity', displayId: 'val-humidity', key: 'humidity',     fmt: v => v.toFixed(2)  },
      { id: 'sl-wind',     displayId: 'val-wind',     key: 'windStrength', fmt: v => v.toFixed(2)  },
      { id: 'sl-brush',    displayId: 'val-brush',    key: '__brushSize',  fmt: v => Math.round(v).toString() },
    ];

    for (const { id, displayId, key, fmt } of sliders) {
      const el      = document.getElementById(id);
      const display = document.getElementById(displayId);
      if (!el) continue;

      el.addEventListener('input', () => {
        const value = parseFloat(el.value);
        if (display) display.textContent = fmt(value);
        bus.emit('params:change', { key, value });
      });
    }
  }

  // ── Wind Direction ────────────────────────────────────────────
  _bindWindDirection() {
    const sel = document.getElementById('sel-wind');
    if (!sel) return;
    sel.addEventListener('change', () => {
      bus.emit('params:change', { key: 'windDir', value: sel.value });
    });
  }

  // ── Rule Toggles ──────────────────────────────────────────────
  _bindToggles() {
    const toggles = [
      { id: 'chk-wind',      key: 'enableWind'      },
      { id: 'chk-humidity',  key: 'enableHumidity'  },
      { id: 'chk-lightning', key: 'enableLightning' },
      { id: 'chk-firebreak', key: 'enableFirebreak' },
      { id: 'chk-growth',    key: 'enableGrowth'    },
    ];

    for (const { id, key } of toggles) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('change', () => {
        bus.emit('params:change', { key, value: el.checked });
      });
    }
  }
}