class Renderer {
  constructor(size, colourMaps = {}, initialColourMap = "greyscale") {
    this.size = size;
    this.img = createImage(this.size, this.size);

    this.colourMaps = colourMaps;
    this.currentColourMap = "";
    this.lut = new Uint8ClampedArray(256 * 3);
    this.calcPanelImage = null;
    this.setColourMap(initialColourMap);
  }

  resize(size) {
    this.size = size;
    this.img = createImage(this.size, this.size);
  }

  _getViewSpec(board, automaton, rawMode) {
    const mode = rawMode;
    const size = board?.size || this.size;

    if (mode === "world") {
      return {
        mode,
        label: "World",
        data: board.cells,
        srcSize: size,
        vmin: 0,
        vmax: 1,
      };
    }

    if (mode === "potential") {
      return {
        mode,
        label: "Potential",
        data: board.potential,
        srcSize: size,
        vmin: 0,
        vmax: 2 * (automaton?.m || 0.15),
      };
    }

    if (mode === "field") {
      return {
        mode,
        label: "Growth",
        data: board.field,
        srcSize: size,
        vmin: -1,
        vmax: 1,
      };
    }

    if (mode === "kernel") {
      return {
        mode,
        label: "Kernel",
        data: automaton.kernel,
        srcSize: automaton.kernelSize,
        vmin: 0,
        vmax: Math.max(automaton.kernelMax || 0, 1e-9),
      };
    }

    return this._getViewSpec(board, automaton, "world");
  }

  render(board, automaton, renderMode, colourMapName) {
    this.setColourMap(colourMapName);
    const view = this._getViewSpec(board, automaton, renderMode);
    const data = view.data;
    const vmin = view.vmin;
    const vmax = view.vmax;
    const currentSize = view.srcSize;

    if (this.img.width !== currentSize || this.img.height !== currentSize) {
      this.img = createImage(currentSize, currentSize);
    }

    const denom = Math.max(vmax - vmin, 1e-9);
    this.img.loadPixels();
    for (let y = 0; y < currentSize; y++) {
      const row = y * currentSize;
      for (let x = 0; x < currentSize; x++) {
        const val = data[row + x];
        const normVal = (val - vmin) / denom;
        const clamped = Math.max(0, Math.min(1, normVal));
        const lutIndex = Math.min(255, Math.max(0, Math.round(clamped * 255))) *
          3;
        const idx = (row + x) * 4;
        this.img.pixels[idx] = this.lut[lutIndex];
        this.img.pixels[idx + 1] = this.lut[lutIndex + 1];
        this.img.pixels[idx + 2] = this.lut[lutIndex + 2];
        this.img.pixels[idx + 3] = 255;
      }
    }

    this.img.updatePixels();
    noSmooth();
    image(this.img, 0, 0, width, height);
  }

  setColourMap(name) {
    const mapName = this.colourMaps[name]
      ? name
      : this._fallbackColourMapName();
    if (!mapName || this.currentColourMap === mapName) return;

    this.currentColourMap = mapName;
    this._rebuildLUT(this.colourMaps[mapName]);
  }

  _fallbackColourMapName() {
    if (this.colourMaps.rocket) return "viridis";
    const keys = Object.keys(this.colourMaps);
    return keys.length ? keys[0] : "";
  }

  _rebuildLUT(colourMapData) {
    if (!colourMapData) return;

    const poly = (coeffs, t) => {
      let val = 0;
      for (let i = coeffs.length - 1; i >= 0; i--) {
        val = val * t + coeffs[i];
      }
      return val;
    };

    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const idx = i * 3;
      this.lut[idx] = constrain(
        Math.round(poly(colourMapData.r, t) * 255),
        0,
        255,
      );
      this.lut[idx + 1] = constrain(
        Math.round(poly(colourMapData.g, t) * 255),
        0,
        255,
      );
      this.lut[idx + 2] = constrain(
        Math.round(poly(colourMapData.b, t) * 255),
        0,
        255,
      );
    }
  }

  _valueToColour(val) {
    const v = Math.max(0, Math.min(1, val));
    const lutIndex = Math.min(255, Math.max(0, Math.round(v * 255))) * 3;
    return [this.lut[lutIndex], this.lut[lutIndex + 1], this.lut[lutIndex + 2]];
  }

  renderGrid(R) {
    push();

    const pixelSpacing = width / this.size;

    if (pixelSpacing > 4) {
      stroke(255, 30);
      strokeWeight(0.5);
      for (let i = 0; i <= this.size; i++) {
        const pos = i * pixelSpacing;
        line(pos, 0, pos, height);
        line(0, pos, width, pos);
      }
    }

    const rSpacing = (R / this.size) * width;
    stroke(200, 100);
    strokeWeight(1.5);
    for (let x = 0; x <= width + 1; x += rSpacing) {
      line(x, 0, x, height);
    }
    for (let y = 0; y <= height + 1; y += rSpacing) {
      line(0, y, width, y);
    }

    pop();
  }

  renderScale(R) {
    const scaleWidth = (R / this.size) * width;
    const x = width - scaleWidth - 20;
    const y = height - 20;
    push();
    fill(255);
    noStroke();
    rect(x, y, scaleWidth, 4);
    textSize(10);
    textAlign(CENTER);
    text("R=" + R.toFixed(1), x + scaleWidth / 2, y + 15);
    pop();
  }

  renderLegend() {
    const x = width - 20;
    const y1 = 20;
    const y2 = height - 70;
    const w = 15;
    const h = y2 - y1;

    push();

    let grad = drawingContext.createLinearGradient(0, y1, 0, y2);

    const stops = 32;
    for (let i = 0; i <= stops; i++) {
      let t = i / stops;
      let c = this._valueToColour(1 - t);
      grad.addColorStop(t, `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
    }

    noStroke();
    drawingContext.fillStyle = grad;
    drawingContext.fillRect(x - w, y1, w, h);

    noFill();
    stroke(255, 255, 255, 200);
    strokeWeight(1.5);
    rect(x - w, y1, w, h);

    fill(255);
    noStroke();
    textSize(11);
    textAlign(RIGHT, CENTER);

    const labels = [
      { val: "1.0", y: y1 },
      { val: "0.75", y: y1 + h * 0.25 },
      { val: "0.5", y: y1 + h * 0.5 },
      { val: "0.25", y: y1 + h * 0.75 },
      { val: "0.0", y: y2 },
    ];

    labels.forEach((label) => {
      text(label.val, x - w - 6, label.y);

      stroke(255, 255, 255, 150);
      strokeWeight(1);
      line(x - w - 3, label.y, x - w, label.y);
    });

    pop();
  }

  renderKeymapRef(metadata) {
    const { name, version } = metadata;

    push();
    background(0);
    noStroke();

    fill(255);
    textAlign(LEFT, TOP);
    let x = 50;
    let y = 50;
    const lh = 26;

    textSize(24);
    text(`${name} ${version} Keymap Reference`, x, y);

    y += 48;
    textSize(14);

    const colW = (width - 100) / 2;

    const sections = [
      {
        title: "Simulation",
        entries: [
          ["Space", "Pause / Resume"],
          ["N", "Step once"],
          ["A / D", "Previous / next animal"],
          ["F", "Load selected animal"],
          ["P", "Toggle place mode"],
          ["Z", "Randomise world"],
          ["X", "Clear world"],
          ["R", "Reset simulation state"],
        ],
      },
      {
        title: "Rendering",
        entries: [
          ["Tab", "Cycle render mode"],
          ["4", "Toggle calc diagnostics panels"],
          ["T", "Cycle colour map"],
          ["G", "Toggle grid"],
          ["L", "Toggle colour legend"],
          ["O", "Toggle stats overlay"],
          ["M", "Toggle motion overlay"],
          ["B", "Toggle scale bar"],
          ["V", "Cycle grid size"],
          ["H", "Hide / show GUI panel"],
        ],
      },
      {
        title: "Parameters",
        entries: [
          ["[ / ]", "Decrease / increase kernel radius (R)"],
          ["; / '", "Decrease / increase time steps (T)"],
          [", / .", "Decrease / increase growth centre (m)"],
          ["- / +", "Decrease / increase growth width (s)"],
          ["← / →", "Decrease / increase noise"],
          ["↑ / ↓", "Decrease / increase mask rate"],
          ["K", "Cycle kernel function"],
          ["Y", "Cycle growth function"],
          ["U", "Toggle soft clipping"],
          ["I", "Toggle multi-step integration"],
          ["Q / Shift+Q", "Cycle placement scale ↑ / ↓"],
          ["` (backtick)", "Auto-scale R & T to placement scale"],
        ],
      },
      {
        title: "Data",
        entries: [
          ["S", "Save canvas as PNG"],
          ["E", "Export world state (JSON)"],
          ["W", "Import world state (JSON)"],
          ["C", "Export statistics (CSV)"],
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
        cy = y;
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

  renderMotionOverlay(statistics) {
    const { centerX, centerY, speed, angle } = statistics;
    if (centerX === 0 && centerY === 0 && speed === 0) return;

    const cx = (centerX / this.size) * width;
    const cy = (centerY / this.size) * height;
    const cellPx = width / this.size;

    const arrowLen = Math.max(24, speed * cellPx * 8);
    const rad = (angle * Math.PI) / 180;
    const tx = cx + Math.cos(rad) * arrowLen;
    const ty = cy + Math.sin(rad) * arrowLen;

    const headLen = Math.max(8, arrowLen * 0.25);
    const headAngle = 0.42;
    const ax1 = tx - headLen * Math.cos(rad - headAngle);
    const ay1 = ty - headLen * Math.sin(rad - headAngle);
    const ax2 = tx - headLen * Math.cos(rad + headAngle);
    const ay2 = ty - headLen * Math.sin(rad + headAngle);

    push();
    stroke(0, 0, 0, 160);
    strokeWeight(3);
    noFill();
    line(cx, cy, tx, ty);
    line(tx, ty, ax1, ay1);
    line(tx, ty, ax2, ay2);

    stroke(220, 220, 220, 230);
    strokeWeight(1.5);
    line(cx, cy, tx, ty);
    line(tx, ty, ax1, ay1);
    line(tx, ty, ax2, ay2);

    noStroke();
    fill(0, 0, 0, 160);
    const dotR = Math.max(5, cellPx * 0.6);
    ellipse(cx, cy, (dotR + 2) * 2, (dotR + 2) * 2);
    fill(220, 220, 220, 230);
    ellipse(cx, cy, dotR * 2, dotR * 2);

    fill(220, 220, 220, 210);
    noStroke();
    textSize(10);
    textAlign(LEFT, TOP);
    const labelX = cx + dotR + 4;
    const labelY = cy - 10;
    fill(0, 200);
    text(
      `${angle.toFixed(1)} deg  speed=${speed.toFixed(3)}`,
      labelX + 1,
      labelY + 4,
    );
    fill(255, 230);
    text(
      `${angle.toFixed(1)} deg  speed=${speed.toFixed(3)}`,
      labelX,
      labelY + 3,
    );

    pop();
  }

  renderStats(statistics, params) {
    const dt = 1 / params.T;
    const RN = Math.pow(params.R, 2);

    const stats = [
      `FPS: ${(Number(statistics.fps) || 0).toFixed(1)}`,
      `Generation: ${String(statistics.gen)}`,
      `Sim Time: ${statistics.time.toFixed(3)} s`,
      `dt = 1/T: ${dt.toFixed(3)}`,
      `Running: ${params.running ? "on" : "off"}`,
      `Grid Size: ${this.size}`,
      `Render Mode: ${params.renderMode}`,
      `Colour Map: ${this.currentColourMap || params.colourMap}`,
      `Kernel Radius: R=${params.R.toFixed(2)}`,
      `Time Scale: T=${params.T.toFixed(2)}`,
      `Growth Mean: m=${params.m.toFixed(3)}`,
      `Growth Std Dev: s=${params.s.toFixed(3)}`,
      `Functions: kn=${params.kn} | gn=${params.gn}`,
      `Mass/R^2: ${(statistics.mass / RN).toFixed(3)}`,
      `Growth/R^2: ${(statistics.growth / RN).toFixed(4)}`,
      `Peak Value: ${statistics.maxValue.toFixed(3)}`,
      `Gyradius: ${statistics.gyradius.toFixed(2)}`,
      `Centroid: (${statistics.centerX?.toFixed(1) || "0.0"}, ${statistics.centerY?.toFixed(1) || "0.0"})`,
      `Growth Center: (${statistics.growthCenterX?.toFixed(1) || "0.0"}, ${statistics.growthCenterY?.toFixed(1) || "0.0"})`,
      `Mass-Growth Distance: ${(statistics.massGrowthDist || 0).toFixed(3)}`,
      `Speed: ${(statistics.speed || 0).toFixed(3)}`,
      `Angle: ${(statistics.angle || 0).toFixed(1)} deg`,
      `Mass asymmetry: ${(statistics.massAsym || 0).toFixed(3)}`,
      `Symmetry Order: ${statistics.symmSides || "?"}`,
      `Symmetry Strength: ${((statistics.symmStrength || 0) * 100).toFixed(1)} %`,
      `Rotation Speed: ${(statistics.rotationSpeed || 0).toFixed(2)} deg/s`,
      `Lyapunov: ${(statistics.lyapunov || 0).toFixed(6)}`,
      `Period: ${(statistics.period || 0).toFixed(3)} s`,
      `Period Confidence: ${(statistics.periodConfidence || 0).toFixed(3)}`,
      `Noise: ${params.addNoise.toFixed(3)}`,
      `Mask Rate: ${params.maskRate.toFixed(3)}`,
    ];

    push();
    textAlign(LEFT, TOP);
    textSize(12);
    noStroke();
    const panelX = 20;
    const panelY = 20;
    fill(255);
    text(stats.join("\n"), panelX, panelY);

    pop();
  }

  renderCalcPanels(board, automaton, params) {
    if (!board || !automaton) return;

    this.setColourMap(params.colourMap);

    const panelSize = 96;
    const gap = 8;
    const cols = 2;
    const rows = 2;
    const totalW = cols * panelSize + (cols - 1) * gap;
    const totalH = rows * panelSize + (rows - 1) * gap;
    const baseX = 20;
    const baseY = height - totalH - 20;

    const views = [
      this._getViewSpec(board, automaton, "world"),
      this._getViewSpec(board, automaton, "potential"),
      this._getViewSpec(board, automaton, "field"),
      this._getViewSpec(board, automaton, "kernel"),
    ];

    for (let i = 0; i < views.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = baseX + col * (panelSize + gap);
      const y = baseY + row * (panelSize + gap);
      this._renderCalcPanel(views[i], x, y, panelSize);
    }
  }

  _renderCalcPanel(view, x, y, panelSize) {
    if (!view || !view.data || !view.srcSize) return;

    if (
      !this.calcPanelImage ||
      this.calcPanelImage.width !== panelSize ||
      this.calcPanelImage.height !== panelSize
    ) {
      this.calcPanelImage = createImage(panelSize, panelSize);
    }

    const img = this.calcPanelImage;
    const srcSize = view.srcSize;
    const src = view.data;
    const denom = Math.max((view.vmax || 0) - (view.vmin || 0), 1e-9);

    img.loadPixels();
    for (let py = 0; py < panelSize; py++) {
      const sy = Math.min(srcSize - 1, Math.floor((py / panelSize) * srcSize));
      for (let px = 0; px < panelSize; px++) {
        const sx = Math.min(
          srcSize - 1,
          Math.floor((px / panelSize) * srcSize),
        );
        const srcIndex = sy * srcSize + sx;
        const v = Number(src[srcIndex]) || 0;
        const t = constrain((v - (view.vmin || 0)) / denom, 0, 1);
        const lutIndex = Math.min(255, Math.max(0, Math.round(t * 255))) * 3;
        const p = (py * panelSize + px) * 4;
        img.pixels[p] = this.lut[lutIndex];
        img.pixels[p + 1] = this.lut[lutIndex + 1];
        img.pixels[p + 2] = this.lut[lutIndex + 2];
        img.pixels[p + 3] = 255;
      }
    }
    img.updatePixels();

    push();
    noSmooth();
    image(img, x, y, panelSize, panelSize);
    noFill();
    stroke(255, 210);
    strokeWeight(1);
    rect(x, y, panelSize, panelSize);

    noStroke();
    fill(0, 200);
    textSize(10);
    textAlign(LEFT, TOP);
    text(view.label, x + 7, y + 5);
    fill(255);
    text(view.label, x + 6, y + 4);
    pop();
  }
}
