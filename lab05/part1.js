/**
 * part1.js — Лабораторная 5.1: «Скажи да или нет»
 *
 * АЛГОРИТМ (Слайд 4):
 *   α ← МКГ()
 *   если α < p(Да) → событие А наступило (ДА)
 *   иначе           → А не наступило (НЕТ)
 *
 * СТАТИСТИКА (Слайд 9):
 *   Statistics[m] = 0;  n = 0
 *   while n < N:
 *     генерация → k;  Statistics[k]++;  n++
 *   Frequency[k] = Statistics[k] / N
 */

let pYes = 0.5;

// Statistics[0] = n_да,  Statistics[1] = n_нет
let stats1 = [0, 0];
let N1 = 0; // общее число попыток

function updateYN(val) {
  pYes = val / 100;
  document.getElementById('yes-disp').textContent = pYes.toFixed(2);
  document.getElementById('no-disp').textContent  = (1 - pYes).toFixed(2);
  document.getElementById('yes-fill').style.width = val + '%';
  document.getElementById('no-fill').style.width  = (100 - val) + '%';
}

/** Одиночная генерация (интерактивный режим) */
function genYN() {
  const alpha = LCG.next();
  const isYes = alpha < pYes;  // Слайд 4: α < p → ДА
  _recordYN(isYes);
  _animateYN(isYes, alpha);
  _updateSeedDisplay();
}

/** Топологически — Слайд 9: запустить N испытаний */
function runYNSimulation() {
  const N = parseInt(document.getElementById('sim-n-1').value) || 100;

  // Statistics[m] = 0 — сброс
  stats1 = [0, 0];
  N1 = 0;

  // while n < N: генерация → k;  Statistics[k]++;  n++
  for (let n = 0; n < N; n++) {
    const alpha = LCG.next();
    const isYes = alpha < pYes;
    _recordYN(isYes);
  }

  // Frequency[k] = Statistics[k] / N — показываем
  _renderStats1();
  _updateSeedDisplay();

  // Анимация последнего результата (просто обновляем индикатор)
  const ansEl = document.getElementById('yn-answer');
  ansEl.textContent = `N = ${N}`;
  ansEl.className = 'result-answer show';
  document.getElementById('yn-alpha').textContent =
    `p̂(Да) = ${(stats1[0]/N1).toFixed(4)}  ·  p̂(Нет) = ${(stats1[1]/N1).toFixed(4)}`;
  document.getElementById('yn-alpha').classList.add('show');
}

function _recordYN(isYes) {
  if (isYes) stats1[0]++; else stats1[1]++;
  N1++;
}

function _renderStats1() {
  document.getElementById('s-total').textContent = N1;
  document.getElementById('s-yes').textContent   = stats1[0];
  document.getElementById('s-no').textContent    = stats1[1];
  // Frequency[k] = Statistics[k] / N
  const freq = N1 > 0 ? (stats1[0] / N1).toFixed(4) : '—';
  document.getElementById('s-freq').textContent = freq;
}

function _animateYN(isYes, alpha) {
  const label = isYes ? 'ДА' : 'НЕТ';
  const ansEl  = document.getElementById('yn-answer');
  const alpEl  = document.getElementById('yn-alpha');
  const idleEl = document.querySelector('#scene-0 .result-idle');

  ansEl.classList.remove('show');
  alpEl.classList.remove('show');
  idleEl.classList.add('hide');
  void ansEl.offsetWidth;

  setTimeout(() => {
    ansEl.textContent = label;
    ansEl.className   = 'result-answer ' + (isYes ? 'yes' : 'no') + ' show';
    alpEl.textContent = `α = ${alpha.toFixed(6)}   p(Да) = ${pYes.toFixed(2)}`;
    alpEl.classList.add('show');
    _renderStats1();
    spawnParticles(isYes);
  }, 60);
}

function _updateSeedDisplay() {
  document.getElementById('nav-seed').textContent = 'SEED: ' + LCG.getSeed();
}

function spawnParticles(isYes) {
  const burst = document.getElementById('burst');
  const color = isYes ? '#00e5a0' : '#ff4d6d';
  burst.innerHTML = '';
  const cx = burst.offsetWidth / 2, cy = burst.offsetHeight / 2;
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (i / 16) * 2 * Math.PI;
    const dist  = 50 + Math.random() * 55;
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${color};
      --tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;
      animation-delay:${Math.random()*0.08}s;`;
    burst.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}
