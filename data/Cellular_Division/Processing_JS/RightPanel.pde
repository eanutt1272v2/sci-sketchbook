class RightPanel {
  private final Simulation sim;
  private final Theme theme;
  private final AccordionPanel[] columns = new AccordionPanel[2];
  private final ParameterSet params;
  private InputHandler input;
  
  RightPanel(AppCore appcore) {
    this.sim = appcore.sim;
    this.theme = appcore.theme;
    this.params = new ParameterSet(sim, theme);
    
    int totalWidth = Config.RIGHT_COLUMN_WIDTH * 2 + Config.COLUMN_GAP;
    int startX = width - totalWidth - 15;
    
    for (int col = 0; col < 2; col++) {
      int x = startX + col * (Config.RIGHT_COLUMN_WIDTH + Config.COLUMN_GAP);
      columns[col] = new AccordionPanel(x, 15, Config.RIGHT_COLUMN_WIDTH, theme);
      
      for (int pi = col * 3; pi < col * 3 + 3; pi++) {
        AccordionGroup grp = new AccordionGroup(params.getLabel(pi), false);
        grp.addRow("val" + pi, 16);
        grp.addRow("slider" + pi, 22);
        grp.addRow("steps" + pi, 30);
        columns[col].addGroup(grp);
      }
      columns[col].recompute();
    }
    
    params.buildWidgets(columns);
  }
  
  void setInputHandler(InputHandler input) {
    this.input = input;
  }
  
  void render() {
    for (AccordionPanel col : columns) {
      col.recompute();
      col.drawBackground();
    }
    params.rebuildWidgets(columns);
    params.render(columns, input);
  }
  
  boolean handleHeaderClick(float mx, float my) {
    for (AccordionPanel col : columns) {
      if (col.handleHeaderClick(mx, my)) {
        col.recompute();
        return true;
      }
    }
    return false;
  }
  
  int handleValueClick(float mx, float my) {
    return params.handleValueClick(columns, mx, my);
  }
  
  int handleSliderPress(float mx, float my) {
    return params.handleSliderPress(mx, my);
  }
  
  int handleMinusClick(float mx, float my) {
    return params.handleMinusClick(mx, my);
  }
  
  int handlePlusClick(float mx, float my) {
    return params.handlePlusClick(mx, my);
  }
  
  void releaseSliders() {
    params.releaseSliders();
  }
  
  SliderComponent getSlider(int index) {
    return params.getSlider(index);
  }
  
  float getStepSize(int index) {
    return params.getStepSize(index);
  }
}