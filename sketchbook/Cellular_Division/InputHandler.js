class InputHandler {
  constructor(ui, sim, leftPanel, rightPanel) {
    this.ui = ui;
    this.sim = sim;
    this.leftPanel = leftPanel;
    this.rightPanel = rightPanel;

    this.wasPressed = false;
    this.activeTypingParam = -1;
    this.typingParticleCount = false;
    this.typingBuffer = "";

    this.activeSlider = -1;
  }

  update() {
    const isPressed = mouseIsPressed;
    const justPressed = isPressed && !this.wasPressed;

    if (justPressed) {
      this.handlePress(mouseX, mouseY);
    } else if (isPressed) {
      this.handleDrag(mouseX);
    } else if (this.wasPressed && !isPressed) {
      this.handleRelease();
    }

    this.wasPressed = isPressed;
  }

  onKeyPressed() {
    if (this.isTyping()) {
      this.handleTypingKey();
    } else {
      this.handleShortcutKey();
    }
  }

  isTyping() {
    return this.activeTypingParam >= 0 || this.typingParticleCount;
  }

  handlePress(mx, my) {
    if (this.leftPanel.handleHeaderClick(mx, my)) {
      return;
    }
    if (this.rightPanel.handleHeaderClick(mx, my)) {
      return;
    }

    if (this.leftPanel.handleRestartClick(mx, my)) {
      this.commitTyping();
      this.ui.requestRestart();
      return;
    }

    if (this.leftPanel.handlePauseClick(mx, my)) {
      this.commitTyping();
      this.ui.toggleSimulationPause();
      return;
    }

    if (this.leftPanel.handleParticleInputClick(mx, my)) {
      this.commitTyping();
      this.typingParticleCount = true;
      this.typingBuffer = str(this.sim.getParticleCount());
      return;
    }

    const clickedParam = this.rightPanel.handleValueClick(mx, my);
    if (clickedParam >= 0) {
      this.commitTyping();
      this.activeTypingParam = clickedParam;
      this.typingBuffer = nf(this.getParamValue(clickedParam), 1, 1);
      return;
    }

    const sliderParam = this.rightPanel.handleSliderPress(mx, my);
    if (sliderParam >= 0) {
      this.commitTyping();
      this.activeSlider = sliderParam;
      this.updateParamFromSlider(sliderParam, mx);
      return;
    }

    const minusParam = this.rightPanel.handleMinusClick(mx, my);
    if (minusParam >= 0) {
      this.commitTyping();
      this.adjustParam(minusParam, -this.getStepSize(minusParam));
      return;
    }

    const plusParam = this.rightPanel.handlePlusClick(mx, my);
    if (plusParam >= 0) {
      this.commitTyping();
      this.adjustParam(plusParam, this.getStepSize(plusParam));
      return;
    }

    this.commitTyping();
  }

  handleDrag(mx) {
    if (this.activeSlider >= 0) {
      this.updateParamFromSlider(this.activeSlider, mx);
    }
  }

  handleRelease() {
    this.activeSlider = -1;
    this.rightPanel.releaseSliders();
  }

  handleTypingKey() {
    const keyValue = KeyboardUtils.normaliseKey(key);

    if (keyValue >= "0" && keyValue <= "9") {
      this.typingBuffer += keyValue;
    } else if (keyValue === "." && !this.typingBuffer.includes(".")) {
      this.typingBuffer += ".";
    } else if (this.isBackspace() && this.typingBuffer.length > 0) {
      this.typingBuffer = this.typingBuffer.substring(
        0,
        this.typingBuffer.length - 1,
      );
    } else if (keyCode === ENTER || keyCode === RETURN) {
      this.commitTyping();
    } else if (keyCode === 27 || keyCode === ESC) {
      this.cancelTyping();
    }
  }

  handleShortcutKey() {
    const keyValue = KeyboardUtils.normaliseKey(key);
    const keyLower = KeyboardUtils.toLower(keyValue);
    const shiftHeld = KeyboardUtils.isShiftHeld();

    if (this.ui.renderKeymapRef && keyValue !== "#") {
      return;
    }

    if (keyValue === "#") {
      this.ui.toggleKeymapReference();
      return;
    }

    if (shiftHeld && keyLower === "i") {
      this.ui.appcore.importParamsJSON();
      return;
    }

    if (shiftHeld && keyLower === "p") {
      this.ui.appcore.exportParamsJSON();
      return;
    }

    if (shiftHeld && keyLower === "j") {
      this.ui.appcore.exportStatisticsJSON();
      return;
    }

    if (shiftHeld && keyLower === "u") {
      this.ui.appcore.importStatisticsJSON();
      return;
    }

    if (shiftHeld && keyLower === "k") {
      this.ui.appcore.exportStatisticsCSV();
      return;
    }

    if (shiftHeld && keyLower === "s") {
      this.ui.appcore.exportStateJSON();
      return;
    }

    if (shiftHeld && keyLower === "o") {
      this.ui.appcore.importStateJSON();
      return;
    }

    if (keyLower === "h") {
      this.ui.toggleVisibility();
      return;
    }

    if (keyLower === "r") {
      this.ui.requestRestart();
      return;
    }

    if (keyLower === "p" || keyValue === " ") {
      this.ui.toggleSimulationPause();
      return;
    }
    const stepBoost = shiftHeld ? 10 : 1;
    switch (keyValue) {
      case "1":
        this.adjustParam(0, -this.getStepSize(0) * stepBoost);
        break;
      case "2":
        this.adjustParam(0, this.getStepSize(0) * stepBoost);
        break;
      case "3":
        this.adjustParam(1, -this.getStepSize(1) * stepBoost);
        break;
      case "4":
        this.adjustParam(1, this.getStepSize(1) * stepBoost);
        break;
      case "5":
        this.adjustParam(2, -this.getStepSize(2) * stepBoost);
        break;
      case "6":
        this.adjustParam(2, this.getStepSize(2) * stepBoost);
        break;
      case "7":
        this.adjustParam(3, -this.getStepSize(3) * stepBoost);
        break;
      case "8":
        this.adjustParam(3, this.getStepSize(3) * stepBoost);
        break;
      case "9":
        this.adjustParam(4, -this.getStepSize(4) * stepBoost);
        break;
      case "0":
        this.adjustParam(4, this.getStepSize(4) * stepBoost);
        break;
      case "-":
      case "_":
        this.adjustParam(5, -this.getStepSize(5) * stepBoost);
        break;
      case "=":
      case "+":
        this.adjustParam(5, this.getStepSize(5) * stepBoost);
        break;
      case "[":
      case "{":
        this.sim.setParticleCount(
          int(this.sim.getParticleCount() - 100 * stepBoost),
        );
        break;
      case "]":
      case "}":
        this.sim.setParticleCount(
          int(this.sim.getParticleCount() + 100 * stepBoost),
        );
        break;
      default:
        break;
    }
  }

  commitTyping() {
    if (this.typingBuffer.length === 0) {
      this.cancelTyping();
      return;
    }

    if (this.typingParticleCount) {
      this.sim.setParticleCount(int(this.typingBuffer));
    } else if (this.activeTypingParam >= 0) {
      this.setParamValue(this.activeTypingParam, float(this.typingBuffer));
    }

    this.cancelTyping();
  }

  cancelTyping() {
    this.activeTypingParam = -1;
    this.typingParticleCount = false;
    this.typingBuffer = "";
  }

  isBackspace() {
    return keyCode === BACKSPACE || keyCode === DELETE;
  }

  getParamValue(index) {
    switch (index) {
      case 0:
        return this.sim.getAlpha();
      case 1:
        return this.sim.getBeta();
      case 2:
        return this.sim.getGamma();
      case 3:
        return this.sim.getRadius();
      case 4:
        return this.sim.getTrailAlpha();
      case 5:
        return this.sim.getDensityThreshold();
      default:
        return 0;
    }
  }

  setParamValue(index, value) {
    switch (index) {
      case 0:
        this.sim.setAlpha(value);
        break;
      case 1:
        this.sim.setBeta(value);
        break;
      case 2:
        this.sim.setGamma(value);
        break;
      case 3:
        this.sim.setRadius(value);
        break;
      case 4:
        this.sim.setTrailAlpha(value);
        break;
      case 5:
        this.sim.setDensityThreshold(int(value));
        break;
      default:
        break;
    }
  }

  updateParamFromSlider(index, mx) {
    const slider = this.rightPanel.getSlider(index);
    const value = map(
      mx,
      slider.getX(),
      slider.getX() + slider.getWidth(),
      slider.getMin(),
      slider.getMax(),
    );
    this.setParamValue(index, value);
  }

  adjustParam(index, delta) {
    this.setParamValue(index, this.getParamValue(index) + delta);
  }

  getStepSize(index) {
    return this.rightPanel.getStepSize(index);
  }

  isTypingParticleCount() {
    return this.typingParticleCount;
  }

  isTypingParam(index) {
    return this.activeTypingParam === index;
  }

  getTypingBuffer() {
    return this.typingBuffer;
  }
}
