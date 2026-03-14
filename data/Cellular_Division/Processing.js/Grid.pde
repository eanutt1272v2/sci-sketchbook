class Grid {
  private final int cellSize;
  private final int cols;
  private final int rows;
  private ArrayList<Particle>[][] cells;
  
  Grid(int cellSize) {
    this.cellSize = cellSize;
    this.cols = ceil(width / (float) cellSize);
    this.rows = ceil(height / (float) cellSize);
    this.cells = new ArrayList[cols][rows];
    
    for (int i = 0; i < cols; i++) {
      for (int j = 0; j < rows; j++) {
        cells[i][j] = new ArrayList<Particle>();
      }
    }
  }
  
  void clear() {
    for (int i = 0; i < cols; i++) {
      for (int j = 0; j < rows; j++) {
        cells[i][j].clear();
      }
    }
  }
  
  void add(Particle p) {
    int gx = constrain(floor(p.x / cellSize), 0, cols - 1);
    int gy = constrain(floor(p.y / cellSize), 0, rows - 1);
    cells[gx][gy].add(p);
    p.setGridPosition(gx, gy);
  }
  
  ArrayList<Particle> getCell(int gx, int gy) {
    gx = (gx + cols) % cols;
    gy = (gy + rows) % rows;
    return cells[gx][gy];
  }
  
  int getCols() { return cols; }
  int getRows() { return rows; }
}