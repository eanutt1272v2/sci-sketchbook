class AppCore {
  constructor(assets = {}) {
    const { metadata = null } = assets;

    this.metadata = metadata;
    this.theme = new Theme();
    this.sim = new Simulation();
    this.ui = new UIManager(this);
    background(0);
  }

  update() {
    this.ui.updateInput();
    this.sim.update();
  }

  render() {
    this.sim.render();
    if (this.ui.isVisible()) {
      this.ui.render();
    }
  }

  onKeyPressed() {
    this.ui.onKeyPressed();
  }

  windowResized() {
    resizeCanvas(windowWidth, windowHeight);

    if (this.ui && typeof this.ui.dispose === "function") {
      this.ui.dispose();
    }

    this.ui = new UIManager(this);
    this.sim.particleCount = this.sim.defaultParticleCount();
    this.restartSimulation();
  }

  dispose() {
    if (this.ui && typeof this.ui.dispose === "function") {
      this.ui.dispose();
    }

    if (this.sim && typeof this.sim.dispose === "function") {
      this.sim.dispose();
    }

    this.ui = null;
    this.sim = null;
  }

  restartSimulation() {
    this.sim.requestRestart();
  }

  toggleSimulationPause() {
    this.sim.togglePause();
  }

  toggleUI() {
    this.ui.toggleVisibility();
  }

  exportParamsJSON() {
    const payload = {
      format: "simpipe.params",
      metadata: this.metadata,
      params: this._getParamsSnapshot(),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("params.json"));
  }

  importParamsJSON() {
    this._openJSONFileDialog((data) => {
      if (!data || typeof data !== "object" || data.format !== "simpipe.params") {
        throw new Error("[Cellular Division] Invalid params JSON payload");
      }

      this._applyParamsSnapshot(data.params || {});
    });
  }

  exportStatisticsJSON() {
    const payload = {
      format: "simpipe.stats",
      metadata: this.metadata,
      statistics: this._getStatisticsSnapshot(),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("stats.json"));
  }

  exportStatisticsCSV() {
    const s = this._getStatisticsSnapshot();
    const rows = [
      ["elapsedSeconds", s.elapsedSeconds],
      ["population", s.population],
      ["particleCount", s.particleCount],
      ["fps", s.fps],
      ["historyLength", Array.isArray(s.history) ? s.history.length : 0],
    ];

    const csv =
      "key,value\n" + rows.map((r) => `${r[0]},${Number(r[1]) || 0}`).join("\n");
    this._downloadText(csv, this._getFilename("stats.csv"), "text/csv");
  }

  exportStateJSON() {
    const payload = {
      format: "simpipe.state",
      metadata: this.metadata,
      params: this._getParamsSnapshot(),
      statistics: this._getStatisticsSnapshot(),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("state.json"));
  }

  importStateJSON() {
    this._openJSONFileDialog((data) => {
      if (!data || typeof data !== "object" || data.format !== "simpipe.state") {
        throw new Error("[Cellular Division] Invalid state JSON payload");
      }

      this._applyParamsSnapshot(data.params || {});

      const history = data?.statistics?.history;
      if (Array.isArray(history)) {
        this.sim._history = history
          .map((value) => Number(value) || 0)
          .slice(-Math.max(10, width));
      }
    });
  }

  _getParamsSnapshot() {
    return {
      alpha: this.sim.getAlpha(),
      beta: this.sim.getBeta(),
      gamma: this.sim.getGamma(),
      radius: this.sim.getRadius(),
      trailAlpha: this.sim.getTrailAlpha(),
      densityThreshold: this.sim.getDensityThreshold(),
      particleCount: this.sim.particleCount,
      paused: this.sim.isPaused(),
    };
  }

  _applyParamsSnapshot(params) {
    if (!params || typeof params !== "object") return;

    if ("alpha" in params) this.sim.setAlpha(Number(params.alpha));
    if ("beta" in params) this.sim.setBeta(Number(params.beta));
    if ("gamma" in params) this.sim.setGamma(Number(params.gamma));
    if ("radius" in params) this.sim.setRadius(Number(params.radius));
    if ("trailAlpha" in params) this.sim.setTrailAlpha(Number(params.trailAlpha));
    if ("densityThreshold" in params)
      this.sim.setDensityThreshold(Number(params.densityThreshold));

    if ("particleCount" in params) {
      this.sim.setParticleCount(Number(params.particleCount));
      this.restartSimulation();
    }

    if ("paused" in params) {
      const shouldPause = Boolean(params.paused);
      if (this.sim.isPaused() !== shouldPause) {
        this.sim.togglePause();
      }
    }
  }

  _getStatisticsSnapshot() {
    return {
      fps: Number(frameRate()) || 0,
      elapsedSeconds: this.sim.getElapsedSeconds(),
      population: this.sim.getCellPopulation(),
      particleCount: this.sim.getParticleCount(),
      history: Array.isArray(this.sim.getCellHistory())
        ? [...this.sim.getCellHistory()]
        : [],
    };
  }

  _openJSONFileDialog(onSuccess) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json,text/plain";
    input.style.display = "none";

    input.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        document.body.removeChild(input);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || "{}"));
          onSuccess(parsed);
        } catch (err) {
          console.error("[Cellular Division] JSON import failed:", err);
        } finally {
          document.body.removeChild(input);
        }
      };
      reader.onerror = () => {
        console.error("[Cellular Division] Failed to read selected file");
        document.body.removeChild(input);
      };
      reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
  }

  _downloadJSON(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    this._triggerDownload(URL.createObjectURL(blob), filename);
  }

  _downloadText(content, filename, mimeType = "text/plain") {
    const blob = new Blob([String(content || "")], { type: mimeType });
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
    const { name, version } = this.metadata || {
      name: "Cellular_Division",
      version: "v0",
    };
    const ts = Date.now();
    return `${name}_${version}_${ts}.${extension}`;
  }
}
