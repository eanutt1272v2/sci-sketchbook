class RendererOverlayPanelMethods {
  renderMotionOverlay(statistics, params = {}) {
    const { mass, centreX, centreY, speed, angle } = statistics;

    const hasValidCentre = Number.isFinite(centreX) && Number.isFinite(centreY);
    const hasVisibleMass = Number.isFinite(mass) && mass > 1e-10;

    if (!hasValidCentre || !hasVisibleMass) {
      this._lastCentreX = undefined;
      this._lastCentreY = undefined;
      return;
    }

    const T = Number(params.T) || 10;
    const cellPx = width / this.size;
    const m1x = centreX;
    const m1y = centreY;

    let dx = 0;
    let dy = 0;

    if (Number.isFinite(speed) && Number.isFinite(angle)) {
      dx = Math.cos(angle) * speed;
      dy = Math.sin(angle) * speed;
    } else if (
      Number.isFinite(this._lastCentreX) &&
      Number.isFinite(this._lastCentreY)
    ) {
      dx = this._torusDelta(m1x, this._lastCentreX, this.size);
      dy = this._torusDelta(m1y, this._lastCentreY, this.size);
    }

    const m0x = m1x - dx;
    const m0y = m1y - dy;

    this._lastCentreX = m1x;
    this._lastCentreY = m1y;

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
    pop();
  }

  renderSymmetryOverlay(statistics, params = {}) {
    const { mass, centreX, centreY, symmSides, symmAngle } = statistics;
    const sidesVec = statistics.sidesVec;
    const angleVec = statistics.angleVec;
    const rotateVec = statistics.rotateVec;
    const symmMaxRadius = statistics.symmMaxRadius || 0;
    const polarMode = Math.max(
      0,
      Math.min(4, Math.floor(Number(params.polarMode) || 0)),
    );

    const hasValidCentre = Number.isFinite(centreX) && Number.isFinite(centreY);
    const hasVisibleMass = Number.isFinite(mass) && mass > 1e-10;
    const k = symmSides || 0;

    if (polarMode === 0) return;
    if (!hasValidCentre || !hasVisibleMass) return;

    const T = Number(params.T) || 10;
    const cellPx = width / this.size;
    const a = symmAngle || 0;

    const vsx = this._viewOffsetActive ? this._viewShiftX : 0;
    const vsy = this._viewOffsetActive ? this._viewShiftY : 0;
    const m1x = (((centreX + vsx) % this.size) + this.size) % this.size;
    const m1y = (((centreY + vsy) % this.size) + this.size) % this.size;
    const m1px = m1x * cellPx;
    const m1py = m1y * cellPx;

    const c254 = [127, 127, 127];
    const c255 = [255, 255, 255];
    const dotR = 2;
    const splitY = (this.size / 2) * cellPx;

    push();

    const maxDist = Math.max(this.size, this.size);

    if (polarMode === 1 && k >= 2) {
      stroke(c254[0], c254[1], c254[2]);
      strokeWeight(1);
      for (let i = 0; i < k; i++) {
        const angle = (2 * Math.PI * i) / k + a;
        const dx = Math.sin(angle) * maxDist;
        const dy = Math.cos(angle) * maxDist;
        line(m1px, m1py, (m1x - dx) * cellPx, (m1y - dy) * cellPx);
      }
    }

    const renderPolarMode2Lines = polarMode === 2;
    if (renderPolarMode2Lines || polarMode === 3 || polarMode === 4) {
      stroke(c254[0], c254[1], c254[2]);
      strokeWeight(1);
      line(0, splitY, width, splitY);
    }

    if (renderPolarMode2Lines && k > 1) {
      stroke(c254[0], c254[1], c254[2]);
      strokeWeight(1);
      for (let i = 0; i < k; i++) {
        const xNorm = (((i / k - a / (2 * Math.PI) + 0.5) % 1) + 1) % 1;
        const x = xNorm * this.size * cellPx;
        line(x, 0, x, height);
      }
    }

    if (polarMode === 4) {
      const sizeF = Math.max(1, Math.floor(this.size / 2));
      for (let kk = 1; kk < sizeF; kk += 5) {
        const x = kk * 2 * cellPx;
        stroke(c254[0], c254[1], c254[2]);
        strokeWeight(1);
        line(x, 0, x, height);
        noStroke();
        fill(c255[0], c255[1], c255[2]);
        textSize(10);
        textAlign(LEFT, CENTER);
        text(String(kk), x + 2, splitY);
      }
    }

    if (sidesVec && angleVec) {
      const numRadii = Math.min(symmMaxRadius, sidesVec.length);
      for (let rIdx = 0; rIdx < numRadii; rIdx++) {
        const kk = sidesVec[rIdx];
        if (kk < 2) continue;
        const aa = angleVec[rIdx];
        const ww = rotateVec ? rotateVec[rIdx] * T : 0;
        const dist = symmMaxRadius - rIdx;
        const col = kk === k ? c255 : c254;

        if (polarMode === 4) {
          const x = Math.floor(((kk + 1) * cellPx) / 2);
          const y = Math.max(0, Math.min(height, rIdx * cellPx));
          stroke(c255[0], c255[1], c255[2]);
          strokeWeight(1);
          line(x, y, x - (ww / (2 * Math.PI)) * this.size * cellPx, y);
          noStroke();
          fill(c255[0], c255[1], c255[2]);
          ellipse(x, y, dotR * 2, dotR * 2);
          continue;
        }

        if (renderPolarMode2Lines) {
          for (let i = 0; i < kk; i++) {
            const xNorm = (((i / kk - aa / (2 * Math.PI) + 0.5) % 1) + 1) % 1;
            const x = xNorm * this.size * cellPx;
            const y = Math.max(0, Math.min(height, rIdx * cellPx));
            stroke(col[0], col[1], col[2]);
            strokeWeight(1);
            line(x, y, x - (ww / (2 * Math.PI)) * this.size * cellPx, y);
            noStroke();
            fill(col[0], col[1], col[2]);
            ellipse(x, y, dotR * 2, dotR * 2);
          }
          continue;
        }

        if (polarMode !== 1) continue;

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
    pop();
  }

  renderSymmetryTitle(statistics, params = {}) {
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
    const polarMode = Math.max(
      0,
      Math.min(4, Math.floor(Number(params.polarMode) || 0)),
    );
    if (polarMode === 0) return;
    if (k < 2) return;

    push();
    if (this.uiFont) textFont(this.uiFont);
    noStroke();
    fill(255);
    textSize(15);
    textAlign(CENTER, TOP);
    const name = POLYGON_NAME[k <= 10 ? k : 0];
    text(`symmetry: ${k} (${name})`, width / 2, 20);
    pop();
  }

  renderSolitonName(soliton) {
    if (!soliton) return;
    const latinParts = [soliton.code || "", soliton.name || ""].filter(Boolean);
    const latinLabel = latinParts.join(" ");
    const cname = soliton.cname || "";
    if (!latinLabel && !cname) return;

    const y = height - 20;
    push();
    noStroke();
    fill(255);
    textSize(15);
    textStyle(ITALIC);
    textAlign(CENTER, BOTTOM);

    if (cname && latinLabel) {
      if (this.uiFont) textFont(this.uiFont);
      const latinW = textWidth(latinLabel);
      textFont(
        "'Noto Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
      );
      const cnameW = textWidth(cname);
      const labelGap = 6;
      const startX = (width - latinW - labelGap - cnameW) / 2;
      if (this.uiFont) textFont(this.uiFont);
      textAlign(LEFT, BOTTOM);
      text(latinLabel, startX, y);
      textFont(
        "'Noto Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
      );
      text(cname, startX + latinW + labelGap, y);
    } else if (latinLabel) {
      if (this.uiFont) textFont(this.uiFont);
      text(latinLabel, width / 2, y);
    } else {
      textFont(
        "'Noto Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
      );
      text(cname, width / 2, y);
    }
    pop();
  }

  renderStatistics(statistics, params) {
    this._statisticsFrameCount += 1;
    if (this._statisticsGfx && this._statisticsFrameCount % 6 !== 0) {
      image(this._statisticsGfx, 0, 0);
      return;
    }

    if (
      !this._statisticsGfx ||
      this._statisticsGfx.width !== width ||
      this._statisticsGfx.height !== height
    ) {
      if (this._statisticsGfx) this._statisticsGfx.remove();
      this._statisticsGfx = createGraphics(width, height);
    }

    const pg = this._statisticsGfx;
    pg.clear();

    const dt = 1 / params.T;
    const dim = Math.max(2, Math.floor(Number(params.dimension) || 2));
    const RN = Math.pow(params.R, dim);
    const superscriptDigits = {
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
    const dimPower = String(dim)
      .split("")
      .map((char) => superscriptDigits[char] || char)
      .join("");
    const microMeterPower = `μm${dimPower}`;
    const cellPower = `cell${dimPower}`;
    const radiusPower = `R${dimPower}`;
    const worldSize = this.size;
    const worldShape = `${worldSize}${dimPower}`;
    const fmt = FormatUtils.formatFixed;

    const statisticsLines = [
      `FPS=${(Number(statistics.fps) || 0).toFixed(1)} [Hz]`,
      `Generation=${String(statistics.gen)} [gen]`,
      `Time=${fmt(statistics.time, 3)} [μs]`,
      `Time Step: dt=1/T=${fmt(dt, 3)} [μs/gen]`,
      `Running=${params.running ? "true" : "false"} (bool)`,
      `Dimension: D=${dim} (2D/3D/4D)`,
      `Lattice Size=${worldShape} [cells]`,
      `Render Mode=${params.renderMode} (mode id)`,
      `Colour Map=${this.currentColourMap || params.colourMap} (palette id)`,
      `Kernel Radius: R=${fmt(params.R, 2)} [cells]`,
      `Time Scale: T=${fmt(params.T, 2)} [gen/μs]`,
      `Growth Mean: m=${fmt(params.m, 3)} [cell-state]`,
      `Growth Std Dev: s=${fmt(params.s, 3)} [cell-state]`,
      `Centre μ=${fmt(params.m, 3)} | Width σ=${fmt(params.s, 3)} (growth func)`,
      `Functions: kn=${params.kn} | gn=${params.gn} (family ids)`,
      `Mass/${radiusPower}=${fmt(statistics.mass / RN, 3)} [μg/${cellPower}]`,
      `Growth/${radiusPower}=${fmt(statistics.growth / RN, 4)} [μg/(μs·${cellPower})]`,
      `Mass (log scale)=${fmt(statistics.massLog || 0, 4)} [μg]`,
      `Growth (log scale)=${fmt(statistics.growthLog || 0, 4)} [μg/μs]`,
      `Mass volume (log scale)=${fmt(statistics.massVolumeLog || 0, 4)} [${microMeterPower}]`,
      `Growth volume (log scale)=${fmt(statistics.growthVolumeLog || 0, 4)} [${microMeterPower}]`,
      `Mass density=${fmt(statistics.massDensity || 0, 6)} [μg/${microMeterPower}]`,
      `Growth density=${fmt(statistics.growthDensity || 0, 6)} [μg/(${microMeterPower}·μs)]`,
      `Peak value=${fmt(statistics.maxValue, 3)} [cell-state]`,
      `Gyradius=${fmt(statistics.gyradius, 2)} [μm]`,
      `Centroid X=${fmt(statistics.centreX, 1)} [μm]`,
      `Centroid Y=${fmt(statistics.centreY, 1)} [μm]`,
      `Growth centroid X=${fmt(statistics.growthCentreX, 1)} [μm]`,
      `Growth centroid Y=${fmt(statistics.growthCentreY, 1)} [μm]`,
      `Mass-growth distance=${fmt(statistics.massGrowthDist || 0, 3)} [μm]`,
      `Speed=${fmt(statistics.speed || 0, 3)} [μm/μs]`,
      `Centroid speed=${fmt(statistics.centroidSpeed || 0, 4)} [μm/μs]`,
      `Direction angle=${fmt(statistics.angle || 0, 3)} [rad]`,
      `Centroid rotate speed=${fmt(statistics.centroidRotateSpeed || 0, 5)} [rad/μs]`,
      `Growth-centroid rotate speed=${fmt(statistics.growthRotateSpeed || 0, 5)} [rad/μs]`,
      `Major axis rotate speed=${fmt(statistics.majorAxisRotateSpeed || 0, 5)} [rad/μs]`,
      `Mass asymmetry=${fmt(statistics.massAsym || 0, 3)} [μg]`,
      `Symmetry order=${statistics.symmSides || "?"}`,
      `Symmetry strength=${fmt((statistics.symmStrength || 0) * 100, 1)} [%]`,
      `Rotation speed=${fmt(statistics.rotationSpeed || 0, 3)} [rad/μs]`,
      `Lyapunov exponent=${fmt(statistics.lyapunov || 0, 6)} [gen⁻¹]`,
      `Moment of inertia - Hu's moment invariant 1 (log scale)=${fmt(statistics.hu1Log || 0, 6)}`,
      `Skewness - Hu's moment invariant 4 (log scale)=${fmt(statistics.hu4Log || 0, 6)}`,
      `Hu's 5 (log scale)=${fmt(statistics.hu5Log || 0, 6)}`,
      `Hu's 6 (log scale)=${fmt(statistics.hu6Log || 0, 6)}`,
      `Hu's 7 (log scale)=${fmt(statistics.hu7Log || 0, 6)}`,
      `Kurtosis - Flusser's moment invariant 7=${fmt(statistics.flusser7 || 0, 6)}`,
      `Flusser's 8 (log scale)=${fmt(statistics.flusser8Log || 0, 6)}`,
      `Flusser's 9 (log scale)=${fmt(statistics.flusser9Log || 0, 6)}`,
      `Flusser's 10 (log scale)=${fmt(statistics.flusser10Log || 0, 6)}`,
      `Period=${fmt(statistics.period || 0, 3)} [μs]`,
      `Period confidence=${fmt((statistics.periodConfidence || 0) * 100, 2)} [%]`,
    ];

    this._applyTextFont(pg);
    pg.textAlign(LEFT, TOP);
    pg.textSize(12.5);
    pg.noStroke();
    pg.fill(255);
    pg.text(statisticsLines.join("\n"), 20, 20);

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

    this.lastCalcPanelsFrame = panelCanvas;

    const renderX = Math.round(baseX);
    const renderY = Math.round(baseY);
    const prevSmooth = drawingContext?.imageSmoothingEnabled;
    if (typeof noSmooth === "function") noSmooth();
    if (drawingContext) drawingContext.imageSmoothingEnabled = false;
    image(panelCanvas, renderX, renderY);
    if (drawingContext && typeof prevSmooth === "boolean") {
      drawingContext.imageSmoothingEnabled = prevSmooth;
    }

    this._renderCalcPanelBorders(
      renderX,
      renderY,
      panelSize,
      gap,
      cols,
      rows,
      null,
    );
  }

  renderCachedCalcPanels() {
    if (!this.lastCalcPanelsFrame) {
      return false;
    }

    const layout = this._getCalcPanelLayout();
    const b = {
      x: Math.round(layout.baseX),
      y: Math.round(layout.baseY),
      w: layout.totalW,
      h: layout.totalH,
    };
    const prevSmooth = drawingContext?.imageSmoothingEnabled;
    if (typeof noSmooth === "function") noSmooth();
    if (drawingContext) drawingContext.imageSmoothingEnabled = false;
    image(this.lastCalcPanelsFrame, b.x, b.y);
    if (drawingContext && typeof prevSmooth === "boolean") {
      drawingContext.imageSmoothingEnabled = prevSmooth;
    }

    this._renderCalcPanelBorders(
      b.x,
      b.y,
      layout.panelSize,
      layout.gap,
      layout.cols,
      layout.rows,
      null,
    );

    return true;
  }

  _ensureCalcPanelsCanvas(layout) {
    const { totalW, totalH } = layout;
    if (
      !this.calcPanelsCanvas ||
      this.calcPanelsCanvas.width !== totalW ||
      this.calcPanelsCanvas.height !== totalH
    ) {
      this._releaseBuffer(this.calcPanelsCanvas);
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
    const hasTarget = target && typeof target.push === "function";
    const render = hasTarget ? target : null;

    if (render) render.push();
    else push();

    if (render) {
      render.noStroke();
      render.fill(210, 145);
    } else {
      noStroke();
      fill(210, 145);
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = Math.round(baseX + col * (panelSize + gap));
        const y = Math.round(baseY + row * (panelSize + gap));

        if (render) {
          render.rect(x, y, panelSize, 1);
          render.rect(x, y + panelSize - 1, panelSize, 1);
          if (panelSize > 2) {
            render.rect(x, y + 1, 1, panelSize - 2);
            renderer.rect(x + panelSize - 1, y + 1, 1, panelSize - 2);
          }
        } else {
          rect(x, y, panelSize, 1);
          rect(x, y + panelSize - 1, panelSize, 1);
          if (panelSize > 2) {
            rect(x, y + 1, 1, panelSize - 2);
            rect(x + panelSize - 1, y + 1, 1, panelSize - 2);
          }
        }
      }
    }

    if (render) render.pop();
    else pop();
  }

  _getCalcPanelImage(panelIndex, panelSize) {
    if (!Array.isArray(this.calcPanelImages)) {
      this.calcPanelImages = [];
    }

    let img = this.calcPanelImages[panelIndex];
    if (!img || img.width !== panelSize || img.height !== panelSize) {
      this._releaseBuffer(img);
      img = this._createReadbackBuffer(panelSize, panelSize);
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
      ctx.noStroke();
      ctx.fill(0, 170);
      ctx.rect(x + 1, y + 1, panelSize - 2, panelSize - 2);
      this._applyTextFont(ctx);
      ctx.textSize(10);
      ctx.textAlign(LEFT, TOP);
      ctx.fill(255, 220);
      ctx.text(`${label} (pending)`, x + 6, y + 4);
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
    ctx.textSize(10);
    ctx.textAlign(LEFT, TOP);
    ctx.fill(255);
    ctx.text(label, x + 6, y + 4);
    ctx.pop();
  }

  dispose() {
    this._releaseBuffer(this.img);
    if (Array.isArray(this.calcPanelImages)) {
      this.calcPanelImages.forEach((panel) => this._releaseBuffer(panel));
    }
    this._releaseBuffer(this.calcPanelsCanvas);
    this._releaseBuffer(this._legendBarImg);
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
    if (this._statisticsGfx) {
      this._statisticsGfx.remove();
      this._statisticsGfx = null;
    }
    this._rollBuffer = null;
  }
}

Renderer.installMethodsFrom(RendererOverlayPanelMethods);
