class NDCompatibility {
  static SUPPORTED_DIMENSIONS = [2, 3, 4];
  static GRID_SIZE_OPTIONS_BY_DIMENSION = {
    2: [64, 128, 256, 512, 1024, 2048],
    3: [32, 64, 128],
    4: [16, 32],
  };
  static DEFAULT_GRID_SIZE_BY_DIMENSION = {
    2: 128,
    3: 64,
    4: 32,
  };
  static DEFAULT_PIXEL_SIZE_BY_DIMENSION = {
    2: 4,
    3: 8,
    4: 16,
  };

  static VIEW_MODES_BY_DIMENSION = {
    2: ["slice"],
    3: ["slice", "projection"],
    4: ["slice", "projection"],
  };

  static coerceDimension(value) {
    const dim = Number(value);
    return this.SUPPORTED_DIMENSIONS.includes(dim) ? dim : 2;
  }

  static getViewModesForDimension(dimension) {
    const dim = this.coerceDimension(dimension);
    return this.VIEW_MODES_BY_DIMENSION[dim] || this.VIEW_MODES_BY_DIMENSION[2];
  }

  static coerceViewMode(dimension, viewMode) {
    const modes = this.getViewModesForDimension(dimension);
    const mode = String(viewMode || "slice");
    return modes.includes(mode) ? mode : modes[0];
  }

  static coerceDepth(value, dimension = 2) {
    const dim = this.coerceDimension(dimension);
    if (dim <= 2) return 1;
    const n = Math.floor(Number(value) || 6);
    return Math.max(2, Math.min(512, n));
  }

  static getGridSizeOptions(dimension = 2) {
    const dim = this.coerceDimension(dimension);
    return (
      this.GRID_SIZE_OPTIONS_BY_DIMENSION[dim] ||
      this.GRID_SIZE_OPTIONS_BY_DIMENSION[2]
    );
  }

  static getDefaultGridSize(dimension = 2) {
    const dim = this.coerceDimension(dimension);
    return this.DEFAULT_GRID_SIZE_BY_DIMENSION[dim] || 128;
  }

  static getDefaultPixelSize(dimension = 2) {
    const dim = this.coerceDimension(dimension);
    return this.DEFAULT_PIXEL_SIZE_BY_DIMENSION[dim] || 4;
  }

  static gridSizeFromPixelSize(pixelSize, canvasSize, dimension = 2) {
    const px = Math.max(1, Math.round(pixelSize));
    const options = this.getGridSizeOptions(dimension);
    const feasible = options.filter((size) => size <= canvasSize);
    const candidates = feasible.length > 0 ? feasible : options;

    let bestSize = candidates[0];
    let bestError = Infinity;

    for (const size of candidates) {
      const derivedPx = this.pixelSizeFromGridSize(size, canvasSize);
      const err = Math.abs(derivedPx - px);

      if (err < bestError || (err === bestError && size > bestSize)) {
        bestError = err;
        bestSize = size;
      }
    }

    return bestSize;
  }

  static pixelSizeFromGridSize(gridSize, canvasSize) {
    return Math.max(1, Math.floor(canvasSize / Math.max(1, gridSize)));
  }

  static getPixelSizeOptions(canvasSize, dimension = 2) {
    const options = this.getGridSizeOptions(dimension);
    const result = {};
    const seen = new Set();
    for (const size of options) {
      if (size > canvasSize) continue;
      const px = Math.max(1, Math.floor(canvasSize / size));
      if (seen.has(px)) continue;
      seen.add(px);
      result[`${px}px (${size})`] = px;
    }
    if (Object.keys(result).length === 0) {
      result["1px"] = 1;
    }
    return result;
  }

  static coerceGridSize(value, dimension = 2) {
    const options = this.getGridSizeOptions(dimension);
    const raw = Number(value);
    if (!Number.isFinite(raw) || raw <= 0) {
      return this.getDefaultGridSize(dimension);
    }

    let closest = options[0];
    let bestDist = Math.abs(raw - closest);
    for (let i = 1; i < options.length; i++) {
      const d = Math.abs(raw - options[i]);
      if (d < bestDist) {
        closest = options[i];
        bestDist = d;
      }
    }
    return closest;
  }

  static getWorldDepthForDimension(gridSize, dimension = 2) {
    const dim = this.coerceDimension(dimension);
    if (dim <= 2) return 1;
    return this.coerceGridSize(gridSize, dim);
  }

  static coerceSliceIndex(value, depth) {
    const d = Math.max(1, Math.floor(Number(depth) || 1));
    const n = Math.floor(Number(value) || 0);
    return Math.max(0, Math.min(d - 1, n));
  }

  static normaliseAnimalDataset(data) {
    const dataArray = Array.isArray(data) ? data : Object.values(data || {});
    return dataArray.filter(
      (animal) => animal && animal.name && !animal.code?.startsWith(">"),
    );
  }

  static buildAnimalsByDimension(animals2D, animalsByDimension = null) {
    const byDim =
      animalsByDimension && typeof animalsByDimension === "object"
        ? animalsByDimension
        : {};

    return {
      2: this.normaliseAnimalDataset(byDim[2] || animals2D),
      3: this.normaliseAnimalDataset(byDim[3]),
      4: this.normaliseAnimalDataset(byDim[4]),
    };
  }
}
