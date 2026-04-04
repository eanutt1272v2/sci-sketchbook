class WorkerPipelineMethods {
  _initWorker() {
    try {
      this._worker = new Worker("worker/LeniaWorker.js");
    } catch (e) {
      throw new Error("[Lenia] Worker is required but could not be created.");
    }

    this._worker.onmessage = (e) => this._onWorkerMessage(e.data);
    this._worker.onerror = (e) => {
      console.error("[Lenia] Worker error:", e);
      this._workerBusy = false;
      this._stepPending = false;
      this._kernelPending = false;
      this._viewPending = false;
      this._changeRecycleBuffer = null;

      const dim = Math.max(2, Math.floor(Number(this.params.dimension) || 2));
      if (dim > 2) {
        const safeSize = NDCompat.coerceGridSize(this.params.gridSize, dim);
        if (safeSize < this.params.gridSize) {
          console.warn(
            `[Lenia] Recovering from worker allocation failure by reducing ${dim}D grid size from ${this.params.gridSize} to ${safeSize}.`,
          );
          this.params.gridSize = safeSize;
          this.changeResolution();
          return;
        }
      }
    };

    this._workerSendKernel();
  }

  _workerSendKernel() {
    const dim = Math.max(2, Math.floor(Number(this.params.dimension) || 2));
    if (dim > 2) {
      const safeSize = NDCompat.coerceGridSize(this.params.gridSize, dim);
      if (safeSize !== this.params.gridSize) {
        console.warn(
          `[Lenia] Reducing ${dim}D grid size from ${this.params.gridSize} to ${safeSize} to avoid excessive worker memory usage.`,
        );
        this.params.gridSize = safeSize;
        this.changeResolution();
        return;
      }
    }

    if (!this._worker) return;
    if (this._workerBusy) {
      this._kernelPending = true;
      return;
    }
    this._workerBusy = true;
    this._kernelPending = false;
    const ndConfig = this.buildNDConfig();
    this._worker.postMessage({
      type: "kernel",
      params: { ...this.params, size: this.params.gridSize },
      ndConfig,
    });
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
    fromSize = this.params.gridSize,
    toSize = this.params.gridSize,
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

    const boardSize = this.board?.size || this.params.gridSize;
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
    const log =
      this._resolutionTransitionActive ||
      this._hasQueuedAction("changeResolution")
        ? console.debug
        : console.warn;
    log(
      `[Lenia] Ignoring stale ${kind} payload (len=${payloadLength}, expected=${expectedLength})`,
    );
  }

  _onWorkerMessage(data) {
    if (!data || typeof data !== "object" || typeof data.type !== "string") {
      this._workerBusy = false;
      return;
    }

    const expectedSize = this.board?.size || this.params.gridSize;
    const expectedLength = expectedSize * expectedSize;

    if (data.type === "kernelReady") {
      if (!this._isKernelPayloadValid(data)) {
        console.error("[Lenia] Ignoring malformed kernelReady payload");
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
        console.error("[Lenia] Ignoring malformed view payload");
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
        console.error("[Lenia] Ignoring malformed view payload");
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
        console.error("[Lenia] Ignoring malformed step payload");
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
        console.error("[Lenia] Ignoring malformed step payload");
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
    }
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
        size: this.params.gridSize,
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

    if (this._changeRecycleBuffer) {
      transfers.push(this._changeRecycleBuffer);
      this._changeRecycleBuffer = null;
    }

    if (this.params.multiStep && b.growthOld) {
      const growthOldCopy = new Float32Array(b.growthOld);
      msg.growthOld = growthOldCopy.buffer;
      transfers.push(growthOldCopy.buffer);
    }

    if (this._ndSeedWorld) {
      msg.ndSeedWorld = this._ndSeedWorld.buffer;
      transfers.push(this._ndSeedWorld.buffer);
      this._ndSeedWorld = null;
    }

    this._workerBusy = true;
    this._worker.postMessage(msg, transfers);
    return true;
  }

  _workerRequestView() {
    if (!this._worker) return false;
    if (this._workerBusy) {
      this._viewPending = true;
      return false;
    }

    const b = this.board;
    const ndConfig = this.buildNDConfig();
    const transfers = [b.world.buffer, b.potential.buffer, b.growth.buffer];
    const msg = {
      type: "view",
      params: {
        ...this.params,
        size: this.params.gridSize,
      },
      ndConfig,
      world: b.world.buffer,
      potential: b.potential.buffer,
      growth: b.growth.buffer,
      growthOld: b.growthOld ? b.growthOld.buffer : null,
    };

    if (b.growthOld) {
      transfers.push(b.growthOld.buffer);
    }

    b.world = null;
    b.potential = null;
    b.growth = null;
    b.growthOld = null;

    if (this._ndSeedWorld) {
      msg.ndSeedWorld = this._ndSeedWorld.buffer;
      transfers.push(this._ndSeedWorld.buffer);
      this._ndSeedWorld = null;
    }

    this._workerBusy = true;
    this._viewPending = false;
    this._worker.postMessage(msg, transfers);
    return true;
  }

  _ensureBuffers() {
    const size = this.params.gridSize;
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

for (const name of Object.getOwnPropertyNames(
  WorkerPipelineMethods.prototype,
)) {
  if (name === "constructor") continue;
  AppCore.prototype[name] = WorkerPipelineMethods.prototype[name];
}
