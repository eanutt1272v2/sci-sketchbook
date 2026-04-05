class AppCoreAnimalMethods {
  _packNDSeed(animal, scale = 1) {
    if (!animal || !animal.cells) return null;
    const cellsStr = Array.isArray(animal.cells)
      ? animal.cells[0]
      : animal.cells;
    if (typeof cellsStr !== "string") return null;
    if (!cellsStr.includes("%") && !cellsStr.includes("#")) return null;

    const slices = RLECodec.parseND(cellsStr);
    if (!slices || slices.length <= 1) return null;

    const dimension = Number(this.params.dimension) || 2;
    if (dimension <= 2) return null;

    const size = this.params.latticeExtent;
    const depth = NDCompat.getWorldDepthForDimension(size, dimension);
    const extraDims = Math.max(0, dimension - 2);
    const planeCount = Math.pow(depth, extraDims);
    const cellCount = size * size;
    const planeCellCount = cellCount;
    const total = planeCellCount * planeCount;
    const packed = new Float32Array(total);

    let maxZ = 0,
      maxW = 0;
    for (const s of slices) {
      if (s.z > maxZ) maxZ = s.z;
      if (s.w > maxW) maxW = s.w;
    }
    const animalDepthZ = maxZ + 1;
    const animalDepthW = maxW + 1;

    const offsetZ = Math.floor((depth - animalDepthZ) / 2);
    const offsetW = extraDims >= 2 ? Math.floor((depth - animalDepthW) / 2) : 0;

    const requestedScale = Number(scale) || 1;
    const useNativeScale = Math.abs(requestedScale - 1) < 1e-6;
    const preparedSlices = [];

    let maxH = 0,
      maxW_ = 0;
    for (const s of slices) {
      const grid = s.grid;
      const h = grid.length;
      const w = grid[0]?.length || 0;
      if (w <= 0 || h <= 0) continue;

      let scaledData = null;
      let scaledW = w;
      let scaledH = h;

      if (!useNativeScale) {
        scaledData = this._scaleGrid(grid, w, h, requestedScale);
        scaledW = Math.max(1, Math.round(w * requestedScale));
        scaledH = Math.max(1, Math.round(h * requestedScale));
      }

      if (scaledH > maxH) maxH = scaledH;
      if (scaledW > maxW_) maxW_ = scaledW;
      preparedSlices.push({
        z: s.z,
        w: s.w,
        grid,
        scaledData,
        scaledW,
        scaledH,
      });
    }

    for (const slice of preparedSlices) {
      const centreedZ = slice.z + offsetZ;
      const centreedW = slice.w + offsetW;
      if (centreedZ < 0 || centreedZ >= depth) continue;
      if (centreedW < 0 || centreedW >= depth) continue;

      let plane;
      if (extraDims >= 2) {
        plane = centreedZ + centreedW * depth;
      } else {
        plane = centreedZ;
      }
      if (plane >= planeCount) continue;

      const grid = slice.grid;
      const h = slice.scaledH;
      const w = slice.scaledW;
      const sy = Math.floor((size - maxH) / 2);
      const sx = Math.floor((size - maxW_) / 2);
      const gy = Math.floor((maxH - h) / 2);
      const gx = Math.floor((maxW_ - w) / 2);
      const planeBase = plane * planeCellCount;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ty = sy + gy + y;
          const tx = sx + gx + x;
          if (ty >= 0 && ty < size && tx >= 0 && tx < size) {
            packed[planeBase + ty * size + tx] = useNativeScale
              ? grid[y][x]
              : slice.scaledData[y * w + x] || 0;
          }
        }
      }
    }

    return packed;
  }

  loadAnimal(animal, options = {}) {
    if (!animal) return;

    this._pendingActions = this._pendingActions.filter(
      (action) => action.name !== "loadAnimalParams",
    );

    this._queueAnimalLoad(animal, { loadPattern: true, ...options });
  }

  loadSelectedAnimal() {
    const selection = this.params.selectedAnimal || "";
    const animal = this._resolveAnimalForPlacement(selection);
    if (!animal) return;

    const boardSize = this.board?.size || this.params.latticeExtent;
    const centre = Math.floor(boardSize / 2);
    const request = this._normalisePlacementRequest(
      {
        selection,
        cellX: centre,
        cellY: centre,
        scale: this.params.placeScale || 1,
      },
      boardSize,
      boardSize,
    );
    if (!request) return;

    this._queueAction("reloadAnimalAtCentre", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        this.board.clear();
        this.analyser.resetStatistics();
        this.analyser.reset();
        this._executePlacementRequest(request);
      }),
    );
  }

  cycleAnimal(delta) {
    const lib = this.animalLibrary;
    if (!lib || !lib.animals || lib.animals.length === 0) return;

    const currentSelection = this.params.selectedAnimal || "";
    const preservedScaleFactor =
      this._getScaleFactorForSelection(currentSelection);

    const total = lib.animals.length;
    const current = this.getSelectedAnimalIndex();
    const base = current === null ? (delta > 0 ? -1 : 0) : current;
    const next = (((base + delta) % total) + total) % total;
    const nextSelection = String(next);

    this._skipNextAnimalParamsLoad = true;
    this._lastAnimalParamsSelection = nextSelection;
    this.params.selectedAnimal = nextSelection;

    const animal = lib.getAnimal(next);
    if (animal) {
      this.loadAnimal(animal, {
        preserveScaleFactor: true,
        preservedScaleFactor,
      });
    }
    this.refreshGUI();
  }

  selectAnimalByIndex(index, { preserveScaleFactor = true } = {}) {
    const lib = this.animalLibrary;
    if (!lib || !Array.isArray(lib.animals) || lib.animals.length === 0) {
      return false;
    }

    const idx = Math.floor(Number(index));
    if (!Number.isFinite(idx) || idx < 0 || idx >= lib.animals.length) {
      return false;
    }

    const currentSelection = this.params.selectedAnimal || "";
    const nextSelection = String(idx);
    const preservedScaleFactor = preserveScaleFactor
      ? this._getScaleFactorForSelection(currentSelection, 1)
      : 1;

    this._skipNextAnimalParamsLoad = true;
    this._lastAnimalParamsSelection = nextSelection;
    this.params.selectedAnimal = nextSelection;

    const animal = lib.getAnimal(idx);
    if (!animal) return false;

    this.loadAnimal(animal, {
      preserveScaleFactor,
      preservedScaleFactor,
    });
    return true;
  }

  loadAnimalParams(animal, options = {}) {
    if (!animal) return;

    this._queueAnimalLoad(animal, { loadPattern: false, ...options });
  }

  _queueAnimalLoad(
    animal,
    {
      loadPattern = true,
      preserveScaleFactor = false,
      preservedScaleFactor = null,
    } = {},
  ) {
    const actionName = loadPattern ? "loadAnimal" : "loadAnimalParams";

    this._queueAction(actionName, () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        this.analyser.resetStatistics();

        const sourceParams = this._getAnimalSourceParams(animal) || {};
        const sourceR = Number(sourceParams.R);
        const currentKn = Number(this.params.kn) || 1;
        const nextKn = Number(sourceParams.kn) || currentKn;
        const isCurrentLife = currentKn === 4;
        const isNextLife = nextKn === 4;
        const animalCode = String(animal?.code || "")
          .trim()
          .toLowerCase();
        const forcePartR = animalCode.startsWith("~");
        const forceNativeBugR = animalCode === "sbug" || animalCode === "bbug";
        const defaultR = this.getDefaultRadius(
          this.params.latticeExtent,
          this.params.dimension,
        );
        const maxR = this.getMaxKernelRadius(this.params.latticeExtent);
        const preservedFactorValue =
          preserveScaleFactor && Number.isFinite(Number(preservedScaleFactor))
            ? Math.max(0.01, Number(preservedScaleFactor))
            : null;

        let baseR = Math.max(2, Number(this.params.R) || defaultR);

        if (isCurrentLife && !isNextLife) {
          baseR = defaultR;
        }

        if (
          (forcePartR || forceNativeBugR) &&
          Number.isFinite(sourceR) &&
          sourceR > 0
        ) {
          baseR = Math.round(constrain(sourceR, 2, maxR));
        }

        this.params.R = baseR;
        this._applyAnimalSimulationParams(animal);

        const requestedScale = this.getEffectivePlacementScale(
          this.params.placeScale,
        );
        let patternScale = requestedScale;

        if (
          Number.isFinite(preservedFactorValue) &&
          Number.isFinite(sourceR) &&
          sourceR > 0
        ) {
          this.params.R = Math.round(
            constrain(sourceR * preservedFactorValue, 2, maxR),
          );
          if (Number.isFinite(sourceR) && sourceR > 0) {
            patternScale = this.params.R / sourceR;
          }
        } else {
          patternScale = this.applyScaledAnimalParams(animal, requestedScale, {
            baseR: Number.isFinite(sourceR) && sourceR > 0 ? sourceR : baseR,
          });
        }

        this.params.R = Math.round(
          constrain(Number(this.params.R) || baseR, 2, maxR),
        );

        const dim = Number(this.params.dimension) || 2;
        if (loadPattern && dim <= 2) {
          if (Math.abs(patternScale - 1) < 1e-6) {
            this.board.loadPattern(animal);
          } else {
            this.board.clear();
            const centre = Math.floor(this.board.size / 2);
            this.board.placePatternScaled(animal, centre, centre, patternScale);
          }
        } else if (loadPattern) {
          this.board.clear();
        }

        if (loadPattern && dim > 2) {
          const ndSeed = this._packNDSeed(animal, patternScale);
          if (ndSeed) {
            this._ndSeedWorld = ndSeed;
          }
        }

        this.automaton.updateParameters(this.params);
        this._prevR = this.params.R;
        this.syncPlacementScaleToRadius(this.params.selectedAnimal);
        this._workerSendKernel();

        this.refreshGUI();
      }),
    );
  }

  _applyAnimalSimulationParams(animal) {
    if (!animal) return false;

    this.animalLibrary.applyAnimalParameters(animal);

    return true;
  }

  applySelectedAnimalParams({ refreshGUI = false } = {}) {
    const animal = this.getSelectedAnimal();
    if (!animal) return false;

    this._applyAnimalSimulationParams(animal);
    this.updateAutomatonParams();
    if (refreshGUI) this.refreshGUI();
    return true;
  }

  applySelectedAnimalScaledRT(
    scale,
    { baseR = null, refreshGUI = false } = {},
  ) {
    const animal = this.getSelectedAnimal();
    if (!animal) return false;

    const effectiveScale = this.getEffectivePlacementScale(scale);
    this.applyScaledAnimalParams(animal, effectiveScale, { baseR });
    this.updateAutomatonParams();
    this.syncPlacementScaleToRadius(this.params.selectedAnimal);
    if (refreshGUI) this.refreshGUI();
    return true;
  }

  _getAnimalSourceParams(animal) {
    if (!animal || !animal.params) return null;
    return Array.isArray(animal.params)
      ? animal.params.find((entry) => entry && typeof entry === "object") ||
          animal.params[0] ||
          null
      : animal.params;
  }

  _getScaleFactorForSelection(selection, fallback = 1) {
    if (
      selection === null ||
      typeof selection === "undefined" ||
      String(selection).trim() === ""
    ) {
      return fallback;
    }

    const animal = this._resolveAnimalForPlacement(selection);
    if (!animal) return fallback;

    const sourceParams = this._getAnimalSourceParams(animal) || {};
    const sourceR = Number(sourceParams.R);
    const currentR = Number(this.params.R);

    if (
      Number.isFinite(sourceR) &&
      sourceR > 0 &&
      Number.isFinite(currentR) &&
      currentR > 0
    ) {
      return currentR / sourceR;
    }

    return fallback;
  }

  _getRadiusLinkedPlacementScale(selection = this.params.selectedAnimal) {
    const animal = this._resolveAnimalForPlacement(selection);
    const sourceParams = this._getAnimalSourceParams(animal) || {};
    const sourceR = Number(sourceParams.R);
    const currentR = Number(this.params.R);

    if (
      Number.isFinite(sourceR) &&
      sourceR > 0 &&
      Number.isFinite(currentR) &&
      currentR > 0
    ) {
      return currentR / sourceR;
    }

    return null;
  }

  _getCombinedPlacementScale(
    selection = this.params.selectedAnimal,
    requestedScale = this.params.placeScale,
  ) {
    const sliderScale = this.getEffectivePlacementScale(requestedScale, selection);
    const zoomScale = this._getRadiusLinkedPlacementScale(selection);

    if (Number.isFinite(zoomScale) && zoomScale > 0) {
      return zoomScale;
    }

    return sliderScale;
  }

  syncPlacementScaleToRadius(selection = this.params.selectedAnimal) {
    const linkedScale = this._getRadiusLinkedPlacementScale(selection);
    const fallback = this.getEffectivePlacementScale(
      this.params.placeScale,
      selection,
    );
    const { min, max } = this.getPlacementScaleBounds(selection);
    const nextRaw = Number.isFinite(linkedScale) ? linkedScale : fallback;
    const next = constrain(nextRaw, min, max);

    this.params.placeScale = next;
    this._lastPlacementScale = next;
    return next;
  }

  applyScaledAnimalParams(animal, scale = 1, { baseR = null } = {}) {
    if (!animal || !animal.params) return scale;

    const sourceParams = this._getAnimalSourceParams(animal) || {};

    const sourceR = Number(sourceParams.R);
    const requestedScale = Number(scale) || 1;
    const anchorR =
      Number.isFinite(baseR) && baseR > 0
        ? baseR
        : Math.max(
            2,
            Number(this.params.R) ||
              (Number.isFinite(sourceR) && sourceR > 0 ? sourceR : 13),
          );

    const targetR = Math.round(
      constrain(anchorR * requestedScale, 2, this.getMaxKernelRadius()),
    );
    this.params.R = targetR;

    if (Number.isFinite(sourceR) && sourceR > 0) {
      return targetR / sourceR;
    }

    return requestedScale;
  }

  updatePlacementScale(scale) {
    const selection = this.params.selectedAnimal;
    this.syncPlacementScaleToRadius(selection);

    const animal = this.getSelectedAnimal();
    const sourceParams = this._getAnimalSourceParams(animal) || {};
    const sourceR = Number(sourceParams.R);
    const { min, max } = this.getPlacementScaleBounds(selection);
    const currentR = Math.max(2, Number(this.params.R) || 13);
    const currentScale = constrain(
      Number(this._lastPlacementScale) || 1,
      min,
      max,
    );
    const baseR =
      Number.isFinite(sourceR) && sourceR > 0
        ? sourceR
        : Number.isFinite(currentScale) && Math.abs(currentScale) > 1e-9
          ? currentR / currentScale
          : currentR;

    const next = constrain(Number(scale) || 1, min, max);
    this.params.placeScale = next;
    this._lastPlacementScale = next;

    const targetR = Math.round(
      constrain(baseR * next, 2, this.getMaxKernelRadius()),
    );

    if (typeof this.zoomWorld === "function") {
      this.zoomWorld(targetR);
    } else {
      const updated = this.applySelectedAnimalScaledRT(next, {
        baseR,
        refreshGUI: false,
      });

      if (!updated) {
        this.syncPlacementScaleToRadius(selection);
      }
    }

    this.refreshGUI();
  }

  _coercePolarModeValue(mode = this.params.polarMode) {
    if (typeof mode === "string") {
      const key = mode.trim().toLowerCase();
      if (key === "off") return 0;
      if (key === "symmetry" || key === "symm") return 1;
      if (key === "polar") return 2;
      if (key === "history") return 3;
      if (key === "strength") return 4;
    }
    const numeric = Math.floor(Number(mode) || 0);
    return Math.max(0, Math.min(4, numeric));
  }

  setPolarMode(mode, { refreshGUI = true } = {}) {
    const nextMode = this._coercePolarModeValue(mode);
    this.params.polarMode = nextMode;
    if (nextMode > 0) {
      this.params.renderSymmetryOverlay = true;
    }
    if (typeof this._workerRequestView === "function") {
      this._workerRequestView();
    }
    if (refreshGUI) this.refreshGUI();
    return nextMode;
  }

  cyclePolarMode(delta = 1, { refreshGUI = true } = {}) {
    const current = this._coercePolarModeValue(this.params.polarMode);
    const step = Math.floor(Number(delta) || 0) || 1;
    const next = (((current + step) % 5) + 5) % 5;
    return this.setPolarMode(next, { refreshGUI });
  }

  loadSelectedAnimalParams() {
    const currentSelection = this.params.selectedAnimal || "";
    const previousSelection = this._lastAnimalParamsSelection;

    if (this._skipNextAnimalParamsLoad) {
      this._skipNextAnimalParamsLoad = false;
      this._lastAnimalParamsSelection = currentSelection;
      return;
    }

    if (currentSelection === this._lastAnimalParamsSelection) {
      return;
    }

    this._lastAnimalParamsSelection = currentSelection;
    const animal = this.getSelectedAnimal();
    if (animal) {
      this.loadAnimalParams(animal, {
        preserveScaleFactor: true,
        preservedScaleFactor: this._getScaleFactorForSelection(
          previousSelection,
          1,
        ),
      });
    }
  }

  _hasQueuedAction(name) {
    return this._pendingActions.some((action) => action?.name === name);
  }

  _resolveAnimalForPlacement(selection) {
    const rawSelection =
      selection !== null && typeof selection !== "undefined"
        ? selection
        : this.params.selectedAnimal;
    const idx = parseInt(String(rawSelection), 10);
    if (Number.isFinite(idx)) {
      const animal = this.animalLibrary.getAnimal(idx);
      if (animal) return animal;
    }
    return this.getSelectedAnimal();
  }

  _executePlacementRequest(request) {
    if (!request) return;

    const animal = this._resolveAnimalForPlacement(request.selection);
    if (!animal) return;

    const scale = this._getCombinedPlacementScale(request.selection, request.scale);
    const dim = Number(this.params.dimension) || 2;
    this._ensureBuffers();

    if (dim > 2) {
      this._placeAnimalND(animal, request.cellX, request.cellY, scale);
    } else {
      this._applyPlacement({
        animal,
        cellX: request.cellX,
        cellY: request.cellY,
        scale,
      });
    }
  }

  placeAnimal(cellX, cellY) {
    if (!this.params.placeMode) return;

    const selection = this.params.selectedAnimal || "";
    const animal = this._resolveAnimalForPlacement(selection);
    if (!animal) return;

    const scale = this.params.placeScale || 1;
    const boardSize = this.board?.size || this.params.latticeExtent;
    const request = this._normalisePlacementRequest(
      {
        selection,
        cellX,
        cellY,
        scale,
      },
      boardSize,
      boardSize,
    );
    if (!request) return;

    if (
      this._hasQueuedAction("loadAnimalParams") ||
      this._hasQueuedAction("loadAnimal")
    ) {
      this._queueAction("deferredPlacement", () =>
        this._queueOrRunMutation(() => {
          this._executePlacementRequest(request);
        }),
      );
      return;
    }

    if (!this.board.world || (this._worker && this._workerBusy)) {
      this._pendingPlacement = request;
      return;
    }

    this._executePlacementRequest(request);
  }

  _applyPlacement({ animal, cellX, cellY, scale }) {
    if (!animal) return;
    if (Math.abs((scale || 1) - 1) < 1e-6) {
      this.board.placePattern(animal, cellX, cellY);
    } else {
      this.board.placePatternScaled(animal, cellX, cellY, scale);
    }
  }

  _mapNearestIndex(
    dstIndex,
    srcSize,
    dstSize,
    { centerWhenCollapsed = false } = {},
  ) {
    const safeSrc = Math.max(1, Math.floor(Number(srcSize) || 1));
    const safeDst = Math.max(1, Math.floor(Number(dstSize) || 1));
    if (safeSrc <= 1) return 0;
    if (safeDst <= 1) {
      return centerWhenCollapsed ? Math.floor((safeSrc - 1) / 2) : 0;
    }
    const srcPos = (dstIndex * (safeSrc - 1)) / (safeDst - 1);
    return Math.max(0, Math.min(safeSrc - 1, Math.round(srcPos)));
  }

  _fitPatternToFootprint(
    patternData,
    srcW,
    srcH,
    {
      targetW = srcW,
      targetH = srcH,
      maxW = Infinity,
      maxH = Infinity,
    } = {},
  ) {
    let width = Math.max(1, Math.floor(Number(srcW) || 1));
    let height = Math.max(1, Math.floor(Number(srcH) || 1));

    const toFloat32Pattern = (value) => {
      if (value instanceof Float32Array) return value;
      if (value instanceof ArrayBuffer) return new Float32Array(value);
      if (ArrayBuffer.isView(value)) {
        const bytes = new Uint8Array(
          value.buffer,
          value.byteOffset,
          value.byteLength,
        );
        const cloned = new Uint8Array(bytes.length);
        cloned.set(bytes);
        const usableLength = Math.floor(cloned.byteLength / 4);
        return new Float32Array(cloned.buffer, 0, usableLength);
      }
      if (Array.isArray(value)) {
        return Float32Array.from(value, (v) => Number(v) || 0);
      }
      return new Float32Array(width * height);
    };

    let data = toFloat32Pattern(patternData);

    if (data.length !== width * height) {
      const normalised = new Float32Array(width * height);
      normalised.set(data.subarray(0, Math.min(data.length, normalised.length)));
      data = normalised;
    }

    const desiredW = Math.max(1, Math.floor(Number(targetW) || 1));
    const desiredH = Math.max(1, Math.floor(Number(targetH) || 1));
    if (width !== desiredW || height !== desiredH) {
      const fitted = new Float32Array(desiredW * desiredH);
      const copyW = Math.min(width, desiredW);
      const copyH = Math.min(height, desiredH);
      const srcOffX = Math.floor((width - copyW) / 2);
      const srcOffY = Math.floor((height - copyH) / 2);
      const dstOffX = Math.floor((desiredW - copyW) / 2);
      const dstOffY = Math.floor((desiredH - copyH) / 2);

      for (let y = 0; y < copyH; y++) {
        const srcRow = (srcOffY + y) * width + srcOffX;
        const dstRow = (dstOffY + y) * desiredW + dstOffX;
        for (let x = 0; x < copyW; x++) {
          fitted[dstRow + x] = data[srcRow + x] || 0;
        }
      }

      data = fitted;
      width = desiredW;
      height = desiredH;
    }

    const limitW = Number.isFinite(maxW)
      ? Math.max(1, Math.floor(Number(maxW) || 1))
      : Infinity;
    const limitH = Number.isFinite(maxH)
      ? Math.max(1, Math.floor(Number(maxH) || 1))
      : Infinity;

    if (width > limitW || height > limitH) {
      const copyW = Math.min(width, limitW);
      const copyH = Math.min(height, limitH);
      const srcOffX = Math.floor((width - copyW) / 2);
      const srcOffY = Math.floor((height - copyH) / 2);
      const cropped = new Float32Array(copyW * copyH);

      for (let y = 0; y < copyH; y++) {
        const srcRow = (srcOffY + y) * width + srcOffX;
        const dstRow = y * copyW;
        for (let x = 0; x < copyW; x++) {
          cropped[dstRow + x] = data[srcRow + x] || 0;
        }
      }

      data = cropped;
      width = copyW;
      height = copyH;
    }

    return {
      patternData: data,
      patternWidth: width,
      patternHeight: height,
    };
  }

  _placeAnimalND(animal, cellX, cellY, scale) {
    if (!animal || !animal.cells) return;
    const cellsStr = Array.isArray(animal.cells)
      ? animal.cells[0]
      : animal.cells;
    const isND =
      typeof cellsStr === "string" &&
      (cellsStr.includes("%") || cellsStr.includes("#"));

    const dimension = Number(this.params.dimension) || 2;
    const size = this.params.latticeExtent;
    const depth = NDCompat.getWorldDepthForDimension(size, dimension);
    const extraDims = Math.max(0, dimension - 2);

    if (isND) {
      const slices = RLECodec.parseND(cellsStr);
      if (!slices || slices.length === 0) return;

      const sourceSliceMap = new Map();
      let maxSourceZIndex = 0;
      let maxSourceWIndex = 0;
      let maxSliceWidth = 0;
      let maxSliceHeight = 0;

      for (const slice of slices) {
        const sourceZIndex = Math.max(0, Math.floor(Number(slice.z) || 0));
        const sourceWIndex =
          extraDims >= 2 ? Math.max(0, Math.floor(Number(slice.w) || 0)) : 0;

        const grid = slice.grid;
        const h = grid.length;
        const w = grid[0]?.length || 0;
        if (w === 0 || h === 0) continue;

        const patternData = this._scaleGrid(grid, w, h, scale);
        const scaledWidth =
          Math.abs((scale || 1) - 1) < 1e-6
            ? w
            : Math.max(1, Math.round(w * scale));
        const scaledHeight =
          Math.abs((scale || 1) - 1) < 1e-6
            ? h
            : Math.max(1, Math.round(h * scale));

        if (scaledWidth > maxSliceWidth) maxSliceWidth = scaledWidth;
        if (scaledHeight > maxSliceHeight) maxSliceHeight = scaledHeight;
        if (sourceZIndex > maxSourceZIndex) maxSourceZIndex = sourceZIndex;
        if (sourceWIndex > maxSourceWIndex) maxSourceWIndex = sourceWIndex;

        sourceSliceMap.set(`${sourceZIndex},${sourceWIndex}`, {
          patternData,
          patternWidth: scaledWidth,
          patternHeight: scaledHeight,
        });
      }

      if (sourceSliceMap.size === 0) return;

      // Scale depth support as well so ND stamping follows X/Y/Z/(W) uniformly.
      const sourceZCount = maxSourceZIndex + 1;
      const sourceWCount = extraDims >= 2 ? maxSourceWIndex + 1 : 1;
      const targetZCount = Math.max(1, Math.round(sourceZCount * scale));
      const targetWCount =
        extraDims >= 2 ? Math.max(1, Math.round(sourceWCount * scale)) : 1;
      const worldOffsetZ = Math.floor((depth - targetZCount) / 2);
      const worldOffsetW =
        extraDims >= 2 ? Math.floor((depth - targetWCount) / 2) : 0;

      const preparedSourceSliceMap = new Map();
      for (const [key, source] of sourceSliceMap.entries()) {
        preparedSourceSliceMap.set(
          key,
          this._fitPatternToFootprint(
            source.patternData,
            source.patternWidth,
            source.patternHeight,
            {
              targetW: maxSliceWidth,
              targetH: maxSliceHeight,
              maxW: size,
              maxH: size,
            },
          ),
        );
      }

      const planeEntries = [];
      for (let targetWIndex = 0; targetWIndex < targetWCount; targetWIndex++) {
        const sourceWIndex =
          extraDims >= 2
            ? this._mapNearestIndex(targetWIndex, sourceWCount, targetWCount, {
                centerWhenCollapsed: true,
              })
            : 0;
        const worldWIndex = targetWIndex + worldOffsetW;
        if (extraDims >= 2 && (worldWIndex < 0 || worldWIndex >= depth)) {
          continue;
        }

        for (let targetZIndex = 0; targetZIndex < targetZCount; targetZIndex++) {
          const sourceZIndex = this._mapNearestIndex(
            targetZIndex,
            sourceZCount,
            targetZCount,
            {
              centerWhenCollapsed: true,
            },
          );
          const worldZIndex = targetZIndex + worldOffsetZ;
          if (worldZIndex < 0 || worldZIndex >= depth) continue;

          const source = preparedSourceSliceMap.get(
            `${sourceZIndex},${sourceWIndex}`,
          );
          if (!source) continue;

          const plane =
            extraDims >= 2
              ? worldZIndex + worldWIndex * depth
              : worldZIndex;
          planeEntries.push({
            plane,
            patternData: source.patternData,
            patternWidth: source.patternWidth,
            patternHeight: source.patternHeight,
          });
        }
      }

      if (planeEntries.length === 0) return;

      this._workerNDMutation({
        type: "placeND",
        planeEntries,
        cellX,
        cellY,
      });
    } else {
      const grids = this.board._getPatternGrids(animal);
      if (!grids || grids.length === 0) return;
      const grid = grids[0];
      const h = grid.length;
      const w = grid[0]?.length || 0;
      if (w === 0 || h === 0) return;

      const patternData = this._scaleGrid(grid, w, h, scale);
      let pw =
        Math.abs((scale || 1) - 1) < 1e-6
          ? w
          : Math.max(1, Math.round(w * scale));
      let ph =
        Math.abs((scale || 1) - 1) < 1e-6
          ? h
          : Math.max(1, Math.round(h * scale));

      const fitted = this._fitPatternToFootprint(patternData, pw, ph, {
        maxW: size,
        maxH: size,
      });
      pw = fitted.patternWidth;
      ph = fitted.patternHeight;

      this._workerNDMutation({
        type: "place",
        patternData: fitted.patternData,
        patternWidth: pw,
        patternHeight: ph,
        cellX,
        cellY,
      });
    }
  }

  _scaleGrid(grid, w, h, scale) {
    if (Math.abs((scale || 1) - 1) < 1e-6) {
      const data = new Float32Array(h * w);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) data[y * w + x] = grid[y][x] || 0;
      return data;
    }
    const pw = Math.max(1, Math.round(w * scale));
    const ph = Math.max(1, Math.round(h * scale));
    const data = new Float32Array(ph * pw);
    for (let dy = 0; dy < ph; dy++) {
      for (let dx = 0; dx < pw; dx++) {
        const srcX = this._mapNearestIndex(dx, w, pw);
        const srcY = this._mapNearestIndex(dy, h, ph);
        data[dy * pw + dx] = grid[srcY]?.[srcX] || 0;
      }
    }
    return data;
  }

  placeAnimalRandom() {
    const selection = this.params.selectedAnimal || "";
    const animal = this._resolveAnimalForPlacement(selection);
    if (!animal) return;

    const size = this.params.latticeExtent;
    const cellX = Math.floor(Math.random() * size);
    const cellY = Math.floor(Math.random() * size);
    const scale = this.params.placeScale || 1;
    const request = { selection, cellX, cellY, scale };

    this._queueAction("placeAnimalRandom", () =>
      this._queueOrRunMutation(() => {
        this._executePlacementRequest(request);
      }),
    );
  }
}

AppCore.installMethodsFrom(AppCoreAnimalMethods);
