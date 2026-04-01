"use strict";

const _twiddleCache = new Map();
const _symmetryCache = new Map();
let _trigCache = {
  size: 0,
  cos: null,
  sin: null,
};
const _fft2DScratch = {
  N: 0,
  row: null,
  col: null,
};
const _symmScratch = {
  size: 0,
  prAngles: null,
  radiusVec: null,
  densitySum: null,
  sidesVec: null,
  angleVec: null,
  rotateVec: null,
  avgPerRadius: null,
  polarDensity: null,
  polarAngle: null,
  polarRotate: null,
  polarTH: null,
  polarR: null,
  rotateWSum: null,
};

const _stepCenterCache = {
  valid: false,
  cosX: 0,
  sinX: 0,
  cosY: 0,
  sinY: 0,
  mass: 0,
};

let _autoCenterTmp = null;
let _autoCenterTmpLen = 0;
let _autoCenterTyLut = null;
let _autoCenterTyLutSize = 0;

let _mcAnalysisScratch = null;
let _mcAnalysisScratchLen = 0;

const _GROWTH_LUT_SIZE = 32768;
const _GROWTH_LUT_UMAX = 20;
const _growthLutExp = new Float32Array(_GROWTH_LUT_SIZE);
const _growthLutPoly = new Float32Array(_GROWTH_LUT_SIZE);
const _GROWTH_LUT_POLY_MAX = 1.5;
const _GLI_EXP = (_GROWTH_LUT_SIZE - 1) / _GROWTH_LUT_UMAX;
const _GLI_POLY = (_GROWTH_LUT_SIZE - 1) / _GROWTH_LUT_POLY_MAX;
(function _initGrowthLUTs() {
  for (let i = 0; i < _GROWTH_LUT_SIZE; i++) {
    const u = (i / (_GROWTH_LUT_SIZE - 1)) * _GROWTH_LUT_UMAX;
    _growthLutExp[i] = Math.exp(-u) * 2 - 1;
  }
  for (let i = 0; i < _GROWTH_LUT_SIZE; i++) {
    const v = (i / (_GROWTH_LUT_SIZE - 1)) * _GROWTH_LUT_POLY_MAX;
    if (v >= 1) {
      _growthLutPoly[i] = -1;
    } else {
      const b = 1 - v;
      const b2 = b * b;
      _growthLutPoly[i] = b2 * b2 * 2 - 1;
    }
  }
})();

const _ndStepCache = {
  valid: false,
  cosX: 0,
  sinX: 0,
  cosY: 0,
  sinY: 0,
  totalMass: 0,
  planeMass: null,
  planeCount: 0,
};

function _getFFT2DScratch(N) {
  if (_fft2DScratch.N !== N || !_fft2DScratch.row || !_fft2DScratch.col) {
    _fft2DScratch.N = N;
    _fft2DScratch.row = new Float64Array(N * 2);
    _fft2DScratch.col = new Float64Array(N * 2);
  }
  return _fft2DScratch;
}

function _getTwiddles(N) {
  let entry = _twiddleCache.get(N);
  if (entry) return entry;
  const fwd = [];
  const inv = [];
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >>> 1;
    const fwdRe = new Float64Array(half);
    const fwdIm = new Float64Array(half);
    const invRe = new Float64Array(half);
    const invIm = new Float64Array(half);
    for (let k = 0; k < half; k++) {
      const angF = (-2 * Math.PI * k) / len;
      const angI = (2 * Math.PI * k) / len;
      fwdRe[k] = Math.cos(angF);
      fwdIm[k] = Math.sin(angF);
      invRe[k] = Math.cos(angI);
      invIm[k] = Math.sin(angI);
    }
    fwd.push({ len, half, re: fwdRe, im: fwdIm });
    inv.push({ len, half, re: invRe, im: invIm });
  }
  entry = { fwd, inv };
  _twiddleCache.set(N, entry);
  return entry;
}

function fftRadix2(buf, inverse) {
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
      const ti = i * 2;
      const tj = j * 2;
      let t = buf[ti];
      buf[ti] = buf[tj];
      buf[tj] = t;
      t = buf[ti + 1];
      buf[ti + 1] = buf[tj + 1];
      buf[tj + 1] = t;
    }
  }

  const stages = _getTwiddles(N);
  const stageList = inverse ? stages.inv : stages.fwd;

  for (let si = 0; si < stageList.length; si++) {
    const { len, half, re: wRe, im: wIm } = stageList[si];
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < half; k++) {
        const a = (i + k) * 2;
        const b = (i + k + half) * 2;
        const tRe = wRe[k] * buf[b] - wIm[k] * buf[b + 1];
        const tIm = wRe[k] * buf[b + 1] + wIm[k] * buf[b];
        buf[b] = buf[a] - tRe;
        buf[b + 1] = buf[a + 1] - tIm;
        buf[a] += tRe;
        buf[a + 1] += tIm;
      }
    }
  }

  if (inverse) {
    const inv = 1 / N;
    for (let i = 0; i < buf.length; i++) buf[i] *= inv;
  }
}

function fft2D(buf, N, inverse) {
  const N2 = N * 2;
  for (let r = 0; r < N; r++) {
    fftRadix2(buf.subarray(r * N2, r * N2 + N2), inverse);
  }

  const col = _getFFT2DScratch(N).col;
  for (let c = 0; c < N; c++) {
    for (let r = 0; r < N; r++) {
      const idx = (r * N + c) * 2;
      col[r * 2] = buf[idx];
      col[r * 2 + 1] = buf[idx + 1];
    }
    fftRadix2(col, inverse);
    for (let r = 0; r < N; r++) {
      const idx = (r * N + c) * 2;
      buf[idx] = col[r * 2];
      buf[idx + 1] = col[r * 2 + 1];
    }
  }
}

let _ndPencilBuf = null;
let _ndPencilSize = 0;

function fftND(buf, N, ndim, inverse) {
  if (ndim <= 1) {
    fftRadix2(buf, inverse);
    return;
  }
  const total = Math.pow(N, ndim);
  const pencilCount = total / N;

  if (!_ndPencilBuf || _ndPencilSize !== N) {
    _ndPencilBuf = new Float64Array(N * 2);
    _ndPencilSize = N;
  }
  const row = _ndPencilBuf;

  _getTwiddles(N);

  const log2N = Math.log2(N) | 0;

  for (let axis = 0; axis < ndim; axis++) {
    if (axis === ndim - 1) {
      const N2 = N * 2;
      for (let p = 0; p < pencilCount; p++) {
        fftRadix2(buf.subarray(p * N2, p * N2 + N2), inverse);
      }
      continue;
    }

    const strideShift = log2N * (ndim - 1 - axis);
    const stride = 1 << strideShift;
    const strideMask = stride - 1;
    const outerStride = stride << log2N;

    for (let p = 0; p < pencilCount; p++) {
      const outer = p >>> strideShift;
      const inner = p & strideMask;
      const base = outer * outerStride + inner;

      for (let k = 0; k < N; k++) {
        const idx = (base + k * stride) * 2;
        row[k * 2] = buf[idx];
        row[k * 2 + 1] = buf[idx + 1];
      }

      fftRadix2(row, inverse);

      for (let k = 0; k < N; k++) {
        const idx = (base + k * stride) * 2;
        buf[idx] = row[k * 2];
        buf[idx + 1] = row[k * 2 + 1];
      }
    }
  }
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function getTrigTables(size) {
  if (_trigCache.size === size && _trigCache.cos && _trigCache.sin) {
    return _trigCache;
  }

  const cos = new Float64Array(size);
  const sin = new Float64Array(size);
  const scale = (2 * Math.PI) / size;
  for (let i = 0; i < size; i++) {
    const a = scale * i;
    cos[i] = Math.cos(a);
    sin[i] = Math.sin(a);
  }

  _trigCache = { size, cos, sin };
  return _trigCache;
}

function createAnalysisState(epsilon = 1e-10, maxHistory = 512) {
  return {
    epsilon,
    maxHistory,
    lastCentreX: null,
    lastCentreY: null,
    lastSymmPhase: null,
    lastSymmOrder: 0,
    lastMassGrowthAngle: null,
    lastMajorAxisAngle: null,
    lyapunov: 0,
    massHistory: new Float64Array(maxHistory),
    massHistoryCount: 0,
    massHistoryHead: 0,
    periodicityCentered: new Float64Array(maxHistory),
    densityEma: null,
    densityEmaAlpha: 0.05,
    lastPolarAngle: null,
    lastSidesVec: null,
    lastAngleVec: null,
    frames: 0,
    analysisStride: 1,
  };
}

function resetAnalysisState(state) {
  state.lastCentreX = null;
  state.lastCentreY = null;
  state.lastSymmPhase = null;
  state.lastSymmOrder = 0;
  state.lastMassGrowthAngle = null;
  state.lastMajorAxisAngle = null;
  state.lyapunov = 0;
  state.massHistoryCount = 0;
  state.massHistoryHead = 0;
  state.densityEma = null;
  state.lastPolarAngle = null;
  state.lastSidesVec = null;
  state.lastAngleVec = null;
  state.frames = 0;
}

function getSymmetryTables(angularBins) {
  let entry = _symmetryCache.get(angularBins);
  if (entry) return entry;

  const halfBins = angularBins >> 1;
  const thetaCos = new Float64Array(angularBins);
  const thetaSin = new Float64Array(angularBins);
  const harmonicCos = new Float64Array(halfBins * angularBins);
  const harmonicSin = new Float64Array(halfBins * angularBins);

  for (let n = 0; n < angularBins; n++) {
    const a = Math.PI / 2 + (2 * Math.PI * n) / angularBins;
    thetaCos[n] = Math.cos(a);
    thetaSin[n] = Math.sin(a);
  }

  for (let k = 0; k < halfBins; k++) {
    const row = k * angularBins;
    for (let n = 0; n < angularBins; n++) {
      const phase = (2 * Math.PI * k * n) / angularBins;
      harmonicCos[row + n] = Math.cos(phase);
      harmonicSin[row + n] = Math.sin(phase);
    }
  }

  entry = { thetaCos, thetaSin, harmonicCos, harmonicSin, halfBins };
  _symmetryCache.set(angularBins, entry);
  return entry;
}

function _gaussianKernel1D(sigma) {
  const s = Math.max(1e-6, Number(sigma) || 1);
  const radius = Math.max(1, Math.ceil(s * 3));
  const size = radius * 2 + 1;
  const kernel = new Float64Array(size);
  const denom = 2 * s * s;
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / denom);
    kernel[i + radius] = v;
    sum += v;
  }
  if (sum > 0) {
    for (let i = 0; i < size; i++) kernel[i] /= sum;
  }
  return { kernel, radius };
}

function _reflectIndex(i, n) {
  if (n <= 1) return 0;
  let x = i;
  const max = n - 1;
  while (x < 0 || x > max) {
    if (x < 0) x = -x;
    else x = max - (x - max);
  }
  return x;
}

let _blurTemp = null;
let _blurOut = null;
let _blurLen = 0;

function blurPolarArray(polar, numRadii, angularBins, sigmaR = 2, sigmaT = 1) {
  const { kernel: kr, radius: rr } = _gaussianKernel1D(sigmaR);
  const { kernel: kt, radius: rt } = _gaussianKernel1D(sigmaT);

  const len = numRadii * angularBins;
  if (_blurLen !== len) {
    _blurTemp = new Float32Array(len);
    _blurOut = new Float32Array(len);
    _blurLen = len;
  }
  const temp = _blurTemp;
  const out = _blurOut;

  for (let r = 0; r < numRadii; r++) {
    const rowBase = r * angularBins;
    for (let t = 0; t < angularBins; t++) {
      let acc = 0;
      for (let k = -rr; k <= rr; k++) {
        const ri = _reflectIndex(r + k, numRadii);
        acc += polar[ri * angularBins + t] * kr[k + rr];
      }
      temp[rowBase + t] = acc;
    }
  }

  for (let r = 0; r < numRadii; r++) {
    const rowBase = r * angularBins;
    for (let t = 0; t < angularBins; t++) {
      let acc = 0;
      for (let k = -rt; k <= rt; k++) {
        const ti = _reflectIndex(t + k, angularBins);
        acc += temp[rowBase + ti] * kt[k + rt];
      }
      out[rowBase + t] = acc;
    }
  }

  return out;
}

function unwrapAngleDelta(current, previous) {
  let d = current - previous;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function positiveLog10(value, epsilon) {
  return Math.log10(Math.max(epsilon, value));
}

function signedLog10(value) {
  const absValue = Math.abs(value);
  if (absValue <= 0) return 0;
  return Math.sign(value) * Math.log10(1 + absValue);
}

function calcMomentInvariants(
  cells,
  size,
  centerX,
  centerY,
  mass,
  epsilon,
  asymNX,
  asymNY,
) {
  const inv = {
    hu1Log: 0,
    hu4Log: 0,
    hu5Log: 0,
    hu6Log: 0,
    hu7Log: 0,
    flusser7: 0,
    flusser8Log: 0,
    flusser9Log: 0,
    flusser10Log: 0,
    mu20: 0,
    mu02: 0,
    mu11: 0,
    inertia: 0,
    massLeft: 0,
    massRight: 0,
  };

  if (mass <= epsilon) {
    return inv;
  }

  let c11Re = 0;
  let c20Re = 0;
  let c20Im = 0;
  let c21Re = 0;
  let c21Im = 0;
  let c12Re = 0;
  let c12Im = 0;
  let c30Re = 0;
  let c30Im = 0;
  let c22Re = 0;
  let c22Im = 0;
  let c31Re = 0;
  let c31Im = 0;
  let c40Re = 0;
  let c40Im = 0;
  let inertia = 0;
  let mL = 0;
  let mR = 0;
  const hasAsym = asymNX !== 0 || asymNY !== 0;
  const half = size * 0.5;

  for (let y = 0; y < size; y++) {
    const row = y * size;
    let dy = y - centerY;
    if (dy > half) dy -= size;
    if (dy < -half) dy += size;
    const dy2 = dy * dy;
    for (let x = 0; x < size; x++) {
      const w = cells[row + x];
      if (w <= epsilon) continue;
      let dx = x - centerX;
      if (dx > half) dx -= size;
      if (dx < -half) dx += size;

      const dx2 = dx * dx;
      const dxy = dx * dy;

      inertia += w * (dx2 + dy2);

      if (hasAsym) {
        const side = dx * asymNY - dy * asymNX;
        if (side > 0) mR += w;
        else mL += w;
      }

      const z2Re = dx2 - dy2;
      const z2Im = 2 * dxy;
      const z3Re = z2Re * dx - z2Im * dy;
      const z3Im = z2Re * dy + z2Im * dx;
      const z4Re = z2Re * z2Re - z2Im * z2Im;
      const z4Im = 2 * z2Re * z2Im;

      const z2zb1Re = z2Re * dx + z2Im * dy;
      const z2zb1Im = -z2Re * dy + z2Im * dx;
      const z1zb2Re = dx * z2Re + dy * z2Im;
      const z1zb2Im = -dx * z2Im + dy * z2Re;
      const z2zb2Re = z2Re * z2Re + z2Im * z2Im;
      const z2zb2Im = 0;
      const z3zb1Re = z3Re * dx + z3Im * dy;
      const z3zb1Im = -z3Re * dy + z3Im * dx;

      c11Re += w * (dx2 + dy2);
      c20Re += w * z2Re;
      c20Im += w * z2Im;
      c21Re += w * z2zb1Re;
      c21Im += w * z2zb1Im;
      c12Re += w * z1zb2Re;
      c12Im += w * z1zb2Im;
      c30Re += w * z3Re;
      c30Im += w * z3Im;
      c22Re += w * z2zb2Re;
      c22Im += w * z2zb2Im;
      c31Re += w * z3zb1Re;
      c31Im += w * z3zb1Im;
      c40Re += w * z4Re;
      c40Im += w * z4Im;

      inv.mu20 += w * dx2;
      inv.mu02 += w * dy2;
      inv.mu11 += w * dxy;
    }
  }

  inv.inertia = inertia;
  inv.massLeft = mL;
  inv.massRight = mR;

  const m2 = Math.pow(mass, 2);
  const m25 = Math.pow(mass, 2.5);
  const m3 = Math.pow(mass, 3);

  c11Re /= m2;
  c20Re /= m2;
  c20Im /= m2;
  c21Re /= m25;
  c21Im /= m25;
  c12Re /= m25;
  c12Im /= m25;
  c30Re /= m25;
  c30Im /= m25;
  c22Re /= m3;
  c22Im /= m3;
  c31Re /= m3;
  c31Im /= m3;
  c40Re /= m3;
  c40Im /= m3;

  const c12sqRe = c12Re * c12Re - c12Im * c12Im;
  const c12sqIm = 2 * c12Re * c12Im;
  const c12cuRe = c12sqRe * c12Re - c12sqIm * c12Im;
  const c12cuIm = c12sqRe * c12Im + c12sqIm * c12Re;
  const c12q4Re = c12sqRe * c12sqRe - c12sqIm * c12sqIm;
  const c12q4Im = 2 * c12sqRe * c12sqIm;

  const hu5Re = c30Re * c12cuRe - c30Im * c12cuIm;
  const hu5Im = c30Re * c12cuIm + c30Im * c12cuRe;
  const hu6Re = c20Re * c12sqRe - c20Im * c12sqIm;
  const fl8Re = c31Re * c12sqRe - c31Im * c12sqIm;
  const fl8Im = c31Re * c12sqIm + c31Im * c12sqRe;
  const fl10Re = c40Re * c12q4Re - c40Im * c12q4Im;
  const hu4Raw = c21Re * c12Re - c21Im * c12Im;

  inv.hu1Log = positiveLog10(Math.abs(c11Re), epsilon);
  inv.hu4Log = signedLog10(hu4Raw);
  inv.hu5Log = signedLog10(hu5Re);
  inv.hu6Log = signedLog10(hu6Re);
  inv.hu7Log = signedLog10(hu5Im);
  inv.flusser7 = c22Re;
  inv.flusser8Log = signedLog10(fl8Re);
  inv.flusser9Log = signedLog10(fl8Im);
  inv.flusser10Log = signedLog10(fl10Re);

  return inv;
}

function torusDelta(a, b, size) {
  let d = a - b;
  const half = size * 0.5;
  if (d > half) d -= size;
  if (d < -half) d += size;
  return d;
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

function kernelCore(r, kn) {
  const fn = KERNEL_CORE[Math.max(0, Math.min(3, kn - 1))];
  return fn ? fn(r) : KERNEL_CORE[0](r);
}

function kernelShell(d, b, kn, rr) {
  if (d >= rr) return 0;
  const B = b.length;
  const Br = (B * d) / rr;
  const idx = Math.min(Math.floor(Br), B - 1);
  const bVal = b[idx];
  const frac = Br % 1;
  return kernelCore(Math.min(frac, 1), kn) * bVal;
}

function buildKernel(params) {
  const R = params.R;
  const kn = params.kn || 1;
  const rr = Number(params.r) || 1;
  let b;
  if (Array.isArray(params.b)) {
    b = params.b.map(Number);
  } else if (typeof params.b === "string") {
    b = params.b.split(",").map(function (s) {
      s = s.trim();
      const slash = s.indexOf("/");
      return slash >= 0
        ? parseFloat(s.substring(0, slash)) / parseFloat(s.substring(slash + 1))
        : parseFloat(s);
    });
  } else {
    b = [Number(params.b) || 1];
  }
  if (b.length === 0 || b.some(isNaN)) b = [1];

  const kernelRadius = Math.ceil(R);
  const kernelSize = kernelRadius * 2 + 1;
  const kernelDisplay = new Float32Array(kernelSize * kernelSize);

  for (let y = 0; y < kernelSize; y++) {
    for (let x = 0; x < kernelSize; x++) {
      const dx = x - kernelRadius;
      const dy = y - kernelRadius;
      const d = Math.sqrt(dx * dx + dy * dy) / R;
      kernelDisplay[y * kernelSize + x] = kernelShell(d, b, kn, rr);
    }
  }

  let sum = 0;
  let maxVal = 0;
  for (let i = 0; i < kernelDisplay.length; i++) {
    sum += kernelDisplay[i];
    if (kernelDisplay[i] > maxVal) maxVal = kernelDisplay[i];
  }

  const kernelConvolution = new Float32Array(kernelDisplay);

  if (sum > 0) {
    for (let i = 0; i < kernelConvolution.length; i++) {
      kernelConvolution[i] /= sum;
    }
  }

  const dxArr = [];
  const dyArr = [];
  const kvArr = [];
  for (let y = 0; y < kernelSize; y++) {
    for (let x = 0; x < kernelSize; x++) {
      const val = kernelConvolution[y * kernelSize + x];
      if (val > 0) {
        dxArr.push(x - kernelRadius);
        dyArr.push(y - kernelRadius);
        kvArr.push(val);
      }
    }
  }

  return {
    kernel: kernelConvolution,
    kernelDisplay,
    kernelConvolution,
    kernelSize,
    kernelRadius,
    kernelMax: maxVal,
    kernelDX: Int16Array.from(dxArr),
    kernelDY: Int16Array.from(dyArr),
    kernelValues: Float32Array.from(kvArr),
  };
}

function buildKernelFFT(kernel, kernelSize, N) {
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

  fft2D(buf, N, false);
  return buf;
}

function buildKernelND(params, N, ndim) {
  const R = params.R;
  const kn = params.kn || 1;
  const rr = Number(params.r) || 1;
  let b;
  if (Array.isArray(params.b)) {
    b = params.b.map(Number);
  } else if (typeof params.b === "string") {
    b = params.b.split(",").map(function (s) {
      s = s.trim();
      const slash = s.indexOf("/");
      return slash >= 0
        ? parseFloat(s.substring(0, slash)) / parseFloat(s.substring(slash + 1))
        : parseFloat(s);
    });
  } else {
    b = [Number(params.b) || 1];
  }
  if (b.length === 0 || b.some(isNaN)) b = [1];
  const total = Math.pow(N, ndim);
  const kernel = new Float64Array(total);
  const mid = N / 2;
  let sum = 0;

  for (let idx = 0; idx < total; idx++) {
    let tmp = idx;
    let distSq = 0;
    for (let a = ndim - 1; a >= 0; a--) {
      const c = tmp % N;
      tmp = Math.floor(tmp / N);
      const delta = (c - mid) / R;
      distSq += delta * delta;
    }
    const d = Math.sqrt(distSq);
    const val = kernelShell(d, b, kn, rr);
    kernel[idx] = val;
    sum += val;
  }

  if (sum > 0) {
    for (let i = 0; i < total; i++) kernel[i] /= sum;
  }
  return kernel;
}

function buildKernelFFTND(kernel, N, ndim) {
  const total = Math.pow(N, ndim);
  const buf = new Float64Array(total * 2);
  const mid = Math.floor(N / 2);

  for (let idx = 0; idx < total; idx++) {
    const val = kernel[idx];
    if (val === 0) continue;

    let tmp = idx;
    let destFlat = 0;
    let mul = 1;
    for (let a = ndim - 1; a >= 0; a--) {
      const c = tmp % N;
      tmp = Math.floor(tmp / N);
      destFlat += ((c - mid + N) % N) * mul;
      mul *= N;
    }

    buf[destFlat * 2] = val;
  }

  fftND(buf, N, ndim, false);
  return buf;
}

function growthFunc(n, m, s, gn) {
  if (gn === 2) return Math.exp(-((n - m) ** 2) / (2 * s ** 2)) * 2 - 1;
  if (gn === 3) return Math.abs(n - m) <= s ? 1 : -1;
  const val = Math.max(0, 1 - (n - m) ** 2 / (9 * s ** 2));
  return Math.pow(val, 4) * 2 - 1;
}

const _fftScratch = {
  N: 0,
  cellBuf: null,
  result: null,
};

function getFFTScratch(N) {
  const required = N * N * 2;
  if (_fftScratch.N !== N || !_fftScratch.cellBuf || !_fftScratch.result) {
    _fftScratch.N = N;
    _fftScratch.cellBuf = new Float64Array(required);
    _fftScratch.result = new Float64Array(required);
  }
  return _fftScratch;
}

function prepareFFTInput2D(cellBuf, cells, size, N) {
  if (size === N) {
    const count = size * size;
    for (let i = 0, j = 0; i < count; i++, j += 2) {
      cellBuf[j] = cells[i];
      cellBuf[j + 1] = 0;
    }
    return;
  }
  for (let y = 0; y < size; y++) {
    const srcRow = y * size;
    const dstRow = y * N;
    for (let x = 0; x < size; x++) {
      const di = (dstRow + x) * 2;
      cellBuf[di] = cells[srcRow + x];
      cellBuf[di + 1] = 0;
    }
    for (let x = size; x < N; x++) {
      const di = (dstRow + x) * 2;
      cellBuf[di] = 0;
      cellBuf[di + 1] = 0;
    }
  }

  for (let y = size; y < N; y++) {
    const row = y * N;
    for (let x = 0; x < N; x++) {
      const di = (row + x) * 2;
      cellBuf[di] = 0;
      cellBuf[di + 1] = 0;
    }
  }
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

  _stepCenterCache.cosX = acCosX;
  _stepCenterCache.sinX = acSinX;
  _stepCenterCache.cosY = acCosY;
  _stepCenterCache.sinY = acSinY;
  _stepCenterCache.mass = acMass;
  _stepCenterCache.valid = true;

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

function detectSymmetry(cells, polarSource, size, stats, state, params) {
  const cx = stats.mass > state.epsilon ? stats.centerX : size / 2;
  const cy = stats.mass > state.epsilon ? stats.centerY : size / 2;
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

  const centered = state.periodicityCentered;
  for (let i = 0; i < len; i++) {
    centered[i] = history[(start + i) % capacity] - mean;
  }

  let bestLag = 0;
  let bestCorr = 0;
  const maxLag = Math.min(180, Math.floor(len / 2));
  for (let lag = 2; lag <= maxLag; lag++) {
    let num = 0;
    let denA = 0;
    let denB = 0;
    for (let i = lag; i < len; i++) {
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

  const hasCachedCentre = _stepCenterCache.valid;
  if (hasCachedCentre) {
    cosX = _stepCenterCache.cosX;
    sinX = _stepCenterCache.sinX;
    cosY = _stepCenterCache.cosY;
    sinY = _stepCenterCache.sinY;
    mass = _stepCenterCache.mass;
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

  let centerX = 0,
    centerY = 0;
  if (mass > state.epsilon) {
    centerX = ((Math.atan2(sinX, cosX) / (2 * Math.PI)) * size + size) % size;
    centerY = ((Math.atan2(sinY, cosY) / (2 * Math.PI)) * size + size) % size;
  }

  let growthCenterX = 0,
    growthCenterY = 0,
    massGrowthDist = 0;
  if (gMass > state.epsilon) {
    growthCenterX =
      ((Math.atan2(gSinX, gCosX) / (2 * Math.PI)) * size + size) % size;
    growthCenterY =
      ((Math.atan2(gSinY, gCosY) / (2 * Math.PI)) * size + size) % size;
    const mgDx = torusDelta(centerX, growthCenterX, size);
    const mgDy = torusDelta(centerY, growthCenterY, size);
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
    const dx = torusDelta(centerX, state.lastCentreX, size);
    const dy = torusDelta(centerY, state.lastCentreY, size);
    const displacement = Math.sqrt(dx * dx + dy * dy);
    speed = displacement;
    centroidSpeed = displacement / safeR / dt;
    const motionAngle = Math.atan2(dy, dx);
    angle = motionAngle;
    centroidRotateSpeed = motionAngle / dt;
  }

  state.lastCentreX = centerX;
  state.lastCentreY = centerY;

  return {
    mass,
    growth,
    maxValue,
    centerX,
    centerY,
    growthCenterX,
    growthCenterY,
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
    centerX: 0,
    centerY: 0,
    growthCenterX: 0,
    growthCenterY: 0,
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
    stats.centerX = ((thetaX / (2 * Math.PI)) * size + size) % size;
    stats.centerY = ((thetaY / (2 * Math.PI)) * size + size) % size;
  }

  if (gMass > state.epsilon) {
    const gThetaX = Math.atan2(gSinX, gCosX);
    const gThetaY = Math.atan2(gSinY, gCosY);
    stats.growthCenterX = ((gThetaX / (2 * Math.PI)) * size + size) % size;
    stats.growthCenterY = ((gThetaY / (2 * Math.PI)) * size + size) % size;
    const mgDx = torusDelta(stats.centerX, stats.growthCenterX, size);
    const mgDy = torusDelta(stats.centerY, stats.growthCenterY, size);
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
    const adx = torusDelta(stats.centerX, state.lastCentreX, size);
    const ady = torusDelta(stats.centerY, state.lastCentreY, size);
    const aNorm = Math.sqrt(adx * adx + ady * ady);
    if (aNorm > state.epsilon) {
      asymNX = adx / aNorm;
      asymNY = ady / aNorm;
    }
  }

  const invariants = calcMomentInvariants(
    cells,
    size,
    stats.centerX,
    stats.centerY,
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
  detectSymmetry(cells, polarSource, size, stats, state, params);
  detectPeriodicity(stats, params, state);

  if (state.lastCentreX !== null) {
    const dx = torusDelta(stats.centerX, state.lastCentreX, size);
    const dy = torusDelta(stats.centerY, state.lastCentreY, size);
    const displacement = Math.sqrt(dx * dx + dy * dy);
    stats.speed = displacement;
    stats.centroidSpeed = displacement / safeR / dt;
    const motionAngle = Math.atan2(dy, dx);
    stats.angle = motionAngle;
    stats.centroidRotateSpeed = motionAngle / dt;
  }

  if (stats.massGrowthDist > state.epsilon) {
    const mgDx = torusDelta(stats.growthCenterX, stats.centerX, size);
    const mgDy = torusDelta(stats.growthCenterY, stats.centerY, size);
    const mgAngle = Math.atan2(mgDy, mgDx);

    if (state.lastMassGrowthAngle !== null) {
      stats.growthRotateSpeed =
        unwrapAngleDelta(mgAngle, state.lastMassGrowthAngle) / dt;
    }

    state.lastMassGrowthAngle = mgAngle;
  } else {
    state.lastMassGrowthAngle = null;
  }

  state.lastCentreX = stats.centerX;
  state.lastCentreY = stats.centerY;
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

function autoCenterShift(arr, size, shiftX, shiftY, channelCount) {
  if (shiftX === 0 && shiftY === 0) return;
  const len = arr.length;
  if (!_autoCenterTmp || _autoCenterTmpLen < len) {
    _autoCenterTmp = new Float32Array(len);
    _autoCenterTmpLen = len;
  }
  const tmp = _autoCenterTmp;
  const cellCount = size * size;
  const sx = ((shiftX % size) + size) % size;
  const sy = ((shiftY % size) + size) % size;
  if (_autoCenterTyLutSize !== size) {
    _autoCenterTyLut = new Int32Array(size);
    _autoCenterTyLutSize = size;
  }
  const tyLut = _autoCenterTyLut;
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
  arr.set(len === _autoCenterTmpLen ? tmp : tmp.subarray(0, len));
}

function zoomPlanes(arr, size, planeCount, factor) {
  const cellCount = size * size;
  const newDim = Math.max(1, Math.round(size * factor));
  const minDim = Math.min(size, newDim);
  const offDst = Math.floor((size - minDim) / 2);
  const offSrc = Math.floor((newDim - minDim) / 2);
  for (let p = 0; p < planeCount; p++) {
    const off = p * cellCount;
    const zoomed = new Float32Array(newDim * newDim);
    for (let y = 0; y < newDim; y++) {
      for (let x = 0; x < newDim; x++) {
        const sx = Math.min(Math.floor(x / factor), size - 1);
        const sy = Math.min(Math.floor(y / factor), size - 1);
        zoomed[y * newDim + x] = arr[off + sy * size + sx];
      }
    }
    for (let i = 0; i < cellCount; i++) arr[off + i] = 0;
    for (let y = 0; y < minDim; y++) {
      for (let x = 0; x < minDim; x++) {
        const v = zoomed[(offSrc + y) * newDim + (offSrc + x)];
        if (v > 1e-10) {
          const dy = (((offDst + y) % size) + size) % size;
          const dx = (((offDst + x) % size) + size) % size;
          arr[off + dy * size + dx] = v;
        }
      }
    }
  }
}

function _clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function _toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function _toInteger(value, fallback, min, max) {
  const numeric = Math.round(_toFiniteNumber(value, fallback));
  return _clamp(numeric, min, max);
}

function _sanitiseWorkerParams(rawParams) {
  const source = rawParams && typeof rawParams === "object" ? rawParams : {};
  const params = { ...source };

  params.size = _toInteger(source.size, 128, 16, 2048);
  params.R = _toInteger(source.R, 13, 1, Math.max(1, Math.floor(params.size / 2)));
  params.T = _clamp(_toFiniteNumber(source.T, 10), 0.1, 512);
  params.m = _clamp(_toFiniteNumber(source.m, 0.15), 0, 1);
  params.s = _clamp(_toFiniteNumber(source.s, 0.015), 0.0001, 1);
  params.kn = _toInteger(source.kn, 1, 1, 4);
  params.gn = _toInteger(source.gn, 1, 1, 3);
  params.h = _clamp(_toFiniteNumber(source.h, 1), 0.01, 2);
  params.addNoise = _clamp(_toFiniteNumber(source.addNoise, 0), 0, 10);
  params.maskRate = _clamp(_toFiniteNumber(source.maskRate, 0), 0, 10);
  params.paramP = _toInteger(source.paramP, 0, 0, 64);
  params.softClip = Boolean(source.softClip);
  params.multiStep = Boolean(source.multiStep);

  if (Array.isArray(source.b)) {
    const b = source.b
      .slice(0, 8)
      .map((v) => _clamp(_toFiniteNumber(v, 0), 0, 1))
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

self.onmessage = function (e) {
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
      if (mutation.type === "randomise") {
        const R = Number(params.R) || 10;
        const { size, dimension, planeCount, depth } = _ndState;
        _ndState.world.fill(0);
        _ndState.potential.fill(0);
        _ndState.growth.fill(0);
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
                _ndState.world[planeBase + y * size + x] = Math.random() * 0.9;
              }
            }
          }
        }
      }

      if (mutation.type === "clear") {
        _ndState.world.fill(0);
        _ndState.potential.fill(0);
        _ndState.growth.fill(0);
      }

      if (mutation.type === "place") {
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
                (((cellX - Math.floor(patternWidth / 2) + px) % size) + size) %
                size;
              const wy =
                (((cellY - Math.floor(patternHeight / 2) + py) % size) + size) %
                size;
              _ndState.world[planeBase + wy * size + wx] = val;
            }
          }
        }
        _ndState.potential.fill(0);
        _ndState.growth.fill(0);
      }

      if (mutation.type === "placeND") {
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
        _ndState.potential.fill(0);
        _ndState.growth.fill(0);
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
        autoCenterShift(_ndState.world, size, dx, dy, total / cellCount);
        autoCenterShift(_ndState.potential, size, dx, dy, total / cellCount);
        autoCenterShift(_ndState.growth, size, dx, dy, total / cellCount);
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
        zoomPlanes(_ndState.world, size, total / cellCount, transform.zoom);
        zoomPlanes(_ndState.potential, size, total / cellCount, transform.zoom);
        zoomPlanes(_ndState.growth, size, total / cellCount, transform.zoom);
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
    let potential = ensureLength(_toFloat32Array(msg.potential, expectedLength));
    let growth = ensureLength(_toFloat32Array(msg.growth, expectedLength));
    let growthOld = msg.growthOld
      ? ensureLength(_toFloat32Array(msg.growthOld, expectedLength))
      : null;

    if ((Number(_ndConfig?.dimension) || 2) > 2) {
      const ndSeed = msg.ndSeedWorld ? new Float32Array(msg.ndSeedWorld) : null;
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
      _kernelFFT = buildKernelFFT(info.kernelConvolution, info.kernelSize, _N);
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
      const ndSeed = msg.ndSeedWorld ? new Float32Array(msg.ndSeedWorld) : null;
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

    if (_stepCenterCache.valid) _stepCenterCache.valid = false;
    if (_ndStepCache.valid) _ndStepCache.valid = false;
    if (params.autoCenter && _ndState && _ndState.planeCount > 1) {
      const ndDim = _ndState.dimension;
      const ndDepth = _ndState.depth;
      const ndPlaneCount = _ndState.planeCount;
      const ndPlaneCellCount = cellCount * channelCount;
      const ndCache = _ndState._cache;
      const planeMass = ndCache.planeMass;
      if (_ndStepCache.planeMass && _ndStepCache.planeCount === ndPlaneCount) {
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
          for (let w = 0; w < ndDepth; w++) zMass += planeMass[z + w * ndDepth];
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
          for (let z = 0; z < ndDepth; z++) wMass += planeMass[z + w * ndDepth];
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
      dimension: Number(_ndConfig?.dimension) || Number(params?.dimension) || 2,
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
};
