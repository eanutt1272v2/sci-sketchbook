class AppCoreSolitonMethods {
  _isNDSliceEncodedEntry(entry) {
    return (
      typeof entry === "string" && (entry.includes("%") || entry.includes("#"))
    );
  }

  _getActiveNDSliceIndices(depth) {
    const safeDepth = Math.max(1, Math.floor(Number(depth) || 1));
    const dim = Number(this.params.dimension) || 2;
    const z = NDCompatibility.coerceSliceIndex(this.params.ndSliceZ, safeDepth);
    const wBase = dim >= 4 ? this.params.ndSliceW : Math.floor(safeDepth / 2);
    const w = NDCompatibility.coerceSliceIndex(wBase, safeDepth);
    return { z, w };
  }

  _rememberSelectedSolitonForCurrentDimension(selection) {
    if (
      !this._selectedSolitonByDimension ||
      typeof this._selectedSolitonByDimension !== "object"
    ) {
      this._selectedSolitonByDimension = { 2: "", 3: "", 4: "" };
    }
    const dim = NDCompatibility.coerceDimension(this.params.dimension);
    this._selectedSolitonByDimension[dim] =
      selection === null || typeof selection === "undefined"
        ? ""
        : String(selection);
  }

  _getRememberedSolitonSelectionForDimension(
    dimension = this.params.dimension,
  ) {
    const dim = NDCompatibility.coerceDimension(dimension);
    if (
      !this._selectedSolitonByDimension ||
      typeof this._selectedSolitonByDimension !== "object"
    ) {
      return "";
    }
    return String(this._selectedSolitonByDimension[dim] || "");
  }

  _setSelectedSolitonForActiveDimension(
    preferredSelection = null,
    { fallbackIndex = 0, skipNextParamsLoad = true } = {},
  ) {
    this._applySolitonSource?.();

    const solitons = Array.isArray(this.solitonLibrary?.solitons)
      ? this.solitonLibrary.solitons
      : [];
    const total = solitons.length;

    if (total <= 0) {
      this.params.selectedSoliton = "";
      if (skipNextParamsLoad) {
        this._skipNextSolitonParamsLoad = true;
        this._lastSolitonParamsSelection = "";
      }
      this._rememberSelectedSolitonForCurrentDimension("");
      return null;
    }

    const candidates = [];
    if (
      preferredSelection !== null &&
      typeof preferredSelection !== "undefined"
    ) {
      candidates.push(preferredSelection);
    }
    candidates.push(this.params.selectedSoliton);

    const remembered = this._getRememberedSolitonSelectionForDimension();
    if (remembered !== "") {
      candidates.push(remembered);
    }
    candidates.push(fallbackIndex);

    let idx = NaN;
    for (const candidate of candidates) {
      const parsed = parseInt(String(candidate), 10);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed < total) {
        idx = parsed;
        break;
      }
    }

    if (!Number.isFinite(idx)) {
      idx = 0;
    }

    const selection = String(idx);
    this.params.selectedSoliton = selection;
    this._rememberSelectedSolitonForCurrentDimension(selection);

    if (skipNextParamsLoad) {
      this._skipNextSolitonParamsLoad = true;
      this._lastSolitonParamsSelection = selection;
    }

    return this.solitonLibrary.getSoliton(idx);
  }

  _pack2DSeedForND(rawCells, channelCount, scale = 1) {
    const dimension = Number(this.params.dimension) || 2;
    if (dimension <= 2) return null;

    const size = this.params.latticeExtent;
    const depth = NDCompatibility.getWorldDepthForDimension(size, dimension);
    const extraDims = Math.max(0, dimension - 2);
    const planeCount = Math.pow(depth, extraDims);
    const cellCount = size * size;
    const planeCellCount = cellCount * channelCount;
    const packed = new Float32Array(planeCellCount * planeCount);
    const { z, w } = this._getActiveNDSliceIndices(depth);
    const plane = extraDims >= 2 ? z + w * depth : z;
    if (plane < 0 || plane >= planeCount) return null;

    const requestedScale = Number(scale) || 1;
    const useNativeScale = Math.abs(requestedScale - 1) < 1e-6;
    const prepared = [];
    let maxH = 0;
    let maxW_ = 0;

    for (let c = 0; c < channelCount; c++) {
      const entry = rawCells[Math.min(c, rawCells.length - 1)];
      if (typeof entry !== "string" || this._isNDSliceEncodedEntry(entry)) {
        continue;
      }

      const grid = RLECodec.parse(entry);
      const h = grid.length;
      const wGrid = grid[0]?.length || 0;
      if (wGrid <= 0 || h <= 0) continue;

      let scaledData = null;
      let scaledW = wGrid;
      let scaledH = h;

      if (!useNativeScale) {
        scaledData = this._scaleGrid(grid, wGrid, h, requestedScale);
        scaledW = Math.max(1, Math.round(wGrid * requestedScale));
        scaledH = Math.max(1, Math.round(h * requestedScale));
      }

      if (scaledH > maxH) maxH = scaledH;
      if (scaledW > maxW_) maxW_ = scaledW;
      prepared.push({
        channel: c,
        grid,
        scaledData,
        scaledW,
        scaledH,
      });
    }

    if (prepared.length === 0) return null;

    for (const entry of prepared) {
      const h = entry.scaledH;
      const wGrid = entry.scaledW;
      const sy = Math.floor((size - maxH) / 2);
      const sx = Math.floor((size - maxW_) / 2);
      const gy = Math.floor((maxH - h) / 2);
      const gx = Math.floor((maxW_ - wGrid) / 2);
      const planeBase = plane * planeCellCount + entry.channel * cellCount;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < wGrid; x++) {
          const ty = sy + gy + y;
          const tx = sx + gx + x;
          if (ty < 0 || ty >= size || tx < 0 || tx >= size) continue;
          packed[planeBase + ty * size + tx] = useNativeScale
            ? entry.grid[y]?.[x] || 0
            : entry.scaledData[y * wGrid + x] || 0;
        }
      }
    }

    return packed;
  }

  _packNDSeed(soliton, scale = 1) {
    if (!soliton || !soliton.cells) return null;
    const channelCount = Math.max(
      1,
      Math.floor(Number(this.params.channelCount) || 1),
    );
    const rawCells = Array.isArray(soliton.cells)
      ? soliton.cells.slice()
      : [soliton.cells];
    if (!rawCells.length) return null;

    const channelSlices = [];
    let hasNDSlices = false;
    for (let c = 0; c < channelCount; c++) {
      const entry = rawCells[Math.min(c, rawCells.length - 1)];
      if (typeof entry !== "string") {
        channelSlices.push([]);
        continue;
      }
      const isND = this._isNDSliceEncodedEntry(entry);
      const parsed = isND
        ? RLECodec.parseND(entry)
        : [{ z: 0, w: 0, grid: RLECodec.parse(entry) }];
      if (isND && Array.isArray(parsed) && parsed.length > 0) {
        hasNDSlices = true;
      }
      channelSlices.push(Array.isArray(parsed) ? parsed : []);
    }

    if (!hasNDSlices) {
      return this._pack2DSeedForND(rawCells, channelCount, scale);
    }

    const dimension = Number(this.params.dimension) || 2;
    if (dimension <= 2) return null;

    const size = this.params.latticeExtent;
    const depth = NDCompatibility.getWorldDepthForDimension(size, dimension);
    const extraDims = Math.max(0, dimension - 2);
    const planeCount = Math.pow(depth, extraDims);
    const cellCount = size * size;
    const planeCellCount = cellCount * channelCount;
    const total = planeCellCount * planeCount;
    const packed = new Float32Array(total);

    let maxZ = 0,
      maxW = 0;
    for (let c = 0; c < channelSlices.length; c++) {
      const slices = channelSlices[c];
      for (const s of slices) {
        if (s.z > maxZ) maxZ = s.z;
        if (s.w > maxW) maxW = s.w;
      }
    }
    const solitonDepthZ = maxZ + 1;
    const solitonDepthW = maxW + 1;

    const offsetZ = Math.floor((depth - solitonDepthZ) / 2);
    const offsetW =
      extraDims >= 2 ? Math.floor((depth - solitonDepthW) / 2) : 0;

    const requestedScale = Number(scale) || 1;
    const useNativeScale = Math.abs(requestedScale - 1) < 1e-6;
    const preparedSlices = [];

    let maxH = 0,
      maxW_ = 0;
    for (let c = 0; c < channelSlices.length; c++) {
      const slices = channelSlices[c];
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
          channel: c,
          z: s.z,
          w: s.w,
          grid,
          scaledData,
          scaledW,
          scaledH,
        });
      }
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
      const planeBase = plane * planeCellCount + slice.channel * cellCount;

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

  loadSoliton(soliton, options = {}) {
    if (!soliton) return;

    this._pendingActions = this._pendingActions.filter(
      (action) => action.name !== "loadSolitonParams",
    );

    this._queueSolitonLoad(soliton, { loadPattern: true, ...options });
  }

  loadSelectedSoliton() {
    const soliton = this._setSelectedSolitonForActiveDimension(
      this.params.selectedSoliton,
      { skipNextParamsLoad: false },
    );
    if (!soliton) return;
    const selection = this.params.selectedSoliton || "";

    const boardSize = this.board?.size || this.params.latticeExtent;
    const centre = Math.floor(boardSize / 2);
    const request = this._normalisePlacementRequest(
      {
        selection,
        cellX: centre,
        cellY: centre,
        scale: this._getCombinedPlacementScale(selection),
      },
      boardSize,
      boardSize,
    );
    if (!request) return;

    this._queuePlacementRequest("reloadSolitonAtCentre", request, {
      clearBeforePlace: true,
      resetAnalysis: true,
    });
  }

  cycleSoliton(delta) {
    const lib = this.solitonLibrary;
    if (!lib || !lib.solitons || lib.solitons.length === 0) return;

    const preservedRadius = Math.max(
      2,
      Number(this.params.R) || this.getDefaultRadius(),
    );
    const preservedScaleFactor = this._getHiddenSolitonScaleFactor(1);

    const total = lib.solitons.length;
    const current = this.getSelectedSolitonIndex();
    const base = current === null ? (delta > 0 ? -1 : 0) : current;
    const next = (((base + delta) % total) + total) % total;
    const nextSelection = String(next);

    const soliton = this._setSelectedSolitonForActiveDimension(nextSelection, {
      skipNextParamsLoad: true,
    });
    if (soliton) {
      this.loadSoliton(soliton, {
        preserveScaleFactor: true,
        preservedRadius,
        preservedScaleFactor,
      });
    }
    this.refreshGUI();
  }

  selectSolitonByIndex(index, { preserveScaleFactor = true } = {}) {
    const lib = this.solitonLibrary;
    if (!lib || !Array.isArray(lib.solitons) || lib.solitons.length === 0) {
      return false;
    }

    const idx = Math.floor(Number(index));
    if (!Number.isFinite(idx) || idx < 0 || idx >= lib.solitons.length) {
      return false;
    }

    const preservedRadius = Math.max(
      2,
      Number(this.params.R) || this.getDefaultRadius(),
    );
    const nextSelection = String(idx);
    const preservedScaleFactor = preserveScaleFactor
      ? this._getHiddenSolitonScaleFactor(1)
      : 1;

    const soliton = this._setSelectedSolitonForActiveDimension(nextSelection, {
      skipNextParamsLoad: true,
    });
    if (!soliton) return false;

    this.loadSoliton(soliton, {
      preserveScaleFactor,
      preservedRadius,
      preservedScaleFactor,
    });
    return true;
  }

  loadSolitonParams(soliton, options = {}) {
    if (!soliton) return;

    this._queueSolitonLoad(soliton, { loadPattern: false, ...options });
  }

  _queueSolitonLoad(
    soliton,
    {
      loadPattern = true,
      preserveScaleFactor = false,
      preservedRadius = null,
      preservedScaleFactor = null,
    } = {},
  ) {
    const actionName = loadPattern ? "loadSoliton" : "loadSolitonParams";

    this._queueAction(actionName, () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        this.analyser.resetStatistics();

        const sourceParams = this._getSolitonSourceParams(soliton) || {};
        const sourceR = Number(sourceParams.R);
        const currentKn = Number(this.params.kn) || 1;
        const nextKn = Number(sourceParams.kn) || currentKn;
        const isCurrentLife = currentKn === 4;
        const isNextLife = nextKn === 4;
        const solitonCode = String(soliton?.code || "")
          .trim()
          .toLowerCase();
        const forcePartR = solitonCode.startsWith("~");
        const forceNativeBugR =
          solitonCode === "sbug" || solitonCode === "bbug";
        const defaultR = this.getDefaultRadius(
          this.params.latticeExtent,
          this.params.dimension,
        );
        const maxR = this.getMaxKernelRadius(this.params.latticeExtent);
        const hiddenScaleFactor = this._getHiddenSolitonScaleFactor(1);
        const preservedFactorValue =
          preserveScaleFactor && Number.isFinite(Number(preservedScaleFactor))
            ? Math.max(0.01, Number(preservedScaleFactor))
            : preserveScaleFactor
              ? hiddenScaleFactor
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
        this._applySolitonSimulationParams(soliton);
        // Ensure board/worker buffers match soliton channel topology before seeding cells.
        this._ensureBuffers();

        let zoomFactor = 1;
        let patternScale = 1;

        if (Number.isFinite(sourceR) && sourceR > 0) {
          if (Number.isFinite(preservedFactorValue)) {
            zoomFactor = Math.max(0.01, preservedFactorValue);
          } else {
            zoomFactor = Math.max(0.01, baseR / sourceR);
          }

          this.params.R = Math.round(constrain(sourceR * zoomFactor, 2, maxR));
          zoomFactor = Math.max(0.01, this.params.R / sourceR);
          patternScale = zoomFactor;
          this._setHiddenSolitonScaleFactor(zoomFactor);
        }

        this.params.R = Math.round(
          constrain(Number(this.params.R) || baseR, 2, maxR),
        );

        if (loadPattern) {
          const selection = this.params.selectedSoliton || "";
          const boardSize = this.board?.size || this.params.latticeExtent;
          const centre = Math.floor(boardSize / 2);
          const request = this._normalisePlacementRequest(
            {
              selection,
              cellX: centre,
              cellY: centre,
              scale: patternScale,
            },
            boardSize,
            boardSize,
          );
          if (request) {
            this._applyPlacementRequest(request, {
              clearBeforePlace: true,
              resetAnalysis: true,
            });
          }
        }

        this.updateAutomatonParams();
        this._prevR = this.params.R;

        if (this.gui && typeof this.gui.rebuildPane === "function") {
          this.gui.rebuildPane();
        } else {
          this.refreshGUI();
        }
      }),
    );
  }

  _applySolitonSimulationParams(soliton) {
    if (!soliton) return false;

    this.solitonLibrary.applySolitonParameters(soliton);

    return true;
  }

  applySelectedSolitonParams({ refreshGUI = false } = {}) {
    const soliton = this._setSelectedSolitonForActiveDimension(
      this.params.selectedSoliton,
      { skipNextParamsLoad: false },
    );
    if (!soliton) return false;

    this._applySolitonSimulationParams(soliton);
    this.updateAutomatonParams();
    if (refreshGUI) this.refreshGUI();
    return true;
  }

  _normaliseHiddenSolitonScaleFactor(value, fallback = 1) {
    const safeFallback =
      Number.isFinite(Number(fallback)) && Number(fallback) > 0
        ? Number(fallback)
        : 1;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : safeFallback;
  }

  _getHiddenSolitonScaleFactor(fallback = 1) {
    return this._normaliseHiddenSolitonScaleFactor(
      this._hiddenSolitonScaleFactor,
      fallback,
    );
  }

  _setHiddenSolitonScaleFactor(value) {
    this._hiddenSolitonScaleFactor = this._normaliseHiddenSolitonScaleFactor(
      value,
      1,
    );
    return this._hiddenSolitonScaleFactor;
  }

  _getSolitonSourceParams(soliton) {
    if (!soliton || !soliton.params) return null;
    return Array.isArray(soliton.params)
      ? soliton.params.find((entry) => entry && typeof entry === "object") ||
          soliton.params[0] ||
          null
      : soliton.params;
  }

  _getScaleFactorForSelection(selection, fallback = 1) {
    const hidden = this._getHiddenSolitonScaleFactor(fallback);
    if (Number.isFinite(hidden) && hidden > 0) return hidden;

    if (
      selection === null ||
      typeof selection === "undefined" ||
      String(selection).trim() === ""
    ) {
      return fallback;
    }

    const soliton = this._resolveSolitonForPlacement(selection);
    if (!soliton) return fallback;

    const sourceParams = this._getSolitonSourceParams(soliton) || {};
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

  _getCombinedPlacementScale(selection = this.params.selectedSoliton) {
    return this._getHiddenSolitonScaleFactor(
      this._getScaleFactorForSelection(selection, 1),
    );
  }

  syncPlacementScaleToRadius(selection = this.params.selectedSoliton) {
    const soliton = this._resolveSolitonForPlacement(selection);
    if (!soliton) return this._getHiddenSolitonScaleFactor(1);

    const sourceParams = this._getSolitonSourceParams(soliton) || {};
    const sourceR = Number(sourceParams.R);
    const currentR = Number(this.params.R);

    if (
      Number.isFinite(sourceR) &&
      sourceR > 0 &&
      Number.isFinite(currentR) &&
      currentR > 0
    ) {
      return this._setHiddenSolitonScaleFactor(currentR / sourceR);
    }

    return this._getHiddenSolitonScaleFactor(1);
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

  loadSelectedSolitonParams() {
    const currentSelection = this.params.selectedSoliton || "";

    if (this._skipNextSolitonParamsLoad) {
      this._skipNextSolitonParamsLoad = false;
      this._lastSolitonParamsSelection = currentSelection;
      return;
    }

    if (currentSelection === this._lastSolitonParamsSelection) {
      return;
    }

    this._lastSolitonParamsSelection = currentSelection;
    const soliton = this.getSelectedSoliton();
    if (soliton) {
      this.loadSolitonParams(soliton, {
        preserveScaleFactor: true,
        preservedRadius: Math.max(
          2,
          Number(this.params.R) || this.getDefaultRadius(),
        ),
        preservedScaleFactor: this._getHiddenSolitonScaleFactor(1),
      });
    }
  }

  _hasQueuedAction(name) {
    return this._pendingActions.some((action) => action?.name === name);
  }

  _resolveSolitonForPlacement(selection) {
    this._applySolitonSource?.();

    const lib = this.solitonLibrary;
    const solitons = Array.isArray(lib?.solitons) ? lib.solitons : [];
    const total = solitons.length;
    if (total <= 0) return null;

    const candidates = [];
    if (selection !== null && typeof selection !== "undefined") {
      candidates.push(selection);
    }
    candidates.push(this.params.selectedSoliton);
    candidates.push(this._getRememberedSolitonSelectionForDimension());

    for (const candidate of candidates) {
      const idx = parseInt(String(candidate), 10);
      if (!Number.isFinite(idx) || idx < 0 || idx >= total) continue;
      const soliton = lib.getSoliton(idx);
      if (soliton) return soliton;
    }

    return lib.getSoliton(0);
  }

  _executePlacementRequest(request) {
    if (!request) return;

    const soliton = this._resolveSolitonForPlacement(request.selection);
    if (!soliton) return;

    const requestedScale = Number(request.scale);
    const scale =
      Number.isFinite(requestedScale) && requestedScale > 0
        ? requestedScale
        : this._getCombinedPlacementScale(request.selection);
    const dim = Number(this.params.dimension) || 2;
    this._ensureBuffers();

    if (dim > 2) {
      this._placeSolitonND(soliton, request.cellX, request.cellY, scale);
    } else {
      this._applyPlacement({
        soliton,
        cellX: request.cellX,
        cellY: request.cellY,
        scale,
      });
    }
  }

  _applyPlacementRequest(
    request,
    { clearBeforePlace = false, resetAnalysis = false } = {},
  ) {
    if (!request) return;

    this._ensureBuffers();
    const dim = Number(this.params.dimension) || 2;

    if (clearBeforePlace) {
      this.board.clear();
      if (dim > 2) {
        this._workerNDMutation({ type: "clear" });
      }
    }

    if (resetAnalysis) {
      this.analyser.resetStatistics();
      this.analyser.reset();
    }

    this._executePlacementRequest(request);
  }

  _queuePlacementRequest(actionName, request, options = {}) {
    if (!request) return;
    this._queueAction(actionName, () =>
      this._queueOrRunMutation(() => {
        this._applyPlacementRequest(request, options);
      }),
    );
  }

  placeSoliton(cellX, cellY) {
    if (!this.params.placeMode) return;

    const selection = this.params.selectedSoliton || "";
    const soliton = this._resolveSolitonForPlacement(selection);
    if (!soliton) return;

    const scale = this._getCombinedPlacementScale(selection);
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
      this._hasQueuedAction("loadSolitonParams") ||
      this._hasQueuedAction("loadSoliton")
    ) {
      this._queuePlacementRequest("deferredPlacement", request);
      return;
    }

    if (!this.board.world || (this._worker && this._workerBusy)) {
      this._pendingPlacement = request;
      return;
    }

    this._applyPlacementRequest(request);
  }

  _applyPlacement({ soliton, cellX, cellY, scale }) {
    if (!soliton) return;
    if (Math.abs((scale || 1) - 1) < 1e-6) {
      this.board.placePattern(soliton, cellX, cellY);
    } else {
      this.board.placePatternScaled(soliton, cellX, cellY, scale);
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
    { targetW = srcW, targetH = srcH, maxW = Infinity, maxH = Infinity } = {},
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
      normalised.set(
        data.subarray(0, Math.min(data.length, normalised.length)),
      );
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

  _placeSolitonND(soliton, cellX, cellY, scale) {
    if (!soliton || !soliton.cells) return;
    const channelCount = Math.max(
      1,
      Math.floor(Number(this.params.channelCount) || 1),
    );
    const rawCells = Array.isArray(soliton.cells)
      ? soliton.cells.slice()
      : [soliton.cells];
    if (!rawCells.length) return;

    const getCellEntry = (channel) =>
      rawCells[Math.min(channel, rawCells.length - 1)];
    const parseGridEntry = (entry) => {
      if (typeof entry === "string") return RLECodec.parse(entry);
      if (Array.isArray(entry) && entry.length > 0 && Array.isArray(entry[0])) {
        return entry;
      }
      return null;
    };

    const dimension = Number(this.params.dimension) || 2;
    const size = this.params.latticeExtent;
    const depth = NDCompatibility.getWorldDepthForDimension(size, dimension);
    const extraDims = Math.max(0, dimension - 2);

    let hasAnyNDSlices = false;
    for (let c = 0; c < channelCount; c++) {
      const entry = getCellEntry(c);
      if (this._isNDSliceEncodedEntry(entry)) {
        hasAnyNDSlices = true;
        break;
      }
    }

    if (hasAnyNDSlices) {
      const planeEntries = [];

      for (let channel = 0; channel < channelCount; channel++) {
        const entry = getCellEntry(channel);
        const slices = this._isNDSliceEncodedEntry(entry)
          ? RLECodec.parseND(entry)
          : null;

        if (!Array.isArray(slices) || slices.length === 0) continue;

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

        if (sourceSliceMap.size === 0) continue;

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

        for (
          let targetWIndex = 0;
          targetWIndex < targetWCount;
          targetWIndex++
        ) {
          const sourceWIndex =
            extraDims >= 2
              ? this._mapNearestIndex(
                  targetWIndex,
                  sourceWCount,
                  targetWCount,
                  {
                    centerWhenCollapsed: true,
                  },
                )
              : 0;
          const worldWIndex = targetWIndex + worldOffsetW;
          if (extraDims >= 2 && (worldWIndex < 0 || worldWIndex >= depth)) {
            continue;
          }

          for (
            let targetZIndex = 0;
            targetZIndex < targetZCount;
            targetZIndex++
          ) {
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
              extraDims >= 2 ? worldZIndex + worldWIndex * depth : worldZIndex;
            planeEntries.push({
              plane,
              channel,
              patternData: source.patternData,
              patternWidth: source.patternWidth,
              patternHeight: source.patternHeight,
            });
          }
        }
      }

      if (planeEntries.length === 0) return;

      this._workerNDMutation({
        type: "placeND",
        planeEntries,
        cellX,
        cellY,
      });
      return;
    }

    const { z, w } = this._getActiveNDSliceIndices(depth);
    const targetPlane = extraDims >= 2 ? z + w * depth : z;
    const planeEntries = [];

    for (let channel = 0; channel < channelCount; channel++) {
      const grid = parseGridEntry(getCellEntry(channel));
      if (!grid || grid.length === 0 || !Array.isArray(grid[0])) continue;
      const h = grid.length;
      const w = grid[0]?.length || 0;
      if (w === 0 || h === 0) continue;

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

      planeEntries.push({
        plane: targetPlane,
        channel,
        patternData: fitted.patternData,
        patternWidth: pw,
        patternHeight: ph,
      });
    }

    if (planeEntries.length === 0) return;

    this._workerNDMutation({
      type: "placeND",
      planeEntries,
      cellX,
      cellY,
    });
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

  placeSolitonRandom() {
    const selection = this.params.selectedSoliton || "";
    const soliton = this._resolveSolitonForPlacement(selection);
    if (!soliton) return;

    const size = this.params.latticeExtent;
    const cellX = Math.floor(Math.random() * size);
    const cellY = Math.floor(Math.random() * size);
    const scale = this._getCombinedPlacementScale(selection);
    const request = { selection, cellX, cellY, scale };

    this._queuePlacementRequest("placeSolitonRandom", request);
  }
}

AppCore.installMethodsFrom(AppCoreSolitonMethods);
