export class GridExporter {
  static exportPNG(canvas, filename = 'forest-fire.png') {
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  static exportJSON(grid, params, generation, filename = 'forest-fire.json') {
    const data = { generation, cols: grid.cols, rows: grid.rows, cells: Array.from(grid.cells) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.download = filename;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
