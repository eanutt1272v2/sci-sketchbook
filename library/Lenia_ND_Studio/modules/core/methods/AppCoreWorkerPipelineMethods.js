class AppCoreWorkerPipelineMethods {
  _ensureDiagnosticsLogger() {
    if (
      this._diagnosticsLogger &&
      typeof this._diagnosticsLogger.error === "function"
    ) {
      return this._diagnosticsLogger;
    }

    this._diagnosticsLogger =
      typeof AppDiagnostics !== "undefined" &&
      typeof AppDiagnostics.resolveLogger === "function"
        ? AppDiagnostics.resolveLogger("Lenia", this._diagnosticsLogger)
        : { info() {}, warn() {}, error() {}, debug() {} };

    return this._diagnosticsLogger;
  }

  _logWarn(message, ...rest) {
    this._ensureDiagnosticsLogger().warn(message, ...rest);
  }

  _logError(message, ...rest) {
    this._ensureDiagnosticsLogger().error(message, ...rest);
  }

  _logDebug(message, ...rest) {
    this._ensureDiagnosticsLogger().debug(message, ...rest);
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
      this._logError(`Failed ${context}`, error);
      return false;
    }
  }

  _handleWorkerFailure(reason, detail = null) {
    this._logError(`Worker ${reason}`, detail);

    this._workerBusy = false;
    this._stepPending = false;
    this._kernelPending = false;
    this._viewPending = false;
    this._changeRecycleBuffer = null;

    const dim = Math.max(2, Math.floor(Number(this.params.dimension) || 2));
    if (dim > 2) {
      const safeSize = NDCompatibility.coerceGridSize(this.params.latticeExtent, dim);
      if (safeSize < this.params.latticeExtent) {
        this._logWarn(
          `Recovering from worker failure by reducing ${dim}D grid size from ${this.params.latticeExtent} to ${safeSize}.`,
        );
        this.params.latticeExtent = safeSize;
        this.changeResolution();
        return;
      }
    }

    this._ensureBuffers();
    this._flushPendingMutations();
    this._tryExecutePendingPlacement();
  }

  _initWorker() {
    try {
      this._worker = new Worker("./modules/worker/LeniaWorker.js");
    } catch (e) {
      throw new Error("[Lenia] Worker is required but could not be created.");
    }

    this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
    this._worker.onerror = (e) => {
      this._handleWorkerFailure("runtime error", e);
    };
    this._worker.onmessageerror = (e) => {
      this._handleWorkerFailure("message deserialisation error", e);
    };

    this._workerSendKernel();
  }

  _workerSendKernel() {
    const dim = Math.max(2, Math.floor(Number(this.params.dimension) || 2));
    if (dim > 2) {
      const safeSize = NDCompatibility.coerceGridSize(this.params.latticeExtent, dim);
      if (safeSize !== this.params.latticeExtent) {
        this._logWarn(
          `Reducing ${dim}D grid size from ${this.params.latticeExtent} to ${safeSize} to avoid excessive worker memory usage.`,
        );
        this.params.latticeExtent = safeSize;
        this.changeResolution();
        return;
      }
    }

    if (!this._worker) return;
    if (this._workerBusy) {
      this._kernelPending = true;
      return;
    }
    this._kernelPending = false;
    const ndConfig = this.buildNDConfig();
    const posted = this._postWorkerMessage(
      {
        type: "kernel",
        params: { ...this.params, size: this.params.latticeExtent },
        ndConfig,
      },
      [],
      "kernel dispatch",
    );
    if (!posted) {
      this._workerBusy = false;
      this._kernelPending = true;
      return;
    }
    this._workerBusy = true;
  }

  _bufferToFloat32(buffer, expectedLength) {
    let view = null;
    if (buffer instanceof ArrayBuffer) {
      view = new Float32Array(buffer);
    } else if (ArrayBuffer.isView(buffer)) {
      if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
        return null;
      }
      view = new Float32Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
      );
    } else {
      return null;
    }

    if (view.length !== expectedLength) {
      return null;
    }

    return view;
  }

  _getFloatPayloadLength(buffer) {
    if (buffer instanceof ArrayBuffer) {
      if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) return null;
      return buffer.byteLength / Float32Array.BYTES_PER_ELEMENT;
    }

    if (ArrayBuffer.isView(buffer)) {
      if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) return null;
      return buffer.byteLength / Float32Array.BYTES_PER_ELEMENT;
    }

    return null;
  }

  _isKernelPayloadValid(data) {
    if (!data || typeof data !== "object") return false;

    const getElementCount = (value, bytesPerElement) => {
      if (value instanceof ArrayBuffer) {
        if (value.byteLength % bytesPerElement !== 0) return null;
        return value.byteLength / bytesPerElement;
      }

      if (ArrayBuffer.isView(value)) {
        if (value.byteLength % bytesPerElement !== 0) return null;
        return value.byteLength / bytesPerElement;
      }

      return null;
    };

    const kernelSize = Number(data.kernelSize);
    if (!Number.isFinite(kernelSize) || kernelSize <= 0) return false;

    const expectedKernelLen = Math.round(kernelSize) * Math.round(kernelSize);
    if (!Number.isFinite(expectedKernelLen) || expectedKernelLen <= 0) {
      return false;
    }

    const kernelFloatLen = getElementCount(
      data.kernel,
      Float32Array.BYTES_PER_ELEMENT,
    );
    const kernelDxLen = getElementCount(
      data.kernelDX,
      Int16Array.BYTES_PER_ELEMENT,
    );
    const kernelDyLen = getElementCount(
      data.kernelDY,
      Int16Array.BYTES_PER_ELEMENT,
    );
    const kernelValuesLen = getElementCount(
      data.kernelValues,
      Float32Array.BYTES_PER_ELEMENT,
    );

    if (
      !Number.isInteger(kernelFloatLen) ||
      kernelFloatLen !== expectedKernelLen
    )
      return false;
    if (!Number.isInteger(kernelDxLen) || kernelDxLen < 0) return false;
    if (!Number.isInteger(kernelDyLen) || kernelDyLen < 0) return false;
    if (!Number.isInteger(kernelValuesLen) || kernelValuesLen < 0) return false;

    if (kernelDxLen > expectedKernelLen) return false;
    if (kernelDyLen > expectedKernelLen) return false;
    if (kernelValuesLen > expectedKernelLen) return false;

    return kernelDxLen === kernelDyLen && kernelDyLen === kernelValuesLen;
  }

  _normaliseImportedSeries(series, maxRows = 10000, maxCols = 64) {
    if (!Array.isArray(series)) return [];
    const start = Math.max(0, series.length - maxRows);
    const out = [];
    for (let i = start; i < series.length; i++) {
      const row = series[i];
      if (!Array.isArray(row)) continue;
      const safeRow = new Array(Math.min(row.length, maxCols));
      for (let j = 0; j < safeRow.length; j++) {
        const n = Number(row[j]);
        safeRow[j] = Number.isFinite(n) ? n : 0;
      }
      out.push(safeRow);
    }
    return out;
  }

  _normalisePlacementRequest(
    request,
    fromSize = this.params.latticeExtent,
    toSize = this.params.latticeExtent,
  ) {
    if (!request || typeof request !== "object") return null;

    const sourceSize = Math.max(1, Math.floor(Number(fromSize) || 1));
    const targetSize = Math.max(1, Math.floor(Number(toSize) || 1));

    const rawCellX = Math.floor(Number(request.cellX));
    const rawCellY = Math.floor(Number(request.cellY));
    if (!Number.isFinite(rawCellX) || !Number.isFinite(rawCellY)) return null;

    const remap = (coord) => {
      if (sourceSize === targetSize) {
        return ((coord % targetSize) + targetSize) % targetSize;
      }

      const ratio = (coord + 0.5) / sourceSize;
      const mapped = Math.floor(ratio * targetSize);
      return ((mapped % targetSize) + targetSize) % targetSize;
    };

    const rawScale = Number(request.scale);
    const scale = Number.isFinite(rawScale) ? rawScale : 1;

    return {
      selection:
        request.selection === null || typeof request.selection === "undefined"
          ? ""
          : String(request.selection),
      cellX: remap(rawCellX),
      cellY: remap(rawCellY),
      scale,
    };
  }

  _tryExecutePendingPlacement() {
    if (!this._pendingPlacement) return;
    if (this._workerBusy) return;
    if (this._resolutionTransitionActive) return;
    if (this._hasQueuedAction("changeResolution")) return;
    if (!this.board.world) return;

    const boardSize = this.board?.size || this.params.latticeExtent;
    const pp = this._normalisePlacementRequest(
      this._pendingPlacement,
      boardSize,
      boardSize,
    );
    this._pendingPlacement = null;
    if (!pp) return;
    this._executePlacementRequest(pp);
  }

  _resetWorkerAfterPayloadIssue({
    ensureBuffers = false,
    clearChangeRecycleBuffer = false,
  } = {}) {
    this._workerBusy = false;
    if (clearChangeRecycleBuffer) {
      this._changeRecycleBuffer = null;
    }
    if (ensureBuffers) {
      this._ensureBuffers();
    }
    this._flushPendingMutations();
    this._tryExecutePendingPlacement();
  }

  _logStaleWorkerPayload(kind, payloadLength, expectedLength) {
    const message = `Ignoring stale ${kind} payload (len=${payloadLength}, expected=${expectedLength})`;
    if (
      this._resolutionTransitionActive ||
      this._hasQueuedAction("changeResolution")
    ) {
      this._logDebug(message);
      return;
    }

    this._logWarn(message);
  }

  _onWorkerMessage(data) {
    if (data && typeof data === "object" && data.type === "workerError") {
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

    if (!data || typeof data !== "object" || typeof data.type !== "string") {
      this._workerBusy = false;
      return;
    }

    const expectedSize = this.board?.size || this.params.latticeExtent;
    const expectedLength = expectedSize * expectedSize;

    if (data.type === "kernelReady") {
      if (!this._isKernelPayloadValid(data)) {
        this._logError("Ignoring malformed kernelReady payload");
        this._resetWorkerAfterPayloadIssue();
        return;
      }

      this.automaton.applyWorkerKernel(data);
      this._workerBusy = false;

      this._flushPendingMutations();

      if (this._kernelPending) {
        this._workerSendKernel();
        return;
      }
      if (this._viewPending) {
        this._viewPending = false;
        this._workerRequestView();
        return;
      }

      this._tryExecutePendingPlacement();

      if (
        (Number(this.params.dimension) || 2) > 2 &&
        this.board.world &&
        !this._stepPending
      ) {
        this._workerRequestView();
        return;
      }
      if (this._stepPending) {
        this._stepPending = false;
        this._dispatchWorkerStep();
      }
      return;
    }

    if (data.type === "view") {
      const payloadLength = this._getFloatPayloadLength(data.world);
      const potentialLength = this._getFloatPayloadLength(data.potential);
      const growthLength = this._getFloatPayloadLength(data.growth);
      const growthOldLength =
        data.growthOld === null || typeof data.growthOld === "undefined"
          ? null
          : this._getFloatPayloadLength(data.growthOld);

      if (
        !Number.isInteger(payloadLength) ||
        payloadLength <= 0 ||
        potentialLength !== payloadLength ||
        growthLength !== payloadLength ||
        (growthOldLength !== null && growthOldLength !== payloadLength)
      ) {
        this._logError("Ignoring malformed view payload");
        this._resetWorkerAfterPayloadIssue({ ensureBuffers: true });
        return;
      }

      if (payloadLength !== expectedLength) {
        this._logStaleWorkerPayload("view", payloadLength, expectedLength);
        this._resetWorkerAfterPayloadIssue({ ensureBuffers: true });
        return;
      }

      const world = this._bufferToFloat32(data.world, payloadLength);
      const potential = this._bufferToFloat32(data.potential, payloadLength);
      const growth = this._bufferToFloat32(data.growth, payloadLength);
      const growthOld =
        data.growthOld === null || typeof data.growthOld === "undefined"
          ? null
          : this._bufferToFloat32(data.growthOld, payloadLength);

      if (!world || !potential || !growth || (data.growthOld && !growthOld)) {
        this._logError("Ignoring malformed view payload");
        this._resetWorkerAfterPayloadIssue({ ensureBuffers: true });
        return;
      }

      const b = this.board;
      b.world = world;
      b.potential = potential;
      b.growth = growth;
      b.growthOld = growthOld;

      if (data.analysis) {
        this.analyser.applyWorkerStatistics(data.analysis, this.automaton);
      }

      this._workerBusy = false;
      this._flushPendingMutations();
      if (this._kernelPending) {
        this._workerSendKernel();
        return;
      }

      this._tryExecutePendingPlacement();
      return;
    }

    if (data.type === "result") {
      const payloadLength = this._getFloatPayloadLength(data.world);
      const potentialLength = this._getFloatPayloadLength(data.potential);
      const growthLength = this._getFloatPayloadLength(data.growth);
      const changeLength = this._getFloatPayloadLength(data.change);
      const growthOldLength =
        data.growthOld === null || typeof data.growthOld === "undefined"
          ? null
          : this._getFloatPayloadLength(data.growthOld);

      if (
        !Number.isInteger(payloadLength) ||
        payloadLength <= 0 ||
        potentialLength !== payloadLength ||
        growthLength !== payloadLength ||
        changeLength !== payloadLength ||
        (growthOldLength !== null && growthOldLength !== payloadLength)
      ) {
        this._logError("Ignoring malformed step payload");
        this._resetWorkerAfterPayloadIssue({ clearChangeRecycleBuffer: true });
        return;
      }

      if (payloadLength !== expectedLength) {
        this._logStaleWorkerPayload("step", payloadLength, expectedLength);
        this._resetWorkerAfterPayloadIssue({ clearChangeRecycleBuffer: true });
        return;
      }

      const world = this._bufferToFloat32(data.world, payloadLength);
      const potential = this._bufferToFloat32(data.potential, payloadLength);
      const growth = this._bufferToFloat32(data.growth, payloadLength);
      const change = this._bufferToFloat32(data.change, payloadLength);
      const growthOld =
        data.growthOld === null || typeof data.growthOld === "undefined"
          ? null
          : this._bufferToFloat32(data.growthOld, payloadLength);

      if (
        !world ||
        !potential ||
        !growth ||
        !change ||
        (data.growthOld && !growthOld)
      ) {
        this._logError("Ignoring malformed step payload");
        this._resetWorkerAfterPayloadIssue({ clearChangeRecycleBuffer: true });
        return;
      }

      const b = this.board;

      b.world = world;
      b.potential = potential;
      b.growth = growth;
      b.growthOld = growthOld;

      this.automaton.change = change;
      this._changeRecycleBuffer = data.change;
      this.automaton.gen++;
      this.automaton.time =
        Math.round((this.automaton.time + 1 / this.params.T) * 10000) / 10000;

      this._workerBusy = false;
      this.analyser.countStep();

      this._flushPendingMutations();

      this._tryExecutePendingPlacement();

      this._postStepUpdate(data.analysis);

      if (this._kernelPending) {
        this._workerSendKernel();
        return;
      }

      if (this._stepPending) {
        this._stepPending = false;
        this._dispatchWorkerStep();
      }
      return;
    }

    this._workerBusy = false;
    this._logWarn(
      `Ignoring unexpected worker message type: ${String(data.type)}`,
    );
  }

  _queueOrRunMutation(mutation) {
    if (typeof mutation !== "function") return;

    if (this._worker && this._workerBusy) {
      this._pendingMutations.push(mutation);
      return;
    }

    mutation();
  }

  _flushPendingMutations() {
    if (!this._pendingMutations.length) return;

    const mutations = this._pendingMutations.splice(
      0,
      this._pendingMutations.length,
    );
    for (const mutation of mutations) {
      mutation();
    }
  }

  _dispatchWorkerStep() {
    if (!this._worker || this._workerBusy) {
      if (this._worker) this._stepPending = true;
      return false;
    }

    const b = this.board;
    const ndConfig = this.buildNDConfig();

    const worldCopy = new Float32Array(b.world);
    const potentialCopy = new Float32Array(b.potential);
    const growthCopy = new Float32Array(b.growth);

    const transfers = [
      worldCopy.buffer,
      potentialCopy.buffer,
      growthCopy.buffer,
    ];
    const msg = {
      type: "step",
      params: {
        ...this.params,
        size: this.params.latticeExtent,
        gn: this.params.gn,
        kn: this.params.kn,
      },
      ndConfig,
      world: worldCopy.buffer,
      potential: potentialCopy.buffer,
      growth: growthCopy.buffer,
      growthOld: null,
      changeBuffer: this._changeRecycleBuffer,
    };

    const recycledChangeBuffer = this._changeRecycleBuffer;
    if (recycledChangeBuffer) {
      transfers.push(recycledChangeBuffer);
    }

    const seedWorld = this._ndSeedWorld;
    if (this.params.multiStep && b.growthOld) {
      const growthOldCopy = new Float32Array(b.growthOld);
      msg.growthOld = growthOldCopy.buffer;
      transfers.push(growthOldCopy.buffer);
    }

    if (seedWorld) {
      msg.ndSeedWorld = seedWorld.buffer;
      transfers.push(seedWorld.buffer);
    }

    const posted = this._postWorkerMessage(msg, transfers, "step dispatch");
    if (!posted) {
      this._workerBusy = false;
      this._stepPending = true;
      return false;
    }

    this._workerBusy = true;
    if (recycledChangeBuffer) {
      this._changeRecycleBuffer = null;
    }
    if (seedWorld) {
      this._ndSeedWorld = null;
    }
    return true;
  }

  _workerRequestView() {
    if (!this._worker) return false;
    if (this._workerBusy) {
      this._viewPending = true;
      return false;
    }

    const b = this.board;
    if (!b.world || !b.potential || !b.growth) {
      this._ensureBuffers();
    }
    const ndConfig = this.buildNDConfig();
    const worldBuffer = b.world.buffer;
    const potentialBuffer = b.potential.buffer;
    const growthBuffer = b.growth.buffer;
    const growthOldBuffer = b.growthOld ? b.growthOld.buffer : null;
    const transfers = [worldBuffer, potentialBuffer, growthBuffer];
    const msg = {
      type: "view",
      params: {
        ...this.params,
        size: this.params.latticeExtent,
      },
      ndConfig,
      world: worldBuffer,
      potential: potentialBuffer,
      growth: growthBuffer,
      growthOld: growthOldBuffer,
    };

    if (growthOldBuffer) {
      transfers.push(growthOldBuffer);
    }

    const seedWorld = this._ndSeedWorld;
    if (seedWorld) {
      msg.ndSeedWorld = seedWorld.buffer;
      transfers.push(seedWorld.buffer);
    }

    const posted = this._postWorkerMessage(msg, transfers, "view request");
    if (!posted) {
      this._workerBusy = false;
      this._viewPending = true;
      return false;
    }

    b.world = null;
    b.potential = null;
    b.growth = null;
    b.growthOld = null;

    if (seedWorld) {
      this._ndSeedWorld = null;
    }

    this._workerBusy = true;
    this._viewPending = false;
    return true;
  }

  _ensureBuffers() {
    const size = this.params.latticeExtent;
    const count = size * size;
    if (!this.board.world || this.board.world.length !== count)
      this.board.world = new Float32Array(count);
    if (!this.board.potential || this.board.potential.length !== count)
      this.board.potential = new Float32Array(count);
    if (!this.board.growth || this.board.growth.length !== count)
      this.board.growth = new Float32Array(count);
  }

  _postStepUpdate(workerAnalysis = null) {
    if (workerAnalysis) {
      this.analyser.applyWorkerStatistics(workerAnalysis, this.automaton);
    }
    if (this.automaton.gen % 10 === 0) {
      const row = this.analyser.getStatRow();
      if (typeof this.analyser.addStatRow === "function") {
        this.analyser.addStatRow(row, this.params);
      } else {
        this.analyser.series.push(row);
      }
      if (this.analyser.series.length > 10000) {
        this.analyser.series.splice(0, this.analyser.series.length - 10000);
      }
    }
    this.analyser.updatePeriodogram(this.params, 10);
  }
}

AppCore.installMethodsFrom(AppCoreWorkerPipelineMethods);
