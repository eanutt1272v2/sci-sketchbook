class GUI {
  constructor(appcore) {
    this.appcore = appcore;

    this.bindings = {};
    this.recordButton = null;
    this.pane = new Tweakpane.Pane({
      title: `${this.appcore.metadata.name} ${this.appcore.metadata.version} by ${this.appcore.metadata.author}`,
      expanded: true,
    });

    this.setupTabs();
  }

  setupTabs() {
    const tabs = this.pane.addTab({
      pages: [
        { title: "Quantum" },
        { title: "Visuals" },
        { title: "Statistics" },
        { title: "Media" },
      ],
    });

    this.createGeneralTab(tabs.pages[0]);
    this.createVisualisationTab(tabs.pages[1]);
    this.createStatisticsTab(tabs.pages[2]);
    this.createMediaTab(tabs.pages[3]);

    this.enforceConstraints();
  }

  createGeneralTab(page) {
    page.addBinding(this.appcore.statistics, "fps", {
      readonly: true,
      label: "FPS",
      view: "graph",
      interval: 60,
      min: 0,
      max: 100,
    });

    page.addBinding(this.appcore.statistics, "fps", {
      label: "",
      readonly: true,
    });

    page.addBlade({ view: "separator" });

    page.addBinding(this.appcore.params, "orbitalNotation", {
      label: "Orbital Notation",
      readonly: true,
    });

    page.addBlade({ view: "separator" });

    this.bindings.n = page.addBinding(this.appcore.params, "n", {
      label: "n (principal)",
      min: 1,
      max: 7,
      step: 1,
    });

    this.bindings.l = page.addBinding(this.appcore.params, "l", {
      label: "l (angular)",
      min: 0,
      max: 0,
      step: 1,
    });

    this.bindings.m = page.addBinding(this.appcore.params, "m", {
      label: "m (magnetic)",
      min: 0,
      max: 0,
      step: 1,
    });

    this.bindings.n.on("change", () => this.enforceConstraints());
    this.bindings.l.on("change", () => this.enforceConstraints());
    this.bindings.m.on("change", () => this.enforceConstraints());
  }

  createVisualisationTab(page) {
    const colourMapOptions = Object.keys(this.appcore.colourMaps).reduce(
      (obj, name) => {
        obj[name.charAt(0).toUpperCase() + name.slice(1)] = name;
        return obj;
      },
      {},
    );

    page
      .addBinding(this.appcore.params, "colourMap", {
        label: "Colour Map",
        options: colourMapOptions,
      })
      .on("change", () => this.appcore.requestRender());

    page
      .addBinding(this.appcore.params, "exposure", {
        label: "Exposure",
        min: 0,
        max: 2,
      })
      .on("change", () => this.appcore.requestRender());

    page.addBlade({ view: "separator" });
    page
      .addBinding(this.appcore.params, "resolution", {
        label: "Resolution (px)",
        min: 64,
        max: 512,
        step: 2,
      })
      .on("change", () => this.appcore.requestRender());

    page
      .addBinding(this.appcore.params, "pixelSmoothing", {
        label: "Pixel Smoothing",
      })
      .on("change", () => this.appcore.requestRender());

    page
      .addBinding(this.appcore.params, "renderOverlay", {
        label: "Render Overlay",
      })
      .on("change", () => this.appcore.requestRender());

    page
      .addBinding(this.appcore.params, "renderLegend", {
        label: "Render Legend",
      })
      .on("change", () => this.appcore.requestRender());

    page.addBlade({ view: "separator" });

    this.bindings.viewRadius = page.addBinding(
      this.appcore.params,
      "viewRadius",
      {
        label: "View Radius (a₀)",
        min: 1,
        max: 256,
      },
    );

    page.addBlade({ view: "separator" });

    page
      .addBinding(this.appcore.params, "slicePlane", {
        label: "Slice Plane",
        options: {
          "XY Plane (Slice Z)": "xy",
          "XZ Plane (Slice Y)": "xz",
          "YZ Plane (Slice X)": "yz",
        },
      })
      .on("change", () => this.appcore.requestRender());

    this.bindings.sliceOffset = page.addBinding(
      this.appcore.params,
      "sliceOffset",
      {
        label: "Slice Offset (a₀)",
        min: -250,
        max: 250,
      },
    );

    this.bindings.viewRadius.on("change", () => this.updateViewConstraints());
    this.bindings.sliceOffset.on("change", () => this.appcore.requestRender());

    page.addBlade({ view: "separator" });

    page
      .addBinding(this.appcore.params.viewCenter, "x", {
        label: "Pan X (a₀)",
        min: -256,
        max: 256,
        step: 0.1,
      })
      .on("change", () => this.appcore.requestRender());

    page
      .addBinding(this.appcore.params.viewCenter, "y", {
        label: "Pan Y (a₀)",
        min: -256,
        max: 256,
        step: 0.1,
      })
      .on("change", () => this.appcore.requestRender());

    page
      .addBinding(this.appcore.params.viewCenter, "z", {
        label: "Pan Z (a₀)",
        min: -256,
        max: 256,
        step: 0.1,
      })
      .on("change", () => this.appcore.requestRender());

    page
      .addButton({ title: "Reset View Center" })
      .on("click", () => this.appcore.resetViewCenter());

    page.addBlade({ view: "separator" });
  }

  createStatisticsTab(page) {
    const { statistics, analyser, media } = this.appcore;

    page.addBinding(statistics, "density", {
      readonly: true,
      label: "Density",
      interval: 60,
    });

    page.addBinding(statistics, "peakDensity", {
      readonly: true,
      label: "Peak Density",
    });

    page.addBinding(statistics, "mean", {
      readonly: true,
      label: "Mean Value",
    });

    page.addBinding(statistics, "stdDev", {
      readonly: true,
      label: "Std Dev",
    });

    page.addBinding(statistics, "entropy", {
      readonly: true,
      label: "Entropy",
    });

    page.addBinding(statistics, "concentration", {
      readonly: true,
      label: "Concentration",
    });

    page.addBinding(statistics, "radialPeak", {
      readonly: true,
      label: "Radial Peak",
    });

    page.addBinding(statistics, "radialSpread", {
      readonly: true,
      label: "Radial Spread",
    });

    page.addBinding(statistics, "nodeEstimate", {
      readonly: true,
      label: "Node Estimate",
    });

    page.addBlade({ view: "separator" });

    const data = page.addFolder({ title: "Analysis Data" });
    data
      .addButton({ title: "Export Analysis (JSON)" })
      .on("click", () => media?.exportAnalysisJSON());
    data
      .addButton({ title: "Export Stats (CSV)" })
      .on("click", () => media?.exportStatisticsCSV());
  }

  createMediaTab(page) {
    const { media, params } = this.appcore;

    const data = page.addFolder({ title: "Data" });

    data
      .addButton({ title: "Export Params (JSON)" })
      .on("click", () => media.exportParamsJSON());
    data
      .addButton({ title: "Import Params (JSON)" })
      .on("click", () => media.importParamsJSON());
    data
      .addButton({ title: "Export Stats (JSON)" })
      .on("click", () => media.exportStatisticsJSON());
    data
      .addButton({ title: "Export Stats (CSV)" })
      .on("click", () => media.exportStatisticsCSV());

    const exp = page.addFolder({ title: "Capture" });

    this.recordButton = exp.addButton({
      title: media.isRecording ? "Stop Recording" : "Start Recording",
    });

    this.recordButton.on("click", () => {
      if (media.isRecording) {
        media.stopRecording();
      } else {
        media.startRecording();
      }

      this.syncMediaControls();
    });

    exp.addBlade({ view: "separator" });

    exp.addBinding(params, "imageFormat", {
      label: "Format",
      options: { PNG: "png", JPG: "jpg", WebP: "webp" },
    });

    exp
      .addButton({ title: "Export Image" })
      .on("click", () => media.exportImage());
  }

  syncMediaControls() {
    if (!this.recordButton) return;
    this.recordButton.title = this.appcore.media.isRecording
      ? "Stop Recording"
      : "Start Recording";
  }

  enforceConstraints() {
    const params = this.appcore.params;

    this.bindings.l.max = params.n - 1;

    if (params.l > this.bindings.l.max) params.l = this.bindings.l.max;

    this.bindings.m.min = -params.l;
    this.bindings.m.max = params.l;

    params.m = Math.max(
      this.bindings.m.min,
      Math.min(this.bindings.m.max, params.m),
    );

    const shells = ["s", "p", "d", "f", "g", "h", "i"];
    params.orbitalNotation = `${params.n}${shells[params.l] || "?"} (m=${params.m})`;

    this.pane.refresh();
    this.appcore.requestRender();
  }

  updateViewConstraints() {
    const params = this.appcore.params;

    this.bindings.sliceOffset.min = -params.viewRadius;
    this.bindings.sliceOffset.max = params.viewRadius;

    params.sliceOffset = Math.max(
      this.bindings.sliceOffset.min,
      Math.min(this.bindings.sliceOffset.max, params.sliceOffset),
    );

    this.pane.refresh();
    this.appcore.requestRender();
  }

  refresh() {
    this.syncMediaControls();
    this.pane.refresh();
  }
}
