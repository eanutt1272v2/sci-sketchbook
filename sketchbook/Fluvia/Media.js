class Media {
  constructor(appcore) {
    this.appcore = appcore;
    this.logTag = "[Fluvia][Media]";
    this._heightmapExportDeferred = false;
    this._worldExportDeferred = false;

    this.mediaRecorder = null;
    this.recordingStream = null;
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

  _logInfo(message, ...rest) {
    console.log(`${this.logTag} ${message}`, ...rest);
  }

  _logWarn(message, ...rest) {
    console.warn(`${this.logTag} ${message}`, ...rest);
  }

  _logError(message, ...rest) {
    console.error(`${this.logTag} ${message}`, ...rest);
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
      this._logError("Heightmap import failed: provided file is not an image");
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
            this._logInfo(`Heightmap imported: ${size}x${size}`);
          } catch (err) {
            this._logError("Heightmap import failed during processing:", err);
          }
        },
        (err) => this._logError("Heightmap import failed: load error", err),
      );
    };

    reader.readAsDataURL(file);
  }

  startRecording() {
    if (this.isRecording) return;

    const sourceCanvas = globalThis._renderer?.elt;
    if (!sourceCanvas) {
      this._logError("No valid canvas found");
      return;
    }

    this.recordedChunks = [];

    const types = ["video/webm;codecs=vp8", "video/mp4", "video/webm"];
    const supportedType = types.find((t) => MediaRecorder.isTypeSupported(t));

    if (!supportedType) {
      this._logError("No supported video format found");
      return;
    }

    try {
      const captureFps = this._getRecordingFPS();
      const bitrateBps = this._getRecordingBitrateBps();
      const stream = sourceCanvas.captureStream(captureFps);
      this.recordingStream = stream;
      const options = { mimeType: supportedType };
      if (bitrateBps > 0) {
        options.videoBitsPerSecond = bitrateBps;
      }
      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.recordedChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const chunks = this.recordedChunks.slice();
        this.recordedChunks = [];
        const blob = new Blob(chunks, { type: supportedType });
        const ext = supportedType.includes("mp4") ? "mp4" : "webm";
        this._triggerDownload(
          URL.createObjectURL(blob),
          this._getFilename(ext),
        );

        this._releaseRecordingResources();
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.appcore.refreshGUI();
      const bitrateMbps = bitrateBps > 0 ? bitrateBps / 1e6 : 0;
      this._logInfo(
        `Recording started: ${supportedType}, fps=${captureFps}, bitrate=${bitrateMbps.toFixed(2)}Mbps`,
      );
    } catch (err) {
      this._logError("Recording failed:", err);
      this.stopRecording();
    }
  }

  stopRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;
    this.mediaRecorder.stop();
    this.isRecording = false;
    this.appcore.refreshGUI();
  }

  _releaseRecordingResources() {
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.onerror = null;
      this.mediaRecorder = null;
    }

    if (this.recordingStream) {
      const tracks = this.recordingStream.getTracks();
      for (const track of tracks) {
        track.stop();
      }
      this.recordingStream = null;
    }
  }

  dispose() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this._releaseRecordingResources();
    this.recordedChunks = [];
    this.pendingDataImportHandler = null;

    const inputs = [this.importInput, this.dataImportInput];
    for (const input of inputs) {
      if (input && input.parentNode === document.body) {
        document.body.removeChild(input);
      }
    }

    this.importInput = null;
    this.dataImportInput = null;
  }

  exportImage() {
    const { imageFormat } = this.appcore.params;
    try {
      save(globalThis._renderer, this._getFilename(imageFormat));
      this._logInfo("Image exported");
    } catch (err) {
      this._logError("Image export failed:", err);
    }
  }

  exportParamsJSON() {
    const payload = {
      format: "simpipe.params",
      metadata: this.appcore.metadata,
      params: this._serialiseParams(this.appcore.params),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("params.json"));
    this._logInfo("Params JSON exported");
  }

  importParamsJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (!data || typeof data !== "object" || !data.params) {
          throw new Error("[Fluvia] Invalid params JSON payload");
        }
        if (data.format !== "simpipe.params") {
          throw new Error("[Fluvia] Invalid params JSON format version");
        }

        this._applyMetadataSnapshot(data.metadata);

        const oldSize = this.appcore.params.terrainSize;
        const incoming = data.params;
        const target = this.appcore.params;
        this._applyParamsSnapshot(incoming);

        if (target.terrainSize !== oldSize) {
          this.appcore.reinitialise();
        }

        this.appcore.refreshGUI();
        this._logInfo("Params JSON imported");
      });
    });
  }

  exportStatisticsJSON() {
    const payload = {
      format: "simpipe.stats",
      metadata: this.appcore.metadata,
      statistics: this._serialiseStatistics(),
      series: [],
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("stats.json"));
    this._logInfo("Stats JSON exported");
  }

  importStatisticsJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (
          !data ||
          typeof data !== "object" ||
          data.format !== "simpipe.stats" ||
          !data.statistics ||
          typeof data.statistics !== "object"
        ) {
          throw new Error("[Fluvia] Invalid stats JSON payload");
        }

        this._applyMetadataSnapshot(data.metadata);
        this._applyStatisticsSnapshot(data.statistics);
        this.appcore.refreshGUI();
        this._logInfo("Stats JSON imported");
      });
    });
  }

  exportStatisticsCSV() {
    const metadataJson = JSON.stringify(this.appcore.metadata || {});
    const exportedAt = new Date().toISOString();
    const rows = [["key", "value"]];
    this._flattenToRows(this._serialiseStatistics(), "", rows);

    const csv =
      `# exportedAt: ${exportedAt}\n` +
      `# metadata: ${metadataJson}\n` +
      rows
        .map((r) => `${this._toCSVCell(r[0])},${this._toCSVCell(r[1])}`)
        .join("\n");
    this._downloadText(csv, this._getFilename("stats.csv"), "text/csv");
    this._logInfo("Stats CSV exported");
  }

  exportWorldJSON() {
    const { terrain } = this.appcore;
    if (!terrain.heightMap) {
      if (!this._worldExportDeferred) {
        this._worldExportDeferred = true;
        if (typeof this.appcore._queueAction === "function") {
          this.appcore._queueAction("exportWorldJSON", () => {
            this._worldExportDeferred = false;
            this.exportWorldJSON();
          });
          this._logInfo(
            "World export deferred until worker returns terrain buffers",
          );
        } else {
          this._worldExportDeferred = false;
          this._logWarn(
            "Cannot export world while worker holds terrain buffers",
          );
        }
      }
      return;
    }

    this._worldExportDeferred = false;

    const payload = {
      format: "simpipe.world",
      metadata: this.appcore.metadata,
      params: this._serialiseParams(this.appcore.params),
      statistics: this._serialiseStatistics(),
      series: [],
      world: {
        terrainSize: terrain.size,
        maps: {
          heightMap: this._encodeWorldMap(terrain.heightMap),
          originalHeightMap: this._encodeWorldMap(terrain.originalHeightMap),
          bedrockMap: this._encodeWorldMap(terrain.bedrockMap),
          sedimentMap: this._encodeWorldMap(terrain.sedimentMap),
          dischargeMap: this._encodeWorldMap(terrain.dischargeMap),
          dischargeTrack: this._encodeWorldMap(terrain.dischargeTrack),
          momentumX: this._encodeWorldMap(terrain.momentumX),
          momentumY: this._encodeWorldMap(terrain.momentumY),
          momentumXTrack: this._encodeWorldMap(terrain.momentumXTrack),
          momentumYTrack: this._encodeWorldMap(terrain.momentumYTrack),
        },
      },
      exportedAt: new Date().toISOString(),
    };

    this._downloadJSON(payload, this._getFilename("world.json"));
    this._logInfo(`World JSON exported: size=${terrain.size}`);
  }

  importWorldJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (
          !data ||
          typeof data !== "object" ||
          data.format !== "simpipe.world" ||
          !data.params ||
          !data.statistics ||
          !Array.isArray(data.series) ||
          !data.world ||
          !data.world.maps ||
          !data.world.terrainSize
        ) {
          throw new Error("[Fluvia] Invalid world JSON payload");
        }

        this._applyMetadataSnapshot(data.metadata);

        const world = data.world;
        const maps = world.maps;

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
          if (!this._isEncodedWorldMap(maps[key])) {
            throw new Error(`[Fluvia] Invalid world JSON: missing maps.${key}`);
          }
        }

        const incomingSize = Number(world.terrainSize);
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
        this._copyArrayInto(
          terrain.heightMap,
          this._decodeWorldMap(maps.heightMap, terrain.heightMap.length),
        );
        this._copyArrayInto(
          terrain.originalHeightMap,
          this._decodeWorldMap(
            maps.originalHeightMap,
            terrain.originalHeightMap.length,
          ),
        );
        this._copyArrayInto(
          terrain.bedrockMap,
          this._decodeWorldMap(maps.bedrockMap, terrain.bedrockMap.length),
        );
        this._copyArrayInto(
          terrain.sedimentMap,
          this._decodeWorldMap(maps.sedimentMap, terrain.sedimentMap.length),
        );
        this._copyArrayInto(
          terrain.dischargeMap,
          this._decodeWorldMap(maps.dischargeMap, terrain.dischargeMap.length),
        );
        this._copyArrayInto(
          terrain.dischargeTrack,
          this._decodeWorldMap(
            maps.dischargeTrack,
            terrain.dischargeTrack.length,
          ),
        );
        this._copyArrayInto(
          terrain.momentumX,
          this._decodeWorldMap(maps.momentumX, terrain.momentumX.length),
        );
        this._copyArrayInto(
          terrain.momentumY,
          this._decodeWorldMap(maps.momentumY, terrain.momentumY.length),
        );
        this._copyArrayInto(
          terrain.momentumXTrack,
          this._decodeWorldMap(
            maps.momentumXTrack,
            terrain.momentumXTrack.length,
          ),
        );
        this._copyArrayInto(
          terrain.momentumYTrack,
          this._decodeWorldMap(
            maps.momentumYTrack,
            terrain.momentumYTrack.length,
          ),
        );

        terrain.updateBoundsCache();
        this.appcore.analyser.reinitialise();
        this._applyParamsSnapshot(data.params, {
          forceTerrainSize: incomingSize,
        });
        this._applyStatisticsSnapshot(data.statistics);
        this.appcore._initWorker();
        this.appcore.refreshGUI();
        this._logInfo(`World JSON imported: size=${terrain.size}`);
      });
    });
  }

  exportHeightmapPNG() {
    const { terrain } = this.appcore;
    if (!terrain || !terrain.heightMap) {
      if (!this._heightmapExportDeferred) {
        this._heightmapExportDeferred = true;
        if (typeof this.appcore._queueAction === "function") {
          this.appcore._queueAction("exportHeightmapPNG", () => {
            this._heightmapExportDeferred = false;
            this.exportHeightmapPNG();
          });
          this._logInfo(
            "Heightmap export deferred until worker returns terrain buffers",
          );
        } else {
          this._heightmapExportDeferred = false;
          this._logWarn(
            "Cannot export heightmap while worker holds terrain buffers",
          );
        }
      }
      return;
    }

    this._heightmapExportDeferred = false;

    setTimeout(() => this._exportHeightmapPNGNow(), 0);
  }

  _exportHeightmapPNGNow() {
    const { terrain } = this.appcore;
    if (!terrain || !terrain.heightMap) {
      this._logWarn("Heightmap export aborted: terrain buffers unavailable");
      return;
    }

    const size = terrain.size;
    const statsBounds = this.appcore?.statistics?.heightBounds;
    const statsMin = Number(statsBounds?.min);
    const statsMax = Number(statsBounds?.max);
    const bounds =
      Number.isFinite(statsMin) && Number.isFinite(statsMax)
        ? { min: statsMin, max: statsMax }
        : terrain.getMapBounds(terrain.heightMap);
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
        this._logError("Failed to export heightmap PNG blob");
        return;
      }
      this._triggerDownload(
        URL.createObjectURL(blob),
        this._getFilename("heightmap.png"),
      );
      this._logInfo(`Heightmap PNG exported: ${size}x${size}`);
    }, "image/png");
  }

  _copyArrayInto(target, source) {
    if (!target || !ArrayBuffer.isView(source)) {
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

  _encodeWorldMap(source) {
    if (!(source instanceof Float32Array)) {
      throw new Error("[Fluvia] Invalid world map during export");
    }

    return {
      encoding: "rle-f32-v1",
      length: source.length,
      data: RLECodec.encodeFloat32Array(source),
    };
  }

  _isEncodedWorldMap(source) {
    return (
      source &&
      typeof source === "object" &&
      source.encoding === "rle-f32-v1" &&
      typeof source.data === "string"
    );
  }

  _decodeWorldMap(source, expectedLength) {
    if (!this._isEncodedWorldMap(source)) {
      throw new Error("[Fluvia] Invalid encoded world map during import");
    }

    const length = Number(source.length);
    if (length !== expectedLength) {
      throw new Error(
        `[Fluvia] Invalid encoded world map length: expected ${expectedLength}, got ${length}`,
      );
    }

    return RLECodec.decodeFloat32Array(source.data, length);
  }

  _applyMetadataSnapshot(metadata) {
    if (!metadata || typeof metadata !== "object") return;
    this.appcore.metadata = JSON.parse(JSON.stringify(metadata));
  }

  _applyParamsSnapshot(incoming, options = {}) {
    if (!incoming || typeof incoming !== "object") return;

    const target = this.appcore.params;
    this._mergeByTargetSchema(target, incoming);

    if (typeof options.forceTerrainSize === "number") {
      target.terrainSize = options.forceTerrainSize;
    }
  }

  _applyStatisticsSnapshot(incoming) {
    if (!incoming || typeof incoming !== "object") return;
    this._mergeByTargetSchema(this.appcore.statistics, incoming);
  }

  _serialiseParams(params) {
    return JSON.parse(JSON.stringify(params));
  }

  _getRecordingFPS() {
    const fps = Number(this.appcore.params?.recordingFPS);
    return Math.max(12, Math.min(120, Math.round(fps || 60)));
  }

  _getRecordingBitrateBps() {
    const mbps = Number(this.appcore.params?.videoBitrateMbps);
    const clampedMbps = Math.max(1, Math.min(64, mbps || 8));
    return Math.round(clampedMbps * 1e6);
  }

  _serialiseStatistics() {
    return this._cloneJSONCompatible(this.appcore.statistics || {});
  }

  _isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  _cloneJSONCompatible(value) {
    if (ArrayBuffer.isView(value)) {
      return Array.from(value);
    }
    if (Array.isArray(value)) {
      return value.map((entry) => this._cloneJSONCompatible(entry));
    }
    if (this._isPlainObject(value)) {
      const out = {};
      for (const [key, entry] of Object.entries(value)) {
        out[key] = this._cloneJSONCompatible(entry);
      }
      return out;
    }
    return value;
  }

  _mergeByTargetSchema(target, incoming) {
    if (!this._isPlainObject(target) || !this._isPlainObject(incoming)) {
      return;
    }

    for (const key of Object.keys(target)) {
      if (!(key in incoming)) continue;

      const sourceValue = incoming[key];
      const targetValue = target[key];

      if (ArrayBuffer.isView(targetValue)) {
        if (!Array.isArray(sourceValue) && !ArrayBuffer.isView(sourceValue)) {
          continue;
        }
        const typed = new targetValue.constructor(targetValue.length);
        const limit = Math.min(typed.length, sourceValue.length || 0);
        for (let i = 0; i < limit; i++) {
          const n = Number(sourceValue[i]);
          typed[i] = Number.isFinite(n) ? n : 0;
        }
        target[key] = typed;
        continue;
      }

      if (Array.isArray(targetValue)) {
        if (Array.isArray(sourceValue)) {
          target[key] = this._cloneJSONCompatible(sourceValue);
        }
        continue;
      }

      if (this._isPlainObject(targetValue)) {
        if (this._isPlainObject(sourceValue)) {
          this._mergeByTargetSchema(targetValue, sourceValue);
        }
        continue;
      }

      if (typeof targetValue === "number") {
        const n = Number(sourceValue);
        if (Number.isFinite(n)) {
          target[key] = n;
        }
        continue;
      }

      if (typeof targetValue === "boolean") {
        target[key] = Boolean(sourceValue);
        continue;
      }

      if (typeof targetValue === "string") {
        target[key] = String(sourceValue);
        continue;
      }

      target[key] = this._cloneJSONCompatible(sourceValue);
    }
  }

  _flattenToRows(value, prefix, rows) {
    if (Array.isArray(value)) {
      rows.push([prefix || "value", JSON.stringify(value)]);
      return;
    }

    if (this._isPlainObject(value)) {
      for (const [key, entry] of Object.entries(value)) {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        this._flattenToRows(entry, nextPrefix, rows);
      }
      return;
    }

    rows.push([prefix || "value", value]);
  }

  _toCSVCell(value) {
    const text = String(value ?? "");
    if (!/[",\n]/.test(text)) {
      return text;
    }
    return `"${text.replace(/"/g, '""')}"`;
  }

  _readJSONFile(file, onSuccess) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onSuccess(parsed);
      } catch (err) {
        this._logError("JSON import failed:", err);
      }
    };
    reader.onerror = () => this._logError("File read failed");
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
