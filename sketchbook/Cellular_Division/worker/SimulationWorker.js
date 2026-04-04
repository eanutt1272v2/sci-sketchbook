"use strict";

if (typeof importScripts === "function") {
  importScripts("../../_shared/utils/WorkerSanitisers.js");
}

const _workerSanitisers =
  globalThis.WorkerSanitisers ||
  Object.freeze({
    toFiniteNumber(value, fallback = 0) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    },
    toInteger(value, fallback, min, max) {
      const numeric = Math.round(this.toFiniteNumber(value, fallback));
      return numeric < min ? min : numeric > max ? max : numeric;
    },
  });

const TWO_PI = Math.PI * 2;
const GRID_SIZE = 30;
const CELLS_INTERVAL = 15;
const MAX_PARTICLES = 300000;

const PARAM_LIMITS = Object.freeze({
  alpha: { min: 0, max: 360 },
  beta: { min: 0, max: 90 },
  gamma: { min: 0, max: 50 },
  radius: { min: 5, max: 50 },
  densityThreshold: { min: 1, max: 60 },
});

function radians(deg) {
  return (deg * Math.PI) / 180;
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

const toFiniteNumber = _workerSanitisers.toFiniteNumber;
const toInteger = _workerSanitisers.toInteger;

function sanitiseInitialMessage(msg) {
  const canvasW = toInteger(msg.canvasW, 800, 1, 16384);
  const canvasH = toInteger(msg.canvasH, 600, 1, 16384);

  return {
    canvasW,
    canvasH,
    alpha: clamp(toFiniteNumber(msg.alpha, 180), 0, 360),
    beta: clamp(toFiniteNumber(msg.beta, 17), 0, 90),
    gamma: clamp(toFiniteNumber(msg.gamma, 13.4), 0, 50),
    radius: clamp(toFiniteNumber(msg.radius, 15), 5, 50),
    densityThreshold: toInteger(msg.densityThreshold, 20, 1, 60),
    count: toInteger(msg.count, 0, 0, MAX_PARTICLES),
  };
}

function applyParamUpdate(key, value) {
  if (!Object.prototype.hasOwnProperty.call(PARAM_LIMITS, key)) return false;
  const limits = PARAM_LIMITS[key];
  state[key] = clamp(toFiniteNumber(value, state[key]), limits.min, limits.max);

  if (state.species) {
    state.species = new Species(
      state.alpha,
      state.beta,
      state.gamma,
      state.radius,
    );
  }
  return true;
}

function wrapCoordinate(v, dim) {
  if (v < 0) return v + dim;
  if (v >= dim) return v - dim;
  return v;
}

function wrapDistance(d, dim) {
  if (d > dim / 2) return d - dim;
  if (d < -dim / 2) return d + dim;
  return d;
}

class Species {
  constructor(alpha, beta, gamma, radius) {
    this.alphaRad = radians(alpha);
    this.betaRad = radians(beta);
    this.velocity = (radius * gamma) / 100.0;
    this.radiusSquared = radius * radius;
  }
}

class Grid {
  constructor(cellSize, canvasW, canvasH) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(canvasW / cellSize);
    this.rows = Math.ceil(canvasH / cellSize);
    this.cells = [];

    for (let i = 0; i < this.cols; i++) {
      this.cells[i] = [];
      for (let j = 0; j < this.rows; j++) {
        this.cells[i][j] = [];
      }
    }
  }

  clear() {
    for (let i = 0; i < this.cols; i++) {
      for (let j = 0; j < this.rows; j++) {
        this.cells[i][j].length = 0;
      }
    }
  }

  add(p, canvasW, canvasH) {
    const gx = Math.min(
      this.cols - 1,
      Math.max(0, Math.floor(p.x / this.cellSize)),
    );
    const gy = Math.min(
      this.rows - 1,
      Math.max(0, Math.floor(p.y / this.cellSize)),
    );
    this.cells[gx][gy].push(p);
    p.gridX = gx;
    p.gridY = gy;
  }

  getCell(gx, gy) {
    const wx = ((gx % this.cols) + this.cols) % this.cols;
    const wy = ((gy % this.rows) + this.rows) % this.rows;
    return this.cells[wx][wy];
  }
}

class Particle {
  constructor(canvasW, canvasH) {
    this.x = Math.random() * canvasW;
    this.y = Math.random() * canvasH;
    this.heading = Math.random() * TWO_PI;
    this.headingSin = Math.sin(this.heading);
    this.headingCos = Math.cos(this.heading);

    this.neighbourCount = 0;
    this.leftCount = 0;
    this.rightCount = 0;
    this.closeNeighbourCount = 0;

    this.highDensity = false;
    this.visited = false;

    this.gridX = 0;
    this.gridY = 0;
    this.radiusSquared = 0;
  }

  countNeighbours(grid, species, canvasW, canvasH) {
    this.neighbourCount = 0;
    this.leftCount = 0;
    this.rightCount = 0;
    this.closeNeighbourCount = 0;
    this.radiusSquared = species.radiusSquared;

    const closeR2 = 3.9 * 3.9;

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const cell = grid.getCell(this.gridX + i, this.gridY + j);
        for (const other of cell) {
          if (other === this) continue;

          const dx = wrapDistance(other.x - this.x, canvasW);
          const dy = wrapDistance(other.y - this.y, canvasH);
          const distSq = dx * dx + dy * dy;

          if (distSq <= species.radiusSquared) {
            if (dx * this.headingSin - dy * this.headingCos > 0) {
              this.leftCount++;
            } else {
              this.rightCount++;
            }
            this.neighbourCount++;
          }

          if (distSq <= closeR2) {
            this.closeNeighbourCount++;
          }
        }
      }
    }
  }

  move(species, canvasW, canvasH) {
    const turnDirection =
      this.rightCount > this.leftCount
        ? 1
        : this.rightCount < this.leftCount
          ? -1
          : 0;
    const turn =
      species.alphaRad + species.betaRad * this.neighbourCount * turnDirection;

    this.heading = (this.heading + turn) % TWO_PI;
    this.headingSin = Math.sin(this.heading);
    this.headingCos = Math.cos(this.heading);

    this.x = wrapCoordinate(
      this.x + species.velocity * this.headingCos,
      canvasW,
    );
    this.y = wrapCoordinate(
      this.y + species.velocity * this.headingSin,
      canvasH,
    );
  }

  updateHighDensity(threshold) {
    this.highDensity = this.neighbourCount >= threshold;
  }
}

class CellTracker {
  constructor(historyLen) {
    this.population = 0;
    this.frameCounter = 0;
    this.history = [];
    this.historyLen = historyLen;
  }

  update(particles, grid, canvasW, canvasH) {
    this.frameCounter++;
    if (this.frameCounter % CELLS_INTERVAL === 0) {
      this.population = this.computeCells(particles, grid, canvasW, canvasH);
    }
    this.history.push(this.population);
    if (this.history.length > this.historyLen) {
      this.history.shift();
    }
  }

  computeCells(particles, grid, canvasW, canvasH) {
    let count = 0;
    for (const p of particles) {
      if (p.highDensity && !p.visited) {
        this.floodFill(p, grid, canvasW, canvasH);
        count++;
      }
    }
    for (const p of particles) {
      p.visited = false;
    }
    return count;
  }

  floodFill(seed, grid, canvasW, canvasH) {
    const stack = [seed];
    seed.visited = true;

    while (stack.length > 0) {
      const current = stack.pop();
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          for (const neighbour of grid.getCell(
            current.gridX + i,
            current.gridY + j,
          )) {
            if (!neighbour.visited && neighbour.highDensity) {
              const dx = wrapDistance(neighbour.x - current.x, canvasW);
              const dy = wrapDistance(neighbour.y - current.y, canvasH);
              if (dx * dx + dy * dy <= current.radiusSquared) {
                neighbour.visited = true;
                stack.push(neighbour);
              }
            }
          }
        }
      }
    }
  }
}

const state = {
  canvasW: 0,
  canvasH: 0,

  alpha: 180,
  beta: 17,
  gamma: 13.4,
  radius: 15,
  densityThreshold: 20,

  species: null,
  particles: [],
  grid: null,
  cellTracker: null,

  startTime: Date.now(),
  paused: false,
};

function initSimulation(msg) {
  const safe = sanitiseInitialMessage(msg);

  state.canvasW = safe.canvasW;
  state.canvasH = safe.canvasH;
  state.alpha = safe.alpha;
  state.beta = safe.beta;
  state.gamma = safe.gamma;
  state.radius = safe.radius;
  state.densityThreshold = safe.densityThreshold;
  state.paused = false;

  state.species = new Species(
    state.alpha,
    state.beta,
    state.gamma,
    state.radius,
  );
  state.grid = new Grid(GRID_SIZE, state.canvasW, state.canvasH);
  state.cellTracker = new CellTracker(state.canvasW);
  state.startTime = Date.now();

  const count = safe.count;
  state.particles = new Array(count);
  for (let i = 0; i < count; i++) {
    state.particles[i] = new Particle(state.canvasW, state.canvasH);
  }
}

function tick() {
  if (state.paused || state.particles.length === 0) return;

  const { particles, grid, species, cellTracker, canvasW, canvasH } = state;

  grid.clear();
  for (const p of particles) {
    p.visited = false;
    grid.add(p, canvasW, canvasH);
  }

  for (const p of particles) {
    p.countNeighbours(grid, species, canvasW, canvasH);
    p.updateHighDensity(state.densityThreshold);
    p.move(species, canvasW, canvasH);
  }

  cellTracker.update(particles, grid, canvasW, canvasH);
}

function buildResult(reuseBuffer) {
  const n = state.particles.length;
  const requiredByteLength = n * 4 * Float32Array.BYTES_PER_ELEMENT;
  const outputBuffer =
    reuseBuffer instanceof ArrayBuffer &&
    reuseBuffer.byteLength === requiredByteLength
      ? reuseBuffer
      : new ArrayBuffer(requiredByteLength);
  const data = new Float32Array(outputBuffer);
  for (let i = 0; i < n; i++) {
    const p = state.particles[i];
    const base = i * 4;
    data[base] = p.x;
    data[base + 1] = p.y;
    data[base + 2] = p.closeNeighbourCount;
    data[base + 3] = p.neighbourCount;
  }

  const elapsed = Date.now() - state.startTime;

  return {
    type: "result",
    particleData: outputBuffer,
    particleCount: n,
    population: state.cellTracker.population,
    elapsed,
    paused: state.paused,
  };
}

self.onmessage = function (e) {
  const msg = e && e.data && typeof e.data === "object" ? e.data : {};

  if (typeof msg.type !== "string") return;

  switch (msg.type) {
    case "init":
    case "restart":
      initSimulation(msg);
      self.postMessage({ type: "ready" });
      break;

    case "tick": {
      tick();
      const reuseBuffer =
        msg.particleDataBuffer instanceof ArrayBuffer
          ? msg.particleDataBuffer
          : null;
      const result = buildResult(reuseBuffer);
      self.postMessage(result, [result.particleData]);
      break;
    }

    case "setParam":
      if (typeof msg.key !== "string") break;
      applyParamUpdate(msg.key, msg.value);
      break;

    case "setParticleCount": {
      const oldCount = state.particles.length;
      const newCount = toInteger(msg.count, oldCount, 0, MAX_PARTICLES);
      if (newCount > oldCount) {
        for (let i = oldCount; i < newCount; i++) {
          state.particles.push(new Particle(state.canvasW, state.canvasH));
        }
      } else {
        state.particles.length = newCount;
      }
      break;
    }

    case "setPaused":
      state.paused = Boolean(msg.value);
      break;

    default:
      break;
  }
};
