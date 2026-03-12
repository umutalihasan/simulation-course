import { Grid }              from './core/Grid.js';
import { Automaton }         from './core/Automaton.js';
import { CanvasRenderer }    from './renderer/CanvasRenderer.js';
import { GridExporter }      from './utils/GridExporter.js';
import { bus }               from './utils/EventBus.js';
import { Controls }          from './ui/Controls.js';
import { ParameterPanel }    from './ui/ParameterPanel.js';
import { StatsPanel }        from './ui/StatsPanel.js';
import { Toolbar }           from './ui/Toolbar.js';
import { drawFirebreakLine } from './rules/FirebreakRule.js';
import { TREE, BURNING, BURNED, WET } from './core/Cell.js';

// ── Config ────────────────────────────────────────────────────────
let COLS = 160, ROWS = 100;

// ── Core ──────────────────────────────────────────────────────────
let grid      = new Grid(COLS, ROWS);
let automaton = new Automaton(grid);

// Varsayılan igniteProb'u düzeltilmiş değere ayarla
// Anlamı: her adımda ağaç başına ~0.0005 olasılıkla yıldırım
automaton.params.igniteProb = 0.0005;

// ── Canvas ────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
canvas.width  = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
let renderer  = new CanvasRenderer(canvas, grid);

// ── UI Components ─────────────────────────────────────────────────
new Controls({
  btnPlay:  document.getElementById('btn-play'),
  btnStep:  document.getElementById('btn-step'),
  btnReset: document.getElementById('btn-reset'),
  btnClear: document.getElementById('btn-clear'),
});
new ParameterPanel();
new StatsPanel();
const toolbar = new Toolbar();

// ── State ──────────────────────────────────────────────────────────
let running   = false;
let lastTime  = 0;
let speed     = 12;
let brushSize = 2;
let isDrawing = false;

// ── Init ───────────────────────────────────────────────────────────
grid.fill(automaton.params.treeDensity);
renderer.render(automaton.params);
emitStats();

// ── Game Loop ──────────────────────────────────────────────────────
function loop(ts) {
  requestAnimationFrame(loop);
  if (!running) return;
  if (ts - lastTime < 1000 / speed) return;
  lastTime = ts;
  automaton.step();
  renderer.render(automaton.params);
  emitStats();
}
requestAnimationFrame(loop);

function emitStats() {
  bus.emit('stats:update', {
    counts:     grid.stats(),
    generation: automaton.generation,
    total:      COLS * ROWS,
  });
}

// ── Grid boyutunu yeniden oluştur ──────────────────────────────────
function rebuildGrid(cols, rows) {
  running = false;
  bus.emit('sim:stateChange', { running });

  COLS = cols; ROWS = rows;

  const oldParams = { ...automaton.params };

  grid      = new Grid(COLS, ROWS);
  automaton = new Automaton(grid);
  Object.assign(automaton.params, oldParams);

  // Canvas pixel boyutlarını sıfırla — aksi hâlde cellSize yanlış hesaplanır
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  renderer = new CanvasRenderer(canvas, grid);
  grid.fill(automaton.params.treeDensity);
  renderer.render(automaton.params);
  emitStats();
}

// ── EventBus: Controls ─────────────────────────────────────────────
bus.on('ctrl:play', () => {
  running = !running;
  bus.emit('sim:stateChange', { running });
});

bus.on('ctrl:step', () => {
  automaton.step();
  renderer.render(automaton.params);
  emitStats();
});

bus.on('ctrl:reset', () => {
  running = false;
  bus.emit('sim:stateChange', { running });
  automaton.reset();
  renderer.render(automaton.params);
  emitStats();
});

bus.on('ctrl:clear', () => {
  running = false;
  bus.emit('sim:stateChange', { running });
  automaton.generation = 0;
  grid.clear();
  renderer.render(automaton.params);
  emitStats();
});

// ── EventBus: Params ───────────────────────────────────────────────
bus.on('params:change', ({ key, value }) => {
  if (key === '__speed')     { speed = value; return; }
  if (key === '__brushSize') { brushSize = value; return; }
  automaton.params[key] = value;
});

// ── Grid Size Apply ────────────────────────────────────────────────
document.getElementById('btn-apply-grid').addEventListener('click', () => {
  const cols = Math.max(10, parseInt(document.getElementById('inp-cols').value) || 160);
  const rows = Math.max(10, parseInt(document.getElementById('inp-rows').value) || 100);
  document.getElementById('inp-cols').value = cols;
  document.getElementById('inp-rows').value = rows;
  rebuildGrid(cols, rows);
});

// ── EventBus: Toolbar ──────────────────────────────────────────────
bus.on('toolbar:firebreak',   () => { drawFirebreakLine(grid, 'horizontal', Math.floor(ROWS / 2), 2); renderer.render(automaton.params); });
bus.on('toolbar:export:png',  () => GridExporter.exportPNG(canvas));
bus.on('toolbar:export:json', () => GridExporter.exportJSON(grid, automaton.params, automaton.generation));

// ── Canvas Drawing ─────────────────────────────────────────────────
function paint(clientX, clientY) {
  const { x, y } = renderer.canvasToGrid(clientX, clientY);
  const r = brushSize - 1;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      grid.set(x + dx, y + dy, toolbar.activeBrush);
  renderer.render(automaton.params);
  emitStats();
}

canvas.addEventListener('mousedown',  e => { isDrawing = true; paint(e.clientX, e.clientY); });
canvas.addEventListener('mousemove',  e => { if (isDrawing) paint(e.clientX, e.clientY); });
canvas.addEventListener('mouseup',    () => isDrawing = false);
canvas.addEventListener('mouseleave', () => isDrawing = false);

canvas.addEventListener('touchstart', e => { e.preventDefault(); isDrawing = true; paint(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
canvas.addEventListener('touchmove',  e => { e.preventDefault(); if (isDrawing) paint(e.touches[0].clientX, e.touches[0].clientY); },    { passive: false });
canvas.addEventListener('touchend',   () => isDrawing = false);

// ── Resize ─────────────────────────────────────────────────────────
window.addEventListener('resize', () => { renderer.resize(); renderer.render(automaton.params); });