class Analyser {
  constructor(statistics = null) {
    this.series = [];
    this.statistics = statistics || {
      fps: 0,
      density: 0,
      peakDensity: 0,
      mean: 0,
      stdDev: 0,
      entropy: 0,
      concentration: 0,
      radialPeak: 0,
      radialSpread: 0,
      nodeEstimate: 0,
    };

    this.reset();
  }

  reset() {
    this.series = [];
  }

  _logGamma(z) {
    const coeffs = [
      676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012,
      9.9843695780195716e-6, 1.5056327351493116e-7,
    ];

    if (z < 0.5) {
      return (
        Math.log(Math.PI) -
        Math.log(Math.sin(Math.PI * z)) -
        this._logGamma(1 - z)
      );
    }

    let x = 0.99999999999980993;
    const tZ = z - 1;
    for (let i = 0; i < coeffs.length; i++) {
      x += coeffs[i] / (tZ + i + 1);
    }

    const t = tZ + coeffs.length - 0.5;
    return (
      0.5 * Math.log(2 * Math.PI) + (tZ + 0.5) * Math.log(t) - t + Math.log(x)
    );
  }

  _genLaguerre(k, alpha, x) {
    if (k <= 0) return 1.0;
    let L2 = 1.0;
    let L1 = 1.0 + alpha - x;
    let Lc = L1;
    for (let i = 2; i <= k; i++) {
      Lc = ((2 * i - 1 + alpha - x) * L1 - (i - 1 + alpha) * L2) / i;
      L2 = L1;
      L1 = Lc;
    }
    return Number.isFinite(Lc) ? Lc : 0.0;
  }

  _computeRadialProbabilityMoments(params) {
    const n = Math.max(1, Math.round(Number(params?.n) || 1));
    const l = Math.max(0, Math.min(n - 1, Math.round(Number(params?.l) || 0)));
    const Z = Math.max(1, Math.round(Number(params?.nuclearCharge) || 1));
    const aMuMeters =
      Number(params?.aMuMeters) > 0
        ? Number(params.aMuMeters)
        : 5.29177210903e-11;
    const a0Meters = 5.29177210903e-11;
    const toA0 = aMuMeters / a0Meters;

    let logNormR = 1.5 * Math.log((2.0 * Z) / (n * aMuMeters));
    logNormR +=
      0.5 *
      (this._logGamma(n - l) - (Math.log(2.0 * n) + this._logGamma(n + l + 1)));

    const expectedRadiusAMu = (3 * n * n - l * (l + 1)) / (2 * Z);
    const maxRadiusAMu = Math.max(
      4,
      Number(params?.viewRadius) || 0,
      expectedRadiusAMu * 4,
    );
    const samples = 1024;
    const dr = maxRadiusAMu / samples;

    let weightSum = 0;
    let weightedR = 0;
    let weightedR2 = 0;
    let peakWeight = -1;
    let radialPeakAMu = 0;

    for (let i = 1; i <= samples; i++) {
      const rAMu = i * dr;
      const rho = (2.0 * Z * rAMu) / n;
      const radialComponent =
        Math.exp(logNormR) *
        Math.exp(-rho / 2.0) *
        Math.pow(rho, l) *
        this._genLaguerre(n - l - 1, 2 * l + 1, rho);

      if (!Number.isFinite(radialComponent)) continue;

      const pR = rAMu * rAMu * radialComponent * radialComponent;
      if (!Number.isFinite(pR) || pR <= 0) continue;

      weightSum += pR;
      weightedR += pR * rAMu;
      weightedR2 += pR * rAMu * rAMu;

      if (pR > peakWeight) {
        peakWeight = pR;
        radialPeakAMu = rAMu;
      }
    }

    if (weightSum <= 0) return { radialPeak: 0, radialSpread: 0 };

    const meanR = weightedR / weightSum;
    const varianceR = Math.max(0, weightedR2 / weightSum - meanR * meanR);
    return {
      radialPeak: radialPeakAMu * toA0,
      radialSpread: Math.sqrt(varianceR) * toA0,
    };
  }

  _estimateOrbitalNodeCount3D(params) {
    const nRaw = Number(params?.n);
    const lRaw = Number(params?.l);
    const n = Number.isFinite(nRaw) ? Math.max(1, Math.round(nRaw)) : 0;
    if (n <= 0) return 0;

    const maxL = Math.max(0, n - 1);
    const l = Number.isFinite(lRaw)
      ? Math.max(0, Math.min(maxL, Math.round(lRaw)))
      : 0;

    const radialNodes = Math.max(0, n - l - 1);
    const angularNodes = l;
    return radialNodes + angularNodes;
  }

  updateStatistics(grid, params) {
    if (!grid || grid.length === 0) {
      this.statistics.density = 0;
      this.statistics.peakDensity = 0;
      this.statistics.mean = 0;
      this.statistics.stdDev = 0;
      this.statistics.entropy = 0;
      this.statistics.concentration = 0;
      this.statistics.radialPeak = 0;
      this.statistics.radialSpread = 0;
      this.statistics.nodeEstimate = 0;
      return;
    }

    let sum = 0;
    let peak = 0;
    let sumSq = 0;
    let entropyAcc = 0;

    const res =
      params?.resolution || Math.max(1, Math.round(Math.sqrt(grid.length)));
    for (let i = 0; i < grid.length; i++) {
      const val = grid[i];
      sum += val;
      sumSq += val * val;
      if (val > peak) peak = val;
      if (val > 1e-300) entropyAcc += val * Math.log(val);
    }

    const mean = sum / grid.length;

    let variance = 0;
    for (let i = 0; i < grid.length; i++) {
      const diff = grid[i] - mean;
      variance += diff * diff;
    }

    const stdDev = Math.sqrt(variance / grid.length);

    let concentration = 0;
    let entropy = 0;
    if (sum > 0) {
      for (let i = 0; i < grid.length; i++) {
        const p = grid[i] / sum;
        if (p > 1e-300) {
          entropy -= p * Math.log(p);
          concentration += p * p;
        }
      }
    }

    const nodeEstimate = this._estimateOrbitalNodeCount3D(params);

    const radialStandard = this._computeRadialProbabilityMoments(params);

    this.statistics.density = mean;
    this.statistics.peakDensity = peak;
    this.statistics.mean = mean;
    this.statistics.stdDev = stdDev;
    this.statistics.entropy = entropy;
    this.statistics.concentration = concentration;
    this.statistics.radialPeak = radialStandard.radialPeak;
    this.statistics.radialSpread = radialStandard.radialSpread;
    this.statistics.nodeEstimate = nodeEstimate;

    this.recordStatistics(params);
  }

  applyWorkerStatistics(workerStats, params) {
    if (!workerStats || typeof workerStats !== "object") return;

    const toFinite = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };

    this.statistics.density = toFinite(workerStats.density);
    this.statistics.peakDensity = toFinite(workerStats.peakDensity);
    this.statistics.mean = toFinite(workerStats.mean);
    this.statistics.stdDev = toFinite(workerStats.stdDev);
    this.statistics.entropy = toFinite(workerStats.entropy);
    this.statistics.concentration = toFinite(workerStats.concentration);
    this.statistics.radialPeak = toFinite(workerStats.radialPeak);
    this.statistics.radialSpread = toFinite(workerStats.radialSpread);
    this.statistics.nodeEstimate = toFinite(workerStats.nodeEstimate);

    this.recordStatistics(params);
  }

  recordStatistics(params) {
    const row = [
      Number(params?.fps) || 0,
      this.statistics.density,
      this.statistics.peakDensity,
      this.statistics.mean,
      this.statistics.stdDev,
      this.statistics.entropy,
      this.statistics.concentration,
      this.statistics.radialPeak,
      this.statistics.radialSpread,
      this.statistics.nodeEstimate,
      params?.n || 0,
      params?.l || 0,
      params?.m || 0,
      params?.resolution || 0,
      params?.viewRadius || 0,
    ];

    this.series.push(row);
    if (this.series.length > 10000) {
      this.series.shift();
    }
  }

  exportJSON() {
    return {
      statistics: { ...this.statistics },
      series: Array.isArray(this.series) ? this.series : [],
    };
  }

  importJSON(data) {
    if (data && typeof data === "object" && Array.isArray(data.series)) {
      this.series = data.series.map((row) =>
        Array.isArray(row) ? row.map((v) => Number(v) || 0) : [],
      );
    }
  }

  getStatRow() {
    const keys = [
      "density",
      "peakDensity",
      "mean",
      "stdDev",
      "entropy",
      "concentration",
      "radialPeak",
      "radialSpread",
      "nodeEstimate",
    ];
    const row = {};
    keys.forEach((key) => {
      row[key] = Number(this.statistics[key]) || 0;
    });
    return row;
  }
}
