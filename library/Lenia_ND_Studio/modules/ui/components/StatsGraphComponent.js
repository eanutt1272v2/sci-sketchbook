class StatisticsGraphComponent {
  _mountStatisticsGraph(graphsFolder) {
    this._teardownStatisticsGraph();

    if (typeof document === "undefined") return;

    const folderElement =
      graphsFolder?.element || graphsFolder?.controller_?.view?.element || null;
    if (!folderElement) return;

    const contentHost =
      folderElement.querySelector?.(".tp-fldv_c") || folderElement;
    if (!contentHost) return;

    const theme = this._resolveGraphTheme(folderElement);

    const wrapper = document.createElement("div");
    wrapper.style.marginTop = "4px";
    wrapper.style.marginLeft = "6px";
    wrapper.style.marginRight = "6px";
    wrapper.style.padding = "4px";
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.rowGap = "4px";
    wrapper.style.border = "none";
    wrapper.style.borderRadius = theme.cornerRadius;
    wrapper.style.background = "var(--tp-container-background-color)";
    wrapper.style.boxShadow = "none";
    wrapper.style.fontFamily = this._graphFontFamily();

    const title = document.createElement("div");
    title.textContent = "Graph Window";
    title.style.fontSize = "11px";
    title.style.color = "var(--tp-container-foreground-color)";
    title.style.letterSpacing = "0.01em";
    title.style.paddingLeft = "4px";
    title.style.lineHeight = "16px";
    title.style.fontFamily = this._graphFontFamily();

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.aspectRatio = "1 / 1";
    canvas.style.border = "none";
    canvas.style.outline = "none";
    canvas.style.borderRadius = theme.cornerRadius;
    canvas.style.background = "var(--tp-monitor-background-color)";

    const caption = document.createElement("div");
    caption.textContent = "collecting samples...";
    caption.style.marginTop = "0";
    caption.style.fontSize = "10px";
    caption.style.color = "var(--tp-label-foreground-color)";
    caption.style.lineHeight = "1.25";
    caption.style.fontFamily = this._graphFontFamily();

    wrapper.appendChild(title);
    wrapper.appendChild(canvas);
    wrapper.appendChild(caption);
    contentHost.appendChild(wrapper);

    this._statisticsGraphWrapper = wrapper;
    this._statisticsGraphCanvas = canvas;
    this._statisticsGraphCaption = caption;

    this._startStatisticsGraphLoop();
    this._renderStatisticsGraph();
  }

  _teardownStatisticsGraph() {
    if (this._statisticsGraphRaf) {
      cancelAnimationFrame(this._statisticsGraphRaf);
      this._statisticsGraphRaf = 0;
    }

    if (this._statisticsGraphWrapper && this._statisticsGraphWrapper.parentNode) {
      this._statisticsGraphWrapper.parentNode.removeChild(this._statisticsGraphWrapper);
    }

    this._statisticsGraphWrapper = null;
    this._statisticsGraphCanvas = null;
    this._statisticsGraphCaption = null;
    this._statisticsGraphLastFrameMs = 0;
    this._statisticsGraphScratch = null;
    this._statisticsGraphLayers = null;
  }

  _startStatisticsGraphLoop() {
    if (this._statisticsGraphRaf || !this._statisticsGraphCanvas) return;

    const tick = (ts) => {
      this._statisticsGraphRaf = requestAnimationFrame(tick);
      if (ts - this._statisticsGraphLastFrameMs < 110) return;
      this._statisticsGraphLastFrameMs = ts;
      this._renderStatisticsGraph();
    };

    this._statisticsGraphRaf = requestAnimationFrame(tick);
  }

  _resolveStatIndex(statistics, statKey) {
    if (
      typeof Analyser !== "undefined" &&
      typeof Analyser.getStatIndex === "function"
    ) {
      return Analyser.getStatIndex(statKey);
    }

    const headers = Array.isArray(statistics?.statHeaders)
      ? statistics.statHeaders
      : [];
    return headers.indexOf(String(statKey || ""));
  }

  _extractGraphPairs(rows, xIndex, yIndex) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
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

  _plotRect(w, h) {
    const margin = { l: 44, r: 12, t: 12, b: 32 };
    return {
      x: margin.l,
      y: margin.t,
      w: Math.max(24, w - margin.l - margin.r),
      h: Math.max(24, h - margin.t - margin.b),
    };
  }

  _graphFontFamily() {
    return '"Iosevka", "Iosevka Fixed", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  }

  _graphFont(sizePx = 11, weight = 400) {
    const size = Math.max(8, Number(sizePx) || 11);
    return `${weight} ${size}px ${this._graphFontFamily()}`;
  }

  _resolveGraphTheme(referenceElement = null) {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return {
        labelForeground: "rgba(220,220,220,0.8)",
        monitorBackground: "rgba(0,0,0,0.2)",
        monitorForeground: "rgba(220,220,220,0.75)",
        inputForeground: "#f0f0f0",
        grooveForeground: "rgba(220,220,220,0.12)",
        cornerRadius: "4px",
      };
    }

    const host =
      referenceElement ||
      this._statisticsGraphWrapper ||
      this.pane?.element ||
      document.documentElement;
    const rootStyle = window.getComputedStyle(document.documentElement);
    const readVar = (name, fallback) => {
      const value = rootStyle.getPropertyValue(name);
      const trimmed = typeof value === "string" ? value.trim() : "";
      return trimmed || fallback;
    };
    const sampleInput =
      host.querySelector?.(".tp-txtv_i, .tp-lstv_i, .tp-btnv_b") || null;
    const sampleStyle = sampleInput
      ? window.getComputedStyle(sampleInput)
      : null;
    const cornerRadius =
      sampleStyle?.getPropertyValue("border-radius")?.trim() || "4px";

    return {
      labelForeground: readVar(
        "--tp-label-foreground-color",
        "rgba(220,220,220,0.8)",
      ),
      monitorBackground: readVar(
        "--tp-monitor-background-color",
        "rgba(0,0,0,0.2)",
      ),
      monitorForeground: readVar(
        "--tp-monitor-foreground-color",
        "rgba(220,220,220,0.75)",
      ),
      inputForeground: readVar("--tp-input-foreground-color", "#f0f0f0"),
      grooveForeground: readVar(
        "--tp-groove-foreground-color",
        "rgba(220,220,220,0.12)",
      ),
      cornerRadius,
    };
  }

  _renderPlotAxes(ctx, plot, theme) {
    ctx.strokeStyle = theme?.grooveForeground || "rgba(220,220,220,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.x + 0.5, plot.y + plot.h + 0.5);
    ctx.lineTo(plot.x + plot.w + 0.5, plot.y + plot.h + 0.5);
    ctx.moveTo(plot.x + 0.5, plot.y + 0.5);
    ctx.lineTo(plot.x + 0.5, plot.y + plot.h + 0.5);
    ctx.stroke();
  }

  _quantile(sortedValues, q) {
    if (!Array.isArray(sortedValues) || sortedValues.length === 0) return 0;
    const qq = Math.max(0, Math.min(1, Number(q) || 0));
    const i = Math.max(
      0,
      Math.min(
        sortedValues.length - 1,
        Math.floor((sortedValues.length - 1) * qq),
      ),
    );
    return sortedValues[i];
  }

  _isMostlyIncreasing(values) {
    if (!Array.isArray(values) || values.length < 12) return false;
    let usable = 0;
    let rising = 0;
    let prev = null;

    for (let i = 0; i < values.length; i++) {
      const value = Number(values[i]);
      if (!Number.isFinite(value)) continue;
      if (prev === null) {
        prev = value;
        continue;
      }

      const delta = value - prev;
      prev = value;
      if (!Number.isFinite(delta) || Math.abs(delta) < 1e-12) continue;
      usable += 1;
      if (delta > 0) rising += 1;
    }

    if (usable < 8) return false;
    return rising / usable >= 0.86;
  }

  _fitAxisRange(values, options = {}) {
    const {
      lowerQuantile = 0.02,
      upperQuantile = 0.98,
      minSpan = 1e-9,
      padMinRatio = 0.03,
      padMaxRatio = 0.08,
      allowScroll = false,
      scrollWindow = 0,
      keepExtrema = true,
    } = options;

    const finiteValues = [];
    if (Array.isArray(values)) {
      for (let i = 0; i < values.length; i++) {
        const value = Number(values[i]);
        if (Number.isFinite(value)) finiteValues.push(value);
      }
    }

    if (finiteValues.length < 2) {
      return {
        min: 0,
        max: 1,
        rawMin: 0,
        rawMax: 1,
        span: 1,
        scrolled: false,
      };
    }

    const sorted = finiteValues.slice().sort((a, b) => a - b);
    let extentMin = sorted[0];
    let extentMax = sorted[sorted.length - 1];
    let rawMin = this._quantile(sorted, lowerQuantile);
    let rawMax = this._quantile(sorted, upperQuantile);
    let scrolled = false;

    if (allowScroll && Number.isFinite(scrollWindow) && scrollWindow >= 8) {
      const recent = [];
      for (
        let i = values.length - 1;
        i >= 0 && recent.length < scrollWindow;
        i--
      ) {
        const value = Number(values[i]);
        if (Number.isFinite(value)) recent.push(value);
      }
      if (recent.length >= 8) {
        recent.sort((a, b) => a - b);
        const recentMin = this._quantile(recent, lowerQuantile);
        const recentMax = this._quantile(recent, upperQuantile);
        if (
          Number.isFinite(recentMin) &&
          Number.isFinite(recentMax) &&
          recentMax - recentMin > minSpan
        ) {
          rawMin = recentMin;
          rawMax = recentMax;
          extentMin = recent[0];
          extentMax = recent[recent.length - 1];
          scrolled = true;
        }
      }
    }

    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
      rawMin = sorted[0];
      rawMax = sorted[sorted.length - 1];
    }

    if (keepExtrema) {
      rawMin = Math.min(rawMin, extentMin);
      rawMax = Math.max(rawMax, extentMax);
    }

    if (Math.abs(rawMax - rawMin) < minSpan) {
      const mid = 0.5 * (rawMin + rawMax);
      rawMin = mid - 0.5;
      rawMax = mid + 0.5;
    }

    const rawSpan = Math.max(minSpan, rawMax - rawMin);
    const padMin = Math.max(minSpan * 0.25, rawSpan * Math.max(0, padMinRatio));
    const padMax = Math.max(minSpan * 0.25, rawSpan * Math.max(0, padMaxRatio));
    const min = rawMin - padMin;
    const max = rawMax + padMax;

    return {
      min,
      max,
      rawMin,
      rawMax,
      span: Math.max(minSpan, max - min),
      scrolled,
    };
  }

  _niceTickStep(span, desiredTicks = 5) {
    const safeSpan = Math.max(1e-12, Number(span) || 1);
    const target = Math.max(2, Math.floor(Number(desiredTicks) || 5));
    const rawStep = safeSpan / target;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalised = rawStep / magnitude;
    let nice = 10;
    if (normalised <= 1) nice = 1;
    else if (normalised <= 2) nice = 2;
    else if (normalised <= 2.5) nice = 2.5;
    else if (normalised <= 5) nice = 5;
    return nice * magnitude;
  }

  _buildTicks(min, max, desiredTicks = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return { ticks: [], step: 1 };
    }

    const step = this._niceTickStep(max - min, desiredTicks);
    const ticks = [];
    const epsilon = step * 1e-6;
    let value = Math.ceil((min - epsilon) / step) * step;
    let guard = 0;
    while (value <= max + epsilon && guard < 128) {
      ticks.push(value);
      value += step;
      guard += 1;
    }

    if (ticks.length < 2) {
      ticks.length = 0;
      ticks.push(min, max);
    }

    return { ticks, step };
  }

  _formatTickValue(value, step) {
    const safeValue = Number(value);
    const safeStep = Math.abs(Number(step) || 1);
    if (!Number.isFinite(safeValue)) return "-";

    const normalised =
      Math.abs(safeValue) < safeStep * 1e-5 ? 0 : Number(safeValue);
    if (
      Math.abs(normalised) >= 1e4 ||
      (Math.abs(normalised) > 0 && Math.abs(normalised) < 1e-3)
    ) {
      return normalised.toExponential(1).replace("+", "");
    }

    let decimals = 0;
    if (safeStep < 1) {
      decimals = Math.min(6, Math.max(0, Math.ceil(-Math.log10(safeStep)) + 1));
    }
    return normalised
      .toFixed(decimals)
      .replace(/\.0+$/, "")
      .replace(/(\.\d*?)0+$/, "$1");
  }

  _renderPlotTicks(ctx, plot, theme, axis) {
    const xMin = Number(axis?.xMin);
    const xMax = Number(axis?.xMax);
    const yMin = Number(axis?.yMin);
    const yMax = Number(axis?.yMax);
    const xToPx = axis?.xToPx;
    const yToPx = axis?.yToPx;
    if (
      !Number.isFinite(xMin) ||
      !Number.isFinite(xMax) ||
      !Number.isFinite(yMin) ||
      !Number.isFinite(yMax) ||
      typeof xToPx !== "function" ||
      typeof yToPx !== "function"
    ) {
      return;
    }

    const xTarget =
      axis?.xTickTarget ?? Math.max(3, Math.min(7, Math.floor(plot.w / 64)));
    const yTarget =
      axis?.yTickTarget ?? Math.max(3, Math.min(7, Math.floor(plot.h / 38)));
    const xTickData = this._buildTicks(xMin, xMax, xTarget);
    const yTickData = this._buildTicks(yMin, yMax, yTarget);
    const xTicks = xTickData.ticks;
    const yTicks = yTickData.ticks;
    if (!xTicks.length && !yTicks.length) return;

    this._withPlotClip(ctx, plot, () => {
      ctx.save();
      ctx.strokeStyle = theme?.grooveForeground || "rgba(220,220,220,0.12)";
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < xTicks.length; i++) {
        const px = xToPx(xTicks[i]);
        if (!Number.isFinite(px)) continue;
        ctx.moveTo(px + 0.5, plot.y + 0.5);
        ctx.lineTo(px + 0.5, plot.y + plot.h + 0.5);
      }
      for (let i = 0; i < yTicks.length; i++) {
        const py = yToPx(yTicks[i]);
        if (!Number.isFinite(py)) continue;
        ctx.moveTo(plot.x + 0.5, py + 0.5);
        ctx.lineTo(plot.x + plot.w + 0.5, py + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    });

    const renderedXTicks = [];
    const renderedYTicks = [];

    ctx.save();
    ctx.strokeStyle = theme?.monitorForeground || "rgba(220,220,220,0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();

    let lastXPx = -Infinity;
    for (let i = 0; i < xTicks.length; i++) {
      const value = xTicks[i];
      const px = xToPx(value);
      if (!Number.isFinite(px)) continue;
      if (px < plot.x - 1 || px > plot.x + plot.w + 1) continue;
      if (px - lastXPx < 26) continue;
      ctx.moveTo(px + 0.5, plot.y + plot.h + 0.5);
      ctx.lineTo(px + 0.5, plot.y + plot.h + 4.5);
      renderedXTicks.push(value);
      lastXPx = px;
    }

    let lastYPx = -Infinity;
    const minYLabelGap = 12;
    for (let i = yTicks.length - 1; i >= 0; i--) {
      const value = yTicks[i];
      const py = yToPx(value);
      if (!Number.isFinite(py)) continue;
      if (py < plot.y - 1 || py > plot.y + plot.h + 1) continue;
      if (py - lastYPx < minYLabelGap) continue;
      ctx.moveTo(plot.x - 3.5, py + 0.5);
      ctx.lineTo(plot.x + 0.5, py + 0.5);
      renderedYTicks.push(value);
      lastYPx = py;
    }

    ctx.stroke();

    ctx.fillStyle = theme?.labelForeground || "rgba(220,220,220,0.8)";
    ctx.font = this._graphFont(8.5);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i < renderedXTicks.length; i++) {
      const value = renderedXTicks[i];
      const px = xToPx(value);
      if (!Number.isFinite(px)) continue;
      ctx.fillText(
        this._formatTickValue(value, xTickData.step),
        px,
        plot.y + plot.h + 6,
      );
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < renderedYTicks.length; i++) {
      const value = renderedYTicks[i];
      const py = yToPx(value);
      if (!Number.isFinite(py)) continue;
      ctx.fillText(
        this._formatTickValue(value, yTickData.step),
        plot.x - 6,
        py,
      );
    }

    ctx.restore();
  }

  _withPlotClip(ctx, plot, renderFn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x, plot.y, Math.max(1, plot.w), Math.max(1, plot.h));
    ctx.clip();
    renderFn();
    ctx.restore();
  }

  _getGraphScratchCanvas(width, height) {
    if (typeof document === "undefined") return null;
    if (!this._statisticsGraphScratch) {
      this._statisticsGraphScratch = document.createElement("canvas");
    }
    const canvas = this._statisticsGraphScratch;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return canvas;
  }

  _getGraphLayerCanvas(mode, width, height) {
    if (typeof document === "undefined") return null;
    if (!this._statisticsGraphLayers) {
      this._statisticsGraphLayers = {};
    }
    const key = String(mode);
    if (!this._statisticsGraphLayers[key]) {
      this._statisticsGraphLayers[key] = document.createElement("canvas");
    }
    const canvas = this._statisticsGraphLayers[key];
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return canvas;
  }

  _renderStatisticsGraph() {
    const canvas = this._statisticsGraphCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const statistics = this.statistics || {};
    const params = this.params || {};
    const rawMode = Math.floor(Number(params.statisticsMode));
    const mode =
      rawMode === 0 || rawMode === 1 || rawMode === 5 || rawMode === 6
        ? rawMode
        : 1;
    const theme = this._resolveGraphTheme(canvas);

    const dpr = Math.max(1, Math.min(2, Number(window.devicePixelRatio) || 1));
    const cssWidth = Math.max(160, Math.floor(canvas.clientWidth || 300));
    const cssHeight = Math.max(110, Math.floor(canvas.clientHeight || 146));
    const pxWidth = Math.max(1, Math.floor(cssWidth * dpr));
    const pxHeight = Math.max(1, Math.floor(cssHeight * dpr));

    if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
      canvas.width = pxWidth;
      canvas.height = pxHeight;
    }

    this.appcore?.analyser?.updatePeriodogram?.(params, 10);

    const renderLayer = (layerMode, renderGraph) => {
      const layerCanvas = this._getGraphLayerCanvas(
        layerMode,
        pxWidth,
        pxHeight,
      );
      if (!layerCanvas) {
        return { canvas: null, caption: "graph unavailable" };
      }

      const layerCtx = layerCanvas.getContext("2d");
      if (!layerCtx) {
        return { canvas: null, caption: "graph unavailable" };
      }

      layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layerCtx.clearRect(0, 0, cssWidth, cssHeight);
      layerCtx.fillStyle = theme.monitorBackground;
      layerCtx.fillRect(0, 0, cssWidth, cssHeight);

      return {
        canvas: layerCanvas,
        caption: renderGraph(layerCtx),
      };
    };

    const layers = {
      1: renderLayer(1, (layerCtx) =>
        this._renderComparativeGraph(
          layerCtx,
          cssWidth,
          cssHeight,
          statistics,
          params,
          theme,
        ),
      ),
      5: renderLayer(5, (layerCtx) =>
        this._renderPeriodogramGraph(
          layerCtx,
          cssWidth,
          cssHeight,
          statistics,
          params,
          theme,
        ),
      ),
      6: renderLayer(6, (layerCtx) =>
        this._renderRecurrenceGraph(
          layerCtx,
          cssWidth,
          cssHeight,
          statistics,
          params,
          theme,
        ),
      ),
    };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = theme.monitorBackground;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    let caption = "collecting samples...";
    if (mode === 0) {
      ctx.fillStyle = theme.monitorForeground;
      ctx.font = this._graphFont(11);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "select Comparative, Periodogram, or Recurrence",
        cssWidth / 2,
        cssHeight / 2,
      );
      caption = "Graph mode: None";
    } else {
      const selected = layers[mode];
      if (selected?.canvas) {
        ctx.drawImage(selected.canvas, 0, 0, cssWidth, cssHeight);
      } else {
        ctx.fillStyle = theme.monitorForeground;
        ctx.font = this._graphFont(11);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("graph unavailable", cssWidth / 2, cssHeight / 2);
      }
      caption = selected?.caption || "graph unavailable";
    }

    if (this._statisticsGraphCaption) {
      this._statisticsGraphCaption.textContent = caption;
    }
  }

  _renderComparativeGraph(ctx, w, h, statistics, params, theme) {
    const analyser = this.appcore?.analyser;
    const rows =
      analyser?.getActiveSegment?.() ||
      (Array.isArray(statistics?.series) ? statistics.series : []);

    const xKey = String(params?.graphX || "m");
    const yKey = String(params?.graphY || "g");
    const xIndex = this._resolveStatIndex(statistics, xKey);
    const yIndex = this._resolveStatIndex(statistics, yKey);
    if (xIndex < 0 || yIndex < 0) {
      ctx.fillStyle = theme.monitorForeground;
      ctx.font = this._graphFont(11);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("invalid axis selection", w / 2, h / 2);
      return "Comparative Graph | invalid axis";
    }

    const pairs = this._extractGraphPairs(rows, xIndex, yIndex);
    if (pairs.length < 2) {
      ctx.fillStyle = theme.monitorForeground;
      ctx.font = this._graphFont(11);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("collecting samples...", w / 2, h / 2);
      return `Comparative Graph | ${xKey} vs ${yKey} | samples=${pairs.length}`;
    }

    const plot = this._plotRect(w, h);
    const xValues = pairs.map((p) => p.x);
    const yValues = pairs.map((p) => p.y);
    const shouldScrollX =
      this._isMostlyIncreasing(xValues) &&
      pairs.length > Math.floor(plot.w * 0.6);

    const xRange = this._fitAxisRange(xValues, {
      lowerQuantile: 0.01,
      upperQuantile: 0.99,
      padMinRatio: shouldScrollX ? 0 : 0.03,
      padMaxRatio: 0.1,
      allowScroll: shouldScrollX,
      scrollWindow: Math.max(48, Math.floor(plot.w * 0.95)),
    });
    const yRange = this._fitAxisRange(yValues, {
      lowerQuantile: 0.01,
      upperQuantile: 0.99,
      padMinRatio: 0.04,
      padMaxRatio: 0.1,
    });

    const xMin = xRange.min;
    const xMax = xRange.max;
    const yMin = yRange.min;
    const yMax = yRange.max;
    const xDen = Math.max(1e-12, xMax - xMin);
    const yDen = Math.max(1e-12, yMax - yMin);
    const xToPx = (v) => plot.x + ((v - xMin) / xDen) * plot.w;
    const yToPx = (v) => plot.y + (1 - (v - yMin) / yDen) * plot.h;

    this._renderPlotTicks(ctx, plot, theme, {
      xMin,
      xMax,
      yMin,
      yMax,
      xToPx,
      yToPx,
      xTickTarget: 5,
      yTickTarget: 4,
    });
    this._renderPlotAxes(ctx, plot, theme);

    this._withPlotClip(ctx, plot, () => {
      ctx.strokeStyle = theme.inputForeground;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < pairs.length; i++) {
        const px = xToPx(pairs[i].x);
        const py = yToPx(pairs[i].y);
        if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      const last = pairs[pairs.length - 1];
      const lx = xToPx(last.x);
      const ly = yToPx(last.y);
      if (Number.isFinite(lx) && Number.isFinite(ly)) {
        ctx.fillStyle = theme.inputForeground;
        ctx.beginPath();
        ctx.arc(lx, ly, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.fillStyle = theme.monitorForeground;
    ctx.font = this._graphFont(10);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `${xKey}: ${xRange.rawMin.toFixed(3)} to ${xRange.rawMax.toFixed(3)}`,
      6,
      h - 20,
    );
    ctx.fillText(
      `${yKey}: ${yRange.rawMin.toFixed(3)} to ${yRange.rawMax.toFixed(3)}`,
      6,
      h - 10,
    );

    return `Comparative Graph | ${xKey} vs ${yKey} | samples=${pairs.length}${xRange.scrolled ? " | scrolling" : " | auto-fit"}`;
  }

  _renderPeriodogramGraph(ctx, w, h, statistics, params, theme) {
    const freq = statistics?.psdFreq;
    const psdPrimary = statistics?.psdPrimary;
    const psdSecondary = statistics?.psdSecondary;
    const useWelch =
      statistics?.psdIsWelch !== undefined
        ? statistics.psdIsWelch
        : params?.periodogramUseWelch !== false;

    const count = Math.min(
      Number(freq?.length) || 0,
      Number(psdPrimary?.length) || 0,
      Number(psdSecondary?.length) || Number(psdPrimary?.length) || 0,
    );
    if (!freq || !psdPrimary || count < 2) {
      ctx.fillStyle = theme.monitorForeground;
      ctx.font = this._graphFont(11);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("collecting periodogram samples...", w / 2, h / 2);
      return useWelch
        ? "Periodogram (Welch) | collecting samples"
        : "Periodogram | collecting samples";
    }

    const xValues = [];
    const yValues = [];
    for (let i = 0; i < count; i++) {
      const f = Number(freq[i]);
      const y1 = Number(psdPrimary[i]);
      const y2 = Number(psdSecondary?.[i]);
      if (Number.isFinite(f) && f > 0) {
        xValues.push(f);
      }
      if (Number.isFinite(y1)) yValues.push(y1);
      if (Number.isFinite(y2)) yValues.push(y2);
    }

    if (xValues.length < 2) {
      ctx.fillStyle = theme.monitorForeground;
      ctx.font = this._graphFont(11);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("invalid periodogram data", w / 2, h / 2);
      return "Periodogram | invalid spectrum";
    }

    const xRange = this._fitAxisRange(xValues, {
      lowerQuantile: 0,
      upperQuantile: 1,
      padMinRatio: 0,
      padMaxRatio: 0.08,
    });
    const yRange = this._fitAxisRange(yValues, {
      lowerQuantile: 0.01,
      upperQuantile: 0.995,
      padMinRatio: 0.04,
      padMaxRatio: 0.1,
    });

    let xMin = xRange.min;
    let xMax = xRange.max;
    let yMin = yRange.min;
    let yMax = yRange.max;
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMax <= yMin) {
      yMin = 0;
      yMax = 1;
    }

    const plot = this._plotRect(w, h);
    const xToPx = (v) => plot.x + ((v - xMin) / (xMax - xMin)) * plot.w;
    const yToPx = (v) => plot.y + (1 - (v - yMin) / (yMax - yMin)) * plot.h;

    this._renderPlotTicks(ctx, plot, theme, {
      xMin,
      xMax,
      yMin,
      yMax,
      xToPx,
      yToPx,
      xTickTarget: 4,
      yTickTarget: 4,
    });
    this._renderPlotAxes(ctx, plot, theme);

    const renderCurve = (series, colour) => {
      if (!series) return;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let moved = false;
      for (let i = 0; i < count; i++) {
        const f = Number(freq[i]);
        const p = Number(series[i]);
        if (!Number.isFinite(f) || !Number.isFinite(p)) continue;
        const px = xToPx(f);
        const py = yToPx(p);
        if (!moved) {
          ctx.moveTo(px, py);
          moved = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      if (moved) ctx.stroke();
    };

    this._withPlotClip(ctx, plot, () => {
      renderCurve(psdSecondary, theme.labelForeground);
      renderCurve(psdPrimary, theme.inputForeground);
    });

    ctx.fillStyle = theme.monitorForeground;
    ctx.font = this._graphFont(10);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `${xRange.rawMin.toFixed(2)}-${xRange.rawMax.toFixed(2)} Hz`,
      6,
      h - 20,
    );

    const periodA = Number(statistics?.psdPrimaryPeriod) || 0;
    const periodB = Number(statistics?.psdSecondaryPeriod) || 0;
    const primaryKey = String(
      statistics?.psdPrimaryKey || params?.graphX || "m",
    );
    const secondaryKey = String(
      statistics?.psdSecondaryKey || params?.graphY || "g",
    );
    ctx.fillText(
      `${primaryKey}: ${periodA > 0 ? periodA.toFixed(2) : "-"} μs | ${secondaryKey}: ${periodB > 0 ? periodB.toFixed(2) : "-"} μs`,
      6,
      h - 10,
    );

    return useWelch ? "Periodogram (Welch)" : "Periodogram";
  }

  _renderRecurrenceGraph(ctx, w, h, statistics, params, theme) {
    const analyser = this.appcore?.analyser;
    const rows =
      analyser?.getActiveSegment?.() ||
      (Array.isArray(statistics?.series) ? statistics.series : []);
    if (!Array.isArray(rows) || rows.length < 4) {
      ctx.fillStyle = theme.monitorForeground;
      ctx.font = this._graphFont(11);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("collecting recurrence samples...", w / 2, h / 2);
      return "Recurrence Plot | collecting samples";
    }

    const recurrenceKeys = ["g", "ml", "gl", "vl", "vgl", "rho", "rhog"];
    const indices = recurrenceKeys
      .map((key) => this._resolveStatIndex(statistics, key))
      .filter((idx) => idx >= 0);
    if (indices.length < 2) {
      ctx.fillStyle = theme.monitorForeground;
      ctx.font = this._graphFont(11);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("recurrence features unavailable", w / 2, h / 2);
      return "Recurrence Plot | unavailable";
    }

    const plot = this._plotRect(w, h);
    const matrixSize = Math.max(
      8,
      Math.min(rows.length, Math.floor(Math.min(plot.w, plot.h))),
    );
    const start = Math.max(0, rows.length - matrixSize);
    const vectors = [];

    for (let i = start; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const vector = [];
      let valid = true;
      for (let d = 0; d < indices.length; d++) {
        const value = Number(row[indices[d]]);
        if (!Number.isFinite(value)) {
          valid = false;
          break;
        }
        vector.push(value);
      }
      if (valid) vectors.push(vector);
    }

    const n = vectors.length;
    if (n < 4) {
      ctx.fillStyle = theme.monitorForeground;
      ctx.font = this._graphFont(11);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("collecting recurrence samples...", w / 2, h / 2);
      return "Recurrence Plot | collecting samples";
    }

    const dims = indices.length;
    const mins = new Array(dims).fill(Number.POSITIVE_INFINITY);
    const maxs = new Array(dims).fill(Number.NEGATIVE_INFINITY);
    for (let i = 0; i < n; i++) {
      const vector = vectors[i];
      for (let d = 0; d < dims; d++) {
        const value = vector[d];
        if (value < mins[d]) mins[d] = value;
        if (value > maxs[d]) maxs[d] = value;
      }
    }

    const normalised = new Array(n);
    for (let i = 0; i < n; i++) {
      const src = vectors[i];
      const vector = new Array(dims);
      for (let d = 0; d < dims; d++) {
        const den = maxs[d] - mins[d];
        vector[d] = den > 1e-12 ? (src[d] - mins[d]) / den : 0.5;
      }
      normalised[i] = vector;
    }

    const recurrenceScale = Math.max(
      0.05,
      Number(params?.recurrenceThreshold) || 0.2,
    );
    const imageData = ctx.createImageData(n, n);
    const rgba = imageData.data;
    let offset = 0;
    for (let y = 0; y < n; y++) {
      const yVec = normalised[y];
      for (let x = 0; x < n; x++) {
        const xVec = normalised[x];
        let distSq = 0;
        for (let d = 0; d < dims; d++) {
          const delta = xVec[d] - yVec[d];
          distSq += delta * delta;
        }
        const distance = Math.sqrt(distSq) / recurrenceScale;
        const intensity = Math.max(
          0,
          Math.min(1, -0.5 * Math.log(Math.max(distance, 1e-12))),
        );
        const shade = Math.round(intensity * 253);
        rgba[offset] = shade;
        rgba[offset + 1] = shade;
        rgba[offset + 2] = shade;
        rgba[offset + 3] = 255;
        offset += 4;
      }
    }

    const renderSize = Math.max(8, Math.min(plot.w, plot.h));
    const renderX = Math.floor(plot.x + (plot.w - renderSize) * 0.5);
    const renderY = Math.floor(plot.y + (plot.h - renderSize) * 0.5);
    const scratch = this._getGraphScratchCanvas(n, n);
    const scratchCtx = scratch.getContext("2d");
    if (scratchCtx) {
      scratchCtx.putImageData(imageData, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scratch, renderX, renderY, renderSize, renderSize);
      ctx.restore();
    }

    ctx.strokeStyle = theme.grooveForeground;
    ctx.lineWidth = 1;
    ctx.strokeRect(renderX + 0.5, renderY + 0.5, renderSize, renderSize);

    ctx.fillStyle = theme.monitorForeground;
    ctx.font = this._graphFont(10);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`size: ${n} | dims: ${dims}`, 6, h - 20);
    ctx.fillText(`scale: ${recurrenceScale.toFixed(2)}`, 6, h - 10);

    return `Recurrence Plot | samples=${n} | dims=${dims}`;
  }
}

window.StatisticsGraphComponent = window.StatisticsGraphComponent || {};
window.StatisticsGraphComponent.install = function installStatisticsGraphComponent(
  targetClass,
) {
  if (!targetClass || !targetClass.prototype) return;
  for (const name of Object.getOwnPropertyNames(
    StatisticsGraphComponent.prototype,
  )) {
    if (name === "constructor") continue;
    targetClass.prototype[name] = StatisticsGraphComponent.prototype[name];
  }
};
