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

    let newVal = cells[i] + dt * D;
    change[i] = D;

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
    const cells = new Float32Array(msg.cells);
    const potential = new Float32Array(msg.potential);
    const field = new Float32Array(msg.field);
    const fieldOld = msg.fieldOld ? new Float32Array(msg.fieldOld) : null;
    const params = msg.params;

    if (!_kernelFFT || _N < _nextPow2(params.size)) {
      const info = _buildKernel(params);
      _kernelInfo = info;
      _N = _nextPow2(params.size);
      _kernelFFT = _buildKernelFFT(info.kernel, info.kernelSize, _N);
    }

    const change = _stepFFT(cells, potential, field, fieldOld, params, _N);

    let newFieldOld = null;
    if (params.multiStep) {
      newFieldOld = new Float32Array(field);
    }

    const transfers = [
      cells.buffer,
      potential.buffer,
      field.buffer,
      change.buffer,
    ];
    if (newFieldOld) transfers.push(newFieldOld.buffer);

    self.postMessage(
      {
        type: "result",
        cells: cells.buffer,
        potential: potential.buffer,
        field: field.buffer,
        fieldOld: newFieldOld ? newFieldOld.buffer : null,
        change: change.buffer,
      },
      transfers,
    );
    return;
  }
};
