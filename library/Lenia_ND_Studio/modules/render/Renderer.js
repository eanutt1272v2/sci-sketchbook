class Renderer {
  static installMethodsFrom(sourceClass) {
    if (!sourceClass || !sourceClass.prototype) return;
    for (const name of Object.getOwnPropertyNames(sourceClass.prototype)) {
      if (name === "constructor") continue;
      Renderer.prototype[name] = sourceClass.prototype[name];
    }
  }

  constructor(
    size,
    colourMaps = {},
    initialColourMap = "greyscale",
    uiFont = null,
  ) {
    this.size = size;
    this.img = this._createReadbackBuffer(this.size, this.size);

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
    this._statisticsGfx = null;
    this._statisticsFrameCount = 0;
    this._viewOffsetActive = false;
    this._viewShiftX = 0;
    this._viewShiftY = 0;
    this._viewTargetX = 0;
    this._viewTargetY = 0;
    this._rollBuffer = null;
    this._polarBuffer = null;
    this._polarHalfBuffer = null;
    this._autoRotationAngle = 0;
    this._autoRotationTarget = 0;
    this._channelMaps = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0.75, 0.375, 0],
      [0, 0.75, 0.375],
      [0.375, 0, 0.75],
      [0.5, 0.5, 0.5],
      [0.375, 0.375, 0.375],
      [0.25, 0.25, 0.25],
      [1, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 1],
    ];
    this._channelBg = [
      [0, 0, 0.25],
      [0, 0.125, 0],
      [0, 0, 0],
      [0, 0, 0.25],
      [0, 0, 0.25],
      [0, 0, 0.25],
    ];
    this._channelLegendChars = "RGBOTVWEKR---G---B";
    this.setColourMap(initialColourMap);
  }

  _createReadbackBuffer(widthPx, heightPx) {
    const canvasEl = document.createElement("canvas");
    try {
      canvasEl.getContext("2d", { willReadFrequently: true });
    } catch {
      canvasEl.getContext("2d");
    }

    const buffer = createGraphics(widthPx, heightPx, canvasEl);
    if (typeof buffer.pixelDensity === "function") {
      buffer.pixelDensity(1);
    }
    if (typeof buffer.noSmooth === "function") {
      buffer.noSmooth();
    }
    return buffer;
  }

  _releaseBuffer(buffer) {
    if (buffer && typeof buffer.remove === "function") {
      buffer.remove();
    }
  }

  _applyTextFont(ctx = null) {
    const target = ctx || this;
    if (!this.uiFont) return;
    if (typeof target.textFont !== "function") return;
    target.textFont(this.uiFont);
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
    this._releaseBuffer(this.img);
    this.img = this._createReadbackBuffer(this.size, this.size);
    if (Array.isArray(this.calcPanelImages)) {
      this.calcPanelImages.forEach((panel) => this._releaseBuffer(panel));
    }
    this.calcPanelImages = [];
    this._releaseBuffer(this.calcPanelsCanvas);
    this.calcPanelsCanvas = null;
    this.lastCalcPanelsFrame = null;
    this._kernelDisplayCache = null;
    this._kernelDisplayCacheSize = 0;
    this._kernelDisplayCacheSource = null;
    this._releaseBuffer(this._legendBarImg);
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
    if (this._statisticsGfx) {
      this._statisticsGfx.remove();
      this._statisticsGfx = null;
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

  _toViewWrappedPoint(pointX, pointY, viewShiftX = 0, viewShiftY = 0) {
    const x = Number(pointX) + viewShiftX;
    const y = Number(pointY) + viewShiftY;
    return {
      x: ((x % this.size) + this.size) % this.size,
      y: ((y % this.size) + this.size) % this.size,
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

  setViewOffset(active, centreX, centreY) {
    this._viewOffsetActive = active;
    if (active && Number.isFinite(centreX) && Number.isFinite(centreY)) {
      const mid = this.size / 2;
      const tx = mid - centreX;
      const ty = mid - centreY;
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
    this._autoRotationAngle +=
      alpha * (this._autoRotationTarget - this._autoRotationAngle);
  }

  beginAutoRotation() {
    const a = this._autoRotationAngle;
    if (Math.abs(a) < 1e-6) return;
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
      cellX = (((cellX - sx) % this.size) + this.size) % this.size;
      cellY = (((cellY - sy) % this.size) + this.size) % this.size;
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

  _safeArrayMax(arr, fallback = 1) {
    if (!arr || typeof arr.length !== "number" || arr.length === 0) {
      return fallback;
    }
    let maxVal = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < arr.length; i++) {
      const v = Number(arr[i]);
      if (!Number.isFinite(v)) continue;
      if (v > maxVal) maxVal = v;
    }
    if (!Number.isFinite(maxVal) || Math.abs(maxVal) < 1e-12) return fallback;
    return maxVal;
  }

  _getChannelCountFromData(data, size) {
    const cellCount = size * size;
    if (!data || typeof data.length !== "number" || cellCount <= 0) return 1;
    return Math.max(1, Math.floor(data.length / cellCount));
  }

  _channelSliceView(data, size, channel = 0) {
    if (!data || typeof data.length !== "number") return data;
    const cellCount = size * size;
    const channelCount = this._getChannelCountFromData(data, size);
    if (channelCount <= 1) return data;
    const index = Math.max(
      0,
      Math.min(channelCount - 1, Math.floor(Number(channel) || 0)),
    );
    const offset = index * cellCount;
    return data.subarray(offset, offset + cellCount);
  }

  _resolveChannelPalette(channelCount, channelShift = 0) {
    const shift = ((Math.floor(Number(channelShift) || 0) % 18) + 18) % 18;
    const group = Math.floor(shift / 3);
    const maps = new Array(channelCount);
    for (let c = 0; c < channelCount; c++) {
      const idx = ((c + shift) % 3) + group * 3;
      maps[c] = this._channelMaps[idx] || [0, 0, 0];
    }
    return {
      shift,
      group,
      maps,
      bg: this._channelBg[group] || [0, 0, 0],
    };
  }

  _channelLegendName(channelCount, channelShift = 0) {
    const { group, shift } = this._resolveChannelPalette(
      channelCount,
      channelShift,
    );
    const items = [];
    for (let c = 0; c < channelCount; c++) {
      const idx = ((c + shift) % 3) + group * 3;
      const ch = this._channelLegendChars[idx] || "-";
      items.push(`${c}:${ch}`);
    }
    return items.join(", ");
  }

  _resolveKernelTintChannel(params, channelCount) {
    const safeChannelCount = Math.max(1, Math.floor(Number(channelCount) || 1));
    if (safeChannelCount <= 1) return 0;

    const kernels = Array.isArray(params?.kernelParams)
      ? params.kernelParams
      : [];
    const selectedKernel = Math.max(
      0,
      Math.min(
        kernels.length - 1,
        Math.floor(Number(params?.selectedKernel) || 0),
      ),
    );
    const kernel = kernels[selectedKernel];

    if (kernel && Array.isArray(kernel.c) && kernel.c.length > 1) {
      const target = Math.floor(Number(kernel.c[1]) || 0);
      return Math.max(0, Math.min(safeChannelCount - 1, target));
    }

    const selectedChannel = Math.floor(Number(params?.selectedChannel) || 0);
    return Math.max(0, Math.min(safeChannelCount - 1, selectedChannel));
  }

  _interpLinear(src, outLen) {
    const n =
      Array.isArray(src) || src instanceof Float32Array ? src.length : 0;
    if (n <= 0 || outLen <= 0) return new Float32Array(outLen);
    if (n === 1) {
      const out = new Float32Array(outLen);
      out.fill(src[0]);
      return out;
    }
    const out = new Float32Array(outLen);
    const scale = (n - 1) / Math.max(1, outLen - 1);
    for (let i = 0; i < outLen; i++) {
      const p = i * scale;
      const i0 = Math.floor(p);
      const i1 = Math.min(n - 1, i0 + 1);
      const t = p - i0;
      out[i] = src[i0] * (1 - t) + src[i1] * t;
    }
    return out;
  }

  _buildPolarModeBuffer(size, polarMode, statistics, params = {}) {
    if (!statistics) return null;
    const sizer = size >> 1;
    const ssq = size * size;
    if (!this._polarBuffer || this._polarBuffer.length !== ssq) {
      this._polarBuffer = new Float32Array(ssq);
    }

    if (polarMode === 2) {
      const polarArray = statistics.polarArray;
      if (!polarArray || polarArray.length < sizer * size) return null;

      const out = this._polarBuffer;
      out.fill(0);
      const totalPolarRows = 2 * sizer - 1;
      const copyLen = Math.min(polarArray.length, totalPolarRows * size);
      out.set(polarArray.subarray(0, copyLen), 0);
      if (totalPolarRows < size && totalPolarRows > 0) {
        const lastSrc = (totalPolarRows - 1) * size;
        const lastDst = totalPolarRows * size;
        for (let x = 0; x < size; x++) {
          out[lastDst + x] = out[lastSrc + x];
        }
      }

      const polarTH = statistics.polarTH;
      if (polarTH && polarTH.length >= size) {
        const maxTH = this._safeArrayMax(polarTH, 1);
        for (let x = 0; x < size; x++) {
          const v = polarTH[x] / maxTH;
          out[x] = v;
          out[size + x] = v;
        }

        const k = Number(statistics.symmSides) || 0;
        if (k > 0) {
          const p = Math.ceil(size / k);
          const interp = this._interpLinear(polarTH, p * k);
          const maxI = this._safeArrayMax(interp, 1);
          for (let i = 0; i < k; i++) {
            const y = 3 + i;
            if (y >= sizer) break;
            const row = y * size;
            for (let x = 0; x < p; x++) {
              out[row + x] = interp[i * p + x] / maxI;
            }
          }
        }
      }

      const mode = Number(params.autoRotateMode) || 0;
      let angleShift = 0;
      if (mode === 1) {
        angleShift = -(Number(statistics.angle) || 0) / (2 * Math.PI) - 0.25;
      } else if (mode === 2) {
        angleShift = (Number(statistics.symmAngle) || 0) / (2 * Math.PI);
      }
      if (Math.abs(angleShift) > 1e-9) {
        const frac = ((-angleShift % 1) + 1) % 1;
        const shiftX = Math.floor(frac * size);
        return this._rollViewData(out, size, shiftX, 0);
      }
      return out;
    }

    if (polarMode === 3) {
      const seriesTH = statistics.seriesTH;
      const seriesR = statistics.seriesR;
      if (!Array.isArray(seriesTH) || !Array.isArray(seriesR)) return null;

      const out = this._polarBuffer;
      out.fill(0);

      const xLen = Math.min(seriesTH.length, Math.max(0, sizer));
      if (xLen > 0) {
        let xMax = 0;
        for (let i = seriesTH.length - xLen; i < seriesTH.length; i++) {
          xMax = Math.max(xMax, this._safeArrayMax(seriesTH[i], 0));
        }
        xMax = Math.max(1e-12, xMax);
        const mid = size >> 1;
        for (let i = 0; i < xLen; i++) {
          const src = seriesTH[seriesTH.length - xLen + i];
          const y = mid + (xLen - 1 - i);
          if (!src || y < 0 || y >= size) continue;
          const row = y * size;
          for (let x = 0; x < size && x < src.length; x++) {
            out[row + x] = src[x] / xMax;
          }
        }
      }

      const yLen = Math.min(seriesR.length, size);
      if (yLen > 0) {
        let yMax = 0;
        for (let i = seriesR.length - yLen; i < seriesR.length; i++) {
          yMax = Math.max(yMax, this._safeArrayMax(seriesR[i], 0));
        }
        yMax = Math.max(1e-12, yMax);
        const start = seriesR.length - yLen;
        for (let r = 0; r < sizer; r++) {
          const row = r * size;
          for (let c = 0; c < yLen; c++) {
            const vec = seriesR[start + c];
            const v = vec && r < vec.length ? vec[r] : 0;
            out[row + c] = v / yMax;
          }
        }
      }

      return out;
    }

    if (polarMode === 4) {
      const polarDensity = statistics.polarDensity;
      if (!polarDensity || polarDensity.length < sizer * sizer) return null;
      const rotateWSum = statistics.rotateWSum;
      const densitySum = statistics.densitySum;

      const halfLen = size * sizer;
      if (!this._polarHalfBuffer || this._polarHalfBuffer.length !== halfLen) {
        this._polarHalfBuffer = new Float32Array(halfLen);
      }
      const half = this._polarHalfBuffer;
      half.fill(0);
      const maxDensity = this._safeArrayMax(polarDensity, 1);
      for (let i = 0; i < sizer * sizer; i++) {
        half[i] = polarDensity[i] / maxDensity;
      }

      const maxRotate = this._safeArrayMax(rotateWSum, 1);
      for (let i = 0; i < sizer * sizer; i++) {
        const v = rotateWSum && i < rotateWSum.length ? rotateWSum[i] : 0;
        half[sizer * sizer + i] = v / maxRotate;
      }

      if (densitySum && densitySum.length > 0) {
        const maxSum = this._safeArrayMax(densitySum, 1);
        for (let x = 0; x < sizer && x < densitySum.length; x++) {
          const v = densitySum[x] / maxSum;
          half[x] = v;
          half[sizer + x] = v;
        }
      }

      const out = this._polarBuffer;
      out.fill(0);
      for (let y = 0; y < size; y++) {
        const srcRow = y * sizer;
        const dstRow = y * size;
        for (let x = 0; x < sizer; x++) {
          const v = half[srcRow + x];
          const dx = x * 2;
          out[dstRow + dx] = v;
          if (dx + 1 < size) out[dstRow + dx + 1] = v;
        }
      }
      return out;
    }

    return null;
  }

  _getViewSpec(board, automaton, rawMode, params) {
    const mode = rawMode;
    const size = board?.size || this.size;
    const isSoftClip = !!params?.softClip;
    const isAritaMode = !!params?.aritaMode;
    const selectedChannel = Math.max(
      0,
      Math.floor(Number(params?.selectedChannel) || 0),
    );

    if (mode === "world" || mode === "world_channels") {
      const channelCount = this._getChannelCountFromData(board.world, size);
      if (channelCount > 1) {
        return {
          mode: "world",
          label: "World (Channels)",
          data: board.world,
          srcSize: size,
          vmin: 0,
          vmax: 1,
          channelComposite: true,
          channelCount,
        };
      }

      const data = this._channelSliceView(board.world, size, selectedChannel);
      let vmin = 0;
      if (isSoftClip && data) {
        const range = this._computeDataRange(data);
        if (range.min < 0) vmin = range.min;
      }
      return {
        mode: "world",
        label: "World",
        data,
        srcSize: size,
        vmin,
        vmax: 1,
      };
    }

    if (mode === "potential") {
      const channelCount = this._getChannelCountFromData(board.potential, size);
      if (channelCount > 1) {
        return {
          mode,
          label: "Potential (Channels)",
          data: board.potential,
          srcSize: size,
          vmin: 0,
          vmax: 2 * (automaton?.m || 0.15),
          channelComposite: true,
          channelCount,
        };
      }

      const data = this._channelSliceView(
        board.potential,
        size,
        selectedChannel,
      );
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
      const channelCount = this._getChannelCountFromData(board.growth, size);
      if (channelCount > 1) {
        return {
          mode: "growth",
          label: "Growth (Channels)",
          data: board.growth,
          srcSize: size,
          vmin: isAritaMode ? 0 : -1,
          vmax: 1,
          channelComposite: true,
          channelCount,
        };
      }

      const data = this._channelSliceView(board.growth, size, selectedChannel);
      return {
        mode: "growth",
        label: "Growth",
        data,
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

      const channelCount = this._getChannelCountFromData(board.world, size);
      const tintChannel = this._resolveKernelTintChannel(params, channelCount);
      return {
        mode,
        label: channelCount > 1 ? `Kernel (C${tintChannel})` : "Kernel",
        data: this._kernelDisplayCache,
        srcSize: size,
        vmin: 0,
        vmax: 1,
        channelTint: channelCount > 1,
        channelCount,
        tintChannel,
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

  render(
    board,
    automaton,
    renderMode,
    colourMapName,
    params = null,
    statistics = null,
  ) {
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

    if (view.channelComposite && Number(view.channelCount) > 1) {
      if (this.img.width !== currentSize || this.img.height !== currentSize) {
        this._releaseBuffer(this.img);
        this.img = this._createReadbackBuffer(currentSize, currentSize);
      }

      this.img.loadPixels();
      const pixels = this.img.pixels;
      const cellCount = currentSize * currentSize;
      const channelCount = Math.max(
        2,
        Math.floor(
          Number(view.channelCount) ||
            this._getChannelCountFromData(data, currentSize),
        ),
      );
      const { maps, bg } = this._resolveChannelPalette(
        channelCount,
        params?.channelShift || 0,
      );
      const dimNorm = Math.max(1, channelCount);
      const invRange = 1 / Math.max(vmax - vmin, 1e-9);
      const shiftX =
        this._viewOffsetActive && renderMode !== "kernel"
          ? Math.round(this._viewShiftX)
          : 0;
      const shiftY =
        this._viewOffsetActive && renderMode !== "kernel"
          ? Math.round(this._viewShiftY)
          : 0;

      liveMin = Number.POSITIVE_INFINITY;
      liveMax = Number.NEGATIVE_INFINITY;

      for (let py = 0; py < currentSize; py++) {
        const srcY =
          (((py - shiftY) % currentSize) + currentSize) % currentSize;
        const row = py * currentSize;
        for (let px = 0; px < currentSize; px++) {
          const srcX =
            (((px - shiftX) % currentSize) + currentSize) % currentSize;
          const srcIdx = srcY * currentSize + srcX;

          let intensity = 0;
          let r = bg[0] / dimNorm;
          let g = bg[1] / dimNorm;
          let b = bg[2] / dimNorm;

          for (let c = 0; c < channelCount; c++) {
            const raw = Number(data[c * cellCount + srcIdx]) || 0;
            let v = (raw - vmin) * invRange;
            if (v < 0) v = 0;
            else if (v > 1) v = 1;
            intensity += v;
            const m = maps[c] || [0, 0, 0];
            r += v * m[0];
            g += v * m[1];
            b += v * m[2];
          }

          if (intensity < liveMin) liveMin = intensity;
          if (intensity > liveMax) liveMax = intensity;

          const di = (row + px) * 4;
          pixels[di] = Math.max(0, Math.min(255, Math.round(r * 255)));
          pixels[di + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
          pixels[di + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
          pixels[di + 3] = 255;
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
        channelCount,
        channelShift: params?.channelShift || 0,
        channelComposite: true,
        channelTint: false,
      };

      this.img.updatePixels();
      image(this.img, 0, 0, width, height);
      return;
    }

    if (view.channelTint && Number(view.channelCount) > 1) {
      if (this.img.width !== currentSize || this.img.height !== currentSize) {
        this._releaseBuffer(this.img);
        this.img = this._createReadbackBuffer(currentSize, currentSize);
      }

      const palette = this._resolveChannelPalette(
        Math.max(2, Math.floor(Number(view.channelCount) || 2)),
        params?.channelShift || 0,
      );
      const tintChannel = Math.max(
        0,
        Math.min(
          Math.max(1, Math.floor(Number(view.channelCount) || 1)) - 1,
          Math.floor(Number(view.tintChannel) || 0),
        ),
      );
      const tint = palette.maps[tintChannel] || [1, 1, 1];
      const invRange = 1 / Math.max(vmax - vmin, 1e-9);

      this.img.loadPixels();
      const pixels = this.img.pixels;
      const total = currentSize * currentSize;

      for (let i = 0; i < total; i++) {
        const raw = Number(data[i]) || 0;
        if (raw < liveMin) liveMin = raw;
        if (raw > liveMax) liveMax = raw;

        let unit = (raw - vmin) * invRange;
        if (unit < 0) unit = 0;
        else if (unit > 1) unit = 1;

        const di = i * 4;
        pixels[di] = Math.max(
          0,
          Math.min(255, Math.round(tint[0] * unit * 255)),
        );
        pixels[di + 1] = Math.max(
          0,
          Math.min(255, Math.round(tint[1] * unit * 255)),
        );
        pixels[di + 2] = Math.max(
          0,
          Math.min(255, Math.round(tint[2] * unit * 255)),
        );
        pixels[di + 3] = 255;
      }

      if (!Number.isFinite(liveMin) || !Number.isFinite(liveMax)) {
        liveMin = 0;
        liveMax = 1;
      }

      this.lastLegendRange = {
        mode: view.mode,
        min: liveMin,
        max: liveMax,
        channelCount: view.channelCount,
        channelShift: params?.channelShift || 0,
        channelComposite: false,
        channelTint: true,
        tintChannel,
      };

      this.img.updatePixels();
      image(this.img, 0, 0, width, height);
      return;
    }

    const polarMode = Math.max(
      0,
      Math.min(4, Math.floor(Number(params?.polarMode) || 0)),
    );
    if (polarMode >= 2) {
      const polarData = this._buildPolarModeBuffer(
        currentSize,
        polarMode,
        statistics,
        params,
      );
      if (polarData && polarData.length === currentSize * currentSize) {
        data = polarData;
        if (polarMode >= 3) {
          vmin = 0;
          vmax = 1;
        }
      }
    }

    if (this.img.width !== currentSize || this.img.height !== currentSize) {
      this._releaseBuffer(this.img);
      this.img = this._createReadbackBuffer(currentSize, currentSize);
    }

    if (
      this._viewOffsetActive &&
      renderMode !== "kernel" &&
      polarMode < 2 &&
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
      channelComposite: false,
      channelTint: false,
    };

    this.img.updatePixels();
    image(this.img, 0, 0, width, height);
  }

  renderCachedFrame() {
    if (this.img && this.img.width > 0 && this.img.height > 0) {
      image(this.img, 0, 0, width, height);
      return true;
    }

    const bg = this.getColourMapLowColour();
    background(bg.r, bg.g, bg.b);
    return false;
  }

  getColourMapLowColour(name = null) {
    if (name !== null && typeof name !== "undefined") {
      this.setColourMap(name);
    }
    return {
      r: Number(this.lut[0]) || 0,
      g: Number(this.lut[1]) || 0,
      b: Number(this.lut[2]) || 0,
    };
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
    ColourMapLUT.buildLUT(
      colourMapData,
      this.lut,
      this.lutPacked,
      this._isLittleEndian,
    );
  }

  _valueToColour(val) {
    return ColourMapLUT.valueToColour(this.lut, val);
  }

  renderGrid(R, params = null) {
    const n = Math.max(0, Math.floor(R / 40));

    const cellPx = width / this.size;
    const mid = Math.floor(this.size / 2);
    const dotSize = Math.max(1, Math.round(cellPx * 0.4));

    const sx = this._viewOffsetActive ? this._viewShiftX : 0;
    const sy = this._viewOffsetActive ? this._viewShiftY : 0;
    const adjMidX = (((mid + sx) % this.size) + this.size) % this.size;
    const adjMidY = (((mid + sy) % this.size) + this.size) % this.size;

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

    this._scaleCacheKey = cacheKey;
    image(pg, 0, 0);
  }

  renderLegend(vmin, vmax) {
    const mode = this.lastLegendRange?.mode || "world";
    const channelComposite = Boolean(this.lastLegendRange?.channelComposite);
    const channelTint = Boolean(this.lastLegendRange?.channelTint);
    const channelCount = Math.max(
      1,
      Math.floor(Number(this.lastLegendRange?.channelCount) || 1),
    );
    const channelShift = Math.floor(
      Number(this.lastLegendRange?.channelShift) || 0,
    );
    const tintChannel = Math.max(
      0,
      Math.min(
        channelCount - 1,
        Math.floor(Number(this.lastLegendRange?.tintChannel) || 0),
      ),
    );
    const legendMetaByMode = {
      world: {
        title: "Aᵗ (state field)",
      },
      potential: {
        title: "K ∗ Aᵗ (weighted sum)",
      },
      growth: {
        title: "G(K ∗ Aᵗ) (growth mapping)",
      },
      kernel: {
        title: "K (kernel)",
      },
    };
    const legendMeta = legendMetaByMode[mode] || legendMetaByMode.world;

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

    const cacheKey = `${mode}|${this.currentColourMap}|${effectiveVmin.toFixed(1)}|${effectiveVmax.toFixed(1)}|${channelCount}|${channelShift}|${channelComposite ? 1 : 0}|${channelTint ? 1 : 0}|${tintChannel}|${width}|${height}`;
    if (this._legendGfx && this._legendCacheKey === cacheKey) {
      image(this._legendGfx, 0, 0);
      return;
    }

    if (channelComposite) {
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

      const barStripW = 3;
      const barW = Math.max(5, channelCount * barStripW);
      const x1 = width - 20 + barW;
      const x0 = x1 - barW;
      const y0 = height - 70;
      const y1 = 20;
      const dy = (y1 - y0) / 256;

      const palette = this._resolveChannelPalette(channelCount, channelShift);
      for (let c = 0; c < channelCount; c++) {
        const m = palette.maps[c] || [0, 0, 0];
        for (let val = 0; val < 256; val++) {
          const r = Math.max(0, Math.min(255, Math.round(m[0] * val)));
          const g = Math.max(0, Math.min(255, Math.round(m[1] * val)));
          const b = Math.max(0, Math.min(255, Math.round(m[2] * val)));
          pg.noStroke();
          pg.fill(r, g, b, 255);
          pg.rect(
            x0 + c * barStripW,
            y0 + dy * val,
            barStripW,
            Math.max(1, Math.abs(dy) + 0.5),
          );
        }
      }

      pg.noFill();
      pg.stroke(200);
      pg.strokeWeight(1);
      pg.rect(x0 - 1, y1 - 1, barW + 2, y0 - y1 + 2);

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

      pg.push();
      pg.translate(x0 + barW * 0.5 + 10, y1 + (y0 - y1) * 0.5);
      pg.rotate(-HALF_PI);
      pg.textAlign(CENTER, CENTER);
      pg.textSize(11);
      pg.text(legendMeta.title, 0, 0);
      pg.pop();

      pg.textAlign(RIGHT, TOP);
      pg.textSize(10);
      pg.text(
        this._channelLegendName(channelCount, channelShift),
        x0 - 5,
        y0 + 8,
      );

      this._legendCacheKey = cacheKey;
      image(pg, 0, 0);
      return;
    }

    if (channelTint && channelCount > 1) {
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

      const palette = this._resolveChannelPalette(channelCount, channelShift);
      const tint = palette.maps[tintChannel] || [1, 1, 1];
      for (let val = 0; val < 256; val++) {
        const y = y0 + ((y1 - y0) * val) / 255;
        const rr = Math.max(0, Math.min(255, Math.round(tint[0] * val)));
        const gg = Math.max(0, Math.min(255, Math.round(tint[1] * val)));
        const bb = Math.max(0, Math.min(255, Math.round(tint[2] * val)));
        pg.noStroke();
        pg.fill(rr, gg, bb, 255);
        pg.rect(x0, y, barW, Math.max(1, Math.abs((y1 - y0) / 255) + 0.5));
      }

      pg.noFill();
      pg.stroke(200);
      pg.strokeWeight(1);
      pg.rect(x0 - 1, y1 - 1, barW + 2, barH + 2);

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

      pg.push();
      pg.translate(x0 + barW * 0.5 + 10, y1 + barH * 0.5);
      pg.rotate(-HALF_PI);
      pg.textAlign(CENTER, CENTER);
      pg.textSize(11);
      pg.text(`${legendMeta.title} C${tintChannel}`, 0, 0);
      pg.pop();

      this._legendCacheKey = cacheKey;
      image(pg, 0, 0);
      return;
    }

    if (
      this.currentColourMap !== this._legendBarCachedMap ||
      !this._legendBarImg
    ) {
      this._releaseBuffer(this._legendBarImg);
      this._legendBarImg = this._createReadbackBuffer(1, 253);
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

    pg.noSmooth();
    pg.image(this._legendBarImg, x0, y1, barW, barH);

    pg.noFill();
    pg.stroke(200);
    pg.strokeWeight(1);
    pg.rect(x0 - 1, y1 - 1, barW + 2, barH + 2);

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

    pg.push();
    pg.translate(x0 + barW * 0.5 + 10, y1 + barH * 0.5);
    pg.rotate(-HALF_PI);
    pg.textAlign(CENTER, CENTER);
    pg.textSize(11);
    pg.text(legendMeta.title, 0, 0);
    pg.pop();

    this._legendCacheKey = cacheKey;
    image(pg, 0, 0);
  }

  renderKeymapRef(metadata) {
    const { name, version } = metadata;
    const sections = KeybindCatalogue.getSections("lenia");

    KeymapRenderer.render(name, version, sections);
  }
}
