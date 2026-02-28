
/**
 * @file Automaton.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
class Automaton {
  constructor(params) {
    this.kernel = null;
    this.kernelRadius = 0;
    this.updateParameters(params);
  }

  updateParameters(params) {
    this.R = params.R;
    this.T = params.T;
    this.m = params.m;
    this.s = params.s;
    this.b = params.b;
    this.kn = params.kn;
    this.gn = params.gn;
    this.softClip = params.softClip;
    this.multiStep = params.multiStep;

    this._calculateKernel();
  }

  _calculateKernel() {
    const kernelSize = Math.ceil(this.R) * 2 + 1;
    this.kernel = Array(kernelSize).fill(0).map(() => Array(kernelSize).fill(0));
    this.kernelRadius = Math.ceil(this.R);

    const cx = Math.floor(kernelSize / 2);
    const cy = Math.floor(kernelSize / 2);

    for (let y = 0; y < kernelSize; y++) {
      for (let x = 0; x < kernelSize; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / this.R;
        this.kernel[y][x] = this._kernelShell(d);
      }
    }

    this._normaliseKernel();
  }

  _normaliseKernel() {
    const kernelSize = this.kernel.length;
    let sum = 0;

    for (let y = 0; y < kernelSize; y++) {
      for (let x = 0; x < kernelSize; x++) {
        sum += this.kernel[y][x];
      }
    }

    if (sum > 0) {
      for (let y = 0; y < kernelSize; y++) {
        for (let x = 0; x < kernelSize; x++) {
          this.kernel[y][x] /= sum;
        }
      }
    }
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
      return (r >= q && r <= 1 - q) ? 1 : 0;
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
      const val = Math.max(0, 1 - ((n - this.m) ** 2) / (9 * (this.s ** 2)));
      return Math.pow(val, 4) * 2 - 1;
    } else if (gn === 1) {
      return Math.exp(-((n - this.m) ** 2) / (2 * (this.s ** 2))) * 2 - 1;
    } else if (gn === 2) {
      return (Math.abs(n - this.m) <= this.s) ? 1 : -1;
    }

    const val = Math.max(0, 1 - ((n - this.m) ** 2) / (9 * (this.s ** 2)));
    return Math.pow(val, 4) * 2 - 1;
  }

  convolve(board) {
    const kr = this.kernelRadius;
    const ksize = this.kernel.length;

    for (let y = 0; y < board.size; y++) {
      for (let x = 0; x < board.size; x++) {
        let sum = 0;

        for (let ky = 0; ky < ksize; ky++) {
          for (let kx = 0; kx < ksize; kx++) {
            const cy = (y + ky - kr + board.size) % board.size;
            const cx = (x + kx - kr + board.size) % board.size;
            sum += board.cells[cy][cx] * this.kernel[ky][kx];
          }
        }

        board.potential[y][x] = sum;
      }
    }
  }

  step(board) {
    this.convolve(board);

    const dt = 1 / this.T;

    for (let y = 0; y < board.size; y++) {
      for (let x = 0; x < board.size; x++) {
        const growth = this._growthFunc(board.potential[y][x]);
        board.field[y][x] = growth;

        let D = growth;
        if (this.multiStep && board.fieldOld) {
          D = 0.5 * (3 * board.field[y][x] - board.fieldOld[y][x]);
        }

        let newVal = board.cells[y][x] + dt * D;

        if (this.softClip) {
          newVal = Automaton.softClip(newVal, 0, 1, 1 / dt);
        } else {
          newVal = Math.max(0, Math.min(1, newVal));
        }

        board.cells[y][x] = newVal;
      }
    }

    if (this.multiStep) {
      if (!board.fieldOld) board.fieldOld = board._createGrid();
      for (let y = 0; y < board.size; y++) {
        for (let x = 0; x < board.size; x++) {
          board.fieldOld[y][x] = board.field[y][x];
        }
      }
    }
  }
}