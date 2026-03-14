class CellTracker {
  private int population = 0;
  private int frameCounter = 0;
  private final ArrayList<Integer> history = new ArrayList<Integer>();
  
  void update(ArrayList<Particle> particles, Grid grid) {
    frameCounter++;
    if (frameCounter % Config.CELLS_INTERVAL == 0) {
      population = computeCells(particles, grid);
    }
    
    history.add(population);
    if (history.size() > width) {
      history.remove(0);
    }
  }
  
  int getPopulation() { return population; }
  ArrayList<Integer> getHistory() { return history; }
  
  private int computeCells(ArrayList<Particle> particles, Grid grid) {
    int count = 0;
    for (Particle p : particles) {
      if (p.isHighDensity() && !p.isVisited()) {
        floodFill(p, grid);
        count++;
      }
    }
    for (Particle p : particles) {
      p.markUnvisited();
    }
    return count;
  }
  
  private void floodFill(Particle seed, Grid grid) {
    ArrayList<Particle> stack = new ArrayList<Particle>();
    seed.markVisited();
    stack.add(seed);
    
    while (!stack.isEmpty()) {
      Particle current = stack.remove(stack.size() - 1);
      
      for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
          int nx = current.gridX + i;
          int ny = current.gridY + j;
          
          for (Particle neighbour : grid.getCell(nx, ny)) {
            if (!neighbour.isVisited() && neighbour.isHighDensity()) {
              float dx = wrapDistance(neighbour.x - current.x, width);
              float dy = wrapDistance(neighbour.y - current.y, height);
              
              if (dx * dx + dy * dy <= current.getRadiusSquared()) {
                neighbour.markVisited();
                stack.add(neighbour);
              }
            }
          }
        }
      }
    }
  }
  
  private float wrapDistance(float d, int dim) {
    if (d > dim / 2) return d - dim;
    if (d < -dim / 2) return d + dim;
    return d;
  }
}