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

  _enableOverlayShadow(ctx = null) {
    const target = ctx || this;
    const dc =
      target?.drawingContext ||
      (typeof drawingContext !== "undefined" ? drawingContext : null);
    if (!dc) return;
    dc.shadowColor = "rgba(0, 0, 0, 0.9)";
    dc.shadowBlur = 4;
    dc.shadowOffsetX = 2;
    dc.shadowOffsetY = 2;
  }

  _disableOverlayShadow(ctx = null) {
    const target = ctx || this;
    const dc =
      target?.drawingContext ||
      (typeof drawingContext !== "undefined" ? drawingContext : null);
    if (!dc) return;
    dc.shadowColor = "rgba(0, 0, 0, 0)";
    dc.shadowBlur = 0;
    dc.shadowOffsetX = 0;
    dc.shadowOffsetY = 0;
  }

  dispose() {
    this.buffer = null;
  }

  _fmtSci(v, digits = 3) {
    if (!Number.isFinite(v)) return "0";
    if (v === 0) return "0";
    const [mantissa, exponent] = Number(v).toExponential(digits).split("e");
    return `${mantissa}e^${Number(exponent)}`;
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
    const {
      pixelSmoothing,
      renderOverlay,
      renderNodeOverlay,
      renderLegend,
      renderKeymapRef,
    } = this.appcore.params;
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

    if (renderNodeOverlay) {
      this.renderNodeOverlay();
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
      `FPS=${stats.fps.toFixed(1)} [Hz]`,
      `Resolution=${resolution} [px]`,
      `Plane: ${slicePlane.toUpperCase()}`,
      `Slice ${fixedLabel}=${sliceOffset.toFixed(2)} [a₀]`,
      `View Radius=${viewRadius.toFixed(2)} [a₀]`,
      `Pan ${axis1Label}=${viewCentre[axis1].toFixed(2)} [a₀]`,
      `Pan ${axis2Label}=${viewCentre[axis2].toFixed(2)} [a₀]`,
      `Mean Density=${this._fmtSci(stats.mean, 3)} [m⁻³]`,
      `Density Std Dev=${this._fmtSci(stats.stdDev, 3)} [m⁻³]`,
      `Density Peak=${this._fmtSci(stats.peakDensity, 3)} [m⁻³]`,
      `Entropy=${this._fmtSci(stats.entropy, 3)}`,
      `Concentration=${this._fmtSci(stats.concentration, 3)}`,
      `Radial Peak=${stats.radialPeak.toFixed(3)} [a₀]`,
      `Radial Spread=${stats.radialSpread.toFixed(3)} [a₀]`,
      `Node Estimate=${stats.nodeEstimate.toFixed(0)}`,
      `Colour Map: ${colourMap} (palette id)`,
      `Exposure=${exposure.toFixed(2)} [index]`,
      `Pixel Smoothing: ${pixelSmoothing ? "true" : "false"}`,
    ];

    push();
    this._enableOverlayShadow();
    textAlign(LEFT, TOP);
    textSize(12);
    noStroke();
    const panelX = 20;
    const panelY = 20;
    fill(255);
    text(lines.join("\n"), panelX, panelY);
    this._disableOverlayShadow();
    pop();
  }

  _worldToScreen(axis1Value, axis2Value, params, axis1, axis2) {
    const viewRadius = Math.max(1e-6, Number(params.viewRadius) || 1);
    const centre1 = Number(params.viewCentre?.[axis1]) || 0;
    const centre2 = Number(params.viewCentre?.[axis2]) || 0;

    const xNorm = (axis1Value - centre1 + viewRadius) / (2 * viewRadius);
    const yNorm = (axis2Value - centre2 + viewRadius) / (2 * viewRadius);

    return {
      x: xNorm * width,
      y: yNorm * height,
    };
  }

  _renderNodeTypeKey(radialCount, angularCount) {
    const panelX = 20;
    const panelY = height - 78;
    const radialColour = [31, 119, 180, 230];
    const angularColour = [214, 39, 40, 235];

    push();
    this._enableOverlayShadow();

    fill(255);
    textAlign(LEFT, TOP);
    textSize(12);
    text("Detected Nodes", panelX + 10, panelY + 1);

    strokeWeight(2);

    stroke(...radialColour);
    line(panelX + 12, panelY + 30, panelX + 32, panelY + 30);
    noStroke();
    fill(255);
    text(`Radial: ${radialCount}`, panelX + 40, panelY + 23);

    stroke(...angularColour);
    line(panelX + 12, panelY + 52, panelX + 32, panelY + 52);
    noStroke();
    fill(255);
    text(`Angular: ${angularCount}`, panelX + 40, panelY + 45);

    this._disableOverlayShadow();
    pop();
  }

  renderNodeOverlay() {
    const params = this.appcore.params;
    const analyser = this.appcore.analyser;
    if (!analyser || typeof analyser.computeNodeOverlayData !== "function") {
      return;
    }

    const { axis1, axis2, fixedAxis } = this.appcore.getPlaneAxes();
    const viewRadius = Math.max(1e-6, Number(params.viewRadius) || 1);
    const centre1 = Number(params.viewCentre?.[axis1]) || 0;
    const centre2 = Number(params.viewCentre?.[axis2]) || 0;
    const fixedCoord =
      (Number(params.viewCentre?.[fixedAxis]) || 0) +
      (Number(params.sliceOffset) || 0);

    const overlayData = analyser.computeNodeOverlayData({
      ...params,
      aMuMeters: this.appcore.aMuMeters,
    });
    const radialNodeRadii = overlayData.radialNodeRadii || [];
    const angularNodeThetas = overlayData.angularNodeThetas || [];
    const angularNodePhis = overlayData.angularNodePhis || [];
    const radialColour = [31, 119, 180, 230];
    const angularColour = [214, 39, 40, 235];

    const pixelScale = Math.min(width, height) / (2 * viewRadius);

    push();
    noFill();
    strokeWeight(1.6);

    const origin = this._worldToScreen(0, 0, params, axis1, axis2);

    stroke(...radialColour);
    for (const radius of radialNodeRadii) {
      if (!Number.isFinite(radius) || radius <= 0) continue;
      if (Math.abs(fixedCoord) > radius) continue;

      const inPlaneRadius = Math.sqrt(
        Math.max(0, radius * radius - fixedCoord * fixedCoord),
      );
      const pxRadius = inPlaneRadius * pixelScale;
      if (!Number.isFinite(pxRadius) || pxRadius <= 0.6) continue;
      ellipse(origin.x, origin.y, 2 * pxRadius, 2 * pxRadius);
    }

    stroke(...angularColour);
    if (params.slicePlane === "xy") {
      for (const theta of angularNodeThetas) {
        if (!Number.isFinite(theta)) continue;
        const tanTheta = Math.tan(theta);
        if (!Number.isFinite(tanTheta)) continue;
        const radius = Math.abs(fixedCoord) * Math.abs(tanTheta);
        const pxRadius = radius * pixelScale;
        if (!Number.isFinite(pxRadius) || pxRadius <= 0.6) continue;
        ellipse(origin.x, origin.y, 2 * pxRadius, 2 * pxRadius);
      }

      for (const phi of angularNodePhis) {
        if (!Number.isFinite(phi)) continue;
        const extent = viewRadius * 1.5;
        const x1 = -extent * Math.cos(phi);
        const y1 = -extent * Math.sin(phi);
        const x2 = extent * Math.cos(phi);
        const y2 = extent * Math.sin(phi);
        const p1 = this._worldToScreen(x1, y1, params, axis1, axis2);
        const p2 = this._worldToScreen(x2, y2, params, axis1, axis2);
        line(p1.x, p1.y, p2.x, p2.y);
      }
    } else {
      const samples = 160;
      for (const theta of angularNodeThetas) {
        if (!Number.isFinite(theta)) continue;
        const tanTheta = Math.tan(theta);
        if (!Number.isFinite(tanTheta) || Math.abs(tanTheta) < 1e-6) continue;

        for (const sign of [-1, 1]) {
          let prevPoint = null;
          for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const axis1Value = centre1 - viewRadius + t * 2 * viewRadius;
            const axis2Value =
              (sign * Math.sqrt(axis1Value * axis1Value + fixedCoord * fixedCoord)) /
              tanTheta;

            const visible =
              Number.isFinite(axis2Value) &&
              axis2Value >= centre2 - viewRadius &&
              axis2Value <= centre2 + viewRadius;

            if (!visible) {
              prevPoint = null;
              continue;
            }

            const current = this._worldToScreen(
              axis1Value,
              axis2Value,
              params,
              axis1,
              axis2,
            );

            if (prevPoint) {
              line(prevPoint.x, prevPoint.y, current.x, current.y);
            }

            prevPoint = current;
          }
        }
      }

      for (const phi of angularNodePhis) {
        if (!Number.isFinite(phi)) continue;

        if (params.slicePlane === "xz") {
          const sinPhi = Math.sin(phi);
          if (Math.abs(sinPhi) < 1e-6) continue;
          const xConst = (fixedCoord * Math.cos(phi)) / sinPhi;
          if (xConst < centre1 - viewRadius || xConst > centre1 + viewRadius) {
            continue;
          }
          const p1 = this._worldToScreen(
            xConst,
            centre2 - viewRadius,
            params,
            axis1,
            axis2,
          );
          const p2 = this._worldToScreen(
            xConst,
            centre2 + viewRadius,
            params,
            axis1,
            axis2,
          );
          line(p1.x, p1.y, p2.x, p2.y);
        } else if (params.slicePlane === "yz") {
          const cosPhi = Math.cos(phi);
          if (Math.abs(cosPhi) < 1e-6) continue;
          const yConst = (fixedCoord * Math.sin(phi)) / cosPhi;
          if (yConst < centre1 - viewRadius || yConst > centre1 + viewRadius) {
            continue;
          }
          const p1 = this._worldToScreen(
            yConst,
            centre2 - viewRadius,
            params,
            axis1,
            axis2,
          );
          const p2 = this._worldToScreen(
            yConst,
            centre2 + viewRadius,
            params,
            axis1,
            axis2,
          );
          line(p1.x, p1.y, p2.x, p2.y);
        }
      }
    }

    pop();

    this._renderNodeTypeKey(
      radialNodeRadii.length,
      angularNodeThetas.length + angularNodePhis.length,
    );
  }

  getSuperscript(num) {
    const map = {
      0: "⁰",
      1: "¹",
      2: "²",
      3: "³",
      4: "⁴",
      5: "⁵",
      6: "⁶",
      7: "⁷",
      8: "⁸",
      9: "⁹",
      "-": "⁻",
    };
    return String(num)
      .split("")
      .map((char) => map[char] || char)
      .join("");
  }

  renderLegend() {
    push();
    this._enableOverlayShadow();
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

    this._disableOverlayShadow();
    noFill();
    stroke(255, 255, 255, 200);
    strokeWeight(1.5);
    rect(x - w, y1, w, h);
    this._enableOverlayShadow();

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
    textSize(14);
    let kSuper = this.getSuperscript(k);
    text(`×10${kSuper}`, x - w * 0.6, y1 - 6);

    push();
    translate(x + w * 0.5, y1 + h * 0.5);
    rotate(-HALF_PI);
    textAlign(CENTER, CENTER);
    textSize(12);
    text("Probability density |ψ|² [m⁻³]", 0, 0);
    pop();
    this._disableOverlayShadow();
    pop();
  }

  renderKeymapRef() {
    const { name, version } = this.appcore.metadata;

    push();
    this._enableOverlayShadow();
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
          ["R/T", "Nuclear charge Z +/- 1"],
          ["P", "Toggle reduced mass"],
          ["G/B", "log₁₀ nucleus mass +/- 0.01"],
        ],
      },
      {
        title: "View",
        entries: [
          ["1 / 2 / 3", "Switch plane: XY / XZ / YZ"],
          ["Z", "Reset view radius"],
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
          ["N", "Toggle detected node overlay"],
          ["L", "Toggle legend"],
          ["[ / ]", "Decrease / increase exposure"],
          ["- / +", "Decrease / increase resolution"],
          ["H", "Toggle GUI"],
        ],
      },
      {
        title: "Data",
        entries: [
          ["V", "Start / stop recording"],
          ["F", "Export image"],
          ["Shift+I / Shift+P", "Import / export params (JSON)"],
          ["Shift+S / Shift+C", "Export stats JSON / CSV"],
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

    this._disableOverlayShadow();
    pop();
  }
}
