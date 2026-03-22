class Analyser {
  constructor(appcore) {
    this.appcore = appcore;
    this.simulationStartTime = performance.now();
    this.reinitialise();
  }

  reinitialise() {
    const stats = this.appcore.statistics;

    this.simulationStartTime = performance.now();

    stats.simulationTime = 0;
    stats.frameCounter = 0;
    stats.heightHistogram = new Int32Array(256);
    stats.normHistogram = new Float32Array(256);

    stats.rugosity = 0;
    stats.drainageDensity = 0;
    stats.sedimentFlux = 0;
    stats.erosionRate = 0;
    stats.hydraulicResidence = 0;

    stats.totalWater = 0;
    stats.totalSediment = 0;
    stats.totalBedrock = 0;

    stats.avgElevation = 0;
    stats.elevationStdDev = 0;

    stats.activeWaterCover = 0;
    stats.slopeComplexity = 0;

    stats.compositeWaterCoveragePct = 0;
    stats.compositeSedimentCoveragePct = 0;
    stats.compositeFlatCoveragePct = 0;
    stats.compositeSteepCoveragePct = 0;
    stats.compositeMeanSlopeWeight = 0;
    stats.compositeMeanSedimentAlpha = 0;
    stats.compositeMeanWaterAlpha = 0;

    stats.heightBounds.min = 0;
    stats.heightBounds.max = 0;
    stats.sedimentBounds.min = 0;
    stats.sedimentBounds.max = 0;
    stats.dischargeBounds.min = 0;
    stats.dischargeBounds.max = 0;
  }

  update() {
    const { statistics, params } = this.appcore;
    statistics.fps = frameRate();
    statistics.frameCounter++;
    statistics.simulationTime =
      (performance.now() - this.simulationStartTime) / 1000;

    if (!params.running) return;
  }

  _hasTerrainBuffers() {
    const t = this.appcore.terrain;
    return !!(
      t &&
      t.heightMap &&
      t.bedrockMap &&
      t.sedimentMap &&
      t.dischargeMap
    );
  }

  applyWorkerAnalysis(analysis) {
    if (!analysis || typeof analysis !== "object") return;

    const statistics = this.appcore.statistics;
    const setNumber = (key) => {
      const value = Number(analysis[key]);
      if (Number.isFinite(value)) statistics[key] = value;
    };

    if (analysis.heightHistogram) {
      statistics.heightHistogram = new Int32Array(analysis.heightHistogram);
    }
    if (analysis.normHistogram) {
      statistics.normHistogram = new Float32Array(analysis.normHistogram);
    }

    setNumber("avgElevation");
    setNumber("elevationStdDev");
    setNumber("totalWater");
    setNumber("totalSediment");
    setNumber("totalBedrock");
    setNumber("activeWaterCover");
    setNumber("drainageDensity");
    setNumber("hydraulicResidence");
    setNumber("rugosity");
    setNumber("slopeComplexity");
    setNumber("sedimentFlux");
    setNumber("erosionRate");
    setNumber("compositeWaterCoveragePct");
    setNumber("compositeSedimentCoveragePct");
    setNumber("compositeFlatCoveragePct");
    setNumber("compositeSteepCoveragePct");
    setNumber("compositeMeanSlopeWeight");
    setNumber("compositeMeanSedimentAlpha");
    setNumber("compositeMeanWaterAlpha");

    if (analysis.heightBounds) {
      statistics.heightBounds.min = Number(analysis.heightBounds.min) || 0;
      statistics.heightBounds.max = Number(analysis.heightBounds.max) || 0;
    }
    if (analysis.sedimentBounds) {
      statistics.sedimentBounds.min = Number(analysis.sedimentBounds.min) || 0;
      statistics.sedimentBounds.max = Number(analysis.sedimentBounds.max) || 0;
    }
    if (analysis.dischargeBounds) {
      statistics.dischargeBounds.min = Number(analysis.dischargeBounds.min) || 0;
      statistics.dischargeBounds.max = Number(analysis.dischargeBounds.max) || 0;
    }
  }

  getAverageHeightInRegion(nx, ny, nSize) {
    const { size, heightMap } = this.appcore.terrain;
    const startX = (nx * size) | 0,
      startY = (ny * size) | 0,
      edge = (nSize * size) | 0;
    let sum = 0,
      count = 0;
    for (let y = startY; y < startY + edge && y < size; y++) {
      for (let x = startX; x < startX + edge && x < size; x++) {
        sum += heightMap[y * size + x];
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  getHypsometricIntegral(threshold = 0.5) {
    const { heightHistogram } = this.appcore.statistics;
    const startBin = (threshold * 255) | 0;
    let countAbove = 0;
    for (let i = startBin; i < 256; i++) countAbove += heightHistogram[i];
    return (countAbove / this.appcore.terrain.area) * 100;
  }
}
