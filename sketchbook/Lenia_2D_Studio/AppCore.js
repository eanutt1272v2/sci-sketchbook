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
      gridSize: 128,

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
      renderKeymapRef: false,

      selectedAnimal: "",
      placeMode: true,
      placeScale: 1,
      autoScaleSimParams: true,

      imageFormat: "png",
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
      massAsym: 0,
      speed: 0,
      angle: 0,
      symmSides: 0,
      symmStrength: 0,
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
    this._initWorker();
  }

  _initWorker() {
    try {
      this._worker = new Worker("FFTWorker.js");
    } catch (e) {
      console.warn(
        "[Lenia] Web Worker unavailable — falling back to main-thread simulation.",
        e,
      );
      this._worker = null;
      return;
    }

    this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
    this._worker.onerror = (e) => {
      console.error("[Lenia] Worker error:", e);
      this._workerBusy = false;
      this._stepPending = false;
      this._kernelPending = false;
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

      b.cells = new Float32Array(data.cells);
      b.potential = new Float32Array(data.potential);
      b.field = new Float32Array(data.field);
      b.fieldOld = data.fieldOld ? new Float32Array(data.fieldOld) : null;

      this.automaton.change = new Float32Array(data.change);
      this.automaton.gen++;
      this.automaton.time =
        Math.round((this.automaton.time + 1 / this.params.T) * 10000) / 10000;

      this._workerBusy = false;

      if (this._pendingPlacement) {
        this._applyPlacement(this._pendingPlacement);
        this._pendingPlacement = null;
      }

      this._flushPendingMutations();

      this._postStepUpdate();

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
    const transfers = [b.cells.buffer, b.potential.buffer, b.field.buffer];
    const msg = {
      type: "step",
      params: {
        ...this.params,
        size: this.params.gridSize,
        gn: this.params.gn,
        kn: this.params.kn,
      },
      cells: b.cells.buffer,
      potential: b.potential.buffer,
      field: b.field.buffer,
      fieldOld: null,
    };

    if (this.params.multiStep && b.fieldOld) {
      msg.fieldOld = b.fieldOld.buffer;
      transfers.push(b.fieldOld.buffer);
    }

    b.cells = null;
    b.potential = null;
    b.field = null;
    b.fieldOld = null;

    this._workerBusy = true;
    this._worker.postMessage(msg, transfers);
    return true;
  }

  _ensureBuffers() {
    const size = this.params.gridSize;
    const count = size * size;
    if (!this.board.cells || this.board.cells.length !== count)
      this.board.cells = new Float32Array(count);
    if (!this.board.potential || this.board.potential.length !== count)
      this.board.potential = new Float32Array(count);
    if (!this.board.field || this.board.field.length !== count)
      this.board.field = new Float32Array(count);
  }

  _postStepUpdate() {
    this.analyser.updateStatistics(this.board, this.automaton, this.params);
    if (this.automaton.gen % 10 === 0) {
      this.analyser.series.push(this.analyser.getStatRow());
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

  draw() {
    this.input.handleContinuousInput();

    if (this.board.cells) {
      this.renderer.render(
        this.board,
        this.automaton,
        this.params.renderMode,
        this.params.colourMap,
      );

      if (this.params.renderGrid && this.params.renderMode !== "kernel") {
        this.renderer.renderGrid(this.params.R);
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

      if (
        this.params.renderMotionOverlay &&
        this.params.renderMode !== "kernel"
      ) {
        this.renderer.renderMotionOverlay(this.statistics, this.params);
      }
    }

    if (this.params.renderKeymapRef) {
      this.renderer.renderKeymapRef(this.metadata);
    }

    if (this._pendingActions.length > 0) {
      this._runNextAction();
      return;
    }

    if (this.params.running) {
      if (this._worker) {
        if (this.board.cells) {
          this._dispatchWorkerStep();
        }
      } else {
        this.automaton.step(this.board);
        this._postStepUpdate();
      }
    }

    this.analyser.updateFps();
  }

  stepOnce() {
    if (this._workerBusy) return;
    this._ensureBuffers();
    if (this._worker) {
      this._dispatchWorkerStep();
    } else {
      this.automaton.step(this.board);
      this._postStepUpdate();
    }
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

    if (!this.board.cells || (this._worker && this._workerBusy)) {
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
      const label = name.charAt(0).toUpperCase() + name.slice(1);
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
    resizeCanvas(canvasSize, canvasSize);
  }
}
