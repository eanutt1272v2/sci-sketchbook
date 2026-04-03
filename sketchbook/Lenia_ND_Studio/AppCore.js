class AppCore {
  constructor(assets) {
    const {
      metadata,
      animalsData,
      animalsByDimension = null,
      colourMaps,
      font,
    } = assets;

    this.metadata = metadata;
    this.animalsByDimension =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.buildAnimalsByDimension(
            animalsData,
            animalsByDimension,
          )
        : { 2: Array.isArray(animalsData) ? animalsData : [] };
    this.font = font;
    this.colourMaps = colourMaps || {};
    this.colourMapKeys = Object.keys(this.colourMaps);

    if (this.colourMapKeys.length === 0) {
      this.colourMaps = { greyscale: ColourMapLUT.GREYSCALE };
      this.colourMapKeys = ["greyscale"];
    }

    this.params = {
      running: true,
      gridSize: 128,
      pixelSize: 4,

      dimension: 2,
      viewMode: "projection",
      ndDepth: 6,
      ndSliceZ: 0,
      ndSliceW: 0,
      ndActiveAxis: "z",

      R: 20,
      T: 10,
      m: 0.1,
      s: 0.01,
      r: 1,
      b: [1],
      kn: 1,
      gn: 1,

      softClip: false,
      multiStep: false,
      aritaMode: false,
      addNoise: 0,
      maskRate: 0,
      paramP: 0,
      h: 1,

      colourMap: this.colourMapKeys.includes("turbo")
        ? "turbo"
        : this.colourMapKeys[0],
      renderMode: "world",

      renderGrid: true,
      renderScale: true,
      renderLegend: true,
      renderStats: true,
      renderMotionOverlay: true,
      renderSymmetryOverlay: false,
      renderCalcPanels: true,
      renderAnimalName: true,
      renderKeymapRef: false,

      polarMode: 0,
      autoRotateMode: 0,
      selectedAnimal: "",
      placeMode: true,
      placeScale: 1,
      autoCenter: false,

      imageFormat: "png",
      recordingFPS: 60,
      videoBitrateMbps: 8,
    };

    this.params.R = this.getPythonDefaultRadius(
      this.params.gridSize,
      this.params.dimension,
    );

    this.statistics = {
      gen: 0,
      time: 0,
      mass: 0,
      growth: 0,
      massLog: 0,
      growthLog: 0,
      massVolumeLog: 0,
      growthVolumeLog: 0,
      massDensity: 0,
      growthDensity: 0,
      maxValue: 0,
      gyradius: 0,
      centerX: 0,
      centerY: 0,
      growthCenterX: 0,
      growthCenterY: 0,
      massGrowthDist: 0,
      massAsym: 0,
      speed: 0,
      centroidSpeed: 0,
      angle: 0,
      centroidRotateSpeed: 0,
      growthRotateSpeed: 0,
      majorAxisRotateSpeed: 0,
      symmSides: 0,
      symmStrength: 0,
      rotationSpeed: 0,
      lyapunov: 0,
      hu1Log: 0,
      hu4Log: 0,
      hu5Log: 0,
      hu6Log: 0,
      hu7Log: 0,
      flusser7: 0,
      flusser8Log: 0,
      flusser9Log: 0,
      flusser10Log: 0,
      period: 0,
      periodConfidence: 0,
      fps: 0,
    };

    this.renderData = {
      frameCount: 0,
      lastTime: 0,
    };

    this.initialiseModules();
  }

  initialiseModules() {
    this.animalLibrary = new AnimalLibrary(this.params);
    if (this.animalLibrary.loadFromDimensionMap) {
      this.animalLibrary.loadFromDimensionMap(this.animalsByDimension);
      this.animalLibrary.setActiveDimension(this.params.dimension);
    } else {
      this.animalLibrary.loadFromData(this.animalsByDimension[2] || []);
    }
    this.board = new Board(this.params.gridSize);
    this.automaton = new Automaton(this.params);
    this.analyser = new Analyser(this.statistics, this.renderData);
    this.renderer = new Renderer(
      this.params.gridSize,
      this.colourMaps,
      this.params.colourMap,
      this.font,
    );
    this.media = new Media(this);
    this.gui = new GUI(
      this.params,
      this.statistics,
      this.renderData,
      this.metadata,
      this.animalLibrary,
      this,
    );
    this.input = new InputHandler(this);

    this._syncPixelSizeFromGrid();

    this._worker = null;
    this._workerBusy = false;
    this._stepPending = false;
    this._kernelPending = false;
    this._viewPending = false;
    this._pendingActions = [];
    this._pendingPlacement = null;
    this._pendingMutations = [];
    this._lastPlacement = { cellX: null, cellY: null, atMs: 0 };
    this._lastPlacementScale = Math.max(
      0.25,
      Math.min(4, Number(this.params.placeScale) || 1),
    );
    this._skipNextAnimalParamsLoad = false;
    this._lastAnimalParamsSelection = null;
    this._changeRecycleBuffer = null;
    this._resolutionTransitionActive = false;
    this._initWorker();
  }

  _initWorker() {
    try {
      this._worker = new Worker("LeniaWorker.js");
    } catch (e) {
      throw new Error("[Lenia] Worker is required but could not be created.");
    }

    this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
    this._worker.onerror = (e) => {
      console.error("[Lenia] Worker error:", e);
      this._workerBusy = false;
      this._stepPending = false;
      this._kernelPending = false;
      this._viewPending = false;
      this._changeRecycleBuffer = null;

      const dim = Math.max(2, Math.floor(Number(this.params.dimension) || 2));
      if (dim > 2 && typeof NDCompatibility !== "undefined") {
        const safeSize = NDCompatibility.coerceGridSize(
          this.params.gridSize,
          dim,
        );
        if (safeSize < this.params.gridSize) {
          console.warn(
            `[Lenia] Recovering from worker allocation failure by reducing ${dim}D grid size from ${this.params.gridSize} to ${safeSize}.`,
          );
          this.params.gridSize = safeSize;
          this.changeResolution();
          return;
        }
      }
    };

    this._workerSendKernel();
  }

  _workerSendKernel() {
    const dim = Math.max(2, Math.floor(Number(this.params.dimension) || 2));
    if (dim > 2 && typeof NDCompatibility !== "undefined") {
      const safeSize = NDCompatibility.coerceGridSize(
        this.params.gridSize,
        dim,
      );
      if (safeSize !== this.params.gridSize) {
        console.warn(
          `[Lenia] Reducing ${dim}D grid size from ${this.params.gridSize} to ${safeSize} to avoid excessive worker memory usage.`,
        );
        this.params.gridSize = safeSize;
        this.changeResolution();
        return;
      }
    }

    if (!this._worker) return;
    if (this._workerBusy) {
      this._kernelPending = true;
      return;
    }
    this._workerBusy = true;
    this._kernelPending = false;
    const ndConfig = this.buildNDConfig();
    this._worker.postMessage({
      type: "kernel",
      params: { ...this.params, size: this.params.gridSize },
      ndConfig,
    });
  }

  _bufferToFloat32(buffer, expectedLength) {
    let view = null;
    if (buffer instanceof ArrayBuffer) {
      view = new Float32Array(buffer);
    } else if (ArrayBuffer.isView(buffer)) {
      if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
        return null;
      }
      view = new Float32Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
      );
    } else {
      return null;
    }

    if (view.length !== expectedLength) {
      return null;
    }

    return view;
  }

  _getFloatPayloadLength(buffer) {
    if (buffer instanceof ArrayBuffer) {
      if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) return null;
      return buffer.byteLength / Float32Array.BYTES_PER_ELEMENT;
    }

    if (ArrayBuffer.isView(buffer)) {
      if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) return null;
      return buffer.byteLength / Float32Array.BYTES_PER_ELEMENT;
    }

    return null;
  }

  _isKernelPayloadValid(data) {
    if (!data || typeof data !== "object") return false;

    const getElementCount = (value, bytesPerElement) => {
      if (value instanceof ArrayBuffer) {
        if (value.byteLength % bytesPerElement !== 0) return null;
        return value.byteLength / bytesPerElement;
      }

      if (ArrayBuffer.isView(value)) {
        if (value.byteLength % bytesPerElement !== 0) return null;
        return value.byteLength / bytesPerElement;
      }

      return null;
    };

    const kernelSize = Number(data.kernelSize);
    if (!Number.isFinite(kernelSize) || kernelSize <= 0) return false;

    const expectedKernelLen = Math.round(kernelSize) * Math.round(kernelSize);
    if (!Number.isFinite(expectedKernelLen) || expectedKernelLen <= 0) {
      return false;
    }

    const kernelFloatLen = getElementCount(
      data.kernel,
      Float32Array.BYTES_PER_ELEMENT,
    );
    const kernelDxLen = getElementCount(
      data.kernelDX,
      Int16Array.BYTES_PER_ELEMENT,
    );
    const kernelDyLen = getElementCount(
      data.kernelDY,
      Int16Array.BYTES_PER_ELEMENT,
    );
    const kernelValuesLen = getElementCount(
      data.kernelValues,
      Float32Array.BYTES_PER_ELEMENT,
    );

    if (
      !Number.isInteger(kernelFloatLen) ||
      kernelFloatLen !== expectedKernelLen
    )
      return false;
    if (!Number.isInteger(kernelDxLen) || kernelDxLen < 0) return false;
    if (!Number.isInteger(kernelDyLen) || kernelDyLen < 0) return false;
    if (!Number.isInteger(kernelValuesLen) || kernelValuesLen < 0) return false;

    if (kernelDxLen > expectedKernelLen) return false;
    if (kernelDyLen > expectedKernelLen) return false;
    if (kernelValuesLen > expectedKernelLen) return false;

    return kernelDxLen === kernelDyLen && kernelDyLen === kernelValuesLen;
  }

  _normaliseImportedSeries(series, maxRows = 10000, maxCols = 64) {
    if (!Array.isArray(series)) return [];
    const start = Math.max(0, series.length - maxRows);
    const out = [];
    for (let i = start; i < series.length; i++) {
      const row = series[i];
      if (!Array.isArray(row)) continue;
      const safeRow = new Array(Math.min(row.length, maxCols));
      for (let j = 0; j < safeRow.length; j++) {
        const n = Number(row[j]);
        safeRow[j] = Number.isFinite(n) ? n : 0;
      }
      out.push(safeRow);
    }
    return out;
  }

  _normalisePlacementRequest(
    request,
    fromSize = this.params.gridSize,
    toSize = this.params.gridSize,
  ) {
    if (!request || typeof request !== "object") return null;

    const sourceSize = Math.max(1, Math.floor(Number(fromSize) || 1));
    const targetSize = Math.max(1, Math.floor(Number(toSize) || 1));

    const rawCellX = Math.floor(Number(request.cellX));
    const rawCellY = Math.floor(Number(request.cellY));
    if (!Number.isFinite(rawCellX) || !Number.isFinite(rawCellY)) return null;

    const remap = (coord) => {
      if (sourceSize === targetSize) {
        return ((coord % targetSize) + targetSize) % targetSize;
      }

      const ratio = (coord + 0.5) / sourceSize;
      const mapped = Math.floor(ratio * targetSize);
      return ((mapped % targetSize) + targetSize) % targetSize;
    };

    const rawScale = Number(request.scale);
    const scale = Number.isFinite(rawScale) ? rawScale : 1;

    return {
      selection:
        request.selection === null || typeof request.selection === "undefined"
          ? ""
          : String(request.selection),
      cellX: remap(rawCellX),
      cellY: remap(rawCellY),
      scale,
    };
  }

  _tryExecutePendingPlacement() {
    if (!this._pendingPlacement) return;
    if (this._workerBusy) return;
    if (this._resolutionTransitionActive) return;
    if (this._hasQueuedAction("changeResolution")) return;
    if (!this.board.world) return;

    const boardSize = this.board?.size || this.params.gridSize;
    const pp = this._normalisePlacementRequest(
      this._pendingPlacement,
      boardSize,
      boardSize,
    );
    this._pendingPlacement = null;
    if (!pp) return;
    this._executePlacementRequest(pp);
  }

  _onWorkerMessage(data) {
    if (!data || typeof data !== "object" || typeof data.type !== "string") {
      this._workerBusy = false;
      return;
    }

    const expectedSize = this.board?.size || this.params.gridSize;
    const expectedLength = expectedSize * expectedSize;

    if (data.type === "kernelReady") {
      if (!this._isKernelPayloadValid(data)) {
        console.error("[Lenia] Ignoring malformed kernelReady payload");
        this._workerBusy = false;
        this._flushPendingMutations();
        this._tryExecutePendingPlacement();
        return;
      }

      this.automaton.applyWorkerKernel(data);
      this._workerBusy = false;

      this._flushPendingMutations();

      if (this._kernelPending) {
        this._workerSendKernel();
        return;
      }
      if (this._viewPending) {
        this._viewPending = false;
        this._workerRequestView();
        return;
      }

      this._tryExecutePendingPlacement();

      if (
        (Number(this.params.dimension) || 2) > 2 &&
        this.board.world &&
        !this._stepPending
      ) {
        this._workerRequestView();
        return;
      }
      if (this._stepPending) {
        this._stepPending = false;
        this._dispatchWorkerStep();
      }
      return;
    }

    if (data.type === "view") {
      const payloadLength = this._getFloatPayloadLength(data.world);
      const potentialLength = this._getFloatPayloadLength(data.potential);
      const growthLength = this._getFloatPayloadLength(data.growth);
      const growthOldLength =
        data.growthOld === null || typeof data.growthOld === "undefined"
          ? null
          : this._getFloatPayloadLength(data.growthOld);

      if (
        !Number.isInteger(payloadLength) ||
        payloadLength <= 0 ||
        potentialLength !== payloadLength ||
        growthLength !== payloadLength ||
        (growthOldLength !== null && growthOldLength !== payloadLength)
      ) {
        console.error("[Lenia] Ignoring malformed view payload");
        this._workerBusy = false;
        this._ensureBuffers();
        this._flushPendingMutations();
        this._tryExecutePendingPlacement();
        return;
      }

      if (payloadLength !== expectedLength) {
        const log =
          this._resolutionTransitionActive ||
          this._hasQueuedAction("changeResolution")
            ? console.debug
            : console.warn;
        log(
          `[Lenia] Ignoring stale view payload (len=${payloadLength}, expected=${expectedLength})`,
        );
        this._workerBusy = false;
        this._ensureBuffers();
        this._flushPendingMutations();
        this._tryExecutePendingPlacement();
        return;
      }

      const world = this._bufferToFloat32(data.world, payloadLength);
      const potential = this._bufferToFloat32(data.potential, payloadLength);
      const growth = this._bufferToFloat32(data.growth, payloadLength);
      const growthOld =
        data.growthOld === null || typeof data.growthOld === "undefined"
          ? null
          : this._bufferToFloat32(data.growthOld, payloadLength);

      if (!world || !potential || !growth || (data.growthOld && !growthOld)) {
        console.error("[Lenia] Ignoring malformed view payload");
        this._workerBusy = false;
        this._ensureBuffers();
        this._flushPendingMutations();
        this._tryExecutePendingPlacement();
        return;
      }

      const b = this.board;
      b.world = world;
      b.potential = potential;
      b.growth = growth;
      b.growthOld = growthOld;

      if (data.analysis) {
        this.analyser.applyWorkerStatistics(data.analysis, this.automaton);
      }

      this._workerBusy = false;
      this._flushPendingMutations();
      if (this._kernelPending) {
        this._workerSendKernel();
        return;
      }

      this._tryExecutePendingPlacement();
      return;
    }

    if (data.type === "result") {
      const payloadLength = this._getFloatPayloadLength(data.world);
      const potentialLength = this._getFloatPayloadLength(data.potential);
      const growthLength = this._getFloatPayloadLength(data.growth);
      const changeLength = this._getFloatPayloadLength(data.change);
      const growthOldLength =
        data.growthOld === null || typeof data.growthOld === "undefined"
          ? null
          : this._getFloatPayloadLength(data.growthOld);

      if (
        !Number.isInteger(payloadLength) ||
        payloadLength <= 0 ||
        potentialLength !== payloadLength ||
        growthLength !== payloadLength ||
        changeLength !== payloadLength ||
        (growthOldLength !== null && growthOldLength !== payloadLength)
      ) {
        console.error("[Lenia] Ignoring malformed step payload");
        this._workerBusy = false;
        this._changeRecycleBuffer = null;
        this._flushPendingMutations();
        this._tryExecutePendingPlacement();
        return;
      }

      if (payloadLength !== expectedLength) {
        const log =
          this._resolutionTransitionActive ||
          this._hasQueuedAction("changeResolution")
            ? console.debug
            : console.warn;
        log(
          `[Lenia] Ignoring stale step payload (len=${payloadLength}, expected=${expectedLength})`,
        );
        this._workerBusy = false;
        this._changeRecycleBuffer = null;
        this._flushPendingMutations();
        this._tryExecutePendingPlacement();
        return;
      }

      const world = this._bufferToFloat32(data.world, payloadLength);
      const potential = this._bufferToFloat32(data.potential, payloadLength);
      const growth = this._bufferToFloat32(data.growth, payloadLength);
      const change = this._bufferToFloat32(data.change, payloadLength);
      const growthOld =
        data.growthOld === null || typeof data.growthOld === "undefined"
          ? null
          : this._bufferToFloat32(data.growthOld, payloadLength);

      if (
        !world ||
        !potential ||
        !growth ||
        !change ||
        (data.growthOld && !growthOld)
      ) {
        console.error("[Lenia] Ignoring malformed step payload");
        this._workerBusy = false;
        this._changeRecycleBuffer = null;
        this._flushPendingMutations();
        this._tryExecutePendingPlacement();
        return;
      }

      const b = this.board;

      b.world = world;
      b.potential = potential;
      b.growth = growth;
      b.growthOld = growthOld;

      this.automaton.change = change;
      this._changeRecycleBuffer = data.change;
      this.automaton.gen++;
      this.automaton.time =
        Math.round((this.automaton.time + 1 / this.params.T) * 10000) / 10000;

      this._workerBusy = false;
      this.analyser.countStep();

      this._flushPendingMutations();

      this._tryExecutePendingPlacement();

      this._postStepUpdate(data.analysis);

      if (this._kernelPending) {
        this._workerSendKernel();
        return;
      }

      if (this._stepPending) {
        this._stepPending = false;
        this._dispatchWorkerStep();
      }
    }
  }

  _queueOrRunMutation(mutation) {
    if (typeof mutation !== "function") return;

    if (this._worker && this._workerBusy) {
      this._pendingMutations.push(mutation);
      return;
    }

    mutation();
  }

  _flushPendingMutations() {
    if (!this._pendingMutations.length) return;

    const mutations = this._pendingMutations.splice(
      0,
      this._pendingMutations.length,
    );
    for (const mutation of mutations) {
      mutation();
    }
  }

  _dispatchWorkerStep() {
    if (!this._worker || this._workerBusy) {
      if (this._worker) this._stepPending = true;
      return false;
    }

    const b = this.board;
    const ndConfig = this.buildNDConfig();

    const worldCopy = new Float32Array(b.world);
    const potentialCopy = new Float32Array(b.potential);
    const growthCopy = new Float32Array(b.growth);

    const transfers = [
      worldCopy.buffer,
      potentialCopy.buffer,
      growthCopy.buffer,
    ];
    const msg = {
      type: "step",
      params: {
        ...this.params,
        size: this.params.gridSize,
        gn: this.params.gn,
        kn: this.params.kn,
      },
      ndConfig,
      world: worldCopy.buffer,
      potential: potentialCopy.buffer,
      growth: growthCopy.buffer,
      growthOld: null,
      changeBuffer: this._changeRecycleBuffer,
    };

    if (this._changeRecycleBuffer) {
      transfers.push(this._changeRecycleBuffer);
      this._changeRecycleBuffer = null;
    }

    if (this.params.multiStep && b.growthOld) {
      const growthOldCopy = new Float32Array(b.growthOld);
      msg.growthOld = growthOldCopy.buffer;
      transfers.push(growthOldCopy.buffer);
    }

    if (this._ndSeedWorld) {
      msg.ndSeedWorld = this._ndSeedWorld.buffer;
      transfers.push(this._ndSeedWorld.buffer);
      this._ndSeedWorld = null;
    }

    this._workerBusy = true;
    this._worker.postMessage(msg, transfers);
    return true;
  }

  _workerRequestView() {
    if (!this._worker) return false;
    if (this._workerBusy) {
      this._viewPending = true;
      return false;
    }

    const b = this.board;
    const ndConfig = this.buildNDConfig();
    const transfers = [b.world.buffer, b.potential.buffer, b.growth.buffer];
    const msg = {
      type: "view",
      params: {
        ...this.params,
        size: this.params.gridSize,
      },
      ndConfig,
      world: b.world.buffer,
      potential: b.potential.buffer,
      growth: b.growth.buffer,
      growthOld: b.growthOld ? b.growthOld.buffer : null,
    };

    if (b.growthOld) {
      transfers.push(b.growthOld.buffer);
    }

    b.world = null;
    b.potential = null;
    b.growth = null;
    b.growthOld = null;

    if (this._ndSeedWorld) {
      msg.ndSeedWorld = this._ndSeedWorld.buffer;
      transfers.push(this._ndSeedWorld.buffer);
      this._ndSeedWorld = null;
    }

    this._workerBusy = true;
    this._viewPending = false;
    this._worker.postMessage(msg, transfers);
    return true;
  }

  _ensureBuffers() {
    const size = this.params.gridSize;
    const count = size * size;
    if (!this.board.world || this.board.world.length !== count)
      this.board.world = new Float32Array(count);
    if (!this.board.potential || this.board.potential.length !== count)
      this.board.potential = new Float32Array(count);
    if (!this.board.growth || this.board.growth.length !== count)
      this.board.growth = new Float32Array(count);
  }

  _postStepUpdate(workerAnalysis = null) {
    if (workerAnalysis) {
      this.analyser.applyWorkerStatistics(workerAnalysis, this.automaton);
    }
    if (this.automaton.gen % 10 === 0) {
      this.analyser.series.push(this.analyser.getStatRow());
      if (this.analyser.series.length > 10000) {
        this.analyser.series.splice(0, this.analyser.series.length - 10000);
      }
    }
  }

  setup() {
    if (this.gui) {
      this.gui.setupTabs();
    }

    if (
      this.gui &&
      this.animalLibrary.loaded &&
      this.animalLibrary.animals.length > 0
    ) {
      this.loadInitialAnimal();
    }
  }

  render() {
    this._syncPixelSizeFromGrid();
    this.input.handleContinuousInput();

    const polarMode = Math.max(
      0,
      Math.min(4, Math.floor(Number(this.params.polarMode) || 0)),
    );

    const isKernel = this.params.renderMode === "kernel";

    this.renderer.setViewOffset(
      this.params.autoCenter && !isKernel,
      this.statistics.centerX,
      this.statistics.centerY,
    );

    const autoRotAngle = isKernel ? 0 : this._computeAutoRotationAngle();
    this.renderer.setAutoRotation(autoRotAngle);

    this.renderer.beginAutoRotation();

    if (this.board.world) {
      this.renderer.render(
        this.board,
        this.automaton,
        this.params.renderMode,
        this.params.colourMap,
        this.params,
        this.statistics,
      );
    } else {
      this.renderer.renderCachedFrame();
    }

    const canRenderWorldGrid = polarMode <= 1;
    if (
      canRenderWorldGrid &&
      (this.params.renderGrid || this.params.renderMode === "kernel")
    ) {
      this.renderer.renderGrid(this.params.R, this.params);
    }

    if (
      this.params.renderMotionOverlay &&
      polarMode <= 1 &&
      this.params.renderMode !== "kernel"
    ) {
      this.renderer.renderMotionOverlay(this.statistics, this.params);
    }

    if (
      this.params.renderSymmetryOverlay &&
      this.params.renderMode !== "kernel"
    ) {
      this.renderer.renderSymmetryOverlay(this.statistics, this.params);
    }

    this.renderer.endAutoRotation();

    if (this.params.renderSymmetryOverlay) {
      this.renderer.renderSymmetryTitle(this.statistics, this.params);
    }

    if (this.params.renderScale && polarMode <= 1) {
      this.renderer.renderScale(this.params.R, this.params);
    }

    if (this.params.renderLegend && polarMode <= 1) {
      this.renderer.renderLegend();
    }

    if (this.params.renderStats) {
      this.renderer.renderStats(this.statistics, this.params);
    }

    if (this.params.renderAnimalName) {
      const animal = this.getSelectedAnimal();
      if (animal?.name) this.renderer.renderAnimalName(animal);
    }

    if (this.board.world) {
      if (this.params.renderCalcPanels) {
        this.renderer.renderCalcPanels(this.board, this.automaton, this.params);
      }
    } else {
      if (this.params.renderCalcPanels) {
        this.renderer.renderCachedCalcPanels();
      }
    }

    if (this.params.renderKeymapRef) {
      this.renderer.renderKeymapRef(this.metadata);
    }

    if (this._pendingActions.length > 0) {
      this._runNextAction();
      return;
    }

    if (this.params.running && this.board.world) {
      this._dispatchWorkerStep();
    }

    if (this.params.running) {
      this.analyser.updateFps();
    }
  }

  _computeAutoRotationAngle() {
    const dim = this.params.dimension || 2;
    if (dim !== 2) return 0;
    if ((Number(this.params.polarMode) || 0) > 1) return 0;
    const mode = this.params.autoRotateMode || 0;
    if (mode === 0) return 0;
    if (mode === 1) {
      const angleRad = this.statistics.angle || 0;
      return angleRad + Math.PI / 2;
    }
    if (mode === 2) {
      return -(this.statistics.symmAngle || 0);
    }
    return 0;
  }

  stepOnce() {
    if (this._workerBusy) return;
    this._ensureBuffers();
    if (this._worker) this._dispatchWorkerStep();
  }

  clearWorld() {
    this._queueAction("clearWorld", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        this.board.clear();
        if ((this.params.dimension || 2) > 2) {
          this._workerNDMutation({ type: "clear" });
        }
        this.analyser.resetStatistics();
        this.analyser.reset();
      }),
    );
  }

  randomiseWorld() {
    this._queueAction("randomiseWorld", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this.board.clear();
          this._workerNDMutation({ type: "randomise" });
        } else {
          this.board.randomise(this.automaton.R);
        }
        this.analyser.resetStatistics();
      }),
    );
  }

  randomWorldWithSeed(seed = null, isFill = false) {
    this._queueAction("randomWorldSeed", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this.board.clear();
          this._workerNDMutation({ type: "randomise" });
        } else {
          const usedSeed = this.board.randomiseSeeded(
            this.params.R,
            seed,
            isFill,
          );
          this._lastRandomSeed = usedSeed;
        }
        this.analyser.resetStatistics();
        this.analyser.reset();
        this.automaton.reset();
      }),
    );
  }

  randomiseParams(incremental = false) {
    this._queueAction("randomiseParams", () =>
      this._queueOrRunMutation(() => {
        const p = this.params;
        const size2 = Math.log2(p.gridSize);
        const dim = p.dimension || 2;
        const randR1 = Math.floor(Math.pow(2, size2 - 7) * dim * 5);
        const randR2 = Math.floor(Math.pow(2, size2 - 5) * dim * 5);

        if (incremental) {
          const isSmall = Math.random() < 0.2;
          const localAdj = (val, delta, vmin, vmax, digits) => {
            const f = Math.pow(10, digits);
            return (
              Math.round(
                Math.max(
                  vmin,
                  Math.min(vmax, val + (Math.random() * 2 - 1) * delta),
                ) * f,
              ) / f
            );
          };
          p.m = localAdj(p.m, isSmall ? 0.02 : 0.05, 0.1, 1.0, 3);
          p.s = localAdj(p.s, isSmall ? 0.002 : 0.005, 0.01, 1.0, 4);
          p.h = localAdj(p.h, 0.1, 0.1, 1.0, 2);
          if (!isSmall && Math.random() < 0.08 && p.b.length > 1) {
            p.b.pop();
            if (p.b.length === 1) p.b = [1];
          } else if (!isSmall && Math.random() < 0.08 && p.b.length < 3) {
            p.b.push(0);
          }
          if (!(p.b.length === 1 && p.b[0] === 1)) {
            for (let bi = 0; bi < p.b.length; bi++) {
              if (Math.random() < (isSmall ? 0.04 : 0.2)) {
                const step = (Math.floor(Math.random() * 3) - 1) / 12;
                p.b[bi] = Math.max(
                  0,
                  Math.min(1, Math.round((p.b[bi] + step) * 12) / 12),
                );
              }
            }
          }
        } else {
          const R =
            randR1 < randR2
              ? randR1 + Math.floor(Math.random() * (randR2 - randR1))
              : randR1;
          p.R = Math.round(Math.max(2, Math.min(this.getMaxKernelRadius(), R)));
          const B = 1 + Math.floor(Math.random() * 2);
          p.b = Array.from(
            { length: B },
            () => Math.round(Math.random() * 12) / 12,
          );
          p.b[Math.floor(Math.random() * B)] = 1;
          const globalRand = (vmin, vmax, digits) => {
            const f = Math.pow(10, digits);
            return Math.round((Math.random() * (vmax - vmin) + vmin) * f) / f;
          };
          p.m = globalRand(0.1, 0.5, 3);
          const sFactor = Math.random() * 2.5 + 0.5;
          p.s = Math.round((p.m / 10) * sFactor * 10000) / 10000;
          p.h = globalRand(0.1, 1.0, 2);
        }
        this.updateAutomatonParams();
      }),
    );
  }

  shiftWorld(dx, dy) {
    this._queueAction("shiftWorld", () =>
      this._queueOrRunMutation(() => {
        if (!this.board.world) return;
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this._workerTransform({ shift: [dx, dy] });
        } else {
          this.board.shift(dx, dy);
        }
      }),
    );
  }

  rotateWorld(angle) {
    this._queueAction("rotateWorld", () =>
      this._queueOrRunMutation(() => {
        if (!this.board.world) return;
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this._workerTransform({ rotate: angle });
        } else {
          this.board.rotate(angle);
        }
      }),
    );
  }

  flipWorld(mode) {
    this._queueAction("flipWorld", () =>
      this._queueOrRunMutation(() => {
        if (!this.board.world) return;
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this._workerTransform({ flip: mode });
        } else {
          this.board.flip(mode);
        }
      }),
    );
  }

  zoomWorld(newR) {
    const targetR = Math.round(
      constrain(Number(newR) || this.params.R, 2, this.getMaxKernelRadius()),
    );
    const oldR = Number(this._prevR);
    const safeOldR = Number.isFinite(oldR) && oldR > 0 ? oldR : targetR;

    this.params.R = targetR;
    this._prevR = targetR;

    this._queueAction("zoomWorld", () =>
      this._queueOrRunMutation(() => {
        const factor = targetR / safeOldR;
        const hasBoard = !!this.board.world;
        if (hasBoard && Math.abs(factor - 1) > 1e-6) {
          this._ensureBuffers();
          if ((this.params.dimension || 2) > 2) {
            this._workerTransform({ zoom: factor });
          } else {
            this.board.zoom(factor);
          }
        }
        this.updateAutomatonParams();
      }),
    );
  }

  _workerTransform(transform) {
    if (!this._worker) return;
    if (this._workerBusy) {
      this._pendingMutations.push(() => this._workerTransform(transform));
      return;
    }
    const b = this.board;
    const ndConfig = this.buildNDConfig();
    const transfers = [b.world.buffer, b.potential.buffer, b.growth.buffer];
    const msg = {
      type: "transform",
      params: { ...this.params, size: this.params.gridSize },
      ndConfig,
      world: b.world.buffer,
      potential: b.potential.buffer,
      growth: b.growth.buffer,
      transform,
    };
    b.world = null;
    b.potential = null;
    b.growth = null;
    this._workerBusy = true;
    this._worker.postMessage(msg, transfers);
  }

  _workerNDMutation(mutation) {
    if (!this._worker) return;
    if (this._workerBusy) {
      this._pendingMutations.push(() => this._workerNDMutation(mutation));
      return;
    }
    const b = this.board;
    this._ensureBuffers();
    const ndConfig = this.buildNDConfig();
    const transfers = [b.world.buffer, b.potential.buffer, b.growth.buffer];
    const msg = {
      type: "ndMutation",
      params: { ...this.params, size: this.params.gridSize },
      ndConfig,
      world: b.world.buffer,
      potential: b.potential.buffer,
      growth: b.growth.buffer,
      mutation,
    };
    if (mutation.patternData) {
      msg.mutation = { ...mutation, patternData: mutation.patternData.buffer };
      transfers.push(mutation.patternData.buffer);
    }
    if (mutation.planeEntries) {
      msg.mutation = {
        ...mutation,
        planeEntries: mutation.planeEntries.map((e) => ({
          ...e,
          patternData: e.patternData.buffer,
        })),
      };
      for (const e of mutation.planeEntries) {
        transfers.push(e.patternData.buffer);
      }
    }
    b.world = null;
    b.potential = null;
    b.growth = null;
    this._workerBusy = true;
    this._worker.postMessage(msg, transfers);
  }

  changeResolution() {
    this._resolutionTransitionActive = true;
    this._queueAction("changeResolution", () =>
      this._queueOrRunMutation(() => {
        try {
          this._restartWorker();

          const canvasSize = min(windowWidth, windowHeight);
          const prevSize = this.board?.size || this.params.gridSize;
          const dim = Math.max(
            2,
            Math.floor(Number(this.params.dimension) || 2),
          );
          const pendingPlacement = this._normalisePlacementRequest(
            this._pendingPlacement,
            prevSize,
            this.params.gridSize,
          );
          resizeCanvas(canvasSize, canvasSize);
          this._syncPixelSizeFromGrid();
          if (
            dim <= 2 &&
            this.board?.world &&
            prevSize > 0 &&
            prevSize !== this.params.gridSize
          ) {
            this.board.resample(this.params.gridSize);
          } else {
            this.board.resize(this.params.gridSize);
          }
          this.renderer.resize(this.params.gridSize);

          this._pendingPlacement = pendingPlacement;
          this.analyser.reset();
          this.analyser.resetStatistics();

          this.automaton.updateParameters(this.params);
          this._prevR = this.params.R;

          this._workerSendKernel();

          if (this.gui && typeof this.gui.rebuildPane === "function") {
            this.gui.rebuildPane();
          } else {
            this.refreshGUI();
          }
        } finally {
          this._resolutionTransitionActive = false;
        }
      }),
    );
  }

  _normaliseGridSize(size) {
    if (typeof NDCompatibility !== "undefined") {
      return NDCompatibility.coerceGridSize(size, this.params.dimension);
    }

    const fallback = [64, 128, 256, 512, 1024, 2048];
    const raw = Number(size);
    if (!Number.isFinite(raw) || raw <= 0) return this.params.gridSize;
    let closest = fallback[0];
    let bestDist = Math.abs(raw - closest);
    for (let i = 1; i < fallback.length; i++) {
      const d = Math.abs(raw - fallback[i]);
      if (d < bestDist) {
        closest = fallback[i];
        bestDist = d;
      }
    }
    return closest;
  }

  _syncSelectedAnimalForActiveDimension(preferredSelection = null) {
    this._applyAnimalSource();

    const animals = Array.isArray(this.animalLibrary?.animals)
      ? this.animalLibrary.animals
      : [];
    const total = animals.length;

    if (total <= 0) {
      this.params.selectedAnimal = "";
      this._skipNextAnimalParamsLoad = true;
      this._lastAnimalParamsSelection = "";
      return null;
    }

    const raw =
      preferredSelection !== null && typeof preferredSelection !== "undefined"
        ? preferredSelection
        : this.params.selectedAnimal;
    let idx = parseInt(String(raw), 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= total) {
      idx = 0;
    }

    this.params.selectedAnimal = String(idx);
    this._skipNextAnimalParamsLoad = true;
    this._lastAnimalParamsSelection = this.params.selectedAnimal;
    return this.animalLibrary.getAnimal(idx);
  }

  _applyAnimalSource() {
    if (!this.animalLibrary || !this.animalLibrary.setActiveDimension) return;
    this.animalLibrary.setActiveDimension(this.params.dimension);
  }

  _applyImportedParams(rawParams, { allowGridSize = true } = {}) {
    if (!rawParams || typeof rawParams !== "object") {
      return { gridSizeChanged: false, dimensionChanged: false };
    }

    const p = this.params;
    const beforeGridSize = p.gridSize;
    const beforeDimension = p.dimension;

    const sanitised = { ...rawParams };

    if ("b" in sanitised && typeof sanitised.b === "string") {
      sanitised.b = sanitised.b
        .split(",")
        .map((v) => RLECodec.parseFraction(v))
        .filter((v) => Number.isFinite(v));
    }

    if (
      "selectedAnimal" in sanitised &&
      (sanitised.selectedAnimal === null ||
        sanitised.selectedAnimal === undefined)
    ) {
      sanitised.selectedAnimal = "";
    }

    if (!allowGridSize) delete sanitised.gridSize;

    const prevColourMap = p.colourMap;
    const prevRenderMode = p.renderMode;
    const prevImageFormat = p.imageFormat;

    this._mergeByTargetSchema(p, sanitised);

    if (allowGridSize && "gridSize" in rawParams) {
      p.gridSize = this._normaliseGridSize(p.gridSize);
    }

    const maxR = this.getMaxKernelRadius(p.gridSize);
    const maxT = this.getMaxTimeScale();

    const numericConstraints = {
      R: (v) => Math.round(constrain(v, 2, maxR)),
      T: (v) => Math.round(constrain(v, 1, maxT)),
      m: (v) => constrain(v, 0, 1),
      s: (v) => Math.max(0.0001, v),
      kn: (v) => Math.round(constrain(v, 1, 4)),
      gn: (v) => Math.round(constrain(v, 1, 3)),
      addNoise: (v) => constrain(v, 0, 10),
      maskRate: (v) => constrain(v, 0, 10),
      paramP: (v) => Math.round(constrain(v, 0, 64)),
      placeScale: (v) => constrain(v, 0.25, 4),
      recordingFPS: (v) => Math.round(constrain(v, 12, 120)),
      videoBitrateMbps: (v) => constrain(v, 1, 64),
    };

    for (const [key, fn] of Object.entries(numericConstraints)) {
      if (key in rawParams && typeof p[key] === "number") {
        p[key] = fn(p[key]);
      }
    }

    if (typeof NDCompatibility !== "undefined") {
      if ("dimension" in rawParams) {
        p.dimension = NDCompatibility.coerceDimension(p.dimension);
        if (this.animalLibrary?.setActiveDimension) {
          this.animalLibrary.setActiveDimension(p.dimension);
        }
      }
      if ("viewMode" in rawParams) {
        p.viewMode = NDCompatibility.coerceViewMode(p.dimension, p.viewMode);
      }
      if ("ndDepth" in rawParams) {
        p.ndDepth = NDCompatibility.coerceDepth(p.ndDepth, p.dimension);
      }
      if ("ndSliceZ" in rawParams) {
        p.ndSliceZ = NDCompatibility.coerceSliceIndex(p.ndSliceZ, p.ndDepth);
      }
      if ("ndSliceW" in rawParams) {
        p.ndSliceW = NDCompatibility.coerceSliceIndex(p.ndSliceW, p.ndDepth);
      }
      if (!(allowGridSize && "gridSize" in rawParams)) {
        p.gridSize = NDCompatibility.coerceGridSize(p.gridSize, p.dimension);
      }
    }

    p.ndActiveAxis = this._coerceNDActiveAxis(p.ndActiveAxis, p.dimension);

    this._syncPixelSizeFromGrid();

    if (!Array.isArray(p.b) || p.b.length === 0) p.b = [1];

    if ("colourMap" in rawParams && !this.colourMapKeys.includes(p.colourMap)) {
      p.colourMap = prevColourMap;
    }

    if (
      "renderMode" in rawParams &&
      !["world", "potential", "growth", "kernel"].includes(p.renderMode)
    ) {
      p.renderMode = prevRenderMode;
    }

    if ("imageFormat" in rawParams) {
      const fmt = String(p.imageFormat || "").toLowerCase();
      if (!["png", "jpg", "jpeg", "webm", "mp4"].includes(fmt)) {
        p.imageFormat = prevImageFormat;
      } else {
        p.imageFormat = fmt;
      }
    }

    if ("selectedAnimal" in rawParams) {
      const incoming = rawParams.selectedAnimal;
      if (
        incoming !== "" &&
        incoming !== null &&
        typeof incoming !== "undefined"
      ) {
        const idx = parseInt(String(incoming), 10);
        if (
          !Number.isFinite(idx) ||
          !this.animalLibrary ||
          idx < 0 ||
          idx >= this.animalLibrary.animals.length
        ) {
          p.selectedAnimal = "";
        }
      }
    }

    this._skipNextAnimalParamsLoad = true;
    this._lastAnimalParamsSelection = p.selectedAnimal || "";
    this._lastPlacementScale = Math.max(
      0.25,
      Math.min(4, Number(p.placeScale) || 1),
    );

    this._syncSelectedAnimalForActiveDimension(p.selectedAnimal);

    return {
      gridSizeChanged: p.gridSize !== beforeGridSize,
      dimensionChanged: p.dimension !== beforeDimension,
    };
  }

  importWorldPayload(payload) {
    if (!payload || !payload.fields) return;

    this._queueAction("importWorld", () =>
      this._queueOrRunMutation(() => {
        const applied = this._applyImportedParams(payload.params, {
          allowGridSize: false,
        });

        const nextSize = this._normaliseGridSize(
          payload.size || this.params.gridSize,
        );
        const sizeChanged = nextSize !== this.params.gridSize;

        if (sizeChanged) {
          this.params.gridSize = nextSize;
          this._restartWorker();

          const canvasSize = min(windowWidth, windowHeight);
          resizeCanvas(canvasSize, canvasSize);
          this.board.resize(nextSize);
          this.renderer.resize(nextSize);
          this._syncPixelSizeFromGrid();
          this._pendingPlacement = null;
        }

        this._ensureBuffers();

        for (const key of Object.getOwnPropertyNames(this.board)) {
          if (key.startsWith("_")) continue;
          const target = this.board[key];
          if (!(target instanceof Float32Array)) continue;
          target.fill(0);
          const src = payload.fields[key];
          if (src instanceof Float32Array) {
            target.set(src.subarray(0, target.length));
          } else if (Array.isArray(src)) {
            const n = Math.min(src.length, target.length);
            for (let i = 0; i < n; i++) {
              const v = Number(src[i]);
              target[i] = Number.isFinite(v) ? v : 0;
            }
          }
        }

        this.automaton.reset();
        this.automaton.updateParameters(this.params);

        this.analyser.resetStatistics();
        this.analyser.reset();
        if (payload.statistics && typeof payload.statistics === "object") {
          this._mergeByTargetSchema(this.statistics, payload.statistics);
        }
        if (Array.isArray(payload.series)) {
          this.analyser.series = this._normaliseImportedSeries(payload.series);
        }

        this._workerSendKernel();
        if (
          applied?.dimensionChanged &&
          this.gui &&
          typeof this.gui.rebuildPane === "function"
        ) {
          this.gui.rebuildPane();
        } else {
          this.refreshGUI();
        }

        const fieldKeys = Object.keys(payload.fields);
        console.log(
          `[Lenia] Imported world: size=${this.params.gridSize}${sizeChanged ? " (resized)" : ""}, params=${payload.params ? "restored" : "unchanged"}, stats=${payload.statistics ? "restored" : "reset"}, fields=[${fieldKeys.join(",")}], selectedAnimal=${this.params.selectedAnimal || "none"}, placeScale=${this.params.placeScale || 1}`,
        );
      }),
    );
  }

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

    const size = this.params.gridSize;
    const depth =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.getWorldDepthForDimension(size, dimension)
        : Math.max(
            2,
            Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)),
          );
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
      const centeredZ = slice.z + offsetZ;
      const centeredW = slice.w + offsetW;
      if (centeredZ < 0 || centeredZ >= depth) continue;
      if (centeredW < 0 || centeredW >= depth) continue;

      let plane;
      if (extraDims >= 2) {
        plane = centeredZ + centeredW * depth;
      } else {
        plane = centeredZ;
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

  loadAnimal(animal) {
    if (!animal) return;

    this._pendingActions = this._pendingActions.filter(
      (action) => action.name !== "loadAnimalParams",
    );

    this._queueAnimalLoad(animal, { loadPattern: true });
  }

  loadSelectedAnimal() {
    const animal = this.getSelectedAnimal();
    if (animal) {
      this.loadAnimal(animal);
    }
  }

  cycleAnimal(delta) {
    const lib = this.animalLibrary;
    if (!lib || !lib.animals || lib.animals.length === 0) return;

    const total = lib.animals.length;
    const current = this.getSelectedAnimalIndex();
    const base = current === null ? (delta > 0 ? -1 : 0) : current;
    const next = (((base + delta) % total) + total) % total;
    const nextSelection = String(next);

    this._skipNextAnimalParamsLoad = true;
    this._lastAnimalParamsSelection = nextSelection;
    this.params.selectedAnimal = nextSelection;

    const animal = lib.getAnimal(next);
    if (animal) this.loadAnimal(animal);
    this.refreshGUI();
  }

  loadAnimalParams(animal) {
    if (!animal) return;

    this._queueAnimalLoad(animal, { loadPattern: false });
  }

  _queueAnimalLoad(animal, { loadPattern = true } = {}) {
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
        const defaultR = this.getPythonDefaultRadius(
          this.params.gridSize,
          this.params.dimension,
        );

        let baseR = Math.max(2, Number(this.params.R) || defaultR);

        if (isCurrentLife && !isNextLife) {
          baseR = defaultR;
        }

        if (
          (forcePartR || forceNativeBugR) &&
          Number.isFinite(sourceR) &&
          sourceR > 0
        ) {
          baseR = Math.round(
            constrain(
              sourceR,
              2,
              this.getMaxKernelRadius(this.params.gridSize),
            ),
          );
        }

        this.params.R = baseR;
        this._applyAnimalSimulationParams(animal);

        const requestedScale = this.getEffectivePlacementScale(
          this.params.placeScale,
        );
        const patternScale = this.applyScaledAnimalParams(
          animal,
          requestedScale,
          {
            baseR: Number.isFinite(sourceR) && sourceR > 0 ? sourceR : baseR,
          },
        );

        this.params.R = Math.round(
          constrain(
            Number(this.params.R) || baseR,
            2,
            this.getMaxKernelRadius(this.params.gridSize),
          ),
        );

        const dim = Number(this.params.dimension) || 2;
        if (loadPattern && dim <= 2) {
          if (Math.abs(patternScale - 1) < 1e-6) {
            this.board.loadPattern(animal);
          } else {
            this.board.clear();
            const center = Math.floor(this.board.size / 2);
            this.board.placePatternScaled(animal, center, center, patternScale);
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
    this.applySelectedAnimalScaledRT(next, { baseR, refreshGUI: true });
  }

  setPolarMode(mode, { refreshGUI = true } = {}) {
    const nextMode = Math.max(0, Math.min(4, Math.floor(Number(mode) || 0)));
    this.params.polarMode = nextMode;
    if (nextMode > 0) {
      this.params.renderSymmetryOverlay = true;
    }
    if (refreshGUI) this.refreshGUI();
    return nextMode;
  }

  cyclePolarMode(delta = 1, { refreshGUI = true } = {}) {
    const current = Math.max(
      0,
      Math.min(4, Math.floor(Number(this.params.polarMode) || 0)),
    );
    const step = Math.floor(Number(delta) || 0) || 1;
    const next = (((current + step) % 5) + 5) % 5;
    return this.setPolarMode(next, { refreshGUI });
  }

  loadSelectedAnimalParams() {
    const currentSelection = this.params.selectedAnimal || "";

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
      this.loadAnimalParams(animal);
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
    if (Number.isFinite(sourceR) && sourceR > 0) {
      const targetR = Math.max(2, Number(this.params.R) || sourceR);
      scale = targetR / sourceR;
    }
    this._ensureBuffers();

    if ((this.params.dimension || 2) > 2) {
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
    const boardSize = this.board?.size || this.params.gridSize;
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
    const size = this.params.gridSize;
    const depth =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.getWorldDepthForDimension(size, dimension)
        : Math.max(
            2,
            Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)),
          );
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

    const size = this.params.gridSize;
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

  _restartWorker() {
    if (!this._worker) return;
    this._worker.terminate();
    this._worker = null;
    this._workerBusy = false;
    this._stepPending = false;
    this._kernelPending = false;
    this._viewPending = false;
    this._changeRecycleBuffer = null;
    this._pendingMutations.length = 0;
    this._initWorker();
  }

  _queueAction(name, handler) {
    this._pendingActions = this._pendingActions.filter(
      (action) => action.name !== name,
    );
    this._pendingActions.push({ name, handler });
  }

  _runNextAction() {
    const next = this._pendingActions.shift();
    if (!next || typeof next.handler !== "function") return;
    next.handler();
  }

  loadInitialAnimal() {
    if (!this.animalLibrary.loaded || this.animalLibrary.animals.length === 0)
      return;

    const firstAnimal = this.animalLibrary.getAnimal(0);
    if (firstAnimal) {
      this._skipNextAnimalParamsLoad = true;
      this._lastAnimalParamsSelection = "0";
      this.params.selectedAnimal = "0";
      this.loadAnimal(firstAnimal);
      this.refreshGUI();
    }
  }

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
    const modes =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.getViewModesForDimension(this.params.dimension)
        : ["slice"];

    return modes.reduce((options, mode) => {
      if (mode === "slice") options["Slice"] = mode;
      if (mode === "projection") options["Projection"] = mode;
      return options;
    }, {});
  }

  getGridSizeOptions(dimension = this.params.dimension) {
    const dim =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDimension(dimension)
        : 2;
    const sizes =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.getGridSizeOptions(dim)
        : [64, 128, 256, 512, 1024, 2048];
    const canvasSize = min(windowWidth, windowHeight);
    const options = {};
    for (const size of sizes) {
      if (size <= canvasSize) {
        options[`${size}^${dim}`] = size;
      }
    }
    if (Object.keys(options).length === 0) {
      options[`${sizes[0]}^${dim}`] = sizes[0];
    }
    return options;
  }

  getPixelSizeOptions(dimension = this.params.dimension) {
    const dim =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDimension(dimension)
        : 2;
    const canvasSize = min(windowWidth, windowHeight);
    return typeof NDCompatibility !== "undefined"
      ? NDCompatibility.getPixelSizeOptions(canvasSize, dim)
      : { "4px (128)": 4, "2px (256)": 2, "1px (512)": 1 };
  }

  applyPixelSize(pixelSize) {
    const canvasSize = min(windowWidth, windowHeight);
    const oldGrid = Math.max(1, Math.floor(Number(this.params.gridSize) || 1));
    const dim =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDimension(this.params.dimension)
        : 2;
    const newGrid =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.gridSizeFromPixelSize(pixelSize, canvasSize, dim)
        : this._normaliseGridSize(Math.floor(canvasSize / pixelSize));

    if (!Number.isFinite(newGrid) || newGrid <= 0) return;

    this.params.pixelSize = Math.max(
      1,
      Math.floor(canvasSize / Math.max(1, newGrid)),
    );

    if (newGrid !== oldGrid) {
      this.params.R = this.getPythonDefaultRadius(newGrid, dim);
      this._prevR = this.params.R;
      this.params.T = Math.round(
        constrain(Number(this.params.T) || 10, 1, this.getMaxTimeScale()),
      );
    }

    this.params.gridSize = newGrid;
    this.changeResolution();
  }

  getMaxKernelRadius(gridSize = this.params.gridSize) {
    const size = Math.max(1, Math.floor(Number(gridSize) || 1));
    return Math.max(2, Math.floor(size / 2));
  }

  getMaxTimeScale() {
    return 1500;
  }

  getPythonDefaultRadius(
    gridSize = this.params.gridSize,
    dimension = this.params.dimension,
  ) {
    const size = Math.max(1, Math.floor(Number(gridSize) || 1));
    const dim =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDimension(dimension)
        : Math.max(2, Math.floor(Number(dimension) || 2));
    const raw = (size / 64) * dim * 5;
    return Math.round(constrain(raw, 2, this.getMaxKernelRadius(size)));
  }

  getEffectivePlacementScale(scale = this.params.placeScale) {
    const uiScale = constrain(Number(scale) || 1, 0.25, 4);
    return uiScale;
  }

  _syncPixelSizeFromGrid() {
    const canvasSize = min(windowWidth, windowHeight);
    this.params.pixelSize = Math.max(
      1,
      Math.floor(canvasSize / Math.max(1, this.params.gridSize)),
    );
  }

  getWorldShapeLabel() {
    const dim = Math.max(2, Math.floor(Number(this.params.dimension) || 2));
    const size = Math.max(1, Math.floor(Number(this.params.gridSize) || 1));
    const shape = dim === 2 ? "square" : dim === 3 ? "cube" : "hypercube";
    return `${shape} ${size}^${dim}`;
  }

  _coerceNDActiveAxis(axis, dimension = this.params.dimension) {
    const dim =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDimension(dimension)
        : Math.max(2, Math.floor(Number(dimension) || 2));
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
    const dimension =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDimension(this.params.dimension)
        : 2;
    const viewMode =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceViewMode(dimension, this.params.viewMode)
        : "slice";
    const ndDepth =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.getWorldDepthForDimension(
            this.params.gridSize,
            dimension,
          )
        : Math.max(
            2,
            Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)),
          );
    const ndSliceZ =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceSliceIndex(this.params.ndSliceZ, ndDepth)
        : Math.max(
            0,
            Math.min(
              ndDepth - 1,
              Math.floor(Number(this.params.ndSliceZ) || 0),
            ),
          );
    const ndSliceW =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceSliceIndex(this.params.ndSliceW, ndDepth)
        : Math.max(
            0,
            Math.min(
              ndDepth - 1,
              Math.floor(Number(this.params.ndSliceW) || 0),
            ),
          );
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
    const nextDimension =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDimension(dimension)
        : 2;

    this._changingDimension = true;
    try {
      this.params.dimension = nextDimension;
      const coercedSize = this._normaliseGridSize(this.params.gridSize);
      const sizeChanged = coercedSize !== this.params.gridSize;
      this.params.gridSize = coercedSize;
      this.params.R = this.getPythonDefaultRadius(
        this.params.gridSize,
        nextDimension,
      );
      this._prevR = this.params.R;

      if ((Number(this.params.dimension) || 2) > 2) {
        this.params.viewMode = "projection";
        const ndDepthForSlice =
          typeof NDCompatibility !== "undefined"
            ? NDCompatibility.getWorldDepthForDimension(
                this.params.gridSize,
                nextDimension,
              )
            : Math.max(
                2,
                Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)),
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

      this._syncPixelSizeFromGrid();

      if (animal) {
        this.loadAnimal(animal);
      } else {
        this.clearWorld();
      }

      console.log(
        `[Lenia] ${nextDimension}D mode enabled with ${this.params.gridSize}^${nextDimension} world shape and ND tensor stepping.`,
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
    const depth =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDepth(
            this.params.ndDepth,
            this.params.dimension,
          )
        : Math.max(
            2,
            Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)),
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

  centerNDSlices({ allAxes = true } = {}) {
    if ((this.params.dimension || 2) <= 2) return;
    const depth =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDepth(
            this.params.ndDepth,
            this.params.dimension,
          )
        : Math.max(
            2,
            Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)),
          );
    const center = Math.floor(depth / 2);

    if (allAxes || this.getNDActiveAxis() === "z") {
      this.params.ndSliceZ = center;
    }
    if ((this.params.dimension || 2) >= 4) {
      if (allAxes || this.getNDActiveAxis() === "w") {
        this.params.ndSliceW = center;
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

      if (this.gui && this.gui.pane) this.gui.pane.refresh();
    } finally {
      this._isRefreshingGUI = false;
    }
  }

  windowResized() {
    const canvasSize = min(windowWidth, windowHeight);
    if (width === canvasSize && height === canvasSize) {
      return false;
    }

    resizeCanvas(canvasSize, canvasSize, true);
    this._syncPixelSizeFromGrid();
    this.refreshGUI();
    return false;
  }

  dispose() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._workerBusy = false;
    this._stepPending = false;
    this._kernelPending = false;
    this._changeRecycleBuffer = null;
    this._pendingActions = [];
    this._pendingMutations = [];

    if (this.media && typeof this.media.dispose === "function") {
      this.media.dispose();
    }

    if (this.gui && typeof this.gui.dispose === "function") {
      this.gui.dispose();
    }

    if (this.renderer && typeof this.renderer.dispose === "function") {
      this.renderer.dispose();
    }
  }

  _isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  _mergeByTargetSchema(target, incoming) {
    if (!this._isPlainObject(target) || !this._isPlainObject(incoming)) {
      return;
    }

    for (const key of Object.keys(target)) {
      if (!(key in incoming)) continue;

      const sourceValue = incoming[key];
      const targetValue = target[key];

      if (ArrayBuffer.isView(targetValue)) {
        if (!Array.isArray(sourceValue) && !ArrayBuffer.isView(sourceValue)) {
          continue;
        }
        const typed = new targetValue.constructor(targetValue.length);
        const limit = Math.min(typed.length, sourceValue.length || 0);
        for (let i = 0; i < limit; i++) {
          const n = Number(sourceValue[i]);
          typed[i] = Number.isFinite(n) ? n : 0;
        }
        target[key] = typed;
        continue;
      }

      if (Array.isArray(targetValue)) {
        if (Array.isArray(sourceValue)) {
          target[key] = JSON.parse(JSON.stringify(sourceValue));
        }
        continue;
      }

      if (this._isPlainObject(targetValue)) {
        if (this._isPlainObject(sourceValue)) {
          this._mergeByTargetSchema(targetValue, sourceValue);
        }
        continue;
      }

      if (typeof targetValue === "number") {
        const n = Number(sourceValue);
        if (Number.isFinite(n)) {
          target[key] = n;
        }
        continue;
      }

      if (typeof targetValue === "boolean") {
        target[key] = Boolean(sourceValue);
        continue;
      }

      if (typeof targetValue === "string") {
        target[key] = String(sourceValue);
        continue;
      }

      target[key] = JSON.parse(JSON.stringify(sourceValue));
    }
  }
}
