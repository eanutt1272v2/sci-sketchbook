class AppCoreImportExportMethods {
  _normaliseGridSize(size) {
    return NDCompatibility.coerceGridSize(size, this.params.dimension);
  }

  _syncSelectedSolitonForActiveDimension(preferredSelection = null) {
    if (typeof this._setSelectedSolitonForActiveDimension === "function") {
      return this._setSelectedSolitonForActiveDimension(preferredSelection, {
        skipNextParamsLoad: true,
      });
    }

    this._applySolitonSource();
    const solitons = Array.isArray(this.solitonLibrary?.solitons)
      ? this.solitonLibrary.solitons
      : [];
    if (solitons.length <= 0) {
      this.params.selectedSoliton = "";
      this._skipNextSolitonParamsLoad = true;
      this._lastSolitonParamsSelection = "";
      return null;
    }

    this.params.selectedSoliton = "0";
    this._skipNextSolitonParamsLoad = true;
    this._lastSolitonParamsSelection = "0";
    return this.solitonLibrary.getSoliton(0);
  }

  _applySolitonSource() {
    if (!this.solitonLibrary || !this.solitonLibrary.setActiveDimension) return;
    this.solitonLibrary.setActiveDimension(this.params.dimension);
  }

  _normaliseImportedParamsPayload(rawParams, { allowGridSize = true } = {}) {
    const sanitised = { ...rawParams };

    if ("b" in sanitised && typeof sanitised.b === "string") {
      sanitised.b = sanitised.b
        .split(",")
        .map((v) => RLECodec.parseFraction(v))
        .filter((v) => Number.isFinite(v));
    }

    if (
      "selectedSoliton" in sanitised &&
      (sanitised.selectedSoliton === null ||
        sanitised.selectedSoliton === undefined)
    ) {
      sanitised.selectedSoliton = "";
    }

    if (!allowGridSize) {
      delete sanitised.latticeExtent;
    }

    if ("kernelParams" in sanitised && !Array.isArray(sanitised.kernelParams)) {
      delete sanitised.kernelParams;
    }

    return sanitised;
  }

  _applyImportedNumericConstraints(rawParams) {
    const p = this.params;
    const maxR = this.getMaxKernelRadius(p.latticeExtent);
    const maxT = this.getMaxTimeScale();

    const numericConstraints = {
      R: (v) => Math.round(constrain(v, 2, maxR)),
      T: (v) => Math.round(constrain(v, 1, maxT)),
      m: (v) => constrain(v, 0, 1),
      s: (v) => Math.max(0.0001, v),
      kn: (v) => Math.round(constrain(v, 1, 4)),
      gn: (v) => Math.round(constrain(v, 1, 3)),
      addNoise: (v) => constrain(v, 0, 10),
      maskRate: (v) => constrain(v, 0, 10),
      paramP: (v) => Math.round(constrain(v, 0, 64)),
      channelCount: (v) => Math.round(constrain(v, 1, 8)),
      selectedChannel: (v) => Math.max(0, Math.round(v)),
      channelShift: (v) => Math.round(constrain(v, 0, 17)),
      selectedKernel: (v) => Math.max(0, Math.round(v)),
      kernelCount: (v) => Math.round(constrain(v, 1, 4)),
      crossKernelCount: (v) => Math.round(constrain(v, 0, 4)),
      recordingFPS: (v) => Math.round(constrain(v, 12, 120)),
      videoBitrateMbps: (v) => constrain(v, 1, 64),
    };

    for (const [key, fn] of Object.entries(numericConstraints)) {
      if (key in rawParams && typeof p[key] === "number") {
        p[key] = fn(p[key]);
      }
    }
  }

  _coerceImportedNDParams(rawParams, { allowGridSize = true } = {}) {
    const p = this.params;

    if ("dimension" in rawParams) {
      p.dimension = NDCompatibility.coerceDimension(p.dimension);
      if (this.solitonLibrary?.setActiveDimension) {
        this.solitonLibrary.setActiveDimension(p.dimension);
      }
    }
    if ("viewMode" in rawParams) {
      p.viewMode = NDCompatibility.coerceViewMode(p.dimension, p.viewMode);
    }
    if ("ndDepth" in rawParams) {
      p.ndDepth = NDCompatibility.coerceDepth(p.ndDepth, p.dimension);
    }
    if ("ndSliceZ" in rawParams) {
      p.ndSliceZ = NDCompatibility.coerceSliceIndex(p.ndSliceZ, p.ndDepth);
    }
    if ("ndSliceW" in rawParams) {
      p.ndSliceW = NDCompatibility.coerceSliceIndex(p.ndSliceW, p.ndDepth);
    }
    if (!(allowGridSize && "latticeExtent" in rawParams)) {
      p.latticeExtent = NDCompatibility.coerceGridSize(
        p.latticeExtent,
        p.dimension,
      );
    }

    p.ndActiveAxis = this._coerceNDActiveAxis(p.ndActiveAxis, p.dimension);

    if (
      typeof this._normaliseKernelTopology === "function" &&
      ("channelCount" in rawParams ||
        "kernelCount" in rawParams ||
        "crossKernelCount" in rawParams ||
        "selectedKernel" in rawParams ||
        "selectedChannel" in rawParams ||
        "kernelParams" in rawParams)
    ) {
      this._normaliseKernelTopology();
      this._syncPrimaryParamsFromSelectedKernel();
    }

    if (!Array.isArray(p.b) || p.b.length === 0) {
      p.b = [1];
    }
  }

  _coerceImportedDisplayParams(
    rawParams,
    { prevColourMap, prevRenderMode, prevImageFormat } = {},
  ) {
    const p = this.params;

    if ("backendComputeDevice" in rawParams) {
      if (typeof this._normaliseBackendComputeDevice === "function") {
        p.backendComputeDevice = this._normaliseBackendComputeDevice(
          p.backendComputeDevice,
        );
        if (
          p.backendComputeDevice === "glsl" &&
          typeof this.isGLSLComputeSupported === "function" &&
          !this.isGLSLComputeSupported()
        ) {
          p.backendComputeDevice = "cpu";
        }
      } else {
        const backendTag = String(p.backendComputeDevice || "cpu")
          .trim()
          .toLowerCase();
        p.backendComputeDevice =
          backendTag === "glsl" ||
          backendTag === "glsl compute" ||
          backendTag === "webgl" ||
          backendTag === "webgl2" ||
          backendTag === "webgpu" ||
          backendTag === "webgpu compute"
            ? "glsl"
            : "cpu";
      }
    }

    if ("colourMap" in rawParams && !this.colourMapKeys.includes(p.colourMap)) {
      p.colourMap = prevColourMap;
    }

    if ("renderMode" in rawParams) {
      const importedMode = String(p.renderMode || "world")
        .trim()
        .toLowerCase();
      if (importedMode === "world_channels") {
        p.renderMode = "world";
      }
      if (!["world", "potential", "growth", "kernel"].includes(p.renderMode)) {
        p.renderMode =
          prevRenderMode === "world_channels" ? "world" : prevRenderMode;
      }
    }

    if ("imageFormat" in rawParams) {
      const fmt = String(p.imageFormat || "").toLowerCase();
      if (!["png", "jpg", "jpeg", "webm", "mp4"].includes(fmt)) {
        p.imageFormat = prevImageFormat;
      } else {
        p.imageFormat = fmt;
      }
    }
  }

  _coerceImportedSelectedSoliton(rawParams) {
    const p = this.params;
    if (!("selectedSoliton" in rawParams)) return;

    const incoming = rawParams.selectedSoliton;
    if (
      incoming === "" ||
      incoming === null ||
      typeof incoming === "undefined"
    ) {
      return;
    }

    const idx = parseInt(String(incoming), 10);
    if (
      !Number.isFinite(idx) ||
      !this.solitonLibrary ||
      idx < 0 ||
      idx >= this.solitonLibrary.solitons.length
    ) {
      p.selectedSoliton = "";
    }
  }

  _applyImportedParams(rawParams, { allowGridSize = true } = {}) {
    if (!rawParams || typeof rawParams !== "object") {
      return { latticeExtentChanged: false, dimensionChanged: false };
    }

    const p = this.params;
    const beforeGridSize = p.latticeExtent;
    const beforeDimension = p.dimension;
    const prevColourMap = p.colourMap;
    const prevRenderMode = p.renderMode;
    const prevImageFormat = p.imageFormat;

    const sanitised = this._normaliseImportedParamsPayload(rawParams, {
      allowGridSize,
    });

    this._mergeByTargetSchema(p, sanitised);

    if (allowGridSize && "latticeExtent" in rawParams) {
      p.latticeExtent = this._normaliseGridSize(p.latticeExtent);
    }

    this._applyImportedNumericConstraints(rawParams);
    this._coerceImportedNDParams(rawParams, { allowGridSize });
    this._coerceImportedDisplayParams(rawParams, {
      prevColourMap,
      prevRenderMode,
      prevImageFormat,
    });
    this._coerceImportedSelectedSoliton(rawParams);

    this._skipNextSolitonParamsLoad = true;
    this._lastSolitonParamsSelection = p.selectedSoliton || "";

    this._syncSelectedSolitonForActiveDimension(p.selectedSoliton);

    return {
      latticeExtentChanged: p.latticeExtent !== beforeGridSize,
      dimensionChanged: p.dimension !== beforeDimension,
    };
  }

  importWorldPayload(payload) {
    if (!payload || !payload.fields) return;

    this._queueAction("importWorld", () =>
      this._queueOrRunMutation(() => {
        const applied = this._applyImportedParams(payload.params, {
          allowGridSize: false,
        });

        const nextSize = this._normaliseGridSize(
          payload.size || this.params.latticeExtent,
        );
        const sizeChanged = nextSize !== this.params.latticeExtent;

        if (sizeChanged) {
          this.params.latticeExtent = nextSize;
          this._restartWorker();

          const canvasSize = min(windowWidth, windowHeight);
          resizeCanvas(canvasSize, canvasSize);
          this.board.resize(nextSize);
          this.renderer.resize(nextSize);
          this._pendingPlacement = null;
        }

        this._ensureBuffers();

        for (const key of Object.getOwnPropertyNames(this.board)) {
          if (key.startsWith("_")) continue;
          const target = this.board[key];
          if (!(target instanceof Float32Array)) continue;
          target.fill(0);
          const src = payload.fields[key];
          if (src instanceof Float32Array) {
            target.set(src.subarray(0, target.length));
          } else if (Array.isArray(src)) {
            const n = Math.min(src.length, target.length);
            for (let i = 0; i < n; i++) {
              const v = Number(src[i]);
              target[i] = Number.isFinite(v) ? v : 0;
            }
          }
        }

        this.automaton.reset();
        this.automaton.updateParameters(this.params);

        this.analyser.resetStatistics();
        this.analyser.reset();
        if (payload.statistics && typeof payload.statistics === "object") {
          this._mergeByTargetSchema(this.statistics, payload.statistics);
        }
        if (Array.isArray(payload.series)) {
          const importedSeries = this._normaliseImportedSeries(payload.series);
          if (typeof this.analyser.setSeries === "function") {
            this.analyser.setSeries(importedSeries);
          } else {
            this.analyser.series = importedSeries;
          }
        }

        this._workerSendKernel();
        if (
          applied?.dimensionChanged &&
          this.gui &&
          typeof this.gui.rebuildPane === "function"
        ) {
          this.gui.rebuildPane();
        } else {
          this.refreshGUI();
        }

        const fieldKeys = Object.keys(payload.fields);
        this._diagnosticsLogger.info(
          `Imported world: size=${this.params.latticeExtent}${sizeChanged ? " (resized)" : ""}, params=${payload.params ? "restored" : "unchanged"}, statistics=${payload.statistics ? "restored" : "reset"}, fields=[${fieldKeys.join(",")}], selectedSoliton=${this.params.selectedSoliton || "none"}`,
        );
      }),
    );
  }
}

AppCore.installMethodsFrom(AppCoreImportExportMethods);
