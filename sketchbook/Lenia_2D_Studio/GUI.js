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
        { title: "Simulation" },
        { title: "Parameters" },
        { title: "Visuals" },
        { title: "Animals" },
        { title: "Statistics" },
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
    run.addBinding(params, "running", { label: "Running" });
    run
      .addButton({ title: "Step Once" })
      .on("click", () => this.appcore?.stepOnce());
    run
      .addButton({ title: "Clear World" })
      .on("click", () => this.appcore?.clearWorld());
    run
      .addButton({ title: "Randomise" })
      .on("click", () => this.appcore?.randomiseWorld());
    run.addBinding(params, "autoCenter", { label: "Auto-Center" });

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
        label: "Grid Size [cells]",
        options: sizeOptions,
      })
      .on("change", () =>
        this._runIfGUIIdle(() => this.appcore?.changeResolution()),
      );

    world
      .addBinding(params, "dimension", {
        label: "Dimension",
        options: { "2D": 2, "3D": 3, "4D": 4 },
      })
      .on("change", (event) =>
        this._runIfGUIIdle(() => this.appcore?.setDimension(event.value)),
      );

    this.addSeparator(world);

    const xform = world.addFolder({ title: "Transform", expanded: false });

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

    const dim = Number(params.dimension) || 2;

    if (dim >= 3) {
      world
        .addBinding(params, "viewMode", {
          label: "ND View",
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
        world
          .addBinding(params, "ndSliceZ", {
            label: "Slice Z",
            min: 0,
            max: depthMax,
            step: 1,
          })
          .on("change", () =>
            this._runIfGUIIdle(() => this.appcore?.refreshNDView()),
          );
      }

      if (dim >= 4) {
        world
          .addBinding(params, "ndSliceW", {
            label: "Slice W",
            min: 0,
            max: depthMax,
            step: 1,
          })
          .on("change", () =>
            this._runIfGUIIdle(() => this.appcore?.refreshNDView()),
          );
      }
    }
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
      max: 0.5,
      step: 0.001,
      label: "Centre (μ)",
    });

    bindAutomaton(growth, "s", {
      min: 0.001,
      max: 0.1,
      step: 0.0001,
      label: "Width (σ)",
    });

    bindAutomaton(growth, "gn", {
      label: "Type",
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
        label: "Radius (R)",
      })
      .on("change", (ev) => {
        if (this.appcore) this.appcore.zoomWorld(ev.value);
      });

    bindAutomaton(kernel, "kn", {
      label: "Type",
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
      max: 50,
      step: 1,
      label: "Steps (T)",
    });

    bindAutomaton(time, "softClip", { label: "Soft Clipping" });

    bindAutomaton(time, "multiStep", { label: "Multi-Step" });

    bindAutomaton(time, "aritaMode", { label: "Arita Mode (target)" });

    bindAutomaton(time, "h", {
      min: 0.1,
      max: 1.0,
      step: 0.1,
      label: "Weight (h)",
    });

    bindAutomaton(time, "addNoise", {
      min: 0,
      max: 10,
      step: 0.1,
      label: "Noise",
    });

    bindAutomaton(time, "maskRate", {
      min: 0,
      max: 10,
      step: 0.1,
      label: "Mask Rate",
    });

    bindAutomaton(time, "paramP", {
      min: 0,
      max: 64,
      step: 1,
      label: "Quantisation P",
    });
  }

  createRenderTab(page) {
    const { params } = this;

    const maps = page.addFolder({ title: "State Maps", expanded: true });

    maps
      .addBinding(params, "colourMap", {
        label: "Colour Map",
        options: this.appcore
          ? this.appcore.getColourMapOptions()
          : { greyscale: "greyscale" },
      })
      .on("change", () =>
        this.appcore?.renderer?.setColourMap(params.colourMap),
      );

    maps.addBinding(params, "renderMode", {
      label: "Render Mode",
      options: {
        World: "world",
        Potential: "potential",
        Growth: "growth",
        Kernel: "kernel",
      },
    });

    this.addSeparator(page);

    const overlay = page.addFolder({ title: "Overlays" });

    overlay.addBinding(params, "renderGrid", { label: "Grid" });
    overlay.addBinding(params, "renderScale", { label: "Scale Bar" });
    overlay.addBinding(params, "renderLegend", { label: "Colour Legend" });
    overlay.addBinding(params, "renderStats", { label: "Statistics" });
    overlay.addBinding(params, "renderMotionOverlay", {
      label: "Motion Overlay",
    });
    overlay.addBinding(params, "renderSymmetryOverlay", {
      label: "Symmetry Overlay",
    });
    overlay.addBinding(params, "renderCalcPanels", {
      label: "Calculation Panels",
    });
    overlay.addBinding(params, "renderAnimalName", {
      label: "Animal Name",
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

    page
      .addButton({ title: "◀ Prev (C)" })
      .on("click", () => this.appcore?.cycleAnimal(-1));
    page
      .addButton({ title: "▶ Next (V)" })
      .on("click", () => this.appcore?.cycleAnimal(1));
    page
      .addButton({ title: "Load Selected (Z)" })
      .on("click", () => this.appcore?.loadSelectedAnimal());

    this.addSeparator(page);

    const placementFolder = page.addFolder({
      title: "Placement",
      expanded: true,
    });

    placementFolder.addBinding(params, "placeMode", {
      label: "Click to Place",
    });

    placementFolder
      .addBinding(params, "placeScale", {
        label: "Scale",
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
        label: "Auto-scale R, T",
      })
      .on("change", () => {
        if (!this.appcore || !params.autoScaleSimParams) return;
        const animal = this.appcore.getSelectedAnimal();
        if (!animal) return;
        this.appcore.applyScaledAnimalParams(animal, params.placeScale);
        this.appcore.updateAutomatonParams();
        this.appcore.refreshGUI();
      });

    placementFolder
      .addButton({ title: "Apply Scaled R, T" })
      .on("click", () => {
        if (!this.appcore) return;
        const animal = this.appcore.getSelectedAnimal();
        if (!animal) return;
        this.appcore.applyScaledAnimalParams(animal, params.placeScale);
        this.appcore.updateAutomatonParams();
        this.appcore.refreshGUI();
      });

    placementFolder
      .addButton({ title: "Reset R, T from Animal" })
      .on("click", () => {
        if (!this.appcore) return;
        const animal = this.appcore.getSelectedAnimal();
        if (animal) {
          this.appcore.animalLibrary.applyAnimalParameters(animal);
          this.appcore.updateAutomatonParams();
          this.appcore.refreshGUI();
        }
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

    const metrics = page.addFolder({ title: "Core Metrics" });
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
      .addButton({ title: "Import Params (JSON)" })
      .on("click", () => media?.importParamsJSON());
    imp
      .addButton({ title: "Import World (JSON)" })
      .on("click", () => media?.importWorldJSON());

    this.addSeparator(page);

    const exp = page.addFolder({ title: "Export" });
    exp
      .addButton({ title: "Export Params (JSON)" })
      .on("click", () => media?.exportParamsJSON());
    exp
      .addButton({ title: "Export Stats (JSON)" })
      .on("click", () => media?.exportStatisticsJSON());
    exp
      .addButton({ title: "Export Stats (CSV)" })
      .on("click", () => media?.exportStatisticsCSV());
    exp
      .addButton({ title: "Export World (JSON)" })
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
      title: media?.isRecording ? "Stop Recording" : "Start Recording",
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
      .addButton({ title: "Export Image" })
      .on("click", () => media?.exportImage());
  }

  syncMediaControls() {
    if (!this.recordButton || !this.appcore || !this.appcore.media) return;
    this.recordButton.title = this.appcore.media.isRecording
      ? "Stop Recording"
      : "Start Recording";
  }

  dispose() {
    if (this.pane) {
      this.pane.dispose();
      this.pane = null;
      this.animalBinding = null;
      this.recordButton = null;
    }
  }
}
