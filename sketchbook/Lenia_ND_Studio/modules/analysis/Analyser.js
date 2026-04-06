class Analyser {
  static STAT_NAMES = {
    fps: "FPS [Hz]",
    n: "Generation [gen]",
    t: "Time [μs]",
    m: "Mass [μg]",
    g: "Growth [μg/μs]",
    ml: "Mass (log scale) [μg]",
    gl: "Growth (log scale) [μg/μs]",
    vl: "Mass volume (log scale) [μm²]",
    vgl: "Growth volume (log scale) [μm²]",
    rho: "Mass density [μg/μm²]",
    rhog: "Growth density [μg/(μm²·μs)]",
    p: "Peak value [cell-state]",
    r: "Gyradius [μm]",
    x: "Centroid X [μm]",
    y: "Centroid Y [μm]",
    gx: "Growth centroid X [μm]",
    gy: "Growth centroid Y [μm]",
    d: "Mass-growth distance [μm]",
    dg: "Growth-centroid distance [μm]",
    s: "Speed [μm/μs]",
    cs: "Centroid speed [μm/μs]",
    a: "Direction angle [rad]",
    wc: "Centroid rotate speed [rad/μs]",
    wg: "Growth-centroid rotate speed [rad/μs]",
    wt: "Major axis rotate speed [rad/μs]",
    ma: "Mass asymmetry [μg]",
    k: "Rotational symmetry order",
    ks: "Rotational symmetry strength [%]",
    wr: "Rotational speed [rad/μs]",
    ly: "Lyapunov exponent [gen⁻¹]",
    h1: "Moment of inertia - Hu's moment invariant 1 (log scale)",
    h4: "Skewness - Hu's moment invariant 4 (log scale)",
    h5: "Hu's 5 (log scale)",
    h6: "Hu's 6 (log scale)",
    h7: "Hu's 7 (log scale)",
    f7: "Kurtosis - Flusser's moment invariant 7",
    f8: "Flusser's 8 (log scale)",
    f9: "Flusser's 9 (log scale)",
    f10: "Flusser's 10 (log scale)",
  };

  static STAT_HEADERS = Object.keys(Analyser.STAT_NAMES);
  static STAT_INDEX = Object.freeze(
    Analyser.STAT_HEADERS.reduce((acc, key, index) => {
      acc[key] = index;
      return acc;
    }, {}),
  );
  static STAT_ROW_INDEX = Object.freeze({
    mass: 3,
    growth: 4,
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
    this.statistics = statistics || {
      gen: 0,
      time: 0,
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
      centreX: 0,
      centreY: 0,
      growthCentreX: 0,
      growthCentreY: 0,
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
      fps: 0,
    };
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

  applyWorkerStatistics(workerStats, automaton) {
    if (!workerStats || typeof workerStats !== "object") return;

    const statistics = this.statistics;
    const toFinite = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };

    statistics.gen = automaton.gen || 0;
    statistics.time = automaton.time || 0;
    statistics.mass = toFinite(workerStats.mass);
    statistics.growth = toFinite(workerStats.growth);
    statistics.massLog = toFinite(workerStats.massLog);
    statistics.growthLog = toFinite(workerStats.growthLog);
    statistics.massVolumeLog = toFinite(workerStats.massVolumeLog);
    statistics.growthVolumeLog = toFinite(workerStats.growthVolumeLog);
    statistics.massDensity = toFinite(workerStats.massDensity);
    statistics.growthDensity = toFinite(workerStats.growthDensity);
    statistics.maxValue = toFinite(workerStats.maxValue);
    statistics.gyradius = toFinite(workerStats.gyradius);
    statistics.centreX = toFinite(workerStats.centreX);
    statistics.centreY = toFinite(workerStats.centreY);
    statistics.growthCentreX = toFinite(workerStats.growthCentreX);
    statistics.growthCentreY = toFinite(workerStats.growthCentreY);
    statistics.massGrowthDist = toFinite(workerStats.massGrowthDist);
    statistics.massAsym = toFinite(workerStats.massAsym);
    statistics.speed = toFinite(workerStats.speed);
    statistics.centroidSpeed = toFinite(workerStats.centroidSpeed);
    statistics.angle = toFinite(workerStats.angle);
    statistics.centroidRotateSpeed = toFinite(workerStats.centroidRotateSpeed);
    statistics.growthRotateSpeed = toFinite(workerStats.growthRotateSpeed);
    statistics.majorAxisRotateSpeed = toFinite(
      workerStats.majorAxisRotateSpeed,
    );
    statistics.symmSides = toFinite(workerStats.symmSides);
    statistics.symmStrength = toFinite(workerStats.symmStrength);
    statistics.symmAngle = toFinite(workerStats.symmAngle);
    statistics.symmRotate = toFinite(workerStats.symmRotate);
    statistics.rotationSpeed = toFinite(workerStats.rotationSpeed);
    statistics.lyapunov = toFinite(workerStats.lyapunov);
    statistics.hu1Log = toFinite(workerStats.hu1Log);
    statistics.hu4Log = toFinite(workerStats.hu4Log);
    statistics.hu5Log = toFinite(workerStats.hu5Log);
    statistics.hu6Log = toFinite(workerStats.hu6Log);
    statistics.hu7Log = toFinite(workerStats.hu7Log);
    statistics.flusser7 = toFinite(workerStats.flusser7);
    statistics.flusser8Log = toFinite(workerStats.flusser8Log);
    statistics.flusser9Log = toFinite(workerStats.flusser9Log);
    statistics.flusser10Log = toFinite(workerStats.flusser10Log);
    statistics.period = toFinite(workerStats.period);
    statistics.periodConfidence = toFinite(workerStats.periodConfidence);

    this._recordTrajectoryPoint(statistics);
    statistics.trajectoryMass = this.trajectoryMass;
    statistics.trajectoryGrowth = this.trajectoryGrowth;
    statistics.psdFreq = this.psdFreq;
    statistics.psdPrimary = this.psdPrimary;
    statistics.psdSecondary = this.psdSecondary;
    statistics.psdPrimaryPeriod = this.psdPrimaryPeriod;
    statistics.psdSecondaryPeriod = this.psdSecondaryPeriod;

    statistics.sidesVec = workerStats.sidesVec || null;
    statistics.angleVec = workerStats.angleVec || null;
    statistics.rotateVec = workerStats.rotateVec || null;
    statistics.radiusVec = workerStats.radiusVec || null;
    statistics.symmMaxRadius = workerStats.symmMaxRadius || 0;
    statistics.polarArray = workerStats.polarArray || null;
    statistics.polarTH = workerStats.polarTH || null;
    statistics.polarR = workerStats.polarR || null;
    statistics.polarDensity = workerStats.polarDensity || null;
    statistics.rotateWSum = workerStats.rotateWSum || null;
    statistics.densitySum = workerStats.densitySum || null;

    if (workerStats.polarTH && workerStats.polarR) {
      this.polarSeriesTH.push(new Float32Array(workerStats.polarTH));
      this.polarSeriesR.push(new Float32Array(workerStats.polarR));
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
    statistics.gen = 0;
    statistics.time = 0;
    statistics.mass = 0;
    statistics.growth = 0;
    statistics.massLog = 0;
    statistics.growthLog = 0;
    statistics.massVolumeLog = 0;
    statistics.growthVolumeLog = 0;
    statistics.massDensity = 0;
    statistics.growthDensity = 0;
    statistics.maxValue = 0;
    statistics.gyradius = 0;
    statistics.centreX = 0;
    statistics.centreY = 0;
    statistics.growthCentreX = 0;
    statistics.growthCentreY = 0;
    statistics.massGrowthDist = 0;
    statistics.massAsym = 0;
    statistics.speed = 0;
    statistics.centroidSpeed = 0;
    statistics.angle = 0;
    statistics.centroidRotateSpeed = 0;
    statistics.growthRotateSpeed = 0;
    statistics.majorAxisRotateSpeed = 0;
    statistics.symmSides = 0;
    statistics.symmStrength = 0;
    statistics.rotationSpeed = 0;
    statistics.lyapunov = 0;
    statistics.hu1Log = 0;
    statistics.hu4Log = 0;
    statistics.hu5Log = 0;
    statistics.hu6Log = 0;
    statistics.hu7Log = 0;
    statistics.flusser7 = 0;
    statistics.flusser8Log = 0;
    statistics.flusser9Log = 0;
    statistics.flusser10Log = 0;
    statistics.period = 0;
    statistics.periodConfidence = 0;
    statistics.fps = 0;
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
    const primarySeries = this._extractStatSeries(activeRows, xKey);
    const secondarySeries = this._extractStatSeries(activeRows, yKey);

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

  _extractStatSeries(rows, statKey) {
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

  addStatRow(row, params = {}) {
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
    this._trimSegment(segment, params?.statsTrimSegment);

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

  getStatRow() {
    const statistics = this.statistics;
    return [
      statistics.fps || 0,
      statistics.gen || 0,
      statistics.time || 0,
      statistics.mass || 0,
      statistics.growth || 0,
      statistics.massLog || 0,
      statistics.growthLog || 0,
      statistics.massVolumeLog || 0,
      statistics.growthVolumeLog || 0,
      statistics.massDensity || 0,
      statistics.growthDensity || 0,
      statistics.maxValue || 0,
      statistics.gyradius || 0,
      statistics.centreX || 0,
      statistics.centreY || 0,
      statistics.growthCentreX || 0,
      statistics.growthCentreY || 0,
      statistics.massGrowthDist || 0,
      statistics.massAsym || 0,
      statistics.speed || 0,
      statistics.centroidSpeed || 0,
      statistics.angle || 0,
      statistics.centroidRotateSpeed || 0,
      statistics.growthRotateSpeed || 0,
      statistics.majorAxisRotateSpeed || 0,
      statistics.symmSides || 0,
      statistics.symmStrength || 0,
      statistics.rotationSpeed || 0,
      statistics.lyapunov || 0,
      statistics.hu1Log || 0,
      statistics.hu4Log || 0,
      statistics.hu5Log || 0,
      statistics.hu6Log || 0,
      statistics.hu7Log || 0,
      statistics.flusser7 || 0,
      statistics.flusser8Log || 0,
      statistics.flusser9Log || 0,
      statistics.flusser10Log || 0,
      statistics.period || 0,
      statistics.periodConfidence || 0,
    ];
  }

  exportCSV() {
    const headers =
      "FPS,Gen,Time,Mass,Growth,MassLog,GrowthLog,MassVolumeLog,GrowthVolumeLog,MassDensity,GrowthDensity,PeakValue,Gyradius,CentreX,CentreY,GrowthCentreX,GrowthCentreY,MassGrowthDist,GrowthCentroidDistance,MassAsym,Speed,CentroidSpeed,Angle,CentroidRotateSpeed,GrowthCentroidRotateSpeed,MajorAxisRotateSpeed,SymmSides,SymmStrength,RotationSpeed,Lyapunov,Hu1Log,Hu4Log,Hu5Log,Hu6Log,Hu7Log,Flusser7,Flusser8Log,Flusser9Log,Flusser10Log,Period,PeriodConfidence\n";
    let csv = headers;

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
