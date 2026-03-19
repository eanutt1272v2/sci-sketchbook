class Renderer {
  constructor(size, colourMaps = {}, initialColourMap = "greyscale") {
    this.size = size;
    this.img = createImage(this.size, this.size);

    this.colourMaps = colourMaps;
    this.currentColourMap = "";
    this.lut = new Uint8ClampedArray(256 * 3);
    this.setColourMap(initialColourMap);
  }

  resize(size) {
    this.size = size;
    this.img = createImage(this.size, this.size);
  }

  render(board, automaton, renderMode, colourMapName) {
    this.setColourMap(colourMapName);

    let data = board.cells;
    let vmin = 0;
    let vmax = 1;
    let currentSize = this.size;

    if (renderMode === "potential") {
      data = board.potential;
      vmax = 2 * automaton.m;
      if (this.img.width !== this.size) {
        this.img = createImage(this.size, this.size);
      }
    } else if (renderMode === "field") {
      data = board.field;
      vmin = -1;
      vmax = 1;
      if (this.img.width !== this.size) {
        this.img = createImage(this.size, this.size);
      }
    } else if (renderMode === "kernel") {
      data = automaton.kernel;
      currentSize = automaton.kernelSize;
      if (this.img.width !== currentSize) {
        this.img = createImage(currentSize, currentSize);
      }
      vmax = Math.max(automaton.kernelMax, 1e-9);
    } else {
      if (this.img.width !== this.size) {
        this.img = createImage(this.size, this.size);
      }
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
    fill(0, 215);
    noStroke();
    rect(0, 0, width, height);

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
    fill(0, 150);
    rect(labelX - 2, labelY - 1, 115, 20, 3);
    fill(255, 230);
    text(
      `${angle.toFixed(1)}°  spd: ${speed.toFixed(3)}`,
      labelX + 2,
      labelY + 3,
    );

    pop();
  }

  renderStats(statistics, params) {
    push();

    const x = 20,
      y = 20;
    const dt = 1 / params.T;
    const RN = Math.pow(params.R, 2);

    fill(255);
    textSize(14);
    textAlign(LEFT, TOP);
    const stats = [
      `Gen: ${String(statistics.gen)} | T: ${statistics.time.toFixed(3)}s`,
      `Mass: ${(statistics.mass / RN).toFixed(3)} | Growth: ${(statistics.growth / RN).toFixed(4)}`,
      `Peak: ${statistics.maxValue.toFixed(3)} | Gyrad: ${statistics.gyradius.toFixed(2)}`,
      `Centre: (${statistics.centerX?.toFixed(1) || "0"}, ${statistics.centerY?.toFixed(1) || "0"})`,
      `MassAsym: ${(statistics.massAsym || 0).toFixed(3)} | Speed: ${(statistics.speed || 0).toFixed(3)}`,
      `Symmetry: ${statistics.symmSides || "?"}-fold (${((statistics.symmStrength || 0) * 100).toFixed(1)}%)`,
      `FPS: ${statistics.fps}`,
    ];

    let yOffset = y;
    stats.forEach((line) => {
      text(line, x, yOffset);
      yOffset += 16;
    });

    pop();
  }
}
