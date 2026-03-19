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
      console.log(`[Eigen] Recording: ${supportedType}`);
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
        if (!data || typeof data !== "object" || !data.params) {
          throw new Error("[Eigen] Invalid params JSON payload");
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
        this.appcore.refreshGUI();
        console.log("[Eigen] Imported params JSON");
      });
    });
  }

  exportStatisticsJSON() {
    const payload = {
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
    const series = Array.isArray(this.appcore.analyser?.series)
      ? this.appcore.analyser.series
      : [];
    const header = [
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
    const rows = [header.join(",")];
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

  exportAnalysisJSON() {
    if (!this.appcore.analyser) return;
    const payload = {
      metadata: this.appcore.metadata,
      ...this.appcore.analyser.exportJSON(),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("analysis.json"));
    console.log(
      `[Eigen] Exported analysis JSON: ${(payload.series || []).length} rows`,
    );
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
