class AppCoreImportExportMethods {
  _normaliseGridSize(size) {
    return NDCompat.coerceGridSize(size, this.params.dimension);
  }

  _syncSelectedAnimalForActiveDimension(preferredSelection = null) {
    this._applyAnimalSource();

    const animals = Array.isArray(this.animalLibrary?.animals)
      ? this.animalLibrary.animals
      : [];
    const total = animals.length;

    if (total <= 0) {
      this.params.selectedAnimal = "";
      this._skipNextAnimalParamsLoad = true;
      this._lastAnimalParamsSelection = "";
      return null;
    }

    const raw =
      preferredSelection !== null && typeof preferredSelection !== "undefined"
        ? preferredSelection
        : this.params.selectedAnimal;
    let idx = parseInt(String(raw), 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= total) {
      idx = 0;
    }

    this.params.selectedAnimal = String(idx);
    this._skipNextAnimalParamsLoad = true;
    this._lastAnimalParamsSelection = this.params.selectedAnimal;
    return this.animalLibrary.getAnimal(idx);
  }

  _applyAnimalSource() {
    if (!this.animalLibrary || !this.animalLibrary.setActiveDimension) return;
    this.animalLibrary.setActiveDimension(this.params.dimension);
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
      "selectedAnimal" in sanitised &&
      (sanitised.selectedAnimal === null ||
        sanitised.selectedAnimal === undefined)
    ) {
      sanitised.selectedAnimal = "";
    }

    if (!allowGridSize) {
      delete sanitised.latticeExtent;
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
      placeScale: (v) => constrain(v, 0.25, 4),
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
      p.dimension = NDCompat.coerceDimension(p.dimension);
      if (this.animalLibrary?.setActiveDimension) {
        this.animalLibrary.setActiveDimension(p.dimension);
      }
    }
    if ("viewMode" in rawParams) {
      p.viewMode = NDCompat.coerceViewMode(p.dimension, p.viewMode);
    }
    if ("ndDepth" in rawParams) {
      p.ndDepth = NDCompat.coerceDepth(p.ndDepth, p.dimension);
    }
    if ("ndSliceZ" in rawParams) {
      p.ndSliceZ = NDCompat.coerceSliceIndex(p.ndSliceZ, p.ndDepth);
    }
    if ("ndSliceW" in rawParams) {
      p.ndSliceW = NDCompat.coerceSliceIndex(p.ndSliceW, p.ndDepth);
    }
    if (!(allowGridSize && "latticeExtent" in rawParams)) {
      p.latticeExtent = NDCompat.coerceGridSize(p.latticeExtent, p.dimension);
    }

    p.ndActiveAxis = this._coerceNDActiveAxis(p.ndActiveAxis, p.dimension);

    if (!Array.isArray(p.b) || p.b.length === 0) {
      p.b = [1];
    }
  }

  _coerceImportedDisplayParams(
    rawParams,
    { prevColourMap, prevRenderMode, prevImageFormat } = {},
  ) {
    const p = this.params;

    if ("colourMap" in rawParams && !this.colourMapKeys.includes(p.colourMap)) {
      p.colourMap = prevColourMap;
    }

    if (
      "renderMode" in rawParams &&
      !["world", "potential", "growth", "kernel"].includes(p.renderMode)
    ) {
      p.renderMode = prevRenderMode;
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

  _coerceImportedSelectedAnimal(rawParams) {
    const p = this.params;
    if (!("selectedAnimal" in rawParams)) return;

    const incoming = rawParams.selectedAnimal;
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
      !this.animalLibrary ||
      idx < 0 ||
      idx >= this.animalLibrary.animals.length
    ) {
      p.selectedAnimal = "";
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
    this._coerceImportedSelectedAnimal(rawParams);

    this._skipNextAnimalParamsLoad = true;
    this._lastAnimalParamsSelection = p.selectedAnimal || "";
    this._lastPlacementScale = Math.max(
      0.25,
      Math.min(4, Number(p.placeScale) || 1),
    );

    this._syncSelectedAnimalForActiveDimension(p.selectedAnimal);

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
          `Imported world: size=${this.params.latticeExtent}${sizeChanged ? " (resized)" : ""}, params=${payload.params ? "restored" : "unchanged"}, stats=${payload.statistics ? "restored" : "reset"}, fields=[${fieldKeys.join(",")}], selectedAnimal=${this.params.selectedAnimal || "none"}, placeScale=${this.params.placeScale || 1}`,
        );
      }),
    );
  }
}

AppCore.installMethodsFrom(AppCoreImportExportMethods);
