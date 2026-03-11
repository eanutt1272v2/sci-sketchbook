class InputHandler {
  private final UIManager ui;
  private final Simulation sim;
  private final LeftPanel leftPanel;
  private final RightPanel rightPanel;
  
  private boolean wasPressed = false;
  private int activeTypingParam = -1;
  private boolean typingParticleCount = false;
  private String typingBuffer = "";
  
  private int activeSlider = -1;
  
  InputHandler(UIManager ui, Simulation sim, LeftPanel leftPanel, RightPanel rightPanel) {
    this.ui = ui;
    this.sim = sim;
    this.leftPanel = leftPanel;
    this.rightPanel = rightPanel;
  }
  
  void update() {
    boolean isPressed = mousePressed;
    boolean justPressed = isPressed && !wasPressed;
    
    if (justPressed) {
      handlePress(mouseX, mouseY);
    } else if (isPressed) {
      handleDrag(mouseX, mouseY);
    } else if (wasPressed && !isPressed) {
      handleRelease();
    }
    
    wasPressed = isPressed;
  }
  
  void onKeyPressed() {
    if (isTyping()) {
      handleTypingKey();
    } else {
      handleShortcutKey();
    }
  }
  
  private boolean isTyping() {
    return activeTypingParam >= 0 || typingParticleCount;
  }
  
  private void handlePress(float mx, float my) {
    if (leftPanel.handleHeaderClick(mx, my)) return;
    if (rightPanel.handleHeaderClick(mx, my)) return;
    
    if (leftPanel.handleRestartClick(mx, my)) {
      commitTyping();
      ui.requestRestart();
      return;
    }
    
    if (leftPanel.handleParticleInputClick(mx, my)) {
      commitTyping();
      typingParticleCount = true;
      typingBuffer = str(sim.getParticleCount());
      return;
    }
    
    int clickedParam = rightPanel.handleValueClick(mx, my);
    if (clickedParam >= 0) {
      commitTyping();
      activeTypingParam = clickedParam;
      typingBuffer = nf(getParamValue(clickedParam), 1, 1);
      return;
    }
    
    int sliderParam = rightPanel.handleSliderPress(mx, my);
    if (sliderParam >= 0) {
      commitTyping();
      activeSlider = sliderParam;
      updateParamFromSlider(sliderParam, mx);
      return;
    }
    
    int minusParam = rightPanel.handleMinusClick(mx, my);
    if (minusParam >= 0) {
      commitTyping();
      adjustParam(minusParam, -getStepSize(minusParam));
      return;
    }
    
    int plusParam = rightPanel.handlePlusClick(mx, my);
    if (plusParam >= 0) {
      commitTyping();
      adjustParam(plusParam, getStepSize(plusParam));
      return;
    }
    
    commitTyping();
  }
  
  private void handleDrag(float mx, float my) {
    if (activeSlider >= 0) {
      updateParamFromSlider(activeSlider, mx);
    }
  }
  
  private void handleRelease() {
    activeSlider = -1;
    rightPanel.releaseSliders();
  }
  
  private void handleTypingKey() {
    if (key >= '0' && key <= '9') {
      typingBuffer += str(key);
    } else if (key == '.' && !typingBuffer.contains(".")) {
      typingBuffer += str('.');
    } else if (isBackspace() && typingBuffer.length() > 0) {
      typingBuffer = typingBuffer.substring(0, typingBuffer.length() - 1);
    } else if (keyCode == ENTER || keyCode == RETURN) {
      commitTyping();
    } else if (keyCode == ESC) {
      cancelTyping();
    }
  }
  
  private void handleShortcutKey() {
    if (key == 'h' || key == 'H') ui.toggleVisibility();
    if (key == 'r' || key == 'R') ui.requestRestart();
  }
  
  private void commitTyping() {
    if (typingBuffer.length() == 0) {
      cancelTyping();
      return;
    }
    
    if (typingParticleCount) {
      sim.setParticleCount(int(typingBuffer));
    } else if (activeTypingParam >= 0) {
      setParamValue(activeTypingParam, float(typingBuffer));
    }
    
    cancelTyping();
  }
  
  private void cancelTyping() {
    activeTypingParam = -1;
    typingParticleCount = false;
    typingBuffer = "";
  }
  
  private boolean isBackspace() {
    return key == BACKSPACE || keyCode == 8 || keyCode == 127;
  }
  
  private float getParamValue(int index) {
    switch (index) {
      case 0: return sim.getAlpha();
      case 1: return sim.getBeta();
      case 2: return sim.getGamma();
      case 3: return sim.getRadius();
      case 4: return sim.getTrailAlpha();
      case 5: return sim.getDensityThreshold();
      default: return 0;
    }
  }
  
  private void setParamValue(int index, float value) {
    switch (index) {
      case 0: sim.setAlpha(value); break;
      case 1: sim.setBeta(value); break;
      case 2: sim.setGamma(value); break;
      case 3: sim.setRadius(value); break;
      case 4: sim.setTrailAlpha(value); break;
      case 5: sim.setDensityThreshold((int) value); break;
    }
  }
  
  private void updateParamFromSlider(int index, float mx) {
    Slider slider = rightPanel.getSlider(index);
    float value = map(mx, slider.getX(), slider.getX() + slider.getWidth(), 
                      slider.getMin(), slider.getMax());
    setParamValue(index, value);
  }
  
  private void adjustParam(int index, float delta) {
    setParamValue(index, getParamValue(index) + delta);
  }
  
  private float getStepSize(int index) {
    return rightPanel.getStepSize(index);
  }
  
  boolean isTypingParticleCount() { return typingParticleCount; }
  boolean isTypingParam(int index) { return activeTypingParam == index; }
  String getTypingBuffer() { return typingBuffer; }
}