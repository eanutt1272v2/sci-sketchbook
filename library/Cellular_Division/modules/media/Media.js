class Media extends MediaCore {
  constructor(appcore) {
    super(appcore, "[Cellular Division][Media]");
  }

  exportParamsJSON() {
    const payload = {
      format: "simpipe.params",
      metadata: this._getMetadataSnapshot(),
      params: this._getParamsSnapshot(),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("params.json"));
    this._logInfo("Params JSON exported");
  }

  importParamsJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        this._applyMetadataSnapshot(data.metadata);
        this._applyParamsPayload(data);
        this.appcore.refreshGUI();
        this._logInfo("Params JSON imported");
      });
    });
  }

  exportStatisticsJSON() {
    const payload = {
      format: "simpipe.stats",
      metadata: this._getMetadataSnapshot(),
      statistics: this._getStatisticsSnapshot(),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("stats.json"));
    this._logInfo("Stats JSON exported");
  }

  exportStatisticsCSV() {
    const stats = this._getStatisticsSnapshot();
    const exportedAt = new Date().toISOString();
    const metadataJson = JSON.stringify(this._getMetadataSnapshot());
    const rows = [];

    for (const [key, value] of Object.entries(stats)) {
      if (Array.isArray(value)) {
        rows.push([`${key}Length`, value.length]);
      } else {
        rows.push([key, Number(value) || 0]);
      }
    }

    const lines = [
      `# exportedAt: ${exportedAt}`,
      `# metadata: ${metadataJson}`,
      "key,value",
      ...rows.map((row) => `${row[0]},${row[1]}`),
    ];

    this._downloadText(
      lines.join("\n"),
      this._getFilename("stats.csv"),
      "text/csv",
    );
    this._logInfo(`Stats CSV exported: rows=${rows.length}`);
  }

  exportStateJSON() {
    const payload = {
      format: "simpipe.state",
      metadata: this._getMetadataSnapshot(),
      params: this._getParamsSnapshot(),
      statistics: this._getStatisticsSnapshot(),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("state.json"));
    this._logInfo("State JSON exported");
  }

  importStateJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        this._applyMetadataSnapshot(data.metadata);
        this._applyStatePayload(data);
        this.appcore.refreshGUI();
        this._logInfo("State JSON imported");
      });
    });
  }

  _applyParamsPayload(data) {
    if (!data || typeof data !== "object" || data.format !== "simpipe.params") {
      throw new Error("[Cellular Division] Invalid params JSON payload");
    }

    this.appcore._applyParamsSnapshot(data.params || {});
  }

  _applyStatePayload(data) {
    if (!data || typeof data !== "object" || data.format !== "simpipe.state") {
      throw new Error("[Cellular Division] Invalid state JSON payload");
    }

    this.appcore._applyParamsSnapshot(data.params || {});

    const history = data?.statistics?.history;
    if (!Array.isArray(history)) return;

    const canvasWidth = typeof width === "number" ? width : 0;
    const maxHistory = Math.max(10, canvasWidth);
    const trimmed = history.slice(-maxHistory);
    this.appcore.sim._history = trimmed.map((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    });
  }

  _getParamsSnapshot() {
    if (typeof this.appcore._getParamsSnapshot !== "function") return {};
    return this._cloneJSONCompatible(this.appcore._getParamsSnapshot());
  }

  _getStatisticsSnapshot() {
    if (typeof this.appcore._getStatisticsSnapshot !== "function") return {};
    return this._cloneJSONCompatible(this.appcore._getStatisticsSnapshot());
  }

  _getMetadataSnapshot() {
    return this._cloneJSONCompatible(this.appcore.metadata || {});
  }

  _getFilename(extension) {
    if (typeof this.appcore._getFilename === "function") {
      return this.appcore._getFilename(extension);
    }

    const ts = Date.now();
    return `Cellular_Division_v0_${ts}.${extension}`;
  }
}
