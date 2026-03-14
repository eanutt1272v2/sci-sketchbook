class Particle {
  float x, y;
  float heading;
  float headingSin, headingCos;
  
  int neighbourCount;
  int leftCount;
  int rightCount;
  int closeNeighbourCount;
  
  boolean highDensity;
  boolean visited;
  
  int gridX, gridY;
  
  private float radiusSquared;
  
  Particle() {
    x = random(width);
    y = random(height);
    heading = random(TWO_PI);
    headingSin = sin(heading);
    headingCos = cos(heading);
  }
  
  void setGridPosition(int gx, int gy) {
    gridX = gx;
    gridY = gy;
  }
  
  void countNeighbours(Grid grid, Species species) {
    neighbourCount = 0;
    leftCount = 0;
    rightCount = 0;
    closeNeighbourCount = 0;
    radiusSquared = species.radiusSquared;
    
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        for (Particle other : grid.getCell(gridX + i, gridY + j)) {
          if (other == this) continue;
          
          float dx = wrapDistance(other.x - x, width);
          float dy = wrapDistance(other.y - y, height);
          float distSq = dx * dx + dy * dy;
          
          if (distSq <= species.radiusSquared) {
            if (dx * headingSin - dy * headingCos > 0) {
              leftCount++;
            } else {
              rightCount++;
            }
            neighbourCount++;
          }
          
          if (distSq <= sq(3.9f)) {
            closeNeighbourCount++;
          }
        }
      }
    }
  }
  
  void move(Species species) {
    int turnDirection = (rightCount > leftCount) ? 1 : (rightCount < leftCount) ? -1 : 0;
    float turn = species.alphaRad + species.betaRad * neighbourCount * turnDirection;
    
    heading = (heading + turn) % TWO_PI;
    headingSin = sin(heading);
    headingCos = cos(heading);
    
    x = wrapCoordinate(x + species.velocity * headingCos, width);
    y = wrapCoordinate(y + species.velocity * headingSin, height);
  }
  
  void display(Theme theme) {
    colorMode(RGB, 255);
    fill(getDisplayColour());
    float pRadius = 2;
    rect(x - pRadius / 2, y - pRadius / 2, pRadius, pRadius);
  }
  
  private color getDisplayColour() {
    if (closeNeighbourCount > 15) return color(255, 80, 255);
    if (neighbourCount > 35) return color(255, 255, 100);
    if (neighbourCount > 15) return color(0, 0, 255);
    if (neighbourCount >= 13) return color(180, 100, 50);
    return color(80, 255, 80);
  }
  
  void updateHighDensity(int threshold) {
    highDensity = (neighbourCount >= threshold);
  }
  
  boolean isHighDensity() { return highDensity; }
  boolean isVisited() { return visited; }
  void markVisited() { visited = true; }
  void markUnvisited() { visited = false; }
  float getRadiusSquared() { return radiusSquared; }
  
  private float wrapDistance(float d, int dim) {
    if (d > dim / 2) return d - dim;
    if (d < -dim / 2) return d + dim;
    return d;
  }
  
  private float wrapCoordinate(float coord, int dim) {
    return (coord + dim) % dim;
  }
}