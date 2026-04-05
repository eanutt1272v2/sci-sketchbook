class Simulation {
  constructor(theme = null) {
    this._diagnosticsLogger =
      typeof AppDiagnostics !== "undefined" &&
      typeof AppDiagnostics.resolveLogger === "function"
        ? AppDiagnostics.resolveLogger("Cellular Division")
        : { info() {}, warn() {}, error() {}, debug() {} };
    this.alpha = 180;
    this.beta = 17;
    this.gamma = 13.4;
    this.radius = 15;
    this.trailAlpha = 200;
    this.densityThreshold = 20;
    this.particleCount = this.defaultParticleCount();
    this.startTime = 0;
    this.needsRestart = false;
    this.paused = false;
    this.isRestarting = false;
    this.restartCursor = 0;
    this.restartChunkSize = 0;

    this.species = null;
    this.particles = [];
    this.spatialGrid = null;
    this.cellTracker = null;

    this._worker = null;
    this._workerBusy = false;
    this._workerReady = false;
    this._lastResult = null;
    this._history = [];
    this._historySampleCounter = 0;
    this._workerStepIntervalMs = 22;
    this._workerStepAdaptiveOffsetMs = 0;
    this._lastWorkerStepMs = 0;
    this._lastPerfTuneMs = 0;
    this._particleBufferForWorker = null;
    this._renderParticleData = null;
    this._densityColours = {
      highDensity: "rgb(255,80,255)",
      veryDense: "rgb(255,255,100)",
      dense: "rgb(0,0,255)",
      moderate: "rgb(180,100,50)",
      sparse: "rgb(80,255,80)",
    };

    this.theme = theme;

    this._initWorker();
    this.restart();
  }

  _initWorker() {
    try {
      this._worker = new Worker("worker/SimulationWorker.js");
    } catch (e) {
      this._diagnosticsLogger.warn(
        "[Cellular Division] Worker unavailable, falling back to synchronous simulation",
        e,
      );
      this._worker = null;
      return;
    }
    this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
    this._worker.onerror = (e) => {
      this._handleWorkerFailure("runtime error", e);
    };
    this._worker.onmessageerror = (e) => {
      this._handleWorkerFailure("message deserialisation error", e);
    };
  }

  _postWorkerMessage(msg, transfers = [], context = "worker request") {
    if (!this._worker) return false;

    if (
      typeof AppDiagnostics !== "undefined" &&
      typeof AppDiagnostics.safePostMessage === "function"
    ) {
      return AppDiagnostics.safePostMessage(
        this._worker,
        msg,
        transfers,
        this._diagnosticsLogger,
        context,
      );
    }

    try {
      this._worker.postMessage(msg, transfers);
      return true;
    } catch (error) {
      this._diagnosticsLogger.error(`Failed ${context}`, error);
      return false;
    }
  }

  _handleWorkerFailure(reason, detail = null) {
    this._diagnosticsLogger.error(`Worker ${reason}`, detail);
    this._workerBusy = false;
    this._workerReady = false;
    this._particleBufferForWorker = null;
  }

  _sendWorkerParam(key, value) {
    if (!this._worker) return;
    this._postWorkerMessage(
      { type: "setParam", key, value },
      [],
      `setParam:${key}`,
    );
  }

  _terminateWorker() {
    if (!this._worker) return;

    this._worker.onmessage = null;
    this._worker.onerror = null;
    this._worker.onmessageerror = null;
    this._worker.terminate();
    this._worker = null;
    this._workerBusy = false;
    this._workerReady = false;
    this._particleBufferForWorker = null;
  }

  _postWorkerTick() {
    if (!this._worker) return;

    const msg = { type: "tick", particleDataBuffer: null };
    const transfers = [];
    const recycledBuffer = this._particleBufferForWorker;

    if (recycledBuffer) {
      msg.particleDataBuffer = recycledBuffer;
      transfers.push(recycledBuffer);
    }

    const posted = this._postWorkerMessage(msg, transfers, "tick dispatch");
    if (posted && recycledBuffer) {
      this._particleBufferForWorker = null;
    }
  }

  _sendWorkerInit() {
    if (!this._worker) return;
    this._workerReady = false;
    this._workerBusy = false;
    this._postWorkerMessage(
      {
        type: "restart",
        count: this.particleCount,
        canvasW: width,
        canvasH: height,
        alpha: this.alpha,
        beta: this.beta,
        gamma: this.gamma,
        radius: this.radius,
        densityThreshold: this.densityThreshold,
      },
      [],
      "restart dispatch",
    );
  }

  _onWorkerMessage(data) {
    if (!data || typeof data !== "object") {
      this._workerBusy = false;
      return;
    }

    if (data.type === "workerError") {
      const stage =
        typeof data.stage === "string" && data.stage
          ? data.stage
          : "unknown stage";
      const message =
        typeof data.message === "string" && data.message
          ? data.message
          : "unknown worker failure";
      this._handleWorkerFailure(
        `reported failure during ${stage}: ${message}`,
        data,
      );
      return;
    }

    if (data.type === "ready") {
      this._workerReady = true;
      this._workerBusy = false;
      this.isRestarting = false;
      this._history.length = 0;
      this._historySampleCounter = 0;
      this._particleBufferForWorker = null;
      return;
    }
    if (data.type !== "result") {
      this._workerBusy = false;
      return;
    }

    if (!(data.particleData instanceof ArrayBuffer)) {
      this._workerBusy = false;
      return;
    }

    this._workerBusy = false;
    const sourceParticleData = new Float32Array(data.particleData);
    const derivedCount = Math.floor(sourceParticleData.length / 4);
    const requestedCount = Math.round(Number(data.particleCount));
    const particleCount =
      Number.isFinite(requestedCount) &&
      requestedCount >= 0 &&
      requestedCount <= derivedCount
        ? requestedCount
        : derivedCount;

    if (
      !this._renderParticleData ||
      this._renderParticleData.length !== sourceParticleData.length
    ) {
      this._renderParticleData = new Float32Array(sourceParticleData.length);
    }
    this._renderParticleData.set(sourceParticleData);

    this._lastResult = {
      particleData: this._renderParticleData,
      particleCount,
      population: Number.isFinite(Number(data.population))
        ? Number(data.population)
        : 0,
      elapsed: Number.isFinite(Number(data.elapsed)) ? Number(data.elapsed) : 0,
      paused: data.paused,
    };
    this._particleBufferForWorker = data.particleData;
    this._historySampleCounter++;
    if ((this._historySampleCounter & 1) === 0) {
      this._history.push(data.population);
      if (this._history.length > width) {
        this._history.shift();
      }
    }
  }

  defaultParticleCount() {
    const calibrationConst = 120.96;
    return int((width * height) / calibrationConst);
  }

  restart() {
    if (this._worker) {
      this._sendWorkerInit();
      this.needsRestart = false;
      this.isRestarting = true;
      this.startTime = millis();
      return;
    }

    this.species = new Species(this.alpha, this.beta, this.gamma, this.radius);
    this.particles = [];
    this.spatialGrid = new Grid(Config.GRID_SIZE);
    this.cellTracker = new CellTracker();
    this.startTime = millis();
    this.needsRestart = false;

    this.restartCursor = 0;
    this.restartChunkSize = max(200, int(this.particleCount / 12));
    this.isRestarting = true;

    this._buildParticlesChunk();
  }

  _buildParticlesChunk() {
    if (!this.isRestarting) return;

    const target = min(
      this.restartCursor + this.restartChunkSize,
      this.particleCount,
    );
    for (let i = this.restartCursor; i < target; i++) {
      this.particles.push(new Particle());
    }

    this.restartCursor = target;
    if (this.restartCursor >= this.particleCount) {
      this.isRestarting = false;
    }
  }

  update() {
    if (this.needsRestart) {
      this.restart();
    }

    if (this._worker) {
      const activeCount = this._lastResult
        ? this._lastResult.particleCount
        : this.particleCount;
      const baseIntervalMs = activeCount > 7000 ? 30 : 22;
      this._workerStepIntervalMs =
        baseIntervalMs + this._workerStepAdaptiveOffsetMs;
      const nowMs = millis();

      if (nowMs - this._lastPerfTuneMs >= 400) {
        this._lastPerfTuneMs = nowMs;
        const fps = Number(frameRate()) || 0;
        if (fps > 0 && fps < 58) {
          this._workerStepAdaptiveOffsetMs = Math.min(
            18,
            this._workerStepAdaptiveOffsetMs + 2,
          );
        } else if (fps > 72) {
          this._workerStepAdaptiveOffsetMs = Math.max(
            0,
            this._workerStepAdaptiveOffsetMs - 1,
          );
        }
      }

      if (
        this._workerReady &&
        !this._workerBusy &&
        !this.paused &&
        nowMs - this._lastWorkerStepMs >= this._workerStepIntervalMs
      ) {
        this._workerBusy = true;
        this._lastWorkerStepMs = nowMs;
        this._postWorkerTick();
      }
      return;
    }

    if (this.isRestarting) {
      this._buildParticlesChunk();
      return;
    }

    if (this.paused) {
      return;
    }

    this.spatialGrid.clear();
    for (const p of this.particles) {
      this.spatialGrid.add(p);
      p.markUnvisited();
    }

    for (const p of this.particles) {
      p.countNeighbours(this.spatialGrid, this.species);
      p.updateHighDensity(this.densityThreshold);
      p.move(this.species);
    }

    this.cellTracker.update(this.particles, this.spatialGrid);
  }

  render() {
    this.renderTrail();
    strokeWeight(1);
    colorMode(RGB, 255);

    if (this._worker) {
      if (!this._lastResult) return;
      const { particleData, particleCount } = this._lastResult;
      const ctx = drawingContext;
      const colours = this._densityColours;

      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      let currentFill = "";

      for (let i = 0; i < particleCount; i++) {
        const base = i * 4;
        const closeCount = particleData[base + 2];
        const neighbourCount = particleData[base + 3];

        let nextFill = colours.sparse;
        if (closeCount > 15) {
          nextFill = colours.highDensity;
        } else if (neighbourCount > 35) {
          nextFill = colours.veryDense;
        } else if (neighbourCount > 15) {
          nextFill = colours.dense;
        } else if (neighbourCount >= 13) {
          nextFill = colours.moderate;
        } else {
          nextFill = colours.sparse;
        }

        if (nextFill !== currentFill) {
          currentFill = nextFill;
          ctx.fillStyle = currentFill;
        }

        ctx.fillRect(particleData[base], particleData[base + 1], 2, 2);
      }

      ctx.restore();
      return;
    }

    for (const p of this.particles) {
      p.render();
    }
  }

  renderTrail() {
    noStroke();
    if (this.theme && this.theme.trailFade) {
      const fade = color(this.theme.trailFade);
      fade.setAlpha(255 - this.trailAlpha);
      fill(fade);
    } else {
      fill(0, 255 - this.trailAlpha);
    }
    rect(0, 0, width, height);
  }

  getAlpha() {
    return this.alpha;
  }

  getBeta() {
    return this.beta;
  }

  getGamma() {
    return this.gamma;
  }

  getRadius() {
    return this.radius;
  }

  getTrailAlpha() {
    return this.trailAlpha;
  }

  getDensityThreshold() {
    return this.densityThreshold;
  }

  getParticleCount() {
    if (this._worker) {
      return this._lastResult ? this._lastResult.particleCount : 0;
    }
    return this.isRestarting ? this.particles.length : this.particleCount;
  }

  getCellPopulation() {
    if (this._worker) {
      return this._lastResult ? this._lastResult.population : 0;
    }
    return this.cellTracker.getPopulation();
  }

  getElapsedSeconds() {
    if (this._worker) {
      return this._lastResult ? int(this._lastResult.elapsed / 1000) : 0;
    }
    return int((millis() - this.startTime) / 1000);
  }

  getCellHistory() {
    if (this._worker) {
      return this._history;
    }
    return this.cellTracker.getHistory();
  }

  setAlpha(value) {
    this.alpha = constrain(value, 0, 360);
    this.updateSpecies();
    this._sendWorkerParam("alpha", this.alpha);
  }

  setBeta(value) {
    this.beta = constrain(value, 0, 90);
    this.updateSpecies();
    this._sendWorkerParam("beta", this.beta);
  }

  setGamma(value) {
    this.gamma = constrain(value, 0, 50);
    this.updateSpecies();
    this._sendWorkerParam("gamma", this.gamma);
  }

  setRadius(value) {
    this.radius = constrain(value, 5, 50);
    this.updateSpecies();
    this._sendWorkerParam("radius", this.radius);
  }

  setTrailAlpha(value) {
    this.trailAlpha = constrain(value, 0, 255);
  }

  setDensityThreshold(value) {
    this.densityThreshold = constrain(value, 1, 60);
    this._sendWorkerParam("densityThreshold", this.densityThreshold);
  }

  setParticleCount(value) {
    this.particleCount = constrain(
      value,
      Config.MIN_PARTICLES,
      Config.MAX_PARTICLES,
    );
  }

  requestRestart() {
    this.needsRestart = true;
  }

  togglePause() {
    this.paused = !this.paused;
    if (this._worker) {
      this._postWorkerMessage(
        { type: "setPaused", value: this.paused },
        [],
        "pause toggle",
      );
    }
  }

  isPaused() {
    return this.paused;
  }

  updateSpecies() {
    this.species = new Species(this.alpha, this.beta, this.gamma, this.radius);
  }

  setTheme(theme) {
    this.theme = theme;
  }

  dispose() {
    this._terminateWorker();
    this._lastResult = null;
    this._history.length = 0;
    this._particleBufferForWorker = null;
    this._renderParticleData = null;
    this.particles.length = 0;
    this.spatialGrid = null;
    this.cellTracker = null;
    this.species = null;
  }
}
