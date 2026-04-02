class GUI {
  constructor(appcore) {
    this.appcore = appcore;
    this.recordButton = null;
    const { name, version, author } = this.appcore.metadata;

    this.pane = new Tweakpane.Pane({
      title: `${name} ${version} by ${author}`,
      expanded: true,
    });

    this.setupTabs();
  }

  setupTabs() {
    const tabs = this.pane.addTab({
      pages: [
        { title: "Sim" },
        { title: "Params" },
        { title: "Render" },
        { title: "Stats" },
        { title: "Media" },
      ],
    });

    const [general, erosion, visuals, stats, media] = tabs.pages;
    this.createGeneralTab(general);
    this.createErosionTab(erosion);
    this.createRenderTab(visuals);
    this.createStatsTab(stats);
    this.createMediaTab(media);
  }

  addSeparator(target) {
    target.addBlade({ view: "separator" });
  }

  addGraphWithValue(target, objectRef, key, options = {}) {
    const {
      label,
      format,
      min,
      max,
      interval = 200,
      bufferSize = 100,
    } = options;

    const graphBinding = {
      readonly: true,
      label,
      view: "graph",
      interval,
      bufferSize,
    };

    if (typeof min !== "undefined") graphBinding.min = min;
    if (typeof max !== "undefined") graphBinding.max = max;

    target.addBinding(objectRef, key, graphBinding);

    const valueBinding = {
      readonly: true,
      label: "",
    };

    if (typeof format === "function") {
      valueBinding.format = format;
    }

    target.addBinding(objectRef, key, valueBinding);
  }

  createGeneralTab(page) {
    const { params, statistics } = this.appcore;

    const controls = page.addFolder({
      title: "Simulation Controls",
      expanded: true,
    });
    controls.addBinding(params, "running", { label: "Running (Space)" });
    controls
      .addButton({ title: "Generate Terrain (G)" })
      .on("click", () => this.appcore.generate());
    controls
      .addButton({ title: "Reset Terrain (R)" })
      .on("click", () => this.appcore.reset());

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
    perf.addBinding(statistics, "simulationTime", {
      label: "Simulation Time [s]",
      readonly: true,
    });

    this.addSeparator(page);

    const droplets = page.addFolder({ title: "Droplets", expanded: true });
    droplets.addBinding(params, "dropletsPerFrame", {
      label: "Droplets/Frame (I/K)",
      min: 0,
      max: 512,
      step: 1,
    });

    droplets.addBinding(params, "maxAge", {
      label: "Max Age",
      min: 128,
      max: 512,
      step: 1,
    });

    droplets.addBinding(params, "minVolume", {
      label: "Min Volume",
      min: 0.001,
      max: 0.1,
      step: 0.001,
    });

    this.addSeparator(page);

    const genFolder = page.addFolder({
      title: "Terrain Generation",
      expanded: true,
    });

    genFolder.addBinding(params, "terrainSize", {
      label: "Size",
      options: { "128×128": 128, "256×256": 256, "512×512": 512 },
    });

    genFolder.addBinding(params, "noiseScale", {
      label: "Scale",
      min: 0.1,
      max: 5,
    });

    genFolder.addBinding(params, "noiseOctaves", {
      label: "Octaves",
      min: 1,
      max: 12,
      step: 1,
    });
  }

  createErosionTab(page) {
    const { params } = this.appcore;
    const hydraulic = page.addFolder({ title: "Hydraulic" });

    const hydraulicSettings = [
      {
        key: "sedimentErosionRate",
        label: "Sediment Erosion",
        min: 0,
        max: 0.2,
      },
      { key: "bedrockErosionRate", label: "Bedrock Erosion", min: 0, max: 0.2 },
      { key: "depositionRate", label: "Deposition", min: 0, max: 0.2 },
      {
        key: "evaporationRate",
        label: "Evaporation",
        min: 0.001,
        max: 1,
        step: 0.001,
      },
      { key: "precipitationRate", label: "Precipitation", min: 0, max: 5 },
      { key: "entrainment", label: "Entrainment", min: 0, max: 10 },
      { key: "gravity", label: "Gravity", min: 0.1, max: 5 },
      { key: "momentumTransfer", label: "Momentum Transfer", min: 0, max: 4 },
      { key: "learningRate", label: "Learning Rate", min: 0, max: 0.5 },
    ];

    hydraulicSettings.forEach((s) => hydraulic.addBinding(params, s.key, s));

    this.addSeparator(page);

    const thermal = page.addFolder({ title: "Thermal" });

    thermal.addBinding(params, "maxHeightDiff", {
      label: "Max Δ Height",
      min: 0.01,
      max: 1,
    });

    thermal.addBinding(params, "settlingRate", {
      label: "Settling Rate",
      min: 0,
      max: 1,
    });
  }

  createRenderTab(page) {
    const { params, colourMaps } = this.appcore;

    const render = page.addFolder({ title: "Render", expanded: true });

    render.addBinding(params, "renderMethod", {
      label: "Render Method (1/2)",
      options: { "3D": "3D", "2D": "2D" },
    });

    render.addBinding(params, "surfaceMap", {
      label: "Surface Map (M)",
      options: {
        Composite: "composite",
        "Height Map": "height",
        Slope: "slope",
        Discharge: "discharge",
        Sediment: "sediment",
        Delta: "delta",
      },
    });

    const colourMapOptions = Object.keys(colourMaps).reduce((obj, name) => {
      const type = (colourMaps[name] && colourMaps[name].type) || "sequential";
      obj[`${name} (${type})`] = name;
      return obj;
    }, {});

    render.addBinding(params, "colourMap", {
      options: colourMapOptions,
      label: "Colour Map (C)",
    });

    render.addBinding(params, "heightScale", {
      label: "Height Scale ([/])",
      min: 1,
      max: 256,
    });

    const camera = page.addFolder({ title: "Camera", expanded: true });

    camera.addBinding(params, "cameraSmoothing", {
      label: "Motion Smoothing",
      min: 0,
      max: 0.98,
      step: 0.01,
    });

    camera.addBinding(params, "cameraOrbitSensitivity", {
      label: "Orbit Sensitivity",
      min: 0.001,
      max: 0.03,
      step: 0.0005,
    });

    camera.addBinding(params, "cameraZoomSensitivity", {
      label: "Zoom Sensitivity",
      min: 0.05,
      max: 3,
      step: 0.05,
    });

    this.addSeparator(page);

    const overlay = page.addFolder({ title: "Overlays", expanded: true });

    overlay.addBinding(params, "renderStats", { label: "Statistics (O)" });

    overlay.addBinding(params, "renderLegend", { label: "Legend (L)" });

    this.addSeparator(page);

    const light = page.addFolder({ title: "Lighting", expanded: true });

    light.addBinding(params, "lightDir", {
      label: "Direction",
      x: { min: -100, max: 100 },
      y: { min: -100, max: 100 },
      z: { min: -100, max: 100 },
    });

    light.addBinding(params, "specularIntensity", {
      label: "Specular Intensity",
      min: 0.01,
      max: 1024,
    });

    this.addSeparator(page);

    const colours = page.addFolder({ title: "Colour Palette", expanded: true });

    ["sky", "steep", "flat", "sediment", "water"].forEach((type) => {
      colours.addBinding(params, `${type}Colour`, {
        label: type.charAt(0).toUpperCase() + type.slice(1),
      });
    });
  }

  createStatsTab(page) {
    const { statistics } = this.appcore;
    const fmt = FormatUtils.formatFixed;
    const fmtInt = FormatUtils.formatInt;

    const perfFolder = page.addFolder({ title: "Performance & Time" });

    this.addGraphWithValue(perfFolder, statistics, "fps", {
      label: "FPS [Hz]",
      format: (v) => fmt(v, 1),
      interval: 100,
      bufferSize: 60,
      min: 0,
      max: 120,
    });

    perfFolder.addBinding(statistics, "simulationTime", {
      label: "Simulation Time [s]",
      readonly: true,
      format: (v) => fmt(v, 2),
    });

    perfFolder.addBinding(statistics, "frameCounter", {
      readonly: true,
      label: "Frame Counter [frame]",
      format: fmtInt,
    });

    this.addSeparator(page);

    const elevationFolder = page.addFolder({ title: "Topography" });

    elevationFolder.addBinding(statistics, "avgElevation", {
      readonly: true,
      label: "Average Elevation [height]",
      format: (v) => fmt(v, 3),
    });

    elevationFolder.addBinding(statistics, "elevationStdDev", {
      readonly: true,
      label: "Elevation Std Dev [height]",
      format: (v) => fmt(v, 3),
    });

    elevationFolder.addBinding(statistics.heightBounds, "min", {
      readonly: true,
      label: "Minimum Elevation [height]",
      format: (v) => fmt(v, 3),
    });

    elevationFolder.addBinding(statistics.heightBounds, "max", {
      readonly: true,
      label: "Maximum Elevation [height]",
      format: (v) => fmt(v, 3),
    });

    this.addGraphWithValue(elevationFolder, statistics, "rugosity", {
      label: "Rugosity Index [index]",
      format: (v) => fmt(v, 4),
      min: 0,
      max: 2,
    });

    this.addSeparator(page);

    const hydroFolder = page.addFolder({ title: "Hydrology" });

    this.addGraphWithValue(hydroFolder, statistics, "totalWater", {
      label: "Volume of Water [volume]",
      format: (v) => fmt(v, 2),
      min: 0,
      max: 128000,
    });

    this.addGraphWithValue(hydroFolder, statistics, "activeWaterCover", {
      label: "Active Water Cells [cells]",
      format: (v) => fmt(v, 2),
      min: 0,
      max: 65536,
    });

    this.addGraphWithValue(hydroFolder, statistics, "drainageDensity", {
      label: "Drainage Density [%]",
      format: (v) => fmt(v, 2),
      min: 0,
      max: 50,
    });

    this.addGraphWithValue(hydroFolder, statistics, "hydraulicResidence", {
      label: "Residence Time [s]",
      format: (v) => fmt(v, 2),
      min: 0,
      max: 1500,
    });

    hydroFolder.addBinding(statistics.dischargeBounds, "min", {
      readonly: true,
      label: "Discharge Minimum [normalised]",
      format: (v) => fmt(v, 3),
      min: 0,
      max: 1,
    });

    hydroFolder.addBinding(statistics.dischargeBounds, "max", {
      readonly: true,
      label: "Discharge Maximum [normalised]",
      format: (v) => fmt(v, 3),
      min: 0,
      max: 1,
    });

    this.addSeparator(page);

    const geomorphFolder = page.addFolder({ title: "Mass Balance" });

    this.addGraphWithValue(geomorphFolder, statistics, "erosionRate", {
      label: "Total Erosion Rate [volume/s]",
      format: (v) => fmt(v, 3),
      min: 0,
      max: 750,
    });

    this.addGraphWithValue(geomorphFolder, statistics, "sedimentFlux", {
      label: "Sediment Flux [volume/s]",
      format: (v) => fmt(v, 3),
      min: -50,
      max: 512,
    });

    this.addGraphWithValue(geomorphFolder, statistics, "totalSediment", {
      label: "Total Sediment [volume]",
      format: (v) => fmt(v, 2),
      min: 0,
      max: 2048,
    });

    this.addGraphWithValue(geomorphFolder, statistics, "totalBedrock", {
      label: "Total Bedrock [volume]",
      format: (v) => fmt(v, 2),
      min: 0,
      max: 40000,
    });

    this.addGraphWithValue(geomorphFolder, statistics.sedimentBounds, "min", {
      label: "Sediment Minimum [normalised]",
      format: (v) => fmt(v, 3),
      min: 0,
      max: 1,
    });

    this.addGraphWithValue(geomorphFolder, statistics.sedimentBounds, "max", {
      label: "Sediment Maximum [normalised]",
      format: (v) => fmt(v, 3),
      min: 0,
      max: 1,
    });

    this.addGraphWithValue(geomorphFolder, statistics, "slopeComplexity", {
      label: "Slope Complexity Index [index]",
      format: (v) => fmt(v, 4),
      min: 0,
      max: 1,
    });

    this.addSeparator(page);

    const compositeFolder = page.addFolder({ title: "Composite Blend" });

    this.addGraphWithValue(
      compositeFolder,
      statistics,
      "compositeWaterCoveragePct",
      {
        label: "Water Contribution [%]",
        format: (v) => fmt(v, 1),
        min: 0,
        max: 100,
      },
    );

    this.addGraphWithValue(
      compositeFolder,
      statistics,
      "compositeSedimentCoveragePct",
      {
        label: "Sediment Contribution [%]",
        format: (v) => fmt(v, 1),
        min: 0,
        max: 100,
      },
    );

    this.addGraphWithValue(
      compositeFolder,
      statistics,
      "compositeFlatCoveragePct",
      {
        label: "Flat Contribution [%]",
        format: (v) => fmt(v, 1),
        min: 0,
        max: 100,
      },
    );

    this.addGraphWithValue(
      compositeFolder,
      statistics,
      "compositeSteepCoveragePct",
      {
        label: "Steep Contribution [%]",
        format: (v) => fmt(v, 1),
        min: 0,
        max: 100,
      },
    );

    this.addGraphWithValue(
      compositeFolder,
      statistics,
      "compositeMeanSlopeWeight",
      {
        label: "Mean Slope Weight [index]",
        format: (v) => fmt(v, 3),
        min: 0,
        max: 1,
      },
    );

    this.addGraphWithValue(
      compositeFolder,
      statistics,
      "compositeMeanSedimentAlpha",
      {
        label: "Mean Sediment Alpha [index]",
        format: (v) => fmt(v, 3),
        min: 0,
        max: 1,
      },
    );

    this.addGraphWithValue(
      compositeFolder,
      statistics,
      "compositeMeanWaterAlpha",
      {
        label: "Mean Water Alpha [index]",
        format: (v) => fmt(v, 3),
        min: 0,
        max: 1,
      },
    );
  }

  createMediaTab(page) {
    const { media, params } = this.appcore;

    const imp = page.addFolder({ title: "Import" });
    imp
      .addButton({ title: "Import Heightmap (U)" })
      .on("click", () => media.openImportDialog());
    imp
      .addButton({ title: "Import Params (Shift+I)" })
      .on("click", () => media.importParamsJSON());
    imp
      .addButton({ title: "Import World (Shift+Q)" })
      .on("click", () => media.importWorldJSON());

    this.addSeparator(page);

    const exp = page.addFolder({ title: "Export" });
    exp
      .addButton({ title: "Export Params (Shift+P)" })
      .on("click", () => media.exportParamsJSON());
    exp
      .addButton({ title: "Export Stats (Shift+J)" })
      .on("click", () => media.exportStatisticsJSON());
    exp
      .addButton({ title: "Export Stats CSV (Shift+K)" })
      .on("click", () => media.exportStatisticsCSV());
    exp
      .addButton({ title: "Export World (Shift+W)" })
      .on("click", () => media.exportWorldJSON());
    exp
      .addButton({ title: "Export Heightmap (PNG)" })
      .on("click", () => media.exportHeightmapPNG());

    this.addSeparator(exp);

    const capture = exp.addFolder({ title: "Capture" });

    capture.addBinding(params, "recordingFPS", {
      label: "Record FPS [Hz]",
      min: 12,
      max: 120,
      step: 1,
    });

    capture.addBinding(params, "videoBitrateMbps", {
      label: "Bitrate [Mbps]",
      min: 1,
      max: 64,
      step: 0.5,
    });

    const btn = capture.addButton({
      title: media.isRecording ? "⏹ Stop (V)" : "⏺ Record (V)",
    });
    this.recordButton = btn;

    btn.on("click", () => {
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
      .addButton({ title: "Export Image (F)" })
      .on("click", () => media.exportImage());
  }

  syncMediaControls() {
    if (this.recordButton) {
      this.recordButton.title = this.appcore.media.isRecording
        ? "⏹ Stop (V)"
        : "⏺ Record (V)";
    }
  }
}
