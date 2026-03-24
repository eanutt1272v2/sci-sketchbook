class Renderer {
  constructor(appcore) {
    this.appcore = appcore;

    this.canvas3D = createGraphics(width, height, WEBGL);
    this.terrainShader = this.canvas3D.createShader(
      this.appcore.shaders.vert,
      this.appcore.shaders.frag,
    );

    const { size } = this.appcore.terrain;
    this.canvas2D = createImage(size, size);
    this.heightMapTexture = createImage(size, size);

    this.lut = new Uint8ClampedArray(256 * 3);
    this.currentColourMap = "";
    this.textureUpdateIntervalMs = 50;
    this.lastTextureUpdateMs = 0;
    this.textureDirty = true;
    this.lastLegendRange = null;
    this.compositeLegendItems = [
      { l: "Water", cKey: "waterColour" },
      { l: "Sediment", cKey: "sedimentColour" },
      { l: "Flat", cKey: "flatColour" },
      { l: "Steep", cKey: "steepColour" },
    ];
    this.keymapSections = [
      {
        title: "Simulation",
        entries: [
          ["P / Space", "Pause / Resume simulation"],
          ["G / R", "Generate / Reset terrain"],
          ["I / K", "Droplets per frame + / -"],
        ],
      },
      {
        title: "Rendering",
        entries: [
          ["1 / 2", "Switch render method: 2D / 3D"],
          ["O / L", "Toggle stats / legend overlays"],
          ["C", "Cycle colour map (Shift reverse)"],
          ["M", "Cycle surface map (Shift reverse)"],
          ["[ / ]", "Height scale -/+ (Shift large)"],
        ],
      },
      {
        title: "Camera",
        entries: [
          ["WASD / Arrow", "Orbit camera (3D mode)"],
          ["Q / E / - / +", "Zoom camera out / in (3D mode)"],
          ["Mouse Drag / Wheel", "Orbit / zoom camera"],
        ],
      },
      {
        title: "Media",
        entries: [
          ["V", "Start/stop recording"],
          ["F", "Export image"],
          ["U", "Import heightmap"],
          ["Shift+I / Shift+P", "Import / export params (JSON)"],
          ["Shift+U", "Import stats (JSON)"],
          ["Shift+J / Shift+K", "Export stats JSON / CSV"],
          ["Shift+W / Shift+Q", "Export/import world state"],
          ["GUI: Media tab", "All data import/export options"],
        ],
      },
      {
        title: "Reference",
        entries: [
          ["H", "Toggle GUI panel"],
          ["#", "Toggle keymap reference"],
        ],
      },
    ];
  }

  reinitialise() {
    const { size } = this.appcore.terrain;
    this.canvas2D = createImage(size, size);
    this.heightMapTexture = createImage(size, size);
    this.textureDirty = true;
  }

  _adaptTextureInterval(renderCostMs) {
    if (renderCostMs > 32) {
      this.textureUpdateIntervalMs = 100;
      return;
    }

    if (renderCostMs > 24) {
      this.textureUpdateIntervalMs = 80;
      return;
    }

    if (renderCostMs > 16) {
      this.textureUpdateIntervalMs = 66;
      return;
    }

    if (renderCostMs < 10) {
      this.textureUpdateIntervalMs = 40;
      return;
    }

    this.textureUpdateIntervalMs = 50;
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

  _samplePolyMapColour(mapName, t) {
    const map = this.appcore.colourMaps?.[mapName];
    if (!map) return [255, 255, 255];

    const clamped = constrain(t, 0, 1);
    const channels = ["r", "g", "b"];
    const out = [0, 0, 0];

    for (let c = 0; c < 3; c++) {
      const coeffs = map[channels[c]];
      let val = 0;
      for (let i = coeffs.length - 1; i >= 0; i--) {
        val = val * clamped + coeffs[i];
      }
      out[c] = constrain(Math.round(val * 255), 0, 255);
    }

    return out;
  }

  _sampleDeltaDivergentColour(t) {
    const center = 236;
    const a = constrain(t, 0, 1);
    const distance = Math.abs(a - 0.5) * 2;

    let sideColour;
    if (a < 0.5) {
      sideColour = this._samplePolyMapColour("mako", 1 - a * 2);
    } else {
      sideColour = this._samplePolyMapColour("plasma", (a - 0.5) * 2);
    }

    return [
      Math.round(center * (1 - distance) + sideColour[0] * distance),
      Math.round(center * (1 - distance) + sideColour[1] * distance),
      Math.round(center * (1 - distance) + sideColour[2] * distance),
    ];
  }

  generateTextures(is3D) {
    const { params, terrain, camera } = this.appcore;
    const {
      surfaceMap,
      lightDir,
      flatColour,
      steepColour,
      sedimentColour,
      waterColour,
      skyColour,
      specularIntensity,
    } = params;

    const { size, area, heightMap, originalHeightMap, sedimentMap } = terrain;

    if (surfaceMap !== "composite") {
      this.updateLUT(params.colourMap || "viridis");
    }

    const lightMag =
      Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2) || 1;
    const lX = lightDir.x / lightMag;
    const lY = lightDir.y / lightMag;
    const lZ = lightDir.z / lightMag;

    let vX = 0,
      vY = 1,
      vZ = 0;
    if (is3D) {
      const v = camera.getViewDirection();
      vX = v.x;
      vY = v.y;
      vZ = v.z;
    }

    const bounds = this.calculateBounds(surfaceMap);
    let fieldMin = Number.POSITIVE_INFINITY;
    let fieldMax = Number.NEGATIVE_INFINITY;

    this.canvas2D.loadPixels();
    this.heightMapTexture.loadPixels();

    for (let i = 0; i < area; i++) {
      const idx = i << 2;
      const hVal = heightMap[i];

      const hByte = (hVal * 255) | 0;
      this.heightMapTexture.pixels[idx] = hByte;
      this.heightMapTexture.pixels[idx + 1] = hByte;
      this.heightMapTexture.pixels[idx + 2] = hByte;
      this.heightMapTexture.pixels[idx + 3] = 255;

      let r, g, b;

      if (surfaceMap === "composite") {
        const x = i % size;
        const y = (i / size) | 0;
        const normal = terrain.getSurfaceNormal(x, y);

        const dot = normal.x * lX + normal.y * lY + normal.z * lZ;
        const diffuse = Math.max(0, dot);
        const sW = normal.y * 0.5 + 0.5;

        const shR = diffuse + skyColour.r * 0.000588 * sW;
        const shG = diffuse + skyColour.g * 0.000588 * sW;
        const shB = diffuse + skyColour.b * 0.000588 * sW;

        const steep = 1 - normal.y;
        r = (normal.y * flatColour.r + steep * steepColour.r) * shR;
        g = (normal.y * flatColour.g + steep * steepColour.g) * shG;
        b = (normal.y * flatColour.b + steep * steepColour.b) * shB;

        const sed = sedimentMap[i];
        if (sed > 0) {
          const a = Math.min(1, sed * 5);
          r = (1 - a) * r + a * sedimentColour.r * shR;
          g = (1 - a) * g + a * sedimentColour.g * shG;
          b = (1 - a) * b + a * sedimentColour.b * shB;
        }

        const dis = terrain.getDischarge(i);
        if (dis > 0) {
          const a = Math.min(1, dis);
          const s = Math.max(0.3, 1 - dis * 0.25);

          r = (1 - a) * r + a * waterColour.r * s * shR;
          g = (1 - a) * g + a * waterColour.g * s * shG;
          b = (1 - a) * b + a * waterColour.b * s * shB;

          if (is3D) {
            const hX = lX + vX,
              hY = lY + vY,
              hZ = lZ + vZ;
            const hM = Math.sqrt(hX * hX + hY * hY + hZ * hZ) || 1;
            const ndotH = Math.max(
              0,
              (normal.x * hX + normal.y * hY + normal.z * hZ) / hM,
            );
            const spec = Math.pow(ndotH, 120) * (specularIntensity || 255) * a;

            r = Math.min(255, r + spec);
            g = Math.min(255, g + spec);
            b = Math.min(255, b + spec);
          }
        }
      } else {
        let v = 0;
        let rawFieldValue = 0;
        if (surfaceMap === "height") {
          rawFieldValue = hVal;
          v = (hVal - bounds.min) / bounds.range;
        } else if (surfaceMap === "slope") {
          rawFieldValue =
            1 - terrain.getSurfaceNormal(i % size, (i / size) | 0).y;
          v = rawFieldValue;
        } else if (surfaceMap === "discharge") {
          rawFieldValue = terrain.getDischarge(i);
          v = rawFieldValue;
        } else if (surfaceMap === "sediment") {
          rawFieldValue = sedimentMap[i];
          v = (sedimentMap[i] - bounds.min) / bounds.range;
        } else if (surfaceMap === "delta") {
          rawFieldValue = hVal - originalHeightMap[i];
          v = (rawFieldValue - bounds.min) / bounds.range;
        }

        if (Number.isFinite(rawFieldValue)) {
          if (rawFieldValue < fieldMin) fieldMin = rawFieldValue;
          if (rawFieldValue > fieldMax) fieldMax = rawFieldValue;
        }

        const lIdx = constrain((v * 255) | 0, 0, 255) * 3;
        r = this.lut[lIdx];
        g = this.lut[lIdx + 1];
        b = this.lut[lIdx + 2];
      }

      this.canvas2D.pixels[idx] = r;
      this.canvas2D.pixels[idx + 1] = g;
      this.canvas2D.pixels[idx + 2] = b;
      this.canvas2D.pixels[idx + 3] = 255;
    }

    this.canvas2D.updatePixels();
    this.heightMapTexture.updatePixels();

    if (surfaceMap !== "composite") {
      const fallbackMin = Number.isFinite(bounds.min) ? bounds.min : 0;
      const fallbackMax = Number.isFinite(bounds.max)
        ? bounds.max
        : fallbackMin + (Number.isFinite(bounds.range) ? bounds.range : 1);
      this.lastLegendRange = {
        map: surfaceMap,
        min: Number.isFinite(fieldMin) ? fieldMin : fallbackMin,
        max: Number.isFinite(fieldMax) ? fieldMax : fallbackMax,
      };
    } else {
      this.lastLegendRange = null;
    }
  }

  calculateBounds(mode) {
    const { terrain } = this.appcore;

    if (mode === "height") {
      const bounds = terrain.getMapBounds(terrain.heightMap);
      return {
        min: bounds.min,
        max: bounds.max,
        range: bounds.max - bounds.min || 1,
      };
    }

    if (mode === "discharge") {
      const bounds = terrain.getDischargeBounds();
      return {
        min: bounds.min,
        max: bounds.max,
        range: bounds.max - bounds.min || 1,
      };
    }

    if (mode === "sediment") {
      const bounds = terrain.getMapBounds(terrain.sedimentMap);
      return {
        min: bounds.min,
        max: bounds.max,
        range: bounds.max - bounds.min || 1,
      };
    }

    if (mode === "delta") {
      const { area, heightMap, originalHeightMap } = terrain;
      if (!area || !heightMap || !originalHeightMap) {
        return { min: -0.05, max: 0.05, range: 0.1 };
      }

      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < area; i++) {
        const d = heightMap[i] - originalHeightMap[i];
        if (d < min) min = d;
        if (d > max) max = d;
      }

      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return { min: -0.05, max: 0.05, range: 0.1 };
      }

      return { min, max, range: max - min || 1 };
    }

    return { min: 0, max: 1, range: 1 };
  }

  render() {
    const terrain = this.appcore.terrain;
    if (
      !terrain ||
      !terrain.heightMap ||
      !terrain.sedimentMap ||
      !terrain.dischargeMap
    ) {
      if (this.appcore.params.renderMethod === "3D") {
        image(this.canvas3D, 0, 0, width, height);
      } else {
        image(this.canvas2D, 0, 0, width, height);
      }
      this.renderOverlay();
      return;
    }

    const is3D = this.appcore.params.renderMethod === "3D";
    const nowMs = performance.now();
    const shouldUpdateTexture =
      this.textureDirty ||
      (this.appcore.params.running &&
        nowMs - this.lastTextureUpdateMs >= this.textureUpdateIntervalMs);

    if (shouldUpdateTexture) {
      const startMs = performance.now();
      this.generateTextures(is3D);
      const costMs = performance.now() - startMs;
      this.lastTextureUpdateMs = nowMs;
      this.textureDirty = false;
      this._adaptTextureInterval(costMs);
    }

    if (is3D) {
      this.render3D();
    } else {
      this.render2D();
    }

    this.renderOverlay();
  }

  render2D() {
    image(this.canvas2D, 0, 0, width, height);
  }

  render3D() {
    const { canvas3D, terrainShader, heightMapTexture, canvas2D } = this;
    const { terrain, params, camera } = this.appcore;
    const eye = camera.getEyePosition();
    const up = camera.getUpVector();

    canvas3D.background(
      params.skyColour.r,
      params.skyColour.g,
      params.skyColour.b,
    );

    canvas3D.push();
    canvas3D.resetMatrix();
    canvas3D.perspective(PI / 3, width / height, 0.1, 30000);
    canvas3D.camera(eye.x, eye.y, eye.z, 0, 0, 0, up.x, up.y, up.z);

    canvas3D.noStroke();
    canvas3D.shader(terrainShader);
    terrainShader.setUniform("uHeightMap", heightMapTexture);
    terrainShader.setUniform("uTexture", canvas2D);
    terrainShader.setUniform("uHeightScale", params.heightScale);

    const pSize = terrain.size * 2;
    canvas3D.plane(pSize, pSize, terrain.size - 1, terrain.size - 1);
    canvas3D.pop();

    image(canvas3D, 0, 0, width, height);
  }

  renderOverlay() {
    if (this.appcore.params.renderStats) this.renderStats();
    if (this.appcore.params.renderLegend) this.renderLegend();
    if (this.appcore.params.renderKeymapRef) this.renderKeymapRef();
  }

  renderStats() {
    const { statistics, params } = this.appcore;
    const fmt = (value, fixed = 3) => {
      const n = Number(value) || 0;
      const abs = Math.abs(n);
      if (abs > 0 && abs < Math.pow(10, -fixed)) {
        const [mantissa, exponent] = n.toExponential(2).split("e");
        return `${mantissa}e^${Number(exponent)}`;
      }
      return n.toFixed(fixed);
    };
    const lines = [
      `FPS=${fmt(statistics.fps, 1)} [Hz]`,
      `Sim Time=${fmt(statistics.simulationTime, 1)} [s]`,
      `Frame=${Math.round(statistics.frameCounter)} [frame]`,
      `Running: ${params.running ? "true" : "false"}`,
      `Grid Size=${Math.round(params.terrainSize)} [cells]`,
      `Droplets Per Frame=${Math.round(params.dropletsPerFrame)} [drops/frame]`,
      `Render Mode: ${params.renderMethod}`,
      `Surface Map: ${params.surfaceMap}`,
      `Colour Map: ${params.colourMap}`,
      `Elevation Mean=${fmt(statistics.avgElevation, 3)} [height]`,
      `Elevation Std Dev=${fmt(statistics.elevationStdDev, 3)} [height]`,
      `Elevation Min=${fmt(statistics.heightBounds.min, 3)} [height]`,
      `Elevation Max=${fmt(statistics.heightBounds.max, 3)} [height]`,
      `Rugosity=${fmt(statistics.rugosity, 3)} [index]`,
      `Slope Complexity=${fmt(statistics.slopeComplexity, 3)} [index]`,
      `Water Total=${fmt(statistics.totalWater, 2)} [volume]`,
      `Active Water Cells=${fmt(statistics.activeWaterCover, 2)} [cells]`,
      `Comp Water=${fmt(statistics.compositeWaterCoveragePct, 1)} [%]`,
      `Comp Sediment=${fmt(statistics.compositeSedimentCoveragePct, 1)} [%]`,
      `Comp Flat=${fmt(statistics.compositeFlatCoveragePct, 1)} [%]`,
      `Comp Steep=${fmt(statistics.compositeSteepCoveragePct, 1)} [%]`,
      `Hydraulic Residence=${fmt(statistics.hydraulicResidence, 2)} [s]`,
      `Drainage Density=${fmt(statistics.drainageDensity, 2)} [%]`,
      `Discharge Min (norm)=${fmt(statistics.dischargeBounds.min, 3)} [norm]`,
      `Discharge Max (norm)=${fmt(statistics.dischargeBounds.max, 3)} [norm]`,
      `Sediment Total=${fmt(statistics.totalSediment, 2)} [volume]`,
      `Bedrock Total=${fmt(statistics.totalBedrock, 2)} [volume]`,
      `Sediment Flux=${fmt(statistics.sedimentFlux, 3)} [volume/s]`,
      `Erosion Rate=${fmt(statistics.erosionRate, 3)} [volume/s]`,
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
    const { surfaceMap, colourMap } = this.appcore.params;
    const legendTitleByMap = {
      composite: "Composite surface blend",
      height: "Terrain elevation",
      slope: "Slope magnitude",
      discharge: "Water discharge",
      sediment: "Sediment depth",
      delta: "Relative relief (delta)",
    };
    const legendTitle = legendTitleByMap[surfaceMap] || "Surface field";

    if (surfaceMap === "composite") {
      const params = this.appcore.params;
      const s = this.appcore.statistics;
      const metrics = {
        contributionPct: {
          waterColour: Number(s.compositeWaterCoveragePct) || 0,
          sedimentColour: Number(s.compositeSedimentCoveragePct) || 0,
          flatColour: Number(s.compositeFlatCoveragePct) || 0,
          steepColour: Number(s.compositeSteepCoveragePct) || 0,
        },
        meanControls: {
          slope: Number(s.compositeMeanSlopeWeight) || 0,
          sediment: Number(s.compositeMeanSedimentAlpha) || 0,
          discharge: Number(s.compositeMeanWaterAlpha) || 0,
        },
      };
      const anchors = [
        { l: "Water", cKey: "waterColour", t: 0.1 },
        { l: "Sediment", cKey: "sedimentColour", t: 0.34 },
        { l: "Flat", cKey: "flatColour", t: 0.66 },
        { l: "Steep", cKey: "steepColour", t: 0.9 },
      ];

      const x = width - 20;
      const y1 = 20;
      const y2 = height - 20;
      const w = 15;
      const h = y2 - y1;

      const grad = drawingContext.createLinearGradient(0, y1, 0, y2);
      const stops = anchors
        .map((anchor) => ({ stop: 1 - anchor.t, cKey: anchor.cKey }))
        .sort((a, b) => a.stop - b.stop);

      const firstColour = params[stops[0].cKey];
      const lastColour = params[stops[stops.length - 1].cKey];
      grad.addColorStop(
        0,
        `rgb(${firstColour.r}, ${firstColour.g}, ${firstColour.b})`,
      );
      stops.forEach((stop) => {
        const c = params[stop.cKey];
        grad.addColorStop(stop.stop, `rgb(${c.r}, ${c.g}, ${c.b})`);
      });
      grad.addColorStop(
        1,
        `rgb(${lastColour.r}, ${lastColour.g}, ${lastColour.b})`,
      );

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
      anchors.forEach((anchor) => {
        const y = y2 - anchor.t * h;
        const pct = metrics.contributionPct[anchor.cKey] || 0;
        text(`${anchor.l} ${pct.toFixed(1)}%`, x - w - 6, y);
        stroke(255, 255, 255, 150);
        strokeWeight(1);
        line(x - w - 3, y, x - w, y);
      });

      noStroke();
      fill(255);
      push();
      translate(x + w * 0.5, y1 + h * 0.5);
      rotate(-HALF_PI);
      textAlign(CENTER, CENTER);
      textSize(12);
      text(legendTitle, 0, 0);
      pop();

      pop();
      return;
    }

    const x = width - 20;
    const y1 = 20;
    const y2 = height - 20;
    const w = 15;
    const h = y2 - y1;

    const grad = drawingContext.createLinearGradient(0, y1, 0, y2);
    this.updateLUT(colourMap || "viridis");
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

    fill(255);
    noStroke();
    textSize(11);
    textAlign(RIGHT, CENTER);

    const b =
      this.lastLegendRange && this.lastLegendRange.map === surfaceMap
        ? {
            min: this.lastLegendRange.min,
            max: this.lastLegendRange.max,
            range: this.lastLegendRange.max - this.lastLegendRange.min,
          }
        : this.calculateBounds(surfaceMap);
    const safeRange = Number.isFinite(b.range) && b.range !== 0 ? b.range : 1;
    const minV = Number.isFinite(b.min) ? b.min : 0;

    const labels = [
      { v: minV + safeRange * 1.0, y: y1 },
      { v: minV + safeRange * 0.75, y: y1 + h * 0.25 },
      { v: minV + safeRange * 0.5, y: y1 + h * 0.5 },
      { v: minV + safeRange * 0.25, y: y1 + h * 0.75 },
      { v: minV, y: y2 },
    ];

    labels.forEach((l) => {
      noStroke();
      text(l.v.toFixed(3), x - w - 6, l.y);
      stroke(255, 255, 255, 150);
      strokeWeight(1);
      line(x - w - 3, l.y, x - w, l.y);
    });

    noStroke();
    fill(255);
    push();
    translate(x + w * 0.5, y1 + h * 0.5);
    rotate(-HALF_PI);
    textAlign(CENTER, CENTER);
    textSize(12);
    text(legendTitle, 0, 0);
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

    let col = 0;
    let cx = x;
    let cy = y;

    for (const section of this.keymapSections) {
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

  resize() {
    const s = min(windowWidth, windowHeight);
    if (this.canvas3D) {
      this.canvas3D.resizeCanvas(s, s);
    }
    this.textureDirty = true;
  }

  dispose() {
    if (this.canvas3D && typeof this.canvas3D.remove === "function") {
      this.canvas3D.remove();
    }
    this.canvas3D = null;
    this.canvas2D = null;
    this.heightMapTexture = null;
    this.calcPanelImage = null;
  }
}
