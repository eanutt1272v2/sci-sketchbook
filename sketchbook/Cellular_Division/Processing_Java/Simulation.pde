class Simulation {
  private Species species;
  private ArrayList<Particle> particles;
  private Grid spatialGrid;
  private CellTracker cellTracker;
  
  private float alpha = 180;
  private float beta = 17;
  private float gamma = 13.4f;
  private float radius = 15;
  private float trailAlpha = 200;
  private int densityThreshold = 20;
  private int particleCount;
  private int startTime;
  private boolean needsRestart = false;
  private boolean paused = false;
  
  Simulation() {
    this.particleCount = defaultParticleCount();
    restart();
  }
  
  private int defaultParticleCount() {
    float calibrationConst = 120.96f;
    return (int) ((width * height) / calibrationConst);
  }
  
  void restart() {
    species = new Species(alpha, beta, gamma, radius);
    particles = new ArrayList<Particle>();
    for (int i = 0; i < particleCount; i++) {
      particles.add(new Particle());
    }
    spatialGrid = new Grid(Config.GRID_SIZE);
    cellTracker = new CellTracker();
    startTime = millis();
    needsRestart = false;
  }
  
  void update() {
    if (needsRestart) {
      restart();
    }

    if (paused) {
      return;
    }
    
    spatialGrid.clear();
    for (Particle p : particles) {
      spatialGrid.add(p);
      p.markUnvisited();
    }
    
    for (Particle p : particles) {
      p.countNeighbours(spatialGrid, species);
      p.updateHighDensity(densityThreshold);
      p.move(species);
    }
    
    cellTracker.update(particles, spatialGrid);
  }
  
  void render() {
    drawTrail();
    
    strokeWeight(1);
    for (Particle p : particles) {
      p.display();
    }
  }
  
  private void drawTrail() {
    noStroke();
    fill(0, 255 - trailAlpha);
    rect(0, 0, width, height);
  }
  
  float getAlpha() { return alpha; }
  float getBeta() { return beta; }
  float getGamma() { return gamma; }
  float getRadius() { return radius; }
  float getTrailAlpha() { return trailAlpha; }
  int getDensityThreshold() { return densityThreshold; }
  int getParticleCount() { return particleCount; }
  int getCellPopulation() { return cellTracker.getPopulation(); }
  int getElapsedSeconds() { return (millis() - startTime) / 1000; }
  ArrayList<Integer> getCellHistory() { return cellTracker.getHistory(); }
  
  void setAlpha(float value) { alpha = constrain(value, 0, 360); updateSpecies(); }
  void setBeta(float value) { beta = constrain(value, 0, 90); updateSpecies(); }
  void setGamma(float value) { gamma = constrain(value, 0, 50); updateSpecies(); }
  void setRadius(float value) { radius = constrain(value, 5, 50); updateSpecies(); }
  void setTrailAlpha(float value) { trailAlpha = constrain(value, 0, 255); }
  void setDensityThreshold(int value) { densityThreshold = constrain(value, 1, 60); }
  void setParticleCount(int value) { particleCount = constrain(value, Config.MIN_PARTICLES, Config.MAX_PARTICLES); }
  
  void requestRestart() { needsRestart = true; }
  void togglePause() { paused = !paused; }
  boolean isPaused() { return paused; }
  
  private void updateSpecies() {
    species = new Species(alpha, beta, gamma, radius);
  }
}
