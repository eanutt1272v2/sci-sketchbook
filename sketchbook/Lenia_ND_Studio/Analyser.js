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

  constructor(statistics = null, renderData = null) {
    this.series = [];
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
      centerX: 0,
      centerY: 0,
      growthCenterX: 0,
      growthCenterY: 0,
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
  }

  reset() {
    this.series = [];
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
    statistics.centerX = toFinite(workerStats.centerX);
    statistics.centerY = toFinite(workerStats.centerY);
    statistics.growthCenterX = toFinite(workerStats.growthCenterX);
    statistics.growthCenterY = toFinite(workerStats.growthCenterY);
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

    statistics.sidesVec = workerStats.sidesVec || null;
    statistics.angleVec = workerStats.angleVec || null;
    statistics.rotateVec = workerStats.rotateVec || null;
    statistics.symmMaxRadius = workerStats.symmMaxRadius || 0;
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
    statistics.centerX = 0;
    statistics.centerY = 0;
    statistics.growthCenterX = 0;
    statistics.growthCenterY = 0;
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
      statistics.centerX || 0,
      statistics.centerY || 0,
      statistics.growthCenterX || 0,
      statistics.growthCenterY || 0,
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
    this.series = [];

    if (lines.length < 2) return;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => parseFloat(v));
      if (values.some((v) => Number.isFinite(v))) {
        this.series.push(values.map((v) => (Number.isFinite(v) ? v : 0)));
      }
    }
  }
}
