

class GUI {
  constructor(manager) {
    this.m = manager;

    this.bindings = {};
    this.pane = new Tweakpane.Pane({
      title: `${this.m.metadata.name} ${this.m.metadata.version} by ${this.m.metadata.author}`,
      expanded: true
    });

    this.setupTabs();
  }

  setupTabs() {
    const tabs = this.pane.addTab({
      pages: [
        { title: "Quantum Parameters" },
        { title: "Visualisation/Other" },
      ],
    });

    this.createGeneralTab(tabs.pages[0]);
    this.createVisualisationTab(tabs.pages[1]);

    this.enforceConstraints();
  }

  createGeneralTab(page) {
    page.addBinding(this.m.statistics, "fps", {
      readonly: true,
      label: "FPS",
      view: "graph",
      interval: 60,
      min: 0,
      max: 100,
    });

    page.addBinding(this.m.statistics, "fps", {
      label: "",
      readonly: true
    });

    page.addBlade({ view: "separator" });

    page.addBinding(this.m.params, "orbitalNotation", {
      label: "Orbital Notation",
      readonly: true
    });

    page.addBlade({ view: "separator" });

    this.bindings.n = page.addBinding(this.m.params, "n", {
      label: "n (principal)",
      min: 1,
      max: 7,
      step: 1
    });

    this.bindings.l = page.addBinding(this.m.params, "l", {
      label: "l (angular)",
      min: 0,
      max: 0,
      step: 1
    });

    this.bindings.m = page.addBinding(this.m.params, "m", {
      label: "m (magnetic)",
      min: 0,
      max: 0,
      step: 1
    });

    this.bindings.n.on("change", () => this.enforceConstraints());
    this.bindings.l.on("change", () => this.enforceConstraints());
    this.bindings.m.on("change", () => this.enforceConstraints());
  }

  createVisualisationTab(page) {
    const colourMapOptions = Object.keys(this.m.colourMaps).reduce((obj, name) => {
      obj[name.charAt(0).toUpperCase() + name.slice(1)] = name;
      return obj;
    }, {});

    page.addBinding(this.m.params, "colourMap", {
      label: "Colour Map",
      options: colourMapOptions
    }).on("change", () => this.m.renderer.update());

    page.addBinding(this.m.params, "exposure", {
      label: "Exposure",
      min: 0,
      max: 2
    }).on("change", () => this.m.renderer.update());

    page.addBlade({ view: "separator" });
    page.addBinding(this.m.params, "resolution", {
      label: "Resolution (px)",
      min: 64,
      max: 512,
      step: 2
    }).on("change", () => this.m.renderer.update());

    page.addBinding(this.m.params, "pixelSmoothing", {
      label: "Pixel Smoothing",
    }).on("change", () => this.m.renderer.update());

    page.addBinding(this.m.params, "renderOverlay", {
      label: "Render Overlay",
    }).on("change", () => this.m.renderer.update());

    page.addBlade({ view: "separator" });

    this.bindings.viewRadius = page.addBinding(this.m.params, "viewRadius", {
      label: "View Radius (a₀)",
      min: 1,
      max: 256
    });

    page.addBlade({ view: "separator" });

    page.addBinding(this.m.params, "slicePlane", {
      label: "Slice Plane",
      options: {
        "XY Plane (Slice Z)": "xy",
        "XZ Plane (Slice Y)": "xz",
        "YZ Plane (Slice X)": "yz"
      }
    }).on("change", () => this.m.renderer.update());

    this.bindings.sliceOffset = page.addBinding(this.m.params, "sliceOffset", {
      label: "Slice Offset (a₀)",
      min: -250,
      max: 250
    });

    this.bindings.viewRadius.on("change", () => this.updateViewConstraints());
    this.bindings.sliceOffset.on("change", () => this.m.renderer.update());

    page.addBlade({ view: "separator" });

    page.addBinding(this.m.params.viewCenter, "x", {
      label: "Pan X (a₀)", min: -256, max: 256, step: 0.1
    }).on("change", () => this.m.requestRender());

    page.addBinding(this.m.params.viewCenter, "y", {
      label: "Pan Y (a₀)", min: -256, max: 256, step: 0.1
    }).on("change", () => this.m.requestRender());

    page.addBinding(this.m.params.viewCenter, "z", {
      label: "Pan Z (a₀)", min: -256, max: 256, step: 0.1
    }).on("change", () => this.m.requestRender());

    page.addButton({ title: "Reset View Center" }).on("click", () => this.m.resetViewCenter());

    page.addBlade({ view: "separator" });

    page.addBinding(this.m.params, "exportFormat", {
      label: "Format",
      options: { PNG: "png", JPG: "jpg", WebP: "webp" }
    });

    page.addButton({
      title: "Export Image",
    }).on("click", () => this.exportImage());
  }

  exportImage() {
    const format = this.m.params.exportFormat || "png";
    const filename = `orbital_${this.m.params.orbitalNotation.replace(/[\s=()]/g, "_")}.${format}`;

    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = filename;

    link.href = canvas.toDataURL(`image/${format === "jpg" ? "jpeg" : format}`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`Exported image: ${filename}`);
  }

  enforceConstraints() {
    const params = this.m.params;

    this.bindings.l.max = params.n - 1;

    if (params.l > this.bindings.l.max) params.l = this.bindings.l.max;

    this.bindings.m.min = -params.l;
    this.bindings.m.max = params.l;

    params.m = Math.max(this.bindings.m.min, Math.min(this.bindings.m.max, params.m));

    const shells = ["s", "p", "d", "f", "g", "h", "i"];
    params.orbitalNotation = `${params.n}${shells[params.l] || "?"} (m=${params.m})`;

    this.pane.refresh();
    this.m.renderer.update();
  }

  updateViewConstraints() {
    const params = this.m.params;

    this.bindings.sliceOffset.min = -params.viewRadius;
    this.bindings.sliceOffset.max = params.viewRadius;

    params.sliceOffset = Math.max(this.bindings.sliceOffset.min, Math.min(this.bindings.sliceOffset.max, params.sliceOffset));

    this.pane.refresh();
    this.m.renderer.update();
  }

  refresh() {
    this.pane.refresh();
  }
}