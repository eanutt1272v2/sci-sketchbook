class GUI {
  constructor(config, onUpdate) {
    this.config = config;
    this.onUpdate = onUpdate;
    this.pane = null;
    this.bindings = {};
  }

  initialise(colourMapNames) {
    this.pane = new Tweakpane.Pane({ title: "Hydrogen Electron Orbitals", expanded: false });
    this.createQuantumFolder();
    this.createVisualisationFolder(colourMapNames);
    this.enforceConstraints();
  }

  createQuantumFolder() {
    const config = this.config;
    
    const folder = this.pane.addFolder({ title: "Quantum Parameters" });
      folder.addBinding(config, "orbitalNotation", {
      readonly: true,
      label: "Orbital Notation",
    });
    
    this.bindings.n = folder.addBinding(config, "n", {
      min: 1,
      max: 7,
      step: 1,
      label: "n (principal)",
    });
    
    this.bindings.l = folder.addBinding(config, "l", {
      min: 0,
      max: 0,
      step: 1,
      label: "l (angular)",
    });
    
    this.bindings.m = folder.addBinding(config, "m", {
      min: 0,
      max: 0,
      step: 1,
      label: "m (magnetic)",
    });

    this.bindings.n.on("change", () => this.enforceConstraints());
    this.bindings.l.on("change", () => this.enforceConstraints());
    this.bindings.m.on("change", () => this.enforceConstraints());
    
  }

  createVisualisationFolder(colourMapNames) {
    const config = this.config;
    
    const folder = this.pane.addFolder({ title: "Visualisation" });
    
    folder
      .addBinding(config, "colourMap", {
        options: colourMapNames.reduce((obj, name) => {
          obj[name.charAt(0).toUpperCase() + name.slice(1)] = name;
          return obj;
        }, {}),
        label: "Colour Map",
      })
      .on("change", () => this.onUpdate());
    
    folder
      .addBinding(config, "smoothing", {
        label: "Pixel Smoothing",
      })
      .on("change", () => this.onUpdate());
    
    folder
      .addBinding(config, "displayData", {
        label: "Display Data",
      })
      .on("change", () => this.onUpdate());
    
    folder
      .addBinding(config, "resolution", {
        min: 32,
        max: 1024,
        step: 2,
        label: "Resolution (px)",
      })
      .on("change", () => this.onUpdate());
    
    this.bindings.viewRadius = folder.addBinding(config, "viewRadius", {
      min: 1,
      max: 100,
      label: "View Radius (a₀)",
    });
    
    this.bindings.sliceY = folder.addBinding(config, "sliceY", {
      min: -250,
      max: 250,
      label: "Slice Y (a₀)",
    });

    this.bindings.viewRadius.on("change", () => this.updateViewConstraints());
    this.bindings.sliceY.on("change", () => this.onUpdate());

    folder
      .addBinding(config, "exposure", {
        min: 0.0,
        max: 2.0,
        label: "Exposure",
      })
      .on("change", () => this.onUpdate());
  }

  enforceConstraints() {
    const config = this.config;
    
    this.bindings.l.max = config.n - 1;
    if (config.l > this.bindings.l.max) config.l = this.bindings.l.max;
    this.bindings.m.min = -config.l;
    this.bindings.m.max = config.l;
    
    config.m = Math.max(
      this.bindings.m.min,
      Math.min(this.bindings.m.max, config.m)
    );

    const shells = ["s", "p", "d", "f", "g", "h", "i"];
    
    config.orbitalNotation = `${config.n}${shells[config.l] || "?"} (m=${
      config.m
    })`;

    this.pane.refresh();
    this.onUpdate();
  }

  updateViewConstraints() {
    const config = this.config;
    
    this.bindings.sliceY.min = -config.viewRadius;
    
    this.bindings.sliceY.max = config.viewRadius;
    
    config.sliceY = Math.max(
      this.bindings.sliceY.min,
      Math.min(this.bindings.sliceY.max, config.sliceY)
    );
    
    this.pane.refresh();
    this.onUpdate();
  }

  refresh() {
    this.pane.refresh();
  }
}
