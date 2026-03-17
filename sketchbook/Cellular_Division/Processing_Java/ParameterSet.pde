class ParameterSet {
  private final Simulation sim;
  private final Theme theme;
  
  private final String[] labels = {
    "Alpha",
    "Beta",
    "Gamma", 
    "Radius",
    "Trail Alpha",
    "Density Threshold"
  };
  private final float[] mins = {0, 0, 0, 5, 0, 1};
  private final float[] maxes = {360, 90, 50, 50, 255, 60};
  private final float[] steps = {1, 1, 0.1f, 1, 5, 1};
  
  private final SliderComponent[] sliders = new SliderComponent[6];
  private final Button[] minusButtons = new Button[6];
  private final Button[] plusButtons = new Button[6];
  private final float[] valueX = new float[6];
  private final float[] valueY = new float[6];
  
  ParameterSet(Simulation sim, Theme theme) {
    this.sim = sim;
    this.theme = theme;
  }
  
  String getLabel(int index) { return labels[index]; }
  float getStepSize(int index) { return steps[index]; }
  SliderComponent getSlider(int index) { return sliders[index]; }
  
  void buildWidgets(AccordionPanel[] columns) {
    float[] values = getCurrentValues();
    
    for (int p = 0; p < 6; p++) {
      AccordionPanel panel = columns[p < 3 ? 0 : 1];
      float sx = panel.contentX();
      float sw = panel.contentW();
      float sy = panel.getY("slider" + p);
      float by = panel.getY("steps" + p);
      float vy = panel.getY("val" + p);
      float btnSize = 28;
      
      sliders[p] = new SliderComponent(sx, sy, sw, 20, mins[p], maxes[p], values[p], theme);
      minusButtons[p] = new Button(sx, by, btnSize, btnSize, "-", theme);
      plusButtons[p] = new Button(sx + 38, by, btnSize, btnSize, "+", theme);
      
      valueX[p] = panel.x + panel.w - panel.padding - Config.VALUE_BOX_WIDTH;
      valueY[p] = vy;
    }
  }
  
  void rebuildWidgets(AccordionPanel[] columns) {
    for (int p = 0; p < 6; p++) {
      AccordionPanel panel = columns[p < 3 ? 0 : 1];
      float sx = panel.contentX();
      float sw = panel.contentW();
      float sy = panel.getY("slider" + p);
      float by = panel.getY("steps" + p);
      
      sliders[p].x = sx;
      sliders[p].y = sy;
      sliders[p].w = sw;
      minusButtons[p].x = sx;
      minusButtons[p].y = by;
      plusButtons[p].x = sx + 38;
      plusButtons[p].y = by;
      
      valueX[p] = panel.x + panel.w - panel.padding - Config.VALUE_BOX_WIDTH;
      valueY[p] = panel.getY("val" + p);
    }
  }
  
  void render(AccordionPanel[] columns, InputHandler input) {
    float[] values = getCurrentValues();
    
    for (int p = 0; p < 6; p++) {
      AccordionPanel panel = columns[p < 3 ? 0 : 1];
      if (panel.getGroup(labels[p]).collapsed) continue;
      
      boolean isTyping = input != null && input.isTypingParam(p);
      float vy = valueY[p];
      
      fill(theme.textMuted);
      textSize(theme.textSizeCaption);
      textAlign(LEFT, TOP);
      noStroke();
      text("Value:", panel.contentX(), vy + 2);
      
      fill(isTyping ? theme.bgActive : theme.bgWidget);
      stroke(isTyping ? theme.strokeFocus : theme.strokeWidget);
      strokeWeight(isTyping ? theme.swWidget : 0.8f);
      rect(valueX[p], vy, Config.VALUE_BOX_WIDTH, Config.VALUE_BOX_HEIGHT, 3);
      
      fill(isTyping ? theme.textPrimary : theme.textSecondary);
      textSize(theme.textSizeCaption);
      textAlign(RIGHT, TOP);
      String display = (input != null && isTyping) ? input.getTypingBuffer() + "_" : nf(values[p], 1, 1);
      text(display, valueX[p] + Config.VALUE_BOX_WIDTH - 5, vy + 2);
      sliders[p].val = constrain(values[p], mins[p], maxes[p]);
      sliders[p].display();
      minusButtons[p].display();
      plusButtons[p].display();
    }
  }
  
  int handleValueClick(AccordionPanel[] columns, float mx, float my) {
    for (int p = 0; p < 6; p++) {
      AccordionPanel panel = columns[p < 3 ? 0 : 1];
      if (panel.getGroup(labels[p]).collapsed) continue;
      
      if (mx > valueX[p] && mx < valueX[p] + Config.VALUE_BOX_WIDTH
          && my > valueY[p] && my < valueY[p] + Config.VALUE_BOX_HEIGHT) {
        return p;
      }
    }
    return -1;
  }
  
  int handleSliderPress(float mx, float my) {
    for (int p = 0; p < 6; p++) {
      if (sliders[p].isPressed(mx, my)) {
        sliders[p].locked = true;
        return p;
      }
    }
    return -1;
  }
  
  int handleMinusClick(float mx, float my) {
    for (int p = 0; p < 6; p++) {
      if (minusButtons[p].isPressed(mx, my)) return p;
    }
    return -1;
  }
  
  int handlePlusClick(float mx, float my) {
    for (int p = 0; p < 6; p++) {
      if (plusButtons[p].isPressed(mx, my)) return p;
    }
    return -1;
  }
  
  void releaseSliders() {
    for (SliderComponent s : sliders) {
      if (s != null) s.locked = false;
    }
  }
  
  private float[] getCurrentValues() {
    return new float[]{
      sim.getAlpha(), sim.getBeta(), sim.getGamma(),
      sim.getRadius(), sim.getTrailAlpha(), sim.getDensityThreshold()
    };
  }
}

