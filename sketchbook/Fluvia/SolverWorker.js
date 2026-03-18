"use strict";

const SQRT2 = Math.SQRT2;
const neighbours = [
  { x: -1, y: -1, distance: SQRT2 }, { x: -1, y: 0, distance: 1 }, { x: -1, y: 1, distance: SQRT2 },
  { x: 0, y: -1, distance: 1 },                                    { x: 0, y: 1, distance: 1 },
  { x: 1, y: -1, distance: SQRT2 },  { x: 1, y: 0, distance: 1 },  { x: 1, y: 1, distance: SQRT2 },
];

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function getIndex(size, x, y) {
  return y * size + x;
}

function getHeight(size, heightMap, x, y) {
  if (x < 0 || x >= size || y < 0 || y >= size) return 0;
  return heightMap[y * size + x];
}

function updateTotalHeight(heightMap, bedrockMap, sedimentMap, index) {
  heightMap[index] = bedrockMap[index] + sedimentMap[index];
}

function getSurfaceNormal(size, heightMap, heightScale, x, y) {
  const west  = x > 0 ? y * size + (x - 1) : y * size + x;
  const east  = x < size - 1 ? y * size + (x + 1) : y * size + x;
  const north = y > 0 ? (y - 1) * size + x : y * size + x;
  const south = y < size - 1 ? (y + 1) * size + x : y * size + x;

  const deltaX = (heightMap[west] - heightMap[east]) * heightScale;
  const deltaZ = (heightMap[north] - heightMap[south]) * heightScale;
  const deltaY = 1.0;
  const mag = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ) || 1;

  return {
    x: deltaX / mag,
    y: deltaY / mag,
    z: deltaZ / mag,
  };
}

function codyErf(x) {
  const absX = Math.abs(x);
  if (absX > 9.3) return x > 0 ? 1.0 : -1.0;

  let result;
  if (absX <= 0.84375) {
    const xSq = x * x;
    const p = [3.1611237438705656, 113.86415415105016, 377.485237685302, 3209.3775891384695, 0.18577770618460315];
    const q = [23.601290953873412, 244.55303442692948, 1287.1751860847748, 2844.2368334391706];

    const num = (((p[4] * xSq + p[0]) * xSq + p[1]) * xSq + p[2]) * xSq + p[3];
    const den = (((xSq + q[0]) * xSq + q[1]) * xSq + q[2]) * xSq + q[3];
    result = x * (num / den);
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

function getDischarge(dischargeMap, index) {
  return codyErf(0.4 * dischargeMap[index]);
}

function thermalErosion(state, x, y) {
  const { size, heightMap, sedimentMap, bedrockMap, maxHeightDiff, settlingRate } = state;

  const cx = x | 0;
  const cy = y | 0;
  if (cx < 0 || cx >= size || cy < 0 || cy >= size) return;

  const cIdx = getIndex(size, cx, cy);
  const cHeight = heightMap[cIdx];

  for (let i = 0; i < neighbours.length; i++) {
    const { x: nxOff, y: nyOff, distance } = neighbours[i];
    const nx = cx + nxOff;
    const ny = cy + nyOff;
    if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

    const nIdx = getIndex(size, nx, ny);
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

function updateDischargeMap(state) {
  const { area, learningRate, dischargeMap, dischargeTrack, momentumX, momentumXTrack, momentumY, momentumYTrack } = state;
  const invLR = 1.0 - learningRate;
  for (let i = 0; i < area; i++) {
    dischargeMap[i] = invLR * dischargeMap[i] + learningRate * dischargeTrack[i];
    momentumX[i]    = invLR * momentumX[i]    + learningRate * momentumXTrack[i];
    momentumY[i]    = invLR * momentumY[i]    + learningRate * momentumYTrack[i];
  }
}

function hydraulicErosion(state) {
  const {
    dropletsPerFrame, maxAge, minVolume, precipitationRate,
    gravity, momentumTransfer, entrainment, depositionRate,
    evaporationRate, sedimentErosionRate, bedrockErosionRate,
    size, heightScale,
    heightMap, sedimentMap, bedrockMap,
    dischargeTrack, momentumXTrack, momentumYTrack,
    momentumX, momentumY, dischargeMap,
    randomSeed,
  } = state;

  const rand = mulberry32(randomSeed || 1);

  dischargeTrack.fill(0);
  momentumXTrack.fill(0);
  momentumYTrack.fill(0);

  for (let d = 0; d < dropletsPerFrame; d++) {
    let x = (rand() * size) | 0;
    let y = (rand() * size) | 0;

    if (getHeight(size, heightMap, x, y) < 0.1) continue;

    let vx = 0;
    let vy = 0;
    let sediment = 0;
    let age = 0;
    let volume = precipitationRate;

    while (age < maxAge && volume >= minVolume) {
      const floorX = x | 0;
      const floorY = y | 0;
      if (floorX < 0 || floorX >= size || floorY < 0 || floorY >= size) break;

      const index = getIndex(size, floorX, floorY);
      const heightStart = heightMap[index];
      const normal = getSurfaceNormal(size, heightMap, heightScale, floorX, floorY);

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
        vx *= mag;
        vy *= mag;
      }

      x += vx;
      y += vy;

      dischargeTrack[index] += volume;
      momentumXTrack[index] += volume * vx;
      momentumYTrack[index] += volume * vy;

      const isOut = (x < 0 || x >= size || y < 0 || y >= size);
      const heightEnd = isOut ? heightStart - 0.002 : getHeight(size, heightMap, x | 0, y | 0);

      const transportCapacity = Math.max(0, (1 + entrainment * getDischarge(dischargeMap, index)) * (heightStart - heightEnd));
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

      updateTotalHeight(heightMap, bedrockMap, sedimentMap, index);

      const evap = (1 - evaporationRate);
      volume *= evap;
      sediment *= evap;

      if (isOut) break;

      thermalErosion(state, x, y);
      age++;
    }
  }
}

self.onmessage = function (e) {
  const data = e.data || {};
  if (data.type !== "step") return;

  const state = {
    size: data.size,
    area: data.size * data.size,
    randomSeed: data.randomSeed,

    dropletsPerFrame: data.params.dropletsPerFrame,
    maxAge: data.params.maxAge,
    minVolume: data.params.minVolume,
    precipitationRate: data.params.precipitationRate,
    gravity: data.params.gravity,
    momentumTransfer: data.params.momentumTransfer,
    entrainment: data.params.entrainment,
    depositionRate: data.params.depositionRate,
    evaporationRate: data.params.evaporationRate,
    sedimentErosionRate: data.params.sedimentErosionRate,
    bedrockErosionRate: data.params.bedrockErosionRate,
    maxHeightDiff: data.params.maxHeightDiff,
    settlingRate: data.params.settlingRate,
    learningRate: data.params.learningRate,
    heightScale: data.params.heightScale,

    heightMap: new Float32Array(data.heightMap),
    bedrockMap: new Float32Array(data.bedrockMap),
    sedimentMap: new Float32Array(data.sedimentMap),
    dischargeMap: new Float32Array(data.dischargeMap),
    dischargeTrack: new Float32Array(data.dischargeTrack),
    momentumX: new Float32Array(data.momentumX),
    momentumY: new Float32Array(data.momentumY),
    momentumXTrack: new Float32Array(data.momentumXTrack),
    momentumYTrack: new Float32Array(data.momentumYTrack),
  };

  hydraulicErosion(state);
  updateDischargeMap(state);

  self.postMessage({
    type: "result",
    requestId: data.requestId,
    heightMap: state.heightMap.buffer,
    bedrockMap: state.bedrockMap.buffer,
    sedimentMap: state.sedimentMap.buffer,
    dischargeMap: state.dischargeMap.buffer,
    dischargeTrack: state.dischargeTrack.buffer,
    momentumX: state.momentumX.buffer,
    momentumY: state.momentumY.buffer,
    momentumXTrack: state.momentumXTrack.buffer,
    momentumYTrack: state.momentumYTrack.buffer,
  }, [
    state.heightMap.buffer,
    state.bedrockMap.buffer,
    state.sedimentMap.buffer,
    state.dischargeMap.buffer,
    state.dischargeTrack.buffer,
    state.momentumX.buffer,
    state.momentumY.buffer,
    state.momentumXTrack.buffer,
    state.momentumYTrack.buffer,
  ]);
};
