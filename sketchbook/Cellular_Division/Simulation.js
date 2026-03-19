class Simulation {
  constructor() {
    this.alpha = 180;
    this.beta = 17;
    this.gamma = 13.4;
    this.radius = 15;
    this.trailAlpha = 200;
    this.densityThreshold = 20;
    this.particleCount = this.defaultParticleCount();
    this.startTime = 0;
    this.needsRestart = false;
    this.paused = false;
    this.isRestarting = false;
    this.restartCursor = 0;
    this.restartChunkSize = 0;

    this.species = null;
    this.particles = [];
    this.spatialGrid = null;
    this.cellTracker = null;

    this.restart();
  }

  defaultParticleCount() {
    const calibrationConst = 120.96;
    return int((width * height) / calibrationConst);
  }

  restart() {
    this.species = new Species(this.alpha, this.beta, this.gamma, this.radius);
    this.particles = [];
    this.spatialGrid = new Grid(Config.GRID_SIZE);
    this.cellTracker = new CellTracker();
    this.startTime = millis();
    this.needsRestart = false;

    this.restartCursor = 0;
    this.restartChunkSize = max(200, int(this.particleCount / 12));
    this.isRestarting = true;

    this._buildParticlesChunk();
  }

  _buildParticlesChunk() {
    if (!this.isRestarting) return;

    const target = min(
      this.restartCursor + this.restartChunkSize,
      this.particleCount,
    );
    for (let i = this.restartCursor; i < target; i++) {
      this.particles.push(new Particle());
    }

    this.restartCursor = target;
    if (this.restartCursor >= this.particleCount) {
      this.isRestarting = false;
    }
  }

  update() {
    if (this.needsRestart) {
      this.restart();
    }

    if (this.isRestarting) {
      this._buildParticlesChunk();
      return;
    }

    if (this.paused) {
      return;
    }

    this.spatialGrid.clear();
    for (const p of this.particles) {
      this.spatialGrid.add(p);
      p.markUnvisited();
    }

    for (const p of this.particles) {
      p.countNeighbours(this.spatialGrid, this.species);
      p.updateHighDensity(this.densityThreshold);
      p.move(this.species);
    }

    this.cellTracker.update(this.particles, this.spatialGrid);
  }

  render() {
    this.drawTrail();

    strokeWeight(1);
    for (const p of this.particles) {
      p.display();
    }
  }

  drawTrail() {
    noStroke();
    fill(0, 255 - this.trailAlpha);
    rect(0, 0, width, height);
  }

  getAlpha() {
    return this.alpha;
  }

  getBeta() {
    return this.beta;
  }

  getGamma() {
    return this.gamma;
  }

  getRadius() {
    return this.radius;
  }

  getTrailAlpha() {
    return this.trailAlpha;
  }

  getDensityThreshold() {
    return this.densityThreshold;
  }

  getParticleCount() {
    return this.isRestarting ? this.particles.length : this.particleCount;
  }

  getCellPopulation() {
    return this.cellTracker.getPopulation();
  }

  getElapsedSeconds() {
    return int((millis() - this.startTime) / 1000);
  }

  getCellHistory() {
    return this.cellTracker.getHistory();
  }

  setAlpha(value) {
    this.alpha = constrain(value, 0, 360);
    this.updateSpecies();
  }

  setBeta(value) {
    this.beta = constrain(value, 0, 90);
    this.updateSpecies();
  }

  setGamma(value) {
    this.gamma = constrain(value, 0, 50);
    this.updateSpecies();
  }

  setRadius(value) {
    this.radius = constrain(value, 5, 50);
    this.updateSpecies();
  }

  setTrailAlpha(value) {
    this.trailAlpha = constrain(value, 0, 255);
  }

  setDensityThreshold(value) {
    this.densityThreshold = constrain(value, 1, 60);
  }

  setParticleCount(value) {
    this.particleCount = constrain(
      value,
      Config.MIN_PARTICLES,
      Config.MAX_PARTICLES,
    );
  }

  requestRestart() {
    this.needsRestart = true;
  }

  togglePause() {
    this.paused = !this.paused;
  }

  isPaused() {
    return this.paused;
  }

  updateSpecies() {
    this.species = new Species(this.alpha, this.beta, this.gamma, this.radius);
  }
}
