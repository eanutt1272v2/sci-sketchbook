class AppCore {
  final Simulation sim;
  final UIManager ui;
  final Theme theme;
  
  AppCore() {
    theme = new Theme();
    sim = new Simulation();
    ui = new UIManager(this);
    background(0);
  }
  
  void update() {
    ui.updateInput();
    sim.update();
  }
  
  void render() {
    sim.render();
    if (ui.isVisible()) {
      ui.render();
    }
  }
  
  void onKeyPressed() {
    ui.onKeyPressed();
  }
  
  void restartSimulation() {
    sim.requestRestart();
  }
  
  void toggleUI() {
    ui.toggleVisibility();
  }
}