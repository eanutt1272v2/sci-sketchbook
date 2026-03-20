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

      colourMap: "rocket",
      exposure: 0.75,

      resolution: 256,
      pixelSmoothing: true,
      renderOverlay: true,
      renderLegend: true,
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
    this._analysisConfig = { resolution: 256, viewRadius: 32 };
    this._analysisSignature = "";
    this._normalisationPeak = 1e-10;
    this._analysisGrid = null;

    this.fallbacksolver = new FallbackSolver(this);
    this.analyser = new Analyser(this.statistics);
    this.renderer = new Renderer(this);
    this.media = new Media(this);
    this.gui = new GUI(this);
    this.input = new InputHandler(this);

    this._worker = null;
    this._workerBusy = false;
    this._renderPending = false;
    this._initWorker();

    this.requestRender();
  }

  update() {
    this.input.handleContinuousInput();
    this.statistics.fps = frameRate();
  }

  draw() {
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
    if (this._worker) {
      if (this._workerBusy) {
        this._renderPending = true;
      } else {
        this._dispatchRender();
      }
    } else {
      this._updateCanonicalAnalysis(false);
      this.renderer.update();
      this.refreshGUI();
    }
  }

  _getAnalysisSignature() {
    const { n, l, m, slicePlane, sliceOffset } = this.params;
    return `${n}|${l}|${m}|${slicePlane}|${Number(sliceOffset).toFixed(5)}`;
  }

  _updateCanonicalAnalysis(force = false) {
    const signature = this._getAnalysisSignature();
    const shouldRecompute = force || signature !== this._analysisSignature;

    if (shouldRecompute) {
      const { n, l, m, slicePlane, sliceOffset } = this.params;
      const { resolution, viewRadius } = this._analysisConfig;
      const result = this.renderer.computeGridData({
        n,
        l,
        m,
        resolution,
        viewRadius,
        slicePlane,
        sliceOffset,
        viewCentre: { x: 0, y: 0, z: 0 },
        allocateBuffer: false,
      });

      this._analysisGrid = result.grid;
      this._normalisationPeak = Math.max(1e-10, Number(result.peak) || 0);
      this._analysisSignature = signature;
    }

    if (!this._analysisGrid || this._analysisGrid.length === 0) return;

    this.analyser.updateStatistics(this._analysisGrid, {
      ...this.params,
      resolution: this._analysisConfig.resolution,
      viewRadius: this._analysisConfig.viewRadius,
      viewCentre: { x: 0, y: 0, z: 0 },
      fps: Number(this.statistics.fps) || 0,
    });
  }

  getNormalisationPeak() {
    return this._normalisationPeak;
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
      this._worker = new Worker("EigenWorker.js");
    } catch (e) {
      console.warn(
        "[Eigen] Worker unavailable, falling back to synchronous rendering",
        e,
      );
      this._worker = null;
      return;
    }
    this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
    this._worker.onerror = (e) => {
      console.error("[Eigen] Worker error:", e);
      this._workerBusy = false;
      this._updateCanonicalAnalysis(false);
      this.renderer.update();
      this.refreshGUI();
    };
  }

  _dispatchRender() {
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
    this._workerBusy = true;
    this._renderPending = false;
    this._worker.postMessage({
      type: "render",
      n,
      l,
      m,
      res,
      viewRadius,
      slicePlane,
      sliceOffset,
      viewCentre: { x: viewCentre.x, y: viewCentre.y, z: viewCentre.z },
    });
  }

  _onWorkerMessage(data) {
    if (data.type !== "result") return;
    this._updateCanonicalAnalysis(false);
    this.renderer.renderFromGrid(data.grid, data.peak);
    this._workerBusy = false;
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
}
