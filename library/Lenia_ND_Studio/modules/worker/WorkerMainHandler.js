function _toWorkerErrorPayload(stage, error) {
  if (error && typeof error === "object") {
    return {
      type: "workerError",
      stage,
      name: String(error.name || "Error"),
      message: String(error.message || "Worker failure"),
      stack: String(error.stack || ""),
    };
  }

  return {
    type: "workerError",
    stage,
    name: "Error",
    message: String(error || "Worker failure"),
    stack: "",
  };
}

function _reportWorkerError(stage, error) {
  const payload = _toWorkerErrorPayload(stage, error);
  try {
    self.postMessage(payload);
  } catch {
    console.warn(
      "[LeniaWorker] Failed to post error message to main thread. Original error:",
      payload,
    );
  }
  try {
    console.error(`[LeniaWorker] ${payload.stage}: ${payload.message}`);
  } catch {
    // Ignore logging failures because obviously logging shouldn't cause more errors. If this fails, there's not much we can do about it. It's up to the bloody user to fix their console if it can't handle error messages.
  }
}

self.onerror = function (_message, _source, _lineno, _colno, error) {
  _reportWorkerError("runtime", error || _message);
  return false;
};

self.onunhandledrejection = function (event) {
  _reportWorkerError("unhandledrejection", event?.reason);
};

const ND_MUTATION_MODE = Object.freeze({
  RANDOMISE: 0,
  CLEAR: 1,
  PLACE: 2,
  PLACE_ND: 3,
});

function _toNDMutationMode(modeOrType) {
  const numeric = Number(modeOrType);
  if (Number.isFinite(numeric)) {
    const mode = Math.floor(numeric);
    if (
      mode === ND_MUTATION_MODE.RANDOMISE ||
      mode === ND_MUTATION_MODE.CLEAR ||
      mode === ND_MUTATION_MODE.PLACE ||
      mode === ND_MUTATION_MODE.PLACE_ND
    ) {
      return mode;
    }
  }

  const text = String(modeOrType || "")
    .trim()
    .toLowerCase();
  if (text === "randomise" || text === "randomize") {
    return ND_MUTATION_MODE.RANDOMISE;
  }
  if (text === "clear") {
    return ND_MUTATION_MODE.CLEAR;
  }
  if (text === "place") {
    return ND_MUTATION_MODE.PLACE;
  }
  if (text === "placend" || text === "place_nd" || text === "place-nd") {
    return ND_MUTATION_MODE.PLACE_ND;
  }
  return -1;
}

self.onmessage = function (e) {
  try {
    const msg = e && e.data && typeof e.data === "object" ? e.data : null;
    if (!msg || typeof msg.type !== "string") return;

    if (
      !["kernel", "ndMutation", "transform", "view", "step"].includes(msg.type)
    ) {
      return;
    }

    if (msg.type === "kernel") {
      const params = _sanitiseWorkerParams(msg.params);
      if (msg.ndConfig && typeof msg.ndConfig === "object") {
        _ndConfig = msg.ndConfig;
      }
      resetAnalysisState(_analysisState);

      const info = buildKernel(params);
      const size = params.size || 128;
      _N = nextPow2(size);
      _kernelFFT = buildKernelFFT(info.kernelConvolution, info.kernelSize, _N);

      const ndDim = Number(_ndConfig?.dimension) || 2;
      if (ndDim > 2) {
        const ndKernel = buildKernelND(params, size, ndDim);
        _ndKernelFFT = buildKernelFFTND(ndKernel, size, ndDim);
        _ndKernelDim = ndDim;
        _ndKernelSize = size;
      } else {
        _ndKernelFFT = null;
        _ndKernelDim = 0;
        _ndKernelSize = 0;
      }

      self.postMessage(
        {
          type: "kernelReady",
          kernelSize: info.kernelSize,
          kernelMax: info.kernelMax,
          kernel: info.kernelDisplay,
          kernelDX: info.kernelDX,
          kernelDY: info.kernelDY,
          kernelValues: info.kernelValues,
          ndConfig: _ndConfig,
        },
        [
          info.kernelDisplay.buffer,
          info.kernelDX.buffer,
          info.kernelDY.buffer,
          info.kernelValues.buffer,
        ],
      );
      return;
    }

    if (msg.type === "ndMutation") {
      if (msg.ndConfig && typeof msg.ndConfig === "object") {
        _ndConfig = msg.ndConfig;
      }
      const params = _sanitiseWorkerParams(msg.params);
      const mutation = msg.mutation || {};
      const channelCount = 1;
      const cellCount = params.size * params.size;
      const expectedLength = cellCount * channelCount;

      let world = _toFloat32Array(msg.world, expectedLength);
      let potential = _toFloat32Array(msg.potential, expectedLength);
      let growth = _toFloat32Array(msg.growth, expectedLength);

      if (!_ndState) {
        ndEnsureState(params, _ndConfig, world, null);
      }

      if (_ndState) {
        const mutationMode = _toNDMutationMode(
          mutation.mode != null ? mutation.mode : mutation.type,
        );

        const resetNDDerivedBuffers = () => {
          _ndState.potential.fill(0);
          _ndState.growth.fill(0);
          if (_ndState.growthOld) _ndState.growthOld.fill(0);
        };

        if (mutationMode === ND_MUTATION_MODE.RANDOMISE) {
          const R = Number(params.R) || 10;
          const { size, dimension, planeCount, depth } = _ndState;
          _ndState.world.fill(0);
          resetNDDerivedBuffers();
          const blobDim = Math.max(1, Math.floor(R * 0.9));
          const blobCount = 15 + Math.floor(Math.random() * 26);
          const border = Math.floor(R * 1.5);
          const mid = Math.floor(size / 2);
          const extraDims = Math.max(0, dimension - 2);

          for (let b = 0; b < blobCount; b++) {
            const shifts = [];
            for (let d = 0; d < dimension; d++) {
              const sz = d < 2 ? size : depth;
              const lo = Math.min(border, Math.floor(sz / 2));
              const hi = Math.max(lo + 1, sz - lo);
              shifts.push(
                Math.floor(Math.random() * (hi - lo)) + lo - Math.floor(sz / 2),
              );
            }

            for (let iz = 0; iz < planeCount; iz++) {
              let planeIdx = iz;
              const coords = [];
              for (let d = 0; d < extraDims; d++) {
                coords.push(planeIdx % depth);
                planeIdx = Math.floor(planeIdx / depth);
              }

              let inRange = true;
              for (let d = 0; d < extraDims; d++) {
                const zMid = Math.floor(depth / 2);
                const zPos = coords[d];
                const blobZ = shifts[2 + d] + zMid;
                if (zPos < blobZ || zPos >= blobZ + blobDim) {
                  inRange = false;
                  break;
                }
              }
              if (!inRange) continue;

              const planeBase = iz * cellCount * channelCount;
              for (let dy = 0; dy < blobDim; dy++) {
                for (let dx = 0; dx < blobDim; dx++) {
                  const x = (((shifts[0] + dx + mid) % size) + size) % size;
                  const y = (((shifts[1] + dy + mid) % size) + size) % size;
                  _ndState.world[planeBase + y * size + x] =
                    Math.random() * 0.9;
                }
              }
            }
          }
        }

        if (mutationMode === ND_MUTATION_MODE.CLEAR) {
          _ndState.world.fill(0);
          resetNDDerivedBuffers();
        }

        if (mutationMode === ND_MUTATION_MODE.PLACE) {
          const { patternData, patternWidth, patternHeight, cellX, cellY } =
            mutation;
          const pattern = new Float32Array(patternData);
          const { size, planeCount } = _ndState;
          for (let iz = 0; iz < planeCount; iz++) {
            const planeBase = iz * cellCount * channelCount;
            for (let py = 0; py < patternHeight; py++) {
              for (let px = 0; px < patternWidth; px++) {
                const val = pattern[py * patternWidth + px];
                if (val === 0) continue;
                const wx =
                  (((cellX - Math.floor(patternWidth / 2) + px) % size) +
                    size) %
                  size;
                const wy =
                  (((cellY - Math.floor(patternHeight / 2) + py) % size) +
                    size) %
                  size;
                _ndState.world[planeBase + wy * size + wx] = val;
              }
            }
          }
          resetNDDerivedBuffers();
        }

        if (mutationMode === ND_MUTATION_MODE.PLACE_ND) {
          const { planeEntries, cellX, cellY } = mutation;
          const { size } = _ndState;
          for (const entry of planeEntries) {
            const pattern = new Float32Array(entry.patternData);
            const pw = entry.patternWidth;
            const ph = entry.patternHeight;
            const planeBase = entry.plane * cellCount * channelCount;
            for (let py = 0; py < ph; py++) {
              for (let px = 0; px < pw; px++) {
                const val = pattern[py * pw + px];
                if (val === 0) continue;
                const wx =
                  (((cellX - Math.floor(pw / 2) + px) % size) + size) % size;
                const wy =
                  (((cellY - Math.floor(ph / 2) + py) % size) + size) % size;
                _ndState.world[planeBase + wy * size + wx] = val;
              }
            }
          }
          resetNDDerivedBuffers();
        }

        const display = ndExtractDisplay(
          _ndState,
          _ndConfig,
          world,
          potential,
          growth,
        );
        world = display.world2D;
        potential = display.potential2D;
        growth = display.growth2D;
      }

      const transfers = [world.buffer, potential.buffer, growth.buffer];
      self.postMessage(
        {
          type: "view",
          world: world.buffer,
          potential: potential.buffer,
          growth: growth.buffer,
          growthOld: null,
          ndConfig: _ndConfig,
        },
        transfers,
      );
      return;
    }

    if (msg.type === "transform") {
      if (msg.ndConfig && typeof msg.ndConfig === "object") {
        _ndConfig = msg.ndConfig;
      }
      const params = _sanitiseWorkerParams(msg.params);
      const transform = msg.transform || {};
      const channelCount = 1;
      const cellCount = params.size * params.size;
      const expectedLength = cellCount * channelCount;

      let world = _toFloat32Array(msg.world, expectedLength);
      let potential = _toFloat32Array(msg.potential, expectedLength);
      let growth = _toFloat32Array(msg.growth, expectedLength);

      if ((Number(_ndConfig?.dimension) || 2) > 2 && _ndState) {
        const { size } = _ndState;
        const total = _ndState.world.length;

        if (transform.shift) {
          const [dx, dy] = transform.shift;
          autoCentreShift(_ndState.world, size, dx, dy, total / cellCount);
          autoCentreShift(_ndState.potential, size, dx, dy, total / cellCount);
          autoCentreShift(_ndState.growth, size, dx, dy, total / cellCount);
        }

        if (transform.shiftDepth && typeof transform.shiftDepth === "object") {
          const axis = transform.shiftDepth.axis || "z";
          const delta = Math.floor(Number(transform.shiftDepth.delta) || 0);
          if (delta !== 0) {
            const planeCellCount = cellCount * channelCount;
            shiftNDDepth(
              _ndState.world,
              planeCellCount,
              _ndState.depth,
              _ndState.dimension,
              axis,
              delta,
            );
            shiftNDDepth(
              _ndState.potential,
              planeCellCount,
              _ndState.depth,
              _ndState.dimension,
              axis,
              delta,
            );
            shiftNDDepth(
              _ndState.growth,
              planeCellCount,
              _ndState.depth,
              _ndState.dimension,
              axis,
              delta,
            );
            if (_ndState.growthOld) {
              shiftNDDepth(
                _ndState.growthOld,
                planeCellCount,
                _ndState.depth,
                _ndState.dimension,
                axis,
                delta,
              );
            }
          }
        }

        if (typeof transform.rotate === "number" && transform.rotate !== 0) {
          ndRotateState(_ndState, transform.rotate);
        }

        if (typeof transform.flip === "number" && transform.flip >= 0) {
          ndFlipState(_ndState, transform.flip);
        }

        if (
          typeof transform.zoom === "number" &&
          Math.abs(transform.zoom - 1) > 1e-6
        ) {
          const wrapShift = estimateNDTorusZoomShift(_ndState.world, _ndState);
          zoomNDTensor(_ndState.world, _ndState, transform.zoom, wrapShift);
          zoomNDTensor(_ndState.potential, _ndState, transform.zoom, wrapShift);
          zoomNDTensor(_ndState.growth, _ndState, transform.zoom, wrapShift);
          if (_ndState.growthOld) {
            zoomNDTensor(
              _ndState.growthOld,
              _ndState,
              transform.zoom,
              wrapShift,
            );
          }
        }

        _stepCentreCache.valid = false;
        _ndStepCache.valid = false;

        const display = ndExtractDisplay(
          _ndState,
          _ndConfig,
          world,
          potential,
          growth,
        );
        world = display.world2D;
        potential = display.potential2D;
        growth = display.growth2D;
      } else {
      }

      const transfers = [world.buffer, potential.buffer, growth.buffer];
      self.postMessage(
        {
          type: "view",
          world: world.buffer,
          potential: potential.buffer,
          growth: growth.buffer,
          growthOld: null,
          ndConfig: _ndConfig,
        },
        transfers,
      );
      return;
    }

    if (msg.type === "view") {
      if (msg.ndConfig && typeof msg.ndConfig === "object") {
        _ndConfig = msg.ndConfig;
      }

      const params = _sanitiseWorkerParams(msg.params);
      const channelCount = 1;
      const cellCount = params.size * params.size;
      const expectedLength = cellCount * channelCount;
      const ensureLength = (arr) => {
        if (!arr || arr.length !== expectedLength) {
          const fixed = new Float32Array(expectedLength);
          if (arr)
            fixed.set(arr.subarray(0, Math.min(arr.length, expectedLength)));
          return fixed;
        }
        return arr;
      };

      let world = ensureLength(_toFloat32Array(msg.world, expectedLength));
      let potential = ensureLength(
        _toFloat32Array(msg.potential, expectedLength),
      );
      let growth = ensureLength(_toFloat32Array(msg.growth, expectedLength));
      let growthOld = msg.growthOld
        ? ensureLength(_toFloat32Array(msg.growthOld, expectedLength))
        : null;

      if ((Number(_ndConfig?.dimension) || 2) > 2) {
        const ndSeed = msg.ndSeedWorld
          ? new Float32Array(msg.ndSeedWorld)
          : null;
        const state = ndEnsureState(params, _ndConfig, world, ndSeed);
        const display = ndExtractDisplay(
          state,
          _ndConfig,
          world,
          potential,
          growth,
        );
        world = display.world2D;
        potential = display.potential2D;
        growth = display.growth2D;
        growthOld = null;
      }

      const analysis = analyseStep(
        world.subarray(0, cellCount),
        potential.subarray(0, cellCount),
        growth.subarray(0, cellCount),
        null,
        {
          size: params.size,
          T: params.T,
          R: params.R,
          renderMode: params.renderMode || "world",
          dimension:
            Number(_ndConfig?.dimension) || Number(params?.dimension) || 2,
        },
        _analysisState,
      );

      const transfers = [world.buffer, potential.buffer, growth.buffer];
      if (growthOld) transfers.push(growthOld.buffer);
      self.postMessage(
        {
          type: "view",
          world: world.buffer,
          potential: potential.buffer,
          growth: growth.buffer,
          growthOld: growthOld ? growthOld.buffer : null,
          analysis,
          ndConfig: _ndConfig,
        },
        transfers,
      );
      return;
    }

    if (msg.type === "step") {
      if (msg.ndConfig && typeof msg.ndConfig === "object") {
        _ndConfig = msg.ndConfig;
      }
      const params = _sanitiseWorkerParams(msg.params);
      const channelCount = 1;
      const cellCount = params.size * params.size;
      const expectedLength = cellCount * channelCount;

      const worldIn = _toFloat32Array(msg.world, expectedLength);
      const potentialIn = _toFloat32Array(msg.potential, expectedLength);
      const growthIn = _toFloat32Array(msg.growth, expectedLength);
      const growthOldIn = msg.growthOld
        ? _toFloat32Array(msg.growthOld, expectedLength)
        : null;
      const changeOutIn = msg.changeBuffer
        ? _toFloat32Array(msg.changeBuffer, expectedLength)
        : null;

      const ensureLength = (arr) => {
        if (!arr || arr.length !== expectedLength) {
          const fixed = new Float32Array(expectedLength);
          if (arr)
            fixed.set(arr.subarray(0, Math.min(arr.length, expectedLength)));
          return fixed;
        }
        return arr;
      };

      const world = ensureLength(worldIn);
      const potential = ensureLength(potentialIn);
      const growth = ensureLength(growthIn);
      const growthOld = growthOldIn ? ensureLength(growthOldIn) : null;
      const changeOut = changeOutIn ? ensureLength(changeOutIn) : null;

      if (!_kernelFFT || _N < nextPow2(params.size)) {
        const info = buildKernel(params);
        _N = nextPow2(params.size);
        _kernelFFT = buildKernelFFT(
          info.kernelConvolution,
          info.kernelSize,
          _N,
        );
      }

      let change = null;
      if ((Number(_ndConfig?.dimension) || 2) <= 2) {
        _ndState = null;
        change = stepFFTSingle(
          world,
          potential,
          growth,
          growthOld,
          params,
          _kernelFFT,
          _N,
          changeOut,
        );
      } else {
        const ndSeed = msg.ndSeedWorld
          ? new Float32Array(msg.ndSeedWorld)
          : null;
        const state = ndStepState(
          params,
          _ndConfig,
          _kernelFFT,
          _N,
          world,
          ndSeed,
        );
        const display = ndExtractDisplay(
          state,
          _ndConfig,
          world,
          potential,
          growth,
        );
        world.set(display.world2D);
        potential.set(display.potential2D);
        growth.set(display.growth2D);

        change =
          changeOut && changeOut.length === expectedLength
            ? changeOut
            : new Float32Array(expectedLength);
        for (let i = 0; i < expectedLength; i++) {
          change[i] = world[i] - worldIn[i];
        }
      }

      _analysisState.frames += 1;

      if (_stepCentreCache.valid) _stepCentreCache.valid = false;
      if (_ndStepCache.valid) _ndStepCache.valid = false;
      if (params.autoCentre && _ndState && _ndState.planeCount > 1) {
        const ndDim = _ndState.dimension;
        const ndDepth = _ndState.depth;
        const ndPlaneCount = _ndState.planeCount;
        const ndPlaneCellCount = cellCount * channelCount;
        const ndCache = _ndState._cache;
        const planeMass = ndCache.planeMass;
        if (
          _ndStepCache.planeMass &&
          _ndStepCache.planeCount === ndPlaneCount
        ) {
          planeMass.set(_ndStepCache.planeMass.subarray(0, ndPlaneCount));
        } else {
          for (let p = 0; p < ndPlaneCount; p++) {
            let pm = 0;
            const base = p * ndPlaneCellCount;
            for (let ii = 0; ii < ndPlaneCellCount; ii++)
              pm += _ndState.world[base + ii];
            planeMass[p] = pm;
          }
        }

        const depthCos = ndCache.depthCos;
        const depthSin = ndCache.depthSin;

        let cosZ = 0,
          sinZ = 0;
        for (let z = 0; z < ndDepth; z++) {
          let zMass = 0;
          if (ndDim === 3) {
            zMass = planeMass[z];
          } else {
            for (let w = 0; w < ndDepth; w++)
              zMass += planeMass[z + w * ndDepth];
          }
          cosZ += zMass * depthCos[z];
          sinZ += zMass * depthSin[z];
        }
        const czND =
          ((Math.atan2(sinZ, cosZ) / (2 * Math.PI)) * ndDepth + ndDepth) %
          ndDepth;
        const ndShiftZ = Math.round(ndDepth / 2 - czND);

        let ndShiftW = 0;
        if (ndDim >= 4) {
          let cosW = 0,
            sinW = 0;
          for (let w = 0; w < ndDepth; w++) {
            let wMass = 0;
            for (let z = 0; z < ndDepth; z++)
              wMass += planeMass[z + w * ndDepth];
            cosW += wMass * depthCos[w];
            sinW += wMass * depthSin[w];
          }
          const cwND =
            ((Math.atan2(sinW, cosW) / (2 * Math.PI)) * ndDepth + ndDepth) %
            ndDepth;
          ndShiftW = Math.round(ndDepth / 2 - cwND);
        }

        if (ndShiftZ !== 0 || ndShiftW !== 0) {
          const tmpBuf = ndCache.reorderTmp;
          const reorder = (src) => {
            for (let op = 0; op < ndPlaneCount; op++) {
              let np = op;
              if (ndDim === 3) {
                np = (((op + ndShiftZ) % ndDepth) + ndDepth) % ndDepth;
              } else if (ndDim >= 4) {
                const z = op % ndDepth;
                const w = Math.floor(op / ndDepth);
                const nz = (((z + ndShiftZ) % ndDepth) + ndDepth) % ndDepth;
                const nw = (((w + ndShiftW) % ndDepth) + ndDepth) % ndDepth;
                np = nz + nw * ndDepth;
              }
              tmpBuf.set(
                src.subarray(
                  op * ndPlaneCellCount,
                  op * ndPlaneCellCount + ndPlaneCellCount,
                ),
                np * ndPlaneCellCount,
              );
            }
            src.set(tmpBuf);
          };
          reorder(_ndState.world);
          reorder(_ndState.potential);
          reorder(_ndState.growth);
          if (_ndState.growthOld) reorder(_ndState.growthOld);
        }
      }

      let analysisWorld = world;
      let analysisPotential = potential;
      let analysisGrowth = growth;
      let analysisChange = change;

      if (channelCount > 1) {
        if (_mcAnalysisScratchLen !== cellCount) {
          _mcAnalysisScratch = {
            world: new Float32Array(cellCount),
            potential: new Float32Array(cellCount),
            growth: new Float32Array(cellCount),
            change: new Float32Array(cellCount),
          };
          _mcAnalysisScratchLen = cellCount;
        }
        analysisWorld = _mcAnalysisScratch.world;
        analysisPotential = _mcAnalysisScratch.potential;
        analysisGrowth = _mcAnalysisScratch.growth;
        analysisChange = _mcAnalysisScratch.change;
        analysisWorld.fill(0);
        analysisPotential.fill(0);
        analysisGrowth.fill(0);
        analysisChange.fill(0);
        for (let c = 0; c < channelCount; c++) {
          const offset = c * cellCount;
          for (let i = 0; i < cellCount; i++) {
            analysisWorld[i] += world[offset + i];
            analysisPotential[i] += potential[offset + i];
            analysisGrowth[i] += growth[offset + i];
            analysisChange[i] += change[offset + i];
          }
        }
      }

      const analysisParams = {
        size: params.size,
        T: params.T,
        R: params.R,
        renderMode: params.renderMode || "world",
        dimension:
          Number(_ndConfig?.dimension) || Number(params?.dimension) || 2,
      };

      let analysis;
      const effectiveInterval =
        _ndState && _ndState.planeCount > 1
          ? _analysisIntervalND
          : _analysisInterval;
      if (_analysisState.frames % effectiveInterval === 0) {
        analysis = analyseStep(
          analysisWorld,
          analysisPotential,
          analysisGrowth,
          analysisChange,
          analysisParams,
          _analysisState,
        );
        _lastAnalysisResult = analysis;
      } else {
        const quick = computeQuickStats(
          analysisWorld,
          analysisGrowth,
          params.size,
          analysisParams,
          _analysisState,
        );
        analysis = _lastAnalysisResult
          ? Object.assign({}, _lastAnalysisResult, quick)
          : quick;
      }

      let newGrowthOld = null;
      if (params.multiStep) {
        newGrowthOld = new Float32Array(growth);
      }

      const transfers = [
        world.buffer,
        potential.buffer,
        growth.buffer,
        change.buffer,
      ];
      if (newGrowthOld) transfers.push(newGrowthOld.buffer);

      self.postMessage(
        {
          type: "result",
          world: world.buffer,
          potential: potential.buffer,
          growth: growth.buffer,
          growthOld: newGrowthOld ? newGrowthOld.buffer : null,
          change: change.buffer,
          analysis,
          ndConfig: _ndConfig,
        },
        transfers,
      );
    }
  } catch (error) {
    _reportWorkerError("onmessage", error);
  }
};
