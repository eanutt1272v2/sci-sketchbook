class GUI {
  constructor(manager) {
    this.m = manager;
    const { name, version, author } = this.m.metadata;

    this.pane = new Tweakpane.Pane({
      title: `${name} ${version} by ${author}`,
      expanded: true,
    });

    this.setupTabs();
  }

  setupTabs() {
    const tabs = this.pane.addTab({
      pages: [
        { title: "General" },
        { title: "Erosion" },
        { title: "Visuals" },
        { title: "Media" },
        { title: "Stats" },
      ],
    });

    const [general, erosion, visuals, media, stats] = tabs.pages;
    this.createGeneralTab(general);
    this.createErosionTab(erosion);
    this.createVisualTab(visuals);
    this.createMediaTab(media);
    this.createStatsTab(stats);
  }

  createGeneralTab(page) {
    const { params, statistics } = this.m;

    page.addButton({ title: "Generate Terrain" }).on("click", () => this.m.generate());
    page.addButton({ title: "Reset Terrain" }).on("click", () => this.m.reset());
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

    page.addBinding(statistics, "simulationTime", { label: "Simulation Time (s)", readonly: true });

    page.addBlade({ view: "separator" });

    page.addBinding(params, "running", { label: "Running" });
    page.addBinding(params, "dropletsPerFrame", { label: "Droplets/Frame", min: 0, max: 512, step: 1 });
    page.addBinding(params, "maxAge", { label: "Max Age", min: 128, max: 512, step: 1 });
    page.addBinding(params, "minVolume", { label: "Min Volume", min: 0.001, max: 0.1, step: 0.001 });

    const genFolder = page.addFolder({ title: "Generation" });
    genFolder.addBinding(params, "terrainSize", {
      label: "Size",
      options: { "128×128": 128, "256×256": 256, "512×512": 512 },
    });
    genFolder.addBinding(params, "noiseScale", { label: "Scale", min: 0.1, max: 5 });
    genFolder.addBinding(params, "noiseOctaves", { label: "Octaves", min: 1, max: 12, step: 1 });
  }

  createErosionTab(page) {
    const { params } = this.m;
    const hydraulic = page.addFolder({ title: "Hydraulic" });

    const hydraulicSettings = [
      { key: "sedimentErosionRate", label: "Sediment Erosion", min: 0, max: 0.2 },
      { key: "bedrockErosionRate", label: "Bedrock Erosion", min: 0, max: 0.2 },
      { key: "depositionRate", label: "Deposition", min: 0, max: 0.2 },
      { key: "evaporationRate", label: "Evaporation", min: 0.001, max: 1, step: 0.001 },
      { key: "precipitationRate", label: "Precipitation", min: 0, max: 5 },
      { key: "entrainment", label: "Entrainment", min: 0, max: 10 },
      { key: "gravity", label: "Gravity", min: 0.1, max: 5 },
      { key: "momentumTransfer", label: "Momentum Transfer", min: 0, max: 4 },
      { key: "learningRate", label: "Learning Rate", min: 0, max: 0.5 }
    ];

    hydraulicSettings.forEach(s => hydraulic.addBinding(params, s.key, s));

    page.addBlade({ view: "separator" });

    const thermal = page.addFolder({ title: "Thermal" });
    thermal.addBinding(params, "maxHeightDiff", { label: "Max Δ Height", min: 0.01, max: 1 });
    thermal.addBinding(params, "settlingRate", { label: "Settling Rate", min: 0, max: 1 });
  }

  createVisualTab(page) {
    const { params, colourMaps } = this.m;

    page.addBinding(params, "displayMethod", {
      label: "Display Method",
      options: { "3D": "3D", "2D": "2D" },
    });

    page.addBinding(params, "surfaceMap", {
      label: "Surface Map",
      options: {
        "Composite": "composite", "Height Map": "height", "Slope": "slope",
        "Discharge": "discharge", "Sediment": "sediment", "Delta": "delta",
      },
    });

    // need to figure out delta divergent colour map?

    const colourMapOptions = Object.keys(colourMaps).reduce((obj, name) => {
      obj[name.charAt(0).toUpperCase() + name.slice(1)] = name;
      return obj;
    }, {});

    page.addBinding(params, "colourMap", { options: colourMapOptions, label: "Colour Map" });
    page.addBinding(params, "heightScale", { label: "Height Scale", min: 1, max: 256 });

    const overlay = page.addFolder({ title: "Overlay" });
    overlay.addBinding(params, "renderStats", { label: "Stats" });
    overlay.addBinding(params, "renderLegend", { label: "Legend" });

    const light = page.addFolder({ title: "Lighting" });
    light.addBinding(params, "lightDir", {
      label: "Direction",
      x: { min: -100, max: 100 }, y: { min: -100, max: 100 }, z: { min: -100, max: 100 },
    });
    light.addBinding(params, "specularIntensity", { label: "Specular Intensity", min: 0.01, max: 1024 });

    const colours = page.addFolder({ title: "Colour Pallete" });
    ["sky", "flat", "steep", "sediment", "water"].forEach(type => {
      colours.addBinding(params, `${type}Colour`, { label: type.charAt(0).toUpperCase() + type.slice(1) });
    });
  }

  createMediaTab(page) {
    const { media, params } = this.m;

    const imp = page.addFolder({ title: "Import" });
    imp.addButton({ title: "Import Heightmap" }).on("click", () => media.openImportDialog());

    const exp = page.addFolder({ title: "Export" });
    const btn = exp.addButton({ title: media.isRecording ? "Stop Recording" : "Start Recording" });

    btn.on("click", () => {
      if (media.isRecording) {
        media.stopRecording();
      } else {
        media.startRecording();
      }

      btn.title = media.isRecording ? "Stop Recording" : "Start Recording";
    });

    exp.addBlade({ view: "separator" });
    exp.addBinding(params, "imageFormat", {
      label: "Format",
      options: { PNG: "png", JPG: "jpg", WebP: "webp" }
    });
    exp.addButton({ title: "Export Image" }).on("click", () => media.exportImage());
  }

  createStatsTab(page) {
    const { statistics } = this.m;

    const perfFolder = page.addFolder({ title: 'Performance & Time' });

    perfFolder.addBinding(statistics, 'fps', {
      readonly: true,
      label: 'FPS',
      view: 'graph',
      interval: 100,
      bufferSize: 60,
      min: 0,
      max: 120,
    });

    perfFolder.addBinding(statistics, 'simulationTime', {
      readonly: true,
      label: 'Simulation Time (s)',
      format: (v) => v.toFixed(1)
    });

    const elevationFolder = page.addFolder({ title: 'Topography' });

    elevationFolder.addBinding(statistics, 'avgElevation', {
      readonly: true,
      label: 'Average Elevation',
      format: (v) => v.toFixed(3)
    });

    elevationFolder.addBinding(statistics, 'elevationStdDev', {
      readonly: true,
      label: 'Roughness (Standard Deviation)',
      format: (v) => v.toFixed(3)
    });

    elevationFolder.addBinding(statistics, 'rugosity', {
      readonly: true,
      label: 'Rugosity Index',
      format: (v) => v.toFixed(4)
    });

    const hydroFolder = page.addFolder({ title: 'Hydrology' });

    hydroFolder.addBinding(statistics, 'totalWater', {
      readonly: true,
      label: 'Volume of Water',
      format: (v) => v.toFixed(2)
    });

    hydroFolder.addBinding(statistics, 'peakDischarge', {
      readonly: true,
      label: 'Peak Discharge',
      view: 'graph',
      bufferSize: 60,
    });

    hydroFolder.addBinding(statistics, 'drainageDensity', {
      readonly: true,
      label: 'Drainage Density (%)',
      format: (v) => v.toFixed(2)
    });

    hydroFolder.addBinding(statistics, 'hydraulicResidence', {
      readonly: true,
      label: 'Residence Time',
      format: (v) => v.toFixed(2)
    });

    const geomorphFolder = page.addFolder({ title: 'Mass Balance' });

    geomorphFolder.addBinding(statistics, 'erosionRate', {
      readonly: true,
      label: 'Total Erosion Rate',
      view: 'graph',
      interval: 200,
      bufferSize: 100,
      min: 0,
      max: 300,
    });

    geomorphFolder.addBinding(statistics, 'sedimentFlux', {
      readonly: true,
      label: 'Sediment Flux',
      view: 'graph',
      interval: 200,
      bufferSize: 100,
      min: -50,
      max: 300,
    });

    geomorphFolder.addBinding(statistics, 'totalSediment', {
      readonly: true,
      label: 'Total Sediment',
      format: (v) => v.toFixed(2)
    });

    geomorphFolder.addBinding(statistics, 'totalBedrock', {
      readonly: true,
      label: 'Total Bedrock',
      format: (v) => v.toFixed(2)
    });
  }
}