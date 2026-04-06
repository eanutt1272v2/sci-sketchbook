class AppCore {
  static ALLOWED_TERRAIN_SIZES = Object.freeze([128, 256, 512]);

  constructor(assets) {
    const { metadata, vertShader, fragShader, colourMaps, font } = assets;

    this.metadata = metadata;
    this._diagnosticsLogger =
      typeof AppDiagnostics !== "undefined" &&
      typeof AppDiagnostics.resolveLogger === "function"
        ? AppDiagnostics.resolveLogger("Fluvia")
        : { info() {}, warn() {}, error() {}, debug() {} };
    this.shaders = {
      vert: vertShader,
      frag: fragShader,
    };
    this.colourMaps = colourMaps || {};
    this.colourMapKeys = Object.keys(this.colourMaps);
    this.font = font;

    if (this.colourMapKeys.length === 0) {
      this.colourMaps = { greyscale: ColourMapLUT.GREYSCALE };
      this.colourMapKeys = ["greyscale"];
    }

    this.params = {
      running: true,
      dropletsPerFrame: 256,
      maxAge: 500,
      minVolume: 0.01,

      terrainSize: 256,
      noiseScale: 0.6,
      noiseOctaves: 8,
      amplitudeFalloff: 0.6,

      sedimentErosionRate: 0.1,
      bedrockErosionRate: 0.1,
      depositionRate: 0.1,
      evaporationRate: 0.001,
      precipitationRate: 1,

      entrainment: 1,
      gravity: 1,
      momentumTransfer: 1,

      learningRate: 0.1,
      maxHeightDiff: 0.01,
      settlingRate: 0.8,

      renderStats: true,
      renderLegend: true,
      renderKeymapRef: false,

      renderMethod: "3D",
      heightScale: 100,
      surfaceMap: "composite",
      colourMap: this.colourMapKeys.includes("viridis")
        ? "viridis"
        : this.colourMapKeys[0],

      cameraSmoothing: 0.82,
      cameraOrbitSensitivity: 0.007,
      cameraZoomSensitivity: 0.5,

      lightDir: { x: 50, y: 50, z: -50 },
      specularIntensity: 100,

      skyColour: { r: 173, g: 183, b: 196 },
      steepColour: { r: 115, g: 115, b: 95 },
      flatColour: { r: 50, g: 81, b: 33 },
      sedimentColour: { r: 201, g: 189, b: 117 },
      waterColour: { r: 92, g: 133, b: 142 },

      imageFormat: "png",
      recordingFPS: 60,
      videoBitrateMbps: 8,
    };

    this.statistics = {
      fps: 0,
      frameCounter: 0,
      simulationTime: 0,

      heightHistogram: new Int32Array(256),
      normHistogram: new Float32Array(256),

      avgElevation: 0,
      elevationStdDev: 0,
      heightBounds: { min: 0, max: 0 },

      totalWater: 0,
      totalSediment: 0,
      totalBedrock: 0,
      sedimentBounds: { min: 0, max: 0 },

      activeWaterCover: 0,
      drainageDensity: 0,
      dischargeBounds: { min: 0, max: 0 },
      hydraulicResidence: 0,

      rugosity: 0,
      slopeComplexity: 0,
      sedimentFlux: 0,
      erosionRate: 0,

      compositeWaterCoveragePct: 0,
      compositeSedimentCoveragePct: 0,
      compositeFlatCoveragePct: 0,
      compositeSteepCoveragePct: 0,
      compositeMeanSlopeWeight: 0,
      compositeMeanSedimentAlpha: 0,
      compositeMeanWaterAlpha: 0,
    };

    this._defaultColourPalette = {
      skyColour: { ...this.params.skyColour },
      steepColour: { ...this.params.steepColour },
      flatColour: { ...this.params.flatColour },
      sedimentColour: { ...this.params.sedimentColour },
      waterColour: { ...this.params.waterColour },
    };

    this.initialiseModules();
    this.terrain.generate();
  }

  _clampNumber(value, min, max, fallback = min) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    if (numeric < min) return min;
    if (numeric > max) return max;
    return numeric;
  }

  _normaliseTerrainSize(value) {
    const allowed = AppCore.ALLOWED_TERRAIN_SIZES;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return this.params.terrainSize;
    }

    let nearest = allowed[0];
    let nearestDistance = Math.abs(allowed[0] - numeric);
    for (let i = 1; i < allowed.length; i++) {
      const distance = Math.abs(allowed[i] - numeric);
      if (distance < nearestDistance) {
        nearest = allowed[i];
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  _sanitiseColour(value, fallback) {
    const source = value && typeof value === "object" ? value : fallback;
    return {
      r: Math.round(this._clampNumber(source.r, 0, 255, fallback.r)),
      g: Math.round(this._clampNumber(source.g, 0, 255, fallback.g)),
      b: Math.round(this._clampNumber(source.b, 0, 255, fallback.b)),
    };
  }

  _sanitiseToggleParams(p) {
    p.running = Boolean(p.running);
    p.renderStats = Boolean(p.renderStats);
    p.renderLegend = Boolean(p.renderLegend);
    p.renderKeymapRef = Boolean(p.renderKeymapRef);
  }

  _sanitiseSimulationParams(p) {
    p.terrainSize = this._normaliseTerrainSize(p.terrainSize);

    p.dropletsPerFrame = Math.round(
      this._clampNumber(p.dropletsPerFrame, 0, 2048, 256),
    );
    p.maxAge = Math.round(this._clampNumber(p.maxAge, 8, 2048, 500));
    p.minVolume = this._clampNumber(p.minVolume, 1e-5, 1, 0.01);

    p.noiseScale = this._clampNumber(p.noiseScale, 0.01, 10, 0.6);
    p.noiseOctaves = Math.round(this._clampNumber(p.noiseOctaves, 1, 12, 8));
    p.amplitudeFalloff = this._clampNumber(p.amplitudeFalloff, 0, 1, 0.6);

    p.sedimentErosionRate = this._clampNumber(p.sedimentErosionRate, 0, 1, 0.1);
    p.bedrockErosionRate = this._clampNumber(p.bedrockErosionRate, 0, 1, 0.1);
    p.depositionRate = this._clampNumber(p.depositionRate, 0, 1, 0.1);
    p.evaporationRate = this._clampNumber(p.evaporationRate, 0.0001, 1, 0.001);
    p.precipitationRate = this._clampNumber(p.precipitationRate, 0, 10, 1);

    p.entrainment = this._clampNumber(p.entrainment, 0, 20, 1);
    p.gravity = this._clampNumber(p.gravity, 0, 10, 1);
    p.momentumTransfer = this._clampNumber(p.momentumTransfer, 0, 10, 1);

    p.learningRate = this._clampNumber(p.learningRate, 0, 1, 0.1);
    p.maxHeightDiff = this._clampNumber(p.maxHeightDiff, 0.0001, 2, 0.01);
    p.settlingRate = this._clampNumber(p.settlingRate, 0, 1, 0.8);
  }

  _sanitiseRenderParams(p) {
    p.renderMethod = p.renderMethod === "2D" ? "2D" : "3D";
    if (
      ![
        "composite",
        "height",
        "slope",
        "discharge",
        "sediment",
        "delta",
      ].includes(p.surfaceMap)
    ) {
      p.surfaceMap = "composite";
    }
    if (!this.colourMapKeys.includes(p.colourMap)) {
      p.colourMap = this.colourMapKeys[0];
    }
  }

  _sanitiseCameraParams(p) {
    p.cameraSmoothing = this._clampNumber(p.cameraSmoothing, 0, 0.98, 0.82);
    p.cameraOrbitSensitivity = this._clampNumber(
      p.cameraOrbitSensitivity,
      0.001,
      0.03,
      0.007,
    );
    p.cameraZoomSensitivity = this._clampNumber(
      p.cameraZoomSensitivity,
      0.05,
      3,
      0.5,
    );
  }

  _sanitiseLightingParams(p) {
    p.heightScale = this._clampNumber(p.heightScale, 1, 1024, 100);
    p.lightDir = {
      x: this._clampNumber(p.lightDir?.x, -1000, 1000, 50),
      y: this._clampNumber(p.lightDir?.y, -1000, 1000, 50),
      z: this._clampNumber(p.lightDir?.z, -1000, 1000, -50),
    };
    p.specularIntensity = this._clampNumber(p.specularIntensity, 0, 4096, 100);
  }

  _sanitiseColourParams(p) {
    p.skyColour = this._sanitiseColour(
      p.skyColour,
      this._defaultColourPalette.skyColour,
    );
    p.steepColour = this._sanitiseColour(
      p.steepColour,
      this._defaultColourPalette.steepColour,
    );
    p.flatColour = this._sanitiseColour(
      p.flatColour,
      this._defaultColourPalette.flatColour,
    );
    p.sedimentColour = this._sanitiseColour(
      p.sedimentColour,
      this._defaultColourPalette.sedimentColour,
    );
    p.waterColour = this._sanitiseColour(
      p.waterColour,
      this._defaultColourPalette.waterColour,
    );
  }

  _sanitiseExportParams(p) {
    const format = String(p.imageFormat || "png").toLowerCase();
    p.imageFormat = ["png", "jpg", "jpeg", "webp"].includes(format)
      ? format
      : "png";
    p.recordingFPS = Math.round(this._clampNumber(p.recordingFPS, 12, 120, 60));
    p.videoBitrateMbps = this._clampNumber(p.videoBitrateMbps, 1, 64, 8);
  }

  _sanitiseParams() {
    const p = this.params;

    this._sanitiseToggleParams(p);
    this._sanitiseSimulationParams(p);
    this._sanitiseRenderParams(p);
    this._sanitiseCameraParams(p);
    this._sanitiseLightingParams(p);
    this._sanitiseColourParams(p);
    this._sanitiseExportParams(p);
  }

  _isValidFloatBuffer(buffer, expectedLength) {
    return (
      buffer instanceof ArrayBuffer &&
      buffer.byteLength === expectedLength * Float32Array.BYTES_PER_ELEMENT
    );
  }

  _restoreTerrainBuffers() {
    this._reallocTerrainBuffers();
    this._workerBusy = false;
  }

  initialiseModules() {
    this.terrain = new Terrain(this);
    this.camera = new Camera(this);
    this.renderer = new Renderer(this);
    this.analyser = new Analyser(this);
    this.media = new Media(this);
    this.gui = new GUI(this);
    this.input = new InputHandler(this);

    this._worker = null;
    this._workerBusy = false;
    this._workerRequestId = 0;
    this._workerStepIntervalMs = 28;
    this._lastWorkerStepMs = 0;
    this._pendingActions = [];
    this._lastVisualSignature = this._computeVisualSignature();
    this._lastVisualSignatureCheckMs = 0;
    this._initWorker();
  }

  _computeWorkerStepIntervalMs() {
    const size = Number(this.params.terrainSize) || 256;
    let base = 20;
    if (size >= 512) base = 40;
    else if (size >= 384) base = 34;
    else if (size >= 256) base = 28;

    if (this.params.renderMethod === "3D") {
      base += 6;
    }

    return base;
  }

  _computeVisualSignature() {
    const p = this.params;
    return JSON.stringify({
      renderMethod: p.renderMethod,
      surfaceMap: p.surfaceMap,
      colourMap: p.colourMap,
      heightScale: p.heightScale,
      lightDir: p.lightDir,
      specularIntensity: p.specularIntensity,
      skyColour: p.skyColour,
      steepColour: p.steepColour,
      flatColour: p.flatColour,
      sedimentColour: p.sedimentColour,
      waterColour: p.waterColour,
    });
  }

  update() {
    this._sanitiseParams();

    const { camera, params } = this;

    this.input.handleContinuousInput();

    const nowMs = performance.now();
    if (nowMs - this._lastVisualSignatureCheckMs >= 120) {
      const visualSignature = this._computeVisualSignature();
      if (visualSignature !== this._lastVisualSignature) {
        this.renderer.textureDirty = true;
        this._lastVisualSignature = visualSignature;
      }
      this._lastVisualSignatureCheckMs = nowMs;
    }

    if (params.running) {
      this.analyser.update();
    }

    camera.update();
  }

  _postWorkerMessage(msg, transfers = [], context = "worker request") {
    if (!this._worker) return false;

    if (
      typeof AppDiagnostics !== "undefined" &&
      typeof AppDiagnostics.safePostMessage === "function"
    ) {
      return AppDiagnostics.safePostMessage(
        this._worker,
        msg,
        transfers,
        this._diagnosticsLogger,
        context,
      );
    }

    try {
      this._worker.postMessage(msg, transfers);
      return true;
    } catch (error) {
      this._diagnosticsLogger.error(`Failed ${context}`, error);
      return false;
    }
  }

  _handleWorkerFailure(reason, detail = null) {
    this._diagnosticsLogger.error(`Worker ${reason}`, detail);

    this._restoreTerrainBuffers();
    this._lastWorkerStepMs = 0;
  }

  _initWorker() {
    try {
      this._worker = new Worker("./modules/worker/FluviaWorker.js");
    } catch (e) {
      throw new Error("[Fluvia] Worker is required but could not be created.");
    }

    this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
    this._worker.onerror = (e) => {
      this._handleWorkerFailure("runtime error", e);
    };
    this._worker.onmessageerror = (e) => {
      this._handleWorkerFailure("message deserialisation error", e);
    };
  }

  _dispatchWorkerStep(nowMs = performance.now()) {
    if (!this._worker || this._workerBusy) {
      return;
    }

    this._sanitiseParams();

    const { terrain, params } = this;

    if (!terrain.heightMap) return;

    const requestId = ++this._workerRequestId;

    const msg = {
      type: "step",
      requestId,
      size: terrain.size,
      randomSeed: (nowMs * 1000) | 0,
      params: {
        dropletsPerFrame: params.dropletsPerFrame,
        maxAge: params.maxAge,
        minVolume: params.minVolume,
        precipitationRate: params.precipitationRate,
        gravity: params.gravity,
        momentumTransfer: params.momentumTransfer,
        entrainment: params.entrainment,
        depositionRate: params.depositionRate,
        evaporationRate: params.evaporationRate,
        sedimentErosionRate: params.sedimentErosionRate,
        bedrockErosionRate: params.bedrockErosionRate,
        maxHeightDiff: params.maxHeightDiff,
        settlingRate: params.settlingRate,
        learningRate: params.learningRate,
        heightScale: params.heightScale,
      },

      heightMap: terrain.heightMap.buffer,
      bedrockMap: terrain.bedrockMap.buffer,
      sedimentMap: terrain.sedimentMap.buffer,
      dischargeMap: terrain.dischargeMap.buffer,
      dischargeTrack: terrain.dischargeTrack.buffer,
      momentumX: terrain.momentumX.buffer,
      momentumY: terrain.momentumY.buffer,
      momentumXTrack: terrain.momentumXTrack.buffer,
      momentumYTrack: terrain.momentumYTrack.buffer,
    };

    const transfers = [
      msg.heightMap,
      msg.bedrockMap,
      msg.sedimentMap,
      msg.dischargeMap,
      msg.dischargeTrack,
      msg.momentumX,
      msg.momentumY,
      msg.momentumXTrack,
      msg.momentumYTrack,
    ];

    const posted = this._postWorkerMessage(msg, transfers, "step dispatch");
    if (!posted) {
      this._workerBusy = false;
      this._lastWorkerStepMs = 0;
      return;
    }

    this._workerBusy = true;
    this._lastWorkerStepMs = nowMs;

    terrain.heightMap = null;
    terrain.bedrockMap = null;
    terrain.sedimentMap = null;
    terrain.dischargeMap = null;
    terrain.dischargeTrack = null;
    terrain.momentumX = null;
    terrain.momentumY = null;
    terrain.momentumXTrack = null;
    terrain.momentumYTrack = null;
  }

  _onWorkerMessage(data) {
    if (data && typeof data === "object" && data.type === "workerError") {
      const stage =
        typeof data.stage === "string" && data.stage
          ? data.stage
          : "unknown stage";
      const message =
        typeof data.message === "string" && data.message
          ? data.message
          : "unknown worker failure";
      this._handleWorkerFailure(
        `reported failure during ${stage}: ${message}`,
        data,
      );
      return;
    }

    if (!data || typeof data !== "object") {
      this._workerBusy = false;
      return;
    }

    if (data.type !== "result") {
      this._workerBusy = false;
      return;
    }
    if (Number(data.requestId) !== this._workerRequestId) {
      return;
    }

    const { terrain } = this;
    const expectedLength = terrain.area;
    const requiredBuffers = [
      "heightMap",
      "bedrockMap",
      "sedimentMap",
      "dischargeMap",
      "dischargeTrack",
      "momentumX",
      "momentumY",
      "momentumXTrack",
      "momentumYTrack",
    ];

    for (const key of requiredBuffers) {
      if (!this._isValidFloatBuffer(data[key], expectedLength)) {
        this._diagnosticsLogger.error(`Invalid worker payload for ${key}`);
        this._restoreTerrainBuffers();
        return;
      }
    }

    terrain.heightMap = new Float32Array(data.heightMap);
    terrain.bedrockMap = new Float32Array(data.bedrockMap);
    terrain.sedimentMap = new Float32Array(data.sedimentMap);
    terrain.dischargeMap = new Float32Array(data.dischargeMap);
    terrain.dischargeTrack = new Float32Array(data.dischargeTrack);
    terrain.momentumX = new Float32Array(data.momentumX);
    terrain.momentumY = new Float32Array(data.momentumY);
    terrain.momentumXTrack = new Float32Array(data.momentumXTrack);
    terrain.momentumYTrack = new Float32Array(data.momentumYTrack);

    this.analyser.applyWorkerAnalysis(data.analysis || {});

    this._workerBusy = false;
  }

  render() {
    this.renderer.render();

    if (this._pendingActions.length > 0) {
      this._runNextAction();
      return;
    }

    this._workerStepIntervalMs = this._computeWorkerStepIntervalMs();
    const nowMs = performance.now();

    if (
      this.params.running &&
      this._worker &&
      this.terrain.heightMap &&
      nowMs - this._lastWorkerStepMs >= this._workerStepIntervalMs
    ) {
      this._dispatchWorkerStep(nowMs);
    }
  }

  generate() {
    this._queueAction("generate", () => this._generateNow());
  }

  _generateNow() {
    const { terrain, params } = this;

    this._terminateWorker();
    if (terrain.size !== params.terrainSize) {
      this._reinitialiseNow();
      return;
    }
    this._reallocTerrainBuffers();
    terrain.generate();
    this.analyser.reinitialise();
    this._initWorker();
  }

  reset() {
    this._queueAction("reset", () => this._resetNow());
  }

  _resetNow() {
    this._terminateWorker();
    this._reallocTerrainBuffers();
    this.terrain.reset();
    this.analyser.reinitialise();
    this._initWorker();
  }

  reinitialise() {
    this._queueAction("reinitialise", () => this._reinitialiseNow());
  }

  _reinitialiseNow() {
    this._terminateWorker();
    this.terrain = new Terrain(this);
    this.renderer.reinitialise();
    this.terrain.generate();
    this.analyser.reinitialise();
    this._initWorker();
  }

  _terminateWorker() {
    if (this._worker) {
      this._worker.onmessage = null;
      this._worker.onerror = null;
      this._worker.onmessageerror = null;
      this._worker.terminate();
      this._worker = null;
    }
    this._workerBusy = false;
    this._lastWorkerStepMs = 0;
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

  _reallocTerrainBuffers() {
    const { terrain } = this;
    const { area } = terrain;
    for (const key of terrain._float32Keys) {
      if (!terrain[key]) terrain[key] = new Float32Array(area);
    }
  }

  handleWheel(event) {
    return this.input.handleWheel(event);
  }

  handlePointer(event) {
    return this.input.handlePointer(event);
  }

  handlePointerStart(event) {
    return this.input.handlePointerStart(event);
  }

  handlePointerEnd(event) {
    return this.input.handlePointerEnd(event);
  }

  resize() {
    const canvasSize = min(windowWidth, windowHeight);
    if (width !== canvasSize || height !== canvasSize) {
      resizeCanvas(canvasSize, canvasSize);
    }
    this.renderer.resize();
  }

  handleKeyPressed(k, kCode, event = null) {
    return KeyboardUtils.safeHandle("Fluvia", "press", () =>
      this.input.handleKeyPressed(k, kCode, event),
    );
  }

  handleKeyReleased(k, kCode, event = null) {
    return KeyboardUtils.safeHandle("Fluvia", "release", () =>
      this.input.handleKeyReleased(k, kCode, event),
    );
  }

  cycleColourMap(step) {
    const keys = this.colourMapKeys;
    if (keys.length === 0) return;
    const current = keys.indexOf(this.params.colourMap);
    const start = current >= 0 ? current : 0;
    const next = (start + step + keys.length) % keys.length;
    this.params.colourMap = keys[next];
  }

  cycleSurfaceMap(step) {
    const maps = [
      "composite",
      "height",
      "slope",
      "discharge",
      "sediment",
      "delta",
    ];
    const current = maps.indexOf(this.params.surfaceMap);
    const start = current >= 0 ? current : 0;
    const next = (start + step + maps.length) % maps.length;
    this.params.surfaceMap = maps[next];
  }

  refreshGUI() {
    if (this.gui && typeof this.gui.syncMediaControls === "function") {
      this.gui.syncMediaControls();
    }

    if (
      this.gui &&
      this.gui.pane &&
      typeof this.gui.pane.refresh === "function"
    ) {
      this.gui.pane.refresh();
    }
  }

  dispose() {
    this._terminateWorker();
    this._pendingActions = [];

    if (this.media && typeof this.media.dispose === "function") {
      this.media.dispose();
    }

    if (this.renderer && typeof this.renderer.dispose === "function") {
      this.renderer.dispose();
    }

    if (this.gui && typeof this.gui.dispose === "function") {
      this.gui.dispose();
    }
  }
}
