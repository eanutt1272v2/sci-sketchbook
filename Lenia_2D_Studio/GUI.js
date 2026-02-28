
/**
 * @file GUI.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
class GUI {
  constructor(params, statistics, displayData, metadata) {
    this.params = params;
    this.statistics = statistics;
    this.displayData = displayData;
    this.metadata = metadata;
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
        { title: "Simulation" },
        { title: "Parameters" },
        { title: "Animals" },
        { title: "Display" },
      ],
    });

    this.createSimulationTab(tabs.pages[0]);
    this.createParametersTab(tabs.pages[1]);
    this.createAnimalsTab(tabs.pages[2]);
    this.createDisplayTab(tabs.pages[3]);
  }

  createSimulationTab(page) {
    const { params, statistics } = this;

    page.addBinding(params, "running", { label: "Running" });

    page.addButton({ title: "Step Once" }).on("click", () => stepOnce());
    page.addButton({ title: "Clear World" }).on("click", () => clearWorld());
    page.addButton({ title: "Randomise" }).on("click", () => randomiseWorld());

    page.addBlade({ view: "separator" });

    page.addBinding(statistics, "fps", {
      readonly: true,
      label: "FPS",
      view: "graph",
      interval: 60,
      min: 0,
      max: 100,
    });

    page.addBinding(statistics, "fps", {
      label: "",
      readonly: true
    });

    page.addBlade({ view: "separator" });

    page.addBinding(params, "gridSize", {
      label: "Grid Size",
      options: { "64×64": 64, "128×128": 128, "256×256": 256, "512×512": 512 }
    }).on("change", () => changeResolution());
  }

  createParametersTab(page) {
    const { params } = this;

    const growth = page.addFolder({ title: "Growth Function", expanded: true });

    growth.addBinding(params, "m", {
      min: 0, max: 0.5, step: 0.001, label: "Centre (μ)"
    }).on("change", () => automaton.updateParameters(params));

    growth.addBinding(params, "s", {
      min: 0.001, max: 0.1, step: 0.0001, label: "Width (σ)"
    }).on("change", () => automaton.updateParameters(params));

    this.growthBinding = growth.addBinding(params, "gn", {
      label: "Type",
      options: {
        "Polynomial": 1,
        "Exponential": 2,
        "Step": 3
      }
    }).on("change", () => automaton.updateParameters(params));

    page.addBlade({ view: "separator" });

    const kernel = page.addFolder({ title: "Kernel Function", expanded: true });

    kernel.addBinding(params, "R", {
      min: 2, max: 50, step: 1, label: "Radius (R)"
    }).on("change", () => automaton.updateParameters(params));

    this.kernelBinding = kernel.addBinding(params, "kn", {
      label: "Type",
      options: {
        "Polynomial": 1,
        "Exponential": 2,
        "Step": 3,
        "Staircase": 4
      }
    }).on("change", () => automaton.updateParameters(params));

    page.addBlade({ view: "separator" });

    const time = page.addFolder({ title: "Time Integration" });

    time.addBinding(params, "T", {
      min: 1, max: 50, step: 1, label: "Steps (T)"
    }).on("change", () => automaton.updateParameters(params));

    time.addBinding(params, "softClip", { label: "Soft Clipping" })
    .on("change", () => automaton.updateParameters(params));

    time.addBinding(params, "multiStep", { label: "Multi-Step" })
    .on("change", () => automaton.updateParameters(params));
  }

  createAnimalsTab(page) {
    const { params } = this;

    this.animalBinding = page.addBinding(params, "selectedAnimal", {
      label: "Lifeform",
      options: animalLibrary.getAnimalList()
    });

    page.addBlade({ view: "separator" });

    page.addBinding(params, "placeMode", { label: "Place Mode" });

    page.addButton({ title: "Load Selected Animal" })
    .on("click", () => loadSelectedAnimal());
  }

  createDisplayTab(page) {
    const { params } = this;

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

    overlay.addBinding(params, "showGrid", { label: "Grid" });
    overlay.addBinding(params, "showScale", { label: "Scale Bar" });
    overlay.addBinding(params, "showColourmap", { label: "Legend" });
    overlay.addBinding(params, "showStats", { label: "Statistics" });
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