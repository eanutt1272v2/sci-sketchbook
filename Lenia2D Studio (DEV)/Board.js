class Board {
  constructor(size) {
    this.size = size;
    this.cells = this._createGrid();
    this.potential = this._createGrid();
    this.field = this._createGrid();
    this.fieldOld = null;
  }

  _createGrid() {
    return Array(this.size).fill(0).map(() => Array(this.size).fill(0));
  }

  clear() {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        this.cells[y][x] = 0;
      }
    }
    this.fieldOld = null;
  }

  randomise(kernelRadius) {
    this.clear();
    const numBlobs = Math.floor(Math.random() * 25) + 15;

    for (let i = 0; i < numBlobs; i++) {
      const cx = Math.floor(Math.random() * this.size);
      const cy = Math.floor(Math.random() * this.size);
      const dim = Math.floor(kernelRadius * 0.9);

      for (let dy = 0; dy < dim; dy++) {
        for (let dx = 0; dx < dim; dx++) {
          const y = (cy + dy - Math.floor(dim / 2) + this.size) % this.size;
          const x = (cx + dx - Math.floor(dim / 2) + this.size) % this.size;
          this.cells[y][x] = Math.random() * 0.9;
        }
      }
    }
  }

  loadPattern(pattern) {
    if (!pattern.cells) return;

    const grid = RLEParser.parse(pattern.cells);
    this.clear();

    const h = grid.length, w = grid[0].length;
    const sy = Math.floor((this.size - h) / 2);
    const sx = Math.floor((this.size - w) / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const targetY = sy + y;
        const targetX = sx + x;
        if (targetY >= 0 && targetY < this.size && targetX >= 0 && targetX < this.size) {
          this.cells[targetY][targetX] = grid[y][x];
        }
      }
    }
  }

  placePattern(pattern, cellX, cellY) {
    if (!pattern.cells) return;

    const grid = RLEParser.parse(pattern.cells);
    const h = grid.length, w = grid[0].length;
    const sy = cellY - Math.floor(h / 2);
    const sx = cellX - Math.floor(w / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ty = (sy + y + this.size) % this.size;
        const tx = (sx + x + this.size) % this.size;
        this.cells[ty][tx] = grid[y][x];
      }
    }
  }

  resize(newSize) {
    this.size = newSize;
    this.cells = this._createGrid();
    this.potential = this._createGrid();
    this.field = this._createGrid();
    this.fieldOld = null;
  }
}