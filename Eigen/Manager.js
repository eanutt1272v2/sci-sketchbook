class Manager {
  constructor(assets) {
    this.metadata = assets.metadata;
    this.colourMaps = assets.colourMaps;
    this.font = assets.font;

    this.params = {
      orbitalNotation: "",
      n: 4, l: 1, m: 0,

      colourMap: "rocket",
      exposure: 0.75,

      resolution: 256,
      pixelSmoothing: true,
      renderOverlay: true,
      renderKeymapRef: false,

      viewRadius: 32,
      slicePlane: "xz",
      sliceOffset: 0,

      exportFormat: "png"
    };

    this.statistics = {
      fps: 0
    };

    this.solver = new Solver(this);
    this.renderer = new Renderer(this);
    this.gui = new GUI(this);

    this.renderer.update();
  }

  update() {
    this.statistics.fps = frameRate();
  }

  draw() {
    this.renderer.render();
  }

  updateQuantumNumbers(type, delta) {
    if (type === 'n') {
      this.params.n = Math.max(1, this.params.n + delta);
    } else if (type === 'l') {
      this.params.l = Math.max(0, this.params.l + delta);
    } else if (type === 'm') {
      this.params.m += delta;
    }

    this.gui.enforceConstraints();
  }

  changePlane(plane) {
    if (['xy', 'xz', 'yz'].includes(plane)) {
      this.params.slicePlane = plane;
      this.renderer.update();
    }
  }

  cycleColourMap() {
    const maps = Object.keys(this.colourMaps);
    const currentIndex = maps.indexOf(this.params.colourMap);
    this.params.colourMap = maps[(currentIndex + 1) % maps.length];
    this.renderer.update();
  }

  toggleOverlay() {
    this.params.renderOverlay = !this.params.renderOverlay;
  }

  toggleSmoothing() {
    this.params.pixelSmoothing = !this.params.pixelSmoothing;
  }

  toggleGUI() {
    this.gui.pane.expanded = !this.gui.pane.expanded;
  }

  toggleKeymapRef() {
    this.params.renderKeymapRef = !this.params.renderKeymapRef;
  }

  resetSliceOffset() {
    this.params.sliceOffset = 0;
    this.renderer.update();
  }

  adjustSliceOffset(delta) {
    this.params.sliceOffset += delta;
    this.renderer.update();
    this.gui.refresh();
  }

  adjustViewRadius(delta) {
    this.params.viewRadius = Math.max(1, this.params.viewRadius + delta);
    this.renderer.update();
    this.gui.refresh();
  }

  adjustExposure(delta) {
    this.params.exposure = constrain(this.params.exposure + delta, 0, 2);
    this.renderer.update();
    this.gui.refresh();
  }

  adjustResolution(delta) {
    this.params.resolution = constrain(this.params.resolution + delta, 64, 512);
    this.renderer.update();
    this.gui.refresh();
  }

  exportImage() {
    this.gui.exportImage();
  }

  handleWheel(e) {
    if (this.canvasInteraction(e)) {
      this.renderer.handleWheel(e);
      return false;
    }
  }

  canvasInteraction(e) {
    if (!e || !e.target) return false;
    if (typeof e.target.closest !== 'function') return false;
    if (e.target.closest(".tp-dfwv")) return false;
    if (e.target.tagName !== 'CANVAS') return false;
    return true;
  }
}