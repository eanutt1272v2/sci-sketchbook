class AppCore {
  constructor(assets = {}) {
    const { metadata = null } = assets;

    this.metadata = metadata;
    this._diagnosticsLogger =
      typeof AppDiagnostics !== "undefined" &&
      typeof AppDiagnostics.resolveLogger === "function"
        ? AppDiagnostics.resolveLogger("Cellular Division")
        : { info() {}, warn() {}, error() {}, debug() {} };
    this.maxJSONImportBytes = 32 * 1024 * 1024;
    this.theme = new Theme();
    this.params = {
      imageFormat: "png",
      recordingFPS: 60,
      videoBitrateMbps: 8,
    };
    this.sim = new Simulation(this.theme);
    this.media = new Media(this);
    this.ui = new UIManager(this);

    this._themeMediaQuery = null;
    this._onThemeChange = null;
    this._setupSystemThemeListener();
    background(this.theme.canvasClear);
  }

  _setupSystemThemeListener() {
    if (!window.matchMedia) return;

    this._themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this._onThemeChange = () => {
      this.theme.applySystemTheme();
      this.sim.setTheme(this.theme);
      background(this.theme.canvasClear);
    };

    if (typeof this._themeMediaQuery.addEventListener === "function") {
      this._themeMediaQuery.addEventListener("change", this._onThemeChange);
    } else if (typeof this._themeMediaQuery.addListener === "function") {
      this._themeMediaQuery.addListener(this._onThemeChange);
    }
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

  onKeyPressed(event = null) {
    KeyboardUtils.safeHandle("Cellular Division", "press", () =>
      this.ui.onKeyPressed(event),
    );
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
    if (
      this._themeMediaQuery &&
      this._onThemeChange &&
      typeof this._themeMediaQuery.removeEventListener === "function"
    ) {
      this._themeMediaQuery.removeEventListener("change", this._onThemeChange);
    } else if (
      this._themeMediaQuery &&
      this._onThemeChange &&
      typeof this._themeMediaQuery.removeListener === "function"
    ) {
      this._themeMediaQuery.removeListener(this._onThemeChange);
    }

    this._themeMediaQuery = null;
    this._onThemeChange = null;

    if (this.ui && typeof this.ui.dispose === "function") {
      this.ui.dispose();
    }

    if (this.media && typeof this.media.dispose === "function") {
      this.media.dispose();
    }

    if (this.sim && typeof this.sim.dispose === "function") {
      this.sim.dispose();
    }

    this.media = null;
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

  refreshGUI() {}

  exportImage() {
    if (this.media && typeof this.media.exportImage === "function") {
      this.media.exportImage();
    }
  }

  exportParamsJSON() {
    if (this.media && typeof this.media.exportParamsJSON === "function") {
      this.media.exportParamsJSON();
    }
  }

  importParamsJSON() {
    if (this.media && typeof this.media.importParamsJSON === "function") {
      this.media.importParamsJSON();
    }
  }

  exportStatisticsJSON() {
    if (this.media && typeof this.media.exportStatisticsJSON === "function") {
      this.media.exportStatisticsJSON();
    }
  }

  exportStatisticsCSV() {
    if (this.media && typeof this.media.exportStatisticsCSV === "function") {
      this.media.exportStatisticsCSV();
    }
  }

  exportStateJSON() {
    if (this.media && typeof this.media.exportStateJSON === "function") {
      this.media.exportStateJSON();
    }
  }

  importStateJSON() {
    if (this.media && typeof this.media.importStateJSON === "function") {
      this.media.importStateJSON();
    }
  }

  _getParamsSnapshot() {
    const sim = this.sim;
    const snapshot = {};
    for (const key of Object.keys(sim)) {
      if (key.startsWith("_")) continue;
      const val = sim[key];
      if (typeof val === "number" || typeof val === "boolean") {
        snapshot[key] = val;
      }
    }
    return snapshot;
  }

  _applyParamsSnapshot(params) {
    if (!params || typeof params !== "object") return;

    const sim = this.sim;
    let needsRestart = false;

    for (const [key, value] of Object.entries(params)) {
      if (key === "paused" || key === "particleCount") continue;
      const setterName = "set" + key.charAt(0).toUpperCase() + key.slice(1);
      if (typeof sim[setterName] === "function") {
        sim[setterName](Number(value));
      }
    }

    if ("particleCount" in params) {
      sim.setParticleCount(Number(params.particleCount));
      needsRestart = true;
    }

    if ("paused" in params) {
      const shouldPause = Boolean(params.paused);
      if (sim.isPaused() !== shouldPause) {
        sim.togglePause();
      }
    }

    if (needsRestart) {
      this.restartSimulation();
    }
  }

  _getStatisticsSnapshot() {
    const sim = this.sim;
    const paramKeys = new Set(Object.keys(this._getParamsSnapshot()));
    const snapshot = { fps: Number(frameRate()) || 0 };

    const proto = Object.getPrototypeOf(sim);
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (!name.startsWith("get") || name.length <= 3) continue;
      if (typeof sim[name] !== "function") continue;
      const paramName = name.charAt(3).toLowerCase() + name.slice(4);
      if (paramKeys.has(paramName)) continue;
      try {
        const val = sim[name]();
        if (Array.isArray(val)) {
          snapshot[paramName] = [...val];
        } else if (typeof val === "number") {
          snapshot[paramName] = val;
        }
      } catch (_) {
        /* skip */
      }
    }

    return snapshot;
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

      if (file.size > this.maxJSONImportBytes) {
        this._diagnosticsLogger.error(
          `JSON import failed: file too large (${file.size} bytes, max ${this.maxJSONImportBytes})`,
        );
        document.body.removeChild(input);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || "{}"));
          onSuccess(parsed);
        } catch (err) {
          this._diagnosticsLogger.error("JSON import failed:", err);
        } finally {
          document.body.removeChild(input);
        }
      };
      reader.onerror = () => {
        this._diagnosticsLogger.error("Failed to read selected file");
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
