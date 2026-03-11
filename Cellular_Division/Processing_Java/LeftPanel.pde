class LeftPanel {
  private final Simulation sim;
  private final Theme theme;
  private final AccordionPanel panel;
  private final Button restartButton;
  
  private float particleInputX, particleInputY, particleInputW;
  private InputHandler input;
  
  LeftPanel(AppCore appcore) {
    this.sim = appcore.sim;
    this.theme = appcore.theme;
    this.panel = new AccordionPanel(15, 15, Config.LEFT_PANEL_WIDTH, theme);
    
    AccordionGroup stats = new AccordionGroup("Statistics", false);
    stats.addRow("fps", 20);
    stats.addRow("time", 20);
    stats.addRow("cells", 20);
    panel.addGroup(stats);
    
    AccordionGroup simulation = new AccordionGroup("Simulation", false);
    simulation.addRow("particleCaption", 15);
    simulation.addRow("particleInput", 28);
    simulation.addRow("restart", 32);
    panel.addGroup(simulation);
    
    panel.recompute();
    
    restartButton = new Button(
      panel.contentX(), panel.getY("restart"),
      panel.contentW(), 28, "Restart Simulation", theme
    );
    
    cacheHitBoxes();
  }
  
  void setInputHandler(InputHandler input) {
    this.input = input;
  }
  
  void render() {
    panel.recompute();
    cacheHitBoxes();
    restartButton.y = panel.getY("restart");
    
    panel.drawBackground();
    float px = panel.contentX();
    
    renderStatistics(px);
    renderSimulationControls(px);
    renderGraph();
  }
  
  private void renderStatistics(float px) {
    if (panel.getGroup("Statistics").collapsed) return;
    
    int elapsed = sim.getElapsedSeconds();
    
    fill(theme.textSecondary);
    textSize(theme.textSizeSecondary);
    textAlign(LEFT, TOP);
    text("FPS: " + nf(frameRate, 1, 1), px, panel.getY("fps"));
    text("Time Elapsed: " + formatTime(elapsed), px, panel.getY("time"));
    
    fill(theme.textPrimary);
    text("Cell Population: " + sim.getCellPopulation(), px, panel.getY("cells"));
  }
  
  private void renderSimulationControls(float px) {
    if (panel.getGroup("Simulation").collapsed) return;
    
    fill(theme.textMuted);
    textSize(theme.textSizeCaption);
    textAlign(LEFT, TOP);
    text("Particles (restart to apply)", px, panel.getY("particleCaption"));
    
    renderParticleInput(px);
    restartButton.display();
  }
  
  private void renderParticleInput(float px) {
    boolean isTyping = input != null && input.isTypingParticleCount();
    
    float iy = particleInputY, iw = particleInputW;
    fill(isTyping ? theme.bgActive : theme.bgWidget);
    stroke(isTyping ? theme.strokeFocus : theme.strokeWidget);
    strokeWeight(theme.swWidget);
    rect(px, iy, iw, 24, 4);
    
    fill(theme.textPrimary);
    textSize(theme.textSizeSecondary);
    textAlign(LEFT, TOP);
    String display = isTyping ? input.getTypingBuffer() + "_" : str(sim.getParticleCount());
    text(display, px + 8, iy + 5);
  }
  
  private void renderGraph() {
    float gh = 120, gw = Config.LEFT_PANEL_WIDTH;
    float x0 = panel.x;
    float y0 = min(panel.y + panel.getTotalHeight() + 15, height - gh - 20);

    noStroke();
    fill(theme.bgPanel);
    rect(x0, y0, gw, gh, 6);

    ArrayList<Integer> history = sim.getCellHistory();
    if (history.size() < 2) return;

    int maxValue = this.getMax(history); 

    stroke(theme.strokeSeparator);
    strokeWeight(theme.swSeparator);
    line(x0 + 5, y0 + 5, x0 + 5, y0 + gh - 5);
    line(x0 + 5, y0 + gh - 5, x0 + gw - 5, y0 + gh - 5);

    fill(theme.textMuted);
    textSize(9);
    textAlign(RIGHT, CENTER);
    text("0", x0 - 4, y0 + gh - 5);
    text(str(maxValue), x0 - 4, y0 + 5);

    textAlign(CENTER, TOP);
    text("Cell population over time", x0 + gw / 2, y0 + gh);

    stroke(200, 80, 80);
    strokeWeight(1.5f);
    noFill();
    beginShape();
    for (int i = 0; i < history.size(); i++) {
      float vx = map(i, 0, history.size() - 1, x0 + 5, x0 + gw - 5);
      float vy = map(history.get(i), 0, maxValue, y0 + gh - 5, y0 + 5);
      vertex(vx, vy);
    }
    endShape();
  }

  boolean handleHeaderClick(float mx, float my) {
    if (panel.handleHeaderClick(mx, my)) {
      panel.recompute();
      return true;
    }
    return false;
  }
  
  boolean handleRestartClick(float mx, float my) {
    return !panel.getGroup("Simulation").collapsed && restartButton.isPressed(mx, my);
  }
  
  boolean handleParticleInputClick(float mx, float my) {
    return !panel.getGroup("Simulation").collapsed 
        && mx > particleInputX && mx < particleInputX + particleInputW
        && my > particleInputY && my < particleInputY + 22;
  }
  
  private void cacheHitBoxes() {
    particleInputX = panel.contentX();
    particleInputY = panel.getY("particleInput");
    particleInputW = panel.contentW();
  }
  
  private String formatTime(int seconds) {
    return int(seconds / 3600) + "h " + int((seconds / 60) % 60) + "m " + int(seconds % 60) + "s";
  }
  
  // call this reference instead to get max for graph
  private int getMax(ArrayList<Integer> list) {
    int _max = 0;
    for (int v : list) _max = max(_max, v);
    return _max;
  }
}

