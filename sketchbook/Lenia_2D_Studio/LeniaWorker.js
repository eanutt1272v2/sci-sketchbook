"use strict";

function _fftRadix2(buf, inverse) {
  const N = buf.length >>> 1;
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >>> 1;
    while (j & bit) {
      j ^= bit;
      bit >>>= 1;
    }
    j ^= bit;
    if (i < j) {
      let ti = i * 2,
        tj = j * 2;
      let t = buf[ti];
      buf[ti] = buf[tj];
      buf[tj] = t;
      t = buf[ti + 1];
      buf[ti + 1] = buf[tj + 1];
      buf[tj + 1] = t;
    }
  }

  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >>> 1;
    const ang = (sign * 2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let uRe = 1,
        uIm = 0;
      for (let k = 0; k < half; k++) {
        const a = (i + k) * 2;
        const b = (i + k + half) * 2;
        const tRe = uRe * buf[b] - uIm * buf[b + 1];
        const tIm = uRe * buf[b + 1] + uIm * buf[b];
        buf[b] = buf[a] - tRe;
        buf[b + 1] = buf[a + 1] - tIm;
        buf[a] += tRe;
        buf[a + 1] += tIm;
        const nuRe = uRe * wRe - uIm * wIm;
        uIm = uRe * wIm + uIm * wRe;
        uRe = nuRe;
      }
    }
  }
  if (inverse) {
    const inv = 1 / N;
    for (let i = 0; i < buf.length; i++) buf[i] *= inv;
  }
}

function _fft2D(buf, N, inverse) {
  const row = new Float64Array(N * 2);
  for (let r = 0; r < N; r++) {
    const off = r * N * 2;
    for (let i = 0; i < N * 2; i++) row[i] = buf[off + i];
    _fftRadix2(row, inverse);
    for (let i = 0; i < N * 2; i++) buf[off + i] = row[i];
  }
  const col = new Float64Array(N * 2);
  for (let c = 0; c < N; c++) {
    for (let r = 0; r < N; r++) {
      col[r * 2] = buf[(r * N + c) * 2];
      col[r * 2 + 1] = buf[(r * N + c) * 2 + 1];
    }
    _fftRadix2(col, inverse);
    for (let r = 0; r < N; r++) {
      buf[(r * N + c) * 2] = col[r * 2];
      buf[(r * N + c) * 2 + 1] = col[r * 2 + 1];
    }
  }
}

function _nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

const KERNEL_CORE = [
  (r) => Math.pow(4 * r * (1 - r), 4),
  (r) => (r > 0 && r < 1 ? Math.exp(4 - 1 / (r * (1 - r))) : 0),
  (r, q = 0.25) => (r >= q && r <= 1 - q ? 1 : 0),
  (r, q = 0.25) => {
    if (r >= q && r <= 1 - q) return 1;
    if (r < q) return 0.5;
    return 0;
  },
];

function _kernelCore(r, kn) {
  const fn = KERNEL_CORE[Math.max(0, Math.min(3, kn - 1))];
  return fn ? fn(r) : KERNEL_CORE[0](r);
}

function _kernelShell(r, b, kn) {
  if (r >= 1) return 0;
  const B = b.length;
  const Br = B * r;
  const idx = Math.min(Math.floor(Br), B - 1);
  const bVal = b[idx];
  const frac = Br % 1;
  return _kernelCore(frac, kn) * bVal;
}

function _buildKernel(params) {
  const R = params.R;
  const kn = params.kn || 1;
  const b = Array.isArray(params.b) ? params.b : [params.b || 1];

  const kernelRadius = Math.ceil(R);
  const kernelSize = kernelRadius * 2 + 1;
  const kernel = new Float32Array(kernelSize * kernelSize);
  const cx = kernelRadius;
  const cy = kernelRadius;

  for (let y = 0; y < kernelSize; y++) {
    for (let x = 0; x < kernelSize; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) / R;
      kernel[y * kernelSize + x] = _kernelShell(d, b, kn);
    }
  }

  let sum = 0;
  let maxVal = 0;
  for (let i = 0; i < kernel.length; i++) {
    sum += kernel[i];
    if (kernel[i] > maxVal) maxVal = kernel[i];
  }
  if (sum > 0) {
    for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
    maxVal /= sum;
  }

  const dxArr = [],
    dyArr = [],
    kvArr = [];
  for (let y = 0; y < kernelSize; y++) {
    for (let x = 0; x < kernelSize; x++) {
      const val = kernel[y * kernelSize + x];
      if (val > 0) {
        dxArr.push(x - kernelRadius);
        dyArr.push(y - kernelRadius);
        kvArr.push(val);
      }
    }
  }

  return {
    kernel,
    kernelSize,
    kernelRadius,
    kernelMax: maxVal,
    kernelDX: Int16Array.from(dxArr),
    kernelDY: Int16Array.from(dyArr),
    kernelValues: Float32Array.from(kvArr),
  };
}

function _buildKernelFFT(kernel, kernelSize, N) {
  const buf = new Float64Array(N * N * 2);
  const kr = Math.floor(kernelSize / 2);

  for (let ky = 0; ky < kernelSize; ky++) {
    for (let kx = 0; kx < kernelSize; kx++) {
      const val = kernel[ky * kernelSize + kx];
      if (val === 0) continue;
      const destY = (ky - kr + N) % N;
      const destX = (kx - kr + N) % N;
      buf[(destY * N + destX) * 2] = val;
    }
  }
  _fft2D(buf, N, false);
  return buf;
}

let _N = 0;
let _kernelFFT = null;
let _kernelInfo = null;

const _analysisState = {
  epsilon: 1e-10,
  lastCentreX: null,
  lastCentreY: null,
  lastSymmPhase: null,
  lastSymmOrder: 0,
  lyapunov: 0,
  massHistory: [],
  maxHistory: 512,
  frames: 0,
};

function _torusDelta(a, b, size) {
  let d = a - b;
  const half = size * 0.5;
  if (d > half) d -= size;
  if (d < -half) d += size;
  return d;
}

function _detectSymmetry(cells, size, stats, state, params) {
  const center = size / 2;
  const radius = Math.min(center * 0.8, 64);
  const angularBins = 64;
  const angles = new Float32Array(angularBins);

  for (let theta = 0; theta < angularBins; theta++) {
    const angle = (theta / angularBins) * 2 * Math.PI;
    let sum = 0;
    let count = 0;

    for (let r = 1; r < radius; r += 1) {
      const x = Math.round(center + r * Math.cos(angle));
      const y = Math.round(center + r * Math.sin(angle));
      if (x >= 0 && x < size && y >= 0 && y < size) {
        sum += cells[y * size + x];
        count++;
      }
    }

    angles[theta] = count > 0 ? sum / count : 0;
  }

  const harmonics = new Float32Array(angularBins / 2);
  for (let k = 0; k < angularBins / 2; k++) {
    let cosSum = 0;
    let sinSum = 0;
    for (let n = 0; n < angularBins; n++) {
      const phase = (2 * Math.PI * k * n) / angularBins;
      cosSum += angles[n] * Math.cos(phase);
      sinSum += angles[n] * Math.sin(phase);
    }
    harmonics[k] = Math.sqrt(cosSum * cosSum + sinSum * sinSum) / angularBins;
  }

  let maxHarmonic = 0;
  let maxIndex = 0;
  for (let k = 2; k < Math.min(16, angularBins / 2); k++) {
    if (harmonics[k] > maxHarmonic) {
      maxHarmonic = harmonics[k];
      maxIndex = k;
    }
  }

  let maxAll = 0;
  for (let i = 0; i < harmonics.length; i++) {
    if (harmonics[i] > maxAll) maxAll = harmonics[i];
  }

  const symmStrength = maxAll > state.epsilon ? maxHarmonic / maxAll : 0;
  let rotSpeed = 0;

  if (maxIndex > 0) {
    let domCos = 0;
    let domSin = 0;
    for (let n = 0; n < angularBins; n++) {
      const phase = (2 * Math.PI * maxIndex * n) / angularBins;
      domCos += angles[n] * Math.cos(phase);
      domSin += angles[n] * Math.sin(phase);
    }

    const symmPhase = Math.atan2(domSin, domCos);
    const T = Math.max(1e-6, Number(params?.T) || 1);
    const dt = 1 / T;

    if (state.lastSymmPhase !== null && state.lastSymmOrder === maxIndex) {
      let dPhase = symmPhase - state.lastSymmPhase;
      if (dPhase > Math.PI) dPhase -= 2 * Math.PI;
      if (dPhase < -Math.PI) dPhase += 2 * Math.PI;

      const dTheta = dPhase / maxIndex;
      rotSpeed = ((dTheta * 180) / Math.PI) / dt;
    }

    state.lastSymmPhase = symmPhase;
    state.lastSymmOrder = maxIndex;
  } else {
    state.lastSymmPhase = null;
    state.lastSymmOrder = 0;
  }

  stats.symmSides = maxIndex > 0 ? maxIndex : 0;
  stats.symmStrength = symmStrength;
  stats.rotationSpeed = Number.isFinite(rotSpeed) ? rotSpeed : 0;
}

function _detectPeriodicity(stats, params, state) {
  const currentMass = Number(stats.mass) || 0;
  state.massHistory.push(currentMass);
  if (state.massHistory.length > state.maxHistory) {
    state.massHistory.splice(0, state.massHistory.length - state.maxHistory);
  }

  const values = state.massHistory;
  if (values.length < 64) {
    stats.period = 0;
    stats.periodConfidence = 0;
    return;
  }

  let mean = 0;
  for (let i = 0; i < values.length; i++) mean += values[i];
  mean /= values.length;

  const centered = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) centered[i] = values[i] - mean;

  let bestLag = 0;
  let bestCorr = 0;
  const maxLag = Math.min(180, Math.floor(values.length / 2));
  for (let lag = 2; lag <= maxLag; lag++) {
    let num = 0;
    let denA = 0;
    let denB = 0;
    for (let i = lag; i < centered.length; i++) {
      const a = centered[i];
      const b = centered[i - lag];
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

function _analyseStep(cells, field, change, params, state) {
  const stats = {
    mass: 0,
    growth: 0,
    maxValue: 0,
    gyradius: 0,
    centerX: 0,
    centerY: 0,
    growthCenterX: 0,
    growthCenterY: 0,
    massGrowthDist: 0,
    massAsym: 0,
    speed: 0,
    angle: 0,
    symmSides: 0,
    symmStrength: 0,
    rotationSpeed: 0,
    lyapunov: 0,
    period: 0,
    periodConfidence: 0,
  };

  const size = params.size;
  const count = size * size;
  let mx = 0;
  let my = 0;
  let gx = 0;
  let gy = 0;
  let gMass = 0;
  let cosX = 0;
  let sinX = 0;
  let cosY = 0;
  let sinY = 0;
  let gCosX = 0;
  let gSinX = 0;
  let gCosY = 0;
  let gSinY = 0;

  for (let i = 0; i < count; i++) {
    const val = cells[i];
    stats.mass += val;

    const growthVal = Math.max(0, field[i]);
    const x = i % size;
    const y = Math.floor(i / size);
    const ax = (2 * Math.PI * x) / size;
    const ay = (2 * Math.PI * y) / size;

    if (growthVal > 0) {
      stats.growth += growthVal;
      gMass += growthVal;
    }

    if (val > stats.maxValue) stats.maxValue = val;

    mx += val * x;
    my += val * y;
    if (growthVal > 0) {
      gx += growthVal * x;
      gy += growthVal * y;
      gCosX += growthVal * Math.cos(ax);
      gSinX += growthVal * Math.sin(ax);
      gCosY += growthVal * Math.cos(ay);
      gSinY += growthVal * Math.sin(ay);
    }

    cosX += val * Math.cos(ax);
    sinX += val * Math.sin(ax);
    cosY += val * Math.cos(ay);
    sinY += val * Math.sin(ay);
  }
  if (stats.mass > state.epsilon) {
    const thetaX = Math.atan2(sinX, cosX);
    const thetaY = Math.atan2(sinY, cosY);
    stats.centerX = ((thetaX / (2 * Math.PI)) * size + size) % size;
    stats.centerY = ((thetaY / (2 * Math.PI)) * size + size) % size;
  }

  if (gMass > state.epsilon) {
    const gThetaX = Math.atan2(gSinX, gCosX);
    const gThetaY = Math.atan2(gSinY, gCosY);
    stats.growthCenterX = ((gThetaX / (2 * Math.PI)) * size + size) % size;
    stats.growthCenterY = ((gThetaY / (2 * Math.PI)) * size + size) % size;
    const mgDx = _torusDelta(stats.centerX, stats.growthCenterX, size);
    const mgDy = _torusDelta(stats.centerY, stats.growthCenterY, size);
    stats.massGrowthDist = Math.sqrt(mgDx * mgDx + mgDy * mgDy);
  }

  let inertia = 0;
  if (stats.mass > state.epsilon) {
    for (let i = 0; i < count; i++) {
      const val = cells[i];
      if (val <= state.epsilon) continue;
      const x = i % size;
      const y = Math.floor(i / size);
      const dx = _torusDelta(x, stats.centerX, size);
      const dy = _torusDelta(y, stats.centerY, size);
      inertia += val * (dx * dx + dy * dy);
    }
  }
  stats.gyradius = stats.mass > state.epsilon ? Math.sqrt(inertia / stats.mass) : 0;

  if (state.lastCentreX !== null && stats.mass > state.epsilon) {
    const dx = _torusDelta(stats.centerX, state.lastCentreX, size);
    const dy = _torusDelta(stats.centerY, state.lastCentreY, size);
    const norm = Math.sqrt(dx * dx + dy * dy);
    if (norm > state.epsilon) {
      const nx = dx / norm;
      const ny = dy / norm;
      let massLeft = 0;
      let massRight = 0;

      for (let i = 0; i < count; i++) {
        const val = cells[i];
        if (val <= state.epsilon) continue;
        const x = i % size;
        const y = Math.floor(i / size);
        const px = _torusDelta(x, stats.centerX, size);
        const py = _torusDelta(y, stats.centerY, size);
        const side = px * ny - py * nx;
        if (side > 0) massRight += val;
        else massLeft += val;
      }

      stats.massAsym = massRight - massLeft;
    }
  }

  if (change && stats.maxValue > state.epsilon) {
    let sum = 0;
    for (let i = 0; i < change.length; i++) {
      sum += Math.abs(change[i]);
    }
    if (sum > state.epsilon) {
      const frameIndex = Math.max(1, state.frames);
      const l = Math.log(sum) - state.lyapunov;
      state.lyapunov += l / frameIndex;
    }
  }

  _detectSymmetry(cells, size, stats, state, params);
  _detectPeriodicity(stats, params, state);

  if (state.lastCentreX !== null) {
    const dx = _torusDelta(stats.centerX, state.lastCentreX, size);
    const dy = _torusDelta(stats.centerY, state.lastCentreY, size);
    stats.speed = Math.sqrt(dx * dx + dy * dy);
    stats.angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  state.lastCentreX = stats.centerX;
  state.lastCentreY = stats.centerY;
  stats.lyapunov = state.lyapunov;

  return stats;
}

function _growthFunc(n, m, s, gn) {
  if (gn === 2) return Math.exp(-((n - m) ** 2) / (2 * s ** 2)) * 2 - 1;
  if (gn === 3) return Math.abs(n - m) <= s ? 1 : -1;
  const val = Math.max(0, 1 - (n - m) ** 2 / (9 * s ** 2));
  return Math.pow(val, 4) * 2 - 1;
}

function _stepFFT(cells, potential, field, fieldOld, params, N) {
  const size = params.size;

  const cellBuf = new Float64Array(N * N * 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cellBuf[(y * N + x) * 2] = cells[y * size + x];
    }
  }
  _fft2D(cellBuf, N, false);

  const result = new Float64Array(N * N * 2);
  for (let i = 0; i < N * N; i++) {
    const ar = cellBuf[i * 2],
      ai = cellBuf[i * 2 + 1];
    const br = _kernelFFT[i * 2],
      bi = _kernelFFT[i * 2 + 1];
    result[i * 2] = ar * br - ai * bi;
    result[i * 2 + 1] = ar * bi + ai * br;
  }
  _fft2D(result, N, true);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      potential[y * size + x] = Math.max(0, result[(y * N + x) * 2]);
    }
  }

  const { T, m, s, gn, softClip, multiStep, addNoise, maskRate, paramP } =
    params;
  const dt = 1 / T;
  const count = size * size;
  const noiseAmp = addNoise / 10;
  const hasNoise = noiseAmp > 0;
  const mr = maskRate / 10;
  const hasMask = mr > 0;
  const hasOld = multiStep && fieldOld;

  const change = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const growth = _growthFunc(potential[i], m, s, gn);
    field[i] = growth;

    let D = growth;
    if (hasOld) D = 0.5 * (3 * field[i] - fieldOld[i]);

    const deltaTerm = dt * D;
    let newVal = cells[i] + deltaTerm;
    change[i] = deltaTerm;

    if (hasNoise) newVal *= 1 + (Math.random() - 0.5) * noiseAmp;

    if (softClip) {
      const k = 1 / dt;
      const a = Math.exp(k * newVal);
      const b2 = Math.exp(0);
      const c2 = Math.exp(-k);
      newVal = Math.log(1 / (a + b2) + c2) / -k;
    } else {
      newVal = Math.max(0, Math.min(1, newVal));
    }

    if (paramP > 0) newVal = Math.round(newVal * paramP) / paramP;
    if (!hasMask || Math.random() > mr) cells[i] = newVal;
  }

  return change;
}

self.onmessage = function (e) {
  const msg = e.data;

  if (msg.type === "kernel") {
    _analysisState.lastCentreX = null;
    _analysisState.lastCentreY = null;
    _analysisState.lastSymmPhase = null;
    _analysisState.lastSymmOrder = 0;
    _analysisState.lyapunov = 0;
    _analysisState.massHistory = [];
    _analysisState.frames = 0;

    const info = _buildKernel(msg.params);
    _kernelInfo = info;

    const size = msg.params.size || 128;
    _N = _nextPow2(size);

    _kernelFFT = _buildKernelFFT(info.kernel, info.kernelSize, _N);

    self.postMessage(
      {
        type: "kernelReady",
        kernelSize: info.kernelSize,
        kernelMax: info.kernelMax,
        kernel: info.kernel,
        kernelDX: info.kernelDX,
        kernelDY: info.kernelDY,
        kernelValues: info.kernelValues,
      },
      [
        info.kernel.buffer,
        info.kernelDX.buffer,
        info.kernelDY.buffer,
        info.kernelValues.buffer,
      ],
    );
    return;
  }

  if (msg.type === "step") {
    const world = new Float32Array(msg.world);
    const potential = new Float32Array(msg.potential);
    const growth = new Float32Array(msg.growth);
    const growthOld = msg.growthOld
      ? new Float32Array(msg.growthOld)
      : null;
    const params = msg.params;

    if (!_kernelFFT || _N < _nextPow2(params.size)) {
      const info = _buildKernel(params);
      _kernelInfo = info;
      _N = _nextPow2(params.size);
      _kernelFFT = _buildKernelFFT(info.kernel, info.kernelSize, _N);
    }

    const change = _stepFFT(world, potential, growth, growthOld, params, _N);
    _analysisState.frames += 1;
    const analysis = _analyseStep(world, growth, change, params, _analysisState);

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
      },
      transfers,
    );
    return;
  }
};
