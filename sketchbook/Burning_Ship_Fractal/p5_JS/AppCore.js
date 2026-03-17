class AppCore {
  constructor() {
    this.maxIterations = 128;
    this.zoom = 1.0;
    this.offsetX = -0.02;
    this.offsetY = -0.08;
    this.needsRedraw = true;
    this.showUI = true;
    this.justPressed = false;

    this.theme = null;
    this.panel = null;
    this.renderer = null;
    this.input = null;
  }

  setup() {
    this.theme = new UITheme();
    this.renderer = new FractalRenderer(this);
    this.panel = new UIPanel(this);
    this.input = new InputHandler(this);

    this.renderer.generateLUT();
    colorMode(RGB, 255);
  }

  draw() {
    background(0);
    this.input.handleContinuousInput();

    if (this.needsRedraw) {
      this.renderer.render();
      this.needsRedraw = false;
    }

    image(this.renderer.buffer, 0, 0);

    if (this.showUI) {
      this.panel.draw();
    }

    this.justPressed = false;
  }

  doZoom(factor, tx, ty) {
    const aspectRatio = width / height;
    const baseX = map(tx, 0, width, -2.1 * aspectRatio, 1.1 * aspectRatio);
    const baseY = map(ty, 0, height, -2.1, 1.1);
    const old = this.zoom;
    this.zoom *= factor;
    this.offsetX += baseX * (1.0 / old - 1.0 / this.zoom);
    this.offsetY += baseY * (1.0 / old - 1.0 / this.zoom);
  }
}