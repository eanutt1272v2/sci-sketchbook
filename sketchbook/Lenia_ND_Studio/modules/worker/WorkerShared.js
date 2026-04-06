"use strict";

if (typeof importScripts === "function") {
  importScripts("../../_shared/utils/WorkerSanitisers.js");
}

const _workerSanitisers =
  globalThis.WorkerSanitisers ||
  Object.freeze({
    toFiniteNumber(value, fallback = 0) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    },
    toInteger(value, fallback, min, max) {
      const numeric = Math.round(this.toFiniteNumber(value, fallback));
      return numeric < min ? min : numeric > max ? max : numeric;
    },
  });

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

const _stepCentreCache = {
  valid: false,
  cosX: 0,
  sinX: 0,
  cosY: 0,
  sinY: 0,
  mass: 0,
};

let _autoCentreTmp = null;
let _autoCentreTmpLen = 0;
let _autoCentreTyLut = null;
let _autoCentreTyLutSize = 0;
let _ndDepthShiftTmp = null;
let _ndDepthShiftTmpLen = 0;

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
    periodicityCentreed: new Float64Array(maxHistory),
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
  centreX,
  centreY,
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
    let dy = y - centreY;
    if (dy > half) dy -= size;
    if (dy < -half) dy += size;
    const dy2 = dy * dy;
    for (let x = 0; x < size; x++) {
      const w = cells[row + x];
      if (w <= epsilon) continue;
      let dx = x - centreX;
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
