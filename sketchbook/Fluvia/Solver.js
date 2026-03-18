class Solver {
  constructor(appcore) {
    this.appcore = appcore;

    const SQRT2 = Math.SQRT2;
    this.neighbours = [
      { x: -1, y: -1, distance: SQRT2 }, { x: -1, y: 0, distance: 1 }, { x: -1, y: 1, distance: SQRT2 },
      { x: 0, y: -1, distance: 1 },                                    { x: 0, y: 1, distance: 1 },
      { x: 1, y: -1, distance: SQRT2 },  { x: 1, y: 0, distance: 1 },  { x: 1, y: 1, distance: SQRT2 },
    ];
  }

  updateDischargeMap() {
    const { learningRate } = this.appcore.params;
    const { 
      area, dischargeMap, dischargeTrack, 
      momentumX, momentumXTrack, momentumY, momentumYTrack 
    } = this.appcore.terrain;

    const invLR = 1.0 - learningRate;

    for (let i = 0; i < area; i++) {
      dischargeMap[i] = invLR * dischargeMap[i] + learningRate * dischargeTrack[i];
      momentumX[i] = invLR * momentumX[i] + learningRate * momentumXTrack[i];
      momentumY[i] = invLR * momentumY[i] + learningRate * momentumYTrack[i];
    }
  }

  hydraulicErosion() {
    const {
      dropletsPerFrame, maxAge, minVolume, precipitationRate,
      gravity, momentumTransfer, entrainment, depositionRate,
      evaporationRate, sedimentErosionRate, bedrockErosionRate
    } = this.appcore.params;

    const { terrain } = this.appcore;
    const { 
      size, heightMap, sedimentMap, bedrockMap, 
      dischargeTrack, momentumXTrack, momentumYTrack,
      momentumX, momentumY, dischargeMap
    } = terrain;

    dischargeTrack.fill(0);
    momentumXTrack.fill(0);
    momentumYTrack.fill(0);

    for (let d = 0; d < dropletsPerFrame; d++) {
      let x = random(size) | 0;
      let y = random(size) | 0;

      if (terrain.getHeight(x, y) < 0.1) continue;

      let vx = 0, vy = 0, sediment = 0, age = 0;
      let volume = precipitationRate;

      while (age < maxAge && volume >= minVolume) {
        const floorX = x | 0;
        const floorY = y | 0;

        if (floorX < 0 || floorX >= size || floorY < 0 || floorY >= size) break;

        const index = terrain.getIndex(floorX, floorY);
        const heightStart = heightMap[index];
        const normal = terrain.getSurfaceNormal(floorX, floorY);

        vx += (gravity * normal.x) / volume;
        vy += (gravity * normal.z) / volume;

        const pmX = momentumX[index];
        const pmY = momentumY[index];
        const pmMag = Math.sqrt(pmX * pmX + pmY * pmY);

        if (pmMag > 0) {
          const speed = Math.sqrt(vx * vx + vy * vy);
          if (speed > 0) {
            const alignment = (pmX * vx + pmY * vy) / (pmMag * speed);
            const transfer = (momentumTransfer * alignment) / (volume + dischargeMap[index]);
            vx += transfer * pmX;
            vy += transfer * pmY;
          }
        }

        const finalSpeed = Math.sqrt(vx * vx + vy * vy);
        if (finalSpeed > 0) {
          const mag = Math.SQRT2 / finalSpeed;
          vx *= mag; vy *= mag;
        }

        x += vx; y += vy;

        dischargeTrack[index] += volume;
        momentumXTrack[index] += volume * vx;
        momentumYTrack[index] += volume * vy;

        const isOut = (x < 0 || x >= size || y < 0 || y >= size);
        const heightEnd = isOut ? heightStart - 0.002 : terrain.getHeight(x | 0, y | 0);

        const transportCapacity = Math.max(0, (1 + entrainment * terrain.getDischarge(index)) * (heightStart - heightEnd));
        const deficit = transportCapacity - sediment;

        if (deficit > 0) {
          const fromSed = Math.min(sedimentMap[index], deficit * sedimentErosionRate);
          sedimentMap[index] -= fromSed;

          let actualEroded = fromSed;
          const remainingDeficit = deficit - (fromSed / sedimentErosionRate);

          if (remainingDeficit > 0) {
            const fromBed = remainingDeficit * bedrockErosionRate;
            bedrockMap[index] -= fromBed;
            actualEroded += fromBed;
          }
          sediment += actualEroded;
        } else {
          const dep = -deficit * depositionRate;
          sedimentMap[index] += dep;
          sediment -= dep;
        }

        terrain.updateTotalHeight(index);

        const evap = (1 - evaporationRate);
        volume *= evap;
        sediment *= evap;

        if (isOut) break;

        this.thermalErosion(x, y);
        age++;
      }
    }
  }

  thermalErosion(x, y) {
    const { terrain } = this.appcore;
    const { size, heightMap, sedimentMap, bedrockMap } = terrain;
    const { maxHeightDiff, settlingRate } = this.appcore.params;

    const cx = x | 0;
    const cy = y | 0;

    if (cx < 0 || cx >= size || cy < 0 || cy >= size) return;

    const cIdx = terrain.getIndex(cx, cy);
    const cHeight = heightMap[cIdx];

    for (let i = 0; i < this.neighbours.length; i++) {
      const { x: nxOff, y: nyOff, distance } = this.neighbours[i];
      const nx = cx + nxOff;
      const ny = cy + nyOff;

      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

      const nIdx = terrain.getIndex(nx, ny);
      const nHeight = heightMap[nIdx];
      const diff = cHeight - nHeight;

      if (diff === 0) continue;

      const excess = Math.abs(diff) - distance * maxHeightDiff;
      if (excess <= 0) continue;

      const transfer = (settlingRate * excess) / 2;
      const srcIdx = diff > 0 ? cIdx : nIdx;
      const tgtIdx = diff > 0 ? nIdx : cIdx;

      heightMap[srcIdx] -= transfer;
      heightMap[tgtIdx] += transfer;

      let remaining = transfer;
      const fromSed = Math.min(remaining, sedimentMap[srcIdx]);
      
      sedimentMap[srcIdx] -= fromSed;
      remaining -= fromSed;

      if (remaining > 0) {
        bedrockMap[srcIdx] -= remaining;
      }
      sedimentMap[tgtIdx] += transfer;
    }
  }
}
