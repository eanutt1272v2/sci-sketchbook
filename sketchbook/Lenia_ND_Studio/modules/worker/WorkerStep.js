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

function stepFFTMulti(
  cells,
  potential,
  field,
  fieldOld,
  params,
  kernelFFT,
  N,
  changeOut,
) {
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

const _ndFFTScratch = { N: 0, ndim: 0, buf: null };

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
  params,
  kernelFFTND,
  N,
  ndim,
) {
  const total = Math.pow(N, ndim);

  const buf = getNDFFTScratch(N, ndim);
  prepareFFTInputND(buf, worldFlat, total);

  fftND(buf, N, ndim, false);

  const len2 = total * 2;
  for (let j = 0; j < len2; j += 2) {
    const ar = buf[j];
    const ai = buf[j + 1];
    const br = kernelFFTND[j];
    const bi = kernelFFTND[j + 1];
    buf[j] = ar * br - ai * bi;
    buf[j + 1] = ar * bi + ai * br;
  }

  fftND(buf, N, ndim, true);

  const {
    T,
    m,
    s,
    gn,
    softClip,
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
  const isArita = !!aritaMode;
  const hasQuant = paramP > 0;
  const inv9s2 = 1 / (9 * s * s);
  const inv2s2 = 1 / (2 * s * s);
  const softK = softClip ? 1 / dt : 0;
  const softC = softClip ? Math.exp(-softK) : 0;

  const size = N;
  const planeCellCount = size * size;
  const planeCount = total / planeCellCount;
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
  const lutE = _growthLutExp;
  const lutP = _growthLutPoly;
  const lutEScale = _GLI_EXP;
  const lutPScale = _GLI_POLY;
  const lutLast = _GROWTH_LUT_SIZE - 1;

  for (let plane = 0; plane < planeCount; plane++) {
    const planeBase = plane * planeCellCount;
    let planeMassAcc = 0;

    for (let y = 0; y < size; y++) {
      const rowBase = planeBase + y * size;
      const cy = cosT[y];
      const sy = sinT[y];

      for (let x = 0; x < size; x++) {
        const i = rowBase + x;
        const pot = buf[i * 2];
        potentialFlat[i] = pot;

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
        fieldFlat[i] = growth;

        let D;
        if (isArita) {
          D = dtH * ((growth + 1) / 2 - worldFlat[i]);
        } else {
          D = dtH * growth;
        }
        let newVal = worldFlat[i] + D;

        if (hasNoise) newVal *= 1 + (Math.random() - 0.5) * noiseAmp;

        if (softClip) {
          const a2 = Math.exp(softK * newVal);
          newVal = Math.log(1 / (a2 + 1) + softC) / -softK;
        } else {
          if (newVal < 0) newVal = 0;
          else if (newVal > 1) newVal = 1;
        }

        if (hasQuant) newVal = Math.round(newVal * paramP) / paramP;
        if (!hasMask || Math.random() > mr) worldFlat[i] = newVal;

        const v = worldFlat[i];
        acCosX += v * cosT[x];
        acSinX += v * sinT[x];
        acCosY += v * cy;
        acSinY += v * sy;
        planeMassAcc += v;
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
