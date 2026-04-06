function detectSymmetry(polarSource, size, stats, state, params) {
  const cx = stats.mass > state.epsilon ? stats.centreX : size / 2;
  const cy = stats.mass > state.epsilon ? stats.centreY : size / 2;
  const sizer = size >> 1;
  const angularBins = size;
  const tables = getSymmetryTables(angularBins);
  const thetaCos = tables.thetaCos;
  const thetaSin = tables.thetaSin;
  const harmonicCos = tables.harmonicCos;
  const harmonicSin = tables.harmonicSin;
  const numRadii = sizer;
  const numFreqBins = sizer;
  const maxHarmonicSearch = numFreqBins;

  const totalPolarRows = 2 * sizer - 1;
  if (_symmScratch.size !== size) {
    _symmScratch.size = size;
    _symmScratch.prAngles = new Float32Array(totalPolarRows * angularBins);
    _symmScratch.radiusVec = new Float32Array(numRadii);
    _symmScratch.densitySum = new Float32Array(maxHarmonicSearch);
    _symmScratch.sidesVec = new Uint8Array(numRadii);
    _symmScratch.angleVec = new Float32Array(numRadii);
    _symmScratch.rotateVec = new Float32Array(numRadii);
    _symmScratch.avgPerRadius = new Float32Array(numRadii);
    _symmScratch.polarDensity = new Float32Array(numRadii * numFreqBins);
    _symmScratch.polarAngle = new Float32Array(numRadii * numFreqBins);
    _symmScratch.polarRotate = new Float32Array(numRadii * numFreqBins);
    _symmScratch.polarTH = new Float32Array(angularBins);
    _symmScratch.polarR = new Float32Array(numRadii);
    _symmScratch.rotateWSum = new Float32Array(numRadii * numFreqBins);
  }
  const prAngles = _symmScratch.prAngles;
  const radiusVec = _symmScratch.radiusVec;
  prAngles.fill(0);
  radiusVec.fill(0);
  for (let rIdx = 0; rIdx < totalPolarRows; rIdx++) {
    const r = sizer - 1 - rIdx;
    const rOffset = rIdx * angularBins;
    if (rIdx < numRadii) radiusVec[rIdx] = r;
    for (let theta = 0; theta < angularBins; theta++) {
      const ux = thetaCos[theta];
      const uy = thetaSin[theta];
      const x = ((Math.trunc(cx + r * ux) % size) + size) % size;
      const y = ((Math.trunc(cy + r * uy) % size) + size) % size;
      prAngles[rOffset + theta] = polarSource[y * size + x];
    }
  }

  const polarAngles = blurPolarArray(prAngles, numRadii, angularBins, 2, 1);

  const densitySum = _symmScratch.densitySum;
  const sidesVec = _symmScratch.sidesVec;
  const angleVec = _symmScratch.angleVec;
  const rotateVec = _symmScratch.rotateVec;
  const avgPerRadius = _symmScratch.avgPerRadius;
  const polarDensity = _symmScratch.polarDensity;
  const polarAngle = _symmScratch.polarAngle;
  const polarRotate = _symmScratch.polarRotate;
  densitySum.fill(0);
  sidesVec.fill(0);
  angleVec.fill(0);
  rotateVec.fill(0);
  avgPerRadius.fill(0);
  polarDensity.fill(0);
  polarAngle.fill(0);
  polarRotate.fill(0);

  for (let rIdx = 0; rIdx < numRadii; rIdx++) {
    const rOffset = rIdx * angularBins;
    let avg = 0;
    for (let t = 0; t < numFreqBins; t++) avg += polarAngles[rOffset + t];
    avg /= numFreqBins;
    avgPerRadius[rIdx] = avg;

    let bestMag = 0;
    let bestK = 0;

    for (let k = 0; k < numFreqBins; k++) {
      const hRow = k * angularBins;
      let cs = 0,
        ss = 0;
      for (let n = 0; n < angularBins; n++) {
        const a = polarAngles[rOffset + n];
        cs += a * harmonicCos[hRow + n];
        ss += a * harmonicSin[hRow + n];
      }

      const mag = Math.sqrt(cs * cs + ss * ss) / angularBins;
      const idx = rIdx * numFreqBins + k;
      polarDensity[idx] = k === 0 ? 0 : mag;

      const denom = k === 0 ? 1 : k;
      polarAngle[idx] = Math.atan2(-ss, cs) / denom;

      if (k >= 2) {
        densitySum[k] += mag;
        if (mag > bestMag) {
          bestMag = mag;
          bestK = k;
        }
      }
    }

    if (avg < 0.05 || avg > 0.95) continue;

    sidesVec[rIdx] = bestK;
    if (bestK > 0) {
      angleVec[rIdx] = polarAngle[rIdx * numFreqBins + bestK];
    }
  }

  if (
    state.lastPolarAngle &&
    state.lastPolarAngle.length === polarAngle.length
  ) {
    for (let rIdx = 0; rIdx < numRadii; rIdx++) {
      const rowBase = rIdx * numFreqBins;
      for (let k = 0; k < numFreqBins; k++) {
        const idx = rowBase + k;
        const denom = k === 0 ? 1 : k;
        const maxAngle = Math.PI / denom;
        let d = polarAngle[idx] - state.lastPolarAngle[idx];
        d = ((d + 3 * maxAngle) % (2 * maxAngle)) - maxAngle;
        polarRotate[idx] = d;
      }
    }
  }
  if (
    !state.lastPolarAngle ||
    state.lastPolarAngle.length !== polarAngle.length
  ) {
    state.lastPolarAngle = new Float32Array(polarAngle.length);
  }
  state.lastPolarAngle.set(polarAngle);

  const alpha = state.densityEmaAlpha;
  if (state.densityEma && state.densityEma.length === maxHarmonicSearch) {
    for (let k = 2; k < maxHarmonicSearch; k++) {
      state.densityEma[k] += alpha * (densitySum[k] - state.densityEma[k]);
    }
  } else {
    state.densityEma = new Float32Array(maxHarmonicSearch);
    state.densityEma.set(densitySum);
  }

  let maxDensity = 0;
  let maxIndex = 0;
  for (let k = 2; k < maxHarmonicSearch; k++) {
    if (state.densityEma[k] > maxDensity) {
      maxDensity = state.densityEma[k];
      maxIndex = k;
    }
  }

  for (let rIdx = 0; rIdx < numRadii; rIdx++) {
    const kk = sidesVec[rIdx];
    if (kk > 1) {
      const idx = rIdx * numFreqBins + kk;
      angleVec[rIdx] = polarAngle[idx];
      rotateVec[rIdx] = polarRotate[idx];
    }
  }

  state.lastSidesVec = sidesVec;
  if (
    !state.lastAngleVecCopy ||
    state.lastAngleVecCopy.length !== angleVec.length
  ) {
    state.lastAngleVecCopy = new Float32Array(angleVec.length);
  }
  state.lastAngleVecCopy.set(angleVec);
  state.lastAngleVec = state.lastAngleVecCopy;

  stats.sidesVec = sidesVec;
  stats.angleVec = angleVec;
  stats.rotateVec = rotateVec;
  stats.radiusVec = radiusVec;
  stats.symmMaxRadius = numRadii;
  stats.rotateWAvg = null;
  stats.polarArray = prAngles;

  const polarTH = _symmScratch.polarTH;
  const polarR = _symmScratch.polarR;
  polarTH.fill(0);
  polarR.fill(0);
  for (let t = 0; t < angularBins; t++) {
    let sum = 0;
    for (let rIdx = 0; rIdx < numRadii; rIdx++) {
      sum += prAngles[rIdx * angularBins + t];
    }
    polarTH[t] = numRadii > 0 ? sum / numRadii : 0;
  }
  for (let rIdx = 0; rIdx < numRadii; rIdx++) {
    let sum = 0;
    const base = rIdx * angularBins;
    for (let t = 0; t < angularBins; t++) {
      sum += prAngles[base + t];
    }
    polarR[rIdx] = angularBins > 0 ? sum / angularBins : 0;
  }

  const rotateWSum = _symmScratch.rotateWSum;
  for (let i = 0; i < polarRotate.length; i++) {
    rotateWSum[i] = polarRotate[i] * polarDensity[i];
  }

  stats.polarTH = polarTH;
  stats.polarR = polarR;
  stats.polarDensity = polarDensity;
  stats.rotateWSum = rotateWSum;
  stats.densitySum = densitySum;

  let maxEma = 0;
  for (let k = 2; k < maxHarmonicSearch; k++) {
    if (state.densityEma[k] > maxEma) maxEma = state.densityEma[k];
  }

  stats.symmSides = maxIndex > 0 ? maxIndex : 0;
  stats.symmStrength =
    maxEma > state.epsilon && maxIndex >= 2
      ? state.densityEma[maxIndex] / maxEma
      : 0;

  stats.symmAngle = 0;
  stats.symmRotate = 0;
  if (maxIndex > 1) {
    for (let rIdx = 0; rIdx < numRadii; rIdx++) {
      if (sidesVec[rIdx] === maxIndex) {
        stats.symmAngle = angleVec[rIdx];
        stats.symmRotate = rotateVec[rIdx];
        break;
      }
    }
  }

  const T = Math.max(1e-6, Number(params?.T) || 1);
  stats.rotationSpeed = Number.isFinite(stats.symmRotate)
    ? stats.symmRotate * T
    : 0;
}

function detectPeriodicity(stats, params, state) {
  const currentMass = Number(stats.mass) || 0;
  const history = state.massHistory;
  const capacity = state.maxHistory;
  history[state.massHistoryHead] = currentMass;
  state.massHistoryHead = (state.massHistoryHead + 1) % capacity;
  if (state.massHistoryCount < capacity) {
    state.massHistoryCount++;
  }

  const len = state.massHistoryCount;
  if (len < 64) {
    stats.period = 0;
    stats.periodConfidence = 0;
    return;
  }

  let start = state.massHistoryHead - len;
  if (start < 0) start += capacity;

  let mean = 0;
  for (let i = 0; i < len; i++) {
    mean += history[(start + i) % capacity];
  }
  mean /= len;

  const centreed = state.periodicityCentreed;
  for (let i = 0; i < len; i++) {
    centreed[i] = history[(start + i) % capacity] - mean;
  }

  let bestLag = 0;
  let bestCorr = 0;
  const maxLag = Math.min(180, Math.floor(len / 2));
  for (let lag = 2; lag <= maxLag; lag++) {
    let num = 0;
    let denA = 0;
    let denB = 0;
    for (let i = lag; i < len; i++) {
      const a = centreed[i];
      const b = centreed[i - lag];
      num += a * b;
      denA += a * a;
      denB += b * b;
    }

    const denom = Math.sqrt(denA * denB);
    if (denom <= state.epsilon) continue;

    const corr = num / denom;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const T = Number(params?.T) || 1;
  stats.period = bestLag > 0 ? bestLag / T : 0;
  stats.periodConfidence = Math.max(0, bestCorr);
}

function computeQuickStats(cells, field, size, params, state) {
  let mass = 0,
    growth = 0,
    maxValue = 0;
  let cosX = 0,
    sinX = 0,
    cosY = 0,
    sinY = 0;
  let gCosX = 0,
    gSinX = 0,
    gCosY = 0,
    gSinY = 0;
  let gMass = 0;

  const hasCachedCentre = _stepCentreCache.valid;
  if (hasCachedCentre) {
    cosX = _stepCentreCache.cosX;
    sinX = _stepCentreCache.sinX;
    cosY = _stepCentreCache.cosY;
    sinY = _stepCentreCache.sinY;
    mass = _stepCentreCache.mass;
  }

  const trig = getTrigTables(size);
  const cosT = trig.cos;
  const sinT = trig.sin;

  for (let y = 0; y < size; y++) {
    const row = y * size;
    const cy = cosT[y],
      sy = sinT[y];
    for (let x = 0; x < size; x++) {
      const i = row + x;
      const val = cells[i];
      if (!hasCachedCentre) {
        mass += val;
        cosX += val * cosT[x];
        sinX += val * sinT[x];
        cosY += val * cy;
        sinY += val * sy;
      }
      if (val > maxValue) maxValue = val;
      const gv = field[i];
      if (gv > 0) {
        growth += gv;
        gMass += gv;
        gCosX += gv * cosT[x];
        gSinX += gv * sinT[x];
        gCosY += gv * cy;
        gSinY += gv * sy;
      }
    }
  }

  let centreX = 0,
    centreY = 0;
  if (mass > state.epsilon) {
    centreX = ((Math.atan2(sinX, cosX) / (2 * Math.PI)) * size + size) % size;
    centreY = ((Math.atan2(sinY, cosY) / (2 * Math.PI)) * size + size) % size;
  }

  let growthCentreX = 0,
    growthCentreY = 0,
    massGrowthDist = 0;
  if (gMass > state.epsilon) {
    growthCentreX =
      ((Math.atan2(gSinX, gCosX) / (2 * Math.PI)) * size + size) % size;
    growthCentreY =
      ((Math.atan2(gSinY, gCosY) / (2 * Math.PI)) * size + size) % size;
    const mgDx = torusDelta(centreX, growthCentreX, size);
    const mgDy = torusDelta(centreY, growthCentreY, size);
    massGrowthDist = Math.sqrt(mgDx * mgDx + mgDy * mgDy);
  }

  const safeR = Math.max(state.epsilon, Number(params?.R) || 1);
  const safeT = Math.max(1e-6, Number(params?.T) || 1);
  const dt = 1 / safeT;

  let speed = 0,
    angle = 0,
    centroidSpeed = 0,
    centroidRotateSpeed = 0;
  if (state.lastCentreX !== null) {
    const dx = torusDelta(centreX, state.lastCentreX, size);
    const dy = torusDelta(centreY, state.lastCentreY, size);
    const displacement = Math.sqrt(dx * dx + dy * dy);
    speed = displacement;
    centroidSpeed = displacement / safeR / dt;
    const motionAngle = Math.atan2(dy, dx);
    angle = motionAngle;
    centroidRotateSpeed = motionAngle / dt;
  }

  state.lastCentreX = centreX;
  state.lastCentreY = centreY;

  return {
    mass,
    growth,
    maxValue,
    centreX,
    centreY,
    growthCentreX,
    growthCentreY,
    massGrowthDist,
    speed,
    angle,
    centroidSpeed,
    centroidRotateSpeed,
  };
}

function analyseStep(cells, potential, field, change, params, state) {
  const stats = {
    mass: 0,
    growth: 0,
    massLog: 0,
    growthLog: 0,
    massVolumeLog: 0,
    growthVolumeLog: 0,
    massDensity: 0,
    growthDensity: 0,
    maxValue: 0,
    gyradius: 0,
    centreX: 0,
    centreY: 0,
    growthCentreX: 0,
    growthCentreY: 0,
    massGrowthDist: 0,
    massAsym: 0,
    speed: 0,
    centroidSpeed: 0,
    angle: 0,
    centroidRotateSpeed: 0,
    growthRotateSpeed: 0,
    majorAxisRotateSpeed: 0,
    symmSides: 0,
    symmStrength: 0,
    symmAngle: 0,
    symmRotate: 0,
    rotationSpeed: 0,
    lyapunov: 0,
    hu1Log: 0,
    hu4Log: 0,
    hu5Log: 0,
    hu6Log: 0,
    hu7Log: 0,
    flusser7: 0,
    flusser8Log: 0,
    flusser9Log: 0,
    flusser10Log: 0,
    period: 0,
    periodConfidence: 0,
  };

  const size = params.size;
  const count = size * size;
  let gMass = 0;
  let cosX = 0;
  let sinX = 0;
  let cosY = 0;
  let sinY = 0;
  let gCosX = 0;
  let gSinX = 0;
  let gCosY = 0;
  let gSinY = 0;
  let massSupport = 0;
  let growthSupport = 0;
  const trig = getTrigTables(size);
  const cosT = trig.cos;
  const sinT = trig.sin;

  for (let y = 0; y < size; y++) {
    const row = y * size;
    const cy = cosT[y];
    const sy = sinT[y];

    for (let x = 0; x < size; x++) {
      const i = row + x;
      const val = cells[i];
      stats.mass += val;

      const growthVal = Math.max(0, field[i]);
      const cx = cosT[x];
      const sx = sinT[x];

      if (growthVal > 0) {
        stats.growth += growthVal;
        gMass += growthVal;
        growthSupport += 1;
      }

      if (val > state.epsilon) {
        massSupport += 1;
      }

      if (val > stats.maxValue) stats.maxValue = val;

      if (growthVal > 0) {
        gCosX += growthVal * cx;
        gSinX += growthVal * sx;
        gCosY += growthVal * cy;
        gSinY += growthVal * sy;
      }

      cosX += val * cx;
      sinX += val * sx;
      cosY += val * cy;
      sinY += val * sy;
    }
  }

  if (stats.mass > state.epsilon) {
    const thetaX = Math.atan2(sinX, cosX);
    const thetaY = Math.atan2(sinY, cosY);
    stats.centreX = ((thetaX / (2 * Math.PI)) * size + size) % size;
    stats.centreY = ((thetaY / (2 * Math.PI)) * size + size) % size;
  }

  if (gMass > state.epsilon) {
    const gThetaX = Math.atan2(gSinX, gCosX);
    const gThetaY = Math.atan2(gSinY, gCosY);
    stats.growthCentreX = ((gThetaX / (2 * Math.PI)) * size + size) % size;
    stats.growthCentreY = ((gThetaY / (2 * Math.PI)) * size + size) % size;
    const mgDx = torusDelta(stats.centreX, stats.growthCentreX, size);
    const mgDy = torusDelta(stats.centreY, stats.growthCentreY, size);
    stats.massGrowthDist = Math.sqrt(mgDx * mgDx + mgDy * mgDy);
  }

  const safeR = Math.max(state.epsilon, Number(params?.R) || 1);
  const dim = Math.max(2, Math.floor(Number(params?.dimension) || 2));
  const rPow = Math.pow(safeR, dim);
  const safeT = Math.max(1e-6, Number(params?.T) || 1);
  const dt = 1 / safeT;
  const massNorm = stats.mass / rPow;
  const growthNorm = stats.growth / rPow;
  const massVolume = massSupport / rPow;
  const growthVolume = growthSupport / rPow;

  stats.massLog = positiveLog10(massNorm, state.epsilon);
  stats.growthLog = positiveLog10(growthNorm, state.epsilon);
  stats.massVolumeLog = positiveLog10(massVolume, state.epsilon);
  stats.growthVolumeLog = positiveLog10(growthVolume, state.epsilon);
  stats.massDensity = massNorm / Math.max(state.epsilon, massVolume);
  stats.growthDensity = growthNorm / Math.max(state.epsilon, growthVolume);

  let asymNX = 0;
  let asymNY = 0;
  if (state.lastCentreX !== null && stats.mass > state.epsilon) {
    const adx = torusDelta(stats.centreX, state.lastCentreX, size);
    const ady = torusDelta(stats.centreY, state.lastCentreY, size);
    const aNorm = Math.sqrt(adx * adx + ady * ady);
    if (aNorm > state.epsilon) {
      asymNX = adx / aNorm;
      asymNY = ady / aNorm;
    }
  }

  const invariants = calcMomentInvariants(
    cells,
    size,
    stats.centreX,
    stats.centreY,
    stats.mass,
    state.epsilon,
    asymNX,
    asymNY,
  );
  stats.hu1Log = invariants.hu1Log;
  stats.hu4Log = invariants.hu4Log;
  stats.hu5Log = invariants.hu5Log;
  stats.hu6Log = invariants.hu6Log;
  stats.hu7Log = invariants.hu7Log;
  stats.flusser7 = invariants.flusser7;
  stats.flusser8Log = invariants.flusser8Log;
  stats.flusser9Log = invariants.flusser9Log;
  stats.flusser10Log = invariants.flusser10Log;

  stats.gyradius =
    stats.mass > state.epsilon ? Math.sqrt(invariants.inertia / stats.mass) : 0;

  if (asymNX !== 0 || asymNY !== 0) {
    stats.massAsym = invariants.massRight - invariants.massLeft;
  }

  const majorAxisAngle =
    0.5 * Math.atan2(2 * invariants.mu11, invariants.mu20 - invariants.mu02);
  if (state.lastMajorAxisAngle !== null) {
    stats.majorAxisRotateSpeed =
      unwrapAngleDelta(majorAxisAngle, state.lastMajorAxisAngle) / dt;
  }
  state.lastMajorAxisAngle = majorAxisAngle;

  if (change && stats.maxValue > state.epsilon) {
    let sum = 0;
    for (let i = 0; i < change.length; i++) sum += Math.abs(change[i]);
    if (sum > state.epsilon) {
      const frameIndex = Math.max(1, state.frames || 1);
      const l = Math.log(sum) - state.lyapunov;
      state.lyapunov += l / frameIndex;
    }
  }

  const renderMode = params.renderMode || "world";
  let polarSource;
  if (renderMode === "potential" && potential) polarSource = potential;
  else if (renderMode === "growth" && field) polarSource = field;
  else polarSource = cells;
  detectSymmetry(polarSource, size, stats, state, params);
  detectPeriodicity(stats, params, state);

  if (state.lastCentreX !== null) {
    const dx = torusDelta(stats.centreX, state.lastCentreX, size);
    const dy = torusDelta(stats.centreY, state.lastCentreY, size);
    const displacement = Math.sqrt(dx * dx + dy * dy);
    stats.speed = displacement;
    stats.centroidSpeed = displacement / safeR / dt;
    const motionAngle = Math.atan2(dy, dx);
    stats.angle = motionAngle;
    stats.centroidRotateSpeed = motionAngle / dt;
  }

  if (stats.massGrowthDist > state.epsilon) {
    const mgDx = torusDelta(stats.growthCentreX, stats.centreX, size);
    const mgDy = torusDelta(stats.growthCentreY, stats.centreY, size);
    const mgAngle = Math.atan2(mgDy, mgDx);

    if (state.lastMassGrowthAngle !== null) {
      stats.growthRotateSpeed =
        unwrapAngleDelta(mgAngle, state.lastMassGrowthAngle) / dt;
    }

    state.lastMassGrowthAngle = mgAngle;
  } else {
    state.lastMassGrowthAngle = null;
  }

  state.lastCentreX = stats.centreX;
  state.lastCentreY = stats.centreY;
  stats.lyapunov = state.lyapunov;

  return stats;
}

let _N = 0;
let _kernelFFT = null;
let _ndKernelFFT = null;
let _ndKernelDim = 0;
let _ndKernelSize = 0;
const _analysisState = createAnalysisState();
let _lastAnalysisResult = null;
const _analysisInterval = 6;
const _analysisIntervalND = 12;
let _ndConfig = {
  dimension: 2,
  viewMode: "slice",
};
let _ndState = null;
