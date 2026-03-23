class AppCore {
  constructor(assets) {
    const { metadata, animalsData, colourMaps, font } = assets;

    this.metadata = metadata;
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
      gridSize: 256,

      R: 13,
      T: 10,
      m: 0.15,
      s: 0.015,
      b: [1],
      kn: 1,
      gn: 1,

      softClip: false,
      multiStep: false,
      addNoise: 0,
      maskRate: 0,
      paramP: 0,

      colourMap: this.colourMapKeys.includes("turbo")
        ? "turbo"
        : this.colourMapKeys[0],
      renderMode: "world",

      renderGrid: true,
      renderScale: true,
      renderLegend: true,
      renderStats: true,
      renderMotionOverlay: true,
      renderMotionTrail: true,
      renderCalcPanels: true,
      renderKeymapRef: false,

      selectedAnimal: "",
      placeMode: true,
      placeScale: 2,
      autoScaleSimParams: true,

      imageFormat: "png",
      recordingFPS: 60,
      videoBitrateMbps: 8,
    };

    this.statistics = {
      gen: 0,
      time: 0,
      mass: 0,
      growth: 0,
      maxValue: 0,
      gyradius: 0,
      centerX: 0,
      centerY: 0,
      growthCenterX: 0,
      growthCenterY: 0,
      massGrowthDist: 0,
      massAsym: 0,
      speed: 0,
      angle: 0,
      symmSides: 0,
      symmStrength: 0,
      rotationSpeed: 0,
      lyapunov: 0,
      period: 0,
      periodConfidence: 0,
      fps: 0,
    };

    this.renderData = {
      frameCount: 0,
      lastTime: 0,
    };

    this.font = font;

    this.animalLibrary = new AnimalLibrary(this.params);
    this.animalLibrary.loadFromData(animalsData);
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
    this._worker.postMessage({
      type: "kernel",
      params: { ...this.params, size: this.params.gridSize },
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
      if (this._stepPending) {
        this._stepPending = false;
        this._dispatchWorkerStep();
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

      if (this._pendingPlacement) {
        this._applyPlacement(this._pendingPlacement);
        this._pendingPlacement = null;
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
    const transfers = [b.world.buffer, b.potential.buffer, b.growth.buffer];
    const msg = {
      type: "step",
      params: {
        ...this.params,
        size: this.params.gridSize,
        gn: this.params.gn,
        kn: this.params.kn,
      },
      world: b.world.buffer,
      potential: b.potential.buffer,
      growth: b.growth.buffer,
      growthOld: null,
      changeBuffer: this._changeRecycleBuffer,
    };

    if (this._changeRecycleBuffer) {
      transfers.push(this._changeRecycleBuffer);
      this._changeRecycleBuffer = null;
    }

    if (this.params.multiStep && b.growthOld) {
      msg.growthOld = b.growthOld.buffer;
      transfers.push(b.growthOld.buffer);
    }

    b.world = null;
    b.potential = null;
    b.growth = null;
    b.growthOld = null;

    this._workerBusy = true;
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
    } else {
      this.analyser.updateStatistics(this.board, this.automaton, this.params);
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
      );

      if (this.params.renderGrid && this.params.renderMode !== "kernel") {
        this.renderer.renderGrid(this.params.R);
      }

      if (
        this.params.renderMotionOverlay &&
        this.params.renderMode !== "kernel"
      ) {
        this.renderer.renderMotionOverlay(this.statistics, this.params);
      }

      if (this.params.renderScale) {
        this.renderer.renderScale(this.params.R);
      }

      if (this.params.renderLegend) {
        this.renderer.renderLegend();
      }

      if (this.params.renderStats) {
        this.renderer.renderStats(this.statistics, this.params);
      }

      if (this.params.renderCalcPanels) {
        this.renderer.renderCalcPanels(this.board, this.automaton, this.params);
      }
    } else {
      this.renderer.renderCachedFrame();

      if (this.params.renderGrid && this.params.renderMode !== "kernel") {
        this.renderer.renderGrid(this.params.R);
      }

      if (
        this.params.renderMotionOverlay &&
        this.params.renderMode !== "kernel"
      ) {
        this.renderer.renderMotionOverlay(this.statistics, this.params);
      }

      if (this.params.renderScale) {
        this.renderer.renderScale(this.params.R);
      }

      if (this.params.renderLegend) {
        this.renderer.renderLegend();
      }

      if (this.params.renderStats) {
        this.renderer.renderStats(this.statistics, this.params);
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
        this.analyser.resetStatistics();
        this.analyser.reset();
      }),
    );
  }

  randomiseWorld() {
    this._queueAction("randomiseWorld", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        this.board.randomise(this.automaton.R);
        this.analyser.resetStatistics();
      }),
    );
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
    const allowed = [64, 128, 256, 512];
    const raw = Number(size);
    if (!Number.isFinite(raw) || raw <= 0) return this.params.gridSize;

    let closest = allowed[0];
    let bestDist = Math.abs(raw - closest);
    for (let i = 1; i < allowed.length; i++) {
      const d = Math.abs(raw - allowed[i]);
      if (d < bestDist) {
        closest = allowed[i];
        bestDist = d;
      }
    }

    return closest;
  }

  _applyImportedParamsSnapshot(rawParams, { allowGridSize = true } = {}) {
    if (!rawParams || typeof rawParams !== "object") {
      return { gridSizeChanged: false };
    }

    const p = this.params;
    const beforeGridSize = p.gridSize;
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

    if (allowGridSize && "gridSize" in rawParams) {
      p.gridSize = this._normaliseGridSize(rawParams.gridSize);
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
    if ("renderMotionTrail" in rawParams) {
      p.renderMotionTrail = toBoolean(
        rawParams.renderMotionTrail,
        p.renderMotionTrail,
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

    return { gridSizeChanged: p.gridSize !== beforeGridSize };
  }

  importWorldPayload(payload) {
    if (!payload || !payload.world) return;

    this._queueAction("importWorld", () =>
      this._queueOrRunMutation(() => {
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

        this._applyImportedParamsSnapshot(payload.params, {
          allowGridSize: false,
        });
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
        this.refreshGUI();

        console.log(
          `[Lenia] Imported world: size=${this.params.gridSize}${sizeChanged ? " (resized)" : ""}, params=${payload.params ? "restored" : "unchanged"}, stats=${payload.statistics ? "restored" : "reset"}, potential=${payload.potential ? "restored" : "zeroed"}, growth=${payload.growth ? "restored" : "zeroed"}, growthOld=${payload.growthOld ? "restored" : "zeroed"}, selectedAnimal=${this.params.selectedAnimal || "none"}, placeScale=${this.params.placeScale || 1}`,
        );
      }),
    );
  }

  loadAnimal(animal) {
    if (!animal) return;

    this._queueAction("loadAnimal", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        this.analyser.resetStatistics();

        const scale = this.params.placeScale || 1;
        if (Math.abs(scale - 1) < 1e-6) {
          this.board.loadPattern(animal);
        } else {
          this.board.loadPatternScaled(animal, scale);
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

    const baseR = Number(animal.params.R);
    const baseT = Number(animal.params.T);
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
    this._applyPlacement({ animal, cellX, cellY, scale });
  }

  _applyPlacement({ animal, cellX, cellY, scale }) {
    if (!animal) return;
    if (Math.abs((scale || 1) - 1) < 1e-6) {
      this.board.placePattern(animal, cellX, cellY);
    } else {
      this.board.placePatternScaled(animal, cellX, cellY, scale);
    }
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

  handleKeyPressed(k, kCode) {
    return this.input.handleKeyPressed(k, kCode);
  }

  handleKeyReleased(k, kCode) {
    return this.input.handleKeyReleased(k, kCode);
  }

  updateAutomatonParams() {
    this.automaton.updateParameters(this.params);
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
    if (this.gui && typeof this.gui.syncMediaControls === "function") {
      this.gui.syncMediaControls();
    }

    if (this.gui && this.gui.pane) this.gui.pane.refresh();
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
