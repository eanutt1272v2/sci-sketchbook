class AppCore {
  constructor(assets = {}) {
    const { metadata = null } = assets;

    this.metadata = metadata;
    this.theme = new Theme();
    this.sim = new Simulation();
    this.ui = new UIManager(this);
    background(0);
  }

  update() {
    this.ui.updateInput();
    this.sim.update();
  }

  render() {
    this.sim.render();
    if (this.ui.isVisible()) {
      this.ui.render();
    }
  }

  onKeyPressed() {
    this.ui.onKeyPressed();
  }

  windowResized() {
    resizeCanvas(windowWidth, windowHeight);

    if (this.ui && typeof this.ui.dispose === "function") {
      this.ui.dispose();
    }

    this.ui = new UIManager(this);
    this.sim.particleCount = this.sim.defaultParticleCount();
    this.restartSimulation();
  }

  dispose() {
    if (this.ui && typeof this.ui.dispose === "function") {
      this.ui.dispose();
    }

    if (this.sim && typeof this.sim.dispose === "function") {
      this.sim.dispose();
    }

    this.ui = null;
    this.sim = null;
  }

  restartSimulation() {
    this.sim.requestRestart();
  }

  toggleSimulationPause() {
    this.sim.togglePause();
  }

  toggleUI() {
    this.ui.toggleVisibility();
  }
}
