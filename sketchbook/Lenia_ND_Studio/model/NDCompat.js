class NDCompat {
  static _impl =
    typeof NDCompatibility !== "undefined" ? NDCompatibility : null;

  static _fallbackGridOptions = Object.freeze({
    2: Object.freeze([64, 128, 256, 512, 1024, 2048]),
    3: Object.freeze([32, 64, 128]),
    4: Object.freeze([16, 32]),
  });

  static _fallbackGridDefaults = Object.freeze({
    2: 128,
    3: 64,
    4: 32,
  });

  static _fallbackViewModes = Object.freeze({
    2: Object.freeze(["slice"]),
    3: Object.freeze(["slice", "projection"]),
    4: Object.freeze(["slice", "projection"]),
  });

  static coerceDimension(value) {
    if (this._impl) return this._impl.coerceDimension(value);
    const dim = Math.floor(Number(value) || 2);
    return dim >= 2 && dim <= 4 ? dim : 2;
  }

  static getViewModesForDimension(dimension) {
    if (this._impl) return this._impl.getViewModesForDimension(dimension);
    const dim = this.coerceDimension(dimension);
    return this._fallbackViewModes[dim] || this._fallbackViewModes[2];
  }

  static coerceViewMode(dimension, viewMode) {
    if (this._impl) return this._impl.coerceViewMode(dimension, viewMode);
    const modes = this.getViewModesForDimension(dimension);
    const mode = String(viewMode || "slice");
    return modes.includes(mode) ? mode : modes[0];
  }

  static coerceDepth(value, dimension = 2) {
    if (this._impl) return this._impl.coerceDepth(value, dimension);
    const dim = this.coerceDimension(dimension);
    if (dim <= 2) return 1;
    const n = Math.floor(Number(value) || 6);
    return Math.max(2, Math.min(512, n));
  }

  static getGridSizeOptions(dimension = 2) {
    if (this._impl) return this._impl.getGridSizeOptions(dimension);
    const dim = this.coerceDimension(dimension);
    return this._fallbackGridOptions[dim] || this._fallbackGridOptions[2];
  }

  static getDefaultGridSize(dimension = 2) {
    if (this._impl) return this._impl.getDefaultGridSize(dimension);
    const dim = this.coerceDimension(dimension);
    return this._fallbackGridDefaults[dim] || 128;
  }

  static coerceGridSize(value, dimension = 2) {
    if (this._impl) return this._impl.coerceGridSize(value, dimension);
    const options = this.getGridSizeOptions(dimension);
    const raw = Number(value);
    if (!Number.isFinite(raw) || raw <= 0) {
      return this.getDefaultGridSize(dimension);
    }

    let closest = options[0];
    let bestDistance = Math.abs(raw - closest);
    for (let i = 1; i < options.length; i++) {
      const distance = Math.abs(raw - options[i]);
      if (distance < bestDistance) {
        closest = options[i];
        bestDistance = distance;
      }
    }
    return closest;
  }

  static getWorldDepthForDimension(latticeExtent, dimension = 2) {
    if (this._impl)
      return this._impl.getWorldDepthForDimension(latticeExtent, dimension);
    const dim = this.coerceDimension(dimension);
    if (dim <= 2) return 1;
    return this.coerceGridSize(latticeExtent, dim);
  }

  static coerceSliceIndex(value, depth) {
    if (this._impl) return this._impl.coerceSliceIndex(value, depth);
    const d = Math.max(1, Math.floor(Number(depth) || 1));
    const n = Math.floor(Number(value) || 0);
    return Math.max(0, Math.min(d - 1, n));
  }

  static buildAnimalsByDimension(animals2D, animalsByDimension = null) {
    if (this._impl) {
      return this._impl.buildAnimalsByDimension(animals2D, animalsByDimension);
    }

    const source =
      animalsByDimension && typeof animalsByDimension === "object"
        ? animalsByDimension
        : {};

    return {
      2: Array.isArray(source[2])
        ? source[2]
        : Array.isArray(animals2D)
          ? animals2D
          : [],
      3: Array.isArray(source[3]) ? source[3] : [],
      4: Array.isArray(source[4]) ? source[4] : [],
    };
  }
}
