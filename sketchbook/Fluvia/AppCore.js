class AppCore {
  constructor(assets) {
    const { metadata, vertShader, fragShader, colourMaps, font } = assets;

    this.metadata = metadata;
    this.shaders = {
      vert: vertShader,
      frag: fragShader,
    };
    this.colourMaps = colourMaps;
    this.colourMapKeys = Object.keys(colourMaps);
    this.font = font;

    this.params = {
      running: true,
      dropletsPerFrame: 256,
      maxAge: 500,
      minVolume: 0.01,

      terrainSize: 256,
      noiseScale: 0.6,
      noiseOctaves: 8,
      amplitudeFalloff: 0.6,

      sedimentErosionRate: 0.1,
      bedrockErosionRate: 0.1,
      depositionRate: 0.1,
      evaporationRate: 0.001,
      precipitationRate: 1,

      entrainment: 1,
      gravity: 1,
      momentumTransfer: 1,

      learningRate: 0.1,
      maxHeightDiff: 0.01,
      settlingRate: 0.8,

      renderStats: true,
      renderLegend: true,
      renderKeymapRef: false,

      displayMethod: "3D",
      heightScale: 100,
      surfaceMap: "composite",
      colourMap: "viridis",

      lightDir: { x: 50, y: 50, z: -50 },
      specularIntensity: 100,

      skyColour: { r: 173, g: 183, b: 196 },
      steepColour: { r: 115, g: 115, b: 95 },
      flatColour: { r: 50, g: 81, b: 33 },
      sedimentColour: { r: 201, g: 189, b: 117 },
      waterColour: { r: 92, g: 133, b: 142 },

      imageFormat: "png",
    };

    this.statistics = {
      fps: 0,
      frameCounter: 0,
      simulationTime: 0,

      heightHistogram: new Int32Array(256),
      normHistogram: new Float32Array(256),

      avgElevation: 0,
      elevationStdDev: 0,
      heightBounds: { min: 0, max: 0 },

      totalWater: 0,
      totalSediment: 0,
      totalBedrock: 0,
      sedimentBounds: { min: 0, max: 0 },

      peakDischarge: 0,
      activeWaterCover: 0,
      drainageDensity: 0,
      dischargeBounds: { min: 0, max: 0 },
      hydraulicResidence: 0,

      rugosity: 0,
      slopeComplexity: 0,
      sedimentFlux: 0,
      erosionRate: 0,
    };

    this.terrain = new Terrain(this);
    this.solver = new Solver(this);
    this.camera = new Camera(this);
    this.renderer = new Renderer(this);
    this.analyser = new Analyser(this);
    this.media = new Media(this);
    this.gui = new GUI(this);
    this.input = new InputHandler(this);

    this.terrain.generate();
  }

  update() {
    const { solver, camera, analyser, params } = this;

    this.input.handleContinuousInput();

    if (params.running) {
      solver.hydraulicErosion();
      solver.updateDischargeMap();
    }

    camera.update();
    analyser.update();
  }

  draw() {
    this.renderer.render();
  }

  generate() {
    const { terrain, params } = this;

    if (terrain.size !== params.terrainSize) {
      this.reinitialise();
    } else {
      terrain.generate();
    }

    this.analyser.reinitialise();
  }

  reset() {
    this.terrain.reset();
    this.analyser.reinitialise();
  }

  reinitialise() {
    this.terrain = new Terrain(this);
    this.solver = new Solver(this);
    this.renderer.reinitialise();
    this.terrain.generate();
  }

  handleWheel(event) {
    return this.input.handleWheel(event);
  }

  handlePointer(event) {
    return this.input.handlePointer(event);
  }

  resize() {
    const canvasSize = min(windowWidth, windowHeight);
    resizeCanvas(canvasSize, canvasSize);
    this.renderer.resize();
  }

  handleKeyPressed(k, kCode) {
    return this.input.handleKeyPressed(k, kCode);
  }

  handleKeyReleased(k, kCode) {
    return this.input.handleKeyReleased(k, kCode);
  }

  cycleColourMap(step) {
    const keys = this.colourMapKeys;
    if (keys.length === 0) return;
    const current = keys.indexOf(this.params.colourMap);
    const start = current >= 0 ? current : 0;
    const next = (start + step + keys.length) % keys.length;
    this.params.colourMap = keys[next];
  }

  cycleSurfaceMap(step) {
    const maps = [
      "composite",
      "height",
      "slope",
      "discharge",
      "sediment",
      "delta",
    ];
    const current = maps.indexOf(this.params.surfaceMap);
    const start = current >= 0 ? current : 0;
    const next = (start + step + maps.length) % maps.length;
    this.params.surfaceMap = maps[next];
  }

  refreshGUI() {
    if (this.gui && typeof this.gui.syncMediaControls === "function") {
      this.gui.syncMediaControls();
    }

    if (
      this.gui &&
      this.gui.pane &&
      typeof this.gui.pane.refresh === "function"
    ) {
      this.gui.pane.refresh();
    }
  }
}
