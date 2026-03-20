class Automaton {
  static KERNEL_CORE = [
    (r) => Math.pow(4 * r * (1 - r), 4),
    (r) => Math.exp(4 - 1 / (r * (1 - r))),
    (r, q = 0.25) => (r >= q && r <= 1 - q ? 1 : 0),
    (r, q = 0.25) => (r >= q && r <= 1 - q ? 1 : 0) + (r < q ? 0.5 : 0),
  ];
  static GROWTH_FUNC = [
    (n, m, s) =>
      Math.max(0, Math.pow(1 - Math.pow((n - m) / (9 * s), 2), 4)) * 2 - 1,
    (n, m, s) => Math.exp(-Math.pow((n - m) / (Math.sqrt(2) * s), 2)) * 2 - 1,
    (n, m, s) => (Math.abs(n - m) <= s ? 1 : -1),
  ];

  constructor(params) {
    this.kernel = null;
    this.kernelSize = 0;
    this.kernelRadius = 0;
    this.kernelMax = 0;
    this.kernelDX = new Int16Array(0);
    this.kernelDY = new Int16Array(0);
    this.kernelValues = new Float32Array(0);
    this.kernelSum = 1;
    this.gen = 0;
    this.time = 0;
    this.change = null;
    this.field = null;
    this.fieldOld = null;
    this.potential = null;
    this.kernelReady = false;

    this.updateParameters(params);
  }

  applyWorkerKernel(data) {
    this.kernel = new Float32Array(data.kernel);
    this.kernelSize = data.kernelSize;
    this.kernelRadius = Math.floor(data.kernelSize / 2);
    this.kernelMax = data.kernelMax;
    this.kernelDX = new Int16Array(data.kernelDX);
    this.kernelDY = new Int16Array(data.kernelDY);
    this.kernelValues = new Float32Array(data.kernelValues);
    this.kernelReady = true;
  }

  updateParameters(params) {
    this.R = params.R;
    this.T = params.T;
    this.m = params.m;
    this.s = params.s;
    this.b = Array.isArray(params.b) ? params.b : [params.b];
    this.kn = params.kn || 1;
    this.gn = params.gn || 1;
    this.softClip = params.softClip || false;
    this.multiStep = params.multiStep || false;
    this.addNoise = params.addNoise || 0;
    this.maskRate = params.maskRate || 0;
    this.paramP = params.paramP || 0;

    this._calculateKernel();
  }

  _calculateKernel() {
    this.kernelSize = Math.ceil(this.R) * 2 + 1;
    this.kernelRadius = Math.ceil(this.R);
    this.kernel = new Float32Array(this.kernelSize * this.kernelSize);

    const cx = Math.floor(this.kernelSize / 2);
    const cy = Math.floor(this.kernelSize / 2);

    for (let y = 0; y < this.kernelSize; y++) {
      for (let x = 0; x < this.kernelSize; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / this.R;
        this.kernel[y * this.kernelSize + x] = this._kernelShell(d);
      }
    }

    this._normaliseKernel();
    this._buildKernelSparse();
  }

  _normaliseKernel() {
    let sum = 0;
    let maxVal = 0;

    for (let i = 0; i < this.kernel.length; i++) {
      sum += this.kernel[i];
      if (this.kernel[i] > maxVal) maxVal = this.kernel[i];
    }

    if (sum > 0) {
      for (let i = 0; i < this.kernel.length; i++) {
        this.kernel[i] /= sum;
      }
      maxVal /= sum;
    }

    this.kernelMax = maxVal;
  }

  _buildKernelSparse() {
    const dx = [];
    const dy = [];
    const kv = [];
    const kr = this.kernelRadius;

    for (let y = 0; y < this.kernelSize; y++) {
      for (let x = 0; x < this.kernelSize; x++) {
        const val = this.kernel[y * this.kernelSize + x];
        if (val <= 0) continue;
        dx.push(x - kr);
        dy.push(y - kr);
        kv.push(val);
      }
    }

    this.kernelDX = Int16Array.from(dx);
    this.kernelDY = Int16Array.from(dy);
    this.kernelValues = Float32Array.from(kv);
  }

  _kernelShell(r) {
    if (r >= 1) return 0;

    const B = this.b.length;
    const Br = B * r;
    const idx = Math.min(Math.floor(Br), B - 1);
    const b = this.b[idx];
    const frac = Br % 1;

    return this._kernelCore(frac) * b;
  }

  _kernelCore(r) {
    const kn = this.kn - 1;

    if (kn === 0) {
      return Math.pow(4 * r * (1 - r), 4);
    } else if (kn === 1) {
      return r < 1 && r > 0 ? Math.exp(4 - 1 / (r * (1 - r))) : 0;
    } else if (kn === 2) {
      const q = 1 / 4;
      return r >= q && r <= 1 - q ? 1 : 0;
    } else if (kn === 3) {
      const q = 1 / 4;
      if (r >= q && r <= 1 - q) return 1;
      if (r < q) return 0.5;
      return 0;
    }

    return Math.pow(4 * r * (1 - r), 4);
  }

  _growthFunc(n) {
    const gn = this.gn - 1;

    if (gn === 0) {
      const val = Math.max(0, 1 - (n - this.m) ** 2 / (9 * this.s ** 2));
      return Math.pow(val, 4) * 2 - 1;
    } else if (gn === 1) {
      return Math.exp(-((n - this.m) ** 2) / (2 * this.s ** 2)) * 2 - 1;
    } else if (gn === 2) {
      return Math.abs(n - this.m) <= this.s ? 1 : -1;
    }

    const val = Math.max(0, 1 - (n - this.m) ** 2 / (9 * this.s ** 2));
    return Math.pow(val, 4) * 2 - 1;
  }

  convolve(board) {
    const size = board.size;
    const cells = board.cells;
    const potential = board.potential;
    const kdx = this.kernelDX;
    const kdy = this.kernelDY;
    const kval = this.kernelValues;

    for (let y = 0; y < size; y++) {
      const rowOffset = y * size;
      for (let x = 0; x < size; x++) {
        let sum = 0;

        for (let k = 0; k < kval.length; k++) {
          let cx = x + kdx[k];
          let cy = y + kdy[k];
          if (cx < 0) cx += size;
          else if (cx >= size) cx -= size;
          if (cy < 0) cy += size;
          else if (cy >= size) cy -= size;
          sum += cells[cy * size + cx] * kval[k];
        }

        potential[rowOffset + x] = sum;
      }
    }
  }

  step(board) {
    this.convolve(board);

    const dt = 1 / this.T;
    const cells = board.cells;
    const potential = board.potential;
    const field = board.field;
    const count = board.size * board.size;
    const hasOld = this.multiStep && board.fieldOld;
    const noiseAmp = this.addNoise / 10;
    const hasNoise = noiseAmp > 0;
    const maskRate = this.maskRate / 10;
    const hasMask = maskRate > 0;
    const quant = this.paramP;

    const delta = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const oldVal = cells[i];
      const growth = this._growthFunc(potential[i]);
      field[i] = growth;

      let D = growth;
      if (hasOld) {
        D = 0.5 * (3 * field[i] - board.fieldOld[i]);
      }

      const deltaTerm = dt * D;
      let newVal = oldVal + deltaTerm;

      if (hasNoise) {
        newVal *= 1 + (Math.random() - 0.5) * noiseAmp;
      }

      if (this.softClip) {
        newVal = Automaton.softClip(newVal, 0, 1, 1 / dt);
      } else {
        newVal = Math.max(0, Math.min(1, newVal));
      }

      if (quant > 0) {
        newVal = Math.round(newVal * quant) / quant;
      }

      delta[i] = deltaTerm;

      if (!hasMask || Math.random() > maskRate) {
        cells[i] = newVal;
      }
    }

    this.change = delta;

    if (this.multiStep) {
      if (!board.fieldOld) board.fieldOld = board._createGrid();
      board.fieldOld.set(field);
    }

    this.gen++;
    this.time = Math.round((this.time + 1 / this.T) * 10000) / 10000;
  }

  static softClip(x, minVal, maxVal, k) {
    const a = Math.exp(k * x);
    const b = Math.exp(k * minVal);
    const c = Math.exp(-k * maxVal);
    return Math.log(1 / (a + b) + c) / -k;
  }

  reset() {
    this.gen = 0;
    this.time = 0;
  }
}
