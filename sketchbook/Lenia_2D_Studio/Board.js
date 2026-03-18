
/**
 * @file Board.js
 * @description Lenia world board - fully ported from LeniaND.py with transforms, crop, and serialization
 * @author @eanutt1272.v2
 * @version 2.0.0 (LeniaND port)
 */
class Board {
  constructor(size) {
    this.size = size;
    this.cells = this._createGrid();
    this.potential = this._createGrid();
    this.field = this._createGrid();
    this.fieldOld = null;
    
    // Metadata (LeniaND port)
    this.names = ['', '', ''];  // [code, name, cname]
    this.params = {
      R: 13,
      T: 10,
      b: [1],
      m: 0.15,
      s: 0.015,
      kn: 1,
      gn: 1
    };
  }

  _createGrid() {
    return new Float32Array(this.size * this.size);
  }

  _index(x, y) {
    return y * this.size + x;
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
    if (!pattern.cells) return;

    const grid = RLEParser.parse(pattern.cells);
    this.clear();

    const h = grid.length;
    const w = grid[0].length;
    const sy = Math.floor((this.size - h) / 2);
    const sx = Math.floor((this.size - w) / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const targetY = sy + y;
        const targetX = sx + x;
        if (targetY >= 0 && targetY < this.size && targetX >= 0 && targetX < this.size) {
          this.cells[this._index(targetX, targetY)] = grid[y][x];
        }
      }
    }
  }

  placePattern(pattern, cellX, cellY) {
    if (!pattern.cells) return;

    const grid = RLEParser.parse(pattern.cells);
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

  resize(newSize) {
    this.size = newSize;
    this.cells = this._createGrid();
    this.potential = this._createGrid();
    this.field = this._createGrid();
    this.fieldOld = null;
  }

  // LeniaND port: advanced transforms
  add(board, shift = [0, 0], isCentered = true) {
    const shift0 = shift[0] || 0;
    const shift1 = shift[1] || 0;
    const size0 = this.size;
    const size1 = board.size;
    const size_min = Math.min(size0, size1);

    for (let iy = 0; iy < size_min; iy++) {
      for (let ix = 0; ix < size_min; ix++) {
        const start0 = isCentered ? (size0 - size_min) / 2 + shift0 : shift0;
        const start1 = isCentered ? (size1 - size_min) / 2 : 0;

        const idx0 = ((start0 + ix) % size0 + size0) % size0;
        const idx1 = (start1 + ix) % size1;

        const iy0 = ((start0 + iy) % size0 + size0) % size0;
        const iy1 = (start1 + iy) % size1;

        if (board.cells[iy1 * size1 + idx1] > 1e-10) {
          this.cells[iy0 * size0 + idx0] = board.cells[iy1 * size1 + idx1];
        }
      }
    }
    return this;
  }

  // Rotate the board 2D (angle in degrees)
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

  // Scale/zoom the board
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

  // Flip the board (flip_mode: 0=horizontal, 1=vertical, 2=diagonal)
  flip(flipMode = 0) {
    const newCells = this._createGrid();

    if (flipMode === 0) {
      // Horizontal flip
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          newCells[y * this.size + x] = this.cells[y * this.size + (this.size - 1 - x)];
        }
      }
    } else if (flipMode === 1) {
      // Vertical flip
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          newCells[y * this.size + x] = this.cells[(this.size - 1 - y) * this.size + x];
        }
      }
    } else if (flipMode === 2) {
      // Transpose (main diagonal)
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          newCells[y * this.size + x] = this.cells[x * this.size + y];
        }
      }
    }

    this.cells.set(newCells);
    return this;
  }

  // Shift the board (wrap-around)
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

  // Crop to non-empty region
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
          newCells[y * newSize + x] = this.cells[(minY + y) * this.size + (minX + x)];
        }
      }
    }

    this.size = newSize;
    this.cells = newCells;
    this.potential = this._createGrid();
    this.field = this._createGrid();
    return this;
  }

  // Get statistics about the board
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

  // Export to JSON with RLE encoding (LeniaND compatible)
  toJSON() {
    const stats = this.getStats();
    return {
      size: this.size,
      params: this.params,
      cells: this._cellsToRLE(),
      stats: stats,
      names: this.names
    };
  }

  // Import from JSON
  static fromJSON(data) {
    const board = new Board(data.size || 128);
    if (data.params) {
      board.params = { ...board.params, ...data.params };
    }
    if (data.names) {
      board.names = data.names;
    }
    if (data.cells) {
      board._cellsFromRLE(data.cells);
    }
    return board;
  }

  _cellsToRLE() {
    // Simple RLE encoding: value,count pairs
    let rle = '';
    let lastVal = -1;
    let count = 0;

    for (let i = 0; i < this.cells.length; i++) {
      const val = Math.round(this.cells[i] * 255);

      if (val === lastVal) {
        count++;
      } else {
        if (count > 0) {
          rle += (count > 1 ? count : '') + Board.val2ch(lastVal) + ' ';
        }
        lastVal = val;
        count = 1;
      }
    }

    if (count > 0) {
      rle += (count > 1 ? count : '') + Board.val2ch(lastVal) + '!';
    }

    return rle;
  }

  _cellsFromRLE(rle) {
    let idx = 0;
    let count = '';

    for (let i = 0; i < rle.length; i++) {
      const ch = rle[i];

      if (ch >= '0' && ch <= '9') {
        count += ch;
      } else if (ch === '!' || ch === ' ') {
        continue;
      } else {
        const n = count ? parseInt(count) : 1;
        const val = Board.ch2val(ch) / 255;

        for (let j = 0; j < n; j++) {
          if (idx < this.cells.length) {
            this.cells[idx++] = val;
          }
        }
        count = '';
      }
    }
  }

  static ch2val(c) {
    if (c === '.' || c === 'b') return 0;
    if (c === 'o') return 255;
    if (c.length === 1) return Math.min(255, ord(c) - ord('A') + 1);
    return Math.min(255, (ord(c[0]) - ord('p')) * 24 + (ord(c[1]) - ord('A') + 25));
  }

  static val2ch(v) {
    if (v === 0) return '.';
    if (v < 25) return String.fromCharCode(65 + v - 1);
    return String.fromCharCode(112 + Math.floor((v - 25) / 24)) + String.fromCharCode(65 + ((v - 25) % 24));
  }

  static get EPSILON() {
    return 1e-10;
  }
}

function ord(c) {
  return c.charCodeAt(0);
}