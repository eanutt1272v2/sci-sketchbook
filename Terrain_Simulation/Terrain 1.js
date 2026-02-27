class Terrain {
  constructor(params) {
    this.size = params.terrainSize;
    this.area = this.size * this.size;
    this.params = params;

    this.heightMap = new Float32Array(this.area);
    this.originalHeightMap = new Float32Array(this.area);

    this.bedrockMap = new Float32Array(this.area);
    this.sedimentMap = new Float32Array(this.area);

    this.dischargeMap = new Float32Array(this.area);
    this.dischargeTrack = new Float32Array(this.area);

    this.momentumX = new Float32Array(this.area);
    this.momentumY = new Float32Array(this.area);
    this.momentumXTrack = new Float32Array(this.area);
    this.momentumYTrack = new Float32Array(this.area);

    this.sharedNormal = { x: 0, y: 0, z: 0 };
  }

  getIndex(x, y) {
    return y * this.size + x;
  }

  getHeight(x, y) {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return 0;
    return this.heightMap[y * this.size + x];
  }

  updateTotalHeight(index) {
    this.heightMap[index] = this.bedrockMap[index] + this.sedimentMap[index];
  }

  getMapBounds(mapArray) {
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let i = 0; i < mapArray.length; i++) {
      const value = mapArray[i];
      if (value < minVal) minVal = value;
      if (value > maxVal) maxVal = value;
    }

    return { min: minVal, max: maxVal };
  }

  getSurfaceNormal(x, y) {
    const { size, heightMap, sharedNormal, params } = this;
    const { heightScale } = params;

    const westIndex = x > 0 ? y * size + (x - 1) : y * size + x;
    const eastIndex = x < size - 1 ? y * size + (x + 1) : y * size + x;
    const northIndex = y > 0 ? (y - 1) * size + x : y * size + x;
    const southIndex = y < size - 1 ? (y + 1) * size + x : y * size + x;

    const deltaX = (heightMap[westIndex] - heightMap[eastIndex]) * heightScale;
    const deltaZ = (heightMap[northIndex] - heightMap[southIndex]) * heightScale;
    const deltaY = 1.0;

    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

    sharedNormal.x = deltaX / magnitude;
    sharedNormal.y = deltaY / magnitude;
    sharedNormal.z = deltaZ / magnitude;

    return sharedNormal;
  }

  getDischarge(index) {
    const intensity = this.dischargeMap[index];
    return this.codyErf(0.4 * intensity);
  }

  codyErf(x) {
    const absX = Math.abs(x);
    if (absX > 9.3) return x > 0 ? 1.0 : -1.0;

    let result;
    if (absX <= 0.84375) {
      const xSq = x * x;
      const p = [3.1611237438705656, 113.86415415105016, 377.485237685302, 3209.3775891384695, 0.18577770618460315];
      const q = [23.601290953873412, 244.55303442692948, 1287.1751860847748, 2844.2368334391706];

      const numerator = (((p[4] * xSq + p[0]) * xSq + p[1]) * xSq + p[2]) * xSq + p[3];
      const denominator = (((xSq + q[0]) * xSq + q[1]) * xSq + q[2]) * xSq + q[3];

      result = x * (numerator / denominator);
    } else if (absX <= 4.0) {
      const p = [0.5641884969886701, 8.883149794388376, 66.11542093743808, 298.63513819740013, 881.9522212417691, 1712.0476126340706, 2051.0783778260715, 1230.3393547979972, 2.1531153547440385e-8];
      const q = [15.744926110709835, 117.6939508913125, 537.1811018620099, 1621.3895745386784, 3290.7992357334596, 4362.61909014206, 3439.3676741437216, 1230.3393548037443];

      const n = (((((((p[8] * absX + p[0]) * absX + p[1]) * absX + p[2]) * absX + p[3]) * absX + p[4]) * absX + p[5]) * absX + p[6]) * absX + p[7];
      const d = (((((((absX + q[0]) * absX + q[1]) * absX + q[2]) * absX + q[3]) * absX + q[4]) * absX + q[5]) * absX + q[6]) * absX + q[7];

      result = 1.0 - Math.exp(-x * x) * (n / d);
      if (x < 0) result = -result;
    } else {
      result = x > 0 ? 1.0 : -1.0;
    }
    return result;
  }

  generate() {
    const { noiseScale, noiseOctaves, amplitudeFalloff } = this.params;
    const { size, area, heightMap, originalHeightMap, bedrockMap, sedimentMap, dischargeMap, dischargeTrack, momentumX, momentumY, momentumXTrack, momentumYTrack } = this;

    const maps = [heightMap, originalHeightMap, bedrockMap, sedimentMap, dischargeMap, dischargeTrack, momentumX, momentumY, momentumXTrack, momentumYTrack];
    maps.forEach(map => map.fill(0));

    const octaveOffsets = [];
    for (let i = 0; i < noiseOctaves; i++) {
      octaveOffsets.push({ x: random(100000), y: random(100000) });
    }

    for (let i = 0; i < area; i++) {
      const x = i % size;
      const y = (i / size) | 0;

      let currentAmplitude = 1;
      let currentFrequency = noiseScale / 100;
      let accumulatedNoise = 0;

      for (let octave = 0; octave < noiseOctaves; octave++) {
        const sampleX = x * currentFrequency + octaveOffsets[octave].x;
        const sampleY = y * currentFrequency + octaveOffsets[octave].y;

        accumulatedNoise += noise(sampleX, sampleY) * currentAmplitude;
        currentFrequency *= 2;
        currentAmplitude *= amplitudeFalloff;
      }

      heightMap[i] = Math.pow(accumulatedNoise, 1.2);
    }

    const { min: minH, max: maxH } = this.getMapBounds(heightMap);
    const heightRange = maxH - minH || 1;

    for (let i = 0; i < area; i++) {
      const normalisedHeight = (heightMap[i] - minH) / heightRange;
      heightMap[i] = normalisedHeight;
      bedrockMap[i] = normalisedHeight;
      originalHeightMap[i] = normalisedHeight;
    }
  }

  reset() {
    [this.heightMap, this.bedrockMap].forEach(map => map.set(this.originalHeightMap));
    [this.sedimentMap, this.dischargeMap, this.dischargeTrack, this.momentumX, this.momentumY, this.momentumXTrack, this.momentumYTrack].forEach(map => map.fill(0));
  }
}