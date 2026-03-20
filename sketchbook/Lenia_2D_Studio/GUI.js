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

    const run = page.addFolder({ title: "Simulation Controls", expanded: true });
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
    perf.addBinding(statistics, "time", { readonly: true, label: "Time (s)" });

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

    page.addBlade({ view: "separator" });

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

    page.addBlade({ view: "separator" });

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
        Growth: "field",
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

    page.addBlade({ view: "separator" });

    page.addBinding(params, "placeMode", { label: "Place Mode" });

    page.addBlade({ view: "separator" });

    const scaleFolder = page.addFolder({
      title: "Placement Scale (animals may not tolerate scaling well)",
      expanded: true,
    });

    scaleFolder
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

    scaleFolder
      .addBinding(params, "autoScaleSimParams", {
        label: "Auto-scale sim params to scale",
      })
      .on("change", () => {
        if (!this.appcore || !params.autoScaleSimParams) return;
        const animal = this.appcore.getSelectedAnimal();
        if (!animal) return;
        this.appcore.applyScaledAnimalParams(animal, params.placeScale);
        this.appcore.updateAutomatonParams();
        this.appcore.refreshGUI();
      });

    scaleFolder
      .addButton({ title: "Manually scale sim params to scale" })
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

    scaleFolder
      .addButton({ title: "Reset to sim params from animal" })
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
    const metrics = page.addFolder({ title: "Core Metrics" });
    metrics.addBinding(statistics, "gen", {
      readonly: true,
      label: "Generation",
    });
    metrics.addBinding(statistics, "time", {
      readonly: true,
      label: "Time (s)",
    });
    metrics.addBinding(statistics, "mass", { readonly: true, label: "Mass" });
    metrics.addBinding(statistics, "growth", {
      readonly: true,
      label: "Growth",
    });
    metrics.addBinding(statistics, "maxValue", {
      readonly: true,
      label: "Peak Value",
    });
    metrics.addBinding(statistics, "gyradius", {
      readonly: true,
      label: "Gyradius",
    });

    page.addBlade({ view: "separator" });
    const motion = page.addFolder({ title: "Position & Motion" });
    motion.addBinding(statistics, "centerX", {
      readonly: true,
      label: "Centre X",
    });
    motion.addBinding(statistics, "centerY", {
      readonly: true,
      label: "Centre Y",
    });
    motion.addBinding(statistics, "growthCenterX", {
      readonly: true,
      label: "Growth Centre X",
    });
    motion.addBinding(statistics, "growthCenterY", {
      readonly: true,
      label: "Growth Centre Y",
    });
    motion.addBinding(statistics, "massGrowthDist", {
      readonly: true,
      label: "Mass-Growth Dist",
    });
    motion.addBinding(statistics, "speed", { readonly: true, label: "Speed" });
    motion.addBinding(statistics, "angle", {
      readonly: true,
      label: "Angle (°)",
    });
    motion.addBinding(statistics, "rotationSpeed", {
      readonly: true,
      label: "Rotation Speed",
    });

    page.addBlade({ view: "separator" });
    const symmetry = page.addFolder({ title: "Symmetry" });
    symmetry.addBinding(statistics, "symmSides", {
      readonly: true,
      label: "Fold Order",
    });
    symmetry.addBinding(statistics, "symmStrength", {
      readonly: true,
      label: "Strength",
    });
    symmetry.addBinding(statistics, "massAsym", {
      readonly: true,
      label: "Mass Asymmetry",
    });
    symmetry.addBinding(statistics, "lyapunov", {
      readonly: true,
      label: "Lyapunov",
    });
    symmetry.addBinding(statistics, "period", {
      readonly: true,
      label: "Period (s)",
    });
    symmetry.addBinding(statistics, "periodConfidence", {
      readonly: true,
      label: "Period Confidence",
    });

    page.addBlade({ view: "separator" });

    metrics.addBinding(statistics, "fps", { readonly: true, label: "FPS" });
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

    const data = page.addFolder({ title: "Export" });
    data
      .addButton({ title: "Export Params (JSON)" })
      .on("click", () => media?.exportParamsJSON());
    data
      .addButton({ title: "Export Stats (JSON)" })
      .on("click", () => media?.exportStatisticsJSON());
    data
      .addButton({ title: "Export Stats (CSV)" })
      .on("click", () => media?.exportStatisticsCSV());
    data
      .addButton({ title: "Export World (JSON)" })
      .on("click", () => media?.exportWorldJSON());

    const exp = page.addFolder({ title: "Capture" });

    this.recordButton = exp.addButton({
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

    exp.addBlade({ view: "separator" });

    exp.addBinding(this.params, "recordingFPS", {
      label: "Record FPS",
      min: 12,
      max: 120,
      step: 1,
    });

    exp.addBinding(this.params, "videoBitrateMbps", {
      label: "Bitrate (Mbps)",
      min: 1,
      max: 64,
      step: 0.5,
    });

    exp.addBinding(this.params, "imageFormat", {
      label: "Image Format",
      options: { PNG: "png", JPG: "jpg", WebP: "webp" },
    });

    exp
      .addButton({ title: "Export Image" })
      .on("click", () => media?.exportImage());

    this.addSeparator(page);

    const session = page.addFolder({ title: "Session", expanded: true });

    session.addBinding(statistics, "gen", {
      readonly: true,
      label: "Current Gen",
    });

    session.addButton({ title: "Clear Statistics" }).on("click", () => {
      if (!analyser) return;
      analyser.series = [];
      analyser.reset();
    });

    this.addSeparator(page);

    page.addButton({ title: "Print Statistics to Console" }).on("click", () => {
      if (!analyser) return;
      console.log("[Lenia] Statistics Series:", analyser.series);
      console.log("[Lenia] Current Stats Row:", analyser.getStatRow());
    });
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
