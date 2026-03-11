class UIManager {
  private final App app;
  private boolean visible = true;
  
  private final LeftPanel leftPanel;
  private final RightPanel rightPanel;
  private final InputHandler inputHandler;
  
  UIManager(App app) {
    this.app = app;
    this.leftPanel = new LeftPanel(app);
    this.rightPanel = new RightPanel(app);
    this.inputHandler = new InputHandler(this, app.sim, leftPanel, rightPanel);
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
    app.restartSimulation();
  }
}