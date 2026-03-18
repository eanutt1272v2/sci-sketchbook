

class AppCore {
  constructor(assets) {
    this.metadata = assets.metadata;
    this.colourMaps = assets.colourMaps;
    this.colourMapKeys = Object.keys(this.colourMaps);
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
      viewCenter: { x: 0, y: 0, z: 0 },

      exportFormat: "png"
    };

    this.statistics = {
      fps: 0
    };

    this.solver = new Solver(this);
    this.renderer = new Renderer(this);
    this.gui = new GUI(this);
    this.input = new InputHandler(this);

    this.renderer.update();
  }

  update() {
    this.input.handleContinuousInput();
    this.statistics.fps = frameRate();
  }

  draw() {
    this.renderer.render();
  }

  updateQuantumNumbers(type, delta) {
    if (type === "n") {
      this.params.n = Math.max(1, this.params.n + delta);
    } else if (type === "l") {
      this.params.l = Math.max(0, this.params.l + delta);
    } else if (type === "m") {
      this.params.m += delta;
    }

    this.gui.enforceConstraints();
  }

  changePlane(plane) {
    if (["xy", "xz", "yz"].includes(plane)) {
      this.params.slicePlane = plane;
      this.requestRender();
    }
  }

  cycleColourMap() {
    const maps = this.colourMapKeys;
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
    this.requestRender();
  }

  resetViewCenter() {
    const { viewCenter } = this.params;
    viewCenter.x = 0;
    viewCenter.y = 0;
    viewCenter.z = 0;
    this.requestRender();
  }

  adjustSliceOffset(delta) {
    this.params.sliceOffset = constrain(this.params.sliceOffset + delta, -this.params.viewRadius, this.params.viewRadius);
    this.requestRender();
  }

  adjustViewRadius(delta) {
    this.params.viewRadius = constrain(this.params.viewRadius + delta, 1, 256);
    this.syncViewConstraints();
  }

  adjustExposure(delta) {
    this.params.exposure = constrain(this.params.exposure + delta, 0, 2);
    this.requestRender();
  }

  adjustResolution(delta) {
    this.params.resolution = constrain(this.params.resolution + delta, 64, 512);
    this.requestRender();
  }

  exportImage() {
    this.gui.exportImage();
  }

  handleWheel(e) {
    return this.input.handleWheel(e);
  }

  handlePointer(event) {
    return this.input.handlePointer(event);
  }

  handlePointerEnd(event) {
    return this.input.handlePointerEnd(event);
  }

  handleKeyPressed(k, kCode) {
    return this.input.handleKeyPressed(k, kCode);
  }

  handleKeyReleased(k, kCode) {
    return this.input.handleKeyReleased(k, kCode);
  }

  canvasInteraction(e) {
    if (!e || !e.target) return false;
    if (typeof e.target.closest !== "function") return false;
    if (e.target.closest(".tp-dfwv")) return false;
    if (e.target.tagName !== "CANVAS") return false;
    return true;
  }

  getPlaneAxes() {
    switch (this.params.slicePlane) {
      case "xy":
        return { axis1: "x", axis2: "y", fixedAxis: "z", axis1Label: "X", axis2Label: "Y", fixedLabel: "Z" };
      case "yz":
        return { axis1: "y", axis2: "z", fixedAxis: "x", axis1Label: "Y", axis2Label: "Z", fixedLabel: "X" };
      case "xz":
      default:
        return { axis1: "x", axis2: "z", fixedAxis: "y", axis1Label: "X", axis2Label: "Z", fixedLabel: "Y" };
    }
  }

  requestRender() {
    this.renderer.update();
    this.refreshGUI();
  }

  syncViewConstraints() {
    if (this.gui && typeof this.gui.updateViewConstraints === "function") {
      this.gui.updateViewConstraints();
      return;
    }

    this.requestRender();
  }

  refreshGUI() {
    if (this.gui && typeof this.gui.refresh === "function") {
      this.gui.refresh();
    }
  }
}