class UIPanel {
  AppCore appcore;
  UILayout layout;
  Slider slider;
  Dropdown dropdown;
  Button exportBtn, zoomInBtn, zoomOutBtn;
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

    slider = new Slider(layout.contentX(), layout.getY("iterSlider"), layout.contentW(), 18, 1, 512, appcore.maxIterations, appcore.theme);

    String[] stepLabels = {"--", "-", "+", "++"};
    float stepY = layout.getY("stepButtons");
    for (int i = 0; i < 4; i++) {
      stepButtons[i] = new Button(layout.contentX() + i * 36, stepY, 28, 28, stepLabels[i], appcore.theme);
    }

    dropdown = new Dropdown(layout.contentX(), layout.getY("colorMap"), 180, 26, appcore.renderer.mapNames, appcore.theme);
    exportBtn = new Button(width - 80, height - 220, 56, 56, "PNG", appcore.theme);
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
    String iterText = inp.isTypingIter ? "Input: " + inp.typingBuffer + "_" : "Iterations: " + appcore.maxIterations;
    fill(t.textPrimary);
    textSize(t.textSizePrimary);
    textAlign(LEFT, TOP);
    text(iterText, px, layout.getY("iterLabel"));

    if (!inp.isTypingIter) {
      fill(t.textMuted);
      textSize(t.textSizeCaption);
      text("(click to type)", px + 160, layout.getY("iterLabel") + 3);
    }

    slider.display();

    for (Button b : stepButtons) b.display();

    fill(t.textSecondary);
    textSize(t.textSizeSecondary);
    textAlign(LEFT, TOP);

    String zr = format3dp(appcore.zoom);
    String xr = format3dp(appcore.offsetX);
    String yr = format3dp(-appcore.offsetY);
    String cr = format3dp(appcore.juliaCx);
    String ci = format3dp(appcore.juliaCy);
    String ciSign = appcore.juliaCy >= 0 ? "+" : "";

    text("Zoom: " + zr + "x", px, layout.getY("zoomInfo"));
    text("Position: X=" + xr + ", Y=" + yr + " | c=" + cr + ciSign + ci + "i", px, layout.getY("posInfo"));

    fill(t.textMuted);
    textSize(t.textSizeCaption);
    text("[WASD/Arrows]: Pan, [Q/E, Scroll]: Zoom, [P]: PNG, [#]: Keymap", px, layout.getY("hints"));

    dropdown.display(appcore.renderer.currentMapIndex);

    exportBtn.display();
    zoomInBtn.display();
    zoomOutBtn.display();
    renderCredits();
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

  void renderKeymapReference() {
    pushStyle();
    fill(0, 220);
    noStroke();
    rect(0, 0, width, height);

    fill(255);
    textAlign(LEFT, TOP);
    float x = 50;
    float y = 50;
    float lineH = 28;

    textSize(28);
    text("Julia Set Keymap Reference", x, y);

    textSize(16);
    y += 50;
    text("Keys", x, y);
    text("Action", x + 240, y);
    stroke(255, 50);
    line(x, y + 25, width - 50, y + 25);
    y += 40;

    String[][] commands = {
      {"W/A/S/D or Arrow Keys", "Pan viewport"},
      {"Q / E, Mouse Wheel", "Zoom out / in"},
      {"[ / ]", "Iterations -16 / +16"},
      {"{ / }", "Iterations -64 / +64"},
      {"1..9", "Select colour map by index"},
      {"X / C", "Previous / next colour map"},
      {"P", "Export PNG image"},
      {"R", "Reset view and iterations"},
      {"H", "Toggle UI"},
      {"#", "Toggle keymap reference"}
    };

    noStroke();
    for (String[] cmd : commands) {
      fill(255);
      text(cmd[0], x, y);
      fill(255, 150);
      text(cmd[1], x + 240, y);
      y += lineH;
    }

    popStyle();
  }

  void renderCredits() {
    pushStyle();
    noStroke();
    fill(255, 170);
    textSize(12);
    textAlign(LEFT, BOTTOM);
    text(SKETCH_NAME + " " + SKETCH_VERSION + " by " + SKETCH_AUTHOR, 12, height - 12);
    popStyle();
  }
}
