/**
 * Basit pub/sub event sistemi.
 * Bileşenler arası doğrudan bağımlılık olmadan iletişim sağlar.
 *
 * Kullanım:
 *   import { bus } from '../utils/EventBus.js';
 *   bus.on('params:change', ({ key, value }) => { ... });
 *   bus.emit('params:change', { key: 'spreadProb', value: 0.9 });
 */
export class EventBus {
  constructor() {
    this._map = new Map();
  }

  on(event, cb) {
    if (!this._map.has(event)) this._map.set(event, new Set());
    this._map.get(event).add(cb);
    return () => this.off(event, cb); // unsubscribe fonksiyonu döner
  }

  off(event, cb) {
    this._map.get(event)?.delete(cb);
  }

  emit(event, data) {
    this._map.get(event)?.forEach(cb => cb(data));
  }

  once(event, cb) {
    const unsub = this.on(event, data => { cb(data); unsub(); });
  }

  clear(event) {
    if (event) this._map.delete(event);
    else this._map.clear();
  }
}

// Singleton — tüm modüller aynı bus'ı kullanır
export const bus = new EventBus();
