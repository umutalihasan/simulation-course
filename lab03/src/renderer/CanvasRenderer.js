import { getCellColor } from './ColorMap.js';

export class CanvasRenderer {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.grid   = grid;
    this._calcSize();
  }

  _calcSize() {
    // Kesirli boyut — canvas'ı tam doldurur, siyah şerit kalmaz
    this.cellW = this.canvas.width  / this.grid.cols;
    this.cellH = this.canvas.height / this.grid.rows;
  }

  resize() {
    this.canvas.width  = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
    this._calcSize();
  }

  render(params) {
    const { ctx, grid, cellW, cellH } = this;

    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        ctx.fillStyle = getCellColor(grid.get(x, y));
        ctx.fillRect(
          Math.floor(x * cellW),
          Math.floor(y * cellH),
          Math.ceil(cellW),
          Math.ceil(cellH),
        );
      }
    }

    // Yıldırım efekti
    if (params._lastLightning) {
      const { x, y, age } = params._lastLightning;
      if (age < 6) {
        ctx.strokeStyle = `rgba(255,255,200,${0.9 - age * 0.15})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          Math.floor(x * cellW),
          Math.floor(y * cellH),
          Math.ceil(cellW),
          Math.ceil(cellH),
        );
        params._lastLightning.age++;
      } else {
        params._lastLightning = null;
      }
    }
  }

  canvasToGrid(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (this.canvas.width  / rect.width);
    const py = (clientY - rect.top)  * (this.canvas.height / rect.height);
    return {
      x: Math.min(this.grid.cols - 1, Math.floor(px / this.cellW)),
      y: Math.min(this.grid.rows - 1, Math.floor(py / this.cellH)),
    };
  }
}