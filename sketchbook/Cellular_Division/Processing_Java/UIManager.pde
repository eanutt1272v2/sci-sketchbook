class UIManager {
  private final AppCore appcore;
  private boolean visible = true;
  private boolean renderKeymapRef = false;
  
  private final LeftPanel leftPanel;
  private final RightPanel rightPanel;
  private final InputHandler inputHandler;
  
  UIManager(AppCore appcore) {
    this.appcore = appcore;
    this.leftPanel = new LeftPanel(appcore);
    this.rightPanel = new RightPanel(appcore);
    this.inputHandler = new InputHandler(this, appcore.sim, leftPanel, rightPanel);
    this.leftPanel.setInputHandler(inputHandler);
    this.rightPanel.setInputHandler(inputHandler);
  }
  
  void updateInput() {
    inputHandler.update();
  }
  
  void render() {
    leftPanel.render();
    rightPanel.render();
    if (renderKeymapRef) {
      leftPanel.renderKeymapReference();
    }
  }
  
  void onKeyPressed() {
    inputHandler.onKeyPressed();
  }
  
  void toggleVisibility() {
    visible = !visible;
  }
  
  boolean isVisible() { return visible; }

  void toggleKeymapReference() {
    renderKeymapRef = !renderKeymapRef;
  }
  
  void requestRestart() {
    appcore.restartSimulation();
  }

  void toggleSimulationPause() {
    appcore.toggleSimulationPause();
  }
}