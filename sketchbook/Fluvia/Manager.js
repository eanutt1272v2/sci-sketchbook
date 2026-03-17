class Manager {
  constructor(assets) {
    const { metadata, vertShader, fragShader, colourMaps, font } = assets;

    this.metadata = metadata;
    this.shaders = {
      vert: vertShader,
      frag: fragShader
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

      imageFormat: "png"
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
      erosionRate: 0
    };

    this.terrain  = new Terrain(this);
    this.solver   = new Solver(this);
    this.camera   = new Camera(this);
    this.renderer = new Renderer(this);
    this.analyser = new Analyser(this);
    this.media    = new Media(this);
    this.gui      = new GUI(this);

    this.terrain.generate();

    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      zoomIn: false,
      zoomOut: false,
    };
  }

  update() {
    const { solver, camera, analyser, params } = this;

    this.handleContinuousInput();
    
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
    if (this.canvasInteraction(event)) {
      this.camera.handleWheel(event);
      return false;
    }
  }

  handlePointer(event) {
    if (this.canvasInteraction(event)) {
      this.camera.handlePointer(event);
      return false;
    }
  }

  canvasInteraction(event) {
    if (!event?.target || typeof event.target.closest !== "function") return false;
    
    const { displayMethod } = this.params;
    const { target } = event;

    const is3D = displayMethod === "3D";
    const isUI = target.closest(".tp-dfwv");
    const isCanvas = target.tagName === "CANVAS";

    return is3D && !isUI && isCanvas;
  }

  resize() {
    const canvasSize = min(windowWidth, windowHeight);
    resizeCanvas(canvasSize, canvasSize);
    this.renderer.resize();
  }

  handleKeyPressed(k, kCode) {
    if (this.shouldIgnoreKeyboard()) {
      return false;
    }

    const keyLower = (k || "").toLowerCase();

    if (k === "#") {
      this.params.renderKeymapRef = !this.params.renderKeymapRef;
      this.refreshGUI();
      return false;
    }

    if (this.params.renderKeymapRef) {
      return false;
    }

    if (keyLower === "h") {
      this.gui.pane.hidden = !this.gui.pane.hidden;
      return false;
    }

    if (keyLower === " ") {
      this.params.running = !this.params.running;
      this.refreshGUI();
      return false;
    }

    if (keyLower === "p") {
      this.params.running = !this.params.running;
      this.refreshGUI();
      return false;
    }

    if (keyLower === "g") {
      this.generate();
      this.refreshGUI();
      return false;
    }

    if (keyLower === "r") {
      this.reset();
      this.refreshGUI();
      return false;
    }

    if (keyLower === "1") {
      this.params.displayMethod = "2D";
      this.refreshGUI();
      return false;
    }

    if (keyLower === "2") {
      this.params.displayMethod = "3D";
      this.refreshGUI();
      return false;
    }

    if (keyLower === "o") {
      this.params.renderStats = !this.params.renderStats;
      this.refreshGUI();
      return false;
    }

    if (keyLower === "l") {
      this.params.renderLegend = !this.params.renderLegend;
      this.refreshGUI();
      return false;
    }

    if (keyLower === "v") {
      if (this.media.isRecording) {
        this.media.stopRecording();
      } else {
        this.media.startRecording();
      }
      this.refreshGUI();
      return false;
    }

    if (keyLower === "f") {
      this.media.exportImage();
      return false;
    }

    if (keyLower === "u") {
      this.media.openImportDialog();
      return false;
    }

    if (keyLower === "c") {
      this.cycleColourMap(keyIsDown(SHIFT) ? -1 : 1);
      this.refreshGUI();
      return false;
    }

    if (keyLower === "m") {
      this.cycleSurfaceMap(keyIsDown(SHIFT) ? -1 : 1);
      this.refreshGUI();
      return false;
    }

    if (keyLower === "[" || keyLower === "{") {
      const delta = keyLower === "{" ? -16 : -4;
      this.params.heightScale = constrain(this.params.heightScale + delta, 1, 256);
      this.refreshGUI();
      return false;
    }

    if (keyLower === "]" || keyLower === "}") {
      const delta = keyLower === "}" ? 16 : 4;
      this.params.heightScale = constrain(this.params.heightScale + delta, 1, 256);
      this.refreshGUI();
      return false;
    }

    if (keyLower === "i") {
      this.params.dropletsPerFrame = constrain(this.params.dropletsPerFrame + 16, 0, 512);
      this.refreshGUI();
      return false;
    }

    if (keyLower === "k") {
      this.params.dropletsPerFrame = constrain(this.params.dropletsPerFrame - 16, 0, 512);
      this.refreshGUI();
      return false;
    }

    if (keyLower === "e" || kCode === 187 || kCode === 107) {
      this.keys.zoomIn = true;
      return false;
    }

    if (keyLower === "q" || kCode === 189 || kCode === 109) {
      this.keys.zoomOut = true;
      return false;
    }

    if (keyLower === "w" || kCode === UP_ARROW) this.keys.up = true;
    if (keyLower === "s" || kCode === DOWN_ARROW) this.keys.down = true;
    if (keyLower === "a" || kCode === LEFT_ARROW) this.keys.left = true;
    if (keyLower === "d" || kCode === RIGHT_ARROW) this.keys.right = true;

    return false;
  }

  handleKeyReleased(k, kCode) {
    const keyLower = (k || "").toLowerCase();

    if (keyLower === "e" || keyLower === "=" || keyLower === "+" || kCode === 187 || kCode === 107) {
      this.keys.zoomIn = false;
    }

    if (keyLower === "q" || keyLower === "-" || kCode === 189 || kCode === 109) {
      this.keys.zoomOut = false;
    }

    if (keyLower === "w" || kCode === UP_ARROW) this.keys.up = false;
    if (keyLower === "s" || kCode === DOWN_ARROW) this.keys.down = false;
    if (keyLower === "a" || kCode === LEFT_ARROW) this.keys.left = false;
    if (keyLower === "d" || kCode === RIGHT_ARROW) this.keys.right = false;

    return false;
  }

  handleContinuousInput() {
    if (this.shouldIgnoreKeyboard() || this.params.renderKeymapRef || this.params.displayMethod !== "3D") {
      return;
    }

    const yawStep = keyIsDown(SHIFT) ? 0.03 : 0.015;
    const pitchStep = keyIsDown(SHIFT) ? 0.03 : 0.015;
    const zoomStep = keyIsDown(SHIFT) ? 8 : 4;

    if (this.keys.left) this.camera.target.yaw -= yawStep;
    if (this.keys.right) this.camera.target.yaw += yawStep;
    if (this.keys.up) this.camera.target.pitch = constrain(this.camera.target.pitch - pitchStep, -1.56, 1.56);
    if (this.keys.down) this.camera.target.pitch = constrain(this.camera.target.pitch + pitchStep, -1.56, 1.56);
    if (this.keys.zoomIn) this.camera.target.zoom = max(20, this.camera.target.zoom - zoomStep);
    if (this.keys.zoomOut) this.camera.target.zoom = max(20, this.camera.target.zoom + zoomStep);
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
    const maps = ["composite", "height", "slope", "discharge", "sediment", "delta"];
    const current = maps.indexOf(this.params.surfaceMap);
    const start = current >= 0 ? current : 0;
    const next = (start + step + maps.length) % maps.length;
    this.params.surfaceMap = maps[next];
  }

  shouldIgnoreKeyboard() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.isContentEditable;
  }

  refreshGUI() {
    if (this.gui && typeof this.gui.syncMediaControls === "function") {
      this.gui.syncMediaControls();
    }

    if (this.gui && this.gui.pane && typeof this.gui.pane.refresh === "function") {
      this.gui.pane.refresh();
    }
  }
}