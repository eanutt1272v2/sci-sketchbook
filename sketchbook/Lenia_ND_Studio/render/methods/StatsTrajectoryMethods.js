class StatsTrajectoryMethods {
  _renderTrajectoryPath(history, colour, cellPx, viewShiftX, viewShiftY) {
    if (!Array.isArray(history) || history.length < 2) return;

    const denom = Math.max(1, history.length - 1);

    push();
    noFill();
    strokeWeight(1);

    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      if (!prev || !curr) continue;

      const px = Number(prev.x);
      const py = Number(prev.y);
      const cx = Number(curr.x);
      const cy = Number(curr.y);
      if (
        !Number.isFinite(px) ||
        !Number.isFinite(py) ||
        !Number.isFinite(cx) ||
        !Number.isFinite(cy)
      ) {
        continue;
      }

      const p0 = this._toViewWrappedPoint(px, py, viewShiftX, viewShiftY);
      const p1Base = this._toViewWrappedPoint(cx, cy, viewShiftX, viewShiftY);
      const p1 = this._nearestWrappedPoint(p0.x, p0.y, p1Base.x, p1Base.y);

      const alpha = Math.round(30 + (200 * i) / denom);
      stroke(colour[0], colour[1], colour[2], alpha);
      for (let sx = -1; sx <= 1; sx++) {
        for (let sy = -1; sy <= 1; sy++) {
          const tx = sx * this.size;
          const ty = sy * this.size;
          line(
            (p0.x + tx) * cellPx,
            (p0.y + ty) * cellPx,
            (p1.x + tx) * cellPx,
            (p1.y + ty) * cellPx,
          );
        }
      }
    }

    const last = history[history.length - 1];
    const lx = Number(last?.x);
    const ly = Number(last?.y);
    if (Number.isFinite(lx) && Number.isFinite(ly)) {
      const tail = this._toViewWrappedPoint(lx, ly, viewShiftX, viewShiftY);
      noStroke();
      fill(colour[0], colour[1], colour[2], 225);
      ellipse(tail.x * cellPx, tail.y * cellPx, 5, 5);
    }

    pop();
  }

  renderTrajectoryOverlay(statistics, params = {}) {
    const massHistory = statistics?.trajectoryMass;
    const growthHistory = statistics?.trajectoryGrowth;
    if (!Array.isArray(massHistory) || massHistory.length < 2) return;

    const mass = Number(statistics?.mass);
    if (!Number.isFinite(mass) || mass <= 1e-10) return;

    const cellPx = width / this.size;
    const vsx = this._viewOffsetActive ? this._viewShiftX : 0;
    const vsy = this._viewOffsetActive ? this._viewShiftY : 0;

    if (Array.isArray(growthHistory) && growthHistory.length >= 2) {
      this._renderTrajectoryPath(
        growthHistory,
        [255, 196, 92],
        cellPx,
        vsx,
        vsy,
      );
    }
    this._renderTrajectoryPath(massHistory, [120, 215, 255], cellPx, vsx, vsy);

    const showLabel = params.renderStats !== true;
    if (!showLabel) return;
    push();
    this._applyTextFont();
    noStroke();
    fill(255, 180);
    textSize(11);
    textAlign(LEFT, TOP);
    text("trajectory", 20, 20);
    pop();
  }

  renderMassGrowthOverlay(statistics, params = {}) {
    const mass = Number(statistics?.mass);
    const centreX = Number(statistics?.centreX);
    const centreY = Number(statistics?.centreY);
    const growthX = Number(statistics?.growthCentreX);
    const growthY = Number(statistics?.growthCentreY);

    if (
      !Number.isFinite(mass) ||
      mass <= 1e-10 ||
      !Number.isFinite(centreX) ||
      !Number.isFinite(centreY) ||
      !Number.isFinite(growthX) ||
      !Number.isFinite(growthY)
    ) {
      return;
    }

    const cellPx = width / this.size;
    const vsx = this._viewOffsetActive ? this._viewShiftX : 0;
    const vsy = this._viewOffsetActive ? this._viewShiftY : 0;

    const massPoint = this._toViewWrappedPoint(centreX, centreY, vsx, vsy);
    const growthBase = this._toViewWrappedPoint(growthX, growthY, vsx, vsy);
    const growthPoint = this._nearestWrappedPoint(
      massPoint.x,
      massPoint.y,
      growthBase.x,
      growthBase.y,
    );

    push();
    stroke(255, 212, 96, 220);
    strokeWeight(1.5);
    for (let sx = -1; sx <= 1; sx++) {
      for (let sy = -1; sy <= 1; sy++) {
        const tx = sx * this.size;
        const ty = sy * this.size;
        line(
          (massPoint.x + tx) * cellPx,
          (massPoint.y + ty) * cellPx,
          (growthPoint.x + tx) * cellPx,
          (growthPoint.y + ty) * cellPx,
        );
      }
    }

    noStroke();
    fill(120, 215, 255, 235);
    ellipse(massPoint.x * cellPx, massPoint.y * cellPx, 6, 6);
    fill(255, 196, 92, 235);
    ellipse(growthPoint.x * cellPx, growthPoint.y * cellPx, 6, 6);

    if (!params.renderStats) {
      this._applyTextFont();
      noStroke();
      fill(220, 200);
      textSize(10);
      textAlign(LEFT, TOP);
      text("mass centroid -> growth centroid", 20, 34);
    }
    pop();
  }

  _getStatHeaders(statistics) {
    if (
      Array.isArray(statistics?.statHeaders) &&
      statistics.statHeaders.length > 0
    ) {
      return statistics.statHeaders;
    }
    return [
      "fps",
      "n",
      "t",
      "m",
      "g",
      "ml",
      "gl",
      "vl",
      "vgl",
      "rho",
      "rhog",
      "p",
      "r",
      "x",
      "y",
      "gx",
      "gy",
      "d",
      "ma",
      "s",
      "cs",
      "a",
      "wc",
      "wg",
      "wt",
      "k",
      "ks",
      "wr",
      "ly",
      "h1",
      "h4",
      "h5",
      "h6",
      "h7",
      "f7",
      "f8",
      "f9",
      "f10",
      "period",
      "periodConfidence",
    ];
  }

  _getStatNames(statistics) {
    return statistics?.statNames && typeof statistics.statNames === "object"
      ? statistics.statNames
      : {};
  }

  _getStatIndex(statistics, key) {
    const headers = this._getStatHeaders(statistics);
    const idx = headers.indexOf(String(key || ""));
    return Number.isInteger(idx) ? idx : -1;
  }

  _extractXYPairs(rows, xIndex, yIndex) {
    if (!Array.isArray(rows) || xIndex < 0 || yIndex < 0) return [];
    const out = [];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const x = Number(row[xIndex]);
      const y = Number(row[yIndex]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      out.push({ x, y });
    }
    return out;
  }

  _rectIntersectionArea(a, b) {
    const x0 = Math.max(a.x, b.x);
    const y0 = Math.max(a.y, b.y);
    const x1 = Math.min(a.x + a.w, b.x + b.w);
    const y1 = Math.min(a.y + a.h, b.y + b.h);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return 0;
    return w * h;
  }

  _getHudReservedRects(params = {}) {
    const rects = [];

    if (params.renderStats) {
      rects.push({
        x: 12,
        y: 12,
        w: Math.max(300, Math.min(460, Math.floor(width * 0.48))),
        h: Math.max(180, height - 24),
      });
    }

    if (
      params.renderCalcPanels &&
      typeof this._getCalcPanelLayout === "function"
    ) {
      const layout = this._getCalcPanelLayout();
      rects.push({
        x: layout.baseX - 4,
        y: layout.baseY - 4,
        w: layout.totalW + 8,
        h: layout.totalH + 8,
      });
    }

    if (params.renderLegend) {
      rects.push({ x: width - 70, y: 12, w: 58, h: height - 24 });
    }

    if (params.renderScale) {
      rects.push({ x: width - 170, y: height - 60, w: 160, h: 52 });
    }

    if (params.renderAnimalName) {
      rects.push({
        x: Math.floor(width * 0.2),
        y: height - 32,
        w: Math.floor(width * 0.6),
        h: 24,
      });
    }

    return rects;
  }

  _pickGraphPanelRect(panelW, panelH, params = {}, preferred = "topRight") {
    const margin = 14;
    const w = Math.max(180, Math.min(Math.floor(panelW), width - margin * 2));
    const h = Math.max(120, Math.min(Math.floor(panelH), height - margin * 2));

    const xMid = Math.floor((width - w) / 2);
    const yMid = Math.floor((height - h) / 2);
    const anchors = {
      topLeft: { x: margin, y: margin },
      topCenter: { x: xMid, y: margin },
      topRight: { x: width - w - margin, y: margin },
      rightCenter: { x: width - w - margin, y: yMid },
      center: { x: xMid, y: yMid },
      bottomLeft: { x: margin, y: height - h - margin },
      bottomCenter: { x: xMid, y: height - h - margin },
      bottomRight: { x: width - w - margin, y: height - h - margin },
      leftCenter: { x: margin, y: yMid },
    };

    const preferenceOrder = {
      topLeft: [
        "topLeft",
        "leftCenter",
        "topCenter",
        "center",
        "topRight",
        "bottomLeft",
      ],
      topCenter: ["topCenter", "topRight", "topLeft", "center", "rightCenter"],
      topRight: ["topRight", "rightCenter", "topCenter", "center", "topLeft"],
      bottomLeft: [
        "bottomLeft",
        "leftCenter",
        "bottomCenter",
        "center",
        "topLeft",
      ],
      bottomCenter: [
        "bottomCenter",
        "bottomRight",
        "bottomLeft",
        "center",
        "topCenter",
      ],
      bottomRight: [
        "bottomRight",
        "rightCenter",
        "bottomCenter",
        "center",
        "topRight",
      ],
      center: [
        "center",
        "topCenter",
        "rightCenter",
        "leftCenter",
        "bottomCenter",
      ],
      rightCenter: [
        "rightCenter",
        "topRight",
        "bottomRight",
        "center",
        "topCenter",
      ],
      leftCenter: [
        "leftCenter",
        "topLeft",
        "bottomLeft",
        "center",
        "topCenter",
      ],
    };

    const reserved = this._getHudReservedRects(params);
    const order = preferenceOrder[preferred] || preferenceOrder.topRight;

    let best = { x: margin, y: margin, w, h };
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < order.length; i++) {
      const key = order[i];
      const anchor = anchors[key];
      if (!anchor) continue;
      const rect = { x: anchor.x, y: anchor.y, w, h };

      let score = i * 1000;
      for (const r of reserved) {
        score += this._rectIntersectionArea(rect, r);
      }

      if (score < bestScore) {
        best = rect;
        bestScore = score;
      }
    }

    best.x = Math.max(margin, Math.min(best.x, width - best.w - margin));
    best.y = Math.max(margin, Math.min(best.y, height - best.h - margin));
    return best;
  }

  _buildGraphFrame(panel, { topRows = 2, bottomRows = 0 } = {}) {
    const rowH = 12;
    const leftPad = 36;
    const rightPad = 10;
    const topPad = topRows > 0 ? topRows * rowH + 10 : 6;
    const bottomPad = bottomRows > 0 ? bottomRows * rowH + 10 : 8;

    return {
      panel,
      plotX: panel.x + leftPad,
      plotY: panel.y + topPad,
      plotW: Math.max(24, panel.w - leftPad - rightPad),
      plotH: Math.max(24, panel.h - topPad - bottomPad),
      topRows,
      bottomRows,
      rowH,
    };
  }

  _drawGraphAxes(frame) {
    const x0 = Math.round(frame.plotX) + 0.5;
    const y0 = Math.round(frame.plotY) + 0.5;
    const x1 = Math.round(frame.plotX + frame.plotW) + 0.5;
    const y1 = Math.round(frame.plotY + frame.plotH) + 0.5;

    push();
    stroke(215, 215, 215, 210);
    strokeWeight(1);
    line(x0, y1, x1, y1);
    line(x0, y0, x0, y1);
    pop();
  }

  _drawGraphPlaceholder(frame, message = "collecting samples...") {
    push();
    this._applyTextFont();
    noStroke();
    fill(210);
    textSize(11);
    textAlign(CENTER, CENTER);
    text(message, frame.plotX + frame.plotW / 2, frame.plotY + frame.plotH / 2);
    pop();
  }

  _formatStatLine(key, min, max, current) {
    return `${key} (${min.toFixed(3)}-${max.toFixed(3)}) ${current.toFixed(3)}`;
  }

  renderStatsGraphOverlay(statistics, params = {}) {
    const mode = Math.max(
      0,
      Math.min(6, Math.floor(Number(params?.statsMode) || 0)),
    );
    if (mode < 1 || mode > 4) return;

    const allSegments = Array.isArray(statistics?.seriesSegments)
      ? statistics.seriesSegments.filter(
          (segment) => Array.isArray(segment) && segment.length > 1,
        )
      : [];
    if (
      allSegments.length === 0 &&
      Array.isArray(statistics?.series) &&
      statistics.series.length > 1
    ) {
      allSegments.push(statistics.series);
    }

    const layoutByMode = {
      1: {
        w: Math.max(250, Math.min(340, Math.floor(width * 0.34))),
        h: Math.max(170, Math.min(240, Math.floor(height * 0.3))),
        anchor: "bottomLeft",
        topRows: 0,
        bottomRows: 2,
      },
      2: {
        w: Math.max(420, Math.min(720, Math.floor(width * 0.72))),
        h: Math.max(280, Math.min(460, Math.floor(height * 0.6))),
        anchor: "topCenter",
        topRows: 2,
        bottomRows: 0,
      },
      3: {
        w: Math.max(320, Math.min(480, Math.floor(width * 0.52))),
        h: Math.max(220, Math.min(340, Math.floor(height * 0.42))),
        anchor: "topRight",
        topRows: 2,
        bottomRows: 0,
      },
      4: {
        w: Math.max(360, Math.min(560, Math.floor(width * 0.62))),
        h: Math.max(250, Math.min(380, Math.floor(height * 0.48))),
        anchor: "topRight",
        topRows: 2,
        bottomRows: 0,
      },
    };
    const layout = layoutByMode[mode] || layoutByMode[2];
    const panel = this._pickGraphPanelRect(
      layout.w,
      layout.h,
      params,
      layout.anchor,
    );
    const frame = this._buildGraphFrame(panel, {
      topRows: layout.topRows,
      bottomRows: layout.bottomRows,
    });

    const xKey = String(params?.statsX || "m");
    const yKey = String(params?.statsY || "g");
    const xIndex = this._getStatIndex(statistics, xKey);
    const yIndex = this._getStatIndex(statistics, yKey);
    const grouped = mode === 4 && Boolean(params?.statsGroupByParams);
    const isSmall = mode === 1;

    if (allSegments.length === 0 || xIndex < 0 || yIndex < 0) {
      this._drawGraphPlaceholder(frame);
      return;
    }

    const selectedRows =
      mode === 4 ? allSegments : [allSegments[allSegments.length - 1]];
    const selectedSegments = selectedRows
      .map((rows) => this._extractXYPairs(rows, xIndex, yIndex))
      .filter((pairs) => pairs.length > 1);
    if (!selectedSegments.length) {
      this._drawGraphPlaceholder(frame);
      return;
    }

    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (const pairs of selectedSegments) {
      for (const p of pairs) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      }
    }
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) return;
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return;

    if (isSmall) {
      xMax = (xMax - xMin) * 4 + xMin;
      yMax = (yMax - yMin) * 4 + yMin;
    }

    if (Math.abs(xMax - xMin) < 1e-12) {
      xMin -= 0.5;
      xMax += 0.5;
    }
    if (Math.abs(yMax - yMin) < 1e-12) {
      yMin -= 0.5;
      yMax += 0.5;
    }

    const isSquare =
      (xKey === "x" || xKey === "y") && (yKey === "x" || yKey === "y");
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    const sharedRange = Math.max(xRange, yRange);
    const xDen = isSquare
      ? Math.max(sharedRange, 1e-12)
      : Math.max(xRange, 1e-12);
    const yDen = isSquare
      ? Math.max(sharedRange, 1e-12)
      : Math.max(yRange, 1e-12);

    const xToPx = (v) => frame.plotX + ((v - xMin) / xDen) * frame.plotW;
    const yToPx = (v) => frame.plotY + (1 - (v - yMin) / yDen) * frame.plotH;

    const latestSegment = selectedSegments[selectedSegments.length - 1] || [];
    const latestPoint = latestSegment[latestSegment.length - 1] || null;
    const currentX = Number.isFinite(latestPoint?.x) ? latestPoint.x : 0;
    const currentY = Number.isFinite(latestPoint?.y) ? latestPoint.y : 0;

    const segmentShades = (() => {
      if (mode !== 4) return new Array(selectedSegments.length).fill(255);
      const shades = [];
      for (let i = 0; i < selectedSegments.length; i++) {
        shades.push(Math.round(194 / 2 ** i + 61));
      }
      return shades.reverse();
    })();

    const sIndex = grouped ? this._getStatIndex(statistics, "s") : -1;
    const mIndex = grouped ? this._getStatIndex(statistics, "m") : -1;
    const groupedMeta = grouped
      ? selectedRows.map((rows) => {
          const head = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
          return {
            s: head && sIndex >= 0 ? Number(head[sIndex]) : Number.NaN,
            m: head && mIndex >= 0 ? Number(head[mIndex]) : Number.NaN,
          };
        })
      : [];
    const finiteS = groupedMeta
      .map((meta) => meta.s)
      .filter((v) => Number.isFinite(v));
    const finiteM = groupedMeta
      .map((meta) => meta.m)
      .filter((v) => Number.isFinite(v));
    const sMin = finiteS.length > 0 ? Math.min(...finiteS) : 0;
    const sMax = finiteS.length > 0 ? Math.max(...finiteS) : 1;
    const mMin = finiteM.length > 0 ? Math.min(...finiteM) : 0;
    const mMax = finiteM.length > 0 ? Math.max(...finiteM) : 1;
    const ds = 0.001;
    const dm = 0.01;
    const sSpan = Math.max(1e-9, sMax - sMin);
    const mSpan = Math.max(1e-9, mMax - mMin);

    this._drawGraphAxes(frame);

    push();
    this._applyTextFont();
    noFill();
    strokeWeight(1);
    drawingContext.lineCap = "butt";
    drawingContext.lineJoin = "miter";

    for (let i = 0; i < selectedSegments.length; i++) {
      const pairs = selectedSegments[i];
      const shade = segmentShades[Math.min(i, segmentShades.length - 1)] || 255;
      stroke(shade, shade, shade, 255);

      if (
        grouped &&
        Number.isFinite(groupedMeta[i]?.s) &&
        Number.isFinite(groupedMeta[i]?.m)
      ) {
        let sxMin = Number.POSITIVE_INFINITY;
        let sxMax = Number.NEGATIVE_INFINITY;
        let syMin = Number.POSITIVE_INFINITY;
        let syMax = Number.NEGATIVE_INFINITY;
        for (const p of pairs) {
          if (p.x < sxMin) sxMin = p.x;
          if (p.x > sxMax) sxMax = p.x;
          if (p.y < syMin) syMin = p.y;
          if (p.y > syMax) syMax = p.y;
        }
        const sxRange = Math.max(1e-9, sxMax - sxMin);
        const syRange = Math.max(1e-9, syMax - syMin);

        const sNorm = (groupedMeta[i].s - sMin) / (sSpan + ds);
        const mNorm = (groupedMeta[i].m - mMin) / (mSpan + dm);
        const xScale = ds / (sSpan + ds);
        const yScale = dm / (mSpan + dm);
        const gx = (v) => frame.plotX + (v * xScale + sNorm) * frame.plotW;
        const gy = (v) =>
          frame.plotY + (1 - (v * yScale + mNorm)) * frame.plotH;

        const bx0 = gx(0);
        const bx1 = gx(1);
        const by0 = gy(0);
        const by1 = gy(1);
        rect(
          Math.min(bx0, bx1),
          Math.min(by0, by1),
          Math.abs(bx1 - bx0),
          Math.abs(by1 - by0),
        );

        for (let j = 1; j < pairs.length; j++) {
          const p0 = pairs[j - 1];
          const p1 = pairs[j];
          const x0 = gx((p0.x - sxMin) / sxRange);
          const y0 = gy((p0.y - syMin) / syRange);
          const x1 = gx((p1.x - sxMin) / sxRange);
          const y1 = gy((p1.y - syMin) / syRange);
          if (
            Number.isFinite(x0) &&
            Number.isFinite(y0) &&
            Number.isFinite(x1) &&
            Number.isFinite(y1)
          ) {
            line(x0, y0, x1, y1);
          }
        }
        continue;
      }

      for (let j = 1; j < pairs.length; j++) {
        const p0 = pairs[j - 1];
        const p1 = pairs[j];
        const x0 = xToPx(p0.x);
        const y0 = yToPx(p0.y);
        const x1 = xToPx(p1.x);
        const y1 = yToPx(p1.y);
        if (
          Number.isFinite(x0) &&
          Number.isFinite(y0) &&
          Number.isFinite(x1) &&
          Number.isFinite(y1)
        ) {
          line(x0, y0, x1, y1);
        }
      }
    }

    noStroke();
    fill(255);
    textAlign(LEFT, TOP);
    textSize(11);

    const lineX = panel.x + 6;
    const line1 = `X: ${this._formatStatLine(xKey, xMin, xMax, currentX)}`;
    const line2 = `Y: ${this._formatStatLine(yKey, yMin, yMax, currentY)}`;
    if (layout.topRows > 0) {
      text(line1, lineX, panel.y + 4);
      text(line2, lineX, panel.y + 16);
    } else {
      text(line1, lineX, panel.y + panel.h - 28);
      text(line2, lineX, panel.y + panel.h - 16);
    }

    pop();
  }

  renderRecurrenceOverlay(statistics, params = {}) {
    const mode = Math.max(
      0,
      Math.min(6, Math.floor(Number(params?.statsMode) || 0)),
    );
    if (mode !== 6) return;

    const segments = Array.isArray(statistics?.seriesSegments)
      ? statistics.seriesSegments.filter(
          (segment) => Array.isArray(segment) && segment.length > 3,
        )
      : [];
    const currentRows =
      segments.length > 0
        ? segments[segments.length - 1]
        : Array.isArray(statistics?.series)
          ? statistics.series
          : [];

    const xKey = String(params?.statsX || "m");
    const yKey = String(params?.statsY || "g");
    const xIndex = this._getStatIndex(statistics, xKey);
    const yIndex = this._getStatIndex(statistics, yKey);
    const pairs = this._extractXYPairs(currentRows, xIndex, yIndex);

    const panelSize = Math.max(
      220,
      Math.min(380, Math.floor(Math.min(width, height) * 0.45)),
    );
    const panel = this._pickGraphPanelRect(
      panelSize,
      panelSize + 40,
      params,
      "topRight",
    );
    const frame = this._buildGraphFrame(panel, { topRows: 1, bottomRows: 2 });
    const names = this._getStatNames(statistics);

    if (pairs.length < 4) {
      this._drawGraphPlaceholder(frame);
      push();
      this._applyTextFont();
      noStroke();
      fill(255);
      textSize(11);
      textAlign(CENTER, TOP);
      text("recurrence plot", panel.x + panel.w / 2, panel.y + 4);
      pop();
      return;
    }

    const maxN = Math.min(96, pairs.length);
    const sampled = [];
    if (pairs.length <= maxN) {
      sampled.push(...pairs);
    } else {
      const scale = (pairs.length - 1) / (maxN - 1);
      for (let i = 0; i < maxN; i++) {
        sampled.push(pairs[Math.round(i * scale)]);
      }
    }

    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (const p of sampled) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    const xRange = Math.max(1e-9, xMax - xMin);
    const yRange = Math.max(1e-9, yMax - yMin);
    const n = sampled.length;
    const cellW = frame.plotW / n;
    const cellH = frame.plotH / n;
    const threshold = Math.max(
      0.05,
      Math.min(1.5, Number(params?.recurrenceThreshold) || 0.2),
    );

    this._drawGraphAxes(frame);

    push();
    noStroke();
    for (let j = 0; j < n; j++) {
      const yj = (sampled[j].y - yMin) / yRange;
      const xj = (sampled[j].x - xMin) / xRange;
      for (let i = 0; i < n; i++) {
        const yi = (sampled[i].y - yMin) / yRange;
        const xi = (sampled[i].x - xMin) / xRange;
        const dist = Math.hypot(xi - xj, yi - yj);
        const v =
          dist <= threshold
            ? 1
            : Math.max(0, 1 - (dist - threshold) / (threshold * 3));
        const shade = Math.round(v * 255);
        fill(shade, shade, shade, 255);
        rect(
          frame.plotX + i * cellW,
          frame.plotY + j * cellH,
          cellW + 0.35,
          cellH + 0.35,
        );
      }
    }

    this._applyTextFont();
    noStroke();
    textSize(11);
    textAlign(CENTER, TOP);
    fill(255);
    text("recurrence plot", panel.x + panel.w / 2, panel.y + 4);

    fill(220);
    textSize(10.5);
    textAlign(LEFT, TOP);
    text(
      `threshold=${threshold.toFixed(2)} | samples=${n}`,
      panel.x + 6,
      panel.y + panel.h - 28,
    );
    fill(188);
    text(
      `${xKey}: ${names[xKey] || xKey} | ${yKey}: ${names[yKey] || yKey}`,
      panel.x + 6,
      panel.y + panel.h - 16,
    );
    pop();
  }

  renderPeriodogramOverlay(statistics, params = {}) {
    const freq = statistics?.psdFreq;
    const psdPrimary = statistics?.psdPrimary;
    const psdSecondary = statistics?.psdSecondary;
    const useWelch =
      statistics?.psdIsWelch !== undefined
        ? statistics.psdIsWelch
        : params.periodogramUseWelch !== false;
    const title = useWelch ? "periodogram (Welch)" : "periodogram";
    const primaryLabel = String(
      statistics?.psdPrimaryKey || params?.statsX || "m",
    );
    const secondaryLabel = String(
      statistics?.psdSecondaryKey || params?.statsY || "g",
    );

    const panelW = Math.max(260, Math.min(430, Math.floor(width * 0.44)));
    const panelH = Math.max(180, Math.min(280, Math.floor(height * 0.34)));
    const panel = this._pickGraphPanelRect(panelW, panelH, params, "topRight");
    const frame = this._buildGraphFrame(panel, { topRows: 3, bottomRows: 1 });

    push();
    this._applyTextFont();
    noStroke();
    fill(255);
    textSize(11);
    textAlign(CENTER, TOP);
    text(title, panel.x + panel.w / 2, panel.y + 4);

    if (!freq || !psdPrimary) {
      this._drawGraphPlaceholder(frame);
      pop();
      return;
    }

    const count = Math.min(
      Number(freq.length) || 0,
      Number(psdPrimary.length) || 0,
      psdSecondary
        ? Number(psdSecondary.length) || 0
        : Number(psdPrimary.length) || 0,
    );
    if (count < 2) {
      this._drawGraphPlaceholder(frame);
      pop();
      return;
    }

    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < count; i++) {
      const f = Number(freq[i]);
      const y1 = Number(psdPrimary[i]);
      const y2 = psdSecondary ? Number(psdSecondary[i]) : Number.NaN;
      if (Number.isFinite(f) && f > 0) {
        if (f < xMin) xMin = f;
        if (f > xMax) xMax = f;
      }
      if (Number.isFinite(y1)) {
        if (y1 < yMin) yMin = y1;
        if (y1 > yMax) yMax = y1;
      }
      if (Number.isFinite(y2)) {
        if (y2 < yMin) yMin = y2;
        if (y2 > yMax) yMax = y2;
      }
    }

    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) {
      this._drawGraphPlaceholder(frame);
      pop();
      return;
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMax <= yMin) {
      yMin = 0;
      yMax = 1;
    }

    this._drawGraphAxes(frame);

    const xToPx = (value) =>
      frame.plotX + ((value - xMin) / (xMax - xMin)) * frame.plotW;
    const yToPx = (value) =>
      frame.plotY + (1 - (value - yMin) / (yMax - yMin)) * frame.plotH;

    const drawCurve = (series, colour) => {
      if (!series) return;
      noFill();
      stroke(colour[0], colour[1], colour[2]);
      strokeWeight(1);
      drawingContext.lineCap = "butt";
      drawingContext.lineJoin = "miter";
      beginShape();
      for (let i = 0; i < count; i++) {
        const f = Number(freq[i]);
        const y = Number(series[i]);
        if (!Number.isFinite(f) || !Number.isFinite(y)) continue;
        vertex(xToPx(f), yToPx(y));
      }
      endShape();
    };

    drawCurve(psdSecondary, [186, 186, 186]);
    drawCurve(psdPrimary, [255, 255, 255]);

    fill(220);
    textAlign(RIGHT, TOP);
    text(
      `${xMax.toFixed(2)} Hz`,
      frame.plotX + frame.plotW,
      frame.plotY + frame.plotH + 3,
    );
    textAlign(LEFT, TOP);
    text(`${xMin.toFixed(2)} Hz`, frame.plotX, frame.plotY + frame.plotH + 3);

    const periodA = Number(statistics?.psdPrimaryPeriod) || 0;
    const periodB = Number(statistics?.psdSecondaryPeriod) || 0;
    fill(255);
    textAlign(CENTER, TOP);
    text(
      `period from ${primaryLabel} = ${periodA > 0 ? periodA.toFixed(2) : "-"} μs`,
      panel.x + panel.w / 2,
      panel.y + 16,
    );
    fill(186);
    text(
      `period from ${secondaryLabel} = ${periodB > 0 ? periodB.toFixed(2) : "-"} μs`,
      panel.x + panel.w / 2,
      panel.y + 28,
    );
    pop();
  }
}

for (const name of Object.getOwnPropertyNames(
  StatsTrajectoryMethods.prototype,
)) {
  if (name === "constructor") continue;
  Renderer.prototype[name] = StatsTrajectoryMethods.prototype[name];
}
