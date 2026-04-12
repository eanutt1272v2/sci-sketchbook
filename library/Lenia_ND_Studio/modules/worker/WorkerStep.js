function _buildCellUpdateConfig(params) {
  const dt = 1 / Math.max(0.0001, Number(params.T) || 10);
  const noiseAmp = (Number(params.addNoise) || 0) / 10;
  const mr = (Number(params.maskRate) || 0) / 10;
  const sc = Boolean(params.softClip);
  const softK = sc ? 1 / dt : 0;
  const softC = sc ? Math.exp(-softK) : 0;
  const pP = Number(params.paramP) || 0;
  return {
    dt,
    noiseAmp,
    hasNoise: noiseAmp > 0,
    mr,
    hasMask: mr > 0,
    softClip: sc,
    softK,
    softC,
    hasQuant: pP > 0,
    quantP: Math.max(1, Math.round(pP)),
  };
}

function stepFFT(
  cells,
  potential,
  field,
  fieldOld,
  params,
  kernelFFT,
  N,
  changeOut,
) {
  const size = params.size;
  const count = size * size;
  const scratch = getFFTScratch(N);

  const cellBuf = scratch.cellBuf;
  prepareFFTInput2D(cellBuf, cells, size, N);
  fft2D(cellBuf, N, false);

  const result = scratch.result;
  const len2 = N * N * 2;
  for (let j = 0; j < len2; j += 2) {
    const ar = cellBuf[j];
    const ai = cellBuf[j + 1];
    const br = kernelFFT[j];
    const bi = kernelFFT[j + 1];
    result[j] = ar * br - ai * bi;
    result[j + 1] = ar * bi + ai * br;
  }
  fft2D(result, N, true);

  if (size === N) {
    for (let i = 0; i < count; i++) {
      potential[i] = result[i * 2];
    }
  } else {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        potential[y * size + x] = result[(y * N + x) * 2];
      }
    }
  }

  const {
    T,
    m,
    s,
    gn,
    softClip,
    multiStep,
    addNoise,
    maskRate,
    paramP,
    aritaMode,
    h: hParam,
  } = params;
  const dt = 1 / T;
  const h = Number(hParam) || 1;
  const dtH = dt * h;
  const noiseAmp = addNoise / 10;
  const hasNoise = noiseAmp > 0;
  const mr = maskRate / 10;
  const hasMask = mr > 0;
  const hasOld = multiStep && fieldOld;
  const isArita = !!aritaMode;
  const hasQuant = paramP > 0;
  const inv9s2 = 1 / (9 * s * s);
  const inv2s2 = 1 / (2 * s * s);
  const softK = softClip ? 1 / dt : 0;
  const softC = softClip ? Math.exp(-softK) : 0;

  const change =
    changeOut && changeOut.length === count
      ? changeOut
      : new Float32Array(count);

  const trig = getTrigTables(size);
  const cosT = trig.cos;
  const sinT = trig.sin;
  let acCosX = 0,
    acSinX = 0,
    acCosY = 0,
    acSinY = 0,
    acMass = 0;
  const lutE = _growthLutExp;
  const lutP = _growthLutPoly;
  const lutEScale = _GLI_EXP;
  const lutPScale = _GLI_POLY;
  const lutLast = _GROWTH_LUT_SIZE - 1;

  for (let y = 0; y < size; y++) {
    const row = y * size;
    const cy = cosT[y];
    const sy = sinT[y];
    for (let x = 0; x < size; x++) {
      const i = row + x;
      const pot = potential[i];
      const diff = pot - m;
      let growth;
      if (gn === 2) {
        const u = diff * diff * inv2s2;
        const fi = u * lutEScale;
        const idx = fi | 0;
        if (idx >= lutLast) {
          growth = -1;
        } else {
          growth = lutE[idx] + (lutE[idx + 1] - lutE[idx]) * (fi - idx);
        }
      } else if (gn === 3) {
        growth = Math.abs(diff) <= s ? 1 : -1;
      } else {
        const v = diff * diff * inv9s2;
        const fi = v * lutPScale;
        const idx = fi | 0;
        if (idx >= lutLast) {
          growth = -1;
        } else {
          growth = lutP[idx] + (lutP[idx + 1] - lutP[idx]) * (fi - idx);
        }
      }
      field[i] = growth;

      let D;
      if (isArita) {
        D = (growth + 1) / 2 - cells[i];
      } else {
        D = growth;
      }
      if (hasOld && !isArita) D = 0.5 * (3 * field[i] - fieldOld[i]);

      const deltaTerm = dtH * D;
      let newVal = cells[i] + deltaTerm;
      change[i] = deltaTerm;

      if (hasNoise) newVal *= 1 + (Math.random() - 0.5) * noiseAmp;

      if (softClip) {
        const a = Math.exp(softK * newVal);
        newVal = Math.log(1 / (a + 1) + softC) / -softK;
      } else {
        if (newVal < 0) newVal = 0;
        else if (newVal > 1) newVal = 1;
      }

      if (hasQuant) newVal = Math.round(newVal * paramP) / paramP;
      if (!hasMask || Math.random() > mr) cells[i] = newVal;

      const v = cells[i];
      acCosX += v * cosT[x];
      acSinX += v * sinT[x];
      acCosY += v * cy;
      acSinY += v * sy;
      acMass += v;
    }
  }

  _stepCentreCache.cosX = acCosX;
  _stepCentreCache.sinX = acSinX;
  _stepCentreCache.cosY = acCosY;
  _stepCentreCache.sinY = acSinY;
  _stepCentreCache.mass = acMass;
  _stepCentreCache.valid = true;

  return change;
}

function _convolveChannel(cells, size, kernelFFT, N, outPotential) {
  const scratch = getFFTScratch(N);
  const cellBuf = scratch.cellBuf;
  prepareFFTInput2D(cellBuf, cells, size, N);
  fft2D(cellBuf, N, false);

  const result = scratch.result;
  const len2 = N * N * 2;
  for (let j = 0; j < len2; j += 2) {
    const ar = cellBuf[j];
    const ai = cellBuf[j + 1];
    const br = kernelFFT[j];
    const bi = kernelFFT[j + 1];
    result[j] = ar * br - ai * bi;
    result[j + 1] = ar * bi + ai * br;
  }
  fft2D(result, N, true);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      outPotential[y * size + x] = result[(y * N + x) * 2];
    }
  }
}

function stepFFTSingle(
  cells,
  potential,
  field,
  fieldOld,
  params,
  kernelFFT,
  N,
  changeOut,
) {
  return stepFFT(
    cells,
    potential,
    field,
    fieldOld,
    params,
    kernelFFT,
    N,
    changeOut,
  );
}

function _kernelGrowthAt(pot, m, s, gn) {
  const diff = pot - m;
  if (gn === 2) {
    const u = (diff * diff) / (2 * s * s);
    const fi = u * _GLI_EXP;
    const idx = fi | 0;
    if (idx >= _GROWTH_LUT_SIZE - 1) return -1;
    const lut = _growthLutExp;
    return lut[idx] + (lut[idx + 1] - lut[idx]) * (fi - idx);
  }
  if (gn === 3) {
    return Math.abs(diff) <= s ? 1 : -1;
  }
  const v = (diff * diff) / (9 * s * s);
  const fi = v * _GLI_POLY;
  const idx = fi | 0;
  if (idx >= _GROWTH_LUT_SIZE - 1) return -1;
  const lut = _growthLutPoly;
  return lut[idx] + (lut[idx + 1] - lut[idx]) * (fi - idx);
}

const _multiKernelStepScratch = {
  cellCount: 0,
  channelCount: 0,
  potentialTmp: null,
  growthTmp: null,
  dAccum: null,
  dWeight: null,
};

function _getMultiKernelStepScratch(cellCount, channelCount) {
  const total = cellCount * channelCount;
  if (
    _multiKernelStepScratch.cellCount !== cellCount ||
    _multiKernelStepScratch.channelCount !== channelCount ||
    !_multiKernelStepScratch.potentialTmp ||
    !_multiKernelStepScratch.growthTmp ||
    !_multiKernelStepScratch.dAccum ||
    !_multiKernelStepScratch.dWeight ||
    _multiKernelStepScratch.dAccum.length !== total
  ) {
    _multiKernelStepScratch.cellCount = cellCount;
    _multiKernelStepScratch.channelCount = channelCount;
    _multiKernelStepScratch.potentialTmp = new Float32Array(cellCount);
    _multiKernelStepScratch.growthTmp = new Float32Array(cellCount);
    _multiKernelStepScratch.dAccum = new Float32Array(total);
    _multiKernelStepScratch.dWeight = new Float32Array(total);
  }
  return _multiKernelStepScratch;
}

function stepFFTMulti(
  cells,
  potential,
  field,
  fieldOld,
  params,
  kernelFFTs,
  N,
  changeOut,
) {
  const size = params.size;
  const cellCount = size * size;
  const totalLength = cells.length;
  const channelCount = Math.max(
    1,
    Math.floor(Number(params.channelCount) || totalLength / cellCount || 1),
  );

  const kernels = Array.isArray(kernelFFTs)
    ? kernelFFTs.filter((k) => k && typeof k.length === "number")
    : kernelFFTs
      ? [kernelFFTs]
      : [];

  if (channelCount <= 1 && kernels.length === 1) {
    const kernelFFT = kernels[0];
    return stepFFTSingle(
      cells,
      potential,
      field,
      fieldOld,
      params,
      kernelFFT,
      N,
      changeOut,
    );
  }

  if (kernels.length === 0) {
    return changeOut && changeOut.length === totalLength
      ? changeOut.fill(0)
      : new Float32Array(totalLength);
  }

  const kernelParams = Array.isArray(params.kernelParams)
    ? params.kernelParams
    : [];
  const selectedKernel = Math.max(
    0,
    Math.min(
      kernels.length - 1,
      Math.floor(Number(params.selectedKernel) || 0),
    ),
  );

  const scratch = _getMultiKernelStepScratch(cellCount, channelCount);
  const potentialTmp = scratch.potentialTmp;
  const growthTmp = scratch.growthTmp;
  const dAccum = scratch.dAccum;
  const dWeight = scratch.dWeight;
  dAccum.fill(0);
  dWeight.fill(0);

  potential.fill(0);
  field.fill(0);

  const hasFieldOld = fieldOld && fieldOld.length === totalLength;

  for (let k = 0; k < kernels.length; k++) {
    const kp = resolveKernelStepParams(params, kernelParams[k], channelCount);
    const srcOffset = kp.c0 * cellCount;
    const dstOffset = kp.c1 * cellCount;

    _convolveChannel(
      cells.subarray(srcOffset, srcOffset + cellCount),
      size,
      kernels[k],
      N,
      potentialTmp,
    );

    for (let i = 0; i < cellCount; i++) {
      const pot = potentialTmp[i];
      const growth = _kernelGrowthAt(pot, kp.m, kp.s, kp.gn);
      growthTmp[i] = growth;

      let D;
      if (kp.aritaMode) {
        D = (growth + 1) / 2 - cells[dstOffset + i];
      } else {
        D = growth;
      }
      if (kp.multiStep && hasFieldOld && !kp.aritaMode) {
        D = 0.5 * (3 * growth - fieldOld[dstOffset + i]);
      }

      dAccum[dstOffset + i] += kp.h * D;
      dWeight[dstOffset + i] += kp.h;

      if (k === selectedKernel) {
        potential[dstOffset + i] = pot;
        field[dstOffset + i] = growth;
      }
    }
  }

  const dt = 1 / Math.max(0.0001, Number(params.T) || 10);
  const cuc = _buildCellUpdateConfig(params);
  const { noiseAmp, hasNoise, mr, hasMask, softClip, softK, softC, hasQuant, quantP } = cuc;

  const change =
    changeOut && changeOut.length === totalLength
      ? changeOut
      : new Float32Array(totalLength);

  const trig = getTrigTables(size);
  const cosT = trig.cos;
  const sinT = trig.sin;
  let acCosX = 0;
  let acSinX = 0;
  let acCosY = 0;
  let acSinY = 0;
  let acMass = 0;

  for (let c = 0; c < channelCount; c++) {
    const offset = c * cellCount;
    for (let y = 0; y < size; y++) {
      const row = offset + y * size;
      const cy = cosT[y];
      const sy = sinT[y];
      for (let x = 0; x < size; x++) {
        const i = row + x;
        const denom = dWeight[i] > 0 ? dWeight[i] : 1;
        const deltaTerm = dt * (dAccum[i] / denom);
        let newVal = cells[i] + deltaTerm;
        change[i] = deltaTerm;

        if (hasNoise) newVal *= 1 + (Math.random() - 0.5) * noiseAmp;

        if (softClip) {
          const a = Math.exp(softK * newVal);
          newVal = Math.log(1 / (a + 1) + softC) / -softK;
        } else {
          if (newVal < 0) newVal = 0;
          else if (newVal > 1) newVal = 1;
        }

        if (hasQuant) newVal = Math.round(newVal * quantP) / quantP;
        if (!hasMask || Math.random() > mr) cells[i] = newVal;

        const v = cells[i];
        acCosX += v * cosT[x];
        acSinX += v * sinT[x];
        acCosY += v * cy;
        acSinY += v * sy;
        acMass += v;
      }
    }
  }

  _stepCentreCache.cosX = acCosX;
  _stepCentreCache.sinX = acSinX;
  _stepCentreCache.cosY = acCosY;
  _stepCentreCache.sinY = acSinY;
  _stepCentreCache.mass = acMass;
  _stepCentreCache.valid = true;

  return change;
}

const _ndFFTScratch = { N: 0, ndim: 0, buf: null };
const _ndMultiStepScratch = {
  total: 0,
  channelCount: 0,
  channelWorld: null,
  dAccum: null,
  dWeight: null,
};

function getNDFFTScratch(N, ndim) {
  const total = Math.pow(N, ndim);
  const required = total * 2;
  if (
    _ndFFTScratch.N !== N ||
    _ndFFTScratch.ndim !== ndim ||
    !_ndFFTScratch.buf ||
    _ndFFTScratch.buf.length < required
  ) {
    _ndFFTScratch.N = N;
    _ndFFTScratch.ndim = ndim;
    _ndFFTScratch.buf = new Float64Array(required);
  }
  return _ndFFTScratch.buf;
}

function getNDMultiStepScratch(total, channelCount) {
  const expected = total * channelCount;
  if (
    _ndMultiStepScratch.total !== total ||
    _ndMultiStepScratch.channelCount !== channelCount ||
    !_ndMultiStepScratch.channelWorld ||
    !_ndMultiStepScratch.dAccum ||
    !_ndMultiStepScratch.dWeight ||
    _ndMultiStepScratch.dAccum.length !== expected
  ) {
    _ndMultiStepScratch.total = total;
    _ndMultiStepScratch.channelCount = channelCount;
    _ndMultiStepScratch.channelWorld = new Float32Array(total);
    _ndMultiStepScratch.dAccum = new Float32Array(expected);
    _ndMultiStepScratch.dWeight = new Float32Array(expected);
  }
  return _ndMultiStepScratch;
}

function prepareFFTInputND(buf, worldFlat, total) {
  const count = Math.min(total, worldFlat.length);
  for (let i = 0; i < count; i++) {
    const bi = i * 2;
    buf[bi] = worldFlat[i];
    buf[bi + 1] = 0;
  }
  for (let i = count; i < total; i++) {
    const bi = i * 2;
    buf[bi] = 0;
    buf[bi + 1] = 0;
  }
}

function stepFFTND(
  worldFlat,
  potentialFlat,
  fieldFlat,
  fieldOldFlat,
  params,
  kernelFFTNDs,
  N,
  ndim,
) {
  const total = Math.pow(N, ndim);

  const channelCount = Math.max(
    1,
    Math.floor(Number(params.channelCount) || worldFlat.length / total || 1),
  );
  const expectedLength = total * channelCount;
  const kernels = Array.isArray(kernelFFTNDs)
    ? kernelFFTNDs.filter((k) => k && typeof k.length === "number")
    : kernelFFTNDs
      ? [kernelFFTNDs]
      : [];
  if (!kernels.length) return;

  const kernelParams = Array.isArray(params.kernelParams)
    ? params.kernelParams
    : [];
  const selectedKernel = Math.max(
    0,
    Math.min(
      kernels.length - 1,
      Math.floor(Number(params.selectedKernel) || 0),
    ),
  );

  const scratch = getNDMultiStepScratch(total, channelCount);
  const channelWorld = scratch.channelWorld;
  const dAccum = scratch.dAccum;
  const dWeight = scratch.dWeight;
  dAccum.fill(0);
  dWeight.fill(0);
  potentialFlat.fill(0);
  fieldFlat.fill(0);

  const planeCellCount = N * N;
  const planeCount = total / planeCellCount;
  const hasFieldOld = fieldOldFlat && fieldOldFlat.length === expectedLength;

  const buf = getNDFFTScratch(N, ndim);
  const len2 = total * 2;

  for (let k = 0; k < kernels.length; k++) {
    const kp = resolveKernelStepParams(params, kernelParams[k], channelCount);

    for (let plane = 0; plane < planeCount; plane++) {
      const srcBase =
        plane * planeCellCount * channelCount + kp.c0 * planeCellCount;
      channelWorld.set(
        worldFlat.subarray(srcBase, srcBase + planeCellCount),
        plane * planeCellCount,
      );
    }

    prepareFFTInputND(buf, channelWorld, total);
    fftND(buf, N, ndim, false);

    const kernelFFTND = kernels[k];
    for (let j = 0; j < len2; j += 2) {
      const ar = buf[j];
      const ai = buf[j + 1];
      const br = kernelFFTND[j];
      const bi = kernelFFTND[j + 1];
      buf[j] = ar * br - ai * bi;
      buf[j + 1] = ar * bi + ai * br;
    }

    fftND(buf, N, ndim, true);

    for (let plane = 0; plane < planeCount; plane++) {
      const contigBase = plane * planeCellCount;
      const dstBase =
        plane * planeCellCount * channelCount + kp.c1 * planeCellCount;
      for (let i = 0; i < planeCellCount; i++) {
        const idx = contigBase + i;
        const dstIdx = dstBase + i;
        const pot = buf[idx * 2];
        const growth = _kernelGrowthAt(pot, kp.m, kp.s, kp.gn);

        let D;
        if (kp.aritaMode) {
          D = (growth + 1) / 2 - worldFlat[dstIdx];
        } else {
          D = growth;
        }
        if (kp.multiStep && hasFieldOld && !kp.aritaMode) {
          D = 0.5 * (3 * growth - fieldOldFlat[dstIdx]);
        }

        dAccum[dstIdx] += kp.h * D;
        dWeight[dstIdx] += kp.h;

        if (k === selectedKernel) {
          potentialFlat[dstIdx] = pot;
          fieldFlat[dstIdx] = growth;
        }
      }
    }
  }

  const cucND = _buildCellUpdateConfig(params);
  const {
    dt, noiseAmp, hasNoise, mr, hasMask, softClip, softK, softC, hasQuant, quantP,
  } = cucND;

  for (let i = 0; i < expectedLength; i++) {
    const denom = dWeight[i] > 0 ? dWeight[i] : 1;
    const delta = dt * (dAccum[i] / denom);
    let newVal = worldFlat[i] + delta;

    if (hasNoise) newVal *= 1 + (Math.random() - 0.5) * noiseAmp;

    if (softClip) {
      const a2 = Math.exp(softK * newVal);
      newVal = Math.log(1 / (a2 + 1) + softC) / -softK;
    } else {
      if (newVal < 0) newVal = 0;
      else if (newVal > 1) newVal = 1;
    }

    if (hasQuant) newVal = Math.round(newVal * quantP) / quantP;
    if (!hasMask || Math.random() > mr) worldFlat[i] = newVal;
  }

  const size = N;
  const trig = getTrigTables(size);
  const cosT = trig.cos;
  const sinT = trig.sin;

  if (!_ndStepCache.planeMass || _ndStepCache.planeMass.length < planeCount) {
    _ndStepCache.planeMass = new Float32Array(planeCount);
  }

  let acCosX = 0,
    acSinX = 0,
    acCosY = 0,
    acSinY = 0,
    acMass = 0;

  for (let plane = 0; plane < planeCount; plane++) {
    const planeBase = plane * planeCellCount * channelCount;
    let planeMassAcc = 0;

    for (let c = 0; c < channelCount; c++) {
      const channelBase = planeBase + c * planeCellCount;
      for (let y = 0; y < size; y++) {
        const rowBase = channelBase + y * size;
        const cy = cosT[y];
        const sy = sinT[y];
        for (let x = 0; x < size; x++) {
          const i = rowBase + x;
          const v = worldFlat[i];
          acCosX += v * cosT[x];
          acSinX += v * sinT[x];
          acCosY += v * cy;
          acSinY += v * sy;
          planeMassAcc += v;
        }
      }
    }

    acMass += planeMassAcc;
    _ndStepCache.planeMass[plane] = planeMassAcc;
  }

  _ndStepCache.cosX = acCosX;
  _ndStepCache.sinX = acSinX;
  _ndStepCache.cosY = acCosY;
  _ndStepCache.sinY = acSinY;
  _ndStepCache.totalMass = acMass;
  _ndStepCache.planeCount = planeCount;
  _ndStepCache.valid = true;
}
