class AppCore {
  constructor(assets) {
    const { metadata, vertShader, fragShader, colourMaps, font } = assets;

    this.metadata = metadata;
    this.shaders = {
      vert: vertShader,
      frag: fragShader,
    };
    this.colourMaps = colourMaps || {};
    this.colourMapKeys = Object.keys(this.colourMaps);
    this.font = font;

    if (this.colourMapKeys.length === 0) {
      this.colourMaps = {
        greyscale: {
          r: [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
          g: [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
          b: [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        },
      };
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

    this.initialiseModules();
    this.terrain.generate();
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
    const { camera, params } = this;

    this.input.handleContinuousInput();

    const visualSignature = this._computeVisualSignature();
    if (visualSignature !== this._lastVisualSignature) {
      this.renderer.textureDirty = true;
      this._lastVisualSignature = visualSignature;
    }

    if (params.running) {
      this.analyser.update();
    }

    camera.update();
  }

  _initWorker() {
    try {
      this._worker = new Worker("FluviaWorker.js");
    } catch (e) {
      throw new Error("[Fluvia] Worker is required but could not be created.");
    }

    this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
    this._worker.onerror = (e) => {
      console.error("[Fluvia] Worker error:", e);
      this._workerBusy = false;
      this._lastWorkerStepMs = 0;
    };
  }

  _dispatchWorkerStep(nowMs = performance.now()) {
    if (!this._worker || this._workerBusy) {
      return;
    }

    const { terrain, params } = this;

    if (!terrain.heightMap) return;

    this._workerBusy = true;
    this._lastWorkerStepMs = nowMs;

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

    this._worker.postMessage(msg, [
      msg.heightMap,
      msg.bedrockMap,
      msg.sedimentMap,
      msg.dischargeMap,
      msg.dischargeTrack,
      msg.momentumX,
      msg.momentumY,
      msg.momentumXTrack,
      msg.momentumYTrack,
    ]);

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
    if (data.type !== "result") return;
    if (data.requestId !== this._workerRequestId) {
      return;
    }

    const { terrain } = this;
    terrain.heightMap = new Float32Array(data.heightMap);
    terrain.bedrockMap = new Float32Array(data.bedrockMap);
    terrain.sedimentMap = new Float32Array(data.sedimentMap);
    terrain.dischargeMap = new Float32Array(data.dischargeMap);
    terrain.dischargeTrack = new Float32Array(data.dischargeTrack);
    terrain.momentumX = new Float32Array(data.momentumX);
    terrain.momentumY = new Float32Array(data.momentumY);
    terrain.momentumXTrack = new Float32Array(data.momentumXTrack);
    terrain.momentumYTrack = new Float32Array(data.momentumYTrack);

    this.analyser.applyWorkerAnalysis(data.analysis);

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

  resize() {
    const canvasSize = min(windowWidth, windowHeight);
    if (width !== canvasSize || height !== canvasSize) {
      resizeCanvas(canvasSize, canvasSize);
    }
    this.renderer.resize();
  }

  handleKeyPressed(k, kCode) {
    return this._safeHandleKeyboard("press", () =>
      this.input.handleKeyPressed(k, kCode),
    );
  }

  handleKeyReleased(k, kCode) {
    return this._safeHandleKeyboard("release", () =>
      this.input.handleKeyReleased(k, kCode),
    );
  }

  _safeHandleKeyboard(action, handler) {
    try {
      return handler();
    } catch (error) {
      console.error(`[Fluvia] Keyboard ${action} handling failed:`, error);
      return false;
    }
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
  }
}
