class Media {
  constructor(appcore) {
    this.appcore = appcore;
    this.mediaRecorder = null;
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
      console.error("[Eigen] No valid canvas found");
      return;
    }

    this.recordedChunks = [];
    const types = ["video/webm;codecs=vp8", "video/mp4", "video/webm"];
    const supportedType = types.find((t) => MediaRecorder.isTypeSupported(t));

    if (!supportedType) {
      console.error("[Eigen] No supported video format found");
      return;
    }

    try {
      const captureFps = this._getRecordingFPS();
      const bitrateBps = this._getRecordingBitrateBps();
      const stream = sourceCanvas.captureStream(captureFps);
      const options = { mimeType: supportedType };
      if (bitrateBps > 0) {
        options.videoBitsPerSecond = bitrateBps;
      }
      this.mediaRecorder = new MediaRecorder(stream, options);

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
      const bitrateMbps = bitrateBps > 0 ? bitrateBps / 1e6 : 0;
      console.log(
        `[Eigen] Recording: ${supportedType}, fps=${captureFps}, bitrate=${bitrateMbps.toFixed(2)}Mbps`,
      );
    } catch (err) {
      console.error("[Eigen] Recording failed:", err);
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
    try {
      save(_renderer, this._getFilename(this.appcore.params.imageFormat));
      console.log("[Eigen] Exported image");
    } catch (err) {
      console.error("[Eigen] Export failed:", err);
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
    console.log("[Eigen] Exported params JSON");
  }

  importParamsJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        this._applyParamsPayload(data);
        this.appcore.refreshGUI();
        console.log("[Eigen] Imported params JSON");
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
    console.log(`[Eigen] Exported stats JSON: ${payload.series.length} rows`);
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
    console.log(`[Eigen] Exported stats CSV: ${series.length} rows`);
  }

  exportWorldJSON() {
    const { renderer, params, statistics } = this.appcore;
    const grid = renderer?.grid;
    if (!grid || !grid.length) {
      console.warn("[Eigen] No rendered grid available for world export");
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
    console.log(`[Eigen] Exported world JSON: resolution=${payload.world.resolution}`);
  }

  importWorldJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (!data || typeof data !== "object" || data.format !== "simpipe.world") {
          throw new Error("[Eigen] Invalid world JSON payload");
        }
        if (!data.params || typeof data.params !== "object") {
          throw new Error("[Eigen] Invalid world JSON: missing params");
        }
        if (!data.statistics || typeof data.statistics !== "object") {
          throw new Error("[Eigen] Invalid world JSON: missing statistics");
        }
        if (!Array.isArray(data.series)) {
          throw new Error("[Eigen] Invalid world JSON: missing series");
        }

        const paramsPayload = { format: "simpipe.params", params: data.params };
        this._applyParamsPayload(paramsPayload);

        const world = data.world;
        Object.assign(this.appcore.statistics, data.statistics);
        if (this.appcore.analyser) {
          this.appcore.analyser.series = JSON.parse(JSON.stringify(data.series));
        }
        if (
          world &&
          Number.isFinite(Number(world.resolution)) &&
          Array.isArray(world.grid) &&
          world.grid.length === Number(world.resolution) * Number(world.resolution)
        ) {
          this.appcore.params.resolution = Number(world.resolution);
          this.appcore.renderer.renderFromGrid(
            Float32Array.from(world.grid).buffer,
            Math.max(1e-10, Number(world.peak) || 1e-10),
          );
        } else {
          this.appcore.requestRender();
        }

        this.appcore.refreshGUI();
        console.log(`[Eigen] Imported world JSON: resolution=${this.appcore.params.resolution}`);
      });
    });
  }

  _applyParamsPayload(data) {
    if (!data || typeof data !== "object" || !data.params) {
      throw new Error("[Eigen] Invalid params JSON payload");
    }
    if (data.format !== "simpipe.params") {
      throw new Error("[Eigen] Invalid params JSON format version");
    }

    const allowed = [
      "n",
      "l",
      "m",
      "colourMap",
      "exposure",
      "resolution",
      "pixelSmoothing",
      "renderOverlay",
      "renderLegend",
      "renderKeymapRef",
      "viewRadius",
      "slicePlane",
      "sliceOffset",
      "viewCentre",
      "imageFormat",
      "recordingFPS",
      "videoBitrateMbps",
    ];

    for (const key of allowed) {
      if (!(key in data.params)) continue;

      if (
        key === "viewCentre" &&
        data.params.viewCentre &&
        typeof data.params.viewCentre === "object"
      ) {
        const vc = data.params.viewCentre;
        this.appcore.params.viewCentre.x = Number(vc.x) || 0;
        this.appcore.params.viewCentre.y = Number(vc.y) || 0;
        this.appcore.params.viewCentre.z = Number(vc.z) || 0;
      } else {
        this.appcore.params[key] = data.params[key];
      }
    }

    this.appcore.gui.enforceConstraints();
    this.appcore.syncViewConstraints();
  }

  _serialiseParams(params) {
    return {
      ...params,
      viewCentre: {
        x: Number(params.viewCentre.x) || 0,
        y: Number(params.viewCentre.y) || 0,
        z: Number(params.viewCentre.z) || 0,
      },
    };
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
        console.error("[Eigen] JSON import failed:", err);
      }
    };
    reader.onerror = () => console.error("[Eigen] File read failed");
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
