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
    const canvasSize = min(windowWidth, windowHeight);
    resizeCanvas(canvasSize, canvasSize);
    this.ui = new UIManager(this);
    this.sim.particleCount = this.sim.defaultParticleCount();
    this.restartSimulation();
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
