class Board {
  constructor(size) {
    this.size = size;
    this._world = this._createGrid();
    this._potential = this._createGrid();
    this._growth = this._createGrid();
    this._growthOld = null;

    Object.defineProperty(this, "world", {
      get: () => this._world,
      set: (v) => {
        this._world = v;
      },
    });
    Object.defineProperty(this, "potential", {
      get: () => this._potential,
      set: (v) => {
        this._potential = v;
      },
    });
    Object.defineProperty(this, "growth", {
      get: () => this._growth,
      set: (v) => {
        this._growth = v;
      },
    });
    Object.defineProperty(this, "growthOld", {
      get: () => this._growthOld,
      set: (v) => {
        this._growthOld = v;
      },
    });

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

  _cellCount() {
    return this.size * this.size;
  }

  _index(x, y) {
    return y * this.size + x;
  }

  _zoomNearestIndex(dstIndex, srcSize, dstSize) {
    if (srcSize <= 1 || dstSize <= 1) return 0;
    const srcPos = (dstIndex * (srcSize - 1)) / (dstSize - 1);
    return Math.max(0, Math.min(srcSize - 1, Math.round(srcPos)));
  }

  _getPatternGrids(pattern) {
    if (!pattern || !pattern.cells) return null;
    if (!pattern._parsedGrids) {
      const raw = Array.isArray(pattern.cells)
        ? pattern.cells
        : [pattern.cells];
      pattern._parsedGrids = raw
        .map((entry) => {
          if (typeof entry === "string") {
            if (entry.includes("%") || entry.includes("#")) {
              const ndSlices = RLECodec.parseND(entry);
              const z0 = ndSlices.find((s) => s.z === 0 && s.w === 0);
              return z0 ? z0.grid : [];
            }
            return RLECodec.parse(entry);
          }
          if (Array.isArray(entry)) return entry;
          return null;
        })
        .filter((grid) => Array.isArray(grid) && grid.length > 0);
    }
    return pattern._parsedGrids;
  }

  clear() {
    this.world.fill(0);
    this.potential.fill(0);
    this.growth.fill(0);
    if (this.growthOld) this.growthOld.fill(0);
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
          this.world[this._index(x, y)] = Math.random() * 0.9;
        }
      }
    }
  }

  randomiseSeeded(kernelRadius, seed = null, isFill = false) {
    const hexSeed = seed || Board._randomHex(8);
    const rng = Board._seededRng(hexSeed);

    this.clear();
    const R = kernelRadius;

    if (isFill) {
      const dim = Math.max(1, this.size - Math.floor(R * 2));
      const offset = Math.floor((this.size - dim) / 2);
      for (let y = 0; y < dim; y++) {
        for (let x = 0; x < dim; x++) {
          this.world[this._index(offset + x, offset + y)] = rng() * 0.9;
        }
      }
    } else {
      const blobDim = Math.max(1, Math.floor(R * 0.9));
      const numBlobs = Math.floor(rng() * 25) + 15;
      const border = Math.floor(R * 1.5);

      for (let i = 0; i < numBlobs; i++) {
        const lo = Math.min(border, this.size - border);
        const hi = Math.max(border, this.size - border);
        const shiftX =
          lo < hi
            ? Math.floor(rng() * (hi - lo)) + lo - Math.floor(this.size / 2)
            : 0;
        const shiftY =
          lo < hi
            ? Math.floor(rng() * (hi - lo)) + lo - Math.floor(this.size / 2)
            : 0;

        for (let dy = 0; dy < blobDim; dy++) {
          for (let dx = 0; dx < blobDim; dx++) {
            const cx = Math.floor(this.size / 2) + shiftX;
            const cy = Math.floor(this.size / 2) + shiftY;
            const y =
              (cy + dy - Math.floor(blobDim / 2) + this.size * 100) % this.size;
            const x =
              (cx + dx - Math.floor(blobDim / 2) + this.size * 100) % this.size;
            this.world[this._index(x, y)] = rng() * 0.9;
          }
        }
      }
    }

    return hexSeed;
  }

  static _randomHex(len = 8) {
    const chars = "0123456789ABCDEF";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
    return s;
  }

  static _seededRng(hexSeed) {
    let seed;
    try {
      seed = parseInt(hexSeed, 16);
    } catch {
      seed = 0;
    }
    if (!Number.isFinite(seed)) seed = 0;
    let state = seed | 0;
    return function () {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  loadPattern(pattern) {
    const grids = this._getPatternGrids(pattern);
    if (!grids || grids.length === 0) return;
    this.clear();

    const grid = grids[0];
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
          this.world[this._index(targetX, targetY)] = grid[y][x];
        }
      }
    }
  }

  placePattern(pattern, cellX, cellY) {
    const grids = this._getPatternGrids(pattern);
    if (!grids || grids.length === 0) return;

    const grid = grids[0];
    const h = grid.length;
    const w = grid[0].length;
    const copyH = Math.min(this.size, h);
    const copyW = Math.min(this.size, w);
    const srcOffY = Math.floor((h - copyH) / 2);
    const srcOffX = Math.floor((w - copyW) / 2);
    const sy = cellY - Math.floor(copyH / 2);
    const sx = cellX - Math.floor(copyW / 2);

    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        const ty = (sy + y + this.size) % this.size;
        const tx = (sx + x + this.size) % this.size;
        this.world[this._index(tx, ty)] = grid[srcOffY + y]?.[srcOffX + x] || 0;
      }
    }
  }

  placePatternScaled(pattern, cellX, cellY, scale) {
    if (!pattern || !pattern.cells) return;
    if (scale === 1) {
      this.placePattern(pattern, cellX, cellY);
      return;
    }

    const grids = this._getPatternGrids(pattern);
    if (!grids || grids.length === 0) return;

    const grid = grids[0];
    const srcH = grid.length;
    const srcW = grid[0].length;

    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const copyW = Math.min(this.size, dstW);
    const copyH = Math.min(this.size, dstH);
    const dstOffX = Math.floor((dstW - copyW) / 2);
    const dstOffY = Math.floor((dstH - copyH) / 2);
    const sy = cellY - Math.floor(copyH / 2);
    const sx = cellX - Math.floor(copyW / 2);

    for (let dy = 0; dy < copyH; dy++) {
      for (let dx = 0; dx < copyW; dx++) {
        const sampleX = dstOffX + dx;
        const sampleY = dstOffY + dy;
        const srcX = this._zoomNearestIndex(sampleX, srcW, dstW);
        const srcY = this._zoomNearestIndex(sampleY, srcH, dstH);
        const v = grid[srcY]?.[srcX] || 0;

        if (v <= 1e-10) continue;

        const ty = (sy + dy + this.size * 100) % this.size;
        const tx = (sx + dx + this.size * 100) % this.size;
        this.world[this._index(tx, ty)] = v;
      }
    }
  }

  resize(newSize) {
    this.size = newSize;
    this.world = this._createGrid();
    this.potential = this._createGrid();
    this.growth = this._createGrid();
    this.growthOld = null;
  }

  resample(newSize) {
    if (newSize === this.size) return this;
    const oldSize = this.size;
    const src = this.world;
    const dst = new Float32Array(newSize * newSize);
    for (let y = 0; y < newSize; y++) {
      const srcY = this._zoomNearestIndex(y, oldSize, newSize);
      for (let x = 0; x < newSize; x++) {
        const srcX = this._zoomNearestIndex(x, oldSize, newSize);
        dst[y * newSize + x] = src[srcY * oldSize + srcX];
      }
    }
    this.size = newSize;
    this.world = dst;
    this.potential = new Float32Array(newSize * newSize);
    this.growth = new Float32Array(newSize * newSize);
    this.growthOld = null;
    return this;
  }

  add(board, shift = [0, 0], isCentred = true) {
    const shift0 = shift[0] || 0;
    const size0 = this.size;
    const size1 = board.size;
    const sizeMin = Math.min(size0, size1);

    for (let iy = 0; iy < sizeMin; iy++) {
      for (let ix = 0; ix < sizeMin; ix++) {
        const start0 = isCentred ? (size0 - sizeMin) / 2 + shift0 : shift0;
        const start1 = isCentred ? (size1 - sizeMin) / 2 : 0;

        const idx0 = (((start0 + ix) % size0) + size0) % size0;
        const idx1 = (start1 + ix) % size1;

        const iy0 = (((start0 + iy) % size0) + size0) % size0;
        const iy1 = (start1 + iy) % size1;

        if (board.world[iy1 * size1 + idx1] > 1e-10) {
          this.world[iy0 * size0 + idx0] = board.world[iy1 * size1 + idx1];
        }
      }
    }
    return this;
  }

  rotate(angle) {
    if (angle % 360 === 0) return this;

    const rad = (angle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const cx = this.size / 2;
    const cy = this.size / 2;
    const newCells = this._createGrid();

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const rx = (x - cx) * cosA - (y - cy) * sinA + cx;
        const ry = (x - cx) * sinA + (y - cy) * cosA + cy;

        const ix = Math.round(rx);
        const iy = Math.round(ry);

        if (ix >= 0 && ix < this.size && iy >= 0 && iy < this.size) {
          newCells[y * this.size + x] = this.world[iy * this.size + ix];
        }
      }
    }

    this.world.set(newCells);
    return this;
  }

  zoom(factor) {
    if (Math.abs(factor - 1) < 1e-6) return this;
    const size = this.size;
    const newDim = Math.max(1, Math.round(size * factor));
    const zoomed = new Float32Array(newDim * newDim);
    for (let y = 0; y < newDim; y++) {
      for (let x = 0; x < newDim; x++) {
        const sx = this._zoomNearestIndex(x, size, newDim);
        const sy = this._zoomNearestIndex(y, size, newDim);
        zoomed[y * newDim + x] = this.world[sy * size + sx];
      }
    }
    const result = new Float32Array(size * size);
    const minDim = Math.min(size, newDim);
    const offDst = Math.floor((size - minDim) / 2);
    const offSrc = Math.floor((newDim - minDim) / 2);
    for (let y = 0; y < minDim; y++) {
      for (let x = 0; x < minDim; x++) {
        const v = zoomed[(offSrc + y) * newDim + (offSrc + x)];
        if (v > 1e-10) {
          const dy = (((offDst + y) % size) + size) % size;
          const dx = (((offDst + x) % size) + size) % size;
          result[dy * size + dx] = v;
        }
      }
    }
    this.world.set(result);
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
        newCells[y * newSize + x] = this.world[oy * oldSize + ox];
      }
    }

    this.size = newSize;
    this.world = newCells;
    this.potential = this._createGrid();
    this.growth = this._createGrid();
    return this;
  }

  flip(flipMode = 0) {
    const newCells = this._createGrid();

    if (flipMode === 0) {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          newCells[y * this.size + x] =
            this.world[y * this.size + (this.size - 1 - x)];
        }
      }
    } else if (flipMode === 1) {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          newCells[y * this.size + x] =
            this.world[(this.size - 1 - y) * this.size + x];
        }
      }
    } else if (flipMode === 2) {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          newCells[y * this.size + x] = this.world[x * this.size + y];
        }
      }
    }

    this.world.set(newCells);
    return this;
  }

  shift(shiftX, shiftY) {
    const newCells = this._createGrid();

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const oldX = (x - shiftX + this.size * 100) % this.size;
        const oldY = (y - shiftY + this.size * 100) % this.size;
        newCells[y * this.size + x] = this.world[oldY * this.size + oldX];
      }
    }

    this.world.set(newCells);
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
        if (this.world[y * this.size + x] > EPSILON) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX === -1) {
      this.world.fill(0);
      return this;
    }

    const newW = maxX - minX + 1;
    const newH = maxY - minY + 1;
    const newSize = Math.max(newW, newH);
    const newCells = new Float32Array(newSize * newSize);

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        if (minX + x < this.size && minY + y < this.size) {
          newCells[y * newSize + x] =
            this.world[(minY + y) * this.size + (minX + x)];
        }
      }
    }

    this.size = newSize;
    this.world = newCells;
    this.potential = this._createGrid();
    this.growth = this._createGrid();
    return this;
  }

  getStats() {
    if (!this.world || typeof this.world.length !== "number") {
      return { mass: 0, max: 0 };
    }

    let mass = 0;
    let max = 0;

    for (let i = 0; i < this.world.length; i++) {
      const val = this.world[i];
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
      world: this._worldToRLE(),
      stats,
    };
  }

  static fromJSON(data) {
    const board = new Board(data.size || 128);
    if (data.params) {
      board.params = { ...board.params, ...data.params };
    }
    if (data.world) {
      board._worldFromRLE(data.world);
    }
    return board;
  }

  _worldToRLE() {
    return RLECodec.encode(this.world, this.size, this.size);
  }

  _worldFromRLE(rle) {
    const decoded = RLECodec.decode(rle, this.size, this.size);
    this.world.set(decoded);
  }

  static get EPSILON() {
    return 1e-10;
  }
}
