class Analyser {
  constructor(manager) {
    this.m = manager;
    this.simulationStartTime = performance.now();
    this.reinitialise();
  }

  reinitialise() {
    const { area } = this.m.terrain;
    const stats = this.m.statistics;

    this.simulationStartTime = performance.now();
    this.lastAnalysisTime = performance.now();
    this.prevTotalSediment = 0;
    this.prevTotalBedrock = 0;

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
    
    stats.maxElevation = 0;
    stats.minElevation = 0;
    stats.avgElevation = 0;
    stats.elevationStdDev = 0;
    
    stats.peakDischarge = 0;
    stats.activeWaterCover = 0;
    stats.slopeComplexity = 0;

    stats.heightBounds = { min: 0, max: 0 };
    stats.sedimentBounds = { min: 0, max: 0 };
    stats.dischargeBounds = { min: 0, max: 0 };
  }

  update() {
    const { statistics, params } = this.m;
    statistics.fps = frameRate();
    statistics.frameCounter++;
    statistics.simulationTime = (performance.now() - this.simulationStartTime) / 1000;

    if (params.running) {
      this.runAnalysis();
    }
  }

  runAnalysis() {
    const { terrain, statistics, params } = this.m;
    const { area, size, heightMap, bedrockMap, sedimentMap, dischargeMap } = terrain;
    const { heightScale, evaporationRate } = params;

    let totalW = 0, totalS = 0, totalB = 0, riverCells = 0, totalSA = 0;
    let minE = Infinity, maxE = -Infinity, sumE = 0, sumSqE = 0;
    let minS = Infinity, maxS = -Infinity;
    let maxD = 0, slopeSum = 0;
    
    statistics.heightHistogram.fill(0);

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastAnalysisTime) / 1000 || 0.016;

    for (let i = 0; i < area; i++) {
      const h = heightMap[i];
      const s = sedimentMap[i];
      const b = bedrockMap[i];
      const d = dischargeMap[i];

      totalW += d;
      totalS += s;
      totalB += b;
      sumE += h;
      sumSqE += h * h;

      if (h < minE) minE = h;
      if (h > maxE) maxE = h;
      if (s < minS) minS = s;
      if (s > maxS) maxS = s;
      if (d > maxD) maxD = d;

      if (d > 0.05) riverCells++;

      const bin = Math.min(255, Math.max(0, (h * 255) | 0));
      statistics.heightHistogram[bin]++;

      const x = i % size;
      const y = (i / size) | 0;
      if (x < size - 1 && y < size - 1) {
        const sa = this._calcCellSA(x, y, terrain, heightScale);
        totalSA += sa;
        slopeSum += (sa - 1.0);
      }
    }

    statistics.minElevation = minE;
    statistics.maxElevation = maxE;
    statistics.heightBounds = { min: minE, max: maxE };
    statistics.sedimentBounds = { min: minS, max: maxS };
    statistics.dischargeBounds = { min: 0, max: maxD };
    statistics.peakDischarge = maxD;

    statistics.avgElevation = sumE / area;
    const variance = (sumSqE / area) - (statistics.avgElevation ** 2);
    statistics.elevationStdDev = Math.sqrt(Math.max(0, variance));

    statistics.totalWater = totalW;
    statistics.totalSediment = totalS;
    statistics.totalBedrock = totalB;
    
    statistics.rugosity = totalSA / area;
    statistics.slopeComplexity = slopeSum / area;
    statistics.drainageDensity = (riverCells / area) * 100;
    statistics.activeWaterCover = riverCells;

    statistics.sedimentFlux = (totalS - this.prevTotalSediment) / deltaTime;
    statistics.erosionRate = (this.prevTotalBedrock - totalB) / deltaTime;
    statistics.hydraulicResidence = totalW / (evaporationRate * area + 1e-6);

    this._normaliseHistogram();

    this.prevTotalSediment = totalS;
    this.prevTotalBedrock = totalB;
    this.lastAnalysisTime = currentTime;
  }

  _normaliseHistogram() {
    const { heightHistogram, normHistogram } = this.m.statistics;
    let maxBin = 0;
    for (let i = 0; i < 256; i++) if (heightHistogram[i] > maxBin) maxBin = heightHistogram[i];
    for (let i = 0; i < 256; i++) normHistogram[i] = maxBin > 0 ? heightHistogram[i] / maxBin : 0;
  }

  _calcCellSA(x, y, terrain, scale) {
    const { size, heightMap } = terrain;
    const i = y * size + x;
    const h00 = heightMap[i] * scale, h10 = heightMap[i+1] * scale;
    const h01 = heightMap[i+size] * scale, h11 = heightMap[i+size+1] * scale;
    const dx = (h10 - h00 + h11 - h01) * 0.5;
    const dy = (h01 - h00 + h11 - h10) * 0.5;
    return Math.sqrt(1 + dx * dx + dy * dy);
  }

  getAverageHeightInRegion(nx, ny, nSize) {
    const { size, heightMap } = this.m.terrain;
    const startX = (nx * size) | 0, startY = (ny * size) | 0, edge = (nSize * size) | 0;
    let sum = 0, count = 0;
    for (let y = startY; y < startY + edge && y < size; y++) {
      for (let x = startX; x < startX + edge && x < size; x++) {
        sum += heightMap[y * size + x];
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  getHypsometricIntegral(threshold = 0.5) {
    const { heightHistogram } = this.m.statistics;
    const startBin = (threshold * 255) | 0;
    let countAbove = 0;
    for (let i = startBin; i < 256; i++) countAbove += heightHistogram[i];
    return (countAbove / this.m.terrain.area) * 100;
  }
}