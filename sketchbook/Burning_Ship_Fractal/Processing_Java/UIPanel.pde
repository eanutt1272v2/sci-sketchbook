class UIPanel {
  AppCore appcore;
  UILayout layout;
  Slider slider;
  Dropdown dropdown;
  Button zoomInBtn, zoomOutBtn;
  Button[] stepButtons = new Button[4];

  static final int PANEL_W = 390;

  UIPanel(AppCore appcore) {
    this.appcore = appcore;

    layout = new UILayout(10, 10, PANEL_W, 12, 5, 18);
    layout.add("iterLabel", 20, "panel");
    layout.add("iterSlider", 18, "panel");
    layout.add("stepButtons", 30, "panel");
    layout.add("zoomInfo", 19, "panel");
    layout.add("posInfo", 19, "panel");
    layout.add("hints", 15, "panel");
    layout.add("colorMap", 28, "panel");
    layout.finish();

    slider = new Slider(
      layout.contentX(), layout.getY("iterSlider"),
      layout.contentW(), 18, 1, 512, appcore.maxIterations, appcore.theme
    );

    String[] stepLabels = {"--", "-", "+", "++"};
    float stepY = layout.getY("stepButtons");
    for (int i = 0; i < 4; i++) {
      stepButtons[i] = new Button(layout.contentX() + i * 36, stepY, 28, 28, stepLabels[i], appcore.theme);
    }

    dropdown = new Dropdown(layout.contentX(), layout.getY("colorMap"), 180, 26, appcore.renderer.mapNames, appcore.theme);
    zoomInBtn = new Button(width - 80, height - 150, 56, 56, "+", appcore.theme);
    zoomOutBtn = new Button(width - 80, height - 80, 56, 56, "-", appcore.theme);
  }

  void draw() {
    UITheme t = appcore.theme;
    colorMode(RGB, 255);

    fill(t.bgPanel);
    stroke(t.strokePanel);
    strokeWeight(t.swPanel);
    rect(layout.x, layout.y, PANEL_W, layout.totalHeight, 4);

    for (float sy : layout.separatorYs()) {
      stroke(t.strokeSeparator);
      strokeWeight(t.swSeparator);
      line(layout.contentX(), sy, layout.x + PANEL_W - layout.padding, sy);
    }

    float px = layout.contentX();

    InputHandler inp = appcore.input;
    String iterText = inp.isTypingIter
      ? "Input: " + inp.typingBuffer + "_"
      : "Iterations: " + appcore.maxIterations;
    fill(t.textPrimary);
    textSize(t.textSizePrimary);
    textAlign(LEFT, TOP);
    text(iterText, px, layout.getY("iterLabel"));

    if (!inp.isTypingIter) {
      fill(t.textMuted);
      textSize(t.textSizeCaption);
      text("(click to type)", px + 105, layout.getY("iterLabel") + 3);
    }

    slider.display();

    for (Button b : stepButtons) b.display();

    fill(t.textSecondary);
    textSize(t.textSizeSecondary);
    textAlign(LEFT, TOP);

    String zr = format3dp(appcore.zoom);
    String xr = format3dp(appcore.offsetX);
    String yr = format3dp(-appcore.offsetY);

    text("Zoom: " + zr + "x", px, layout.getY("zoomInfo"));
    text("Position: X=" + xr + ", Y=" + yr, px, layout.getY("posInfo"));

    fill(t.textMuted);
    textSize(t.textSizeCaption);
    text("[WASD/Arrows]: Pan, [Scroll/Q,E]: Zoom, [H]: Toggle UI", px, layout.getY("hints"));

    dropdown.display(appcore.renderer.currentMapIndex);

    zoomInBtn.display();
    zoomOutBtn.display();
  }

  String format3dp(double value) {
    double rounded = Math.round(value * 1000.0) / 1000.0;
    String sign = rounded < 0 ? "-" : "";
    double absRounded = Math.abs(rounded);

    double whole = Math.floor(absRounded);
    int frac = (int) Math.round((absRounded - whole) * 1000.0);
    if (frac == 1000) {
      whole += 1;
      frac = 0;
    }

    String wholeStr = "" + whole;
    int dot = wholeStr.indexOf('.');
    if (dot != -1) wholeStr = wholeStr.substring(0, dot);

    String fracStr = (frac < 10 ? "00" : (frac < 100 ? "0" : "")) + frac;
    return sign + wholeStr + "." + fracStr;
  }
}