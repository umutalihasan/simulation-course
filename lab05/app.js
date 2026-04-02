/**
 * app.js — Инициализация и управление вкладками
 */

function switchTab(idx) {
  document.querySelectorAll('.nav-tab').forEach((t, i) =>
    t.classList.toggle('active', i === idx));
  document.getElementById('scene-0').classList.toggle('hidden', idx !== 0);
  document.getElementById('scene-1').classList.toggle('hidden', idx !== 1);
}

function resetSeed() {
  let s = parseInt(document.getElementById('seed-input').value);
  if (isNaN(s) || s <= 0) { s = 12345; document.getElementById('seed-input').value = 12345; }
  LCG.reset(s);
  document.getElementById('nav-seed').textContent = 'SEED ' + LCG.getSeed();
  const btn = document.querySelector('.seed-btn');
  btn.textContent = '✓ OK'; btn.style.color = 'var(--yes)';
  setTimeout(() => { btn.textContent = 'СБРОС'; btn.style.color = ''; }, 900);
}

document.addEventListener('DOMContentLoaded', () => {
  updateYN(50);
  document.getElementById('nav-seed').textContent = 'SEED ' + LCG.getSeed();
  const bf = document.getElementById('ball-face');
  if (bf) { bf.textContent = '8'; bf.className = 'ball-face idle'; }
});
