class LeftPanel {
  constructor(appcore) {
    this.sim = appcore.sim;
    this.theme = appcore.theme;
    this._pauseHint = KeybindCatalogue.getHint("cellular", "pause", "P/Space");
    this.keymapHint = KeybindCatalogue.getHint(
      "cellular",
      "keymapReference",
      "#",
    );
    this.panel = new AccordionPanel(
      15,
      15,
      Config.LEFT_PANEL_WIDTH,
      this.theme,
    );

    const statistics = new AccordionGroup("Statistics", false);
    statistics.addRow("fps", 20);
    statistics.addRow("time", 20);
    statistics.addRow("cells", 20);
    this.panel.addGroup(statistics);

    const simulation = new AccordionGroup("Simulation", false);
    simulation.addRow("particleCaption", 15);
    simulation.addRow("particleInput", 28);
    simulation.addRow("restart", 32);
    simulation.addRow("pause", 32);
    this.panel.addGroup(simulation);

    this.panel.recompute();

    this.restartButton = new Button(
      this.panel.contentX(),
      this.panel.getY("restart"),
      this.panel.contentW(),
      28,
      "Restart (R)",
      this.theme,
    );

    this.pauseButton = new Button(
      this.panel.contentX(),
      this.panel.getY("pause"),
      this.panel.contentW(),
      28,
      `Pause (${this._pauseHint})`,
      this.theme,
    );

    this.particleInputX = 0;
    this.particleInputY = 0;
    this.particleInputW = 0;
    this.input = null;

    this.cacheHitBoxes();
  }

  setInputHandler(input) {
    this.input = input;
  }

  render() {
    this.pauseButton.label = this.sim.isPaused()
      ? `Play (${this._pauseHint})`
      : `Pause (${this._pauseHint})`;

    this.panel.renderBackground();
    const px = this.panel.contentX();
    this.renderStatistics(px);
    this.renderSimulationControls(px);
    this.renderGraph();
    this.renderCredits();
  }

  renderStatistics(px) {
    if (this.panel.getGroup("Statistics").collapsed) {
      return;
    }

    const elapsed = this.sim.getElapsedSeconds();

    noStroke();
    fill(this.theme.textSecondary);
    textSize(this.theme.textSizeSecondary);
    textAlign(LEFT, TOP);
    text(`FPS: ${nf(frameRate(), 1, 1)}`, px, this.panel.getY("fps"));
    text(
      `Time Elapsed: ${this.formatTime(elapsed)}`,
      px,
      this.panel.getY("time"),
    );

    fill(this.theme.textPrimary);
    text(
      `Cell Population: ${this.sim.getCellPopulation()}`,
      px,
      this.panel.getY("cells"),
    );
  }

  renderSimulationControls(px) {
    if (this.panel.getGroup("Simulation").collapsed) {
      return;
    }

    noStroke();
    fill(this.theme.textMuted);
    textSize(this.theme.textSizeCaption);
    textAlign(LEFT, TOP);
    text(
      "Particles (restart to apply)",
      px,
      this.panel.getY("particleCaption"),
    );

    this.renderParticleInput(px);
    this.restartButton.render();
    this.pauseButton.render();
  }

  renderParticleInput(px) {
    const isTyping = this.input !== null && this.input.isTypingParticleCount();

    const iy = this.particleInputY;
    const iw = this.particleInputW;
    fill(isTyping ? this.theme.bgActive : this.theme.bgWidget);
    stroke(isTyping ? this.theme.strokeFocus : this.theme.strokeWidget);
    strokeWeight(this.theme.swWidget);
    rect(px, iy, iw, 24, 4);

    fill(this.theme.textPrimary);
    textSize(this.theme.textSizeSecondary);
    textAlign(LEFT, TOP);
    const render = isTyping
      ? `${this.input.getTypingBuffer()}_`
      : str(this.sim.getParticleCount());
    text(render, px + 8, iy + 5);
  }

  renderGraph() {
    const gh = 120;
    const gw = Config.LEFT_PANEL_WIDTH;
    const x0 = this.panel.x;
    const y0 = min(
      this.panel.y + this.panel.getTotalHeight() + 15,
      height - gh - 20,
    );

    noStroke();
    fill(this.theme.bgPanel);
    rect(x0, y0, gw, gh, 6);

    const history = this.sim.getCellHistory();
    if (history.length < 2) {
      return;
    }

    const maxValue = this.getMax(history);

    stroke(this.theme.strokeSeparator);
    strokeWeight(this.theme.swSeparator);
    line(x0 + 5, y0 + 5, x0 + 5, y0 + gh - 5);
    line(x0 + 5, y0 + gh - 5, x0 + gw - 5, y0 + gh - 5);

    fill(this.theme.textMuted);
    textSize(9);
    textAlign(RIGHT, CENTER);
    text("0", x0 - 4, y0 + gh - 5);
    text(str(maxValue), x0 - 4, y0 + 5);

    textAlign(CENTER, TOP);
    text("Cell population over time", x0 + gw / 2, y0 + gh);

    stroke(200, 80, 80);
    strokeWeight(1.5);
    noFill();
    beginShape();
    for (let i = 0; i < history.length; i++) {
      const vx = map(i, 0, history.length - 1, x0 + 5, x0 + gw - 5);
      const vy = map(history[i], 0, maxValue, y0 + gh - 5, y0 + 5);
      vertex(vx, vy);
    }
    endShape();
  }

  handleHeaderClick(mx, my) {
    if (this.panel.handleHeaderClick(mx, my)) {
      this.panel.recompute();
      this.cacheHitBoxes();
      this.restartButton.y = this.panel.getY("restart");
      this.pauseButton.y = this.panel.getY("pause");
      return true;
    }
    return false;
  }

  handleRestartClick(mx, my) {
    return (
      !this.panel.getGroup("Simulation").collapsed &&
      this.restartButton.isPressed(mx, my)
    );
  }

  handlePauseClick(mx, my) {
    return (
      !this.panel.getGroup("Simulation").collapsed &&
      this.pauseButton.isPressed(mx, my)
    );
  }

  handleParticleInputClick(mx, my) {
    return (
      !this.panel.getGroup("Simulation").collapsed &&
      mx > this.particleInputX &&
      mx < this.particleInputX + this.particleInputW &&
      my > this.particleInputY &&
      my < this.particleInputY + 22
    );
  }

  cacheHitBoxes() {
    this.particleInputX = this.panel.contentX();
    this.particleInputY = this.panel.getY("particleInput");
    this.particleInputW = this.panel.contentW();
  }

  formatTime(seconds) {
    return `${int(seconds / 3600)}h ${int((seconds / 60) % 60)}m ${int(seconds % 60)}s`;
  }

  getMax(list) {
    let maxValue = 0;
    for (const v of list) {
      maxValue = max(maxValue, v);
    }
    return maxValue;
  }

  renderKeymapReference() {
    push();
    fill(0, 220);
    noStroke();
    rect(0, 0, width, height);

    fill(255);
    textAlign(LEFT, TOP);
    let x = 50;
    let y = 50;
    const lineH = 28;

    textSize(28);
    text(`${metadata.name} ${metadata.version} Keymap Reference`, x, y);

    textSize(16);
    y += 50;
    text("Keys", x, y);
    text("Action", x + 230, y);

    stroke(255, 50);
    line(x, y + 25, width - 50, y + 25);
    y += 40;

    const sections = KeybindCatalogue.getSections("cellular");

    noStroke();
    for (const section of sections) {
      fill(180, 220, 255);
      text(section.title.toUpperCase(), x, y);
      y += lineH;

      stroke(255, 30);
      line(x, y - 6, width - 50, y - 6);
      noStroke();

      for (const cmd of section.entries) {
        fill(255);
        text(cmd[0], x, y);
        fill(255, 150);
        text(cmd[1], x + 230, y);
        y += lineH;
      }

      y += 10;
    }

    pop();
  }

  renderCredits() {
    const { name, version, author } = metadata;

    push();
    noStroke();
    fill(255, 170);
    textSize(12);
    textAlign(LEFT, BOTTOM);
    text(`Press ${this.keymapHint} to open keymap reference`, 12, height - 28);
    text(`${name} ${version} by ${author}`, 12, height - 12);
    pop();
  }
}
