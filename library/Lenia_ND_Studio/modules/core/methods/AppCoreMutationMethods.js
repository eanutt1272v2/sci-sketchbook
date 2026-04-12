class AppCoreMutationMethods {
  clearWorld() {
    this._queueAction("clearWorld", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        this.board.clear();
        if ((this.params.dimension || 2) > 2) {
          this._workerNDMutation({ type: "clear" });
        }
        this.analyser.resetStatistics();
        this.analyser.reset();
      }),
    );
  }

  randomiseWorld() {
    this._queueAction("randomiseWorld", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this.board.clear();
          this._workerNDMutation({ type: "randomise" });
        } else {
          this.board.randomise(this.automaton.R);
        }
        this.analyser.resetStatistics();
      }),
    );
  }

  randomWorldWithSeed(seed = null, isFill = false) {
    this._queueAction("randomWorldSeed", () =>
      this._queueOrRunMutation(() => {
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this.board.clear();
          this._workerNDMutation({ type: "randomise" });
        } else {
          const usedSeed = this.board.randomiseSeeded(
            this.params.R,
            seed,
            isFill,
          );
          this._lastRandomSeed = usedSeed;
        }
        this.analyser.resetStatistics();
        this.analyser.reset();
        this.automaton.reset();
      }),
    );
  }

  randomiseParams(incremental = false) {
    this._queueAction("randomiseParams", () =>
      this._queueOrRunMutation(() => {
        const p = this.params;
        const size2 = Math.log2(p.latticeExtent);
        const dim = p.dimension || 2;
        const randR1 = Math.floor(Math.pow(2, size2 - 7) * dim * 5);
        const randR2 = Math.floor(Math.pow(2, size2 - 5) * dim * 5);

        if (incremental) {
          const isSmall = Math.random() < 0.2;
          const localAdj = (val, delta, vmin, vmax, digits) => {
            const f = Math.pow(10, digits);
            return (
              Math.round(
                Math.max(
                  vmin,
                  Math.min(vmax, val + (Math.random() * 2 - 1) * delta),
                ) * f,
              ) / f
            );
          };
          p.m = localAdj(p.m, isSmall ? 0.02 : 0.05, 0.1, 1.0, 3);
          p.s = localAdj(p.s, isSmall ? 0.002 : 0.005, 0.01, 1.0, 4);
          p.h = localAdj(p.h, 0.1, 0.1, 1.0, 2);
          if (!isSmall && Math.random() < 0.08 && p.b.length > 1) {
            p.b.pop();
            if (p.b.length === 1) p.b = [1];
          } else if (!isSmall && Math.random() < 0.08 && p.b.length < 3) {
            p.b.push(0);
          }
          if (!(p.b.length === 1 && p.b[0] === 1)) {
            for (let bi = 0; bi < p.b.length; bi++) {
              if (Math.random() < (isSmall ? 0.04 : 0.2)) {
                const step = (Math.floor(Math.random() * 3) - 1) / 12;
                p.b[bi] = Math.max(
                  0,
                  Math.min(1, Math.round((p.b[bi] + step) * 12) / 12),
                );
              }
            }
          }
        } else {
          const R =
            randR1 < randR2
              ? randR1 + Math.floor(Math.random() * (randR2 - randR1))
              : randR1;
          p.R = Math.round(Math.max(2, Math.min(this.getMaxKernelRadius(), R)));
          const B = 1 + Math.floor(Math.random() * 2);
          p.b = Array.from(
            { length: B },
            () => Math.round(Math.random() * 12) / 12,
          );
          p.b[Math.floor(Math.random() * B)] = 1;
          const globalRand = (vmin, vmax, digits) => {
            const f = Math.pow(10, digits);
            return Math.round((Math.random() * (vmax - vmin) + vmin) * f) / f;
          };
          p.m = globalRand(0.1, 0.5, 3);
          const sFactor = Math.random() * 2.5 + 0.5;
          p.s = Math.round((p.m / 10) * sFactor * 10000) / 10000;
          p.h = globalRand(0.1, 1.0, 2);
        }
        this.updateAutomatonParams();
      }),
    );
  }

  shiftWorld(dx, dy) {
    this._queueAction("shiftWorld", () =>
      this._queueOrRunMutation(() => {
        if (!this.board.world) return;
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this._workerTransform({ shift: [dx, dy] });
        } else {
          this.board.shift(dx, dy);
        }
      }),
    );
  }

  rotateWorld(angle) {
    this._queueAction("rotateWorld", () =>
      this._queueOrRunMutation(() => {
        if (!this.board.world) return;
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this._workerTransform({ rotate: angle });
        } else {
          this.board.rotate(angle);
        }
      }),
    );
  }

  flipWorld(mode) {
    this._queueAction("flipWorld", () =>
      this._queueOrRunMutation(() => {
        if (!this.board.world) return;
        this._ensureBuffers();
        if ((this.params.dimension || 2) > 2) {
          this._workerTransform({ flip: mode });
        } else {
          this.board.flip(mode);
        }
      }),
    );
  }

  zoomWorld(newR) {
    const maxR = this.getMaxKernelRadius();
    const targetR = Math.round(
      constrain(Number(newR) || this.params.R, 2, maxR),
    );
    const appliedR = Number(this._prevR);
    const safeAppliedR =
      Number.isFinite(appliedR) && appliedR > 0 ? appliedR : targetR;
    const factor = targetR / safeAppliedR;

    if (Math.abs(factor - 1) > 1e-6) {
      const kernels =
        typeof this.getKernelParams === "function"
          ? this.getKernelParams()
          : Array.isArray(this.params.kernelParams)
            ? this.params.kernelParams
            : [];

      if (Array.isArray(kernels) && kernels.length > 0) {
        const selectedKernel = Math.max(
          0,
          Math.min(
            kernels.length - 1,
            Math.floor(Number(this.params.selectedKernel) || 0),
          ),
        );

        for (let i = 0; i < kernels.length; i++) {
          const kernel = kernels[i];
          if (!kernel || typeof kernel !== "object") continue;
          const sourceR = Number(kernel.R);
          const safeR =
            Number.isFinite(sourceR) && sourceR > 0 ? sourceR : safeAppliedR;
          kernel.R = Math.round(constrain(safeR * factor, 2, maxR));
        }

        if (
          kernels[selectedKernel] &&
          typeof kernels[selectedKernel] === "object"
        ) {
          kernels[selectedKernel].R = targetR;
        }

        this.params.kernelParams = kernels;
      }
    }

    this.params.R = targetR;
    if (typeof this.syncPlacementScaleToRadius === "function") {
      this.syncPlacementScaleToRadius(this.params.selectedSoliton);
    }

    this._queueAction("zoomWorld", () =>
      this._queueOrRunMutation(() => {
        const hasBoard = !!this.board.world;
        if (hasBoard && Math.abs(factor - 1) > 1e-6) {
          this._ensureBuffers();
          if ((this.params.dimension || 2) > 2) {
            this._workerTransform({ zoom: factor });
          } else {
            this.board.zoom(factor);
          }
        }
        this.updateAutomatonParams();
        this._prevR = targetR;
      }),
    );
  }

  _workerTransform(transform) {
    if (!this._worker) return;
    if (this._workerBusy) {
      this._pendingMutations.push(() => this._workerTransform(transform));
      return;
    }
    const b = this.board;
    const ndConfig = this.buildNDConfig();
    const transfers = [b.world.buffer, b.potential.buffer, b.growth.buffer];
    const msg = {
      type: "transform",
      params: { ...this.params, size: this.params.latticeExtent },
      ndConfig,
      world: b.world.buffer,
      potential: b.potential.buffer,
      growth: b.growth.buffer,
      transform,
    };
    this._inflightViewExpectedLength =
      b.world && typeof b.world.length === "number" ? b.world.length : null;
    b.world = null;
    b.potential = null;
    b.growth = null;
    this._workerBusy = true;
    this._worker.postMessage(msg, transfers);
  }

  _workerNDMutation(mutation) {
    if (!this._worker) return;
    if (this._workerBusy) {
      this._pendingMutations.push(() => this._workerNDMutation(mutation));
      return;
    }
    const b = this.board;
    this._ensureBuffers();
    const ndConfig = this.buildNDConfig();
    const safeMutation =
      mutation && typeof mutation === "object" ? mutation : {};

    const toNDMutationMode = (modeOrType) => {
      const numeric = Number(modeOrType);
      if (Number.isFinite(numeric)) return Math.floor(numeric);

      const text = String(modeOrType || "")
        .trim()
        .toLowerCase();
      if (text === "randomise" || text === "randomize") return 0;
      if (text === "clear") return 1;
      if (text === "place") return 2;
      if (text === "placend" || text === "place_nd" || text === "place-nd") {
        return 3;
      }
      return -1;
    };

    const inferredMode =
      safeMutation.mode != null
        ? Number(safeMutation.mode)
        : toNDMutationMode(safeMutation.type);
    const mutationPayload =
      Number.isFinite(inferredMode) && inferredMode >= 0
        ? { ...safeMutation, mode: Math.floor(inferredMode) }
        : safeMutation;

    const toFloat32Pattern = (value) => {
      if (value instanceof Float32Array) return value;
      if (value instanceof ArrayBuffer) return new Float32Array(value);
      if (ArrayBuffer.isView(value)) {
        const bytes = new Uint8Array(
          value.buffer,
          value.byteOffset,
          value.byteLength,
        );
        const cloned = new Uint8Array(bytes.length);
        cloned.set(bytes);
        const usableLength = Math.floor(cloned.byteLength / 4);
        return new Float32Array(cloned.buffer, 0, usableLength);
      }
      if (Array.isArray(value)) {
        return Float32Array.from(value, (v) => Number(v) || 0);
      }
      return new Float32Array(0);
    };

    const transferSeen = new Set();
    const transfers = [];
    const addTransfer = (buffer) => {
      if (!(buffer instanceof ArrayBuffer)) return;
      if (transferSeen.has(buffer)) return;
      transferSeen.add(buffer);
      transfers.push(buffer);
    };

    addTransfer(b.world.buffer);
    addTransfer(b.potential.buffer);
    addTransfer(b.growth.buffer);

    const msg = {
      type: "ndMutation",
      params: { ...this.params, size: this.params.latticeExtent },
      ndConfig,
      world: b.world.buffer,
      potential: b.potential.buffer,
      growth: b.growth.buffer,
      mutation: mutationPayload,
    };
    this._inflightViewExpectedLength =
      b.world && typeof b.world.length === "number" ? b.world.length : null;
    if (mutationPayload.patternData) {
      const pattern = toFloat32Pattern(mutationPayload.patternData);
      msg.mutation = { ...mutationPayload, patternData: pattern.buffer };
      addTransfer(pattern.buffer);
    }
    if (Array.isArray(mutationPayload.planeEntries)) {
      const planeEntries = mutationPayload.planeEntries.map((entry = {}) => {
        const pattern = toFloat32Pattern(entry.patternData);
        addTransfer(pattern.buffer);
        return {
          ...entry,
          patternData: pattern.buffer,
        };
      });

      msg.mutation = {
        ...mutationPayload,
        planeEntries,
      };
    }
    b.world = null;
    b.potential = null;
    b.growth = null;
    this._workerBusy = true;
    this._worker.postMessage(msg, transfers);
  }

  changeResolution() {
    this._resolutionTransitionActive = true;
    this._queueAction("changeResolution", () =>
      this._queueOrRunMutation(() => {
        try {
          this._restartWorker();

          const canvasSize = min(windowWidth, windowHeight);
          const prevSize = this.board?.size || this.params.latticeExtent;
          const dim = Math.max(
            2,
            Math.floor(Number(this.params.dimension) || 2),
          );
          const pendingPlacement = this._normalisePlacementRequest(
            this._pendingPlacement,
            prevSize,
            this.params.latticeExtent,
          );
          resizeCanvas(canvasSize, canvasSize);
          if (
            dim <= 2 &&
            this.board?.world &&
            prevSize > 0 &&
            prevSize !== this.params.latticeExtent
          ) {
            this.board.resample(this.params.latticeExtent);
          } else {
            this.board.resize(this.params.latticeExtent);
          }
          this.renderer.resize(this.params.latticeExtent);

          this._pendingPlacement = pendingPlacement;
          this.analyser.reset();
          this.analyser.resetStatistics();

          this.automaton.updateParameters(this.params);
          this._prevR = this.params.R;

          this._workerSendKernel();

          if (this.gui && typeof this.gui.rebuildPane === "function") {
            this.gui.rebuildPane();
          } else {
            this.refreshGUI();
          }
        } finally {
          this._resolutionTransitionActive = false;
        }
      }),
    );
  }
  _restartWorker() {
    if (!this._worker) return;
    this._worker.terminate();
    this._worker = null;
    this._workerBusy = false;
    this._stepPending = false;
    this._kernelPending = false;
    this._viewPending = false;
    this._changeRecycleBuffer = null;
    this._inflightViewExpectedLength = null;
    this._inflightStepExpectedLength = null;
    this._pendingMutations.length = 0;
    this._initWorker();
  }

  _queueAction(name, handler) {
    this._pendingActions = this._pendingActions.filter(
      (action) => action.name !== name,
    );
    this._pendingActions.push({ name, handler });
  }

  _runNextAction() {
    const next = this._pendingActions.shift();
    if (!next || typeof next.handler !== "function") return;
    next.handler();
  }

  loadInitialSoliton() {
    if (
      !this.solitonLibrary.loaded ||
      this.solitonLibrary.solitons.length === 0
    )
      return;

    const firstSoliton = this._setSelectedSolitonForActiveDimension(0, {
      fallbackIndex: 0,
      skipNextParamsLoad: true,
    });
    if (firstSoliton) {
      this.loadSoliton(firstSoliton, {
        preserveScaleFactor: true,
        preservedScaleFactor: this._getHiddenSolitonScaleFactor(1),
      });
      this.refreshGUI();
    }
  }
}

AppCore.installMethodsFrom(AppCoreMutationMethods);
