class Media {
  constructor(appcore) {
    this.appcore = appcore;
    this.mediaRecorder = null;
    this.recordingStream = null;
    this.recordedChunks = [];
    this.isRecording = false;

    this.dataImportInput = document.createElement("input");
    this.dataImportInput.type = "file";
    this.dataImportInput.accept = ".json,application/json,text/plain";
    this.dataImportInput.style.display = "none";
    this.dataImportInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file || !this.pendingImportHandler) return;
      this.pendingImportHandler(file);
      this.pendingImportHandler = null;
      this.dataImportInput.value = "";
    });

    this.pendingImportHandler = null;
    document.body.appendChild(this.dataImportInput);
  }

  openDataImportDialog(handler) {
    this.pendingImportHandler = handler;
    this.dataImportInput.value = "";
    this.dataImportInput.click();
  }

  startRecording() {
    if (this.isRecording) return;

    const sourceCanvas = _renderer?.elt;
    if (!sourceCanvas) {
      console.error("[Psi] No valid canvas found");
      return;
    }

    this.recordedChunks = [];
    const types = ["video/webm;codecs=vp8", "video/mp4", "video/webm"];
    const supportedType = types.find((t) => MediaRecorder.isTypeSupported(t));

    if (!supportedType) {
      console.error("[Psi] No supported video format found");
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
      console.log(
        `[Psi] Recording: ${supportedType}, fps=${captureFps}, bitrate=${bitrateMbps.toFixed(2)}Mbps`,
      );
    } catch (err) {
      console.error("[Psi] Recording failed:", err);
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
    this.pendingImportHandler = null;

    if (
      this.dataImportInput &&
      this.dataImportInput.parentNode === document.body
    ) {
      document.body.removeChild(this.dataImportInput);
    }
    this.dataImportInput = null;
  }

  exportImage() {
    try {
      save(_renderer, this._getFilename(this.appcore.params.imageFormat));
      console.log("[Psi] Exported image");
    } catch (err) {
      console.error("[Psi] Export failed:", err);
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
    console.log("[Psi] Exported params JSON");
  }

  importParamsJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        this._applyMetadataPayload(data.metadata);
        this._applyParamsPayload(data);
        this.appcore.refreshGUI();
        console.log("[Psi] Imported params JSON");
      });
    });
  }

  exportStatisticsJSON() {
    const payload = {
      format: "simpipe.stats",
      metadata: this.appcore.metadata,
      statistics: { ...this.appcore.statistics },
      series: Array.isArray(this.appcore.analyser?.series)
        ? this.appcore.analyser.series
        : [],
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("stats.json"));
    console.log(`[Psi] Exported stats JSON: ${payload.series.length} rows`);
  }

  exportStatisticsCSV() {
    const metadataJson = JSON.stringify(this.appcore.metadata || {});
    const exportedAt = new Date().toISOString();
    const series = Array.isArray(this.appcore.analyser?.series)
      ? this.appcore.analyser.series
      : [];
    const header = [
      "fps",
      "density",
      "peakDensity",
      "mean",
      "stdDev",
      "entropy",
      "concentration",
      "radialPeak",
      "radialSpread",
      "nodeEstimate",
      "n",
      "l",
      "m",
      "resolution",
      "viewRadius",
    ];
    const rows = [
      `# exportedAt: ${exportedAt}`,
      `# metadata: ${metadataJson}`,
      header.join(","),
    ];
    for (const row of series) {
      rows.push(
        (Array.isArray(row) ? row : []).map((v) => Number(v) || 0).join(","),
      );
    }
    this._downloadText(
      rows.join("\n"),
      this._getFilename("stats.csv"),
      "text/csv",
    );
    console.log(`[Psi] Exported stats CSV: ${series.length} rows`);
  }

  exportWorldJSON() {
    const { renderer, params, statistics } = this.appcore;
    const grid = renderer?.grid;
    if (!grid || !grid.length) {
      console.warn("[Psi] No rendered grid available for world export");
      return;
    }

    const payload = {
      format: "simpipe.world",
      metadata: this.appcore.metadata,
      exportedAt: new Date().toISOString(),
      params: this._serialiseParams(params),
      statistics: { ...statistics },
      series: Array.isArray(this.appcore.analyser?.series)
        ? this.appcore.analyser.series
        : [],
      world: {
        resolution: Number(params.resolution) || 0,
        peak: Number(this.appcore.getNormalisationPeak?.() || statistics.peakDensity || 1e-10),
        grid: Array.from(grid),
      },
    };

    this._downloadJSON(payload, this._getFilename("world.json"));
    console.log(`[Psi] Exported world JSON: resolution=${payload.world.resolution}`);
  }

  importWorldJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (!data || typeof data !== "object" || data.format !== "simpipe.world") {
          throw new Error("[Psi] Invalid world JSON payload");
        }
        if (!data.params || typeof data.params !== "object") {
          throw new Error("[Psi] Invalid world JSON: missing params");
        }
        if (!data.statistics || typeof data.statistics !== "object") {
          throw new Error("[Psi] Invalid world JSON: missing statistics");
        }
        if (!Array.isArray(data.series)) {
          throw new Error("[Psi] Invalid world JSON: missing series");
        }
        if (
          !data.world ||
          typeof data.world !== "object" ||
          !Number.isFinite(Number(data.world.resolution)) ||
          !Array.isArray(data.world.grid)
        ) {
          throw new Error("[Psi] Invalid world JSON: missing world fields");
        }

        this._applyMetadataPayload(data.metadata);

        const paramsPayload = { format: "simpipe.params", params: data.params };
        this._applyParamsPayload(paramsPayload);

        const world = data.world;
        this._applyStatisticsPayload({ format: "simpipe.stats", statistics: data.statistics, series: data.series });
        if (
          world.grid.length === Number(world.resolution) * Number(world.resolution)
        ) {
          this.appcore.params.resolution = Number(world.resolution);
          this.appcore.renderer.renderFromGrid(
            Float32Array.from(world.grid).buffer,
            Math.max(1e-10, Number(world.peak) || 1e-10),
          );
        } else {
          throw new Error("[Psi] Invalid world JSON: grid length mismatch");
        }

        this.appcore.refreshGUI();
        console.log(`[Psi] Imported world JSON: resolution=${this.appcore.params.resolution}`);
      });
    });
  }

  _applyParamsPayload(data) {
    if (!data || typeof data !== "object" || !data.params) {
      throw new Error("[Psi] Invalid params JSON payload");
    }
    if (data.format !== "simpipe.params") {
      throw new Error("[Psi] Invalid params JSON format version");
    }

    this._mergeByTargetSchema(this.appcore.params, data.params);

    this.appcore.gui.enforceConstraints();
    this.appcore.syncViewConstraints();
  }

  _applyStatisticsPayload(data) {
    if (!data || typeof data !== "object") {
      throw new Error("[Psi] Invalid stats JSON payload");
    }
    if (data.format !== "simpipe.stats") {
      throw new Error("[Psi] Invalid stats JSON format version");
    }
    if (!data.statistics || typeof data.statistics !== "object") {
      throw new Error("[Psi] Invalid stats JSON: missing statistics");
    }
    if (!Array.isArray(data.series)) {
      throw new Error("[Psi] Invalid stats JSON: missing series");
    }

    this._applyMetadataPayload(data.metadata);
    this._mergeByTargetSchema(this.appcore.statistics, data.statistics);
    if (this.appcore.analyser) {
      this.appcore.analyser.series = JSON.parse(JSON.stringify(data.series));
    }
  }

  _applyMetadataPayload(metadata) {
    if (!metadata || typeof metadata !== "object") return;
    this.appcore.metadata = JSON.parse(JSON.stringify(metadata));
  }

  _serialiseParams(params) {
    return this._cloneJSONCompatible(params);
  }

  _isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  _cloneJSONCompatible(value) {
    if (ArrayBuffer.isView(value)) {
      return Array.from(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this._cloneJSONCompatible(item));
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

  _getRecordingFPS() {
    const fps = Number(this.appcore.params?.recordingFPS);
    return Math.max(12, Math.min(120, Math.round(fps || 60)));
  }

  _getRecordingBitrateBps() {
    const mbps = Number(this.appcore.params?.videoBitrateMbps);
    const clampedMbps = Math.max(1, Math.min(64, mbps || 8));
    return Math.round(clampedMbps * 1e6);
  }

  _readJSONFile(file, onSuccess) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onSuccess(parsed);
      } catch (err) {
        console.error("[Psi] JSON import failed:", err);
      }
    };
    reader.onerror = () => console.error("[Psi] File read failed");
    reader.readAsText(file);
  }

  _downloadJSON(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
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
    const { name, version } = this.appcore.metadata;
    const { orbitalNotation } = this.appcore.params;
    const safeOrbital = (orbitalNotation || "orbital")
      .replace(/\s+/g, "_")
      .replace(/[()=]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "");
    const ts = Date.now();

    return `${name}_${version}_${safeOrbital}_${ts}.${extension}`;
  }
}
