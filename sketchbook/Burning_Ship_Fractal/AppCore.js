class AppCore {
  constructor(assets = {}) {
    const { metadata = null } = assets;

    this.metadata = metadata;
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

    this._worker = null;
    this._workerBusy = false;
    this._renderPending = false;
    this._workerLutVersion = -1;
  }

  windowResized() {
    const canvasSize = min(windowWidth, windowHeight);
    resizeCanvas(canvasSize, canvasSize);

    if (this.renderer !== null) {
      this.renderer.buffer = createGraphics(width, height);
      this.renderer.buffer.pixelDensity(1);
    }

    if (this.panel !== null) {
      this.panel = new UIPanel(this);
    }

    this.needsRedraw = true;
  }

  setup() {
    this.theme = new UITheme();
    this.renderer = new FractalRenderer(this);
    this.panel = new UIPanel(this);
    this.input = new InputHandler(this);

    this.renderer.generateLUT();
    colorMode(RGB, 255);
    this._initWorker();
  }

  _initWorker() {
    try {
      this._worker = new Worker("FractalWorker.js");
    } catch (e) {
      console.warn(
        "[Burning Ship Fractal] Worker unavailable, falling back to sync render.",
        e,
      );
      this._worker = null;
      return;
    }
    this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
    this._workerLutVersion = -1;
    this._worker.onerror = (e) => {
      console.error("[Burning Ship Fractal] Worker error:", e);
      this._workerBusy = false;
      this.renderer.render();
    };
  }

  _dispatchRender() {
    this._workerBusy = true;
    this._renderPending = false;
    if (this._workerLutVersion !== this.renderer.lutVersion) {
      const lut = this.renderer.buildLUTBuffer();
      this._worker.postMessage({
        type: "setLUT",
        lut,
        LUT_SIZE: this.renderer.LUT_SIZE,
      });
      this._workerLutVersion = this.renderer.lutVersion;
    }
    this._worker.postMessage({
      type: "render",
      w: width,
      h: height,
      zoom: this.zoom,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      maxIterations: this.maxIterations,
    });
  }

  _onWorkerMessage(data) {
    if (data.type !== "result") return;
    this._workerBusy = false;
    if (data.w === width && data.h === height) {
      this.renderer.renderFromPixels(data.pixels);
    } else {
      this.needsRedraw = true;
    }
    if (this._renderPending) {
      this._renderPending = false;
      this._dispatchRender();
    }
  }

  draw() {
    background(0);
    this.input.handleContinuousInput();

    if (this.needsRedraw) {
      if (this._worker) {
        if (!this._workerBusy) {
          this._dispatchRender();
        } else {
          this._renderPending = true;
        }
      } else {
        this.renderer.render();
      }
      this.needsRedraw = false;
    }

    image(this.renderer.buffer, 0, 0);

    if (this.showUI) {
      this.panel.draw();
    }

    if (this.showKeymapRef) {
      this.panel.renderKeymapReference();
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
    const slug = ((this.metadata && this.metadata.name) || "fractal")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    save(this.renderer.buffer, `${slug}_${timestamp}.png`);
  }
}
