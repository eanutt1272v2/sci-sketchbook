class AppCore {
  int maxIterations = 128;
  double zoom = 1.0;
  double offsetX = -0.25;
  double offsetY = 0.5;
  boolean needsRedraw = true;
  boolean showUI = true;

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
    if (needsRedraw) { renderer.render(); needsRedraw = false; }
    image(renderer.buffer, 0, 0);
    if (showUI) panel.draw();
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
}