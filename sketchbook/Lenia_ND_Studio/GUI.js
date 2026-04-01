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

    const run = page.addFolder({
      title: "Simulation Controls",
      expanded: true,
    });
    run.addBinding(params, "running", { label: "Running (Enter)" });
    run
      .addButton({ title: "Step Once (Space)" })
      .on("click", () => this.appcore?.stepOnce());
    run
      .addButton({ title: "Clear World (Del)" })
      .on("click", () => this.appcore?.clearWorld());
    run
      .addButton({ title: "Random Cells (N)" })
      .on("click", () => this.appcore?.randomiseWorld());
    run
      .addButton({ title: "Random Params (M)" })
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
        label: "Grid Size (\`)",
        options: sizeOptions,
      })
      .on("change", () =>
        this._runIfGUIIdle(() => this.appcore?.changeResolution()),
      );

    world
      .addBinding(params, "dimension", {
        label: "Dimension (Ctrl+D)",
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
          label: "ND View (Ctrl+End)",
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
            label: "Slice Z (PgUp/Dn)",
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
            label: "Slice W (Shift+Scroll)",
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
      .addButton({ title: "Shift Left (←)" })
      .on("click", () => this.appcore?.shiftWorld(-10, 0));
    xform
      .addButton({ title: "Shift Right (→)" })
      .on("click", () => this.appcore?.shiftWorld(10, 0));
    xform
      .addButton({ title: "Shift Up (↑)" })
      .on("click", () => this.appcore?.shiftWorld(0, -10));
    xform
      .addButton({ title: "Shift Down (↓)" })
      .on("click", () => this.appcore?.shiftWorld(0, 10));

    this.addSeparator(xform);

    xform
      .addButton({ title: "Rotate -90° (Ctrl+←)" })
      .on("click", () => this.appcore?.rotateWorld(-90));
    xform
      .addButton({ title: "Rotate +90° (Ctrl+→)" })
      .on("click", () => this.appcore?.rotateWorld(90));

    this.addSeparator(xform);

    xform
      .addButton({ title: "Flip Horizontal (=)" })
      .on("click", () => this.appcore?.flipWorld(0));
    xform
      .addButton({ title: "Flip Vertical (Shift+=)" })
      .on("click", () => this.appcore?.flipWorld(1));
    xform
      .addButton({ title: "Transpose (-)" })
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
      label: "Centre μ (Q/A)",
    });

    bindAutomaton(growth, "s", {
      min: 0.0001,
      step: 0.0001,
      label: "Width σ (W/S)",
    });

    bindAutomaton(growth, "gn", {
      label: "Growth Type (Ctrl+U)",
      options: {
        Polynomial: 1,
        Exponential: 2,
        Step: 3,
      },
    });

    this.addSeparator(page);

    const kernel = page.addFolder({ title: "Kernel Function", expanded: true });

    kernel
      .addBinding(params, "R", {
        min: 2,
        max: 50,
        step: 1,
        label: "Radius R (R/F)",
      })
      .on("change", (ev) => {
        if (this.appcore) this.appcore.zoomWorld(ev.value);
      });

    bindAutomaton(kernel, "kn", {
      label: "Kernel Type (Ctrl+Y)",
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
      label: "Steps T (T/G)",
    });

    bindAutomaton(time, "softClip", { label: "Soft Clip (Ctrl+I)" });

    bindAutomaton(time, "multiStep", { label: "Multi-Step (Ctrl+M)" });

    bindAutomaton(time, "aritaMode", { label: "Arita Mode (Ctrl+P)" });

    bindAutomaton(time, "h", {
      min: 0.1,
      max: 1.0,
      step: 0.1,
      label: "Weight h (Ctrl+T/G)",
    });

    bindAutomaton(time, "addNoise", {
      min: 0,
      max: 10,
      step: 0.1,
      label: "Noise (Ctrl+O)",
    });

    bindAutomaton(time, "maskRate", {
      min: 0,
      max: 10,
      step: 0.1,
      label: "Mask Rate (Ctrl+Shift+I)",
    });

    bindAutomaton(time, "paramP", {
      min: 0,
      max: 64,
      step: 1,
      label: "Quantise P (E/D)",
    });
  }

  createRenderTab(page) {
    const { params } = this;

    const maps = page.addFolder({ title: "State Maps", expanded: true });

    maps
      .addBinding(params, "colourMap", {
        label: "Colour Map (. ,)",
        options: this.appcore
          ? this.appcore.getColourMapOptions()
          : { greyscale: "greyscale" },
      })
      .on("change", () =>
        this.appcore?.renderer?.setColourMap(params.colourMap),
      );

    maps.addBinding(params, "renderMode", {
      label: "Render Mode (Tab)",
      options: {
        World: "world",
        Potential: "potential",
        Growth: "growth",
        Kernel: "kernel",
      },
    });

    this.addSeparator(page);

    const overlay = page.addFolder({ title: "Overlays" });

    overlay.addBinding(params, "renderGrid", { label: "Grid (Shift+G)" });
    overlay.addBinding(params, "renderScale", { label: "Scale Bar (B)" });
    overlay.addBinding(params, "renderLegend", { label: "Legend (L)" });
    overlay.addBinding(params, "renderStats", { label: "Statistics (Ctrl+H)" });
    overlay.addBinding(params, "renderMotionOverlay", {
      label: "Motion (J)",
    });
    overlay.addBinding(params, "renderSymmetryOverlay", {
      label: "Symmetry (Ctrl+J)",
    });
    overlay.addBinding(params, "renderCalcPanels", {
      label: "Calc Panels (K)",
    });
    overlay.addBinding(params, "renderAnimalName", {
      label: "Name (Shift+J)",
    });
    this.addSeparator(page);

    const polar = page.addFolder({ title: "Polar & Symmetry" });

    polar.addBinding(params, "autoCenter", { label: "Auto-Centre (')" });

    polar
      .addBinding(params, "polarMode", {
        label: "Polar (Ctrl+')",
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
      label: "Auto-Rotate (Shift+')",
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
      .addButton({ title: "◀ Prev (C)" })
      .on("click", () => this.appcore?.cycleAnimal(-1));
    page
      .addButton({ title: "▶ Next (V)" })
      .on("click", () => this.appcore?.cycleAnimal(1));
    page
      .addButton({ title: "Load Selected (Z)" })
      .on("click", () => this.appcore?.loadSelectedAnimal());
    page
      .addButton({ title: "Place Random (X)" })
      .on("click", () => this.appcore?.placeAnimalRandom());

    this.addSeparator(page);

    const placementFolder = page.addFolder({
      title: "Placement",
      expanded: true,
    });

    placementFolder.addBinding(params, "placeMode", {
      label: "Click to Place (Shift+X)",
    });

    placementFolder
      .addBinding(params, "placeScale", {
        label: "Scale (Ctrl+[/])",
        min: 0.25,
        max: 4,
        step: 0.05,
      })
      .on("change", () => {
        if (!this.appcore) return;
        this.appcore.updatePlacementScale(params.placeScale);
      });

    this.addSeparator(placementFolder);

    placementFolder
      .addBinding(params, "autoScaleSimParams", {
        label: "Auto-scale R, T (Ctrl+K)",
      })
      .on("change", () => {
        if (!this.appcore || !params.autoScaleSimParams) return;
        this.appcore.applySelectedAnimalScaledRT(params.placeScale, {
          refreshGUI: true,
        });
      });

    placementFolder
      .addButton({ title: "Apply Scaled R, T (Ctrl+Shift+K)" })
      .on("click", () => {
        if (!this.appcore) return;
        this.appcore.applySelectedAnimalScaledRT(params.placeScale, {
          refreshGUI: true,
        });
      });

    placementFolder
      .addButton({ title: "Reset Animal Params (Ctrl+Shift+Z)" })
      .on("click", () => {
        if (!this.appcore) return;
        this.appcore.applySelectedAnimalParams({
          respectAutoScale: true,
          refreshGUI: true,
        });
      });
  }

  createStatisticsTab(page) {
    const { statistics } = this;
    const formatSigned = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return "0";
      if (n === 0) return "+0.000";
      const abs = Math.abs(n);
      if (abs >= 1e3 || abs < 1e-3) {
        const [mantissa, exponent] = n.toExponential(2).split("e");
        return `${n >= 0 ? "+" : ""}${mantissa}e^${Number(exponent)}`;
      }
      return `${n >= 0 ? "+" : ""}${n.toPrecision(3)}`;
    };
    const formatPercent = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return "0";
      return formatSigned(n * 100);
    };
    const formatInt = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return "0";
      return String(Math.round(n));
    };
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
      .addButton({ title: "Import Params (Ctrl+Shift+I)" })
      .on("click", () => media?.importParamsJSON());
    imp
      .addButton({ title: "Import World (Ctrl+Shift+W)" })
      .on("click", () => media?.importWorldJSON());

    this.addSeparator(page);

    const exp = page.addFolder({ title: "Export" });
    exp
      .addButton({ title: "Export Params (Ctrl+Shift+P)" })
      .on("click", () => media?.exportParamsJSON());
    exp
      .addButton({ title: "Export Stats (JSON)" })
      .on("click", () => media?.exportStatisticsJSON());
    exp
      .addButton({ title: "Export Stats (CSV)" })
      .on("click", () => media?.exportStatisticsCSV());
    exp
      .addButton({ title: "Export World (Ctrl+Shift+E)" })
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
      title: media?.isRecording ? "⏹ Stop (Ctrl+R)" : "⏺ Record (Ctrl+R)",
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
      .addButton({ title: "Export Image (Ctrl+S)" })
      .on("click", () => media?.exportImage());
  }

  syncMediaControls() {
    if (!this.recordButton || !this.appcore || !this.appcore.media) return;
    this.recordButton.title = this.appcore.media.isRecording
      ? "⏹ Stop (Ctrl+R)"
      : "⏺ Record (Ctrl+R)";
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
