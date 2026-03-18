class UIManager {
  constructor(appcore) {
    this.appcore = appcore;
    this.visible = true;
    this.renderKeymapRef = false;

    this.leftPanel = new LeftPanel(appcore);
    this.rightPanel = new RightPanel(appcore);
    this.inputHandler = new InputHandler(this, appcore.sim, this.leftPanel, this.rightPanel);

    this.leftPanel.setInputHandler(this.inputHandler);
    this.rightPanel.setInputHandler(this.inputHandler);
  }

  updateInput() {
    this.inputHandler.update();
  }

  render() {
    this.leftPanel.render();
    this.rightPanel.render();
    if (this.renderKeymapRef) {
      this.leftPanel.renderKeymapReference();
    }
  }

  onKeyPressed() {
    this.inputHandler.onKeyPressed();
  }

  toggleVisibility() {
    this.visible = !this.visible;
  }

  isVisible() {
    return this.visible;
  }

  toggleKeymapReference() {
    this.renderKeymapRef = !this.renderKeymapRef;
  }

  requestRestart() {
    this.appcore.restartSimulation();
  }

  toggleSimulationPause() {
    this.appcore.toggleSimulationPause();
  }
}