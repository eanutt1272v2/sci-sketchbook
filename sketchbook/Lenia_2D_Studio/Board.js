class Board {
  constructor(size) {
    this.size = size;
    this.cells = this._createGrid();
    this.potential = this._createGrid();
    this.field = this._createGrid();
    this.fieldOld = null;
    this.params = {
      R: 13,
      T: 10,
      b: [1],
      m: 0.15,
      s: 0.015,
      kn: 1,
      gn: 1,
    };
  }

  _createGrid() {
    return new Float32Array(this.size * this.size);
  }

  _index(x, y) {
    return y * this.size + x;
  }

  _getPatternGrid(pattern) {
    if (!pattern || !pattern.cells) return null;
    if (!pattern._parsedGrid) {
      pattern._parsedGrid = RLECodec.parse(pattern.cells);
    }
    return pattern._parsedGrid;
  }

  clear() {
    this.cells.fill(0);
    this.potential.fill(0);
    this.field.fill(0);
    if (this.fieldOld) this.fieldOld.fill(0);
  }

  randomise(kernelRadius) {
    this.clear();
    const numBlobs = Math.floor(Math.random() * 25) + 15;

    for (let i = 0; i < numBlobs; i++) {
      const cx = Math.floor(Math.random() * this.size);
      const cy = Math.floor(Math.random() * this.size);
      const dim = Math.max(1, Math.floor(kernelRadius * 0.9));

      for (let dy = 0; dy < dim; dy++) {
        for (let dx = 0; dx < dim; dx++) {
          const y = (cy + dy - Math.floor(dim / 2) + this.size) % this.size;
          const x = (cx + dx - Math.floor(dim / 2) + this.size) % this.size;
          this.cells[this._index(x, y)] = Math.random() * 0.9;
        }
      }
    }
  }

  loadPattern(pattern) {
    const grid = this._getPatternGrid(pattern);
    if (!grid) return;
    this.clear();

    const h = grid.length;
    const w = grid[0].length;
    const sy = Math.floor((this.size - h) / 2);
    const sx = Math.floor((this.size - w) / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const targetY = sy + y;
        const targetX = sx + x;
        if (
          targetY >= 0 &&
          targetY < this.size &&
          targetX >= 0 &&
          targetX < this.size
        ) {
          this.cells[this._index(targetX, targetY)] = grid[y][x];
        }
      }
    }
  }

  loadPatternScaled(pattern, scale) {
    this.clear();

    if (!pattern || !pattern.cells) return;
    if (Math.abs(scale - 1) < 1e-6) {
      this.loadPattern(pattern);
      return;
    }

    const center = Math.floor(this.size / 2);
    this.placePatternScaled(pattern, center, center, scale);
  }

  placePattern(pattern, cellX, cellY) {
    const grid = this._getPatternGrid(pattern);
    if (!grid) return;
    const h = grid.length;
    const w = grid[0].length;
    const sy = cellY - Math.floor(h / 2);
    const sx = cellX - Math.floor(w / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ty = (sy + y + this.size) % this.size;
        const tx = (sx + x + this.size) % this.size;
        this.cells[this._index(tx, ty)] = grid[y][x];
      }
    }
  }

  placePatternScaled(pattern, cellX, cellY, scale) {
    if (!pattern || !pattern.cells) return;
    if (scale === 1) {
      this.placePattern(pattern, cellX, cellY);
      return;
    }

    const grid = this._getPatternGrid(pattern);
    if (!grid) return;
    const srcH = grid.length;
    const srcW = grid[0].length;

    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const sy = cellY - Math.floor(dstH / 2);
    const sx = cellX - Math.floor(dstW / 2);

    for (let dy = 0; dy < dstH; dy++) {
      for (let dx = 0; dx < dstW; dx++) {
        const srcXf = dx / scale;
        const srcYf = dy / scale;

        const x0 = Math.floor(srcXf);
        const y0 = Math.floor(srcYf);
        const x1 = Math.min(x0 + 1, srcW - 1);
        const y1 = Math.min(y0 + 1, srcH - 1);
        const fx = srcXf - x0;
        const fy = srcYf - y0;

        const v =
          x0 < srcW && y0 < srcH
            ? (grid[y0][x0] || 0) * (1 - fx) * (1 - fy) +
              (grid[y0][x1] || 0) * fx * (1 - fy) +
              (grid[y1][x0] || 0) * (1 - fx) * fy +
              (grid[y1][x1] || 0) * fx * fy
            : 0;

        if (v <= 1e-10) continue;

        const ty = (sy + dy + this.size * 100) % this.size;
        const tx = (sx + dx + this.size * 100) % this.size;
        this.cells[this._index(tx, ty)] = v;
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
  add(board, shift = [0, 0], isCentred = true) {
    const shift0 = shift[0] || 0;
    const shift1 = shift[1] || 0;
    const size0 = this.size;
    const size1 = board.size;
    const size_min = Math.min(size0, size1);

    for (let iy = 0; iy < size_min; iy++) {
      for (let ix = 0; ix < size_min; ix++) {
        const start0 = isCentred ? (size0 - size_min) / 2 + shift0 : shift0;
        const start1 = isCentred ? (size1 - size_min) / 2 : 0;

        const idx0 = (((start0 + ix) % size0) + size0) % size0;
        const idx1 = (start1 + ix) % size1;

        const iy0 = (((start0 + iy) % size0) + size0) % size0;
        const iy1 = (start1 + iy) % size1;

        if (board.cells[iy1 * size1 + idx1] > 1e-10) {
          this.cells[iy0 * size0 + idx0] = board.cells[iy1 * size1 + idx1];
        }
      }
    }
    return this;
  }
  rotate(angle, order = 0) {
    if (angle % 360 === 0) return this;

    const rad = (angle * Math.PI) / 180;
    const cos_a = Math.cos(rad);
    const sin_a = Math.sin(rad);
    const cx = this.size / 2;
    const cy = this.size / 2;
    const newCells = this._createGrid();

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const rx = (x - cx) * cos_a - (y - cy) * sin_a + cx;
        const ry = (x - cx) * sin_a + (y - cy) * cos_a + cy;

        const ix = Math.round(rx);
        const iy = Math.round(ry);

        if (ix >= 0 && ix < this.size && iy >= 0 && iy < this.size) {
          newCells[y * this.size + x] = this.cells[iy * this.size + ix];
        }
      }
    }

    this.cells.set(newCells);
    return this;
  }
  scale(factor) {
    if (factor === 1) return this;

    const oldSize = this.size;
    const newSize = Math.max(1, Math.round(oldSize / factor));
    const newCells = new Float32Array(newSize * newSize);

    for (let y = 0; y < newSize; y++) {
      for (let x = 0; x < newSize; x++) {
        const oldX = Math.round((x / newSize) * oldSize);
        const oldY = Math.round((y / newSize) * oldSize);
        const ox = Math.min(oldX, oldSize - 1);
        const oy = Math.min(oldY, oldSize - 1);
        newCells[y * newSize + x] = this.cells[oy * oldSize + ox];
      }
    }

    this.size = newSize;
    this.cells = newCells;
    this.potential = this._createGrid();
    this.field = this._createGrid();
    return this;
  }
  flip(flipMode = 0) {
    const newCells = this._createGrid();

    if (flipMode === 0) {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          newCells[y * this.size + x] =
            this.cells[y * this.size + (this.size - 1 - x)];
        }
      }
    } else if (flipMode === 1) {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          newCells[y * this.size + x] =
            this.cells[(this.size - 1 - y) * this.size + x];
        }
      }
    } else if (flipMode === 2) {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          newCells[y * this.size + x] = this.cells[x * this.size + y];
        }
      }
    }

    this.cells.set(newCells);
    return this;
  }
  shift(shiftX, shiftY) {
    const newCells = this._createGrid();

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const oldX = (x - shiftX + this.size * 100) % this.size;
        const oldY = (y - shiftY + this.size * 100) % this.size;
        newCells[y * this.size + x] = this.cells[oldY * this.size + oldX];
      }
    }

    this.cells.set(newCells);
    return this;
  }
  crop() {
    const EPSILON = 1e-10;
    let minX = this.size;
    let maxX = -1;
    let minY = this.size;
    let maxY = -1;

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.cells[y * this.size + x] > EPSILON) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX === -1) {
      this.cells.fill(0);
      return this;
    }

    const newW = maxX - minX + 1;
    const newH = maxY - minY + 1;
    const newSize = Math.max(newW, newH);
    const newCells = this._createGrid();

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        if (minX + x < this.size && minY + y < this.size) {
          newCells[y * newSize + x] =
            this.cells[(minY + y) * this.size + (minX + x)];
        }
      }
    }

    this.size = newSize;
    this.cells = newCells;
    this.potential = this._createGrid();
    this.field = this._createGrid();
    return this;
  }
  getStats() {
    let mass = 0;
    let max = 0;

    for (let i = 0; i < this.cells.length; i++) {
      const val = this.cells[i];
      mass += val;
      if (val > max) max = val;
    }

    return { mass, max };
  }
  toJSON() {
    const stats = this.getStats();
    return {
      size: this.size,
      params: this.params,
      cells: this._cellsToRLE(),
      stats: stats,
    };
  }
  static fromJSON(data) {
    const board = new Board(data.size || 128);
    if (data.params) {
      board.params = { ...board.params, ...data.params };
    }
    if (data.cells) {
      board._cellsFromRLE(data.cells);
    }
    return board;
  }

  _cellsToRLE() {
    return RLECodec.encode(this.cells, this.size, this.size);
  }

  _cellsFromRLE(rle) {
    const decoded = RLECodec.decode(rle, this.size, this.size);
    this.cells.set(decoded);
  }

  static get EPSILON() {
    return 1e-10;
  }
}
