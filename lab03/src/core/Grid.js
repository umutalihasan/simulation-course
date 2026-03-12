import { EMPTY, TREE } from './Cell.js';

export class Grid {
  constructor(cols, rows) {
    this.cols  = cols;
    this.rows  = rows;
    this.cells = new Uint8Array(cols * rows);
    this.next  = new Uint8Array(cols * rows);
  }

  _idx(x, y) { return y * this.cols + x; }

  get(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return EMPTY;
    return this.cells[this._idx(x, y)];
  }

  set(x, y, v) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
    this.cells[this._idx(x, y)] = v;
  }

  setNext(x, y, v) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
    this.next[this._idx(x, y)] = v;
  }

  swap()        { const t = this.cells; this.cells = this.next; this.next = t; }
  copyToNext()  { this.next.set(this.cells); }

  neighbors(x, y) {
    return [
      [x-1, y], [x+1, y], [x, y-1], [x, y+1],
      [x-1, y-1], [x+1, y-1], [x-1, y+1], [x+1, y+1],
    ];
  }

  fill(density = 0.65) {
    for (let i = 0; i < this.cells.length; i++)
      this.cells[i] = Math.random() < density ? TREE : EMPTY;
  }

  clear() { this.cells.fill(EMPTY); this.next.fill(EMPTY); }

  stats() {
    const c = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < this.cells.length; i++) c[this.cells[i]]++;
    return c;
  }
}
