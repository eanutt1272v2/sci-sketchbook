class AppCore {
  static installMethodsFrom(sourceClass) {
    if (!sourceClass || !sourceClass.prototype) return;
    for (const name of Object.getOwnPropertyNames(sourceClass.prototype)) {
      if (name === "constructor") continue;
      AppCore.prototype[name] = sourceClass.prototype[name];
    }
  }

  constructor(assets) {
    const {
      metadata,
      animalsData,
      animalsByDimension = null,
      colourMaps,
      font,
    } = assets;

    this.metadata = metadata;
    this.animalDatasetByDimension = {
      2: Array.isArray(animalsByDimension?.[2])
        ? animalsByDimension[2]
        : Array.isArray(animalsData)
          ? animalsData
          : [],
      3: Array.isArray(animalsByDimension?.[3]) ? animalsByDimension[3] : [],
      4: Array.isArray(animalsByDimension?.[4]) ? animalsByDimension[4] : [],
    };
    this.animalsByDimension = NDCompat.buildAnimalsByDimension(
      this.animalDatasetByDimension[2],
      this.animalDatasetByDimension,
    );
    this.font = font;
    this.colourMaps = colourMaps || {};
    this.colourMapKeys = Object.keys(this.colourMaps);

    if (this.colourMapKeys.length === 0) {
      this.colourMaps = { greyscale: ColourMapLUT.GREYSCALE };
      this.colourMapKeys = ["greyscale"];
    }

    this.params = {
      running: true,
      latticeExtent: 128,

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
      renderTrajectoryOverlay: false,
      renderMassGrowthOverlay: false,
      renderSymmetryOverlay: false,
      periodogramUseWelch: true,
      statsMode: 1,
      graphX: "m",
      graphY: "g",
      statsTrimSegment: 1,
      statsGroupByParams: false,
      recurrenceThreshold: 0.2,
      renderCalcPanels: true,
      renderAnimalName: true,
      renderKeymapRef: false,

      polarMode: 0,
      autoRotateMode: 0,
      selectedAnimal: "",
      placeMode: true,
      placeScale: 1,
      autoCentre: false,

      imageFormat: "png",
      recordingFPS: 60,
      videoBitrateMbps: 8,
    };

    this.params.R = this.getDefaultRadius(
      this.params.latticeExtent,
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
      centreX: 0,
      centreY: 0,
      growthCentreX: 0,
      growthCentreY: 0,
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
      this.animalLibrary.loadFromDimensionMap(this.animalDatasetByDimension);
      this.animalLibrary.setActiveDimension(this.params.dimension);
    } else {
      this.animalLibrary.loadFromData(this.animalDatasetByDimension[2] || []);
    }
    this.board = new Board(this.params.latticeExtent);
    this.automaton = new Automaton(this.params);
    this.analyser = new Analyser(this.statistics, this.renderData);
    this.renderer = new Renderer(
      this.params.latticeExtent,
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

  stepOnce() {
    if (this._workerBusy) return;
    this._ensureBuffers();
    if (this._worker) this._dispatchWorkerStep();
  }
  windowResized() {
    const canvasSize = min(windowWidth, windowHeight);
    if (width === canvasSize && height === canvasSize) {
      return false;
    }

    resizeCanvas(canvasSize, canvasSize, true);
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
