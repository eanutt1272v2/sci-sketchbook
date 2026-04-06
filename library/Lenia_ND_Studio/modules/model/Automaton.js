class Automaton {
  constructor(params) {
    this.kernel = null;
    this.kernelSize = 0;
    this.kernelRadius = 0;
    this.kernelMax = 0;
    this.kernelDX = new Int16Array(0);
    this.kernelDY = new Int16Array(0);
    this.kernelValues = new Float32Array(0);
    this.kernelReady = false;

    this.gen = 0;
    this.time = 0;
    this.change = null;

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
    this.kernelReady = false;
  }

  reset() {
    this.gen = 0;
    this.time = 0;
    this.change = null;
  }
}
