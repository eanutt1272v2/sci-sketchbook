



p5.displayFriendlyErrors = false;
let terrain, solver, renderer;

const params = {  
  dropletsPerFrame: 256,
  maxAge: 500,
  minVolume: 0.01,

  terrainSize: 256,
  noiseScale: 0.6,
  noiseOctaves: 8,
  amplitudeFalloff: 0.6,

  sedimentErosionRate: 0.1,
  bedrockErosionRate: 0.1,
  depositionRate: 0.1,
  evaporationRate: 0.001,
  precipitationRate: 1,

  entrainment: 1,
  gravity: 1,
  momentumTransfer: 1,

  learningRate: 0.1,
  maxHeightDiff: 0.01,
  settlingRate: 0.8,

  surfaceMap: "composite",

  heightScale: 100,

  skyColour: { r: 173, g: 183, b: 196 },
  steepColour: { r: 115, g: 115, b: 95 },
  flatColour: { r: 50, g: 81, b: 33 },
  sedimentColour: { r: 201, g: 189, b: 117 },
  waterColour: { r: 92, g: 133, b: 142 },

  lightDir: { x: 50, y: 50, z: -50 },
};

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  createCanvas(canvasSize, canvasSize);

  noSmooth();
  pixelDensity(1);

  terrain = new Terrain(params);
  solver = new Solver(terrain, params);
  renderer = new Renderer(terrain, params);
  terrain.generate();
}

function draw() {
  solver.hydraulicErosion();
  solver.updateDischargeMap();
  renderer.render();
}

function windowResized() {
  renderer.resize();
}

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
      result = x * (((((p[4] * xSq + p[0]) * xSq + p[1]) * xSq + p[2]) * xSq + p[3]) / ((((xSq + q[0]) * xSq + q[1]) * xSq + q[2]) * xSq + q[3]));
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
    const { size, area, heightMap, originalHeightMap, bedrockMap } = this;

    const octaveOffsets = Array.from({ length: noiseOctaves }, () => ({ x: random(100000), y: random(100000) }));

    let minH = Infinity, maxH = -Infinity;

    for (let i = 0; i < area; i++) {
      const x = i % size;
      const y = (i / size) | 0;
      let currentAmplitude = 1, currentFrequency = noiseScale / 100, accumulatedNoise = 0;

      for (let octave = 0; octave < noiseOctaves; octave++) {
        accumulatedNoise += noise(x * currentFrequency + octaveOffsets[octave].x, y * currentFrequency + octaveOffsets[octave].y) * currentAmplitude;
        currentFrequency *= 2;
        currentAmplitude *= amplitudeFalloff;
      }

      const val = Math.pow(accumulatedNoise, 1.2);
      heightMap[i] = val;
      if (val < minH) minH = val;
      if (val > maxH) maxH = val;
    }

    const range = maxH - minH || 1;
    for (let i = 0; i < area; i++) {
      const norm = (heightMap[i] - minH) / range;
      heightMap[i] = bedrockMap[i] = originalHeightMap[i] = norm;
    }
  }
}

class Solver {
  constructor(terrain, params) {
    this.terrain = terrain;
    this.params = params;
    const S2 = Math.SQRT2;
    this.neighbours = [
      { x: -1, y: -1, distance: S2 }, { x: -1, y: 0, distance: 1 }, { x: -1, y: 1, distance: S2 },
      { x: 0, y: -1, distance: 1 },                                 { x: 0, y: 1, distance: 1 },
      { x: 1, y: -1, distance: S2 },  { x: 1, y: 0, distance: 1 },  { x: 1, y: 1, distance: S2 },
    ];
  }

  updateDischargeMap() {
    const { learningRate } = this.params;
    const { area, dischargeMap, dischargeTrack, momentumX, momentumXTrack, momentumY, momentumYTrack } = this.terrain;
    const invLR = 1.0 - learningRate;

    for (let i = 0; i < area; i++) {
      dischargeMap[i] = invLR * dischargeMap[i] + learningRate * dischargeTrack[i];
      momentumX[i] = invLR * momentumX[i] + learningRate * momentumXTrack[i];
      momentumY[i] = invLR * momentumY[i] + learningRate * momentumYTrack[i];
    }
  }

  hydraulicErosion() {
    const { dropletsPerFrame, maxAge, minVolume, precipitationRate, gravity, momentumTransfer, entrainment, depositionRate, evaporationRate, sedimentErosionRate, bedrockErosionRate } = this.params;
    const { size, dischargeTrack, momentumXTrack, momentumYTrack, sedimentMap, bedrockMap, dischargeMap, momentumX, momentumY } = this.terrain;

    dischargeTrack.fill(0);
    momentumXTrack.fill(0);
    momentumYTrack.fill(0);

    for (let d = 0; d < dropletsPerFrame; d++) {
      let x = random(size), y = random(size);
      if (this.terrain.getHeight(x | 0, y | 0) < 0.1) continue;

      let vx = 0, vy = 0, sediment = 0, age = 0, volume = precipitationRate;

      while (age < maxAge && volume >= minVolume) {
        const fx = x | 0, fy = y | 0;
        if (fx < 0 || fx >= size || fy < 0 || fy >= size) break;

        const idx = this.terrain.getIndex(fx, fy);
        const hStart = this.terrain.heightMap[idx];
        const norm = this.terrain.getSurfaceNormal(fx, fy);

        vx += (gravity * norm.x) / volume;
        vy += (gravity * norm.z) / volume;

        const pMx = momentumX[idx], pMy = momentumY[idx];
        const pMMag = Math.sqrt(pMx * pMx + pMy * pMy);

        if (pMMag > 0) {
          const cSpd = Math.sqrt(vx * vx + vy * vy);
          if (cSpd > 0) {
            const align = (pMx * vx + pMy * vy) / (pMMag * cSpd);
            const trans = (momentumTransfer * align) / (volume + dischargeMap[idx]);
            vx += trans * pMx;
            vy += trans * pMy;
          }
        }

        const fSpd = Math.sqrt(vx * vx + vy * vy);
        if (fSpd > 0) { vx *= Math.SQRT2 / fSpd; vy *= Math.SQRT2 / fSpd; }

        x += vx; y += vy;
        dischargeTrack[idx] += volume;
        momentumXTrack[idx] += volume * vx;
        momentumYTrack[idx] += volume * vy;

        const out = (x < 0 || x >= size || y < 0 || y >= size);
        const hEnd = out ? hStart - 0.002 : this.terrain.getHeight(x | 0, y | 0);

        const cap = Math.max(0, (1 + entrainment * this.terrain.getDischarge(idx)) * (hStart - hEnd));
        const deficit = cap - sediment;

        if (deficit > 0) {
          const fSed = Math.min(sedimentMap[idx], deficit * sedimentErosionRate);
          sedimentMap[idx] -= fSed;
          let actual = fSed;
          const rem = deficit - (fSed / sedimentErosionRate);
          if (rem > 0) {
            const fBed = rem * bedrockErosionRate;
            bedrockMap[idx] -= fBed;
            actual += fBed;
          }
          sediment += actual;
        } else {
          const dep = -deficit * depositionRate;
          sedimentMap[idx] += dep;
          sediment -= dep;
        }

        this.terrain.updateTotalHeight(idx);
        volume *= (1 - evaporationRate);
        sediment *= (1 - evaporationRate);
        if (out) break;
        this.thermalErosion(x, y);
        age++;
      }
    }
  }

  thermalErosion(x, y) {
    const { size, heightMap, sedimentMap, bedrockMap } = this.terrain;
    const { maxHeightDiff, settlingRate } = this.params;
    const cx = x | 0, cy = y | 0;
    if (cx < 0 || cx >= size || cy < 0 || cy >= size) return;

    const cIdx = cy * size + cx;
    const cH = heightMap[cIdx];

    for (let n of this.neighbours) {
      const nx = cx + n.x, ny = cy + n.y;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      const nIdx = ny * size + nx;
      const nH = heightMap[nIdx];
      const diff = cH - nH;
      const excess = Math.abs(diff) - n.distance * maxHeightDiff;

      if (excess > 0) {
        const val = (settlingRate * excess) / 2;
        const sIdx = diff > 0 ? cIdx : nIdx;
        const tIdx = diff > 0 ? nIdx : cIdx;

        heightMap[sIdx] -= val;
        heightMap[tIdx] += val;

        const fSed = Math.min(val, sedimentMap[sIdx]);
        sedimentMap[sIdx] -= fSed;
        if (val - fSed > 0) bedrockMap[sIdx] -= (val - fSed);
        sedimentMap[tIdx] += val;
      }
    }
  }
}

class Renderer {
  constructor(terrain, params) {
    this.terrain = terrain;
    this.params = params;
    this.canvas2D = createImage(terrain.size, terrain.size);
  }

  render() {
    const { lightDir, flatColour, steepColour, sedimentColour, waterColour, skyColour } = this.params;
    const { terrain, canvas2D } = this;
    const { size, area, heightMap, sedimentMap } = terrain;

    const lMag = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2) || 1;
    const lX = lightDir.x / lMag, lY = lightDir.y / lMag, lZ = lightDir.z / lMag;

    canvas2D.loadPixels();
    for (let i = 0; i < area; i++) {
      const px = i << 2;
      const normal = terrain.getSurfaceNormal(i % size, (i / size) | 0);
      const diffuse = Math.max(0, normal.x * lX + normal.y * lY + normal.z * lZ);
      const sky = normal.y * 0.5 + 0.5;
      
      const shR = diffuse + (skyColour.r / 255) * sky * 0.15;
      const shG = diffuse + (skyColour.g / 255) * sky * 0.15;
      const shB = diffuse + (skyColour.b / 255) * sky * 0.15;

      const steep = 1 - normal.y;
      let r = (normal.y * flatColour.r + steep * steepColour.r) * shR;
      let g = (normal.y * flatColour.g + steep * steepColour.g) * shG;
      let b = (normal.y * flatColour.b + steep * steepColour.b) * shB;

      const sed = Math.min(1, sedimentMap[i] * 5);
      if (sed > 0) {
        r = (1 - sed) * r + sed * (sedimentColour.r * shR);
        g = (1 - sed) * g + sed * (sedimentColour.g * shG);
        b = (1 - sed) * b + sed * (sedimentColour.b * shB);
      }

      const wtr = Math.min(1, terrain.getDischarge(i));
      if (wtr > 0) {
        const wSh = Math.max(0.3, 1 - wtr * 0.25);
        r = (1 - wtr) * r + wtr * (waterColour.r * wSh * shR);
        g = (1 - wtr) * g + wtr * (waterColour.g * wSh * shG);
        b = (1 - wtr) * b + wtr * (waterColour.b * wSh * shB);
      }

      canvas2D.pixels[px] = r; canvas2D.pixels[px + 1] = g; canvas2D.pixels[px + 2] = b; canvas2D.pixels[px + 3] = 255;
    }
    canvas2D.updatePixels();
    image(canvas2D, 0, 0, width, height);
  }

  resize() {
    const canvasSize = min(windowWidth, windowHeight);
    resizeCanvas(canvasSize, canvasSize);
  }
}
