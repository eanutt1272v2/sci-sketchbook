class UIPanel {
  constructor(appcore) {
    this.appcore = appcore;

    this.PANEL_W = 390;

    this.layout = new UILayout(10, 10, this.PANEL_W, 12, 5, 18);
    this.layout.add("iterLabel", 20, "panel");
    this.layout.add("iterSlider", 18, "panel");
    this.layout.add("stepButtons", 30, "panel");
    this.layout.add("zoomInfo", 19, "panel");
    this.layout.add("posInfo", 19, "panel");
    this.layout.add("hints", 15, "panel");
    this.layout.add("colorMap", 28, "panel");
    this.layout.finish();

    this.slider = new Slider(
      this.layout.contentX(),
      this.layout.getY("iterSlider"),
      this.layout.contentW(),
      18,
      1,
      512,
      this.appcore.maxIterations,
      this.appcore.theme,
    );

    const stepLabels = ["--", "-", "+", "++"];
    const stepY = this.layout.getY("stepButtons");
    this.stepButtons = new Array(4);
    for (let i = 0; i < 4; i++) {
      this.stepButtons[i] = new Button(
        this.layout.contentX() + i * 36,
        stepY,
        28,
        28,
        stepLabels[i],
        this.appcore.theme,
      );
    }

    this.dropdown = new Dropdown(
      this.layout.contentX(),
      this.layout.getY("colorMap"),
      180,
      26,
      this.appcore.renderer.mapNames,
      this.appcore.theme,
    );
    this.exportBtn = new Button(
      width - 80,
      height - 220,
      56,
      56,
      "PNG",
      this.appcore.theme,
    );
    this.zoomInBtn = new Button(
      width - 80,
      height - 150,
      56,
      56,
      "+",
      this.appcore.theme,
    );
    this.zoomOutBtn = new Button(
      width - 80,
      height - 80,
      56,
      56,
      "-",
      this.appcore.theme,
    );
  }

  draw() {
    const t = this.appcore.theme;
    colorMode(RGB, 255);

    fill(t.bgPanel);
    stroke(t.strokePanel);
    strokeWeight(t.swPanel);
    rect(
      this.layout.x,
      this.layout.y,
      this.PANEL_W,
      this.layout.totalHeight,
      4,
    );

    for (const sy of this.layout.separatorYs()) {
      stroke(t.strokeSeparator);
      strokeWeight(t.swSeparator);
      line(
        this.layout.contentX(),
        sy,
        this.layout.x + this.PANEL_W - this.layout.padding,
        sy,
      );
    }

    const px = this.layout.contentX();

    const inp = this.appcore.input;
    const iterText = inp.isTypingIter
      ? `Input: ${inp.typingBuffer}_`
      : `Iterations: ${this.appcore.maxIterations}`;
    noStroke();
    fill(t.textPrimary);
    textSize(t.textSizePrimary);
    textAlign(LEFT, TOP);
    text(iterText, px, this.layout.getY("iterLabel"));

    if (!inp.isTypingIter) {
      fill(t.textMuted);
      textSize(t.textSizeCaption);
      text("(click to type)", px + 155, this.layout.getY("iterLabel") + 3);
    }

    this.slider.display();

    for (const b of this.stepButtons) {
      b.display();
    }

    noStroke();
    fill(t.textSecondary);
    textSize(t.textSizeSecondary);
    textAlign(LEFT, TOP);

    const zr = this.format3dp(this.appcore.zoom);
    const xr = this.format3dp(this.appcore.offsetX);
    const yr = this.format3dp(-this.appcore.offsetY);

    text(`Zoom: ${zr}x`, px, this.layout.getY("zoomInfo"));
    text(`Position: X=${xr}, Y=${yr}`, px, this.layout.getY("posInfo"));

    fill(t.textMuted);
    textSize(t.textSizeCaption);
    text(
      "[WASD/Arrows]: Pan, [Q/E, Scroll]: Zoom, [P]: PNG, [#]: Keymap",
      px,
      this.layout.getY("hints"),
    );

    this.dropdown.display(this.appcore.renderer.currentMapIndex);

    this.exportBtn.display();
    this.zoomInBtn.display();
    this.zoomOutBtn.display();
    this.renderCredits();
  }

  format3dp(value) {
    const rounded = Math.round(value * 1000.0) / 1000.0;
    const sign = rounded < 0 ? "-" : "";
    const absRounded = Math.abs(rounded);

    let whole = Math.floor(absRounded);
    let frac = Math.round((absRounded - whole) * 1000.0);
    if (frac === 1000) {
      whole += 1;
      frac = 0;
    }

    const wholeStr = String(whole);
    const fracStr = `${frac < 10 ? "00" : frac < 100 ? "0" : ""}${frac}`;
    return `${sign}${wholeStr}.${fracStr}`;
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
    text("Action", x + 240, y);
    stroke(255, 50);
    line(x, y + 25, width - 50, y + 25);
    y += 40;

    const commands = [
      ["W/A/S/D or Arrow Keys", "Pan viewport"],
      ["Q / E, Mouse Wheel", "Zoom out / in"],
      ["[ / ]", "Iterations -16 / +16"],
      ["{ / }", "Iterations -64 / +64"],
      ["1..9", "Select colour map by index"],
      ["X / C", "Previous / next colour map"],
      ["P", "Export PNG image"],
      ["R", "Reset view and iterations"],
      ["H", "Toggle UI"],
      ["#", "Toggle keymap reference"],
    ];

    noStroke();
    for (const cmd of commands) {
      fill(255);
      text(cmd[0], x, y);
      fill(255, 150);
      text(cmd[1], x + 240, y);
      y += lineH;
    }

    pop();
  }

  renderCredits() {
    push();
    noStroke();
    fill(255, 170);
    textSize(12);
    textAlign(LEFT, BOTTOM);
    text(
      `${metadata.name} ${metadata.version} by ${metadata.author}`,
      12,
      height - 12,
    );
    pop();
  }
}
