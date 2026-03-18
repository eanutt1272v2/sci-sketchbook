class AppCore {
  int maxIterations = 128;
  double zoom = 1.0;
  double offsetX = -0.02;
  double offsetY = -0.08;
  final double defaultZoom = 1.0;
  final double defaultOffsetX = -0.02;
  final double defaultOffsetY = -0.08;
  final int defaultIterations = 128;
  boolean needsRedraw = true;
  boolean showUI = true;
  boolean showKeymapRef = false;
  boolean justPressed = false;

  UITheme theme;
  UIPanel panel;
  FractalRenderer renderer;
  InputHandler input;

  void setup() {
    theme = new UITheme();
    renderer = new FractalRenderer(this);
    panel = new UIPanel(this);
    input = new InputHandler(this);

    renderer.generateLUT();
    colorMode(RGB, 255);
  }

  void draw() {
    background(0);
    input.handleContinuousInput();
    if (needsRedraw) {
      renderer.render();
      needsRedraw = false;
    }
    image(renderer.buffer, 0, 0);
    if (showUI) panel.draw();
    if (showKeymapRef) panel.renderKeymapReference();
    justPressed = false;
  }

  void doZoom(double factor, int tx, int ty) {
    float ar = (float) width / height;
    double baseX = map(tx, 0, width, -2.1f * ar, 1.1f * ar);
    double baseY = map(ty, 0, height, -2.1f, 1.1f);
    double old = zoom;
    zoom *= factor;
    offsetX += baseX * (1.0 / old - 1.0 / zoom);
    offsetY += baseY * (1.0 / old - 1.0 / zoom);
  }

  void resetView() {
    zoom = defaultZoom;
    offsetX = defaultOffsetX;
    offsetY = defaultOffsetY;
    maxIterations = defaultIterations;
    if (panel != null && panel.slider != null) {
      panel.slider.val = maxIterations;
    }
    needsRedraw = true;
  }

  void cycleColorMap(int step) {
    int count = renderer.mapNames.length;
    int next = (renderer.currentMapIndex + step + count) % count;
    renderer.setMap(next);
    needsRedraw = true;
  }

  void exportImagePNG() {
    String timestamp = "" + year()
      + nf(month(), 2)
      + nf(day(), 2)
      + "_"
      + nf(hour(), 2)
      + nf(minute(), 2)
      + nf(second(), 2);
    String slug = SKETCH_NAME.toLowerCase().replace(" ", "_");
    String filename = slug + "_" + timestamp + ".png";
    renderer.buffer.save("data/" + filename);
    println("Saved image: data/" + filename);
  }
}