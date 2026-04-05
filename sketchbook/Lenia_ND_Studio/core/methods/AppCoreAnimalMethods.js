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

  syncPlacementScaleToRadius(selection = this.params.selectedAnimal) {
    const linkedScale = this._getRadiusLinkedPlacementScale(selection);
    const fallback = this.getEffectivePlacementScale(this.params.placeScale);
    const nextRaw = Number.isFinite(linkedScale) ? linkedScale : fallback;
    const next = constrain(nextRaw, 0.25, 4);

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
    this.syncPlacementScaleToRadius(this.params.selectedAnimal);

    const animal = this.getSelectedAnimal();
    const sourceParams = this._getAnimalSourceParams(animal) || {};
    const sourceR = Number(sourceParams.R);
    const currentR = Math.max(2, Number(this.params.R) || 13);
    const currentScale = constrain(
      Number(this._lastPlacementScale) || 1,
      0.25,
      4,
    );
    const baseR =
      Number.isFinite(sourceR) && sourceR > 0
        ? sourceR
        : Number.isFinite(currentScale) && Math.abs(currentScale) > 1e-9
          ? currentR / currentScale
          : currentR;

    const next = constrain(Number(scale) || 1, 0.25, 4);
    this.params.placeScale = next;
    this._lastPlacementScale = next;

    const updated = this.applySelectedAnimalScaledRT(next, {
      baseR,
      refreshGUI: false,
    });

    if (!updated) {
      this.syncPlacementScaleToRadius(this.params.selectedAnimal);
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

    let scale = this.getEffectivePlacementScale(request.scale);
    const sourceParams = this._getAnimalSourceParams(animal) || {};
    const sourceR = Number(sourceParams.R);
    const dim = Number(this.params.dimension) || 2;
    if (Number.isFinite(sourceR) && sourceR > 0) {
      const targetR = Math.max(2, Number(this.params.R) || sourceR);
      scale = targetR / sourceR;
    }
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

      let maxZ = 0,
        maxW = 0;
      for (const s of slices) {
        if (s.z > maxZ) maxZ = s.z;
        if (s.w > maxW) maxW = s.w;
      }
      const offsetZ = Math.floor((depth - (maxZ + 1)) / 2);
      const offsetW = extraDims >= 2 ? Math.floor((depth - (maxW + 1)) / 2) : 0;

      const planeEntries = [];
      for (const slice of slices) {
        const cz = slice.z + offsetZ;
        const cw = slice.w + offsetW;
        if (cz < 0 || cz >= depth || cw < 0 || cw >= depth) continue;
        const plane = extraDims >= 2 ? cz + cw * depth : cz;

        const grid = slice.grid;
        const h = grid.length;
        const w = grid[0]?.length || 0;
        if (w === 0 || h === 0) continue;

        const patternData = this._scaleGrid(grid, w, h, scale);
        planeEntries.push({
          plane,
          patternData,
          patternWidth:
            Math.abs((scale || 1) - 1) < 1e-6
              ? w
              : Math.max(1, Math.round(w * scale)),
          patternHeight:
            Math.abs((scale || 1) - 1) < 1e-6
              ? h
              : Math.max(1, Math.round(h * scale)),
        });
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
      const pw =
        Math.abs((scale || 1) - 1) < 1e-6
          ? w
          : Math.max(1, Math.round(w * scale));
      const ph =
        Math.abs((scale || 1) - 1) < 1e-6
          ? h
          : Math.max(1, Math.round(h * scale));

      this._workerNDMutation({
        type: "place",
        patternData,
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
    const mapNearestIndex = (dstIndex, srcSize, dstSize) => {
      if (srcSize <= 1 || dstSize <= 1) return 0;
      const srcPos = (dstIndex * (srcSize - 1)) / (dstSize - 1);
      return Math.max(0, Math.min(srcSize - 1, Math.round(srcPos)));
    };
    for (let dy = 0; dy < ph; dy++) {
      for (let dx = 0; dx < pw; dx++) {
        const srcX = mapNearestIndex(dx, w, pw);
        const srcY = mapNearestIndex(dy, h, ph);
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
