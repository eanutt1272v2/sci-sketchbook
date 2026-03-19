class AppCore {
  constructor() {
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
