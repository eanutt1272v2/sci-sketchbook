class ControlMethods {
  getSelectedAnimalIndex() {
    const value = this.params.selectedAnimal;
    if (!value || value === "") return null;

    const idx = parseInt(value, 10);
    return Number.isNaN(idx) ? null : idx;
  }

  getSelectedAnimal() {
    const idx = this.getSelectedAnimalIndex();
    if (idx === null) return null;
    return this.animalLibrary.getAnimal(idx);
  }

  getViewModeOptions() {
    const modes = NDCompat.getViewModesForDimension(this.params.dimension);

    return modes.reduce((options, mode) => {
      if (mode === "slice") options["Slice"] = mode;
      if (mode === "projection") options["Projection"] = mode;
      return options;
    }, {});
  }

  getGridSizeOptions(dimension = this.params.dimension) {
    const dim = NDCompat.coerceDimension(dimension);
    const sizes = NDCompat.getGridSizeOptions(dim);
    const canvasSize = min(windowWidth, windowHeight);
    const superscriptDigits = {
      0: "⁰",
      1: "¹",
      2: "²",
      3: "³",
      4: "⁴",
      5: "⁵",
      6: "⁶",
      7: "⁷",
      8: "⁸",
      9: "⁹",
      "-": "⁻",
    };
    const dimPower = String(dim)
      .split("")
      .map((char) => superscriptDigits[char] || char)
      .join("");
    const options = {};
    for (const size of sizes) {
      if (size <= canvasSize) {
        options[`${size}${dimPower}`] = size;
      }
    }
    if (Object.keys(options).length === 0) {
      options[`${sizes[0]}${dimPower}`] = sizes[0];
    }
    return options;
  }

  getMaxKernelRadius(latticeExtent = this.params.latticeExtent) {
    const size = Math.max(1, Math.floor(Number(latticeExtent) || 1));
    return Math.max(2, Math.floor(size / 2));
  }

  getMaxTimeScale() {
    return 1500;
  }

  nudgeRadius(delta) {
    const step = Math.floor(Number(delta) || 0);
    if (!Number.isFinite(step) || step === 0) return;

    const maxR = this.getMaxKernelRadius();
    const currentR = Math.round(Number(this.params.R) || 2);
    const nextR = Math.max(2, Math.min(maxR, currentR + step));
    if (nextR === currentR) return;

    this.zoomWorld(nextR);
  }

  getDefaultRadius(
    latticeExtent = this.params.latticeExtent,
    dimension = this.params.dimension,
  ) {
    const size = Math.max(1, Math.floor(Number(latticeExtent) || 1));
    const dim = NDCompat.coerceDimension(dimension);
    const raw = (size / 64) * dim * 5;
    return Math.round(constrain(raw, 2, this.getMaxKernelRadius(size)));
  }

  getEffectivePlacementScale(scale = this.params.placeScale) {
    const uiScale = constrain(Number(scale) || 1, 0.25, 4);
    return uiScale;
  }

  _coerceAutoRotateModeValue(mode = this.params.autoRotateMode) {
    if (typeof mode === "string") {
      const key = mode.trim().toLowerCase();
      if (key === "off") return 0;
      if (key === "arrow" || key === "arrow (velocity)" || key === "velocity") {
        return 1;
      }
      if (key === "symmetry" || key === "symm") return 2;
    }
    const numeric = Math.floor(Number(mode) || 0);
    return Math.max(0, Math.min(2, numeric));
  }

  getAutoRotateMode() {
    return this._coerceAutoRotateModeValue(this.params.autoRotateMode);
  }

  setAutoRotateMode(mode, { refreshGUI = true } = {}) {
    const nextMode = this._coerceAutoRotateModeValue(mode);
    this.params.autoRotateMode = nextMode;
    if (refreshGUI) this.refreshGUI();
    return nextMode;
  }

  cycleAutoRotateMode(delta = 1, { refreshGUI = true } = {}) {
    const current = this.getAutoRotateMode();
    const step = Math.floor(Number(delta) || 0) || 1;
    const next = (((current + step) % 3) + 3) % 3;
    return this.setAutoRotateMode(next, { refreshGUI });
  }

  getWorldShapeLabel() {
    const dim = Math.max(2, Math.floor(Number(this.params.dimension) || 2));
    const size = Math.max(
      1,
      Math.floor(Number(this.params.latticeExtent) || 1),
    );
    const shape = dim === 2 ? "square" : dim === 3 ? "cube" : "hypercube";
    return `${shape} ${size}^${dim}`;
  }

  _coerceNDActiveAxis(axis, dimension = this.params.dimension) {
    const dim = NDCompat.coerceDimension(dimension);
    if (dim <= 3) return "z";
    return String(axis || "z").toLowerCase() === "w" ? "w" : "z";
  }

  getNDActiveAxis() {
    return this._coerceNDActiveAxis(
      this.params.ndActiveAxis,
      this.params.dimension,
    );
  }

  setNDActiveAxis(axis, { refreshGUI = true } = {}) {
    if ((this.params.dimension || 2) <= 2) return "z";
    const nextAxis = this._coerceNDActiveAxis(axis, this.params.dimension);
    this.params.ndActiveAxis = nextAxis;
    if (refreshGUI) this.refreshGUI();
    return nextAxis;
  }

  cycleNDActiveAxis(delta = 1, { refreshGUI = true } = {}) {
    if ((this.params.dimension || 2) < 4) {
      this.params.ndActiveAxis = "z";
      if (refreshGUI) this.refreshGUI();
      return "z";
    }
    const step = Math.floor(Number(delta) || 0) || 1;
    const order = ["z", "w"];
    const current = this.getNDActiveAxis();
    const idx = order.indexOf(current);
    const safeIdx = idx >= 0 ? idx : 0;
    const next = order[(safeIdx + step + order.length) % order.length];
    this.params.ndActiveAxis = next;
    if (refreshGUI) this.refreshGUI();
    return next;
  }

  buildNDConfig() {
    const dimension = NDCompat.coerceDimension(this.params.dimension);
    const viewMode = NDCompat.coerceViewMode(dimension, this.params.viewMode);
    const ndDepth = NDCompat.getWorldDepthForDimension(
      this.params.latticeExtent,
      dimension,
    );
    const ndSliceZ = NDCompat.coerceSliceIndex(this.params.ndSliceZ, ndDepth);
    const ndSliceW = NDCompat.coerceSliceIndex(this.params.ndSliceW, ndDepth);
    this.params.dimension = dimension;
    this.params.viewMode = viewMode;
    this.params.ndDepth = ndDepth;
    this.params.ndSliceZ = ndSliceZ;
    this.params.ndSliceW = ndSliceW;
    this.params.ndActiveAxis = this._coerceNDActiveAxis(
      this.params.ndActiveAxis,
      dimension,
    );

    return {
      dimension,
      viewMode,
      depth: ndDepth,
      sliceZ: ndSliceZ,
      sliceW: ndSliceW,
      activeAxis: this.params.ndActiveAxis,
    };
  }

  setDimension(dimension) {
    if (this._changingDimension) return;
    const nextDimension = NDCompat.coerceDimension(dimension);

    this._changingDimension = true;
    try {
      this.params.dimension = nextDimension;
      const coercedSize = this._normaliseGridSize(this.params.latticeExtent);
      const sizeChanged = coercedSize !== this.params.latticeExtent;
      this.params.latticeExtent = coercedSize;
      this.params.R = this.getDefaultRadius(
        this.params.latticeExtent,
        nextDimension,
      );
      this._prevR = this.params.R;

      if ((Number(this.params.dimension) || 2) > 2) {
        this.params.viewMode = "projection";
        const ndDepthForSlice = NDCompat.getWorldDepthForDimension(
          this.params.latticeExtent,
          nextDimension,
        );
        this.params.ndSliceZ = Math.floor(ndDepthForSlice / 2);
        this.params.ndSliceW = Math.floor(ndDepthForSlice / 2);
        this.params.ndActiveAxis = this._coerceNDActiveAxis(
          this.params.ndActiveAxis,
          nextDimension,
        );
      } else {
        this.params.viewMode = "slice";
        this.params.ndActiveAxis = "z";
      }

      this.params.placeScale = 1;
      this._lastPlacementScale = 1;

      this._applyAnimalSource();

      const animal = this._syncSelectedAnimalForActiveDimension(0);

      if (sizeChanged) {
        this.changeResolution();
      }

      if (animal) {
        this.loadAnimal(animal);
      } else {
        this.clearWorld();
      }

      console.log(
        `[Lenia] ${nextDimension}D mode enabled with ${this.params.latticeExtent}^${nextDimension} world shape and ND tensor stepping.`,
      );

      if (this.gui && typeof this.gui.rebuildPane === "function") {
        this.gui.rebuildPane();
      } else {
        this.refreshGUI();
      }
    } finally {
      this._changingDimension = false;
    }
  }

  setViewMode(viewMode) {
    this.params.viewMode = viewMode === "slice" ? "slice" : "projection";

    this._workerRequestView();

    if (this.gui && typeof this.gui.rebuildPane === "function") {
      this.gui.rebuildPane();
    } else {
      this.refreshGUI();
    }
  }

  adjustNDSlice(axis, delta) {
    if ((this.params.dimension || 2) <= 2) return;
    const targetAxis = this._coerceNDActiveAxis(
      axis || this.params.ndActiveAxis,
      this.params.dimension,
    );
    const step = Math.floor(Number(delta) || 0);
    if (!Number.isFinite(step) || step === 0) return;
    const depth = NDCompat.coerceDepth(
      this.params.ndDepth,
      this.params.dimension,
    );
    if (targetAxis === "z") {
      this.params.ndSliceZ =
        (((Math.floor(Number(this.params.ndSliceZ) || 0) + step) % depth) +
          depth) %
        depth;
    } else if (targetAxis === "w") {
      this.params.ndSliceW =
        (((Math.floor(Number(this.params.ndSliceW) || 0) + step) % depth) +
          depth) %
        depth;
    }
    this._workerRequestView();
    this.refreshGUI();
  }

  centreNDSlices({ allAxes = true } = {}) {
    if ((this.params.dimension || 2) <= 2) return;
    const depth = NDCompat.coerceDepth(
      this.params.ndDepth,
      this.params.dimension,
    );
    const centre = Math.floor(depth / 2);

    if (allAxes || this.getNDActiveAxis() === "z") {
      this.params.ndSliceZ = centre;
    }
    if ((this.params.dimension || 2) >= 4) {
      if (allAxes || this.getNDActiveAxis() === "w") {
        this.params.ndSliceW = centre;
      }
    }

    this._workerRequestView();
    this.refreshGUI();
  }

  toggleNDSliceView() {
    if ((this.params.dimension || 2) <= 2) return;
    const nextMode = this.params.viewMode === "slice" ? "projection" : "slice";
    this.setViewMode(nextMode);
  }

  shiftNDDepth(delta, axis = null) {
    if ((this.params.dimension || 2) <= 2) return;
    const step = Math.floor(Number(delta) || 0);
    if (!Number.isFinite(step) || step === 0) return;

    const targetAxis = this._coerceNDActiveAxis(
      axis || this.params.ndActiveAxis,
      this.params.dimension,
    );

    this._queueAction("shiftNDDepth", () =>
      this._queueOrRunMutation(() => {
        if (!this.board.world) return;
        this._ensureBuffers();
        this._workerTransform({
          shiftDepth: {
            axis: targetAxis,
            delta: step,
          },
        });
      }),
    );
  }

  refreshNDView() {
    this._workerRequestView();
    this.refreshGUI();
  }

  canvasInteraction(event) {
    if (!event || !event.target) return false;
    if (event.target.closest(".tp-dfwv")) return false;
    if (event.target.tagName !== "CANVAS") return false;
    return true;
  }

  handleMouseClicked(event) {
    if (this.canvasInteraction(event)) {
      const cell = this.renderer.screenToCell(mouseX, mouseY);
      const cellX = cell.x;
      const cellY = cell.y;

      const nowMs = millis();
      const last = this._lastPlacement;
      if (
        last.cellX === cellX &&
        last.cellY === cellY &&
        nowMs - last.atMs < 140
      ) {
        return false;
      }

      last.cellX = cellX;
      last.cellY = cellY;
      last.atMs = nowMs;

      this.placeAnimal(cellX, cellY);
      return false;
    }
  }

  handleMousePressed(event) {
    if (this.canvasInteraction(event)) {
      return this.input.handlePointerPressed(event);
    }
    return;
  }

  handleMouseDragged(event) {
    if (this.canvasInteraction(event)) {
      return this.input.handlePointerDragged(event);
    }
    return;
  }

  handleMouseReleased(event) {
    this.input.handlePointerReleased(event);
    if (this.canvasInteraction(event)) {
      return false;
    }
    return;
  }

  handleMouseWheel(event) {
    if (this.canvasInteraction(event)) {
      return this.input.handleWheel(event);
    }
    return;
  }

  handleKeyPressed(k, kCode, event = null) {
    return KeyboardUtils.safeHandle("Lenia", "press", () =>
      this.input.handleKeyPressed(k, kCode, event),
    );
  }

  handleKeyReleased(k, kCode, event = null) {
    return KeyboardUtils.safeHandle("Lenia", "release", () =>
      this.input.handleKeyReleased(k, kCode, event),
    );
  }

  updateAutomatonParams() {
    this.automaton.updateParameters(this.params);
    this._prevR = this.params.R;
    this._workerSendKernel();
  }

  cycleColourMap(delta = 1) {
    if (!this.colourMapKeys.length) return;

    const currentIndex = this.colourMapKeys.indexOf(this.params.colourMap);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const length = this.colourMapKeys.length;
    const nextIndex = (baseIndex + delta + length) % length;

    this.params.colourMap = this.colourMapKeys[nextIndex];
    this.refreshGUI();
  }

  getColourMapOptions() {
    return this.colourMapKeys.reduce((options, name) => {
      const entry = this.colourMaps[name] || {};
      const type = entry.type || "sequential";
      const label = `${name} (${type})`;
      options[label] = name;
      return options;
    }, {});
  }

  getStatAxisHeaders() {
    if (
      typeof Analyser !== "undefined" &&
      Array.isArray(Analyser.STAT_HEADERS)
    ) {
      return Analyser.STAT_HEADERS.slice();
    }
    return ["m", "g", "x", "y", "s", "k", "wr"];
  }

  getStatAxisOptions() {
    const headers = this.getStatAxisHeaders();
    const names =
      typeof Analyser !== "undefined" && Analyser.STAT_NAMES
        ? Analyser.STAT_NAMES
        : {};
    return headers.reduce((options, key) => {
      const label = names[key] ? `${key} - ${names[key]}` : key;
      options[label] = key;
      return options;
    }, {});
  }

  cycleStatsMode(delta = 1, { refreshGUI = true } = {}) {
    const modes = [0, 1, 5, 6];
    const currentRaw = Math.floor(Number(this.params.statsMode) || 1);
    const currentIndex = modes.indexOf(currentRaw);
    const current = currentIndex >= 0 ? currentIndex : 0;
    const step = Math.floor(Number(delta) || 0) || 1;
    const nextIndex =
      (((current + step) % modes.length) + modes.length) % modes.length;
    const next = modes[nextIndex];
    this.params.statsMode = next;

    if (next === 5) {
      this.analyser?.updatePeriodogram?.(this.params, 10, true);
    }

    if (refreshGUI) this.refreshGUI();
    return next;
  }

  cycleStatsAxis(axis = "x", delta = 1, { refreshGUI = true } = {}) {
    const key = String(axis).toLowerCase() === "y" ? "graphY" : "graphX";
    const headers = this.getStatAxisHeaders();
    if (!headers.length) return this.params[key];

    const current = headers.indexOf(this.params[key]);
    const base = current >= 0 ? current : 0;
    const step = Math.floor(Number(delta) || 0) || 1;
    const nextIndex =
      (((base + step) % headers.length) + headers.length) % headers.length;
    this.params[key] = headers[nextIndex];

    this.analyser?.updatePeriodogram?.(this.params, 10, true);
    if (refreshGUI) this.refreshGUI();
    return this.params[key];
  }

  startStatsSegment({ refreshGUI = true } = {}) {
    this.analyser?.startNewSegment?.();
    if (refreshGUI) this.refreshGUI();
  }

  clearCurrentStatsSegment({ refreshGUI = true } = {}) {
    this.analyser?.clearCurrentSegment?.();
    this.analyser?.updatePeriodogram?.(this.params, 10, true);
    if (refreshGUI) this.refreshGUI();
  }

  clearAllStatsSegments({ refreshGUI = true } = {}) {
    this.analyser?.clearAllSegments?.();
    this.analyser?.updatePeriodogram?.(this.params, 10, true);
    if (refreshGUI) this.refreshGUI();
  }

  refreshGUI() {
    if (this._isRefreshingGUI) return;
    this._isRefreshingGUI = true;
    try {
      if (this.gui && typeof this.gui.syncMediaControls === "function") {
        this.gui.syncMediaControls();
      }

      if (this.gui && typeof this.gui.syncNDSliceBounds === "function") {
        this.gui.syncNDSliceBounds();
      }

      if (this.gui && typeof this.gui.syncAnimalSelectors === "function") {
        this.gui.syncAnimalSelectors();
      }

      if (this.gui && this.gui.pane) this.gui.pane.refresh();
    } finally {
      this._isRefreshingGUI = false;
    }
  }
}

for (const name of Object.getOwnPropertyNames(ControlMethods.prototype)) {
  if (name === "constructor") continue;
  AppCore.prototype[name] = ControlMethods.prototype[name];
}
