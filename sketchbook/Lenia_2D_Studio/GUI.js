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

  createSimulationTab(page) {
    const { params, statistics } = this;

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

    this.addSeparator(page);

    const perf = page.addFolder({ title: "Performance", expanded: true });

    perf.addBinding(statistics, "fps", {
      readonly: true,
      label: "FPS",
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
        label: "Grid Size",
        options: {
          "64×64": 64,
          "128×128": 128,
          "256×256": 256,
          "512×512": 512,
        },
      })
      .on("change", () => this.appcore?.changeResolution());
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

    bindAutomaton(kernel, "R", {
      min: 2,
      max: 50,
      step: 1,
      label: "Radius (R)",
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
    overlay.addBinding(params, "renderMotionTrail", {
      label: "Motion Trail",
    });
    overlay.addBinding(params, "renderCalcPanels", {
      label: "Calculation Panels",
    });
  }

  createAnimalsTab(page) {
    const { params } = this;

    this.animalBinding = page
      .addBinding(params, "selectedAnimal", {
        label: "Selected Animal",
        options: this.animalLibrary ? this.animalLibrary.getAnimalList() : {},
      })
      .on("change", () => this.appcore?.loadSelectedAnimalParams());

    page
      .addButton({ title: "Load Selected Animal" })
      .on("click", () => this.appcore?.loadSelectedAnimal());

    this.addSeparator(page);

    const placementFolder = page.addFolder({
      title: "Placement (animals may not tolerate scaling well)",
      expanded: true,
    });

    placementFolder.addBinding(params, "placeMode", { label: "Place Mode" });

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

    placementFolder
      .addBinding(params, "autoScaleSimParams", {
        label: "Auto-scale Params",
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
      .addButton({ title: "Manually Scale Params" })
      .on("click", () => {
        if (!this.appcore) return;
        const animal = this.appcore.getSelectedAnimal();
        if (!animal) return;
        this.appcore.applyScaledAnimalParams(animal, params.placeScale);
        this.appcore.updateAutomatonParams();
        this.appcore.refreshGUI();
        console.log(
          `[Lenia] Manually scaled params: R=${params.R}, T=${params.T}`,
        );
      });

    placementFolder
      .addButton({ title: "Reset to Params from Animal" })
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
    addStat(metrics, "massVolumeLog", "Mass volume (log scale) [μm²]");
    addStat(metrics, "growthVolumeLog", "Growth volume (log scale) [μm²]");
    addStat(metrics, "massDensity", "Mass density [μg/μm²]");
    addStat(metrics, "growthDensity", "Growth density [μg/(μm²·μs)]");
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
    addStat(motion, "growthRotateSpeed", "Growth-centroid rotate speed [rad/μs]");
    addStat(motion, "majorAxisRotateSpeed", "Major axis rotate speed [rad/μs]");
    addStat(motion, "rotationSpeed", "Rotation speed [rad/μs]");

    this.addSeparator(page);

    const symmetry = page.addFolder({ title: "Symmetry" });
    addStat(symmetry, "symmSides", "Symmetry order", formatInt);
    addStat(symmetry, "symmStrength", "Symmetry strength [%]", formatPercent);
    addStat(symmetry, "massAsym", "Mass asymmetry [μg]");
    addStat(symmetry, "lyapunov", "Lyapunov exponent [gen⁻¹]");
    addStat(symmetry, "period", "Period [μs]");
    addStat(symmetry, "periodConfidence", "Period confidence [%]", formatPercent);

    this.addSeparator(page);

    const invariants = page.addFolder({ title: "Moment Invariants" });
    addStat(invariants, "hu1Log", "Moment of inertia - Hu's moment invariant 1 (log scale)");
    addStat(invariants, "hu4Log", "Skewness - Hu's moment invariant 4 (log scale)");
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
      label: "Record FPS",
      min: 12,
      max: 120,
      step: 1,
    });

    capture.addBinding(this.params, "videoBitrateMbps", {
      label: "Bitrate (Mbps)",
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
