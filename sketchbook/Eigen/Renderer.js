class Renderer {
  constructor(appcore) {
    this.appcore = appcore;
    this.buffer = null;
    this.grid = new Float32Array(0);
    this.axisSamples = new Float32Array(0);
    this.axisSampleCache = { resolution: 0, viewRadius: 0 };

    this.lut = new Uint8ClampedArray(256 * 3);
    this.currentColourMap = "";
  }

  getAxisSamples(resolution, viewRadius) {
    const cache = this.axisSampleCache;
    if (
      cache.resolution === resolution &&
      cache.viewRadius === viewRadius &&
      this.axisSamples.length === resolution
    ) {
      return this.axisSamples;
    }

    this.axisSamples = new Float32Array(resolution);

    if (resolution === 1) {
      this.axisSamples[0] = 0;
    } else {
      const step = (viewRadius * 2) / (resolution - 1);
      let value = -viewRadius;

      for (let i = 0; i < resolution; i++) {
        this.axisSamples[i] = value;
        value += step;
      }
    }

    cache.resolution = resolution;
    cache.viewRadius = viewRadius;
    return this.axisSamples;
  }

  updateLUT(colourMap) {
    if (this.currentColourMap === colourMap) return;

    const colourData = this.appcore.colourMaps[colourMap];
    if (!colourData) return;

    this.currentColourMap = colourMap;
    const channels = ["r", "g", "b"];

    for (let i = 0; i < 256; i++) {
      const intensity = i / 255;

      for (let c = 0; c < 3; c++) {
        const coeffs = colourData[channels[c]];
        let val = 0;

        for (let j = coeffs.length - 1; j >= 0; j--) {
          val = val * intensity + coeffs[j];
        }

        this.lut[i * 3 + c] = constrain(val * 255, 0, 255);
      }
    }
  }

  getSliceAxes(slicePlane) {
    if (slicePlane === "xy") return { c1: 0, c2: 1, cFixed: 2 };
    if (slicePlane === "yz") return { c1: 1, c2: 2, cFixed: 0 };
    return { c1: 0, c2: 2, cFixed: 1 };
  }

  update() {
    const {
      n,
      l,
      m,
      resolution: res,
      viewRadius,
      slicePlane,
      sliceOffset,
      colourMap,
      exposure,
      viewCenter,
    } = this.appcore.params;
    const { fallbacksolver } = this.appcore;
    let { buffer } = this;

    if (!buffer || buffer.width !== res || buffer.height !== res) {
      buffer = createImage(res, res);
    }

    if (this.grid.length !== res * res) {
      this.grid = new Float32Array(res * res);
    }

    const grid = this.grid;
    const axisSamples = this.getAxisSamples(res, viewRadius);
    const { c1, c2, cFixed } = this.getSliceAxes(slicePlane);
    let peak = 1e-10;

    const centerX = viewCenter.x;
    const centerY = viewCenter.y;
    const centerZ = viewCenter.z;

    const axisCenter1 = c1 === 0 ? centerX : c1 === 1 ? centerY : centerZ;
    const axisCenter2 = c2 === 0 ? centerX : c2 === 1 ? centerY : centerZ;

    for (let v = 0; v < res; v++) {
      const p2 = axisSamples[v] + axisCenter2;
      const rowOffset = v * res;

      for (let u = 0; u < res; u++) {
        const p1 = axisSamples[u] + axisCenter1;

        let x = 0;
        let y = 0;
        let z = 0;

        if (c1 === 0) x = p1;
        else if (c1 === 1) y = p1;
        else z = p1;

        if (c2 === 0) x = p2;
        else if (c2 === 1) y = p2;
        else z = p2;

        if (cFixed === 0) x = sliceOffset;
        else if (cFixed === 1) y = sliceOffset;
        else z = sliceOffset;

        const density = fallbacksolver.getProbabilityDensity(x, y, z, n, l, m);
        grid[rowOffset + u] = density;
        if (density > peak) peak = density;
      }
    }

    this.buffer = buffer;
    this.renderToBuffer(grid, peak, res, colourMap, exposure);
  }

  renderFromGrid(gridBuffer, peak) {
    const { resolution: res, colourMap, exposure } = this.appcore.params;
    this.grid = new Float32Array(gridBuffer);
    if (
      !this.buffer ||
      this.buffer.width !== res ||
      this.buffer.height !== res
    ) {
      this.buffer = createImage(res, res);
    }
    this.renderToBuffer(this.grid, peak, res, colourMap, exposure);
  }

  renderToBuffer(grid, peak, res, colourMap, exposure) {
    const { buffer } = this;
    this.updateLUT(colourMap || "rocket");

    const gamma = 1.0 / (1.0 + exposure);
    buffer.loadPixels();

    for (let i = 0; i < res * res; i++) {
      let norm = grid[i] / peak;
      let val = Math.pow(constrain(norm, 0, 1), gamma);
      const lutIndex = Math.min(255, Math.max(0, Math.round(val * 255))) * 3;

      const idx = i * 4;
      buffer.pixels[idx] = this.lut[lutIndex];
      buffer.pixels[idx + 1] = this.lut[lutIndex + 1];
      buffer.pixels[idx + 2] = this.lut[lutIndex + 2];
      buffer.pixels[idx + 3] = 255;
    }

    buffer.updatePixels();
  }

  render() {
    const { pixelSmoothing, renderOverlay, renderLegend, renderKeymapRef } =
      this.appcore.params;
    const { buffer } = this;

    background(0);

    if (pixelSmoothing) {
      smooth();
    } else {
      noSmooth();
    }

    if (buffer) {
      image(buffer, 0, 0, width, height);
    }

    if (renderOverlay) {
      this.renderOverlay();
    }

    if (renderLegend) {
      this.renderLegend();
    }

    if (renderKeymapRef) {
      this.renderKeymapRef();
    }
  }

  renderOverlay() {
    const { n, l, m, viewRadius, sliceOffset, orbitalNotation, viewCenter } =
      this.appcore.params;
    const { axis1, axis2, fixedLabel, axis1Label, axis2Label } =
      this.appcore.getPlaneAxes();
    const fps = this.appcore.statistics.fps;
    const overlay = `Orbital: ${orbitalNotation}\nn=${n}, l=${l}, m=${m}\nView Radius: ${viewRadius.toFixed(2)} a₀\nPan ${axis1Label}: ${viewCenter[axis1].toFixed(2)} a₀   ${axis2Label}: ${viewCenter[axis2].toFixed(2)} a₀\nSlice ${fixedLabel}: ${sliceOffset.toFixed(2)} a₀\nFPS: ${fps.toFixed(1)}`;

    fill(255);
    noStroke();
    textAlign(LEFT, TOP);
    textSize(20);

    text(overlay, 20, 20);
  }

  renderLegend() {
    push();
    const { colourMap } = this.appcore.params;
    this.updateLUT(colourMap || "rocket");

    const x = width - 15;
    const y1 = 15;
    const y2 = height - 15;
    const w = 20;
    const h = y2 - y1;

    const grad = drawingContext.createLinearGradient(0, y1, 0, y2);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const idx = (((1 - t) * 255) | 0) * 3;
      grad.addColorStop(
        t,
        `rgb(${this.lut[idx]}, ${this.lut[idx + 1]}, ${this.lut[idx + 2]})`,
      );
    }

    drawingContext.strokeStyle = "rgba(255, 255, 255, 0.78)";
    drawingContext.lineWidth = 1;

    drawingContext.fillStyle = grad;
    drawingContext.fillRect(x - w, y1, w, h);

    drawingContext.strokeRect(x - w, y1, w, h);

    const labels = [
      { v: 1, y: y1 },
      { v: 1 / 2, y: y1 + h / 2 },
      { v: 0, y: y2 },
    ];

    fill(255);
    textSize(11);
    textAlign(RIGHT, CENTER);

    labels.forEach((label) => {
      text(label.v.toFixed(3), x - w - 6, label.y);
      stroke(255, 100);
      line(x - w - 3, label.y, x - w, label.y);
    });
    pop();
  }

  renderKeymapRef() {
    const { name, version } = this.appcore.metadata;

    push();
    fill(0, 220);
    noStroke();
    rect(0, 0, width, height);

    fill(255);
    textAlign(LEFT, TOP);
    const x = 50;
    let y = 50;
    const lh = 26;
    const colW = (width - 100) / 2;

    textSize(24);
    text(`${name} ${version} Keymap Reference`, x, y);

    y += 48;

    const sections = [
      {
        title: "Quantum",
        entries: [
          ["W/S", "Increment/decrement n"],
          ["D/A", "Increment/decrement l"],
          ["E/Q", "Increment/decrement m"],
        ],
      },
      {
        title: "View",
        entries: [
          ["1 / 2 / 3", "Switch plane: XY / XZ / YZ"],
          ["Space", "Reset slice offset"],
          ["X", "Reset view centre"],
          ["Arrow Keys", "Slice or zoom radius"],
          ["Shift + Arrow", "Pan in active plane"],
          ["Mouse Drag / Touch", "Pan view"],
          ["Wheel / Pinch", "Zoom radius"],
        ],
      },
      {
        title: "Display",
        entries: [
          ["C", "Cycle colour map"],
          ["M", "Toggle pixel smoothing"],
          ["O", "Toggle overlay"],
          ["L", "Toggle legend"],
          ["H", "Toggle GUI"],
        ],
      },
      {
        title: "Data",
        entries: [
          ["P", "Export image"],
          ["G", "Export analysis data"],
          ["GUI: Media tab", "Export/import params + stats"],
        ],
      },
      {
        title: "Reference",
        entries: [["#", "Toggle keymap reference"]],
      },
    ];

    let col = 0;
    let cx = x;
    let cy = y;

    for (const section of sections) {
      if (cy + (section.entries.length + 2) * lh > height - 30 && col === 0) {
        col = 1;
        cx = x + colW;
        cy = y + 50;
      }

      fill(180, 220, 255);
      textSize(13);
      text(section.title.toUpperCase(), cx, cy);
      cy += lh - 4;

      stroke(255, 40);
      line(cx, cy, cx + colW - 20, cy);
      noStroke();
      cy += 8;

      for (const [k, desc] of section.entries) {
        fill(255);
        textSize(13);
        text(k, cx, cy);
        fill(200);
        text(desc, cx + 130, cy);
        cy += lh;
      }

      cy += 14;
    }

    fill(120);
    textSize(11);
    textAlign(CENTER, BOTTOM);
    text("Press # to close", width / 2, height - 16);

    pop();
  }
}
