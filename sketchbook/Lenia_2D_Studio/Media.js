class Media {
  constructor(appcore) {
    this.appcore = appcore;
    this.mediaRecorder = null;
    this.recordingStream = null;
    this.recordedChunks = [];
    this.isRecording = false;

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

  openDataImportDialog(handler) {
    this.pendingDataImportHandler = handler;
    this.dataImportInput.value = "";
    this.dataImportInput.click();
  }

  startRecording() {
    if (this.isRecording) return;

    const sourceCanvas = _renderer?.elt;
    if (!sourceCanvas) {
      console.error("[Lenia] No valid canvas found");
      return;
    }

    this.recordedChunks = [];
    const types = ["video/webm;codecs=vp8", "video/mp4", "video/webm"];
    const supportedType = types.find((t) => MediaRecorder.isTypeSupported(t));

    if (!supportedType) {
      console.error("[Lenia] No supported video format found");
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
        `[Lenia] Recording: ${supportedType}, fps=${captureFps}, bitrate=${bitrateMbps.toFixed(2)}Mbps`,
      );
    } catch (err) {
      console.error("[Lenia] Recording failed:", err);
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

  exportImage() {
    save(_renderer, this._getFilename(this.appcore.params.imageFormat));
  }

  exportWorldJSON() {
    const data = this.appcore.board.toJSON();
    if (!data) return;

    const stats = this._getFullStatsSnapshot();
    const payload = {
      format: "simpipe.world",
      metadata: this._getMetadataSnapshot(),
      params: this._getFullParamsSnapshot(),
      statistics: stats.statistics,
      series: stats.series,
      world: {
        size: data.size,
        world: data.world,
        potential: this._encodeFloatField(this.appcore.board?.potential, data.size),
        growth: this._encodeFloatField(this.appcore.board?.growth, data.size),
        growthOld: this.appcore.board?.growthOld
          ? this._encodeFloatField(this.appcore.board.growthOld, data.size)
          : null,
      },
      exportedAt: new Date().toISOString(),
    };

    this._downloadJSON(payload, this._getFilename("world.json"));
    console.log(`[Lenia] Exported world JSON: size=${this.appcore.board.size}`);
  }

  importWorldJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (
          !data ||
          typeof data !== "object" ||
          data.format !== "simpipe.world" ||
          !data.world ||
          !data.world.world ||
          !data.world.potential ||
          !data.world.growth ||
          !data.params ||
          !data.statistics ||
          !Array.isArray(data.series)
        ) {
          throw new Error("[Lenia] Invalid world JSON payload");
        }

        this._applyMetadataSnapshot(data.metadata);

        const payload = this._normaliseWorldPayload(data);
        this.appcore.importWorldPayload(payload);
        console.log("[Lenia] Imported world JSON with all params, stats, and field states");
      });
    });
  }

  _normaliseWorldPayload(data) {
    const rawSize = Number(data.world.size);
    if (!Number.isFinite(rawSize) || rawSize <= 0) {
      throw new Error("[Lenia] Invalid world JSON: missing or invalid size");
    }
    const size = this.appcore._normaliseGridSize(rawSize);

    if (typeof data.world.world !== "string") {
      throw new Error("[Lenia] Invalid world JSON: world must be RLE string");
    }
    const world = RLECodec.decode(data.world.world, size, size);
    const expectedLength = size * size;
    const potential = this._decodeFloatField(data.world.potential, expectedLength);
    const growth = this._decodeFloatField(data.world.growth, expectedLength);
    
    let growthOld = null;
    if (data.world.growthOld && typeof data.world.growthOld === "object") {
      growthOld = this._decodeFloatField(data.world.growthOld, expectedLength);
    }

    return {
      size,
      world,
      potential,
      growth,
      growthOld,
      params: data.params,
      statistics: data.statistics,
      series: data.series,
    };
  }

  exportStatisticsCSV() {
    const metadataJson = JSON.stringify(this._getMetadataSnapshot());
    const exportedAt = new Date().toISOString();
    const csvBody = this.appcore.analyser.exportCSV();
    const csv =
      `# exportedAt: ${exportedAt}\n` +
      `# metadata: ${metadataJson}\n` +
      csvBody;
    if (!csv) return;
    this._downloadText(csv, this._getFilename("stats.csv"), "text/csv");
    console.log(`[Lenia] Exported statistics CSV`);
  }

  exportStatisticsJSON() {
    const stats = this._getFullStatsSnapshot();
    const payload = {
      format: "simpipe.stats",
      metadata: this._getMetadataSnapshot(),
      statistics: stats.statistics,
      series: stats.series,
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("stats.json"));
    console.log(
      `[Lenia] Exported statistics JSON: ${this.appcore.analyser.series.length} rows`,
    );
  }

  importStatisticsJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (!data || typeof data !== "object") {
          throw new Error("[Lenia] Invalid statistics JSON payload");
        }

        if (data.format !== "simpipe.stats") {
          throw new Error("[Lenia] Invalid statistics JSON format version");
        }

        if (!data.statistics || typeof data.statistics !== "object") {
          throw new Error("[Lenia] Invalid statistics JSON: missing statistics");
        }

        if (!Array.isArray(data.series)) {
          throw new Error("[Lenia] Invalid statistics JSON: missing series");
        }

        this._applyMetadataSnapshot(data.metadata);

        this.appcore.analyser.resetStatistics();
        this.appcore.analyser.reset();
        Object.assign(this.appcore.statistics, this._cloneJSONCompatible(data.statistics));
        this.appcore.analyser.series = this._capSeries(
          this._cloneJSONCompatible(data.series),
        );
        this.appcore.refreshGUI();

        console.log(
          `[Lenia] Imported statistics JSON: ${this.appcore.analyser.series.length} rows`,
        );
      });
    });
  }

  exportParamsJSON() {
    const payload = {
      format: "simpipe.params",
      metadata: this._getMetadataSnapshot(),
      exportedAt: new Date().toISOString(),
      params: this._getFullParamsSnapshot(),
    };
    this._downloadJSON(payload, this._getFilename("params.json"));
    console.log(`[Lenia] Exported params JSON`);
  }

  importParamsJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (!data || typeof data !== "object") {
          throw new Error("[Lenia] Invalid params JSON payload");
        }

        if (data.format !== "simpipe.params") {
          throw new Error("[Lenia] Invalid params JSON format version");
        }

        this._applyMetadataSnapshot(data.metadata);

        if (!data.params || typeof data.params !== "object") {
          throw new Error("[Lenia] Invalid params JSON format");
        }

        const result = this.appcore._applyImportedParamsSnapshot(data.params, {
          allowGridSize: true,
        });

        if (result.gridSizeChanged) {
          this.appcore.changeResolution();
        }

        this.appcore.updateAutomatonParams();
        this.appcore.refreshGUI();
        console.log(`[Lenia] Imported params JSON`);
      });
    });
  }

  _readJSONFile(file, onSuccess) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onSuccess(parsed);
      } catch (err) {
        console.error("[Lenia] JSON import failed:", err);
      }
    };
    reader.onerror = () => console.error("[Lenia] File read failed");
    reader.readAsText(file);
  }

  _getFullParamsSnapshot() {
    return this._cloneJSONCompatible(this.appcore.params || {});
  }

  _getMetadataSnapshot() {
    return this._cloneJSONCompatible(this.appcore.metadata || {});
  }

  _applyMetadataSnapshot(metadata) {
    if (!metadata || typeof metadata !== "object") return;
    this.appcore.metadata = this._cloneJSONCompatible(metadata);
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

  _getFullStatsSnapshot() {
    return {
      statistics: this._cloneJSONCompatible(this.appcore.statistics || {}),
      series: this._capSeries(
        this._cloneJSONCompatible(
          Array.isArray(this.appcore.analyser?.series)
            ? this.appcore.analyser.series
            : [],
        ),
      ),
    };
  }

  _capSeries(series, limit = 10000) {
    if (!Array.isArray(series)) return [];
    if (series.length <= limit) return series;
    return series.slice(series.length - limit);
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

  _encodeFloatField(source, size) {
    if (!(source instanceof Float32Array)) {
      throw new Error("[Lenia] Invalid world JSON export: missing Float32 field");
    }
    const expectedLength = Number(size) * Number(size);
    if (source.length !== expectedLength) {
      throw new Error("[Lenia] Invalid world JSON export: field length mismatch");
    }

    return {
      encoding: "rle-f32-v1",
      length: source.length,
      data: RLECodec.encodeFloat32Array(source),
    };
  }

  _decodeFloatField(source, expectedLength) {
    if (
      !source ||
      typeof source !== "object" ||
      source.encoding !== "rle-f32-v1" ||
      typeof source.data !== "string"
    ) {
      throw new Error("[Lenia] Invalid world JSON: malformed float field encoding");
    }

    const length = Number(source.length);
    if (length !== expectedLength) {
      throw new Error(
        `[Lenia] Invalid world JSON: encoded float field length mismatch (expected ${expectedLength}, got ${length})`,
      );
    }

    return RLECodec.decodeFloat32Array(source.data, length);
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
    const { name, version } = this.appcore.metadata;
    const { renderMode, gridSize } = this.appcore.params;
    const ts = Date.now();
    return `${name}_${version}_${renderMode}_${gridSize}_${ts}.${extension}`;
  }

  dispose() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this._releaseRecordingResources();
    this.recordedChunks = [];
    this.pendingDataImportHandler = null;

    if (this.dataImportInput && this.dataImportInput.parentNode === document.body) {
      document.body.removeChild(this.dataImportInput);
    }
    this.dataImportInput = null;
  }
}
