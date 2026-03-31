class ParameterSet {
  constructor(sim, theme) {
    this.sim = sim;
    this.theme = theme;

    this.labels = [
      "Alpha α (1/2)",
      "Beta β (3/4)",
      "Gamma γ (5/6)",
      "Radius r (7/8)",
      "Trail Alpha τ (9/0)",
      "Density ρ (−/=)",
    ];
    this.mins = [0, 0, 0, 5, 0, 1];
    this.maxes = [360, 90, 50, 50, 255, 60];
    this.steps = [1, 1, 0.1, 1, 5, 1];

    this.sliders = new Array(6);
    this.minusButtons = new Array(6);
    this.plusButtons = new Array(6);
    this.valueX = new Array(6).fill(0);
    this.valueY = new Array(6).fill(0);
  }

  getLabel(index) {
    return this.labels[index];
  }

  getStepSize(index) {
    return this.steps[index];
  }

  getSlider(index) {
    return this.sliders[index];
  }

  buildWidgets(columns) {
    const values = this.getCurrentValues();

    for (let p = 0; p < 6; p++) {
      const panel = columns[p < 3 ? 0 : 1];
      const sx = panel.contentX();
      const sw = panel.contentW();
      const sy = panel.getY(`slider${p}`);
      const by = panel.getY(`steps${p}`);
      const vy = panel.getY(`val${p}`);
      const btnSize = 28;

      this.sliders[p] = new SliderComponent(
        sx,
        sy,
        sw,
        20,
        this.mins[p],
        this.maxes[p],
        values[p],
        this.theme,
      );
      this.minusButtons[p] = new Button(
        sx,
        by,
        btnSize,
        btnSize,
        "-",
        this.theme,
      );
      this.plusButtons[p] = new Button(
        sx + 38,
        by,
        btnSize,
        btnSize,
        "+",
        this.theme,
      );

      this.valueX[p] =
        panel.x + panel.w - panel.padding - Config.VALUE_BOX_WIDTH;
      this.valueY[p] = vy;
    }
  }

  rebuildWidgets(columns) {
    for (let p = 0; p < 6; p++) {
      const panel = columns[p < 3 ? 0 : 1];
      const sx = panel.contentX();
      const sw = panel.contentW();
      const sy = panel.getY(`slider${p}`);
      const by = panel.getY(`steps${p}`);

      this.sliders[p].x = sx;
      this.sliders[p].y = sy;
      this.sliders[p].w = sw;
      this.minusButtons[p].x = sx;
      this.minusButtons[p].y = by;
      this.plusButtons[p].x = sx + 38;
      this.plusButtons[p].y = by;

      this.valueX[p] =
        panel.x + panel.w - panel.padding - Config.VALUE_BOX_WIDTH;
      this.valueY[p] = panel.getY(`val${p}`);
    }
  }

  render(columns, input) {
    const values = this.getCurrentValues();

    for (let p = 0; p < 6; p++) {
      const panel = columns[p < 3 ? 0 : 1];
      if (panel.getGroup(this.labels[p]).collapsed) {
        continue;
      }

      const isTyping = input !== null && input.isTypingParam(p);
      const vy = this.valueY[p];

      fill(this.theme.textMuted);
      textSize(this.theme.textSizeCaption);
      textAlign(LEFT, TOP);
      noStroke();
      text("Value:", panel.contentX(), vy + 2);

      fill(isTyping ? this.theme.bgActive : this.theme.bgWidget);
      stroke(isTyping ? this.theme.strokeFocus : this.theme.strokeWidget);
      strokeWeight(isTyping ? this.theme.swWidget : 0.8);
      rect(
        this.valueX[p],
        vy,
        Config.VALUE_BOX_WIDTH,
        Config.VALUE_BOX_HEIGHT,
        3,
      );

      fill(isTyping ? this.theme.textPrimary : this.theme.textSecondary);
      textSize(this.theme.textSizeCaption);
      textAlign(RIGHT, TOP);
      const render =
        input !== null && isTyping
          ? `${input.getTypingBuffer()}_`
          : nf(values[p], 1, 1);
      text(render, this.valueX[p] + Config.VALUE_BOX_WIDTH - 5, vy + 2);

      this.sliders[p].val = constrain(values[p], this.mins[p], this.maxes[p]);
      this.sliders[p].render();
      this.minusButtons[p].render();
      this.plusButtons[p].render();
    }
  }

  handleValueClick(columns, mx, my) {
    for (let p = 0; p < 6; p++) {
      const panel = columns[p < 3 ? 0 : 1];
      if (panel.getGroup(this.labels[p]).collapsed) {
        continue;
      }

      if (
        mx > this.valueX[p] &&
        mx < this.valueX[p] + Config.VALUE_BOX_WIDTH &&
        my > this.valueY[p] &&
        my < this.valueY[p] + Config.VALUE_BOX_HEIGHT
      ) {
        return p;
      }
    }
    return -1;
  }

  handleSliderPress(mx, my) {
    for (let p = 0; p < 6; p++) {
      if (this.sliders[p].isPressed(mx, my)) {
        this.sliders[p].locked = true;
        return p;
      }
    }
    return -1;
  }

  handleMinusClick(mx, my) {
    for (let p = 0; p < 6; p++) {
      if (this.minusButtons[p].isPressed(mx, my)) {
        return p;
      }
    }
    return -1;
  }

  handlePlusClick(mx, my) {
    for (let p = 0; p < 6; p++) {
      if (this.plusButtons[p].isPressed(mx, my)) {
        return p;
      }
    }
    return -1;
  }

  releaseSliders() {
    for (const s of this.sliders) {
      if (s !== null) {
        s.locked = false;
      }
    }
  }

  getCurrentValues() {
    return [
      this.sim.getAlpha(),
      this.sim.getBeta(),
      this.sim.getGamma(),
      this.sim.getRadius(),
      this.sim.getTrailAlpha(),
      this.sim.getDensityThreshold(),
    ];
  }
}
