

class Renderer {
  constructor(manager) {
    this.m = manager;
    this.buffer = null;
    this.grid = new Float32Array(0);
    this.axisSamples = new Float32Array(0);
    this.axisSampleCache = { resolution: 0, viewRadius: 0 };

    this.lut = new Uint8ClampedArray(256 * 3);
    this.currentColourMap = "";
  }

  getAxisSamples(resolution, viewRadius) {
    const cache = this.axisSampleCache;
    if (cache.resolution === resolution && cache.viewRadius === viewRadius && this.axisSamples.length === resolution) {
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

    const colourData = this.m.colourMaps[colourMap];
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
    const { n, l, m, resolution: res, viewRadius, slicePlane, sliceOffset, colourMap, exposure, viewCenter } = this.m.params;
    const { solver } = this.m;
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

        const density = solver.getProbabilityDensity(x, y, z, n, l, m);
        grid[rowOffset + u] = density;
        if (density > peak) peak = density;
      }
    }

    this.buffer = buffer;
    this.renderToBuffer(grid, peak, res, colourMap, exposure);
  }

  renderToBuffer(grid, peak, res, colourMap, exposure) {
    const colourMapData = this.m.colourMaps[colourMap] || this.m.colourMaps.rocket;
    const { buffer } = this;

    const gamma = 1.0 / (1.0 + exposure);
    const poly = (c, t) => c[0] + t * (c[1] + t * (c[2] + t * (c[3] + t * (c[4] + t * (c[5] + t * c[6])))));

    let r, g, b;
    buffer.loadPixels();

    for (let i = 0; i < res * res; i++) {
      let norm = grid[i] / peak;
      let val = Math.pow(constrain(norm, 0, 1), gamma);

      r = Math.floor(constrain(poly(colourMapData.r, val), 0, 1) * 255);
      g = Math.floor(constrain(poly(colourMapData.g, val), 0, 1) * 255);
      b = Math.floor(constrain(poly(colourMapData.b, val), 0, 1) * 255);

      const idx = i * 4;
      buffer.pixels[idx] = r;
      buffer.pixels[idx + 1] = g;
      buffer.pixels[idx + 2] = b;
      buffer.pixels[idx + 3] = 255;
    }

    buffer.updatePixels();
  }

  render() {
    const { pixelSmoothing, renderOverlay, renderKeymapRef } = this.m.params;
    const { buffer } = this;

    background(0);

    if (pixelSmoothing) { smooth(); } else { noSmooth(); }

    if (buffer) {
      image(buffer, 0, 0, width, height);
    }

    if (renderOverlay) {
      this.renderOverlay();
    }

    if (renderKeymapRef) {
      this.renderKeymapRef();
    }

    this.renderLegend();
  }

  renderOverlay() {
    const { n, l, m, viewRadius, sliceOffset, orbitalNotation, viewCenter } = this.m.params;
    const { axis1, axis2, fixedLabel, axis1Label, axis2Label } = this.m.getPlaneAxes();
    const fps = this.m.statistics.fps;
    const overlay = `Orbital: ${orbitalNotation}\nn=${n}, l=${l}, m=${m}\nView Radius: ${viewRadius.toFixed(2)} a₀\nPan ${axis1Label}: ${viewCenter[axis1].toFixed(2)} a₀   ${axis2Label}: ${viewCenter[axis2].toFixed(2)} a₀\nSlice ${fixedLabel}: ${sliceOffset.toFixed(2)} a₀\nFPS: ${fps.toFixed(1)}`;

    fill(255);
    noStroke();
    textAlign(LEFT, TOP);
    textSize(20);

    text(overlay, 20, 20);
  }

  renderLegend() {
    push();
    const { colourMap } = this.m.params;
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
      grad.addColorStop(t, `rgb(${this.lut[idx]}, ${this.lut[idx + 1]}, ${this.lut[idx + 2]})`);
    }

    drawingContext.strokeStyle = "rgba(255, 255, 255, 0.78)";
    drawingContext.lineWidth = 1;

    drawingContext.fillStyle = grad;
    drawingContext.fillRect(x - w, y1, w, h);

    drawingContext.strokeRect(x - w, y1, w, h);

    const labels = [
      { v: 1, y: y1 },
      { v: 1 / 2, y: y1 + h / 2 },
      { v: 0, y: y2 }
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
    const { name, version } = this.m.metadata;

    push();
    fill(0, 220);
    noStroke();
    rect(0, 0, width, height);

    fill(255);
    textAlign(LEFT, TOP);
    let x = 50;
    let y = 50;
    const lineH = 30;

    textSize(28);
    text(`${name} ${version} Keymap Reference`, x, y);

    textSize(16);
    y += 50;

    text("Keys", x, y);
    text("Action", x + 210, y);

    stroke(255, 50);
    line(x, y + 25, width - 50, y + 25);
    y += 40;

    const commands = [
      ["W/S, A/D, Q/E", "Increment n, l, m quantum numbers"],
      ["1, 2, 3", "Switch Planes (XY, XZ, YZ)"],
      ["L/R, U/D Arrow Keys", "Scan Slice / Zoom Radius"],
      ["Shift + Arrow Keys", "Pan view within current slice plane"],
      ["Mouse Drag / Touch Drag", "Pan view"],
      ["Mouse Wheel / Pinch", "Zoom radius"],
      ["Space", "Reset Slice Offset to 0 a₀"],
      ["X", "Reset view center"],
      ["[ / ]", "Adjust Exposure (Gamma)"],
      ["+ / -", "Alter Resolution"],
      ["M, C", "Toggle Smoothing / Cycle Colour Maps"],
      ["H, O, P", "Toggle GUI / Toggle Overlay / Export"],
      ["#", "Toggle Keymap Reference"]
    ];

    noStroke();

    for (const command of commands) {
      fill(255);
      text(command[0], x, y);
      fill(255, 150);
      text(command[1], x + 210, y);
      y += lineH;
    }

    pop();
  }
}