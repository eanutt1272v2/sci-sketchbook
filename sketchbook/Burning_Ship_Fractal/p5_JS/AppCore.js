class AppCore {
  constructor() {
    this.maxIterations = 128;
    this.zoom = 1.0;
    this.offsetX = -0.02;
    this.offsetY = -0.08;
    this.defaultOffsetX = -0.02;
    this.defaultOffsetY = -0.08;
    this.defaultZoom = 1.0;
    this.defaultIterations = 128;
    this.needsRedraw = true;
    this.showUI = true;
    this.showKeymapRef = false;
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

    if (this.showKeymapRef) {
      this.panel.drawKeymapReference();
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

  resetView() {
    this.zoom = this.defaultZoom;
    this.offsetX = this.defaultOffsetX;
    this.offsetY = this.defaultOffsetY;
    this.maxIterations = this.defaultIterations;
    if (this.panel && this.panel.slider) {
      this.panel.slider.val = this.maxIterations;
    }
    this.needsRedraw = true;
  }

  cycleColorMap(step) {
    const count = this.renderer.mapNames.length;
    const next = (this.renderer.currentMapIndex + step + count) % count;
    this.renderer.setMap(next);
    this.needsRedraw = true;
  }

  exportImagePNG() {
    const timestamp = `${year()}${nf(month(), 2)}${nf(day(), 2)}_${nf(hour(), 2)}${nf(minute(), 2)}${nf(second(), 2)}`;
    const slug = (metadata.name || "fractal").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    save(this.renderer.buffer, `${slug}_${timestamp}.png`);
  }
}