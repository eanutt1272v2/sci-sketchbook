class GUI {
  constructor(params, statistics, displayData, metadata, animalLibrary = null, appcore = null) {
    this.params = params;
    this.statistics = statistics;
    this.displayData = displayData;
    this.metadata = metadata;
    this.animalLibrary = animalLibrary;
    this.appcore = appcore;
    this.pane = null;
    this.animalBinding = null;
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
        { title: "Animals" },
        { title: "Display" },
        { title: "Stats" },
        { title: "Export" }
      ],
    });

    this.createSimulationTab(tabs.pages[0]);
    this.createParametersTab(tabs.pages[1]);
    this.createAnimalsTab(tabs.pages[2]);
    this.createDisplayTab(tabs.pages[3]);
    this.createStatisticsTab(tabs.pages[4]);
    this.createExportTab(tabs.pages[5]);
  }

  createSimulationTab(page) {
    const { params, statistics } = this;

    page.addBinding(params, "running", { label: "Running" });

    page.addButton({ title: "Step Once" }).on("click", () => this.appcore?.stepOnce());
    page.addButton({ title: "Clear World" }).on("click", () => this.appcore?.clearWorld());
    page.addButton({ title: "Randomise" }).on("click", () => this.appcore?.randomiseWorld());

    page.addBlade({ view: "separator" });

    page.addBinding(statistics, "fps", {
      readonly: true,
      label: "FPS",
      view: "graph",
      interval: 60,
      min: 0,
      max: 100,
    });

    page.addBlade({ view: "separator" });

    page.addBinding(statistics, "time", { readonly: true, label: "Time (s)" });

    page.addBlade({ view: "separator" });

    page.addBinding(params, "gridSize", {
      label: "Grid Size",
      options: { "64×64": 64, "128×128": 128, "256×256": 256 }
    }).on("change", () => this.appcore?.changeResolution());
  }

  createParametersTab(page) {
    const { params } = this;
    const automaton = this.appcore?.automaton;

    const growth = page.addFolder({ title: "Growth Function", expanded: true });

    growth.addBinding(params, "m", {
      min: 0, max: 0.5, step: 0.001, label: "Centre (μ)"
    }).on("change", () => automaton?.updateParameters(params));

    growth.addBinding(params, "s", {
      min: 0.001, max: 0.1, step: 0.0001, label: "Width (σ)"
    }).on("change", () => automaton?.updateParameters(params));

    this.growthBinding = growth.addBinding(params, "gn", {
      label: "Type",
      options: {
        "Polynomial": 1,
        "Exponential": 2,
        "Step": 3
      }
    }).on("change", () => automaton?.updateParameters(params));

    page.addBlade({ view: "separator" });

    const kernel = page.addFolder({ title: "Kernel Function", expanded: true });

    kernel.addBinding(params, "R", {
      min: 2, max: 50, step: 1, label: "Radius (R)"
    }).on("change", () => automaton?.updateParameters(params));

    this.kernelBinding = kernel.addBinding(params, "kn", {
      label: "Type",
      options: {
        "Polynomial": 1,
        "Exponential": 2,
        "Step": 3,
        "Staircase": 4
      }
    }).on("change", () => automaton?.updateParameters(params));

    page.addBlade({ view: "separator" });

    const time = page.addFolder({ title: "Time Integration" });

    time.addBinding(params, "T", {
      min: 1, max: 50, step: 1, label: "Steps (T)"
    }).on("change", () => automaton?.updateParameters(params));

    time.addBinding(params, "softClip", { label: "Soft Clipping" })
    .on("change", () => automaton?.updateParameters(params));

    time.addBinding(params, "multiStep", { label: "Multi-Step" })
    .on("change", () => automaton?.updateParameters(params));

    time.addBinding(params, "addNoise", {
      min: 0, max: 10, step: 0.1, label: "Noise"
    }).on("change", () => automaton?.updateParameters(params));

    time.addBinding(params, "maskRate", {
      min: 0, max: 10, step: 0.1, label: "Mask Rate"
    }).on("change", () => automaton?.updateParameters(params));

    time.addBinding(params, "paramP", {
      min: 0, max: 64, step: 1, label: "Quantisation P"
    }).on("change", () => automaton?.updateParameters(params));
  }

  createAnimalsTab(page) {
    const { params } = this;

    this.animalBinding = page.addBinding(params, "selectedAnimal", {
      label: "Selected Animal",
      options: this.animalLibrary ? this.animalLibrary.getAnimalList() : {}
    }).on("change", () => this.appcore?.loadSelectedAnimalParams());

    page.addBlade({ view: "separator" });

    page.addBinding(params, "placeMode", { label: "Place Mode" });

    page.addButton({ title: "Load Selected Animal Pattern" })
    .on("click", () => this.appcore?.loadSelectedAnimal());
  }

  createDisplayTab(page) {
    const { params } = this;

    page.addBinding(params, "colourMap", {
      label: "Colour Map",
      options: this.appcore ? this.appcore.getColourMapOptions() : { greyscale: "greyscale" }
    }).on("change", () => this.appcore?.renderer?.setColourMap(params.colourMap));

    page.addBlade({ view: "separator" });

    page.addBinding(params, "displayMode", {
      label: "Display Mode",
      options: {
        "World": "world",
        "Potential Field": "potential",
        "Growth Field": "field",
        "Kernel": "kernel"
      }
    });

    page.addBlade({ view: "separator" });

    const overlay = page.addFolder({ title: "Overlay Options" });

    overlay.addBinding(params, "renderGrid", { label: "Grid" });
    overlay.addBinding(params, "renderScale", { label: "Scale Bar" });
    overlay.addBinding(params, "renderLegend", { label: "Legend" });
    overlay.addBinding(params, "renderStats", { label: "Statistics" });
    overlay.addBinding(params, "renderMotionOverlay", { label: "Motion Overlay" });
  }

  createStatisticsTab(page) {
    const { statistics } = this;
    const metrics = page.addFolder({ title: "Metrics" });
    metrics.addBinding(statistics, "gen", { readonly: true, label: "Generation" });
    metrics.addBinding(statistics, "time", { readonly: true, label: "Time (s)" });
    metrics.addBinding(statistics, "mass", { readonly: true, label: "Mass" });
    metrics.addBinding(statistics, "growth", { readonly: true, label: "Growth" });
    metrics.addBinding(statistics, "maxValue", { readonly: true, label: "Peak Value" });
    metrics.addBinding(statistics, "gyradius", { readonly: true, label: "Gyradius" });

    page.addBlade({ view: "separator" });
    const motion = page.addFolder({ title: "Position & Motion" });
    motion.addBinding(statistics, "centerX", { readonly: true, label: "Center X" });
    motion.addBinding(statistics, "centerY", { readonly: true, label: "Center Y" });
    motion.addBinding(statistics, "speed", { readonly: true, label: "Speed" });
    motion.addBinding(statistics, "angle", { readonly: true, label: "Angle (°)" });

    page.addBlade({ view: "separator" });
    const symmetry = page.addFolder({ title: "Symmetry" });
    symmetry.addBinding(statistics, "symmSides", { readonly: true, label: "Fold Order" });
    symmetry.addBinding(statistics, "symmStrength", { readonly: true, label: "Strength" });
    symmetry.addBinding(statistics, "massAsym", { readonly: true, label: "Mass Asymmetry" });

    page.addBlade({ view: "separator" });

    metrics.addBinding(statistics, "fps", { readonly: true, label: "FPS" });
  }

  createExportTab(page) {
    const { statistics } = this;
    const board = this.appcore?.board;
    const automaton = this.appcore?.automaton;
    const analyser = this.appcore?.analyser;

    page.addButton({ title: "Export World (JSON)" }).on("click", () => {
      const data = board?.toJSON();
      if (!data) return;
      const json = JSON.stringify(data, null, 2);
      downloadFile(json, `lenia-world-${automaton.gen}.json`, 'application/json');
    });

    page.addButton({ title: "Export Statistics (CSV)" }).on("click", () => {
      const csv = analyser?.exportCSV();
      if (!csv) return;
      downloadFile(csv, `lenia-stats-${automaton.gen}.csv`, 'text/csv');
    });

    page.addButton({ title: "Export Canvas (PNG)" }).on("click", () => {
      saveCanvas(`lenia-frame-${automaton?.gen || 0}`, 'png');
    });

    page.addBlade({ view: "separator" });

    page.addBinding(statistics, "gen", { readonly: true, label: "Current Gen" });
    
    page.addButton({ title: "Clear Statistics" }).on("click", () => {
      if (!analyser) return;
      analyser.series = [];
      analyser.reset();
    });

    page.addBlade({ view: "separator" });

    page.addButton({ title: "Print Statistics to Console" }).on("click", () => {
      if (!analyser) return;
      console.log('Statistics Series:', analyser.series);
      console.log('Current Stats Row:', analyser.getStatRow());
    });
  }

  dispose() {
    if (this.pane) {
      this.pane.dispose();
      this.pane = null;
      this.animalBinding = null;
      this.kernelBinding = null;
      this.growthBinding = null;
    }
  }
}