class Media extends MediaCore {
  constructor(appcore) {
    super(appcore, "[Lenia][Media]");
    this._worldExportDeferred = false;
    this._maxEncodedFieldChars = 32 * 1024 * 1024;
  }

  exportWorldJSON() {
    const board = this.appcore?.board;
    const fields = this._collectFloat32Fields(board);

    if (Object.keys(fields).length === 0) {
      if (!this._worldExportDeferred) {
        this._worldExportDeferred = true;
        if (typeof this.appcore?._queueAction === "function") {
          this.appcore._queueAction("exportWorldJSON", () => {
            this._worldExportDeferred = false;
            this.exportWorldJSON();
          });
          this._logInfo(
            "World export deferred until worker returns board buffers",
          );
        } else {
          this._worldExportDeferred = false;
          this._logWarn("Cannot export world while worker holds board buffers");
        }
      }
      return;
    }

    this._worldExportDeferred = false;

    if (!board || !Number.isFinite(board.size) || board.size <= 0) return;
    const expectedLength = board.size * board.size;

    const worldPayload = { size: board.size };
    for (const [key, arr] of Object.entries(fields)) {
      worldPayload[key] = this._encodeFloatField(arr, expectedLength);
    }

    const statistics = this._getFullStatisticsSnapshot();
    const payload = {
      format: "simpipe.world",
      metadata: this._getMetadataSnapshot(),
      params: this._getFullParamsSnapshot(),
      statistics: statistics.statistics,
      series: statistics.series,
      world: worldPayload,
      exportedAt: new Date().toISOString(),
    };

    this._downloadJSON(payload, this._getFilename("world.json"));
    this._logInfo(`World JSON exported: size=${board.size}`);
  }

  importWorldJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (
          !data ||
          typeof data !== "object" ||
          data.format !== "simpipe.world" ||
          !data.world ||
          !data.params ||
          !data.statistics ||
          !Array.isArray(data.series)
        ) {
          throw new Error("[Lenia] Invalid world JSON payload");
        }

        this._applyMetadataSnapshot(data.metadata);

        const payload = this._normaliseWorldPayload(data);
        this.appcore.importWorldPayload(payload);
        this._logInfo("World JSON imported (params, statistics, and field states)");
      });
    });
  }

  _normaliseWorldPayload(data) {
    const rawSize = Number(data.world.size);
    if (!Number.isFinite(rawSize) || rawSize <= 0) {
      throw new Error("[Lenia] Invalid world JSON: missing or invalid size");
    }
    const size = this.appcore._normaliseGridSize(rawSize);
    const expectedLength = size * size;

    const fields = {};
    for (const [key, val] of Object.entries(data.world)) {
      if (key === "size") continue;
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }

      if (val && typeof val === "object" && val.encoding === "rle-f32-v1") {
        fields[key] = this._decodeFloatField(val, expectedLength);
      } else if (typeof val === "string") {
        throw new Error(
          "[Lenia] Invalid world JSON: legacy string field encoding is no longer supported",
        );
      }
    }

    return {
      size,
      fields,
      params: data.params,
      statistics: data.statistics,
      series: data.series,
    };
  }

  exportImage() {
    super.exportImage();
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
    this._downloadText(csv, this._getFilename("statistics.csv"), "text/csv");
    this._logInfo("Statistics CSV exported");
  }

  exportStatisticsJSON() {
    const statistics = this._getFullStatisticsSnapshot();
    const payload = {
      format: "simpipe.statistics",
      metadata: this._getMetadataSnapshot(),
      statistics: statistics.statistics,
      series: statistics.series,
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("statistics.json"));
    this._logInfo(
      `Statistics JSON exported: rows=${this.appcore.analyser.series.length}`,
    );
  }

  exportParamsJSON() {
    const payload = {
      format: "simpipe.params",
      metadata: this._getMetadataSnapshot(),
      exportedAt: new Date().toISOString(),
      params: this._getFullParamsSnapshot(),
    };
    this._downloadJSON(payload, this._getFilename("params.json"));
    this._logInfo("Params JSON exported");
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

        const result = this.appcore._applyImportedParams(data.params, {
          allowGridSize: true,
        });

        if (result.latticeExtentChanged) {
          this.appcore.changeResolution();
        } else {
          this.appcore.updateAutomatonParams();
          if (
            result.dimensionChanged &&
            this.appcore.gui &&
            typeof this.appcore.gui.rebuildPane === "function"
          ) {
            this.appcore.gui.rebuildPane();
          } else {
            this.appcore.refreshGUI();
          }
        }
        this._logInfo("Params JSON imported");
      });
    });
  }

  _getFullParamsSnapshot() {
    return this._cloneJSONCompatible(this.appcore.params || {});
  }

  _getMetadataSnapshot() {
    return this._cloneJSONCompatible(this.appcore.metadata || {});
  }

  _getFullStatisticsSnapshot() {
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

  _collectFloat32Fields(container) {
    const fields = {};
    if (!container) return fields;
    for (const key of Object.getOwnPropertyNames(container)) {
      if (key.startsWith("_")) continue;
      const val = container[key];
      if (val instanceof Float32Array) {
        fields[key] = val;
      }
    }
    return fields;
  }

  _encodeFloatField(source, size) {
    if (!(source instanceof Float32Array)) {
      throw new Error(
        "[Lenia] Invalid world JSON export: missing Float32 field",
      );
    }
    const expectedLength = Number(size);
    if (source.length !== expectedLength) {
      throw new Error(
        "[Lenia] Invalid world JSON export: field length mismatch",
      );
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
      throw new Error(
        "[Lenia] Invalid world JSON: malformed float field encoding",
      );
    }

    const length = Number(source.length);
    if (length !== expectedLength) {
      throw new Error(
        `[Lenia] Invalid world JSON: encoded float field length mismatch (expected ${expectedLength}, got ${length})`,
      );
    }

    if (source.data.length > this._maxEncodedFieldChars) {
      throw new Error(
        "[Lenia] Invalid world JSON: encoded float field exceeds size limit",
      );
    }

    return RLECodec.decodeFloat32Array(source.data, length);
  }

  _getFilename(extension) {
    const { name, version } = this.appcore.metadata;
    const { renderMode, latticeExtent } = this.appcore.params;
    const ts = Date.now();
    return `${name}_${version}_${renderMode}_${latticeExtent}_${ts}.${extension}`;
  }
}
