class UIManager {
  private boolean visible = true;
  
  private final LeftPanel leftPanel;
  private final RightPanel rightPanel;
  private final InputHandler inputHandler;
  
  UIManager(AppCore appcore) {
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
  }
  
  void onKeyPressed() {
    inputHandler.onKeyPressed();
  }
  
  void toggleVisibility() {
    visible = !visible;
  }
  
  boolean isVisible() { return visible; }
  
  void requestRestart() {
    appcore.restartSimulation();
  }
}
