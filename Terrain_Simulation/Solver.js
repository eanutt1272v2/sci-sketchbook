class Solver {
  constructor(terrain, params) {
    this.terrain = terrain;
    this.params = params;

    const SQRT2 = Math.SQRT2;
    this.neighbours = [
      { x: -1, y: -1, distance: SQRT2 }, { x: -1, y: 0, distance: 1 }, { x: -1, y: 1, distance: SQRT2 },
      { x: 0, y: -1, distance: 1 },                                  { x: 0, y: 1, distance: 1 },
      { x: 1, y: -1, distance: SQRT2 },  { x: 1, y: 0, distance: 1 },  { x: 1, y: 1, distance: SQRT2 },
    ];
  }

  updateDischargeMap() {
    const { learningRate } = this.params;
    const { area, dischargeMap, dischargeTrack, momentumX, momentumXTrack, momentumY, momentumYTrack } = this.terrain;
    const inverseLearningRate = 1.0 - learningRate;

    for (let i = 0; i < area; i++) {
      dischargeMap[i] = inverseLearningRate * dischargeMap[i] + learningRate * dischargeTrack[i];
      momentumX[i] = inverseLearningRate * momentumX[i] + learningRate * momentumXTrack[i];
      momentumY[i] = inverseLearningRate * momentumY[i] + learningRate * momentumYTrack[i];
    }
  }

  hydraulicErosion() {
    const {
      dropletsPerFrame, maxAge, minVolume, precipitationRate,
      gravity, momentumTransfer, entrainment, depositionRate,
      evaporationRate, sedimentErosionRate, bedrockErosionRate
    } = this.params;

    const terrain = this.terrain;
    const { size } = terrain;

    terrain.dischargeTrack.fill(0);
    terrain.momentumXTrack.fill(0);
    terrain.momentumYTrack.fill(0);

    for (let d = 0; d < dropletsPerFrame; d++) {
      let x = random(size) | 0;
      let y = random(size) | 0;

      if (terrain.getHeight(x, y) < 0.1) continue;

      let vx = 0;
      let vy = 0;
      let sediment = 0;
      let age = 0;
      let volume = precipitationRate;

      while (age < maxAge && volume >= minVolume) {
        const floorX = x | 0;
        const floorY = y | 0;

        if (floorX < 0 || floorX >= size || floorY < 0 || floorY >= size) break;

        const index = terrain.getIndex(floorX, floorY);
        const heightStart = terrain.heightMap[index];
        const normal = terrain.getSurfaceNormal(floorX, floorY);

        vx += (gravity * normal.x) / volume;
        vy += (gravity * normal.z) / volume;

        const prevMomentumX = terrain.momentumX[index];
        const prevMomentumY = terrain.momentumY[index];
        const prevMomentumMag = Math.sqrt(prevMomentumX * prevMomentumX + prevMomentumY * prevMomentumY);

        if (prevMomentumMag > 0) {
          const currentSpeed = Math.sqrt(vx * vx + vy * vy);
          if (currentSpeed > 0) {
            const alignment = (prevMomentumX * vx + prevMomentumY * vy) / (prevMomentumMag * currentSpeed);
            const transfer = (momentumTransfer * alignment) / (volume + terrain.dischargeMap[index]);
            vx += transfer * prevMomentumX;
            vy += transfer * prevMomentumY;
          }
        }

        const finalSpeed = Math.sqrt(vx * vx + vy * vy);
        if (finalSpeed > 0) {
          const magnitude = Math.SQRT2 / finalSpeed;
          vx *= magnitude;
          vy *= magnitude;
        }

        x += vx;
        y += vy;

        terrain.dischargeTrack[index] += volume;
        terrain.momentumXTrack[index] += volume * vx;
        terrain.momentumYTrack[index] += volume * vy;

        const isOutOfBounds = (x < 0 || x >= size || y < 0 || y >= size);
        const heightEnd = isOutOfBounds ? heightStart - 0.002 : terrain.getHeight(x | 0, y | 0);

        const transportCapacity = Math.max(0, (1 + entrainment * terrain.getDischarge(index)) * (heightStart - heightEnd));
        const sedimentDeficit = transportCapacity - sediment;

        if (sedimentDeficit > 0) {
          const fromSediment = Math.min(terrain.sedimentMap[index], sedimentDeficit * sedimentErosionRate);
          terrain.sedimentMap[index] -= fromSediment;

          let actualErosion = fromSediment;
          const remainingDeficit = (sedimentDeficit - (fromSediment / sedimentErosionRate));

          if (remainingDeficit > 0) {
            const fromBedrock = remainingDeficit * bedrockErosionRate;
            terrain.bedrockMap[index] -= fromBedrock;
            actualErosion += fromBedrock;
          }
			
          sediment += actualErosion;
        } else {
          const deposited = -sedimentDeficit * depositionRate;
          terrain.sedimentMap[index] += deposited;
          sediment -= deposited;
        }

        terrain.updateTotalHeight(index);

        const evaporation = (1 - evaporationRate);
        volume *= evaporation;
        sediment *= evaporation;

        if (isOutOfBounds) break;

        this.thermalErosion(x, y);
        age++;
      }
    }
  }

  thermalErosion(x, y) {
    const { size, heightMap, sedimentMap, bedrockMap } = this.terrain;
    const { maxHeightDiff, settlingRate } = this.params;
    const terrain = this.terrain;

    const centerX = x | 0;
    const centerY = y | 0;

    if (centerX < 0 || centerX >= size || centerY < 0 || centerY >= size) return;

    const centerIndex = terrain.getIndex(centerX, centerY);
    const centerHeight = heightMap[centerIndex];

    for (let i = 0; i < this.neighbours.length; i++) {
      const neighbour = this.neighbours[i];
      const nx = centerX + neighbour.x;
      const ny = centerY + neighbour.y;

      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

      const neighbourIndex = terrain.getIndex(nx, ny);
      const neighbourHeight = heightMap[neighbourIndex];
      const heightDifference = centerHeight - neighbourHeight;

      if (heightDifference === 0) continue;

      const absoluteDifference = Math.abs(heightDifference);
      const excess = absoluteDifference - neighbour.distance * maxHeightDiff;

      if (excess <= 0) continue;

      const transferValue = (settlingRate * excess) / 2;
      const sourceIndex = heightDifference > 0 ? centerIndex : neighbourIndex;
      const targetIndex = heightDifference > 0 ? neighbourIndex : centerIndex;

      heightMap[sourceIndex] -= transferValue;
      heightMap[targetIndex] += transferValue;

      let remainingToTransfer = transferValue;
      const fromSediment = Math.min(remainingToTransfer, sedimentMap[sourceIndex]);
      
      sedimentMap[sourceIndex] -= fromSediment;
      remainingToTransfer -= fromSediment;

      if (remainingToTransfer > 0) {
        bedrockMap[sourceIndex] -= remainingToTransfer;
      }
      sedimentMap[targetIndex] += transferValue;
    }
  }
}