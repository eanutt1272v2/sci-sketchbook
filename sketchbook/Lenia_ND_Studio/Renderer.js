class Renderer {
  constructor(
    size,
    colourMaps = {},
    initialColourMap = "greyscale",
    uiFont = null,
  ) {
    this.size = size;
    this.img = createImage(this.size, this.size);

    this.colourMaps = colourMaps;
    this.currentColourMap = "";
    this.lut = new Uint8ClampedArray(256 * 3);
    this.lutPacked = new Uint32Array(256);
    this._isLittleEndian = (() => {
      const u32 = new Uint32Array([0x11223344]);
      const u8 = new Uint8Array(u32.buffer);
      return u8[0] === 0x44;
    })();
    this.calcPanelImages = [];
    this.calcPanelsCanvas = null;
    this.lastCalcPanelsFrame = null;
    this._calcPanelFrameCounter = 0;
    this._calcPanelUpdateIntervalRunning = 3;
    this.lastLegendRange = { mode: "world", min: 0, max: 1 };
    this._kernelDisplayCache = null;
    this._kernelDisplayCacheSize = 0;
    this._kernelDisplayCacheSource = null;
    this.uiFont = uiFont;
    this._legendBarImg = null;
    this._legendBarCachedMap = "";
    this._legendGfx = null;
    this._legendCacheKey = "";
    this._scaleGfx = null;
    this._scaleCacheKey = "";
    this._statsGfx = null;
    this._statsFrameCount = 0;
    this._viewOffsetActive = false;
    this._viewShiftX = 0;
    this._viewShiftY = 0;
    this._viewTargetX = 0;
    this._viewTargetY = 0;
    this._rollBuffer = null;
    this._autoRotationAngle = 0;
    this._autoRotationTarget = 0;
    this.setColourMap(initialColourMap);
  }

  _applyTextFont(ctx = null) {
    const target = ctx || this;
    if (!this.uiFont) return;
    if (typeof target.textFont !== "function") return;
    target.textFont(this.uiFont);
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

  _computeDataRange(data) {
    if (!data || typeof data.length !== "number" || data.length === 0) {
      return { min: 0, max: 1 };
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < data.length; i++) {
      const v = Number(data[i]);
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: 0, max: 1 };
    }

    return { min, max };
  }

  resize(size) {
    this.size = size;
    this.img = createImage(this.size, this.size);
    this.calcPanelImages = [];
    this.calcPanelsCanvas = null;
    this.lastCalcPanelsFrame = null;
    this._kernelDisplayCache = null;
    this._kernelDisplayCacheSize = 0;
    this._kernelDisplayCacheSource = null;
    this._legendBarImg = null;
    this._legendBarCachedMap = "";
    if (this._legendGfx) {
      this._legendGfx.remove();
      this._legendGfx = null;
    }
    this._legendCacheKey = "";
    if (this._scaleGfx) {
      this._scaleGfx.remove();
      this._scaleGfx = null;
    }
    this._scaleCacheKey = "";
    if (this._statsGfx) {
      this._statsGfx.remove();
      this._statsGfx = null;
    }
  }

  _wrapCoord(value) {
    return ((value % this.size) + this.size) % this.size;
  }

  _torusDelta(a, b, size = this.size) {
    let delta = a - b;
    if (delta > size / 2) delta -= size;
    if (delta < -size / 2) delta += size;
    return delta;
  }

  _worldToScreen(x, y) {
    return {
      x: (x / this.size) * width,
      y: (y / this.size) * height,
    };
  }

  _nearestWrappedPoint(anchorX, anchorY, pointX, pointY) {
    return {
      x: anchorX + this._torusDelta(pointX, anchorX),
      y: anchorY + this._torusDelta(pointY, anchorY),
    };
  }

  _nearestWrappedShift(value, anchor) {
    return Math.round((anchor - value) / this.size) * this.size;
  }

  setViewOffset(active, centerX, centerY) {
    this._viewOffsetActive = active;
    if (
      active &&
      Number.isFinite(centerX) &&
      Number.isFinite(centerY)
    ) {
      const mid = this.size / 2;
      const tx = mid - centerX;
      const ty = mid - centerY;
      const alpha = 0.12;
      let dx = tx - this._viewTargetX;
      let dy = ty - this._viewTargetY;
      dx -= Math.round(dx / this.size) * this.size;
      dy -= Math.round(dy / this.size) * this.size;
      this._viewTargetX += dx;
      this._viewTargetY += dy;
      this._viewShiftX += alpha * (this._viewTargetX - this._viewShiftX);
      this._viewShiftY += alpha * (this._viewTargetY - this._viewShiftY);
    } else {
      this._viewShiftX = 0;
      this._viewShiftY = 0;
      this._viewTargetX = 0;
      this._viewTargetY = 0;
    }
  }

  setAutoRotation(angleRadians) {
    const target = Number.isFinite(angleRadians) ? angleRadians : 0;
    if (Math.abs(target) < 1e-9 && Math.abs(this._autoRotationAngle) < 1e-9) {
      this._autoRotationAngle = 0;
      this._autoRotationTarget = 0;
      return;
    }
    let delta = target - this._autoRotationTarget;
    delta = delta - Math.round(delta / (2 * Math.PI)) * 2 * Math.PI;
    this._autoRotationTarget += delta;
    const alpha = 0.12;
    this._autoRotationAngle += alpha * (this._autoRotationTarget - this._autoRotationAngle);
  }

  beginAutoRotation() {
    const a = this._autoRotationAngle;
    if (Math.abs(a) < 1e-6) return;
    background(0);
    push();
    translate(width / 2, height / 2);
    rotate(-a);
    translate(-width / 2, -height / 2);
  }

  endAutoRotation() {
    const a = this._autoRotationAngle;
    if (Math.abs(a) < 1e-6) return;
    pop();
  }

  screenToCell(screenX, screenY) {
    let px = screenX;
    let py = screenY;
    const a = this._autoRotationAngle;
    if (Math.abs(a) >= 1e-6) {
      const cx = width / 2;
      const cy = height / 2;
      const dx = px - cx;
      const dy = py - cy;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      px = cx + dx * cosA - dy * sinA;
      py = cy + dx * sinA + dy * cosA;
    }
    let cellX = Math.floor((px / width) * this.size);
    let cellY = Math.floor((py / height) * this.size);
    if (this._viewOffsetActive) {
      const sx = Math.round(this._viewShiftX);
      const sy = Math.round(this._viewShiftY);
      cellX = ((cellX - sx) % this.size + this.size) % this.size;
      cellY = ((cellY - sy) % this.size + this.size) % this.size;
    }
    return { x: cellX, y: cellY };
  }

  _rollViewData(src, size, shiftX, shiftY) {
    if (shiftX === 0 && shiftY === 0) return src;
    if (!this._rollBuffer || this._rollBuffer.length !== src.length) {
      this._rollBuffer = new Float32Array(src.length);
    }
    const out = this._rollBuffer;
    const nsx = ((-shiftX % size) + size) % size;
    for (let py = 0; py < size; py++) {
      const srcY = (((py - shiftY) % size) + size) % size;
      const srcRow = srcY * size;
      const dstRow = py * size;
      if (nsx === 0) {
        out.set(src.subarray(srcRow, srcRow + size), dstRow);
      } else {
        const firstLen = size - nsx;
        out.set(src.subarray(srcRow + nsx, srcRow + size), dstRow);
        out.set(src.subarray(srcRow, srcRow + nsx), dstRow + firstLen);
      }
    }
    return out;
  }

  _expandKernelForDisplay(kernel, kernelSize, viewSize) {
    if (!kernel || !kernelSize || kernelSize <= 0) return kernel;
    if (kernelSize === viewSize) return kernel;

    const out = new Float32Array(viewSize * viewSize);
    const viewMid = Math.floor(viewSize / 2);
    const kernelRadius = Math.floor(kernelSize / 2);
    const start = viewMid - kernelRadius;

    for (let ky = 0; ky < kernelSize; ky++) {
      const vy = start + ky;
      if (vy < 0 || vy >= viewSize) continue;
      const kRow = ky * kernelSize;
      const vRow = vy * viewSize;
      for (let kx = 0; kx < kernelSize; kx++) {
        const vx = start + kx;
        if (vx < 0 || vx >= viewSize) continue;
        out[vRow + vx] = kernel[kRow + kx];
      }
    }

    return out;
  }

  _getViewSpec(board, automaton, rawMode, params) {
    const mode = rawMode;
    const size = board?.size || this.size;
    const isSoftClip = !!params?.softClip;
    const isAritaMode = !!params?.aritaMode;

    if (mode === "world") {
      const data = board.world;
      let vmin = 0;
      if (isSoftClip && data) {
        const range = this._computeDataRange(data);
        if (range.min < 0) vmin = range.min;
      }
      return {
        mode,
        label: "World",
        data,
        srcSize: size,
        vmin,
        vmax: 1,
      };
    }

    if (mode === "potential") {
      const data = board.potential;
      let vmin = 0;
      if (isSoftClip && data) {
        const range = this._computeDataRange(data);
        if (range.min < 0) vmin = range.min;
      }
      return {
        mode,
        label: "Potential",
        data,
        srcSize: size,
        vmin,
        vmax: 2 * (automaton?.m || 0.15),
      };
    }

    if (mode === "growth") {
      return {
        mode: "growth",
        label: "Growth",
        data: board.growth,
        srcSize: size,
        vmin: isAritaMode ? 0 : -1,
        vmax: 1,
      };
    }

    if (mode === "kernel") {
      const kernel = automaton?.kernel;
      if (
        !this._kernelDisplayCache ||
        this._kernelDisplayCacheSize !== size ||
        this._kernelDisplayCacheSource !== kernel
      ) {
        this._kernelDisplayCache = this._expandKernelForDisplay(
          kernel,
          automaton.kernelSize,
          size,
        );
        this._kernelDisplayCacheSize = size;
        this._kernelDisplayCacheSource = kernel;
      }
      return {
        mode,
        label: "Kernel",
        data: this._kernelDisplayCache,
        srcSize: size,
        vmin: 0,
        vmax: 1,
      };
    }

    return this._getViewSpec(board, automaton, "world", params);
  }

  _getKernelCalcPanelSpec(automaton) {
    const kernel = automaton?.kernel;
    const kernelSize = automaton?.kernelSize || 0;
    return {
      mode: "kernel",
      label: "Kernel",
      data: kernel,
      srcSize: kernelSize,
      vmin: 0,
      vmax: 1,
    };
  }

  render(board, automaton, renderMode, colourMapName, params = null) {
    this.setColourMap(colourMapName);
    const view = this._getViewSpec(board, automaton, renderMode, params);
    let data = view.data;
    let vmin = view.vmin;
    let vmax = view.vmax;
    const currentSize = view.srcSize;
    let liveMin = Number.POSITIVE_INFINITY;
    let liveMax = Number.NEGATIVE_INFINITY;

    this._lastViewVmin = vmin;
    this._lastViewVmax = vmax;

    if (this.img.width !== currentSize || this.img.height !== currentSize) {
      this.img = createImage(currentSize, currentSize);
    }

    if (
      this._viewOffsetActive &&
      renderMode !== "kernel" &&
      data &&
      (this._viewShiftX !== 0 || this._viewShiftY !== 0)
    ) {
      data = this._rollViewData(
        data,
        currentSize,
        Math.round(this._viewShiftX),
        Math.round(this._viewShiftY),
      );
    }

    const scale = 255 / Math.max(vmax - vmin, 1e-9);
    this.img.loadPixels();
    const pixels = this.img.pixels;
    const lut = this.lut;
    if (this._isLittleEndian) {
      const packed = this.lutPacked;
      const pixels32 = new Uint32Array(pixels.buffer);
      const total = currentSize * currentSize;
      for (let i = 0; i < total; i++) {
        const val = data[i];
        if (val < liveMin) liveMin = val;
        if (val > liveMax) liveMax = val;
        let scaled = (val - vmin) * scale;
        if (scaled < 0) scaled = 0;
        else if (scaled > 255) scaled = 255;
        pixels32[i] = packed[(scaled + 0.5) | 0];
      }
    } else {
      for (let y = 0; y < currentSize; y++) {
        const row = y * currentSize;
        for (let x = 0; x < currentSize; x++) {
          const val = data[row + x];
          if (val < liveMin) liveMin = val;
          if (val > liveMax) liveMax = val;
          let scaled = (val - vmin) * scale;
          if (scaled < 0) scaled = 0;
          else if (scaled > 255) scaled = 255;
          const lutIndex = ((scaled + 0.5) | 0) * 3;
          const idx = (row + x) * 4;
          pixels[idx] = lut[lutIndex];
          pixels[idx + 1] = lut[lutIndex + 1];
          pixels[idx + 2] = lut[lutIndex + 2];
          pixels[idx + 3] = 255;
        }
      }
    }

    if (!Number.isFinite(liveMin) || !Number.isFinite(liveMax)) {
      liveMin = 0;
      liveMax = 1;
    }
    this.lastLegendRange = {
      mode: view.mode,
      min: liveMin,
      max: liveMax,
    };

    this.img.updatePixels();
    image(this.img, 0, 0, width, height);
  }

  renderCachedFrame() {
    if (this.img && this.img.width > 0 && this.img.height > 0) {
      image(this.img, 0, 0, width, height);
      return true;
    }

    background(0);
    return false;
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
    if (this.colourMaps.turbo) return "turbo";
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
      const r = constrain(Math.round(poly(colourMapData.r, t) * 255), 0, 255);
      const g = constrain(Math.round(poly(colourMapData.g, t) * 255), 0, 255);
      const b = constrain(Math.round(poly(colourMapData.b, t) * 255), 0, 255);
      this.lut[idx] = r;
      this.lut[idx + 1] = g;
      this.lut[idx + 2] = b;
      if (this._isLittleEndian) {
        this.lutPacked[i] = r | (g << 8) | (b << 16) | (255 << 24);
      }
    }
  }

  _valueToColour(val) {
    const v = Math.max(0, Math.min(1, val));
    const lutIndex = Math.min(255, Math.max(0, Math.round(v * 255))) * 3;
    return [this.lut[lutIndex], this.lut[lutIndex + 1], this.lut[lutIndex + 2]];
  }

  renderGrid(R, params = null) {
    const n = Math.max(0, Math.floor(R / 40));

    const cellPx = width / this.size;
    const mid = Math.floor(this.size / 2);
    const dotSize = Math.max(1, Math.round(cellPx * 0.4));

    const sx = this._viewOffsetActive ? this._viewShiftX : 0;
    const sy = this._viewOffsetActive ? this._viewShiftY : 0;
    const adjMidX =
      ((((mid + sx) % this.size) + this.size) % this.size);
    const adjMidY =
      ((((mid + sy) % this.size) + this.size) % this.size);

    push();
    noStroke();
    fill(95);

    const baseRow = ((adjMidY % R) + R) % R;
    const baseCol = ((adjMidX % R) + R) % R;

    for (let i = -n; i <= n; i++) {
      const rowStart = (((adjMidY + i) % R) + R) % R;
      const colStart = (((adjMidX + i) % R) + R) % R;

      for (let y = rowStart; y < this.size; y += R) {
        for (let x = baseCol; x < this.size; x += R) {
          rect(x * cellPx, y * cellPx, dotSize, dotSize);
        }
      }
      if (i !== 0) {
        for (let y = baseRow; y < this.size; y += R) {
          for (let x = colStart; x < this.size; x += R) {
            rect(x * cellPx, y * cellPx, dotSize, dotSize);
          }
        }
      }
    }

    pop();
  }

  renderScale(R, params = null) {
    const cacheKey = `${R}|${width}|${height}|${this.size}`;
    if (this._scaleGfx && this._scaleCacheKey === cacheKey) {
      image(this._scaleGfx, 0, 0);
      return;
    }

    if (
      !this._scaleGfx ||
      this._scaleGfx.width !== width ||
      this._scaleGfx.height !== height
    ) {
      if (this._scaleGfx) this._scaleGfx.remove();
      this._scaleGfx = createGraphics(width, height);
    }
    const pg = this._scaleGfx;
    pg.clear();

    const cellPx = width / this.size;
    const scaleWidth = R * cellPx;

    this._enableOverlayShadow(pg);
    pg.noStroke();

    const sx = width - 50;
    const sy = height - 20;
    pg.fill(255);
    pg.rect(sx - scaleWidth, sy + 3, scaleWidth, 4);
    this._applyTextFont(pg);
    pg.textSize(10);
    pg.textAlign(LEFT, TOP);
    pg.text("1mm", sx + 10, sy);

    const lx = width - 50;
    const ly = height - 35;
    pg.stroke(200);
    pg.strokeWeight(1);
    pg.line(lx - 90, ly, lx, ly);
    pg.noStroke();
    pg.fill(200);
    const dotR = 2;
    for (const m of [0, -10, -50, -90]) {
      pg.ellipse(lx + m, ly, dotR * 2, dotR * 2);
    }
    pg.fill(255);
    pg.textSize(10);
    pg.textAlign(LEFT, TOP);
    pg.text("2s", lx - 95, ly - 15);
    pg.text("1s", lx - 55, ly - 15);

    this._disableOverlayShadow(pg);
    this._scaleCacheKey = cacheKey;
    image(pg, 0, 0);
  }

  renderLegend(vmin, vmax) {
    const effectiveVmin =
      vmin !== undefined
        ? vmin
        : this._lastViewVmin !== undefined
          ? this._lastViewVmin
          : 0;
    const effectiveVmax =
      vmax !== undefined
        ? vmax
        : this._lastViewVmax !== undefined
          ? this._lastViewVmax
          : 1;

    const cacheKey = `${this.currentColourMap}|${effectiveVmin.toFixed(1)}|${effectiveVmax.toFixed(1)}|${width}|${height}`;
    if (this._legendGfx && this._legendCacheKey === cacheKey) {
      image(this._legendGfx, 0, 0);
      return;
    }

    if (
      this.currentColourMap !== this._legendBarCachedMap ||
      !this._legendBarImg
    ) {
      this._legendBarImg = createImage(1, 253);
      this._legendBarImg.loadPixels();
      for (let i = 0; i < 253; i++) {
        const lutIndex = (252 - i) * 3;
        const idx = i * 4;
        this._legendBarImg.pixels[idx] = this.lut[lutIndex];
        this._legendBarImg.pixels[idx + 1] = this.lut[lutIndex + 1];
        this._legendBarImg.pixels[idx + 2] = this.lut[lutIndex + 2];
        this._legendBarImg.pixels[idx + 3] = 255;
      }
      this._legendBarImg.updatePixels();
      this._legendBarCachedMap = this.currentColourMap;
    }

    if (
      !this._legendGfx ||
      this._legendGfx.width !== width ||
      this._legendGfx.height !== height
    ) {
      if (this._legendGfx) this._legendGfx.remove();
      this._legendGfx = createGraphics(width, height);
    }
    const pg = this._legendGfx;
    pg.clear();

    const barW = 5;
    const x0 = width - 20;
    const y0 = height - 70;
    const y1 = 20;
    const barH = y0 - y1;

    this._enableOverlayShadow(pg);
    pg.noSmooth();
    pg.image(this._legendBarImg, x0, y1, barW, barH);

    this._disableOverlayShadow(pg);
    pg.noFill();
    pg.stroke(200);
    pg.strokeWeight(1);
    pg.rect(x0 - 1, y1 - 1, barW + 2, barH + 2);
    this._enableOverlayShadow(pg);

    pg.noStroke();
    pg.fill(255);
    this._applyTextFont(pg);
    pg.textSize(10);
    pg.textAlign(RIGHT, CENTER);
    pg.text(effectiveVmin.toFixed(1), x0 - 5, y0);
    pg.text(
      ((effectiveVmin + effectiveVmax) / 2).toFixed(1),
      x0 - 5,
      (y1 + y0) / 2,
    );
    pg.text(effectiveVmax.toFixed(1), x0 - 5, y1);

    this._disableOverlayShadow(pg);
    this._legendCacheKey = cacheKey;
    image(pg, 0, 0);
  }

  renderKeymapRef(metadata) {
    const { name, version } = metadata;

    push();
    this._enableOverlayShadow();
    fill(0, 220);
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
        title: "Run Control",
        entries: [
          ["Enter", "Pause / Resume"],
          ["Space", "Step once"],
          ["Del / Bksp", "Clear world"],
        ],
      },
      {
        title: "Animals & World",
        entries: [
          ["Z", "Reload current animal"],
          ["C / V", "Previous / next animal (Shift ±10)"],
          ["X", "Place at random (Shift ×5)"],
          ["Shift+X", "Toggle click-to-place mode"],
          ["Ctrl+[/]", "Place scale -/+"],
          ["Ctrl+K", "Toggle auto-scale R, T"],
          ["Ctrl+Shift+K", "Apply scaled R, T"],
          ["Ctrl+Shift+Z", "Reset R, T from animal"],
          ["N", "Random world (Shift=seeded)"],
          ["M", "Random world"],
          ["'", "Toggle auto-center"],
        ],
      },
      {
        title: "Parameters",
        entries: [
          ["Q / A", "Growth centre m  +/- 0.001 (Shift ±0.01)"],
          ["W / S", "Growth width s  +/- 0.0001 (Shift ±0.001)"],
          ["R / F", "Kernel radius R  +/- 10 (Shift ±1)"],
          ["T / G", "Time steps T  ×2 / ÷2 (Shift ±1)"],
          ["E / D", "Quantise paramP  +/- 10 (Shift ±1)"],
          ["Ctrl+T / Ctrl+G", "Weight h  +/- 0.1"],
          ["Y/U/I/O/P", "Kernel peaks b[0-4]  +/- 1/12 (Shift -)"],
          [";", "Add peak (Shift=remove)"],
        ],
      },
      {
        title: "Options",
        entries: [
          ["Ctrl+Y", "Cycle kernel core kn (Shift=reverse)"],
          ["Ctrl+U", "Cycle growth func gn (Shift=reverse)"],
          ["Ctrl+I", "Toggle soft clip (Shift=mask rate)"],
          ["Ctrl+O", "Cycle noise"],
          ["Ctrl+P", "Toggle Arita mode (Shift=reset mask+noise)"],
          ["Ctrl+M", "Toggle multi-step"],
          ["Ctrl+D", "Cycle dimension (2D/3D/4D)"],
        ],
      },
      {
        title: "Transforms",
        entries: [
          ["Arrows", "Shift world ±10 (Shift ±1)"],
          ["Ctrl+←/→", "Rotate ±90° (Shift ±15°)"],
          ["= / Shift+=", "Flip horiz / vert"],
          ["- (minus)", "Transpose"],
          ["PgUp/PgDn", "Shift Z-slice (3D+)"],
          ["Home/End", "Scroll slice Z (3D+)"],
          ["Ctrl+End", "Toggle slice/projection (3D+)"],
        ],
      },
      {
        title: "Display",
        entries: [
          ["Tab", "Cycle render mode (Shift=reverse)"],
          [". / ,", "Next / prev colour map"],
          ["H", "Hide / show GUI panel"],
          ["Ctrl+H", "Toggle stats overlay"],
          ["Ctrl+J", "Toggle symmetry overlay"],
          ["J", "Toggle motion overlay"],
          ["Shift+J", "Toggle animal name"],
          ["K", "Toggle calc panels"],
          ["L", "Toggle legend"],
          ["B", "Toggle scale bar"],
          ["Shift+G", "Toggle grid (slice view)"],
          ["` (backtick)", "Cycle grid size"],
        ],
      },
      {
        title: "Data",
        entries: [
          ["Ctrl+R", "Start / stop recording"],
          ["Ctrl+S", "Save canvas as PNG"],
          ["Ctrl+Shift+E", "Export world (JSON)"],
          ["Ctrl+Shift+W", "Import world (JSON)"],
          ["Ctrl+Shift+P/I", "Export / import params (JSON)"],
          ["#", "Toggle keymap reference"],
        ],
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

    this._disableOverlayShadow();
    pop();
  }

  renderMotionOverlay(statistics, params = {}) {
    const { mass, centerX, centerY, speed, angle } = statistics;

    const hasValidCenter = Number.isFinite(centerX) && Number.isFinite(centerY);
    const hasVisibleMass = Number.isFinite(mass) && mass > 1e-10;

    if (!hasValidCenter || !hasVisibleMass) {
      this._lastCenterX = undefined;
      this._lastCenterY = undefined;
      return;
    }

    const T = Number(params.T) || 10;
    const cellPx = width / this.size;
    const m1x = centerX;
    const m1y = centerY;

    let m0x, m0y;
    if (
      Number.isFinite(this._lastCenterX) &&
      Number.isFinite(this._lastCenterY)
    ) {
      m0x = this._lastCenterX;
      m0y = this._lastCenterY;
    } else {
      m0x = m1x;
      m0y = m1y;
    }
    this._lastCenterX = m1x;
    this._lastCenterY = m1y;

    let dx = m1x - m0x;
    let dy = m1y - m0y;
    if (dx > this.size / 2) dx -= this.size;
    if (dx < -this.size / 2) dx += this.size;
    if (dy > this.size / 2) dy -= this.size;
    if (dy < -this.size / 2) dy += this.size;

    const running = !!params.running;
    const hasNewMotion = Math.abs(dx) + Math.abs(dy) > 1e-6;
    if (running && hasNewMotion) {
      const alpha = 0.15;
      if (
        Number.isFinite(this._lastMotionDx) &&
        Number.isFinite(this._lastMotionDy)
      ) {
        this._lastMotionDx += alpha * (dx - this._lastMotionDx);
        this._lastMotionDy += alpha * (dy - this._lastMotionDy);
      } else {
        this._lastMotionDx = dx;
        this._lastMotionDy = dy;
      }
    }
    if (
      Number.isFinite(this._lastMotionDx) &&
      Number.isFinite(this._lastMotionDy)
    ) {
      dx = this._lastMotionDx;
      dy = this._lastMotionDy;
    }

    const m2x = m0x + dx * T;
    const m2y = m0y + dy * T;
    const m3x = m0x + dx * 2 * T;
    const m3y = m0y + dy * 2 * T;

    const vsx = this._viewOffsetActive ? this._viewShiftX : 0;
    const vsy = this._viewOffsetActive ? this._viewShiftY : 0;
    const am1x = m1x + vsx;
    const am1y = m1y + vsy;

    const ms_x = (((am1x % this.size) + this.size) % this.size) - am1x;
    const ms_y = (((am1y % this.size) + this.size) % this.size) - am1y;

    const dotR = 2;

    const c254 = [127, 127, 127];
    const c255 = [255, 255, 255];

    push();
    this._enableOverlayShadow();
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const adjx = i * this.size + ms_x + vsx;
        const adjy = j * this.size + ms_y + vsy;

        const p0x = (m0x + adjx) * cellPx;
        const p0y = (m0y + adjy) * cellPx;
        const p3x = (m3x + adjx) * cellPx;
        const p3y = (m3y + adjy) * cellPx;

        if (
          Math.max(p0x, p3x) < -20 ||
          Math.min(p0x, p3x) > width + 20 ||
          Math.max(p0y, p3y) < -20 ||
          Math.min(p0y, p3y) > height + 20
        ) {
          continue;
        }

        stroke(c254[0], c254[1], c254[2]);
        strokeWeight(1);
        line(p0x, p0y, p3x, p3y);

        noStroke();
        const points = [
          { x: m0x, y: m0y, col: c254 },
          { x: m1x, y: m1y, col: c255 },
          { x: m2x, y: m2y, col: c255 },
          { x: m3x, y: m3y, col: c255 },
        ];
        for (const pt of points) {
          const px = (pt.x + adjx) * cellPx;
          const py = (pt.y + adjy) * cellPx;
          fill(pt.col[0], pt.col[1], pt.col[2]);
          ellipse(px, py, dotR * 2, dotR * 2);
        }
      }
    }
    this._disableOverlayShadow();
    pop();
  }

  renderSymmetryOverlay(statistics, params = {}) {
    const POLYGON_NAME = {
      1: "irregular",
      2: "bilateral",
      3: "trimeric",
      4: "tetrameric",
      5: "pentameric",
      6: "hexameric",
      7: "heptameric",
      8: "octameric",
      9: "nonameric",
      10: "decameric",
      0: "polymeric",
    };

    const { mass, centerX, centerY, symmSides, symmStrength, symmAngle } =
      statistics;
    const sidesVec = statistics.sidesVec;
    const angleVec = statistics.angleVec;
    const rotateVec = statistics.rotateVec;
    const symmMaxRadius = statistics.symmMaxRadius || 0;

    const hasValidCenter =
      Number.isFinite(centerX) && Number.isFinite(centerY);
    const hasVisibleMass = Number.isFinite(mass) && mass > 1e-10;
    const k = symmSides || 0;

    if (!hasValidCenter || !hasVisibleMass || k < 2) return;

    const T = Number(params.T) || 10;
    const cellPx = width / this.size;
    const a = symmAngle || 0;

    const vsx = this._viewOffsetActive ? this._viewShiftX : 0;
    const vsy = this._viewOffsetActive ? this._viewShiftY : 0;
    const m1x =
      (((centerX + vsx) % this.size) + this.size) % this.size;
    const m1y =
      (((centerY + vsy) % this.size) + this.size) % this.size;
    const m1px = m1x * cellPx;
    const m1py = m1y * cellPx;

    const c254 = [127, 127, 127];
    const c255 = [255, 255, 255];
    const dotR = 4;

    push();
    this._enableOverlayShadow();

    const maxDist = Math.max(this.size, this.size);
    stroke(c254[0], c254[1], c254[2]);
    strokeWeight(1);
    for (let i = 0; i < k; i++) {
      const angle = (2 * Math.PI * i) / k + a;
      const dx = Math.sin(angle) * maxDist;
      const dy = Math.cos(angle) * maxDist;
      line(m1px, m1py, (m1x - dx) * cellPx, (m1y - dy) * cellPx);
    }

    if (sidesVec && angleVec) {
      const numRadii = Math.min(symmMaxRadius, sidesVec.length);
      for (let rIdx = 0; rIdx < numRadii; rIdx++) {
        const kk = sidesVec[rIdx];
        if (kk < 2) continue;
        const aa = angleVec[rIdx];
        const ww = rotateVec ? rotateVec[rIdx] * T : 0;
        const dist = rIdx + 1;
        const col = kk === k ? c255 : c254;

        for (let i = 0; i < kk; i++) {
          const angle = (2 * Math.PI * i) / kk + aa;
          const dx = Math.sin(angle) * dist;
          const dy = Math.cos(angle) * dist;
          const dotX = (m1x - dx) * cellPx;
          const dotY = (m1y - dy) * cellPx;

          noStroke();
          fill(col[0], col[1], col[2]);
          ellipse(dotX, dotY, dotR * 2, dotR * 2);

          if (Math.abs(ww) > 0.01) {
            noFill();
            stroke(col[0], col[1], col[2]);
            strokeWeight(1);
            const arcR = dist * cellPx;
            const p5a1 = (3 * Math.PI) / 2 - angle;
            const p5a2 = p5a1 - ww;
            const arcStart = Math.min(p5a1, p5a2);
            const arcStop = Math.max(p5a1, p5a2);
            arc(m1px, m1py, arcR * 2, arcR * 2, arcStart, arcStop);
          }
        }
      }
    }
    this._disableOverlayShadow();
    pop();
  }

  renderSymmetryTitle(statistics) {
    const POLYGON_NAME = {
      1: "irregular",
      2: "bilateral",
      3: "trimeric",
      4: "tetrameric",
      5: "pentameric",
      6: "hexameric",
      7: "heptameric",
      8: "octameric",
      9: "nonameric",
      10: "decameric",
      0: "polymeric",
    };

    const k = statistics.symmSides || 0;
    if (k < 2) return;

    push();
    this._enableOverlayShadow();
    this._applyTextFont();
    noStroke();
    fill(255);
    textSize(15);
    textAlign(CENTER, TOP);
    const name = POLYGON_NAME[k <= 10 ? k : 0];
    text(`symmetry: ${k} (${name})`, width / 2, 20);
    this._disableOverlayShadow();
    pop();
  }

  renderAnimalName(animal) {
    if (!animal) return;
    const parts = [
      animal.code || "",
      animal.name || "",
      animal.cname ? `${animal.cname}` : "",
    ].filter(Boolean);
    const label = parts.join(" ");
    if (!label) return;
    push();
    textFont("monospace");
    this._enableOverlayShadow();
    noStroke();
    textSize(15);
    textAlign(CENTER, BOTTOM);
    fill(255);
    text(label, width / 2, height - 20);
    this._disableOverlayShadow();
    pop();
  }

  renderStats(statistics, params) {
    this._statsFrameCount += 1;
    if (this._statsGfx && this._statsFrameCount % 6 !== 0) {
      image(this._statsGfx, 0, 0);
      return;
    }

    if (
      !this._statsGfx ||
      this._statsGfx.width !== width ||
      this._statsGfx.height !== height
    ) {
      if (this._statsGfx) this._statsGfx.remove();
      this._statsGfx = createGraphics(width, height);
    }

    const pg = this._statsGfx;
    pg.clear();

    const dt = 1 / params.T;
    const RN = Math.pow(params.R, 2);
    const dim = Math.max(2, Math.floor(Number(params.dimension) || 2));
    const worldSize = this.size;
    const worldShape =
      dim === 2 ? `${worldSize}x${worldSize}` : `${worldSize}^${dim}`;
    const fmt = (value, fixed = 3) => {
      const n = Number(value) || 0;
      const abs = Math.abs(n);
      if (abs > 0 && abs < Math.pow(10, -fixed)) {
        const [mant, exp] = n.toExponential(2).split("e");
        return `${mant}e^${Number(exp)}`;
      }
      return n.toFixed(fixed);
    };

    const stats = [
      `FPS=${(Number(statistics.fps) || 0).toFixed(1)} [Hz]`,
      `Generation=${String(statistics.gen)} [gen]`,
      `Simulation Time=${fmt(statistics.time, 3)} [μs]`,
      `Time Step: dt=1/T=${fmt(dt, 3)} [μs/gen]`,
      `Running=${params.running ? "true" : "false"} (bool)`,
      `Dimension: D=${dim} (2D/3D/4D)`,
      `Grid Size=${worldShape} [cells]`,
      `Render Mode=${params.renderMode} (mode id)`,
      `Colour Map=${this.currentColourMap || params.colourMap} (palette id)`,
      `Kernel Radius: R=${fmt(params.R, 2)} [cells]`,
      `Time Scale: T=${fmt(params.T, 2)} [gen/μs]`,
      `Growth Mean: m=${fmt(params.m, 3)} [cell-state]`,
      `Growth Std Dev: s=${fmt(params.s, 3)} [cell-state]`,
      `Centre μ=${fmt(params.m, 3)} | Width σ=${fmt(params.s, 3)} (growth function)`,
      `Functions: kn=${params.kn} | gn=${params.gn} (family ids)`,
      `Mass/R²=${fmt(statistics.mass / RN, 3)} [μg/cell²]`,
      `Growth/R²=${fmt(statistics.growth / RN, 4)} [μg/(μs·cell²)]`,
      `Mass (log)=${fmt(statistics.massLog || 0, 4)} [μg]`,
      `Growth (log)=${fmt(statistics.growthLog || 0, 4)} [μg/μs]`,
      `Mass Volume (log)=${fmt(statistics.massVolumeLog || 0, 4)} [μm²]`,
      `Growth Volume (log)=${fmt(statistics.growthVolumeLog || 0, 4)} [μm²]`,
      `Mass Density=${fmt(statistics.massDensity || 0, 6)} [μg/μm²]`,
      `Growth Density=${fmt(statistics.growthDensity || 0, 6)} [μg/(μm²·μs)]`,
      `Peak Value=${fmt(statistics.maxValue, 3)} [cell-state]`,
      `Gyradius=${fmt(statistics.gyradius, 2)} [μm]`,
      `Centroid=(${fmt(statistics.centerX, 1)}, ${fmt(statistics.centerY, 1)}) [μm]`,
      `Growth Centre=(${fmt(statistics.growthCenterX, 1)}, ${fmt(statistics.growthCenterY, 1)}) [μm]`,
      `Mass-Growth Dist=${fmt(statistics.massGrowthDist || 0, 3)} [μm]`,
      `Speed=${fmt(statistics.speed || 0, 3)} [μm/μs]`,
      `Centroid Speed=${fmt(statistics.centroidSpeed || 0, 4)} [μm/μs]`,
      `Angle=${fmt(statistics.angle || 0, 3)} [rad]`,
      `Centroid Rot Speed=${fmt(statistics.centroidRotateSpeed || 0, 5)} [rad/μs]`,
      `Growth Rot Speed=${fmt(statistics.growthRotateSpeed || 0, 5)} [rad/μs]`,
      `Major Axis Rot Speed=${fmt(statistics.majorAxisRotateSpeed || 0, 5)} [rad/μs]`,
      `Mass Asymmetry=${fmt(statistics.massAsym || 0, 3)} [μg]`,
      `Symmetry Order=${statistics.symmSides || "?"}`,
      `Symmetry Strength=${fmt((statistics.symmStrength || 0) * 100, 1)} [%]`,
      `Rotation Speed=${fmt(statistics.rotationSpeed || 0, 3)} [rad/μs]`,
      `Lyapunov=${fmt(statistics.lyapunov || 0, 6)} [gen⁻¹]`,
      `Hu1 (log)=${fmt(statistics.hu1Log || 0, 6)}`,
      `Hu4 (log)=${fmt(statistics.hu4Log || 0, 6)}`,
      `Hu5 (log)=${fmt(statistics.hu5Log || 0, 6)}`,
      `Hu6 (log)=${fmt(statistics.hu6Log || 0, 6)}`,
      `Hu7 (log)=${fmt(statistics.hu7Log || 0, 6)}`,
      `Flusser7=${fmt(statistics.flusser7 || 0, 6)}`,
      `Flusser8 (log)=${fmt(statistics.flusser8Log || 0, 6)}`,
      `Flusser9 (log)=${fmt(statistics.flusser9Log || 0, 6)}`,
      `Flusser10 (log)=${fmt(statistics.flusser10Log || 0, 6)}`,
      `Period=${fmt(statistics.period || 0, 3)} [μs]`,
      `Period Confidence=${fmt((statistics.periodConfidence || 0) * 100, 2)} [%]`,
    ];

    this._applyTextFont(pg);
    this._enableOverlayShadow(pg);
    pg.textAlign(LEFT, TOP);
    pg.textSize(12.5);
    pg.noStroke();
    pg.fill(255);
    pg.text(stats.join("\n"), 20, 20);
    this._disableOverlayShadow(pg);

    image(pg, 0, 0);
  }

  renderCalcPanels(board, automaton, params) {
    if (!board || !automaton) return;

    this._calcPanelFrameCounter += 1;
    if (
      params?.running &&
      this.lastCalcPanelsFrame &&
      this._calcPanelFrameCounter % this._calcPanelUpdateIntervalRunning !== 0
    ) {
      this.renderCachedCalcPanels();
      return;
    }

    this.setColourMap(params.colourMap);

    const layout = this._getCalcPanelLayout();
    const { panelSize, gap, cols, rows, totalW, totalH, baseX, baseY } = layout;
    const panelCanvas = this._ensureCalcPanelsCanvas(layout);

    panelCanvas.clear();

    const views = [
      this._getViewSpec(board, automaton, "world", params),
      this._getViewSpec(board, automaton, "potential", params),
      this._getViewSpec(board, automaton, "growth", params),
      this._getKernelCalcPanelSpec(automaton),
    ];

    for (let i = 0; i < views.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (panelSize + gap);
      const y = row * (panelSize + gap);
      this._renderCalcPanel(views[i], x, y, panelSize, panelCanvas, i);
    }

    this._renderCalcPanelBorders(0, 0, panelSize, gap, cols, rows, panelCanvas);
    this.lastCalcPanelsFrame = panelCanvas;

    image(panelCanvas, baseX, baseY, totalW, totalH);
  }

  renderCachedCalcPanels() {
    if (!this.lastCalcPanelsFrame) {
      return false;
    }

    const layout = this._getCalcPanelLayout();
    const b = {
      x: layout.baseX,
      y: layout.baseY,
      w: layout.totalW,
      h: layout.totalH,
    };
    image(this.lastCalcPanelsFrame, b.x, b.y, b.w, b.h);

    return true;
  }

  _ensureCalcPanelsCanvas(layout) {
    const { totalW, totalH } = layout;
    if (
      !this.calcPanelsCanvas ||
      this.calcPanelsCanvas.width !== totalW ||
      this.calcPanelsCanvas.height !== totalH
    ) {
      this.calcPanelsCanvas = createGraphics(totalW, totalH);
      if (typeof this.calcPanelsCanvas.pixelDensity === "function") {
        this.calcPanelsCanvas.pixelDensity(1);
      }
      if (typeof this.calcPanelsCanvas.noSmooth === "function") {
        this.calcPanelsCanvas.noSmooth();
      }
    }
    return this.calcPanelsCanvas;
  }

  _getCalcPanelLayout() {
    const panelSize = 96;
    const gap = 8;
    const cols = 2;
    const rows = 2;
    const totalW = cols * panelSize + (cols - 1) * gap;
    const totalH = rows * panelSize + (rows - 1) * gap;
    const baseX = 20;
    const baseY = height - totalH - 20;
    return { panelSize, gap, cols, rows, totalW, totalH, baseX, baseY };
  }

  _renderCalcPanelBorders(
    baseX,
    baseY,
    panelSize,
    gap,
    cols,
    rows,
    target = null,
  ) {
    const ctx = target || this;
    ctx.push();
    this._enableOverlayShadow(ctx);
    ctx.noFill();
    ctx.stroke(255, 210);
    ctx.strokeWeight(1);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = baseX + col * (panelSize + gap);
        const y = baseY + row * (panelSize + gap);
        ctx.rect(x, y, panelSize, panelSize);
      }
    }
    this._disableOverlayShadow(ctx);
    ctx.pop();
  }

  _getCalcPanelImage(panelIndex, panelSize) {
    if (!Array.isArray(this.calcPanelImages)) {
      this.calcPanelImages = [];
    }

    let img = this.calcPanelImages[panelIndex];
    if (!img || img.width !== panelSize || img.height !== panelSize) {
      img = createImage(panelSize, panelSize);
      this.calcPanelImages[panelIndex] = img;
    }
    return img;
  }

  _renderCalcPanel(view, x, y, panelSize, target = null, panelIndex = 0) {
    const ctx = target || this;
    const label = view?.label || "Panel";
    const hasData = !!(
      view &&
      view.data &&
      Number.isFinite(view.srcSize) &&
      view.srcSize > 0
    );

    ctx.push();
    ctx.noStroke();
    ctx.fill(0, 190);
    ctx.rect(x, y, panelSize, panelSize);
    ctx.pop();

    if (!hasData) {
      ctx.push();
      this._enableOverlayShadow(ctx);
      ctx.noStroke();
      ctx.fill(0, 170);
      ctx.rect(x + 1, y + 1, panelSize - 2, panelSize - 2);
      this._applyTextFont(ctx);
      ctx.textSize(10);
      ctx.textAlign(LEFT, TOP);
      ctx.fill(255, 220);
      ctx.text(`${label} (pending)`, x + 6, y + 4);
      this._disableOverlayShadow(ctx);
      ctx.pop();
      return;
    }

    const img = this._getCalcPanelImage(panelIndex, panelSize);
    const srcSize = view.srcSize;
    const src = view.data;
    const panelVmin = view.vmin || 0;
    const panelVmax = view.vmax || 0;
    const denom = Math.max(panelVmax - panelVmin, 1e-9);

    img.loadPixels();
    const scale255 = 255 / denom;
    if (this._isLittleEndian) {
      const packed = this.lutPacked;
      const pixels32 = new Uint32Array(img.pixels.buffer);
      for (let py = 0; py < panelSize; py++) {
        const sy = Math.min(srcSize - 1, ((py * srcSize) / panelSize) | 0);
        const srcRow = sy * srcSize;
        const dstRow = py * panelSize;
        for (let px = 0; px < panelSize; px++) {
          const sx = Math.min(srcSize - 1, ((px * srcSize) / panelSize) | 0);
          let scaled = ((src[srcRow + sx] || 0) - panelVmin) * scale255;
          if (scaled < 0) scaled = 0;
          else if (scaled > 255) scaled = 255;
          pixels32[dstRow + px] = packed[(scaled + 0.5) | 0];
        }
      }
    } else {
      const lut = this.lut;
      for (let py = 0; py < panelSize; py++) {
        const sy = Math.min(srcSize - 1, ((py * srcSize) / panelSize) | 0);
        const srcRow = sy * srcSize;
        for (let px = 0; px < panelSize; px++) {
          const sx = Math.min(srcSize - 1, ((px * srcSize) / panelSize) | 0);
          let scaled = ((src[srcRow + sx] || 0) - panelVmin) * scale255;
          if (scaled < 0) scaled = 0;
          else if (scaled > 255) scaled = 255;
          const lutIndex = ((scaled + 0.5) | 0) * 3;
          const p = (py * panelSize + px) * 4;
          img.pixels[p] = lut[lutIndex];
          img.pixels[p + 1] = lut[lutIndex + 1];
          img.pixels[p + 2] = lut[lutIndex + 2];
          img.pixels[p + 3] = 255;
        }
      }
    }
    img.updatePixels();

    ctx.push();
    if (typeof ctx.noSmooth === "function") ctx.noSmooth();
    ctx.image(img, x, y, panelSize, panelSize);

    ctx.noStroke();
    ctx.fill(0, 200);
    this._applyTextFont(ctx);
    this._enableOverlayShadow(ctx);
    ctx.textSize(10);
    ctx.textAlign(LEFT, TOP);
    ctx.fill(255);
    ctx.text(label, x + 6, y + 4);
    this._disableOverlayShadow(ctx);
    ctx.pop();
  }

  dispose() {
    this.img = null;
    this.calcPanelImages = [];
    this.calcPanelsCanvas = null;
    this.lastCalcPanelsFrame = null;
    this.lutPacked = null;
    this._kernelDisplayCache = null;
    this._kernelDisplayCacheSize = 0;
    this._kernelDisplayCacheSource = null;
    this._legendBarImg = null;
    this._legendBarCachedMap = "";
    if (this._legendGfx) {
      this._legendGfx.remove();
      this._legendGfx = null;
    }
    this._legendCacheKey = "";
    if (this._scaleGfx) {
      this._scaleGfx.remove();
      this._scaleGfx = null;
    }
    this._scaleCacheKey = "";
    if (this._statsGfx) {
      this._statsGfx.remove();
      this._statsGfx = null;
    }
    this._rollBuffer = null;
  }
}
