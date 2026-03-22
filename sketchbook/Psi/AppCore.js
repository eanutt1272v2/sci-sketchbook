class AppCore {
  constructor(assets) {
    this.metadata = assets.metadata;
    this.colourMaps = assets.colourMaps;
    this.colourMapKeys = Object.keys(this.colourMaps);
    this.font = assets.font;

    this.params = {
      orbitalNotation: "",
      n: 4,
      l: 1,
      m: 0,
      nuclearCharge: 1,
      useReducedMass: true,
      nucleusMassKg: 1.67262192369e-27,

      colourMap: "rocket",
      exposure: 0.75,

      resolution: 256,
      pixelSmoothing: true,
      renderOverlay: true,
      renderLegend: true,
      renderEquation: true,
      renderKeymapRef: false,

      viewRadius: 32,
      slicePlane: "xz",
      sliceOffset: 0,
      viewCentre: { x: 0, y: 0, z: 0 },

      imageFormat: "png",
      recordingFPS: 60,
      videoBitrateMbps: 8,
    };

    this.statistics = {
      fps: 0,
      density: 0,
      peakDensity: 0,
      mean: 0,
      stdDev: 0,
      entropy: 0,
      concentration: 0,
      radialPeak: 0,
      radialSpread: 0,
      nodeEstimate: 0,
    };

    this._pendingActions = [];
    this._analysisConfig = { resolution: 384 };
    this._analysisSignature = "";
    this._analysisGrid = null;
    this._normalisationPeak = 1e-30;
    this._lastStableNormalisationPeak = 1e-30;
    this.aMuMeters = 5.29177210903e-11;

    this.fallbacksolver = new FallbackSolver(this);
    this.analyser = new Analyser(this.statistics);
    this.renderer = new Renderer(this);
    this.media = new Media(this);
    this.gui = new GUI(this);
    this.input = new InputHandler(this);

    this._worker = null;
    this._workerBusy = false;
    this._renderPending = false;
    this._renderRequestId = 0;
    this._initWorker();

    this.requestRender();
  }

  update() {
    this.input.handleContinuousInput();
    this.statistics.fps = frameRate();
  }

  render() {
    this.renderer.render();

    if (this._pendingActions.length > 0) {
      this._runNextAction();
    }
  }

  updateQuantumNumbers(type, delta) {
    if (type === "n") {
      this.params.n = Math.max(1, this.params.n + delta);
    } else if (type === "l") {
      this.params.l = Math.max(0, this.params.l + delta);
    } else if (type === "m") {
      this.params.m += delta;
    }

    this.gui.enforceConstraints();
  }

  changePlane(plane) {
    if (["xy", "xz", "yz"].includes(plane)) {
      this.params.slicePlane = plane;
      this.requestRender();
    }
  }

  cycleColourMap() {
    const maps = this.colourMapKeys;
    const currentIndex = maps.indexOf(this.params.colourMap);
    this.params.colourMap = maps[(currentIndex + 1) % maps.length];
    this.renderer.update();
  }

  toggleOverlay() {
    this.params.renderOverlay = !this.params.renderOverlay;
  }

  toggleLegend() {
    this.params.renderLegend = !this.params.renderLegend;
  }

  toggleSmoothing() {
    this.params.pixelSmoothing = !this.params.pixelSmoothing;
  }

  toggleGUI() {
    this.gui.pane.expanded = !this.gui.pane.expanded;
  }

  toggleKeymapRef() {
    this.params.renderKeymapRef = !this.params.renderKeymapRef;
  }

  resetSliceOffset() {
    this.params.sliceOffset = 0;
    this.requestRender();
  }

  resetViewCentre() {
    const { viewCentre } = this.params;
    viewCentre.x = 0;
    viewCentre.y = 0;
    viewCentre.z = 0;
    this.requestRender();
  }

  adjustSliceOffset(delta) {
    this.params.sliceOffset = constrain(
      this.params.sliceOffset + delta,
      -this.params.viewRadius,
      this.params.viewRadius,
    );
    this.requestRender();
  }

  adjustViewRadius(delta) {
    this.params.viewRadius = constrain(this.params.viewRadius + delta, 1, 256);
    this.syncViewConstraints();
  }

  adjustExposure(delta) {
    this.params.exposure = constrain(this.params.exposure + delta, 0, 2);
    this.requestRender();
  }

  adjustResolution(delta) {
    this.params.resolution = constrain(this.params.resolution + delta, 64, 512);
    this.requestRender();
  }

  exportImage() {
    this.media.exportImage();
  }

  resize() {
    const canvasSize = min(windowWidth, windowHeight);
    resizeCanvas(canvasSize, canvasSize);
    this.requestRender();
  }

  handleWheel(e) {
    return this.input.handleWheel(e);
  }

  handlePointer(event) {
    return this.input.handlePointer(event);
  }

  handlePointerEnd(event) {
    return this.input.handlePointerEnd(event);
  }

  handleKeyPressed(k, kCode) {
    return this.input.handleKeyPressed(k, kCode);
  }

  handleKeyReleased(k, kCode) {
    return this.input.handleKeyReleased(k, kCode);
  }

  canvasInteraction(e) {
    if (!e || !e.target) return false;
    if (typeof e.target.closest !== "function") return false;
    if (e.target.closest(".tp-dfwv")) return false;
    if (e.target.tagName !== "CANVAS") return false;
    return true;
  }

  getPlaneAxes() {
    switch (this.params.slicePlane) {
      case "xy":
        return {
          axis1: "x",
          axis2: "y",
          fixedAxis: "z",
          axis1Label: "X",
          axis2Label: "Y",
          fixedLabel: "Z",
        };
      case "yz":
        return {
          axis1: "y",
          axis2: "z",
          fixedAxis: "x",
          axis1Label: "Y",
          axis2Label: "Z",
          fixedLabel: "X",
        };
      case "xz":
      default:
        return {
          axis1: "x",
          axis2: "z",
          fixedAxis: "y",
          axis1Label: "X",
          axis2Label: "Z",
          fixedLabel: "Y",
        };
    }
  }

  requestRender() {
    this._queueAction("render", () => this._requestRenderNow());
  }

  _requestRenderNow() {
    this._sanitisePhysicalParams();
    if (this._worker) {
      if (this._workerBusy) {
        this._renderPending = true;
      } else {
        this._dispatchRender();
      }
    } else {
      this._updateCanonicalAnalysis(false, this.params.renderOverlay);
      this.renderer.update();
      this.refreshGUI();
    }
  }

  _getCanonicalViewRadius() {
    const n = Math.max(1, Number(this.params.n) || 1);
    const l = Math.max(0, Number(this.params.l) || 0);
    const Z = Math.max(1, Number(this.params.nuclearCharge) || 1);
    const expectedRadius = (3 * n * n - l * (l + 1)) / (2 * Z);
    return Math.max(8, Math.min(512, expectedRadius));
  }

  _getAnalysisSignature() {
    const { n, l, m, slicePlane, sliceOffset } = this.params;
    const nuclearCharge = Math.max(
      1,
      Math.round(Number(this.params.nuclearCharge) || 1),
    );
    const useReducedMass = this.params.useReducedMass !== false;
    const nucleusMassKg = Number(this.params.nucleusMassKg) || 0;
    return [
      n,
      l,
      m,
      slicePlane,
      Number(sliceOffset).toFixed(6),
      Number(nuclearCharge || 1),
      useReducedMass ? 1 : 0,
      Number(nucleusMassKg || 0).toPrecision(8),
    ].join("|");
  }

  _sanitisePhysicalParams() {
    const params = this.params;
    const protonMassKg = 1.67262192369e-27;

    params.nuclearCharge = Math.max(
      1,
      Math.round(Number(params.nuclearCharge) || 1),
    );

    params.useReducedMass = params.useReducedMass !== false;

    const rawMass = Number(params.nucleusMassKg);
    const fallbackMass =
      params.nuclearCharge === 1
        ? protonMassKg
        : Math.max(protonMassKg, params.nuclearCharge * protonMassKg);

    params.nucleusMassKg =
      Number.isFinite(rawMass) && rawMass > 0 ? rawMass : fallbackMass;
  }

  _updateCanonicalAnalysis(force = false, updateStats = true) {
    this._sanitisePhysicalParams();
    const signature = this._getAnalysisSignature();
    const shouldRecompute = force || signature !== this._analysisSignature;

    if (shouldRecompute) {
      const { n, l, m, slicePlane, sliceOffset } = this.params;
      const canonicalRadius = this._getCanonicalViewRadius();
      const result = this.renderer.computeGridData({
        n,
        l,
        m,
        resolution: this._analysisConfig.resolution,
        viewRadius: canonicalRadius,
        slicePlane,
        sliceOffset,
        viewCentre: { x: 0, y: 0, z: 0 },
        allocateBuffer: false,
      });

      this._analysisGrid = result.grid;
      const nextPeak = Number(result.peak);
      if (Number.isFinite(nextPeak) && nextPeak > 0) {
        this._normalisationPeak = Math.max(1e-30, nextPeak);
        this._lastStableNormalisationPeak = this._normalisationPeak;
      } else {
        this._normalisationPeak = this._lastStableNormalisationPeak;
      }
      if (Number.isFinite(Number(result.aMu))) {
        this.aMuMeters = Number(result.aMu);
      }
      this._analysisSignature = signature;
    }

    if (!this._analysisGrid || this._analysisGrid.length === 0) return;

    if (!updateStats) return;

    this.analyser.updateStatistics(this._analysisGrid, {
      ...this.params,
      fps: Number(this.statistics.fps) || 0,
      resolution: this._analysisConfig.resolution,
      viewRadius: this._getCanonicalViewRadius(),
      viewCentre: { x: 0, y: 0, z: 0 },
      aMuMeters: this.aMuMeters,
    });
  }

  getNormalisationPeak() {
    const peak = Number(this._normalisationPeak);
    if (Number.isFinite(peak) && peak > 0) {
      return peak;
    }
    return Math.max(1e-30, Number(this._lastStableNormalisationPeak) || 1e-30);
  }

  _queueAction(name, handler) {
    if (!Array.isArray(this._pendingActions)) {
      this._pendingActions = [];
    }
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

  _initWorker() {
    try {
      this._worker = new Worker("PsiWorker.js");
    } catch (e) {
      console.warn(
        "[Psi] Worker unavailable, falling back to synchronous rendering",
        e,
      );
      this._worker = null;
      return;
    }
    this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
    this._worker.onerror = (e) => {
      console.error("[Psi] Worker error:", e);
      this._workerBusy = false;
      this._updateCanonicalAnalysis(false, this.params.renderOverlay);
      this.renderer.update();
      this.refreshGUI();
    };
  }

  _dispatchRender() {
    this._sanitisePhysicalParams();
    const {
      n,
      l,
      m,
      resolution: res,
      viewRadius,
      slicePlane,
      sliceOffset,
      viewCentre,
    } = this.params;
    const analysisSignature = this._getAnalysisSignature();
    const includeAnalysis =
      this.params.renderOverlay && analysisSignature !== this._analysisSignature;
    const analysisViewRadius = this._getCanonicalViewRadius();
    const requestId = ++this._renderRequestId;
    this._workerBusy = true;
    this._renderPending = false;
    this._worker.postMessage({
      type: "render",
      requestId,
      n,
      l,
      m,
      nuclearCharge: Math.max(1, Math.round(Number(this.params.nuclearCharge) || 1)),
      useReducedMass: this.params.useReducedMass !== false,
      nucleusMassKg: Number(this.params.nucleusMassKg) || this.params.nucleusMassKg,
      res,
      viewRadius,
      slicePlane,
      sliceOffset,
      viewCentre: { x: viewCentre.x, y: viewCentre.y, z: viewCentre.z },
      includeAnalysis,
      analysisSignature,
      analysisResolution: this._analysisConfig.resolution,
      analysisViewRadius,
    });
  }

  _applyWorkerAnalysis(data) {
    const nextPeak = Number(data.analysisPeak);
    if (Number.isFinite(nextPeak) && nextPeak > 0) {
      this._normalisationPeak = Math.max(1e-30, nextPeak);
      this._lastStableNormalisationPeak = this._normalisationPeak;
    } else {
      this._normalisationPeak = this._lastStableNormalisationPeak;
    }

    const workerAMu = Number(data.analysisAMu);
    if (Number.isFinite(workerAMu) && workerAMu > 0) {
      this.aMuMeters = workerAMu;
    }

    if (typeof data.analysisSignature === "string" && data.analysisSignature) {
      this._analysisSignature = data.analysisSignature;
    }

    if (!this.params.renderOverlay || !data.analysisStats) return;
    this.analyser.applyWorkerStatistics(data.analysisStats, {
      ...this.params,
      fps: Number(this.statistics.fps) || 0,
      resolution: Number(data.analysisResolution) || this._analysisConfig.resolution,
      viewRadius: Number(data.analysisViewRadius) || this._getCanonicalViewRadius(),
      viewCentre: { x: 0, y: 0, z: 0 },
      aMuMeters: this.aMuMeters,
    });
  }

  _onWorkerMessage(data) {
    if (data.type !== "result") return;

    if (Number(data.requestId) !== this._renderRequestId) {
      return;
    }

    this._workerBusy = false;
    this._applyWorkerAnalysis(data);
    this.renderer.renderFromGrid(data.grid, data.peak, data.resolution);

    if (this._renderPending) {
      this._renderPending = false;
      this._dispatchRender();
    }
  }

  syncViewConstraints() {
    if (this.gui && typeof this.gui.updateViewConstraints === "function") {
      this.gui.updateViewConstraints();
      return;
    }

    this.requestRender();
  }

  refreshGUI() {
    if (this.gui && typeof this.gui.syncMediaControls === "function") {
      this.gui.syncMediaControls();
    }

    if (this.gui && typeof this.gui.refresh === "function") {
      this.gui.refresh();
    }
  }

  dispose() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._workerBusy = false;
    this._renderPending = false;
    this._pendingActions = [];

    if (this.media && typeof this.media.dispose === "function") {
      this.media.dispose();
    }

    if (this.renderer && typeof this.renderer.dispose === "function") {
      this.renderer.dispose();
    }
  }
}