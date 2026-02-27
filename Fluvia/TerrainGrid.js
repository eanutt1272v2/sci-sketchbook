class TerrainGrid {
  constructor(size, params) {
    this.size = size;
    this.area = size * size;
    this.params = params;

    this.heightMap = new Float32Array(this.area);
    this.originalHeightMap = new Float32Array(this.area);
    this.dischargeMap = new Float32Array(this.area);
    this.dischargeTrack = new Float32Array(this.area);
    this.momentumX = new Float32Array(this.area);
    this.momentumY = new Float32Array(this.area);
    this.momentumXTrack = new Float32Array(this.area);
    this.momentumYTrack = new Float32Array(this.area);

    this.sharedNormal = { x: 0, y: 0, z: 0 };
  }

  getIndex(coordinateX, coordinateY) {
    return coordinateY * this.size + coordinateX;
  }

  getHeight(coordinateX, coordinateY) {
    const { size } = this;
    if (coordinateX < 0 || coordinateX >= size || coordinateY < 0 || coordinateY >= size) return 0;

    return this.heightMap[coordinateY * size + coordinateX];
  }

  getSurfaceNormal(coordinateX, coordinateY) {
    const { size } = this;
    const { surfaceNormalExaggeration } = this.params;
    const heightMap = this.heightMap;

    const indexLeft = coordinateX > 0 ? coordinateY * size + (coordinateX - 1) : coordinateY * size + coordinateX;
    const indexRight = coordinateX < size - 1 ? coordinateY * size + (coordinateX + 1) : coordinateY * size + coordinateX;
    const indexUp = coordinateY > 0 ? (coordinateY - 1) * size + coordinateX : coordinateY * size + coordinateX;
    const indexDown = coordinateY < size - 1 ? (coordinateY + 1) * size + coordinateX : coordinateY * size + coordinateX;

    const normalStrength = surfaceNormalExaggeration;
    const normalX = (heightMap[indexLeft] - heightMap[indexRight]) * normalStrength;
    const normalZ = (heightMap[indexUp] - heightMap[indexDown]) * normalStrength;
    const normalY = 1;

    const magnitude = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ);

    this.sharedNormal.x = normalX / magnitude;
    this.sharedNormal.y = normalY / magnitude;
    this.sharedNormal.z = normalZ / magnitude;

    return this.sharedNormal;
  }

  getDischarge(gridCellIndex) {
    const dischargeValue = this.dischargeMap[gridCellIndex];
    return this.erf(0.4 * dischargeValue);
  }

  erf(inputValue) {
    const sign = inputValue >= 0 ? 1 : -1;
    const absoluteValue = Math.abs(inputValue);

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t = 1 / (1 + p * absoluteValue);
    const result = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absoluteValue * absoluteValue);

    return sign * result;
  }

  generate() {
    this.heightMap.fill(0);
    this.dischargeMap.fill(0);
    this.dischargeTrack.fill(0);
    this.momentumX.fill(0);
    this.momentumY.fill(0);
    this.momentumXTrack.fill(0);
    this.momentumYTrack.fill(0);

    const { noiseScale, noiseOctaves, amplitudeFalloff, terrainHeight, } = this.params;
    const { size, area } = this;

    const octaveOffsets = [];
    for (let i = 0; i < noiseOctaves; i++) {
      octaveOffsets.push({
        x: random(100000),
        y: random(100000),
      });
    }

    for (let i = 0; i < area; i++) {
      const x = i % size;
      const y = (i / size) | 0;

      let amplitude = 1;
      let frequency = noiseScale / 100;
      let noiseValue = 0;

      for (let octave = 0; octave < noiseOctaves; octave++) {
        const sampleX = x * frequency + octaveOffsets[octave].x;
        const sampleY = y * frequency + octaveOffsets[octave].y;

        noiseValue += noise(sampleX, sampleY) * amplitude;

        frequency *= 2;
        amplitude *= amplitudeFalloff;
      }
      this.heightMap[i] = noiseValue;
      this.heightMap[i] = Math.pow(this.heightMap[i], 1.2);
    }

    let minHeight = Infinity;
    let maxHeight = -Infinity;

    for (let cellIndex = 0; cellIndex < area; cellIndex++) {
      const heightValue = this.heightMap[cellIndex];
      if (heightValue < minHeight) minHeight = heightValue;
      if (heightValue > maxHeight) maxHeight = heightValue;
    }

    const heightRange = maxHeight - minHeight || 1;

    for (let cellIndex = 0; cellIndex < area; cellIndex++) {
      let normalizedHeight =
        (this.heightMap[cellIndex] - minHeight) / heightRange;

      this.heightMap[cellIndex] = normalizedHeight * terrainHeight;
      this.originalHeightMap[cellIndex] = this.heightMap[cellIndex];
    }
  }

  reset() {
    this.heightMap.set(this.originalHeightMap);
    this.dischargeMap.fill(0);
    this.dischargeTrack.fill(0);
    this.momentumX.fill(0);
    this.momentumY.fill(0);
    this.momentumXTrack.fill(0);
    this.momentumYTrack.fill(0);
  }
}
