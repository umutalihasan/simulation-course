#  Forest Fire — Клеточный Автомат

Веб-симуляция возникновения и распространения лесных пожаров на основе двумерного клеточного автомата. Реализована на чистом JavaScript (ES Modules) с рендерингом через HTML5 Canvas — без сборщиков и внешних зависимостей.

Live Demo: https://umut.ipmkn.ru

---

##  Содержание

- [Запуск](#запуск)
- [Структура проекта](#структура-проекта)
- [Состояния клеток](#состояния-клеток)
- [Правила системы](#правила-системы)
- [Параметры симуляции](#параметры-симуляции)
- [Управление](#управление)
- [Архитектура и ключевые решения](#архитектура-и-ключевые-решения)
- [Разбор кода по модулям](#разбор-кода-по-модулям)
- [Технические детали](#технические-детали)

---

##  Запуск

ES Modules требуют HTTP-сервера. Откройте терминал в папке проекта:

```bash
# Node.js (рекомендуется)
npx serve .

# Python 3
python -m http.server 8080

# VS Code: расширение Live Server
```

Затем откройте в браузере: `http://localhost:3000`

> !!!!!! Открытие `index.html` двойным кликом (`file://`) **не работает** — браузер блокирует ES Modules по соображениям безопасности.

---

##  Структура проекта

```
forest-fire-ca/
│
├── index.html                  # Точка входа, разметка интерфейса
├── style.css                   # Стили UI
│
└── src/
    ├── main.js                 # Инициализация, игровой цикл, EventBus-оркестровка
    │
    ├── core/
    │   ├── Cell.js             # Константы состояний клеток
    │   ├── Grid.js             # Двумерный буфер (Uint8Array × 2), двойная буферизация
    │   └── Automaton.js        # Движок CA: шаг симуляции, порядок применения правил
    │
    ├── rules/
    │   ├── BaseRules.js        # Базовые правила CA
    │   ├── WindRule.js         # Доп. правило 1: ветер
    │   ├── HumidityRule.js     # Доп. правило 2: влажность и дождь
    │   ├── LightningRule.js    # Доп. правило 3: молнии (распределение Пуассона)
    │   └── FirebreakRule.js    # Доп. правило 4: противопожарные заграждения
    │
    ├── renderer/
    │   ├── CanvasRenderer.js   # Отрисовка на Canvas с дробным размером клетки
    │   └── ColorMap.js         # Цвета состояний, динамические цвета огня и деревьев
    │
    ├── ui/
    │   ├── Controls.js         # Кнопки Play/Pause/Step/Reset/Clear
    │   ├── ParameterPanel.js   # Слайдеры и переключатели правил
    │   ├── StatsPanel.js       # Живая статистика
    │   └── Toolbar.js          # Кисть и кнопки экспорта
    │
    └── utils/
        ├── EventBus.js         # Singleton pub/sub шина событий
        └── GridExporter.js     # Экспорт в PNG и JSON
```

---

##  Состояния клеток

Каждая клетка хранится как один байт (`Uint8Array`). Возможные значения:

| Константа    | Значение | Цвет                  | Описание                                        |
|--------------|----------|-----------------------|-------------------------------------------------|
| `EMPTY`      | `0`      | 🟫 Тёмно-коричневый   | Пустая земля, может зарасти деревом             |
| `TREE`       | `1`      | 🟢 Зелёный            | Здоровое дерево                                 |
| `BURNING`    | `2`      | 🔴 Красно-оранжевый   | Активный огонь                                  |
| `BURNED`     | `3`      | ⬛ Чёрный             | Зола → в следующем шаге становится `EMPTY`      |
| `WET`        | `4`      | 🔵 Синий              | Влажное дерево, устойчивое к огню               |
| `FIREBREAK`  | `5`      | 🟡 Жёлтый             | Противопожарная полоса, непроницаема для огня   |

```javascript
// src/core/Cell.js
export const EMPTY     = 0;
export const TREE      = 1;
export const BURNING   = 2;
export const BURNED    = 3;
export const WET       = 4;
export const FIREBREAK = 5;
```

---

##  Правила системы

### Базовые правила (`BaseRules.js`)

| Текущее состояние | Условие                                              | Следующее состояние |
|-------------------|------------------------------------------------------|---------------------|
| `BURNING`         | всегда                                               | `BURNED`            |
| `BURNED`          | всегда                                               | `EMPTY`             |
| `EMPTY`           | `Math.random() < growProb`                           | `TREE`              |
| `TREE`            | горящий сосед + `Math.random() < spreadProb`         | `BURNING`           |
| `WET`             | `Math.random() < 0.015`                              | `TREE`              |
| `FIREBREAK`       | всегда                                               | `FIREBREAK`         |

Проверяются все **8 соседей** (окрестность Мура).

```javascript
// src/rules/BaseRules.js
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
```

---

### Доп. правило 1 — Ветер (`WindRule.js`)

Ветер асимметрично изменяет вероятность распространения огня.

**С наветренной стороны** (откуда дует ветер) — вероятность возгорания увеличивается:
```
P_boost = spreadProb + windStrength × (1 − spreadProb)
```

**С подветренной стороны** — вероятность уменьшается:
```
P_reduced = spreadProb × (1 − windStrength × 0.5)
```

```javascript
// src/rules/WindRule.js
const VECTORS = {
  N:  [  0, -1 ], S:  [ 0,  1 ], E:  [  1, 0 ], W:  [ -1, 0 ],
  NE: [  1, -1 ], NW: [-1, -1 ], SE: [  1, 1 ], SW: [ -1, 1 ],
};

export function applyWindRule(x, y, state, grid, params) {
  if (state !== TREE) return null;

  const [dx, dy] = VECTORS[params.windDir] ?? VECTORS['N'];

  const upwindBurning   = grid.get(x - dx, y - dy) === BURNING;
  const downwindBurning = grid.get(x + dx, y + dy) === BURNING;

  if (upwindBurning) {
    const boost = params.spreadProb + params.windStrength * (1 - params.spreadProb);
    if (Math.random() < boost) return BURNING;
  }

  if (downwindBurning && !upwindBurning) {
    const reduced = params.spreadProb * (1 - params.windStrength * 0.5);
    if (Math.random() < reduced) return BURNING;
  }

  return null; // null = не изменять результат BaseRules
}
```

---

### Доп. правило 2 — Влажность и дождь (`HumidityRule.js`)

Работает на двух уровнях:

**На уровне клетки** — перехватывает переход `TREE → BURNING` и может заменить его на `WET`:
```
Если humidity > 0.5:
  P(WET) = (humidity − 0.5) × 0.6
```

**Эффект дождя** — применяется ко всей сетке после `swap()`. Активен только при `humidity > 0.7`:
```
P(TREE → WET)    = (humidity − 0.7) × 0.02   // макс. ≈ 0.006
P(BURNING → WET) = P × 0.3
```

```javascript
// src/rules/HumidityRule.js
export function applyHumidityRule(x, y, proposedNext, params) {
  if (proposedNext !== BURNING) return null;
  if (params.humidity < 0.5) return null;
  if (Math.random() < (params.humidity - 0.5) * 0.6) return WET;
  return null;
}

export function applyRainEffect(grid, params) {
  if (!params.enableHumidity || params.humidity < 0.7) return;
  const prob = (params.humidity - 0.7) * 0.02;
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const s = grid.get(x, y);
      if (s === TREE    && Math.random() < prob)       grid.set(x, y, WET);
      if (s === BURNING && Math.random() < prob * 0.3) grid.set(x, y, WET);
    }
  }
}
```

---

### Доп. правило 3 — Молнии (`LightningRule.js`)

Обеспечивает самопроизвольное возникновение пожаров. Количество ударов за шаг моделируется **распределением Пуассона**:

```
λ = igniteProb × treeCount
k = poissonSample(λ)
```

Алгоритм Кнута для Poisson-сэмплинга при малых λ:
```
L = e^(−λ)
k = 0, p = 1
while p > L: k++, p *= U(0,1)
return k − 1
```

> **Критично:** Правило вызывается **после `grid.swap()`**. Если вызвать до — записи перезапишет следующий кадр.

```javascript
// src/rules/LightningRule.js
export function applyLightningRule(grid, params) {
  const stats     = grid.stats();
  const treeCount = stats[TREE] ?? 0;
  if (treeCount === 0) return;

  const expected = params.igniteProb * treeCount;
  const strikes  = poissonSample(expected);
  if (strikes === 0) return;

  let attempts = 0, hit = 0;
  while (hit < strikes && attempts < strikes * 20) {
    attempts++;
    const x = Math.floor(Math.random() * grid.cols);
    const y = Math.floor(Math.random() * grid.rows);
    if (grid.get(x, y) === TREE) {
      grid.set(x, y, BURNING);
      params._lastLightning = { x, y, age: 0 };
      hit++;
    }
  }
}

function poissonSample(lambda) {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * randn()));
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function randn() {
  // Box-Muller transform
  return Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
}
```

---

### Доп. правило 4 — Противопожарные заграждения (`FirebreakRule.js`)

Клетки `FIREBREAK` полностью непроницаемы для огня. Правило проверяется **первым** в цикле обновления — до базовых правил и всех остальных.

```javascript
// src/rules/FirebreakRule.js
export function applyFirebreakRule(x, y, state, grid) {
  if (grid.get(x, y) === FIREBREAK) return FIREBREAK;
  return null;
}

// Нарисовать горизонтальную или вертикальную полосу заграждений
export function drawFirebreakLine(grid, direction, position, thickness = 2) {
  for (let t = 0; t < thickness; t++) {
    if (direction === 'horizontal') {
      const row = Math.min(position + t, grid.rows - 1);
      for (let x = 0; x < grid.cols; x++) grid.set(x, row, FIREBREAK);
    } else {
      const col = Math.min(position + t, grid.cols - 1);
      for (let y = 0; y < grid.rows; y++) grid.set(col, y, FIREBREAK);
    }
  }
}
```

---

##  Параметры симуляции

| Параметр       | Диапазон      | По умолчанию | Описание                                      |
|----------------|---------------|--------------|-----------------------------------------------|
| Speed (FPS)    | 1 – 60        | 12           | Шагов CA в секунду                            |
| Tree Density   | 0.10 – 0.95   | 0.65         | Начальная плотность деревьев при сбросе       |
| Spread Prob    | 0.00 – 1.00   | 0.80         | Базовая вероятность распространения огня      |
| Lightning Rate | 0 – 0.005     | 0.0005       | Вероятность удара молнии на дерево за шаг     |
| Humidity       | 0.00 – 1.00   | 0.30         | Влажность (дождь активен при > 0.7)           |
| Wind Strength  | 0.00 – 1.00   | 0.40         | Сила влияния ветра                            |
| Wind Direction | 8 направлений | N            | Направление ветра (N/S/E/W/NE/NW/SE/SW)       |
| Grid Cols      | 20 – 400      | 160          | Ширина сетки в клетках                        |
| Grid Rows      | 20 – 300      | 100          | Высота сетки в клетках                        |
| Brush Size     | 1 – 5         | 2            | Радиус кисти (квадрат N×N)                    |

---

##  Управление

### Кнопки

| Кнопка            | Действие                                             |
|-------------------|------------------------------------------------------|
|    Play /   Pause | Запуск / приостановка симуляции                      |
|    Step           | Один шаг вперёд                                      |
|    Reset          | Заполнить сетку деревьями                            |
|    Clear          | Очистить сетку                                       |
|    Apply Grid Size| Пересоздать сетку с новыми Cols × Rows               |
|    PNG            | Сохранить снимок Canvas                              |
|    JSON           | Сохранить дамп состояния                             |

### Рисование

Выберите тип в **Draw Tool** и рисуйте мышью прямо на Canvas. Кисть рисует квадратом N×N.

### Переключение правил

В **Active Rules** каждое правило отключается в реальном времени без остановки симуляции.

---

## Архитектура и ключевые решения

### EventBus — шина событий

Компоненты UI не зависят друг от друга напрямую. Все коммуникации проходят через singleton `EventBus`:

```
Controls       →  bus.emit('ctrl:play')
ParameterPanel →  bus.emit('params:change', { key, value })
Toolbar        →  bus.emit('toolbar:brushChange', { state })

main.js        →  bus.on('ctrl:play')       → меняет running
main.js        →  bus.on('params:change')   → обновляет automaton.params
main.js        →  bus.emit('stats:update')  → после каждого шага

StatsPanel     →  bus.on('stats:update')    → обновляет DOM
Controls       →  bus.on('sim:stateChange') → меняет текст кнопки
```

```javascript
// src/utils/EventBus.js
export class EventBus {
  constructor() {
    this._map = new Map();
  }

  on(event, cb) {
    if (!this._map.has(event)) this._map.set(event, new Set());
    this._map.get(event).add(cb);
    return () => this.off(event, cb); // возвращает функцию отписки
  }

  off(event, cb) { this._map.get(event)?.delete(cb); }

  emit(event, data) { this._map.get(event)?.forEach(cb => cb(data)); }

  once(event, cb) {
    const unsub = this.on(event, data => { cb(data); unsub(); });
  }
}

export const bus = new EventBus(); // singleton
```

### Двойная буферизация сетки

`Grid` хранит два `Uint8Array` — `cells` (текущий кадр) и `next` (следующий). Это исключает побочные эффекты при обновлении: правило для клетки `(x,y)` читает состояние соседей из `cells`, но пишет результат в `next`.

```javascript
// src/core/Grid.js
export class Grid {
  constructor(cols, rows) {
    this.cols  = cols;
    this.rows  = rows;
    this.cells = new Uint8Array(cols * rows); // текущий кадр
    this.next  = new Uint8Array(cols * rows); // следующий кадр
  }

  get(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return EMPTY;
    return this.cells[y * this.cols + x];
  }

  setNext(x, y, v) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
    this.next[y * this.cols + x] = v;
  }

  // O(1) — просто меняем указатели, без копирования
  swap() {
    const t = this.cells;
    this.cells = this.next;
    this.next = t;
  }

  copyToNext() { this.next.set(this.cells); }

  // Окрестность Мура (8 соседей)
  neighbors(x, y) {
    return [
      [x-1, y], [x+1, y], [x, y-1], [x, y+1],
      [x-1, y-1], [x+1, y-1], [x-1, y+1], [x+1, y+1],
    ];
  }

  stats() {
    const c = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < this.cells.length; i++) c[this.cells[i]]++;
    return c;
  }
}
```

### Порядок шага симуляции (`Automaton.step`)

Порядок применения правил и момент вызова `swap()` критически важны:

```javascript
// src/core/Automaton.js
step() {
  const { grid, params } = this;

  grid.copyToNext(); // 1. Скопировать текущий кадр в next

  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const cur = grid.get(x, y); // читаем из cells

      // Правило 4: Firebreak — наивысший приоритет
      if (params.enableFirebreak) {
        const fb = applyFirebreakRule(x, y, cur, grid);
        if (fb !== null) { grid.setNext(x, y, fb); continue; }
      }

      // Правило 1: базовые переходы
      let next = applyBaseRules(x, y, cur, grid, params);

      // Правило 2: ветер может изменить результат
      if (params.enableWind) {
        const wr = applyWindRule(x, y, cur, grid, params);
        if (wr !== null) next = wr;
      }

      // Правило 3: влажность может отменить возгорание
      if (params.enableHumidity) {
        const hr = applyHumidityRule(x, y, next, params);
        if (hr !== null) next = hr;
      }

      grid.setNext(x, y, next); // пишем в next
    }
  }

  grid.swap(); // 2. Теперь next становится cells

  // ВАЖНО: дождь и молнии вызываются ПОСЛЕ swap(),
  // иначе их записи будут перезаписаны на следующем шаге
  if (params.enableHumidity)  applyRainEffect(grid, params);
  if (params.enableLightning) applyLightningRule(grid, params);

  this.generation++;
}
```

### Дробный размер клетки в Canvas

`Math.floor` при вычислении целочисленного `cellSize` оставляет чёрные полосы при нестандартных размерах сетки (например, 500×100 на canvas шириной 1400px: `1400/500 = 2.8 → floor = 2 → 500×2 = 1000px`, 400px пустых). Решение — дробные `cellW` и `cellH`:

```javascript
// src/renderer/CanvasRenderer.js
_calcSize() {
  this.cellW = this.canvas.width  / this.grid.cols; // например, 2.8
  this.cellH = this.canvas.height / this.grid.rows;
}

render(params) {
  const { ctx, grid, cellW, cellH } = this;
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      ctx.fillStyle = getCellColor(grid.get(x, y));
      ctx.fillRect(
        Math.floor(x * cellW),  // позиция — floor
        Math.floor(y * cellH),
        Math.ceil(cellW),        // размер — ceil, перекрывает зазор
        Math.ceil(cellH),
      );
    }
  }
}

// Перевод координат мыши → индекс клетки
canvasToGrid(clientX, clientY) {
  const rect = this.canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (this.canvas.width  / rect.width);
  const py = (clientY - rect.top)  * (this.canvas.height / rect.height);
  return {
    x: Math.min(this.grid.cols - 1, Math.floor(px / this.cellW)),
    y: Math.min(this.grid.rows - 1, Math.floor(py / this.cellH)),
  };
}
```

### UI-компоненты

Каждый компонент отвечает только за свою часть DOM и общается через шину:

```javascript
// src/ui/Controls.js — кнопки управления
export class Controls {
  constructor({ btnPlay, btnStep, btnReset, btnClear }) {
    btnPlay.addEventListener('click',  () => bus.emit('ctrl:play'));
    btnStep.addEventListener('click',  () => bus.emit('ctrl:step'));
    btnReset.addEventListener('click', () => bus.emit('ctrl:reset'));
    btnClear.addEventListener('click', () => bus.emit('ctrl:clear'));

    bus.on('sim:stateChange', ({ running }) => {
      btnPlay.textContent = running ? '⏸ Pause' : '▶ Play';
      btnPlay.classList.toggle('active', running);
    });
  }
}
```

```javascript
// src/ui/StatsPanel.js — живая статистика
export class StatsPanel {
  constructor() {
    this._els = {
      gen: document.getElementById('stat-gen'),
      tree: document.getElementById('stat-tree'),
      // ...
    };
    bus.on('stats:update', ({ counts, generation, total }) => {
      this._render(counts, generation, total);
    });
  }

  _render(counts, generation, total) {
    const coverPct = (((counts[TREE] ?? 0) + (counts[WET] ?? 0)) / total * 100).toFixed(1) + '%';
    this._els.gen.textContent  = generation;
    this._els.tree.textContent = counts[TREE] ?? 0;
    // ...
  }
}
```

---

## Технические детали

| Характеристика     | Решение                                                              |
|--------------------|----------------------------------------------------------------------|
| Язык               | Vanilla JS (ES2020, ES Modules)                                      |
| Рендеринг          | HTML5 Canvas 2D, `image-rendering: pixelated`                        |
| Хранение сетки     | `Uint8Array` — 1 байт на клетку, два буфера                         |
| Игровой цикл       | `requestAnimationFrame` + контроль FPS по временно́й метке           |
| Коммуникация       | EventBus (pub/sub), без прямых зависимостей между компонентами       |
| Молнии             | Распределение Пуассона (алгоритм Кнута) + Box-Muller для больших λ  |
| Заполнение Canvas  | Дробные `cellW/cellH` + `Math.floor/ceil` — нет чёрных полос        |
| Шрифты             | Oxanium (Google Fonts CDN)                                           |
| Зависимости        | Нет (только Google Fonts по CDN)                                     |
| Браузеры           | Chrome 80+, Firefox 80+, Safari 14+, Edge 80+                        |

---


