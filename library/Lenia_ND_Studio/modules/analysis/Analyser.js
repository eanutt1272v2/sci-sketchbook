class Analyser {
  static STAT_NAMES = STAT_NAMES;
  static STAT_HEADERS = STAT_HEADERS;
  static STAT_INDEX = STAT_INDEX;
  static STAT_ROW_INDEX = Object.freeze({
    mass: STAT_INDEX["m"],
    growth: STAT_INDEX["g"],
  });
  static PSD_INTERVAL = 32;
  static SEGMENT_LENGTH_SHORT = 512;
  static SEGMENT_LENGTH_LONG = 2048;

  constructor(statistics = null, renderData = null) {
    this.series = [];
    this.seriesSegments = [[]];
    this.current = null;
    this.polarSeriesTH = [];
    this.polarSeriesR = [];
    this.maxPolarSeries = 512;
    this.trajectoryMass = [];
    this.trajectoryGrowth = [];
    this.maxTrajectoryPoints = 512;
    this.psdFreq = null;
    this.psdPrimary = null;
    this.psdSecondary = null;
    this.psdPrimaryPeriod = 0;
    this.psdSecondaryPeriod = 0;
    this._lastPsdGeneration = -1;
    this.statistics = statistics || createEmptyStatistics();
    this.renderData = renderData || {
      frameCount: 0,
      lastTime: 0,
    };

    this._syncSeriesMetadata();
  }

  reset() {
    this.series = [];
    this.seriesSegments = [[]];
    this.current = null;
    this._resetOverlayHistory();
    this._syncSeriesMetadata();
  }

  applyWorkerStatistics(workerStatistics, automaton) {
    if (!workerStatistics || typeof workerStatistics !== "object") return;

    const statistics = this.statistics;

    statistics.gen = automaton.gen || 0;
    statistics.time = automaton.time || 0;
    applyWorkerStatScalars(statistics, workerStatistics);
    statistics.symmAngle = Number.isFinite(Number(workerStatistics.symmAngle))
      ? Number(workerStatistics.symmAngle)
      : 0;
    statistics.symmRotate = Number.isFinite(Number(workerStatistics.symmRotate))
      ? Number(workerStatistics.symmRotate)
      : 0;

    this._recordTrajectoryPoint(statistics);
    statistics.trajectoryMass = this.trajectoryMass;
    statistics.trajectoryGrowth = this.trajectoryGrowth;
    statistics.psdFreq = this.psdFreq;
    statistics.psdPrimary = this.psdPrimary;
    statistics.psdSecondary = this.psdSecondary;
    statistics.psdPrimaryPeriod = this.psdPrimaryPeriod;
    statistics.psdSecondaryPeriod = this.psdSecondaryPeriod;

    statistics.sidesVec = workerStatistics.sidesVec || null;
    statistics.angleVec = workerStatistics.angleVec || null;
    statistics.rotateVec = workerStatistics.rotateVec || null;
    statistics.radiusVec = workerStatistics.radiusVec || null;
    statistics.symmMaxRadius = workerStatistics.symmMaxRadius || 0;
    statistics.polarArray = workerStatistics.polarArray || null;
    statistics.polarTH = workerStatistics.polarTH || null;
    statistics.polarR = workerStatistics.polarR || null;
    statistics.polarDensity = workerStatistics.polarDensity || null;
    statistics.rotateWSum = workerStatistics.rotateWSum || null;
    statistics.densitySum = workerStatistics.densitySum || null;

    if (workerStatistics.polarTH && workerStatistics.polarR) {
      this.polarSeriesTH.push(new Float32Array(workerStatistics.polarTH));
      this.polarSeriesR.push(new Float32Array(workerStatistics.polarR));
      if (this.polarSeriesTH.length > this.maxPolarSeries) {
        this.polarSeriesTH.shift();
      }
      if (this.polarSeriesR.length > this.maxPolarSeries) {
        this.polarSeriesR.shift();
      }
    }
    statistics.seriesTH = this.polarSeriesTH;
    statistics.seriesR = this.polarSeriesR;
    statistics.series = this.series;
    statistics.seriesSegments = this.seriesSegments;
    statistics.statHeaders = Analyser.STAT_HEADERS;
    statistics.statNames = Analyser.STAT_NAMES;
  }

  resetStatistics() {
    const statistics = this.statistics;
    resetStatisticsScalars(statistics);
    statistics.polarArray = null;
    statistics.polarTH = null;
    statistics.polarR = null;
    statistics.polarDensity = null;
    statistics.rotateWSum = null;
    statistics.densitySum = null;
    statistics.seriesTH = [];
    statistics.seriesR = [];
    statistics.trajectoryMass = [];
    statistics.trajectoryGrowth = [];
    statistics.psdFreq = null;
    statistics.psdPrimary = null;
    statistics.psdSecondary = null;
    statistics.psdPrimaryPeriod = 0;
    statistics.psdSecondaryPeriod = 0;
    statistics.series = [];
    statistics.seriesSegments = [];
    statistics.statHeaders = Analyser.STAT_HEADERS;
    statistics.statNames = Analyser.STAT_NAMES;
    this.polarSeriesTH = [];
    this.polarSeriesR = [];
    this.series = [];
    this.seriesSegments = [[]];
    this.current = null;
    this._resetOverlayHistory();
    this._syncSeriesMetadata();
  }

  updatePeriodogram(params = {}, sampleStride = 1, force = false) {
    const generation = Math.max(
      0,
      Math.floor(Number(this.statistics.gen) || 0),
    );
    if (!force) {
      if (generation === this._lastPsdGeneration) return;
      if (generation % Analyser.PSD_INTERVAL !== 0) return;
    }

    const stride = Math.max(1, Math.floor(Number(sampleStride) || 1));
    const T = Math.max(1e-6, Number(params?.T) || 10);
    const sampleRateHz = T / stride;
    const xKey = String(params?.graphX || "m");
    const yKey = String(params?.graphY || "g");
    const activeRows = this.getActiveSegment();
    const primarySeries = this._extractStatisticseries(activeRows, xKey);
    const secondarySeries = this._extractStatisticseries(activeRows, yKey);

    if (primarySeries.length < 32 || secondarySeries.length < 32) {
      this.psdFreq = null;
      this.psdPrimary = null;
      this.psdSecondary = null;
      this.psdPrimaryPeriod = 0;
      this.psdSecondaryPeriod = 0;
      this.statistics.psdFreq = null;
      this.statistics.psdPrimary = null;
      this.statistics.psdSecondary = null;
      this.statistics.psdPrimaryPeriod = 0;
      this.statistics.psdSecondaryPeriod = 0;
      this.statistics.psdPrimaryKey = xKey;
      this.statistics.psdSecondaryKey = yKey;
      this.statistics.psdPrimaryLabel = Analyser.STAT_NAMES[xKey] || xKey;
      this.statistics.psdSecondaryLabel = Analyser.STAT_NAMES[yKey] || yKey;
      this.statistics.psdIsWelch = params?.periodogramUseWelch !== false;
      this._lastPsdGeneration = generation;
      return;
    }

    const useWelch = params?.periodogramUseWelch !== false;
    const computePSD = useWelch
      ? (series) => this._computeWelchPeriodogram(series, sampleRateHz, 512)
      : (series) => this._computePeriodogram(series, sampleRateHz, 512);

    const primary = computePSD(primarySeries);
    const secondary = computePSD(secondarySeries);

    if (!primary || !secondary) return;
    const count = Math.min(
      primary.freq.length,
      primary.power.length,
      secondary.power.length,
    );
    if (count <= 0) return;

    this.psdFreq = primary.freq.slice(0, count);
    this.psdPrimary = primary.power.slice(0, count);
    this.psdSecondary = secondary.power.slice(0, count);
    this.psdPrimaryPeriod = this._estimateDominantPeriod(
      this.psdFreq,
      this.psdPrimary,
    );
    this.psdSecondaryPeriod = this._estimateDominantPeriod(
      this.psdFreq,
      this.psdSecondary,
    );

    this.statistics.psdFreq = this.psdFreq;
    this.statistics.psdPrimary = this.psdPrimary;
    this.statistics.psdSecondary = this.psdSecondary;
    this.statistics.psdPrimaryPeriod = this.psdPrimaryPeriod;
    this.statistics.psdSecondaryPeriod = this.psdSecondaryPeriod;
    this.statistics.psdPrimaryKey = xKey;
    this.statistics.psdSecondaryKey = yKey;
    this.statistics.psdPrimaryLabel = Analyser.STAT_NAMES[xKey] || xKey;
    this.statistics.psdSecondaryLabel = Analyser.STAT_NAMES[yKey] || yKey;
    this.statistics.psdIsWelch = useWelch;

    this._lastPsdGeneration = generation;
  }

  _resetOverlayHistory() {
    this.trajectoryMass = [];
    this.trajectoryGrowth = [];
    this.psdFreq = null;
    this.psdPrimary = null;
    this.psdSecondary = null;
    this.psdPrimaryPeriod = 0;
    this.psdSecondaryPeriod = 0;
    this._lastPsdGeneration = -1;
  }

  static getStatIndex(statKey) {
    const key = String(statKey || "");
    const idx = Analyser.STAT_INDEX[key];
    return Number.isInteger(idx) ? idx : -1;
  }

  _extractStatisticseries(rows, statKey) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const idx = Analyser.getStatIndex(statKey);
    if (idx < 0) return [];
    const out = [];
    for (const row of rows) {
      if (!Array.isArray(row) || idx >= row.length) continue;
      const value = Number(row[idx]);
      if (Number.isFinite(value)) out.push(value);
    }
    return out;
  }

  _normaliseStatRow(row) {
    if (!Array.isArray(row)) return null;
    return row.map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    });
  }

  _trimSegment(segment, trimMode = 1) {
    const mode = Math.max(0, Math.min(2, Math.floor(Number(trimMode) || 0)));
    if (mode === 0) return;
    const limit =
      mode === 1 ? Analyser.SEGMENT_LENGTH_SHORT : Analyser.SEGMENT_LENGTH_LONG;
    if (segment.length > limit) {
      segment.splice(0, segment.length - limit);
    }
  }

  _syncSeriesMetadata() {
    this.statistics.series = this.series;
    this.statistics.seriesSegments = this.seriesSegments;
    this.statistics.statHeaders = Analyser.STAT_HEADERS;
    this.statistics.statNames = Analyser.STAT_NAMES;
  }

  addStatisticRow(row, params = {}) {
    const normalised = this._normaliseStatRow(row);
    if (!normalised) return;

    this.series.push(normalised);
    if (this.series.length > 10000) {
      this.series.splice(0, this.series.length - 10000);
    }

    if (
      !Array.isArray(this.seriesSegments) ||
      this.seriesSegments.length === 0
    ) {
      this.seriesSegments = [[]];
    }
    let segment = this.seriesSegments[this.seriesSegments.length - 1];
    if (!Array.isArray(segment)) {
      segment = [];
      this.seriesSegments.push(segment);
    }
    segment.push(normalised);
    this._trimSegment(segment, params?.statisticsTrimSegment);

    this.current = normalised;
    this._syncSeriesMetadata();
  }

  getActiveSegment() {
    if (
      !Array.isArray(this.seriesSegments) ||
      this.seriesSegments.length === 0
    ) {
      return [];
    }
    for (let i = this.seriesSegments.length - 1; i >= 0; i--) {
      const segment = this.seriesSegments[i];
      if (Array.isArray(segment) && segment.length > 0) return segment;
    }
    return [];
  }

  getAllSegments() {
    if (!Array.isArray(this.seriesSegments)) return [];
    return this.seriesSegments.filter(
      (segment) => Array.isArray(segment) && segment.length > 0,
    );
  }

  startNewSegment() {
    if (
      !Array.isArray(this.seriesSegments) ||
      this.seriesSegments.length === 0
    ) {
      this.seriesSegments = [[]];
      this._syncSeriesMetadata();
      return;
    }
    const last = this.seriesSegments[this.seriesSegments.length - 1];
    if (!Array.isArray(last) || last.length > 0) {
      this.seriesSegments.push([]);
    }
    this._syncSeriesMetadata();
  }

  _rebuildFlatSeriesFromSegments() {
    const merged = [];
    for (const segment of this.getAllSegments()) {
      for (const row of segment) {
        merged.push(row);
      }
    }
    this.series =
      merged.length > 10000 ? merged.slice(merged.length - 10000) : merged;
  }

  clearCurrentSegment() {
    if (
      !Array.isArray(this.seriesSegments) ||
      this.seriesSegments.length === 0
    ) {
      this.seriesSegments = [[]];
      this.series = [];
      this._syncSeriesMetadata();
      return;
    }
    let last = this.seriesSegments[this.seriesSegments.length - 1];
    if (
      Array.isArray(last) &&
      last.length === 0 &&
      this.seriesSegments.length > 1
    ) {
      this.seriesSegments.pop();
      last = this.seriesSegments[this.seriesSegments.length - 1];
    }
    if (Array.isArray(last)) {
      last.splice(0, last.length);
    }
    this._rebuildFlatSeriesFromSegments();
    this._syncSeriesMetadata();
  }

  clearAllSegments() {
    this.series = [];
    this.seriesSegments = [[]];
    this.current = null;
    this._syncSeriesMetadata();
  }

  setSeries(seriesRows) {
    const source = Array.isArray(seriesRows) ? seriesRows : [];
    const normalised = [];
    for (const row of source) {
      const next = this._normaliseStatRow(row);
      if (next) normalised.push(next);
    }
    this.series =
      normalised.length > 10000
        ? normalised.slice(normalised.length - 10000)
        : normalised;
    this.seriesSegments = [this.series.slice()];
    this.current = this.series.length
      ? this.series[this.series.length - 1]
      : null;
    this._syncSeriesMetadata();
  }

  _recordTrajectoryPoint(statistics) {
    const mass = Number(statistics?.mass);
    const centreX = Number(statistics?.centreX);
    const centreY = Number(statistics?.centreY);
    const growthX = Number(statistics?.growthCentreX);
    const growthY = Number(statistics?.growthCentreY);

    if (
      !Number.isFinite(mass) ||
      mass <= 1e-10 ||
      !Number.isFinite(centreX) ||
      !Number.isFinite(centreY)
    ) {
      return;
    }

    this.trajectoryMass.push({ x: centreX, y: centreY });
    if (this.trajectoryMass.length > this.maxTrajectoryPoints) {
      this.trajectoryMass.splice(
        0,
        this.trajectoryMass.length - this.maxTrajectoryPoints,
      );
    }

    if (Number.isFinite(growthX) && Number.isFinite(growthY)) {
      this.trajectoryGrowth.push({ x: growthX, y: growthY });
      if (this.trajectoryGrowth.length > this.maxTrajectoryPoints) {
        this.trajectoryGrowth.splice(
          0,
          this.trajectoryGrowth.length - this.maxTrajectoryPoints,
        );
      }
    }
  }

  _computeWelchPeriodogram(series, sampleRateHz, nfft = 512) {
    const clean = Array.isArray(series)
      ? series.filter((v) => Number.isFinite(v))
      : [];
    if (
      clean.length < 16 ||
      !Number.isFinite(sampleRateHz) ||
      sampleRateHz <= 0
    ) {
      return null;
    }

    const npersegRaw = Math.min(clean.length, 128);
    const nperseg = 2 ** Math.floor(Math.log2(npersegRaw));
    if (nperseg < 16) return null;

    const step = Math.max(8, Math.floor(nperseg / 2));
    const window = new Float64Array(nperseg);
    for (let i = 0; i < nperseg; i++) {
      window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (nperseg - 1));
    }

    let count = 0;
    let frequency = null;
    let accumPower = null;
    for (let start = 0; start + nperseg <= clean.length; start += step) {
      const chunk = clean.slice(start, start + nperseg);
      const spec = this._computePeriodogram(chunk, sampleRateHz, nfft, window);
      if (!spec || !spec.power || spec.power.length === 0) continue;

      if (!accumPower) {
        frequency = spec.freq;
        accumPower = new Float32Array(spec.power.length);
      }
      const len = Math.min(accumPower.length, spec.power.length);
      for (let i = 0; i < len; i++) {
        accumPower[i] += spec.power[i];
      }
      count += 1;
    }

    if (!accumPower || count <= 0) {
      return this._computePeriodogram(clean, sampleRateHz, nfft, window);
    }

    for (let i = 0; i < accumPower.length; i++) {
      accumPower[i] /= count;
    }

    return {
      freq: frequency,
      power: accumPower,
    };
  }

  _computePeriodogram(series, sampleRateHz, nfft = 512, window = null) {
    const clean = Array.isArray(series)
      ? series.filter((v) => Number.isFinite(v))
      : [];
    if (
      clean.length < 8 ||
      !Number.isFinite(sampleRateHz) ||
      sampleRateHz <= 0
    ) {
      return null;
    }

    const maxSize = Math.max(16, Math.floor(Number(nfft) || clean.length));
    const size = Math.min(clean.length, maxSize);
    if (size < 8) return null;

    const signal = clean.slice(clean.length - size);
    let mean = 0;
    for (let i = 0; i < size; i++) mean += signal[i];
    mean /= size;

    const half = Math.floor(size / 2);
    if (half <= 1) return null;

    const freq = new Float32Array(half - 1);
    const power = new Float32Array(half - 1);
    const effectiveWindow =
      window && window.length >= size ? window : new Float64Array(size).fill(1);

    let windowNorm = 0;
    for (let i = 0; i < size; i++) {
      const w = effectiveWindow[i];
      windowNorm += w * w;
    }
    if (!Number.isFinite(windowNorm) || windowNorm <= 0) windowNorm = size;

    for (let k = 1; k < half; k++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < size; n++) {
        const sample = (signal[n] - mean) * effectiveWindow[n];
        const phase = (2 * Math.PI * k * n) / size;
        re += sample * Math.cos(phase);
        im -= sample * Math.sin(phase);
      }

      freq[k - 1] = (k * sampleRateHz) / size;
      power[k - 1] = (re * re + im * im) / (size * windowNorm);
    }

    return { freq, power };
  }

  _estimateDominantPeriod(freq, power) {
    if (!freq || !power || !freq.length || !power.length) return 0;
    const count = Math.min(freq.length, power.length);
    let bestIndex = -1;
    let bestPower = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < count; i++) {
      const f = Number(freq[i]);
      const p = Number(power[i]);
      if (!Number.isFinite(f) || f <= 0 || !Number.isFinite(p)) continue;
      if (p > bestPower) {
        bestPower = p;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) return 0;
    const dominant = Number(freq[bestIndex]);
    if (!Number.isFinite(dominant) || dominant <= 0) return 0;
    return 1 / dominant;
  }

  updateFps() {
    const renderData = this.renderData;
    const statistics = this.statistics;
    const now = millis();

    if (now - renderData.lastTime > 1000) {
      statistics.fps = Math.round(
        (renderData.frameCount * 1000) / (now - renderData.lastTime),
      );
      renderData.frameCount = 0;
      renderData.lastTime = now;
    }
  }

  countStep() {
    this.renderData.frameCount++;
  }

  getStatisticsRow() {
    return statisticsToRow(this.statistics);
  }

  exportCSV() {
    let csv = STAT_CSV_HEADERS.join(",") + "\n";
    for (const row of this.series) {
      csv += row.join(",") + "\n";
    }
    return csv;
  }

  importCSV(csvText) {
    const lines = String(csvText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    const imported = [];

    if (lines.length < 2) {
      this.setSeries([]);
      return;
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => parseFloat(v));
      if (values.some((v) => Number.isFinite(v))) {
        imported.push(values.map((v) => (Number.isFinite(v) ? v : 0)));
      }
    }

    this.setSeries(imported);
  }
}
