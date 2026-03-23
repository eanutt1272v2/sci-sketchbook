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
    const center = (res - 1) * 0.5;
    const maxR = Math.max(1, Math.sqrt(center * center + center * center));
    const radialBins = 64;
    const radialMass = new Float64Array(radialBins);
    const radialCount = new Uint32Array(radialBins);

    for (let i = 0; i < grid.length; i++) {
      const val = grid[i];
      sum += val;
      sumSq += val * val;
      if (val > peak) peak = val;
      if (val > 1e-300) entropyAcc += val * Math.log(val);

      const x = i % res;
      const y = (i / res) | 0;
      const dx = x - center;
      const dy = y - center;
      const rn = Math.min(0.999999, Math.sqrt(dx * dx + dy * dy) / maxR);
      const bin = Math.floor(rn * radialBins);
      radialMass[bin] += val;
      radialCount[bin] += 1;
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

    let radialPeakBin = 0;
    let radialPeakMass = 0;
    let radialWeightedSum = 0;
    for (let i = 0; i < radialBins; i++) {
      const m = radialMass[i];
      if (m > radialPeakMass) {
        radialPeakMass = m;
        radialPeakBin = i;
      }
      radialWeightedSum += m * (i + 0.5);
    }

    const radialMeanBin = sum > 0 ? radialWeightedSum / sum : 0;
    let radialVarAcc = 0;
    for (let i = 0; i < radialBins; i++) {
      const d = i + 0.5 - radialMeanBin;
      radialVarAcc += radialMass[i] * d * d;
    }
    const radialSpread =
      sum > 0 ? Math.sqrt(radialVarAcc / sum) / radialBins : 0;

    let nodeEstimate = 0;
    const radialProfile = new Float64Array(radialBins);
    for (let i = 0; i < radialBins; i++) {
      radialProfile[i] =
        radialCount[i] > 0 ? radialMass[i] / radialCount[i] : 0;
    }
    for (let i = 1; i < radialBins - 1; i++) {
      const prev = radialProfile[i - 1];
      const cur = radialProfile[i];
      const next = radialProfile[i + 1];
      if (cur < prev && cur < next && cur < peak * 0.02) {
        nodeEstimate++;
      }
    }

    const radialPeakNorm = (radialPeakBin + 0.5) / radialBins;
    const maxRadiusAMu = Math.sqrt(2) * (Number(params?.viewRadius) || 0);
    const radialPeakAMu = radialPeakNorm * maxRadiusAMu;
    const radialSpreadAMu = radialSpread * maxRadiusAMu;

    this.statistics.density = mean;
    this.statistics.peakDensity = peak;
    this.statistics.mean = mean;
    this.statistics.stdDev = stdDev;
    this.statistics.entropy = entropy;
    this.statistics.concentration = concentration;
    this.statistics.radialPeak = radialPeakAMu;
    this.statistics.radialSpread = radialSpreadAMu;
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
