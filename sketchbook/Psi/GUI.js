class GUI {
  constructor(appcore) {
    this.appcore = appcore;

    this.bindings = {};
    this.massControl = { nucleusMassLog10: -27 };
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
        { title: "Simulation" },
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

  addSeparator(target) {
    target.addBlade({ view: "separator" });
  }

  createGeneralTab(page) {
    const perf = page.addFolder({ title: "Performance", expanded: true });

    perf.addBinding(this.appcore.statistics, "fps", {
      readonly: true,
      label: "FPS",
      view: "graph",
      interval: 60,
      min: 0,
      max: 100,
    });

    perf.addBinding(this.appcore.statistics, "fps", {
      label: "",
      readonly: true,
    });

    this.addSeparator(page);

    const quantum = page.addFolder({ title: "Quantum State", expanded: true });

    quantum.addBinding(this.appcore.params, "orbitalNotation", {
      label: "Orbital Notation",
      readonly: true,
    });

    this.bindings.n = quantum.addBinding(this.appcore.params, "n", {
      label: "n (principal)",
      min: 1,
      max: 7,
      step: 1,
    });

    this.bindings.l = quantum.addBinding(this.appcore.params, "l", {
      label: "l (angular)",
      min: 0,
      max: 0,
      step: 1,
    });

    this.bindings.m = quantum.addBinding(this.appcore.params, "m", {
      label: "m (magnetic)",
      min: 0,
      max: 0,
      step: 1,
    });

    this.bindings.nuclearCharge = quantum.addBinding(this.appcore.params, "nuclearCharge", {
      label: "Z (nuclear charge)",
      min: 1,
      max: 20,
      step: 1,
      format: (v) => String(Math.max(1, Math.min(20, Math.round(Number(v) || 1)))),
    }).on("change", (ev) => {
      const z = Math.max(1, Math.min(20, Math.round(Number(ev.value) || 1)));
      if (this.appcore.params.nuclearCharge !== z) {
        this.appcore.params.nuclearCharge = z;
        this.pane.refresh();
      }
      this.appcore.requestRender();
    });

    quantum.addBinding(this.appcore.params, "useReducedMass", {
      label: "Use reduced mass",
    }).on("change", () => {
      this.appcore.requestRender();
    });

    this.syncMassControlFromParams();

    this.bindings.nucleusMassLog10 = quantum.addBinding(this.massControl, "nucleusMassLog10", {
      label: "log10 Nucleus mass (kg)",
      min: -30,
      max: -24,
      step: 0.01,
      format: (v) => Number(v).toFixed(2),
    }).on("change", (ev) => {
      const value = Number(ev.value);
      if (!Number.isFinite(value)) return;

      this.appcore.params.nucleusMassKg = Math.pow(10, value);
      this.appcore.requestRender();
    });

    quantum.addBinding(this.appcore.params, "nucleusMassKg", {
      label: "Nucleus mass (kg)",
      readonly: true,
      format: (v) => {
        const numeric = Number(v);
        return Number.isFinite(numeric) && numeric > 0
          ? numeric.toExponential(6)
          : "1.672622e-27";
      },
    });

    this.bindings.n.on("change", () => this.enforceConstraints());
    this.bindings.l.on("change", () => this.enforceConstraints());
    this.bindings.m.on("change", () => this.enforceConstraints());
  }

  createVisualisationTab(page) {
    const colourMapOptions = Object.keys(this.appcore.colourMaps).reduce(
      (obj, name) => {
        const entry = this.appcore.colourMaps[name] || {};
        const type = entry.type || "sequential";
        obj[`${name} (${type})`] = name;
        return obj;
      },
      {},
    );

    const appearance = page.addFolder({ title: "Appearance", expanded: true });

    appearance
      .addBinding(this.appcore.params, "colourMap", {
        label: "Colour Map",
        options: colourMapOptions,
      })
      .on("change", () => this.appcore.requestRender());

    appearance
      .addBinding(this.appcore.params, "exposure", {
        label: "Exposure",
        min: 0,
        max: 2,
      })
      .on("change", () => this.appcore.requestRender());

    this.addSeparator(page);

    const quality = page.addFolder({ title: "Sampling", expanded: true });

    quality
      .addBinding(this.appcore.params, "resolution", {
        label: "Resolution (px)",
        min: 64,
        max: 512,
        step: 2,
      })
      .on("change", () => this.appcore.requestRender());

    quality
      .addBinding(this.appcore.params, "pixelSmoothing", {
        label: "Pixel Smoothing",
      })
      .on("change", () => this.appcore.requestRender());

    quality
      .addBinding(this.appcore.params, "renderOverlay", {
        label: "Statistics Overlay",
      })
      .on("change", () => this.appcore.requestRender());

    quality
      .addBinding(this.appcore.params, "renderLegend", {
        label: "Colour Legend",
      })
      .on("change", () => this.appcore.requestRender());

    quality
      .addBinding(this.appcore.params, "renderEquation", {
        label: "Equation Overlay",
      })
      .on("change", () => this.appcore.requestRender());

    this.addSeparator(page);

    const slice = page.addFolder({ title: "Slice View", expanded: true });

    this.bindings.viewRadius = slice.addBinding(
      this.appcore.params,
      "viewRadius",
      {
        label: "View Radius (a_μ)",
        min: 1,
        max: 256,
      },
    );

    slice
      .addBinding(this.appcore.params, "slicePlane", {
        label: "Slice Plane",
        options: {
          "XY Plane (Slice Z)": "xy",
          "XZ Plane (Slice Y)": "xz",
          "YZ Plane (Slice X)": "yz",
        },
      })
      .on("change", () => this.appcore.requestRender());

    this.bindings.sliceOffset = slice.addBinding(
      this.appcore.params,
      "sliceOffset",
      {
        label: "Slice Offset (a_μ)",
        min: -250,
        max: 250,
      },
    );

    this.bindings.viewRadius.on("change", () => this.updateViewConstraints());
    this.bindings.sliceOffset.on("change", () => this.appcore.requestRender());

    this.addSeparator(page);

    const pan = page.addFolder({ title: "View Centre", expanded: true });

    pan
      .addBinding(this.appcore.params.viewCentre, "x", {
        label: "Pan X (a_μ)",
        min: -256,
        max: 256,
        step: 0.1,
      })
      .on("change", () => this.appcore.requestRender());

    pan
      .addBinding(this.appcore.params.viewCentre, "y", {
        label: "Pan Y (a_μ)",
        min: -256,
        max: 256,
        step: 0.1,
      })
      .on("change", () => this.appcore.requestRender());

    pan
      .addBinding(this.appcore.params.viewCentre, "z", {
        label: "Pan Z (a_μ)",
        min: -256,
        max: 256,
        step: 0.1,
      })
      .on("change", () => this.appcore.requestRender());

    pan
      .addButton({ title: "Reset View Centre" })
      .on("click", () => this.appcore.resetViewCentre());
  }

  createStatisticsTab(page) {
    const { statistics, analyser, media } = this.appcore;

    const distribution = page.addFolder({ title: "Distribution", expanded: true });

    distribution.addBinding(statistics, "density", {
      readonly: true,
      label: "Density",
      interval: 60,
    });

    distribution.addBinding(statistics, "peakDensity", {
      readonly: true,
      label: "Peak Density (m^-3)",
    });

    distribution.addBinding(statistics, "mean", {
      readonly: true,
      label: "Mean Density (m^-3)",
    });

    distribution.addBinding(statistics, "stdDev", {
      readonly: true,
      label: "Std Dev (m^-3)",
    });

    distribution.addBinding(statistics, "entropy", {
      readonly: true,
      label: "Entropy",
    });

    distribution.addBinding(statistics, "concentration", {
      readonly: true,
      label: "Concentration",
    });

    this.addSeparator(page);

    const radial = page.addFolder({ title: "Radial Profile", expanded: true });

    radial.addBinding(statistics, "radialPeak", {
      readonly: true,
      label: "Radial Peak (a_mu)",
    });

    radial.addBinding(statistics, "radialSpread", {
      readonly: true,
      label: "Radial Spread (a_mu)",
    });

    radial.addBinding(statistics, "nodeEstimate", {
      readonly: true,
      label: "Node Estimate",
    });
  }

  createMediaTab(page) {
    const { media, params } = this.appcore;

    const imp = page.addFolder({ title: "Import" });

    imp
      .addButton({ title: "Import Params (JSON)" })
      .on("click", () => media.importParamsJSON());

    this.addSeparator(page);

    const exp = page.addFolder({ title: "Export" });

    exp
      .addButton({ title: "Export Params (JSON)" })
      .on("click", () => media.exportParamsJSON());
    exp
      .addButton({ title: "Export Stats (JSON)" })
      .on("click", () => media.exportStatisticsJSON());
    exp
      .addButton({ title: "Export Stats (CSV)" })
      .on("click", () => media.exportStatisticsCSV());

    this.addSeparator(exp);

    const capture = exp.addFolder({ title: "Capture" });

    capture.addBinding(params, "recordingFPS", {
      label: "Record FPS",
      min: 12,
      max: 120,
      step: 1,
    });

    capture.addBinding(params, "videoBitrateMbps", {
      label: "Bitrate (Mbps)",
      min: 1,
      max: 64,
      step: 0.5,
    });

    this.recordButton = capture.addButton({
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

    this.addSeparator(capture);

    capture.addBinding(params, "imageFormat", {
      label: "Format",
      options: { PNG: "png", JPG: "jpg", WebP: "webp" },
    });

    capture
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

    params.nuclearCharge = Math.max(
      1,
      Math.min(20, Math.round(Number(params.nuclearCharge) || 1)),
    );

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

    this.syncMassControlFromParams();

    this.pane.refresh();
    this.appcore.requestRender();
  }

  syncMassControlFromParams() {
    const mass = Number(this.appcore.params.nucleusMassKg);
    const fallback = 1.67262192369e-27;
    const safeMass = Number.isFinite(mass) && mass > 0 ? mass : fallback;
    this.appcore.params.nucleusMassKg = safeMass;
    this.massControl.nucleusMassLog10 = Math.max(
      -30,
      Math.min(-24, Math.log10(safeMass)),
    );
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
    this.syncMassControlFromParams();
    this.syncMediaControls();
    this.pane.refresh();
  }
}