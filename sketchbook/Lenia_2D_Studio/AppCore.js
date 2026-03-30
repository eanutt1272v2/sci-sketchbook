class AppCore {
  constructor(assets) {
    const { metadata, animalsData, animalsByDimension = null, colourMaps, font } = assets;

    this.metadata = metadata;
    this.animalsByDimension =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.buildAnimalsByDimension(animalsData, animalsByDimension)
        : { 2: Array.isArray(animalsData) ? animalsData : [] };
    this.font = font;
    this.colourMaps = colourMaps || {};
    this.colourMapKeys = Object.keys(this.colourMaps);

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
      gridSize: 128,

      dimension: 2,
      animalSource: "auto",
      viewMode: "projection",
      ndDepth: 6,
      ndSliceZ: 0,
      ndSliceW: 0,

      R: 13,
      T: 10,
      m: 0.15,
      s: 0.015,
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
      renderCalcPanels: true,
      renderAnimalName: true,
      renderKeymapRef: false,

      selectedAnimal: "",
      placeMode: true,
      placeScale: 1,
      autoScaleSimParams: false,
      autoCenter: false,

      imageFormat: "png",
      recordingFPS: 60,
      videoBitrateMbps: 8,
    };

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

    this._worker = null;
    this._workerBusy = false;
    this._stepPending = false;
    this._kernelPending = false;
    this._viewPending = false;
    this._pendingActions = [];
    this._pendingPlacement = null;
    this._pendingMutations = [];
    this._lastPlacement = { cellX: null, cellY: null, atMs: 0 };
    this._skipNextAnimalParamsLoad = false;
    this._lastAnimalParamsSelection = null;
    this._changeRecycleBuffer = null;
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
    };

    this._workerSendKernel();
  }

  _workerSendKernel() {
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

  _onWorkerMessage(data) {
    if (data.type === "kernelReady") {
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

      if ((Number(this.params.dimension) || 2) > 2 && this.board.world && !this._stepPending) {
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
      const b = this.board;
      b.world = new Float32Array(data.world);
      b.potential = new Float32Array(data.potential);
      b.growth = new Float32Array(data.growth);
      b.growthOld = data.growthOld ? new Float32Array(data.growthOld) : null;

      if (data.analysis) {
        this.analyser.applyWorkerStatistics(data.analysis, this.automaton);
      }

      this._workerBusy = false;
      this._flushPendingMutations();
      if (this._kernelPending) {
        this._workerSendKernel();
      }
      return;
    }

    if (data.type === "result") {
      const b = this.board;

      b.world = new Float32Array(data.world);
      b.potential = new Float32Array(data.potential);
      b.growth = new Float32Array(data.growth);
      b.growthOld = data.growthOld ? new Float32Array(data.growthOld) : null;

      this.automaton.change = new Float32Array(data.change);
      this._changeRecycleBuffer = data.change;
      this.automaton.gen++;
      this.automaton.time =
        Math.round((this.automaton.time + 1 / this.params.T) * 10000) / 10000;

      this._workerBusy = false;
      this.analyser.countStep();

      if (this._pendingPlacement) {
        const pp = this._pendingPlacement;
        this._pendingPlacement = null;
        if ((this.params.dimension || 2) > 2) {
          this._placeAnimalND(pp.animal, pp.cellX, pp.cellY, pp.scale);
        } else {
          this._applyPlacement(pp);
        }
      }

      this._flushPendingMutations();

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

    // Copy buffers to worker instead of transferring - keeps board data
    // available for rendering while worker computes next step.
    // At 128x128+, copy cost (~0.1ms) is negligible vs. the pipeline gain.
    const worldCopy = new Float32Array(b.world);
    const potentialCopy = new Float32Array(b.potential);
    const growthCopy = new Float32Array(b.growth);

    const transfers = [worldCopy.buffer, potentialCopy.buffer, growthCopy.buffer];
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

    // Board retains its buffers for rendering

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
    this.input.handleContinuousInput();

    if (this.board.world) {
      this.renderer.render(
        this.board,
        this.automaton,
        this.params.renderMode,
        this.params.colourMap,
        this.params,
      );

      if (this.params.renderGrid || this.params.renderMode === "kernel") {
        this.renderer.renderGrid(this.params.R, this.params);
      }

      if (
        this.params.renderMotionOverlay &&
        this.params.renderMode !== "kernel"
      ) {
        this.renderer.renderMotionOverlay(this.statistics, this.params);
      }

      if (this.params.renderScale) {
        this.renderer.renderScale(this.params.R, this.params);
      }

      if (this.params.renderLegend) {
        this.renderer.renderLegend();
      }

      if (this.params.renderStats) {
        this.renderer.renderStats(this.statistics, this.params);
      }

      if (this.params.renderAnimalName) {
        const animal = this.getSelectedAnimal();
        if (animal?.name) this.renderer.renderAnimalName(animal);
      }

      if (this.params.renderCalcPanels) {
        this.renderer.renderCalcPanels(this.board, this.automaton, this.params);
      }
    } else {
      this.renderer.renderCachedFrame();

      if (this.params.renderGrid || this.params.renderMode === "kernel") {
        this.renderer.renderGrid(this.params.R, this.params);
      }

      if (
        this.params.renderMotionOverlay &&
        this.params.renderMode !== "kernel"
      ) {
        this.renderer.renderMotionOverlay(this.statistics, this.params);
      }

      if (this.params.renderScale) {
        this.renderer.renderScale(this.params.R, this.params);
      }

      if (this.params.renderLegend) {
        this.renderer.renderLegend();
      }

      if (this.params.renderStats) {
        this.renderer.renderStats(this.statistics, this.params);
      }

      if (this.params.renderAnimalName) {
        const animal = this.getSelectedAnimal();
        if (animal?.name) this.renderer.renderAnimalName(animal);
      }

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
            this.params.R, seed, isFill,
          );
          this._lastRandomSeed = usedSeed;
        }
        this.analyser.resetStatistics();
        this.analyser.reset();
        this.automaton.reset();
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
    const targetR = Math.round(constrain(Number(newR) || this.params.R, 2, 50));
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
    this._queueAction("changeResolution", () =>
      this._queueOrRunMutation(() => {
        this._restartWorker();

        const canvasSize = min(windowWidth, windowHeight);
        resizeCanvas(canvasSize, canvasSize);
        this.board.resize(this.params.gridSize);
        this.renderer.resize(this.params.gridSize);

        this._pendingPlacement = null;
        this.analyser.reset();
        this.analyser.resetStatistics();

        this._workerSendKernel();
      }),
    );
  }

  _normaliseGridSize(size) {
    if (typeof NDCompatibility !== "undefined") {
      return NDCompatibility.coerceGridSize(size, this.params.dimension);
    }

    const fallback = [64, 128, 256, 512];
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

  _resolveAnimalSourceDimension() {
    return this.params.dimension;
  }

  _applyAnimalSource() {
    if (!this.animalLibrary || !this.animalLibrary.setActiveDimension) return;
    this.animalLibrary.setActiveDimension(this._resolveAnimalSourceDimension());
  }

  _findAnimalIndexByCode(code) {
    if (!code) return null;
    const animals = Array.isArray(this.animalLibrary?.animals)
      ? this.animalLibrary.animals
      : [];
    if (!animals.length) return null;
    const idx = animals.findIndex((animal) => String(animal?.code || "") === code);
    return idx >= 0 ? idx : null;
  }

  _applyImportedParamsSnapshot(rawParams, { allowGridSize = true } = {}) {
    if (!rawParams || typeof rawParams !== "object") {
      return { gridSizeChanged: false, dimensionChanged: false };
    }

    const p = this.params;
    const beforeGridSize = p.gridSize;
    const beforeDimension = p.dimension;
    const toNumber = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const toBoolean = (value, fallback) => {
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      return fallback;
    };

    if ("running" in rawParams)
      p.running = toBoolean(rawParams.running, p.running);

    if ("dimension" in rawParams) {
      const incomingDimension =
        typeof NDCompatibility !== "undefined"
          ? NDCompatibility.coerceDimension(rawParams.dimension)
          : 2;
      p.dimension = incomingDimension;
      if (this.animalLibrary && this.animalLibrary.setActiveDimension) {
        this.animalLibrary.setActiveDimension(incomingDimension);
      }
    }

    if ("viewMode" in rawParams) {
      p.viewMode =
        typeof NDCompatibility !== "undefined"
          ? NDCompatibility.coerceViewMode(p.dimension, rawParams.viewMode)
          : "slice";
    }

    if ("ndDepth" in rawParams) {
      p.ndDepth =
        typeof NDCompatibility !== "undefined"
          ? NDCompatibility.coerceDepth(rawParams.ndDepth, p.dimension)
          : Math.max(2, Math.min(512, Math.floor(Number(rawParams.ndDepth) || 6)));
    }

    if ("ndSliceZ" in rawParams) {
      p.ndSliceZ =
        typeof NDCompatibility !== "undefined"
          ? NDCompatibility.coerceSliceIndex(rawParams.ndSliceZ, p.ndDepth)
          : Math.max(0, Math.min(p.ndDepth - 1, Math.floor(Number(rawParams.ndSliceZ) || 0)));
    }

    if ("ndSliceW" in rawParams) {
      p.ndSliceW =
        typeof NDCompatibility !== "undefined"
          ? NDCompatibility.coerceSliceIndex(rawParams.ndSliceW, p.ndDepth)
          : Math.max(0, Math.min(p.ndDepth - 1, Math.floor(Number(rawParams.ndSliceW) || 0)));
    }

    if (allowGridSize && "gridSize" in rawParams) {
      p.gridSize = this._normaliseGridSize(rawParams.gridSize);
    }

    if (
      typeof NDCompatibility !== "undefined" &&
      !(allowGridSize && "gridSize" in rawParams)
    ) {
      p.gridSize = NDCompatibility.coerceGridSize(p.gridSize, p.dimension);
    }

    if ("R" in rawParams)
      p.R = Math.round(constrain(toNumber(rawParams.R, p.R), 2, 50));
    if ("T" in rawParams)
      p.T = Math.round(constrain(toNumber(rawParams.T, p.T), 1, 50));
    if ("m" in rawParams) p.m = constrain(toNumber(rawParams.m, p.m), 0, 0.5);
    if ("s" in rawParams)
      p.s = constrain(toNumber(rawParams.s, p.s), 0.001, 0.1);
    if ("kn" in rawParams)
      p.kn = Math.round(constrain(toNumber(rawParams.kn, p.kn), 1, 4));
    if ("gn" in rawParams)
      p.gn = Math.round(constrain(toNumber(rawParams.gn, p.gn), 1, 3));
    if ("addNoise" in rawParams) {
      p.addNoise = constrain(toNumber(rawParams.addNoise, p.addNoise), 0, 10);
    }
    if ("maskRate" in rawParams) {
      p.maskRate = constrain(toNumber(rawParams.maskRate, p.maskRate), 0, 10);
    }
    if ("paramP" in rawParams) {
      p.paramP = Math.round(
        constrain(toNumber(rawParams.paramP, p.paramP), 0, 64),
      );
    }
    if ("softClip" in rawParams)
      p.softClip = toBoolean(rawParams.softClip, p.softClip);
    if ("multiStep" in rawParams)
      p.multiStep = toBoolean(rawParams.multiStep, p.multiStep);

    if ("b" in rawParams) {
      const b = rawParams.b;
      if (typeof b === "string") {
        p.b = b
          .split(",")
          .map((v) => RLECodec.parseFraction(v))
          .filter((v) => Number.isFinite(v));
      } else if (Array.isArray(b)) {
        p.b = b.map((v) => Number(v)).filter((v) => Number.isFinite(v));
      }
      if (!Array.isArray(p.b) || p.b.length === 0) p.b = [1];
    }

    if (
      "colourMap" in rawParams &&
      this.colourMapKeys.includes(rawParams.colourMap)
    ) {
      p.colourMap = rawParams.colourMap;
    }

    if ("renderMode" in rawParams) {
      const mode = String(rawParams.renderMode || "");
      if (["world", "potential", "growth", "kernel"].includes(mode)) {
        p.renderMode = mode;
      }
    }

    if ("renderGrid" in rawParams)
      p.renderGrid = toBoolean(rawParams.renderGrid, p.renderGrid);
    if ("renderScale" in rawParams)
      p.renderScale = toBoolean(rawParams.renderScale, p.renderScale);
    if ("renderLegend" in rawParams)
      p.renderLegend = toBoolean(rawParams.renderLegend, p.renderLegend);
    if ("renderStats" in rawParams)
      p.renderStats = toBoolean(rawParams.renderStats, p.renderStats);
    if ("renderMotionOverlay" in rawParams) {
      p.renderMotionOverlay = toBoolean(
        rawParams.renderMotionOverlay,
        p.renderMotionOverlay,
      );
    }
    if ("renderCalcPanels" in rawParams) {
      p.renderCalcPanels = toBoolean(
        rawParams.renderCalcPanels,
        p.renderCalcPanels,
      );
    }
    if ("renderKeymapRef" in rawParams) {
      p.renderKeymapRef = toBoolean(
        rawParams.renderKeymapRef,
        p.renderKeymapRef,
      );
    }
    if ("selectedAnimal" in rawParams) {
      const incoming = rawParams.selectedAnimal;
      if (
        incoming === "" ||
        incoming === null ||
        typeof incoming === "undefined"
      ) {
        p.selectedAnimal = "";
      } else {
        const idx = parseInt(String(incoming), 10);
        if (
          Number.isFinite(idx) &&
          this.animalLibrary &&
          idx >= 0 &&
          idx < this.animalLibrary.animals.length
        ) {
          p.selectedAnimal = String(idx);
        }
      }
    }

    p.animalSource = "auto";

    if ("placeMode" in rawParams)
      p.placeMode = toBoolean(rawParams.placeMode, p.placeMode);
    if ("placeScale" in rawParams) {
      p.placeScale = constrain(
        toNumber(rawParams.placeScale, p.placeScale),
        0.25,
        4,
      );
    }
    if ("autoScaleSimParams" in rawParams) {
      p.autoScaleSimParams = toBoolean(
        rawParams.autoScaleSimParams,
        p.autoScaleSimParams,
      );
    }

    if ("imageFormat" in rawParams) {
      const fmt = String(rawParams.imageFormat || "").toLowerCase();
      if (["png", "jpg", "jpeg", "webm", "mp4"].includes(fmt)) {
        p.imageFormat = fmt;
      }
    }
    if ("recordingFPS" in rawParams) {
      p.recordingFPS = Math.round(
        constrain(toNumber(rawParams.recordingFPS, p.recordingFPS), 12, 120),
      );
    }
    if ("videoBitrateMbps" in rawParams) {
      p.videoBitrateMbps = constrain(
        toNumber(rawParams.videoBitrateMbps, p.videoBitrateMbps),
        1,
        64,
      );
    }

    this._skipNextAnimalParamsLoad = true;
    this._lastAnimalParamsSelection = p.selectedAnimal || "";

    this._syncSelectedAnimalForActiveDimension(p.selectedAnimal);

    return {
      gridSizeChanged: p.gridSize !== beforeGridSize,
      dimensionChanged: p.dimension !== beforeDimension,
    };
  }

  importWorldPayload(payload) {
    if (!payload || !payload.world) return;

    this._queueAction("importWorld", () =>
      this._queueOrRunMutation(() => {
        const applied = this._applyImportedParamsSnapshot(payload.params, {
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
          this._pendingPlacement = null;
        }

        this._ensureBuffers();

        const src = payload.world;
        this.board.world.fill(0);
        if (src instanceof Float32Array) {
          this.board.world.set(src.subarray(0, this.board.world.length));
        } else if (Array.isArray(src)) {
          const n = Math.min(src.length, this.board.world.length);
          for (let i = 0; i < n; i++) {
            const v = Number(src[i]);
            this.board.world[i] = Number.isFinite(v) ? constrain(v, 0, 1) : 0;
          }
        }

        this.board.potential.fill(0);
        if (payload.potential instanceof Float32Array) {
          this.board.potential.set(
            payload.potential.subarray(0, this.board.potential.length),
          );
        }

        this.board.growth.fill(0);
        const importedGrowth = payload.growth;
        if (importedGrowth instanceof Float32Array) {
          this.board.growth.set(
            importedGrowth.subarray(0, this.board.growth.length),
          );
        }

        if (this.board.growthOld) {
          const importedGrowthOld = payload.growthOld;
          if (importedGrowthOld instanceof Float32Array) {
            this.board.growthOld.set(
              importedGrowthOld.subarray(0, this.board.growthOld.length),
            );
          } else {
            this.board.growthOld.fill(0);
          }
        }

        this.automaton.reset();
        this.automaton.updateParameters(this.params);

        this.analyser.resetStatistics();
        this.analyser.reset();
        if (payload.statistics && typeof payload.statistics === "object") {
          Object.assign(this.statistics, payload.statistics);
        }
        if (Array.isArray(payload.series)) {
          this.analyser.series = JSON.parse(JSON.stringify(payload.series));
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

        console.log(
          `[Lenia] Imported world: size=${this.params.gridSize}${sizeChanged ? " (resized)" : ""}, params=${payload.params ? "restored" : "unchanged"}, stats=${payload.statistics ? "restored" : "reset"}, potential=${payload.potential ? "restored" : "zeroed"}, growth=${payload.growth ? "restored" : "zeroed"}, growthOld=${payload.growthOld ? "restored" : "zeroed"}, selectedAnimal=${this.params.selectedAnimal || "none"}, placeScale=${this.params.placeScale || 1}`,
        );
      }),
    );
  }

  _packNDSeed(animal) {
    if (!animal || !animal.cells) return null;
    const cellsStr = Array.isArray(animal.cells) ? animal.cells[0] : animal.cells;
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
        : Math.max(2, Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)));
    const extraDims = Math.max(0, dimension - 2);
    const planeCount = Math.pow(depth, extraDims);
    const cellCount = size * size;
    const planeCellCount = cellCount;
    const total = planeCellCount * planeCount;
    const packed = new Float32Array(total);

    let maxZ = 0, maxW = 0;
    for (const s of slices) {
      if (s.z > maxZ) maxZ = s.z;
      if (s.w > maxW) maxW = s.w;
    }
    const animalDepthZ = maxZ + 1;
    const animalDepthW = maxW + 1;

    const offsetZ = Math.floor((depth - animalDepthZ) / 2);
    const offsetW = extraDims >= 2 ? Math.floor((depth - animalDepthW) / 2) : 0;

    let maxH = 0, maxW_ = 0;
    for (const s of slices) {
      const h = s.grid.length;
      const w = s.grid[0]?.length || 0;
      if (h > maxH) maxH = h;
      if (w > maxW_) maxW_ = w;
    }

    for (const slice of slices) {
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
      const h = grid.length;
      const w = grid[0]?.length || 0;
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
            packed[planeBase + ty * size + tx] = grid[y][x];
          }
        }
      }
    }

    return packed;
  }

  loadAnimal(animal) {
    if (!animal) return;

    this._queueAction("loadAnimal", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        this.analyser.resetStatistics();

        const dim = Number(this.params.dimension) || 2;
        if (dim <= 2) {
          const scale = this.params.placeScale || 1;
          if (Math.abs(scale - 1) < 1e-6) {
            this.board.loadPattern(animal);
          } else {
            this.board.loadPatternScaled(animal, scale);
          }
        } else {
          this.board.clear();
        }

        if (dim > 2) {
          const ndSeed = this._packNDSeed(animal);
          if (ndSeed) {
            this._ndSeedWorld = ndSeed;
          }
        }

        this.animalLibrary.applyAnimalParameters(animal);

        if (this.params.autoScaleSimParams) {
          this.applyScaledAnimalParams(animal, this.params.placeScale || 1);
        }

        this.automaton.updateParameters(this.params);
        this._workerSendKernel();

        this.refreshGUI();
      }),
    );
  }

  loadSelectedAnimal() {
    const animal = this.getSelectedAnimal();
    if (animal) {
      this.loadAnimal(animal);
    }
  }

  loadAnimalParams(animal) {
    if (!animal) return;

    this._queueAction("loadAnimalParams", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        this.analyser.resetStatistics();
        this.board.clear();

        this.animalLibrary.applyAnimalParameters(animal);

        if (this.params.autoScaleSimParams) {
          this.applyScaledAnimalParams(animal, this.params.placeScale || 1);
        }

        this.automaton.updateParameters(this.params);
        this._workerSendKernel();

        this.refreshGUI();
      }),
    );
  }

  applyScaledAnimalParams(animal, scale = 1) {
    if (!animal || !animal.params) return;

    const sourceParams = Array.isArray(animal.params)
      ? animal.params.find((entry) => entry && typeof entry === "object") ||
        animal.params[0] ||
        {}
      : animal.params;

    const baseR = Number(sourceParams.R);
    const baseT = Number(sourceParams.T);
    const s = Number(scale) || 1;

    if (Number.isFinite(baseR)) {
      this.params.R = Math.round(constrain(baseR * s, 2, 50));
    }

    if (Number.isFinite(baseT)) {
      this.params.T = Math.round(constrain(baseT * s, 1, 50));
    }
  }

  updatePlacementScale(scale) {
    const next = constrain(Number(scale) || 1, 0.25, 4);
    this.params.placeScale = next;

    if (!this.params.autoScaleSimParams) return;
    const animal = this.getSelectedAnimal();
    if (!animal) return;

    this.applyScaledAnimalParams(animal, next);
    this.updateAutomatonParams();
    this.refreshGUI();
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

  placeAnimal(cellX, cellY) {
    if (!this.params.placeMode) return;

    const animal = this.getSelectedAnimal();
    if (!animal) return;

    const scale = this.params.placeScale || 1;

    if (!this.board.world || (this._worker && this._workerBusy)) {
      this._pendingPlacement = { animal, cellX, cellY, scale };
      return;
    }

    this._ensureBuffers();

    if ((this.params.dimension || 2) > 2) {
      this._placeAnimalND(animal, cellX, cellY, scale);
    } else {
      this._applyPlacement({ animal, cellX, cellY, scale });
    }
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
    const cellsStr = Array.isArray(animal.cells) ? animal.cells[0] : animal.cells;
    const isND = typeof cellsStr === "string" && (cellsStr.includes("%") || cellsStr.includes("#"));

    const dimension = Number(this.params.dimension) || 2;
    const size = this.params.gridSize;
    const depth =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.getWorldDepthForDimension(size, dimension)
        : Math.max(2, Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)));
    const extraDims = Math.max(0, dimension - 2);

    if (isND) {
      const slices = RLECodec.parseND(cellsStr);
      if (!slices || slices.length === 0) return;

      let maxZ = 0, maxW = 0;
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
          patternWidth: Math.abs((scale || 1) - 1) < 1e-6 ? w : Math.max(1, Math.round(w * scale)),
          patternHeight: Math.abs((scale || 1) - 1) < 1e-6 ? h : Math.max(1, Math.round(h * scale)),
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
      const pw = Math.abs((scale || 1) - 1) < 1e-6 ? w : Math.max(1, Math.round(w * scale));
      const ph = Math.abs((scale || 1) - 1) < 1e-6 ? h : Math.max(1, Math.round(h * scale));

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
        for (let x = 0; x < w; x++)
          data[y * w + x] = grid[y][x] || 0;
      return data;
    }
    const pw = Math.max(1, Math.round(w * scale));
    const ph = Math.max(1, Math.round(h * scale));
    const data = new Float32Array(ph * pw);
    for (let dy = 0; dy < ph; dy++) {
      for (let dx = 0; dx < pw; dx++) {
        const srcXf = dx / scale;
        const srcYf = dy / scale;
        const x0 = Math.floor(srcXf);
        const y0 = Math.floor(srcYf);
        const x1 = Math.min(x0 + 1, w - 1);
        const y1 = Math.min(y0 + 1, h - 1);
        const fx = srcXf - x0;
        const fy = srcYf - y0;
        data[dy * pw + dx] = x0 < w && y0 < h
          ? (grid[y0][x0] || 0) * (1 - fx) * (1 - fy) +
            (grid[y0][x1] || 0) * fx * (1 - fy) +
            (grid[y1][x0] || 0) * (1 - fx) * fy +
            (grid[y1][x1] || 0) * fx * fy
          : 0;
      }
    }
    return data;
  }

  placeAnimalRandom() {
    const animal = this.getSelectedAnimal();
    if (!animal) return;

    const size = this.params.gridSize;
    const cellX = Math.floor(Math.random() * size);
    const cellY = Math.floor(Math.random() * size);
    const scale = this.params.placeScale || 1;

    this._queueAction("placeAnimalRandom", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this._placeAnimalND(animal, cellX, cellY, scale);
        } else {
          this._applyPlacement({ animal, cellX, cellY, scale });
        }
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

  getAnimalSourceOptions() {
    const count2D = (this.animalsByDimension[2] || []).length;
    const count3D = (this.animalsByDimension[3] || []).length;
    const count4D = (this.animalsByDimension[4] || []).length;
    return {
      [`Auto (D${this.params.dimension})`]: "auto",
      [`2D Library (${count2D})`]: "2d",
      [`3D Library (${count3D})`]: "3d",
      [`4D Library (${count4D})`]: "4d",
    };
  }

  setAnimalSource(source) {
    if (this._changingAnimalSource) return;
    const nextSource = String(source || "auto").toLowerCase();
    if (!["auto", "2d", "3d", "4d"].includes(nextSource)) return;

    this._changingAnimalSource = true;
    try {
      const prevAnimal = this.getSelectedAnimal();
      const prevCode = prevAnimal?.code || "";

      this.params.animalSource = nextSource;
      this._applyAnimalSource();

      const matchedIdx = this._findAnimalIndexByCode(prevCode);
      if (matchedIdx !== null) {
        this.params.selectedAnimal = String(matchedIdx);
      } else {
        this.params.selectedAnimal =
          this.animalLibrary.animals.length > 0 ? "0" : "";
      }

      this._skipNextAnimalParamsLoad = true;
      this._lastAnimalParamsSelection = this.params.selectedAnimal || "";

      if (this.gui && typeof this.gui.rebuildPane === "function") {
        this.gui.rebuildPane();
      } else {
        this.refreshGUI();
      }

      const animal = this.getSelectedAnimal();
      if (animal) {
        this.loadAnimal(animal);
      }
    } finally {
      this._changingAnimalSource = false;
    }
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
        : [64, 128, 256, 512];
    const options = {};
    for (const size of sizes) {
      options[`${size}^${dim}`] = size;
    }
    return options;
  }

  getWorldShapeLabel() {
    const dim = Math.max(2, Math.floor(Number(this.params.dimension) || 2));
    const size = Math.max(1, Math.floor(Number(this.params.gridSize) || 1));
    const shape = dim === 2 ? "square" : dim === 3 ? "cube" : "hypercube";
    return `${shape} ${size}^${dim}`;
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
        ? NDCompatibility.getWorldDepthForDimension(this.params.gridSize, dimension)
        : Math.max(2, Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)));
    const ndSliceZ =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceSliceIndex(this.params.ndSliceZ, ndDepth)
        : Math.max(0, Math.min(ndDepth - 1, Math.floor(Number(this.params.ndSliceZ) || 0)));
    const ndSliceW =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceSliceIndex(this.params.ndSliceW, ndDepth)
        : Math.max(0, Math.min(ndDepth - 1, Math.floor(Number(this.params.ndSliceW) || 0)));
    this.params.dimension = dimension;
    this.params.viewMode = viewMode;
    this.params.ndDepth = ndDepth;
    this.params.ndSliceZ = ndSliceZ;
    this.params.ndSliceW = ndSliceW;

    return {
      dimension,
      viewMode,
      depth: ndDepth,
      sliceZ: ndSliceZ,
      sliceW: ndSliceW,
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

    if ((Number(this.params.dimension) || 2) > 2) {
      this.params.viewMode = "projection";
      const ndDepthForSlice =
        typeof NDCompatibility !== "undefined"
          ? NDCompatibility.getWorldDepthForDimension(this.params.gridSize, nextDimension)
          : Math.max(2, Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)));
      this.params.ndSliceZ = Math.floor(ndDepthForSlice / 2);
      this.params.ndSliceW = Math.floor(ndDepthForSlice / 2);
    } else {
      this.params.viewMode = "slice";
    }

    this._applyAnimalSource();

    const animal = this._syncSelectedAnimalForActiveDimension(0);

    this.params.running = false;

    if (sizeChanged) {
      this.changeResolution();
    }

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
    const depth =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDepth(this.params.ndDepth, this.params.dimension)
        : Math.max(2, Math.min(512, Math.floor(Number(this.params.ndDepth) || 6)));
    if (axis === "z") {
      this.params.ndSliceZ =
        ((Math.floor(Number(this.params.ndSliceZ) || 0) + delta) % depth + depth) % depth;
    } else if (axis === "w") {
      this.params.ndSliceW =
        ((Math.floor(Number(this.params.ndSliceW) || 0) + delta) % depth + depth) % depth;
    }
    this._workerRequestView();
    this.refreshGUI();
  }

  refreshNDView() {
    this._workerRequestView();
    this.refreshGUI();
  }

  canvasInteraction(e) {
    if (!e || !e.target) return false;
    if (e.target.closest(".tp-dfwv")) return false;
    if (e.target.tagName !== "CANVAS") return false;
    return true;
  }

  handleMouseClicked(e) {
    if (this.canvasInteraction(e)) {
      const cellX = Math.floor((mouseX / width) * this.params.gridSize);
      const cellY = Math.floor((mouseY / height) * this.params.gridSize);

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

  handleMousePressed(e) {
    if (this.canvasInteraction(e)) {
      return this.input.handlePointerPressed(e);
    }
    return;
  }

  handleMouseDragged(e) {
    if (this.canvasInteraction(e)) {
      return this.input.handlePointerDragged(e);
    }
    return;
  }

  handleMouseReleased(e) {
    this.input.handlePointerReleased(e);
    if (this.canvasInteraction(e)) {
      return false;
    }
    return;
  }

  handleMouseWheel(e) {
    if (this.canvasInteraction(e)) {
      return this.input.handleWheel(e);
    }
    return;
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
      console.error(`[Lenia] Keyboard ${action} handling failed:`, error);
      return false;
    }
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
}
