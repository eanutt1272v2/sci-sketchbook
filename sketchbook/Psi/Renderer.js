class Renderer {
  constructor(appcore) {
    this.appcore = appcore;
    this.buffer = null;
    this.grid = new Float32Array(0);
    this.axisSamples = new Float32Array(0);
    this.axisSampleCache = { resolution: 0, viewRadius: 0 };

    this.lut = new Uint8ClampedArray(256 * 3);
    this.currentColourMap = "";
    this._lastPixelSmoothing = null;
    this.lastLegendPeak = 1e-30;
    this.lastAMu = 5.29177210903e-11;
  }

  dispose() {
    this.buffer = null;
  }

  _fmtSci(v, digits = 3) {
    if (!Number.isFinite(v)) return "0";
    if (v === 0) return "0";
    return Number(v).toExponential(digits);
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

  renderFromGrid(gridBuffer, peak, resolutionHint) {
    const { colourMap, exposure } = this.appcore.params;
    this.grid = new Float32Array(gridBuffer);
    let res = Number(resolutionHint);
    if (!Number.isFinite(res) || res <= 0) {
      res = Math.round(Math.sqrt(this.grid.length));
    }
    res = Math.max(1, res | 0);
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
    const peakRef =
      (typeof this.appcore.getNormalisationPeak === "function" &&
        this.appcore.getNormalisationPeak()) ||
      peak ||
      1e-30;
    this.lastLegendPeak = Math.max(1e-30, Number(peakRef) || 0);
    buffer.loadPixels();

    for (let i = 0; i < res * res; i++) {
      let norm = grid[i] / peakRef;
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

    if (this._lastPixelSmoothing !== pixelSmoothing) {
      if (pixelSmoothing) {
        smooth();
      } else {
        noSmooth();
      }
      this._lastPixelSmoothing = pixelSmoothing;
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
    const {
      n,
      l,
      m,
      nuclearCharge,
      viewRadius,
      sliceOffset,
      orbitalNotation,
      viewCentre,
      resolution,
      slicePlane,
      exposure,
      colourMap,
      pixelSmoothing,
    } = this.appcore.params;
    const stats = this.appcore.statistics;
    const { axis1, axis2, fixedLabel, axis1Label, axis2Label } =
      this.appcore.getPlaneAxes();
    const lines = [
      `Orbital: ${orbitalNotation}`,
      `Quantum: n=${n}, l=${l}, m=${m}`,
      `Nuclear Charge: Z=${nuclearCharge}`,
      `FPS: ${stats.fps.toFixed(1)}`,
      `Resolution=${resolution}`,
      `Plane: ${slicePlane.toUpperCase()}`,
      `Slice ${fixedLabel}= ${sliceOffset.toFixed(2)} a₀`,
      `View Radius=${viewRadius.toFixed(2)} a₀`,
      `Pan ${axis1Label}=${viewCentre[axis1].toFixed(2)} a₀`,
      `Pan ${axis2Label}=${viewCentre[axis2].toFixed(2)} a₀`,
      `Density Mean=${this._fmtSci(stats.mean, 3)} m⁻³`,
      `Density Std Dev=${this._fmtSci(stats.stdDev, 3)} m⁻³`,
      `Density Peak=${this._fmtSci(stats.peakDensity, 3)} m⁻³`,
      `Entropy=${stats.entropy.toFixed(4)}`,
      `Concentration=${stats.concentration.toFixed(4)}`,
      `Radial Peak=${stats.radialPeak.toFixed(3)} a₀`,
      `Radial Spread=${stats.radialSpread.toFixed(3)} a₀`,
      `Node Estimate=${stats.nodeEstimate.toFixed(0)}`,
      `Colour Map: ${colourMap}`,
      `Exposure=${exposure.toFixed(2)}`,
      `Pixel Smoothing: ${pixelSmoothing ? "on" : "off"}`,
    ];

    push();
    textAlign(LEFT, TOP);
    textSize(12);
    noStroke();
    const panelX = 20;
    const panelY = 20;
    fill(255);
    text(lines.join("\n"), panelX, panelY);
    pop();
  }

  renderLegend() {
    push();
    const { colourMap, exposure } = this.appcore.params;
    this.updateLUT(colourMap || "rocket");

    const x = width - 20;
    const y1 = 34;
    const y2 = height - 20;
    const w = 15;
    const h = y2 - y1;

    const grad = drawingContext.createLinearGradient(0, y1, 0, y2);
    const stops = 32;
    for (let i = 0; i <= stops; i++) {
      const t = i / stops;
      const idx = (((1 - t) * 255) | 0) * 3;
      grad.addColorStop(
        t,
        `rgb(${this.lut[idx]}, ${this.lut[idx + 1]}, ${this.lut[idx + 2]})`,
      );
    }

    noStroke();
    drawingContext.fillStyle = grad;
    drawingContext.fillRect(x - w, y1, w, h);

    noFill();
    stroke(255, 255, 255, 200);
    strokeWeight(1.5);
    rect(x - w, y1, w, h);

    const maxV = Math.max(1e-30, Number(this.lastLegendPeak) || 0);
    const k = Math.floor(Math.log10(maxV));
    const scale = Math.pow(10, k);
    const scaledMax = maxV / scale;

    const gamma = 1.0 / (1.0 + exposure);
    const rawStep = scaledMax / 7;
    const stepMag = Math.pow(
      10,
      Math.floor(Math.log10(Math.max(rawStep, 1e-9))),
    );
    const stepNorm = rawStep / stepMag;
    let niceNorm = 1;
    if (stepNorm > 1 && stepNorm <= 2) niceNorm = 2;
    else if (stepNorm > 2 && stepNorm <= 2.5) niceNorm = 2.5;
    else if (stepNorm > 2.5 && stepNorm <= 5) niceNorm = 5;
    else if (stepNorm > 5) niceNorm = 10;
    const step = niceNorm * stepMag;

    const labels = [{ val: scaledMax, y: y1 }];
    const start = Math.floor(scaledMax / step) * step;
    for (let v = start; v >= -1e-12; v -= step) {
      if (scaledMax - v < 1e-9) continue;
      const tv = Math.max(0, v);
      const tLinear = tv / scaledMax;
      const tMapped = Math.pow(constrain(tLinear, 0, 1), gamma);
      labels.push({ val: tv, y: y1 + (1 - tMapped) * h });
    }

    const decimals = step >= 1 ? 1 : step >= 0.1 ? 2 : 3;

    fill(255);
    noStroke();
    textSize(11);
    textAlign(RIGHT, CENTER);

    labels.forEach((label) => {
      noStroke();
      text(label.val.toFixed(decimals), x - w - 6, label.y);
      stroke(255, 255, 255, 150);
      strokeWeight(1);
      line(x - w - 3, label.y, x - w, label.y);
    });

    noStroke();
    fill(255);
    textAlign(CENTER, BOTTOM);
    textSize(12);
    text(`×10^${k}`, x - w * 0.5, y1 - 6);

    push();
    translate(x + w * 0.5, y1 + h * 0.5);
    rotate(-HALF_PI);
    textAlign(CENTER, CENTER);
    textSize(12);
    text("Probability density |ψ|² [m⁻³]", 0, 0);
    pop();
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
        title: "Rendering",
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
