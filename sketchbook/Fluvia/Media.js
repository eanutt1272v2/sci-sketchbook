class Media {
  constructor(appcore) {
    this.appcore = appcore;

    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;

    this.importInput = this._createHiddenInput("image/*", (file) =>
      this.handleHeightmapImport(file),
    );
    this.dataImportInput = this._createHiddenInput(
      ".json,application/json,text/plain",
      (file) => {
        if (this.pendingDataImportHandler) {
          this.pendingDataImportHandler(file);
          this.pendingDataImportHandler = null;
        }
      },
    );
    this.pendingDataImportHandler = null;
  }

  _createHiddenInput(accept, onFile) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) onFile(file);
      input.value = "";
    });
    document.body.appendChild(input);
    return input;
  }

  openImportDialog() {
    this.importInput.value = "";
    this.importInput.click();
  }

  openDataImportDialog(handler) {
    this.pendingDataImportHandler = handler;
    this.dataImportInput.value = "";
    this.dataImportInput.click();
  }

  handleHeightmapImport(file) {
    if (!file?.type.startsWith("image")) {
      console.error("[Fluvia] Import failed: provided file is not an image");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgSrc = event.target.result;

      loadImage(
        imgSrc,
        (img) => {
          try {
            const { terrain } = this.appcore;
            const {
              size,
              area,
              heightMap,
              bedrockMap,
              originalHeightMap,
              sedimentMap,
            } = terrain;

            if (!img) throw new Error("[Fluvia] loadImage returned null");

            img.resize(size, size);
            img.loadPixels();

            const { pixels } = img;
            if (!pixels || pixels.length < area * 4)
              throw new Error("[Fluvia] Pixel buffer incomplete");

            for (let i = 0; i < area; i++) {
              const idx = i << 2;
              const brightness =
                (0.2126 * pixels[idx] +
                  0.7152 * pixels[idx + 1] +
                  0.0722 * pixels[idx + 2]) /
                255;

              heightMap[i] = bedrockMap[i] = originalHeightMap[i] = brightness;
              sedimentMap[i] = 0;
            }

            terrain.reset();
            this.appcore.refreshGUI();
            console.log(`[Fluvia] Heightmap imported: ${size}x${size}`);
          } catch (err) {
            console.error("[Fluvia] Import failed during processing:", err);
          }
        },
        (err) => console.error("[Fluvia] Import failed: load error", err),
      );
    };

    reader.readAsDataURL(file);
  }

  startRecording() {
    if (this.isRecording) return;

    const sourceCanvas = _renderer?.elt;
    if (!sourceCanvas) return console.error("[Fluvia] No valid canvas found");

    this.recordedChunks = [];

    const types = ["video/webm;codecs=vp8", "video/mp4", "video/webm"];
    const supportedType = types.find((t) => MediaRecorder.isTypeSupported(t));

    if (!supportedType) return console.error("[Fluvia] No supported video format found");

    try {
      const stream = sourceCanvas.captureStream(60);
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedType,
        videoBitsPerSecond: 8000000,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.recordedChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: supportedType });
        const ext = supportedType.includes("mp4") ? "mp4" : "webm";
        this._triggerDownload(
          URL.createObjectURL(blob),
          this._getFilename(ext),
        );
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.appcore.refreshGUI();
      console.log(`[Fluvia] Recording: ${supportedType}`);
    } catch (err) {
      console.error("[Fluvia] Recording failed:", err);
      this.stopRecording();
    }
  }

  stopRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;
    this.mediaRecorder.stop();
    this.isRecording = false;
    this.recordedChunks = [];
    this.appcore.refreshGUI();
  }

  exportImage() {
    const { imageFormat } = this.appcore.params;
    try {
      save(_renderer, this._getFilename(imageFormat));
      console.log("[Fluvia] Exported image");
    } catch (err) {
      console.error(`[Fluvia] Export failed: ${err}`);
    }
  }

  exportParamsJSON() {
    const payload = {
      metadata: this.appcore.metadata,
      params: this._serialiseParams(this.appcore.params),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("params.json"));
    console.log("[Fluvia] Exported params JSON");
  }

  importParamsJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (!data || typeof data !== "object" || !data.params) {
          throw new Error("[Fluvia] Invalid params JSON payload");
        }

        const oldSize = this.appcore.params.terrainSize;
        const incoming = data.params;
        const target = this.appcore.params;

        const scalarKeys = [
          "running",
          "dropletsPerFrame",
          "maxAge",
          "minVolume",
          "terrainSize",
          "noiseScale",
          "noiseOctaves",
          "amplitudeFalloff",
          "sedimentErosionRate",
          "bedrockErosionRate",
          "depositionRate",
          "evaporationRate",
          "precipitationRate",
          "entrainment",
          "gravity",
          "momentumTransfer",
          "learningRate",
          "maxHeightDiff",
          "settlingRate",
          "renderStats",
          "renderLegend",
          "renderKeymapRef",
          "renderMethod",
          "heightScale",
          "surfaceMap",
          "colourMap",
          "specularIntensity",
          "imageFormat",
        ];

        for (const key of scalarKeys) {
          if (key in incoming) target[key] = incoming[key];
        }

        this._assignColour(incoming, target, "skyColour");
        this._assignColour(incoming, target, "steepColour");
        this._assignColour(incoming, target, "flatColour");
        this._assignColour(incoming, target, "sedimentColour");
        this._assignColour(incoming, target, "waterColour");
        this._assignVec3(incoming, target, "lightDir");

        if (target.terrainSize !== oldSize) {
          this.appcore.reinitialise();
        }

        this.appcore.refreshGUI();
        console.log("[Fluvia] Imported params JSON");
      });
    });
  }

  exportStatisticsJSON() {
    const payload = {
      metadata: this.appcore.metadata,
      statistics: this._serialiseStatistics(),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("stats.json"));
    console.log("[Fluvia] Exported stats JSON");
  }

  exportStatisticsCSV() {
    const stats = this.appcore.statistics;
    const rows = [["key", "value"]];
    const scalarKeys = [
      "fps",
      "frameCounter",
      "simulationTime",
      "avgElevation",
      "elevationStdDev",
      "totalWater",
      "totalSediment",
      "totalBedrock",
      "peakDischarge",
      "activeWaterCover",
      "drainageDensity",
      "hydraulicResidence",
      "rugosity",
      "slopeComplexity",
      "sedimentFlux",
      "erosionRate",
    ];

    for (const k of scalarKeys) rows.push([k, Number(stats[k]) || 0]);
    rows.push(["heightBounds.min", Number(stats.heightBounds?.min) || 0]);
    rows.push(["heightBounds.max", Number(stats.heightBounds?.max) || 0]);
    rows.push(["sedimentBounds.min", Number(stats.sedimentBounds?.min) || 0]);
    rows.push(["sedimentBounds.max", Number(stats.sedimentBounds?.max) || 0]);
    rows.push(["dischargeBounds.min", Number(stats.dischargeBounds?.min) || 0]);
    rows.push(["dischargeBounds.max", Number(stats.dischargeBounds?.max) || 0]);

    const csv = rows.map((r) => `${r[0]},${r[1]}`).join("\n");
    this._downloadText(csv, this._getFilename("stats.csv"), "text/csv");
    console.log("[Fluvia] Exported stats CSV");
  }

  exportWorldJSON() {
    const { terrain } = this.appcore;
    if (!terrain.heightMap) {
      console.warn(
        "[Fluvia] Cannot export world while worker holds terrain buffers.",
      );
      return;
    }
    const payload = {
      metadata: this.appcore.metadata,
      terrainSize: terrain.size,
      maps: {
        heightMap: Array.from(terrain.heightMap),
        originalHeightMap: Array.from(terrain.originalHeightMap),
        bedrockMap: Array.from(terrain.bedrockMap),
        sedimentMap: Array.from(terrain.sedimentMap),
        dischargeMap: Array.from(terrain.dischargeMap),
        dischargeTrack: Array.from(terrain.dischargeTrack),
        momentumX: Array.from(terrain.momentumX),
        momentumY: Array.from(terrain.momentumY),
        momentumXTrack: Array.from(terrain.momentumXTrack),
        momentumYTrack: Array.from(terrain.momentumYTrack),
      },
      exportedAt: new Date().toISOString(),
    };

    this._downloadJSON(payload, this._getFilename("world.json"));
    console.log(`[Fluvia] Exported world JSON: size=${terrain.size}`);
  }

  importWorldJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (
          !data ||
          typeof data !== "object" ||
          !data.maps ||
          !data.terrainSize
        ) {
          throw new Error("[Fluvia] Invalid world JSON payload");
        }

        const requiredMaps = [
          "heightMap",
          "originalHeightMap",
          "bedrockMap",
          "sedimentMap",
          "dischargeMap",
          "dischargeTrack",
          "momentumX",
          "momentumY",
          "momentumXTrack",
          "momentumYTrack",
        ];
        for (const key of requiredMaps) {
          if (!Array.isArray(data.maps[key])) {
            throw new Error(`[Fluvia] Invalid world JSON: missing maps.${key}`);
          }
        }

        const incomingSize = Number(data.terrainSize);
        if (!Number.isFinite(incomingSize) || incomingSize <= 0) {
          throw new Error("[Fluvia] Invalid world JSON: invalid terrainSize");
        }

        this.appcore._terminateWorker();
        if (incomingSize !== this.appcore.params.terrainSize) {
          this.appcore.params.terrainSize = incomingSize;
          this.appcore.terrain = new Terrain(this.appcore);
        } else {
          this.appcore._reallocTerrainBuffers();
        }

        const { terrain } = this.appcore;
        this._copyArrayInto(terrain.heightMap, data.maps.heightMap);
        this._copyArrayInto(
          terrain.originalHeightMap,
          data.maps.originalHeightMap,
        );
        this._copyArrayInto(terrain.bedrockMap, data.maps.bedrockMap);
        this._copyArrayInto(terrain.sedimentMap, data.maps.sedimentMap);
        this._copyArrayInto(terrain.dischargeMap, data.maps.dischargeMap);
        this._copyArrayInto(terrain.dischargeTrack, data.maps.dischargeTrack);
        this._copyArrayInto(terrain.momentumX, data.maps.momentumX);
        this._copyArrayInto(terrain.momentumY, data.maps.momentumY);
        this._copyArrayInto(terrain.momentumXTrack, data.maps.momentumXTrack);
        this._copyArrayInto(terrain.momentumYTrack, data.maps.momentumYTrack);

        terrain.updateBoundsCache();
        this.appcore.analyser.reinitialise();
        this.appcore._initWorker();
        this.appcore.refreshGUI();
        console.log(`[Fluvia] Imported world JSON: size=${terrain.size}`);
      });
    });
  }

  exportHeightmapPNG() {
    const { terrain } = this.appcore;
    if (!terrain || !terrain.heightMap) return;

    const size = terrain.size;
    const bounds = terrain.getMapBounds(terrain.heightMap);
    const range = Math.max(1e-9, bounds.max - bounds.min);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(size, size);
    const pixels = imageData.data;

    for (let i = 0; i < terrain.heightMap.length; i++) {
      const v = (terrain.heightMap[i] - bounds.min) / range;
      const g = Math.max(0, Math.min(255, Math.round(v * 255)));
      const p = i * 4;
      pixels[p] = g;
      pixels[p + 1] = g;
      pixels[p + 2] = g;
      pixels[p + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error("[Fluvia] Failed to export heightmap PNG blob");
        return;
      }
      this._triggerDownload(
        URL.createObjectURL(blob),
        this._getFilename("heightmap.png"),
      );
      console.log(`[Fluvia] Exported heightmap PNG: ${size}x${size}`);
    }, "image/png");
  }

  _copyArrayInto(target, source) {
    if (!target || !Array.isArray(source)) {
      throw new Error("[Fluvia] Invalid map buffer during world import");
    }
    if (source.length !== target.length) {
      throw new Error(
        `[Fluvia] Invalid map length during world import: expected ${target.length}, got ${source.length}`,
      );
    }

    for (let i = 0; i < target.length; i++) {
      const value = Number(source[i]);
      target[i] = Number.isFinite(value) ? value : 0;
    }
  }

  _assignColour(srcRoot, dstRoot, key) {
    if (!srcRoot[key] || typeof srcRoot[key] !== "object") return;
    const s = srcRoot[key];
    if (!dstRoot[key]) dstRoot[key] = { r: 0, g: 0, b: 0 };
    dstRoot[key].r = Number(s.r) || 0;
    dstRoot[key].g = Number(s.g) || 0;
    dstRoot[key].b = Number(s.b) || 0;
  }

  _assignVec3(srcRoot, dstRoot, key) {
    if (!srcRoot[key] || typeof srcRoot[key] !== "object") return;
    const s = srcRoot[key];
    if (!dstRoot[key]) dstRoot[key] = { x: 0, y: 0, z: 0 };
    dstRoot[key].x = Number(s.x) || 0;
    dstRoot[key].y = Number(s.y) || 0;
    dstRoot[key].z = Number(s.z) || 0;
  }

  _serialiseParams(params) {
    return JSON.parse(JSON.stringify(params));
  }

  _serialiseStatistics() {
    const s = this.appcore.statistics;
    return {
      ...s,
      heightHistogram: Array.from(s.heightHistogram || []),
      normHistogram: Array.from(s.normHistogram || []),
      heightBounds: { ...(s.heightBounds || { min: 0, max: 0 }) },
      sedimentBounds: { ...(s.sedimentBounds || { min: 0, max: 0 }) },
      dischargeBounds: { ...(s.dischargeBounds || { min: 0, max: 0 }) },
    };
  }

  _readJSONFile(file, onSuccess) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onSuccess(parsed);
      } catch (err) {
        console.error("[Fluvia] JSON import failed:", err);
      }
    };
    reader.onerror = () => console.error("[Fluvia] File read failed");
    reader.readAsText(file);
  }

  _downloadJSON(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    this._triggerDownload(URL.createObjectURL(blob), filename);
  }

  _downloadText(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    this._triggerDownload(URL.createObjectURL(blob), filename);
  }

  _triggerDownload(url, filename) {
    const anchor = document.createElement("a");
    anchor.style.display = "none";
    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 100);
  }

  _getFilename(extension) {
    const { terrainSize, surfaceMap, renderMethod } = this.appcore.params;
    const { name, version } = this.appcore.metadata;
    const ts = Date.now();

    return `${name}_${version}_${renderMethod}_${surfaceMap}_${terrainSize}_${ts}.${extension}`;
  }
}
