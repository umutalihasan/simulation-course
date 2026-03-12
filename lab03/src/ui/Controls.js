import { bus } from '../utils/EventBus.js';

/**
 * Controls — Simülasyon kontrol butonları
 *
 * Yayımlanan eventler:
 *   'ctrl:play'   → toggle play/pause
 *   'ctrl:step'   → tek adım ilerle
 *   'ctrl:reset'  → grid'i yeniden doldur
 *   'ctrl:clear'  → grid'i temizle
 *
 * Dinlenen eventler:
 *   'sim:stateChange' → { running: bool }  buton metnini günceller
 */
export class Controls {
  /**
   * @param {Object} elements - { btnPlay, btnStep, btnReset, btnClear }
   */
  constructor({ btnPlay, btnStep, btnReset, btnClear }) {
    this.btnPlay = btnPlay;

    btnPlay.addEventListener('click',  () => bus.emit('ctrl:play'));
    btnStep.addEventListener('click',  () => bus.emit('ctrl:step'));
    btnReset.addEventListener('click', () => bus.emit('ctrl:reset'));
    btnClear.addEventListener('click', () => bus.emit('ctrl:clear'));

    // Dışarıdan gelen durum güncellemesi
    bus.on('sim:stateChange', ({ running }) => {
      btnPlay.textContent = running ? '⏸ Pause' : '▶ Play';
      btnPlay.classList.toggle('active', running);
    });
  }
}
