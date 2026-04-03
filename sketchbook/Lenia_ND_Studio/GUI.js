class GUI {
  constructor(
    params,
    statistics,
    renderData,
    metadata,
    animalLibrary = null,
    appcore = null,
  ) {
    this.params = params;
    this.statistics = statistics;
    this.renderData = renderData;
    this.metadata = metadata;
    this.animalLibrary = animalLibrary;
    this.appcore = appcore;
    this.pane = null;
    this.animalBinding = null;
    this.recordButton = null;
    this.ndSliceZBinding = null;
    this.ndSliceWBinding = null;
  }

  rebuildPane() {
    if (this._rebuildScheduled) return;
    this._rebuildScheduled = true;
    Promise.resolve().then(() => {
      this._rebuildScheduled = false;
      if (this.pane) {
        this.pane.dispose();
      }
      this.pane = null;
      this.animalBinding = null;
      this.recordButton = null;
      this.ndSliceZBinding = null;
      this.ndSliceWBinding = null;
      this.setupTabs();
    });
  }

  setupTabs() {
    this.pane = new Tweakpane.Pane({
      title: `${this.metadata.name} ${this.metadata.version} by ${this.metadata.author}`,
      expanded: true,
    });

    const tabs = this.pane.addTab({
      pages: [
        { title: "Sim" },
        { title: "Params" },
        { title: "Render" },
        { title: "Animals" },
        { title: "Stats" },
        { title: "Media" },
      ],
    });

    this.createSimulationTab(tabs.pages[0]);
    this.createParametersTab(tabs.pages[1]);
    this.createAnimalsTab(tabs.pages[3]);
    this.createRenderTab(tabs.pages[2]);
    this.createStatisticsTab(tabs.pages[4]);
    this.createMediaTab(tabs.pages[5]);
  }

  addSeparator(target) {
    target.addBlade({ view: "separator" });
  }

  withHint(label, id, fallback = "") {
    if (typeof KeybindCatalogue === "undefined") {
      return fallback ? `${label} (${fallback})` : label;
    }
    return KeybindCatalogue.withHint(label, "lenia", id, fallback);
  }

  _runIfGUIIdle(fn) {
    if (!this.appcore) return;
    if (this.appcore._isRefreshingGUI) return;
    fn();
  }

  createSimulationTab(page) {
    const { params, statistics } = this;
    const sizeOptions = this.appcore
      ? this.appcore.getGridSizeOptions(params.dimension)
      : { "64^2": 64, "128^2": 128, "256^2": 256, "512^2": 512 };
    const pixelOptions = this.appcore
      ? this.appcore.getPixelSizeOptions(params.dimension)
      : { "4px (128)": 4, "2px (256)": 2, "1px (512)": 1 };

    const run = page.addFolder({
      title: "Simulation Controls",
      expanded: true,
    });
    run.addBinding(params, "running", {
      label: this.withHint("Running", "running", "Space"),
    });
    run
      .addButton({
        title: this.withHint("Step Once", "stepOnce", "Enter"),
      })
      .on("click", () => this.appcore?.stepOnce());
    run
      .addButton({
        title: this.withHint("Clear World", "clearWorld", "Del/Bksp"),
      })
      .on("click", () => this.appcore?.clearWorld());
    run
      .addButton({
        title: this.withHint("Random Cells", "randomCells", "N"),
      })
      .on("click", () => this.appcore?.randomiseWorld());
    run
      .addButton({
        title: this.withHint("Random Params", "randomParams", "M"),
      })
      .on("click", () => this.appcore?.randomiseParams(false));
    this.addSeparator(page);

    const perf = page.addFolder({ title: "Performance", expanded: true });

    perf.addBinding(statistics, "fps", {
      readonly: true,
      label: "FPS [Hz]",
      view: "graph",
      interval: 60,
      min: 0,
      max: 100,
    });
    perf.addBinding(statistics, "time", { readonly: true, label: "Time [μs]" });

    this.addSeparator(page);

    const world = page.addFolder({ title: "World", expanded: true });
    world
      .addBinding(params, "gridSize", {
        label: this.withHint("Grid Size", "gridSize", "`"),
        options: sizeOptions,
      })
      .on("change", () =>
        this._runIfGUIIdle(() => this.appcore?.changeResolution()),
      );

    world
      .addBinding(params, "pixelSize", {
        label: "Pixel Size",
        options: pixelOptions,
      })
      .on("change", (event) =>
        this._runIfGUIIdle(() => this.appcore?.applyPixelSize(event.value)),
      );

    world
      .addBinding(params, "dimension", {
        label: this.withHint("Dimension", "dimension", "Ctrl+D"),
        options: { "2D": 2, "3D": 3, "4D": 4 },
      })
      .on("change", (event) =>
        this._runIfGUIIdle(() => this.appcore?.setDimension(event.value)),
      );

    const dim = Number(params.dimension) || 2;

    if (dim >= 3) {
      this.addSeparator(world);

      world
        .addBinding(params, "viewMode", {
          label: this.withHint("ND View", "ndView", "Ctrl+End"),
          options: this.appcore
            ? this.appcore.getViewModeOptions()
            : { Slice: "slice", Projection: "projection" },
        })
        .on("change", (event) =>
          this._runIfGUIIdle(() => this.appcore?.setViewMode(event.value)),
        );

      world.addBinding(params, "ndDepth", {
        label: "Tensor Depth (auto)",
        readonly: true,
      });

      const depthMax = Math.max(1, (Number(params.ndDepth) || 2) - 1);

      if (String(params.viewMode) === "slice") {
        this.ndSliceZBinding = world
          .addBinding(params, "ndSliceZ", {
            label: this.withHint("Slice Z", "sliceZ", "PgUp/PgDn"),
            min: 0,
            max: depthMax,
            step: 1,
          })
          .on("change", () =>
            this._runIfGUIIdle(() => this.appcore?.refreshNDView()),
          );
      }

      if (dim >= 4) {
        this.ndSliceWBinding = world
          .addBinding(params, "ndSliceW", {
            label: this.withHint("Slice W", "sliceW", "Shift+Scroll"),
            min: 0,
            max: depthMax,
            step: 1,
          })
          .on("change", () =>
            this._runIfGUIIdle(() => this.appcore?.refreshNDView()),
          );
      }
    }

    this.addSeparator(page);

    const xform = page.addFolder({ title: "Transform" });

    xform
      .addButton({ title: this.withHint("Shift Left", "shiftLeft", "Left") })
      .on("click", () => this.appcore?.shiftWorld(-10, 0));
    xform
      .addButton({
        title: this.withHint("Shift Right", "shiftRight", "Right"),
      })
      .on("click", () => this.appcore?.shiftWorld(10, 0));
    xform
      .addButton({ title: this.withHint("Shift Up", "shiftUp", "Up") })
      .on("click", () => this.appcore?.shiftWorld(0, -10));
    xform
      .addButton({
        title: this.withHint("Shift Down", "shiftDown", "Down"),
      })
      .on("click", () => this.appcore?.shiftWorld(0, 10));

    this.addSeparator(xform);

    xform
      .addButton({
        title: this.withHint("Rotate -90°", "rotateLeft", "Ctrl+Left"),
      })
      .on("click", () => this.appcore?.rotateWorld(-90));
    xform
      .addButton({
        title: this.withHint("Rotate +90°", "rotateRight", "Ctrl+Right"),
      })
      .on("click", () => this.appcore?.rotateWorld(90));

    this.addSeparator(xform);

    xform
      .addButton({
        title: this.withHint("Flip Horizontal", "flipH", "="),
      })
      .on("click", () => this.appcore?.flipWorld(0));
    xform
      .addButton({
        title: this.withHint("Flip Vertical", "flipV", "Shift+="),
      })
      .on("click", () => this.appcore?.flipWorld(1));
    xform
      .addButton({ title: this.withHint("Transpose", "transpose", "-") })
      .on("click", () => this.appcore?.flipWorld(2));
  }

  createParametersTab(page) {
    const { params } = this;
    const bindAutomaton = (target, key, options) => {
      return target
        .addBinding(params, key, options)
        .on("change", () => this.appcore?.updateAutomatonParams());
    };

    const growth = page.addFolder({ title: "Growth Function", expanded: true });

    bindAutomaton(growth, "m", {
      min: 0,
      max: 1,
      step: 0.001,
      label: this.withHint("Centre μ", "growthCentre", "Q/A"),
    });

    bindAutomaton(growth, "s", {
      min: 0.0001,
      max: 1,
      step: 0.0001,
      label: this.withHint("Width σ", "growthWidth", "W/S"),
    });

    bindAutomaton(growth, "gn", {
      label: this.withHint("Growth Type", "growthType", "Ctrl+U"),
      options: {
        Polynomial: 1,
        Exponential: 2,
        Step: 3,
      },
    });

    this.addSeparator(page);

    const kernel = page.addFolder({ title: "Kernel Function", expanded: true });
    const maxR = this.appcore?.getMaxKernelRadius
      ? this.appcore.getMaxKernelRadius()
      : 50;

    kernel
      .addBinding(params, "R", {
        min: 2,
        max: maxR,
        step: 1,
        label: this.withHint("Radius R", "radius", "R/F"),
      })
      .on("change", (ev) => {
        this._runIfGUIIdle(() => {
          if (this.appcore) this.appcore.zoomWorld(ev.value);
        });
      });

    bindAutomaton(kernel, "kn", {
      label: this.withHint("Kernel Type", "kernelType", "Ctrl+Y"),
      options: {
        Polynomial: 1,
        Exponential: 2,
        Step: 3,
        Staircase: 4,
      },
    });

    this.addSeparator(page);

    const time = page.addFolder({ title: "Time Integration" });

    bindAutomaton(time, "T", {
      min: 1,
      max: 1500,
      step: 1,
      label: this.withHint("Steps T", "steps", "T/G"),
    });

    bindAutomaton(time, "softClip", {
      label: this.withHint("Soft Clip", "softClip", "Ctrl+I"),
    });

    bindAutomaton(time, "multiStep", {
      label: this.withHint("Multi-Step", "multiStep", "Ctrl+M"),
    });

    bindAutomaton(time, "aritaMode", {
      label: this.withHint("Arita Mode", "aritaMode", "Ctrl+P"),
    });

    bindAutomaton(time, "h", {
      min: 0.1,
      max: 1.0,
      step: 0.1,
      label: this.withHint("Weight h", "weight", "Ctrl+T/G"),
    });

    bindAutomaton(time, "addNoise", {
      min: 0,
      max: 10,
      step: 0.1,
      label: this.withHint("Noise", "noise", "Ctrl+O"),
    });

    bindAutomaton(time, "maskRate", {
      min: 0,
      max: 10,
      step: 0.1,
      label: this.withHint("Mask Rate", "maskRate", "Ctrl+Shift+I"),
    });

    bindAutomaton(time, "paramP", {
      min: 0,
      max: 64,
      step: 1,
      label: this.withHint("Quantise P", "quantiseP", "E/D"),
    });
  }

  createRenderTab(page) {
    const { params } = this;

    const maps = page.addFolder({ title: "State Maps", expanded: true });

    maps
      .addBinding(params, "colourMap", {
        label: this.withHint("Colour Map", "colourMap", "./,"),
        options: this.appcore
          ? this.appcore.getColourMapOptions()
          : { greyscale: "greyscale" },
      })
      .on("change", () =>
        this.appcore?.renderer?.setColourMap(params.colourMap),
      );

    maps.addBinding(params, "renderMode", {
      label: this.withHint("Render Mode", "renderMode", "Tab"),
      options: {
        World: "world",
        Potential: "potential",
        Growth: "growth",
        Kernel: "kernel",
      },
    });

    this.addSeparator(page);

    const overlay = page.addFolder({ title: "Overlays" });

    overlay.addBinding(params, "renderGrid", {
      label: this.withHint("Grid", "renderGrid", "Shift+G"),
    });
    overlay.addBinding(params, "renderScale", {
      label: this.withHint("Scale Bar", "renderScale", "B"),
    });
    overlay.addBinding(params, "renderLegend", {
      label: this.withHint("Legend", "renderLegend", "L"),
    });
    overlay.addBinding(params, "renderStats", {
      label: this.withHint("Statistics", "renderStats", "Ctrl+H"),
    });
    overlay.addBinding(params, "renderMotionOverlay", {
      label: this.withHint("Motion", "renderMotion", "J"),
    });
    overlay.addBinding(params, "renderSymmetryOverlay", {
      label: this.withHint(
        "Symmetry Overlay (Applies when Polar Mode is on)",
        "renderSymmetry",
        "Ctrl+J",
      ),
    });
    overlay.addBinding(params, "renderCalcPanels", {
      label: this.withHint("Calc Panels", "renderCalc", "K"),
    });
    overlay.addBinding(params, "renderAnimalName", {
      label: this.withHint("Name", "renderName", "Shift+J"),
    });
    this.addSeparator(page);

    const polar = page.addFolder({ title: "Polar & Symmetry" });

    polar.addBinding(params, "autoCenter", {
      label: this.withHint("Auto-Centre", "autoCenter", "'"),
    });

    polar
      .addBinding(params, "polarMode", {
        label: this.withHint("Polar", "polarMode", "Ctrl+'"),
        options: {
          Off: 0,
          Symmetry: 1,
          Polar: 2,
          History: 3,
          Strength: 4,
        },
      })
      .on("change", (event) =>
        this._runIfGUIIdle(() =>
          this.appcore?.setPolarMode(event.value, { refreshGUI: true }),
        ),
      );

    polar.addBinding(params, "autoRotateMode", {
      label: this.withHint("Auto-Rotate", "autoRotate", "Shift+'"),
      options: {
        Off: 0,
        "Arrow (velocity)": 1,
        Symmetry: 2,
      },
    });
  }

  createAnimalsTab(page) {
    const { params } = this;
    const sourceDimension =
      this.animalLibrary && Number.isFinite(this.animalLibrary.activeDimension)
        ? this.animalLibrary.activeDimension
        : params.dimension;
    const animalCount = Array.isArray(this.animalLibrary?.animals)
      ? this.animalLibrary.animals.length
      : 0;

    this.animalBinding = page.addBinding(params, "selectedAnimal", {
      label: `Animal (${animalCount} × ${sourceDimension}D)`,
      options: this.animalLibrary ? this.animalLibrary.getAnimalList() : {},
    });
    this.animalBinding.on("change", () =>
      this.appcore?.loadSelectedAnimalParams(),
    );

    page
      .addButton({
        title: this.withHint("◀ Prev", "prevAnimal", "C"),
      })
      .on("click", () => this.appcore?.cycleAnimal(-1));
    page
      .addButton({
        title: this.withHint("▶ Next", "nextAnimal", "V"),
      })
      .on("click", () => this.appcore?.cycleAnimal(1));
    page
      .addButton({
        title: this.withHint("Load Selected", "loadAnimal", "Z"),
      })
      .on("click", () => this.appcore?.loadSelectedAnimal());
    page
      .addButton({
        title: this.withHint("Place Random", "placeRandom", "X"),
      })
      .on("click", () => this.appcore?.placeAnimalRandom());

    this.addSeparator(page);

    const placementFolder = page.addFolder({
      title: "Placement",
      expanded: true,
    });

    placementFolder.addBinding(params, "placeMode", {
      label: this.withHint("Click to Place", "placeMode", "Shift+X"),
    });

    placementFolder
      .addBinding(params, "placeScale", {
        label: this.withHint("Scale", "placeScale", "Ctrl+[/]"),
        min: 0.25,
        max: 4,
        step: 0.05,
      })
      .on("change", () => {
        if (!this.appcore) return;
        this.appcore.updatePlacementScale(params.placeScale);
      });

    placementFolder
      .addButton({
        title: this.withHint(
          "Reset Animal Params",
          "resetAnimalParams",
          "Ctrl+Shift+Z",
        ),
      })
      .on("click", () => {
        if (!this.appcore) return;
        this.appcore.applySelectedAnimalParams({ refreshGUI: true });
      });
  }

  createStatisticsTab(page) {
    const { statistics } = this;
    const formatSigned = FormatUtils.formatSigned;
    const formatPercent = FormatUtils.formatPercent;
    const formatInt = FormatUtils.formatInt;
    const addStat = (folder, key, label, format = formatSigned) =>
      folder.addBinding(statistics, key, {
        readonly: true,
        label,
        format,
      });

    const metrics = page.addFolder({ title: "Basic Metrics" });
    addStat(metrics, "gen", "Generation [gen]", formatInt);
    addStat(metrics, "time", "Time [μs]");
    addStat(metrics, "mass", "Mass [μg]");
    addStat(metrics, "growth", "Growth [μg/μs]");
    addStat(metrics, "massLog", "Mass (log scale) [μg]");
    addStat(metrics, "growthLog", "Growth (log scale) [μg/μs]");
    addStat(metrics, "massVolumeLog", "Mass volume (log scale) [μm^D]");
    addStat(metrics, "growthVolumeLog", "Growth volume (log scale) [μm^D]");
    addStat(metrics, "massDensity", "Mass density [μg/μm^D]");
    addStat(metrics, "growthDensity", "Growth density [μg/(μm^D·μs)]");
    addStat(metrics, "maxValue", "Peak value [cell-state]");
    addStat(metrics, "gyradius", "Gyradius [μm]");

    this.addSeparator(page);

    const motion = page.addFolder({ title: "Position & Motion" });
    addStat(motion, "centerX", "Centroid X [μm]");
    addStat(motion, "centerY", "Centroid Y [μm]");
    addStat(motion, "growthCenterX", "Growth centroid X [μm]");
    addStat(motion, "growthCenterY", "Growth centroid Y [μm]");
    addStat(motion, "massGrowthDist", "Mass-growth distance [μm]");
    addStat(motion, "speed", "Speed [μm/μs]");
    addStat(motion, "centroidSpeed", "Centroid speed [μm/μs]");
    addStat(motion, "angle", "Direction angle [rad]");
    addStat(motion, "centroidRotateSpeed", "Centroid rotate speed [rad/μs]");
    addStat(
      motion,
      "growthRotateSpeed",
      "Growth-centroid rotate speed [rad/μs]",
    );
    addStat(motion, "majorAxisRotateSpeed", "Major axis rotate speed [rad/μs]");
    addStat(motion, "rotationSpeed", "Rotation speed [rad/μs]");

    this.addSeparator(page);

    const symmetry = page.addFolder({ title: "Symmetry" });
    addStat(symmetry, "symmSides", "Symmetry order", formatInt);
    addStat(symmetry, "symmStrength", "Symmetry strength [%]", formatPercent);
    addStat(symmetry, "massAsym", "Mass asymmetry [μg]");
    addStat(symmetry, "lyapunov", "Lyapunov exponent [gen⁻¹]");
    addStat(symmetry, "period", "Period [μs]");
    addStat(
      symmetry,
      "periodConfidence",
      "Period confidence [%]",
      formatPercent,
    );

    this.addSeparator(page);

    const invariants = page.addFolder({ title: "Moment Invariants" });
    addStat(
      invariants,
      "hu1Log",
      "Moment of inertia - Hu's moment invariant 1 (log scale)",
    );
    addStat(
      invariants,
      "hu4Log",
      "Skewness - Hu's moment invariant 4 (log scale)",
    );
    addStat(invariants, "hu5Log", "Hu's 5 (log scale)");
    addStat(invariants, "hu6Log", "Hu's 6 (log scale)");
    addStat(invariants, "hu7Log", "Hu's 7 (log scale)");
    addStat(invariants, "flusser7", "Kurtosis - Flusser's moment invariant 7");
    addStat(invariants, "flusser8Log", "Flusser's 8 (log scale)");
    addStat(invariants, "flusser9Log", "Flusser's 9 (log scale)");
    addStat(invariants, "flusser10Log", "Flusser's 10 (log scale)");

    this.addSeparator(page);

    addStat(metrics, "fps", "FPS [Hz]");
  }

  createMediaTab(page) {
    const { statistics, appcore } = this;
    const media = appcore?.media;
    const analyser = appcore?.analyser;

    const imp = page.addFolder({ title: "Import" });
    imp
      .addButton({
        title: this.withHint("Import Params", "importParams", "Ctrl+Shift+I"),
      })
      .on("click", () => media?.importParamsJSON());
    imp
      .addButton({
        title: this.withHint("Import World", "importWorld", "Ctrl+Shift+W"),
      })
      .on("click", () => media?.importWorldJSON());

    this.addSeparator(page);

    const exp = page.addFolder({ title: "Export" });
    exp
      .addButton({
        title: this.withHint("Export Params", "exportParams", "Ctrl+Shift+P"),
      })
      .on("click", () => media?.exportParamsJSON());
    exp
      .addButton({
        title: this.withHint(
          "Export Stats (JSON)",
          "exportStatsJson",
          "Ctrl+Shift+J",
        ),
      })
      .on("click", () => media?.exportStatisticsJSON());
    exp
      .addButton({
        title: this.withHint(
          "Export Stats (CSV)",
          "exportStatsCsv",
          "Ctrl+Shift+K",
        ),
      })
      .on("click", () => media?.exportStatisticsCSV());
    exp
      .addButton({
        title: this.withHint("Export World", "exportWorld", "Ctrl+Shift+E"),
      })
      .on("click", () => media?.exportWorldJSON());

    const capture = exp.addFolder({ title: "Capture" });

    capture.addBinding(this.params, "recordingFPS", {
      label: "Record FPS [Hz]",
      min: 12,
      max: 120,
      step: 1,
    });

    capture.addBinding(this.params, "videoBitrateMbps", {
      label: "Bitrate [Mbps]",
      min: 1,
      max: 64,
      step: 0.5,
    });

    this.recordButton = capture.addButton({
      title: media?.isRecording
        ? this.withHint("⏹ Stop", "record", "Ctrl+R")
        : this.withHint("⏺ Record", "record", "Ctrl+R"),
    });

    this.recordButton.on("click", () => {
      if (!media) return;
      if (media.isRecording) {
        media.stopRecording();
      } else {
        media.startRecording();
      }
      this.syncMediaControls();
    });

    this.addSeparator(capture);

    capture.addBinding(this.params, "imageFormat", {
      label: "Image Format",
      options: { PNG: "png", JPG: "jpg", WebP: "webp" },
    });

    capture
      .addButton({
        title: this.withHint("Export Image", "exportImage", "Ctrl+S"),
      })
      .on("click", () => media?.exportImage());
  }

  syncMediaControls() {
    if (!this.recordButton || !this.appcore || !this.appcore.media) return;
    this.recordButton.title = this.appcore.media.isRecording
      ? this.withHint("⏹ Stop", "record", "Ctrl+R")
      : this.withHint("⏺ Record", "record", "Ctrl+R");
  }

  syncNDSliceBounds() {
    const params = this.params;
    const dim = Number(params.dimension) || 2;
    if (dim < 3) return;

    const depth = Math.max(2, Math.floor(Number(params.ndDepth) || 2));
    const depthMax = depth - 1;

    if (this.ndSliceZBinding) {
      this.ndSliceZBinding.min = 0;
      this.ndSliceZBinding.max = depthMax;
    }

    if (this.ndSliceWBinding) {
      this.ndSliceWBinding.min = 0;
      this.ndSliceWBinding.max = depthMax;
    }

    params.ndSliceZ = Math.max(
      0,
      Math.min(depthMax, Math.floor(Number(params.ndSliceZ) || 0)),
    );
    params.ndSliceW = Math.max(
      0,
      Math.min(depthMax, Math.floor(Number(params.ndSliceW) || 0)),
    );
  }

  dispose() {
    if (this.pane) {
      this.pane.dispose();
      this.pane = null;
      this.animalBinding = null;
      this.recordButton = null;
      this.ndSliceZBinding = null;
      this.ndSliceWBinding = null;
    }
  }
}
