class FractalRenderer {
  constructor(appcore) {
    this.appcore = appcore;
    this.buffer = createGraphics(width, height);
    this.buffer.pixelDensity(1);

    this.LUT_SIZE = 2048;
    this.colorLUT = new Array(this.LUT_SIZE);

    this.mapNames = [
      "cividis", "inferno", "magma", "mako",
      "plasma", "rocket", "turbo", "viridis", "greyscale"
    ];

    this.currentMapIndex = 2;
  }

  render() {
    this.buffer.loadPixels();
    this.buffer.colorMode(RGB, 1.0);

    const aspectRatio = width / height;
    const invZoom = 1.0 / this.appcore.zoom;
    const cRe = this.appcore.juliaCx;
    const cIm = this.appcore.juliaCy;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let zx = map(x, 0, width, -2.1 * aspectRatio, 1.1 * aspectRatio) * invZoom + this.appcore.offsetX + 0.5;
        let zy = map(y, 0, height, -2.1, 1.1) * invZoom + this.appcore.offsetY + 0.5;
        let n = 0;

        while (n < this.appcore.maxIterations) {
          const zx2 = zx * zx;
          const zy2 = zy * zy;
          if (zx2 + zy2 > 16.0) {
            break;
          }
          const newZx = zx2 - zy2 + cRe;
          zy = 2.0 * zx * zy + cIm;
          zx = newZx;
          n++;
        }

        const idx = x + y * width;
        const pidx = idx * 4;
        if (n === this.appcore.maxIterations) {
          this.buffer.pixels[pidx] = 0;
          this.buffer.pixels[pidx + 1] = 0;
          this.buffer.pixels[pidx + 2] = 0;
          this.buffer.pixels[pidx + 3] = 255;
        } else {
          const logZn = Math.log(zx * zx + zy * zy) / 2.0;
          const nu = Math.log(logZn / Math.log(2)) / Math.log(2);
          const t = (n + 1 - nu) / this.appcore.maxIterations;
          const lutIndex = floor(constrain(t, 0, 1) * (this.LUT_SIZE - 1));
          const lutColor = this.colorLUT[lutIndex];
          this.buffer.pixels[pidx] = lutColor[0];
          this.buffer.pixels[pidx + 1] = lutColor[1];
          this.buffer.pixels[pidx + 2] = lutColor[2];
          this.buffer.pixels[pidx + 3] = 255;
        }
      }
    }

    this.buffer.updatePixels();
  }

  setMap(index) {
    this.currentMapIndex = index;
    this.generateLUT();
  }

  generateLUT() {
    const c = this.getCoefficients(this.mapNames[this.currentMapIndex]);
    for (let i = 0; i < this.LUT_SIZE; i++) {
      const t = i / (this.LUT_SIZE - 1);
      const r = Math.round(constrain(this.applyPoly(t, c[0]), 0, 1) * 255);
      const g = Math.round(constrain(this.applyPoly(t, c[1]), 0, 1) * 255);
      const b = Math.round(constrain(this.applyPoly(t, c[2]), 0, 1) * 255);
      this.colorLUT[i] = [r, g, b];
    }
  }

  applyPoly(t, c) {
    return c[0] + c[1] * t + c[2] * t * t + c[3] * t * t * t + c[4] * t * t * t * t + c[5] * t * t * t * t * t + c[6] * t * t * t * t * t * t;
  }

  getCoefficients(name) {
    if (name === "cividis") return [[-0.008973, -0.384689, 15.42921, -58.977031, 102.370492, -83.187239, 25.77607], [0.136756, 0.639494, 0.385562, -1.404197, 2.600914, -2.14075, 0.688122], [0.29417, 2.982654, -22.36376, 74.863561, -121.303164, 93.974216, -28.262533]];
    if (name === "inferno") return [[0.000214, 0.105874, 11.617115, -41.709277, 77.157454, -71.287667, 25.092619], [0.001635, 0.566364, -3.947723, 17.457724, -33.415679, 32.55388, -12.222155], [-0.03713, 4.117926, -16.257323, 44.645117, -82.253923, 73.588132, -23.11565]];
    if (name === "magma") return [[-0.002067, 0.250486, 8.345901, -27.666969, 52.170684, -50.758572, 18.664253], [-0.000688, 0.694455, -3.596031, 14.253853, -27.944584, 29.05388, -11.490027], [-0.009548, 2.495287, 0.329057, -13.646583, 12.881091, 4.269936, -5.570769]];
    if (name === "mako") return [[0.032987, 1.620032, -5.833466, 19.26673, -48.335836, 57.794682, -23.67438], [0.013232, 0.848348, -1.651402, 8.153931, -12.79364, 8.555513, -2.172825], [0.040283, 0.292971, 12.702365, -44.241782, 65.176477, -47.319049, 14.259791]];
    if (name === "plasma") return [[0.064053, 2.142438, -2.653255, 6.094711, -11.065106, 9.974645, -3.623823], [0.024812, 0.244749, -7.461101, 42.308428, -82.644718, 71.408341, -22.914405], [0.5349, 0.742966, 3.108382, -28.491792, 60.093584, -54.020563, 18.193381]];
    if (name === "rocket") return [[-0.003174, 1.947267, -6.401815, 30.376433, -57.268147, 44.789992, -12.453563], [0.037717, -0.476821, 15.073064, -81.403784, 173.768416, -158.313952, 52.250665], [0.112123, 0.400542, 6.253872, -21.550609, 14.869938, 11.402042, -10.648435]];
    if (name === "turbo") return [[0.080545, 7.00898, -66.727306, 228.660253, -334.841257, 220.424075, -54.09554], [0.069393, 3.147611, -4.927799, 25.101273, -69.296265, 67.510842, -21.578703], [0.219622, 7.655918, -10.16298, -91.680678, 288.708703, -305.386975, 110.735079]];
    if (name === "viridis") return [[0.274455, 0.107708, -0.327241, -4.599932, 6.203736, 4.751787, -5.432077], [0.005768, 1.39647, 0.214814, -5.758238, 14.153965, -13.749439, 4.641571], [0.332664, 1.386771, 0.091977, -19.291809, 56.6563, -65.320968, 26.272108]];
    return [[0, 1, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0]];
  }
}