class ErosionEngine {
  constructor(grid, params) {
    this.grid = grid;
    this.params = params;
    
    this.neighbourOffsets = [
      { x: -1, y: -1, d: Math.SQRT2 }, { x: -1, y: 0, d: 1 }, { x: -1, y: 1, d: Math.SQRT2 },
      { x: 0, y: -1, d: 1 },                                 { x: 0, y: 1, d: 1 },
      { x: 1, y: -1, d: Math.SQRT2 },  { x: 1, y: 0, d: 1 },  { x: 1, y: 1, d: Math.SQRT2 },
    ];
  }

  updateDischargeMap() {
    const { dischargeLearningRate } = this.params;
    const { area, dischargeMap, dischargeTrack, momentumX, momentumXTrack, momentumY, momentumYTrack } = this.grid;
    const inverseLearningRate = 1.0 - dischargeLearningRate;

    for (let cellIndex = 0; cellIndex < area; cellIndex++) {
      dischargeMap[cellIndex] = inverseLearningRate * dischargeMap[cellIndex] + dischargeLearningRate * dischargeTrack[cellIndex];
      momentumX[cellIndex] = inverseLearningRate * momentumX[cellIndex] + dischargeLearningRate * momentumXTrack[cellIndex];
      momentumY[cellIndex] = inverseLearningRate * momentumY[cellIndex] + dischargeLearningRate * momentumYTrack[cellIndex];
    }
  }

  simulateHydraulicErosion() {
    const { dropletsPerFrame, dropletMaxAge, dropletMinVolume, precipitationRate, gravity, momentumTransfer, entrainment, depositionRate, evaporationRate } = this.params;
    const { size } = this.grid;

    for (let dropletIndex = 0; dropletIndex < dropletsPerFrame; dropletIndex++) {
      let currentPosX = Math.floor(random(size));
      let currentPosY = Math.floor(random(size));
      const spawnHeight = this.grid.getHeight(currentPosX, currentPosY);

      if (spawnHeight < 0.1) continue;

      let velocityX = 0;
      let velocityY = 0;
      let waterVolume = precipitationRate;
      let sedimentLoad = 0;
      let dropletAge = 0;

      while (dropletAge < dropletMaxAge && waterVolume >= dropletMinVolume) {
        const coordinateX = Math.floor(currentPosX);
        const coordinateY = Math.floor(currentPosY);

        if (coordinateX < 0 || coordinateX >= size || coordinateY < 0 || coordinateY >= size) break;

        const gridCellIndex = this.grid.getIndex(coordinateX, coordinateY);
        const heightAtStart = this.grid.heightMap[gridCellIndex];
        const surfaceNormal = this.grid.getSurfaceNormal(coordinateX, coordinateY);

        if (waterVolume < dropletMinVolume || dropletAge > dropletMaxAge) {
          this.grid.heightMap[gridCellIndex] += sedimentLoad;
          break;
        }
        
        velocityX += (gravity * surfaceNormal.x) / waterVolume;
        velocityY += (gravity * surfaceNormal.z) / waterVolume;

        const flowVelX = this.grid.momentumX[gridCellIndex];
        const flowVelY = this.grid.momentumY[gridCellIndex];
        const flowSpeed = Math.sqrt(flowVelX * flowVelX + flowVelY * flowVelY);

        if (flowSpeed > 0) {
          const currentSpeed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

          if (currentSpeed > 0) {
            const alignment = (flowVelX * velocityX + flowVelY * velocityY) / (flowSpeed * currentSpeed);
            const transferFactor = (momentumTransfer * alignment) / (waterVolume + this.grid.dischargeMap[gridCellIndex]);

            velocityX += transferFactor * flowVelX;
            velocityY += transferFactor * flowVelY;
          }
        }

        const finalSpeed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (finalSpeed > 0) {
          const normalisationFactor = Math.sqrt(2) / finalSpeed;
          velocityX *= normalisationFactor;
          velocityY *= normalisationFactor;
        }

        currentPosX += velocityX;
        currentPosY += velocityY;

        this.grid.dischargeTrack[gridCellIndex] += waterVolume;
        this.grid.momentumXTrack[gridCellIndex] += waterVolume * velocityX;
        this.grid.momentumYTrack[gridCellIndex] += waterVolume * velocityY;
        
        let heightAtEnd;
        if (currentPosX < 0 || currentPosX >= size || currentPosY < 0 || currentPosY >= size) {
          heightAtEnd = heightAtStart - 0.002;
        } else {
          heightAtEnd = this.grid.getHeight(Math.floor(currentPosX), Math.floor(currentPosY));
        }

        const sedimentCapacity = (1 + entrainment * this.grid.getDischarge(gridCellIndex)) * (heightAtStart - heightAtEnd);
        const capacityClamped = Math.max(0, sedimentCapacity);
        const deltaSediment = capacityClamped - sedimentLoad;
        const sedimentChange = depositionRate * deltaSediment;

        sedimentLoad += sedimentChange;
        this.grid.heightMap[gridCellIndex] -= sedimentChange;

        const evaporationFactor = 1 - evaporationRate;
        sedimentLoad /= evaporationFactor;
        waterVolume *= evaporationFactor;

        if (currentPosX < 0 || currentPosX >= size || currentPosY < 0 || currentPosY >= size) {
          waterVolume = 0;
          break;
        }

        this.simulateThermalErosion(currentPosX, currentPosY);
        dropletAge++;
      }
    }
  }
  
  simulateThermalErosion(dropletPosX, dropletPosY) {
    const { size, heightMap } = this.grid;
    const { cascadeMaxDiff, cascadeSettling } = this.params;
    const offsets = this.neighbourOffsets;

    const coordinateX = dropletPosX | 0;
    const coordinateY = dropletPosY | 0;

    if (coordinateX < 0 || coordinateX >= size || coordinateY < 0 || coordinateY >= size) return;

    const centreIndex = coordinateY * size + coordinateX;
    const centreHeight = heightMap[centreIndex];

    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      const neighbourX = coordinateX + offset.x;
      const neighbourY = coordinateY + offset.y;

      if (neighbourX < 0 || neighbourX >= size || neighbourY < 0 || neighbourY >= size) continue;

      const neighbourIndex = neighbourY * size + neighbourX;
      const neighbourHeight = heightMap[neighbourIndex];

      const heightDifference = centreHeight - neighbourHeight;
      if (heightDifference === 0) continue;

      const absoluteDiff = Math.abs(heightDifference);
      let excessHeight = 0;

      if (neighbourHeight > 0.1) {
        excessHeight = absoluteDiff - offset.d * cascadeMaxDiff;
      } else {
        excessHeight = absoluteDiff;
      }

      if (excessHeight <= 0) continue;

      const materialTransfer = (cascadeSettling * excessHeight) / 2;

      if (heightDifference > 0) {
        heightMap[centreIndex] -= materialTransfer;
        heightMap[neighbourIndex] += materialTransfer;
      } else {
        heightMap[centreIndex] += materialTransfer;
        heightMap[neighbourIndex] -= materialTransfer;
      }
    }
  }
}