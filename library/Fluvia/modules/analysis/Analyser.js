class Analyser {
  constructor(appcore) {
    this.appcore = appcore;
    this.simulationStartTime = performance.now();
    this.reinitialise();
  }

  reinitialise() {
    const statistics = this.appcore.statistics;

    this.simulationStartTime = performance.now();

    statistics.simulationTime = 0;
    statistics.frameCounter = 0;
    statistics.heightHistogram = new Int32Array(256);
    statistics.normHistogram = new Float32Array(256);

    statistics.rugosity = 0;
    statistics.drainageDensity = 0;
    statistics.sedimentFlux = 0;
    statistics.erosionRate = 0;
    statistics.hydraulicResidence = 0;

    statistics.totalWater = 0;
    statistics.totalSediment = 0;
    statistics.totalBedrock = 0;

    statistics.avgElevation = 0;
    statistics.elevationStdDev = 0;

    statistics.activeWaterCover = 0;
    statistics.slopeComplexity = 0;

    statistics.compositeWaterCoveragePct = 0;
    statistics.compositeSedimentCoveragePct = 0;
    statistics.compositeFlatCoveragePct = 0;
    statistics.compositeSteepCoveragePct = 0;
    statistics.compositeMeanSlopeWeight = 0;
    statistics.compositeMeanSedimentAlpha = 0;
    statistics.compositeMeanWaterAlpha = 0;

    statistics.heightBounds.min = 0;
    statistics.heightBounds.max = 0;
    statistics.sedimentBounds.min = 0;
    statistics.sedimentBounds.max = 0;
    statistics.dischargeBounds.min = 0;
    statistics.dischargeBounds.max = 0;
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

  _copyFromBuffer(target, buffer, TypedArrayCtor) {
    if (!(buffer instanceof ArrayBuffer)) {
      return target;
    }

    const incoming = new TypedArrayCtor(buffer);
    const targetLength =
      target && typeof target.length === "number" ? target.length : 0;
    const outputLength = targetLength > 0 ? targetLength : incoming.length;

    if (!target || target.length !== outputLength) {
      target = new TypedArrayCtor(outputLength);
    }

    target.fill(0);
    target.set(incoming.subarray(0, outputLength));
    return target;
  }

  applyWorkerAnalysis(analysis) {
    if (!analysis || typeof analysis !== "object") return;

    const statistics = this.appcore.statistics;
    const setNumber = (key) => {
      const value = Number(analysis[key]);
      if (Number.isFinite(value)) statistics[key] = value;
    };

    if (analysis.heightHistogram) {
      statistics.heightHistogram = this._copyFromBuffer(
        statistics.heightHistogram,
        analysis.heightHistogram,
        Int32Array,
      );
    }
    if (analysis.normHistogram) {
      statistics.normHistogram = this._copyFromBuffer(
        statistics.normHistogram,
        analysis.normHistogram,
        Float32Array,
      );
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
      statistics.dischargeBounds.min =
        Number(analysis.dischargeBounds.min) || 0;
      statistics.dischargeBounds.max =
        Number(analysis.dischargeBounds.max) || 0;
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
