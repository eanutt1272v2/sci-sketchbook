function ndPlaneCount(dimension, depth) {
  const dim = Math.max(2, Math.floor(Number(dimension) || 2));
  const d = Math.max(2, Math.floor(Number(depth) || 2));
  return Math.pow(d, Math.max(0, dim - 2));
}

function ndCoordsFromPlane(plane, depth, extraDims) {
  const coords = new Array(extraDims).fill(0);
  let p = plane;
  for (let axis = 0; axis < extraDims; axis++) {
    coords[axis] = p % depth;
    p = Math.floor(p / depth);
  }
  return coords;
}

function ndPlaneFromCoords(coords, depth) {
  let plane = 0;
  let mul = 1;
  for (let axis = 0; axis < coords.length; axis++) {
    plane += (coords[axis] || 0) * mul;
    mul *= depth;
  }
  return plane;
}

function ndPlaneIndex(dimension, depth, z, w = 0) {
  if (dimension <= 2) return 0;
  if (dimension === 3) return z;
  if (dimension === 4) return z + w * depth;
  return z;
}

function ndRotateState(state, angle) {
  if (angle % 360 === 0) return;
  const { size, planeCount, channelCount } = state;
  const cellCount = size * size;
  const planeCells = cellCount * channelCount;
  const rad = (angle * Math.PI) / 180;
  const cos_a = Math.cos(rad);
  const sin_a = Math.sin(rad);
  const cx = size / 2;
  const cy = size / 2;

  const rotateArray = (arr) => {
    const tmp = new Float32Array(arr.length);
    for (let p = 0; p < planeCount; p++) {
      for (let c = 0; c < channelCount; c++) {
        const off = p * planeCells + c * cellCount;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const rx = (x - cx) * cos_a - (y - cy) * sin_a + cx;
            const ry = (x - cx) * sin_a + (y - cy) * cos_a + cy;
            const ix = Math.round(rx);
            const iy = Math.round(ry);
            if (ix >= 0 && ix < size && iy >= 0 && iy < size) {
              tmp[off + y * size + x] = arr[off + iy * size + ix];
            }
          }
        }
      }
    }
    arr.set(tmp);
  };

  rotateArray(state.world);
  rotateArray(state.potential);
  rotateArray(state.growth);
}

function ndFlipState(state, mode) {
  const { size, planeCount, channelCount } = state;
  const cellCount = size * size;
  const planeCells = cellCount * channelCount;

  const flipArray = (arr) => {
    const tmp = new Float32Array(arr.length);
    for (let p = 0; p < planeCount; p++) {
      for (let c = 0; c < channelCount; c++) {
        const off = p * planeCells + c * cellCount;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            let sx, sy;
            if (mode === 0) {
              sx = size - 1 - x;
              sy = y;
            } else if (mode === 1) {
              sx = x;
              sy = size - 1 - y;
            } else {
              sx = y;
              sy = x;
            }
            tmp[off + y * size + x] = arr[off + sy * size + sx];
          }
        }
      }
    }
    arr.set(tmp);
  };

  flipArray(state.world);
  flipArray(state.potential);
  flipArray(state.growth);
}

function ndEnsureState(params, ndConfig, worldSeed, ndSeedWorld) {
  const dimension = Math.max(2, Math.floor(Number(ndConfig?.dimension) || 2));
  const channelCount = Math.max(
    1,
    Math.floor(Number(ndConfig?.channelCount) || 1),
  );
  const size = Math.max(1, Math.floor(Number(params?.size) || 128));
  const depth =
    dimension > 2
      ? size
      : Math.max(2, Math.min(512, Math.floor(Number(ndConfig?.depth) || 6)));
  const planeCount = ndPlaneCount(dimension, depth);
  const cellCount = size * size;
  const total = cellCount * channelCount * planeCount;

  if (ndSeedWorld) _ndState = null;

  const needsReset =
    !_ndState ||
    _ndState.dimension !== dimension ||
    _ndState.channelCount !== channelCount ||
    _ndState.size !== size ||
    _ndState.depth !== depth;

  if (needsReset) {
    const depthWeights = new Float32Array(depth);
    const depthCos = new Float64Array(depth);
    const depthSin = new Float64Array(depth);
    let wSum = 0;
    for (let z = 0; z < depth; z++) wSum += z;
    const normaliser = wSum > 0 ? 3 / wSum : 1 / depth;
    for (let z = 0; z < depth; z++) {
      depthWeights[z] = z * normaliser;
      const a = (2 * Math.PI * z) / depth;
      depthCos[z] = Math.cos(a);
      depthSin[z] = Math.sin(a);
    }

    _ndState = {
      dimension,
      channelCount,
      size,
      depth,
      planeCount,
      world: new Float32Array(total),
      potential: new Float32Array(total),
      growth: new Float32Array(total),
      growthOld: null,
      _cache: {
        depthWeights,
        depthCos,
        depthSin,
        projectionSliceW: -1,
        projectionPlaneOffsets: new Int32Array(depth),
        planeMass: new Float32Array(planeCount),
        reorderTmp: new Float32Array(total),
      },
    };

    if (ndSeedWorld && ndSeedWorld.length) {
      const seedLen = Math.min(ndSeedWorld.length, total);
      _ndState.world.set(ndSeedWorld.subarray(0, seedLen), 0);
    } else if (worldSeed && worldSeed.length) {
      const seedLength = Math.min(worldSeed.length, cellCount * channelCount);
      _ndState.world.set(worldSeed.subarray(0, seedLength), 0);
    }
  }

  return _ndState;
}

function ndInjectSliceFrom2D(state, source2D, ndConfig) {
  if (!state || !source2D) return;
  if (String(ndConfig?.viewMode || "slice") !== "slice") return;

  const { size, channelCount, depth, dimension } = state;
  const cellCount = size * size;
  const sliceZ =
    ((Math.floor(Number(ndConfig?.sliceZ) || 0) % depth) + depth) % depth;
  const sliceW =
    ((Math.floor(Number(ndConfig?.sliceW) || 0) % depth) + depth) % depth;
  const plane = ndPlaneIndex(dimension, depth, sliceZ, sliceW);
  const planeBase = plane * cellCount * channelCount;

  for (let c = 0; c < channelCount; c++) {
    const srcOff = c * cellCount;
    const dstOff = planeBase + c * cellCount;
    state.world.set(source2D.subarray(srcOff, srcOff + cellCount), dstOff);
  }
}

function ndExtractDisplay(state, ndConfig, outWorld, outPotential, outGrowth) {
  const { size, channelCount, depth, dimension } = state;
  const cellCount = size * size;
  const total2D = cellCount * channelCount;
  const isSlice = String(ndConfig?.viewMode || "projection") === "slice";
  const cache = state._cache || null;

  const world2D =
    outWorld && outWorld.length === total2D
      ? outWorld
      : new Float32Array(total2D);
  const potential2D =
    outPotential && outPotential.length === total2D
      ? outPotential
      : new Float32Array(total2D);
  const growth2D =
    outGrowth && outGrowth.length === total2D
      ? outGrowth
      : new Float32Array(total2D);

  const sliceZ =
    ((Math.floor(Number(ndConfig?.sliceZ) || 0) % depth) + depth) % depth;
  const sliceW =
    ((Math.floor(Number(ndConfig?.sliceW) || 0) % depth) + depth) % depth;

  if (isSlice || dimension <= 2) {
    const plane = ndPlaneIndex(dimension, depth, sliceZ, sliceW);
    const planeBase = plane * cellCount * channelCount;
    for (let c = 0; c < channelCount; c++) {
      const off2d = c * cellCount;
      const offNd = planeBase + c * cellCount;
      world2D.set(state.world.subarray(offNd, offNd + cellCount), off2d);
      potential2D.set(
        state.potential.subarray(offNd, offNd + cellCount),
        off2d,
      );
      growth2D.set(state.growth.subarray(offNd, offNd + cellCount), off2d);
    }
    return { world2D, potential2D, growth2D };
  }

  world2D.fill(0);
  potential2D.fill(0);
  growth2D.fill(0);

  const depthWeights = cache?.depthWeights;
  const projectionOffsets = cache?.projectionPlaneOffsets;
  if (projectionOffsets) {
    if (dimension === 4) {
      if (cache.projectionSliceW !== sliceW) {
        cache.projectionSliceW = sliceW;
        for (let z = 0; z < depth; z++) {
          projectionOffsets[z] =
            (z + sliceW * depth) * cellCount * channelCount;
        }
      }
    } else {
      for (let z = 0; z < depth; z++) {
        projectionOffsets[z] = z * cellCount * channelCount;
      }
    }
  }

  const zStart = depthWeights && depthWeights[0] === 0 ? 1 : 0;

  for (let z = zStart; z < depth; z++) {
    const planeBase = projectionOffsets
      ? projectionOffsets[z]
      : ndPlaneIndex(dimension, depth, z, sliceW) * cellCount * channelCount;
    const w = depthWeights ? depthWeights[z] : z;

    for (let c = 0; c < channelCount; c++) {
      const off2d = c * cellCount;
      const offNd = planeBase + c * cellCount;
      for (let i = 0; i < cellCount; i++) {
        world2D[off2d + i] += state.world[offNd + i] * w;
        potential2D[off2d + i] += state.potential[offNd + i] * w;
        growth2D[off2d + i] += state.growth[offNd + i] * w;
      }
    }
  }

  return { world2D, potential2D, growth2D };
}

function ndStepState(params, ndConfig, kernelFFT, N, source2D, ndSeedWorld) {
  const state = ndEnsureState(params, ndConfig, source2D, ndSeedWorld);
  if (!ndSeedWorld) {
    ndInjectSliceFrom2D(state, source2D, ndConfig);
  }

  const { size, dimension } = state;

  if (!_ndKernelFFT || _ndKernelDim !== dimension || _ndKernelSize !== size) {
    const ndKernel = buildKernelND(params, size, dimension);
    _ndKernelFFT = buildKernelFFTND(ndKernel, size, dimension);
    _ndKernelDim = dimension;
    _ndKernelSize = size;
  }

  stepFFTND(
    state.world,
    state.potential,
    state.growth,
    params,
    _ndKernelFFT,
    size,
    dimension,
  );

  return state;
}

function autoCentreShift(arr, size, shiftX, shiftY, channelCount) {
  if (shiftX === 0 && shiftY === 0) return;
  const len = arr.length;
  if (!_autoCentreTmp || _autoCentreTmpLen < len) {
    _autoCentreTmp = new Float32Array(len);
    _autoCentreTmpLen = len;
  }
  const tmp = _autoCentreTmp;
  const cellCount = size * size;
  const sx = ((shiftX % size) + size) % size;
  const sy = ((shiftY % size) + size) % size;
  if (_autoCentreTyLutSize !== size) {
    _autoCentreTyLut = new Int32Array(size);
    _autoCentreTyLutSize = size;
  }
  const tyLut = _autoCentreTyLut;
  for (let y = 0; y < size; y++) {
    tyLut[y] = ((y + sy) % size) * size;
  }
  const firstLen = size - sx;
  for (let c = 0; c < channelCount; c++) {
    const off = c * cellCount;
    for (let y = 0; y < size; y++) {
      const srcRow = off + y * size;
      const dstRow = off + tyLut[y];
      if (sx === 0) {
        tmp.set(arr.subarray(srcRow, srcRow + size), dstRow);
      } else {
        tmp.set(arr.subarray(srcRow, srcRow + firstLen), dstRow + sx);
        tmp.set(arr.subarray(srcRow + firstLen, srcRow + size), dstRow);
      }
    }
  }
  arr.set(len === _autoCentreTmpLen ? tmp : tmp.subarray(0, len));
}

function shiftNDDepth(arr, planeCellCount, depth, dimension, axis, delta) {
  const d = Math.floor(Number(delta) || 0);
  if (!Number.isFinite(d) || d === 0) return;

  const dim = Math.max(3, Math.floor(Number(dimension) || 3));
  const shift = ((d % depth) + depth) % depth;
  if (shift === 0) return;

  const shiftW = dim >= 4 && String(axis || "z").toLowerCase() === "w";
  const planeCount = dim >= 4 ? depth * depth : depth;
  const len = planeCount * planeCellCount;

  if (!_ndDepthShiftTmp || _ndDepthShiftTmpLen < len) {
    _ndDepthShiftTmp = new Float32Array(len);
    _ndDepthShiftTmpLen = len;
  }
  const tmp = _ndDepthShiftTmp;

  for (let p = 0; p < planeCount; p++) {
    const z = dim >= 4 ? p % depth : p;
    const w = dim >= 4 ? Math.floor(p / depth) : 0;

    const nz = shiftW ? z : (z + shift) % depth;
    const nw = shiftW ? (w + shift) % depth : w;
    const np = dim >= 4 ? nz + nw * depth : nz;

    const src = p * planeCellCount;
    const dst = np * planeCellCount;
    tmp.set(arr.subarray(src, src + planeCellCount), dst);
  }

  arr.set(len === _ndDepthShiftTmpLen ? tmp : tmp.subarray(0, len));
}

function _normaliseSignedShift(shift, size) {
  const span = Math.max(1, Math.floor(Number(size) || 1));
  let s = Math.round(Number(shift) || 0);
  s = ((s % span) + span) % span;
  if (s > Math.floor(span / 2)) s -= span;
  return s;
}

function _wrapIndex(index, size) {
  const span = Math.max(1, Math.floor(Number(size) || 1));
  const wrapped = index % span;
  return wrapped < 0 ? wrapped + span : wrapped;
}

function _hasNonZeroShift(shiftByAxis) {
  if (!Array.isArray(shiftByAxis)) return false;
  for (let i = 0; i < shiftByAxis.length; i++) {
    if (Math.round(Number(shiftByAxis[i]) || 0) !== 0) return true;
  }
  return false;
}

function estimateNDTorusZoomShift(arr, state) {
  if (!state || !arr) return [];

  const dim = Math.max(2, Math.floor(Number(state.dimension) || 2));
  const size = Math.max(1, Math.floor(Number(state.size) || 1));
  const depth = Math.max(2, Math.floor(Number(state.depth) || 2));
  const channelCount = Math.max(1, Math.floor(Number(state.channelCount) || 1));
  const extraDims = Math.max(0, dim - 2);
  const axisSizes = [];
  for (let axis = 0; axis < extraDims; axis++) axisSizes.push(depth);
  axisSizes.push(size);
  axisSizes.push(size);

  const axisMass = axisSizes.map((axisSize) => new Float64Array(axisSize));
  const cellCount = size * size;
  const planeCells = cellCount * channelCount;
  let totalMass = 0;

  if (dim === 3) {
    for (let z = 0; z < depth; z++) {
      const planeBase = z * planeCells;
      for (let c = 0; c < channelCount; c++) {
        const chBase = planeBase + c * cellCount;
        for (let y = 0; y < size; y++) {
          const rowBase = chBase + y * size;
          for (let x = 0; x < size; x++) {
            const val = arr[rowBase + x];
            if (val <= 1e-9) continue;
            totalMass += val;
            axisMass[0][z] += val;
            axisMass[1][y] += val;
            axisMass[2][x] += val;
          }
        }
      }
    }
  } else if (dim === 4) {
    for (let w = 0; w < depth; w++) {
      for (let z = 0; z < depth; z++) {
        const plane = z + w * depth;
        const planeBase = plane * planeCells;
        for (let c = 0; c < channelCount; c++) {
          const chBase = planeBase + c * cellCount;
          for (let y = 0; y < size; y++) {
            const rowBase = chBase + y * size;
            for (let x = 0; x < size; x++) {
              const val = arr[rowBase + x];
              if (val <= 1e-9) continue;
              totalMass += val;
              axisMass[0][z] += val;
              axisMass[1][w] += val;
              axisMass[2][y] += val;
              axisMass[3][x] += val;
            }
          }
        }
      }
    }
  } else {
    const planeCount = Math.max(1, Math.floor(Number(state.planeCount) || 1));
    for (let p = 0; p < planeCount; p++) {
      const extraCoords = ndCoordsFromPlane(p, depth, extraDims);
      const planeBase = p * planeCells;

      for (let c = 0; c < channelCount; c++) {
        const chBase = planeBase + c * cellCount;
        for (let y = 0; y < size; y++) {
          const rowBase = chBase + y * size;
          for (let x = 0; x < size; x++) {
            const val = arr[rowBase + x];
            if (val <= 1e-9) continue;
            totalMass += val;
            for (let axis = 0; axis < extraDims; axis++) {
              axisMass[axis][extraCoords[axis]] += val;
            }
            axisMass[extraDims][y] += val;
            axisMass[extraDims + 1][x] += val;
          }
        }
      }
    }
  }

  if (totalMass <= 1e-9) {
    return axisSizes.map(() => 0);
  }

  const shifts = new Array(axisSizes.length).fill(0);
  for (let axis = 0; axis < axisSizes.length; axis++) {
    const span = axisSizes[axis];
    const massByIndex = axisMass[axis];
    let cosSum = 0;
    let sinSum = 0;

    for (let i = 0; i < span; i++) {
      const m = massByIndex[i];
      if (m <= 1e-12) continue;
      const angle = (2 * Math.PI * i) / span;
      cosSum += m * Math.cos(angle);
      sinSum += m * Math.sin(angle);
    }

    if (Math.abs(cosSum) <= 1e-12 && Math.abs(sinSum) <= 1e-12) {
      shifts[axis] = 0;
      continue;
    }

    const centre =
      ((Math.atan2(sinSum, cosSum) / (2 * Math.PI)) * span + span) % span;
    shifts[axis] = _normaliseSignedShift(Math.round(span / 2 - centre), span);
  }

  return shifts;
}

function applyNDTorusShift(arr, state, shiftByAxis) {
  if (!state || !arr || !Array.isArray(shiftByAxis)) return;

  const dim = Math.max(2, Math.floor(Number(state.dimension) || 2));
  const size = Math.max(1, Math.floor(Number(state.size) || 1));
  const depth = Math.max(2, Math.floor(Number(state.depth) || 2));
  const channelCount = Math.max(1, Math.floor(Number(state.channelCount) || 1));
  const extraDims = Math.max(0, dim - 2);
  const axisCount = extraDims + 2;
  if (shiftByAxis.length < axisCount) return;

  const shifts = new Array(axisCount).fill(0);
  for (let axis = 0; axis < extraDims; axis++) {
    shifts[axis] = _normaliseSignedShift(shiftByAxis[axis], depth);
  }
  shifts[extraDims] = _normaliseSignedShift(shiftByAxis[extraDims], size);
  shifts[extraDims + 1] = _normaliseSignedShift(
    shiftByAxis[extraDims + 1],
    size,
  );
  if (!_hasNonZeroShift(shifts)) return;

  const cellCount = size * size;
  const planeCells = cellCount * channelCount;
  const planeCount = Math.max(1, Math.floor(Number(state.planeCount) || 1));

  const cachedTmp = state._cache?.reorderTmp;
  const tmp =
    cachedTmp && cachedTmp.length === arr.length
      ? cachedTmp
      : new Float32Array(arr.length);

  const shiftX = ((shifts[extraDims + 1] % size) + size) % size;
  const firstLen = size - shiftX;

  for (let dstPlane = 0; dstPlane < planeCount; dstPlane++) {
    const dstCoords = ndCoordsFromPlane(dstPlane, depth, extraDims);
    const srcCoords = new Array(extraDims);
    for (let axis = 0; axis < extraDims; axis++) {
      srcCoords[axis] = _wrapIndex(dstCoords[axis] - shifts[axis], depth);
    }
    const srcPlane = ndPlaneFromCoords(srcCoords, depth);

    const dstPlaneBase = dstPlane * planeCells;
    const srcPlaneBase = srcPlane * planeCells;

    for (let c = 0; c < channelCount; c++) {
      const dstChOff = dstPlaneBase + c * cellCount;
      const srcChOff = srcPlaneBase + c * cellCount;
      for (let y = 0; y < size; y++) {
        const srcY = _wrapIndex(y - shifts[extraDims], size);
        const dstRow = dstChOff + y * size;
        const srcRow = srcChOff + srcY * size;

        if (shiftX === 0) {
          tmp.set(arr.subarray(srcRow, srcRow + size), dstRow);
        } else {
          tmp.set(arr.subarray(srcRow, srcRow + firstLen), dstRow + shiftX);
          tmp.set(arr.subarray(srcRow + firstLen, srcRow + size), dstRow);
        }
      }
    }
  }

  arr.set(tmp.length === arr.length ? tmp : tmp.subarray(0, arr.length));
}

function zoomNDTensor(arr, state, factor, wrapShift = null) {
  if (!state || !arr || Math.abs(factor - 1) <= 1e-6) return;

  const dim = Math.max(2, Math.floor(Number(state.dimension) || 2));
  const size = Math.max(1, Math.floor(Number(state.size) || 1));
  const depth = Math.max(2, Math.floor(Number(state.depth) || 2));
  const channelCount = Math.max(1, Math.floor(Number(state.channelCount) || 1));
  const extraDims = Math.max(0, dim - 2);
  const cellCount = size * size;
  const planeCells = cellCount * channelCount;

  const mapNearestIndex = (dstIndex, srcSize, dstSize) => {
    if (srcSize <= 1 || dstSize <= 1) return 0;
    const srcPos = (dstIndex * (srcSize - 1)) / (dstSize - 1);
    return Math.max(0, Math.min(srcSize - 1, Math.round(srcPos)));
  };

  const axisSizes = [];
  for (let axis = 0; axis < extraDims; axis++) axisSizes.push(depth);
  axisSizes.push(size);
  axisSizes.push(size);

  const effectiveWrapShift =
    Array.isArray(wrapShift) && wrapShift.length >= axisSizes.length
      ? wrapShift.slice(0, axisSizes.length)
      : estimateNDTorusZoomShift(arr, state);
  for (let axis = 0; axis < axisSizes.length; axis++) {
    effectiveWrapShift[axis] = _normaliseSignedShift(
      effectiveWrapShift[axis],
      axisSizes[axis],
    );
  }
  const hasWrapShift = _hasNonZeroShift(effectiveWrapShift);

  const axisMaps = [];
  let hasShapeChange = false;
  for (let axis = 0; axis < axisSizes.length; axis++) {
    const oldDim = axisSizes[axis];
    const newDim = Math.max(1, Math.round(oldDim * factor));
    if (newDim !== oldDim) hasShapeChange = true;

    const minDim = Math.min(oldDim, newDim);
    const offDst = Math.floor((oldDim - minDim) / 2);
    const offSrc = Math.floor((newDim - minDim) / 2);

    const srcByDst = new Int32Array(oldDim);
    srcByDst.fill(-1);
    for (let d = 0; d < minDim; d++) {
      const dst = offDst + d;
      const z = offSrc + d;
      srcByDst[dst] = mapNearestIndex(z, oldDim, newDim);
    }

    axisMaps.push(srcByDst);
  }

  if (!hasShapeChange) return;

  if (hasWrapShift) {
    applyNDTorusShift(arr, state, effectiveWrapShift);
  }

  const out = new Float32Array(arr.length);
  const finaliseZoom = () => {
    arr.set(out);

    if (!hasWrapShift) return;

    const inverseShift = new Array(axisSizes.length);
    for (let axis = 0; axis < axisSizes.length; axis++) {
      inverseShift[axis] = _normaliseSignedShift(
        -Math.round(effectiveWrapShift[axis] * factor),
        axisSizes[axis],
      );
    }
    if (_hasNonZeroShift(inverseShift)) {
      applyNDTorusShift(arr, state, inverseShift);
    }
  };

  const yMap = axisMaps[axisMaps.length - 2];
  const xMap = axisMaps[axisMaps.length - 1];

  if (dim === 3) {
    const zMap = axisMaps[0];
    for (let z = 0; z < depth; z++) {
      const sz = zMap[z];
      if (sz < 0) continue;

      const dstPlane = z;
      const srcPlane = sz;
      const dstPlaneBase = dstPlane * planeCells;
      const srcPlaneBase = srcPlane * planeCells;

      for (let c = 0; c < channelCount; c++) {
        const dstChOff = dstPlaneBase + c * cellCount;
        const srcChOff = srcPlaneBase + c * cellCount;

        for (let y = 0; y < size; y++) {
          const sy = yMap[y];
          if (sy < 0) continue;

          const dstRow = dstChOff + y * size;
          const srcRow = srcChOff + sy * size;
          for (let x = 0; x < size; x++) {
            const sx = xMap[x];
            if (sx < 0) continue;
            out[dstRow + x] = arr[srcRow + sx];
          }
        }
      }
    }

    finaliseZoom();
    return;
  }

  if (dim === 4) {
    const zMap = axisMaps[0];
    const wMap = axisMaps[1];
    for (let w = 0; w < depth; w++) {
      const sw = wMap[w];
      if (sw < 0) continue;

      for (let z = 0; z < depth; z++) {
        const sz = zMap[z];
        if (sz < 0) continue;

        const dstPlane = z + w * depth;
        const srcPlane = sz + sw * depth;
        const dstPlaneBase = dstPlane * planeCells;
        const srcPlaneBase = srcPlane * planeCells;

        for (let c = 0; c < channelCount; c++) {
          const dstChOff = dstPlaneBase + c * cellCount;
          const srcChOff = srcPlaneBase + c * cellCount;

          for (let y = 0; y < size; y++) {
            const sy = yMap[y];
            if (sy < 0) continue;

            const dstRow = dstChOff + y * size;
            const srcRow = srcChOff + sy * size;
            for (let x = 0; x < size; x++) {
              const sx = xMap[x];
              if (sx < 0) continue;
              out[dstRow + x] = arr[srcRow + sx];
            }
          }
        }
      }
    }

    finaliseZoom();
    return;
  }

  const planeCount = Math.max(1, Math.floor(Number(state.planeCount) || 1));
  const extraMaps = axisMaps.slice(0, extraDims);
  for (let p = 0; p < planeCount; p++) {
    const dstCoords = ndCoordsFromPlane(p, depth, extraDims);
    const srcCoords = new Array(extraDims);
    let valid = true;
    for (let axis = 0; axis < extraDims; axis++) {
      const mapped = extraMaps[axis][dstCoords[axis]];
      if (mapped < 0) {
        valid = false;
        break;
      }
      srcCoords[axis] = mapped;
    }
    if (!valid) continue;

    const srcPlane = ndPlaneFromCoords(srcCoords, depth);
    const dstPlaneBase = p * planeCells;
    const srcPlaneBase = srcPlane * planeCells;

    for (let c = 0; c < channelCount; c++) {
      const dstChOff = dstPlaneBase + c * cellCount;
      const srcChOff = srcPlaneBase + c * cellCount;

      for (let y = 0; y < size; y++) {
        const sy = yMap[y];
        if (sy < 0) continue;

        const dstRow = dstChOff + y * size;
        const srcRow = srcChOff + sy * size;
        for (let x = 0; x < size; x++) {
          const sx = xMap[x];
          if (sx < 0) continue;
          out[dstRow + x] = arr[srcRow + sx];
        }
      }
    }
  }

  finaliseZoom();
}

function _clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

const _toFiniteNumber = _workerSanitisers.toFiniteNumber;
const _toInteger = _workerSanitisers.toInteger;

function _sanitiseWorkerParams(rawParams) {
  const source = rawParams && typeof rawParams === "object" ? rawParams : {};
  const params = { ...source };

  params.size = _toInteger(source.size, 128, 16, 2048);
  params.R = _toInteger(
    source.R,
    13,
    1,
    Math.max(1, Math.floor(params.size / 2)),
  );
  params.T = Math.max(0.1, _toFiniteNumber(source.T, 10));
  params.m = _clamp(_toFiniteNumber(source.m, 0.15), 0, 1);
  params.s = _clamp(_toFiniteNumber(source.s, 0.015), 0.0001, 1);
  params.r = Math.max(0.0001, _toFiniteNumber(source.r, 1));
  params.kn = _toInteger(source.kn, 1, 1, 4);
  params.gn = _toInteger(source.gn, 1, 1, 3);
  params.h = Math.max(0.0001, _toFiniteNumber(source.h, 1));
  params.addNoise = _clamp(_toFiniteNumber(source.addNoise, 0), 0, 10);
  params.maskRate = _clamp(_toFiniteNumber(source.maskRate, 0), 0, 10);
  params.paramP = _toInteger(source.paramP, 0, 0, 64);
  params.softClip = Boolean(source.softClip);
  params.multiStep = Boolean(source.multiStep);

  if (Array.isArray(source.b)) {
    const b = source.b
      .slice(0, 8)
      .map((v) => Math.max(0, _toFiniteNumber(v, 0)))
      .filter((v) => Number.isFinite(v));
    params.b = b.length > 0 ? b : [1];
  } else {
    params.b = [1];
  }

  return params;
}

function _toFloat32Array(buffer, expectedLength) {
  if (!(buffer instanceof ArrayBuffer)) {
    return new Float32Array(Math.max(0, expectedLength || 0));
  }

  const incoming = new Float32Array(buffer);
  if (!Number.isFinite(expectedLength) || expectedLength <= 0) {
    return incoming;
  }

  if (incoming.length === expectedLength) {
    return incoming;
  }

  const out = new Float32Array(expectedLength);
  out.set(incoming.subarray(0, Math.min(incoming.length, expectedLength)));
  return out;
}
