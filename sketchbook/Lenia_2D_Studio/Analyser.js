class Analyser {
  static STAT_NAMES = {
    fps: "FPS",
    n: "Gen (#)",
    t: "Time (s)",
    m: "Mass (mg)",
    g: "Growth (mg/s)",
    p: "Peak value",
    r: "Gyradius (mm)",
    x: "Mass centre X",
    y: "Mass centre Y",
    gx: "Growth centre X",
    gy: "Growth centre Y",
    d: "Mass-growth distance (mm)",
    s: "Speed (mm/s)",
    a: "Direction angle (deg)",
    ma: "Mass asymmetry (mg)",
    k: "Rotational symmetry order",
    ks: "Rotational symmetry strength",
    wr: "Rotational speed (deg/s)",
    ly: "Lyapunov exponent",
  };

  static STAT_HEADERS = Object.keys(Analyser.STAT_NAMES);

  constructor(statistics = null, renderData = null) {
    this.series = [];
    this.statistics = statistics || {
      gen: 0,
      time: 0,
      mass: 0,
      growth: 0,
      maxValue: 0,
      gyradius: 0,
      centerX: 0,
      centerY: 0,
      growthCenterX: 0,
      growthCenterY: 0,
      massGrowthDist: 0,
      massAsym: 0,
      speed: 0,
      angle: 0,
      symmSides: 0,
      symmStrength: 0,
      rotationSpeed: 0,
      lyapunov: 0,
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
    statistics.maxValue = toFinite(workerStats.maxValue);
    statistics.gyradius = toFinite(workerStats.gyradius);
    statistics.centerX = toFinite(workerStats.centerX);
    statistics.centerY = toFinite(workerStats.centerY);
    statistics.growthCenterX = toFinite(workerStats.growthCenterX);
    statistics.growthCenterY = toFinite(workerStats.growthCenterY);
    statistics.massGrowthDist = toFinite(workerStats.massGrowthDist);
    statistics.massAsym = toFinite(workerStats.massAsym);
    statistics.speed = toFinite(workerStats.speed);
    statistics.angle = toFinite(workerStats.angle);
    statistics.symmSides = toFinite(workerStats.symmSides);
    statistics.symmStrength = toFinite(workerStats.symmStrength);
    statistics.rotationSpeed = toFinite(workerStats.rotationSpeed);
    statistics.lyapunov = toFinite(workerStats.lyapunov);
    statistics.period = toFinite(workerStats.period);
    statistics.periodConfidence = toFinite(workerStats.periodConfidence);
  }

  resetStatistics() {
    const statistics = this.statistics;
    statistics.gen = 0;
    statistics.time = 0;
    statistics.mass = 0;
    statistics.growth = 0;
    statistics.maxValue = 0;
    statistics.gyradius = 0;
    statistics.centerX = 0;
    statistics.centerY = 0;
    statistics.growthCenterX = 0;
    statistics.growthCenterY = 0;
    statistics.massGrowthDist = 0;
    statistics.massAsym = 0;
    statistics.speed = 0;
    statistics.angle = 0;
    statistics.symmSides = 0;
    statistics.symmStrength = 0;
    statistics.rotationSpeed = 0;
    statistics.lyapunov = 0;
    statistics.period = 0;
    statistics.periodConfidence = 0;
    statistics.fps = 0;
  }

  updateFps() {
    const renderData = this.renderData;
    const statistics = this.statistics;
    renderData.frameCount++;
    const now = millis();

    if (now - renderData.lastTime > 1000) {
      statistics.fps = Math.round(
        (renderData.frameCount * 1000) / (now - renderData.lastTime),
      );
      renderData.frameCount = 0;
      renderData.lastTime = now;
    }
  }

  getStatRow() {
    const statistics = this.statistics;
    return [
      statistics.fps || 0,
      statistics.gen || 0,
      statistics.time || 0,
      statistics.mass || 0,
      statistics.growth || 0,
      statistics.maxValue || 0,
      statistics.gyradius || 0,
      statistics.centerX || 0,
      statistics.centerY || 0,
      statistics.growthCenterX || 0,
      statistics.growthCenterY || 0,
      statistics.massGrowthDist || 0,
      statistics.massAsym || 0,
      statistics.speed || 0,
      statistics.angle || 0,
      statistics.symmSides || 0,
      statistics.symmStrength || 0,
      statistics.rotationSpeed || 0,
      statistics.lyapunov || 0,
      statistics.period || 0,
      statistics.periodConfidence || 0,
    ];
  }

  exportCSV() {
    const headers =
      "FPS,Gen,Time,Mass,Growth,PeakValue,Gyradius,CentreX,CentreY,GrowthCentreX,GrowthCentreY,MassGrowthDist,MassAsym,Speed,Angle,SymmSides,SymmStrength,RotationSpeed,Lyapunov,Period,PeriodConfidence\n";
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
