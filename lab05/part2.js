/**
 * part2.js — Лабораторная 5.2: «Шар предсказаний» (Magic 8-Ball)
 *
 * СТРУКТУРА:
 *   Ответы сгруппированы по типу (позитивные / нейтральные / негативные).
 *   Пользователь задаёт вероятности ГРУПП — p(pos), p(neu), p(neg).
 *   Последняя (neg) = 1 − p(pos) − p(neu) — автоматически (Слайд 6, Лекция).
 *
 * АЛГОРИТМ (Слайд 7):
 *   A := α;  k := 1
 *   цикл: A := A − pₖ
 *         если A ≤ 0 → выбрана группа k  (выход)
 *         иначе:  k := k + 1
 *   Внутри группы: второй вызов МКГ → случайный ответ из группы.
 *
 * СТАТИСТИКА (Слайд 9):
 *   Statistics[m] = 0;  n = 0
 *   while n < N:
 *     генерация события → k;  Statistics[k]++;  n++
 *   Frequency[k] = Statistics[k] / N
 */

// ── Ответы ─────────────────────────────────────────────────────────────────────
const ANSWERS = {
  positive: [
    "Бесспорно",
    "Предрешено",
    "Никаких сомнений",
    "Определённо да",
    "Можешь быть уверен в этом",
    "Вероятнее всего",
    "Хорошие перспективы",
    "Знаки говорят — да",
    "Да",
  ],
  neutral: [
    "Пока не ясно, попробуй снова",
    "Спроси позже",
    "Лучше не рассказывать",
    "Сейчас нельзя предсказать",
    "Сконцентрируйся и спроси опять",
  ],
  negative: [
    "Не рассчитывай на это",
    "Мой ответ — нет",
    "Весьма сомнительно",
    "Перспективы не очень хорошие",
  ],
};

const GROUPS = ['positive', 'neutral', 'negative'];
// Плоский список всех ответов для статистики
const ALL_ANSWERS = [...ANSWERS.positive, ...ANSWERS.neutral, ...ANSWERS.negative];
const M = ALL_ANSWERS.length; // 18 исходов

// Вероятности групп — p(neg) всегда = 1 − p(pos) − p(neu)
let pPos = 0.50; // 9 ответов → ~0.50
let pNeu = 0.28; // 5 ответов → ~0.28
// pNeg = 1 − pPos − pNeu  (4 ответа → ~0.22)

function getPNeg() {
  return Math.max(0, parseFloat((1 - pPos - pNeu).toFixed(4)));
}

// Statistics[k] — счётчик для каждого ответа (Слайд 9)
let statistics2 = new Array(M).fill(0);
let N2 = 0;

let litIdx = -1; // подсвеченная строка

// ── Алгоритм Слайда 7 ─────────────────────────────────────────────────────────
/**
 * Выбор группы методом кумулятивного вычитания (Слайд 7):
 *   A := α;  k := 1
 *   цикл: A := A − pₖ;  если A ≤ 0 → группа k
 */
function pickGroup(alpha) {
  const groupProbs = [pPos, pNeu, getPNeg()];
  let A = alpha;           // A := α
  for (let k = 0; k < groupProbs.length; k++) {
    A = A - groupProbs[k]; // A := A − pₖ
    if (A <= 0) return GROUPS[k]; // если A ≤ 0 → произошло Aₖ
  }
  return GROUPS[GROUPS.length - 1]; // страховка
}

/**
 * Выбор конкретного ответа внутри группы: второй вызов МКГ.
 */
function pickAnswer(group) {
  const list = ANSWERS[group];
  const idx  = Math.floor(LCG.next() * list.length);
  return { text: list[idx], group, globalIdx: ALL_ANSWERS.indexOf(list[idx]) };
}

// ── Рендер UI ─────────────────────────────────────────────────────────────────
function renderGroupControls() {
  document.getElementById('prob-pos').value = pPos.toFixed(2);
  document.getElementById('prob-neu').value = pNeu.toFixed(2);
  document.getElementById('prob-neg').value = getPNeg().toFixed(2);
  updateSumBar();
}

function onProbChange() {
  pPos = parseFloat(document.getElementById('prob-pos').value) || 0;
  pNeu = parseFloat(document.getElementById('prob-neu').value) || 0;
  document.getElementById('prob-neg').value = getPNeg().toFixed(2);
  updateSumBar();
}

function updateSumBar() {
  const s = pPos + pNeu + getPNeg();
  const valEl  = document.getElementById('sum-val');
  const fillEl = document.getElementById('sum-fill');
  if (!valEl || !fillEl) return;
  valEl.textContent = s.toFixed(3);
  valEl.className   = 'sum-val ' + (Math.abs(s - 1) < 0.005 ? 'ok' : 'err');
  fillEl.style.width      = Math.min(s * 100, 100) + '%';
  fillEl.style.background = Math.abs(s - 1) < 0.005 ? 'var(--yes)' : 'var(--no)';
}

function renderAnswerTable() {
  const list = document.getElementById('outcomes-list');
  list.innerHTML = '';

  let globalIdx = 0;
  for (const grp of GROUPS) {
    // Заголовок группы
    const header = document.createElement('div');
    header.className = 'oc-group-header oc-gh-' + grp;
    const labels = { positive: '+ ПОЗИТИВНЫЕ', neutral: '~ НЕЙТРАЛЬНЫЕ', negative: '− НЕГАТИВНЫЕ' };
    header.textContent = labels[grp];
    list.appendChild(header);

    for (const text of ANSWERS[grp]) {
      const i = globalIdx;
      const row = document.createElement('div');
      row.className = 'oc-row'; row.id = 'oc-row-' + i;

      const idxEl  = document.createElement('div'); idxEl.className = 'oc-idx'; idxEl.textContent = i + 1;
      const nameEl = document.createElement('div'); nameEl.className = 'oc-name oc-name-' + grp; nameEl.id = 'oc-nm-' + i; nameEl.textContent = text;
      const nkEl   = document.createElement('div'); nkEl.className = 'oc-nk';   nkEl.id = 'oc-nk-' + i;  nkEl.textContent = '0';
      const freqEl = document.createElement('div'); freqEl.className = 'oc-freq'; freqEl.id = 'oc-freq-' + i; freqEl.textContent = '—';

      row.appendChild(idxEl); row.appendChild(nameEl);
      row.appendChild(nkEl);  row.appendChild(freqEl);
      list.appendChild(row);
      globalIdx++;
    }
  }
}

/** Обновить таблицу частот (Слайд 9: Frequency[k] = Statistics[k] / N) */
function updateFrequencyTable() {
  for (let k = 0; k < M; k++) {
    const nkEl   = document.getElementById('oc-nk-' + k);
    const freqEl = document.getElementById('oc-freq-' + k);
    if (nkEl)   nkEl.textContent   = statistics2[k];
    if (freqEl) freqEl.textContent = N2 > 0 ? (statistics2[k] / N2).toFixed(3) : '—';
  }
  document.getElementById('p2-total').textContent = N2;
}

// ── Одиночная генерация ───────────────────────────────────────────────────────
function askBall() {
  const alpha  = LCG.next();
  const group  = pickGroup(alpha);       // Слайд 7: кумулятивное вычитание
  const result = pickAnswer(group);      // второй вызов МКГ

  // Statistics[k]++  (Слайд 9)
  statistics2[result.globalIdx]++;
  N2++;
  updateFrequencyTable();

  _highlightRow(result.globalIdx);
  _animateBall(result, alpha);
  document.getElementById('nav-seed').textContent = 'SEED: ' + LCG.getSeed();
}

/** Слайд 9: запустить N испытаний */
function runBallSimulation() {
  const N = parseInt(document.getElementById('sim-n-2').value) || 100;

  // Statistics[m] = 0 — сброс
  statistics2 = new Array(M).fill(0);
  N2 = 0;

  // while n < N: генерация → k;  Statistics[k]++;  n++
  for (let n = 0; n < N; n++) {
    const alpha  = LCG.next();
    const group  = pickGroup(alpha);
    const result = pickAnswer(group);
    statistics2[result.globalIdx]++;
    N2++;
  }

  // Frequency[k] = Statistics[k] / N — показываем
  updateFrequencyTable();
  document.getElementById('nav-seed').textContent = 'SEED: ' + LCG.getSeed();

  // Показать итог в дисплее
  const ansMain = document.getElementById('ans-main');
  const ansSub  = document.getElementById('ans-sub');
  const placeholder = document.querySelector('.ans-placeholder');
  if (placeholder) placeholder.style.display = 'none';
  ansMain.textContent = `Симуляция: N = ${N}`;
  ansMain.style.color = 'var(--accent)';
  ansSub.textContent  = `p̂(+) = ${(statistics2.slice(0,9).reduce((a,b)=>a+b,0)/N2).toFixed(3)}  ·  p̂(~) = ${(statistics2.slice(9,14).reduce((a,b)=>a+b,0)/N2).toFixed(3)}  ·  p̂(−) = ${(statistics2.slice(14).reduce((a,b)=>a+b,0)/N2).toFixed(3)}`;
  ansMain.classList.add('show'); ansSub.classList.add('show');
}

function _highlightRow(idx) {
  if (litIdx >= 0) document.getElementById('oc-row-' + litIdx)?.classList.remove('lit');
  const row = document.getElementById('oc-row-' + idx);
  row?.classList.add('lit');
  row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  litIdx = idx;
}

function _animateBall(result, alpha) {
  const ball     = document.getElementById('ball');
  const ballFace = document.getElementById('ball-face');
  ball.classList.remove('rolling');
  ballFace.classList.remove('show', 'idle');
  ballFace.textContent = '8';
  void ball.offsetWidth;
  ball.classList.add('rolling');

  const colors = { positive: 'var(--yes)', neutral: '#f0a500', negative: 'var(--no)' };

  setTimeout(() => {
    ballFace.textContent = result.text;
    ballFace.style.color = colors[result.group];
    ballFace.className   = 'ball-face show';
  }, 420);

  const ansMain     = document.getElementById('ans-main');
  const ansSub      = document.getElementById('ans-sub');
  const placeholder = document.querySelector('.ans-placeholder');
  ansMain.classList.remove('show'); ansSub.classList.remove('show');

  setTimeout(() => {
    const q = document.getElementById('q-input').value.trim();
    if (placeholder) placeholder.style.display = 'none';
    ansMain.textContent = result.text;
    ansMain.style.color = colors[result.group];
    const pGroup = { positive: pPos, neutral: pNeu, negative: getPNeg() };
    ansSub.textContent  = (q ? `«${q}» · ` : '') +
      `α = ${alpha.toFixed(5)} · группа: ${result.group} (p=${pGroup[result.group].toFixed(2)})`;
    ansMain.classList.add('show'); ansSub.classList.add('show');
  }, 500);
}

// ── Инициализация ─────────────────────────────────────────────────────────────
renderGroupControls();
renderAnswerTable();

document.addEventListener('DOMContentLoaded', () => {
  const bf = document.getElementById('ball-face');
  if (bf) { bf.textContent = '8'; bf.className = 'ball-face idle'; }
});
