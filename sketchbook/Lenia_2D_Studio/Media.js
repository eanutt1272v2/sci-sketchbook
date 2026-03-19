class Media {
  constructor(appcore) {
    this.appcore = appcore;
    this.mediaRecorder = null;
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
      console.log(`[Lenia] Recording: ${supportedType}`);
    } catch (err) {
      console.error("[Lenia] Recording failed:", err);
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
    save(_renderer, this._getFilename(this.appcore.params.imageFormat));
  }

  exportWorldJSON() {
    const data = this.appcore.board.toJSON();
    if (!data) return;

    data.metadata = this._getMetadataSnapshot();
    data.params = this._getFullParamsSnapshot();
    data.stats = this._getFullStatsSnapshot();
    data.format = "lenia-world-v2";
    data.exportedAt = new Date().toISOString();

    this._downloadJSON(data, this._getFilename("world.json"));
    console.log(`[Lenia] Exported world JSON: size=${this.appcore.board.size}`);
  }

  importWorldJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (!data || typeof data !== "object" || !data.cells) {
          throw new Error("[Lenia] Invalid world JSON payload");
        }

        const payload = this._normaliseWorldPayload(data);
        this.appcore.importWorldPayload(payload);
      });
    });
  }

  _normaliseWorldPayload(data) {
    const rawSize = Number(data.size);
    if (!Number.isFinite(rawSize) || rawSize <= 0) {
      throw new Error("[Lenia] Invalid world JSON: missing or invalid size");
    }
    const size = this.appcore._normaliseGridSize(rawSize);

    if (typeof data.cells !== "string") {
      throw new Error("[Lenia] Invalid world JSON: cells must be RLE string");
    }
    const cells = RLECodec.decode(data.cells, size, size);

    return {
      size,
      cells,
      params: data.params,
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
    const payload = {
      metadata: this._getMetadataSnapshot(),
      exportedAt: new Date().toISOString(),
      ...this._getFullStatsSnapshot(),
    };
    this._downloadJSON(payload, this._getFilename("stats.json"));
    console.log(
      `[Lenia] Exported statistics JSON: ${this.appcore.analyser.series.length} rows`,
    );
  }

  exportParamsJSON() {
    const payload = {
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

        if (!data.params || typeof data.params !== "object") {
          throw new Error("[Lenia] Invalid params JSON format");
        }

        const incoming = data.params;
        const target = this.appcore.params;
        const oldSize = target.gridSize;

        const allowed = [
          "running",
          "gridSize",
          "R",
          "T",
          "m",
          "s",
          "b",
          "kn",
          "gn",
          "softClip",
          "multiStep",
          "addNoise",
          "maskRate",
          "paramP",
          "colourMap",
          "renderMode",
          "renderGrid",
          "renderScale",
          "renderLegend",
          "renderStats",
          "renderMotionOverlay",
          "renderKeymapRef",
          "selectedAnimal",
          "placeMode",
          "imageFormat",
        ];

        for (const key of allowed) {
          if (key in incoming) target[key] = incoming[key];
        }

        if (target.gridSize !== oldSize) {
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
    return JSON.parse(JSON.stringify(this.appcore.params || {}));
  }

  _getMetadataSnapshot() {
    return JSON.parse(JSON.stringify(this.appcore.metadata || {}));
  }

  _getFullStatsSnapshot() {
    return {
      statistics: JSON.parse(JSON.stringify(this.appcore.statistics || {})),
      series: JSON.parse(
        JSON.stringify(
          Array.isArray(this.appcore.analyser?.series)
            ? this.appcore.analyser.series
            : [],
        ),
      ),
    };
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
}
